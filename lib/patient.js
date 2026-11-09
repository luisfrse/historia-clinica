'use strict';
const U = require('./util');

/* Ficha base del paciente (ficticio). `hidden: true` = solo la ve el profesorado (no el alumnado). */
const FIELDS = [
  { k: 'nombre', max: 80, req: true }, { k: 'apellidos', max: 120, req: true },
  { k: 'sexo', enum: ['M', 'F', 'O'] }, { k: 'fecha_nacimiento', date: true },
  { k: 'nhc', max: 30 }, { k: 'unidad', max: 80 }, { k: 'habitacion', max: 20 }, { k: 'cama', max: 20 },
  { k: 'fecha_ingreso', date: true }, { k: 'procedencia', max: 120 },
  { k: 'motivo_ingreso', max: 2000, ml: true }, { k: 'enfermedad_actual', max: 4000, ml: true },
  { k: 'diagnostico_medico', max: 1000, ml: true },
  { k: 'antecedentes_personales', max: 4000, ml: true }, { k: 'antecedentes_familiares', max: 2000, ml: true },
  { k: 'intervenciones_previas', max: 2000, ml: true },
  { k: 'medicacion_habitual', max: 3000, ml: true },
  { k: 'peso', num: [0.3, 400] }, { k: 'talla', num: [20, 250] }, { k: 'grupo_sanguineo', enum: ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-'] },
  { k: 'autonomia', max: 2000, ml: true }, { k: 'habitos', max: 2000, ml: true },
  { k: 'situacion_social', max: 2000, ml: true }, { k: 'contacto_familiar', max: 500 },
  { k: 'dieta', max: 300 }, { k: 'aislamiento', max: 200 }, { k: 'riesgos', max: 1000, ml: true },
  { k: 'notas_docente', max: 6000, ml: true, hidden: true },
  { k: 'objetivos_aprendizaje', max: 4000, ml: true, hidden: true },
];

/* Valida el cuerpo recibido y devuelve { data, error }. */
function sanitize(b) {
  b = b && typeof b === 'object' ? b : {};
  const data = {};
  for (const f of FIELDS) {
    let v = b[f.k];
    if (v == null || v === '') { if (f.req) return { error: 'falta:' + f.k }; continue; }
    if (f.enum) { if (!f.enum.includes(v)) return { error: 'valor:' + f.k }; if (v) data[f.k] = v; continue; }
    if (f.date) { v = String(v); if (!U.validDate(v)) return { error: 'fecha:' + f.k }; data[f.k] = v; continue; }
    if (f.num) { const n = Number(String(v).replace(',', '.')); if (!Number.isFinite(n) || n < f.num[0] || n > f.num[1]) return { error: 'rango:' + f.k }; data[f.k] = n; continue; }
    v = f.ml ? U.clipML(v, f.max) : U.clip(v, f.max);
    if (v) data[f.k] = v; else if (f.req) return { error: 'falta:' + f.k };
  }
  const al = [];
  if (Array.isArray(b.alergias)) for (const a of b.alergias.slice(0, 30)) {
    const ag = U.clip(a && a.agente, 100); if (!ag) continue;
    al.push({ agente: ag, reaccion: U.clip(a.reaccion, 200), gravedad: ['leve', 'moderada', 'grave'].includes(a.gravedad) ? a.gravedad : '' });
  }
  data.alergias = al;
  if (b.sin_alergias === true && !al.length) data.sin_alergias = true;
  return { data };
}

/* Versión de la ficha para el alumnado: sin los campos reservados al profesorado. */
function forStudent(data) {
  const o = Object.assign({}, data);
  for (const f of FIELDS) if (f.hidden) delete o[f.k];
  return o;
}
module.exports = { FIELDS, sanitize, forStudent };
