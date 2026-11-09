'use strict';
const crypto = require('crypto');
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const eq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const clip = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const clipML = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, n);
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 120;
const normName = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
/* Fecha/hora local de Madrid "YYYY-MM-DDTHH:MM" */
function nowLocal() { return new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).replace(' ', 'T').slice(0, 16); }
const validLocal = (s) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) && !isNaN(Date.parse(s + ':00Z'));
const validDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'));
function limiter(max, ms) {
  const m = new Map();
  return {
    blocked(k) { const e = m.get(k); if (!e) return false; if (Date.now() - e.t > ms) { m.delete(k); return false; } return e.n >= max; },
    fail(k) { if (m.size > 20000) m.clear(); const e = m.get(k); if (!e || Date.now() - e.t > ms) m.set(k, { n: 1, t: Date.now() }); else e.n++; },
    ok(k) { m.delete(k); },
  };
}
module.exports = { sha, eq, clip, clipML, validEmail, normName, nowLocal, validLocal, validDate, limiter };
