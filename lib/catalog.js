'use strict';
const U = require('./util');

/* Perfiles: enfermeria (todo) y tcae (técnico en cuidados auxiliares: solo registros propios de auxiliar). */
const PROFILES = ['enfermeria', 'tcae'];
const TYPES = ['nota', 'constantes', 'balance', 'cuidado'];

const num = (v, lo, hi, dec) => {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < lo || n > hi) throw new Error('rango');
  return dec == null ? n : Math.round(n * 10 ** dec) / 10 ** dec;
};
const oneOf = (v, list) => { if (!list.includes(v)) throw new Error('valor'); return v; };

/* Valida y normaliza los datos de un registro. Lanza Error('...') si no es válido. */
function validate(type, d, ctx) {
  d = d && typeof d === 'object' ? d : {};
  if (type === 'nota') {
    const text = U.clipML(d.texto, 4000); if (text.length < 3) throw new Error('texto');
    return { texto: text, turno: oneOf(d.turno || 'M', ['M', 'T', 'N']), tipo: oneOf(d.tipo || 'evolucion', ['evolucion', 'incidencia', 'educacion', 'traspaso']) };
  }
  if (type === 'constantes') {
    const o = {
      ta_sis: num(d.ta_sis, 30, 300), ta_dia: num(d.ta_dia, 15, 200), fc: num(d.fc, 10, 300), fr: num(d.fr, 2, 80),
      temp: num(d.temp, 25, 45, 1), spo2: num(d.spo2, 30, 100), glucemia: num(d.glucemia, 10, 900), dolor: num(d.dolor, 0, 10),
      peso: num(d.peso, 0.3, 400, 1), talla: num(d.talla, 20, 250),
    };
    if ((o.ta_sis == null) !== (o.ta_dia == null)) throw new Error('ta');
    if (o.ta_sis != null && o.ta_dia >= o.ta_sis) throw new Error('ta');
    if (d.conciencia) o.conciencia = oneOf(d.conciencia, ['alerta', 'somnoliento', 'estuporoso', 'coma']);
    for (const k of Object.keys(o)) if (o[k] == null) delete o[k];
    if (!Object.keys(o).length) throw new Error('vacio');
    const obs = U.clip(d.obs, 300); if (obs) o.obs = obs;
    return o;
  }
  if (type === 'balance') {
    const dir = oneOf(d.dir, ['ingesta', 'eliminacion']);
    const via = oneOf(d.via, dir === 'ingesta' ? ['oral', 'iv', 'sng', 'otra'] : ['diuresis', 'deposicion', 'vomito', 'drenaje', 'otra']);
    const o = { dir, via, ml: num(d.ml, 0, 10000) };
    if (o.ml == null) throw new Error('ml');
    const obs = U.clip(d.obs, 300); if (obs) o.obs = obs;
    return o;
  }
  if (type === 'cuidado') {
    const it = ctx && ctx.catalog(parseInt(d.catalog_id, 10));
    if (!it || !it.active) throw new Error('catalogo');
    if (!it.roles.split(',').includes(ctx.role)) throw new Error('perfil');
    const o = { catalog_id: it.id, nombre_es: it.name_es, nombre_ca: it.name_ca || it.name_es, resultado: oneOf(d.resultado || 'realizado', ['realizado', 'rechazado', 'no_tolerado', 'pendiente']) };
    const obs = U.clipML(d.obs, 1500); if (obs) o.obs = obs;
    return o;
  }
  throw new Error('tipo');
}

