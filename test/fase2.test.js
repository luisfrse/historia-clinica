'use strict';
const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'hc2-')); process.env.SSO_SECRET = 'secreto-de-prueba'; process.env.ADMIN_PASSWORD = 'clave-admin-larga'; process.env.CAMPUS_URL = 'http://127.0.0.1:47123'; process.env.CAMPUS_TOKEN = 'tok-campus';
const SSO = require('../lib/sso');
const SC = require('../public/scales');
const { server } = require('../server');
const http = require('http');
let campusGot = null;
const fakeCampus = http.createServer((req, res) => { let b = ''; req.on('data', (d) => { b += d; }); req.on('end', () => { campusGot = { url: req.url, auth: req.headers.authorization, body: b ? JSON.parse(b) : null }; res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, created: true, saved: campusGot.body ? campusGot.body.grades.length : 0, kept: 0, missing: [] })); }); });

let base;
test.before(async () => { await new Promise((r) => fakeCampus.listen(47123, '127.0.0.1', r)); await new Promise((r) => server.listen(0, r)); base = 'http://127.0.0.1:' + server.address().port; });
test.after(() => { server.close(); fakeCampus.close(); });
async function call(method, url, body, cookie) {
  const r = await fetch(base + url, { method, redirect: 'manual', headers: Object.assign({ 'X-Requested-With': 'historia', 'Content-Type': 'application/json' }, cookie ? { Cookie: cookie } : {}), body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (_) {}
  return { status: r.status, json: j };
}
const token = (o) => SSO.sign(Object.assign({ iss: 'campus', jti: crypto.randomUUID(), iat: Date.now(), exp: Date.now() + 60e3, lang: 'es', subjects: [] }, o), 'secreto-de-prueba');
async function sso(o) { const r = await fetch(base + '/sso?t=' + encodeURIComponent(token(o)), { redirect: 'manual' }); return (r.headers.get('set-cookie') || '').split(';')[0]; }

let admin, enf, aux, pid, cEnf, cAux, ordOral, ordIv, ordLater;

test('escalas: cálculo y niveles', () => {
  const b = SC.compute('barthel', { comer: 10, lavarse: 5, vestirse: 10, arreglarse: 5, deposicion: 10, miccion: 10, retrete: 10, traslado: 15, deambulacion: 15, escaleras: 10 });
  assert.strictEqual(b.total, 100); assert.strictEqual(b.nivel, 'independiente');
  const g = SC.compute('glasgow', { ocular: 1, verbal: 1, motora: 1 }); assert.strictEqual(g.total, 3); assert.strictEqual(g.nivel, 'grave'); assert.ok(g.alerta);
  const br = SC.compute('braden', { percepcion: 2, humedad: 2, actividad: 1, movilidad: 2, nutricion: 2, friccion: 1 }); assert.strictEqual(br.total, 10); assert.strictEqual(br.nivel, 'alto');
  assert.throws(() => SC.compute('barthel', { comer: 7 }));
  assert.throws(() => SC.compute('braden', { percepcion: 9, humedad: 1, actividad: 1, movilidad: 1, nutricion: 1, friccion: 1 }));
});

test('preparación: paciente, alumnado y prescripciones', async () => {
  admin = await sso({ email: 'admin@campus.local', name: 'Admin', admin: true });
  enf = await sso({ email: 'enf@x.com', name: 'Eva Enfermera' }); aux = await sso({ email: 'aux@x.com', name: 'Aitana Auxiliar' });
  const users = (await call('GET', '/api/users', null, admin)).json.users;
  const ue = users.find((u) => u.email === 'enf@x.com'), ua = users.find((u) => u.email === 'aux@x.com');
  await call('PUT', '/api/users/' + ua.id, { profile: 'tcae' }, admin);
  pid = (await call('POST', '/api/patients', { nombre: 'Pedro', apellidos: 'Gil Mora', sexo: 'M', fecha_nacimiento: '1950-01-01', sin_alergias: true }, admin)).json.id;
  await call('POST', '/api/patients/' + pid + '/assign', { mode: 'individual', user_ids: [ue.id, ua.id] }, admin);
  cEnf = (await call('GET', '/api/my/charts', null, enf)).json.charts[0].id; cAux = (await call('GET', '/api/my/charts', null, aux)).json.charts[0].id;
  assert.strictEqual((await call('POST', '/api/patients/' + pid + '/orders', { drug: 'X', times: '25:00' }, admin)).status, 400, 'hora inválida');
  assert.strictEqual((await call('POST', '/api/patients/' + pid + '/orders', { drug: 'Paracetamol', dose: '1 g', route: 'oral', times: '08:00,16:00,00:00' }, enf)).status, 403, 'el alumnado no prescribe');
  ordOral = (await call('POST', '/api/patients/' + pid + '/orders', { drug: 'Paracetamol', dose: '1 g', route: 'oral', freq: 'cada 8 h', times: '08:00,16:00,00:00' }, admin)).json.id;
  ordIv = (await call('POST', '/api/patients/' + pid + '/orders', { drug: 'Suero fisiológico', dose: '500 ml', route: 'iv', times: '10:00' }, admin)).json.id;
  ordLater = (await call('POST', '/api/patients/' + pid + '/orders', { drug: 'Antibiótico', dose: '1 g', route: 'oral', times: '09:00', start_day: 3 }, admin)).json.id;
});

test('el alumnado solo ve prescripciones y eventos que ya tocan por el día del caso', async () => {
  await call('POST', '/api/patients/' + pid + '/events', { kind: 'prueba', day: 2, title: 'Analítica', body: 'Leucocitos 14.000' }, admin);
  let c = (await call('GET', '/api/charts/' + cEnf, null, enf)).json;
  assert.strictEqual(c.orders.length, 2); assert.strictEqual(c.events.length, 0); assert.strictEqual(c.chart.day, 1);
  assert.strictEqual((await call('PUT', '/api/charts/' + cEnf, { day: 3 }, enf)).status, 403);
  await call('PUT', '/api/charts/' + cEnf, { day: 3 }, admin);
  c = (await call('GET', '/api/charts/' + cEnf, null, enf)).json;
  assert.strictEqual(c.orders.length, 3); assert.strictEqual(c.events.length, 1); assert.strictEqual(c.events[0].body, 'Leucocitos 14.000');
  assert.strictEqual((await call('GET', '/api/charts/' + cAux, null, aux)).json.events.length, 0, 'otro día, otra historia');
});

test('medicación: perfil TCAE solo oral/tópica, hora de la pauta y prescripción visible', async () => {
  const rec = (cid, ck, d) => call('POST', '/api/charts/' + cid + '/records', { type: 'medicacion', data: d }, ck);
  assert.strictEqual((await rec(cEnf, enf, { order_id: ordIv, slot: '10:00', estado: 'administrada' })).status, 200);
  assert.strictEqual((await rec(cAux, aux, { order_id: ordOral, slot: '08:00', estado: 'administrada' })).status, 200, 'oral sí');
  assert.strictEqual((await rec(cAux, aux, { order_id: ordIv, slot: '10:00' })).status, 400, 'IV no para auxiliar');
  assert.strictEqual((await rec(cAux, aux, { order_id: ordOral, slot: '09:30' })).status, 400, 'hora fuera de pauta');
  assert.strictEqual((await rec(cAux, aux, { order_id: ordLater, slot: '09:00' })).status, 400, 'aún no prescrita (día 1)');
  assert.strictEqual((await rec(cAux, aux, { order_id: 99999 })).status, 400);
  const mine = (await call('GET', '/api/charts/' + cAux, null, aux)).json.records.find((r) => r.type === 'medicacion');
  assert.strictEqual(mine.data.farmaco, 'Paracetamol');
  assert.strictEqual((await call('DELETE', '/api/orders/' + ordOral, null, admin)).status, 409, 'no se borra una prescripción con administraciones');
  assert.strictEqual((await call('PUT', '/api/orders/' + ordOral, { active: false }, admin)).status, 200);
});

test('escalas, valoración, plan de cuidados e informe: solo enfermería', async () => {
  const items = { comer: 10, lavarse: 5, vestirse: 5, arreglarse: 5, deposicion: 10, miccion: 10, retrete: 5, traslado: 10, deambulacion: 10, escaleras: 5 };
  const post = (cid, ck, type, data) => call('POST', '/api/charts/' + cid + '/records', { type, data }, ck);
  const e1 = await post(cEnf, enf, 'escala', { scale: 'barthel', items }); assert.strictEqual(e1.status, 200);
  const got = (await call('GET', '/api/charts/' + cEnf, null, enf)).json.records.find((r) => r.type === 'escala');
  assert.strictEqual(got.data.total, 75); assert.strictEqual(got.data.nivel, 'leve');
  assert.strictEqual((await post(cEnf, enf, 'escala', { scale: 'barthel', items: Object.assign({}, items, { comer: 3 }) })).status, 400);
  assert.strictEqual((await post(cAux, aux, 'escala', { scale: 'barthel', items })).status, 400, 'TCAE no puntúa escalas');
  assert.strictEqual((await post(cEnf, enf, 'valoracion', { patron: 'actividad', alterado: true, texto: 'Precisa ayuda para deambular' })).status, 200);
  assert.strictEqual((await post(cEnf, enf, 'valoracion', { patron: 'inventado', texto: 'xxx' })).status, 400);
  const plan = await post(cEnf, enf, 'plan', { problema: 'Riesgo de caídas', causa: 'Debilidad', objetivo: 'No sufrirá caídas durante el ingreso', intervenciones: 'Cama baja, timbre al alcance, acompañar al baño' });
  assert.strictEqual(plan.status, 200);
  assert.strictEqual((await post(cEnf, enf, 'plan_eval', { plan_id: plan.json.id, resultado: 'conseguido', texto: 'Sin caídas' })).status, 200);
  assert.strictEqual((await post(cEnf, enf, 'plan_eval', { plan_id: 99999, resultado: 'conseguido' })).status, 400);
  /* el plan de cuidados (PAI) también lo hace el auxiliar; valoración, escalas e informe siguen siendo de enfermería */
  const planAux = await post(cAux, aux, 'plan', { problema: 'Riesgo de caídas', causa: 'Debilidad', objetivo: 'No sufrirá caídas', intervenciones: 'Cama baja y timbre al alcance' }); assert.strictEqual(planAux.status, 200);
  assert.strictEqual((await post(cAux, aux, 'plan_eval', { plan_id: planAux.json.id, resultado: 'parcial' })).status, 200);
  assert.strictEqual((await post(cAux, aux, 'valoracion', { patron: 'actividad', texto: 'Una valoración' })).status, 400, 'el auxiliar no hace la valoración por patrones');
  assert.strictEqual((await post(cAux, aux, 'informe', { tipo: 'alta', resumen: 'Un resumen largo del alta' })).status, 400);
  assert.strictEqual((await post(cAux, aux, 'plan', { problema: 'ab', objetivo: 'ab', intervenciones: 'ab' })).status, 400, 'textos demasiado cortos');
  assert.strictEqual((await post(cEnf, enf, 'informe', { tipo: 'alta', resumen: 'Paciente estable, alta a domicilio con pautas.' })).status, 200);
});

test('notas con rúbrica: el alumno solo ve la suya y solo si está publicada', async () => {
  const ue = (await call('GET', '/api/users', null, admin)).json.users.find((u) => u.email === 'enf@x.com');
  const rub = (await call('GET', '/api/rubric', null, admin)).json.rubric; assert.ok(rub.length >= 3);
  const scores = {}; rub.forEach((c) => { scores[c.id] = 4; });
  const r = await call('PUT', '/api/charts/' + cEnf + '/grades/' + ue.id, { scores, comment: 'Excelente', published: false }, admin);
  assert.strictEqual(r.json.total, 10);
  assert.strictEqual((await call('GET', '/api/charts/' + cEnf, null, enf)).json.grades.list.length, 0, 'sin publicar');
  assert.strictEqual((await call('PUT', '/api/charts/' + cEnf + '/grades/' + ue.id, { scores, published: true }, enf)).status, 403);
  scores[rub[0].id] = 2; const r2 = await call('PUT', '/api/charts/' + cEnf + '/grades/' + ue.id, { scores, comment: 'Bien', published: true }, admin);
  assert.ok(r2.json.total < 10 && r2.json.total > 8);
  const mine = (await call('GET', '/api/charts/' + cEnf, null, enf)).json.grades;
  assert.strictEqual(mine.list.length, 1); assert.strictEqual(mine.list[0].comment, 'Bien');
  assert.strictEqual((await call('PUT', '/api/charts/' + cEnf + '/grades/' + ue.id, { scores: { [rub[0].id]: 9 } }, admin)).status, 400);
  const csv = await fetch(base + '/api/grades.csv', { headers: { Cookie: admin } }); assert.strictEqual(csv.status, 200);
  assert.match(await csv.text(), /Eva Enfermera/);
  assert.strictEqual((await fetch(base + '/api/grades.csv', { headers: { Cookie: enf } })).status, 403);
});

test('profesorado adicional: solo la administración lo da de alta, con contraseña propia; nunca desde el alumnado', async () => {
  const ue = (await call('GET', '/api/users', null, admin)).json.users.find((u) => u.email === 'enf@x.com');
  assert.strictEqual((await call('PUT', '/api/users/' + ue.id + '/role', { role: 'teacher' }, admin)).status, 404, 'ya no se puede ascender al alumnado');
  const body = { name: 'Rosa Docente', email: 'rosa@centro.es', password: 'una-clave-larga-1' };
  assert.strictEqual((await call('POST', '/api/teachers', body, enf)).status, 403);
  assert.strictEqual((await call('POST', '/api/teachers', Object.assign({}, body, { password: 'corta' }), admin)).status, 400);
  assert.strictEqual((await call('POST', '/api/teachers', Object.assign({}, body, { email: 'enf@x.com' }), admin)).status, 409, 'no convierte alumnado en profesorado');
  assert.strictEqual((await call('POST', '/api/teachers', body, admin)).status, 200);
  const bad = await fetch(base + '/api/teacher/login', { method: 'POST', headers: { 'X-Requested-With': 'historia', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'rosa@centro.es', password: 'otra' }) }); assert.strictEqual(bad.status, 401);
  const ok = await fetch(base + '/api/teacher/login', { method: 'POST', headers: { 'X-Requested-With': 'historia', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'rosa@centro.es', password: 'una-clave-larga-1' }) }); assert.strictEqual(ok.status, 200);
  const rosa = (ok.headers.get('set-cookie') || '').split(';')[0];
  assert.strictEqual((await call('GET', '/api/patients', null, rosa)).status, 200, 'entra como profesorado');
  assert.strictEqual((await call('POST', '/api/teachers', Object.assign({}, body, { email: 'otra@centro.es' }), rosa)).status, 403, 'solo la administración da altas');
  const rid = (await call('GET', '/api/users', null, admin)).json.users.find((u) => u.email === 'rosa@centro.es').id;
  assert.strictEqual((await call('DELETE', '/api/teachers/' + rid, null, admin)).status, 200);
  assert.strictEqual((await call('GET', '/api/patients', null, rosa)).status, 401, 'la baja cierra sus sesiones');
});

