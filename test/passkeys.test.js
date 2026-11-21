'use strict';
/* Llaves de acceso (huella, cara, PIN) del profesorado y la administracion: verificacion WebAuthn, migracion de la BD y servidor.
   Se prueba con un autenticador por software (test/helpers/soft-authenticator.js) que firma como un navegador con huella.
   El recorrido con un navegador real (autenticador virtual de Chrome) esta en tools/e2e-ui.mjs; un movil real NO se ha probado. */
const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const { SoftKey } = require('./helpers/soft-authenticator');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hc-pk-'));
process.env.DATA_DIR = dir; process.env.SSO_SECRET = 'secreto-de-prueba'; process.env.ADMIN_PASSWORD = 'clave-admin-larga'; process.env.BASE_URL = '';
process.env.PASSKEY_CHAL_TTL_MS = '1200';
delete process.env.NODE_ENV;
const W = require('../lib/webauthn');
const SSO = require('../lib/sso');
const { open } = require('../lib/db');
const { server, db } = require('../server');

let base, V = {};
test.before(async () => { await new Promise((r) => server.listen(0, r)); base = 'http://127.0.0.1:' + server.address().port; });
test.after(() => { server.close(); });

async function call(method, url, body, cookie) {
  const r = await fetch(base + url, { method, redirect: 'manual', headers: Object.assign({ 'X-Requested-With': 'historia', 'Content-Type': 'application/json' }, cookie ? { Cookie: cookie } : {}), body: body === undefined || body === null ? undefined : JSON.stringify(body) });
  let j = null; try { j = await r.json(); } catch (_) { /* sin cuerpo */ }
  return { s: r.status, j, h: r.headers };
}
const cookieOf = (r) => (r.h.getSetCookie ? r.h.getSetCookie() : []).map((c) => c.split(';')[0]).filter((c) => !/=$/.test(c)).join('; ');
const sign = (o) => SSO.sign(Object.assign({ iss: 'campus', jti: crypto.randomUUID(), iat: Date.now(), exp: Date.now() + 60e3, lang: 'es', subjects: [] }, o), 'secreto-de-prueba');
async function sso(o) { const r = await fetch(base + '/sso?t=' + encodeURIComponent(sign(o)), { redirect: 'manual' }); return (r.headers.get('set-cookie') || '').split(';')[0]; }
const actions = async (admin) => (await call('GET', '/api/audit', null, admin)).j.rows.map((a) => a.action);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function adminCookie() { if (!V.admin) V.admin = cookieOf(await call('POST', '/api/admin/login', { password: 'clave-admin-larga' })); return V.admin; }
async function teacher(email, name) {
  const admin = await adminCookie();
  assert.strictEqual((await call('POST', '/api/teachers', { email, name, password: 'contrasena-larga-1' }, admin)).s, 200);
  const cookie = cookieOf(await call('POST', '/api/teacher/login', { email, password: 'contrasena-larga-1' }));
  const me = (await call('GET', '/api/me', null, cookie)).j; return { cookie, id: me.id, email };
}
const keyFor = (u, o) => new SoftKey('127.0.0.1', base, Object.assign({ userHandle: String(u.id) }, o));
async function register(cookie, k, o = {}) {
  const r = await call('POST', '/api/passkeys/register/options', {}, cookie); if (r.s !== 200) return { r };
  return { r, v: await call('POST', '/api/passkeys/register/verify', { chal: r.j.chal, name: o.name || 'Prueba', credential: k.create(r.j.options, o) }, cookie) };
}
async function login(k, o) { const r = await call('POST', '/api/passkeys/login/options', {}); return { r, v: await call('POST', '/api/passkeys/login/verify', { chal: r.j.chal, credential: k.get(r.j.options, o) }) }; }

