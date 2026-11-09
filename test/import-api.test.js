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
