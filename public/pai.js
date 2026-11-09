/* Plan de cuidados individualizado (PAI) guiado: valoración → diagnóstico → resultados → intervenciones → revisión,
   con buscador y sugerencias de la biblioteca NANDA · NOC · NIC, pistas y ejemplos. También la pantalla de la biblioteca (profesorado). */
(function () {
  const HC = window.HC, { h, add, clear, api, toast, fail, panel, empty, field, fmtDT, nowInput } = HC;
  const t = HC.t, lang = () => HC.lang(), PATRONES = window.HC_SCALES.PATRONES;

  Object.assign(window.I18N.es, {
    pai_new: 'Nuevo plan de cuidados (PAI)', pai_title: 'Plan de cuidados individualizado (PAI)', pai_next: 'Siguiente', pai_prev: 'Anterior', pai_hint: 'Pista', pai_example: 'Ejemplo',
    pai_s1: '1 · Valoración', pai_s2: '2 · Diagnóstico', pai_s3: '3 · Resultados', pai_s4: '4 · Intervenciones', pai_s5: '5 · Revisión',
    pai_h1: 'Todo plan empieza por lo que has observado. Elige el patrón o la necesidad que está alterada y escribe 1 o 2 datos concretos: qué ves, qué dice la persona, qué muestran las constantes.',
    pai_e1: 'Patrón «Actividad y ejercicio» · «Disnea al caminar 5 metros, SpO2 89 % al esfuerzo, refiere cansancio.»',
    pai_pat: 'Patrón o necesidad alterada', pai_pick_pat: '— Elige —', pai_datos: 'Datos de la valoración que lo justifican',
    pai_h2: 'Busca el diagnóstico de enfermería que mejor describe el problema (puedes buscar por palabras: «caídas», «piel», «dolor»). Después completa la frase: «diagnóstico, relacionado con (r/c) la causa, manifestado por (m/p) los signos». Si el diagnóstico es de riesgo no se escriben signos, solo factores de riesgo.',
    pai_e2: 'Limpieza ineficaz de las vías aéreas r/c secreciones bronquiales abundantes m/p tos con expectoración y ruidos respiratorios añadidos.',
    pai_search_dx: 'Buscar diagnóstico (por ejemplo: dolor, caídas, piel…)', pai_free: 'No lo encuentro: lo escribo yo', pai_free_ph: 'Escribe el diagnóstico', pai_type: 'Tipo', pai_t_real: 'Real', pai_t_riesgo: 'De riesgo', pai_t_promocion: 'De promoción de la salud',
    pai_rc: 'Relacionado con (r/c)', pai_rc_risk: 'Factores de riesgo (r/c)', pai_mp: 'Manifestado por (m/p)', pai_more: 'Otros (separados por comas)', pai_pes: 'Así se lee tu diagnóstico', pai_none: 'No hay resultados. Prueba con otra palabra o escribe el diagnóstico tú.', pai_when: 'Cuándo usarlo', pai_chosen: 'Elegido',
    pai_h3: 'Un resultado (NOC) es lo que quieres conseguir en la persona. Elige el que corresponde a tu diagnóstico, marca de 2 a 3 indicadores y da a cada uno una puntuación de partida y una meta, de 1 (la peor situación) a 5 (la mejor).',
    pai_e3: 'Estado respiratorio: permeabilidad de las vías respiratorias · indicador «capacidad de eliminar secreciones»: ahora 2, meta 4, en 7 días.',
    pai_sugg: 'Sugeridos para tu diagnóstico', pai_search_all: 'Buscar en toda la biblioteca…', pai_add: 'Añadir', pai_remove: 'Quitar', pai_scale: 'Escala: 1 = situación muy alterada · 3 = moderada · 5 = sin alteración', pai_now: 'Ahora', pai_goal: 'Meta', pai_term: 'Plazo',
    pai_t3: 'en 3 días', pai_t7: 'en 7 días', pai_t14: 'en 14 días', pai_t0: 'durante el ingreso', pai_pick_ind: 'Elige los indicadores que vas a medir', pai_ind_custom: 'Otro indicador', pai_ind_add: 'Añadir indicador',
    pai_h4: 'Las intervenciones (NIC) son lo que vas a hacer para conseguir el resultado. Elige las que correspondan, marca las actividades concretas e indica quién las hace y cada cuánto.',
    pai_e4: 'Manejo de las vías aéreas · colocar semisentada, animar a toser y respirar profundamente, vigilar los ruidos respiratorios · cada 4 h · enfermería y auxiliar.',
    pai_who: 'Quién', pai_who_both: 'Enfermería y auxiliar', pai_who_nurse: 'Enfermería', pai_who_aux: 'Auxiliar', pai_freq: 'Frecuencia', pai_freq_ph: 'por ejemplo, cada 4 h', pai_acts: 'Actividades', pai_act_custom: 'Otra actividad', pai_act_add: 'Añadir actividad',
    pai_nurse_tech: 'Suele ser técnica de enfermería: si eres auxiliar, déjala a enfermería y avísala.', pai_aux_note: 'Eres auxiliar: elige las actividades de tu competencia y marca «Enfermería» lo que debe hacer enfermería.',
    pai_h5: 'Revisa tu plan antes de registrarlo. Debe tener un diagnóstico bien formulado, al menos un resultado con meta y al menos una intervención con actividades.',
    pai_check_dx: 'Diagnóstico con causa (r/c) y, si es real, signos (m/p)', pai_check_noc: 'Al menos un resultado con indicadores y meta', pai_check_nic: 'Al menos una intervención con actividades', pai_prio: 'Prioridad', pai_register: 'Registrar el plan', pai_fix: 'Corrige esto para continuar',
    pai_v_pat: 'Elige el patrón o la necesidad alterada.', pai_v_datos: 'Escribe al menos un dato de la valoración (unas 10 letras).', pai_v_dx: 'Elige un diagnóstico o escribe el tuyo.', pai_v_rc: 'Indica al menos una causa o factor (r/c).', pai_v_mp: 'Un diagnóstico real necesita al menos un signo o síntoma (m/p).',
    pai_v_noc: 'Añade al menos un resultado.', pai_v_ind: 'Marca al menos un indicador en cada resultado.', pai_v_meta: 'La meta debe ser mayor que la puntuación de partida.', pai_v_nic: 'Añade al menos una intervención.', pai_v_act: 'Marca al menos una actividad en cada intervención.',
    pai_dx_h: 'Diagnóstico (NANDA)', pai_noc_h: 'Resultados (NOC)', pai_nic_h: 'Intervenciones (NIC)', pai_val_h: 'Valoración', pai_ind: 'Indicador', pai_from: 'Inicio', pai_eval_col: 'Evaluación', pai_evals: 'Evaluaciones',
    pai_eval_h: 'Mide de nuevo cada indicador con la misma escala (1 a 5) y compara con la meta. Si no se ha conseguido, explica qué ajustas.', pai_eval_auto: 'Resultado sugerido', pai_eval_adjust: 'Reajuste del plan (qué cambias si no se ha conseguido)', pai_last: 'Última',
    tx_title: 'Biblioteca NANDA · NOC · NIC', tx_open: 'Biblioteca NANDA · NOC · NIC', tx_to_catalog: 'Catálogo de cuidados',
    tx_note: 'Esta biblioteca guía el plan de cuidados del alumnado (buscador, sugerencias y pistas). Viene con una selección inicial pequeña de etiquetas habituales y pistas redactadas para la aplicación. NANDA-I, NOC y NIC son taxonomías con derechos de autor: complétala o corrígela con tu material con licencia (manuales, documentación del centro). No se incluyen los textos oficiales.',
    tx_kind_nanda: 'Diagnósticos (NANDA)', tx_kind_noc: 'Resultados (NOC)', tx_kind_nic: 'Intervenciones (NIC)', tx_code: 'Código', tx_label_es: 'Etiqueta (castellano)', tx_label_ca: 'Etiqueta (catalán)', tx_hint_es: 'Cuándo usarlo (castellano)', tx_hint_ca: 'Cuándo usarlo (catalán)',
    tx_rc: 'Factores relacionados o de riesgo (r/c), uno por línea', tx_mp: 'Signos y síntomas (m/p), uno por línea', tx_ind: 'Indicadores, uno por línea', tx_act: 'Actividades, una por línea', tx_ca_lines: '(en catalán)', tx_links_noc: 'Resultados sugeridos', tx_links_nic: 'Intervenciones sugeridas',
    tx_add: 'Nueva entrada', tx_import: 'Importar CSV', tx_export: 'Exportar CSV', tx_import_help: 'Una entrada por línea, separada por «;»: tipo (nanda, noc o nic); código; etiqueta en castellano; etiqueta en catalán; elementos separados por « | » (indicadores o actividades; en los diagnósticos, los r/c); y, solo en los diagnósticos, los m/p. Si la etiqueta ya existe, se actualiza.',
    tx_imported: 'Importadas: {c} nuevas, {u} actualizadas', tx_custom: 'propia', tx_inactive: 'desactivada', tx_search: 'Buscar…', tx_confirm_del: '¿Eliminar esta entrada? Los planes ya hechos no cambian.', tx_saved: 'Guardado', tx_tipo: 'Tipo de diagnóstico', tx_who: 'Quién la hace habitualmente', tx_items: 'elementos', tx_on: 'Activar', tx_off: 'Desactivar', tx_empty: 'No hay entradas.',
  });
  Object.assign(window.I18N.ca, {
    pai_new: 'Nou pla de cures (PAI)', pai_title: 'Pla de cures individualitzat (PAI)', pai_next: 'Següent', pai_prev: 'Anterior', pai_hint: 'Pista', pai_example: 'Exemple',
    pai_s1: '1 · Valoració', pai_s2: '2 · Diagnòstic', pai_s3: '3 · Resultats', pai_s4: '4 · Intervencions', pai_s5: '5 · Revisió',
    pai_h1: "Tot pla comença per allò que has observat. Tria el patró o la necessitat que està alterada i escriu 1 o 2 dades concretes: què veus, què diu la persona, què mostren les constants.",
    pai_e1: 'Patró «Activitat i exercici» · «Dispnea en caminar 5 metres, SpO2 89 % a l\'esforç, refereix cansament.»',
    pai_pat: 'Patró o necessitat alterada', pai_pick_pat: '— Tria —', pai_datos: 'Dades de la valoració que ho justifiquen',
    pai_h2: "Cerca el diagnòstic d'infermeria que millor descriu el problema (pots cercar per paraules: «caigudes», «pell», «dolor»). Després completa la frase: «diagnòstic, relacionat amb (r/c) la causa, manifestat per (m/p) els signes». Si el diagnòstic és de risc no s'escriuen signes, només factors de risc.",
    pai_e2: 'Neteja ineficaç de les vies aèries r/c secrecions bronquials abundants m/p tos amb expectoració i sorolls respiratoris afegits.',
    pai_search_dx: 'Cercar diagnòstic (per exemple: dolor, caigudes, pell…)', pai_free: 'No el trobo: l\'escric jo', pai_free_ph: 'Escriu el diagnòstic', pai_type: 'Tipus', pai_t_real: 'Real', pai_t_riesgo: 'De risc', pai_t_promocion: 'De promoció de la salut',
    pai_rc: 'Relacionat amb (r/c)', pai_rc_risk: 'Factors de risc (r/c)', pai_mp: 'Manifestat per (m/p)', pai_more: 'Altres (separats per comes)', pai_pes: 'Així es llegeix el teu diagnòstic', pai_none: "No hi ha resultats. Prova amb una altra paraula o escriu el diagnòstic tu.", pai_when: 'Quan fer-lo servir', pai_chosen: 'Triat',
    pai_h3: "Un resultat (NOC) és el que vols aconseguir en la persona. Tria el que correspon al teu diagnòstic, marca de 2 a 3 indicadors i dona a cadascun una puntuació de partida i una meta, d'1 (la pitjor situació) a 5 (la millor).",
    pai_e3: 'Estat respiratori: permeabilitat de les vies respiratòries · indicador «capacitat d\'eliminar secrecions»: ara 2, meta 4, en 7 dies.',
    pai_sugg: 'Suggerits pel teu diagnòstic', pai_search_all: 'Cercar a tota la biblioteca…', pai_add: 'Afegir', pai_remove: 'Treure', pai_scale: 'Escala: 1 = situació molt alterada · 3 = moderada · 5 = sense alteració', pai_now: 'Ara', pai_goal: 'Meta', pai_term: 'Termini',
    pai_t3: 'en 3 dies', pai_t7: 'en 7 dies', pai_t14: 'en 14 dies', pai_t0: "durant l'ingrés", pai_pick_ind: 'Tria els indicadors que mesuraràs', pai_ind_custom: 'Un altre indicador', pai_ind_add: 'Afegir indicador',
    pai_h4: "Les intervencions (NIC) són el que faràs per aconseguir el resultat. Tria les que corresponguin, marca les activitats concretes i indica qui les fa i cada quant.",
    pai_e4: "Maneig de les vies aèries · col·locar semiasseguda, animar a tossir i respirar profundament, vigilar els sorolls respiratoris · cada 4 h · infermeria i auxiliar.",
    pai_who: 'Qui', pai_who_both: 'Infermeria i auxiliar', pai_who_nurse: 'Infermeria', pai_who_aux: 'Auxiliar', pai_freq: 'Freqüència', pai_freq_ph: 'per exemple, cada 4 h', pai_acts: 'Activitats', pai_act_custom: 'Una altra activitat', pai_act_add: 'Afegir activitat',
    pai_nurse_tech: "Sol ser una tècnica d'infermeria: si ets auxiliar, deixa-la a infermeria i avisa-la.", pai_aux_note: "Ets auxiliar: tria les activitats de la teva competència i marca «Infermeria» el que ha de fer infermeria.",
    pai_h5: "Revisa el teu pla abans de registrar-lo. Ha de tenir un diagnòstic ben formulat, almenys un resultat amb meta i almenys una intervenció amb activitats.",
    pai_check_dx: 'Diagnòstic amb causa (r/c) i, si és real, signes (m/p)', pai_check_noc: 'Almenys un resultat amb indicadors i meta', pai_check_nic: 'Almenys una intervenció amb activitats', pai_prio: 'Prioritat', pai_register: 'Registrar el pla', pai_fix: 'Corregeix això per continuar',
    pai_v_pat: 'Tria el patró o la necessitat alterada.', pai_v_datos: 'Escriu almenys una dada de la valoració (unes 10 lletres).', pai_v_dx: 'Tria un diagnòstic o escriu el teu.', pai_v_rc: 'Indica almenys una causa o factor (r/c).', pai_v_mp: 'Un diagnòstic real necessita almenys un signe o símptoma (m/p).',
    pai_v_noc: 'Afegeix almenys un resultat.', pai_v_ind: 'Marca almenys un indicador a cada resultat.', pai_v_meta: 'La meta ha de ser més gran que la puntuació de partida.', pai_v_nic: 'Afegeix almenys una intervenció.', pai_v_act: 'Marca almenys una activitat a cada intervenció.',
    pai_dx_h: 'Diagnòstic (NANDA)', pai_noc_h: 'Resultats (NOC)', pai_nic_h: 'Intervencions (NIC)', pai_val_h: 'Valoració', pai_ind: 'Indicador', pai_from: 'Inici', pai_eval_col: 'Avaluació', pai_evals: 'Avaluacions',
    pai_eval_h: "Mesura de nou cada indicador amb la mateixa escala (1 a 5) i compara amb la meta. Si no s'ha aconseguit, explica què ajustes.", pai_eval_auto: 'Resultat suggerit', pai_eval_adjust: "Reajust del pla (què canvies si no s'ha aconseguit)", pai_last: 'Darrera',
    tx_title: 'Biblioteca NANDA · NOC · NIC', tx_open: 'Biblioteca NANDA · NOC · NIC', tx_to_catalog: 'Catàleg de cures',
    tx_note: "Aquesta biblioteca guia el pla de cures de l'alumnat (cercador, suggeriments i pistes). Ve amb una selecció inicial petita d'etiquetes habituals i pistes redactades per a l'aplicació. NANDA-I, NOC i NIC són taxonomies amb drets d'autor: completa-la o corregeix-la amb el teu material amb llicència (manuals, documentació del centre). No s'inclouen els textos oficials.",
    tx_kind_nanda: 'Diagnòstics (NANDA)', tx_kind_noc: 'Resultats (NOC)', tx_kind_nic: 'Intervencions (NIC)', tx_code: 'Codi', tx_label_es: 'Etiqueta (castellà)', tx_label_ca: 'Etiqueta (català)', tx_hint_es: 'Quan fer-lo servir (castellà)', tx_hint_ca: 'Quan fer-lo servir (català)',
    tx_rc: 'Factors relacionats o de risc (r/c), un per línia', tx_mp: 'Signes i símptomes (m/p), un per línia', tx_ind: 'Indicadors, un per línia', tx_act: 'Activitats, una per línia', tx_ca_lines: '(en català)', tx_links_noc: 'Resultats suggerits', tx_links_nic: 'Intervencions suggerides',
    tx_add: 'Nova entrada', tx_import: 'Importar CSV', tx_export: 'Exportar CSV', tx_import_help: "Una entrada per línia, separada per «;»: tipus (nanda, noc o nic); codi; etiqueta en castellà; etiqueta en català; elements separats per « | » (indicadors o activitats; als diagnòstics, els r/c); i, només als diagnòstics, els m/p. Si l'etiqueta ja existeix, s'actualitza.",
    tx_imported: 'Importades: {c} noves, {u} actualitzades', tx_custom: 'pròpia', tx_inactive: 'desactivada', tx_search: 'Cercar…', tx_confirm_del: "Eliminar aquesta entrada? Els plans ja fets no canvien.", tx_saved: 'Desat', tx_tipo: 'Tipus de diagnòstic', tx_who: 'Qui la fa habitualment', tx_items: 'elements', tx_on: 'Activar', tx_off: 'Desactivar', tx_empty: 'No hi ha entrades.',
  });

  /* ---------- biblioteca ---------- */
  let TAX = null;
  async function loadTax(force) { if (!TAX || force) TAX = (await api('GET', '/api/taxonomy')).items; return TAX; }
  const lab = (e) => (lang() === 'ca' ? e.ca || e.es : e.es);
  const hintOf = (e) => (lang() === 'ca' ? e.hint_ca || e.hint_es : e.hint_es) || '';
  const itemsOf = (e, k) => ((lang() === 'ca' ? (e.items_ca || {})[k] : null) || (e.items_es || {})[k] || []);
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const search = (kind, q, skip) => {
    const words = norm(q).split(/\s+/).filter(Boolean); if (!words.length) return [];
    return TAX.filter((e) => e.kind === kind && !(skip || []).includes(e.slug) && (() => { const hay = norm([e.es, e.ca, e.code].concat(Object.values(e.items_es || {}).flat()).join(' ')); return words.every((w) => hay.includes(w)); })()).slice(0, 10);
  };
  const bySlug = (slug) => TAX.find((e) => e.slug === slug);
  const WHO_LABEL = { both: 'pai_who_both', nurse: 'pai_who_nurse', aux: 'pai_who_aux' };
  const ph = (e) => ({ slug: e.slug, code: e.code, es: e.es, ca: e.ca });
  const nOf = (x) => (lang() === 'ca' ? x.ca || x.es : x.es);

  /* ---------- frase PES ---------- */
  function pes(S) {
    const dx = S.dx ? lab(S.dx) : S.free.trim(), rc = [...S.rc, ...S.rcFree.split(',').map((x) => x.trim()).filter(Boolean)], mp = [...S.mp, ...S.mpFree.split(',').map((x) => x.trim()).filter(Boolean)];
    return { dx, rc, mp, text: dx + (rc.length ? ' r/c ' + rc.join(', ') : '') + (S.tipo === 'real' && mp.length ? ' m/p ' + mp.join(', ') : '') };
  }

  /* ---------- visualización de un plan (tarjeta y revisión) ---------- */
  function scoreBox(v, cls) { return h('span', { class: 'sb ' + (cls || '') }, String(v)); }
  function paiBody(d, evs) {
    const last = (n, i) => { for (const e of evs || []) { const f = ((e.data.ind) || []).find((x) => x.n === n && x.i === i); if (f) return f.valor; } return null; };
    const dx = d.nanda ? nOf(d.nanda) : d.problema, out = [];
    out.push(h('div', { class: 'pai-pes' }, h('b', null, dx), d.causa ? ' r/c ' + d.causa : '', d.signos && d.tipo === 'real' ? ' m/p ' + d.signos : ''));
    if (d.datos) out.push(h('p', { class: 'mut' }, (d.patron && PATRONES[d.patron] ? PATRONES[d.patron][lang() === 'ca' ? 1 : 0] + ' · ' : '') + d.datos));
    (d.noc || []).forEach((n, ni) => {
      out.push(h('div', { class: 'pai-h' }, h('span', { class: 'ev-kind' }, 'NOC'), h('b', null, nOf(n)), n.plazo ? h('span', { class: 'chip' }, t('pai_t' + n.plazo) || n.plazo + ' d') : h('span', { class: 'chip' }, t('pai_t0'))));
      out.push(h('table', { class: 'grid pai-t' }, h('thead', null, h('tr', null, [t('pai_ind'), t('pai_from'), t('pai_goal'), t('pai_eval_col')].map((x) => h('th', null, x)))),
        h('tbody', null, n.ind.map((i, ii) => { const v = last(ni, ii); return h('tr', null, h('td', null, i.t), h('td', null, scoreBox(i.ini)), h('td', null, scoreBox(i.meta, 'meta')), h('td', null, v == null ? '—' : [scoreBox(v, v >= i.meta ? 'ok' : v > i.ini ? 'mid' : 'bad'), v >= i.meta ? ' ✓' : ''])); }))));
    });
    (d.nic || []).forEach((n) => {
      out.push(h('div', { class: 'pai-h' }, h('span', { class: 'ev-kind' }, 'NIC'), h('b', null, nOf(n)), h('span', { class: 'chip' }, t(WHO_LABEL[n.quien] || 'pai_who_both')), n.freq ? h('span', { class: 'chip gry' }, n.freq) : null));
      out.push(h('ul', { class: 'pai-ul' }, n.act.map((a) => h('li', null, a))));
    });
    if (!(d.noc || []).length && !(d.nic || []).length) { out.push(h('dl', { class: 'ficha' }, d.objetivo ? h('div', { class: 'long' }, h('dt', null, t('pl_goal')), h('dd', null, d.objetivo)) : null, d.intervenciones ? h('div', { class: 'long' }, h('dt', null, t('pl_interv')), h('dd', null, d.intervenciones)) : null)); }
    return out;
  }

  /* ---------- pestaña «Plan de cuidados» ---------- */
  function tabPlan(X) {
    const plans = X.byType('plan'), evs = X.live('plan_eval'), canDo = !X.staff && X.open;
    const cards = plans.map((p) => {
      const mine = evs.filter((e) => e.data.plan_id === p.id), pr = p.data.prioridad;
      return h('div', { class: 'panel plan' + (p.void_at ? ' void' : '') }, h('div', { class: 'ph' }, p.data.nanda ? nOf(p.data.nanda) : p.data.problema, h('span', { class: 'chip ' + (pr === 'alta' ? 'red' : pr === 'media' ? 'amb' : 'gry') }, t('pl_' + { alta: 'high', media: 'mid', baja: 'low' }[pr]) || pr)),
        h('div', { class: 'pb' }, paiBody(p.data, mine),
          mine.length ? h('div', { class: 'pai-evs' }, h('b', null, t('pai_evals')), mine.map((e) => h('div', { class: 'cm' }, h('b', null, fmtDT(e.occurred) + ' · ' + t('pl_' + e.data.resultado) + ': '), e.data.texto || '', h('span', { class: 'sub' }, ' — ' + e.author)))) : null,
          X.voidInfo(p), X.cmts(p), h('div', { class: 'sub' }, fmtDT(p.occurred) + ' · ' + p.author),
          h('div', { class: 'row' }, !p.void_at && canDo ? h('button', { class: 'sm pri', onclick: () => X.openForm('plan_eval', null, { plan_id: p.id, title: p.data.nanda ? nOf(p.data.nanda) : p.data.problema, plan: p.data, evs: mine }) }, t('pl_eval')) : null, X.actions(p))));
    });
    return [canDo ? h('p', null, h('button', { class: 'pri', onclick: () => X.openForm('plan') }, '+ ' + t('pai_new'))) : null, cards.length ? cards : panel(null, empty(t('pl_empty')))];
  }

  /* ---------- asistente guiado ---------- */
  function wizard(X, done) {
    const TC = X.role === 'tcae', L = () => (lang() === 'ca' ? 'ca' : 'es');
    const S = { freeMode: false, step: 0, patron: '', datos: '', dx: null, free: '', tipo: 'real', rc: new Set(), rcFree: '', mp: new Set(), mpFree: '', noc: [], nic: [], prioridad: 'media', visited: 0 };
    const pf = X.prefill && X.prefill.noc ? X.prefill : null;
    if (pf) {
      S.patron = pf.patron || ''; S.datos = pf.datos || ''; S.tipo = pf.tipo || 'real'; S.dx = pf.nanda ? bySlug(pf.nanda.slug) || null : null; if (!S.dx) { S.free = (pf.nanda ? nOf(pf.nanda) : pf.problema) || ''; S.freeMode = true; }
      S.rcFree = pf.causa || ''; S.mpFree = pf.signos || ''; S.prioridad = pf.prioridad || 'media';
      S.noc = (pf.noc || []).map((n) => ({ e: bySlug(n.slug) || Object.assign({ items_es: {}, items_ca: {} }, n), plazo: n.plazo, ind: n.ind.map((i) => ({ t: i.t, ini: i.ini, meta: i.meta, on: true })), custom: '' }));
      S.nic = (pf.nic || []).map((n) => ({ e: bySlug(n.slug) || Object.assign({ items_es: {}, items_ca: {} }, n), quien: n.quien, freq: n.freq, act: n.act.map((a) => ({ t: a, on: true })), custom: '' }));
      S.visited = 4;
    }
    const body = h('div', { class: 'wz-body' }), nav = h('div', { class: 'wz-nav' }), bar = h('div', { class: 'wz-bar', role: 'tablist' }), errBox = h('div', { class: 'wz-err', role: 'alert' });
    const w = h('input', { type: 'datetime-local', value: X.caseDate ? X.caseDate + 'T' + nowInput().slice(11) : nowInput(), min: X.caseDate ? X.caseDate + 'T00:00' : null, max: X.caseDate ? X.caseDate + 'T23:59' : null });
    const tip = (key, ex) => h('details', { class: 'wz-tip', open: true }, h('summary', null, '💡 ' + t('pai_hint')), h('p', null, t(key)), ex ? h('p', { class: 'wz-ex' }, h('b', null, t('pai_example') + ': '), t(ex)) : null);
    const sel = (opts, val, on) => h('select', { onchange: (e) => on(e.target.value) }, opts.map(([v, l]) => h('option', { value: v, selected: String(v) === String(val) }, l)));
    const csv = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);

    /* validación por paso */
    const check = {
      0: () => { const p = []; if (!S.patron) p.push(t('pai_v_pat')); if (S.datos.trim().length < 10) p.push(t('pai_v_datos')); return p; },
      1: () => { const p = [], q = pes(S); if (!q.dx || q.dx.length < 4) p.push(t('pai_v_dx')); if (!q.rc.length) p.push(t('pai_v_rc')); if (S.tipo === 'real' && !q.mp.length) p.push(t('pai_v_mp')); return p; },
      2: () => { const p = []; if (!S.noc.length) p.push(t('pai_v_noc')); S.noc.forEach((n) => { const on = n.ind.filter((i) => i.on); if (!on.length) p.push(t('pai_v_ind') + ' (' + lab(n.e) + ')'); on.forEach((i) => { if (i.meta <= i.ini) p.push(t('pai_v_meta') + ' (' + i.t + ')'); }); }); return p; },
      3: () => { const p = []; if (!S.nic.length) p.push(t('pai_v_nic')); S.nic.forEach((n) => { if (!n.act.some((a) => a.on)) p.push(t('pai_v_act') + ' (' + lab(n.e) + ')'); }); return p; },
    };
    const problems = (upTo) => { let all = []; for (let s = 0; s <= upTo; s++) all = all.concat(check[s] ? check[s]() : []); return all; };

    /* componentes reutilizables */
    const pickList = (kind, skip, onPick, placeholder) => {
      const res = h('div', { class: 'wz-res' }), box = h('input', { type: 'search', placeholder, 'aria-label': placeholder });
      box.addEventListener('input', () => { clear(res); const hits = search(kind, box.value, skip()); if (box.value.trim() && !hits.length) add(res, h('p', { class: 'mut' }, t('pai_none'))); hits.forEach((e) => add(res, h('button', { type: 'button', class: 'wz-hit', onclick: () => { onPick(e); } }, h('b', null, (e.code ? e.code + ' · ' : '') + lab(e)), hintOf(e) ? h('span', { class: 'sub' }, hintOf(e).slice(0, 110) + (hintOf(e).length > 110 ? '…' : '')) : null))); });
      return h('div', null, box, res);
    };
    const suggested = (kind, chosen) => {
      const slugs = S.dx ? ((S.dx.links || {})[kind] || []) : []; const list = slugs.map(bySlug).filter((e) => e && !chosen().includes(e.slug));
      return list;
    };

    /* paso 1 */
    const step0 = () => [tip('pai_h1', 'pai_e1'),
      h('div', { class: 'cols' }, field(t('pai_pat'), sel([['', t('pai_pick_pat')]].concat(Object.keys(PATRONES).map((k) => [k, PATRONES[k][lang() === 'ca' ? 1 : 0]])), S.patron, (v) => { S.patron = v; })),
        field(t('pai_datos'), h('textarea', { rows: 3, value: S.datos, oninput: (e) => { S.datos = e.target.value; } })))];

    /* paso 2 */
    const step1 = () => {
      const out = [tip('pai_h2', 'pai_e2')], preview = h('div', { class: 'wz-pes', role: 'status' });
      const refresh = () => { clear(preview); const q = pes(S); add(preview, [h('span', { class: 'mut' }, t('pai_pes') + ': '), h('b', null, q.text || '—')]); };
      const dxBox = h('div'), freeCk = h('input', { type: 'checkbox', checked: S.freeMode, onchange: (e) => { S.freeMode = e.target.checked; if (S.freeMode) S.dx = null; redraw(); } });
      if (!S.freeMode) {
        add(dxBox, pickList('nanda', () => [], (e) => { S.dx = e; S.free = ''; S.tipo = e.tipo || 'real'; S.rc.clear(); S.mp.clear(); redraw(); }, t('pai_search_dx')));
        if (S.dx) add(dxBox, h('div', { class: 'wz-card' }, h('b', null, '✓ ' + lab(S.dx)), h('div', { class: 'sub' }, t('pai_when') + ': ' + hintOf(S.dx))));
      } else {
        add(dxBox, h('div', { class: 'cols' }, field(t('pai_free_ph'), h('input', { type: 'text', value: S.free, oninput: (e) => { S.free = e.target.value; refresh(); } })), field(t('pai_type'), sel([['real', t('pai_t_real')], ['riesgo', t('pai_t_riesgo')], ['promocion', t('pai_t_promocion')]], S.tipo, (v) => { S.tipo = v; redraw(); }))));
      }
      const chips = (title, key, freeKey, list) => h('div', { class: 'wz-card' }, h('b', null, title),
        list.length ? h('div', { class: 'wz-chips' }, list.map((x) => h('label', { class: 'row' }, h('input', { type: 'checkbox', checked: S[key].has(x), onchange: (e) => { e.target.checked ? S[key].add(x) : S[key].delete(x); refresh(); } }), x))) : null,
        field(t('pai_more'), h('input', { type: 'text', value: S[freeKey], oninput: (e) => { S[freeKey] = e.target.value; refresh(); } })));
      const risk = S.tipo !== 'real';
      out.push(h('label', { class: 'row' }, freeCk, t('pai_free')), dxBox);
      if (S.dx || S.free) { out.push(chips(risk ? t('pai_rc_risk') : t('pai_rc'), 'rc', 'rcFree', S.dx ? itemsOf(S.dx, 'rc') : [])); if (!risk) out.push(chips(t('pai_mp'), 'mp', 'mpFree', S.dx ? itemsOf(S.dx, 'mp') : [])); }
      refresh(); out.push(preview); return out;
    };

    /* paso 3 */
    const step2 = () => {
      const out = [tip('pai_h3', 'pai_e3'), h('p', { class: 'mut' }, t('pai_scale'))], list = h('div');
      const addNoc = (e) => { if (S.noc.length >= 3 || S.noc.some((n) => n.e.slug === e.slug)) return; S.noc.push({ e, plazo: 7, ind: itemsOf(e, 'ind').map((x) => ({ t: x, ini: 2, meta: 4, on: false })), custom: '' }); redraw(); };
      const sg = suggested('noc', () => S.noc.map((n) => n.e.slug));
      if (sg.length) out.push(h('div', { class: 'wz-card' }, h('b', null, t('pai_sugg')), h('div', { class: 'wz-chips' }, sg.map((e) => h('button', { type: 'button', class: 'sm', onclick: () => addNoc(e) }, '+ ' + lab(e))))));
      out.push(pickList('noc', () => S.noc.map((n) => n.e.slug), addNoc, t('pai_search_all')), list);
      S.noc.forEach((n, k) => {
        const rows = h('div'), drawRows = () => { clear(rows); n.ind.forEach((i) => add(rows, h('div', { class: 'wz-ind' }, h('label', { class: 'row grow' }, h('input', { type: 'checkbox', checked: i.on, onchange: (e) => { i.on = e.target.checked; drawRows(); } }), i.t),
          i.on ? h('span', { class: 'row' }, h('label', { class: 'row' }, t('pai_now'), sel([1, 2, 3, 4, 5].map((v) => [v, v]), i.ini, (v) => { i.ini = +v; })), h('label', { class: 'row' }, t('pai_goal'), sel([1, 2, 3, 4, 5].map((v) => [v, v]), i.meta, (v) => { i.meta = +v; }))) : null))); };
        drawRows();
        const cu = h('input', { type: 'text', placeholder: t('pai_ind_custom'), 'aria-label': t('pai_ind_custom') });
        add(list, h('div', { class: 'wz-card' }, h('div', { class: 'row' }, h('span', { class: 'ev-kind' }, 'NOC'), h('b', null, lab(n.e)), h('span', { class: 'grow' }), h('button', { type: 'button', class: 'sm danger', onclick: () => { S.noc.splice(k, 1); redraw(); } }, t('pai_remove'))),
          h('p', { class: 'mut' }, t('pai_pick_ind')), rows, h('div', { class: 'row' }, cu, h('button', { type: 'button', class: 'sm', onclick: () => { const v = cu.value.trim(); if (v) { n.ind.push({ t: v, ini: 2, meta: 4, on: true }); cu.value = ''; drawRows(); } } }, t('pai_ind_add'))),
          h('label', { class: 'row' }, t('pai_term'), sel([[3, t('pai_t3')], [7, t('pai_t7')], [14, t('pai_t14')], [0, t('pai_t0')]], n.plazo, (v) => { n.plazo = +v; }))));
      });
      return out;
    };

    /* paso 4 */
    const step3 = () => {
      const out = [tip('pai_h4', 'pai_e4')]; if (TC) out.push(h('p', { class: 'mut' }, t('pai_aux_note'))); const list = h('div');
      const addNic = (e) => { if (S.nic.length >= 5 || S.nic.some((n) => n.e.slug === e.slug)) return; S.nic.push({ e, quien: e.who === 'nurse' ? 'nurse' : TC ? 'aux' : 'both', freq: '', act: itemsOf(e, 'act').map((x) => ({ t: x, on: false })), custom: '' }); redraw(); };
      const sg = suggested('nic', () => S.nic.map((n) => n.e.slug));
      if (sg.length) out.push(h('div', { class: 'wz-card' }, h('b', null, t('pai_sugg')), h('div', { class: 'wz-chips' }, sg.map((e) => h('button', { type: 'button', class: 'sm', onclick: () => addNic(e) }, '+ ' + lab(e))))));
      out.push(pickList('nic', () => S.nic.map((n) => n.e.slug), addNic, t('pai_search_all')), list);
      S.nic.forEach((n, k) => {
        const rows = h('div'), drawRows = () => { clear(rows); n.act.forEach((a) => add(rows, h('label', { class: 'row' }, h('input', { type: 'checkbox', checked: a.on, onchange: (e) => { a.on = e.target.checked; } }), a.t))); }; drawRows();
        const cu = h('input', { type: 'text', placeholder: t('pai_act_custom'), 'aria-label': t('pai_act_custom') });
        add(list, h('div', { class: 'wz-card' }, h('div', { class: 'row' }, h('span', { class: 'ev-kind' }, 'NIC'), h('b', null, lab(n.e)), h('span', { class: 'grow' }), h('button', { type: 'button', class: 'sm danger', onclick: () => { S.nic.splice(k, 1); redraw(); } }, t('pai_remove'))),
          n.e.who === 'nurse' ? h('p', { class: 'mut' }, '⚠ ' + t('pai_nurse_tech')) : null, h('b', null, t('pai_acts')), rows, h('div', { class: 'row' }, cu, h('button', { type: 'button', class: 'sm', onclick: () => { const v = cu.value.trim(); if (v) { n.act.push({ t: v, on: true }); cu.value = ''; redraw(); } } }, t('pai_act_add'))),
          h('div', { class: 'cols' }, field(t('pai_who'), sel(Object.keys(WHO_LABEL).map((v) => [v, t(WHO_LABEL[v])]), n.quien, (v) => { n.quien = v; })), field(t('pai_freq'), h('input', { type: 'text', value: n.freq, placeholder: t('pai_freq_ph'), oninput: (e) => { n.freq = e.target.value; } })))));
      });
      return out;
    };

    /* datos finales */
    const build = () => {
      const q = pes(S);
      return { patron: S.patron, datos: S.datos.trim(), tipo: S.tipo, nanda: S.dx ? ph(S.dx) : null, problema: q.dx, causa: q.rc.join(', ').slice(0, 300), signos: S.tipo === 'real' ? q.mp.join(', ').slice(0, 600) : '', prioridad: S.prioridad,
        noc: S.noc.map((n) => Object.assign(ph(n.e), { plazo: n.plazo, ind: n.ind.filter((i) => i.on).map((i) => ({ t: i.t, ini: i.ini, meta: i.meta })) })),
        nic: S.nic.map((n) => Object.assign(ph(n.e), { quien: n.quien, freq: n.freq.trim(), act: n.act.filter((a) => a.on).map((a) => a.t) })) };
    };

    /* paso 5 */
    const step4 = () => {
      const d = build(), ok = (c) => h('li', { class: c.ok ? 'ok' : 'bad' }, (c.ok ? '✓ ' : '✗ ') + c.t);
      const checks = [{ ok: !check[1]().length && !check[0]().length, t: t('pai_check_dx') }, { ok: !check[2]().length, t: t('pai_check_noc') }, { ok: !check[3]().length, t: t('pai_check_nic') }];
      return [tip('pai_h5'), h('ul', { class: 'wz-check' }, checks.map(ok)), h('div', { class: 'panel plan' }, h('div', { class: 'pb' }, paiBody(d, []))),
        h('div', { class: 'cols' }, field(t('pai_prio'), sel([['alta', t('pl_high')], ['media', t('pl_mid')], ['baja', t('pl_low')]], S.prioridad, (v) => { S.prioridad = v; })), field(t('when'), w))];
    };
    const steps = [step0, step1, step2, step3, step4];

    function redraw() {
      clear(body); clear(errBox); clear(bar); clear(nav);
      ['pai_s1', 'pai_s2', 'pai_s3', 'pai_s4', 'pai_s5'].forEach((k, i) => add(bar, h('button', { type: 'button', role: 'tab', 'aria-selected': i === S.step ? 'true' : 'false', class: 'wz-step' + (i === S.step ? ' on' : i < S.visited ? ' done' : ''), disabled: i > S.visited, onclick: () => { S.step = i; redraw(); } }, t(k))));
      steps[S.step]().forEach((n) => add(body, n));
      add(nav, h('button', { type: 'button', disabled: S.step === 0, onclick: () => { S.step--; redraw(); } }, t('pai_prev')));
      if (S.step < 4) add(nav, h('button', { type: 'button', class: 'pri', onclick: () => { const p = check[S.step](); if (p.length) { add(errBox, h('div', null, h('b', null, t('pai_fix') + ':'), h('ul', null, p.map((x) => h('li', null, x))))); return; } S.step++; S.visited = Math.max(S.visited, S.step); redraw(); } }, t('pai_next')));
      else add(nav, h('button', { type: 'submit', class: 'pri' }, t('pai_register')));
      add(nav, h('button', { type: 'button', onclick: () => done(false) }, t('cancel')));
    }
    const form = h('form', { class: 'panel formp wz', onsubmit: async (e) => {
      e.preventDefault(); const p = problems(3); if (p.length) { clear(errBox); add(errBox, h('div', null, h('b', null, t('pai_fix') + ':'), h('ul', null, p.map((x) => h('li', null, x))))); return; }
      try { await api('POST', '/api/charts/' + X.chartId + '/records', { type: 'plan', data: build(), occurred: w.value, replaces_id: X.replaces || undefined }); toast(t('saved')); done(true); } catch (er) { fail(er); }
    } }, h('div', { class: 'ph' }, t('pai_title') + (X.replaces ? ' — ' + t('replaces') + ' #' + X.replaces : '')), h('div', { class: 'pb' }, bar, body, errBox, nav));
    redraw(); return form;
  }

  function wizardAsync(X, done) {
    if (TAX) return wizard(X, done);
    const box = h('div', { class: 'panel formp' }, h('div', { class: 'pb mut' }, '…'));
    loadTax().then(() => box.replaceWith(wizard(X, done))).catch((e) => { fail(e); done(false); });
    return box;
  }

  /* ---------- evaluación guiada ---------- */
  function evalForm(X, done) {
    const pf = X.prefill || {}, plan = pf.plan;
    if (!plan || !plan.noc || !plan.noc.length) {
      const res0 = h('select', null, ['conseguido', 'parcial', 'no_conseguido'].map((v) => h('option', { value: v }, t('pl_' + v)))), txt0 = h('textarea');
      return window.HCX.shell('plan_eval', X, [h('p', { class: 'mut' }, pf.title || ''), field(t('pl_result'), res0), field(t('pl_ev_text'), txt0)], () => ({ plan_id: pf.plan_id, resultado: res0.value, texto: txt0.value }), done);
    }
    const last = (n, i) => { for (const e of pf.evs || []) { const f = (e.data.ind || []).find((x) => x.n === n && x.i === i); if (f) return f.valor; } return null; };
    const vals = []; plan.noc.forEach((n, ni) => n.ind.forEach((i, ii) => vals.push({ n: ni, i: ii, ind: i, valor: last(ni, ii) || i.ini })));
    const sugg = h('span', { class: 'chip' }), res = h('select', null, ['conseguido', 'parcial', 'no_conseguido'].map((v) => h('option', { value: v }, t('pl_' + v)))), txt = h('textarea', { rows: 3 });
    let touched = false; res.addEventListener('change', () => { touched = true; });
    const autoRes = () => { const all = vals.every((x) => x.valor >= x.ind.meta), some = vals.some((x) => x.valor > x.ind.ini); const r = all ? 'conseguido' : some ? 'parcial' : 'no_conseguido'; sugg.textContent = t('pai_eval_auto') + ': ' + t('pl_' + r); if (!touched) res.value = r; };
    const rows = plan.noc.map((n, ni) => h('div', { class: 'wz-card' }, h('b', null, nOf(n)), vals.filter((x) => x.n === ni).map((x) => h('div', { class: 'wz-ind' }, h('span', { class: 'grow' }, x.ind.t, h('span', { class: 'sub' }, ' · ' + t('pai_from') + ' ' + x.ind.ini + ' → ' + t('pai_goal') + ' ' + x.ind.meta)),
      h('label', { class: 'row' }, t('pai_now'), h('select', { onchange: (e) => { x.valor = +e.target.value; autoRes(); } }, [1, 2, 3, 4, 5].map((v) => h('option', { value: v, selected: v === x.valor }, v))))))));
    autoRes();
    return window.HCX.shell('plan_eval', X, [h('p', { class: 'mut' }, pf.title || ''), h('p', { class: 'mut' }, t('pai_eval_h')), h('p', { class: 'mut' }, t('pai_scale')), rows, sugg, field(t('pl_result'), res), field(t('pai_eval_adjust'), txt)],
      () => ({ plan_id: pf.plan_id, resultado: res.value, texto: txt.value, ind: vals.map((x) => ({ n: x.n, i: x.i, valor: x.valor })) }), done);
  }

  /* ---------- pantalla de la biblioteca (profesorado) ---------- */
  async function viewTaxonomy() {
    const items = (await api('GET', '/api/taxonomy?all=1')).items; TAX = items.filter((e) => e.active);
    let kind = 'nanda', q = ''; const listBox = h('div'), edBox = h('div'), kinds = h('div', { class: 'row' }), qIn = h('input', { type: 'search', placeholder: t('tx_search'), 'aria-label': t('tx_search'), oninput: (e) => { q = e.target.value; drawList(); } });
    const reload = async () => { await viewTaxonomy(); };
    const lines = (a) => (a || []).join('\n'), split = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
    function editor(e, k) {
      const f = {}, ta = (v, r) => h('textarea', { rows: r || 4, value: v }), inp = (v) => h('input', { type: 'text', value: v || '' });
      f.code = inp(e && e.code); f.es = inp(e && e.es); f.ca = inp(e && e.ca); f.hes = ta(e ? e.hint_es : '', 2); f.hca = ta(e ? e.hint_ca : '', 2);
      const ie = (e && e.items_es) || {}, ic = (e && e.items_ca) || {}, keys = k === 'nanda' ? ['rc', 'mp'] : k === 'noc' ? ['ind'] : ['act'];
      keys.forEach((kk) => { f[kk + '_es'] = ta(lines(ie[kk])); f[kk + '_ca'] = ta(lines(ic[kk])); });
      f.tipo = h('select', null, ['real', 'riesgo', 'promocion'].map((v) => h('option', { value: v, selected: e && e.tipo === v }, t('pai_t_' + v)))); f.who = h('select', null, Object.keys(WHO_LABEL).map((v) => h('option', { value: v, selected: (e && e.who || 'both') === v }, t(WHO_LABEL[v]))));
      const msel = (kd) => { const s = h('select', { multiple: true, size: 8 }, items.filter((x) => x.kind === kd).map((x) => h('option', { value: x.slug, selected: !!(e && e.links && (e.links[kd] || []).includes(x.slug)) }, lab(x)))); return s; };
      if (k === 'nanda') { f.lnoc = msel('noc'); f.lnic = msel('nic'); }
      const lbl = { rc: t('tx_rc'), mp: t('tx_mp'), ind: t('tx_ind'), act: t('tx_act') };
      const body = () => ({ kind: k, code: f.code.value, es: f.es.value, ca: f.ca.value, hint_es: f.hes.value, hint_ca: f.hca.value, tipo: f.tipo.value, who: f.who.value,
        items_es: Object.fromEntries(keys.map((kk) => [kk, split(f[kk + '_es'].value)])), items_ca: Object.fromEntries(keys.map((kk) => [kk, split(f[kk + '_ca'].value)])),
        links: k === 'nanda' ? { noc: [...f.lnoc.selectedOptions].map((o) => o.value), nic: [...f.lnic.selectedOptions].map((o) => o.value) } : {} });
      clear(edBox);
      add(edBox, h('div', { class: 'panel' }, h('div', { class: 'ph' }, e ? lab(e) : t('tx_add')), h('div', { class: 'pb' },
        h('div', { class: 'cols' }, field(t('tx_code'), f.code), field(t('tx_label_es'), f.es), field(t('tx_label_ca'), f.ca), k === 'nanda' ? field(t('tx_tipo'), f.tipo) : null, k === 'nic' ? field(t('tx_who'), f.who) : null),
        k === 'nanda' ? h('div', { class: 'cols' }, field(t('tx_hint_es'), f.hes), field(t('tx_hint_ca'), f.hca)) : null,
        keys.map((kk) => h('div', { class: 'cols' }, field(lbl[kk], f[kk + '_es']), field(lbl[kk] + ' ' + t('tx_ca_lines'), f[kk + '_ca']))),
        k === 'nanda' ? h('div', { class: 'cols' }, field(t('tx_links_noc'), f.lnoc), field(t('tx_links_nic'), f.lnic)) : null,
        h('p', { class: 'row' }, h('button', { class: 'pri', onclick: async () => { try { if (e) await api('PUT', '/api/taxonomy/' + e.id, body()); else await api('POST', '/api/taxonomy', body()); toast(t('tx_saved')); await reload(); } catch (er) { fail(er); } } }, t('save')), h('button', { onclick: () => clear(edBox) }, t('cancel'))))));
      edBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    function drawList() {
      clear(listBox); clear(kinds);
      ['nanda', 'noc', 'nic'].forEach((k) => add(kinds, h('button', { class: k === kind ? 'pri' : '', onclick: () => { kind = k; clear(edBox); drawList(); } }, t('tx_kind_' + k) + ' (' + items.filter((x) => x.kind === k).length + ')')));
      const words = norm(q).split(/\s+/).filter(Boolean), rows = items.filter((e) => e.kind === kind && words.every((w) => norm(e.es + ' ' + e.ca + ' ' + e.code).includes(w)));
      add(listBox, rows.length ? panel(null, h('div', { class: 'tw' }, h('table', { class: 'grid' }, h('tbody', null, rows.map((e) => h('tr', { class: e.active ? '' : 'void' }, h('td', null, e.code || '—'), h('td', null, h('b', null, lab(e)), e.custom ? h('span', { class: 'chip' }, t('tx_custom')) : null, e.active ? null : h('span', { class: 'chip amb' }, t('tx_inactive')),
        h('div', { class: 'sub' }, Object.values(e.items_es || {}).reduce((a, b) => a + b.length, 0) + ' ' + t('tx_items') + (kind === 'nanda' ? ' · NOC ' + ((e.links || {}).noc || []).length + ' · NIC ' + ((e.links || {}).nic || []).length : ''))),
        h('td', null, h('div', { class: 'row' }, h('button', { class: 'sm', onclick: () => editor(e, kind) }, t('edit')), h('button', { class: 'sm', onclick: async () => { try { await api('PUT', '/api/taxonomy/' + e.id, { active: !e.active }); await reload(); } catch (er) { fail(er); } } }, e.active ? t('tx_off') : t('tx_on')),
          h('button', { class: 'sm danger', onclick: async () => { if (!confirm(t('tx_confirm_del'))) return; try { await api('DELETE', '/api/taxonomy/' + e.id); await reload(); } catch (er) { fail(er); } } }, t('delete'))))))))), { flush: true }) : panel(null, empty(t('tx_empty'))));
    }
    const csvTa = h('textarea', { rows: 6, placeholder: 'tipo;codigo;es;ca;elementos;elementos_mp' });
    drawList();
    HC.show(h('div', { class: 'pg-title' }, h('button', { class: 'link', onclick: () => { location.hash = '#/catalog'; } }, t('back') + ' · ' + t('tx_to_catalog')), h('div', { class: 'row' }, h('a', { class: 'btn', href: '/api/taxonomy.csv', download: '' }, t('tx_export')), h('button', { class: 'pri', onclick: () => editor(null, kind) }, '+ ' + t('tx_add')))),
      h('h1', null, t('tx_title')), h('div', { class: 'hp-box warn' }, t('tx_note')), h('div', { class: 'toolbar row' }, kinds, qIn), edBox, listBox,
      h('details', { class: 'panel' }, h('summary', null, t('tx_import')), h('div', { class: 'pb' }, h('p', { class: 'mut' }, t('tx_import_help')), csvTa, h('p', null, h('button', { class: 'pri', onclick: async () => { try { const r = await api('POST', '/api/taxonomy/import', { text: csvTa.value }); toast(t('tx_imported').replace('{c}', r.created).replace('{u}', r.updated) + (r.errors.length ? ' · ' + r.errors.length + ' ⚠' : '')); if (r.errors.length) alert(r.errors.map((x) => 'L' + x.line + ': ' + x.msg).join('\n')); await reload(); } catch (er) { fail(er); } } }, t('tx_import'))))));
  }

  Object.assign(window.HCX, { paiTab: tabPlan, paiWizard: wizard, paiWizardAsync: wizardAsync, paiEval: evalForm, viewTaxonomy, loadTax, paiBody });
})();
