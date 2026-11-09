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

const { seedCatalog } = require('./seed-catalog');
module.exports = { PROFILES, TYPES, validate, seedCatalog };
