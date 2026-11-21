'use strict';
/* Dispositivo de confianza de Historia clínica (solo profesorado y administración; el alumnado nunca).
   El módulo común (lib/dc/confianza.cjs, copia de diseno-comun) no sabe de cuentas. Aquí se liga cada dispositivo a su cuenta (tabla dc_trust_user):
   cada cuenta ve y revoca solo los suyos, y una cookie de confianza solo abre sesión de la cuenta que la creó (mientras siga activa y sea de profesorado o administración).

   Rutas:
     GET  /api/trust/state (público)   -> { enabled, days }                 la pantalla de entrada decide si enseña la casilla
     GET  /api/trust/list              -> { devices, days, absoluteDays, enabled }   solo los de la cuenta
     POST /api/trust/enroll { trust:true }   solo tras un acceso completo y reciente, nunca desde una sesión de confianza ni de alumnado
     POST /api/trust/revoke { id } · POST /api/trust/revoke-all             piden confirmación reciente
     POST /api/stepup/password { password } -> confirmación reforzada (10 min) con la contraseña de la cuenta (administración: ADMIN_PASSWORD)
   (la confirmación con llave está en lib/passkeys.js: /api/stepup/passkey/options|verify). */
module.exports = function trustRoutes(X) {
  const { R, db, json, readJson, audit, trust, limLogin, pwCheck, cookies, U, ADMIN_PASSWORD, enabled, days, STRONG_MS, ipOf } = X;
  const sessOf = (ctx) => ctx.user && ctx.user._sess;
  const info = (ctx) => { const s = sessOf(ctx); return { authed: !!s, trusted: !!(s && s.trusted), strong: !!(s && s.strong_until > Date.now()) }; };
  const call = (req, ctx, path, body, method) => trust.handle({ method: method || req.method, path, ua: req.headers['user-agent'], ip: ipOf(req), cookie: req.headers.cookie, body, session: info(ctx) });
  const mine = (uid) => new Set(db.all('SELECT trust_id FROM dc_trust_user WHERE user_id = ?', uid).map((r) => r.trust_id));
  const send = (res, out) => json(res, out.status, out.body, out.headers);

  R('GET', '/api/trust/state', async (req, res) => json(res, 200, { enabled: !!enabled, days }), { open: true });

  R('GET', '/api/trust/list', async (req, res, ctx) => {
    const out = await call(req, ctx, '/api/trust/list'), own = mine(ctx.user.id);
    if (out.status === 200) { out.body.devices = out.body.devices.filter((d) => own.has(d.id)); db.run('DELETE FROM dc_trust_user WHERE trust_id NOT IN (SELECT id FROM dc_trust)'); }
    send(res, out);
  }, { staff: true });

  R('POST', '/api/trust/enroll', async (req, res, ctx) => {
    const b = await readJson(req, 2e3);
    const out = await call(req, ctx, '/api/trust/enroll', b);
    if (out.status === 200 && out.body.device) db.run('INSERT OR REPLACE INTO dc_trust_user (trust_id, user_id) VALUES (?,?)', out.body.device.id, ctx.user.id);
    send(res, out);
  }, { staff: true });

  R('POST', '/api/trust/revoke', async (req, res, ctx) => {
    const b = await readJson(req, 2e3);
    if (!mine(ctx.user.id).has(String(b.id || ''))) return json(res, info(ctx).strong ? 404 : 403, { error: info(ctx).strong ? 'notfound' : 'stepup' });
    send(res, await call(req, ctx, '/api/trust/revoke', b));
  }, { staff: true });

  /* revocar todos: solo los de esta cuenta (el módulo revocaría los de todas) */
  R('POST', '/api/trust/revoke-all', async (req, res, ctx) => {
    if (!info(ctx).strong) return json(res, 403, { error: 'stepup' });
    const own = mine(ctx.user.id); let current = false;
    const list = await call(req, ctx, '/api/trust/list', undefined, 'GET');
    for (const d of (list.body.devices || [])) if (own.has(d.id) && d.current) current = true;
    for (const id of own) trust.revoke(id);
    audit(ctx.user.email, 'confianza-revocados-todos', own.size + ' dispositivo(s)');
    json(res, 200, { ok: true }, current ? { 'Set-Cookie': trust.clearCookie() } : undefined);
  }, { staff: true });

  /* confirmación reforzada con contraseña */
  R('POST', '/api/stepup/password', async (req, res, ctx) => {
    const ip = ipOf(req), u = ctx.user;
    if (limLogin.blocked(ip)) return json(res, 429, { error: 'rate', wait: limLogin.wait(ip) });
    const b = await readJson(req, 2e3), pw = String(b.password || '');
    const full = db.get('SELECT pw FROM users WHERE id = ?', u.id);
    const ok = u.role === 'admin' ? !!ADMIN_PASSWORD && U.eq(U.sha(pw), U.sha(ADMIN_PASSWORD)) : !!(full && full.pw) && pwCheck(pw, full.pw);
    if (!ok) { limLogin.fail(ip); audit(u.email, 'confirmacion-fallida', ip); return json(res, 403, { error: 'bad' }); }
    limLogin.ok(ip);
    db.run('UPDATE sessions SET strong_until = ? WHERE hash = ?', Date.now() + STRONG_MS, U.sha(cookies(req).hid || ''));
    audit(u.email, 'confirmacion', 'contraseña'); json(res, 200, { ok: true });
  }, { staff: true });
};
