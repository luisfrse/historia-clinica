'use strict';
const test = require('node:test');
const assert = require('node:assert');
const IMP = require('../lib/import');

test('importar en catalán: el ejemplo se lee entero', () => {
  const r = IMP.parse(IMP.EXAMPLES.ca, '2025-03-12');
  assert.deepStrictEqual(r.errors, []);
  const p = r.patient;
  assert.strictEqual(p.nombre, 'Carme'); assert.strictEqual(p.apellidos, 'Ruiz Soto'); assert.strictEqual(p.sexo, 'F');
  assert.strictEqual(p.fecha_ingreso, '2025-03-12'); assert.strictEqual(p.fecha_nacimiento, '1947-03-12');
  assert.strictEqual(p.peso, 68); assert.strictEqual(p.grupo_sanguineo, 'A+');
  assert.match(p.diagnostico_medico, /MPOC/); assert.match(p.notas_docente, /Errors típics/); assert.match(p.objetivos_aprendizaje, /Valorar el patró/);
  assert.deepStrictEqual(p.alergias.map((a) => a.gravedad), ['grave', 'leve']);
  assert.strictEqual(r.orders.length, 6); assert.ok(r.orders.some((o) => o.prn));
  assert.strictEqual(r.orders.find((o) => o.drug === 'Enoxaparina').route, 'sc');
  assert.strictEqual(r.events.length, 7); assert.deepStrictEqual(r.events.map((e) => e.kind).filter((k, i, a) => a.indexOf(k) === i).sort(), ['evento', 'prueba']);
});

test('importar en castellano: el ejemplo se lee entero', () => {
  const r = IMP.parse(IMP.EXAMPLES.es, '2025-03-12');
  assert.deepStrictEqual(r.errors, []);
  assert.strictEqual(r.orders.length, 6); assert.strictEqual(r.events.length, 7); assert.strictEqual(r.patient.alergias.length, 2);
});

test('importar en catalán: la plantilla sin tocar no da errores y «Cap» es sin alergias', () => {
  const t = IMP.TEMPLATES.ca;
  const r = IMP.parse(t.slice(t.indexOf('[FITXA]')).replace('Nom:', 'Nom: Joan').replace('Cognoms:', 'Cognoms: Pons'), '2025-01-01');
  assert.deepStrictEqual(r.errors, []); assert.strictEqual(r.patient.nombre, 'Joan');
  assert.ok(r.orders.length === 2 && r.events.length === 2);
  const r2 = IMP.parse('[FITXA]\nNom: A\nCognoms: B\n\n[AL·LÈRGIES]\nCap\n', '2025-01-01');
  assert.strictEqual(r2.patient.sin_alergias, true);
  const r3 = IMP.parse('[FITXA]\nNom: A\nCognoms: B\nSexe: Home\nPes: 70 kg\nGrup sanguini: 0 positiu\n\n[PRESCRIPCIONS]\n- Ibuprofè | 600 mg | via oral | cada 8 h | 8:00 | des de 2 |\n\n[PROVES I ESDEVENIMENTS]\n- Dia 3 | Prova | Anàlisi | Normal\n', '2025-01-01');
  assert.strictEqual(r3.patient.sexo, 'M'); assert.strictEqual(r3.patient.grupo_sanguineo, '0+');
  assert.strictEqual(r3.orders[0].start_day, 2); assert.strictEqual(r3.orders[0].end_day, null); assert.strictEqual(r3.events[0].kind, 'prueba');
});
