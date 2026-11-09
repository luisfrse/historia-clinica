'use strict';
const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hc-'));
process.env.DATA_DIR = dir; process.env.SSO_SECRET = 'secreto-de-prueba'; process.env.ADMIN_PASSWORD = 'clave-admin-larga';
const SSO = require('../lib/sso');
const { server } = require('../server');

let base;
test.before(async () => { await new Promise((r) => server.listen(0, r)); base = 'http://127.0.0.1:' + server.address().port; });
test.after(() => { server.close(); });

async function call(method, url, body, cookie) {
  const r = await fetch(base + url, { method, redirect: 'manual', headers: Object.assign({ 'X-Requested-With': 'historia', 'Content-Type': 'application/json' }, cookie ? { Cookie: cookie } : {}), body: body ? JSON.stringify(body) : undefined });
  const ck = (r.headers.get('set-cookie') || '').split(';')[0];
  let j = null; try { j = await r.json(); } catch (_) {}
  return { status: r.status, json: j, cookie: ck, loc: r.headers.get('location') };
}
const token = (o) => SSO.sign(Object.assign({ iss: 'campus', jti: crypto.randomUUID(), iat: Date.now(), exp: Date.now() + 60e3, lang: 'es', subjects: [] }, o), 'secreto-de-prueba');
async function sso(o) { const r = await fetch(base + '/sso?t=' + encodeURIComponent(token(o)), { redirect: 'manual' }); return (r.headers.get('set-cookie') || '').split(';')[0]; }

const ficha = { nombre: 'Carmen', apellidos: 'Ruiz Soto', sexo: 'F', fecha_nacimiento: '1948-03-02', motivo_ingreso: 'Disnea', diagnostico_medico: 'EPOC reagudizada', notas_docente: 'SOLO PROFESORADO', alergias: [{ agente: 'Penicilina', reaccion: 'urticaria', gravedad: 'moderada' }] };
let admin, ana, luis, pid, chartAna, chartLuis;

test('SSO: acepta token válido, rechaza falsificado, caducado y reutilizado', async () => {
  const t = token({ email: 'x@y.com', name: 'X' });
  const r1 = await fetch(base + '/sso?t=' + encodeURIComponent(t), { redirect: 'manual' });
  assert.strictEqual(r1.status, 302);
  const r2 = await fetch(base + '/sso?t=' + encodeURIComponent(t), { redirect: 'manual' });
  assert.strictEqual(r2.status, 401, 'reutilización');
  const bad = SSO.sign({ iss: 'campus', jti: 'a1', iat: Date.now(), exp: Date.now() + 60e3, email: 'x@y.com' }, 'otro-secreto');
  assert.strictEqual((await fetch(base + '/sso?t=' + encodeURIComponent(bad), { redirect: 'manual' })).status, 401);
  const old = SSO.sign({ iss: 'campus', jti: 'a2', iat: Date.now() - 200e3, exp: Date.now() - 100e3, email: 'x@y.com' }, 'secreto-de-prueba');
  assert.strictEqual((await fetch(base + '/sso?t=' + encodeURIComponent(old), { redirect: 'manual' })).status, 401);
});

test('inicio de sesión de profesorado y alumnado', async () => {
  admin = await sso({ email: 'admin@campus.local', name: 'Admin', admin: true });
  ana = await sso({ email: 'ana@x.com', name: 'Ana Uno' });
  luis = await sso({ email: 'luis@x.com', name: 'Luis Dos' });
  assert.ok(admin && ana && luis);
  assert.strictEqual((await call('GET', '/api/me', null, admin)).json.staff, true);
  assert.strictEqual((await call('GET', '/api/me', null, ana)).json.staff, false);
  assert.strictEqual((await call('GET', '/api/me')).status, 401);
  assert.strictEqual((await call('POST', '/api/admin/login', { password: 'mal' })).status, 401);
  assert.strictEqual((await call('POST', '/api/admin/login', { password: 'clave-admin-larga' })).status, 200);
});

test('el alumnado no puede crear ni ver pacientes', async () => {
  assert.strictEqual((await call('POST', '/api/patients', ficha, ana)).status, 403);
  assert.strictEqual((await call('GET', '/api/patients', null, ana)).status, 403);
});