/* ------------------------------------------------------------------ verificacion (unidad) ------------------------------------------------------------------ */
test('verificacion: ES256, Ed25519 y RS256 se registran y firman; cualquier alteracion se rechaza', () => {
  const origin = 'https://historia.luisfs.com', rpId = 'historia.luisfs.com';
  for (const alg of ['es256', 'ed25519', 'rs256']) {
    const k = new SoftKey(rpId, origin, { alg }), ch = crypto.randomBytes(32).toString('base64url');
    const reg = W.verifyRegistration({ credential: k.create({ challenge: ch }), challenge: ch, origin, rpId });
    assert.strictEqual(reg.id, k.idB64, alg);
    const key = { publicKey: reg.publicKey, counter: reg.counter };
    const out = W.verifyAssertion({ credential: k.get({ challenge: ch }), challenge: ch, origin, rpId, key });
    assert.strictEqual(out.counter, 1, alg);
    const bad = (cred, c = ch, o = origin, r = rpId, kk = key) => assert.throws(() => W.verifyAssertion({ credential: cred, challenge: c, origin: o, rpId: r, key: kk }));
    bad(k.get({ challenge: ch }), 'otro-reto');
    bad(k.get({ challenge: ch }), ch, 'https://evil.example');
    bad(k.get({ challenge: ch }), ch, origin, 'otro.dominio');
    bad(k.get({ challenge: ch }, { uv: false }));                                                 // sin huella/PIN no vale
    bad(k.get({ challenge: ch }, { counter: 1 }), ch, origin, rpId, { publicKey: reg.publicKey, counter: 5 });   // contador que no avanza
    const t = k.get({ challenge: ch }); const sig = Buffer.from(t.response.signature, 'base64url'); sig[sig.length - 1] ^= 1; t.response.signature = sig.toString('base64url'); bad(t);
    const other = new SoftKey(rpId, origin, { alg }); bad(other.get({ challenge: ch }));          // firmada con otra clave
  }
});

test('verificacion: el registro rechaza sin verificacion de usuario, con otro rpId o con un identificador distinto', () => {
  const origin = 'https://historia.luisfs.com', rpId = 'historia.luisfs.com', k = new SoftKey(rpId, origin), ch = 'abc';
  assert.throws(() => W.verifyRegistration({ credential: k.create({ challenge: ch }, { uv: false }), challenge: ch, origin, rpId }));
  assert.throws(() => W.verifyRegistration({ credential: k.create({ challenge: ch }, { rpId: 'otro.dominio' }), challenge: ch, origin, rpId }));
  const c = k.create({ challenge: ch }); c.id = 'AAAA'; assert.throws(() => W.verifyRegistration({ credential: c, challenge: ch, origin, rpId }));
  assert.throws(() => W.verifyRegistration({ credential: { id: 'x', type: 'public-key', response: { clientDataJSON: 'e30', attestationObject: 'e30' } }, challenge: ch, origin, rpId }));
  assert.throws(() => W.cborDecode(Buffer.from([0xff])));
});

test('dominio (rpID): produccion exige https y un dominio real; si no, se desactivan con motivo; en desarrollo se usa el Host', () => {
  assert.deepStrictEqual(W.rpConfig({ BASE_URL: '' }, true, 'https://historia.luisfs.com').fixed, { id: 'historia.luisfs.com', origin: 'https://historia.luisfs.com' }, 'por defecto en produccion');
  assert.strictEqual(W.rpConfig({ BASE_URL: 'http://historia.luisfs.com' }, true, '').off, 'https');
  assert.strictEqual(W.rpConfig({ BASE_URL: 'https://localhost:3000' }, true, '').off, 'dominio');
  assert.strictEqual(W.rpConfig({ BASE_URL: 'esto no es una url' }, true, '').off, 'direccion');
  assert.deepStrictEqual(W.rpConfig({ BASE_URL: '' }, false, 'https://x'), { fixed: null, off: null, raw: '' }, 'en desarrollo sin BASE_URL: se usa la cabecera Host');
  assert.strictEqual(W.rpConfig({ BASE_URL: 'http://localhost:3000' }, false, '').fixed.id, 'localhost');
});

