'use strict';
/* Integración con el Campus: acceso directo por NHC y listado firmado de las historias de un alumno/a. */
const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hc-campus-'));
process.env.DATA_DIR = dir; process.env.SSO_SECRET = 'secreto-de-prueba'; process.env.ADMIN_PASSWORD = 'clave-admin-larga';
const SSO = require('../lib/sso');
const { server } = require('../server');

let base;
test.before(async () => { await new Promise((r) => server.listen(0, r)); base = 'http://127.0.0.1:' + server.address().port; });
test.after(() => { server.close(); });

async function call(method, url, body, cookie) {
  const r = await fetch(base + url, { method, redirect: 'manual', headers: Object.assign({ 'X-Requested-With': 'historia', 'Content-Type': 'application/json' }, cookie ? { Cookie: cookie } : {}), body: body === undefined || body === null ? undefined : JSON.stringify(body) });
  let j = null; try { j = await r.json(); } catch (_) { /* sin cuerpo */ }
  return { status: r.status, json: j, headers: r.headers };
}
const sign = (o) => SSO.sign(Object.assign({ iss: 'campus', jti: crypto.randomUUID(), iat: Date.now(), exp: Date.now() + 60e3 }, o), 'secreto-de-prueba');
async function sso(o) { const r = await fetch(base + '/sso?t=' + encodeURIComponent(sign(Object.assign({ lang: 'es', subjects: [] }, o))), { redirect: 'manual' }); return { cookie: (r.headers.get('set-cookie') || '').split(';')[0], loc: r.headers.get('location') }; }

test('NHC en el acceso directo, fechas de cada historia y listado firmado para el Campus', async () => {
  const admin = (await sso({ email: 'admin@campus.local', name: 'Admin', admin: true })).cookie;
  const alu = await sso({ email: 'al@x.com', name: 'Alumna Prueba', subjects: [{ slug: 'proyecto', title: 'Proyecto' }], to: 'nhc/20260431' });
  assert.ok(/#\/go\/nhc\/20260431$/.test(alu.loc), 'el acceso directo por NHC se conserva: ' + alu.loc);
  assert.ok(!/go\/nhc/.test((await sso({ email: 'al@x.com', name: 'Alumna Prueba', to: 'nhc/no valido!' })).loc), 'un NHC con caracteres raros se descarta');
  const users = (await call('GET', '/api/users', null, admin)).json.users; const uid = users.find((u) => u.email === 'al@x.com').id;
  const pid = (await call('POST', '/api/patients', { nombre: 'Àlex', apellidos: 'Domènech Vila', sexo: 'M', fecha_nacimiento: '2000-05-09', nhc: '20260431', motivo_ingreso: 'Neumonía', diagnostico_medico: 'Neumonía atípica' }, admin)).json.id;
  await call('PUT', '/api/patients/' + pid + '/classify', { subjects: ['Proyecto intermodular (APSD)'], topics: ['Cas 3'] }, admin);
  assert.strictEqual((await call('POST', '/api/patients/' + pid + '/assign', { mode: 'individual', user_ids: [uid] }, admin)).json.created, 1);
  const chart = (await call('GET', '/api/patients/' + pid, null, admin)).json.charts[0];
  const today = new Date().toLocaleDateString('sv-SE'), past = '2020-01-01', future = '2999-01-01';
  assert.strictEqual((await call('PUT', '/api/charts/' + chart.id, { opens: past, closes: future }, admin)).status, 200);
  assert.strictEqual((await call('PUT', '/api/charts/' + chart.id, { opens: future, closes: past }, admin)).status, 400, 'fechas incoherentes');
  /* el alumnado ve su NHC en su lista (para entrar por él) */
  const mine = (await call('GET', '/api/my/charts', null, alu.cookie)).json.charts; assert.strictEqual(mine[0].nhc, '20260431');
  /* listado firmado para el Campus */
  const list = (o) => call('GET', '/api/campus/charts?t=' + encodeURIComponent(sign(Object.assign({ email: 'al@x.com', purpose: 'charts' }, o))));
  const r = await list({}); assert.strictEqual(r.status, 200); const c = r.json.charts[0];
  assert.strictEqual(c.nhc, '20260431'); assert.strictEqual(c.status, 'open'); assert.strictEqual(c.opens, past); assert.strictEqual(c.closes, future); assert.deepStrictEqual(c.topics, ['Cas 3']); assert.deepStrictEqual(c.subjects, ['Proyecto intermodular (APSD)']);
  assert.strictEqual((await call('GET', '/api/campus/charts')).status, 401, 'sin firma no hay listado');
  assert.strictEqual((await list({ purpose: 'otro' })).status, 401);
  const t1 = sign({ email: 'al@x.com', purpose: 'charts' }); assert.strictEqual((await call('GET', '/api/campus/charts?t=' + encodeURIComponent(t1))).status, 200); assert.strictEqual((await call('GET', '/api/campus/charts?t=' + encodeURIComponent(t1))).status, 401, 'un solo uso');
  assert.deepStrictEqual((await list({ email: 'nadie@x.com' })).json.charts, []);
  /* cerrada por fecha: el alumnado ya no puede escribir y el listado lo dice */
  await call('PUT', '/api/charts/' + chart.id, { opens: past, closes: '2020-02-01' }, admin);
  assert.strictEqual((await list({})).json.charts[0].status, 'closed'); assert.strictEqual((await list({})).json.charts[0].window, 'ended');
  assert.strictEqual((await call('POST', '/api/charts/' + chart.id + '/records', { type: 'nota', data: { texto: 'hola' } }, alu.cookie)).status, 409, 'historia cerrada: no admite registros');
  void today;
});
