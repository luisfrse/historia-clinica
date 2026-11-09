'use strict';
(function () {
  const main = document.getElementById('main'), top = document.getElementById('top'), toastEl = document.getElementById('toast');
  let ME = null, LANG = (navigator.language || 'es').startsWith('ca') ? 'ca' : 'es';
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
    if (r.status === 401 && !url.startsWith('/api/admin/login')) { ME = null; renderLogin(); throw new Error('auth'); }
    if (!r.ok) { const e = new Error((j && j.error) || 'error'); e.status = r.status; throw e; }
    return j;
  }
  const fail = (e) => { if (e.message !== 'auth') toast(t('err') + (e.message && e.message !== 'error' ? ' (' + e.message + ')' : ''), true); };
  const fmtDT = (s) => String(s || '').replace('T', ' ').slice(0, 16);
  const fmtISO = (s) => { try { return new Date(s).toLocaleString(LANG === 'ca' ? 'ca-ES' : 'es-ES', { dateStyle: 'short', timeStyle: 'short' }); } catch (_) { return s; } };
  const nowInput = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const ageOf = (iso) => { if (!iso) return ''; const b = new Date(iso), n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return a >= 0 ? a : ''; };
  const field = (label, input) => h('div', null, h('label', null, label), input);

  /* ---------- cabecera ---------- */
  function renderTop() {
    clear(top);
    add(top, h('span', { class: 'brand' }, '🩺 ' + t('app')));
    if (ME) {
      const nav = h('nav', { 'aria-label': 'Principal' });
      const items = ME.staff ? [['#/', 'nav_patients'], ['#/students', 'nav_students'], ['#/catalog', 'nav_catalog'], ['#/audit', 'nav_audit']] : [['#/', 'nav_mine']];
      items.forEach(([href, k]) => nav.appendChild(h('button', { class: location.hash.replace(/^#/, '') === href.slice(1) || (href === '#/' && (location.hash === '' || location.hash === '#')) ? 'on' : '', onclick: () => { location.hash = href; } }, t(k))));
      add(top, nav);
      add(top, h('span', { class: 'mut' }, ME.name));
    }
    add(top, h('button', { onclick: async () => { LANG = LANG === 'es' ? 'ca' : 'es'; document.documentElement.lang = LANG; if (ME) api('PUT', '/api/me', { lang: LANG }).catch(() => {}); renderTop(); route(); }, 'aria-label': t('lang') }, LANG === 'es' ? 'CA' : 'ES'));
    if (ME) add(top, h('button', { onclick: async () => { await api('POST', '/api/logout').catch(() => {}); ME = null; renderLogin(); } }, t('logout')));
  }

  function renderLogin() {
    renderTop();
    const pw = h('input', { type: 'password', autocomplete: 'current-password' });
    const f = h('form', { onsubmit: async (e) => { e.preventDefault(); try { await api('POST', '/api/admin/login', { password: pw.value }); await boot(); } catch (er) { toast(er.status === 429 ? 'Demasiados intentos' : 'Contraseña incorrecta', true); } } },
      field(t('admin_pw'), pw), h('p', null, h('button', { class: 'pri', type: 'submit' }, t('enter'))));
    show(h('div', { class: 'card' }, h('h1', null, t('login_title')), h('p', null, t('login_campus')), h('p', null, h('a', { class: 'btn pri', href: 'https://campus.luisfs.com' }, t('login_btn')))),
      h('details', { class: 'card' }, h('summary', null, t('admin_pw')), f));
  }

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

  function allergyBox(d) {
    const al = d.alergias || [];
    return h('div', { class: 'card alert-allergy' }, h('h3', null, '⚠ ' + t('sec_allergy')),
      al.length ? h('ul', null, al.map((a) => h('li', null, h('b', null, a.agente), a.reaccion ? ' — ' + a.reaccion : '', a.gravedad ? ' ' : '', a.gravedad ? h('span', { class: 'tag ' + (a.gravedad === 'grave' ? 'danger' : 'warn') }, t('sev_' + a.gravedad)) : ''))) : h('p', null, d.sin_alergias ? t('no_allergy') : t('none')));
  }
  function fichaView(p, staff) {
    const d = p.data, cards = [];
    SECTIONS.forEach(([sk, keys]) => {
      const rows = keys.filter((k) => d[k] != null && d[k] !== '');
      if (!rows.length) return;
      cards.push(h('div', { class: 'card' }, h('h3', null, t(sk)), h('dl', { class: 'ficha' }, rows.map((k) => {
        let v = d[k]; if (k === 'sexo') v = t('sex_' + v); if (k === 'fecha_nacimiento') v = v + ' (' + ageOf(v) + ')';
        return h('div', null, h('dt', null, t('f_' + k)), h('dd', null, v));
      }))));
    });
    return h('div', null, allergyBox(d), cards);
  }

  function patientForm(existing) {
    const d = existing ? existing.data : {}, inputs = {};
    const sections = SECTIONS.map(([sk, keys]) => {
      const body = keys.map((k) => {
        let el;
        if (k === 'sexo') el = h('select', null, ['', 'M', 'F', 'O'].map((v) => h('option', { value: v, selected: d.sexo === v }, v ? t('sex_' + v) : '—')));
        else if (k === 'grupo_sanguineo') el = h('select', null, ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-'].map((v) => h('option', { value: v, selected: d[k] === v }, v || '—')));
        else if (LONG.has(k)) el = h('textarea', { value: d[k] || '' });
        else if (DATES.has(k)) el = h('input', { type: 'date', value: d[k] || '' });
        else if (NUMS.has(k)) el = h('input', { type: 'text', inputmode: 'decimal', value: d[k] != null ? d[k] : '' });
        else el = h('input', { type: 'text', value: d[k] || '', required: k === 'nombre' || k === 'apellidos' });
        inputs[k] = el; return field(t('f_' + k) + (k === 'nombre' || k === 'apellidos' ? ' *' : ''), el);
      });
      return h('div', { class: 'card' }, h('h3', null, t(sk)), h('div', { class: 'cols' }, body));
    });
    const alList = h('div'); let alRows = [];
    const addAl = (a) => {
      const r = { agente: h('input', { type: 'text', value: a.agente || '', placeholder: t('allergy_agent') }), reaccion: h('input', { type: 'text', value: a.reaccion || '', placeholder: t('allergy_reaction') }), gravedad: h('select', null, ['', 'leve', 'moderada', 'grave'].map((v) => h('option', { value: v, selected: a.gravedad === v }, v ? t('sev_' + v) : t('allergy_sev')))) };
      const row = h('div', { class: 'row' }, r.agente, r.reaccion, r.gravedad, h('button', { type: 'button', class: 'danger', onclick: () => { alRows = alRows.filter((x) => x !== r); row.remove(); } }, '✕'));
      alRows.push(r); alList.appendChild(row);
    };
    (d.alergias || []).forEach(addAl);
    const noAl = h('input', { type: 'checkbox', checked: !!d.sin_alergias });
    const alCard = h('div', { class: 'card' }, h('h3', null, t('sec_allergy')), alList, h('p', null, h('button', { type: 'button', onclick: () => addAl({}) }, t('add_allergy'))), h('label', null, noAl, ' ' + t('no_allergy')));
    const form = h('form', {
      onsubmit: async (e) => {
        e.preventDefault();
        const body = {}; for (const [k, el] of Object.entries(inputs)) body[k] = el.value;
        body.alergias = alRows.map((r) => ({ agente: r.agente.value, reaccion: r.reaccion.value, gravedad: r.gravedad.value })).filter((a) => a.agente.trim());
        body.sin_alergias = noAl.checked;
        try { const r = existing ? await api('PUT', '/api/patients/' + existing.id, body) : await api('POST', '/api/patients', body); toast(t('ok')); location.hash = '#/patient/' + (existing ? existing.id : r.id); } catch (er) { fail(er); }
      },
    }, h('p', { class: 'mut' }, t('fictitious')), sections.slice(0, 1), alCard, sections.slice(1), h('div', { class: 'row' }, h('button', { class: 'pri', type: 'submit' }, t('save')), h('button', { type: 'button', onclick: () => history.back() }, t('cancel'))));
    return form;
  }

  /* ---------- profesorado ---------- */
  async function viewPatients() {
    const { patients } = await api('GET', '/api/patients');
    show(h('div', { class: 'row sp' }, h('h1', null, t('nav_patients')), h('button', { class: 'pri', onclick: () => { location.hash = '#/patient/new'; } }, '+ ' + t('new_patient'))),
      patients.length ? h('div', { class: 'grid' }, patients.map((p) => h('div', { class: 'card' },
        h('h3', null, p.data.nombre + ' ' + p.data.apellidos), h('div', { class: 'mut' }, p.code + (p.data.fecha_nacimiento ? ' · ' + ageOf(p.data.fecha_nacimiento) : '') + (p.data.unidad ? ' · ' + p.data.unidad : '')),
        h('p', null, p.data.diagnostico_medico || ''), h('div', { class: 'row' }, h('span', { class: 'tag' }, p.charts + ' ' + t('charts')), h('span', { class: 'tag' }, p.records + ' ' + t('records')), p.archived ? h('span', { class: 'tag warn' }, t('archived')) : null),
        h('p', null, h('button', { onclick: () => { location.hash = '#/patient/' + p.id; } }, '›'))))) : h('p', { class: 'card' }, t('patients_empty')));
  }

  async function viewPatient(id) {
    const [{ patient, charts, revisions }, uj, act] = await Promise.all([api('GET', '/api/patients/' + id), api('GET', '/api/users'), api('GET', '/api/patients/' + id + '/activity')]);
    const users = uj.users.filter((u) => u.active);
    const subjects = uj.subjects;
    /* asignación */
    const picked = new Set(); let mode = 'individual', q = '', sj = '';
    const list = h('div', { class: 'pick' }), cnt = h('span', { class: 'mut' });
    const assignedIds = new Set(charts.flatMap((c) => c.members.map((m) => m.id)));
    const visible = () => users.filter((u) => (!sj || u.subjects.includes(sj)) && (!q || (u.name + ' ' + u.email).toLowerCase().includes(q)));
    const drawList = () => {
      clear(list); const v = visible();
      v.forEach((u) => list.appendChild(h('label', null, h('input', { type: 'checkbox', checked: picked.has(u.id), onchange: (e) => { e.target.checked ? picked.add(u.id) : picked.delete(u.id); cnt.textContent = picked.size + ' ' + t('selected'); } }), u.name, h('span', { class: 'tag' }, t('p_' + u.profile)), assignedIds.has(u.id) ? h('span', { class: 'tag ok' }, '✓') : null)));
      if (!v.length) list.appendChild(h('p', { class: 'mut' }, t('no_students')));
      cnt.textContent = picked.size + ' ' + t('selected');
    };
    const teamName = h('input', { type: 'text', placeholder: t('team_name') });
    const modeSel = h('select', { onchange: (e) => { mode = e.target.value; teamField.hidden = mode !== 'team'; } }, h('option', { value: 'individual' }, t('mode_ind')), h('option', { value: 'team' }, t('mode_team')));
    const teamField = field(t('team_name'), teamName); teamField.hidden = true;
    const sjSel = h('select', { onchange: (e) => { sj = e.target.value; drawList(); } }, h('option', { value: '' }, t('all_subjects')), subjects.map((s) => h('option', { value: s.slug }, s.title)));
    const search = h('input', { type: 'search', placeholder: t('search'), oninput: (e) => { q = e.target.value.toLowerCase(); drawList(); } });
    drawList();
    const assignCard = h('div', { class: 'card' }, h('h2', null, t('assign')),
      h('div', { class: 'cols' }, field(t('assign_mode'), modeSel), teamField, field(t('subject'), sjSel), field(t('search'), search)),
      h('div', { class: 'row' }, h('button', { onclick: () => { visible().forEach((u) => picked.add(u.id)); drawList(); } }, t('select_all')), h('button', { onclick: () => { picked.clear(); drawList(); } }, '✕'), cnt), list,
      h('p', { class: 'row' }, h('button', { class: 'pri', onclick: async () => { try { const r = await api('POST', '/api/patients/' + id + '/assign', { mode, team_name: teamName.value, user_ids: [...picked] }); toast(t('assigned') + ': ' + r.created + (r.skipped ? ' · ' + r.skipped + ' ' + t('skipped') : '')); viewPatient(id); } catch (e) { fail(e); } } }, t('assign_btn')),
        h('button', { onclick: async () => { try { const r = await api('POST', '/api/sync'); toast(t('synced') + ': ' + r.students); viewPatient(id); } catch (e) { fail(e); } } }, t('sync'))));
    /* historias */
    const chartCards = charts.map((c) => h('div', { class: 'card' }, h('div', { class: 'row sp' },
      h('div', null, h('b', null, c.name), ' ', h('span', { class: 'tag' }, c.kind === 'team' ? t('team') : t('individual')), h('span', { class: 'tag ' + (c.status === 'open' ? 'ok' : 'warn') }, c.status === 'open' ? t('status_open') : t('status_closed')), h('div', { class: 'mut' }, c.members.map((m) => m.name).join(', ') + ' · ' + c.recs + ' ' + t('records'))),
      h('div', { class: 'row' }, h('button', { onclick: () => { location.hash = '#/chart/' + c.id; } }, '›'),
        h('button', { onclick: async () => { try { await api('PUT', '/api/charts/' + c.id, { status: c.status === 'open' ? 'closed' : 'open' }); viewPatient(id); } catch (e) { fail(e); } } }, c.status === 'open' ? t('close_chart') : t('open_chart')),
        !c.recs ? h('button', { class: 'danger', onclick: async () => { try { await api('DELETE', '/api/charts/' + c.id); viewPatient(id); } catch (e) { fail(e); } } }, t('delete')) : null))));
    /* actividad */
    const uf = h('select', { onchange: async (e) => { const r = await api('GET', '/api/patients/' + id + '/activity' + (e.target.value ? '?user=' + e.target.value : '')); drawAct(r.records); } }, h('option', { value: '' }, t('all_students')), [...new Map(act.records.map((r) => [r.user_id, r.author])).entries()].map(([k, v]) => h('option', { value: k }, v)));
    const actBox = h('div');
    const drawAct = (recs) => { clear(actBox); if (!recs.length) actBox.appendChild(h('p', { class: 'mut' }, t('no_records'))); recs.forEach((r) => actBox.appendChild(recNode({ id: r.id, author: r.author, type: r.type, data: r.data, occurred: r.occurred, void_at: r.void_at, void_reason: r.void_reason, comments: [] }, { chartLabel: r.chart_name, link: '#/chart/' + r.chart_id }))); };
    drawAct(act.records);
    show(h('button', { class: 'link', onclick: () => { location.hash = '#/'; } }, t('back')),
      h('div', { class: 'row sp' }, h('h1', null, patient.data.nombre + ' ' + patient.data.apellidos + ' ', h('span', { class: 'tag' }, patient.code), patient.archived ? h('span', { class: 'tag warn' }, t('archived')) : null),
        h('div', { class: 'row' }, h('button', { onclick: () => { location.hash = '#/patient/' + id + '/edit'; } }, t('edit')), h('button', { class: 'danger', onclick: async () => { if (patient.archived || confirm(t('confirm_archive'))) { await api('PUT', '/api/patients/' + id, { archived: !patient.archived }); viewPatient(id); } } }, patient.archived ? t('restore') : t('archive')))),
      revisions ? h('p', { class: 'mut' }, revisions + ' ' + t('revisions')) : null, fichaView(patient, true), assignCard, h('h2', null, t('charts_title')), chartCards, h('h2', null, t('activity')), field(t('filter_student'), uf), actBox);
  }

  async function viewStudents() {
    const j = await api('GET', '/api/users');
    const map = Object.assign({}, j.subject_profiles);
    const rows = j.users.map((u) => h('tr', null, h('td', null, u.name, h('div', { class: 'mut' }, u.email)),
      h('td', null, h('select', { 'aria-label': t('role_prof'), onchange: async (e) => { try { await api('PUT', '/api/users/' + u.id, { profile: e.target.value }); toast(t('ok')); } catch (er) { fail(er); } } },
        h('option', { value: 'auto', selected: !u.profile_manual }, t('p_auto') + ' → ' + t('p_' + u.profile)), h('option', { value: 'enfermeria', selected: !!u.profile_manual && u.profile === 'enfermeria' }, t('p_enfermeria')), h('option', { value: 'tcae', selected: !!u.profile_manual && u.profile === 'tcae' }, t('p_tcae')))),
      h('td', null, u.last_login ? fmtISO(u.last_login) : '—'),
      h('td', null, h('label', null, h('input', { type: 'checkbox', checked: !!u.active, onchange: async (e) => { try { await api('PUT', '/api/users/' + u.id, { active: e.target.checked }); } catch (er) { fail(er); } } }), ' ' + t('active')))));
    const sp = j.subjects.length ? h('div', { class: 'card' }, h('h3', null, t('subj_profiles')), h('p', { class: 'mut' }, t('subj_profiles_help')),
      j.subjects.map((s) => h('div', { class: 'row' }, h('span', null, s.title), h('select', { onchange: (e) => { if (e.target.value) map[s.slug] = e.target.value; else delete map[s.slug]; } }, h('option', { value: '' }, '—'), h('option', { value: 'enfermeria', selected: map[s.slug] === 'enfermeria' }, t('p_enfermeria')), h('option', { value: 'tcae', selected: map[s.slug] === 'tcae' }, t('p_tcae'))))),
      h('p', null, h('button', { onclick: async () => { try { await api('PUT', '/api/subject-profiles', { map }); toast(t('ok')); } catch (er) { fail(er); } } }, t('save')))) : null;
    show(h('div', { class: 'row sp' }, h('h1', null, t('nav_students')), h('button', { onclick: async () => { try { const r = await api('POST', '/api/sync'); toast(t('synced') + ': ' + r.students); viewStudents(); } catch (e) { fail(e); } } }, t('sync'))),
      sp, j.users.length ? h('div', { class: 'card' }, h('table', null, h('thead', null, h('tr', null, h('th', null, t('nav_students')), h('th', null, t('role_prof')), h('th', null, t('last_login')), h('th', null, ''))), h('tbody', null, rows))) : h('p', { class: 'card' }, t('no_students')));
  }

  async function viewCatalog() {
    const { items } = await api('GET', '/api/catalog');
    const nes = h('input', { type: 'text' }), nca = h('input', { type: 'text' }), grp = h('input', { type: 'text' });
    const re = h('input', { type: 'checkbox', checked: true }), rt = h('input', { type: 'checkbox' });
    const add1 = h('div', { class: 'card' }, h('h3', null, t('c_add')), h('div', { class: 'cols' }, field(t('c_name_es'), nes), field(t('c_name_ca'), nca), field(t('c_group'), grp)),
      h('div', { class: 'row' }, h('label', null, re, ' ' + t('p_enfermeria')), h('label', null, rt, ' ' + t('p_tcae'))),
      h('p', null, h('button', { class: 'pri', onclick: async () => { try { await api('POST', '/api/catalog', { name_es: nes.value, name_ca: nca.value, grp: grp.value, roles: [re.checked ? 'enfermeria' : '', rt.checked ? 'tcae' : ''].filter(Boolean) }); viewCatalog(); } catch (e) { fail(e); } } }, t('c_add'))));
    const groups = [...new Set(items.map((i) => i.grp))];
    show(h('h1', null, t('nav_catalog')), h('p', { class: 'mut' }, t('catalog_help')), add1, groups.map((g) => h('div', { class: 'card' }, h('h3', null, g || '—'), h('table', null, h('tbody', null, items.filter((i) => i.grp === g).map((i) => h('tr', null,
      h('td', null, LANG === 'ca' && i.name_ca ? i.name_ca : i.name_es, i.active ? '' : h('span', { class: 'tag warn' }, 'off')),
      h('td', null, ['enfermeria', 'tcae'].map((r) => h('label', null, h('input', { type: 'checkbox', checked: i.roles.split(',').includes(r), onchange: async (e) => { const cur = new Set(i.roles.split(',')); e.target.checked ? cur.add(r) : cur.delete(r); i.roles = [...cur].join(','); try { await api('PUT', '/api/catalog/' + i.id, { roles: [...cur] }); } catch (er) { fail(er); } } }), ' ' + t('p_' + r)))),
      h('td', null, h('button', { onclick: async () => { try { await api('PUT', '/api/catalog/' + i.id, { active: !i.active }); viewCatalog(); } catch (e) { fail(e); } } }, i.active ? t('c_off') : t('c_on'))))))))));
  }

  async function viewAudit() {
    const { rows } = await api('GET', '/api/audit');
    show(h('h1', null, t('nav_audit')), h('p', { class: 'mut' }, t('audit_help')), h('div', { class: 'card' }, h('table', null, h('tbody', null, rows.map((r) => h('tr', null, h('td', null, fmtISO(r.ts)), h('td', null, r.who), h('td', null, r.action), h('td', null, r.detail)))))));
  }

  /* ---------- registros ---------- */
  function recBody(r) {
    const d = r.data;
    if (r.type === 'nota') return h('div', null, h('span', { class: 'tag' }, t('n_' + d.tipo)), h('span', { class: 'tag' }, t('t_' + d.turno)), h('div', { class: 'body' }, d.texto));
    if (r.type === 'constantes') {
      const v = [];
      if (d.ta_sis != null) v.push([t('ta'), d.ta_sis + '/' + d.ta_dia + ' mmHg']);
      [['fc', 'lpm'], ['fr', 'rpm'], ['temp', '°C'], ['spo2', '%'], ['glucemia', 'mg/dl'], ['dolor', '/10'], ['peso', 'kg'], ['talla', 'cm']].forEach(([k, u]) => { if (d[k] != null) v.push([t(k).replace(/\s*\(.*$/, ''), d[k] + ' ' + u]); });
      if (d.conciencia) v.push([t('conciencia'), t('c_' + d.conciencia)]);
      return h('div', null, h('div', { class: 'vit body' }, v.map(([a, b]) => h('span', null, a + ': ', h('b', null, b)))), d.obs ? h('div', { class: 'body' }, d.obs) : null);
    }
    if (r.type === 'balance') return h('div', null, h('span', { class: 'tag' }, t(d.dir)), ' ' + t('v_' + d.via) + ': ', h('b', null, d.ml + ' ml'), d.obs ? h('div', { class: 'body' }, d.obs) : null);
    if (r.type === 'cuidado') return h('div', null, h('b', null, LANG === 'ca' ? d.nombre_ca : d.nombre_es), ' ', h('span', { class: 'tag ' + (d.resultado === 'realizado' ? 'ok' : 'warn') }, t('res_' + d.resultado)), d.obs ? h('div', { class: 'body' }, d.obs) : null);
    return h('div', null, JSON.stringify(d));
  }
  function recNode(r, opt) {
    opt = opt || {};
    const meta = h('div', { class: 'meta' }, h('span', { class: 'tag' }, t('r_' + r.type)), fmtDT(r.occurred) + ' · ' + t('by') + ' ' + r.author + (r.author_role ? ' (' + t('p_' + r.author_role) + ')' : ''), opt.chartLabel ? ' · ' : '', opt.link ? h('a', { href: opt.link }, opt.chartLabel) : '');
    const node = h('div', { class: 'rec' + (r.void_at ? ' void' : '') }, meta, recBody(r));
    if (r.void_at) add(node, h('div', { class: 'meta' }, h('span', { class: 'tag danger' }, t('voided')), ' ' + t('reason') + ': ' + r.void_reason + (r.void_name ? ' · ' + t('voided_by') + ' ' + r.void_name : '')));
    (r.comments || []).forEach((c) => add(node, h('div', { class: 'cm' }, h('b', null, c.author + ': '), c.text)));
    if (opt.actions) add(node, h('div', { class: 'row' }, opt.actions));
    return node;
  }

  function recForm(type, ctx, done) {
    const f = {}, when = h('input', { type: 'datetime-local', value: nowInput() });
    const inp = (k, o) => (f[k] = h('input', Object.assign({ type: 'text', inputmode: 'decimal', 'aria-label': t(k) }, o || {})));
    let body;
    if (type === 'nota') {
      f.turno = h('select', null, ['M', 'T', 'N'].map((v) => h('option', { value: v }, t('t_' + v)))); f.tipo = h('select', null, ['evolucion', 'incidencia', 'educacion', 'traspaso'].map((v) => h('option', { value: v }, t('n_' + v)))); f.texto = h('textarea', { required: true });
      body = [h('div', { class: 'cols' }, field(t('turno'), f.turno), field(t('tipo'), f.tipo)), field(t('text'), f.texto)];
    } else if (type === 'constantes') {
      f.conciencia = h('select', null, h('option', { value: '' }, '—'), ['alerta', 'somnoliento', 'estuporoso', 'coma'].map((v) => h('option', { value: v }, t('c_' + v)))); f.obs = h('input', { type: 'text' });
      body = [h('div', { class: 'cols' }, ['ta_sis', 'ta_dia', 'fc', 'fr', 'temp', 'spo2', 'glucemia', 'dolor'].map((k) => field(t(k), inp(k))), field(t('conciencia'), f.conciencia)), field(t('obs'), f.obs)];
    } else if (type === 'balance') {
      f.dir = h('select', { onchange: fillVia }, h('option', { value: 'ingesta' }, t('ingesta')), h('option', { value: 'eliminacion' }, t('eliminacion'))); f.via = h('select'); f.ml = inp('ml'); f.obs = h('input', { type: 'text' });
      function fillVia() { clear(f.via); (f.dir.value === 'ingesta' ? ['oral', 'iv', 'sng', 'otra'] : ['diuresis', 'deposicion', 'vomito', 'drenaje', 'otra']).forEach((v) => f.via.appendChild(h('option', { value: v }, t('v_' + v)))); }
      fillVia(); body = [h('div', { class: 'cols' }, field(t('ingesta') + ' / ' + t('eliminacion'), f.dir), field(t('via'), f.via), field(t('ml'), f.ml)), field(t('obs'), f.obs)];
    } else {
      const items = ctx.catalog.filter((c) => c.roles.split(',').includes(ctx.role) && c.active); const groups = [...new Set(items.map((c) => c.grp))];
      f.catalog_id = h('select', null, groups.map((g) => h('optgroup', { label: g }, items.filter((c) => c.grp === g).map((c) => h('option', { value: c.id }, LANG === 'ca' && c.name_ca ? c.name_ca : c.name_es)))));
      f.resultado = h('select', null, ['realizado', 'rechazado', 'no_tolerado', 'pendiente'].map((v) => h('option', { value: v }, t('res_' + v)))); f.obs = h('textarea');
      body = [h('div', { class: 'cols' }, field(t('care'), f.catalog_id), field(t('result'), f.resultado)), field(t('obs'), f.obs)];
    }
    return h('form', {
      class: 'card', onsubmit: async (e) => {
        e.preventDefault(); const data = {}; for (const [k, el] of Object.entries(f)) data[k] = el.value;
        try { await api('POST', '/api/charts/' + ctx.chartId + '/records', { type, data, occurred: when.value, replaces_id: ctx.replaces || undefined }); toast(t('saved')); done(); } catch (er) { fail(er); }
      },
    }, h('h3', null, t('r_' + type)), ctx.replaces ? h('p', { class: 'mut' }, t('replaces') + ' #' + ctx.replaces) : null, field(t('when'), when), body, h('p', { class: 'row' }, h('button', { class: 'pri', type: 'submit' }, t('register')), h('button', { type: 'button', onclick: done }, t('cancel'))));
  }

  async function viewChart(id, userFilter, replaces) {
    const [c, cat] = await Promise.all([api('GET', '/api/charts/' + id + (userFilter ? '?user=' + userFilter : '')), api('GET', '/api/catalog')]);
    const staff = ME.staff, open = c.chart.status === 'open';
    let formBox = h('div');
    const openForm = (type, rep) => { clear(formBox); formBox.appendChild(recForm(type, { chartId: id, role: c.chart.role, catalog: cat.items, replaces: rep }, () => viewChart(id, userFilter))); formBox.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
    const adder = !staff && open ? h('div', { class: 'row' }, ['nota', 'constantes', 'balance', 'cuidado'].map((ty) => h('button', { class: 'pri', onclick: () => openForm(ty) }, '+ ' + t('r_' + ty)))) : null;
    const recs = c.records.map((r) => recNode(Object.assign({}, r), {
      actions: [
        !staff && r.user_id === ME.id && !r.void_at && open ? h('button', { class: 'danger', onclick: async () => { const reason = prompt(t('void_prompt')); if (!reason) return; try { await api('POST', '/api/records/' + r.id + '/void', { reason }); viewChart(id, userFilter); } catch (e) { fail(e); } } }, t('void')) : null,
        !staff && r.user_id === ME.id && !r.void_at && open ? h('button', { onclick: () => openForm(r.type, r.id) }, t('correct')) : null,
        staff ? h('button', { onclick: async () => { const text = prompt(t('comment_prompt')); if (!text) return; try { await api('POST', '/api/charts/' + id + '/comments', { text, record_id: r.id }); viewChart(id, userFilter); } catch (e) { fail(e); } } }, t('comment')) : null,
        staff && !r.void_at ? h('button', { class: 'danger', onclick: async () => { const reason = prompt(t('void_prompt')); if (!reason) return; try { await api('POST', '/api/records/' + r.id + '/void', { reason }); viewChart(id, userFilter); } catch (e) { fail(e); } } }, t('void')) : null,
      ],
    }));
    const flt = staff && c.members.length > 1 ? field(t('filter_student'), h('select', { onchange: (e) => viewChart(id, e.target.value) }, h('option', { value: '' }, t('all_students')), c.members.map((m) => h('option', { value: m.id, selected: String(m.id) === String(userFilter || '') }, m.name)))) : null;
    show(h('button', { class: 'link', onclick: () => history.back() }, t('back')),
      h('div', { class: 'row sp' }, h('h1', null, c.patient.data.nombre + ' ' + c.patient.data.apellidos), h('div', { class: 'row' }, h('span', { class: 'tag' }, c.chart.kind === 'team' ? t('team') + ': ' + c.chart.name : t('individual')), h('span', { class: 'tag ' + (open ? 'ok' : 'warn') }, open ? t('status_open') : t('status_closed')), c.chart.role ? h('span', { class: 'tag' }, t('p_' + c.chart.role)) : null)),
      h('p', { class: 'mut' }, t('members') + ': ' + c.members.map((m) => m.name).join(', ')),
      h('details', { open: true, class: 'card' }, h('summary', null, h('b', null, t('ficha'))), h('p', { class: 'mut' }, t('readonly_note')), fichaView(c.patient, staff)),
      h('h2', null, t(staff ? 'activity' : 'my_chart')), !open && !staff ? h('p', { class: 'card' }, t('chart_closed')) : null, adder, formBox, flt,
      recs.length ? recs : h('p', { class: 'card mut' }, t('no_records')));
    if (replaces) openForm(c.records.find((r) => r.id === replaces).type, replaces);
  }

  async function viewMine() {
    const { charts } = await api('GET', '/api/my/charts');
    show(h('h1', null, t('nav_mine')), h('p', { class: 'mut' }, t('mine_intro')),
      charts.length ? h('div', { class: 'grid' }, charts.map((c) => h('div', { class: 'card' }, h('h3', null, c.patient), h('div', { class: 'mut' }, c.code + (c.unidad ? ' · ' + c.unidad : '')), h('p', null, c.diagnostico),
        h('div', { class: 'row' }, h('span', { class: 'tag' }, c.kind === 'team' ? t('team') + ': ' + c.name : t('individual')), h('span', { class: 'tag ' + (c.status === 'open' ? 'ok' : 'warn') }, c.status === 'open' ? t('status_open') : t('status_closed')), h('span', { class: 'tag' }, c.mine + ' ' + t('records'))),
        h('p', null, h('button', { class: 'pri', onclick: () => { location.hash = '#/chart/' + c.id; } }, '›'))))) : h('p', { class: 'card' }, t('mine_empty')));
  }

  /* ---------- router ---------- */
  async function route() {
    if (!ME) return;
    renderTop();
    const hs = location.hash.replace(/^#\/?/, '').split('/'); const [a, b, c] = hs;
    try {
      if (!ME.staff) { if (a === 'chart' && b) return await viewChart(parseInt(b, 10)); return await viewMine(); }
      if (a === 'patient' && b === 'new') return show(h('button', { class: 'link', onclick: () => history.back() }, t('back')), h('h1', null, t('new_patient')), patientForm(null));
      if (a === 'patient' && b && c === 'edit') { const j = await api('GET', '/api/patients/' + parseInt(b, 10)); return show(h('button', { class: 'link', onclick: () => history.back() }, t('back')), h('h1', null, t('edit')), patientForm(j.patient)); }
      if (a === 'patient' && b) return await viewPatient(parseInt(b, 10));
      if (a === 'chart' && b) return await viewChart(parseInt(b, 10));
      if (a === 'students') return await viewStudents();
      if (a === 'catalog') return await viewCatalog();
      if (a === 'audit') return await viewAudit();
      return await viewPatients();
    } catch (e) { fail(e); if (e.status === 404) location.hash = '#/'; }
  }
  async function boot() {
    try { ME = await api('GET', '/api/me'); LANG = ME.lang || LANG; document.documentElement.lang = LANG; route(); } catch (_) { renderLogin(); }
  }
  document.querySelector('.skip').addEventListener('click', (e) => { e.preventDefault(); main.focus(); });
  window.addEventListener('hashchange', route);
  boot();
})();