/* ------------------------------------------------------------------ migracion de la BD ------------------------------------------------------------------ */
test('migracion: una base anterior (sin la tabla de llaves) se abre, crea la tabla y no toca ningun dato; abrirla otra vez no cambia nada', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'hc-mig-'));
  const first = open(d);
  first.run("INSERT INTO users (email, name, role, created, pw) VALUES ('p@x.com','Profe','teacher','2026-01-01','hash:x')");
  first.run("INSERT INTO patients (code, data, created) VALUES ('P1','{\"nombre\":\"Ana\"}','2026-01-01')");
  first.run("INSERT INTO audit (ts, who, action, detail) VALUES ('2026-01-01','p@x.com','antiguo','')");
  first.raw.exec('DROP TABLE staff_passkeys; DROP INDEX IF EXISTS idx_staff_passkeys_user;');   // = la base de antes de este cambio
  first.raw.close();
  const before = new DatabaseSync(path.join(d, 'historia.db')); const snap = () => JSON.stringify(['users', 'patients', 'audit', 'sessions', 'charts', 'records'].map((t) => before.prepare('SELECT * FROM ' + t).all()));
  const s0 = snap(); assert.ok(!before.prepare("SELECT 1 FROM sqlite_master WHERE name = 'staff_passkeys'").get()); before.close();
  const migrated = open(d);
  assert.ok(migrated.get("SELECT 1 x FROM sqlite_master WHERE name = 'staff_passkeys'"), 'la tabla nueva existe');
  assert.deepStrictEqual(migrated.all("SELECT name FROM pragma_table_info('staff_passkeys') ORDER BY cid").map((c) => c.name), ['id', 'user_id', 'public_key', 'counter', 'transports', 'name', 'created', 'last_used', 'discoverable']);
  migrated.raw.close();
  const after = new DatabaseSync(path.join(d, 'historia.db')); const s1 = JSON.stringify(['users', 'patients', 'audit', 'sessions', 'charts', 'records'].map((t) => after.prepare('SELECT * FROM ' + t).all()));
  assert.strictEqual(s1, s0, 'ningun dato existente cambia'); after.close();
  const again = open(d); again.run("INSERT INTO staff_passkeys (id, user_id, public_key, created) VALUES ('k', 1, x'00', 'ya')"); again.raw.close();
  const third = open(d); assert.strictEqual(third.get('SELECT COUNT(*) n FROM staff_passkeys').n, 1, 'reabrir no vacia ni duplica'); third.raw.close();
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* Windows */ }
});

/* ------------------------------------------------------------------ servidor ------------------------------------------------------------------ */
test('sin llaves: no hay entrada por huella, el estado es publico y minimo, y la gestion exige sesion de profesorado o administracion', async () => {
  assert.deepStrictEqual((await call('GET', '/api/passkeys/state')).j, { enabled: true, reason: null, keys: false });
  assert.strictEqual((await call('POST', '/api/passkeys/login/options', {})).s, 404, 'sin llaves registradas');
  for (const [m, u] of [['GET', '/api/passkeys/list'], ['POST', '/api/passkeys/register/options'], ['POST', '/api/passkeys/register/verify'], ['POST', '/api/passkeys/check/options'], ['POST', '/api/passkeys/check/verify'], ['POST', '/api/passkeys/remove']]) {
    assert.strictEqual((await call(m, u, m === 'GET' ? undefined : {})).s, 401, m + ' ' + u + ' sin sesion');
  }
  const alu = await sso({ email: 'alu@x.com', name: 'Alumno Prueba' });
  for (const [m, u] of [['GET', '/api/passkeys/list'], ['POST', '/api/passkeys/register/options'], ['POST', '/api/passkeys/check/options'], ['POST', '/api/passkeys/remove']]) {
    assert.strictEqual((await call(m, u, m === 'GET' ? undefined : {}, alu)).s, 403, 'el alumnado no puede usar ' + u);
  }
  const admin = await adminCookie();
  const o = (await call('POST', '/api/passkeys/register/options', {}, admin)).j;
  assert.ok(o.chal && o.options.challenge && o.options.rp.id === '127.0.0.1', 'el rpID sale del Host cuando no hay BASE_URL (desarrollo)');
  const sel = o.options.authenticatorSelection;
  assert.strictEqual(sel.userVerification, 'required'); assert.strictEqual(sel.residentKey, 'required'); assert.strictEqual(sel.requireResidentKey, true);
  assert.strictEqual(o.options.attestation, 'none'); assert.ok(/@/.test(o.options.user.name), 'userName real');
  assert.strictEqual((await call('POST', '/api/passkeys/register/verify', { chal: o.chal, credential: { id: 'x', rawId: 'x', type: 'public-key', response: { clientDataJSON: 'e30', attestationObject: 'e30' } } }, admin)).s, 400, 'una credencial inventada no vale');
  assert.strictEqual((await call('POST', '/api/passkeys/register/verify', { credential: { id: 'x' } }, admin)).s, 400, 'sin reto no se registra');
  assert.deepStrictEqual((await call('GET', '/api/passkeys/list', undefined, admin)).j.passkeys, []);
  assert.strictEqual((await call('POST', '/api/passkeys/login/verify', { credential: { id: 'nada' } })).s, 401, 'sin reto ni llave no se entra');
});

