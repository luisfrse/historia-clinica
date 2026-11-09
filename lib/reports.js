'use strict';
/* Informes en PDF (todo lo que ha introducido un alumno) y ZIP con varios. Sin dependencias. */
const zlib = require('zlib');
const { Doc } = require('./minipdf');
const SC = require('../public/scales');

const L = {
  es: {
    title: 'Informe de actividad del alumno/a', generated: 'Generado el', student: 'Alumno/a', nothing: 'Sin registros todavía.', chart: 'Historia', consigna: 'Consigna', due: 'Entrega', tasks: 'Tareas',
    progress: 'hechas', dayw: 'Día', grade: 'Nota', published: 'publicada', unpublished: 'sin publicar', comment: 'Comentario del profesorado', records: 'registros', voided: 'ANULADO', reason: 'motivo', pag: 'Pag.',
    turno: { M: 'mañana', T: 'tarde', N: 'noche' }, dir: { ingesta: 'Ingesta', eliminacion: 'Eliminación' },
    res: { realizado: 'realizado', rechazado: 'rechazado', no_tolerado: 'no tolerado', pendiente: 'pendiente' }, st: { administrada: 'administrada', rechazada: 'rechazada', omitida: 'omitida', retrasada: 'retrasada' },
    pl: { conseguido: 'conseguido', parcial: 'parcial', no_conseguido: 'no conseguido' }, inf: { alta: 'Informe de alta', traspaso: 'Informe de traspaso' }, alta: 'alta', media: 'media', baja: 'baja', priority: 'Prioridad',
    types: { nota: 'Nota de evolución', constantes: 'Constantes', balance: 'Balance hídrico', cuidado: 'Cuidado', medicacion: 'Medicación', escala: 'Escala', valoracion: 'Valoración', plan: 'Plan de cuidados', plan_eval: 'Evaluación del plan', informe: 'Informe' },
    alert: 'ALERTA', cause: 'Causa', goal: 'Objetivo', interv: 'Intervenciones', summary: 'Resumen', state: 'Estado', recs: 'Recomendaciones', pain: 'Dolor',
  },
  ca: {
    title: "Informe d'activitat de l'alumne/a", generated: 'Generat el', student: 'Alumne/a', nothing: 'Encara sense registres.', chart: 'Història', consigna: 'Consigna', due: 'Lliurament', tasks: 'Tasques',
    progress: 'fetes', dayw: 'Dia', grade: 'Nota', published: 'publicada', unpublished: 'sense publicar', comment: 'Comentari del professorat', records: 'registres', voided: 'ANUL·LAT', reason: 'motiu', pag: 'Pag.',
    turno: { M: 'matí', T: 'tarda', N: 'nit' }, dir: { ingesta: 'Ingesta', eliminacion: 'Eliminació' },
    res: { realizado: 'realitzat', rechazado: 'rebutjat', no_tolerado: 'no tolerat', pendiente: 'pendent' }, st: { administrada: 'administrada', rechazada: 'rebutjada', omitida: 'omesa', retrasada: 'retardada' },
    pl: { conseguido: 'aconseguit', parcial: 'parcial', no_conseguido: 'no aconseguit' }, inf: { alta: "Informe d'alta", traspaso: 'Informe de traspàs' }, alta: 'alta', media: 'mitjana', baja: 'baixa', priority: 'Prioritat',
    types: { nota: "Nota d'evolució", constantes: 'Constants', balance: 'Balanç hídric', cuidado: 'Cura', medicacion: 'Medicació', escala: 'Escala', valoracion: 'Valoració', plan: 'Pla de cures', plan_eval: 'Avaluació del pla', informe: 'Informe' },
    alert: 'ALERTA', cause: 'Causa', goal: 'Objectiu', interv: 'Intervencions', summary: 'Resum', state: 'Estat', recs: 'Recomanacions', pain: 'Dolor',
  },
};
const ROUTE = { es: { oral: 'oral', topica: 'tópica', sc: 'subcutánea', im: 'intramuscular', iv: 'intravenosa', inhalatoria: 'inhalatoria', rectal: 'rectal', oftalmica: 'oftálmica', otica: 'ótica', sng: 'sonda', otra: 'otra' },
  ca: { oral: 'oral', topica: 'tòpica', sc: 'subcutània', im: 'intramuscular', iv: 'intravenosa', inhalatoria: 'inhalatòria', rectal: 'rectal', oftalmica: 'oftàlmica', otica: 'òtica', sng: 'sonda', otra: 'altra' } };

