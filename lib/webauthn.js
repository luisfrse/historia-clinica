'use strict';
/* WebAuthn mínimo, sin dependencias (solo node:crypto): verifica el registro y la entrada con llave de acceso (huella, cara, PIN del dispositivo, llave física).
   Esta app no tiene dependencias de terceros, así que la verificación vive aquí en vez de traer una librería. Alcance deliberado:
   - Algoritmos: ES256 (P-256), EdDSA (Ed25519) y RS256, los tres que piden las opciones del servidor.
   - Atestación «none»: se pide sin atestación y se ignora attStmt (no se confía en el fabricante, solo se guarda la clave pública).
   - Se exige presencia (UP) y verificación de usuario (UV) en CADA firma, el origen exacto, el rpId y el reto que dio el servidor. */
const crypto = require('crypto');

/* ---- CBOR (solo lo que usan attestationObject y la clave COSE) ---- */
function cborAt(buf, off, depth) {
  if (depth > 6 || off >= buf.length) throw new Error('cbor');
  const ib = buf[off++], major = ib >> 5, ai = ib & 31;
  let n;
  if (ai < 24) n = ai;
  else if (ai === 24) { n = buf[off]; off += 1; }
  else if (ai === 25) { n = buf.readUInt16BE(off); off += 2; }
  else if (ai === 26) { n = buf.readUInt32BE(off); off += 4; }
  else if (ai === 27) { n = Number(buf.readBigUInt64BE(off)); off += 8; if (!Number.isSafeInteger(n)) throw new Error('cbor'); }
  else throw new Error('cbor');
  if (major === 0) return [n, off];
  if (major === 1) return [-1 - n, off];
  if (major === 2 || major === 3) {
    if (off + n > buf.length) throw new Error('cbor');
    const b = buf.subarray(off, off + n); return [major === 2 ? Buffer.from(b) : b.toString('utf8'), off + n];
  }
  if (major === 4) { const a = []; if (n > 64) throw new Error('cbor'); for (let i = 0; i < n; i++) { const [v, o] = cborAt(buf, off, depth + 1); a.push(v); off = o; } return [a, off]; }
  if (major === 5) { const m = new Map(); if (n > 64) throw new Error('cbor'); for (let i = 0; i < n; i++) { const [k, o1] = cborAt(buf, off, depth + 1); const [v, o2] = cborAt(buf, o1, depth + 1); m.set(k, v); off = o2; } return [m, off]; }
  if (major === 7) { if (ai === 20) return [false, off]; if (ai === 21) return [true, off]; if (ai === 22) return [null, off]; }
  throw new Error('cbor');
}
const cborDecode = (buf, off = 0) => cborAt(buf, off, 0);

/* ---- clave pública COSE -> SPKI DER (es lo que se guarda) ---- */
function coseToSpki(cose) {
  if (!(cose instanceof Map)) throw new Error('cose');
  const kty = cose.get(1), alg = cose.get(3);
  let jwk;
  if (kty === 2 && alg === -7 && cose.get(-1) === 1) jwk = { kty: 'EC', crv: 'P-256', x: cose.get(-2).toString('base64url'), y: cose.get(-3).toString('base64url') };
  else if (kty === 1 && alg === -8 && cose.get(-1) === 6) jwk = { kty: 'OKP', crv: 'Ed25519', x: cose.get(-2).toString('base64url') };
  else if (kty === 3 && alg === -257) jwk = { kty: 'RSA', n: cose.get(-1).toString('base64url'), e: cose.get(-2).toString('base64url') };
  else throw new Error('alg');
  return crypto.createPublicKey({ key: jwk, format: 'jwk' }).export({ type: 'spki', format: 'der' });
}

/* ---- datos del autenticador ---- */
function parseAuthData(ad, needCred) {
  if (!Buffer.isBuffer(ad) || ad.length < 37) throw new Error('authData');
  const out = { rpIdHash: ad.subarray(0, 32), flags: ad[32], counter: ad.readUInt32BE(33) };
  out.up = !!(out.flags & 0x01); out.uv = !!(out.flags & 0x04); out.at = !!(out.flags & 0x40);
  if (needCred) {
    if (!out.at || ad.length < 55) throw new Error('credencial');
    const len = ad.readUInt16BE(53);
    if (len < 1 || len > 1023 || ad.length < 55 + len) throw new Error('credencial');
    out.credId = ad.subarray(55, 55 + len);
    out.cose = cborDecode(ad, 55 + len)[0];
  }
  return out;
}