test('profesorado: registrar una llave, entrar con ella (sesion de profesorado), comprobar sin abrir otra sesion, y queda auditado', async () => {
  const t = await teacher('profe1@x.com', 'Profe Uno'), k = keyFor(t);
  const { v } = await register(t.cookie, k, { name: 'Windows · Chrome' });
  assert.strictEqual(v.s, 200); assert.strictEqual(v.j.id, k.idB64);
  const list = (await call('GET', '/api/passkeys/list', undefined, t.cookie)).j.passkeys;
  assert.strictEqual(list.length, 1); assert.strictEqual(list[0].discoverable, 1); assert.strictEqual(list[0].name, 'Windows · Chrome');
  assert.deepStrictEqual((await call('GET', '/api/passkeys/state')).j.keys, true);
  /* comprobar (asistente): con sesion, sin lista y sin abrir otra sesion */
  const co = await call('POST', '/api/passkeys/check/options', {}, t.cookie); assert.strictEqual(co.j.options.allowCredentials, undefined);
  const cv = await call('POST', '/api/passkeys/check/verify', { chal: co.j.chal, credential: k.get(co.j.options) }, t.cookie);
  assert.strictEqual(cv.s, 200); assert.strictEqual(cookieOf(cv), '', 'la comprobacion no abre otra sesion');
  /* entrar sin sesion previa */
  const lo = await call('POST', '/api/passkeys/login/options', {});
  assert.strictEqual(lo.j.options.allowCredentials, undefined, 'entrada sin lista (credencial descubrible)'); assert.strictEqual(lo.j.options.userVerification, 'required'); assert.strictEqual(lo.j.options.rpId, '127.0.0.1');
  const lv = await call('POST', '/api/passkeys/login/verify', { chal: lo.j.chal, credential: k.get(lo.j.options) });
  assert.strictEqual(lv.s, 200); const sess = cookieOf(lv); assert.match(sess, /hid=/);
  assert.match(lv.h.get('set-cookie'), /HttpOnly/);
  const me = (await call('GET', '/api/me', null, sess)).j; assert.strictEqual(me.email, 'profe1@x.com'); assert.strictEqual(me.role, 'teacher'); assert.strictEqual(me.staff, true);
  assert.strictEqual((await call('GET', '/api/patients', null, sess)).s, 200, 'la sesion por llave vale como la de contrasena');
  const acts = await actions(await adminCookie()); for (const a of ['huella-anadida', 'huella-prueba', 'login-huella']) assert.ok(acts.includes(a), a + ' en ' + acts.join());
  /* la contrasena sigue entrando */
  assert.strictEqual((await call('POST', '/api/teacher/login', { email: t.email, password: 'contrasena-larga-1' })).s, 200, 'la contrasena sigue siendo la salida');
});

test('la administracion (cuenta local) tambien puede tener llave, y la contrasena de administracion sigue funcionando', async () => {
  const admin = await adminCookie(), me = (await call('GET', '/api/me', null, admin)).j, k = keyFor(me);
  assert.strictEqual((await register(admin, k, { name: 'Admin' })).v.s, 200);
  const l = await login(k); assert.strictEqual(l.v.s, 200);
  const sess = cookieOf(l.v), m2 = (await call('GET', '/api/me', null, sess)).j; assert.strictEqual(m2.role, 'admin');
  assert.strictEqual((await call('POST', '/api/admin/login', { password: 'clave-admin-larga' })).s, 200);
});

