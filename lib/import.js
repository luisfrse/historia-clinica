'use strict';
/* Importación de un caso clínico desde texto plano (pensado para lo que devuelve una IA).
   parse(texto) -> { patient, orders, events, errors, warnings }; la validación final la hace el servidor con las mismas reglas que el alta manual. */

const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9+\- ]+/g, ' ').replace(/\s+/g, ' ').trim();

const ALIASES = {
  nombre: 'nombre', apellidos: 'apellidos', sexo: 'sexo', 'fecha de nacimiento': 'fecha_nacimiento', nacimiento: 'fecha_nacimiento', edad: 'edad',
  nhc: 'nhc', 'n h c': 'nhc', 'historia clinica': 'nhc', unidad: 'unidad', servicio: 'unidad', habitacion: 'habitacion', cama: 'cama',
  'fecha de ingreso': 'fecha_ingreso', ingreso: 'fecha_ingreso', procedencia: 'procedencia', 'motivo de ingreso': 'motivo_ingreso', motivo: 'motivo_ingreso',
  'enfermedad actual': 'enfermedad_actual', 'diagnostico medico': 'diagnostico_medico', diagnostico: 'diagnostico_medico',
  'antecedentes personales': 'antecedentes_personales', 'antecedentes familiares': 'antecedentes_familiares',
  'intervenciones previas': 'intervenciones_previas', 'intervenciones quirurgicas': 'intervenciones_previas',
  'medicacion habitual': 'medicacion_habitual', peso: 'peso', talla: 'talla', altura: 'talla', 'grupo sanguineo': 'grupo_sanguineo',
  autonomia: 'autonomia', habitos: 'habitos', 'situacion social': 'situacion_social', 'contacto familiar': 'contacto_familiar',
  dieta: 'dieta', aislamiento: 'aislamiento', riesgos: 'riesgos', temas: 'temas', temes: 'temas', etiquetas: 'temas', etiquetes: 'temas', 'tipo de aislamiento': 'aislamiento_tipos', 'tipos de aislamiento': 'aislamiento_tipos', 'tipus d aillament': 'aislamiento_tipos', 'tipus daillament': 'aislamiento_tipos',
  /* catalán */
  nom: 'nombre', cognoms: 'apellidos', sexe: 'sexo', 'data de naixement': 'fecha_nacimiento', naixement: 'fecha_nacimiento', edat: 'edad',
  unitat: 'unidad', habitacio: 'habitacion', servei: 'unidad', llit: 'cama', 'data d ingres': 'fecha_ingreso', ingres: 'fecha_ingreso', 'motiu d ingres': 'motivo_ingreso', motiu: 'motivo_ingreso',
  'malaltia actual': 'enfermedad_actual', 'diagnostic medic': 'diagnostico_medico', diagnostic: 'diagnostico_medico',
  'antecedents personals': 'antecedentes_personales', 'antecedents familiars': 'antecedentes_familiares', 'intervencions previes': 'intervenciones_previas', 'intervencions quirurgiques': 'intervenciones_previas',
  'medicacio habitual': 'medicacion_habitual', pes: 'peso', alcada: 'talla', 'grup sanguini': 'grupo_sanguineo', habits: 'habitos', 'situacio social': 'situacion_social',
  'contacte familiar': 'contacto_familiar', aillament: 'aislamiento', riscos: 'riesgos',
  'notes del docent': 'notas_docente', 'notes del professor': 'notas_docente', 'notes del professorat': 'notas_docente', 'objectius d aprenentatge': 'objetivos_aprendizaje', objectius: 'objetivos_aprendizaje',
  'notas del docente': 'notas_docente', 'notas docente': 'notas_docente', 'notas para el docente': 'notas_docente',
  'objetivos de aprendizaje': 'objetivos_aprendizaje', objetivos: 'objetivos_aprendizaje',
};
const SECTIONS = { consignas: 'consignas', consignes: 'consignas', actividades: 'consignas', activitats: 'consignas', fitxa: 'ficha', 'al lergies': 'alergias', allergies: 'alergias', prescripcions: 'prescripciones', 'proves i esdeveniments': 'eventos', proves: 'eventos', esdeveniments: 'eventos', 'linia temporal': 'eventos', ficha: 'ficha', alergias: 'alergias', prescripciones: 'prescripciones', medicacion: 'prescripciones', 'pruebas y eventos': 'eventos', pruebas: 'eventos', eventos: 'eventos', 'linea temporal': 'eventos' };
const ROUTE_ALIAS = { oral: 'oral', 'via oral': 'oral', vo: 'oral', topica: 'topica', 'via topica': 'topica', sc: 'sc', subcutanea: 'sc', im: 'im', intramuscular: 'im', iv: 'iv', ev: 'iv', intravenosa: 'iv', endovenosa: 'iv', inhalatoria: 'inhalatoria', inhalada: 'inhalatoria', rectal: 'rectal', oftalmica: 'oftalmica', otica: 'otica', sng: 'sng', sonda: 'sng', 'sonda nasogastrica': 'sng', otra: 'otra', altra: 'otra', subcutania: 'sc', inhalada: 'inhalatoria' };
const TASK_ALIAS = { nota: 'nota', notas: 'nota', notes: 'nota', constantes: 'constantes', constants: 'constantes', balance: 'balance', balanc: 'balance', cuidado: 'cuidado', cuidados: 'cuidado', cura: 'cuidado', cures: 'cuidado',
  medicacion: 'medicacion', medicacio: 'medicacion', escala: 'escala', escalas: 'escala', escales: 'escala', valoracion: 'valoracion', valoracio: 'valoracion', plan: 'plan', pla: 'plan', evaluacion: 'plan_eval', avaluacio: 'plan_eval', informe: 'informe', libre: 'libre', lliure: 'libre' };