/* Texto legible de un registro. */
function recText(r, lang) {
  const t = L[lang] || L.es, d = r.data || {}, i = lang === 'ca' ? 1 : 0;
  let x = '';
  switch (r.type) {
    case 'nota': x = (d.turno ? '[' + (t.turno[d.turno] || d.turno) + '] ' : '') + (d.texto || ''); break;
    case 'constantes': {
      const v = []; if (d.ta_sis != null) v.push('TA ' + d.ta_sis + '/' + d.ta_dia);
      [['fc', 'FC'], ['fr', 'FR'], ['temp', 'T'], ['spo2', 'SpO2'], ['glucemia', 'Gluc'], ['dolor', t.pain], ['peso', 'Peso'], ['talla', 'Talla']].forEach(([k, l]) => { if (d[k] != null) v.push(l + ' ' + d[k]); });
      if (d.conciencia) v.push(d.conciencia); x = v.join(', ') + (d.obs ? ' - ' + d.obs : ''); break;
    }
    case 'balance': x = (t.dir[d.dir] || d.dir) + ' - ' + d.via + ' - ' + d.ml + ' ml' + (d.obs ? ' - ' + d.obs : ''); break;
    case 'cuidado': x = (i ? d.nombre_ca : d.nombre_es) + ' - ' + (t.res[d.resultado] || d.resultado) + (d.obs ? ' - ' + d.obs : ''); break;
    case 'medicacion': x = d.farmaco + ' ' + d.dosis + ' (' + (ROUTE[lang] || ROUTE.es)[d.via] + ') - ' + (t.st[d.estado] || d.estado) + (d.slot ? ' - ' + d.slot : '') + (d.lote ? ' - lote ' + d.lote : '') + (d.obs ? ' - ' + d.obs : ''); break;
    case 'escala': { const s = SC.SCALES[d.scale]; x = (s ? s[lang === 'ca' ? 'ca' : 'es'] : d.scale) + ': ' + d.total + ' - ' + ((s && s.levels[d.nivel] && s.levels[d.nivel][i]) || d.nivel) + (d.alerta ? ' (' + t.alert + ')' : '') + (d.obs ? ' - ' + d.obs : ''); break; }
    case 'valoracion': x = ((SC.PATRONES[d.patron] || [d.patron])[i] || d.patron) + (d.alterado ? ' (' + t.alert + ')' : '') + ': ' + d.texto; break;
    case 'plan': x = d.problema + ' [' + t.priority + ' ' + (t[d.prioridad] || d.prioridad) + ']\n' + t.cause + ': ' + (d.causa || '-') + '\n' + t.goal + ': ' + d.objetivo + '\n' + t.interv + ': ' + d.intervenciones; break;
    case 'plan_eval': x = (t.pl[d.resultado] || d.resultado) + (d.texto ? ': ' + d.texto : ''); break;
    case 'informe': x = (t.inf[d.tipo] || d.tipo) + '\n' + t.summary + ': ' + d.resumen + (d.estado ? '\n' + t.state + ': ' + d.estado : '') + (d.recomendaciones ? '\n' + t.recs + ': ' + d.recomendaciones : ''); break;
    default: x = JSON.stringify(d);
  }
  return x;
}

const fmtD = (s) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : s || '');
const fmtDT = (s) => (s ? fmtD(s) + ' ' + String(s).slice(11, 16) : '');

