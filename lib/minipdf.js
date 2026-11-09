'use strict';
/* Generador mínimo de PDF (solo texto, Helvetica estándar, A4). Sin dependencias.
   Caracteres fuera de Latin-1 se sustituyen (— → -, comillas tipográficas, etc.). */
const MAP = { '—': '-', '–': '-', '‘': "'", '’': "'", '“': '"', '”': '"', '…': '...', '•': '-', '→': '->', '≥': '>=', '≤': '<=', '✓': 'OK', '✗': 'X', '€': 'EUR', ' ': ' ', 'ŀ': 'l·', 'Ŀ': 'L·' };
const clean = (t) => String(t == null ? '' : t).replace(/[^\x20-\x7e\xa0-\xff\n]/g, (c) => MAP[c] || (c === '\t' ? ' ' : '?')).replace(/\r/g, '');
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
// anchuras Helvetica (aprox. por carácter, en milésimas); suficiente para ajustar líneas
const W = { ' ': 278, i: 222, j: 222, l: 222, t: 278, f: 278, r: 333, I: 278, '.': 278, ',': 278, ':': 278, ';': 278, '|': 260, '!': 278, "'": 191, '(': 333, ')': 333, '-': 333, m: 833, w: 722, M: 833, W: 944, '/': 278 };
const cw = (c, bold) => (W[c] || (c >= 'A' && c <= 'Z' ? 667 : c >= '0' && c <= '9' ? 556 : 556)) * (bold ? 1.06 : 1);
const tw = (s, size, bold) => { let w = 0; for (const c of s) w += cw(c, bold); return w * size / 1000; };

function wrap(text, size, bold, maxw) {
  const out = [];
  for (const para of clean(text).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const cand = line ? line + ' ' + word : word;
      if (tw(cand, size, bold) <= maxw) line = cand;
      else { if (line) out.push(line); let w = word; while (tw(w, size, bold) > maxw && w.length > 1) { let k = w.length - 1; while (k > 1 && tw(w.slice(0, k), size, bold) > maxw) k--; out.push(w.slice(0, k)); w = w.slice(k); } line = w; }
    }
    out.push(line);
  }
  return out;
}

