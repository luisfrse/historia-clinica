'use strict';
/* Autenticador WebAuthn por software (solo pruebas): genera credenciales y las firma como lo haria un navegador con huella.
   Permite probar el servidor de llaves de acceso de punta a punta sin navegador. Algoritmos: es256 (por defecto), ed25519 y rs256.
   Mismo patron que el del Campus (campus/test/helpers/soft-authenticator.js), con el userHandle configurable. */
const crypto = require('node:crypto');

const b64u = (b) => Buffer.from(b).toString('base64url');
function cbor(v) {
  const head = (major, n) => (n < 24 ? Buffer.from([(major << 5) | n]) : n < 256 ? Buffer.from([(major << 5) | 24, n]) : Buffer.from([(major << 5) | 25, n >> 8, n & 255]));
  if (Buffer.isBuffer(v)) return Buffer.concat([head(2, v.length), v]);
  if (typeof v === 'string') { const b = Buffer.from(v); return Buffer.concat([head(3, b.length), b]); }
  if (typeof v === 'number') return v >= 0 ? head(0, v) : head(1, -1 - v);
  if (v instanceof Map) return Buffer.concat([head(5, v.size), ...[...v].flatMap(([k, x]) => [cbor(k), cbor(x)])]);
  throw new Error('cbor: tipo no admitido');
}

class SoftKey {
  constructor(rpId, origin, { alg = 'es256', userHandle = 'x' } = {}) {
    this.rpId = rpId; this.origin = origin; this.counter = 0; this.alg = alg; this.userHandle = userHandle;
    this.id = crypto.randomBytes(32); this.idB64 = b64u(this.id);
    const kp = alg === 'ed25519' ? crypto.generateKeyPairSync('ed25519') : alg === 'rs256' ? crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }) : crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
    this.priv = kp.privateKey; this.jwk = kp.publicKey.export({ format: 'jwk' });
  }
  rpHash() { return crypto.createHash('sha256').update(this.rpId).digest(); }
  clientData(type, challenge) { return Buffer.from(JSON.stringify({ type, challenge, origin: this.origin, crossOrigin: false })); }
  cose() {
    const d = (k) => Buffer.from(this.jwk[k], 'base64url');
    if (this.alg === 'ed25519') return cbor(new Map([[1, 1], [3, -8], [-1, 6], [-2, d('x')]]));
    if (this.alg === 'rs256') return cbor(new Map([[1, 3], [3, -257], [-1, d('n')], [-2, d('e')]]));
    return cbor(new Map([[1, 2], [3, -7], [-1, 1], [-2, d('x')], [-3, d('y')]]));
  }
  /* respuesta a navigator.credentials.create(); rk = lo que informaria credProps (undefined = no lo dice); uv = bandera de verificacion de usuario */
  create(options, { rk = true, uv = true, rpId } = {}) {
    const len = Buffer.alloc(2); len.writeUInt16BE(this.id.length);
    const rpHash = rpId ? crypto.createHash('sha256').update(rpId).digest() : this.rpHash();
    const authData = Buffer.concat([rpHash, Buffer.from([uv ? 0x45 : 0x41]), Buffer.alloc(4), Buffer.alloc(16), len, this.id, this.cose()]);
    const att = cbor(new Map([['fmt', 'none'], ['attStmt', new Map()], ['authData', authData]]));
    return { id: this.idB64, rawId: this.idB64, type: 'public-key', authenticatorAttachment: 'platform',
      clientExtensionResults: rk === undefined ? {} : { credProps: { rk } },
      response: { clientDataJSON: b64u(this.clientData('webauthn.create', options.challenge)), attestationObject: b64u(att), transports: ['internal'] } };
  }
  /* respuesta a navigator.credentials.get() */
  get(options, { uv = true, counter, handle } = {}) {
    const cd = this.clientData('webauthn.get', options.challenge), ctr = Buffer.alloc(4); ctr.writeUInt32BE(counter !== undefined ? counter : ++this.counter);
    const authData = Buffer.concat([this.rpHash(), Buffer.from([uv ? 0x05 : 0x01]), ctr]);
    const data = Buffer.concat([authData, crypto.createHash('sha256').update(cd).digest()]);
    const sig = this.alg === 'ed25519' ? crypto.sign(null, data, this.priv) : crypto.sign('sha256', data, this.priv);
    return { id: this.idB64, rawId: this.idB64, type: 'public-key', authenticatorAttachment: 'platform', clientExtensionResults: {},
      response: { authenticatorData: b64u(authData), clientDataJSON: b64u(cd), signature: b64u(sig), userHandle: b64u(handle !== undefined ? handle : this.userHandle) } };
  }
}
module.exports = { SoftKey };