/* model = { user:{name,email}, charts:[{ code, patient, name, status, consigna:{title,due,body,tasks:[{text,kind,min,done,count}]}|null, grade:{total,published,comment}|null, records:[{type,data,occurred,void_at,void_reason,comments:[{author,text}]}] }] } */
function studentPdf(model, lang, today) {
  const t = L[lang] || L.es;
  const doc = new Doc(t.title + ' - ' + model.user.name, { pageWord: t.pag });
  doc.h1(t.title);
  doc.text(t.student + ': ' + model.user.name + ' (' + model.user.email + ')', { size: 11, bold: true });
  doc.text(t.generated + ' ' + fmtD(today), { size: 9, color: '0.4 0.4 0.4' });
  doc.line();
  if (!model.charts.length) doc.text(t.nothing, { size: 10 });
  for (const c of model.charts) {
    doc.h2(c.patient + (c.code ? ' (' + c.code + ')' : '') + (c.name ? ' - ' + c.name : ''));
    if (c.consigna) {
      doc.text(t.consigna + ': ' + c.consigna.title + (c.consigna.due ? '   ' + t.due + ': ' + fmtD(c.consigna.due) : ''), { size: 10, bold: true });
      if (c.consigna.body) doc.text(c.consigna.body, { size: 9, indent: 8 });
      const typed = c.consigna.tasks.filter((k) => k.done != null);
      if (c.consigna.tasks.length) doc.text(t.tasks + (typed.length ? ' (' + typed.filter((k) => k.done).length + '/' + typed.length + ' ' + t.progress + ')' : '') + ':', { size: 9, bold: true, indent: 8, gap: 1 });
      c.consigna.tasks.forEach((k) => doc.text((k.done == null ? '- ' : k.done ? '[x] ' : '[ ] ') + (k.day ? t.dayw + ' ' + k.day + ': ' : '') + k.text, { size: 9, indent: 16, gap: 1 }));
    }
    if (c.grade) {
      doc.text(t.grade + ': ' + (c.grade.total == null ? '-' : String(c.grade.total).replace('.', ',')) + ' / 10 (' + (c.grade.published ? t.published : t.unpublished) + ')' + (c.grade.comment ? ' - ' + c.grade.comment : ''), { size: 10, bold: true, gap: 4 });
    }
    doc.text(c.records.length + ' ' + t.records, { size: 9, color: '0.4 0.4 0.4', gap: 2 });
    for (const r of c.records) {
      doc.text((r.day ? t.dayw + ' ' + r.day + '  |  ' : '') + fmtDT(r.occurred) + '  |  ' + (t.types[r.type] || r.type) + (r.void_at ? '  |  ' + t.voided + (r.void_reason ? ' (' + t.reason + ': ' + r.void_reason + ')' : '') : ''), { size: 9, bold: true, gap: 0, color: r.void_at ? '0.6 0.2 0.2' : undefined });
      doc.text(recText(r, lang), { size: 9, indent: 10, gap: 1 });
      (r.comments || []).forEach((m) => doc.text(t.comment + ' (' + m.author + '): ' + m.text, { size: 8.5, indent: 20, gap: 1, color: '0.25 0.2 0.5' }));
      doc.y -= 3;
    }
    doc.line();
  }
  return doc.build();
}

