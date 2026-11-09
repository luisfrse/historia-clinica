'use strict';
/* Token de acceso único firmado por el Campus: base64url(JSON) + "." + HMAC-SHA256(secreto).
   Lo emite el Campus (GET /sso/historia), caduca en 60 s y se acepta una sola vez (jti). */
const crypto = require('crypto');

function sign(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return body + '.' + crypto.createHmac('sha256', secret).update(body).digest('base64url');
}
function verify(token, secret, now) {
  if (!secret || typeof token !== 'string' || token.length > 4000) return null;
  const i = token.indexOf('.'); if (i < 1) return null;
  const body = token.slice(0, i), mac = token.slice(i + 1);
  const good = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(mac), b = Buffer.from(good);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let p; try { p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch (_) { return null; }
  const t = now == null ? Date.now() : now;
  if (!p || typeof p !== 'object' || !p.jti || !(p.exp > t) || !(p.iat <= t + 5000) || p.exp - p.iat > 120e3) return null;
  return p;
}
module.exports = { sign, verify };