function clientData(raw, type, challenge, origin) {
  let cd; try { cd = JSON.parse(Buffer.from(String(raw), 'base64url').toString('utf8')); } catch (_) { throw new Error('clientData'); }
  if (!cd || cd.type !== type) throw new Error('tipo');
  if (typeof cd.challenge !== 'string' || cd.challenge !== challenge) throw new Error('reto');
  if (cd.origin !== origin) throw new Error('origen');
  if (cd.crossOrigin === true) throw new Error('crossOrigin');
  return cd;
}
const rpHash = (rpId) => crypto.createHash('sha256').update(rpId).digest();
const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(a, b);

/* credential = lo que manda el navegador (JSON con base64url). Devuelve { id, publicKey (SPKI DER), counter, transports }. Lanza Error si algo no cuadra. */
function verifyRegistration({ credential, challenge, origin, rpId }) {
  const r = credential && credential.response; if (!r || credential.type !== 'public-key') throw new Error('credencial');
  clientData(r.clientDataJSON, 'webauthn.create', challenge, origin);
  const att = cborDecode(Buffer.from(String(r.attestationObject), 'base64url'))[0];
  if (!(att instanceof Map) || !Buffer.isBuffer(att.get('authData'))) throw new Error('attestation');
  const ad = parseAuthData(att.get('authData'), true);
  if (!same(ad.rpIdHash, rpHash(rpId))) throw new Error('rpId');
  if (!ad.up || !ad.uv) throw new Error('uv');
  const id = ad.credId.toString('base64url');
  if (credential.id !== id || (credential.rawId && credential.rawId !== id)) throw new Error('id');
  const transports = Array.isArray(r.transports) ? r.transports.filter((t) => typeof t === 'string').slice(0, 8) : [];
  return { id, publicKey: coseToSpki(ad.cose), counter: ad.counter, transports };
}

/* key = { publicKey: SPKI DER, counter }. Devuelve { counter, userHandle }. */
function verifyAssertion({ credential, challenge, origin, rpId, key }) {
  const r = credential && credential.response; if (!r || credential.type !== 'public-key') throw new Error('credencial');
  clientData(r.clientDataJSON, 'webauthn.get', challenge, origin);
  const adRaw = Buffer.from(String(r.authenticatorData), 'base64url'), ad = parseAuthData(adRaw, false);
  if (!same(ad.rpIdHash, rpHash(rpId))) throw new Error('rpId');
  if (!ad.up || !ad.uv) throw new Error('uv');
  const pub = crypto.createPublicKey({ key: Buffer.from(key.publicKey), format: 'der', type: 'spki' });
  const signed = Buffer.concat([adRaw, crypto.createHash('sha256').update(Buffer.from(String(r.clientDataJSON), 'base64url')).digest()]);
  const sig = Buffer.from(String(r.signature), 'base64url'), t = pub.asymmetricKeyType;
  const ok = t === 'ed25519' ? crypto.verify(null, signed, pub, sig) : crypto.verify('sha256', signed, pub, sig);
  if (!ok) throw new Error('firma');
  /* contador: si algún lado lo usa, tiene que avanzar (un autenticador clonado lo repetiría). Los de plataforma que siempre mandan 0 se aceptan. */
  if ((ad.counter || key.counter) && ad.counter <= key.counter) throw new Error('contador');
  return { counter: ad.counter, userHandle: r.userHandle ? Buffer.from(String(r.userHandle), 'base64url') : null };
}

/* ---- dominio de las llaves (rpID) y origen ----
   Producción: la dirección pública SIEMPRE https y un dominio real; si no, las llaves se DESACTIVAN con un motivo claro (la contraseña sigue entrando).
   Desarrollo y pruebas: BASE_URL si está y, si no, la cabecera Host. */
function rpConfig(env, prod, defaultUrl) {
  const raw = String((env && env.BASE_URL) || '').trim() || (prod ? String(defaultUrl || '') : '');
  if (!raw) return { fixed: null, off: null, raw };
  try {
    const u = new URL(raw);
    if (prod && u.protocol !== 'https:') return { fixed: null, off: 'https', raw };
    if (prod && /^(localhost|127\.|\[?::1)/.test(u.hostname)) return { fixed: null, off: 'dominio', raw };
    return { fixed: { id: u.hostname, origin: u.origin }, off: null, raw };
  } catch (_) { return { fixed: null, off: 'direccion', raw }; }
}

module.exports = { cborDecode, coseToSpki, parseAuthData, verifyRegistration, verifyAssertion, rpConfig };