test('alta de paciente y validación', async () => {
  assert.strictEqual((await call('POST', '/api/patients', { nombre: 'Sin apellidos' }, admin)).status, 400);
  const r = await call('POST', '/api/patients', ficha, admin);
  assert.strictEqual(r.status, 200); pid = r.json.id;
  assert.strictEqual((await call('POST', '/api/patients', Object.assign({}, ficha, { fecha_nacimiento: '31-02-2000' }), admin)).status, 400);
});

test('asignación individual: una historia por alumno, sin duplicar', async () => {
  const users = (await call('GET', '/api/users', null, admin)).json.users;
  const ids = ['ana@x.com', 'luis@x.com'].map((e) => users.find((u) => u.email === e).id);
  const r = await call('POST', '/api/patients/' + pid + '/assign', { mode: 'individual', user_ids: ids }, admin);
  assert.deepStrictEqual(r.json, { created: 2, skipped: 0 });
  assert.deepStrictEqual((await call('POST', '/api/patients/' + pid + '/assign', { mode: 'individual', user_ids: ids }, admin)).json, { created: 0, skipped: 2 });
  chartAna = (await call('GET', '/api/my/charts', null, ana)).json.charts[0].id;
  chartLuis = (await call('GET', '/api/my/charts', null, luis)).json.charts[0].id;
  assert.notStrictEqual(chartAna, chartLuis);
});

test('el alumno ve la ficha sin notas del docente y solo su historia', async () => {
  const r = await call('GET', '/api/charts/' + chartAna, null, ana);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.patient.data.nombre, 'Carmen');
  assert.strictEqual(r.json.patient.data.notas_docente, undefined);
  assert.strictEqual((await call('GET', '/api/charts/' + chartLuis, null, ana)).status, 404, 'no ve la historia de otro');
  assert.strictEqual((await call('GET', '/api/charts/' + chartAna, null, admin)).json.patient.data.notas_docente, 'SOLO PROFESORADO');
});

test('registros: validación, perfil TCAE y aislamiento', async () => {
  const ok = await call('POST', '/api/charts/' + chartAna + '/records', { type: 'constantes', data: { ta_sis: 130, ta_dia: 80, fc: 88, temp: '37,2', spo2: 94 } }, ana);
  assert.strictEqual(ok.status, 200);
  assert.strictEqual((await call('POST', '/api/charts/' + chartAna + '/records', { type: 'constantes', data: { ta_sis: 80, ta_dia: 120 } }, ana)).status, 400);
  assert.strictEqual((await call('POST', '/api/charts/' + chartAna + '/records', { type: 'constantes', data: {} }, ana)).status, 400);
  assert.strictEqual((await call('POST', '/api/charts/' + chartAna + '/records', { type: 'nota', data: { texto: 'Paciente estable, refiere menos disnea.' } }, ana)).status, 200);
  assert.strictEqual((await call('POST', '/api/charts/' + chartLuis + '/records', { type: 'nota', data: { texto: 'intento en otra historia' } }, ana)).status, 404);
  assert.strictEqual((await call('POST', '/api/charts/' + chartAna + '/records', { type: 'nota', data: { texto: 'x'.repeat(10) }, occurred: '2999-01-01T10:00' }, ana)).status, 400, 'futuro');
  assert.strictEqual((await call('POST', '/api/charts/' + chartAna + '/records', { type: 'nota', data: { texto: 'staff' } }, admin)).status, 403, 'el profesorado no escribe como alumno');
  const luisRecs = (await call('GET', '/api/charts/' + chartLuis, null, luis)).json.records;
  assert.strictEqual(luisRecs.length, 0, 'Luis no ve nada de Ana');
  const all = (await call('GET', '/api/patients/' + pid + '/activity', null, admin)).json.records;
  assert.strictEqual(all.length, 2);
});

