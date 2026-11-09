'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { open } = require('./lib/db');
const U = require('./lib/util');
const SSO = require('./lib/sso');
const CAT = require('./lib/catalog');
const PAT = require('./lib/patient');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SSO_SECRET = process.env.SSO_SECRET || '';
const CAMPUS_URL = (process.env.CAMPUS_URL || 'https://campus.luisfs.com').replace(/\/+$/, '');
const CAMPUS_TOKEN = process.env.CAMPUS_TOKEN || '';
const PUB = path.join(__dirname, 'public');
const TTL = 10 * 3600e3;

const db = open(DATA_DIR);
CAT.seedCatalog(db);

/* ---------- utilidades HTTP ---------- */
const CSP = "default-src 'self'; img-src 'self' data:; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
const hdrs = (extra) => Object.assign({ 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY', 'X-Robots-Tag': 'noindex', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()' }, extra || {});
function json(res, code, obj, extra) { res.writeHead(code, hdrs(Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, extra))); res.end(JSON.stringify(obj)); }
const ipOf = (req) => { const x = String(req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean); return x.length ? x[x.length - 1] : req.socket.remoteAddress || '?'; };
const isHttps = (req) => String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
function cookies(req) { const o = {}; String(req.headers.cookie || '').split(';').forEach((p) => { const i = p.indexOf('='); if (i > 0) o[p.slice(0, i).trim()] = p.slice(i + 1).trim(); }); return o; }
const setCookie = (req, val, maxAge) => 'hid=' + val + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + maxAge + (isHttps(req) ? '; Secure' : '');
function readJson(req, limit) {
  return new Promise((resolve, reject) => {
    const parts = []; let n = 0;
    req.on('data', (c) => { n += c.length; if (n > (limit || 1e6)) { reject(Object.assign(new Error('too-big'), { code: 413 })); req.destroy(); } else parts.push(c); });
    req.on('end', () => { if (!n) return resolve({}); try { resolve(JSON.parse(Buffer.concat(parts).toString('utf8'))); } catch (_) { reject(Object.assign(new Error('bad-json'), { code: 400 })); } });
    req.on('error', reject);
  });
}
const csrfOk = (req) => {
  if (req.headers['x-requested-with'] !== 'historia') return false;
  const o = req.headers.origin; if (!o) return true;
  try { return new URL(o).host === String(req.headers.host); } catch (_) { return false; }
};

/* ---------- sesiones y auditoría ---------- */
function newSession(uid) {
  const tok = crypto.randomBytes(32).toString('base64url');
  db.run('INSERT INTO sessions (hash, user_id, exp) VALUES (?,?,?)', U.sha(tok), uid, Date.now() + TTL);
  return tok;
}
function userOf(req) {
  const tok = cookies(req).hid; if (!tok || tok.length > 80) return null;
  const s = db.get('SELECT * FROM sessions WHERE hash = ?', U.sha(tok));
  if (!s) return null;
  if (s.exp < Date.now()) { db.run('DELETE FROM sessions WHERE hash = ?', s.hash); return null; }
  return db.get('SELECT * FROM users WHERE id = ? AND active = 1', s.user_id) || null;
}
const isStaff = (u) => !!u && (u.role === 'admin' || u.role === 'teacher');
function audit(who, action, detail) { db.run('INSERT INTO audit (ts, who, action, detail) VALUES (?,?,?,?)', new Date().toISOString(), who, action, U.clip(detail || '', 300)); }
function purge() { db.run('DELETE FROM sessions WHERE exp < ?', Date.now()); db.run('DELETE FROM sso_used WHERE exp < ?', Date.now()); }
purge(); setInterval(purge, 3600e3).unref();

const limLogin = U.limiter(8, 15 * 60e3);
const limSso = U.limiter(30, 60e3);