test('ver como alumno: solo lectura, sin notas del docente y sin lo que aún no toca', async () => {
  const mk = await sso({ email: 'admin@campus.local', name: 'Admin', admin: true });
  const r = await call('POST', '/api/import/example', null, mk); assert.strictEqual(r.status, 200); assert.ok(r.json.records > 5);
  const chart = r.json.chart_id;
  const staffView = (await call('GET', '/api/charts/' + chart, null, mk)).json;
  assert.ok(staffView.events.some((e) => e.day === 5), 'el profesorado ve el día 5');
  assert.strictEqual((await call('POST', '/api/charts/' + chart + '/preview', { profile: 'enfermeria' }, mk)).status, 200);
  const me = (await call('GET', '/api/me', null, mk)).json; assert.strictEqual(me.preview, true); assert.strictEqual(me.staff, false);
  const v = (await call('GET', '/api/charts/' + chart, null, mk)).json;
  assert.ok(!v.events.some((e) => e.day > 3), 'el día 5 aún no se ha liberado');
  assert.strictEqual(v.patient.data.notas_docente, undefined, 'no ve las notas del docente');
  assert.strictEqual((await call('GET', '/api/patients', null, mk)).status, 403, 'no ve la lista de pacientes');
  assert.strictEqual((await call('POST', '/api/charts/' + chart + '/records', { type: 'nota', data: { texto: 'prueba' } }, mk)).status, 403, 'solo lectura');
  assert.strictEqual((await call('POST', '/api/preview/exit', null, mk)).status, 200);
  assert.strictEqual((await call('GET', '/api/me', null, mk)).json.staff, true, 'vuelve al profesorado');
  assert.ok(!(await call('GET', '/api/users', null, mk)).json.users.some((u) => /historia\.local$/.test(u.email)), 'el alumno de prueba no sale en Alumnado');
});

