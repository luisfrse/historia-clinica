'use strict';
/* Huellas y llaves de acceso (WebAuthn / passkeys) para el PROFESORADO y la administración: huella o cara en el móvil, Windows Hello, llaves físicas.
   El alumnado NO usa llaves: entra desde el Campus y solo puede haber llaves de cuentas con rol teacher o admin.
   Es un camino de entrada ADEMÁS de la contraseña: la contraseña (y el acceso por el Campus) siguen funcionando siempre y no dependen de este fichero;
   si las llaves se desactivan por configuración, se entra igual con la contraseña. Una llave con verificación de usuario (huella, cara o PIN del dispositivo)
   ya es un segundo factor en sí misma.
   La verificación criptográfica está en lib/webauthn.js (sin dependencias).

   Contrato «v2» compartido con el resto de apps (diseno-comun/entrada/passkey.js), base /api/passkeys:
     GET  /state (público)               -> { enabled, reason, keys }
     POST /login/options {}              -> { options, chal }        404 nokeys si no hay ninguna llave · 503 disabled
     POST /login/verify { chal, credential } -> { ok, id } y abre la sesión
     POST /register/options {} (sesión de profesorado/administración) -> { options, chal }
     POST /register/verify { chal, name, credential } -> { ok, id }
     POST /check/options y /check/verify (sesión) -> como login, SIN abrir otra sesión (prueba del asistente «Añadir este dispositivo»)
     GET  /list (sesión)                 -> { passkeys:[{ id, name, created, last_used, discoverable }], enabled, reason }   (solo las de quien pregunta)
     POST /remove { id, confirm? } (sesión) -> 409 last si es la última y falta confirm:true
   Cada ficha de reto (chal) es de un solo uso y caduca a los 5 minutos: dos ceremonias a la vez no se pisan. */
const crypto = require('crypto');
const W = require('./webauthn');