class Doc {
  constructor(title, opts = {}) { this.title = clean(title); this.pages = []; this.sizes = []; this.pageWord = opts.pageWord || 'Pag.'; this.landscape = !!opts.landscape; this.M = opts.margin || 54; this.imgs = []; this.newPage(); }
  newPage() { this.W = this.landscape ? 841.89 : 595.28; this.H = this.landscape ? 595.28 : 841.89; this.cur = []; this.pages.push(this.cur); this.sizes.push([this.W, this.H, this.M]); this.y = this.H - this.M; }
  /* imagen JPEG (RGB/gris) en la posición indicada (origen abajo-izquierda) */
  image(buf, x, y, w, h) {
    let off = 2, iw = 0, ih = 0, nc = 3;
    while (off < buf.length - 9) { if (buf[off] !== 0xff) { off++; continue; } const m = buf[off + 1]; if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) { ih = buf.readUInt16BE(off + 5); iw = buf.readUInt16BE(off + 7); nc = buf[off + 9]; break; } off += 2 + buf.readUInt16BE(off + 2); }
    if (!iw || !ih) return false;
    this.imgs.push({ buf, w: iw, h: ih, nc }); const n = this.imgs.length - 1;
    this.cur.push('q ' + w.toFixed(2) + ' 0 0 ' + h.toFixed(2) + ' ' + x.toFixed(2) + ' ' + y.toFixed(2) + ' cm /Im' + n + ' Do Q'); return true;
  }
  /* cambia a página nueva con otra orientación/márgenes */
  section({ landscape = false, margin } = {}) { this.landscape = landscape; if (margin) this.M = margin; this.newPage(); }
  rect(x, y, w, h, { fill, stroke, lw = 0.5 } = {}) { this.cur.push((fill ? fill + ' rg ' : '') + (stroke ? stroke + ' RG ' + lw + ' w ' : '') + x.toFixed(2) + ' ' + y.toFixed(2) + ' ' + w.toFixed(2) + ' ' + h.toFixed(2) + ' re ' + (fill && stroke ? 'B' : fill ? 'f' : 'S')); }
  at(x, y, t, { size = 8, bold = false, color = '0 0 0', align = 'l' } = {}) { t = clean(t).replace(/\n/g, ' '); const w = tw(t, size, bold); const xx = align === 'r' ? x - w : align === 'c' ? x - w / 2 : x; this.cur.push(color + ' rg BT /' + (bold ? 'F2' : 'F1') + ' ' + size + ' Tf ' + xx.toFixed(2) + ' ' + y.toFixed(2) + ' Td (' + esc(t) + ') Tj ET'); }
  fit(t, size, bold, maxw) { t = clean(t).replace(/\n/g, ' '); if (tw(t, size, bold) <= maxw) return t; while (t.length > 1 && tw(t + '...', size, bold) > maxw) t = t.slice(0, -1); return t + '...'; }
  /* tabla: cols = [{ w, label, align }], rows = array de arrays de texto; opts.color(ci, v, ri) -> 'r g b' o undefined; opts.bold(ci, v, ri) */
  table(cols, rows, { size = 7.5, head = 6.8, rowH = 12.5, color, bold } = {}) {
    const x0 = this.M; const hl = cols.map((c) => wrap(c.label || '', head, true, c.w - 4)); const hh = Math.max(...hl.map((l) => l.length), 1) * (head * 1.25) + 5;
    const drawHead = () => { this.ensure(hh + rowH * 2); let x = x0; this.rect(x0, this.y - hh, cols.reduce((a, c) => a + c.w, 0), hh, { fill: '0.91 0.89 0.96' });
      cols.forEach((c, i) => { hl[i].forEach((ln, k) => this.at(c.align === 'r' ? x + c.w - 2 : x + 2, this.y - 2 - head * 1.15 * (k + 1), ln, { size: head, bold: true, color: '0.2 0.12 0.4', align: c.align === 'r' ? 'r' : 'l' })); x += c.w; }); this.y -= hh; };
    drawHead();
    rows.forEach((r, ri) => { if (this.y - rowH < this.M + 14) { this.newPage(); drawHead(); }
      if (ri % 2) this.rect(x0, this.y - rowH, cols.reduce((a, c) => a + c.w, 0), rowH, { fill: '0.97 0.97 0.98' });
      let x = x0; cols.forEach((c, i) => { const v = r[i] == null ? '' : String(r[i]); const col = (color && color(i, v, ri)) || '0 0 0'; const b = !!(bold && bold(i, v, ri)); this.at(c.align === 'r' ? x + c.w - 2 : x + 2, this.y - rowH + 3.6, this.fit(v, size, b, c.w - 4), { size, bold: b, color: col, align: c.align === 'r' ? 'r' : 'l' }); x += c.w; }); this.y -= rowH; });
    this.y -= 6;
  }
  ensure(h) { if (this.y - h < this.M + 14) this.newPage(); }
  text(t, { size = 10, bold = false, indent = 0, gap = 3, color } = {}) {
    const lead = size * 1.32;
    for (const ln of wrap(t, size, bold, this.W - 2 * this.M - indent)) {
      this.ensure(lead); this.y -= lead;
      this.cur.push((color ? color + ' rg ' : '0 g ') + 'BT /' + (bold ? 'F2' : 'F1') + ' ' + size + ' Tf ' + (this.M + indent).toFixed(2) + ' ' + this.y.toFixed(2) + ' Td (' + esc(ln) + ') Tj ET');
    }
    this.y -= gap;
  }
  h1(t) { this.text(t, { size: 17, bold: true, color: '0.36 0.23 0.60', gap: 6 }); }
  h2(t) { this.y -= 6; this.ensure(40); this.text(t, { size: 12, bold: true, color: '0.36 0.23 0.60', gap: 4 }); }
  line() { this.ensure(6); this.cur.push('0.8 G 0.5 w ' + this.M + ' ' + (this.y - 2).toFixed(2) + ' m ' + (this.W - this.M) + ' ' + (this.y - 2).toFixed(2) + ' l S'); this.y -= 6; }
  build() {
    const objs = []; const add = (s) => { objs.push(s); return objs.length; };
    add('<< /Type /Catalog /Pages 2 0 R >>'); add('PAGES'); add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'); add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const imgIds = this.imgs.map((im) => add(im)); const xo = imgIds.length ? ' /XObject << ' + imgIds.map((id, i) => '/Im' + i + ' ' + id + ' 0 R').join(' ') + ' >>' : '';
    const kids = [];
    this.pages.forEach((ops, i) => {
      const [PW, PH, PM] = this.sizes[i];
      ops = ops.concat(['0.5 g BT /F1 8 Tf ' + PM + ' 30 Td (' + esc(this.title) + ') Tj ET', '0.5 g BT /F1 8 Tf ' + (PW - PM - 40) + ' 30 Td (' + esc(this.pageWord) + ' ' + (i + 1) + '/' + this.pages.length + ') Tj ET']);
      const stream = ops.join('\n'); const c = add('STREAM:' + stream); const p = add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>' + xo + ' >> /Contents ' + c + ' 0 R >>'); kids.push(p + ' 0 R');
    });
    objs[1] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + kids.length + ' >>';
    const parts = [Buffer.from('%PDF-1.4\n%âãÏÓ\n', 'latin1')]; const offs = []; let pos = parts[0].length;
    objs.forEach((o, i) => {
      let b; if (typeof o !== 'string') b = Buffer.concat([Buffer.from((i + 1) + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + o.w + ' /Height ' + o.h + ' /ColorSpace /' + (o.nc === 1 ? 'DeviceGray' : o.nc === 4 ? 'DeviceCMYK' : 'DeviceRGB') + ' /BitsPerComponent 8 /Filter /DCTDecode /Length ' + o.buf.length + ' >>\nstream\n', 'latin1'), o.buf, Buffer.from('\nendstream\nendobj\n', 'latin1')]);
      else if (o.startsWith('STREAM:')) { const data = Buffer.from(o.slice(7), 'latin1'); b = Buffer.concat([Buffer.from((i + 1) + ' 0 obj\n<< /Length ' + data.length + ' >>\nstream\n', 'latin1'), data, Buffer.from('\nendstream\nendobj\n', 'latin1')]); }
      else b = Buffer.from((i + 1) + ' 0 obj\n' + o + '\nendobj\n', 'latin1');
      offs.push(pos); pos += b.length; parts.push(b);
    });
    let x = 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('');
    x += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + pos + '\n%%EOF';
    parts.push(Buffer.from(x, 'latin1')); return Buffer.concat(parts);
  }
}
module.exports = { Doc, clean };