test('perfil TCAE: no puede registrar procedimientos de enfermería', async () => {
  const cat = (await call('GET', '/api/catalog', null, admin)).json.items;
  const enf = cat.find((c) => c.roles === 'enfermeria'), aux = cat.find((c) => c.roles === 'enfermeria,tcae');
  const users = (await call('GET', '/api/users', null, admin)).json.users;
  const luisU = users.find((u) => u.email === 'luis@x.com');
  await call('PUT', '/api/users/' + luisU.id, { profile: 'tcae' }, admin);
  const t = await call('POST', '/api/patients/' + pid + '/assign', { mode: 'team', team_name: 'Equipo A', user_ids: [luisU.id] }, admin);
  assert.strictEqual(t.json.created, 1);
  const lt = (await call('GET', '/api/my/charts', null, luis)).json.charts.find((c) => c.kind === 'team');
  assert.strictEqual((await call('POST', '/api/charts/' + lt.id + '/records', { type: 'cuidado', data: { catalog_id: enf.id } }, luis)).status, 400);
  assert.strictEqual((await call('POST', '/api/charts/' + lt.id + '/records', { type: 'cuidado', data: { catalog_id: aux.id, resultado: 'realizado' } }, luis)).status, 200);
  assert.ok(!(await call('GET', '/api/catalog', null, luis)).json.items.some((c) => c.id === enf.id), 'el catálogo del TCAE no incluye lo de enfermería');
});

test('los registros no se editan ni se borran: se anulan con motivo', async () => {
  const recs = (await call('GET', '/api/charts/' + chartAna, null, ana)).json.records;
  const rid = recs[0].id;
  assert.strictEqual((await call('PUT', '/api/records/' + rid, { data: {} }, ana)).status, 404, 'no hay edición');
  assert.strictEqual((await call('DELETE', '/api/records/' + rid, null, ana)).status, 404, 'no hay borrado');
  assert.strictEqual((await call('POST', '/api/records/' + rid + '/void', { reason: 'no' }, luis)).status, 404, 'otro alumno no puede');
  assert.strictEqual((await call('POST', '/api/records/' + rid + '/void', { reason: 'ok' }, ana)).status, 400, 'motivo corto');
  assert.strictEqual((await call('POST', '/api/records/' + rid + '/void', { reason: 'Error al anotar la tensión' }, ana)).status, 200);
  const after = (await call('GET', '/api/charts/' + chartAna, null, ana)).json.records.find((r) => r.id === rid);
  assert.ok(after.void_at && after.void_reason && after.data, 'sigue visible y marcado');
  assert.strictEqual((await call('POST', '/api/records/' + rid + '/void', { reason: 'Otra vez anulado' }, ana)).status, 409);
});

test('comentarios del profesorado visibles para el alumno; el alumno no comenta', async () => {
  const recs = (await call('GET', '/api/charts/' + chartAna, null, admin)).json.records;
  assert.strictEqual((await call('POST', '/api/charts/' + chartAna + '/comments', { text: 'Revisa las unidades', record_id: recs[0].id }, admin)).status, 200);
  assert.strictEqual((await call('POST', '/api/charts/' + chartAna + '/comments', { text: 'yo comento' }, ana)).status, 403);
  const seen = (await call('GET', '/api/charts/' + chartAna, null, ana)).json.records.find((r) => r.id === recs[0].id);
  assert.strictEqual(seen.comments.length, 1);
});

test('historia cerrada: no admite registros; la ficha editada guarda revisión', async () => {
  await call('PUT', '/api/charts/' + chartAna, { status: 'closed' }, admin);
  assert.strictEqual((await call('POST', '/api/charts/' + chartAna + '/records', { type: 'nota', data: { texto: 'tras cierre' } }, ana)).status, 409);
  assert.strictEqual((await call('PUT', '/api/patients/' + pid, Object.assign({}, ficha, { diagnostico_medico: 'EPOC + neumonía' }), admin)).status, 200);
  assert.strictEqual((await call('GET', '/api/patients/' + pid, null, admin)).json.revisions, 1);
  assert.strictEqual((await call('PUT', '/api/patients/' + pid, ficha, ana)).status, 403);
});

test('CSRF: una escritura sin cabecera se rechaza', async () => {
  const r = await fetch(base + '/api/me', { method: 'PUT', headers: { Cookie: ana, 'Content-Type': 'application/json' }, body: '{}' });
  assert.strictEqual(r.status, 403);
});