const FL = {
  es: { nombre: 'Nombre', apellidos: 'Apellidos', sexo: 'Sexo', fecha_nacimiento: 'Fecha de nacimiento', nhc: 'NHC', unidad: 'Unidad', habitacion: 'Habitación', cama: 'Cama', fecha_ingreso: 'Fecha de ingreso', procedencia: 'Procedencia', motivo_ingreso: 'Motivo de ingreso', enfermedad_actual: 'Enfermedad actual', diagnostico_medico: 'Diagnóstico médico', antecedentes_personales: 'Antecedentes personales', antecedentes_familiares: 'Antecedentes familiares', intervenciones_previas: 'Intervenciones previas', medicacion_habitual: 'Medicación habitual', peso: 'Peso (kg)', talla: 'Talla (cm)', grupo_sanguineo: 'Grupo sanguíneo', autonomia: 'Autonomía / movilidad', habitos: 'Hábitos', situacion_social: 'Situación social', contacto_familiar: 'Contacto familiar (ficticio)', dieta: 'Dieta', aislamiento: 'Aislamiento', riesgos: 'Riesgos detectados', notas_docente: 'Notas para el profesorado', objetivos_aprendizaje: 'Objetivos de aprendizaje' },
  ca: { nombre: 'Nom', apellidos: 'Cognoms', sexo: 'Sexe', fecha_nacimiento: 'Data de naixement', nhc: 'NHC', unidad: 'Unitat', habitacion: 'Habitació', cama: 'Llit', fecha_ingreso: "Data d'ingrés", procedencia: 'Procedència', motivo_ingreso: "Motiu d'ingrés", enfermedad_actual: 'Malaltia actual', diagnostico_medico: 'Diagnòstic mèdic', antecedentes_personales: 'Antecedents personals', antecedentes_familiares: 'Antecedents familiars', intervenciones_previas: 'Intervencions prèvies', medicacion_habitual: 'Medicació habitual', peso: 'Pes (kg)', talla: 'Talla (cm)', grupo_sanguineo: 'Grup sanguini', autonomia: 'Autonomia / mobilitat', habitos: 'Hàbits', situacion_social: 'Situació social', contacto_familiar: 'Contacte familiar (fictici)', dieta: 'Dieta', aislamiento: 'Aïllament', riesgos: 'Riscos detectats', notas_docente: 'Notes per al professorat', objetivos_aprendizaje: "Objectius d'aprenentatge" },
};
const CT = {
  es: { title: 'Caso clínico', full: 'Versión completa (profesorado)', student: 'Versión para el alumnado', basic: 'Datos del paciente', allergies: 'Alergias', none: 'Sin alergias conocidas', unk: 'No registradas', sev: { leve: 'leve', moderada: 'moderada', grave: 'grave' }, orders: 'Prescripciones', ordersNone: 'Sin prescripciones.', days: 'días', prn: 'si precisa', events: 'Pruebas y eventos', eventsNone: 'Sin pruebas ni eventos.', day: 'Día', test: 'Prueba', event: 'Evento', consignas: 'Consignas', tasks: 'Tareas', due: 'Entrega', until: 'Se muestran los datos hasta el día', teacher: 'Solo profesorado', ais: { contacto: 'contacto', gotas: 'gotas', aereo: 'aéreo', protector: 'protector (inverso)' }, aisT: 'Tipo de aislamiento', sexv: { M: 'Hombre', F: 'Mujer', O: 'Otro' }, std: 'más precauciones estándar', pag: 'Pag.', gen: 'Generado el' },
  ca: { title: 'Cas clínic', full: 'Versió completa (professorat)', student: "Versió per a l'alumnat", basic: 'Dades del pacient', allergies: 'Al·lèrgies', none: 'Sense al·lèrgies conegudes', unk: 'No registrades', sev: { leve: 'lleu', moderada: 'moderada', grave: 'greu' }, orders: 'Prescripcions', ordersNone: 'Sense prescripcions.', days: 'dies', prn: 'si cal', events: 'Proves i esdeveniments', eventsNone: 'Sense proves ni esdeveniments.', day: 'Dia', test: 'Prova', event: 'Esdeveniment', consignas: 'Consignes', tasks: 'Tasques', due: 'Lliurament', until: 'Es mostren les dades fins al dia', teacher: 'Només professorat', ais: { contacto: 'contacte', gotas: 'gotes', aereo: 'aeri', protector: 'protector (invers)' }, aisT: "Tipus d'aïllament", sexv: { M: 'Home', F: 'Dona', O: 'Altre' }, std: 'més precaucions estàndard', pag: 'Pag.', gen: 'Generat el' },
};
const FIELD_ORDER = ['nhc', 'sexo', 'fecha_nacimiento', 'unidad', 'habitacion', 'cama', 'fecha_ingreso', 'procedencia', 'motivo_ingreso', 'enfermedad_actual', 'diagnostico_medico', 'antecedentes_personales', 'antecedentes_familiares', 'intervenciones_previas', 'medicacion_habitual', 'peso', 'talla', 'grupo_sanguineo', 'autonomia', 'habitos', 'situacion_social', 'contacto_familiar', 'dieta', 'riesgos'];

