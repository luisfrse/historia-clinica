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
const REP = require('./lib/reports');

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
  const real = db.get('SELECT * FROM users WHERE id = ? AND active = 1', s.user_id) || null;
  if (real && s.as_user && isStaff(real)) {
    const as = db.get('SELECT * FROM users WHERE id = ? AND active = 1', s.as_user);
    if (as) return Object.assign({}, as, { _preview: true, _real: real.email });
  }
  return real;
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

/* ---------- calendario de acceso de una historia: desde / hasta (vacío = sin límite) ---------- */
const todayLocal = () => U.nowLocal().slice(0, 10);
function chartWindow(c) { const t = todayLocal(); if (c.opens && t < c.opens) return 'scheduled'; if (c.closes && t > c.closes) return 'ended'; return ''; }
const effStatus = (c) => (chartWindow(c) === 'ended' ? 'closed' : c.status);
/* Ritmo del caso: 'teacher' = el profesor mueve el día; 'student' = cada alumno o equipo termina un día y pasa al siguiente.
   En el modo por días la fecha de cada registro sale del día del caso (fecha de inicio + día − 1), de modo que la hoja de medicación, el balance
   y las gráficas se agrupan por día del caso aunque el alumno haga varios días en una sola tarde. */
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const caseStart = (c) => c.start_date || String(c.created || '').slice(0, 10) || todayLocal();
const caseDate = (c, day) => addDays(caseStart(c), (day || c.day || 1) - 1);
function lastDay(pid) { const e = db.get('SELECT MAX(day) m FROM events WHERE patient_id = ?', pid), o = db.get('SELECT MAX(start_day) a, MAX(end_day) b FROM orders WHERE patient_id = ?', pid); return Math.max(1, e.m || 0, o.a || 0, o.b || 0); }
const dayCap = (c) => Math.max(c.day || 1, c.max_day || lastDay(c.patient_id));
function chartMeta(id) { const c = db.get('SELECT * FROM charts WHERE id = ?', id) || {}; return { status: effStatus(c), opens: c.opens || '', closes: c.closes || '', window: chartWindow(c), consigna_id: c.consigna_id || null, pace: c.pace || 'teacher', day: c.day || 1, cap: c.id ? dayCap(c) : 1, case_date: c.id ? caseDate(c) : '' }; }
function windowFields(b) {
  const opens = b.opens ? String(b.opens) : '', closes = b.closes ? String(b.closes) : '';
  if ((opens && !U.validDate(opens)) || (closes && !U.validDate(closes))) return { error: 'fecha' };
  if (opens && closes && closes < opens) return { error: 'rango' };
  return { opens, closes };
}

/* ---------- permisos de historias ---------- */
function chartFor(user, chartId) {
  const c = db.get('SELECT * FROM charts WHERE id = ?', chartId); if (!c) return null;
  if (isStaff(user)) return { chart: c, role: null, staff: true };
  const m = db.get('SELECT role FROM chart_members WHERE chart_id = ? AND user_id = ?', c.id, user.id);
  return m && chartWindow(c) !== 'scheduled' ? { chart: c, role: m.role, staff: false } : null;
}
const orderOut = (o) => ({ id: o.id, drug: o.drug, dose: o.dose, route: o.route, freq: o.freq, times: o.times ? o.times.split(',') : [], prn: !!o.prn, start_day: o.start_day, end_day: o.end_day, notes: o.notes, active: !!o.active });
/* El alumnado solo ve lo que ya toca según el día del caso; el profesorado lo ve todo. */
const visibleOrders = (chart) => db.all('SELECT * FROM orders WHERE patient_id = ? AND active = 1 AND start_day <= ? ORDER BY start_day, id', chart.patient_id, chart.day);
const visibleEvents = (chart) => db.all('SELECT * FROM events WHERE patient_id = ? AND day <= ? ORDER BY day, id', chart.patient_id, chart.day);
const evOut = (e) => ({ id: e.id, kind: e.kind, day: e.day, title: e.title, body: e.body });
const catalogGet = (id) => db.get('SELECT * FROM catalog WHERE id = ?', id);
const membersOf = (cid) => db.all('SELECT u.id, u.name, u.email, m.role FROM chart_members m JOIN users u ON u.id = m.user_id WHERE m.chart_id = ? AND u.email NOT LIKE ? ORDER BY u.name COLLATE NOCASE', cid, '%@historia.local');
function recordsOf(cid, userFilter) {
  const rows = db.all('SELECT r.*, u.name author, v.name void_name FROM records r JOIN users u ON u.id = r.user_id LEFT JOIN users v ON v.id = r.void_by WHERE r.chart_id = ?' + (userFilter ? ' AND r.user_id = ' + (parseInt(userFilter, 10) || 0) : '') + ' ORDER BY r.occurred DESC, r.id DESC', cid);
  const com = db.all('SELECT c.id, c.record_id, c.text, c.created, u.name author FROM comments c JOIN users u ON u.id = c.user_id WHERE c.chart_id = ? ORDER BY c.id', cid);
  return rows.map((r) => ({ id: r.id, user_id: r.user_id, author: r.author, author_role: r.author_role, type: r.type, day: r.day, data: JSON.parse(r.data), occurred: r.occurred, created: r.created, replaces_id: r.replaces_id, void_at: r.void_at, void_reason: r.void_reason, void_name: r.void_name, comments: com.filter((c) => c.record_id === r.id) }));
}
const chartComments = (cid) => db.all('SELECT c.id, c.text, c.created, u.name author FROM comments c JOIN users u ON u.id = c.user_id WHERE c.chart_id = ? AND c.record_id IS NULL ORDER BY c.id', cid);
const patientCard = (p, staff) => { const d = JSON.parse(p.data); return Object.assign({ id: p.id, code: p.code, archived: !!p.archived, created: p.created, updated: p.updated, data: staff ? d : PAT.forStudent(d) }, staff ? { subjects: JSON.parse(p.subjects || '[]'), topics: JSON.parse(p.topics || '[]') } : {}); };