/* ---------- usuarios ---------- */
const profileFromSubjects = (subs) => {
  const map = (() => { try { return JSON.parse(db.getSetting('subject_profiles', '{}')); } catch (_) { return {}; } })();
  const ps = (subs || []).map((s) => map[s]).filter(Boolean);
  if (!ps.length) return null;
  return ps.includes('enfermeria') ? 'enfermeria' : 'tcae';
};
function upsertUser(email, name, lang, subjects, role) {
  email = String(email).toLowerCase().trim();
  const subs = JSON.stringify((subjects || []).slice(0, 60));
  let u = db.get('SELECT * FROM users WHERE email = ?', email);
  if (!u) {
    const r = db.run('INSERT INTO users (email, name, role, profile, lang, subjects, created) VALUES (?,?,?,?,?,?,?)', email, U.clip(name, 120), role, profileFromSubjects(subjects) || 'enfermeria', lang === 'ca' ? 'ca' : 'es', subs, new Date().toISOString());
    return db.get('SELECT * FROM users WHERE id = ?', Number(r.lastInsertRowid));
  }
  const prof = !u.profile_manual && role === 'student' ? (profileFromSubjects(subjects) || u.profile) : u.profile;
  db.run('UPDATE users SET name = ?, subjects = ?, profile = ?, role = CASE WHEN role IN (\'teacher\', \'admin\') AND ? = \'student\' THEN role ELSE ? END WHERE id = ?', U.clip(name, 120) || u.name, subs, prof, role, role, u.id);
  return db.get('SELECT * FROM users WHERE id = ?', u.id);
}

/* ---------- permisos de historias ---------- */
function chartFor(user, chartId) {
  const c = db.get('SELECT * FROM charts WHERE id = ?', chartId); if (!c) return null;
  if (isStaff(user)) return { chart: c, role: null, staff: true };
  const m = db.get('SELECT role FROM chart_members WHERE chart_id = ? AND user_id = ?', c.id, user.id);
  return m ? { chart: c, role: m.role, staff: false } : null;
}
const catalogGet = (id) => db.get('SELECT * FROM catalog WHERE id = ?', id);
const membersOf = (cid) => db.all('SELECT u.id, u.name, u.email, m.role FROM chart_members m JOIN users u ON u.id = m.user_id WHERE m.chart_id = ? ORDER BY u.name COLLATE NOCASE', cid);
function recordsOf(cid, userFilter) {
  const rows = db.all('SELECT r.*, u.name author, v.name void_name FROM records r JOIN users u ON u.id = r.user_id LEFT JOIN users v ON v.id = r.void_by WHERE r.chart_id = ?' + (userFilter ? ' AND r.user_id = ' + (parseInt(userFilter, 10) || 0) : '') + ' ORDER BY r.occurred DESC, r.id DESC', cid);
  const com = db.all('SELECT c.id, c.record_id, c.text, c.created, u.name author FROM comments c JOIN users u ON u.id = c.user_id WHERE c.chart_id = ? ORDER BY c.id', cid);
  return rows.map((r) => ({ id: r.id, user_id: r.user_id, author: r.author, author_role: r.author_role, type: r.type, data: JSON.parse(r.data), occurred: r.occurred, created: r.created, replaces_id: r.replaces_id, void_at: r.void_at, void_reason: r.void_reason, void_name: r.void_name, comments: com.filter((c) => c.record_id === r.id) }));
}
const chartComments = (cid) => db.all('SELECT c.id, c.text, c.created, u.name author FROM comments c JOIN users u ON u.id = c.user_id WHERE c.chart_id = ? AND c.record_id IS NULL ORDER BY c.id', cid);
const patientCard = (p, staff) => { const d = JSON.parse(p.data); return { id: p.id, code: p.code, archived: !!p.archived, created: p.created, updated: p.updated, data: staff ? d : PAT.forStudent(d) }; };

/* ---------- rutas ---------- */
const routes = [];
const R = (method, pattern, fn, opts) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '([^/]+)') + '$'), names: (pattern.match(/:(\w+)/g) || []).map((s) => s.slice(1)), fn, staff: !!(opts && opts.staff), open: !!(opts && opts.open) });
const bad = (res, msg, code) => json(res, code || 400, { error: msg || 'invalid' });
const intId = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : 0; };