test('enviar notas publicadas al Campus: una prueba por actividad, no una por historia', async () => {
  const group = 'p' + pid, body = { group, slug: 'cuidados', kind: 'practica', ra_id: 3, weight: 2, title: 'Caso EPOC' };
  assert.strictEqual((await call('POST', '/api/send-campus', body, enf)).status, 403, 'el alumnado no puede');
  assert.strictEqual((await call('POST', '/api/send-campus', Object.assign({}, body, { kind: '' }), admin)).status, 400, 'la categoría es obligatoria');
  assert.strictEqual((await call('POST', '/api/send-campus', Object.assign({}, body, { group: 'x1' }), admin)).status, 400);
  const r = await call('POST', '/api/send-campus', body, admin);
  assert.strictEqual(r.status, 200); assert.strictEqual(r.json.saved, 1);
  assert.strictEqual(campusGot.url, '/api/historia/grades'); assert.strictEqual(campusGot.auth, 'Bearer tok-campus');
  assert.strictEqual(campusGot.body.kind, 'practica'); assert.strictEqual(campusGot.body.key, 'hc-p' + pid);
  assert.deepStrictEqual(campusGot.body.grades.map((g) => g.email), ['enf@x.com']);
  assert.strictEqual((await call('POST', '/api/send-campus', Object.assign({}, body, { group: 'p99999' }), admin)).status, 400, 'sin notas publicadas');
});