test('seguridad: ficha de un solo uso y con caducidad, contador, userHandle, verificacion de usuario y llaves ajenas', async () => {
  const t = await teacher('profe2@x.com', 'Profe Dos'), k = keyFor(t);
  assert.strictEqual((await register(t.cookie, k)).v.s, 200);
  /* un solo uso */
  const o1 = await call('POST', '/api/passkeys/login/options', {}), cred = k.get(o1.j.options);
  assert.strictEqual((await call('POST', '/api/passkeys/login/verify', { chal: o1.j.chal, credential: cred })).s, 200);
  assert.strictEqual((await call('POST', '/api/passkeys/login/verify', { chal: o1.j.chal, credential: cred })).j.error, 'challenge', 'la ficha no se reutiliza');
  /* repeticion de una firma antigua con un reto nuevo: el contador no avanza */
  const o2 = await call('POST', '/api/passkeys/login/options', {});
  assert.strictEqual((await call('POST', '/api/passkeys/login/verify', { chal: o2.j.chal, credential: k.get(o2.j.options, { counter: 1 }) })).j.error, 'verify', 'contador repetido');
  /* sin verificacion de usuario */
  const o3 = await call('POST', '/api/passkeys/login/options', {});
  assert.strictEqual((await call('POST', '/api/passkeys/login/verify', { chal: o3.j.chal, credential: k.get(o3.j.options, { uv: false }) })).j.error, 'verify');
  /* userHandle de otra cuenta */
  const o4 = await call('POST', '/api/passkeys/login/options', {});
  assert.strictEqual((await call('POST', '/api/passkeys/login/verify', { chal: o4.j.chal, credential: k.get(o4.j.options, { handle: '99999' }) })).j.error, 'verify');
  /* caducidad (PASSKEY_CHAL_TTL_MS=1200 solo en pruebas) */
  const o5 = await call('POST', '/api/passkeys/login/options', {}); await sleep(1400);
  assert.strictEqual((await call('POST', '/api/passkeys/login/verify', { chal: o5.j.chal, credential: k.get(o5.j.options) })).j.error, 'challenge', 'la ficha caduca');
  /* la ficha de un tipo no sirve para otro: la de registro no abre sesion */
  const reg = await call('POST', '/api/passkeys/register/options', {}, t.cookie);
  assert.strictEqual((await call('POST', '/api/passkeys/login/verify', { chal: reg.j.chal, credential: k.get(reg.j.options) })).s, 401);
  /* llaves ajenas: otra cuenta no ve, no quita ni comprueba con la llave de t */
  const u = await teacher('profe3@x.com', 'Profe Tres');
  assert.deepStrictEqual((await call('GET', '/api/passkeys/list', undefined, u.cookie)).j.passkeys, [], 'solo se ven las propias');
  assert.strictEqual((await call('POST', '/api/passkeys/remove', { id: k.idB64, confirm: true }, u.cookie)).s, 404);
  const co = await call('POST', '/api/passkeys/check/options', {}, u.cookie); assert.strictEqual(co.s, 404, 'sin llaves propias no hay comprobacion');
  const k2 = keyFor(u); await register(u.cookie, k2);
  const co2 = await call('POST', '/api/passkeys/check/options', {}, u.cookie);
  assert.strictEqual((await call('POST', '/api/passkeys/check/verify', { chal: co2.j.chal, credential: k.get(co2.j.options) }, u.cookie)).s, 401, 'la llave de otra cuenta no vale en la comprobacion');
  /* una llave no puede pasar de una cuenta a otra (mismo id de credencial) */
  const ro = await call('POST', '/api/passkeys/register/options', {}, u.cookie);
  assert.strictEqual((await call('POST', '/api/passkeys/register/verify', { chal: ro.j.chal, credential: k.create(ro.j.options) }, u.cookie)).s, 400);
});

test('registro: una llave no descubrible no se guarda; no hay segunda cuenta con la misma; y quitar la ultima pide confirmacion', async () => {
  const t = await teacher('profe4@x.com', 'Profe Cuatro'), k = keyFor(t);
  const r = await register(t.cookie, k, { rk: false }); assert.strictEqual(r.v.s, 400); assert.strictEqual(r.v.j.error, 'notdiscoverable');
  assert.deepStrictEqual((await call('GET', '/api/passkeys/list', undefined, t.cookie)).j.passkeys, []);
  assert.strictEqual((await register(t.cookie, k, { rk: undefined })).v.s, 200, 'si el navegador no informa credProps se guarda (la comprobacion del asistente lo confirma)');
  const k2 = keyFor(t); assert.strictEqual((await register(t.cookie, k2)).v.s, 200);
  const ex = (await call('POST', '/api/passkeys/register/options', {}, t.cookie)).j.options.excludeCredentials; assert.strictEqual(ex.length, 2, 'se excluyen las ya registradas');
  assert.strictEqual((await call('POST', '/api/passkeys/remove', { id: k.idB64 }, t.cookie)).s, 200, 'quitar una de dos no pide nada');
  assert.strictEqual((await call('POST', '/api/passkeys/remove', { id: k2.idB64 }, t.cookie)).j.error, 'last');
  assert.strictEqual((await call('POST', '/api/passkeys/remove', { id: k2.idB64, confirm: true }, t.cookie)).s, 200);
  assert.deepStrictEqual((await call('GET', '/api/passkeys/list', undefined, t.cookie)).j.passkeys, []);
  assert.strictEqual((await login(k2)).v.s, 401, 'una llave quitada ya no entra');
  assert.strictEqual((await call('POST', '/api/teacher/login', { email: t.email, password: 'contrasena-larga-1' })).s, 200, 'y la contrasena sigue valiendo');
});

