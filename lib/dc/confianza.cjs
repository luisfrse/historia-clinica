'use strict';
/* diseno-comun · entrada/servidor/confianza.cjs — «Dispositivo de confianza» (módulo de servidor, sin dependencias).
   Receta completa y lista de acciones sensibles por app: docs/dispositivo-confianza.md.

   QUÉ HACE. Tras un acceso COMPLETO normal (lo que exija la app: contraseña + segundo factor, o llave) y solo si la persona marca «Confiar en este dispositivo»,
   el servidor entrega una cookie con un token aleatorio de 256 bits. Con ella, mientras no caduque, el dispositivo abre sesión sin PIN, sin huella y sin
   bloqueo por inactividad. Nunca se crea un token sin esa petición explícita, y no se crea desde una sesión que ya vino de un token de confianza.

   GARANTÍAS.
   - En la base solo se guarda SHA-256 del token (nunca el token). Cookie HttpOnly, SameSite=Strict, Secure.
   - Caducidad deslizante (days desde el último uso) con tope absoluto (absoluteDays desde el alta).
   - Rotación en cada uso: el token se cambia al restaurar una sesión. Si un token YA ROTADO reaparece fuera de la ventana de gracia (15 s, para
     peticiones paralelas), se interpreta como robo: se revoca TODA la familia (ese dispositivo) y se exige acceso completo.
   - Las acciones sensibles piden requireStrong(): una confirmación reciente aunque la sesión sea de confianza.
   - Auditoría de altas, usos desde un navegador distinto del dado de alta, reutilizaciones y revocaciones, sin IP ni datos personales.

   USO MÍNIMO (CommonJS):
     const { createTrust } = require('./dc/confianza.cjs');
     const trust = createTrust({ db, days: 90, cookieName: 'app-trust', secure: true, audit: (a, d) => db.audit('', a, d), notify: (n) => push(n), onRevoke: (ids) => borrarSesiones(ids) });
     // al abrir sesión desde la cookie de confianza:   const r = trust.restore({ cookie: cookieHeader, ua, ip })  →  { ok, id, setCookie, clearCookie, reason }
     // rutas /api/trust/* (lista, alta, revocar):       const out = await trust.handle({ method, path, ua, ip, cookie, body, session })  →  null | { status, body, headers }
   `db` puede ser un envoltorio con get/all/run (posicionales) o un DatabaseSync de node:sqlite. */
const crypto = require('node:crypto');

