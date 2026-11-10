'use strict';
(function () {
  const main = document.getElementById('main'), top = document.getElementById('top'), toastEl = document.getElementById('toast');
  let ME = null, LANG = (navigator.language || 'es').startsWith('ca') ? 'ca' : 'es', chartKey = 0, chartUser = '';

  /* Textos nuevos de la interfaz clínica (se suman a los de i18n.js). */
  Object.assign(window.I18N.es, {
    col_patient: 'Paciente', col_age: 'Edad / sexo', col_loc: 'Unidad / cama', col_dx: 'Diagnóstico', col_chart: 'Historia', col_mine: 'Mis registros', col_state: 'Estado', col_students: 'Historias', col_records: 'Registros', col_author: 'Autor', col_time: 'Fecha y hora', col_detail: 'Detalle', col_result: 'Resultado', col_actions: 'Acciones', col_last: 'Último registro', col_type: 'Tipo', col_members: 'Miembros', col_id: 'Código',
    tab_resumen: 'Resumen', tab_evolucion: 'Evolución', tab_constantes: 'Constantes', tab_balance: 'Balance hídrico', tab_cuidados: 'Cuidados', tab_ficha: 'Ficha', tab_asignar: 'Asignación', tab_historias: 'Historias', tab_actividad: 'Actividad',
    f_age: 'Edad', age_years: 'años', b_dob: 'F. nacimiento', b_loc: 'Ubicación', allergies: 'Alergias', allergies_none: 'Sin alergias conocidas', allergies_unk: 'Alergias no registradas',
    p_admission: 'Datos del ingreso', p_last_vitals: 'Últimas constantes', p_last_note: 'Última nota de evolución', worklist: 'Lista de pacientes', no_data: 'Sin datos todavía.',
    fl_param: 'Parámetro', fl_legend: 'Fuera de rango (adulto, orientativo): ▲ alto, ▼ bajo.', fl_voided: 'Anulado', bal_day: 'Día', bal_in: 'Entradas (ml)', bal_out: 'Salidas (ml)', bal_net: 'Balance (ml)', ask_ok: 'Aceptar', today_rec: 'Registrar ahora',
    nav_help: 'Ayuda', tb_record: 'Registrar', comments_by: 'Comentario de', open_it: 'Abrir', teacher_only: 'Solo profesorado: el alumnado no ve este apartado',
  });
  Object.assign(window.I18N.ca, {
    col_patient: 'Pacient', col_age: 'Edat / sexe', col_loc: 'Unitat / llit', col_dx: 'Diagnòstic', col_chart: 'Història', col_mine: 'Els meus registres', col_state: 'Estat', col_students: 'Històries', col_records: 'Registres', col_author: 'Autor', col_time: 'Data i hora', col_detail: 'Detall', col_result: 'Resultat', col_actions: 'Accions', col_last: 'Últim registre', col_type: 'Tipus', col_members: 'Membres', col_id: 'Codi',
    tab_resumen: 'Resum', tab_evolucion: 'Evolució', tab_constantes: 'Constants', tab_balance: 'Balanç hídric', tab_cuidados: 'Cures', tab_ficha: 'Fitxa', tab_asignar: 'Assignació', tab_historias: 'Històries', tab_actividad: 'Activitat',
    f_age: 'Edat', age_years: 'anys', b_dob: 'D. naixement', b_loc: 'Ubicació', allergies: 'Al·lèrgies', allergies_none: 'Sense al·lèrgies conegudes', allergies_unk: 'Al·lèrgies no registrades',
    p_admission: "Dades de l'ingrés", p_last_vitals: 'Últimes constants', p_last_note: "Última nota d'evolució", worklist: 'Llista de pacients', no_data: 'Sense dades encara.',
    fl_param: 'Paràmetre', fl_legend: 'Fora de rang (adult, orientatiu): ▲ alt, ▼ baix.', fl_voided: 'Anul·lat', bal_day: 'Dia', bal_in: 'Entrades (ml)', bal_out: 'Sortides (ml)', bal_net: 'Balanç (ml)', ask_ok: 'Acceptar', today_rec: 'Registrar ara',
    nav_help: 'Ajuda', tb_record: 'Registrar', comments_by: 'Comentari de', open_it: 'Obrir', teacher_only: "Només professorat: l'alumnat no veu aquest apartat",
  });
  const t = (k) => (window.I18N[LANG] && window.I18N[LANG][k]) || window.I18N.es[k] || k;

  /* ---------- utilidades ---------- */
  function h(tag, attrs) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k === 'value') el.value = v;
      else if (k === 'checked' || k === 'selected' || k === 'disabled' || k === 'required') el[k] = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (let i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach((x) => add(el, x)); else el.appendChild(c.nodeType ? c : document.createTextNode(String(c))); }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function show(...nodes) { clear(main); nodes.forEach((n) => add(main, n)); main.focus({ preventScroll: true }); window.scrollTo(0, 0); }
  function toast(msg, err) { toastEl.textContent = msg; toastEl.className = 'show' + (err ? ' err' : ''); clearTimeout(toast.t); toast.t = setTimeout(() => { toastEl.className = ''; }, 3500); }
  async function api(method, url, body) {
    const r = await fetch(url, { method, credentials: 'same-origin', headers: { 'X-Requested-With': 'historia', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    let j = null; try { j = await r.json(); } catch (_) {}
    if (r.status === 401 && !url.startsWith('/api/admin/login') && !url.startsWith('/api/teacher/login')) { ME = null; renderLogin(); throw new Error('auth'); }
    if (!r.ok) { const e = new Error((j && j.error) || 'error'); e.status = r.status; throw e; }
    return j;
  }
  const fail = (e) => { if (e.message === 'preview') return toast(t('prev_ro'), true); if (e.message === 'day-closed') return toast(t('dy_closed'), true); if (e.message === 'last-day') return toast(t('dy_last'), true); if (e.message !== 'auth') { const k = 'e_' + String(e.message).replace(/-/g, '_'), tx = e.message ? t(k) : ''; toast(tx && tx !== k ? tx : t('err') + (e.message && e.message !== 'error' ? ' (' + e.message + ')' : ''), true); } };
  const pad = (n) => String(n).padStart(2, '0');
  const fmtD = (s) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '');
  const fmtDT = (s) => (s ? s.slice(8, 10) + '/' + s.slice(5, 7) + ' ' + s.slice(11, 16) : '');
  const fmtISO = (s) => { try { return new Date(s).toLocaleString(LANG === 'ca' ? 'ca-ES' : 'es-ES', { dateStyle: 'short', timeStyle: 'short' }); } catch (_) { return s; } };
  const nowInput = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const ageOf = (iso) => { if (!iso) return ''; const b = new Date(iso), n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return a >= 0 ? a : ''; };
  let fid = 0; const field = (label, input) => { const c = input && (input.matches && input.matches('input,select,textarea') ? input : input.querySelector && input.querySelector('input,select,textarea')); if (c && !c.id) c.id = 'hf' + (++fid); return h('div', null, h('label', c ? { for: c.id } : null, label), input); };
  const name = (d) => (d.apellidos || '') + ', ' + (d.nombre || '');
  const stateChip = (open) => h('span', { class: 'chip ' + (open ? 'grn' : 'amb') }, open ? t('status_open') : t('status_closed'));
  const panel = (title, body, opts) => h('div', { class: 'panel' + (opts && opts.cls ? ' ' + opts.cls : '') }, title ? h('div', { class: 'ph' }, title, opts && opts.right) : null, h('div', { class: 'pb' + (opts && opts.flush ? ' flush' : '') }, body));
  const empty = (msg) => h('div', { class: 'empty' }, msg || t('no_data'));

  /* Pregunta con texto libre en un diálogo (anular, comentar). Devuelve el texto o null. */
  function ask(title, label, min) {
    return new Promise((resolve) => {
      const ta = h('textarea'); let done = false;
      const dlg = h('dialog', null, h('form', { onsubmit: (e) => { e.preventDefault(); if (ta.value.trim().length < (min || 1)) { ta.focus(); return; } finish(ta.value.trim()); } },
        h('div', { class: 'dh' }, title), h('div', { class: 'db' }, label ? h('p', { class: 'mut' }, label) : null, ta),
        h('div', { class: 'df' }, h('button', { type: 'button', onclick: () => finish(null) }, t('cancel')), h('button', { class: 'pri', type: 'submit' }, t('ask_ok')))));
      function finish(v) { if (done) return; done = true; try { dlg.close(); } catch (_) {} dlg.remove(); resolve(v); }
      dlg.addEventListener('cancel', () => finish(null));
      document.body.appendChild(dlg); dlg.showModal(); ta.focus();
    });
  }

  /* ---------- barra de aplicación ---------- */
  function renderTop() {
    clear(top);
    add(top, h('span', { class: 'brand' }, h('img', { src: '/favicon-32.png', alt: '' }), h('span', { class: 'bt' }, t('app'))));
    if (ME) {
      const seg = location.hash.replace(/^#\/?/, '').split('/')[0];
      const cur = seg === 'students' || seg === 'catalog' || seg === 'taxonomy' || seg === 'audit' || seg === 'grades' || seg === 'help' ? seg : 'home';
      const items = ME.staff ? [['home', '#/', 'nav_patients'], ['students', '#/students', 'nav_students'], ['catalog', '#/catalog', 'nav_catalog'], ['grades', '#/grades', 'nav_grades'], ['audit', '#/audit', 'nav_audit'], ['help', '#/help', 'nav_help']] : [['home', '#/', 'nav_mine'], ['help', '#/help', 'nav_help']];
      add(top, h('nav', { 'aria-label': 'Principal' }, items.map(([k, href, l]) => h('button', { class: cur === k ? 'on' : '', onclick: () => { location.hash = href; } }, t(l)))));
      add(top, h('span', { class: 'who' }, ME.name));
    } else add(top, h('nav'));
    add(top, h('button', { class: 'tb', 'aria-label': t('lang'), onclick: () => { LANG = LANG === 'es' ? 'ca' : 'es'; document.documentElement.lang = LANG; if (ME) api('PUT', '/api/me', { lang: LANG }).catch(() => {}); renderTop(); ME ? route() : renderLogin(); } }, LANG === 'es' ? 'CA' : 'ES'));
    const pb = document.getElementById('prevbar'); if (pb) pb.remove();
    if (ME && ME.preview) top.after(h('div', { id: 'prevbar', class: 'prevbar', role: 'status' }, h('span', null, t('prev_ro')), h('button', { class: 'sm', onclick: async () => { try { await api('POST', '/api/preview/exit'); await boot(); location.hash = '#/'; } catch (e) { fail(e); } } }, t('prev_exit'))));
    if (ME) add(top, h('button', { class: 'tb', onclick: async () => { await api('POST', '/api/logout').catch(() => {}); ME = null; renderLogin(); } }, t('logout')));
  }

  function renderLogin() {
    renderTop();
    const pw = h('input', { type: 'password', autocomplete: 'current-password' }), em = h('input', { type: 'email', autocomplete: 'username', placeholder: t('login_email_ph') });
    const f = h('form', { onsubmit: async (e) => { e.preventDefault(); try { if (em.value.trim()) await api('POST', '/api/teacher/login', { email: em.value, password: pw.value }); else await api('POST', '/api/admin/login', { password: pw.value }); await boot(); } catch (er) { toast(er.status === 429 ? t('too_many') : t('bad_pw'), true); } } },
      field(t('login_email'), em), field(t('admin_pw'), pw), h('p', null, h('button', { class: 'pri', type: 'submit' }, t('enter'))));
    show(h('div', { class: 'login' }, panel(t('login_title'), [h('p', null, t('login_campus')), h('p', null, h('a', { class: 'btn pri', href: 'https://campus.luisfs.com' }, t('login_btn')))]),
      h('details', { class: 'panel' }, h('summary', null, t('admin_pw')), h('div', { class: 'pb' }, f))));
  }

  /* ---------- banda de paciente y pestañas ---------- */
  function banner(p, right) {
    const d = p.data, al = d.alergias || [], age = ageOf(d.fecha_nacimiento);
    const f = (l, v) => (v ? h('div', { class: 'bn-f' }, h('span', null, l), h('b', null, v)) : null);
    const loc = [d.unidad, d.habitacion && 'H ' + d.habitacion, d.cama && 'C ' + d.cama].filter(Boolean).join(' / ');
    const alEl = al.length ? h('span', { class: 'al' }, '⚠ ' + t('allergies') + ': ' + al.map((a) => a.agente + (a.reaccion ? ' (' + a.reaccion + ')' : '')).join('; '))
      : d.sin_alergias ? h('span', { class: 'al none' }, t('allergies_none')) : h('span', { class: 'al unk' }, t('allergies_unk'));
    return h('div', { class: 'banner' },
      h('div', { class: 'b1' }, h('div', { class: 'bn-name' }, name(d)), f(t('f_age'), age !== '' ? age + ' ' + t('age_years') : ''), f(t('f_sexo'), d.sexo ? t('sex_' + d.sexo) : ''), f(t('b_dob'), fmtD(d.fecha_nacimiento)), f('NHC', d.nhc || p.code), f(t('b_loc'), loc)),
      h('div', { class: 'b2' }, alEl, (d.aislamiento || (d.aislamiento_tipos || []).length) ? h('span', { class: 'chip ' + ((d.aislamiento_tipos || []).length ? 'red' : 'amb') }, t('f_aislamiento') + ': ' + [(d.aislamiento_tipos || []).map((k) => t('ais_' + k)).join(' + '), d.aislamiento].filter(Boolean).join(' · ')) : null, d.dieta ? h('span', { class: 'chip' }, t('f_dieta') + ': ' + d.dieta) : null, right ? h('span', { class: 'row' }, right) : null));
  }
  const tabBar = (tabs, cur, base) => h('div', { class: 'tabs', role: 'tablist' }, tabs.map(([k, label, n]) => h('button', { role: 'tab', 'aria-selected': k === cur ? 'true' : 'false', class: k === cur ? 'on' : '', onclick: () => { location.hash = base + '/' + k; } }, label, n ? h('span', { class: 'cnt' }, n) : null)));

  /* ---------- ficha del paciente ---------- */
  const SECTIONS = [
    ['sec_ident', ['nombre', 'apellidos', 'sexo', 'fecha_nacimiento', 'nhc', 'unidad', 'habitacion', 'cama', 'fecha_ingreso', 'procedencia', 'motivo_ingreso']],
    ['sec_clin', ['enfermedad_actual', 'diagnostico_medico', 'dieta', 'aislamiento', 'riesgos', 'medicacion_habitual']],
    ['sec_ant', ['antecedentes_personales', 'antecedentes_familiares', 'intervenciones_previas']],
    ['sec_val', ['peso', 'talla', 'grupo_sanguineo', 'autonomia', 'habitos', 'situacion_social', 'contacto_familiar']],
    ['sec_teacher', ['notas_docente', 'objetivos_aprendizaje']],
  ];
  const LONG = new Set(['motivo_ingreso', 'enfermedad_actual', 'diagnostico_medico', 'antecedentes_personales', 'antecedentes_familiares', 'intervenciones_previas', 'medicacion_habitual', 'autonomia', 'habitos', 'situacion_social', 'riesgos', 'notas_docente', 'objetivos_aprendizaje']);
  const DATES = new Set(['fecha_nacimiento', 'fecha_ingreso']), NUMS = new Set(['peso', 'talla']);
  const dl = (d, keys) => {
    const ks = keys.filter((k) => d[k] != null && d[k] !== ''), item = (k) => {
      let v = d[k]; if (k === 'sexo') v = t('sex_' + v); if (DATES.has(k)) v = fmtD(v);
      return h('div', { class: LONG.has(k) ? 'long' : null }, h('dt', null, t('f_' + k)), h('dd', null, String(v)));
    };
    return h('dl', { class: 'ficha' }, ks.filter((k) => !LONG.has(k)).map(item), ks.filter((k) => LONG.has(k)).map(item));
  };
  function fichaPanels(p, staff) {
    const d = p.data, out = [];
    const al = d.alergias || [];
    out.push(panel(t('sec_allergy'), al.length ? h('table', { class: 'grid' }, h('thead', null, h('tr', null, h('th', null, t('allergy_agent')), h('th', null, t('allergy_reaction')), h('th', null, t('allergy_sev')))), h('tbody', null, al.map((a) => h('tr', null, h('td', null, h('b', null, a.agente)), h('td', null, a.reaccion), h('td', null, a.gravedad ? h('span', { class: 'chip ' + (a.gravedad === 'grave' ? 'red' : 'amb') }, t('sev_' + a.gravedad)) : ''))))) : h('span', null, d.sin_alergias ? t('allergies_none') : t('allergies_unk')), { flush: al.length > 0 }));
    SECTIONS.forEach(([sk, keys]) => {
      if (sk === 'sec_teacher' && !staff) return;
      if (!keys.some((k) => d[k] != null && d[k] !== '')) return;
      out.push(panel(t(sk), dl(d, keys), sk === 'sec_teacher' ? { cls: 'warn' } : null));
    });
    return out;
  }

  function patientForm(existing) {
    const d = existing ? existing.data : {}, inputs = {};
    const sections = SECTIONS.map(([sk, keys]) => panel(t(sk), h('div', { class: 'cols' }, keys.map((k) => {
      let el;
      if (k === 'sexo') el = h('select', null, ['', 'M', 'F', 'O'].map((v) => h('option', { value: v, selected: d.sexo === v }, v ? t('sex_' + v) : '—')));
      else if (k === 'grupo_sanguineo') el = h('select', null, ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-'].map((v) => h('option', { value: v, selected: d[k] === v }, v || '—')));
      else if (LONG.has(k)) el = h('textarea', { value: d[k] || '' });
      else if (DATES.has(k)) el = h('input', { type: 'date', value: d[k] || '' });
      else if (NUMS.has(k)) el = h('input', { type: 'text', inputmode: 'decimal', value: d[k] != null ? d[k] : '' });
      else el = h('input', { type: 'text', value: d[k] || '', required: k === 'nombre' || k === 'apellidos' });
      inputs[k] = el; return field(t('f_' + k) + (k === 'nombre' || k === 'apellidos' ? ' *' : ''), el);
    })), sk === 'sec_teacher' ? { cls: 'warn' } : null));
    const AIS = ['contacto', 'gotas', 'aereo', 'protector'], aisBox = {}; AIS.forEach((k) => { aisBox[k] = h('input', { type: 'checkbox', checked: (d.aislamiento_tipos || []).includes(k) }); });
    const aisCard = panel(t('ais_types'), [h('div', { class: 'row' }, AIS.map((k) => h('label', { class: 'row' }, aisBox[k], t('ais_' + k)))), h('p', { class: 'mut' }, t('ais_help'))]);
    const alList = h('div'); let alRows = [];
    const addAl = (a) => {
      const r = { agente: h('input', { type: 'text', value: a.agente || '', placeholder: t('allergy_agent') }), reaccion: h('input', { type: 'text', value: a.reaccion || '', placeholder: t('allergy_reaction') }), gravedad: h('select', null, ['', 'leve', 'moderada', 'grave'].map((v) => h('option', { value: v, selected: a.gravedad === v }, v ? t('sev_' + v) : t('allergy_sev')))) };
      const row = h('div', { class: 'row' }, r.agente, r.reaccion, r.gravedad, h('button', { type: 'button', class: 'danger sm', onclick: () => { alRows = alRows.filter((x) => x !== r); row.remove(); } }, '✕'));
      alRows.push(r); alList.appendChild(row);
    };
    (d.alergias || []).forEach(addAl);
    const noAl = h('input', { type: 'checkbox', checked: !!d.sin_alergias });
    const alCard = panel(t('sec_allergy'), [alList, h('p', null, h('button', { type: 'button', onclick: () => addAl({}) }, t('add_allergy'))), h('label', null, noAl, ' ' + t('no_allergy'))]);
    return h('form', {
      onsubmit: async (e) => {
        e.preventDefault();
        const body = {}; for (const [k, el] of Object.entries(inputs)) body[k] = el.value;
        body.aislamiento_tipos = AIS.filter((k) => aisBox[k].checked);
        body.alergias = alRows.map((r) => ({ agente: r.agente.value, reaccion: r.reaccion.value, gravedad: r.gravedad.value })).filter((a) => a.agente.trim());
        body.sin_alergias = noAl.checked;
        try { const r = existing ? await api('PUT', '/api/patients/' + existing.id, body) : await api('POST', '/api/patients', body); toast(t('ok')); location.hash = '#/patient/' + (existing ? existing.id : r.id); } catch (er) { fail(er); }
      },
    }, h('p', { class: 'mut' }, t('fictitious')), sections[0], alCard, aisCard, sections.slice(1), h('div', { class: 'row' }, h('button', { class: 'pri', type: 'submit' }, t('save')), h('button', { type: 'button', onclick: () => history.back() }, t('cancel'))));
  }

  /* ---------- resúmenes de registros ---------- */
  function recSummary(r) {
    const d = r.data;
    if (r.type === 'nota') return d.texto;
    if (r.type === 'constantes') { const v = []; if (d.ta_sis != null) v.push(t('ta') + ' ' + d.ta_sis + '/' + d.ta_dia); [['fc', 'FC'], ['fr', 'FR'], ['temp', 'T'], ['spo2', 'SpO₂'], ['glucemia', 'Gluc'], ['dolor', 'Dolor']].forEach(([k, l]) => { if (d[k] != null) v.push(l + ' ' + d[k]); }); return v.join(', '); }
    if (r.type === 'balance') return t(d.dir) + ' · ' + t('v_' + d.via) + ' · ' + d.ml + ' ml';
    if (r.type === 'cuidado') return (LANG === 'ca' ? d.nombre_ca : d.nombre_es) + ' — ' + t('res_' + d.resultado);
    return window.HCX ? window.HCX.summary(r) : '';
  }

  /* ---------- profesorado: lista y ficha de paciente ---------- */
  async function viewPatients() { return window.HCX.viewPatients(); }

  async function viewPatient(id, tab) {
    tab = tab || 'ficha';
    const [{ patient, charts, revisions }, uj, act] = await Promise.all([api('GET', '/api/patients/' + id), api('GET', '/api/users'), api('GET', '/api/patients/' + id + '/activity')]);
    const base = '#/patient/' + id;
    const actions = [h('button', { onclick: () => { location.hash = base + '/edit'; } }, t('edit')), h('button', { class: 'danger', onclick: async () => { if (patient.archived || confirm(t('confirm_archive'))) { await api('PUT', '/api/patients/' + id, { archived: !patient.archived }); viewPatient(id, tab); } } }, patient.archived ? t('restore') : t('archive'))];
    let body;
    if (tab === 'ficha') body = [window.HCX.casePdfBar(id), await window.HCX.classifyPanel(patient, () => viewPatient(id, tab)), revisions ? h('p', { class: 'mut' }, revisions + ' ' + t('revisions')) : null, fichaPanels(patient, true), await window.HCX.deletePatientPanel(patient)];
    else if (tab === 'asignar') body = assignPanel(id, charts, uj, (await api('GET', '/api/patients/' + id + '/consignas')).consignas);
    else if (tab === 'historias') body = panel(null, charts.length ? h('div', { class: 'tw' }, h('table', { class: 'grid' }, h('thead', null, h('tr', null, [t('col_chart'), t('col_type'), t('col_members'), t('col_records'), t('col_last'), t('col_state'), ''].map((x, i) => h('th', { class: i === 3 ? 'r' : '' }, x)))),
      h('tbody', null, charts.map((c) => h('tr', null, h('td', null, h('a', { href: '#/chart/' + c.id }, c.name), c.brief ? h('div', { class: 'sub' }, c.brief.title + (c.brief.total ? ' · ' + c.brief.done + '/' + c.brief.total : '')) : null), h('td', null, h('span', { class: 'chip' }, c.kind === 'team' ? t('team') : t('individual'))), h('td', null, c.members.map((m) => m.name).join(', ')), h('td', { class: 'r' }, c.recs), h('td', null, c.last ? fmtISO(c.last) : '—'), h('td', null, stateChip(c.status === 'open')),
        h('td', null, h('div', { class: 'row' }, h('button', { class: 'sm', onclick: () => { location.hash = '#/chart/' + c.id; } }, t('open_it')), h('button', { class: 'sm', onclick: async () => { try { await api('PUT', '/api/charts/' + c.id, { status: c.status === 'open' ? 'closed' : 'open' }); viewPatient(id, tab); } catch (e) { fail(e); } } }, c.status === 'open' ? t('close_chart') : t('open_chart')),
          !c.recs ? h('button', { class: 'sm danger', onclick: async () => { try { await api('DELETE', '/api/charts/' + c.id); viewPatient(id, tab); } catch (e) { fail(e); } } }, t('delete')) : null))))))) : empty(t('no_data')), { flush: true });
    else if (tab === 'prescripciones' || tab === 'linea' || tab === 'consignas' || tab === 'seguimiento') body = await window.HCX.patientTab(tab, { id, refresh: () => viewPatient(id, tab) });
    else body = activityPanel(id, act);
    show(h('div', { class: 'pg-title' }, h('button', { class: 'link', onclick: () => { location.hash = '#/'; } }, t('back')), h('span', { class: 'mut' }, patient.code + (patient.archived ? ' · ' + t('archived') : ''))),
      banner(patient, actions), tabBar([['ficha', t('tab_ficha')], ['consignas', t('tab_consignas')], ['seguimiento', t('tab_seg')], ['asignar', t('tab_asignar')], ['prescripciones', t('tab_presc')], ['linea', t('tab_linea')], ['historias', t('tab_historias'), charts.length], ['actividad', t('tab_actividad'), act.records.length]], tab, base), body);
  }

  function assignPanel(id, charts, uj, cons) {
    const users = uj.users.filter((u) => u.active && u.role === 'student'), picked = new Set(); let mode = 'individual', q = '', sj = '', fg = '', fs = '', fh = '', teamBy = 'one';
    const list = h('div', { class: 'pick' }), cnt = h('span', { class: 'mut' }), preview = h('p', { class: 'mut', hidden: true });
    const assignedIds = new Set(charts.flatMap((c) => c.members.map((m) => m.id)));
    const subjTitle = (slug) => (uj.subjects.find((x) => x.slug === slug) || {}).title || slug;
    const enrs = (u) => (u.enr || []).filter((e) => !sj || e.slug === sj);              /* matrículas que cuentan según la asignatura elegida */
    const okEnr = (e, g, s, hf) => (!g || e.grp === g) && (!s || String(e.sub) === s) && (!hf || e.half === hf);
    const visible = () => users.filter((u) => (!sj || u.subjects.includes(sj)) && (!q || (u.name + ' ' + u.email).toLowerCase().includes(q)) && (!(fg || fs || fh) || enrs(u).some((e) => okEnr(e, fg, fs, fh))));
    const code = (e) => (e.grp ? e.grp + (e.sub || '') : (e.sub ? '#' + e.sub : '')) + (e.half ? (e.grp || e.sub ? ' · ' : '') + t('half') + ' ' + e.half : '');
    const tagsOf = (u) => enrs(u).filter((e) => e.grp || e.sub || e.half).map((e) => (sj ? '' : subjTitle(e.slug) + ': ') + code(e));
    const teamsOf = (us) => { const m = new Map(); for (const u of us) { const e = enrs(u).find((x) => x.sub); const k = e ? (e.grp || '') + e.sub : ''; if (!m.has(k)) m.set(k, []); m.get(k).push(u); } return m; };
    const refreshInfo = () => {
      const shown = new Set(visible().map((u) => u.id)), hid = [...picked].filter((x) => !shown.has(x)).length;
      cnt.textContent = picked.size + ' ' + t('selected') + (hid ? ' · ' + hid + ' ' + t('hidden_sel') : '');
      const byTeam = mode === 'team' && teamBy === 'sub'; preview.hidden = !byTeam; if (!byTeam) return;
      const m = teamsOf(users.filter((u) => picked.has(u.id))), nos = m.get('') ? m.get('').length : 0;
      preview.textContent = !sj ? t('team_need_subj') : !picked.size ? t('team_pick_hint') : (m.size - (nos ? 1 : 0)) + ' ' + t('teams_n') + ': ' + [...m.entries()].filter(([k]) => k).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })).map(([k, v]) => k + ' (' + v.length + ')').join(', ') + (nos ? ' · ' + nos + ' ' + t('no_sub') : '');
    };
    const drawList = () => {
      clear(list); const v = visible();
      v.forEach((u) => list.appendChild(h('label', null, h('input', { type: 'checkbox', checked: picked.has(u.id), onchange: (e) => { e.target.checked ? picked.add(u.id) : picked.delete(u.id); refreshInfo(); } }), u.name, h('span', { class: 'chip' }, t('p_' + u.profile)), tagsOf(u).map((x) => h('span', { class: 'chip' }, x)), assignedIds.has(u.id) ? h('span', { class: 'chip grn', title: t('already_has'), 'aria-label': t('already_has') }, '✓') : null)));
      if (!v.length) list.appendChild(h('div', { class: 'empty' }, t('no_students')));
      refreshInfo();
    };
    const consSel = h('select', { 'aria-label': t('cs_assign') }, h('option', { value: '' }, t('cs_pick')), (cons || []).map((k) => h('option', { value: k.id }, k.title)));
    const winFrom = h('input', { type: 'date', 'aria-label': t('win_from') }), winTo = h('input', { type: 'date', 'aria-label': t('win_to') });
    const paceSel = h('select', { 'aria-label': t('pace_title') }, h('option', { value: 'teacher' }, t('pace_teacher')), h('option', { value: 'student' }, t('pace_student'))), capIn = h('input', { type: 'number', min: 1, max: 60, 'aria-label': t('pace_cap'), placeholder: t('pace_auto') });
    const teamName = h('input', { type: 'text', placeholder: t('team_name') }); const teamField = field(t('team_name'), teamName); teamField.hidden = true;
    const teamBySel = h('select', { 'aria-label': t('team_by'), onchange: (e) => { teamBy = e.target.value; refreshInfo(); } }, h('option', { value: 'one' }, t('team_by_one')), h('option', { value: 'sub' }, t('team_by_sub'))); const teamByField = field(t('team_by'), teamBySel); teamByField.hidden = true;
    const modeSel = h('select', { onchange: (e) => { mode = e.target.value; teamField.hidden = teamByField.hidden = mode !== 'team'; refreshInfo(); } }, h('option', { value: 'individual' }, t('mode_ind')), h('option', { value: 'team' }, t('mode_team')));
    const mk = (label, set) => { const sel = h('select', { 'aria-label': label, onchange: (e) => { set(e.target.value); fillFilters(); drawList(); } }); const f = field(label, sel); f.hidden = true; return { sel, f }; };
    const gSel = mk(t('f_group'), (v) => { fg = v; fs = ''; }), sSel = mk(t('f_sub'), (v) => { fs = v; }), hSel = mk(t('f_half'), (v) => { fh = v; });
    const fillFilters = () => { /* opciones según el alumnado matriculado (de la asignatura elegida, o de todas); el subgrupo se acota al grupo elegido */
      const all = users.flatMap((u) => enrs(u));
      for (const [x, key, num, cur] of [[gSel, 'grp', false, fg], [sSel, 'sub', true, fs], [hSel, 'half', false, fh]]) {
        const es = key === 'sub' && fg ? all.filter((e) => e.grp === fg) : all;
        const vals = [...new Set(es.map((e) => String(e[key] || '')).filter(Boolean))].sort((a, b) => (num ? a - b : a.localeCompare(b)));
        clear(x.sel); x.sel.appendChild(h('option', { value: '' }, t('f_all'))); vals.forEach((v) => x.sel.appendChild(h('option', { value: v, selected: v === cur }, v))); x.f.hidden = !vals.length;
      }
    };
    const sjSel = h('select', { onchange: (e) => { sj = e.target.value; fg = fs = fh = ''; fillFilters(); drawList(); } }, h('option', { value: '' }, t('all_subjects')), uj.subjects.map((s) => h('option', { value: s.slug }, s.title)));
    const search = h('input', { type: 'search', placeholder: t('search'), oninput: (e) => { q = e.target.value.toLowerCase(); drawList(); } });
    fillFilters(); drawList();
    return panel(t('assign'), [h('div', { class: 'cols' }, field(t('assign_mode'), modeSel), field(t('cs_assign'), consSel), field(t('win_from'), winFrom), field(t('win_to'), winTo), field(t('pace_title'), paceSel), field(t('pace_cap'), capIn), teamByField, teamField, field(t('subject'), sjSel), gSel.f, sSel.f, hSel.f, field(t('search'), search)),
      h('div', { class: 'row' }, h('button', { onclick: () => { visible().forEach((u) => picked.add(u.id)); drawList(); } }, t('select_all')), h('button', { onclick: () => { picked.clear(); drawList(); } }, '✕'), cnt), preview, h('div', null, list),
      h('p', { class: 'row' }, h('button', { class: 'pri', onclick: async (ev) => { const btn = ev.currentTarget; if (btn.disabled) return; try {
        if (!picked.size) return toast(t('pick_some'), true);
        if (mode === 'team' && teamBy === 'sub' && !sj) return toast(t('team_need_subj'), true);
        btn.disabled = true;
        const r = await api('POST', '/api/patients/' + id + '/assign', { mode, team_by: teamBy, subject: sj, team_name: teamName.value, consigna_id: consSel.value || null, opens: winFrom.value, closes: winTo.value, pace: paceSel.value, max_day: capIn.value || null, user_ids: [...picked] });
        toast(t('assigned') + ': ' + r.created + (r.skipped ? ' · ' + r.skipped + ' ' + t('skipped') : '') + (r.no_sub ? ' · ' + r.no_sub + ' ' + t('no_sub_done') : '')); viewPatient(id, 'asignar'); } catch (e) { btn.disabled = false; fail(e); } } }, t('assign_btn')),
        h('button', { onclick: async () => { try { const r = await api('POST', '/api/sync'); toast(t('synced') + ': ' + r.students); viewPatient(id, 'asignar'); } catch (e) { fail(e); } } }, t('sync')))]);
  }
  function activityPanel(id, act) {
    const box = h('div', { class: 'tw' });
    const draw = (recs) => { clear(box); if (!recs.length) return box.appendChild(empty(t('no_records')));
      box.appendChild(h('table', { class: 'grid' }, h('thead', null, h('tr', null, [t('col_time'), t('col_author'), t('col_chart'), t('col_type'), t('col_detail')].map((x) => h('th', null, x)))),
        h('tbody', null, recs.map((r) => h('tr', { class: r.void_at ? 'void' : '' }, h('td', null, fmtDT(r.occurred)), h('td', null, r.author), h('td', null, h('a', { href: '#/chart/' + r.chart_id }, r.chart_name)), h('td', null, t('r_' + r.type)), h('td', null, h('span', { class: 'vv' }, recSummary(r)), r.void_at ? h('span', { class: 'chip red' }, t('voided') + ': ' + r.void_reason) : null)))))); };
    draw(act.records);
    const authors = [...new Map(act.records.map((r) => [r.user_id, r.author])).entries()];
    return panel(t('activity'), [h('div', { class: 'pb' }, field(t('filter_student'), h('select', { onchange: async (e) => { try { const r = await api('GET', '/api/patients/' + id + '/activity' + (e.target.value ? '?user=' + e.target.value : '')); draw(r.records); } catch (er) { fail(er); } } }, h('option', { value: '' }, t('all_students')), authors.map(([k, v]) => h('option', { value: k }, v))))), box], { flush: true });
  }

  async function viewStudents() {
    const j = await api('GET', '/api/users'), pl = (await api('GET', '/api/patients')).patients;
    const map = Object.assign({}, j.subject_profiles);
    const row = (u) => h('tr', null, h('td', null, u.name, h('div', { class: 'sub' }, u.email)),
      h('td', null, h('select', { 'aria-label': t('role_prof'), onchange: async (e) => { try { await api('PUT', '/api/users/' + u.id, { profile: e.target.value }); toast(t('ok')); } catch (er) { fail(er); } } },
        h('option', { value: 'auto', selected: !u.profile_manual }, t('p_auto') + ' → ' + t('p_' + u.profile)), h('option', { value: 'enfermeria', selected: !!u.profile_manual && u.profile === 'enfermeria' }, t('p_enfermeria')), h('option', { value: 'tcae', selected: !!u.profile_manual && u.profile === 'tcae' }, t('p_tcae')))),
      h('td', null, u.last_login ? fmtISO(u.last_login) : '—'),
      h('td', null, h('button', { class: 'sm', onclick: () => { location.hash = '#/student/' + u.id; } }, t('stu_work'))),
      h('td', null, h('label', { class: 'row' }, h('input', { type: 'checkbox', checked: !!u.active, onchange: async (e) => { try { await api('PUT', '/api/users/' + u.id, { active: e.target.checked }); } catch (er) { fail(er); } } }), t('active'))));
    const groupCard = (title, list) => h('details', { class: 'panel', open: true }, h('summary', null, h('span', null, title, ' ', h('span', { class: 'chip' }, list.length))),
      h('div', { class: 'tw' }, h('table', { class: 'grid' }, h('thead', null, h('tr', null, h('th', null, t('nav_students')), h('th', null, t('role_prof')), h('th', null, t('last_login')), h('th', null, ''), h('th', null, ''))), h('tbody', null, list.map(row)))));
    const students = j.users.filter((u) => u.role !== 'teacher'), teachers = j.users.filter((u) => u.role === 'teacher');
    const known = new Set(j.subjects.map((s) => s.slug));
    const groups = j.subjects.map((s) => [s.title, students.filter((u) => u.subjects.includes(s.slug))]).filter((g) => g[1].length);
    const none = students.filter((u) => !u.subjects.some((x) => known.has(x)));
    if (none.length) groups.push([t('no_subject'), none]);
    const sp = j.subjects.length ? h('details', { class: 'panel' }, h('summary', null, t('subj_profiles')), h('div', { class: 'pb' }, h('p', { class: 'mut' }, t('subj_profiles_help')),
      h('div', { class: 'spgrid' }, j.subjects.map((s) => h('label', { class: 'spcell' }, h('span', null, s.title), h('select', { 'aria-label': s.title, onchange: (e) => { if (e.target.value) map[s.slug] = e.target.value; else delete map[s.slug]; } }, h('option', { value: '' }, '—'), h('option', { value: 'enfermeria', selected: map[s.slug] === 'enfermeria' }, t('p_enfermeria')), h('option', { value: 'tcae', selected: map[s.slug] === 'tcae' }, t('p_tcae')))))),
      h('p', null, h('button', { onclick: async () => { try { await api('PUT', '/api/subject-profiles', { map }); toast(t('ok')); } catch (er) { fail(er); } } }, t('save'))))) : null;
    const find = h('input', { type: 'search', class: 'stu-find', placeholder: t('search'), 'aria-label': t('search'), oninput: (e) => { const q = e.target.value.toLowerCase(); document.querySelectorAll('.stu-groups tbody tr').forEach((tr) => { tr.hidden = !!q && !tr.textContent.toLowerCase().includes(q); }); } });
    const tools = [ME.role === 'admin' ? window.HCX.teachersPanel(teachers, () => viewStudents()) : null, window.HCX.dataPanel(pl), sp].filter(Boolean);
    show(h('div', { class: 'pg-title' }, h('h1', null, t('nav_students'), ' ', h('span', { class: 'chip' }, students.length)), h('button', { onclick: async () => { try { const r = await api('POST', '/api/sync'); toast(t('synced') + ': ' + r.students); viewStudents(); } catch (e) { fail(e); } } }, t('sync'))),
      students.length ? [find, h('div', { class: 'stu-groups' }, groups.map((g) => groupCard(g[0], g[1])))] : panel(null, empty(t('no_students'))),
      h('div', { class: 'stu-tools' }, tools));
  }

  async function viewCatalog() {
    const { items } = await api('GET', '/api/catalog');
    const nes = h('input', { type: 'text' }), nca = h('input', { type: 'text' }), grp = h('input', { type: 'text' });
    const re = h('input', { type: 'checkbox', checked: true }), rt = h('input', { type: 'checkbox' });
    const add1 = h('details', { class: 'panel' }, h('summary', null, t('c_add')), h('div', { class: 'pb' }, h('div', { class: 'cols' }, field(t('c_name_es'), nes), field(t('c_name_ca'), nca), field(t('c_group'), grp)),
      h('div', { class: 'row' }, h('label', { class: 'row' }, re, t('p_enfermeria')), h('label', { class: 'row' }, rt, t('p_tcae'))),
      h('p', null, h('button', { class: 'pri', onclick: async () => { try { await api('POST', '/api/catalog', { name_es: nes.value, name_ca: nca.value, grp: grp.value, roles: [re.checked ? 'enfermeria' : '', rt.checked ? 'tcae' : ''].filter(Boolean) }); viewCatalog(); } catch (e) { fail(e); } } }, t('c_add')))));
    const groups = [...new Set(items.map((i) => i.grp))];
    show(h('div', { class: 'pg-title' }, h('h1', null, t('nav_catalog')), h('button', { onclick: () => { location.hash = '#/taxonomy'; } }, t('tx_open'))), h('p', { class: 'mut' }, t('catalog_help')), add1, groups.map((g) => h('details', { class: 'panel', open: true }, h('summary', null, h('span', null, g || '—', ' ', h('span', { class: 'chip' }, items.filter((i) => i.grp === g).length))),
      h('div', { class: 'tw' }, h('table', { class: 'grid' }, h('tbody', null, items.filter((i) => i.grp === g).map((i) => h('tr', null,
        h('td', null, LANG === 'ca' && i.name_ca ? i.name_ca : i.name_es, i.active ? '' : h('span', { class: 'chip amb' }, 'off')),
        h('td', null, h('div', { class: 'row' }, ['enfermeria', 'tcae'].map((r) => h('label', { class: 'row' }, h('input', { type: 'checkbox', checked: i.roles.split(',').includes(r), onchange: async (e) => { const cur = new Set(i.roles.split(',')); e.target.checked ? cur.add(r) : cur.delete(r); i.roles = [...cur].join(','); try { await api('PUT', '/api/catalog/' + i.id, { roles: [...cur] }); } catch (er) { fail(er); } } }), t('p_' + r))))),
        h('td', { class: 'r' }, h('button', { class: 'sm', onclick: async () => { try { await api('PUT', '/api/catalog/' + i.id, { active: !i.active }); viewCatalog(); } catch (e) { fail(e); } } }, i.active ? t('c_off') : t('c_on')))))))))));
  }

  async function viewAudit() {
    const { rows } = await api('GET', '/api/audit');
    show(h('h1', null, t('nav_audit')), h('p', { class: 'mut' }, t('audit_help')), panel(null, h('div', { class: 'tw' }, h('table', { class: 'grid' }, h('tbody', null, rows.map((r) => h('tr', null, h('td', null, fmtISO(r.ts)), h('td', null, r.who), h('td', null, r.action), h('td', null, r.detail)))))), { flush: true }));
  }

  /* ---------- registros: formulario de alta ---------- */
  function recForm(type, ctx, done) {
    if (window.HCX && window.HCX.forms[type]) return window.HCX.forms[type](ctx, done);
    const f = {}, when = h('input', { type: 'datetime-local', value: ctx.caseDate ? ctx.caseDate + 'T' + nowInput().slice(11) : nowInput(), min: ctx.caseDate ? ctx.caseDate + 'T00:00' : null, max: ctx.caseDate ? ctx.caseDate + 'T23:59' : null });
    const inp = (k, o) => (f[k] = h('input', Object.assign({ type: 'text', inputmode: 'decimal', 'aria-label': t(k) }, o || {})));
    let body;
    if (type === 'nota') {
      f.turno = h('select', null, ['M', 'T', 'N'].map((v) => h('option', { value: v }, t('t_' + v)))); f.tipo = h('select', null, ['evolucion', 'incidencia', 'educacion', 'traspaso'].map((v) => h('option', { value: v }, t('n_' + v)))); f.texto = h('textarea', { required: true });
      body = [h('div', { class: 'cols' }, field(t('turno'), f.turno), field(t('tipo'), f.tipo)), field(t('text'), f.texto)];
    } else if (type === 'constantes') {
      f.conciencia = h('select', null, h('option', { value: '' }, '—'), ['alerta', 'somnoliento', 'estuporoso', 'coma'].map((v) => h('option', { value: v }, t('c_' + v)))); f.obs = h('input', { type: 'text' });
      body = [h('div', { class: 'cols' }, ['ta_sis', 'ta_dia', 'fc', 'fr', 'temp', 'spo2', 'glucemia', 'dolor'].map((k) => field(t(k), inp(k))), field(t('conciencia'), f.conciencia)), field(t('obs'), f.obs)];
    } else if (type === 'balance') {
      f.dir = h('select', { onchange: () => fillVia() }, h('option', { value: 'ingesta' }, t('ingesta')), h('option', { value: 'eliminacion' }, t('eliminacion'))); f.via = h('select'); f.ml = inp('ml'); f.obs = h('input', { type: 'text' });
      const fillVia = () => { clear(f.via); (f.dir.value === 'ingesta' ? ['oral', 'iv', 'sng', 'otra'] : ['diuresis', 'deposicion', 'vomito', 'drenaje', 'otra']).forEach((v) => f.via.appendChild(h('option', { value: v }, t('v_' + v)))); };
      fillVia(); body = [h('div', { class: 'cols' }, field(t('ingesta') + ' / ' + t('eliminacion'), f.dir), field(t('via'), f.via), field(t('ml'), f.ml)), field(t('obs'), f.obs)];
    } else {
      const items = ctx.catalog.filter((c) => c.roles.split(',').includes(ctx.role) && c.active); const groups = [...new Set(items.map((c) => c.grp))];
      f.catalog_id = h('select', null, groups.map((g) => h('optgroup', { label: g }, items.filter((c) => c.grp === g).map((c) => h('option', { value: c.id }, LANG === 'ca' && c.name_ca ? c.name_ca : c.name_es)))));
      f.resultado = h('select', null, ['realizado', 'rechazado', 'no_tolerado', 'pendiente'].map((v) => h('option', { value: v }, t('res_' + v)))); f.obs = h('textarea');
      body = [h('div', { class: 'cols' }, field(t('care'), f.catalog_id), field(t('result'), f.resultado)), field(t('obs'), f.obs)];
    }
    return h('form', {
      class: 'panel formp', onsubmit: async (e) => {
        e.preventDefault(); const data = {}; for (const [k, el] of Object.entries(f)) data[k] = el.value;
        try { await api('POST', '/api/charts/' + ctx.chartId + '/records', { type, data, occurred: when.value, replaces_id: ctx.replaces || undefined }); toast(t('saved')); done(true); } catch (er) { fail(er); }
      },
    }, h('div', { class: 'ph' }, t('r_' + type) + (ctx.replaces ? ' — ' + t('replaces') + ' #' + ctx.replaces : '')),
      h('div', { class: 'pb' }, field(t('when'), when), body, h('p', { class: 'row' }, h('button', { class: 'pri', type: 'submit' }, t('register')), h('button', { type: 'button', onclick: () => done(false) }, t('cancel')))));
  }

  /* ---------- historia de trabajo ---------- */
  const PARAMS = [
    ['ta', 'ta', 'mmHg', (d) => (d.ta_sis != null ? d.ta_sis + '/' + d.ta_dia : null), (d) => (d.ta_sis == null ? '' : d.ta_sis >= 140 || d.ta_dia >= 90 ? 'hi' : d.ta_sis < 90 || d.ta_dia < 60 ? 'lo' : '')],
    ['fc', 'fc', 'lpm', (d) => d.fc, (d) => (d.fc == null ? '' : d.fc > 100 ? 'hi' : d.fc < 50 ? 'lo' : '')],
    ['fr', 'fr', 'rpm', (d) => d.fr, (d) => (d.fr == null ? '' : d.fr > 20 ? 'hi' : d.fr < 12 ? 'lo' : '')],
    ['temp', 'temp', '°C', (d) => d.temp, (d) => (d.temp == null ? '' : d.temp >= 38 ? 'hi' : d.temp < 35.5 ? 'lo' : '')],
    ['spo2', 'spo2', '%', (d) => d.spo2, (d) => (d.spo2 == null ? '' : d.spo2 < 92 ? 'lo' : '')],
    ['glucemia', 'glucemia', 'mg/dl', (d) => d.glucemia, (d) => (d.glucemia == null ? '' : d.glucemia > 180 ? 'hi' : d.glucemia < 70 ? 'lo' : '')],
    ['dolor', 'dolor', '/10', (d) => d.dolor, (d) => (d.dolor == null ? '' : d.dolor >= 4 ? 'hi' : '')],
    ['conciencia', 'conciencia', '', (d) => (d.conciencia ? t('c_' + d.conciencia) : null), (d) => (d.conciencia && d.conciencia !== 'alerta' ? 'hi' : '')],
    ['peso', 'peso', 'kg', (d) => d.peso, () => ''],
    ['talla', 'talla', 'cm', (d) => d.talla, () => ''],
  ];
  const plain = (k) => t(k).replace(/\s*\(.*$/, '');

  async function viewChart(id, tab) {
    tab = tab || 'resumen';
    if (chartKey !== id) { chartKey = id; chartUser = ''; }
    const [c, cat] = await Promise.all([api('GET', '/api/charts/' + id + (chartUser ? '?user=' + chartUser : '')), api('GET', '/api/catalog')]);
    if (tab === 'imprimir') return show(window.HCX.printView(c));
    const staff = ME.staff, open = c.chart.status === 'open', recs = c.records, base = '#/chart/' + id;
    const refresh = () => viewChart(id, tab);
    const byType = (ty) => recs.filter((r) => r.type === ty), live = (ty) => byType(ty).filter((r) => !r.void_at);
    const formBox = h('div');
    const openForm = (type, rep, prefill) => { clear(formBox); formBox.appendChild(recForm(type, { chartId: id, role: c.chart.role, catalog: cat.items, replaces: rep, prefill, orders: c.orders, caseDate: c.chart.pace === 'student' ? c.chart.case_date : null }, (saved) => { if (saved) refresh(); else clear(formBox); })); formBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); };
    const voidRec = async (r) => { const reason = await ask(t('void'), t('void_prompt'), 5); if (!reason) return; try { await api('POST', '/api/records/' + r.id + '/void', { reason }); refresh(); } catch (e) { fail(e); } };
    const commentRec = async (r) => { const text = await ask(t('comment'), t('comment_prompt'), 2); if (!text) return; try { await api('POST', '/api/charts/' + id + '/comments', { text, record_id: r.id }); refresh(); } catch (e) { fail(e); } };
    const actions = (r) => {
      const out = [], mine = !staff && r.user_id === ME.id && open;
      if (mine && !r.void_at) { out.push(h('button', { class: 'sm danger', onclick: () => voidRec(r) }, t('void'))); out.push(h('button', { class: 'sm', onclick: () => openForm(r.type, r.id) }, t('correct'))); }
      if (staff) { out.push(h('button', { class: 'sm', onclick: () => commentRec(r) }, t('comment'))); if (!r.void_at) out.push(h('button', { class: 'sm danger', onclick: () => voidRec(r) }, t('void'))); }
      return h('div', { class: 'row' }, out);
    };
    const voidInfo = (r) => (r.void_at ? h('div', null, h('span', { class: 'chip red' }, t('voided')), ' ', h('span', { class: 'sub' }, t('reason') + ': ' + r.void_reason + (r.void_name ? ' (' + r.void_name + ')' : ''))) : null);
    const cmts = (r) => (r.comments || []).map((cm) => h('div', { class: 'cm' }, h('b', null, cm.author + ': '), cm.text));
    const who = (r) => h('td', null, r.author, r.author_role ? h('div', { class: 'sub' }, t('p_' + r.author_role)) : null);
    const timeCell = (r) => h('td', { title: r.occurred.replace('T', ' ') }, (c.chart.pace === 'student' && r.day ? t('day_short') + r.day + ' · ' : '') + fmtDT(r.occurred));
    const tbl = (heads, rows) => (rows.length ? h('div', { class: 'tw' }, h('table', { class: 'grid' }, h('thead', null, h('tr', null, heads.map((x) => h('th', null, x)))), h('tbody', null, rows))) : empty(t('no_records')));

    const X = { c, id, staff, open, role: c.chart.role, recs, byType, live, actions, voidInfo, cmts, who, timeCell, tbl, openForm, refresh };
    let body;
    if (tab === 'resumen') {
      const d = c.patient.data, lastV = live('constantes')[0], lastN = live('nota')[0];
      const vit = lastV ? h('div', null, h('div', { class: 'sub' }, fmtDT(lastV.occurred) + ' · ' + lastV.author), h('table', { class: 'grid' }, h('tbody', null, PARAMS.filter((p) => p[3](lastV.data) != null).map((p) => h('tr', null, h('td', null, plain(p[1])), h('td', { class: p[4](lastV.data) ? 'r ' : 'r' }, h('b', null, p[3](lastV.data) + (p[2] ? ' ' + p[2] : '')), p[4](lastV.data) === 'hi' ? ' ▲' : p[4](lastV.data) === 'lo' ? ' ▼' : '')))))) : empty(t('no_data'));
      body = h('div', { class: 'split' }, h('div', null, panel(t('p_admission'), dl(d, ['fecha_ingreso', 'procedencia', 'motivo_ingreso', 'enfermedad_actual', 'diagnostico_medico', 'riesgos', 'autonomia']))),
        h('div', null, panel(t('p_last_vitals'), vit), panel(t('p_last_note'), lastN ? h('div', null, h('div', { class: 'sub' }, fmtDT(lastN.occurred) + ' · ' + lastN.author), h('div', { class: 'body' }, lastN.data.texto)) : empty(t('no_data')))));
    } else if (tab === 'evolucion') {
      const ns = byType('nota');
      body = ns.length ? ns.map((r) => h('div', { class: 'note' + (r.void_at ? ' void' : '') }, h('div', { class: 'meta' }, h('b', null, fmtDT(r.occurred)), ' · ' + r.author + ' · ', h('span', { class: 'chip' }, t('n_' + r.data.tipo)), ' ', h('span', { class: 'chip gry' }, t('t_' + r.data.turno))), h('div', { class: 'body' }, r.data.texto), voidInfo(r), cmts(r), h('div', { class: 'row' }, actions(r)))) : panel(null, empty(t('no_records')));
    } else if (tab === 'constantes') {
      const cols = byType('constantes'), rowsP = PARAMS.filter((p) => cols.some((r) => p[3](r.data) != null));
      if (!cols.length) body = panel(null, empty(t('no_records')));
      else {
        const graphs = window.HCX.vitalCharts(cols);
        const head = h('tr', null, h('th', { class: 'lbl' }, t('fl_param')), cols.map((r) => h('th', { title: r.occurred.replace('T', ' ') + ' · ' + r.author }, fmtDT(r.occurred), h('div', { class: 'by' }, r.author.split(' ')[0]), r.void_at ? h('div', { class: 'by' }, t('fl_voided')) : null)));
        const trs = rowsP.map((p) => h('tr', null, h('td', { class: 'lbl' }, plain(p[1]), p[2] ? h('span', { class: 'u' }, p[2]) : null), cols.map((r) => { const v = p[3](r.data), fl = v == null ? '' : p[4](r.data); return h('td', { class: (r.void_at ? 'void ' : '') + (!r.void_at && fl ? fl : '') }, v == null ? '' : String(v), !r.void_at && fl === 'hi' ? ' ▲' : !r.void_at && fl === 'lo' ? ' ▼' : ''); })));
        trs.push(h('tr', null, h('td', { class: 'lbl' }, t('obs')), cols.map((r) => h('td', { class: r.void_at ? 'void' : '' }, r.data.obs || ''))));
        if (cols.some((r) => (r.comments || []).length)) trs.push(h('tr', null, h('td', { class: 'lbl' }, t('comments')), cols.map((r) => h('td', null, (r.comments || []).map((cm) => cm.text).join(' / ')))));
        trs.push(h('tr', null, h('td', { class: 'lbl' }, ''), cols.map((r) => h('td', null, actions(r)))));
        body = [h('div', { class: 'panel' }, h('div', { class: 'pb flush flow tw' }, h('table', null, h('thead', null, head), h('tbody', null, trs))), h('div', { class: 'legend' }, t('fl_legend'))), h('h2', { class: 'sec-h' }, t('ch_vitals')), graphs];
      }
    } else if (tab === 'balance') {
      const bs = byType('balance'), days = {};
      bs.filter((r) => !r.void_at).forEach((r) => { const k = r.occurred.slice(0, 10); days[k] = days[k] || { i: 0, o: 0 }; days[k][r.data.dir === 'ingesta' ? 'i' : 'o'] += r.data.ml; });
      const dk = Object.keys(days).sort().reverse();
      body = [window.HCX.balanceChart(bs), window.HCX.balanceShifts(bs), dk.length ? panel(null, h('div', { class: 'tw' }, h('table', { class: 'grid' }, h('thead', null, h('tr', null, [t('bal_day'), t('bal_in'), t('bal_out'), t('bal_net')].map((x, i) => h('th', { class: i ? 'r' : '' }, x)))), h('tbody', null, dk.map((k) => { const n = days[k].i - days[k].o; return h('tr', null, h('td', null, fmtD(k)), h('td', { class: 'r' }, days[k].i), h('td', { class: 'r' }, days[k].o), h('td', { class: 'r' }, h('b', null, (n > 0 ? '+' : '') + n))); })))), { flush: true }) : null,
        panel(null, tbl([t('col_time'), t('col_type'), t('ml'), t('col_author'), t('col_detail'), ''], bs.map((r) => h('tr', { class: r.void_at ? 'void' : '' }, timeCell(r), h('td', null, h('span', { class: 'vv' }, t(r.data.dir) + ' · ' + t('v_' + r.data.via))), h('td', null, h('span', { class: 'vv' }, r.data.ml + ' ml')), who(r), h('td', null, r.data.obs || '', voidInfo(r), cmts(r)), h('td', null, actions(r))))), { flush: true })];
    } else if (tab === 'cuidados') {
      const cs = byType('cuidado');
      body = panel(null, tbl([t('col_time'), t('care'), t('col_result'), t('col_detail'), t('col_author'), ''], cs.map((r) => h('tr', { class: r.void_at ? 'void' : '' }, timeCell(r), h('td', null, h('span', { class: 'vv' }, LANG === 'ca' ? r.data.nombre_ca : r.data.nombre_es)), h('td', null, h('span', { class: 'chip ' + (r.data.resultado === 'realizado' ? 'grn' : 'amb') }, t('res_' + r.data.resultado))), h('td', null, r.data.obs || '', voidInfo(r), cmts(r)), who(r), h('td', null, actions(r))))), { flush: true });
    } else if (window.HCX.chartTab(tab, X)) body = window.HCX.chartTab(tab, X);
    else body = [h('p', { class: 'mut' }, t('readonly_note')), fichaPanels(c.patient, staff)];

    const tabs = [['resumen', t('tab_resumen')], ['evolucion', t('tab_evolucion'), byType('nota').length], ['constantes', t('tab_constantes'), byType('constantes').length], ['balance', t('tab_balance'), byType('balance').length], ['cuidados', t('tab_cuidados'), byType('cuidado').length]].concat(window.HCX.extraTabs(X), [['ficha', t('tab_ficha')]]);
    const toolbar = !staff && open ? h('div', { class: 'toolbar row' }, h('b', null, t('tb_record') + ':'), ['nota', 'constantes', 'balance', 'cuidado'].map((ty) => h('button', { class: 'pri sm', onclick: () => openForm(ty) }, '+ ' + t('r_' + ty))), h('button', { class: 'sm', onclick: () => { location.hash = base + '/imprimir'; } }, t('print')))
      : staff ? h('div', { class: 'toolbar row' }, window.HCX.dayControl(id, c.chart.day, refresh), window.HCX.previewControl(id), window.HCX.consignaControl(id, c.consignas, c.chart.consigna_id, refresh), window.HCX.windowControl(id, c.chart, refresh), window.HCX.paceControl(id, c.chart, refresh), c.members.length > 1 ? h('label', { class: 'row' }, t('filter_student') + ':', h('select', { onchange: (e) => { chartUser = e.target.value; refresh(); } }, h('option', { value: '' }, t('all_students')), c.members.map((m) => h('option', { value: m.id, selected: String(m.id) === String(chartUser) }, m.name)))) : null, h('button', { class: 'sm', onclick: () => { location.hash = base + '/imprimir'; } }, t('print'))) : null;
    const right = [h('span', { class: 'chip' }, c.chart.kind === 'team' ? t('team') + ': ' + c.chart.name : t('individual')), stateChip(open), c.chart.role ? h('span', { class: 'chip gry' }, t('p_' + c.chart.role)) : null];
    show(h('div', { class: 'pg-title' }, h('button', { class: 'link', onclick: () => { history.length > 1 ? history.back() : (location.hash = '#/'); } }, t('back')), c.members.length ? h('span', { class: 'mut' }, t('members') + ': ' + c.members.map((m) => m.name).join(', ')) : null),
      banner(c.patient, right), tabBar(tabs, tab, base), !open && !staff ? h('div', { class: 'panel warn' }, h('div', { class: 'pb' }, t('chart_closed'))) : null, window.HCX.consignaCard(c, tab === 'resumen'), window.HCX.dayBar(c, refresh), toolbar, formBox, body);
  }

  async function viewMine() {
    const { charts } = await api('GET', '/api/my/charts');
    const rows = charts.map((c) => { const age = ageOf(c.nacimiento); return h('tr', { class: c.window === 'scheduled' ? 'locked' : 'clk', onclick: () => { if (c.window !== 'scheduled') location.hash = '#/chart/' + c.id; } },
      h('td', null, c.window === 'scheduled' ? (c.patient.trim() || t('sched_name')) : h('a', { href: '#/chart/' + c.id, onclick: (e) => e.stopPropagation() }, c.patient.trim()), c.alergias.length ? h('div', null, h('span', { class: 'al' }, '⚠ ' + c.alergias.join(', '))) : null, c.consigna ? h('div', { class: 'sub' }, t('cs_title') + ': ' + c.consigna.title + (c.consigna.total ? ' · ' + c.consigna.done + '/' + c.consigna.total : '')) : null),
      h('td', null, (age !== '' ? age + ' ' + t('age_years') : '') + (c.sexo ? ' / ' + t('sex_' + c.sexo) : '')), h('td', null, [c.unidad, c.habitacion && 'H ' + c.habitacion, c.cama && 'C ' + c.cama].filter(Boolean).join(' / ')), h('td', null, c.diagnostico),
      h('td', null, h('span', { class: 'chip' }, c.kind === 'team' ? t('team') + ': ' + c.name : t('individual'))), h('td', { class: 'r' }, c.mine), h('td', null, c.window === 'scheduled' ? h('span', { class: 'chip' }, t('win_from_on').replace('{d}', fmtD(c.opens))) : c.window === 'ended' ? h('span', { class: 'chip amb' }, t('win_ended_on').replace('{d}', fmtD(c.closes))) : stateChip(c.status === 'open'), c.closes && !c.window ? h('div', { class: 'sub' }, t('win_until').replace('{d}', fmtD(c.closes))) : null, c.pace === 'student' ? h('div', { class: 'sub' }, t('dy_title').replace('{n}', c.day).replace('{m}', c.cap)) : null)); });
    show(h('div', { class: 'pg-title' }, h('h1', null, t('nav_mine'))), h('p', { class: 'mut' }, t('mine_intro')),
      charts.length ? panel(null, h('div', { class: 'tw' }, h('table', { class: 'grid' }, h('thead', null, h('tr', null, [t('col_patient'), t('col_age'), t('col_loc'), t('col_dx'), t('col_chart'), t('col_mine'), t('col_state')].map((x, i) => h('th', { class: i === 5 ? 'r' : '' }, x)))), h('tbody', null, rows))), { flush: true }) : panel(null, empty(t('mine_empty'))));
  }

  window.HC = { ageOf, name, stateChip, role: () => (ME && ME.role) || '', campus: () => (ME && ME.campus) || '', h, add, clear, api, toast, fail, panel, empty, field, fmtD, fmtDT, fmtISO, nowInput, show, t, plain, recSummary, lang: () => LANG };

  /* ---------- router ---------- */
  async function route() {
    if (!ME) return;
    renderTop();
    const [a, b, c] = location.hash.replace(/^#\/?/, '').split('/');
    try {
      if (a === 'help') return window.HCX.viewHelp(ME.staff && b !== 'student' ? 'teacher' : 'student');
      if (a === 'go' && c) {
        if (b === 'chart') { location.replace('#/chart/' + parseInt(c, 10)); return; }
        if (b === 'consigna' && !ME.staff) { const { charts } = await api('GET', '/api/my/charts'); const m = charts.find((x) => String(x.consigna_id) === c && x.window !== 'scheduled'); if (m) { location.replace('#/chart/' + m.id); return; } toast(t('go_none'), true); }
        location.replace('#/'); return;
      }
      if (!ME.staff) { if (a === 'chart' && b) return await viewChart(parseInt(b, 10), c); return await viewMine(); }
      if (a === 'patient' && b === 'new') return show(h('button', { class: 'link', onclick: () => history.back() }, t('back')), h('h1', null, t('new_patient')), patientForm(null));
      if (a === 'patient' && b && c === 'edit') { const j = await api('GET', '/api/patients/' + parseInt(b, 10)); return show(h('button', { class: 'link', onclick: () => history.back() }, t('back')), h('h1', null, t('edit')), patientForm(j.patient)); }
      if (a === 'patient' && b) return await viewPatient(parseInt(b, 10), c);
      if (a === 'chart' && b) return await viewChart(parseInt(b, 10), c);
      if (a === 'students') return await viewStudents();
      if (a === 'student' && b) return await window.HCX.viewStudent(parseInt(b, 10));
      if (a === 'catalog') return await viewCatalog();
      if (a === 'taxonomy') return await window.HCX.viewTaxonomy();
      if (a === 'audit') return await viewAudit();
      if (a === 'grades') return await window.HCX.viewGrades();
      if (a === 'import') return await window.HCX.viewImport();
      return await viewPatients();
    } catch (e) { fail(e); if (e.status === 404) location.hash = '#/'; }
  }
  async function boot() {
    try { ME = await api('GET', '/api/me'); LANG = ME.lang || LANG; document.documentElement.lang = LANG; document.documentElement.classList.toggle('nocopy', !ME.staff); route(); } catch (_) { document.documentElement.classList.remove('nocopy'); renderLogin(); }
  }
  document.querySelector('.skip').addEventListener('click', (e) => { e.preventDefault(); main.focus(); });
  window.addEventListener('hashchange', route);
  window.addEventListener('DOMContentLoaded', boot);
})();
