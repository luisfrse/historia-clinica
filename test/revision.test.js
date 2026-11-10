'use strict';
/* Revisión previa a publicar: corregir un registro, historias programadas, rúbrica y cuentas de profesorado. */
const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hc-rev-'));
process.env.DATA_DIR = dir; process.env.SSO_SECRET = 'secreto-de-prueba'; process.env.ADMIN_PASSWORD = 'clave-admin-larga';
const SSO = require('../lib/sso');
const { server } = require('../server');

let base;
test.before(async () => { await new Promise((r) => server.listen(0, r)); base = 'http://127.0.0.1:' + server.address().port; });
test.after(() => { server.close(); });

async function call(method, url, body, cookie) {
  const r = await fetch(base + url, { method, redirect: 'manual', headers: Object.assign({ 'X-Requested-With': 'historia', 'Content-Type': 'application/json' }, cookie ? { Cookie: cookie } : {}), body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (_) { /* sin cuerpo */ }
  return { status: r.status, json: j };
}
const token = (o) => SSO.sign(Object.assign({ iss: 'campus', jti: crypto.randomUUID(), iat: Date.now(), exp: Date.now() + 60e3, lang: 'es', subjects: [] }, o), 'secreto-de-prueba');
async function sso(o) { const r = await fetch(base + '/sso?t=' + encodeURIComponent(token(o)), { redirect: 'manual' }); return (r.headers.get('set-cookie') || '').split(';')[0]; }
const ficha = { nombre: 'Carmen', apellidos: 'Ruiz Soto', sexo: 'F', fecha_nacimiento: '1948-03-02', motivo_ingreso: 'Disnea', diagnostico_medico: 'EPOC', alergias: [{ agente: 'Penicilina', reaccion: 'urticaria', gravedad: 'grave' }] };

test('corregir un registro anula el original y no se duplica', async () => {
  const admin = await sso({ email: 'admin@campus.local', name: 'Admin', admin: true });
  const ana = await sso({ email: 'ana@x.com', name: 'Ana Uno' });
  const pid = (await call('POST', '/api/patients', ficha, admin)).json.id;
  const uid = (await call('GET', '/api/users', null, admin)).json.users.find((u) => u.email === 'ana@x.com').id;
  await call('POST', '/api/patients/' + pid + '/assign', { mode: 'individual', user_ids: [uid] }, admin);
  const cid = (await call('GET', '/api/my/charts', null, ana)).json.charts[0].id;
  const r1 = await call('POST', '/api/charts/' + cid + '/records', { type: 'nota', data: { texto: 'Primera versión de la nota.' } }, ana);
  assert.strictEqual(r1.status, 200);
  const r2 = await call('POST', '/api/charts/' + cid + '/records', { type: 'nota', data: { texto: 'Versión corregida de la nota.' }, replaces_id: r1.json.id }, ana);
  assert.strictEqual(r2.status, 200);
  const recs = (await call('GET', '/api/charts/' + cid, null, ana)).json.records;
  assert.ok(recs.find((r) => r.id === r1.json.id).void_at, 'el original queda anulado');
  assert.ok(!recs.find((r) => r.id === r2.json.id).void_at, 'la corrección sigue vigente');
  assert.strictEqual(recs.filter((r) => !r.void_at && r.type === 'nota').length, 1, 'solo una nota vigente');
  assert.strictEqual((await call('POST', '/api/charts/' + cid + '/records', { type: 'nota', data: { texto: 'Otra versión.' }, replaces_id: r1.json.id }, ana)).status, 409, 'no se corrige dos veces lo ya anulado');
  assert.strictEqual((await call('POST', '/api/charts/' + cid + '/records', { type: 'balance', data: { entradas: 100, salidas: 50 }, replaces_id: r2.json.id }, ana)).status, 400, 'ha de ser del mismo tipo');
});

test('una historia programada no enseña datos del paciente hasta que se abre', async () => {
  const admin = await sso({ email: 'admin@campus.local', name: 'Admin', admin: true });
  const luis = await sso({ email: 'luis@x.com', name: 'Luis Dos' });
  const pid = (await call('POST', '/api/patients', ficha, admin)).json.id;
  const uid = (await call('GET', '/api/users', null, admin)).json.users.find((u) => u.email === 'luis@x.com').id;
  await call('POST', '/api/patients/' + pid + '/assign', { mode: 'individual', opens: '2999-01-01', user_ids: [uid] }, admin);
  const c = (await call('GET', '/api/my/charts', null, luis)).json.charts[0];
  assert.strictEqual(c.window, 'scheduled');
  assert.strictEqual(c.patient.trim(), '', 'sin nombre');
  assert.deepStrictEqual(c.alergias, [], 'sin alergias');
  assert.strictEqual(c.diagnostico, '', 'sin diagnóstico');
});

test('la rúbrica conserva los id de los criterios y no reutiliza los antiguos', async () => {
  const admin = await sso({ email: 'admin@campus.local', name: 'Admin', admin: true });
  const before = (await call('GET', '/api/rubric', null, admin)).json.rubric;
  const edited = before.slice().reverse().map((c) => ({ id: c.id, es: c.es, ca: c.ca, w: c.w })); /* se reordena */
  edited.push({ es: 'Criterio nuevo', ca: 'Criteri nou', w: 1 });
  assert.strictEqual((await call('PUT', '/api/rubric', { rubric: edited }, admin)).status, 200);
  const after = (await call('GET', '/api/rubric', null, admin)).json.rubric;
  assert.deepStrictEqual(after.slice(0, before.length).map((c) => c.id), edited.slice(0, before.length).map((c) => c.id), 'los id siguen a su criterio');
  assert.ok(!before.some((c) => c.id === after[after.length - 1].id), 'el criterio nuevo tiene un id nuevo');
});

test('las cuentas de profesorado solo las gestiona la administración', async () => {
  const admin = await sso({ email: 'admin@campus.local', name: 'Admin', admin: true });
  assert.strictEqual((await call('POST', '/api/teachers', { email: 'prof1@x.com', name: 'Prof Uno', password: 'una-clave-larga-1' }, admin)).status, 200);
  assert.strictEqual((await call('POST', '/api/teachers', { email: 'prof2@x.com', name: 'Prof Dos', password: 'una-clave-larga-2' }, admin)).status, 200);
  const t1 = await call('POST', '/api/teacher/login', { email: 'prof1@x.com', password: 'una-clave-larga-1' });
  assert.strictEqual(t1.status, 200);
  const uid2 = (await call('GET', '/api/users', null, admin)).json.users.find((u) => u.email === 'prof2@x.com');
  if (uid2) {
    const r = await fetch(base + '/api/teacher/login', { method: 'POST', headers: { 'X-Requested-With': 'historia', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'prof1@x.com', password: 'una-clave-larga-1' }) });
    const ck = (r.headers.get('set-cookie') || '').split(';')[0];
    assert.strictEqual((await call('PUT', '/api/users/' + uid2.id, { active: false }, ck)).status, 403, 'un profesor no desactiva a otro');
  }
});
