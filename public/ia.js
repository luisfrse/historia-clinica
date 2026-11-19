'use strict';
/* Borrador de feedback con IA (Claude) para el profesorado: por alumno y por grupo.
   Siempre: primero la estimación de coste y el gasto del mes; después, si se confirma, el borrador en un cuadro EDITABLE.
   La IA no publica ni pone nota: el profesor revisa, edita y publica él mismo. Sin estilos ni scripts en línea (CSP estricta). */
(function () {
  const HC = window.HC, { h, api, toast, panel } = HC, t = HC.t;

  Object.assign(window.I18N.es, {
    ia_btn: 'Borrador de feedback con IA', ia_group: 'Feedback del grupo', ia_group_help: 'La IA lee las anotaciones de toda la historia y prepara un borrador. No ve nombres, no pone nota y no publica nada: tú lo revisas y lo publicas.',
    ia_title: 'Borrador de feedback con IA', ia_check: 'Calculando el coste…', ia_will: 'Se enviarán {n} registro(s) (sin nombres ni correos).', ia_cost: 'Coste estimado: unos {c} US$ · este mes {u} de {cap} US$ de tope · modelo {m}.',
    ia_empty: 'Aún no hay registros que revisar.', ia_off: 'La IA aún no está configurada (falta ANTHROPIC_API_KEY en el servidor).', ia_go: 'Generar borrador', ia_working: 'Generando… puede tardar un minuto.',
    ia_edit: 'Borrador editable (revísalo antes de usarlo)', ia_note: 'Nota sugerida (orientativa, no se guarda): {n} / 10', ia_use: 'Usar en el comentario de evaluación', ia_post: 'Publicar como comentario de la historia', ia_posted: 'Comentario publicado',
    ia_mark: 'Borrador asistido por IA y revisado por el profesorado.', ia_close: 'Cerrar', ia_used: 'Borrador copiado en el comentario: revísalo y pulsa Guardar.',
    ia_err_ai_off: 'La IA no está configurada.', ia_err_ai_cap: 'Se ha alcanzado el tope mensual de IA.', ia_err_ai_key: 'La clave de IA no es válida.', ia_err_ai_busy: 'La IA está saturada: reintenta en un rato.', ia_err_ai_net: 'La IA no responde.', ia_err_ai_error: 'Error de la IA.'
  });
  Object.assign(window.I18N.ca, {
    ia_btn: 'Esborrany de feedback amb IA', ia_group: 'Feedback del grup', ia_group_help: "La IA llegeix les anotacions de tota la història i prepara un esborrany. No veu noms, no posa nota i no publica res: tu el revises i el publiques.",
    ia_title: 'Esborrany de feedback amb IA', ia_check: 'Calculant el cost…', ia_will: "S'enviaran {n} registre(s) (sense noms ni correus).", ia_cost: 'Cost estimat: uns {c} US$ · aquest mes {u} de {cap} US$ de topall · model {m}.',
    ia_empty: 'Encara no hi ha registres per revisar.', ia_off: "La IA encara no està configurada (falta ANTHROPIC_API_KEY al servidor).", ia_go: 'Generar esborrany', ia_working: 'Generant… pot trigar un minut.',
    ia_edit: "Esborrany editable (revisa'l abans d'usar-lo)", ia_note: 'Nota suggerida (orientativa, no es desa): {n} / 10', ia_use: "Usar al comentari d'avaluació", ia_post: "Publicar com a comentari de la història", ia_posted: 'Comentari publicat',
    ia_mark: "Esborrany assistit per IA i revisat pel professorat.", ia_close: 'Tancar', ia_used: "Esborrany copiat al comentari: revisa'l i prem Desa.",
    ia_err_ai_off: 'La IA no està configurada.', ia_err_ai_cap: "S'ha arribat al topall mensual d'IA.", ia_err_ai_key: 'La clau d\'IA no és vàlida.', ia_err_ai_busy: 'La IA està saturada: reintenta-ho d\'aquí a una estona.', ia_err_ai_net: 'La IA no respon.', ia_err_ai_error: 'Error de la IA.'
  });
  const fmt = (s, o) => String(s).replace(/\{(\w+)\}/g, (m, k) => (o[k] != null ? o[k] : m));
  const money = (n) => (Math.round(n * 100) / 100).toFixed(2);
  const errMsg = (e) => { const code = String((e && e.message) || '').replace(/-/g, '_'); const k = 'ia_err_' + code; const v = t(k); return v && v !== k ? v : (e && e.message) || 'Error'; };

  /* Diálogo: estimación -> confirmar -> borrador editable. opts: { chartId, userId (opcional), title, actions: [{label, run(text, close)}] } */
  async function open(opts) {
    const lang = HC.lang(), body = h('div', { class: 'db' }), foot = h('div', { class: 'df' });
    const dlg = h('dialog', { class: 'ia' }, h('div', { class: 'dh' }, t('ia_title') + (opts.title ? ' · ' + opts.title : '')), body, foot);
    const close = () => { try { dlg.close(); } catch (_) { /* ya cerrado */ } dlg.remove(); };
    dlg.addEventListener('cancel', close);
    const closeBtn = h('button', { type: 'button', onclick: close }, t('ia_close'));
    document.body.appendChild(dlg); dlg.showModal();
    body.append(h('p', { class: 'mut' }, t('ia_check'))); foot.append(closeBtn);
    const payload = (dry) => Object.assign({ lang, dry: !!dry }, opts.userId ? { user_id: opts.userId } : {});
    let pre;
    try { pre = await api('POST', '/api/charts/' + opts.chartId + '/ai-feedback', payload(true)); }
    catch (e) { body.replaceChildren(h('p', { class: 'err' }, e.message === 'ai-off' ? t('ia_off') : errMsg(e))); return; }
    if (pre.vacio) { body.replaceChildren(h('p', { class: 'mut' }, t('ia_empty'))); return; }
    const out = h('div');
    const go = h('button', { class: 'pri', type: 'button', onclick: async () => {
      go.disabled = true; out.replaceChildren(h('p', { class: 'mut' }, t('ia_working')));
      try {
        const r = await api('POST', '/api/charts/' + opts.chartId + '/ai-feedback', payload(false)), ta = h('textarea', { rows: 14, value: r.texto });
        out.replaceChildren(h('label', { class: 'mut' }, t('ia_edit')), ta, r.borrador.nota_sugerida != null ? h('p', { class: 'mut' }, fmt(t('ia_note'), { n: r.borrador.nota_sugerida }) + (r.borrador.justificacion_nota ? ' — ' + r.borrador.justificacion_nota : '')) : null,
          h('p', { class: 'row' }, (opts.actions || []).map((a) => h('button', { class: 'pri', type: 'button', onclick: () => a.run(ta.value.trim(), close) }, a.label))));
        go.remove();
      } catch (e) { out.replaceChildren(h('p', { class: 'err' }, errMsg(e))); go.disabled = false; }
    } }, t('ia_go'));
    body.replaceChildren(h('p', null, fmt(t('ia_will'), { n: pre.registros })), h('p', { class: 'mut' }, fmt(t('ia_cost'), { c: money(pre.estimacion.usd), u: money(pre.uso.usd), cap: money(pre.uso.cap), m: pre.modelo })), out);
    foot.prepend(go);
  }

  const mark = (txt) => txt + '\n\n' + t('ia_mark');
  /* Botón por alumno: el borrador se copia en el cuadro «comentario de evaluación» (no se guarda hasta pulsar Guardar). */
  const studentBtn = (X, mb, cm) => h('button', { type: 'button', onclick: () => open({ chartId: X.id, userId: mb.id, title: mb.name, actions: [{ label: t('ia_use'), run: (txt, close) => { cm.value = mark(txt); close(); toast(t('ia_used')); } }] }) }, t('ia_btn'));
  /* Panel de grupo: el borrador se publica, ya editado, como comentario de la historia (con marca de IA). */
  const groupPanel = (X) => panel(t('ia_group'), [h('p', { class: 'mut' }, t('ia_group_help')), h('p', { class: 'row' }, h('button', { type: 'button', onclick: () => open({ chartId: X.id, title: X.c.chart.name || '', actions: [{ label: t('ia_post'), run: async (txt, close) => {
    if (txt.length < 2) return; try { await api('POST', '/api/charts/' + X.id + '/comments', { text: mark(txt), ai: true }); close(); toast(t('ia_posted')); X.refresh(); } catch (e) { HC.fail(e); } } }] }) }, t('ia_btn')))]);

  window.HC_AI = { studentBtn, groupPanel, open };
})();