const DAY = 86400e3;
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const newToken = () => crypto.randomBytes(32).toString('base64url');      // 256 bits
const clampInt = (v, lo, hi, d) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS dc_trust (
    id TEXT PRIMARY KEY, hash TEXT NOT NULL UNIQUE, prev_hash TEXT, rotated INTEGER NOT NULL DEFAULT 0,
    label TEXT NOT NULL DEFAULT '', ua_sum TEXT NOT NULL DEFAULT '', created INTEGER NOT NULL, last_used INTEGER NOT NULL,
    expires INTEGER NOT NULL, abs_expires INTEGER NOT NULL, uses INTEGER NOT NULL DEFAULT 0)`,
  'CREATE INDEX IF NOT EXISTS dc_trust_prev ON dc_trust(prev_hash)',
  /* hashes de tokens ya rotados (los últimos 20 por dispositivo): si uno reaparece, es una reutilización aunque hayan pasado varias rotaciones */
  'CREATE TABLE IF NOT EXISTS dc_trust_old (hash TEXT PRIMARY KEY, id TEXT NOT NULL, retired INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS dc_trust_old_id ON dc_trust_old(id, retired)',
  'CREATE TABLE IF NOT EXISTS dc_trust_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)'
];

/* acepta un envoltorio {get,all,run} o un DatabaseSync */
function adapt(db) {
  if (typeof db.get === 'function' && typeof db.all === 'function' && typeof db.run === 'function') return { get: (s, ...p) => db.get(s, ...p), all: (s, ...p) => db.all(s, ...p), run: (s, ...p) => db.run(s, ...p) };
  return {
    get: (s, ...p) => db.prepare(s).get(...p), all: (s, ...p) => db.prepare(s).all(...p),
    run: (s, ...p) => { const r = db.prepare(s).run(...p); return { changes: Number(r.changes) }; }
  };
}

/* «Chrome · Android»: navegador y sistema, sin versiones (las versiones cambian solas y no deben parecer un dispositivo distinto) */
function summarizeUa(ua) {
  ua = String(ua || '');
  const os = /android/i.test(ua) ? 'Android' : /iphone|ipad|ipod/i.test(ua) ? 'iOS' : /windows/i.test(ua) ? 'Windows' : /cros/i.test(ua) ? 'ChromeOS' : /mac os|macintosh/i.test(ua) ? 'macOS' : /linux/i.test(ua) ? 'Linux' : 'Dispositivo';
  const br = /edg(e|a|ios)?\//i.test(ua) ? 'Edge' : /opr\/|opera/i.test(ua) ? 'Opera' : /firefox|fxios/i.test(ua) ? 'Firefox' : /samsungbrowser/i.test(ua) ? 'Samsung Internet' : /chrome|crios|chromium/i.test(ua) ? 'Chrome' : /safari/i.test(ua) ? 'Safari' : 'Navegador';
  return br + ' · ' + os;
}
function cookieValue(header, name) {
  for (const part of String(header || '').split(';')) { const i = part.indexOf('='); if (i > 0 && part.slice(0, i).trim() === name) { try { return decodeURIComponent(part.slice(i + 1).trim()); } catch (_) { return ''; } } }
  return '';
}

/* ¿vale la sesión para una acción sensible? ctx = { trusted, strongUntil, always, now }
   - sesión de confianza: hace falta una confirmación vigente (strongUntil > ahora).
   - sesión normal: solo si la app lo pide siempre (always: true, como Control); si no, vale (comportamiento anterior de la app).
   Devuelve null si vale o { status: 403, body: { error: 'stepup' } } para devolverlo tal cual. */
function isStrong(ctx) {
  ctx = ctx || {}; const now = ctx.now || Date.now();
  if (!ctx.trusted && !ctx.always) return true;
  return !!ctx.strongUntil && ctx.strongUntil > now;
}
function requireStrong(ctx) { return isStrong(ctx) ? null : { status: 403, body: { error: 'stepup' } }; }

function createTrust(o) {
  o = o || {};
  if (!o.db) throw new Error('confianza: falta db');
  const q = adapt(o.db), now = o.now || (() => Date.now());
  const days = clampInt(o.days, 1, 365, 90), absoluteDays = clampInt(o.absoluteDays, days, 730, Math.min(365, days * 4));
  const cookieName = o.cookieName || 'dc-trust', secure = o.secure !== false, prefix = (o.prefix || '/api/trust').replace(/\/+$/, '');
  const maxDevices = clampInt(o.maxDevices, 1, 50, 10), graceMs = clampInt(o.graceMs, 0, 120000, 15000);
  const disabled = typeof o.disabled === 'function' ? o.disabled : () => false;
  const audit = (a, d) => { try { if (o.audit) o.audit(a, d || ''); } catch (_) { /* la auditoría nunca rompe el acceso */ } };
  const notify = (n) => { try { const r = o.notify && o.notify(n); if (r && r.catch) r.catch(() => {}); } catch (_) { /* idem */ } };
  const onRevoke = (ids) => { try { if (o.onRevoke) o.onRevoke(ids); } catch (_) { /* idem */ } };
  for (const s of SCHEMA) q.run(s);

  /* límite de intentos con token inválido, por IP (un token de 256 bits no se adivina, pero se frena igualmente) */
  const fails = new Map();
  const failsOf = (ip) => { const t = now(), a = (fails.get(ip) || []).filter((x) => t - x < 15 * 60e3); fails.set(ip, a); return a; };
  const limited = (ip) => !!ip && failsOf(ip).length >= 20;
  const failed = (ip) => { if (ip) failsOf(ip).push(now()); };

  const cookieHeader = (token) => cookieName + '=' + encodeURIComponent(token) + '; Path=/; HttpOnly; SameSite=Strict' + (secure ? '; Secure' : '') + '; Max-Age=' + Math.floor(days * DAY / 1000);
  const clearCookie = () => cookieName + '=; Path=/; HttpOnly; SameSite=Strict' + (secure ? '; Secure' : '') + '; Max-Age=0';
  const short = (id) => String(id).slice(0, 8);
  const publicDevice = (r, currentId) => ({ id: r.id, label: r.label, created: r.created, last_used: r.last_used, expires: Math.min(r.expires, r.abs_expires), current: r.id === currentId });

  const drop = (id) => { q.run('DELETE FROM dc_trust WHERE id = ?', id); q.run('DELETE FROM dc_trust_old WHERE id = ?', id); };
  function sweep() { const t = now(), gone = q.all('SELECT id FROM dc_trust WHERE expires < ? OR abs_expires < ?', t, t); gone.forEach((r) => drop(r.id)); return gone.length; }

  /* alta: SOLO se llama con una sesión de acceso completo y reciente, y tras la petición explícita de la persona */
  function enroll({ ua, replaceCookie } = {}) {
    if (disabled()) return { ok: false, error: 'disabled' };
    const t = now(); sweep();
    if (replaceCookie) { const old = rowOfToken(replaceCookie); if (old) drop(old.row.id); }
    const rows = q.all('SELECT id FROM dc_trust ORDER BY last_used'); while (rows.length >= maxDevices) { const gone = rows.shift(); drop(gone.id); onRevoke([gone.id]); audit('confianza-retirado-por-limite', short(gone.id)); }
    const token = newToken(), id = crypto.randomBytes(12).toString('hex'), label = summarizeUa(ua);
    q.run('INSERT INTO dc_trust (id, hash, label, ua_sum, created, last_used, expires, abs_expires) VALUES (?,?,?,?,?,?,?,?)', id, sha256(token), label, label, t, t, t + days * DAY, t + absoluteDays * DAY);
    audit('confianza-alta', label + ' · ' + short(id));
    notify({ kind: 'security', level: 'info', title: 'Nuevo dispositivo de confianza', body: label + ' ya no pedirá PIN ni huella durante ' + days + ' días. Si no has sido tú, revócalo en Seguridad.' });
    return { ok: true, id, setCookie: cookieHeader(token), device: { id, label, created: t, expires: t + days * DAY } };
  }

  function rowOfToken(token) {
    if (!token || typeof token !== 'string' || token.length < 40 || token.length > 64) return null;
    const h = sha256(token);
    let row = q.get('SELECT * FROM dc_trust WHERE hash = ?', h);
    if (row) return { row, current: true };
    row = q.get('SELECT * FROM dc_trust WHERE prev_hash = ?', h);
    if (row) return { row, current: false };
    const old = q.get('SELECT id FROM dc_trust_old WHERE hash = ?', h);
    row = old ? q.get('SELECT * FROM dc_trust WHERE id = ?', old.id) : null;
    return row ? { row, current: false, old: true } : null;
  }

  /* abre sesión desde la cookie. Rota el token. Devuelve { ok, id, setCookie } o { ok:false, reason, clearCookie? } (reason: none|rate|invalid|expired|reused|disabled) */
  function restore({ cookie, ua, ip } = {}) {
    const token = cookieValue(cookie, cookieName);
    if (!token) return { ok: false, reason: 'none' };
    if (disabled()) return { ok: false, reason: 'disabled', clearCookie: clearCookie() };
    if (limited(ip)) return { ok: false, reason: 'rate' };
    const found = rowOfToken(token), t = now();
    if (!found) { failed(ip); return { ok: false, reason: 'invalid', clearCookie: clearCookie() }; }
    const row = found.row;
    if (t > row.expires || t > row.abs_expires) { drop(row.id); onRevoke([row.id]); audit('confianza-caducada', row.label + ' · ' + short(row.id)); return { ok: false, reason: 'expired', clearCookie: clearCookie() }; }
    if (!found.current) {
      if (!found.old && t - row.rotated <= graceMs) return { ok: true, id: row.id, setCookie: null, grace: true };      // petición paralela con el token recién rotado: no es robo
      drop(row.id); onRevoke([row.id]); failed(ip);
      audit('confianza-reutilizado', row.label + ' · ' + short(row.id) + ' (familia revocada)');
      notify({ kind: 'security', level: 'critical', title: 'Dispositivo de confianza revocado', body: 'Un token de ' + row.label + ' se usó dos veces: puede haberse copiado. Se ha revocado y hará falta entrar de nuevo con todo.' });
      return { ok: false, reason: 'reused', clearCookie: clearCookie(), id: row.id };
    }
    const next = newToken(), expires = Math.min(t + days * DAY, row.abs_expires), sum = summarizeUa(ua);
    const r = q.run('UPDATE dc_trust SET hash = ?, prev_hash = ?, rotated = ?, last_used = ?, expires = ?, uses = uses + 1 WHERE id = ? AND hash = ?', sha256(next), row.hash, t, t, expires, row.id, row.hash);
    if (!r.changes) return { ok: false, reason: 'invalid', clearCookie: clearCookie() };
    if (row.prev_hash) q.run('INSERT OR IGNORE INTO dc_trust_old (hash, id, retired) VALUES (?,?,?)', row.prev_hash, row.id, row.rotated || t);
    q.run('DELETE FROM dc_trust_old WHERE id = ? AND hash NOT IN (SELECT hash FROM dc_trust_old WHERE id = ? ORDER BY retired DESC LIMIT 20)', row.id, row.id);
    if (sum !== row.ua_sum) { audit('confianza-uso-distinto', row.ua_sum + ' → ' + sum + ' · ' + short(row.id)); notify({ kind: 'security', level: 'warning', title: 'Dispositivo de confianza usado desde otro navegador', body: 'Dado de alta como ' + row.ua_sum + ', usado desde ' + sum + '. Si no lo reconoces, revócalo.' }); }
    return { ok: true, id: row.id, setCookie: cookieHeader(next) };
  }

  const list = (cookie) => { sweep(); const cur = rowOfToken(cookieValue(cookie, cookieName)); return q.all('SELECT * FROM dc_trust ORDER BY last_used DESC').map((r) => publicDevice(r, cur && cur.row.id)); };
  function revoke(id) { const r = q.get('SELECT id, label FROM dc_trust WHERE id = ?', String(id || '')); if (!r) return false; drop(r.id); onRevoke([r.id]); audit('confianza-revocado', r.label + ' · ' + short(r.id)); return true; }
  function revokeAll(reason) { const ids = q.all('SELECT id FROM dc_trust').map((r) => r.id); if (!ids.length) return 0; q.run('DELETE FROM dc_trust'); q.run('DELETE FROM dc_trust_old'); onRevoke(ids); audit('confianza-revocados-todos', (reason || '') + ' · ' + ids.length); return ids.length; }
  /* cerrar sesión de forma explícita en este dispositivo también le quita la confianza */
  function revokeCurrent(cookie) { const cur = rowOfToken(cookieValue(cookie, cookieName)); if (!cur) return false; return revoke(cur.row.id); }

  /* Vigila un secreto (p. ej. la contraseña de una variable de entorno): si cambia entre arranques, se revoca todo. Se guarda un resumen con scrypt y sal, no el secreto. */
  function watchSecret(name, value) {
    if (!value) return false;
    const k = 'secret:' + name, row = q.get('SELECT value FROM dc_trust_meta WHERE key = ?', k);
    const make = () => { const salt = crypto.randomBytes(16).toString('hex'); return salt + ':' + crypto.scryptSync(String(value), salt, 32, { N: 16384 }).toString('hex'); };
    if (!row) { q.run('INSERT INTO dc_trust_meta (key, value) VALUES (?, ?)', k, make()); return false; }
    const [salt, hash] = row.value.split(':'), same = crypto.timingSafeEqual(Buffer.from(hash, 'hex'), crypto.scryptSync(String(value), salt, 32, { N: 16384 }));
    if (same) return false;
    q.run('UPDATE dc_trust_meta SET value = ? WHERE key = ?', make(), k); revokeAll('cambio de ' + name); return true;
  }

  /* Rutas {prefix}/…: GET list, POST enroll, POST revoke, POST revoke-all.
     session = { authed, trusted, strong } (la app lo calcula de su sesión). Devuelve null si la ruta no es de este módulo. */
  async function handle({ method, path, ua, ip, cookie, body, session } = {}) {
    if (!String(path || '').startsWith(prefix + '/')) return null;
    const route = path.slice(prefix.length + 1), b = body && typeof body === 'object' ? body : {}, deny = (status, error) => ({ status, body: { error } });
    const known = (method === 'GET' && route === 'list') || (method === 'POST' && ['enroll', 'revoke', 'revoke-all'].includes(route));
    if (!known) return deny(404, 'notfound');
    if (!session || !session.authed) return deny(401, 'auth');
    if (route === 'list') return { status: 200, body: { devices: list(cookie), days, absoluteDays, enabled: !disabled() } };
    if (route === 'enroll') {
      if (b.trust !== true) return deny(400, 'invalid');                                  // sin la petición explícita no se crea nada
      if (disabled()) return deny(403, 'disabled');
      if (session.trusted || !session.strong) return deny(403, 'stepup');                 // solo tras un acceso completo y reciente, nunca desde una sesión de confianza
      const r = enroll({ ua, replaceCookie: cookieValue(cookie, cookieName) });
      return r.ok ? { status: 200, body: { ok: true, device: r.device, days }, headers: { 'Set-Cookie': r.setCookie } } : deny(403, r.error);
    }
    if (!session.strong) return deny(403, 'stepup');                                      // revocar siempre exige confirmación reciente
    if (route === 'revoke') {
      const cur = rowOfToken(cookieValue(cookie, cookieName)), id = String(b.id || '');
      if (!revoke(id)) return deny(404, 'notfound');
      return { status: 200, body: { ok: true }, headers: cur && cur.row.id === id ? { 'Set-Cookie': clearCookie() } : undefined };
    }
    revokeAll('manual');
    return { status: 200, body: { ok: true }, headers: { 'Set-Cookie': clearCookie() } };
  }

  return { enroll, restore, list, revoke, revokeAll, revokeCurrent, watchSecret, handle, sweep, cookieName, clearCookie, cookieValue: (h) => cookieValue(h, cookieName), requireStrong, isStrong, days, absoluteDays };
}

/* para scripts que cambian secretos sin crear el módulo (p. ej. tools/set-password.js): borra todas las confianzas de esa base */
function revokeAllRaw(db) { const q = adapt(db); try { q.run('DELETE FROM dc_trust'); q.run('DELETE FROM dc_trust_old'); } catch (_) { /* aún no existe la tabla: nada que revocar */ } }

module.exports = { createTrust, requireStrong, isStrong, summarizeUa, revokeAllRaw, sha256 };
