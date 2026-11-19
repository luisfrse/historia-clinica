'use strict';
/* Acceso unico desde Control: enlace firmado de un solo uso que entra como el primer administrador. La contrasena de administracion sigue funcionando. */
const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hc-control-'));
process.env.DATA_DIR = dir; process.env.SSO_SECRET = 'secreto-de-prueba'; process.env.ADMIN_PASSWORD = 'clave-admin-larga'; process.env.CONTROL_SSO_SECRET = 'secreto-de-control-0123456789-abc';
const SSO = require('../lib/sso');
const { sign } = require('../lib/control-sso');
const { server } = require('../server');

let base;
test.before(async () => { await new Promise((r) => server.listen(0, r)); base = 'http://127.0.0.1:' + server.address().port; });
test.after(() => { server.close(); });

const entrar = (t) => fetch(base + '/api/control/sso?t=' + encodeURIComponent(t), { redirect: 'manual' });
const campusSso = (o) => fetch(base + '/sso?t=' + encodeURIComponent(SSO.sign(Object.assign({ iss: 'campus', jti: crypto.randomUUID(), iat: Date.now(), exp: Date.now() + 60e3, lang: 'es', subjects: [] }, o), 'secreto-de-prueba')), { redirect: 'manual' });
const hid = (r) => (r.headers.getSetCookie() || []).map((c) => c.split(';')[0]).find((c) => c.startsWith('hid='));

test('sin ningun administrador el enlace de Control no entra; con uno, abre su sesion', async () => {
  const sinAdmin = await entrar(sign('secreto-de-control-0123456789-abc'));
  assert.strictEqual(sinAdmin.status, 403, 'sin usuario administrador no hay a quien dar la sesion');
  assert.ok(await campusSso({ email: 'admin@campus.local', name: 'Admin', admin: true }));
  const r = await entrar(sign('secreto-de-control-0123456789-abc'));
  assert.strictEqual(r.status, 302); assert.strictEqual(r.headers.get('location'), '/');
  const cookie = hid(r); assert.ok(cookie, 'sesion por cookie');
  const u = await fetch(base + '/api/users', { headers: { Cookie: cookie, 'X-Requested-With': 'historia' } });
  assert.strictEqual(u.status, 200, 'la sesion es de administracion (el personal puede listar usuarios)');
});

test('el enlace vale una vez; firma de otra app, caducado y basura se rechazan', async () => {
  const tk = sign('secreto-de-control-0123456789-abc');
  assert.strictEqual((await entrar(tk)).status, 302);
  assert.strictEqual((await entrar(tk)).status, 403, 'no se repite');
  for (const mal of [sign('otro-secreto-distinto-0123456789'), sign('secreto-de-control-0123456789-abc', { now: Date.now() - 5 * 60e3 }), 'basura', '']) assert.strictEqual((await entrar(mal)).status, 403);
});
