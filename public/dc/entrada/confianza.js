'use strict';
/* diseno-comun · entrada/confianza.js — Ajustes › Seguridad › «Dispositivos de confianza» y confirmación reforzada (step-up) genérica.
   Dos piezas independientes (receta completa en docs/dispositivo-confianza.md):

   1) DCTrustSettings.mount(el, { base: '/api/trust', headers: {…}, stepUp: async () => {…}, lang, onChange })
      onAuthLost: qué hacer si la sesión desaparece (revocar todos desde una sesión de confianza la cierra); por defecto recarga la página.
      Lista los dispositivos (etiqueta, último uso, caducidad), revoca uno o todos. Si el servidor responde 403 «stepup», llama a stepUp() (que debe
      resolver cuando la confirmación esté hecha o rechazar si se cancela) y repite. Con request(method, path, body) la app aporta su propio cliente HTTP.
   2) DCStepUp.ask({ base: '/api/stepup', headers, password: true, totp: true, passkey: true, lang }) → promesa que resuelve al confirmar.
      Diálogo con huella/llave, contraseña (+ código si hay 2FA). Habla con {base}/password ({ password, totp }) y {base}/passkey/options|verify.
      Las apps con su propio diálogo (Control: apiStrong) no lo necesitan: pasan su función en stepUp.
   Sin innerHTML ni estilos en línea (CSP). Necesita base.css, iconos.js y, para la huella, passkey.js. */
