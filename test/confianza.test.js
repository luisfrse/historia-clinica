'use strict';
/* Dispositivo de confianza (profesorado y administración): alta solo con petición explícita, cookie propia con token de 256 bits (solo su hash en la base),
   reapertura sin acceso completo, rotación y detección de reutilización, caducidad, revocación, confirmación reforzada (contraseña y llave), cuentas ligadas,
   el alumnado nunca, y migración sobre una base antigua. Chrome real: tools/e2e-confianza.mjs. Un móvil real NO se ha probado. */
const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const { SoftKey } = require('./helpers/soft-authenticator');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hc-trust-'));
process.env.DATA_DIR = dir; process.env.SSO_SECRET = 'secreto-de-prueba'; process.env.ADMIN_PASSWORD = 'clave-admin-larga'; process.env.BASE_URL = '';
delete process.env.NODE_ENV;
const SSO = require('../lib/sso');
const { open } = require('../lib/db');
const { server, db } = require('../server');

let base; const V = {};
test.before(async () => { await new Promise((r) => server.listen(0, r)); base = 'http://127.0.0.1:' + server.address().port; });
test.after(() => { server.close(); });

async function call(method, url, body, cookie) {
  const r = await fetch(base + url, { method, redirect: 'manual', headers: Object.assign({ 'X-Requested-With': 'historia', 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile' }, cookie ? { Cookie: cookie } : {}), body: body === undefined || body === null ? undefined : JSON.stringify(body) });
  let j = null; try { j = await r.json(); } catch (_) { /* sin cuerpo */ }
  return { s: r.status, j, h: r.headers, sc: r.headers.getSetCookie ? r.headers.getSetCookie() : [] };
}
const pick = (r, name) => { const c = r.sc.find((x) => x.startsWith(name + '=')); return c ? c.split(';')[0] : ''; };
const TRUST = '__Host-hc-trust';
const sign = (o) => SSO.sign(Object.assign({ iss: 'campus', jti: crypto.randomUUID(), iat: Date.now(), exp: Date.now() + 60e3, lang: 'es', subjects: [] }, o), 'secreto-de-prueba');
async function sso(o) { const r = await fetch(base + '/sso?t=' + encodeURIComponent(sign(o)), { redirect: 'manual' }); return (r.headers.get('set-cookie') || '').split(';')[0]; }
const adminLogin = async () => pick(await call('POST', '/api/admin/login', { password: 'clave-admin-larga' }), 'hid');
async function teacher(email) {
  const admin = await adminLogin();
  assert.strictEqual((await call('POST', '/api/teachers', { email, name: 'Profe ' + email, password: 'contrasena-larga-1' }, admin)).s, 200);
  const r = await call('POST', '/api/teacher/login', { email, password: 'contrasena-larga-1' });
  return { hid: pick(r, 'hid'), email, id: (await call('GET', '/api/me', null, pick(r, 'hid'))).j.id };
}
/* acceso completo + alta del dispositivo: devuelve la cookie de confianza */
async function enroll(hid) { const r = await call('POST', '/api/trust/enroll', { trust: true }, hid); return { r, trust: pick(r, TRUST) }; }
const age = (ms) => db.run('UPDATE dc_trust SET rotated = rotated - ?', ms);
const actions = () => db.all('SELECT action FROM audit').map((a) => a.action);

test('el estado público dice si hay casilla y los días; sin petición explícita no se crea ningún token', async () => {
  const st = await call('GET', '/api/trust/state'); assert.strictEqual(st.s, 200); assert.strictEqual(st.j.enabled, true); assert.strictEqual(st.j.days, 14);
  const hid = await adminLogin();
  const a = await call('POST', '/api/trust/enroll', {}, hid); assert.strictEqual(a.s, 400); assert.strictEqual(pick(a, TRUST), '');
  const b = await call('POST', '/api/trust/enroll', { trust: false }, hid); assert.strictEqual(b.s, 400);
  assert.strictEqual(db.get('SELECT COUNT(*) n FROM dc_trust').n, 0);
  assert.strictEqual((await call('POST', '/api/trust/enroll', { trust: true })).s, 401, 'sin sesión no se da de alta nada');
});

test('alta con acceso completo: cookie HttpOnly, Secure, SameSite=Strict, 14 días; en la base solo el hash', async () => {
  const hid = await adminLogin(), { r, trust } = await enroll(hid);
  assert.strictEqual(r.s, 200); assert.ok(trust, 'cookie de confianza');
  const raw = r.sc.find((x) => x.startsWith(TRUST + '='));
  assert.match(raw, /HttpOnly/); assert.match(raw, /Secure/); assert.match(raw, /SameSite=Strict/); assert.match(raw, /Path=\//); assert.match(raw, new RegExp('Max-Age=' + 14 * 86400));
  const token = decodeURIComponent(trust.split('=')[1]);
  assert.ok(token.length >= 43, '256 bits en base64url');
  const row = db.get('SELECT * FROM dc_trust'); assert.notStrictEqual(row.hash, token); assert.strictEqual(row.hash, crypto.createHash('sha256').update(token).digest('hex'));
  assert.ok(!JSON.stringify(db.all('SELECT * FROM dc_trust')).includes(token), 'el token nunca se guarda');
  assert.strictEqual(db.get('SELECT user_id FROM dc_trust_user WHERE trust_id = ?', row.id).user_id, (await call('GET', '/api/me', null, hid)).j.id);
  assert.ok(actions().includes('confianza-alta'));
  V.admin = { hid, trust };
});

test('reapertura sin pedir nada: abre sesión de confianza, rota el token y la sesión no es de acceso reciente', async () => {
  const r = await call('GET', '/api/me', null, V.admin.trust);
  assert.strictEqual(r.s, 200); assert.strictEqual(r.j.role, 'admin'); assert.strictEqual(r.j.trusted, true); assert.strictEqual(r.j.strong, false);
  const next = pick(r, TRUST); assert.ok(next && next !== V.admin.trust, 'token rotado'); assert.ok(pick(r, 'hid'));
  const s = db.get('SELECT * FROM sessions WHERE hash = ?', crypto.createHash('sha256').update(pick(r, 'hid').split('=')[1]).digest('hex'));
  assert.strictEqual(s.trusted, 1); assert.ok(s.trust_id); assert.strictEqual(s.strong_until, 0);
  V.old = V.admin.trust; V.admin.trust = next; V.admin.trustedHid = pick(r, 'hid');
});

test('una sesión de confianza no puede dar de alta otro dispositivo ni usar el acceso como completo', async () => {
  const r = await call('POST', '/api/trust/enroll', { trust: true }, V.admin.trustedHid);
  assert.strictEqual(r.s, 403); assert.strictEqual(pick(r, TRUST), '');
});

test('petición paralela con el token recién rotado: se acepta sin rotar ni revocar; pasada la gracia, la reutilización revoca la familia', async () => {
  const par = await call('GET', '/api/me', null, V.old);   // dentro de los 15 s
  assert.strictEqual(par.s, 200); assert.strictEqual(pick(par, TRUST), '', 'no rota en la ventana de gracia');
  age(60e3);
  const bad = await call('GET', '/api/me', null, V.old);
  assert.strictEqual(bad.s, 401); assert.match(bad.sc.join(' '), new RegExp(TRUST + '=;'), 'se retira la cookie');
  assert.ok(actions().includes('confianza-reutilizado'));
  assert.strictEqual((await call('GET', '/api/me', null, V.admin.trust)).s, 401, 'también el token vigente de esa familia');
  assert.strictEqual((await call('GET', '/api/me', null, V.admin.trustedHid)).s, 401, 'y las sesiones nacidas de ese dispositivo');
});

test('confirmación reforzada: la sesión de confianza pide confirmar para exportar y borrar; la contraseña (o la llave) la concede 10 minutos', async () => {
  const hid = await adminLogin(), { trust } = await enroll(hid);
  const t = await call('GET', '/api/me', null, trust), th = pick(t, 'hid');
  for (const [m, u] of [['GET', '/api/grades.csv'], ['GET', '/api/reports.zip'], ['GET', '/api/patients/1/case.pdf'], ['GET', '/api/students/1/report.pdf'], ['POST', '/api/cleanup'], ['POST', '/api/patients/1/delete'], ['DELETE', '/api/charts/1'], ['POST', '/api/teachers'], ['DELETE', '/api/teachers/1'], ['PUT', '/api/users/1'], ['POST', '/api/passkeys/register/options'], ['POST', '/api/passkeys/remove']]) {
    const r = await call(m, u, m === 'GET' ? null : {}, th); assert.strictEqual(r.s, 403, m + ' ' + u); assert.strictEqual(r.j.error, 'stepup', m + ' ' + u);
  }
  const noPw = await call('POST', '/api/stepup/password', { password: 'mal' }, th); assert.strictEqual(noPw.s, 403); assert.strictEqual(noPw.j.error, 'bad');
  assert.strictEqual((await call('GET', '/api/grades.csv', null, th)).s, 403, 'una contraseña errónea no concede nada');
  assert.strictEqual((await call('POST', '/api/stepup/password', { password: 'clave-admin-larga' }, th)).s, 200);
  assert.strictEqual((await call('GET', '/api/grades.csv', null, th)).s, 200);
  assert.strictEqual((await call('GET', '/api/me', null, th)).j.strong, true);
  db.run('UPDATE sessions SET strong_until = ? WHERE hash = ?', Date.now() - 1, crypto.createHash('sha256').update(th.split('=')[1]).digest('hex'));
  assert.strictEqual((await call('GET', '/api/grades.csv', null, th)).s, 403, 'caduca a los 10 minutos');
  assert.strictEqual((await call('GET', '/api/grades.csv', null, hid)).s, 200, 'una sesión de acceso completo se comporta como siempre');
  assert.ok(actions().includes('confirmacion'));
});

test('confirmación con llave: sirve para borrar tras abrir con la cookie de confianza', async () => {
  const tch = await teacher('llave@x.com'), k = new SoftKey('127.0.0.1', base, { userHandle: String(tch.id) });
  const ro = await call('POST', '/api/passkeys/register/options', {}, tch.hid); assert.strictEqual(ro.s, 200);
  assert.strictEqual((await call('POST', '/api/passkeys/register/verify', { chal: ro.j.chal, name: 'T', credential: k.create(ro.j.options) }, tch.hid)).s, 200);
  const { trust } = await enroll(tch.hid), t = await call('GET', '/api/me', null, trust), th = pick(t, 'hid');
  assert.strictEqual(t.j.keys, 1);
  assert.strictEqual((await call('POST', '/api/cleanup', { scope: 'x' }, th)).s, 403);
  const o = await call('POST', '/api/stepup/passkey/options', {}, th); assert.strictEqual(o.s, 200);
  const v = await call('POST', '/api/stepup/passkey/verify', { chal: o.j.chal, credential: k.get(o.j.options) }, th); assert.strictEqual(v.s, 200);
  assert.notStrictEqual((await call('POST', '/api/cleanup', { scope: 'x' }, th)).s, 403, 'ya no pide confirmar');
});

test('cada cuenta ve y revoca solo sus dispositivos; la cookie solo abre la sesión de su cuenta; revocar pide confirmación reciente', async () => {
  const tch = await teacher('uno@x.com'), { trust } = await enroll(tch.hid);
  const t = await call('GET', '/api/me', null, trust); assert.strictEqual(t.j.email, 'uno@x.com');
  const th0 = pick(t, 'hid'), tr2 = pick(t, TRUST), th = th0 + '; ' + tr2;   // el navegador manda las dos cookies
  const own = await call('GET', '/api/trust/list', null, th); assert.strictEqual(own.s, 200); assert.strictEqual(own.j.devices.length, 1); assert.strictEqual(own.j.devices[0].current, true); assert.strictEqual(own.j.days, 14);
  const admin = await adminLogin(), all = await call('GET', '/api/trust/list', null, admin);
  assert.ok(!all.j.devices.some((d) => d.id === own.j.devices[0].id), 'la administración no ve los de otra cuenta');
  assert.strictEqual((await call('POST', '/api/trust/revoke', { id: own.j.devices[0].id }, admin)).s, 404, 'ni los revoca');
  assert.strictEqual((await call('POST', '/api/trust/revoke', { id: own.j.devices[0].id }, th)).s, 403, 'desde una sesión de confianza sin confirmar, no');
  assert.strictEqual((await call('POST', '/api/trust/revoke-all', {}, th)).s, 403);
  await call('POST', '/api/stepup/password', { password: 'contrasena-larga-1' }, th);
  const rv = await call('POST', '/api/trust/revoke-all', {}, th); assert.strictEqual(rv.s, 200);
  assert.match(rv.sc.join(' '), new RegExp(TRUST + '=;'));
  assert.strictEqual((await call('GET', '/api/me', null, tr2)).s, 401);
  assert.strictEqual((await call('GET', '/api/me', null, th0)).s, 401, 'revocar cierra las sesiones de ese dispositivo');
  assert.ok(actions().includes('confianza-revocado'));
});

test('el alumnado nunca: ni da de alta ni su sesión abre con una cookie de confianza', async () => {
  const stu = await sso({ email: 'alumno@x.com', name: 'Alumno', admin: false });
  assert.ok(stu);
  assert.strictEqual((await call('POST', '/api/trust/enroll', { trust: true }, stu)).s, 403);
  assert.strictEqual((await call('GET', '/api/trust/list', null, stu)).s, 403);
  // una cookie de confianza ligada a una cuenta que ya no es de profesorado/administración no abre nada y se retira
  const tch = await teacher('degradado@x.com'), { trust } = await enroll(tch.hid);
  db.run("UPDATE users SET role = 'student' WHERE id = ?", tch.id);
  const r = await call('GET', '/api/me', null, trust); assert.strictEqual(r.s, 401); assert.match(r.sc.join(' '), new RegExp(TRUST + '=;'));
  assert.strictEqual(db.get('SELECT COUNT(*) n FROM dc_trust_user WHERE user_id = ?', tch.id).n, 0);
});

test('caducidad: pasados los 14 días sin uso (o el tope absoluto) hay que entrar de nuevo', async () => {
  const hid = await adminLogin(), { trust } = await enroll(hid);
  db.run('UPDATE dc_trust SET expires = ?', Date.now() - 1);
  const r = await call('GET', '/api/me', null, trust); assert.strictEqual(r.s, 401);
  assert.ok(actions().includes('confianza-caducada'));
  const again = await enroll(hid); db.run('UPDATE dc_trust SET abs_expires = ?', Date.now() - 1);
  assert.strictEqual((await call('GET', '/api/me', null, again.trust)).s, 401);
});

test('salir revoca este dispositivo; dar de baja a una cuenta o ponerle contraseña nueva revoca los suyos; los demás siguen', async () => {
  const hid = await adminLogin(), a = await enroll(hid), t1 = await teacher('baja@x.com'), b = await enroll(t1.hid), t2 = await teacher('clave@x.com'), c = await enroll(t2.hid);
  const out = await call('POST', '/api/logout', {}, a.trust); assert.strictEqual(out.s, 200);   // solo la cookie de confianza, sin sesión
  assert.strictEqual((await call('GET', '/api/me', null, a.trust)).s, 401, 'salir sin sesión también quita la confianza');
  const admin = await adminLogin();
  assert.strictEqual((await call('DELETE', '/api/teachers/' + t1.id, null, admin)).s, 200);
  assert.strictEqual((await call('GET', '/api/me', null, b.trust)).s, 401, 'baja de la cuenta');
  assert.strictEqual((await call('GET', '/api/me', null, c.trust)).s, 200, 'otra cuenta no se toca');
  const c2 = pick(await call('GET', '/api/me', null, c.trust), TRUST) || c.trust;
  assert.strictEqual((await call('POST', '/api/teachers', { email: 'clave@x.com', name: 'X', password: 'otra-contrasena-2' }, admin)).s, 200);
  assert.strictEqual((await call('GET', '/api/me', null, c2)).s, 401, 'contraseña nueva');
});

test('un cambio de ADMIN_PASSWORD entre arranques revoca todos los dispositivos', () => {
  const { createTrust } = require('../lib/dc/confianza.cjs');
  const d = new DatabaseSync(':memory:'), tr = createTrust({ db: d, days: 14, cookieName: 'x-trust' });
  assert.strictEqual(tr.watchSecret('contraseña', 'una'), false);
  tr.enroll({ ua: 'Chrome Android' }); assert.strictEqual(tr.list('').length, 1);
  assert.strictEqual(tr.watchSecret('contraseña', 'una'), false); assert.strictEqual(tr.list('').length, 1);
  assert.strictEqual(tr.watchSecret('contraseña', 'otra'), true); assert.strictEqual(tr.list('').length, 0);
});

test('sin token todo funciona como antes: sesiones normales, 401 sin sesión, cookie basura ignorada', async () => {
  assert.strictEqual((await call('GET', '/api/me')).s, 401);
  assert.strictEqual((await call('GET', '/api/me', null, TRUST + '=' + 'x'.repeat(43))).s, 401);
  const hid = await adminLogin(); assert.strictEqual((await call('GET', '/api/me', null, hid)).j.trusted, false);
  assert.strictEqual((await call('GET', '/api/me', null, hid)).j.strong, true, 'acceso completo = reciente');
});

test('migración aditiva: una base antigua (sin columnas ni tabla) se abre, conserva sesiones y gana lo nuevo', () => {
  const d2 = fs.mkdtempSync(path.join(os.tmpdir(), 'hc-old-'));
  const old = new DatabaseSync(path.join(d2, 'historia.db'));
  old.exec("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT 'student', profile TEXT NOT NULL DEFAULT 'enfermeria', profile_manual INTEGER NOT NULL DEFAULT 0, lang TEXT NOT NULL DEFAULT 'es', subjects TEXT NOT NULL DEFAULT '[]', active INTEGER NOT NULL DEFAULT 1, created TEXT NOT NULL, last_login TEXT)");
  old.exec('CREATE TABLE sessions (hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, exp INTEGER NOT NULL)');
  old.exec("INSERT INTO users (email, created) VALUES ('a@x.com','2026-01-01')"); old.exec("INSERT INTO sessions VALUES ('h1', 1, 99999999999999)");
  old.close();
  const m = open(d2);
  const cols = m.all('PRAGMA table_info(sessions)').map((c) => c.name);
  for (const c of ['trusted', 'trust_id', 'strong_until']) assert.ok(cols.includes(c), c);
  assert.strictEqual(m.get('SELECT trusted, strong_until FROM sessions').trusted, 0); assert.ok(m.get("SELECT name FROM sqlite_master WHERE name = 'dc_trust_user'"));
  open(d2).raw.close();   // reabrir no falla (idempotente)
});
