'use strict';
/* Biblioteca editable de diagnósticos (NANDA), resultados (NOC) e intervenciones (NIC) para guiar el plan de cuidados.
   Solo se siembra una biblioteca inicial pequeña y propia; el profesorado la amplía o importa su material (ver seed-taxonomy-es.js). */
const fs = require('fs');
const path = require('path');
const U = require('./util');
const ES = require('./seed-taxonomy-es');

const KINDS = ['nanda', 'noc', 'nic'];
const TIPOS = ['real', 'riesgo', 'promocion'], WHO = ['both', 'nurse', 'aux'];

function loadCa() { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'seed-taxonomy-ca.json'), 'utf8')); } catch (_) { return {}; } }
const itemsKey = (kind) => (kind === 'nanda' ? ['rc', 'mp'] : kind === 'noc' ? ['ind'] : ['act']);

function seedTaxonomy(db) {
  if (db.getSetting('tax_seed_v1')) return;
  const CA = loadCa(), now = new Date().toISOString(); let ord = 0;
  const ins = (kind, e) => {
    const c = CA[e.slug] || {}, items = (src) => Object.fromEntries(itemsKey(kind).map((k) => [k, src[k] || e[k] || []]));
    db.run('INSERT OR IGNORE INTO taxonomy (kind, slug, code, es, ca, hint_es, hint_ca, items_es, items_ca, links, tipo, who, ord, created) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      kind, e.slug, '', e.es, c.ca || e.es, e.hint || '', c.hint || e.hint || '', JSON.stringify(items(e)), JSON.stringify(items(c)), JSON.stringify({ noc: e.noc || [], nic: e.nic || [] }), e.tipo || '', e.who || '', ++ord, now);
  };
  db.tx(() => { ES.DX.forEach((e) => ins('nanda', e)); ES.NOC.forEach((e) => ins('noc', e)); ES.NIC.forEach((e) => ins('nic', e)); db.setSetting('tax_seed_v1', '1'); });
}

const out = (r) => ({ id: r.id, kind: r.kind, slug: r.slug, code: r.code, es: r.es, ca: r.ca, hint_es: r.hint_es, hint_ca: r.hint_ca, items_es: JSON.parse(r.items_es || '{}'), items_ca: JSON.parse(r.items_ca || '{}'), links: JSON.parse(r.links || '{}'), tipo: r.tipo, who: r.who, active: !!r.active, custom: !!r.custom });

const list = (v, n, max) => (Array.isArray(v) ? v : String(v || '').split('\n')).map((x) => U.clip(x, max || 200)).filter(Boolean).slice(0, n || 15);
/* Valida el cuerpo de una entrada (alta o edición). */
function fields(kind, b, slugs) {
  const es = U.clip(b.es, 200); if (es.length < 2) return { error: 'es' };
  const ca = U.clip(b.ca, 200) || es, keys = itemsKey(kind);
  const ie = {}, ic = {}; keys.forEach((k) => { ie[k] = list((b.items_es || {})[k]); ic[k] = list((b.items_ca || {})[k]); if (!ic[k].length) ic[k] = ie[k]; });
  const lk = b.links && typeof b.links === 'object' ? b.links : {};
  const links = kind === 'nanda' ? { noc: list(lk.noc, 12, 80).filter((s) => slugs.noc.has(s)), nic: list(lk.nic, 16, 80).filter((s) => slugs.nic.has(s)) } : {};
  return { v: { code: U.clip(b.code, 20), es, ca, hint_es: U.clipML(b.hint_es, 600), hint_ca: U.clipML(b.hint_ca, 600) || U.clipML(b.hint_es, 600), items_es: ie, items_ca: ic, links, tipo: kind === 'nanda' && TIPOS.includes(b.tipo) ? b.tipo : kind === 'nanda' ? 'real' : '', who: kind === 'nic' && WHO.includes(b.who) ? b.who : kind === 'nic' ? 'both' : '' } };
}

/* CSV propio de importación/exportación: tipo;codigo;es;ca;elementos;elementos_mp  (elementos separados por « | »; para diagnósticos: r/c y m/p) */
function parseCsvLine(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ';' || c === '\t') { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur); return out.map((x) => x.trim());
}
const csvCell = (v) => { let s = String(v == null ? '' : v); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

module.exports = { KINDS, TIPOS, WHO, seedTaxonomy, out, fields, itemsKey, list, parseCsvLine, csvCell };