const SEX = { m: 'M', h: 'M', hombre: 'M', varon: 'M', masculino: 'M', f: 'F', mujer: 'F', femenino: 'F', o: 'O', otro: 'O', otra: 'O', a: 'O', d: 'F', dona: 'F', femeni: 'F', home: 'M', masculi: 'M', altre: 'O' };

const pad = (n) => String(n).padStart(2, '0');
const isoDate = (y, m, d) => y + '-' + pad(m) + '-' + pad(d);
function toDate(v, today) {
  const s = String(v).trim(); let m;
  if (/^(hoy|today|avui)$/i.test(s)) return today;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return isoDate(m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/))) return isoDate(m[3], +m[2], +m[1]);
  return null;
}
const firstNum = (v) => { const m = String(v).replace(',', '.').match(/\d+(\.\d+)?/); return m ? Number(m[0]) : null; };
function parseTimes(v) {
  const out = [];
  for (const part of String(v).split(/[,;\/y]| y /i)) {
    const t = part.trim(); if (!t) continue;
    const m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*h?$/i); if (!m || +m[1] > 23 || (m[2] && +m[2] > 59)) return null;
    out.push(pad(+m[1]) + ':' + (m[2] || '00'));
  }
  return out.join(',');
}
function parseDays(v) {
  const s = String(v || '').trim(); if (!s) return { start: 1, end: null };
  let m;
  if ((m = s.match(/(\d+)\s*(?:-|–|a|al|hasta|fins(?: a)?)\s*(\d+)/i))) return { start: +m[1], end: +m[2] };
  if ((m = s.match(/(?:desde|des de|d[ií]a)?\s*(\d+)\s*(?:-|–|en adelante|endavant|\+)\s*$/i)) && /desde|des de|-|–|adelante|endavant|\+/i.test(s)) return { start: +m[1], end: null };
  if ((m = s.match(/(\d+)/))) return { start: +m[1], end: /solo|nom[eé]s|[uú]nic|hasta|fins/i.test(s) ? +m[1] : null };
  return null;
}