(function (root) {
  var S = {
    es: { title: 'Dispositivos de confianza', intro: 'En estos dispositivos la app no pide PIN ni huella al abrirla. Revoca el que ya no uses o hayas perdido.', none: 'Ningún dispositivo de confianza. Al entrar, marca «Confiar en este dispositivo».',
      current: 'Este dispositivo', used: 'Último uso', expires: 'Caduca', never: 'sin usar', revoke: 'Revocar', revokeAll: 'Revocar todos', revokeTitle: '¿Revocar este dispositivo?', revokeText: 'La próxima vez tendrá que entrar con todos los pasos.',
      revokeAllTitle: '¿Revocar todos los dispositivos de confianza?', revokeAllText: 'Todos tendrán que entrar con todos los pasos, también este.', cancel: 'Cancelar', done: 'Revocado.', doneAll: 'Todos revocados.', stepNeeded: 'Confirma que eres tú para revocar.', error: 'No se pudo completar. Inténtalo de nuevo.', loadError: 'No se pudo leer la lista.', days: function (d) { return 'Caduca a los ' + d + ' días sin usarlo.'; },
      stepTitle: 'Confirma que eres tú', stepText: 'Es una acción importante y la confirmación vale unos minutos.', stepKey: 'Confirmar con huella o llave', stepPw: 'Contraseña', stepCode: 'Código de dos pasos', stepGo: 'Confirmar', stepBad: 'No coincide. Inténtalo de nuevo.', stepRate: 'Demasiados intentos. Espera unos minutos.', stepNone: 'No hay ninguna forma de confirmar disponible.' },
    ca: { title: 'Dispositius de confiança', intro: 'En aquests dispositius l’app no demana PIN ni empremta en obrir-la. Revoca el que ja no facis servir o hagis perdut.', none: 'Cap dispositiu de confiança. En entrar, marca «Confiar en aquest dispositiu».',
      current: 'Aquest dispositiu', used: 'Últim ús', expires: 'Caduca', never: 'sense usar', revoke: 'Revoca', revokeAll: 'Revoca’ls tots', revokeTitle: 'Vols revocar aquest dispositiu?', revokeText: 'La propera vegada haurà d’entrar amb tots els passos.',
      revokeAllTitle: 'Vols revocar tots els dispositius de confiança?', revokeAllText: 'Tots hauran d’entrar amb tots els passos, també aquest.', cancel: 'Cancel·la', done: 'Revocat.', doneAll: 'Tots revocats.', stepNeeded: 'Confirma que ets tu per revocar.', error: 'No s’ha pogut completar. Torna-ho a provar.', loadError: 'No s’ha pogut llegir la llista.', days: function (d) { return 'Caduca als ' + d + ' dies sense fer-lo servir.'; },
      stepTitle: 'Confirma que ets tu', stepText: 'És una acció important i la confirmació val uns minuts.', stepKey: 'Confirma amb empremta o clau', stepPw: 'Contrasenya', stepCode: 'Codi de dos passos', stepGo: 'Confirma', stepBad: 'No coincideix. Torna-ho a provar.', stepRate: 'Massa intents. Espera uns minuts.', stepNone: 'No hi ha cap manera de confirmar disponible.' },
    en: { title: 'Trusted devices', intro: 'On these devices the app does not ask for a PIN or fingerprint when you open it. Revoke any you no longer use or have lost.', none: 'No trusted devices. When signing in, tick “Trust this device”.',
      current: 'This device', used: 'Last used', expires: 'Expires', never: 'never used', revoke: 'Revoke', revokeAll: 'Revoke all', revokeTitle: 'Revoke this device?', revokeText: 'Next time it will have to sign in with every step.',
      revokeAllTitle: 'Revoke all trusted devices?', revokeAllText: 'All of them will have to sign in with every step, including this one.', cancel: 'Cancel', done: 'Revoked.', doneAll: 'All revoked.', stepNeeded: 'Confirm it is you to revoke.', error: 'Could not complete. Try again.', loadError: 'Could not read the list.', days: function (d) { return 'Expires after ' + d + ' days without use.'; },
      stepTitle: 'Confirm it is you', stepText: 'This is an important action and the confirmation lasts a few minutes.', stepKey: 'Confirm with fingerprint or key', stepPw: 'Password', stepCode: 'Two-step code', stepGo: 'Confirm', stepBad: 'It does not match. Try again.', stepRate: 'Too many attempts. Wait a few minutes.', stepNone: 'No way to confirm is available.' }
  };
  function h(tag, attrs) {
    var e = document.createElement(tag), a = attrs || {};
    Object.keys(a).forEach(function (k) { var v = a[k]; if (v == null || v === false) return; if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); });
    for (var i = 2; i < arguments.length; i++) add(e, arguments[i]);
    return e;
  }
  function add(e, c) { if (c == null || c === false) return; if (Array.isArray(c)) { c.forEach(function (x) { add(e, x); }); return; } e.appendChild(c.nodeType ? c : document.createTextNode(String(c))); }
  function icon(n) { var w = h('span', { class: 'dc-icon', 'aria-hidden': 'true' }); if (root.DCIcons) w.appendChild(root.DCIcons.svg(n)); return w; }
  var lg = function (o) { var l = (o && o.lang || document.documentElement.lang || 'es').slice(0, 2); return Object.assign({}, S[l] || S.es, o && o.text || {}); };
  function fmt(t) { if (!t) return ''; var d = new Date(t); return isNaN(d) ? '' : d.toLocaleDateString(document.documentElement.lang || 'es', { day: 'numeric', month: 'short', year: 'numeric' }); }
  function ago(t, lang) {
    if (!t) return ''; var s = Math.max(0, Math.round((Date.now() - t) / 1000)), l = (lang || 'es').slice(0, 2), u = l === 'ca' ? ['ara mateix', 'min', 'h', 'd', 'fa '] : l === 'en' ? ['just now', 'min', 'h', 'd', ''] : ['ahora mismo', 'min', 'h', 'd', 'hace '];
    if (s < 60) return u[0]; var m = Math.round(s / 60); if (m < 90) return u[4] + m + ' ' + u[1] + (l === 'en' ? ' ago' : ''); var hh = Math.round(m / 60); if (hh < 48) return u[4] + hh + ' ' + u[2] + (l === 'en' ? ' ago' : ''); return u[4] + Math.round(hh / 24) + ' ' + u[3] + (l === 'en' ? ' ago' : '');
  }
  async function http(o, method, path, body) {
    var hdr = Object.assign({}, o.headers || {}), opt = { method: method, credentials: 'same-origin', headers: hdr }, res, data = {};
    if (body !== undefined) { hdr['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    try { res = await fetch(path, opt); } catch (_) { var n = new Error('network'); n.status = 0; n.data = { error: 'network' }; throw n; }
    try { data = await res.json(); } catch (_) { data = {}; }
    if (!res.ok) { var e = new Error((data && data.error) || 'http'); e.status = res.status; e.data = data || {}; throw e; }
    return data;
  }
  var isStep = function (e) { return e && e.status === 403 && e.data && e.data.error === 'stepup'; };

  /* ---------- diálogo de confirmación nativo (<dialog>) ---------- */
  function modal(title, body, actions, labelId) {
    return new Promise(function (resolve) {
      var dlg = h('dialog', { class: 'dc-dialog', 'aria-labelledby': labelId }), done = false;
      var close = function (v) { if (done) return; done = true; try { dlg.close(); } catch (_) { /* ya cerrado */ } dlg.remove(); resolve(v); };
      dlg.appendChild(h('h2', { class: 'dc-card__title', id: labelId, text: title }));
      add(dlg, typeof body === 'function' ? body(close) : body);
      dlg.appendChild(h('div', { class: 'dc-dialog__actions' }, actions.map(function (a) { return h('button', { type: 'button', class: 'dc-btn dc-btn--' + (a.kind || 'secondary'), onclick: function () { if (a.onclick) a.onclick(close); else close(a.value); } }, a.label); })));
      dlg.addEventListener('close', function () { close(undefined); }); dlg.addEventListener('cancel', function () { close(undefined); });
      document.body.appendChild(dlg); dlg.showModal();
      var f = dlg.querySelector('input,.dc-btn--primary'); if (f) f.focus();
    });
  }

  function mount(el, o) {
    o = o || {}; var T = lg(o), lang = (o.lang || document.documentElement.lang || 'es').slice(0, 2), base = (o.base || '/api/trust').replace(/\/+$/, '');
    var request = o.request || function (m, p, b) { return http(o, m, p, b); };
    var listBox = h('div'), msg = h('div', { role: 'status', 'aria-live': 'polite' }), allBtn = h('button', { type: 'button', class: 'dc-btn dc-btn--danger', id: 'confianza-revocar-todos', onclick: function () { revoke(null); } }, T.revokeAll);
    el.classList.add('dc-card'); el.setAttribute('data-dc-trust', '');
    el.replaceChildren(h('h2', { class: 'dc-card__title', text: T.title }), h('p', { class: 'dc-muted', id: 'confianza-intro', text: T.intro }), listBox, msg, h('div', { class: 'dc-row' }, allBtn));
    function say(text, kind) { msg.replaceChildren(); if (!text) return; msg.appendChild(h('div', { class: 'dc-alert dc-alert--' + (kind || 'info') }, icon(kind === 'ok' ? 'check-circle' : kind === 'danger' ? 'x-circle' : 'info'), h('div', { text: text }))); }
    async function withStep(fn) { try { return await fn(); } catch (e) { if (!isStep(e) || !o.stepUp) throw e; say(T.stepNeeded, 'info'); await o.stepUp(); return fn(); } }
    async function refresh() {
      var r; try { r = await request('GET', base + '/list'); } catch (e) { if (e && (e.status === 401 || e.status === 423)) { (o.onAuthLost || function () { location.reload(); })(); return []; } listBox.replaceChildren(h('p', { class: 'dc-hint', text: T.loadError })); allBtn.hidden = true; return []; }
      var items = r.devices || []; allBtn.hidden = !items.length;
      listBox.replaceChildren(items.length ? h('ul', { class: 'dc-list', id: 'confianza-lista' }, items.map(function (d) {
        return h('li', { 'data-id': d.id }, h('span', { class: 'dc-list__icon' }, icon('phone')), h('div', { class: 'dc-grow' },
          h('div', { class: 'dc-list__title' }, d.label || '—', d.current ? h('span', { class: 'dc-chip dc-chip--ok', text: T.current }) : null),
          h('div', { class: 'dc-list__meta', text: T.used + ': ' + (d.last_used ? ago(d.last_used, lang) : T.never) + ' · ' + T.expires + ': ' + fmt(d.expires) })),
          h('button', { type: 'button', class: 'dc-btn dc-btn--ghost', 'aria-label': T.revoke + ': ' + (d.label || ''), onclick: function () { revoke(d); } }, T.revoke));
      })) : h('p', { class: 'dc-hint', id: 'confianza-vacio', text: T.none }));
      if (items.length && r.days) listBox.appendChild(h('p', { class: 'dc-hint', text: T.days(r.days) }));
      return items;
    }
    async function revoke(d) {
      var ok = await modal(d ? T.revokeTitle : T.revokeAllTitle, h('p', { text: d ? (d.label || '') + '. ' + T.revokeText : T.revokeAllText }), [{ label: T.cancel, value: false }, { label: d ? T.revoke : T.revokeAll, kind: 'danger', value: true }], 'confianza-dt');
      if (ok !== true) return;
      say('');
      try {
        var r = await withStep(function () { return request('POST', base + (d ? '/revoke' : '/revoke-all'), d ? { id: d.id } : {}); });
        say(d ? T.done : T.doneAll, 'ok'); await refresh(); if (o.onChange) o.onChange(r, d);
      } catch (e) { if (e && e.name === 'Cancel') return; say(T.error, 'danger'); }
    }
    refresh();
    return { refresh: refresh };
  }

  /* ---------- confirmación reforzada genérica ---------- */
  var seq = 0;
  function ask(o) {
    o = o || {}; var T = lg(o), base = (o.base || '/api/stepup').replace(/\/+$/, ''), lang = (o.lang || document.documentElement.lang || 'es').slice(0, 2);
    var pk = o.passkey && root.DCPasskey ? root.DCPasskey.create({ base: base + '/passkey', lang: lang, headers: o.headers || {}, paths: { loginOptions: '/options', loginVerify: '/verify' } }) : null;
    var keys = !!(pk && pk.supported()), out = h('div', { role: 'alert', 'aria-live': 'assertive' }), id = ++seq;
    var pw = o.password ? h('input', { class: 'dc-input', id: 'su-pw' + id, type: 'password', autocomplete: 'current-password' }) : null;
    var code = o.totp && o.password ? h('input', { class: 'dc-input dc-input--code', id: 'su-code' + id, type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '24' }) : null;
    var say = function (t) { out.replaceChildren(); if (t) out.appendChild(h('div', { class: 'dc-alert dc-alert--danger' }, icon('x-circle'), h('div', { text: t }))); };
    var guard = async function (btn, fn, close) {
      btn.setAttribute('aria-busy', 'true'); btn.disabled = true; say('');
      try { await fn(); close(true); } catch (e) { btn.removeAttribute('aria-busy'); btn.disabled = false; var ex = e && e.name === 'PKError' && pk ? pk.explain(e) : null; say(ex ? ex.text : e && (e.status === 429) ? T.stepRate : T.stepBad); }
    };
    return modal(T.stepTitle, function (close) {
      var kids = [h('p', { class: 'dc-muted', text: T.stepText })];
      if (keys) kids.push(h('button', { type: 'button', class: 'dc-btn dc-btn--primary dc-btn--lg dc-btn--block', id: 'su-key', onclick: function (ev) { guard(ev.currentTarget, function () { return pk.login({ mode: 'modal' }); }, close); } }, icon('fingerprint'), T.stepKey));
      if (pw) {
        kids.push(h('div', { class: 'dc-field' }, h('label', { class: 'dc-label', for: pw.id, text: T.stepPw }), pw));
        if (code) kids.push(h('div', { class: 'dc-field' }, h('label', { class: 'dc-label', for: code.id, text: T.stepCode }), code));
        kids.push(h('button', { type: 'button', class: 'dc-btn dc-btn--secondary dc-btn--block', id: 'su-go', onclick: function (ev) { guard(ev.currentTarget, function () { return http(o, 'POST', base + '/password', { password: pw.value, totp: code ? code.value : undefined }); }, close); } }, T.stepGo));
      }
      if (!keys && !pw) kids.push(h('p', { text: T.stepNone }));
      kids.push(out); return h('div', { class: 'dc-stack' }, kids);
    }, [{ label: T.cancel, kind: 'ghost', value: false }], 'su-title' + id).then(function (v) { if (v !== true) { var e = new Error('cancel'); e.name = 'Cancel'; throw e; } });
  }

  root.DCTrustSettings = { mount: mount, strings: S };
  root.DCStepUp = { ask: ask };
})(typeof window !== 'undefined' ? window : globalThis);