/* ---------- clasificación de pacientes: asignaturas del Campus y temas libres ---------- */
const campusSlugs = () => { try { return JSON.parse(db.getSetting('campus_subjects', '[]')).map((x) => x.slug); } catch (_) { return []; } };
const uniq = (a, key) => { const seen = new Set(); return a.filter((x) => { const k = key ? key(x) : x; if (seen.has(k)) return false; seen.add(k); return true; }); };
function cleanClass(b) {
  const known = campusSlugs();
  const subjects = uniq((Array.isArray(b.subjects) ? b.subjects : []).map((x) => U.clip(x, 80)).filter(Boolean)).filter((x) => !known.length || known.includes(x)).slice(0, 20);
  const topics = uniq((Array.isArray(b.topics) ? b.topics : []).map((x) => U.clip(x, 40)).filter(Boolean), (x) => x.toLowerCase()).slice(0, 15);
  return { subjects, topics };
}

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
  const to = typeof p.to === 'string' && /^(consigna|chart)\/\d+$/.test(p.to) ? p.to : '';
  res.writeHead(302, hdrs({ Location: '/' + (to ? '#/go/' + to : ''), 'Set-Cookie': setCookie(req, newSession(u.id), TTL / 1000), 'Cache-Control': 'no-store' })); res.end();
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
const pwHash = (pw) => { const salt = crypto.randomBytes(16); return salt.toString('base64') + ':' + crypto.scryptSync(pw, salt, 32).toString('base64'); };
const pwCheck = (pw, stored) => { try { const [sl, hs] = String(stored || '').split(':'); const a = crypto.scryptSync(String(pw), Buffer.from(sl, 'base64'), 32), b = Buffer.from(hs, 'base64'); return a.length === b.length && crypto.timingSafeEqual(a, b); } catch (_) { return false; } };
R('POST', '/api/teacher/login', async (req, res) => {
  const ip = ipOf(req);
  if (limLogin.blocked(ip)) return bad(res, 'rate', 429);
  const b = await readJson(req, 2e3), email = String(b.email || '').toLowerCase().trim();
  const u = db.get("SELECT * FROM users WHERE email = ? AND role = 'teacher' AND active = 1", email);
  const ok = pwCheck(b.password, u && u.pw) && !!u;
  if (!ok) { limLogin.fail(ip); audit(email || '?', 'login-fallido', ip); return bad(res, 'auth', 401); }
  limLogin.ok(ip); db.run('UPDATE users SET last_login = ? WHERE id = ?', new Date().toISOString(), u.id); audit(u.email, 'login-profesorado', '');
  json(res, 200, { ok: true }, { 'Set-Cookie': setCookie(req, newSession(u.id), TTL / 1000) });
}, { open: true });
R('POST', '/api/logout', async (req, res) => {
  const tok = cookies(req).hid; if (tok) db.run('DELETE FROM sessions WHERE hash = ?', U.sha(tok));
  json(res, 200, { ok: true }, { 'Set-Cookie': setCookie(req, '', 0) });
});
R('GET', '/api/me', async (req, res, ctx) => {
  const u = ctx.user;
  json(res, 200, { id: u.id, name: u.name, email: u.email, role: u.role, profile: u.profile, lang: u.lang, campus: CAMPUS_URL, staff: isStaff(u), preview: !!u._preview });
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
R('GET', '/api/class-options', async (req, res) => {
  let subjects = []; try { subjects = JSON.parse(db.getSetting('campus_subjects', '[]')).map((x) => ({ slug: x.slug, title: x.title })); } catch (_) { /* sin sincronizar */ }
  const cnt = new Map(); db.all('SELECT topics FROM patients').forEach((r) => JSON.parse(r.topics || '[]').forEach((t) => { const k = t.toLowerCase(); cnt.set(k, { name: (cnt.get(k) || { name: t }).name, count: ((cnt.get(k) || {}).count || 0) + 1 }); }));
  json(res, 200, { subjects, topics: [...cnt.values()].sort((a, b) => a.name.localeCompare(b.name)) });
}, { staff: true });
R('PUT', '/api/patients/:id/classify', async (req, res, ctx) => {
  const p = db.get('SELECT id FROM patients WHERE id = ?', intId(ctx.params.id)); if (!p) return bad(res, 'notfound', 404);
  const c = cleanClass(await readJson(req, 4e3)); db.run('UPDATE patients SET subjects = ?, topics = ? WHERE id = ?', JSON.stringify(c.subjects), JSON.stringify(c.topics), p.id);
  audit(ctx.user.email, 'paciente-clasificar', '#' + p.id + ' ' + c.subjects.length + ' asignaturas, ' + c.topics.length + ' temas'); json(res, 200, c);
}, { staff: true });
R('POST', '/api/patients/classify', async (req, res, ctx) => {
  const b = await readJson(req, 2e4), ids = uniq((Array.isArray(b.ids) ? b.ids : []).map(intId).filter(Boolean)).slice(0, 500); if (!ids.length) return bad(res, 'ids');
  const addS = cleanClass({ subjects: b.add_subjects }).subjects, addT = cleanClass({ topics: b.add_topics }).topics;
  const remS = (Array.isArray(b.remove_subjects) ? b.remove_subjects : []).map(String), remT = (Array.isArray(b.remove_topics) ? b.remove_topics : []).map((x) => String(x).toLowerCase());
  let n = 0;
  db.tx(() => ids.forEach((id) => {
    const p = db.get('SELECT subjects, topics FROM patients WHERE id = ?', id); if (!p) return;
    const subs = uniq(JSON.parse(p.subjects || '[]').filter((x) => !remS.includes(x)).concat(addS)).slice(0, 20);
    const tops = uniq(JSON.parse(p.topics || '[]').filter((x) => !remT.includes(x.toLowerCase())).concat(addT), (x) => x.toLowerCase()).slice(0, 15);
    db.run('UPDATE patients SET subjects = ?, topics = ? WHERE id = ?', JSON.stringify(subs), JSON.stringify(tops), id); n++;
  }));
  audit(ctx.user.email, 'pacientes-clasificar', n + ' pacientes'); json(res, 200, { ok: true, updated: n });
}, { staff: true });
R('POST', '/api/patients', async (req, res, ctx) => {
  const body0 = await readJson(req, 2e5); const { data, error } = PAT.sanitize(body0); if (error) return bad(res, error);
  const n = db.get('SELECT COALESCE(MAX(id),0)+1 n FROM patients').n;
  const code = 'P' + String(n).padStart(4, '0');
  const cl = cleanClass(body0);
  const r = db.run('INSERT INTO patients (code, data, subjects, topics, created, created_by) VALUES (?,?,?,?,?,?)', code, JSON.stringify(data), JSON.stringify(cl.subjects), JSON.stringify(cl.topics), new Date().toISOString(), ctx.user.id);
  audit(ctx.user.email, 'paciente-alta', code + ' ' + data.nombre);
  json(res, 200, { id: Number(r.lastInsertRowid), code });
}, { staff: true });
R('GET', '/api/patients/:id', async (req, res, ctx) => {
  const p = db.get('SELECT * FROM patients WHERE id = ?', intId(ctx.params.id)); if (!p) return bad(res, 'notfound', 404);
  const charts = db.all('SELECT c.*, (SELECT COUNT(*) FROM records r WHERE r.chart_id = c.id AND r.void_at IS NULL) recs, (SELECT MAX(r.created) FROM records r WHERE r.chart_id = c.id) last FROM charts c WHERE c.patient_id = ? ORDER BY c.id', p.id)
    .map((c) => Object.assign({}, c, { members: membersOf(c.id), brief: consignaBrief(c.id) }));
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
  const win = windowFields(b); if (win.error) return bad(res, win.error);
  const pace = b.pace === 'student' ? 'student' : 'teacher', maxDay = b.max_day ? Math.min(60, intId(b.max_day)) || null : null, startD = todayLocal();
  const cons = b.consigna_id ? db.get('SELECT id FROM consignas WHERE id = ? AND patient_id = ?', intId(b.consigna_id), p.id) : null, cid = cons ? cons.id : null;
  db.tx(() => {
    if (b.mode === 'team') {
      const name = U.clip(b.team_name, 80) || 'Equipo';
      const r = db.run("INSERT INTO charts (patient_id, kind, name, consigna_id, opens, closes, pace, max_day, start_date, created) VALUES (?,'team',?,?,?,?,?,?,?,?)", p.id, name, cid, win.opens, win.closes, pace, maxDay, startD, new Date().toISOString());
      users.forEach((u) => db.run('INSERT INTO chart_members (chart_id, user_id, role) VALUES (?,?,?)', Number(r.lastInsertRowid), u.id, u.profile));
      out.created = 1;
    } else {
      for (const u of users) {
        if (db.get("SELECT 1 x FROM charts c JOIN chart_members m ON m.chart_id = c.id WHERE c.patient_id = ? AND m.user_id = ? AND c.kind = 'individual'", p.id, u.id)) { out.skipped++; continue; }
        const r = db.run("INSERT INTO charts (patient_id, kind, name, consigna_id, opens, closes, pace, max_day, start_date, created) VALUES (?,'individual',?,?,?,?,?,?,?,?)", p.id, u.name, cid, win.opens, win.closes, pace, maxDay, startD, new Date().toISOString());
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
  if (b.consigna_id !== undefined) { const k = b.consigna_id ? db.get('SELECT id FROM consignas WHERE id = ? AND patient_id = ?', intId(b.consigna_id), c.patient_id) : null; if (b.consigna_id && !k) return bad(res, 'consigna'); db.run('UPDATE charts SET consigna_id = ? WHERE id = ?', k ? k.id : null, c.id); }
  if (b.opens !== undefined || b.closes !== undefined) { const w = windowFields({ opens: b.opens !== undefined ? b.opens : c.opens, closes: b.closes !== undefined ? b.closes : c.closes }); if (w.error) return bad(res, w.error); db.run('UPDATE charts SET opens = ?, closes = ? WHERE id = ?', w.opens, w.closes, c.id); }
  if (b.pace === 'teacher' || b.pace === 'student') db.run('UPDATE charts SET pace = ? WHERE id = ?', b.pace, c.id);
  if (b.max_day !== undefined) { const m = b.max_day === null || b.max_day === '' ? null : intId(b.max_day); if (m !== null && (!m || m > 60)) return bad(res, 'max_day'); db.run('UPDATE charts SET max_day = ? WHERE id = ?', m, c.id); }
  if (b.day != null) { const dd = intId(b.day); if (!dd || dd > 60) return bad(res, 'day'); db.run('UPDATE charts SET day = ? WHERE id = ?', dd, c.id); }
  audit(ctx.user.email, 'historia-edicion', '#' + c.id + ' ' + (b.status || '') + (b.day ? ' día ' + b.day : ''));
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
  let rows = db.all("SELECT id, name, email, role, profile, profile_manual, lang, subjects, active, last_login FROM users WHERE role != 'admin' AND email NOT LIKE '%@historia.local' ORDER BY name COLLATE NOCASE");
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
    db.setSetting('campus_subjects', JSON.stringify((j.subjects || []).map((s) => ({ slug: U.clip(s.slug, 80), title: U.clip(s.title, 160), ras: (Array.isArray(s.ras) ? s.ras : []).slice(0, 60).map((r) => ({ id: intId(r.id), code: U.clip(r.code, 20), title: U.clip(r.title, 160) })) }))));
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
  json(res, 200, { charts: rows.map((r) => { const d = PAT.forStudent(JSON.parse(r.data)); return { consigna: consignaBrief(r.id), consigna_id: chartMeta(r.id).consigna_id, id: r.id, kind: r.kind, name: r.name, status: r.status, ...chartMeta(r.id), code: r.code, patient: (d.nombre || '') + ' ' + (d.apellidos || ''), unidad: d.unidad || '', habitacion: d.habitacion || '', cama: d.cama || '', sexo: d.sexo || '', nacimiento: d.fecha_nacimiento || '', alergias: (d.alergias || []).map((x) => x.agente), sin_alergias: !!d.sin_alergias, diagnostico: d.diagnostico_medico || '', mine: r.mine, total: r.total }; }) });
});
R('GET', '/api/charts/:id', async (req, res, ctx) => {
  const a = chartFor(ctx.user, intId(ctx.params.id));
  if (!a) { const c0 = db.get('SELECT * FROM charts WHERE id = ?', intId(ctx.params.id)); if (c0 && !isStaff(ctx.user) && chartWindow(c0) === 'scheduled' && db.get('SELECT 1 x FROM chart_members WHERE chart_id = ? AND user_id = ?', c0.id, ctx.user.id)) return json(res, 403, { error: 'scheduled', opens: c0.opens }); return bad(res, 'notfound', 404); }
  const p = db.get('SELECT * FROM patients WHERE id = ?', a.chart.patient_id);
  json(res, 200, {
    chart: { id: a.chart.id, kind: a.chart.kind, name: a.chart.name, status: a.staff ? a.chart.status : effStatus(a.chart), opens: a.chart.opens || '', closes: a.chart.closes || '', window: chartWindow(a.chart), pace: a.chart.pace || 'teacher', max_day: a.chart.max_day || null, cap: dayCap(a.chart), case_date: caseDate(a.chart), role: a.role, day: a.chart.day, consigna_id: a.chart.consigna_id || null }, patient: patientCard(p, a.staff),
    consigna: consignaFor(a.chart), consignas: a.staff ? db.all('SELECT id, title FROM consignas WHERE patient_id = ? ORDER BY id', p.id) : [],
    orders: (a.staff ? db.all('SELECT * FROM orders WHERE patient_id = ? ORDER BY start_day, id', p.id) : visibleOrders(a.chart)).map(orderOut),
    events: (a.staff ? db.all('SELECT * FROM events WHERE patient_id = ? ORDER BY day, id', p.id) : visibleEvents(a.chart)).map(evOut),
    grades: gradesFor(a, ctx.user),
    members: membersOf(a.chart.id), records: recordsOf(a.chart.id, a.staff ? ctx.url.searchParams.get('user') : null), comments: chartComments(a.chart.id),
  });
});
R('POST', '/api/charts/:id/records', async (req, res, ctx) => {
  const a = chartFor(ctx.user, intId(ctx.params.id)); if (!a) return bad(res, 'notfound', 404);
  if (a.staff) return bad(res, 'staff-readonly', 403);
  if (effStatus(a.chart) !== 'open') return bad(res, 'closed', 409);
  if (db.get('SELECT archived FROM patients WHERE id = ?', a.chart.patient_id).archived) return bad(res, 'archived', 409);
  const b = await readJson(req, 2e5);
  if (!CAT.TYPES.includes(b.type)) return bad(res, 'tipo');
  let data; try { data = CAT.validate(b.type, b.data, { role: a.role, catalog: catalogGet, order: (id) => visibleOrders(a.chart).find((o) => o.id === id), record: (id, ty) => db.get('SELECT id FROM records WHERE id = ? AND chart_id = ? AND type = ? AND void_at IS NULL', id, a.chart.id, ty) }); } catch (e) { return bad(res, 'dato:' + e.message); }
  let occurred = b.occurred ? String(b.occurred) : U.nowLocal();
  if (!U.validLocal(occurred)) return bad(res, 'fecha');
  const byDays = a.chart.pace === 'student';
  if (byDays) occurred = caseDate(a.chart) + occurred.slice(10); /* manda la fecha del caso; el alumno solo elige la hora */
  else if (occurred > U.nowLocal().slice(0, 11) + '23:59') return bad(res, 'futuro');
  let rep = null;
  if (b.replaces_id) { rep = db.get('SELECT * FROM records WHERE id = ? AND chart_id = ? AND user_id = ?', intId(b.replaces_id), a.chart.id, ctx.user.id); if (!rep) return bad(res, 'replaces'); if (byDays && rep.day != null && rep.day < a.chart.day) return bad(res, 'day-closed', 409); }
  const r = db.run('INSERT INTO records (chart_id, user_id, author_role, type, data, occurred, day, created, replaces_id) VALUES (?,?,?,?,?,?,?,?,?)', a.chart.id, ctx.user.id, a.role, b.type, JSON.stringify(data), occurred, a.chart.day || 1, new Date().toISOString(), rep ? rep.id : null);
  json(res, 200, { id: Number(r.lastInsertRowid) });
});
R('POST', '/api/charts/:id/advance', async (req, res, ctx) => {
  const a = chartFor(ctx.user, intId(ctx.params.id)); if (!a) return bad(res, 'notfound', 404);
  if (a.staff) return bad(res, 'staff', 403);
  if (a.chart.pace !== 'student') return bad(res, 'pace', 409);
  if (effStatus(a.chart) !== 'open') return bad(res, 'closed', 409);
  const cap = dayCap(a.chart); if (a.chart.day >= cap) return bad(res, 'last-day', 409);
  db.run('UPDATE charts SET day = day + 1 WHERE id = ?', a.chart.id); audit(ctx.user.email, 'avanzar-dia', '#' + a.chart.id + ' → día ' + (a.chart.day + 1));
  json(res, 200, { day: a.chart.day + 1, cap });
});
R('POST', '/api/records/:id/void', async (req, res, ctx) => {
  const r = db.get('SELECT * FROM records WHERE id = ?', intId(ctx.params.id)); if (!r) return bad(res, 'notfound', 404);
  const a = chartFor(ctx.user, r.chart_id); if (!a) return bad(res, 'notfound', 404);
  if (!a.staff && r.user_id !== ctx.user.id) return bad(res, 'forbidden', 403);
  if (!a.staff && effStatus(a.chart) !== 'open') return bad(res, 'closed', 409);
  if (!a.staff && a.chart.pace === 'student' && r.day != null && r.day < a.chart.day) return bad(res, 'day-closed', 409);
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

/* --- prescripciones y línea temporal (profesorado) --- */
const timesOk = (s) => { const l = String(s || '').split(',').map((x) => x.trim()).filter(Boolean); if (l.length > 12 || !l.every((x) => /^([01]\d|2[0-3]):[0-5]\d$/.test(x))) return null; return [...new Set(l)].sort().join(','); };
function orderFields(b, o) {
  const drug = U.clip(b.drug != null ? b.drug : o && o.drug, 120); if (!drug) return { error: 'drug' };
  const route = CAT.ROUTES.includes(b.route) ? b.route : o ? o.route : 'oral';
  const prn = b.prn != null ? (b.prn ? 1 : 0) : o ? o.prn : 0;
  const times = prn ? '' : timesOk(b.times != null ? b.times : o && o.times); if (times == null) return { error: 'times' };
  const sd = b.start_day != null ? intId(b.start_day) : o ? o.start_day : 1, ed = b.end_day === '' || b.end_day === null ? null : b.end_day != null ? intId(b.end_day) : o ? o.end_day : null;
  if (!sd || sd > 60 || (ed != null && (ed < sd || ed > 60))) return { error: 'day' };
  return { v: [drug, U.clip(b.dose != null ? b.dose : o && o.dose, 80), route, U.clip(b.freq != null ? b.freq : o && o.freq, 80), times, prn, sd, ed, U.clipML(b.notes != null ? b.notes : o && o.notes, 500)] };
}
R('GET', '/api/patients/:id/plan', async (req, res, ctx) => {
  const p = db.get('SELECT id FROM patients WHERE id = ?', intId(ctx.params.id)); if (!p) return bad(res, 'notfound', 404);
  json(res, 200, { orders: db.all('SELECT * FROM orders WHERE patient_id = ? ORDER BY start_day, id', p.id).map(orderOut), events: db.all('SELECT * FROM events WHERE patient_id = ? ORDER BY day, id', p.id).map(evOut) });
}, { staff: true });
R('POST', '/api/patients/:id/orders', async (req, res, ctx) => {
  const p = db.get('SELECT id FROM patients WHERE id = ?', intId(ctx.params.id)); if (!p) return bad(res, 'notfound', 404);
  const f = orderFields(await readJson(req, 8e3), null); if (f.error) return bad(res, f.error);
  const r = db.run('INSERT INTO orders (patient_id, drug, dose, route, freq, times, prn, start_day, end_day, notes, created) VALUES (?,?,?,?,?,?,?,?,?,?,?)', p.id, ...f.v, new Date().toISOString());
  audit(ctx.user.email, 'prescripcion-alta', '#' + p.id + ' ' + f.v[0]); json(res, 200, { id: Number(r.lastInsertRowid) });
}, { staff: true });
R('PUT', '/api/orders/:id', async (req, res, ctx) => {
  const o = db.get('SELECT * FROM orders WHERE id = ?', intId(ctx.params.id)); if (!o) return bad(res, 'notfound', 404);
  const b = await readJson(req, 8e3);
  if (b.active != null && Object.keys(b).length === 1) { db.run('UPDATE orders SET active = ? WHERE id = ?', b.active ? 1 : 0, o.id); return json(res, 200, { ok: true }); }
  const f = orderFields(b, o); if (f.error) return bad(res, f.error);
  db.run('UPDATE orders SET drug=?, dose=?, route=?, freq=?, times=?, prn=?, start_day=?, end_day=?, notes=? WHERE id = ?', ...f.v, o.id);
  audit(ctx.user.email, 'prescripcion-edicion', '#' + o.id); json(res, 200, { ok: true });
}, { staff: true });
R('DELETE', '/api/orders/:id', async (req, res, ctx) => {
  const o = db.get('SELECT * FROM orders WHERE id = ?', intId(ctx.params.id)); if (!o) return bad(res, 'notfound', 404);
  if (db.get("SELECT 1 x FROM records r JOIN charts c ON c.id = r.chart_id WHERE c.patient_id = ? AND r.type = 'medicacion' AND json_extract(r.data, '$.order_id') = ?", o.patient_id, o.id)) return bad(res, 'has-records', 409);
  db.run('DELETE FROM orders WHERE id = ?', o.id); audit(ctx.user.email, 'prescripcion-borrada', '#' + o.id); json(res, 200, { ok: true });
}, { staff: true });
function eventFields(b, e) {
  const title = U.clip(b.title != null ? b.title : e && e.title, 160); if (!title) return { error: 'title' };
  const day = b.day != null ? intId(b.day) : e ? e.day : 1; if (!day || day > 60) return { error: 'day' };
  return { v: [['prueba', 'evento'].includes(b.kind) ? b.kind : e ? e.kind : 'prueba', day, title, U.clipML(b.body != null ? b.body : e && e.body, 3000)] };
}
R('POST', '/api/patients/:id/events', async (req, res, ctx) => {
  const p = db.get('SELECT id FROM patients WHERE id = ?', intId(ctx.params.id)); if (!p) return bad(res, 'notfound', 404);
  const f = eventFields(await readJson(req, 8e3), null); if (f.error) return bad(res, f.error);
  const r = db.run('INSERT INTO events (patient_id, kind, day, title, body, created) VALUES (?,?,?,?,?,?)', p.id, ...f.v, new Date().toISOString());
  json(res, 200, { id: Number(r.lastInsertRowid) });
}, { staff: true });
R('PUT', '/api/events/:id', async (req, res, ctx) => {
  const e = db.get('SELECT * FROM events WHERE id = ?', intId(ctx.params.id)); if (!e) return bad(res, 'notfound', 404);
  const f = eventFields(await readJson(req, 8e3), e); if (f.error) return bad(res, f.error);
  db.run('UPDATE events SET kind=?, day=?, title=?, body=? WHERE id = ?', ...f.v, e.id); json(res, 200, { ok: true });
}, { staff: true });
R('DELETE', '/api/events/:id', async (req, res, ctx) => { db.run('DELETE FROM events WHERE id = ?', intId(ctx.params.id)); json(res, 200, { ok: true }); }, { staff: true });

/* --- consignas (actividades): enunciado y tareas; un mismo paciente puede tener varias --- */
const TASK_KINDS = ['nota', 'constantes', 'balance', 'cuidado', 'medicacion', 'escala', 'valoracion', 'plan', 'plan_eval', 'informe', 'libre'];
function consignaFields(b, c) {
  const title = U.clip(b.title != null ? b.title : c && c.title, 160); if (!title) return { error: 'title' };
  const body = U.clipML(b.body != null ? b.body : c && c.body, 4000);
  const due = b.due != null ? String(b.due) : c ? c.due : ''; if (due && !U.validDate(due)) return { error: 'due' };
  const tasks = b.tasks != null ? b.tasks : c ? JSON.parse(c.tasks) : []; if (!Array.isArray(tasks)) return { error: 'tasks' };
  const out = [];
  for (const k of tasks.slice(0, 20)) { const kind = k && TASK_KINDS.includes(k.kind) ? k.kind : null, text = U.clip(k && k.text, 200); if (!kind || !text) continue; const day = Math.min(60, intId(k.day) || 0); out.push(Object.assign({ kind, min: kind === 'libre' ? 0 : Math.min(20, Math.max(1, intId(k.min) || 1)), text }, day ? { day } : {})); }
  return { v: [title, body, due || '', JSON.stringify(out)] };
}
const consignaOut = (c) => ({ id: c.id, title: c.title, body: c.body, due: c.due, tasks: JSON.parse(c.tasks) });
/* progreso de una historia: cuenta los registros vigentes de cada tipo */
function taskProgress(tasks, chartId) {
  const cnt = {}, byDay = {}; db.all('SELECT type, day, COUNT(*) n FROM records WHERE chart_id = ? AND void_at IS NULL GROUP BY type, day', chartId).forEach((r) => { cnt[r.type] = (cnt[r.type] || 0) + r.n; byDay[r.type + ':' + r.day] = r.n; });
  return tasks.map((k) => { if (k.kind === 'libre') return Object.assign({}, k, { done: null, count: 0 }); const n = k.day ? byDay[k.kind + ':' + k.day] || 0 : cnt[k.kind] || 0; return Object.assign({}, k, { count: n, done: n >= k.min }); });
}
function consignaBrief(chartId) {
  const c = db.get('SELECT k.* FROM consignas k JOIN charts h ON h.consigna_id = k.id WHERE h.id = ?', chartId); if (!c) return null;
  const t = taskProgress(JSON.parse(c.tasks), chartId).filter((x) => x.done != null);
  return { title: c.title, due: c.due, done: t.filter((x) => x.done).length, total: t.length };
}
function consignaFor(chart) {
  const c = chart.consigna_id && db.get('SELECT * FROM consignas WHERE id = ?', chart.consigna_id); if (!c) return null;
  return Object.assign(consignaOut(c), { tasks: taskProgress(JSON.parse(c.tasks), chart.id) });
}
R('GET', '/api/patients/:id/consignas', async (req, res, ctx) => {
  const p = db.get('SELECT id FROM patients WHERE id = ?', intId(ctx.params.id)); if (!p) return bad(res, 'notfound', 404);
  json(res, 200, { consignas: db.all('SELECT * FROM consignas WHERE patient_id = ? ORDER BY id', p.id).map(consignaOut) });
}, { staff: true });
R('POST', '/api/patients/:id/consignas', async (req, res, ctx) => {
  const p = db.get('SELECT id FROM patients WHERE id = ?', intId(ctx.params.id)); if (!p) return bad(res, 'notfound', 404);
  const f = consignaFields(await readJson(req, 3e4), null); if (f.error) return bad(res, f.error);
  const r = db.run('INSERT INTO consignas (patient_id, title, body, due, tasks, created) VALUES (?,?,?,?,?,?)', p.id, ...f.v, new Date().toISOString());
  audit(ctx.user.email, 'consigna-alta', '#' + p.id + ' ' + f.v[0]); json(res, 200, { id: Number(r.lastInsertRowid) });
}, { staff: true });
R('PUT', '/api/consignas/:id', async (req, res, ctx) => {
  const c = db.get('SELECT * FROM consignas WHERE id = ?', intId(ctx.params.id)); if (!c) return bad(res, 'notfound', 404);
  const f = consignaFields(await readJson(req, 3e4), c); if (f.error) return bad(res, f.error);
  db.run('UPDATE consignas SET title = ?, body = ?, due = ?, tasks = ? WHERE id = ?', ...f.v, c.id); audit(ctx.user.email, 'consigna-edicion', '#' + c.id); json(res, 200, { ok: true });
}, { staff: true });
R('DELETE', '/api/consignas/:id', async (req, res, ctx) => {
  const c = db.get('SELECT * FROM consignas WHERE id = ?', intId(ctx.params.id)); if (!c) return bad(res, 'notfound', 404);
  db.run('UPDATE charts SET consigna_id = NULL WHERE consigna_id = ?', c.id); db.run('DELETE FROM consignas WHERE id = ?', c.id); audit(ctx.user.email, 'consigna-borrada', '#' + c.id); json(res, 200, { ok: true });
}, { staff: true });

/* --- seguimiento y corrección: qué ha hecho cada alumno o grupo --- */
const patName = (pdata) => { const d = JSON.parse(pdata); return ((d.apellidos || '') + (d.nombre ? ', ' + d.nombre : '')).trim(); };
R('GET', '/api/patients/:id/seguimiento', async (req, res, ctx) => {
  const p = db.get('SELECT id FROM patients WHERE id = ?', intId(ctx.params.id)); if (!p) return bad(res, 'notfound', 404);
  const groups = new Map();
  for (const c of db.all('SELECT * FROM charts WHERE patient_id = ? ORDER BY id', p.id)) {
    const k = c.consigna_id || 0;
    if (!groups.has(k)) { const kr = k && db.get('SELECT * FROM consignas WHERE id = ?', k); groups.set(k, { consigna: kr ? consignaOut(kr) : null, charts: [] }); }
    const g = groups.get(k), tasks = g.consigna ? taskProgress(g.consigna.tasks, c.id) : [];
    const per = {}; db.all('SELECT user_id, COUNT(*) n, MAX(occurred) last FROM records WHERE chart_id = ? AND void_at IS NULL GROUP BY user_id', c.id).forEach((r) => { per[r.user_id] = r; });
    const gr = {}; db.all('SELECT user_id, total, published FROM grades WHERE chart_id = ?', c.id).forEach((r) => { gr[r.user_id] = { total: r.total, published: !!r.published }; });
    const tot = db.get('SELECT COUNT(*) n, MAX(occurred) last FROM records WHERE chart_id = ? AND void_at IS NULL', c.id);
    g.charts.push({ id: c.id, name: c.name, kind: c.kind, ...chartMeta(c.id), raw_status: c.status, records: tot.n, last: tot.last || '', progress: tasks.map((t) => ({ done: t.done, count: t.count })),
      members: membersOf(c.id).map((m) => ({ id: m.id, name: m.name, records: (per[m.id] || {}).n || 0, last: (per[m.id] || {}).last || '', grade: gr[m.id] || null })) });
  }
  json(res, 200, { groups: [...groups.values()].sort((a, b) => (b.consigna ? 1 : 0) - (a.consigna ? 1 : 0) || (a.consigna ? a.consigna.id - b.consigna.id : 0)) });
}, { staff: true });
function studentModel(u) {
  const rows = db.all('SELECT c.*, p.code, p.data pdata FROM charts c JOIN chart_members m ON m.chart_id = c.id JOIN patients p ON p.id = c.patient_id WHERE m.user_id = ? ORDER BY c.id', u.id);
  return { user: { name: u.name, email: u.email }, charts: rows.map((c) => ({ id: c.id, code: c.code, patient: patName(c.pdata), name: c.kind === 'team' ? c.name : '', status: c.status, consigna: consignaFor(c),
    grade: db.get('SELECT total, published, comment FROM grades WHERE chart_id = ? AND user_id = ?', c.id, u.id) || null,
    records: db.all('SELECT * FROM records WHERE chart_id = ? AND user_id = ? ORDER BY occurred, id', c.id, u.id).map((r) => Object.assign({}, r, { data: JSON.parse(r.data), comments: db.all('SELECT k.text, x.name author FROM comments k JOIN users x ON x.id = k.user_id WHERE k.record_id = ? ORDER BY k.id', r.id) })) })) };
}
const studentOr404 = (id) => db.get("SELECT * FROM users WHERE id = ? AND role = 'student'", intId(id));
R('GET', '/api/students/:id/work', async (req, res, ctx) => {
  const u = studentOr404(ctx.params.id); if (!u) return bad(res, 'notfound', 404);
  const m = studentModel(u);
  json(res, 200, { user: { id: u.id, name: u.name, email: u.email }, charts: m.charts.map((c) => ({ id: c.id, patient: c.patient, code: c.code, name: c.name, status: c.status, ...chartMeta(c.id),
    consigna: c.consigna ? { title: c.consigna.title, due: c.consigna.due, done: c.consigna.tasks.filter((t) => t.done).length, total: c.consigna.tasks.filter((t) => t.done != null).length } : null,
    records: c.records.filter((r) => !r.void_at).length, last: c.records.length ? c.records[c.records.length - 1].occurred : '', grade: c.grade ? { total: c.grade.total, published: !!c.grade.published } : null })) });
}, { staff: true });
const slugName = (n) => String(n).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'alumno';
R('GET', '/api/students/:id/report.pdf', async (req, res, ctx) => {
  const u = studentOr404(ctx.params.id); if (!u) return bad(res, 'notfound', 404);
  const lang = ctx.url.searchParams.get('lang') === 'es' ? 'es' : 'ca', buf = REP.studentPdf(studentModel(u), lang, todayLocal());
  audit(ctx.user.email, 'informe-pdf', u.email);
  res.writeHead(200, hdrs({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="informe-' + slugName(u.name) + '.pdf"', 'Content-Length': buf.length, 'Cache-Control': 'no-store' })); res.end(buf);
}, { staff: true });
R('GET', '/api/patients/:id/case.pdf', async (req, res, ctx) => {
  const p = db.get('SELECT * FROM patients WHERE id = ?', intId(ctx.params.id)); if (!p) return bad(res, 'notfound', 404);
  const q = ctx.url.searchParams, full = q.get('full') === '1', lang = q.get('lang') === 'es' ? 'es' : 'ca', day = Math.min(60, Math.max(1, intId(q.get('day')) || 1));
  const d = JSON.parse(p.data), data = full ? d : PAT.forStudent(d);
  const orders = db.all('SELECT * FROM orders WHERE patient_id = ? AND active = 1 ORDER BY start_day, id', p.id).filter((o) => full || o.start_day <= day).map(orderOut);
  const events = db.all('SELECT * FROM events WHERE patient_id = ? ORDER BY day, id', p.id).filter((e) => full || e.day <= day).map(evOut);
  const consignas = db.all('SELECT * FROM consignas WHERE patient_id = ? ORDER BY id', p.id).map(consignaOut);
  const buf = REP.casePdf({ code: p.code, data, orders, events, consignas, day: full ? null : day }, lang, full, todayLocal());
  audit(ctx.user.email, 'caso-pdf', p.code + (full ? ' completo' : ' alumnado día ' + day));
  res.writeHead(200, hdrs({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="caso-' + p.code + (full ? '-completo' : '') + '.pdf"', 'Content-Length': buf.length, 'Cache-Control': 'no-store' })); res.end(buf);
}, { staff: true });
R('GET', '/api/reports.zip', async (req, res, ctx) => {
  const lang = ctx.url.searchParams.get('lang') === 'es' ? 'es' : 'ca', pid = intId(ctx.url.searchParams.get('patient'));
  const users = db.all("SELECT DISTINCT u.* FROM users u JOIN records r ON r.user_id = u.id JOIN charts c ON c.id = r.chart_id WHERE u.role = 'student' AND u.email NOT LIKE ?" + (pid ? ' AND c.patient_id = ?' : '') + ' ORDER BY u.name COLLATE NOCASE', ...(pid ? ['%@historia.local', pid] : ['%@historia.local']));
  if (!users.length) return bad(res, 'No hay registros de alumnado que descargar.', 404);
  const used = new Set(), files = users.map((u) => { let n = slugName(u.name), k = n, i = 2; while (used.has(k)) k = n + '_' + i++; used.add(k); return { name: k + '.pdf', data: REP.studentPdf(studentModel(u), lang, todayLocal()) }; });
  const buf = REP.zipStore(files); audit(ctx.user.email, 'informes-zip', files.length + ' alumnos');
  res.writeHead(200, hdrs({ 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="informes-alumnado.zip"', 'Content-Length': buf.length, 'Cache-Control': 'no-store' })); res.end(buf);
}, { staff: true });

/* --- borrar los datos introducidos por el alumnado (fin de curso o cuando se quiera) --- */
function cleanupTargets(scope, id) {
  if (scope === 'student') { const u = studentOr404(id); if (!u) return null; return { user: u, chartIds: db.all('SELECT chart_id FROM chart_members WHERE user_id = ?', u.id).map((r) => r.chart_id) }; }
  let rows;
  if (scope === 'all') rows = db.all('SELECT id FROM charts');
  else if (scope === 'patient') { if (!db.get('SELECT 1 x FROM patients WHERE id = ?', intId(id))) return null; rows = db.all('SELECT id FROM charts WHERE patient_id = ?', intId(id)); }
  else if (scope === 'consigna') { if (!db.get('SELECT 1 x FROM consignas WHERE id = ?', intId(id))) return null; rows = db.all('SELECT id FROM charts WHERE consigna_id = ?', intId(id)); }
  else if (scope === 'chart') { if (!db.get('SELECT 1 x FROM charts WHERE id = ?', intId(id))) return null; rows = [{ id: intId(id) }]; }
  else return null;
  return { chartIds: rows.map((r) => r.id) };
}
const inList = (ids) => '(' + (ids.length ? ids.map(Number).join(',') : '-1') + ')';
function cleanupCounts(tg) {
  const q = (sql) => db.get(sql).n;
  if (tg.user) { const uid = tg.user.id; return { records: q('SELECT COUNT(*) n FROM records WHERE user_id = ' + uid), comments: q('SELECT COUNT(*) n FROM comments WHERE record_id IN (SELECT id FROM records WHERE user_id = ' + uid + ')'), grades: q('SELECT COUNT(*) n FROM grades WHERE user_id = ' + uid), charts: tg.chartIds.length }; }
  const L = inList(tg.chartIds);
  return { records: q('SELECT COUNT(*) n FROM records WHERE chart_id IN ' + L), comments: q('SELECT COUNT(*) n FROM comments WHERE chart_id IN ' + L), grades: q('SELECT COUNT(*) n FROM grades WHERE chart_id IN ' + L), charts: tg.chartIds.length };
}
R('GET', '/api/cleanup', async (req, res, ctx) => {
  const scope = ctx.url.searchParams.get('scope'), tg = cleanupTargets(scope, ctx.url.searchParams.get('id')); if (!tg) return bad(res, 'notfound', 404);
  if (scope === 'all' && ctx.user.role !== 'admin') return bad(res, 'forbidden', 403);
  json(res, 200, cleanupCounts(tg));
}, { staff: true });
R('POST', '/api/cleanup', async (req, res, ctx) => {
  const b = await readJson(req, 4e3), scope = String(b.scope || ''), tg = cleanupTargets(scope, b.id); if (!tg) return bad(res, 'notfound', 404);
  if (scope === 'all' && ctx.user.role !== 'admin') return bad(res, 'forbidden', 403);
  if (!/^(borrar|esborrar)$/i.test(String(b.confirm || '').trim())) return bad(res, 'confirm');
  const withGrades = b.grades !== false, withCharts = !!b.charts, n = cleanupCounts(tg);
  db.tx(() => {
    if (tg.user) {
      const uid = tg.user.id;
      db.run('DELETE FROM comments WHERE record_id IN (SELECT id FROM records WHERE user_id = ?)', uid); db.run('DELETE FROM records WHERE user_id = ?', uid);
      if (withGrades) db.run('DELETE FROM grades WHERE user_id = ?', uid);
      if (withCharts) {
        for (const cid of tg.chartIds) { const c = db.get('SELECT kind FROM charts WHERE id = ?', cid); if (c && c.kind === 'individual' && db.get('SELECT COUNT(*) n FROM chart_members WHERE chart_id = ?', cid).n <= 1) db.run('DELETE FROM charts WHERE id = ?', cid); }
        db.run('DELETE FROM chart_members WHERE user_id = ?', uid);
      }
    } else {
      const L = inList(tg.chartIds);
      db.run('DELETE FROM comments WHERE chart_id IN ' + L); db.run('DELETE FROM records WHERE chart_id IN ' + L);
      if (withGrades) db.run('DELETE FROM grades WHERE chart_id IN ' + L);
      if (withCharts) db.run('DELETE FROM charts WHERE id IN ' + L);
    }
  });
  audit(ctx.user.email, 'borrado-datos', scope + (b.id ? ' #' + b.id : '') + ': ' + n.records + ' registros, ' + n.comments + ' comentarios' + (withGrades ? ', ' + n.grades + ' notas' : '') + (withCharts ? ', historias' : ''));
  json(res, 200, { ok: true, deleted: n });
}, { staff: true });

/* --- importar un caso desde texto plano (lo que devuelve una IA) --- */
const IMP = require('./lib/import');
R('GET', '/api/import/template', async (req, res) => json(res, 200, { template: IMP.TEMPLATES.ca, templates: IMP.TEMPLATES }), { staff: true });
function importCase(text, commit, user) {
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const r = IMP.parse(text, today), errors = r.errors.slice(), warnings = r.warnings.slice();
  const pat = PAT.sanitize(r.patient); if (pat.error) errors.push({ line: 0, msg: 'Ficha no válida (' + pat.error + ').' });
  const orders = [], events = [];
  for (const o of r.orders) { const f = orderFields(o, null); if (f.error) errors.push({ line: o.n, msg: 'Prescripción «' + o.drug + '» no válida (' + f.error + ').' }); else orders.push({ line: o.n, v: f.v, o }); }
  for (const e of r.events) { const f = eventFields(e, null); if (f.error) errors.push({ line: e.n, msg: 'Evento «' + e.title + '» no válido (' + f.error + ').' }); else events.push({ line: e.n, v: f.v, e }); }
  const consignas = [];
  for (const k of r.consignas || []) { const f = consignaFields(k, null); if (f.error) errors.push({ line: k.n, msg: 'Consigna «' + k.title + '» no válida (' + f.error + ').' }); else consignas.push({ v: f.v }); }
  const blocking = errors.some((e) => e.line === 0);
  const filled = pat.data ? Object.keys(pat.data).filter((k) => !['alergias'].includes(k)).length : 0;
  const out = {
    can_commit: !blocking && !!pat.data, errors, warnings, filled,
    topics: cleanClass({ topics: r.topics }).topics,
    patient: pat.data ? { nombre: pat.data.nombre, apellidos: pat.data.apellidos, diagnostico: pat.data.diagnostico_medico || '', alergias: pat.data.alergias.length, sin_alergias: !!pat.data.sin_alergias } : null,
    orders: orders.map((x) => ({ drug: x.v[0], dose: x.v[1], route: x.v[2], times: x.v[4], prn: !!x.v[5], start_day: x.v[6], end_day: x.v[7] })),
    events: events.map((x) => ({ kind: x.v[0], day: x.v[1], title: x.v[2] })),
    consignas: consignas.map((x) => ({ title: x.v[0], tasks: JSON.parse(x.v[3]).length })),
  };
  if (!commit) return { status: 200, body: out };
  if (!out.can_commit) return { status: 400, body: { error: 'El texto tiene errores en la ficha: corrígelos antes de crear el caso.' } };
  let id, code; const now = new Date().toISOString();
  db.tx(() => {
    const n = db.get('SELECT COALESCE(MAX(id),0)+1 n FROM patients').n; code = 'P' + String(n).padStart(4, '0');
    id = Number(db.run('INSERT INTO patients (code, data, topics, created, created_by) VALUES (?,?,?,?,?)', code, JSON.stringify(pat.data), JSON.stringify(cleanClass({ topics: r.topics }).topics), now, user.id).lastInsertRowid);
    for (const x of orders) db.run('INSERT INTO orders (patient_id, drug, dose, route, freq, times, prn, start_day, end_day, notes, created) VALUES (?,?,?,?,?,?,?,?,?,?,?)', id, ...x.v, now);
    for (const x of events) db.run('INSERT INTO events (patient_id, kind, day, title, body, created) VALUES (?,?,?,?,?,?)', id, ...x.v, now);
    for (const x of consignas) db.run('INSERT INTO consignas (patient_id, title, body, due, tasks, created) VALUES (?,?,?,?,?,?)', id, ...x.v, now);
  });
  audit(user.email, 'caso-importado', code + ' ' + pat.data.nombre + ' (' + orders.length + ' prescripciones, ' + events.length + ' eventos, ' + consignas.length + ' consignas)');
  return { status: 200, body: Object.assign(out, { id, code }) };
}
R('POST', '/api/import', async (req, res, ctx) => {
  const b = await readJson(req, 3e5), text = String(b.text || '');
  if (text.trim().length < 20) return bad(res, 'Pega el texto del caso.');
  const r = importCase(text, !!b.commit, ctx.user); json(res, r.status, r.body);
}, { staff: true });
/* Caso de ejemplo ya trabajado: paciente, historia y algunos registros del alumno de prueba, para ver cómo queda. */
R('POST', '/api/import/example', async (req, res, ctx) => {
  const eb = await readJson(req, 1e3), lang = eb.lang === 'es' ? 'es' : 'ca';
  const r = importCase(IMP.EXAMPLES[lang], true, ctx.user); if (r.status !== 200) return json(res, r.status, r.body);
  const now = new Date(), pad2 = (n) => String(n).padStart(2, '0');
  const at = (daysAgo, hm) => { const d = new Date(now.getTime() - daysAgo * 864e5); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + 'T' + hm; };
  const demo = demoUser('enfermeria');
  const firstK = db.get('SELECT id FROM consignas WHERE patient_id = ? ORDER BY id LIMIT 1', r.body.id);
  const chartId = Number(db.run("INSERT INTO charts (patient_id, kind, name, day, consigna_id, created) VALUES (?,'team',?,3," + (firstK ? firstK.id : 'NULL') + ",?)", r.body.id, (lang === 'ca' ? 'Història d\'exemple' : 'Historia de ejemplo'), now.toISOString()).lastInsertRowid);
  db.run('INSERT INTO chart_members (chart_id, user_id, role) VALUES (?,?,?)', chartId, demo.id, 'enfermeria');
  const orderByDrug = (d) => db.get('SELECT * FROM orders WHERE patient_id = ? AND drug = ?', r.body.id, d);
  const ctxv = { role: 'enfermeria', catalog: catalogGet, order: (oid) => db.get('SELECT * FROM orders WHERE id = ? AND patient_id = ?', oid, r.body.id), record: () => null };
  const recs = [
    ['constantes', { ta_sis: 142, ta_dia: 88, fc: 98, fr: 24, temp: 37.8, spo2: 90, dolor: 3, conciencia: 'alerta' }, at(2, '08:00')],
    ['constantes', { ta_sis: 138, ta_dia: 84, fc: 94, fr: 22, temp: 38.4, spo2: 91, dolor: 3 }, at(2, '20:00')],
    ['constantes', { ta_sis: 135, ta_dia: 80, fc: 88, fr: 20, temp: 37.2, spo2: 93, glucemia: 168 }, at(1, '08:00')],
    ['constantes', { ta_sis: 132, ta_dia: 80, fc: 86, fr: 20, temp: 36.9, spo2: 93, glucemia: 245 }, at(1, '20:00')],
    ['constantes', { ta_sis: 128, ta_dia: 78, fc: 82, fr: 18, temp: 36.8, spo2: 95, dolor: 1 }, at(0, '08:00')],
    ['balance', { dir: 'ingesta', via: 'oral', ml: 600 }, at(1, '14:00')], ['balance', { dir: 'ingesta', via: 'iv', ml: 500 }, at(1, '16:00')], ['balance', { dir: 'eliminacion', via: 'diuresis', ml: 900 }, at(1, '18:00')], ['balance', { dir: 'eliminacion', via: 'vomito', ml: 150 }, at(1, '22:00')], ['balance', { dir: 'ingesta', via: 'oral', ml: 700 }, at(1, '20:00')], ['balance', { dir: 'eliminacion', via: 'diuresis', ml: 750 }, at(0, '07:30')], ['balance', { dir: 'ingesta', via: 'oral', ml: 800 }, at(0, '08:30')],
    ['nota', { texto: lang === 'ca' ? 'Pacient conscient i orientada, amb dispnea en parlar. Es manté amb ulleres nasals a 2 l/min. Tolera la dieta. Refereix tos amb expectoració groguenca.' : 'Paciente consciente y orientada, con disnea al hablar. Se mantiene con gafas nasales a 2 l/min. Tolera la dieta. Refiere tos con expectoración amarillenta.', turno: 'M', tipo: 'evolucion' }, at(1, '10:00')],
    ['escala', { scale: 'barthel', items: { comer: 10, lavarse: 5, vestirse: 5, arreglarse: 5, deposicion: 10, miccion: 10, retrete: 5, traslado: 10, deambulacion: 10, escaleras: 5 } }, at(1, '11:00')],
  ];
  const par = orderByDrug('Paracetamol');
  const levName = lang === 'ca' ? 'Levofloxacina' : 'Levofloxacino'; if (par) recs.push(['medicacion', { order_id: par.id, slot: '08:00', estado: 'administrada' }, at(0, '08:05')]);
  const lev = orderByDrug(levName); if (lev) recs.push(['medicacion', { order_id: lev.id, slot: '10:00', estado: 'administrada' }, at(0, '10:10')]);
  let n = 0;
  for (const [type, d, occ] of recs) { try { const data = CAT.validate(type, d, ctxv); db.run('INSERT INTO records (chart_id, user_id, author_role, type, data, occurred, created) VALUES (?,?,?,?,?,?,?)', chartId, demo.id, 'enfermeria', type, JSON.stringify(data), occ, now.toISOString()); n++; } catch (e) { /* un registro no válido no impide el ejemplo */ } }
  audit(ctx.user.email, 'caso-ejemplo', r.body.code + ' (' + n + ' registros)');
  json(res, 200, { id: r.body.id, code: r.body.code, chart_id: chartId, records: n });
}, { staff: true });

/* --- profesorado adicional (solo administración): cuentas propias con correo y contraseña --- */
R('POST', '/api/teachers', async (req, res, ctx) => {
  if (ctx.user.role !== 'admin') return bad(res, 'forbidden', 403);
  const b = await readJson(req, 2e3), email = String(b.email || '').toLowerCase().trim(), name = U.clip(b.name, 120), pw = String(b.password || '');
  if (!U.validEmail(email) || !name) return bad(res, 'Escribe nombre y un correo válido.');
  if (pw.length < 10) return bad(res, 'La contraseña debe tener al menos 10 caracteres.');
  const ex = db.get('SELECT * FROM users WHERE email = ?', email);
  if (ex && ex.role !== 'teacher') return bad(res, 'Ese correo ya existe como alumnado o administración.', 409);
  if (ex) db.run('UPDATE users SET name = ?, pw = ?, active = 1 WHERE id = ?', name, pwHash(pw), ex.id);
  else db.run("INSERT INTO users (email, name, role, profile, lang, subjects, pw, created) VALUES (?,?,'teacher','enfermeria','es','[]',?,?)", email, name, pwHash(pw), new Date().toISOString());
  audit(ctx.user.email, 'profesorado-alta', email); json(res, 200, { ok: true });
}, { staff: true });
R('DELETE', '/api/teachers/:id', async (req, res, ctx) => {
  if (ctx.user.role !== 'admin') return bad(res, 'forbidden', 403);
  const u = db.get("SELECT * FROM users WHERE id = ? AND role = 'teacher'", intId(ctx.params.id)); if (!u) return bad(res, 'notfound', 404);
  db.run('UPDATE users SET active = 0, pw = NULL WHERE id = ?', u.id); db.run('DELETE FROM sessions WHERE user_id = ?', u.id);
  audit(ctx.user.email, 'profesorado-baja', u.email); json(res, 200, { ok: true });
}, { staff: true });

/* --- ver la historia como la ve el alumnado (solo lectura) --- */
const DEMO_DOMAIN = '@historia.local';
function demoUser(profile) {
  profile = profile === 'tcae' ? 'tcae' : 'enfermeria';
  const email = 'alumno.prueba.' + profile + DEMO_DOMAIN;
  const u = db.get('SELECT * FROM users WHERE email = ?', email); if (u) return u;
  db.run("INSERT INTO users (email, name, role, profile, profile_manual, lang, subjects, created) VALUES (?,?,'student',?,1,'es','[]',?)", email, profile === 'tcae' ? 'Alumno de prueba (TCAE)' : 'Alumno de prueba (Enfermería)', profile, new Date().toISOString());
  return db.get('SELECT * FROM users WHERE email = ?', email);
}
R('POST', '/api/charts/:id/preview', async (req, res, ctx) => {
  const c = db.get('SELECT * FROM charts WHERE id = ?', intId(ctx.params.id)); if (!c) return bad(res, 'notfound', 404);
  const b = await readJson(req, 1e3), u = demoUser(b.profile);
  db.run('INSERT OR IGNORE INTO chart_members (chart_id, user_id, role) VALUES (?,?,?)', c.id, u.id, u.profile);
  db.run('UPDATE sessions SET as_user = ? WHERE hash = ?', u.id, U.sha(cookies(req).hid));
  audit(ctx.user.email, 'vista-alumno', '#' + c.id + ' ' + u.profile); json(res, 200, { ok: true });
}, { staff: true });
R('POST', '/api/preview/exit', async (req, res, ctx) => {
  db.run('UPDATE sessions SET as_user = NULL WHERE hash = ?', U.sha(cookies(req).hid)); json(res, 200, { ok: true });
});

/* --- evaluación: rúbrica y notas --- */
const DEF_RUBRIC = [
  { id: 'valoracion', es: 'Valoración del paciente', ca: 'Valoració del pacient', w: 2 },
  { id: 'registros', es: 'Calidad de los registros (constantes, balance, cuidados)', ca: 'Qualitat dels registres (constants, balanç, cures)', w: 2 },
  { id: 'plan', es: 'Plan de cuidados', ca: 'Pla de cures', w: 3 },
  { id: 'medicacion', es: 'Seguridad y medicación', ca: 'Seguretat i medicació', w: 2 },
  { id: 'comunicacion', es: 'Notas de evolución y comunicación', ca: "Notes d'evolució i comunicació", w: 1 },
];
const getRubric = () => { try { const r = JSON.parse(db.getSetting('rubric', '')); return Array.isArray(r) && r.length ? r : DEF_RUBRIC; } catch (_) { return DEF_RUBRIC; } };
function gradeTotal(scores, rubric) {
  let sw = 0, acc = 0;
  for (const c of rubric) { const v = scores[c.id]; if (typeof v === 'number') { sw += c.w; acc += (c.w * v) / 4; } }
  return sw ? Math.round((acc / sw) * 100) / 10 : null;
}
const gradeOut = (g) => ({ user_id: g.user_id, scores: JSON.parse(g.scores), total: g.total, comment: g.comment, published: !!g.published, updated: g.updated });
function gradesFor(a, user) {
  if (a.staff) return { rubric: getRubric(), list: db.all('SELECT * FROM grades WHERE chart_id = ?', a.chart.id).map(gradeOut) };
  const g = db.get('SELECT * FROM grades WHERE chart_id = ? AND user_id = ? AND published = 1', a.chart.id, user.id);
  return g ? { rubric: getRubric(), list: [gradeOut(g)] } : { rubric: [], list: [] };
}
R('GET', '/api/rubric', async (req, res) => json(res, 200, { rubric: getRubric() }), { staff: true });
R('PUT', '/api/rubric', async (req, res, ctx) => {
  const b = await readJson(req, 2e4); const out = [];
  for (const c of (Array.isArray(b.rubric) ? b.rubric : []).slice(0, 12)) {
    const es = U.clip(c.es, 120); if (!es) continue;
    out.push({ id: 'c' + (out.length + 1), es, ca: U.clip(c.ca, 120) || es, w: Math.min(10, Math.max(1, intId(c.w) || 1)) });
  }
  if (!out.length) return bad(res, 'rubric');
  db.setSetting('rubric', JSON.stringify(out)); audit(ctx.user.email, 'rubrica', out.length + ' criterios'); json(res, 200, { ok: true });
}, { staff: true });
R('PUT', '/api/charts/:id/grades/:uid', async (req, res, ctx) => {
  const c = db.get('SELECT * FROM charts WHERE id = ?', intId(ctx.params.id)); if (!c) return bad(res, 'notfound', 404);
  const uid = intId(ctx.params.uid); if (!db.get('SELECT 1 x FROM chart_members WHERE chart_id = ? AND user_id = ?', c.id, uid)) return bad(res, 'notfound', 404);
  const b = await readJson(req, 8e3), rub = getRubric(), scores = {};
  for (const cr of rub) { const v = b.scores && b.scores[cr.id]; if (v === '' || v == null) continue; const n = Number(v); if (!Number.isInteger(n) || n < 0 || n > 4) return bad(res, 'scores'); scores[cr.id] = n; }
  const total = gradeTotal(scores, rub);
  db.run('INSERT INTO grades (chart_id, user_id, scores, total, comment, published, by_email, updated) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(chart_id, user_id) DO UPDATE SET scores = excluded.scores, total = excluded.total, comment = excluded.comment, published = excluded.published, by_email = excluded.by_email, updated = excluded.updated',
    c.id, uid, JSON.stringify(scores), total, U.clipML(b.comment, 2000), b.published ? 1 : 0, ctx.user.email, new Date().toISOString());
  audit(ctx.user.email, 'nota', '#' + c.id + ' alumno ' + uid + ' = ' + total + (b.published ? ' (publicada)' : ''));
  json(res, 200, { ok: true, total });
}, { staff: true });
const GRADE_SQL = 'SELECT g.*, u.name, u.email, u.subjects usubs, c.name chart_name, c.kind, c.consigna_id, c.patient_id, k.title ktitle, p.code, p.data pdata FROM grades g JOIN users u ON u.id = g.user_id JOIN charts c ON c.id = g.chart_id JOIN patients p ON p.id = c.patient_id LEFT JOIN consignas k ON k.id = c.consigna_id ORDER BY p.id, c.consigna_id, c.id, u.name COLLATE NOCASE';
R('GET', '/api/grades', async (req, res) => {
  const rows = db.all(GRADE_SQL);
  json(res, 200, { rubric: getRubric(), campus: JSON.parse(db.getSetting('campus_subjects', '[]')), grades: rows.map((r) => Object.assign(gradeOut(r), { consigna_id: r.consigna_id, consigna: r.ktitle || '', patient_id: r.patient_id, subjects: JSON.parse(r.usubs || '[]'), chart_id: r.chart_id, name: r.name, email: r.email, chart: r.chart_name, kind: r.kind, code: r.code, patient: JSON.parse(r.pdata).apellidos || '' })) });
}, { staff: true });
/* Envía al Campus las notas publicadas de una ACTIVIDAD: todas las historias que comparten consigna (o, sin consigna, las del mismo paciente) forman una sola prueba. */
R('POST', '/api/send-campus', async (req, res, ctx) => {
  if (!CAMPUS_TOKEN) return bad(res, 'Falta CAMPUS_TOKEN en el entorno.', 503);
  const b = await readJson(req, 4e3), m = String(b.group || '').match(/^([kp])(\d+)$/); if (!m) return bad(res, 'group');
  const slug = U.clip(b.slug, 80), title = U.clip(b.title, 160), kind = ['teoria', 'practica', 'seguimiento'].includes(b.kind) ? b.kind : '';
  if (!slug || !title || !kind) return bad(res, 'Elige asignatura, categoría y título.');
  const rows = db.all('SELECT g.total, u.email FROM grades g JOIN users u ON u.id = g.user_id JOIN charts c ON c.id = g.chart_id WHERE g.published = 1 AND g.total IS NOT NULL AND ' + (m[1] === 'k' ? 'c.consigna_id = ?' : 'c.consigna_id IS NULL AND c.patient_id = ?') + ' ORDER BY g.updated', +m[2]);
  const byEmail = new Map(); rows.forEach((x) => byEmail.set(x.email, x.total));
  if (!byEmail.size) return bad(res, 'No hay notas publicadas en esta actividad.');
  let r, j;
  try {
    r = await fetch(CAMPUS_URL + '/api/historia/grades', { method: 'POST', headers: { Authorization: 'Bearer ' + CAMPUS_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, key: 'hc-' + m[1] + m[2], title, kind, ra_id: b.ra_id || null, weight: b.weight, grades: [...byEmail].map(([email, grade]) => ({ email, grade })) }), signal: AbortSignal.timeout(20000) });
    j = await r.json().catch(() => ({}));
  } catch (e) { return bad(res, 'No se pudo contactar con el Campus.', 502); }
  if (!r.ok) return bad(res, j.msg || 'El Campus respondió ' + r.status, 502);
  audit(ctx.user.email, 'enviar-notas-campus', m[1] + m[2] + ' → ' + slug + ' (' + j.saved + ' notas)');
  json(res, 200, j);
}, { staff: true });
const csvCell = (v) => { let s = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
R('GET', '/api/grades.csv', async (req, res) => {
  const out = ['Alumno;Correo;Caso;Historia;Nota (0-10);Publicada;Comentario'].concat(db.all(GRADE_SQL).map((r) => [r.name, r.email, r.code + ' ' + (JSON.parse(r.pdata).apellidos || ''), r.chart_name, r.total == null ? '' : String(r.total).replace('.', ','), r.published ? 'sí' : 'no', r.comment.replace(/\s+/g, ' ')].map(csvCell).join(';')));
  res.writeHead(200, hdrs({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="notas-historia-clinica.csv"', 'Cache-Control': 'no-store' }));
  res.end('\ufeff' + out.join('\r\n'));
}, { staff: true });

/* ---------- servidor ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };
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
      if (ctx.user && ctx.user._preview && req.method !== 'GET' && pathname !== '/api/preview/exit' && pathname !== '/api/logout') { req.resume(); return json(res, 403, { error: 'preview' }); }
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