/* --- acceso --- */
R('GET', '/sso', async (req, res, ctx) => {
  const ip = ipOf(req);
  const fail = (code, m) => { res.writeHead(code, hdrs({ 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })); res.end(m); };
  if (limSso.blocked(ip)) return fail(429, 'Demasiados intentos.');
  limSso.fail(ip);
  if (!SSO_SECRET) return fail(503, 'SSO no configurado (falta SSO_SECRET).');
  const p = SSO.verify(ctx.url.searchParams.get('t'), SSO_SECRET);
  if (!p || p.iss !== 'campus' || !U.validEmail(String(p.email || ''))) return fail(401, 'Enlace de acceso no válido o caducado. Vuelve a entrar desde el Campus.');
  if (db.get('SELECT 1 x FROM sso_used WHERE jti = ?', String(p.jti))) return fail(401, 'Este enlace ya se ha usado. Vuelve a entrar desde el Campus.');
  db.run('INSERT INTO sso_used (jti, exp) VALUES (?,?)', String(p.jti), p.exp + 60e3);
  const subs = Array.isArray(p.subjects) ? p.subjects.map((s) => U.clip(s && s.slug, 80)).filter(Boolean) : [];
  const u = upsertUser(p.email, p.name, p.lang, subs, p.admin ? 'admin' : 'student');
  if (!u.active) return fail(403, 'Tu acceso está desactivado.');
  db.run('UPDATE users SET last_login = ? WHERE id = ?', new Date().toISOString(), u.id);
  audit(u.email, 'login-sso', u.role);
  limSso.ok(ip);
  res.writeHead(302, hdrs({ Location: '/', 'Set-Cookie': setCookie(req, newSession(u.id), TTL / 1000), 'Cache-Control': 'no-store' })); res.end();
}, { open: true });

R('POST', '/api/admin/login', async (req, res) => {
  const ip = ipOf(req);
  if (!ADMIN_PASSWORD) return bad(res, 'disabled', 503);
  if (limLogin.blocked(ip)) return bad(res, 'rate', 429);
  const b = await readJson(req, 2e3);
  if (!U.eq(U.sha(String(b.password || '')), U.sha(ADMIN_PASSWORD))) { limLogin.fail(ip); audit('?', 'login-fallido', ip); return bad(res, 'auth', 401); }
  limLogin.ok(ip);
  const u = upsertUser('admin@local', 'Administrador', 'es', [], 'admin');
  audit(u.email, 'login-admin', '');
  json(res, 200, { ok: true }, { 'Set-Cookie': setCookie(req, newSession(u.id), TTL / 1000) });
}, { open: true });
R('POST', '/api/logout', async (req, res) => {
  const tok = cookies(req).hid; if (tok) db.run('DELETE FROM sessions WHERE hash = ?', U.sha(tok));
  json(res, 200, { ok: true }, { 'Set-Cookie': setCookie(req, '', 0) });
});
R('GET', '/api/me', async (req, res, ctx) => {
  const u = ctx.user;
  json(res, 200, { id: u.id, name: u.name, email: u.email, role: u.role, profile: u.profile, lang: u.lang, campus: CAMPUS_URL, staff: isStaff(u) });
});
R('PUT', '/api/me', async (req, res, ctx) => {
  const b = await readJson(req, 2e3);
  if (b.lang === 'ca' || b.lang === 'es') db.run('UPDATE users SET lang = ? WHERE id = ?', b.lang, ctx.user.id);
  json(res, 200, { ok: true });
});
R('GET', '/api/catalog', async (req, res, ctx) => {
  const rows = db.all('SELECT * FROM catalog' + (isStaff(ctx.user) ? '' : ' WHERE active = 1') + ' ORDER BY ord, id');
  json(res, 200, { items: rows.filter((r) => isStaff(ctx.user) || r.roles.split(',').includes(ctx.user.profile)) });
});

