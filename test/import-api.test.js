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

test('acceso programado, seguimiento, informe PDF/ZIP y borrado de datos del alumnado', async () => {
  const admin = await sso({ email: 'admin@campus.local', name: 'Admin', admin: true });
  const alum = await sso({ email: 'c@x.com', name: 'Carla Pons' });
  const ex = await call('POST', '/api/import/example', { lang: 'es' }, admin), pid = ex.json.id;
  const ub = (await call('GET', '/api/users', null, admin)).json.users.find((u) => u.email === 'c@x.com');
  const kid = (await call('GET', '/api/patients/' + pid + '/consignas', null, admin)).json.consignas[0].id;
  /* programada para el futuro: el alumno la ve en su lista pero no puede abrirla */
  assert.strictEqual((await call('POST', '/api/patients/' + pid + '/assign', { mode: 'individual', user_ids: [ub.id], consigna_id: kid, opens: '2999-01-01' }, admin)).status, 200);
  const mine = (await call('GET', '/api/my/charts', null, alum)).json.charts; assert.strictEqual(mine.length, 1);
  const cid = mine[0].id; assert.strictEqual(mine[0].window, 'scheduled'); assert.strictEqual(mine[0].opens, '2999-01-01');
  const early = await call('GET', '/api/charts/' + cid, null, alum); assert.strictEqual(early.status, 403); assert.strictEqual(early.json.error, 'scheduled');
  const nota = { type: 'nota', data: { texto: 'Nota de prueba escrita por la alumna.' } };
  assert.strictEqual((await call('POST', '/api/charts/' + cid + '/records', nota, alum)).status, 404, 'no puede escribir antes de la fecha');
  assert.strictEqual((await call('PUT', '/api/charts/' + cid, { opens: '2030-05-01', closes: '2030-04-01' }, admin)).status, 400, 'hasta no puede ser anterior a desde');
  /* terminada: se puede ver pero no escribir */
  assert.strictEqual((await call('PUT', '/api/charts/' + cid, { opens: '', closes: '2000-01-01' }, admin)).status, 200);
  const late = (await call('GET', '/api/charts/' + cid, null, alum)); assert.strictEqual(late.status, 200); assert.strictEqual(late.json.chart.status, 'closed'); assert.strictEqual(late.json.chart.window, 'ended');
  assert.strictEqual((await call('POST', '/api/charts/' + cid + '/records', nota, alum)).status, 409);
  /* abierta sin límites */
  assert.strictEqual((await call('PUT', '/api/charts/' + cid, { opens: '', closes: '' }, admin)).status, 200);
  assert.strictEqual((await call('POST', '/api/charts/' + cid + '/records', nota, alum)).status, 200);
  /* seguimiento por consigna */
  const sg = (await call('GET', '/api/patients/' + pid + '/seguimiento', null, admin)).json.groups;
  const g1 = sg.find((g) => g.consigna && g.consigna.id === kid); assert.ok(g1, 'grupo de la consigna');
  const ch = g1.charts.find((c) => c.id === cid); assert.strictEqual(ch.members[0].records, 1); assert.strictEqual(ch.records, 1);
  assert.strictEqual((await call('GET', '/api/patients/' + pid + '/seguimiento', null, alum)).status, 403);
  /* ficha de trabajo del alumno e informe */
  const work = (await call('GET', '/api/students/' + ub.id + '/work', null, admin)).json; assert.strictEqual(work.charts.length, 1); assert.strictEqual(work.charts[0].records, 1);
  const pdf = await fetch(base + '/api/students/' + ub.id + '/report.pdf?lang=es', { headers: { Cookie: admin } });
  assert.strictEqual(pdf.status, 200); assert.match(pdf.headers.get('content-type'), /application\/pdf/);
  const buf = Buffer.from(await pdf.arrayBuffer()); assert.strictEqual(buf.slice(0, 5).toString(), '%PDF-'); assert.ok(buf.toString('latin1').includes('Nota de prueba escrita'), 'el PDF lleva lo que escribió');
  assert.strictEqual((await fetch(base + '/api/students/' + ub.id + '/report.pdf', { headers: { Cookie: alum } })).status, 403);
  const zip = await fetch(base + '/api/reports.zip', { headers: { Cookie: admin } }); assert.strictEqual(zip.status, 200);
  const zb = Buffer.from(await zip.arrayBuffer()); assert.strictEqual(zb.slice(0, 2).toString(), 'PK'); assert.ok(zb.includes(Buffer.from('Carla_Pons.pdf')));
  assert.ok(!zb.includes(Buffer.from('alumno_prueba')), 'el alumno de prueba no entra en el ZIP');
  /* borrado: pide confirmación, conserva la historia salvo que se pida */
  assert.strictEqual((await call('GET', '/api/cleanup?scope=student&id=' + ub.id, null, admin)).json.records, 1);
  assert.strictEqual((await call('POST', '/api/cleanup', { scope: 'student', id: ub.id }, admin)).status, 400, 'sin confirmar no borra');
  assert.strictEqual((await call('POST', '/api/cleanup', { scope: 'student', id: ub.id, confirm: 'BORRAR' }, alum)).status, 403);
  assert.strictEqual((await call('POST', '/api/cleanup', { scope: 'student', id: ub.id, confirm: 'BORRAR' }, admin)).status, 200);
  assert.strictEqual((await call('GET', '/api/students/' + ub.id + '/work', null, admin)).json.charts[0].records, 0);
  assert.strictEqual((await call('GET', '/api/my/charts', null, alum)).json.charts.length, 1, 'la historia sigue asignada');
  assert.strictEqual((await call('POST', '/api/cleanup', { scope: 'chart', id: cid, confirm: 'borrar', charts: true }, admin)).status, 200);
  assert.strictEqual((await call('GET', '/api/my/charts', null, alum)).json.charts.length, 0, 'con «borrar historias» desaparece la asignación');
  assert.ok((await call('GET', '/api/charts/' + ex.json.chart_id, null, admin)).json.records.length > 5, 'los registros de otras historias no se tocan');
});

