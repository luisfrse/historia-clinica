/* Pantalla de ayuda: guía del alumnado y guía del profesorado (contenido en ayuda-data.js). Los textos son propios y de confianza. */
(function () {
  const HC = window.HC, { h, clear, panel } = HC;
  const html = (tag, cls, s) => { const e = h(tag, cls ? { class: cls } : {}); e.innerHTML = s; return e; };

  function block(L, D, b) {
    const k = b[0];
    if (k === 'lead') return html('p', 'hp-lead', b[1]);
    if (k === 'h2') return html('h3', 'sec-h', b[1]);
    if (k === 'p') return html('p', '', b[1]);
    if (k === 'img') return h('img', { class: 'hp-img', src: '/ayuda/' + L + '/' + b[1] + '.jpg', alt: '', loading: 'lazy', style: b[2] && b[2] < 1 ? 'max-width:' + Math.round(b[2] * 100) + '%' : null });
    if (k === 'leg') return h('ul', { class: 'hp-leg' }, b[1].map(([n, tx]) => { const li = h('li'); li.append(h('span', { class: 'hp-n' }, n)); li.append(html('span', '', tx)); return li; }));
    if (k === 'box') return html('div', 'hp-box ' + b[1], '<b>' + (b[1] === 'tip' ? D.ui.tip : D.ui.warn) + '.</b> ' + b[2]);
    if (k === 'flow') return h('div', { class: 'hp-flow' }, b[1].map(([n, tx, s]) => html('div', 'hp-step', '<b class="hp-big">' + n + '</b><b>' + tx + '</b><span>' + s + '</span>')));
    if (k === 'faq') return h('div', { class: 'hp-faq' }, b[1].map(([q, a]) => { const d = h('details'); d.append(h('summary', null, q)); d.append(html('p', '', a)); return d; }));
    return null;
  }

  /* audience: 'student' | 'teacher'. El profesorado puede ver las dos guías. */
  function viewHelp(audience) {
    const L = HC.lang(), D = window.HC_HELP[L] || window.HC_HELP.es, G = D[audience], staff = HC.role() === 'admin' || HC.role() === 'teacher';
    document.title = G.title;
    const secs = G.sections.map(([title, blocks], i) => {
      const body = h('div'); blocks.forEach((b) => { const e = block(L, D, b); if (e) body.append(e); });
      const p = panel(title, body); p.id = 'hp-s' + i; return p;
    });
    const toc = h('nav', { class: 'hp-nav noprint', 'aria-label': D.ui.toc }, G.sections.map(([title], i) => h('button', { class: 'sm', onclick: () => { const el = document.getElementById('hp-s' + i); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, title)));
    const tabs = staff ? h('div', { class: 'row noprint' }, ['teacher', 'student'].map((a) => h('button', { class: a === audience ? 'pri' : '', onclick: () => { location.hash = '#/help/' + a; } }, D.ui[a]))) : null;
    HC.show(h('div', { class: 'pg-title' }, h('h1', null, G.title), h('div', { class: 'row noprint' }, tabs, h('button', { onclick: () => window.print() }, D.ui.print))),
      h('p', { class: 'mut' }, G.subtitle), toc, secs);
  }

  window.HCX = window.HCX || {}; window.HCX.viewHelp = viewHelp;
})();
