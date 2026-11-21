'use strict';
/* diseno-comun · entrada/passkey.js — cliente WebAuthn compartido (huella, cara, PIN del dispositivo, llaves físicas).
   Sin dependencias ni código en línea (CSP estricta). Lo usan entrada.js (entrar) y ajustes-llaves.js (añadir este dispositivo).

   Qué resuelve (fallos reales encontrados en las apps, ver docs/passkeys.md):
   - UNA sola ceremonia a la vez: antes de empezar otra se aborta la anterior (AbortController). Con la cookie de reto única de Control/Campus,
     el aviso automático + el botón se pisaban el reto y la huella fallaba «a veces».
   - Credenciales descubribles: entrar sin escribir usuario (allowCredentials vacío) y, si el navegador lo permite, autorrelleno (mediación condicional).
   - Aviso automático al cargar SOLO si este dispositivo ya usó la llave en esta app (marca local no sensible). Sin marca no se molesta con el
     cuadro «usa un móvil / una llave» de Chrome.
   - Errores explicados: cancelar, sin gesto del usuario (Safari), sin llave en este dispositivo, sin bloqueo de pantalla, llave repetida, dominio mal configurado…
   - Registro con comprobación inmediata de que se puede entrar con ella (credProps.rk + una entrada de prueba).

   Contrato de servidor por defecto («v2», ver docs/passkeys.md):
     POST {base}/login/options     {}                      → { options, chal }
     POST {base}/login/verify      { chal, credential }    → { ok:true, ... }   (abre sesión)
     POST {base}/register/options  {}                      → { options, chal }   (con sesión)
     POST {base}/register/verify   { chal, name, credential } → { ok:true, id }
     POST {base}/check/options y /check/verify              (opcionales; igual que login pero sin abrir otra sesión)
     GET  {base}/list → { passkeys:[{id,name,created,last_used}] }      POST {base}/remove { id }
   Con `legacy: true` se habla con el contrato antiguo de Control/Campus/Deporte (opciones en la raíz, reto en cookie, credencial en la raíz). */