/* --- pacientes (profesorado) --- */
R('GET', '/api/patients', async (req, res) => {
  const rows = db.all('SELECT p.*, (SELECT COUNT(*) FROM charts c WHERE c.patient_id = p.id) charts, (SELECT COUNT(*) FROM records r JOIN charts c ON c.id = r.chart_id WHERE c.patient_id = p.id) recs FROM patients p ORDER BY p.archived, p.id DESC');
  json(res, 200, { patients: rows.map((p) => Object.assign(patientCard(p, true), { charts: p.charts, records: p.recs })) });
}, { staff: true });
R('POST', '/api/patients', async (req, res, ctx) => {
  const { data, error } = PAT.sanitize(await readJson(req, 2e5)); if (error) return bad(res, error);
  const n = db.get('SELECT COALESCE(MAX(id),0)+1 n FROM patients').n;
  const code = 'P' + String(n).padStart(4, '0');
  const r = db.run('INSERT INTO patients (code, data, created, created_by) VALUES (?,?,?,?)', code, JSON.stringify(data), new Date().toISOString(), ctx.user.id);
  audit(ctx.user.email, 'paciente-alta', code + ' ' + data.nombre);
  json(res, 200, { id: Number(r.lastInsertRowid), code });
}, { staff: true });
R('GET', '/api/patients/:id', async (req, res, ctx) => {
  const p = db.get('SELECT * FROM patients WHERE id = ?', intId(ctx.params.id)); if (!p) return bad(res, 'notfound', 404);
  const charts = db.all('SELECT c.*, (SELECT COUNT(*) FROM records r WHERE r.chart_id = c.id AND r.void_at IS NULL) recs, (SELECT MAX(r.created) FROM records r WHERE r.chart_id = c.id) last FROM charts c WHERE c.patient_id = ? ORDER BY c.id', p.id)
    .map((c) => Object.assign({}, c, { members: membersOf(c.id) }));
  json(res, 200, { patient: patientCard(p, true), charts, revisions: db.get('SELECT COUNT(*) n FROM patient_revisions WHERE patient_id = ?', p.id).n });
}, { staff: true });
R('PUT', '/api/patients/:id', async (req, res, ctx) => {
  const p = db.get('SELECT * FROM patients WHERE id = ?', intId(ctx.params.id)); if (!p) return bad(res, 'notfound', 404);
  const b = await readJson(req, 2e5);
  if (b.archived != null && Object.keys(b).length === 1) { db.run('UPDATE patients SET archived = ? WHERE id = ?', b.archived ? 1 : 0, p.id); audit(ctx.user.email, b.archived ? 'paciente-archivar' : 'paciente-restaurar', p.code); return json(res, 200, { ok: true }); }
  const { data, error } = PAT.sanitize(b); if (error) return bad(res, error);
  db.tx(() => {
    db.run('INSERT INTO patient_revisions (patient_id, ts, who, data) VALUES (?,?,?,?)', p.id, new Date().toISOString(), ctx.user.email, p.data);
    db.run('UPDATE patients SET data = ?, updated = ? WHERE id = ?', JSON.stringify(data), new Date().toISOString(), p.id);
  });
  audit(ctx.user.email, 'paciente-edicion', p.code);
  json(res, 200, { ok: true });
}, { staff: true });
R('GET', '/api/patients/:id/activity', async (req, res, ctx) => {
  const p = db.get('SELECT * FROM patients WHERE id = ?', intId(ctx.params.id)); if (!p) return bad(res, 'notfound', 404);
  const uf = intId(ctx.url.searchParams.get('user'));
  const rows = db.all('SELECT r.id, r.chart_id, r.user_id, r.type, r.data, r.occurred, r.created, r.void_at, r.void_reason, u.name author, c.name chart_name, c.kind FROM records r JOIN charts c ON c.id = r.chart_id JOIN users u ON u.id = r.user_id WHERE c.patient_id = ?' + (uf ? ' AND r.user_id = ' + uf : '') + ' ORDER BY r.occurred DESC, r.id DESC LIMIT 1000', p.id);
  json(res, 200, { records: rows.map((r) => Object.assign({}, r, { data: JSON.parse(r.data) })) });
}, { staff: true });