module.exports = function passkeys(X) {
  const { R, db, json, readJson, audit, newSession, setCookie, ipOf, limLogin, isStaff, SESSION_TTL } = X;
  const PROD = process.env.NODE_ENV === 'production';
  const TTL = !PROD && Number(process.env.PASSKEY_CHAL_TTL_MS) > 0 ? Number(process.env.PASSKEY_CHAL_TTL_MS) : 5 * 60e3;   /* SOLO PRUEBAS: acorta la caducidad; en producción se ignora */
  const challenges = new Map();   // ficha -> { challenge, kind, uid, exp }

  const cfg = W.rpConfig(process.env, PROD, X.PUBLIC_URL);
  if (cfg.off) console.warn('[huellas] desactivadas: BASE_URL (' + cfg.raw + ') no sirve para llaves de acceso (motivo: ' + cfg.off + '). Debe ser la dirección https de Historia clínica. La contraseña sigue funcionando.');
  const enabled = () => !cfg.off;
  function rp(req) {
    if (cfg.fixed) return cfg.fixed;
    const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || 'http', host = String(req.headers.host || '');
    return { id: host.replace(/:\d+$/, ''), origin: proto + '://' + host };
  }
  const refuse = (res) => json(res, 503, { error: 'disabled', reason: cfg.off });

  function put(challenge, kind, uid) {
    const t = crypto.randomBytes(18).toString('base64url'), now = Date.now();
    for (const [k, v] of challenges) if (v.exp < now) challenges.delete(k);
    if (challenges.size > 500) challenges.delete(challenges.keys().next().value);
    challenges.set(t, { challenge, kind, uid: uid || 0, exp: now + TTL }); return t;
  }
  function take(t, kind, uid) {
    const c = typeof t === 'string' ? challenges.get(t) : null; if (c) challenges.delete(t);
    return c && c.kind === kind && c.exp > Date.now() && (!c.uid || c.uid === uid) ? c.challenge : null;
  }
  const newChallenge = () => crypto.randomBytes(32).toString('base64url');
  const count = () => db.get('SELECT COUNT(*) n FROM staff_passkeys').n;
  const countOf = (uid) => db.get('SELECT COUNT(*) n FROM staff_passkeys WHERE user_id = ?', uid).n;
  const creds = (rows) => rows.map((c) => ({ id: c.id, type: 'public-key', transports: JSON.parse(c.transports || '[]') }));
  /* quien gestiona llaves: una cuenta real de profesorado o administración (nunca la vista previa «como alumno») */
  const owner = (ctx) => (ctx.user && !ctx.user._preview && isStaff(ctx.user) ? ctx.user : null);

  /* ---- estado público: la pantalla de entrada lo necesita para saber qué enseñar ---- */
  R('GET', '/api/passkeys/state', async (req, res) => json(res, 200, { enabled: enabled(), reason: cfg.off, keys: enabled() && count() > 0 }), { open: true });

  /* ---- entrar con huella (público) y comprobar (con sesión, sin abrir otra) ---- */
  async function authOptions(req, res, ctx, kind) {
    if (!enabled()) return refuse(res);
    if (kind === 'auth' && limLogin.blocked(ipOf(req))) return json(res, 429, { error: 'rate', wait: limLogin.wait(ipOf(req)) });
    const me = kind === 'check' ? owner(ctx) : null;
    if (kind === 'check' && !me) return json(res, 403, { error: 'forbidden' });
    if (!(kind === 'check' ? countOf(me.id) : count())) return json(res, 404, { error: 'nokeys' });
    /* Sin lista de credenciales: la llave es descubrible y el navegador la ofrece sin escribir nada. La comprobación del asistente tampoco lleva lista:
       justo prueba que la llave nueva se descubre. */
    const options = { challenge: newChallenge(), rpId: rp(req).id, timeout: 60000, userVerification: 'required' };
    json(res, 200, { options, chal: put(options.challenge, kind, me && me.id) });
  }
  R('POST', '/api/passkeys/login/options', (req, res, ctx) => authOptions(req, res, ctx, 'auth'), { open: true });
  R('POST', '/api/passkeys/check/options', (req, res, ctx) => authOptions(req, res, ctx, 'check'), { staff: true });

  async function authVerify(req, res, ctx, kind) {
    if (!enabled()) return refuse(res);
    const ip = ipOf(req), login = kind === 'auth';
    if (login && limLogin.blocked(ip)) return json(res, 429, { error: 'rate', wait: limLogin.wait(ip) });
    const me = login ? null : owner(ctx); if (!login && !me) return json(res, 403, { error: 'forbidden' });
    const b = await readJson(req, 20e3) || {}, cred = b.credential, expected = take(b.chal, kind, me && me.id);
    const fail = async (why, code) => {
      if (login && why !== 'challenge') { limLogin.fail(ip); await new Promise((r) => setTimeout(r, 300)); }
      audit(login ? '?' : me.email, login ? 'login-huella-fallo' : 'huella-prueba-fallo', ip + ' ' + why);
      return json(res, 401, { error: code || 'bad', left: login ? limLogin.left(ip) : undefined });
    };
    if (!expected) return fail('challenge', 'challenge');
    const row = cred && typeof cred.id === 'string' && cred.id.length < 400 ? db.get('SELECT * FROM staff_passkeys WHERE id = ?', cred.id) : null;
    if (!row || (me && row.user_id !== me.id)) return fail('unknown', 'unknown');
    const r = rp(req); let v;
    try { v = W.verifyAssertion({ credential: cred, challenge: expected, origin: r.origin, rpId: r.id, key: { publicKey: row.public_key, counter: row.counter } }); }
    catch (e) { return fail('verify:' + e.message, 'verify'); }
    /* el userHandle (si lo manda el autenticador) debe ser la cuenta dueña de la llave */
    if (v.userHandle && v.userHandle.toString('utf8') !== String(row.user_id)) return fail('userHandle', 'verify');
    db.run('UPDATE staff_passkeys SET counter = ?, last_used = ? WHERE id = ?', v.counter, new Date().toISOString(), row.id);
    if (!login) { audit(me.email, 'huella-prueba', ip + ' (' + row.name + ')'); return json(res, 200, { ok: true, id: row.id }); }
    /* la cuenta tiene que seguir activa y ser de profesorado o administración: una llave nunca da paso a una cuenta de alumnado ni a una dada de baja */
    const u = db.get("SELECT * FROM users WHERE id = ? AND active = 1 AND role IN ('teacher','admin')", row.user_id);
    if (!u) return fail('cuenta', 'unknown');
    limLogin.ok(ip);
    db.run('UPDATE users SET last_login = ? WHERE id = ?', new Date().toISOString(), u.id);
    audit(u.email, 'login-huella', ip + ' (' + row.name + ')');
    json(res, 200, { ok: true, id: row.id }, { 'Set-Cookie': setCookie(req, newSession(u.id), SESSION_TTL / 1000) });
  }
  R('POST', '/api/passkeys/login/verify', (req, res, ctx) => authVerify(req, res, ctx, 'auth'), { open: true });
  R('POST', '/api/passkeys/check/verify', (req, res, ctx) => authVerify(req, res, ctx, 'check'), { staff: true });

  /* ---- gestionar las llaves propias (sesión de profesorado o administración) ---- */
  const listing = (uid) => db.all('SELECT id, name, created, last_used, discoverable FROM staff_passkeys WHERE user_id = ? ORDER BY created', uid);
  R('GET', '/api/passkeys/list', async (req, res, ctx) => {
    const me = owner(ctx); if (!me) return json(res, 403, { error: 'forbidden' });
    json(res, 200, { passkeys: listing(me.id), enabled: enabled(), reason: cfg.off });
  }, { staff: true });

  R('POST', '/api/passkeys/register/options', async (req, res, ctx) => {
    if (!enabled()) return refuse(res);
    const me = owner(ctx); if (!me) return json(res, 403, { error: 'forbidden' });
    const r = rp(req), challenge = newChallenge();
    const options = {
      rp: { name: 'Historia clínica', id: r.id },
      user: { id: Buffer.from(String(me.id)).toString('base64url'), name: me.email, displayName: me.name || me.email },
      challenge, timeout: 60000, attestation: 'none',
      pubKeyCredParams: [{ alg: -8, type: 'public-key' }, { alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
      /* solo se excluyen las descubribles: una llave antigua del mismo dispositivo debe poder sustituirse */
      excludeCredentials: creds(db.all('SELECT id, transports FROM staff_passkeys WHERE user_id = ? AND discoverable = 1', me.id)),
      authenticatorSelection: { residentKey: 'required', requireResidentKey: true, userVerification: 'required' },
      extensions: { credProps: true },
    };
    json(res, 200, { options, chal: put(challenge, 'reg', me.id) });
  }, { staff: true });

  R('POST', '/api/passkeys/register/verify', async (req, res, ctx) => {
    if (!enabled()) return refuse(res);
    const me = owner(ctx); if (!me) return json(res, 403, { error: 'forbidden' });
    const b = await readJson(req, 40e3) || {}, expected = take(b.chal, 'reg', me.id); if (!expected) return json(res, 400, { error: 'challenge' });
    const r = rp(req); let v;
    try { v = W.verifyRegistration({ credential: b.credential, challenge: expected, origin: r.origin, rpId: r.id }); } catch (e) { return json(res, 400, { error: 'verify' }); }
    /* credProps.rk lo informa el navegador: false = no es descubrible, y una llave así no serviría para entrar sin escribir usuario: no se guarda */
    const ext = b.credential && b.credential.clientExtensionResults, rk = ext && ext.credProps ? ext.credProps.rk : undefined;
    if (rk === false) { audit(me.email, 'huella-rechazada', ipOf(req) + ' no descubrible'); return json(res, 400, { error: 'notdiscoverable' }); }
    if (db.get('SELECT 1 x FROM staff_passkeys WHERE id = ? AND user_id != ?', v.id, me.id)) return json(res, 400, { error: 'verify' });   /* una llave no puede pasar de una cuenta a otra */
    const name = String(b.name || 'Este dispositivo').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 60) || 'Este dispositivo';
    db.run('INSERT OR REPLACE INTO staff_passkeys (id, user_id, public_key, counter, transports, name, created, discoverable) VALUES (?,?,?,?,?,?,?,1)', v.id, me.id, v.publicKey, v.counter, JSON.stringify(v.transports), name, new Date().toISOString());
    audit(me.email, 'huella-anadida', ipOf(req));
    json(res, 200, { ok: true, id: v.id });
  }, { staff: true });

  /* Quitar una llave propia. Si fuera la última, hay que confirmarlo (confirm:true): se sigue entrando con la contraseña, que no se toca aquí. */
  R('POST', '/api/passkeys/remove', async (req, res, ctx) => {
    const me = owner(ctx); if (!me) return json(res, 403, { error: 'forbidden' });
    const b = await readJson(req, 2e3) || {}, id = String(b.id || '');
    if (!db.get('SELECT 1 x FROM staff_passkeys WHERE id = ? AND user_id = ?', id, me.id)) return json(res, 404, { error: 'unknown' });
    if (countOf(me.id) <= 1 && b.confirm !== true) return json(res, 409, { error: 'last' });
    const r = db.run('DELETE FROM staff_passkeys WHERE id = ? AND user_id = ?', id, me.id);
    audit(me.email, 'huella-borrada', ipOf(req)); json(res, 200, { ok: true, removed: r.changes });
  }, { staff: true });
};