/* Catálogo inicial propio (editable en la app). roles = quién puede registrarlo. */
const E = 'enfermeria', EA = 'enfermeria,tcae';
const SEED = [
  ['Higiene y confort', 'Higiene completa en cama', 'Higiene completa al llit', EA],
  ['Higiene y confort', 'Higiene parcial / aseo asistido', 'Higiene parcial / aseig assistit', EA],
  ['Higiene y confort', 'Ducha asistida', 'Dutxa assistida', EA],
  ['Higiene y confort', 'Higiene bucal', 'Higiene bucal', EA],
  ['Higiene y confort', 'Cuidado de la piel e hidratación', 'Cura de la pell i hidratació', EA],
  ['Higiene y confort', 'Cambio de ropa de cama', 'Canvi de roba de llit', EA],
  ['Higiene y confort', 'Cambio de absorbente / dispositivo de incontinencia', "Canvi d'absorbent / dispositiu d'incontinència", EA],
  ['Movilidad', 'Cambio postural', 'Canvi postural', EA],
  ['Movilidad', 'Movilización y transferencia cama-sillón', 'Mobilització i transferència llit-cadira', EA],
  ['Movilidad', 'Deambulación asistida', 'Deambulació assistida', EA],
  ['Movilidad', 'Prevención de úlceras por presión (medidas)', 'Prevenció de nafres per pressió (mesures)', EA],
  ['Nutrición', 'Ayuda en la ingesta', 'Ajuda en la ingesta', EA],
  ['Nutrición', 'Control de dieta y líquidos', 'Control de dieta i líquids', EA],
  ['Eliminación', 'Medición de diuresis', 'Mesura de diüresi', EA],
  ['Eliminación', 'Recogida de muestra de orina / heces', "Recollida de mostra d'orina / femta", EA],
  ['Seguridad', 'Medidas de seguridad (barandillas, timbre, calzado)', 'Mesures de seguretat (baranes, timbre, calçat)', EA],
  ['Seguridad', 'Acompañamiento y apoyo emocional', 'Acompanyament i suport emocional', EA],
  ['Seguridad', 'Preparación de la habitación / acogida al ingreso', "Preparació de l'habitació / acollida a l'ingrés", EA],
  ['Procedimientos de enfermería', 'Cura de herida quirúrgica', 'Cura de ferida quirúrgica', E],
  ['Procedimientos de enfermería', 'Cura de úlcera por presión', 'Cura de nafra per pressió', E],
  ['Procedimientos de enfermería', 'Canalización de vía venosa periférica', 'Canalització de via venosa perifèrica', E],
  ['Procedimientos de enfermería', 'Control y mantenimiento de vía venosa', 'Control i manteniment de via venosa', E],
  ['Procedimientos de enfermería', 'Sondaje vesical', 'Sondatge vesical', E],
  ['Procedimientos de enfermería', 'Sondaje nasogástrico', 'Sondatge nasogàstric', E],
  ['Procedimientos de enfermería', 'Extracción de muestras sanguíneas', 'Extracció de mostres sanguínies', E],
  ['Procedimientos de enfermería', 'Glucemia capilar', 'Glucèmia capil·lar', E],
  ['Procedimientos de enfermería', 'Oxigenoterapia', 'Oxigenoteràpia', E],
  ['Procedimientos de enfermería', 'Aspiración de secreciones', 'Aspiració de secrecions', E],
  ['Procedimientos de enfermería', 'Cuidados de ostomía', "Cures d'ostomia", E],
  ['Procedimientos de enfermería', 'Electrocardiograma', 'Electrocardiograma', E],
  ['Educación y valoración', 'Educación sanitaria al paciente / familia', 'Educació sanitària al pacient / família', E],
  ['Educación y valoración', 'Valoración del riesgo (caídas, úlceras, etc.)', 'Valoració del risc (caigudes, nafres, etc.)', E],
];
function seedCatalog(db) {
  if (db.get('SELECT COUNT(*) n FROM catalog').n > 0) return;
  SEED.forEach((s, i) => db.run('INSERT INTO catalog (kind, grp, name_es, name_ca, roles, ord) VALUES (?,?,?,?,?,?)', 'cuidado', s[0], s[1], s[2], s[3], i));
}
module.exports = { PROFILES, TYPES, validate, seedCatalog };