test('baja del profesorado: la llave deja de entrar y se borra; una cuenta de alumnado nunca entra por llave', async () => {
  const admin = await adminCookie(), t = await teacher('profe5@x.com', 'Profe Cinco'), k = keyFor(t);
  assert.strictEqual((await register(t.cookie, k)).v.s, 200); assert.strictEqual((await login(k)).v.s, 200);
  assert.strictEqual((await call('DELETE', '/api/teachers/' + t.id, null, admin)).s, 200);
  assert.strictEqual((await login(k)).v.s, 401, 'dada de baja: la llave no entra');
  assert.strictEqual(db.get('SELECT COUNT(*) n FROM staff_passkeys WHERE user_id = ?', t.id).n, 0, 'las llaves se borran con la baja');
  /* una fila de llave puesta a la fuerza en una cuenta de alumnado (no se puede crear por la API) tampoco da paso */
  const st = await sso({ email: 'alu2@x.com', name: 'Alumna Dos' }); const sid = (await call('GET', '/api/me', null, st)).j.id, sk = keyFor({ id: sid });
  const reg = sk.create({ challenge: 'x' }); const parsed = W.verifyRegistration({ credential: reg, challenge: 'x', origin: base, rpId: '127.0.0.1' });
  db.run('INSERT INTO staff_passkeys (id, user_id, public_key, counter, created, discoverable) VALUES (?,?,?,?,?,1)', parsed.id, sid, parsed.publicKey, 0, 'ya');
  assert.strictEqual((await login(sk)).v.s, 401, 'el alumnado no entra por llave aunque exista la fila');
});

test('la vista previa «como alumno» y el alumnado no gestionan llaves', async () => {
  const admin = await adminCookie();
  const st = await sso({ email: 'alu3@x.com', name: 'Alumna Tres' }); const sid = (await call('GET', '/api/me', null, st)).j.id;
  const pid = (await call('POST', '/api/patients', { nombre: 'Ana', apellidos: 'Prueba Vila', sexo: 'F', fecha_nacimiento: '1950-05-09', nhc: '777', motivo_ingreso: 'x', diagnostico_medico: 'y' }, admin)).j.id;
  await call('POST', '/api/patients/' + pid + '/assign', { mode: 'individual', user_ids: [sid] }, admin);
  const chart = (await call('GET', '/api/patients/' + pid, null, admin)).j.charts[0];
  assert.strictEqual((await call('POST', '/api/charts/' + chart.id + '/preview', {}, admin)).s, 200);
  assert.strictEqual((await call('GET', '/api/passkeys/list', undefined, admin)).s, 403, 'en vista previa no se gestionan llaves');
  assert.strictEqual((await call('POST', '/api/passkeys/register/options', {}, admin)).s, 403);
  await call('POST', '/api/preview/exit', {}, admin);
});

test('intentos fallidos de entrada por llave se limitan por IP', async () => {
  for (let i = 0; i < 8; i++) await call('POST', '/api/passkeys/login/verify', { chal: 'inventada', credential: { id: 'x' } });
  /* un reto caducado/inventado no cuenta como intento fallido de firma; los de llave desconocida si */
  const k = new SoftKey('127.0.0.1', base);
  let last; for (let i = 0; i < 9; i++) { const o = await call('POST', '/api/passkeys/login/options', {}); if (o.s === 429) { last = o; break; } last = await call('POST', '/api/passkeys/login/verify', { chal: o.j.chal, credential: k.get(o.j.options) }); if (last.s === 429) break; }
  assert.strictEqual(last.s, 429); assert.strictEqual(last.j.error, 'rate');
});