function clean(line) {
  return line.replace(/\r/g, '').replace(/^\s*>\s?/, '').replace(/\*\*|__|`/g, '').replace(/\s+$/, '');
}
const unfilled = (v) => /^\(.*\)$/.test(v) || /^\[.*\]$/.test(v) || /^(n\/a|—|-|…|\.\.\.)$/i.test(v);

function parse(text, today) {
  const errors = [], warnings = [], raw = {}, allergies = [], orders = [], events = [], consignas = [];
  let cur = null, cmode = 'body';
  let sinAlergias = false, section = 'ficha', curKey = null;
  const lines = String(text || '').split('\n');
  const err = (n, m) => errors.push({ line: n, msg: m }), warn = (n, m) => warnings.push({ line: n, msg: m });
  const HEADERS = ['tipo', 'tipus', 'farmaco', 'farmac', 'dia', 'agente', 'agent', 'medicamento', 'medicament'];
  /* null = no es un elemento de lista; '' = cabecera de la plantilla (se ignora) */
  const listItem = (l) => {
    const m = l.match(/^\s*(?:[-*•–]|\d+[.)])\s+(.*)$/); let it = m ? m[1].trim() : /\|/.test(l) ? l.trim() : null;
    if (it == null) return null;
    it = it.replace(/^(ejemplo|exemple)( a demanda)?:\s*/i, '');
    return HEADERS.includes(norm(it.split('|')[0])) ? '' : it;
  };

  lines.forEach((line0, i) => {
    const n = i + 1; let l = clean(line0);
    if (/^\s*```/.test(l) || !l.trim()) { if (!l.trim() && curKey && raw[curKey]) raw[curKey] += '\n'; return; }
    const head = l.replace(/^\s*#+\s*/, '').replace(/^\s*[\[(]\s*/, '').replace(/\s*[\])]\s*:?\s*$/, '').trim();
    if (norm(head) in SECTIONS && head.length < 40 && !/:\s*\S/.test(l)) { section = SECTIONS[norm(head)]; curKey = null; return; }
    if (/^\s*(caso cl[ií]nico|cas cl[ií]nic|datos (del caso|para la ia)|dades del cas|tema o patolog|nivel del alumnado|nivell de l.alumnat|idioma del contenido|idioma del contingut|duraci[oó]n del ingreso|durada de l.ingr)/i.test(l) && !/\|/.test(l)) return;

    if (section === 'ficha') {
      const m = l.match(/^\s*(?:[-*•]\s*)?([^:|]{2,40}):\s*(.*)$/);
      const key = m && ALIASES[norm(m[1])];
      if (key) {
        curKey = key; const v = m[2].trim();
        if (key === 'alergias') return;
        raw[key] = unfilled(v) ? '' : v; return;
      }
      if (m && (norm(m[1]) === 'alergias' || norm(m[1]) === 'al lergies')) { section = 'alergias'; curKey = null; const v = m[2].trim(); if (v && !unfilled(v)) { if (/^(ninguna|sin alergias|no conocidas|no|cap|sense al)\b/i.test(v)) sinAlergias = true; else allergies.push({ n, parts: v.split('|').map((x) => x.trim()) }); } return; }
      if (m && /^[A-Za-zÁÉÍÓÚÜÑÀÈÒÏÇáéíóúüñàèòïç ]{2,40}$/.test(m[1]) && !curKey) { warn(n, 'Campo desconocido «' + m[1].trim() + '»: se ha ignorado.'); return; }
      if (curKey) raw[curKey] = (raw[curKey] ? raw[curKey] + '\n' : '') + l.trim();
      else warn(n, 'Línea fuera de un campo: se ha ignorado.');
      return;
    }
    if (section === 'alergias') {
      const li = listItem(l); if (li === '') return;
      const it = li || l.trim();
      if (/^(ninguna|sin alergias|no se conocen|no conocidas|cap\b|sense al|no es coneix)/i.test(it)) { sinAlergias = true; return; }
      if (!unfilled(it)) allergies.push({ n, parts: it.split('|').map((x) => x.trim()) }); return;
    }
    if (section === 'prescripciones') {
      const it = listItem(l); if (it === '' || (it != null && unfilled(it))) return;
      if (it == null) { warn(n, 'Línea de prescripciones sin formato de lista: se ha ignorado.'); return; }
      const p = it.split('|').map((x) => x.trim());
      const [drug, dose = '', route = '', freq = '', times = '', days = '', notes = ''] = p;
      const rk = route ? ROUTE_ALIAS[norm(route)] : 'oral'; if (!rk) { err(n, 'Vía no reconocida «' + route + '» en «' + drug + '».'); return; }
      const prn = /precisa|prn|sos|necesario|\bsi cal\b|necessari|a demanda/i.test(times + ' ' + freq);
      let tm = ''; if (!prn && times) { tm = parseTimes(times); if (tm == null) { err(n, 'Horas no válidas «' + times + '» en «' + drug + '» (usa HH:MM separadas por comas).'); return; } }
      const d = parseDays(days); if (!d) { err(n, 'Días no válidos «' + days + '» en «' + drug + '».'); return; }
      orders.push({ n, drug, dose, route: rk, freq, times: tm, prn, start_day: d.start, end_day: d.end, notes });
      return;
    }
    if (section === 'eventos') {
      const it = listItem(l); if (it === '' || (it != null && unfilled(it))) return;
      if (it == null) { warn(n, 'Línea de pruebas y eventos sin formato de lista: se ha ignorado.'); return; }
      const p = it.split('|').map((x) => x.trim());
      const day = firstNum(p[0]); if (!day || day < 1 || day > 60 || !Number.isInteger(day)) { err(n, 'Día no válido «' + p[0] + '» (de 1 a 60).'); return; }
      const k = norm(p[1] || ''); let kind = k.startsWith('prueba') || k.startsWith('prova') ? 'prueba' : k.startsWith('evento') || k.startsWith('esdeveniment') ? 'evento' : null;
      if (!kind) { warn(n, 'Tipo «' + (p[1] || '') + '» no reconocido (prueba o evento): se ha tratado como evento.'); kind = 'evento'; }
      if (!p[2]) { err(n, 'Falta el título.'); return; }
      events.push({ n, kind, day, title: p[2], body: p.slice(3).join(' | ') });
      return;
    }
    if (section === 'consignas') {
      const hm = l.match(/^\s*(?:[-*•]\s*)?(?:consigna|consignes?|activitat|actividad)\s*\d*\s*[:.\-–]\s*(.*)$/i);
      if (hm) { const ti = hm[1].trim(); cur = { n, title: unfilled(ti) ? '' : ti, body: '', due: '', tasks: [] }; cmode = 'body'; consignas.push(cur); return; }
      if (!cur) { if (l.trim() && !unfilled(l.trim())) warn(n, 'Línea de consignas fuera de una consigna: se ha ignorado.'); return; }
      const lm = l.match(/^\s*(?:[-*•]\s*)?([^:|]{2,30}):\s*(.*)$/), lk = lm && norm(lm[1]);
      if (lk && ['enunciado', 'enunciat', 'descripcion', 'descripcio'].includes(lk)) { cmode = 'body'; const v = lm[2].trim(); cur.body = unfilled(v) ? '' : v; return; }
      if (lk && ['entrega', 'lliurament', 'fecha de entrega', 'data de lliurament'].includes(lk)) { const v = lm[2].trim(); if (v && !unfilled(v)) { const dd = toDate(v, today); if (dd) cur.due = dd; else warn(n, 'Fecha de entrega no válida: usa AAAA-MM-DD.'); } return; }
      if (lk && ['tareas', 'tasques'].includes(lk)) { cmode = 'tasks'; return; }
      if (cmode === 'tasks') {
        const it = listItem(l); if (it === '' || (it != null && unfilled(it))) return;
        if (it == null) { if (l.trim()) warn(n, 'Línea de tareas sin formato de lista: se ha ignorado.'); return; }
        const p = it.split('|').map((x) => x.trim()), m2 = p[0].match(/^([A-Za-zÀ-ÿ_·]+)\s*(?:[x×:]\s*|\s+)?(\d+)?$/), kind = m2 && TASK_ALIAS[norm(m2[1])];
        if (!kind || !p[1]) { err(n, 'Tarea no válida «' + it.slice(0, 50) + '»: usa «tipo | texto» (tipos: nota, constantes, balance, cuidado, medicacion, escala, valoracion, plan, informe, libre).'); return; }
        cur.tasks.push({ kind, min: kind === 'libre' ? 0 : Math.max(1, +m2[2] || 1), text: p.slice(1).join(' | ') }); return;
      }
      cur.body += (cur.body ? '\n' : '') + l.trim();
      return;
    }
  });

  /* ficha */
  const b = {}; let topics = [];
  for (const [k, v0] of Object.entries(raw)) {
    const v = String(v0).replace(/\n+$/g, '').trim(); if (!v) continue;
    if (k === 'sexo') { const s = SEX[norm(v)]; if (s) b.sexo = s; else warnings.push({ line: 0, msg: 'Sexo «' + v + '» no reconocido (M, F u O).' }); }
    else if (k === 'fecha_nacimiento' || k === 'fecha_ingreso') { const d = toDate(v, today); if (d) b[k] = d; else warnings.push({ line: 0, msg: 'Fecha no válida en «' + k.replace('_', ' ') + '»: usa AAAA-MM-DD.' }); }
    else if (k === 'edad') { const a = firstNum(v); if (a != null && a >= 0 && a < 120 && !raw.fecha_nacimiento) { const t = new Date(today + 'T00:00:00'); b.fecha_nacimiento = isoDate(t.getFullYear() - Math.floor(a), t.getMonth() + 1, t.getDate()); } }
    else if (k === 'peso') { const x = firstNum(v); if (x != null) b.peso = x; }
    else if (k === 'talla') { let x = firstNum(v); if (x != null) { if (x < 3) x *= 100; b.talla = Math.round(x); } }
    else if (k === 'temas') topics = v.split(/[,;\n]/).map((x) => x.trim().replace(/^[-*•]\s*/, '')).filter((x) => x && !/^\(.*\)$/.test(x)).slice(0, 15);
    else if (k === 'aislamiento_tipos') {
      const out = []; for (const w of v.split(/[,;+\/]| y | i /i).map((x) => norm(x)).filter(Boolean)) {
        const t = /^(contact)/.test(w) ? 'contacto' : /^(got)/.test(w) ? 'gotas' : /^(aer|aire|aeros)/.test(w) ? 'aereo' : /^(protec|inver)/.test(w) ? 'protector' : /^(ningun|cap|no|sin|sense)/.test(w) ? '' : null;
        if (t === null) warnings.push({ line: 0, msg: 'Tipo de aislamiento «' + w + '» no reconocido (contacto, gotas, aereo, protector).' }); else if (t && !out.includes(t)) out.push(t);
      } if (out.length) b.aislamiento_tipos = out;
    }
    else if (k === 'grupo_sanguineo') { const g = v.replace(/\s+/g, '').toUpperCase().replace(/^O/, '0').replace(/(POSITIVO|POSITIU)$/, '+').replace(/(NEGATIVO|NEGATIU)$/, '-'); b.grupo_sanguineo = g; }
    else b[k] = v;
  }
  b.alergias = [];
  for (const a of allergies) {
    const g = norm(a.parts[2] || ''); const grav = g.startsWith('leve') || g.startsWith('lleu') ? 'leve' : g.startsWith('moder') ? 'moderada' : g.startsWith('grave') || g.startsWith('greu') ? 'grave' : '';
    if (a.parts[0]) b.alergias.push({ agente: a.parts[0], reaccion: a.parts[1] || '', gravedad: grav });
  }
  if (sinAlergias && !b.alergias.length) b.sin_alergias = true;
  const cons = consignas.filter((c) => { if (c.title) return true; if (c.body || c.tasks.length > 1) warn(c.n, 'Consigna sin título: se ha omitido.'); return false; });
  if (!b.nombre) err(0, 'Falta el campo «Nombre» en la ficha.');
  if (!b.apellidos) err(0, 'Falta el campo «Apellidos» en la ficha.');
  return { patient: b, topics, orders, events, consignas: cons, errors, warnings };
}

