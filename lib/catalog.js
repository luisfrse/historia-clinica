'use strict';
const U = require('./util');
const SC = require('../public/scales');

/* Perfiles: enfermeria (todo) y tcae (técnico en cuidados auxiliares: solo registros propios de auxiliar). */
const PROFILES = ['enfermeria', 'tcae'];
const TYPES = ['nota', 'constantes', 'balance', 'cuidado', 'medicacion', 'escala', 'valoracion', 'plan', 'plan_eval', 'informe'];
/* Registros que solo hace el perfil de enfermería. */
const NURSE_ONLY = ['escala', 'valoracion', 'informe']; /* el plan de cuidados (PAI) lo hacen enfermería y auxiliar */
const ROUTES = ['oral', 'topica', 'sc', 'im', 'iv', 'inhalatoria', 'rectal', 'oftalmica', 'otica', 'sng', 'otra'];
/* Vías que el auxiliar puede administrar bajo supervisión de enfermería. */
const TCAE_ROUTES = ['oral', 'topica'];

const num = (v, lo, hi, dec) => {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < lo || n > hi) throw new Error('rango');
  return dec == null ? n : Math.round(n * 10 ** dec) / 10 ** dec;
};
const oneOf = (v, list) => { if (!list.includes(v)) throw new Error('valor'); return v; };

const score = (v) => { const n = parseInt(v, 10); if (!(n >= 1 && n <= 5)) throw new Error('puntuacion'); return n; };
const taxRef = (x) => ({ slug: U.clip(x && x.slug, 60), code: U.clip(x && x.code, 20), es: U.clip(x && x.es, 200), ca: U.clip((x && x.ca) || (x && x.es), 200) });
/* Plan de cuidados guiado (PAI): valoración → diagnóstico (PES) → resultados (NOC) con indicadores y puntuaciones → intervenciones (NIC) con actividades. */
function planStructured(d, o) {
  const x = { tipo: oneOf(d.tipo || 'real', ['real', 'riesgo', 'promocion']), datos: U.clipML(d.datos, 1500), signos: U.clipML(d.signos, 600) };
  if (d.patron) x.patron = oneOf(d.patron, Object.keys(SC.PATRONES));
  if (d.nanda && d.nanda.es) x.nanda = taxRef(d.nanda);
  x.noc = (Array.isArray(d.noc) ? d.noc : []).slice(0, 4).map((n) => {
    const r = taxRef(n), ind = (Array.isArray(n && n.ind) ? n.ind : []).slice(0, 6).map((i) => ({ t: U.clip(i && i.t, 200), ini: score(i && i.ini), meta: score(i && i.meta) })).filter((i) => i.t);
    ind.forEach((i) => { if (i.meta <= i.ini) throw new Error('meta'); }); if (!r.es || !ind.length) throw new Error('noc');
    return Object.assign(r, { plazo: Math.min(365, Math.max(0, parseInt(n.plazo, 10) || 0)), ind });
  });
  x.nic = (Array.isArray(d.nic) ? d.nic : []).slice(0, 6).map((n) => {
    const r = taxRef(n), act = (Array.isArray(n && n.act) ? n.act : []).map((a) => U.clip(a, 200)).filter(Boolean).slice(0, 10); if (!r.es || !act.length) throw new Error('nic');
    return Object.assign(r, { quien: oneOf(n.quien || 'both', ['both', 'nurse', 'aux']), freq: U.clip(n.freq, 100), act });
  });
  if (!o.objetivo) x.objetivo = U.clipML(x.noc.map((n) => n.es + ': ' + n.ind.map((i) => i.t + ' ' + i.ini + '→' + i.meta).join('; ')).join('\n'), 800);
  if (!o.intervenciones) x.intervenciones = U.clipML(x.nic.map((n) => n.es + ': ' + n.act.join('; ')).join('\n'), 2000);
  return x;
}

/* Valida y normaliza los datos de un registro. Lanza Error('...') si no es válido. */
function validate(type, d, ctx) {
  d = d && typeof d === 'object' ? d : {};
  if (NURSE_ONLY.includes(type) && ctx && ctx.role !== 'enfermeria') throw new Error('perfil');
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
  if (type === 'medicacion') {
    const ord = ctx && ctx.order && ctx.order(parseInt(d.order_id, 10));
    if (!ord) throw new Error('prescripcion');
    if (ctx.role === 'tcae' && !TCAE_ROUTES.includes(ord.route)) throw new Error('perfil');
    const slot = d.slot ? String(d.slot) : '';
    if (slot && !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot)) throw new Error('hora');
    if (slot && !ord.times.split(',').includes(slot)) throw new Error('hora');
    const o = { order_id: ord.id, farmaco: ord.drug, dosis: ord.dose, via: ord.route, estado: oneOf(d.estado || 'administrada', ['administrada', 'rechazada', 'omitida', 'retrasada']) };
    if (slot) o.slot = slot;
    if (d.lote) o.lote = U.clip(d.lote, 40);
    const obs = U.clip(d.obs, 300); if (obs) o.obs = obs;
    return o;
  }
  if (type === 'escala') {
    const r = SC.compute(String(d.scale || ''), d.items);
    const obs = U.clip(d.obs, 300); if (obs) r.obs = obs;
    return r;
  }
  if (type === 'valoracion') {
    const o = { patron: oneOf(d.patron, Object.keys(SC.PATRONES)), alterado: !!d.alterado, texto: U.clipML(d.texto, 3000) };
    if (o.texto.length < 3) throw new Error('texto');
    return o;
  }
  if (type === 'plan') {
    const o = { problema: U.clip(d.problema || (d.nanda && d.nanda.es), 200), causa: U.clip(d.causa, 300), objetivo: U.clipML(d.objetivo, 800), intervenciones: U.clipML(d.intervenciones, 2000), prioridad: oneOf(d.prioridad || 'media', ['alta', 'media', 'baja']) };
    if (Array.isArray(d.noc) || Array.isArray(d.nic)) Object.assign(o, planStructured(d, o));
    if (o.problema.length < 3 || o.objetivo.length < 3 || o.intervenciones.length < 3) throw new Error('texto');
    return o;
  }
  if (type === 'plan_eval') {
    const o = { plan_id: parseInt(d.plan_id, 10), resultado: oneOf(d.resultado, ['conseguido', 'parcial', 'no_conseguido']), texto: U.clipML(d.texto, 1500) };
    if (!ctx || !ctx.record || !ctx.record(o.plan_id, 'plan')) throw new Error('plan');
    if (Array.isArray(d.ind)) o.ind = d.ind.slice(0, 24).map((x) => ({ n: Math.min(3, Math.max(0, parseInt(x && x.n, 10) || 0)), i: Math.min(5, Math.max(0, parseInt(x && x.i, 10) || 0)), valor: score(x && x.valor) }));
    return o;
  }
  if (type === 'informe') {
    const o = { tipo: oneOf(d.tipo || 'alta', ['alta', 'traspaso']), resumen: U.clipML(d.resumen, 3000), estado: U.clipML(d.estado, 1500), recomendaciones: U.clipML(d.recomendaciones, 3000) };
    if (o.resumen.length < 10) throw new Error('texto');
    return o;
  }
  throw new Error('tipo');
}

const { seedCatalog } = require('./seed-catalog');
module.exports = { PROFILES, TYPES, NURSE_ONLY, ROUTES, TCAE_ROUTES, validate, seedCatalog };