test('enlace directo desde el Campus: SSO con «to» lleva a la actividad', async () => {
  const go = async (to) => { const r = await fetch(base + '/sso?t=' + encodeURIComponent(token({ email: 'd' + Math.random().toString(36).slice(2) + '@x.com', name: 'D', to })), { redirect: 'manual' }); return r.headers.get('location'); };
  assert.strictEqual(await go('consigna/5'), '/#/go/consigna/5');
  assert.strictEqual(await go('chart/9'), '/#/go/chart/9');
  assert.strictEqual(await go('consigna/5/../../x'), '/', 'un destino no válido se ignora');
  assert.strictEqual(await go(undefined), '/');
});

test('aislamiento: tipos en la ficha y en la importación, catálogo ampliado y PDF del caso', async () => {
  const admin = await sso({ email: 'admin@campus.local', name: 'Admin', admin: true });
  const alum = await sso({ email: 'e@x.com', name: 'Elena' });
  /* ficha con tipos (los desconocidos se descartan) */
  const p = await call('POST', '/api/patients', { nombre: 'Rosa', apellidos: 'Vidal', aislamiento: 'SARM en herida', aislamiento_tipos: ['contacto', 'gotas', 'invento'] }, admin);
  assert.strictEqual(p.status, 200);
  assert.deepStrictEqual((await call('GET', '/api/patients/' + p.json.id, null, admin)).json.patient.data.aislamiento_tipos, ['contacto', 'gotas']);
  /* importar en los dos idiomas */
  const base2 = (k, v) => '[FICHA]\nNombre: A\nApellidos: B\n' + k + ': ' + v + '\n';
  const IMPL = require('../lib/import');
  assert.deepStrictEqual(IMPL.parse(base2('Tipo de aislamiento', 'contacto, aérea'), '2025-01-01').patient.aislamiento_tipos, ['contacto', 'aereo']);
  assert.deepStrictEqual(IMPL.parse('[FITXA]\nNom: A\nCognoms: B\nTipus d\'aïllament: gotes i protector\n', '2025-01-01').patient.aislamiento_tipos, ['gotas', 'protector']);
  assert.strictEqual(IMPL.parse(base2('Tipo de aislamiento', 'ninguno'), '2025-01-01').patient.aislamiento_tipos, undefined);
  assert.match(IMPL.TEMPLATES.ca, /Tipus d'aïllament/); assert.match(IMPL.TEMPLATES.es, /Tipo de aislamiento/);
  /* catálogo: acciones de aislamiento disponibles para enfermería y auxiliar */
  const cat = (await call('GET', '/api/catalog', null, admin)).json.items;
  for (const n of ['Aislamiento de contacto: medidas (bata, guantes, material exclusivo)', 'Aislamiento aéreo: medidas (mascarilla FFP2, puerta cerrada)', 'Señalización del aislamiento en la puerta de la habitación']) {
    const it = cat.find((c) => c.name_es === n); assert.ok(it, n); assert.strictEqual(it.roles, 'enfermeria,tcae');
  }
  /* PDF del caso: versión alumnado sin notas del docente y por día; completa con todo */
  const ex = await call('POST', '/api/import/example', { lang: 'es' }, admin), pid = ex.json.id;
  const get = async (q, ck) => { const r = await fetch(base + '/api/patients/' + pid + '/case.pdf' + q, { headers: { Cookie: ck } }); return { status: r.status, type: r.headers.get('content-type'), text: Buffer.from(await r.arrayBuffer()).toString('latin1') }; };
  const st = await get('?lang=es&day=1', admin); assert.strictEqual(st.status, 200); assert.match(st.type, /pdf/);
  assert.ok(st.text.startsWith('%PDF-')); assert.ok(st.text.includes('Ruiz Soto')); assert.ok(st.text.includes('Penicilina')); assert.ok(st.text.includes('Paracetamol'));
  assert.ok(!st.text.includes('Notas para el profesorado'), 'el alumnado no recibe las notas del docente');
  assert.ok(st.text.includes('Radiograf') && !st.text.includes('Fiebre vespertina'), 'solo pruebas y eventos hasta el día 1');
  assert.ok(st.text.includes('Consignas') && st.text.includes('Turno de mañana'));
  const full = await get('?lang=ca&full=1', admin); assert.ok(full.text.includes('Notes per al professorat') && full.text.includes('Preparaci'), 'la versión completa lleva notas y todos los días');
  assert.strictEqual((await get('?lang=es', alum)).status, 403, 'el alumnado no descarga el caso');
});

test('clasificar pacientes por asignatura y tema: individual, en bloque, filtros e importación', async () => {
  const admin = await sso({ email: 'admin@campus.local', name: 'Admin', admin: true });
  const alum = await sso({ email: 'f@x.com', name: 'Fer' });
  const mk = async (n) => (await call('POST', '/api/patients', { nombre: n, apellidos: 'Clasif' }, admin)).json.id;
  const a = await mk('Ana'), b = await mk('Beto'), c = await mk('Cari');
  const { db } = require('../server'); db.setSetting('campus_subjects', JSON.stringify([{ slug: 'c6', title: 'C6 (CAI)' }, { slug: 'fisio', title: 'Fisiología' }]));
  /* individual: valida contra las asignaturas del Campus y limpia temas repetidos */
  const one = await call('PUT', '/api/patients/' + a + '/classify', { subjects: ['c6', 'inventada', 'c6'], topics: ['Respiratorio', 'respiratorio', ' EPOC '] }, admin);
  assert.strictEqual(one.status, 200); assert.deepStrictEqual(one.json.subjects, ['c6']); assert.deepStrictEqual(one.json.topics, ['Respiratorio', 'EPOC']);
  assert.strictEqual((await call('PUT', '/api/patients/' + a + '/classify', { subjects: ['c6'] }, alum)).status, 403);
  /* editar la ficha no pierde la clasificación */
  assert.strictEqual((await call('PUT', '/api/patients/' + a, { nombre: 'Ana', apellidos: 'Cambiada' }, admin)).status, 200);
  const card = (await call('GET', '/api/patients/' + a, null, admin)).json.patient; assert.deepStrictEqual(card.subjects, ['c6']); assert.deepStrictEqual(card.topics, ['Respiratorio', 'EPOC']);
  /* en bloque: añadir y quitar */
  const bulk = await call('POST', '/api/patients/classify', { ids: [a, b, c, 99999], add_subjects: ['fisio'], add_topics: ['Diabetes'], remove_topics: ['epoc'] }, admin);
  assert.strictEqual(bulk.status, 200); assert.strictEqual(bulk.json.updated, 3);
  const list = (await call('GET', '/api/patients', null, admin)).json.patients, by = (id) => list.find((p) => p.id === id);
  assert.deepStrictEqual(by(a).subjects, ['c6', 'fisio']); assert.deepStrictEqual(by(a).topics, ['Respiratorio', 'Diabetes']); assert.deepStrictEqual(by(b).subjects, ['fisio']);
  assert.strictEqual((await call('POST', '/api/patients/classify', { ids: [] }, admin)).status, 400);
  assert.strictEqual((await call('POST', '/api/patients/classify', { ids: [a] , add_subjects: ['fisio'] }, alum)).status, 403);
  await call('POST', '/api/patients/classify', { ids: [b], remove_subjects: ['fisio'], remove_topics: ['diabetes'] }, admin);
  assert.deepStrictEqual((await call('GET', '/api/patients/' + b, null, admin)).json.patient.subjects, []);
  /* opciones para filtros: asignaturas del Campus y temas con su recuento */
  const opt = (await call('GET', '/api/class-options', null, admin)).json;
  assert.deepStrictEqual(opt.subjects.map((x) => x.slug), ['c6', 'fisio']);
  assert.ok(opt.topics.find((x) => x.name === 'Diabetes').count >= 2, 'cuenta al menos Ana y Cari (más los ejemplos creados antes)');
  assert.strictEqual((await call('GET', '/api/class-options', null, alum)).status, 403);
  /* el alumnado no ve la clasificación en las fichas */
  const created = await call('POST', '/api/patients', { nombre: 'Gus', apellidos: 'Visible', subjects: ['c6'], topics: ['Renal'] }, admin);
  assert.deepStrictEqual((await call('GET', '/api/patients/' + created.json.id, null, admin)).json.patient.topics, ['Renal'], 'al crear también se puede clasificar');
  /* importar: la IA propone los temas; las asignaturas las eliges tú */
  const IMPL = require('../lib/import');
  assert.deepStrictEqual(IMPL.parse('[FICHA]\nNombre: A\nApellidos: B\nTemas: Respiratorio, EPOC; Oxigenoterapia\n', '2025-01-01').topics, ['Respiratorio', 'EPOC', 'Oxigenoterapia']);
  assert.deepStrictEqual(IMPL.parse('[FITXA]\nNom: A\nCognoms: B\nTemes: Respiratori, MPOC\n', '2025-01-01').topics, ['Respiratori', 'MPOC']);
  assert.deepStrictEqual(IMPL.parse(IMPL.TEMPLATES.es.slice(IMPL.TEMPLATES.es.indexOf('[FICHA]')).replace('Nombre:', 'Nombre: Z').replace('Apellidos:', 'Apellidos: Y'), '2025-01-01').topics, [], 'la sugerencia de la plantilla sin rellenar no cuenta');
  const ex = await call('POST', '/api/import/example', { lang: 'ca' }, admin);
  assert.deepStrictEqual((await call('GET', '/api/patients/' + ex.json.id, null, admin)).json.patient.topics, ['Respiratori', 'MPOC', 'Oxigenoteràpia', 'Diabetis']);
});