test('enviar notas al Campus por consigna: varias historias de la misma actividad forman una sola prueba', async () => {
  const k = (await call('POST', '/api/patients/' + pid + '/consignas', { title: 'Turno de mañana', body: 'Haz lo que se pide.', tasks: [] }, admin)).json.id;
  assert.strictEqual((await call('PUT', '/api/charts/' + cEnf, { consigna_id: k }, admin)).status, 200);
  const g = (await call('GET', '/api/grades', null, admin)).json.grades.find((x) => x.chart_id === cEnf);
  assert.strictEqual(g.consigna_id, k); assert.strictEqual(g.consigna, 'Turno de mañana');
  const r = await call('POST', '/api/send-campus', { group: 'k' + k, slug: 'cuidados', kind: 'teoria', title: 'Turno de mañana' }, admin);
  assert.strictEqual(r.status, 200); assert.strictEqual(campusGot.body.key, 'hc-k' + k); assert.strictEqual(campusGot.body.title, 'Turno de mañana');
  assert.deepStrictEqual(campusGot.body.grades.map((x) => x.email), ['enf@x.com']);
  assert.strictEqual((await call('POST', '/api/send-campus', { group: 'p' + pid, slug: 'cuidados', kind: 'teoria', title: 'x' }, admin)).status, 400, 'ya no cuelga del paciente: la historia tiene consigna');
});