/* --- asignación: individual (una historia por alumno) o por equipo (una historia compartida) --- */
R('POST', '/api/patients/:id/assign', async (req, res, ctx) => {
  const p = db.get('SELECT * FROM patients WHERE id = ?', intId(ctx.params.id)); if (!p) return bad(res, 'notfound', 404);
  if (p.archived) return bad(res, 'archived');
  const b = await readJson(req, 2e5);
  const ids = [...new Set((Array.isArray(b.user_ids) ? b.user_ids : []).map(intId).filter(Boolean))].slice(0, 500);
  const users = ids.map((i) => db.get("SELECT * FROM users WHERE id = ? AND role = 'student' AND active = 1", i)).filter(Boolean);
  if (!users.length) return bad(res, 'users');
  const out = { created: 0, skipped: 0 };
  db.tx(() => {
    if (b.mode === 'team') {
      const name = U.clip(b.team_name, 80) || 'Equipo';
      const r = db.run("INSERT INTO charts (patient_id, kind, name, created) VALUES (?,'team',?,?)", p.id, name, new Date().toISOString());
      users.forEach((u) => db.run('INSERT INTO chart_members (chart_id, user_id, role) VALUES (?,?,?)', Number(r.lastInsertRowid), u.id, u.profile));
      out.created = 1;
    } else {
      for (const u of users) {
        if (db.get("SELECT 1 x FROM charts c JOIN chart_members m ON m.chart_id = c.id WHERE c.patient_id = ? AND m.user_id = ? AND c.kind = 'individual'", p.id, u.id)) { out.skipped++; continue; }
        const r = db.run("INSERT INTO charts (patient_id, kind, name, created) VALUES (?,'individual',?,?)", p.id, u.name, new Date().toISOString());
        db.run('INSERT INTO chart_members (chart_id, user_id, role) VALUES (?,?,?)', Number(r.lastInsertRowid), u.id, u.profile);
        out.created++;
      }
    }
  });
  audit(ctx.user.email, 'asignar', p.code + ' → ' + users.length + ' alumnos (' + (b.mode === 'team' ? 'equipo' : 'individual') + ')');
  json(res, 200, out);
}, { staff: true });
R('PUT', '/api/charts/:id', async (req, res, ctx) => {
  const c = db.get('SELECT * FROM charts WHERE id = ?', intId(ctx.params.id)); if (!c) return bad(res, 'notfound', 404);
  const b = await readJson(req, 2e3);
  if (b.status === 'open' || b.status === 'closed') db.run('UPDATE charts SET status = ? WHERE id = ?', b.status, c.id);
  if (b.name != null) db.run('UPDATE charts SET name = ? WHERE id = ?', U.clip(b.name, 80) || c.name, c.id);
  audit(ctx.user.email, 'historia-edicion', '#' + c.id + ' ' + (b.status || ''));
  json(res, 200, { ok: true });
}, { staff: true });
R('DELETE', '/api/charts/:id', async (req, res, ctx) => {
  const c = db.get('SELECT * FROM charts WHERE id = ?', intId(ctx.params.id)); if (!c) return bad(res, 'notfound', 404);
  if (db.get('SELECT COUNT(*) n FROM records WHERE chart_id = ?', c.id).n) return bad(res, 'has-records', 409);
  db.run('DELETE FROM charts WHERE id = ?', c.id); audit(ctx.user.email, 'historia-borrada', '#' + c.id);
  json(res, 200, { ok: true });
}, { staff: true });
R('POST', '/api/charts/:id/members', async (req, res, ctx) => {
  const c = db.get('SELECT * FROM charts WHERE id = ?', intId(ctx.params.id)); if (!c) return bad(res, 'notfound', 404);
  if (c.kind !== 'team') return bad(res, 'not-team');
  const b = await readJson(req, 2e3);
  const u = db.get("SELECT * FROM users WHERE id = ? AND role = 'student'", intId(b.user_id)); if (!u) return bad(res, 'users');
  db.run('INSERT OR IGNORE INTO chart_members (chart_id, user_id, role) VALUES (?,?,?)', c.id, u.id, ['enfermeria', 'tcae'].includes(b.role) ? b.role : u.profile);
  json(res, 200, { ok: true });
}, { staff: true });
R('DELETE', '/api/charts/:id/members/:uid', async (req, res, ctx) => {
  const c = db.get('SELECT * FROM charts WHERE id = ?', intId(ctx.params.id)); if (!c) return bad(res, 'notfound', 404);
  if (db.get('SELECT 1 x FROM records WHERE chart_id = ? AND user_id = ?', c.id, intId(ctx.params.uid))) return bad(res, 'has-records', 409);
  db.run('DELETE FROM chart_members WHERE chart_id = ? AND user_id = ?', c.id, intId(ctx.params.uid));
  json(res, 200, { ok: true });
}, { staff: true });