/* model = { code, data (ficha), orders, events, consignas, day (null = todos) } */
function casePdf(model, lang, full, today) {
  const t = CT[lang] || CT.es, fl = FL[lang] || FL.es, d = model.data || {};
  const name = ((d.apellidos || '') + (d.nombre ? ', ' + d.nombre : '')).trim() || model.code;
  const doc = new Doc(t.title + ' ' + model.code + ' - ' + name, { pageWord: t.pag });
  doc.h1(name);
  doc.text(model.code + (d.unidad ? ' - ' + d.unidad : '') + '   |   ' + (full ? t.full : t.student + (model.day ? ' (' + t.until + ' ' + model.day + ')' : '')), { size: 9, color: '0.4 0.4 0.4', gap: 1 });
  doc.text(t.gen + ' ' + fmtD(today), { size: 8.5, color: '0.4 0.4 0.4' });
  doc.line();
  doc.h2(t.basic);
  const field = (label, value) => { doc.text(label, { size: 8.5, bold: true, gap: 0, color: '0.36 0.23 0.60' }); doc.text(value, { size: 10, indent: 8, gap: 3 }); };
  FIELD_ORDER.forEach((k) => { if (d[k] == null || d[k] === '') return; field(fl[k] || k, k === 'sexo' ? (t.sexv[d[k]] || d[k]) : fmtD(String(d[k])) === String(d[k]) ? String(d[k]) : (/^\d{4}-\d{2}-\d{2}$/.test(String(d[k])) ? fmtD(String(d[k])) : String(d[k]))); });
  const ais = (d.aislamiento_tipos || []).map((x) => t.ais[x] || x);
  if (ais.length || d.aislamiento) field(fl.aislamiento, (ais.length ? t.aisT + ': ' + ais.join(' + ') + ' (' + t.std + ')' : '') + (ais.length && d.aislamiento ? '\n' : '') + (d.aislamiento || ''));
  doc.h2(t.allergies);
  if ((d.alergias || []).length) d.alergias.forEach((a) => doc.text('- ' + a.agente + (a.reaccion ? ': ' + a.reaccion : '') + (a.gravedad ? ' (' + (t.sev[a.gravedad] || a.gravedad) + ')' : ''), { size: 10, gap: 1 }));
  else doc.text(d.sin_alergias ? t.none : t.unk, { size: 10 });
  doc.h2(t.orders);
  if (model.orders.length) model.orders.forEach((o) => doc.text('- ' + o.drug + ' ' + (o.dose || '') + ' (' + ((ROUTE[lang] || ROUTE.es)[o.route] || o.route) + ')' + (o.freq ? ' - ' + o.freq : '') + (o.prn ? ' - ' + t.prn : o.times.length ? ' - ' + o.times.join(', ') : '') + ' - ' + t.days + ' ' + o.start_day + (o.end_day ? '-' + o.end_day : '+') + (o.notes ? ' - ' + o.notes : ''), { size: 10, gap: 2 }));
  else doc.text(t.ordersNone, { size: 10 });
  doc.h2(t.events);
  if (model.events.length) {
    let last = null;
    model.events.forEach((e) => { if (e.day !== last) { doc.text(t.day + ' ' + e.day, { size: 10, bold: true, gap: 1 }); last = e.day; } doc.text((e.kind === 'prueba' ? t.test : t.event) + ': ' + e.title + (e.body ? ' - ' + e.body : ''), { size: 10, indent: 10, gap: 2 }); });
  } else doc.text(t.eventsNone, { size: 10 });
  if (model.consignas.length) {
    doc.h2(t.consignas);
    model.consignas.forEach((k) => {
      doc.text(k.title + (k.due ? '   (' + t.due + ': ' + fmtD(k.due) + ')' : ''), { size: 11, bold: true, gap: 2 });
      if (k.body) doc.text(k.body, { size: 10, indent: 8, gap: 2 });
      if (k.tasks.length) { doc.text(t.tasks + ':', { size: 9.5, bold: true, indent: 8, gap: 1 }); k.tasks.forEach((x) => doc.text('- ' + x.text + (x.min > 1 ? ' (x' + x.min + ')' : ''), { size: 10, indent: 16, gap: 1 })); }
      doc.y -= 4;
    });
  }
  if (full && (d.notas_docente || d.objetivos_aprendizaje)) {
    doc.h2(t.teacher);
    if (d.objetivos_aprendizaje) field(fl.objetivos_aprendizaje, d.objetivos_aprendizaje);
    if (d.notas_docente) field(fl.notas_docente, d.notas_docente);
  }
  return doc.build();
}

/* ZIP sin compresión (método «stored»). */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function zipStore(files) {
  const parts = [], central = []; let off = 0; const d = new Date(), dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff, dd = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8'), data = f.data, crc = crc32(data);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(0, 8); lh.writeUInt16LE(dt, 10); lh.writeUInt16LE(dd, 12); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    parts.push(lh, name, data);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(0, 10); ch.writeUInt16LE(dt, 12); ch.writeUInt16LE(dd, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(off, 42);
    central.push(ch, name); off += 30 + name.length + data.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, end]);
}

module.exports = { recText, studentPdf, casePdf, zipStore, crc32 };
