'use strict';
const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const fs = require('fs');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'hc4-')); process.env.SSO_SECRET = 'secreto-de-prueba'; process.env.ADMIN_PASSWORD = 'clave-admin-larga';
global.window = {}; require('../public/ayuda-data.js'); const H = global.window.HC_HELP;
const { server } = require('../server');
let base;
test.before(async () => { await new Promise((r) => server.listen(0, r)); base = 'http://127.0.0.1:' + server.address().port; });
test.after(() => { server.close(); });

test('ayuda: las dos guías existen en los dos idiomas con la misma estructura', () => {
  for (const a of ['student', 'teacher']) {
    const es = H.es[a].sections, ca = H.ca[a].sections;
    assert.ok(es.length >= 8, a + ' tiene contenido'); assert.strictEqual(es.length, ca.length, a + ': mismo número de secciones');
    es.forEach((s, i) => {
      assert.strictEqual(s[1].length, ca[i][1].length, a + ' sección ' + (i + 1) + ': mismos bloques');
      s[1].forEach((b, k) => assert.strictEqual(b[0], ca[i][1][k][0], a + ' ' + (i + 1) + '.' + k + ': mismo tipo de bloque'));
      assert.match(s[0], /^\d+ · /); assert.match(ca[i][0], /^\d+ · /);
    });
    assert.ok(H.es[a].title && H.ca[a].title && H.es[a].subtitle && H.ca[a].subtitle);
  }
  for (const L of ['es', 'ca']) for (const k of ['tip', 'warn', 'print', 'student', 'teacher', 'toc']) assert.ok(H[L].ui[k], L + ' ui.' + k);
});

test('ayuda: ninguna sección está vacía ni tiene textos a medio traducir', () => {
  for (const L of ['es', 'ca']) for (const a of ['student', 'teacher']) for (const [title, blocks] of H[L][a].sections) {
    assert.ok(blocks.length > 0, title);
    for (const b of blocks) {
      assert.ok(['lead', 'h2', 'p', 'img', 'leg', 'box', 'flow', 'faq'].includes(b[0]), 'bloque desconocido ' + b[0]);
      const txt = JSON.stringify(b); assert.ok(!/TODO|XXX|undefined/.test(txt), title);
    }
  }
  /* el catalán no debe llevar las marcas típicas del castellano en los títulos */
  assert.ok(!H.ca.teacher.sections.some((s) => /Visión|Alumnado|Clasificar/.test(s[0])));
});

test('ayuda: todas las capturas referenciadas existen y se sirven', async () => {
  const names = new Set();
  for (const a of ['student', 'teacher']) H.es[a].sections.forEach((s) => s[1].forEach((b) => { if (b[0] === 'img') names.add(b[1]); }));
  assert.ok(names.size >= 8, 'hay capturas');
  for (const L of ['es', 'ca']) for (const n of names) {
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'public', 'ayuda', L, n + '.jpg')), L + '/' + n);
    const r = await fetch(base + '/ayuda/' + L + '/' + n + '.jpg'); assert.strictEqual(r.status, 200, L + '/' + n); assert.strictEqual(r.headers.get('content-type'), 'image/jpeg');
  }
  assert.strictEqual((await fetch(base + '/ayuda-data.js')).status, 200); assert.strictEqual((await fetch(base + '/ayuda.js')).status, 200);
});