const TEMPLATE = `Eres docente de Enfermería y TCAE y preparas un caso clínico FICTICIO y realista para una simulación de historia clínica con alumnado.
Responde SOLO con el texto de abajo, ya rellenado, sin explicaciones, sin Markdown, sin negritas y sin cambiar los nombres de los apartados ni de los campos.
Reglas:
- Todos los datos son inventados (nada de personas reales). Elige nombres y apellidos habituales.
- Fechas en formato AAAA-MM-DD. Horas en formato HH:MM. Peso en kg y talla en cm, solo números.
- Sexo: M, F u O. Grupo sanguíneo: A+, A-, B+, B-, AB+, AB-, 0+ o 0-.
- Tipo de aislamiento: ninguno o uno o varios de contacto, gotas, aereo y protector (las precauciones estándar se dan siempre y no se escriben). Si hay aislamiento, explica en «Aislamiento» el microorganismo y las medidas.
- Vía de administración: oral, topica, sc, im, iv, inhalatoria, rectal, oftalmica, otica, sng u otra.
- Si un dato no procede, deja el campo vacío (no escribas «N/A»).
- Sustituye las líneas de ejemplo por las prescripciones y los eventos reales del caso, y no copies las líneas de cabecera.
- Cada prescripción y cada prueba o evento va en una línea que empieza por «- », con los datos separados por « | ». En «Horas» pon «si precisa» para las pautas a demanda.
- Los días son los del ingreso: «Día 1» es el primero. Reparte las pruebas y los eventos a lo largo de varios días para que el caso avance.
- Escribe de 2 a 3 consignas distintas para poder reutilizar el caso con actividades diferentes. Tipos de tarea: nota, constantes, balance, cuidado, medicacion, escala, valoracion, plan, informe y libre (sin comprobación automática). Añade «x2» tras el tipo para pedir dos registros. Si algo no aplica, borra las líneas de ejemplo.
- «Notas del docente» y «Objetivos de aprendizaje» solo los verá el profesorado: incluye la evolución esperada, los puntos clave y los errores típicos del alumnado.

DATOS DEL CASO QUE QUIERO (edítalo antes de enviarlo):
Tema o patología: (por ejemplo, EPOC reagudizada)
Nivel del alumnado: (por ejemplo, 1.º de Cuidados Auxiliares de Enfermería)
Idioma del contenido: (castellano o catalán)
Duración del ingreso: (por ejemplo, 5 días)

[FICHA]
Nombre:
Apellidos:
Sexo:
Fecha de nacimiento:
NHC:
Unidad:
Habitación:
Cama:
Fecha de ingreso:
Procedencia:
Motivo de ingreso:
Enfermedad actual:
Diagnóstico médico:
Antecedentes personales:
Antecedentes familiares:
Intervenciones previas:
Medicación habitual:
Peso:
Talla:
Grupo sanguíneo:
Autonomía:
Hábitos:
Situación social:
Contacto familiar:
Dieta:
Tipo de aislamiento: (ninguno, o uno o varios separados por comas: contacto, gotas, aereo, protector)
Aislamiento: (detalles: microorganismo, motivo, medidas)
Riesgos:
Notas del docente:
Objetivos de aprendizaje:
Temas: (de 2 a 4 etiquetas separadas por comas, por ejemplo: Respiratorio, EPOC, Oxigenoterapia)

[ALERGIAS]
- Agente | Reacción | Gravedad (leve, moderada o grave)
(Si no tiene alergias conocidas, escribe solo: Ninguna)

[PRESCRIPCIONES]
- Fármaco | Dosis | Vía | Pauta | Horas | Días | Notas
- Ejemplo: Paracetamol | 1 g | oral | cada 8 h | 08:00, 16:00, 00:00 | 1-5 | Si fiebre o dolor
- Ejemplo a demanda: Salbutamol | 2 inhalaciones | inhalatoria | si precisa | si precisa | 1-5 |

[CONSIGNAS]
Consigna 1: (título corto de la actividad)
Enunciado: (qué debe hacer el alumnado, en 2 a 4 frases dirigidas a él)
Entrega: (AAAA-MM-DD, opcional)
Tareas:
- tipo | Texto de la tarea
- Ejemplo: constantes x2 | Registra las constantes de ingreso y una segunda toma
- Ejemplo: medicacion | Administra la medicación de la mañana
- Ejemplo: libre | Prepara una explicación para la paciente
Consigna 2: (otra actividad distinta con el mismo paciente)
Enunciado:
Tareas:
- tipo | Texto de la tarea

[PRUEBAS Y EVENTOS]
- Día | prueba o evento | Título | Descripción
- Ejemplo: 1 | prueba | Radiografía de tórax | Infiltrado en base derecha.
- Ejemplo: 2 | evento | Fiebre vespertina | Temperatura 38,5 °C a las 18:00.
`;

