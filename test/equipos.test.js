'use strict';
/* Asignación por equipos formados según el subgrupo del Campus (mismo caso, un equipo por subgrupo). */
const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hc-eq-'));
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

test('un mismo caso a varios equipos, uno por subgrupo del Campus', async () => {
  const admin = await sso({ email: 'admin@campus.local', name: 'Admin', admin: true });
  const mails = ['a1@x.com', 'a2@x.com', 'a3@x.com', 'b1@x.com', 'sin@x.com'];
  for (const e of mails) await sso({ email: e, name: e.split('@')[0], subjects: [{ slug: 'proyecto', title: 'Proyecto' }] });
  const db = new DatabaseSync(path.join(dir, 'historia.db'));
  const setEnr = (email, enr) => db.prepare('UPDATE users SET enr = ? WHERE email = ?').run(JSON.stringify(enr), email);
  setEnr('a1@x.com', [{ slug: 'proyecto', grp: 'A', sub: '1', half: '' }]); setEnr('a2@x.com', [{ slug: 'proyecto', grp: 'A', sub: '1', half: '' }]);
  setEnr('a3@x.com', [{ slug: 'proyecto', grp: 'A', sub: '2', half: '' }]); setEnr('b1@x.com', [{ slug: 'proyecto', grp: 'B', sub: '5', half: '' }]);
  setEnr('sin@x.com', [{ slug: 'proyecto', grp: 'A', sub: '', half: '' }]); db.close();

  const users = (await call('GET', '/api/users', null, admin)).json.users;
  assert.deepStrictEqual(users.find((u) => u.email === 'a3@x.com').enr, [{ slug: 'proyecto', grp: 'A', sub: '2', half: '' }], '/api/users devuelve los grupos');
  const ids = mails.map((e) => users.find((u) => u.email === e).id);
  const pid = (await call('POST', '/api/patients', { nombre: 'Carmen', apellidos: 'Ruiz Soto', sexo: 'F', fecha_nacimiento: '1948-03-02', motivo_ingreso: 'Disnea', diagnostico_medico: 'EPOC' }, admin)).json.id;

  assert.strictEqual((await call('POST', '/api/patients/' + pid + '/assign', { mode: 'team', team_by: 'sub', subject: 'proyecto', team_name: 'Equipo', user_ids: ids.slice(0, 3) }, admin)).json.created, 2);
  const r = await call('POST', '/api/patients/' + pid + '/assign', { mode: 'team', team_by: 'sub', subject: 'proyecto', team_name: 'Grupo', user_ids: ids }, admin);
  assert.deepStrictEqual(r.json, { created: 3, skipped: 0, no_sub: 1 }, 'A1, A2 y B5 (nombre distinto) y uno sin subgrupo que se omite');
  const rep = await call('POST', '/api/patients/' + pid + '/assign', { mode: 'team', team_by: 'sub', subject: 'proyecto', team_name: 'Grupo', user_ids: ids }, admin);
  assert.deepStrictEqual(rep.json, { created: 0, skipped: 3, no_sub: 1 }, 'repetir la asignación no duplica los equipos');
  const names = (await call('GET', '/api/patients/' + pid, null, admin)).json.charts.map((c) => c.name).sort();
  assert.ok(names.includes('Grupo A1') && names.includes('Grupo A2') && names.includes('Grupo B5') && names.includes('Equipo A1'), names.join(','));
  const g1 = (await call('GET', '/api/patients/' + pid, null, admin)).json.charts.find((c) => c.name === 'Grupo A1');
  assert.strictEqual(g1.members.length, 2);
  assert.strictEqual((await call('POST', '/api/patients/' + pid + '/assign', { mode: 'team', team_name: 'Todos', user_ids: ids }, admin)).json.created, 1, 'sin team_by: un solo equipo');
});
