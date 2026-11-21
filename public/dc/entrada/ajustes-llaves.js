'use strict';
/* diseno-comun · entrada/ajustes-llaves.js — asistente de Ajustes › Seguridad para las llaves de acceso («Añadir este dispositivo»).
   Hace TRES cosas que hoy no hace ninguna app: (1) crea la llave descubrible, (2) COMPRUEBA al momento que se puede entrar con ella sin escribir
   nada, y si no funciona la quita; (3) avisa si solo hay una llave.
   Uso:  <section id="dc-llaves"></section>  +  DCPasskeySettings.mount(document.getElementById('dc-llaves'), { pk: DCPasskey.create({ base: '/api/webauthn' }) })
   Necesita base.css, entrada.css (solo .dc-entrada no hace falta), iconos.js y passkey.js. Sin innerHTML ni estilos en línea. */
(function (root) {
  var S = {
    es: { title: 'Huella y llaves de acceso', intro: 'Entra sin escribir la contraseña con la huella, la cara o el PIN de este dispositivo.', add: 'Añadir este dispositivo', none: 'Todavía no hay ninguna llave.', added: 'Añadida', used: 'usada', never: 'sin usar',
      remove: 'Quitar', removeTitle: '¿Quitar esta llave?', removeText: 'Con ella ya no se podrá entrar desde ese dispositivo. Tendrás que usar otra llave o la contraseña.', cancel: 'Cancelar', step1: 'Crear la llave en este dispositivo', step2: 'Comprobar que se puede entrar con ella',
      doing1: 'Sigue las indicaciones del sistema: huella, cara o PIN del dispositivo.', doing2: 'Ahora toca el sensor otra vez para comprobar que entrar funciona. No se escribe nada.', ok: 'Listo: la próxima vez la app te pedirá la huella nada más abrirla.',
      one: 'Solo tienes una llave. Si pierdes ese dispositivo, tendrás que entrar con la contraseña. Añade también otro dispositivo (el móvil y el ordenador, por ejemplo).', unsupported: 'Este navegador no admite llaves de acceso.', retryCheck: 'Repetir la comprobación', removeFailed: 'Quitar esta llave', otherKey: 'La comprobación usó otra llave distinta de la que acabas de crear. Quita la nueva y repite el proceso, o conserva las dos si son de dispositivos diferentes.',
      removedBad: 'La llave no funcionaba para entrar y se ha quitado para que no te bloquee.', unnamed: 'Dispositivo', platform: 'Este dispositivo no parece tener huella ni bloqueo de pantalla; si el sistema no ofrece nada, actívalo antes.' },
    ca: { title: 'Empremta i claus d’accés', intro: 'Entra sense escriure la contrasenya amb l’empremta, la cara o el PIN d’aquest dispositiu.', add: 'Afegeix aquest dispositiu', none: 'Encara no hi ha cap clau.', added: 'Afegida', used: 'usada', never: 'sense usar',
      remove: 'Treu', removeTitle: 'Vols treure aquesta clau?', removeText: 'Amb ella ja no es podrà entrar des d’aquell dispositiu. Hauràs de fer servir una altra clau o la contrasenya.', cancel: 'Cancel·la', step1: 'Crear la clau en aquest dispositiu', step2: 'Comprovar que s’hi pot entrar',
      doing1: 'Segueix les indicacions del sistema: empremta, cara o PIN del dispositiu.', doing2: 'Ara toca el sensor un altre cop per comprovar que entrar funciona. No s’escriu res.', ok: 'Llest: la propera vegada l’app et demanarà l’empremta tan bon punt l’obris.',
      one: 'Només tens una clau. Si perds aquest dispositiu, hauràs d’entrar amb la contrasenya. Afegeix també un altre dispositiu (el mòbil i l’ordinador, per exemple).', unsupported: 'Aquest navegador no admet claus d’accés.', retryCheck: 'Repeteix la comprovació', removeFailed: 'Treu aquesta clau', otherKey: 'La comprovació ha fet servir una altra clau diferent de la que acabes de crear. Treu la nova i repeteix el procés, o conserva les dues si són de dispositius diferents.',
      removedBad: 'La clau no servia per entrar i s’ha tret perquè no et bloquegi.', unnamed: 'Dispositiu', platform: 'Aquest dispositiu no sembla tenir empremta ni bloqueig de pantalla; si el sistema no ofereix res, activa’l abans.' },
    en: { title: 'Fingerprint and passkeys', intro: 'Sign in without typing your password using this device’s fingerprint, face or PIN.', add: 'Add this device', none: 'No keys yet.', added: 'Added', used: 'used', never: 'never used',
      remove: 'Remove', removeTitle: 'Remove this key?', removeText: 'That device will no longer be able to sign in with it. You will need another key or the password.', cancel: 'Cancel', step1: 'Create the key on this device', step2: 'Check that signing in works with it',
      doing1: 'Follow the system prompts: fingerprint, face or device PIN.', doing2: 'Now touch the sensor again to check that signing in works. Nothing is typed.', ok: 'Done: next time the app will ask for your fingerprint as soon as it opens.',
      one: 'You only have one key. If you lose that device you will have to sign in with the password. Add another device too (phone and computer, for example).', unsupported: 'This browser does not support passkeys.', retryCheck: 'Repeat the check', removeFailed: 'Remove this key', otherKey: 'The check used a different key from the one you just created. Remove the new one and repeat, or keep both if they are on different devices.',
      removedBad: 'The key could not sign you in and was removed so it does not lock you out.', unnamed: 'Device', platform: 'This device does not seem to have a fingerprint or screen lock; if the system offers nothing, turn it on first.' }
  };
  var NS = 'http://www.w3.org/2000/svg';
  function h(tag, attrs) {
    var e = document.createElement(tag), a = attrs || {};
    Object.keys(a).forEach(function (k) { var v = a[k]; if (v == null || v === false) return; if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); });
    for (var i = 2; i < arguments.length; i++) add(e, arguments[i]);
    return e;
  }
  function add(e, c) { if (c == null || c === false) return; if (Array.isArray(c)) { c.forEach(function (x) { add(e, x); }); return; } e.appendChild(c.nodeType ? c : document.createTextNode(String(c))); }
  function icon(n) { var w = h('span', { class: 'dc-icon', 'aria-hidden': 'true' }); if (root.DCIcons) w.appendChild(root.DCIcons.svg(n)); return w; }
  var fmt = function (t) { if (!t) return ''; var d = new Date(typeof t === 'number' ? t : String(t).replace(' ', 'T')); return isNaN(d) ? String(t).slice(0, 10) : d.toLocaleDateString(document.documentElement.lang || 'es', { day: 'numeric', month: 'short', year: 'numeric' }); };

  function mount(el, o) {
    o = o || {}; var pk = o.pk; if (!pk) throw new Error('DCPasskeySettings: falta pk (DCPasskey.create(...))');
    var lang = (o.lang || document.documentElement.lang || 'es').slice(0, 2), T = Object.assign({}, S[lang] || S.es, o.text || {});
    var listBox = h('div'), warnBox = h('div', { role: 'status', 'aria-live': 'polite' }), steps = h('ol', { class: 'dc-steps', hidden: true }), msg = h('div', { role: 'alert', 'aria-live': 'assertive' });
    var addBtn = h('button', { type: 'button', class: 'dc-btn dc-btn--primary', onclick: run }, icon('fingerprint'), T.add);
    var dlg = h('dialog', { class: 'dc-dialog', 'aria-labelledby': 'dc-llaves-dt' });
    el.classList.add('dc-card');
    el.replaceChildren(h('h2', { class: 'dc-card__title', text: T.title }), h('p', { class: 'dc-muted', text: T.intro }), listBox, warnBox, steps, msg, h('div', { class: 'dc-row' }, addBtn), dlg);
    if (!pk.supported()) { addBtn.disabled = true; say(msg, T.unsupported, 'warn'); }

    function say(box, text, kind, title) { box.replaceChildren(); if (!text) return; box.appendChild(h('div', { class: 'dc-alert dc-alert--' + (kind || 'info') }, icon(kind === 'ok' ? 'check-circle' : kind === 'danger' ? 'x-circle' : kind === 'warn' ? 'alert' : 'info'), h('div', null, title ? h('span', { class: 'dc-alert__title', text: title }) : null, text))); }
    function showErr(e) { var x = pk.explain(e); if (x.silent) return say(msg, ''); say(msg, x.text, x.kind === 'cancelled' ? 'info' : x.kind === 'nocred' || x.kind === 'nouv' || x.kind === 'notdiscoverable' ? 'warn' : 'danger', x.title); }
    function paintSteps(state) {   // state: [estado1, estado2] con 'todo' | 'doing' | 'ok' | 'bad'
      steps.hidden = false; steps.replaceChildren(h('li', { class: 'dc-steps__item is-' + state[0] }, icon(state[0] === 'ok' ? 'check-circle' : state[0] === 'bad' ? 'x-circle' : 'fingerprint'), h('span', { text: T.step1 })), h('li', { class: 'dc-steps__item is-' + state[1] }, icon(state[1] === 'ok' ? 'check-circle' : state[1] === 'bad' ? 'x-circle' : 'shield-check'), h('span', { text: T.step2 })));
    }
    function confirmRemove(k) {
      return new Promise(function (res) {
        var done = function (v) { try { dlg.close(); } catch (_) { /* ya cerrado */ } res(v); };
        dlg.replaceChildren(h('h2', { class: 'dc-card__title', id: 'dc-llaves-dt', text: T.removeTitle }), h('p', { text: (k.name || T.unnamed) + '. ' + T.removeText }), h('div', { class: 'dc-dialog__actions' }, h('button', { type: 'button', class: 'dc-btn dc-btn--secondary', onclick: function () { done(false); } }, T.cancel), h('button', { type: 'button', class: 'dc-btn dc-btn--danger', onclick: function () { done(true); } }, T.remove)));
        dlg.addEventListener('close', function () { res(false); }, { once: true }); dlg.showModal();
      });
    }
    async function refresh() {
      var items = []; try { items = await pk.list(); } catch (_) { /* sin sesión */ }
      listBox.replaceChildren(items.length ? h('ul', { class: 'dc-list' }, items.map(function (k) {
        return h('li', null, h('span', { class: 'dc-list__icon' }, icon('key')), h('div', { class: 'dc-grow' }, h('div', { class: 'dc-list__title', text: k.name || T.unnamed }), h('div', { class: 'dc-list__meta', text: T.added + ' ' + fmt(k.created) + ' · ' + (k.last_used || k.lastUsed ? T.used + ' ' + fmt(k.last_used || k.lastUsed) : T.never) })),
          h('button', { type: 'button', class: 'dc-btn dc-btn--ghost', 'aria-label': T.remove + ': ' + (k.name || T.unnamed), onclick: async function () { if (await confirmRemove(k)) { try { await pk.remove(k.id); } catch (e) { showErr(e); } refresh(); if (o.onChange) o.onChange(); } } }, icon('trash'), T.remove));
      })) : h('p', { class: 'dc-hint', text: T.none }));
      if (items.length === 1) say(warnBox, T.one, 'warn'); else say(warnBox, '');
      return items;
    }
    async function run() {
      say(msg, ''); addBtn.disabled = true; addBtn.setAttribute('aria-busy', 'true'); paintSteps(['doing', 'todo']); say(msg, T.doing1, 'info');
      var made = null;
      try {
        made = await pk.register({ name: pk.describeDevice() });
        if (made.discoverable === false) { try { await pk.remove(made.serverId || made.id); } catch (_) { /* nada */ } paintSteps(['bad', 'todo']); showErr({ kind: 'notdiscoverable' }); await refresh(); return; }
        paintSteps(['ok', 'doing']); say(msg, T.doing2, 'info');
        var chk = await pk.verifyNow(made.id);
        if (!chk.ok) { paintSteps(['ok', 'bad']); say(msg, T.otherKey, 'warn'); }
        else { paintSteps(['ok', 'ok']); pk.setMark(); say(msg, T.ok, 'ok'); }
      } catch (e) {
        if (made) {   // la llave se creó pero la prueba falló: se ofrece repetir o quitarla (nunca se da por buena sin comprobar)
          paintSteps(['ok', 'bad']); showErr(e);
          var again = h('button', { type: 'button', class: 'dc-btn dc-btn--secondary', onclick: function () { again.remove(); drop.remove(); run2(made); } }, T.retryCheck);
          var drop = h('button', { type: 'button', class: 'dc-btn dc-btn--danger', onclick: async function () { try { await pk.remove(made.serverId || made.id); } catch (_) { /* nada */ } again.remove(); drop.remove(); paintSteps(['bad', 'todo']); say(msg, T.removedBad, 'info'); refresh(); } }, T.removeFailed);
          msg.appendChild(h('div', { class: 'dc-row' }, again, drop));
        } else { paintSteps(['bad', 'todo']); showErr(e); }
      } finally { addBtn.disabled = !pk.supported(); addBtn.removeAttribute('aria-busy'); await refresh(); if (o.onChange) o.onChange(); }
    }
    async function run2(made) {
      say(msg, T.doing2, 'info'); paintSteps(['ok', 'doing']);
      try { var chk = await pk.verifyNow(made.id); if (chk.ok) { paintSteps(['ok', 'ok']); pk.setMark(); say(msg, T.ok, 'ok'); } else { paintSteps(['ok', 'bad']); say(msg, T.otherKey, 'warn'); } }
      catch (e) { paintSteps(['ok', 'bad']); showErr(e); }
    }
    refresh();
    return { refresh: refresh };
  }
  root.DCPasskeySettings = { mount: mount, strings: S };
})(typeof window !== 'undefined' ? window : globalThis);