const EXAMPLE = `[FICHA]
Nombre: Carmen
Apellidos: Ruiz Soto
Sexo: F
Edad: 78
NHC: 482915
Unidad: Medicina Interna
Habitación: 214
Cama: B
Fecha de ingreso: hoy
Procedencia: Urgencias
Motivo de ingreso: Disnea progresiva de 3 días, aumento de la tos con expectoración purulenta y fiebre de 38 °C.
Enfermedad actual: Paciente con EPOC conocida que acude a Urgencias por empeoramiento de su disnea habitual, con tos y expectoración amarillo-verdosa desde hace 3 días. En Urgencias: SpO2 88 % basal, sibilancias espiratorias y crepitantes en base derecha. Radiografía con infiltrado en base derecha. Se ingresa con diagnóstico de reagudización de EPOC con probable neumonía.
Diagnóstico médico: Reagudización de EPOC con neumonía de base derecha
Antecedentes personales: EPOC GOLD III desde hace 8 años. Hipertensión arterial. Ex fumadora de 40 paquetes-año (dejó de fumar hace 5 años). Diabetes mellitus tipo 2 en tratamiento oral.
Antecedentes familiares: Padre fallecido por infarto de miocardio. Madre con diabetes.
Intervenciones previas: Colecistectomía hace 15 años.
Medicación habitual: Enalapril 10 mg/24 h, metformina 850 mg/12 h, tiotropio inhalado 18 mcg/24 h, salbutamol a demanda.
Peso: 68
Talla: 158
Grupo sanguíneo: A+
Autonomía: Independiente para las actividades básicas; precisa ayuda con las escaleras. Usa gafas.
Hábitos: Duerme unas 6 horas, con dos almohadas. Dieta diabética. Camina a diario cerca de casa.
Situación social: Viuda, vive sola en un primer piso con ascensor. Su hija la visita a diario.
Contacto familiar: Marta (hija) 600 000 000
Dieta: Diabética, 1.500 kcal, sin sal añadida
Tipo de aislamiento: ninguno
Aislamiento: Ninguno
Riesgos: Riesgo de caídas por disnea y debilidad. Riesgo de úlceras por presión moderado. Riesgo de broncoaspiración bajo.
Notas del docente: Caso para trabajar la valoración respiratoria y la oxigenoterapia. Errores típicos: subir el flujo de oxígeno sin control en paciente con EPOC (objetivo SpO2 88-92 %), no registrar la glucemia en paciente diabética que recibe corticoides, y olvidar la educación sanitaria sobre el uso del inhalador. Evolución esperada: mejoría progresiva con fiebre el día 2 y pico de glucemia el día 3.
Temas: Respiratorio, EPOC, Oxigenoterapia, Diabetes
Objetivos de aprendizaje: Valorar el patrón respiratorio. Administrar oxigenoterapia con seguridad. Aplicar los cinco correctos en la administración de medicación (vía oral, intravenosa, subcutánea e inhalada). Registrar constantes y balance hídrico. Elaborar un plan de cuidados con el problema «Limpieza ineficaz de las vías aéreas».

[ALERGIAS]
- Penicilina | Urticaria generalizada | grave
- Látex | Dermatitis de contacto | leve

[PRESCRIPCIONES]
- Paracetamol | 1 g | oral | cada 8 h | 08:00, 16:00, 00:00 | 1-5 | Si dolor o fiebre mayor de 37,5 °C
- Levofloxacino | 500 mg | iv | cada 24 h | 10:00 | 1-5 | Diluido en 100 ml de suero fisiológico, en 60 minutos
- Enoxaparina | 40 mg | sc | cada 24 h | 20:00 | 1-5 | Rotar la zona de punción
- Prednisona | 30 mg | oral | cada 24 h | 08:00 | 1-4 | Con el desayuno
- Metformina | 850 mg | oral | cada 12 h | 09:00, 21:00 | 1-5 | Con las comidas
- Salbutamol | 2 inhalaciones | inhalatoria | si precisa | si precisa | 1-5 | Si disnea o sibilancias

[CONSIGNAS]
Consigna 1: Turno de mañana: valoración y administración
Enunciado: Eres la enfermera del turno de mañana y recibes a la paciente en planta. Valórala, registra sus constantes, administra la medicación de las 08:00 y anota la evolución del turno.
Tareas:
- constantes x2 | Registra las constantes de ingreso y una segunda toma a media mañana
- valoracion | Realiza la valoración por patrones (respiratorio y actividad)
- medicacion x2 | Administra el paracetamol y el levofloxacino de la mañana
- nota | Escribe una nota de evolución del turno
Consigna 2: Plan de cuidados y educación sanitaria
Enunciado: Con la información de los tres primeros días, elabora el plan de cuidados de la paciente y prepara la educación para el alta.
Tareas:
- plan | Elabora el problema «Limpieza ineficaz de las vías aéreas» con objetivo e intervenciones
- escala | Valora el riesgo de úlceras con la escala Braden
- informe | Redacta el informe de traspaso al turno siguiente
- libre | Prepara una explicación breve sobre el uso del inhalador

[PRUEBAS Y EVENTOS]
- 1 | prueba | Radiografía de tórax | Infiltrado alveolar en base derecha. Hiperinsuflación pulmonar.
- 1 | prueba | Analítica de ingreso | Leucocitos 14.200/µl, PCR 85 mg/l, glucemia 168 mg/dl, creatinina 0,9 mg/dl.
- 2 | evento | Fiebre vespertina | Temperatura de 38,5 °C a las 18:00, con escalofríos. Se administra paracetamol y se avisa al médico.
- 2 | prueba | Gasometría arterial | pH 7,36, pCO2 48 mmHg, pO2 62 mmHg, HCO3 27 mEq/l con 2 l/min de oxígeno.
- 3 | evento | Hiperglucemia por corticoides | Glucemia capilar de 245 mg/dl antes de la cena. Se avisa al médico, que pauta insulina rápida según pauta.
- 4 | prueba | Hemocultivos | Negativos a las 72 horas.
- 5 | evento | Preparación del alta | Saturación 94 % sin oxígeno. Se revisa con la paciente el uso del inhalador y los signos de alarma.
`;

const CA = require('./import-ca');
module.exports = { parse, TEMPLATE, EXAMPLE, TEMPLATES: { es: TEMPLATE, ca: CA.TEMPLATE_CA }, EXAMPLES: { es: EXAMPLE, ca: CA.EXAMPLE_CA } };