(function (root) {
  var TXT = {
    es: {
      cancelled: ['Cancelado', 'No se completó la verificación. Cuando quieras, vuelve a pulsar «Entrar con huella».'],
      gesture: ['Toca el botón para usar la huella', 'Este navegador no deja pedirla sin que toques la pantalla. Pulsa «Entrar con huella».'],
      nocred: ['Este dispositivo no tiene llave para esta app', 'Entra con tu contraseña y, en Ajustes › Seguridad, pulsa «Añadir este dispositivo». También puedes usar la huella de otro dispositivo si el sistema te lo ofrece.'],
      timeout: ['Se agotó el tiempo', 'El sistema esperó la huella y no llegó. Pulsa de nuevo «Entrar con huella».'],
      nouv: ['Este dispositivo no puede crear la llave', 'Falta un bloqueo de pantalla, huella o reconocimiento facial (actívalo en los ajustes del sistema: Windows Hello, bloqueo del móvil), o es una llave física antigua que no guarda passkeys. Usa el móvil u ordenador con huella o PIN. Mientras tanto, entra con la contraseña.'],
      exists: ['Este dispositivo ya está registrado', 'Ya hay una llave guardada aquí para esta app. No hace falta añadirla otra vez; para sustituirla, quita antes la anterior de la lista.'],
      security: ['La dirección no sirve para llaves', 'Las llaves solo funcionan con https y con el dominio exacto de la app. Avisa a quien administre el servidor: el dominio configurado no coincide con esta dirección.'],
      rpid: ['El servidor tiene mal configurado el dominio', 'La app dice que sus llaves son de otro dominio distinto de este. Hay que corregir la dirección pública en la configuración del servidor.'],
      unknown: ['El servidor no reconoce esta llave', 'Puede que la quitaras de la lista. Bórrala también del dispositivo (Ajustes › Contraseñas / llaves de acceso) y añade una nueva con la contraseña.'],
      challenge: ['La petición caducó', 'Pasaron más de cinco minutos o hubo dos intentos a la vez. Vuelve a intentarlo.'],
      rate: ['Demasiados intentos', 'Espera unos minutos antes de volver a probar.'],
      network: ['Sin conexión con el servidor', 'Comprueba la conexión y vuelve a intentarlo.'],
      unsupported: ['Este navegador no admite llaves', 'Prueba con Chrome, Edge, Safari o Firefox actualizados; mientras tanto, entra con la contraseña.'],
      notdiscoverable: ['La llave se creó, pero no sirve para entrar sin escribir usuario', 'Tu dispositivo ha guardado una llave que el sistema no puede ofrecer al abrir la app (suele pasar con llaves físicas antiguas). Quítala y usa la huella del móvil u ordenador, o una llave con almacenamiento de passkeys.'],
      other: ['No se pudo usar la llave', 'Algo ha fallado. Inténtalo de nuevo; si sigue igual, entra con la contraseña.']
    },
    ca: {
      cancelled: ['Cancel·lat', 'No s’ha completat la verificació. Quan vulguis, torna a prémer «Entra amb empremta».'],
      gesture: ['Toca el botó per fer servir l’empremta', 'Aquest navegador no deixa demanar-la sense que toquis la pantalla. Prem «Entra amb empremta».'],
      nocred: ['Aquest dispositiu no té clau per a aquesta app', 'Entra amb la contrasenya i, a Ajustos › Seguretat, prem «Afegeix aquest dispositiu». També pots fer servir l’empremta d’un altre dispositiu si el sistema t’ho ofereix.'],
      timeout: ['S’ha esgotat el temps', 'El sistema ha esperat l’empremta i no ha arribat. Torna a prémer «Entra amb empremta».'],
      nouv: ['Aquest dispositiu no pot crear la clau', 'Falta un bloqueig de pantalla, empremta o reconeixement facial (activa’l als ajustos del sistema: Windows Hello, bloqueig del mòbil), o és una clau física antiga que no guarda passkeys. Fes servir el mòbil o l’ordinador amb empremta o PIN. Mentrestant, entra amb la contrasenya.'],
      exists: ['Aquest dispositiu ja està registrat', 'Ja hi ha una clau guardada aquí per a aquesta app. No cal afegir-la un altre cop; per substituir-la, treu primer l’anterior de la llista.'],
      security: ['L’adreça no serveix per a claus', 'Les claus només funcionen amb https i amb el domini exacte de l’app. Avisa qui administri el servidor: el domini configurat no coincideix amb aquesta adreça.'],
      rpid: ['El servidor té mal configurat el domini', 'L’app diu que les seves claus són d’un altre domini. Cal corregir l’adreça pública a la configuració del servidor.'],
      unknown: ['El servidor no reconeix aquesta clau', 'Potser la vas treure de la llista. Esborra-la també del dispositiu (Ajustos › Contrasenyes / claus d’accés) i afegeix-ne una de nova amb la contrasenya.'],
      challenge: ['La petició ha caducat', 'Han passat més de cinc minuts o hi ha hagut dos intents alhora. Torna-ho a provar.'],
      rate: ['Massa intents', 'Espera uns minuts abans de tornar-ho a provar.'],
      network: ['Sense connexió amb el servidor', 'Comprova la connexió i torna-ho a provar.'],
      unsupported: ['Aquest navegador no admet claus', 'Prova amb Chrome, Edge, Safari o Firefox actualitzats; mentrestant, entra amb la contrasenya.'],
      notdiscoverable: ['La clau s’ha creat, però no serveix per entrar sense escriure usuari', 'El teu dispositiu ha guardat una clau que el sistema no pot oferir en obrir l’app (passa amb claus físiques antigues). Treu-la i fes servir l’empremta del mòbil o de l’ordinador.'],
      other: ['No s’ha pogut fer servir la clau', 'Alguna cosa ha fallat. Torna-ho a provar; si continua igual, entra amb la contrasenya.']
    },
    en: {
      cancelled: ['Cancelled', 'Verification was not completed. Press “Sign in with fingerprint” when you want to retry.'],
      gesture: ['Tap the button to use your fingerprint', 'This browser will not ask for it unless you tap the screen. Press “Sign in with fingerprint”.'],
      nocred: ['This device has no key for this app', 'Sign in with your password, then in Settings › Security press “Add this device”. You can also use another device if the system offers it.'],
      timeout: ['Timed out', 'The system waited for your fingerprint and it did not arrive. Press “Sign in with fingerprint” again.'],
      nouv: ['This device cannot create the key', 'It needs a screen lock, fingerprint or face unlock (turn it on in system settings: Windows Hello, phone lock), or it is an old security key that cannot store passkeys. Use your phone or computer with fingerprint or PIN. Meanwhile, sign in with your password.'],
      exists: ['This device is already registered', 'A key for this app is already stored here. To replace it, remove the old one from the list first.'],
      security: ['This address cannot use keys', 'Keys only work over https and on the app’s exact domain. Tell whoever runs the server: the configured domain does not match this address.'],
      rpid: ['The server has the wrong domain configured', 'The app says its keys belong to a different domain. The public address in the server configuration must be fixed.'],
      unknown: ['The server does not recognise this key', 'It may have been removed from the list. Delete it from the device too (Settings › Passwords / passkeys) and add a new one with your password.'],
      challenge: ['The request expired', 'More than five minutes passed or two attempts overlapped. Try again.'],
      rate: ['Too many attempts', 'Wait a few minutes before trying again.'],
      network: ['No connection to the server', 'Check your connection and try again.'],
      unsupported: ['This browser does not support passkeys', 'Try an up-to-date Chrome, Edge, Safari or Firefox; meanwhile sign in with your password.'],
      notdiscoverable: ['The key was created but cannot sign you in without a username', 'Your device stored a key the system cannot offer when the app opens (common with old security keys). Remove it and use your phone or computer fingerprint instead.'],
      other: ['Could not use the key', 'Something went wrong. Try again; if it keeps failing, sign in with your password.']
    }
  };

  function PKError(kind, cause, extra) { var e = new Error(kind); e.name = 'PKError'; e.kind = kind; e.cause = cause; if (extra) Object.keys(extra).forEach(function (k) { e[k] = extra[k]; }); return e; }

  var b64 = {
    dec: function (s) { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); var bin = atob(s + '='.repeat((4 - s.length % 4) % 4)); var u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; },
    enc: function (buf) { var u = new Uint8Array(buf), s = ''; for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  };
  var desc = function (c) { return { type: 'public-key', id: b64.dec(c.id), transports: c.transports }; };

  function create(cfg) {
    cfg = cfg || {};
    var base = (cfg.base || '/api/webauthn').replace(/\/+$/, ''), P = Object.assign({ loginOptions: '/login/options', loginVerify: '/login/verify', registerOptions: '/register/options', registerVerify: '/register/verify', checkOptions: '/check/options', checkVerify: '/check/verify', list: '/list', remove: '/remove' }, cfg.paths || {});
    var legacy = !!cfg.legacy, lang = (cfg.lang || document.documentElement.lang || 'es').slice(0, 2), TT = Object.assign({}, TXT[lang] || TXT.es);
    var markKey = 'dc-pk:' + (cfg.markKey || location.host), current = null;

    /* ---- red ---- */
    async function call(path, body, method) {
      if (cfg.request) return cfg.request(path, body, method, base);       // la app puede aportar su propio cliente (p. ej. con confirmación reforzada)
      var hdr = Object.assign({}, cfg.headers || {}), res, data = {};
      try {
        var o = { method: method || (body === undefined ? 'GET' : 'POST'), credentials: 'same-origin', headers: hdr };
        if (body !== undefined) { hdr['Content-Type'] = 'application/json'; o.body = JSON.stringify(body); }
        res = await fetch(base + path, o);
      } catch (_) { throw PKError('network'); }
      try { data = await res.json(); } catch (_) { data = {}; }
      if (!res.ok) { var code = (data && data.error) || 'http'; var k = res.status === 429 || code === 'rate' ? 'rate' : code === 'challenge' ? 'challenge' : code === 'unknown' ? 'unknown' : code === 'nokeys' ? 'nocred' : 'other'; throw PKError(k, null, { status: res.status, code: code, data: data, wait: data.wait || parseInt(res.headers.get('Retry-After'), 10) || undefined }); }
      return data;
    }
    var unwrap = function (r) { return legacy ? { options: r, chal: null } : { options: r.options, chal: r.chal }; };
    var wrapVerify = function (chal, cred, extra) {
      extra = extra || {};
      if (!legacy) return Object.assign({ chal: chal, credential: cred }, extra.name ? { name: extra.name } : {});
      return extra.register ? { name: extra.name, credential: cred } : cred;      // contrato antiguo: entrar = credencial en la raíz; registrar = { name, credential }
    };

    /* ---- soporte y marca local ---- */
    var supported = function () { return !!(root.PublicKeyCredential && navigator.credentials && navigator.credentials.get); };
    async function platformAvailable() { try { return !!(root.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch (_) { return false; } }
    async function conditionalAvailable() { try { return !!(root.PublicKeyCredential && PublicKeyCredential.isConditionalMediationAvailable && await PublicKeyCredential.isConditionalMediationAvailable()); } catch (_) { return false; } }
    function hasMark() { try { return !!localStorage.getItem(markKey); } catch (_) { return false; } }
    function setMark() { try { localStorage.setItem(markKey, JSON.stringify({ t: Date.now() })); } catch (_) { /* modo privado: sin aviso automático */ } }
    function clearMark() { try { localStorage.removeItem(markKey); } catch (_) { /* nada */ } }

    /* ---- una ceremonia a la vez ---- */
    function begin(kind) { if (current) { try { current.ctrl.abort(); } catch (_) { /* ya terminada */ } } var c = { kind: kind, ctrl: new AbortController() }; current = c; return c; }
    function end(c) { if (current === c) current = null; }
    function cancelAll() { if (current) { try { current.ctrl.abort(); } catch (_) { /* nada */ } current = null; } }

    /* ---- clasificación de errores del navegador ---- */
    function classify(e, ctx) {
      if (e && e.name === 'PKError') return e;
      var n = e && e.name, el = ctx.t0 ? Date.now() - ctx.t0 : 9999;
      if (n === 'AbortError' || (ctx.signal && ctx.signal.aborted)) return PKError('abort', e);
      if (n === 'InvalidStateError') return PKError(ctx.op === 'register' ? 'exists' : 'other', e);
      if (n === 'SecurityError') return PKError('security', e);
      if (n === 'NotSupportedError' || n === 'ConstraintError') return PKError(ctx.op === 'register' ? 'nouv' : 'unsupported', e);
      if (n === 'NotAllowedError') {
        if (ctx.mode === 'auto' && el < 700) return PKError('gesture', e);
        if (ctx.op === 'register' && el < 900) return PKError('nouv', e);                                  // un usuario no cancela en menos de 1 s: el sistema rechazó (sin bloqueo/huella, o llave sin UV)                                  // el navegador rechazó sin preguntar (Safari: hace falta un toque)
        if (ctx.op === 'login' && el < 500) return PKError('nocred', e);                                    // respuesta inmediata: no había ninguna llave que ofrecer
        if (ctx.timeout && el >= ctx.timeout - 1500) return PKError('timeout', e);
        return PKError('cancelled', e);
      }
      return PKError('other', e);
    }
    function explain(e, ctx) {
      var k = e && e.kind || 'other'; var t = TT[k] || TT.other;
      return { kind: k, title: t[0], text: t[1], silent: k === 'abort', retry: k === 'cancelled' || k === 'timeout' || k === 'gesture' || k === 'challenge' || k === 'network' || k === 'other', wait: e && e.wait };
    }

    /* ---- opciones del navegador a partir de las del servidor ---- */
    function reqOpts(o) { var pk = Object.assign({}, o, { challenge: b64.dec(o.challenge) }); if (o.allowCredentials) pk.allowCredentials = o.allowCredentials.map(desc); return pk; }
    function createOpts(o) {
      var pk = Object.assign({}, o, { challenge: b64.dec(o.challenge), user: Object.assign({}, o.user, { id: b64.dec(o.user.id) }) });
      if (o.excludeCredentials) pk.excludeCredentials = o.excludeCredentials.map(desc);
      pk.extensions = Object.assign({}, o.extensions, { credProps: true });
      return pk;
    }
    function assertionJSON(c) { var r = c.response; return { id: c.id, rawId: b64.enc(c.rawId), type: c.type, authenticatorAttachment: c.authenticatorAttachment || undefined, clientExtensionResults: c.getClientExtensionResults ? c.getClientExtensionResults() : {}, response: { authenticatorData: b64.enc(r.authenticatorData), clientDataJSON: b64.enc(r.clientDataJSON), signature: b64.enc(r.signature), userHandle: r.userHandle ? b64.enc(r.userHandle) : undefined } }; }
    function attestationJSON(c) { var r = c.response; return { id: c.id, rawId: b64.enc(c.rawId), type: c.type, authenticatorAttachment: c.authenticatorAttachment || undefined, clientExtensionResults: c.getClientExtensionResults ? c.getClientExtensionResults() : {}, response: { clientDataJSON: b64.enc(r.clientDataJSON), attestationObject: b64.enc(r.attestationObject), transports: r.getTransports ? r.getTransports() : [] } }; }
    function rpCheck(o) { var rp = o && (o.rpId || (o.rp && o.rp.id)); if (rp && !(location.hostname === rp || location.hostname.endsWith('.' + rp))) throw PKError('rpid', null, { rpId: rp, host: location.hostname }); }

    /* ---- entrar ---- */
    /* mode: 'modal' (botón), 'auto' (al cargar) o 'conditional' (autorrelleno). purpose: 'login' | 'check'. */
    async function login(o) {
      o = o || {}; var mode = o.mode || 'modal', purpose = o.purpose || 'login', retried = false;
      if (!supported()) throw PKError('unsupported');
      var c = begin(mode === 'conditional' ? 'conditional' : 'modal');
      try {
        for (;;) {
          var r = unwrap(await call(purpose === 'check' ? P.checkOptions : P.loginOptions, {})), opts = r.options; rpCheck(opts);
          var t0 = Date.now(), cred;
          try { cred = await navigator.credentials.get({ publicKey: reqOpts(opts), signal: c.ctrl.signal, mediation: mode === 'conditional' ? 'conditional' : undefined }); }
          catch (e) { throw classify(e, { op: 'login', mode: mode, t0: t0, timeout: opts.timeout, signal: c.ctrl.signal }); }
          if (!cred) throw PKError('cancelled');
          try { var out = await call(purpose === 'check' ? P.checkVerify : P.loginVerify, wrapVerify(r.chal, assertionJSON(cred))); }
          catch (e) { if (e.kind === 'challenge' && !retried && mode !== 'conditional') { retried = true; continue; } throw e; }
          if (purpose === 'login') setMark();
          out = out || {}; out.credentialId = cred.id; return out;
        }
      } finally { end(c); }
    }
    /* Autorrelleno: la llave aparece al tocar el campo de contraseña. Devuelve cancel(). Los errores salvo AbortError van a onError. */
    async function startConditional(onDone, onError) {
      if (!supported() || !(await conditionalAvailable())) return null;
      var active = true;
      login({ mode: 'conditional' }).then(function (r) { if (active) onDone(r); }, function (e) { if (active && e.kind !== 'abort' && onError) onError(e); });
      return function () { active = false; cancelAll(); };
    }
    /* Aviso al cargar: solo con marca local. Si el navegador lo rechaza por falta de gesto, se devuelve el error 'gesture' sin tratarlo como fallo. */
    function auto() { return hasMark() && supported() ? login({ mode: 'auto' }) : Promise.reject(PKError('abort')); }

    /* ---- registrar este dispositivo ---- */
    async function register(o) {
      o = o || {}; if (!supported()) throw PKError('unsupported');
      var c = begin('register');
      try {
        var r = unwrap(await call(P.registerOptions, {})), opts = r.options; rpCheck(opts);
        var t0 = Date.now(), cred;
        try { cred = await navigator.credentials.create({ publicKey: createOpts(opts), signal: c.ctrl.signal }); }
        catch (e) { throw classify(e, { op: 'register', t0: t0, timeout: opts.timeout, signal: c.ctrl.signal }); }
        var ext = cred.getClientExtensionResults ? cred.getClientExtensionResults() : {}, rk = ext.credProps ? ext.credProps.rk : undefined;
        var out = await call(P.registerVerify, wrapVerify(r.chal, attestationJSON(cred), { name: o.name, register: true }));
        return { id: cred.id, serverId: out && out.id, discoverable: rk, transports: cred.response.getTransports ? cred.response.getTransports() : [], raw: out };
      } finally { end(c); }
    }
    /* Prueba inmediata: entrar con la llave que se acaba de crear, sin escribir nada. ok = funciona y es la misma llave. */
    async function verifyNow(expectId) {
      var r = await login({ mode: 'modal', purpose: cfg.noCheck ? 'login' : 'check' });
      return { ok: !expectId || r.credentialId === expectId, sameKey: !expectId || r.credentialId === expectId, credentialId: r.credentialId };
    }

    /* ---- lista ---- */
    var list = async function () { var r = await call(P.list); return r.passkeys || []; };
    var remove = function (id) { return call(P.remove, { id: id }); };
    function describeDevice() { var ua = navigator.userAgent || '', p = (navigator.userAgentData && navigator.userAgentData.platform) || ''; var n = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(p + ua) ? 'Windows' : /Mac/.test(p + ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Este dispositivo'; var b = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : ''; return b ? n + ' · ' + b : n; }

    return { supported: supported, platformAvailable: platformAvailable, conditionalAvailable: conditionalAvailable, hasMark: hasMark, setMark: setMark, clearMark: clearMark, login: login, startConditional: startConditional, auto: auto, register: register, verifyNow: verifyNow, list: list, remove: remove, cancel: cancelAll, explain: explain, describeDevice: describeDevice, text: TT };
  }
  root.DCPasskey = { create: create, TXT: TXT, b64: b64 };
})(typeof window !== 'undefined' ? window : globalThis);
