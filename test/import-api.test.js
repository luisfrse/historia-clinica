'use strict';
const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'hc3-')); process.env.SSO_SECRET = 'secreto-de-prueba'; process.env.ADMIN_PASSWORD = 'clave-admin-larga';
const SSO = require('../lib/sso');
const { server } = require('../server');

let base;
test.before(async () => { await new Promise((r) => server.listen(0, r)); base = 'http://127.0.0.1:' + server.address().port; });
test.after(() => { server.close(); });
async function call(method, url, body, cookie) {
  const r = await fetch(base + url, { method, redirect: 'manual', headers: Object.assign({ 'X-Requested-With': 'historia', 'Content-Type': 'application/json' }, cookie ? { Cookie: cookie } : {}), body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (_) {}
  return { status: r.status, json: j };
}
const token = (o) => SSO.sign(Object.assign({ iss: 'campus', jti: crypto.randomUUID(), iat: Date.now(), exp: Date.now() + 60e3, lang: 'es', subjects: [] }, o), 'secreto-de-prueba');
async function sso(o) { const r = await fetch(base + '/sso?t=' + encodeURIComponent(token(o)), { redirect: 'manual' }); return (r.headers.get('set-cookie') || '').split(';')[0]; }

const TEXT = `[FICHA]
Nombre: Pedro
Apellidos: Gil Mora
Sexo: M
Edad: 70
Diagnóstico médico: Neumonía
Notas del docente: Solo para el profesorado.

[ALERGIAS]
Ninguna

[PRESCRIPCIONES]
- Paracetamol | 1 g | oral | cada 8 h | 08:00, 16:00 | 1-3 |
- Ceftriaxona | 1 g | iv | cada 24 h | 10:00 | 1-5 |
- Fallo | 1 g | inventada | cada 8 h | 08:00 | 1-3 |

[PRUEBAS Y EVENTOS]
- 1 | prueba | Radiografía | Infiltrado.
- 2 | evento | Fiebre | 38,5 °C.
`;

test('importar caso: vista previa, creación y permisos', async () => {
  const admin = await sso({ email: 'admin@campus.local', name: 'Admin', admin: true });
  const alum = await sso({ email: 'a@x.com', name: 'Alumna' });
  assert.strictEqual((await call('POST', '/api/import', { text: TEXT }, alum)).status, 403);
  assert.strictEqual((await call('GET', '/api/import/template', null, alum)).status, 403);
  const tpl = await call('GET', '/api/import/template', null, admin); assert.strictEqual(tpl.status, 200); assert.match(tpl.json.template, /\[PRESCRIPCIONS\]/, 'por defecto en catalán'); assert.match(tpl.json.templates.es, /\[PRESCRIPCIONES\]/);

  const pre = await call('POST', '/api/import', { text: TEXT }, admin);
  assert.strictEqual(pre.status, 200); assert.strictEqual(pre.json.can_commit, true);
  assert.strictEqual(pre.json.orders.length, 2); assert.strictEqual(pre.json.events.length, 2);
  assert.ok(pre.json.errors.some((e) => /inventada/.test(e.msg)), 'la prescripción con vía desconocida se informa');
  assert.strictEqual((await call('GET', '/api/patients', null, admin)).json.patients.length, 0, 'la vista previa no crea nada');

  const bad = await call('POST', '/api/import', { text: '[FICHA]\nNombre: Solo\nMotivo de ingreso: algo largo para pasar el mínimo' }, admin);
  assert.strictEqual(bad.json.can_commit, false);
  assert.strictEqual((await call('POST', '/api/import', { text: '[FICHA]\nNombre: Solo\nMotivo de ingreso: algo largo para pasar el mínimo', commit: true }, admin)).status, 400);

  const ok = await call('POST', '/api/import', { text: TEXT, commit: true }, admin);
  assert.strictEqual(ok.status, 200); assert.ok(ok.json.id);
  const plan = (await call('GET', '/api/patients/' + ok.json.id + '/plan', null, admin)).json;
  assert.deepStrictEqual(plan.orders.map((o) => o.drug), ['Paracetamol', 'Ceftriaxona']);
  assert.deepStrictEqual(plan.events.map((e) => e.title), ['Radiografía', 'Fiebre']);
  const pat = (await call('GET', '/api/patients/' + ok.json.id, null, admin)).json.patient;
  assert.strictEqual(pat.data.diagnostico_medico, 'Neumonía'); assert.strictEqual(pat.data.sin_alergias, true);
  assert.match(pat.data.notas_docente, /profesorado/);
});

test('consignas: varias por paciente, asignación, progreso para el alumno y permisos', async () => {
  const admin = await sso({ email: 'admin@campus.local', name: 'Admin', admin: true });
  const alum = await sso({ email: 'b@x.com', name: 'Beatriz' });
  const ex = await call('POST', '/api/import/example', { lang: 'ca' }, admin); assert.strictEqual(ex.status, 200);
  const pid = ex.json.id, chart = ex.json.chart_id;
  const list = (await call('GET', '/api/patients/' + pid + '/consignas', null, admin)).json.consignas;
  assert.strictEqual(list.length, 2, 'el ejemplo trae dos consignas importadas');
  assert.strictEqual((await call('GET', '/api/patients/' + pid + '/consignas', null, alum)).status, 403);
  /* la historia de ejemplo usa la primera: las tareas se marcan solas con los registros */
  const v = (await call('GET', '/api/charts/' + chart, null, admin)).json;
  assert.strictEqual(v.consigna.id, list[0].id);
  const by = Object.fromEntries(v.consigna.tasks.map((x) => [x.kind, x]));
  assert.strictEqual(by.constantes.done, true); assert.strictEqual(by.medicacion.done, true); assert.strictEqual(by.nota.done, true); assert.strictEqual(by.valoracion.done, false);
  /* crear, editar, asignar otra consigna y borrar */
  const nueva = await call('POST', '/api/patients/' + pid + '/consignas', { title: 'Solo balance', body: 'Registra el balance.', due: '2030-01-31', tasks: [{ kind: 'balance', min: 2, text: 'Dos registros' }, { kind: 'raro', text: 'x' }, { kind: 'libre', text: 'Comenta' }] }, admin);
  assert.strictEqual(nueva.status, 200);
  assert.strictEqual((await call('POST', '/api/patients/' + pid + '/consignas', { title: '' }, admin)).status, 400);
  assert.strictEqual((await call('POST', '/api/patients/' + pid + '/consignas', { title: 'x', due: 'mañana' }, admin)).status, 400);
  const k2 = (await call('GET', '/api/patients/' + pid + '/consignas', null, admin)).json.consignas.find((k) => k.id === nueva.json.id);
  assert.deepStrictEqual(k2.tasks.map((x) => x.kind), ['balance', 'libre'], 'los tipos desconocidos se descartan');
  assert.strictEqual((await call('PUT', '/api/charts/' + chart, { consigna_id: nueva.json.id }, admin)).status, 200);
  const v2 = (await call('GET', '/api/charts/' + chart, null, admin)).json;
  assert.strictEqual(v2.consigna.title, 'Solo balance'); assert.strictEqual(v2.consigna.tasks[0].done, true, 'hay 3 balances de muestra');
  assert.strictEqual((await call('PUT', '/api/charts/' + chart, { consigna_id: 99999 }, admin)).status, 400, 'una consigna de otro paciente o inexistente no vale');
  /* asignar con consigna a un alumno real */
  const users = (await call('GET', '/api/users', null, admin)).json.users; const ub = users.find((u) => u.email === 'b@x.com');
  assert.strictEqual((await call('POST', '/api/patients/' + pid + '/assign', { mode: 'individual', user_ids: [ub.id], consigna_id: list[1].id }, admin)).status, 200);
  const mine = (await call('GET', '/api/my/charts', null, alum)).json.charts;
  assert.strictEqual(mine.length, 1); assert.strictEqual(mine[0].consigna.title, list[1].title); assert.strictEqual(mine[0].consigna.done, 0);
  const mc = (await call('GET', '/api/charts/' + mine[0].id, null, alum)).json;
  assert.strictEqual(mc.consigna.title, list[1].title); assert.deepStrictEqual(mc.consignas, [], 'el alumno no recibe la lista de consignas');
  assert.strictEqual((await call('PUT', '/api/charts/' + mine[0].id, { consigna_id: null }, alum)).status, 403);
  assert.strictEqual((await call('DELETE', '/api/consignas/' + list[1].id, null, alum)).status, 403);
  assert.strictEqual((await call('DELETE', '/api/consignas/' + list[1].id, null, admin)).status, 200);
  assert.strictEqual((await call('GET', '/api/charts/' + mine[0].id, null, alum)).json.consigna, null, 'al borrar la consigna la historia se queda sin ella');
});
