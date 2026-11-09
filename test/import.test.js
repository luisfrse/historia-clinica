'use strict';
const test = require('node:test');
const assert = require('node:assert');
const IMP = require('../lib/import');

const SAMPLE = `\`\`\`
## CASO CLÍNICO
**[FICHA]**
Nombre: Carmen
Apellidos: Ruiz Soto
Sexo: Mujer
Edad: 78
NHC: 123456
Unidad: Medicina Interna
Habitación: 12
Fecha de ingreso: 12/03/2025
Motivo de ingreso: Disnea progresiva y fiebre de 3 días.
Enfermedad actual: Paciente con EPOC que consulta por
aumento de la tos y expectoración purulenta.
Hipertensión: controlada con enalapril.
Diagnóstico médico: EPOC reagudizada
Peso: 68,5 kg
Talla: 1,58 m
Grupo sanguíneo: O positivo
Notas del docente: Vigilar saturación. Error típico: oxígeno a flujo alto.
Objetivos de aprendizaje: (rellenar)

[ALERGIAS]
- Penicilina | Urticaria | grave
- Látex |  | moderada

[PRESCRIPCIONES]
- Fármaco | Dosis | Vía | Pauta | Horas | Días | Notas
- Paracetamol | 1 g | oral | cada 8 h | 8:00, 16:00, 00:00 | 1-5 | Si fiebre
- Enoxaparina | 40 mg | subcutánea | cada 24 h | 20:00 | 1-
- Salbutamol | 2 inhalaciones | inhalatoria | si precisa | si precisa | 1-5 |
- Morfina | 5 mg | telepática | cada 8 h | 08:00 | 1-3 |

[PRUEBAS Y EVENTOS]
- Día | prueba o evento | Título | Descripción
- 1 | prueba | Radiografía de tórax | Infiltrado en base derecha. | Sin derrame.
- Día 2 | evento | Fiebre vespertina | Temperatura 38,5 °C.
- 90 | evento | Fuera de rango | x
\`\`\`
`;

test('importar: ficha, alergias, prescripciones y eventos desde texto de IA', () => {
  const r = IMP.parse(SAMPLE, '2025-03-12');
  const p = r.patient;
  assert.strictEqual(p.nombre, 'Carmen'); assert.strictEqual(p.apellidos, 'Ruiz Soto'); assert.strictEqual(p.sexo, 'F');
  assert.strictEqual(p.fecha_nacimiento, '1947-03-12', 'edad -> fecha de nacimiento');
  assert.strictEqual(p.fecha_ingreso, '2025-03-12'); assert.strictEqual(p.peso, 68.5); assert.strictEqual(p.talla, 158); assert.strictEqual(p.grupo_sanguineo, '0+');
  assert.match(p.enfermedad_actual, /tos y expectoración purulenta/, 'campo en varias líneas');
  assert.match(p.enfermedad_actual, /\n/);
  assert.match(p.enfermedad_actual, /Hipertensión: controlada/, 'una línea con «:» dentro de un campo no es un campo nuevo');
  assert.strictEqual(p.objetivos_aprendizaje, undefined, 'valor entre paréntesis = sin rellenar');
  assert.deepStrictEqual(p.alergias, [{ agente: 'Penicilina', reaccion: 'Urticaria', gravedad: 'grave' }, { agente: 'Látex', reaccion: '', gravedad: 'moderada' }]);
  assert.deepStrictEqual(r.orders.map((o) => o.drug), ['Paracetamol', 'Enoxaparina', 'Salbutamol'], 'cabecera ignorada y vía inválida rechazada');
  assert.deepStrictEqual(r.orders[0].times.split(',').sort(), ['00:00', '08:00', '16:00']);
  assert.strictEqual(r.orders[1].route, 'sc'); assert.strictEqual(r.orders[1].start_day, 1); assert.strictEqual(r.orders[1].end_day, null);
  assert.strictEqual(r.orders[2].prn, true); assert.strictEqual(r.orders[2].times, '');
  assert.strictEqual(r.orders[0].start_day, 1); assert.strictEqual(r.orders[0].end_day, 5);
  assert.deepStrictEqual(r.events.map((e) => [e.day, e.kind, e.title]), [[1, 'prueba', 'Radiografía de tórax'], [2, 'evento', 'Fiebre vespertina']]);
  assert.match(r.events[0].body, /Sin derrame/);
  assert.ok(r.errors.some((e) => /Morfina|telepática/.test(e.msg)), 'vía desconocida se informa con su línea');
  assert.ok(r.errors.some((e) => /Día no válido/.test(e.msg)));
  assert.ok(r.errors.every((e) => e.line > 0), 'ningún error bloqueante de ficha');
});

test('importar: sin nombre o apellidos es un error de ficha', () => {
  const r = IMP.parse('[FICHA]\nNombre: Ana\nMotivo de ingreso: algo\n', '2025-01-01');
  assert.ok(r.errors.some((e) => e.line === 0 && /Apellidos/.test(e.msg)));
});

test('importar: la plantilla se puede rellenar y volver a leer', () => {
  const filled = IMP.TEMPLATE.slice(IMP.TEMPLATE.indexOf('[FICHA]')).replace('Nombre:', 'Nombre: Luis').replace('Apellidos:', 'Apellidos: Pérez');
  const r = IMP.parse(filled, '2025-01-01');
  assert.deepStrictEqual(r.errors, [], 'la plantilla sin tocar no da errores');
  assert.strictEqual(r.patient.nombre, 'Luis');
  assert.ok(r.orders.length === 2 && r.events.length === 2, 'los ejemplos de la plantilla se leen como datos');
});