/* --- alumnado --- */
R('GET', '/api/users', async (req, res, ctx) => {
  const q = U.normName(ctx.url.searchParams.get('q') || '');
  let rows = db.all("SELECT id, name, email, role, profile, profile_manual, lang, subjects, active, last_login FROM users WHERE role != 'admin' ORDER BY name COLLATE NOCASE");
  if (q) rows = rows.filter((r) => U.normName(r.name + ' ' + r.email).includes(q));
  json(res, 200, { users: rows.slice(0, 1000).map((r) => Object.assign(r, { subjects: JSON.parse(r.subjects) })), subject_profiles: JSON.parse(db.getSetting('subject_profiles', '{}')), subjects: JSON.parse(db.getSetting('campus_subjects', '[]')) });
}, { staff: true });
R('PUT', '/api/users/:id', async (req, res, ctx) => {
  const u = db.get("SELECT * FROM users WHERE id = ? AND role != 'admin'", intId(ctx.params.id)); if (!u) return bad(res, 'notfound', 404);
  const b = await readJson(req, 2e3);
  if (CAT.PROFILES.includes(b.profile)) db.run('UPDATE users SET profile = ?, profile_manual = 1 WHERE id = ?', b.profile, u.id);
  if (b.profile === 'auto') db.run('UPDATE users SET profile_manual = 0 WHERE id = ?', u.id);
  if (b.active != null) db.run('UPDATE users SET active = ? WHERE id = ?', b.active ? 1 : 0, u.id);
  audit(ctx.user.email, 'usuario-edicion', u.email + ' ' + (b.profile || '') + (b.active != null ? ' activo=' + b.active : ''));
  json(res, 200, { ok: true });
}, { staff: true });
R('PUT', '/api/subject-profiles', async (req, res, ctx) => {
  const b = await readJson(req, 2e4); const m = {};
  for (const [k, v] of Object.entries(b.map || {})) if (CAT.PROFILES.includes(v)) m[U.clip(k, 80)] = v;
  db.setSetting('subject_profiles', JSON.stringify(m)); audit(ctx.user.email, 'perfiles-asignatura', Object.keys(m).length + ' asignaturas');
  json(res, 200, { ok: true });
}, { staff: true });
R('POST', '/api/sync', async (req, res, ctx) => {
  if (!CAMPUS_TOKEN) return bad(res, 'Falta CAMPUS_TOKEN en el entorno.', 503);
  let j;
  try {
    const r = await fetch(CAMPUS_URL + '/api/historia/roster', { headers: { Authorization: 'Bearer ' + CAMPUS_TOKEN }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) return bad(res, 'El Campus respondió ' + r.status, 502);
    j = await r.json();
  } catch (e) { return bad(res, 'No se pudo contactar con el Campus.', 502); }
  let n = 0;
  db.tx(() => {
    db.setSetting('campus_subjects', JSON.stringify((j.subjects || []).map((s) => ({ slug: U.clip(s.slug, 80), title: U.clip(s.title, 160) }))));
    for (const s of (j.students || []).slice(0, 5000)) { if (!U.validEmail(String(s.email || ''))) continue; upsertUser(s.email, s.name, s.lang, (s.subjects || []).map((x) => U.clip(x, 80)), 'student'); n++; }
  });
  audit(ctx.user.email, 'sincronizar-campus', n + ' alumnos');
  json(res, 200, { ok: true, students: n });
}, { staff: true });

/* --- catálogo editable --- */
R('POST', '/api/catalog', async (req, res, ctx) => {
  const b = await readJson(req, 4e3); const name = U.clip(b.name_es, 160); if (!name) return bad(res, 'name');
  const roles = ['enfermeria', 'tcae'].filter((r) => (b.roles || []).includes(r)).join(',') || 'enfermeria';
  const r = db.run('INSERT INTO catalog (kind, grp, name_es, name_ca, roles, ord) VALUES (?,?,?,?,?,?)', 'cuidado', U.clip(b.grp, 80), name, U.clip(b.name_ca, 160), roles, db.get('SELECT COALESCE(MAX(ord),0)+1 n FROM catalog').n);
  json(res, 200, { id: Number(r.lastInsertRowid) });
}, { staff: true });
R('PUT', '/api/catalog/:id', async (req, res, ctx) => {
  const it = catalogGet(intId(ctx.params.id)); if (!it) return bad(res, 'notfound', 404);
  const b = await readJson(req, 4e3);
  const roles = Array.isArray(b.roles) ? ['enfermeria', 'tcae'].filter((r) => b.roles.includes(r)).join(',') || it.roles : it.roles;
  db.run('UPDATE catalog SET name_es = ?, name_ca = ?, grp = ?, roles = ?, active = ? WHERE id = ?', U.clip(b.name_es, 160) || it.name_es, b.name_ca != null ? U.clip(b.name_ca, 160) : it.name_ca, b.grp != null ? U.clip(b.grp, 80) : it.grp, roles, b.active != null ? (b.active ? 1 : 0) : it.active, it.id);
  json(res, 200, { ok: true });
}, { staff: true });
R('GET', '/api/audit', async (req, res) => json(res, 200, { rows: db.all('SELECT * FROM audit ORDER BY id DESC LIMIT 300') }), { staff: true });

/* --- historias de trabajo (alumnado y profesorado) --- */
R('GET', '/api/my/charts', async (req, res, ctx) => {
  const rows = db.all('SELECT c.id, c.kind, c.name, c.status, p.id pid, p.code, p.data, (SELECT COUNT(*) FROM records r WHERE r.chart_id = c.id AND r.user_id = ? AND r.void_at IS NULL) mine, (SELECT COUNT(*) FROM records r WHERE r.chart_id = c.id AND r.void_at IS NULL) total FROM chart_members m JOIN charts c ON c.id = m.chart_id JOIN patients p ON p.id = c.patient_id WHERE m.user_id = ? AND p.archived = 0 ORDER BY c.id DESC', ctx.user.id, ctx.user.id);
  json(res, 200, { charts: rows.map((r) => { const d = PAT.forStudent(JSON.parse(r.data)); return { id: r.id, kind: r.kind, name: r.name, status: r.status, code: r.code, patient: (d.nombre || '') + ' ' + (d.apellidos || ''), unidad: d.unidad || '', habitacion: d.habitacion || '', cama: d.cama || '', sexo: d.sexo || '', nacimiento: d.fecha_nacimiento || '', alergias: (d.alergias || []).map((x) => x.agente), sin_alergias: !!d.sin_alergias, diagnostico: d.diagnostico_medico || '', mine: r.mine, total: r.total }; }) });
});
R('GET', '/api/charts/:id', async (req, res, ctx) => {
  const a = chartFor(ctx.user, intId(ctx.params.id)); if (!a) return bad(res, 'notfound', 404);
  const p = db.get('SELECT * FROM patients WHERE id = ?', a.chart.patient_id);
  json(res, 200, {
    chart: { id: a.chart.id, kind: a.chart.kind, name: a.chart.name, status: a.chart.status, role: a.role }, patient: patientCard(p, a.staff),
    members: membersOf(a.chart.id), records: recordsOf(a.chart.id, a.staff ? ctx.url.searchParams.get('user') : null), comments: chartComments(a.chart.id),
  });
});
R('POST', '/api/charts/:id/records', async (req, res, ctx) => {
  const a = chartFor(ctx.user, intId(ctx.params.id)); if (!a) return bad(res, 'notfound', 404);
  if (a.staff) return bad(res, 'staff-readonly', 403);
  if (a.chart.status !== 'open') return bad(res, 'closed', 409);
  if (db.get('SELECT archived FROM patients WHERE id = ?', a.chart.patient_id).archived) return bad(res, 'archived', 409);
  const b = await readJson(req, 2e5);
  if (!CAT.TYPES.includes(b.type)) return bad(res, 'tipo');
  let data; try { data = CAT.validate(b.type, b.data, { role: a.role, catalog: catalogGet }); } catch (e) { return bad(res, 'dato:' + e.message); }
  const occurred = b.occurred ? String(b.occurred) : U.nowLocal();
  if (!U.validLocal(occurred)) return bad(res, 'fecha');
  if (occurred > U.nowLocal().slice(0, 11) + '23:59') return bad(res, 'futuro');
  let rep = null;
  if (b.replaces_id) { rep = db.get('SELECT * FROM records WHERE id = ? AND chart_id = ? AND user_id = ?', intId(b.replaces_id), a.chart.id, ctx.user.id); if (!rep) return bad(res, 'replaces'); }
  const r = db.run('INSERT INTO records (chart_id, user_id, author_role, type, data, occurred, created, replaces_id) VALUES (?,?,?,?,?,?,?,?)', a.chart.id, ctx.user.id, a.role, b.type, JSON.stringify(data), occurred, new Date().toISOString(), rep ? rep.id : null);
  json(res, 200, { id: Number(r.lastInsertRowid) });
});
R('POST', '/api/records/:id/void', async (req, res, ctx) => {
  const r = db.get('SELECT * FROM records WHERE id = ?', intId(ctx.params.id)); if (!r) return bad(res, 'notfound', 404);
  const a = chartFor(ctx.user, r.chart_id); if (!a) return bad(res, 'notfound', 404);
  if (!a.staff && r.user_id !== ctx.user.id) return bad(res, 'forbidden', 403);
  if (!a.staff && a.chart.status !== 'open') return bad(res, 'closed', 409);
  if (r.void_at) return bad(res, 'already', 409);
  const b = await readJson(req, 4e3); const reason = U.clip(b.reason, 300);
  if (reason.length < 5) return bad(res, 'motivo');
  db.run('UPDATE records SET void_at = ?, void_by = ?, void_reason = ? WHERE id = ?', new Date().toISOString(), ctx.user.id, reason, r.id);
  if (a.staff) audit(ctx.user.email, 'registro-anulado', '#' + r.id + ' ' + reason);
  json(res, 200, { ok: true });
});
R('POST', '/api/charts/:id/comments', async (req, res, ctx) => {
  const c = db.get('SELECT * FROM charts WHERE id = ?', intId(ctx.params.id)); if (!c) return bad(res, 'notfound', 404);
  const b = await readJson(req, 8e3); const text = U.clipML(b.text, 2000); if (text.length < 2) return bad(res, 'texto');
  let rid = null; if (b.record_id) { const rr = db.get('SELECT id FROM records WHERE id = ? AND chart_id = ?', intId(b.record_id), c.id); if (!rr) return bad(res, 'record'); rid = rr.id; }
  db.run('INSERT INTO comments (chart_id, record_id, user_id, text, created) VALUES (?,?,?,?,?)', c.id, rid, ctx.user.id, text, new Date().toISOString());
  json(res, 200, { ok: true });
}, { staff: true });

/* ---------- servidor ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };
function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  const file = path.normalize(path.join(PUB, rel));
  if (!file.startsWith(PUB + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404, hdrs({ 'Content-Type': 'text/plain' })); return res.end('No encontrado'); }
  res.writeHead(200, hdrs({ 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }));
  fs.createReadStream(file).pipe(res);
}
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x'); const pathname = url.pathname;
    if (!pathname.startsWith('/api/') && pathname !== '/sso') {
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
      return serveStatic(req, res, pathname);
    }
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = r.re.exec(pathname); if (!m) continue;
      const params = {}; r.names.forEach((n, i) => { params[n] = decodeURIComponent(m[i + 1]); });
      const ctx = { url, params, user: null };
      if (!r.open) {
        ctx.user = userOf(req);
        if (!ctx.user) { req.resume(); return json(res, 401, { error: 'auth' }); }
        if (r.staff && !isStaff(ctx.user)) { req.resume(); return json(res, 403, { error: 'forbidden' }); }
      }
      if (req.method !== 'GET' && !csrfOk(req) && !(r.open && pathname === '/sso')) { req.resume(); return json(res, 403, { error: 'csrf' }); }
      return await r.fn(req, res, ctx);
    }
    json(res, 404, { error: 'notfound' });
  } catch (e) {
    if (e && e.code === 413) return json(res, 413, { error: 'too-big' });
    if (e && e.code === 400) return json(res, 400, { error: 'bad-json' });
    console.error('[Historia]', e);
    if (!res.headersSent) json(res, 500, { error: 'server' });
  }
});
if (require.main === module) server.listen(PORT, () => console.log('[Historia clínica] escuchando en :' + PORT + (SSO_SECRET ? '' : ' (SSO sin configurar)') + (ADMIN_PASSWORD ? '' : ' (sin ADMIN_PASSWORD)')));
module.exports = { server, db };
