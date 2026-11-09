'use strict';
/* Módulos clínicos ampliados: medicación (MAR), escalas, valoración por patrones, plan de cuidados,
   línea temporal, informe, gráficas, evaluación con rúbrica e impresión. Usa las utilidades de app.js (window.HC). */
(function () {
  const HC = window.HC, { h, add, clear, api, toast, fail, panel, empty, field, fmtD, fmtDT, fmtISO, nowInput } = HC;
  const t = HC.t, lang = () => HC.lang(), SCx = window.HC_SCALES, SCALES = SCx.SCALES, PATRONES = SCx.PATRONES;
  const pick = (o) => (lang() === 'ca' ? o.ca || o.es : o.es);
  const TCAE_ROUTES = ['oral', 'topica'], ROUTES = ['oral', 'topica', 'sc', 'im', 'iv', 'inhalatoria', 'rectal', 'oftalmica', 'otica', 'sng', 'otra'];

  Object.assign(window.I18N.es, {
    imp_title: 'Importar caso clínico', imp_btn: 'Importar caso', imp_intro: 'Genera el caso con tu IA y pégalo aquí: se crea el paciente con su ficha, alergias, prescripciones y pruebas o eventos por día.', imp_step1: '1. Copia la plantilla y pásasela a la IA', imp_step1_help: 'Antes de enviarla, rellena los cuatro datos de «Datos del caso que quiero» (tema, nivel, idioma y duración).', imp_copy: 'Copiar plantilla', imp_copied: 'Plantilla copiada', imp_step2: '2. Pega aquí lo que te devuelva la IA', imp_paste_ph: 'Pega aquí el texto del caso…', imp_review: 'Revisar', imp_create: 'Crear caso', imp_errors: 'Errores', imp_warnings: 'Avisos', imp_line: 'línea', imp_will: 'Se creará', imp_pat: 'Paciente', imp_fields: '{n} campos de la ficha', imp_allergies: '{n} alergias', imp_no_allergies: 'sin alergias conocidas', imp_orders: 'Prescripciones ({n})', imp_events: 'Pruebas y eventos ({n})', imp_day: 'día', imp_blocked: 'Corrige los errores marcados en la ficha y vuelve a pulsar «Revisar».', imp_skipped: 'Las líneas con error se omitirán; el resto se importa.', imp_done: 'Caso creado', nav_grades: 'Notas', tab_mar: 'Medicación', tab_escalas: 'Escalas', tab_valoracion: 'Valoración', tab_plan: 'Plan de cuidados', tab_pruebas: 'Pruebas y evolución', tab_informe: 'Informe', tab_eval: 'Evaluación', tab_presc: 'Prescripciones', tab_linea: 'Línea temporal',
    r_medicacion: 'Administración de medicación', r_escala: 'Escala de valoración', r_valoracion: 'Valoración por patrones', r_plan: 'Problema del plan de cuidados', r_plan_eval: 'Evaluación del plan', r_informe: 'Informe de enfermería',
    day_case: 'Día del caso', day_next: 'Avanzar día', day_prev: 'Retroceder día', print: 'Imprimir / guardar PDF', print_back: 'Volver a la historia',
    mar_date: 'Fecha', mar_drug: 'Medicamento', mar_sched: 'Pauta', mar_prn: 'Si precisa', mar_none: 'No hay prescripciones activas para este día del caso.', mar_nurse_only: 'Solo enfermería', mar_register: 'Registrar', mar_hist: 'Administraciones registradas',
    mar_five: 'He comprobado los cinco correctos: paciente, medicamento, dosis, vía y hora.', mar_order: 'Prescripción', mar_slot: 'Hora de la pauta', mar_state: 'Estado', mar_offslot: 'Fuera de pauta / si precisa', mar_supervised: 'Medicación oral o tópica: se registra bajo supervisión de enfermería.',
    st_administrada: 'Administrada', st_rechazada: 'Rechazada', st_omitida: 'Omitida', st_retrasada: 'Retrasada',
    rt_oral: 'Oral', rt_topica: 'Tópica', rt_sc: 'Subcutánea', rt_im: 'Intramuscular', rt_iv: 'Intravenosa', rt_inhalatoria: 'Inhalatoria', rt_rectal: 'Rectal', rt_oftalmica: 'Oftálmica', rt_otica: 'Ótica', rt_sng: 'Sonda nasogástrica', rt_otra: 'Otra',
    sc_new: 'Nueva escala', sc_pick: 'Escala', sc_total: 'Puntuación', sc_level: 'Resultado', sc_incomplete: 'Responde todos los apartados.', sc_last: 'Última valoración', sc_none: 'Sin valorar', sc_hist: 'Historial de escalas',
    pat_assess: 'Valorar', pat_altered: 'Patrón alterado', pat_ok: 'Sin alteración', pat_text: 'Hallazgos', pat_none: 'Sin valorar', pat_previous: 'valoraciones anteriores',
    pl_new: 'Nuevo problema', pl_problem: 'Problema / diagnóstico de enfermería', pl_cause: 'Relacionado con / causa', pl_goal: 'Objetivo (resultado esperado)', pl_interv: 'Intervenciones', pl_prio: 'Prioridad', pl_high: 'Alta', pl_mid: 'Media', pl_low: 'Baja', pl_eval: 'Evaluar', pl_result: 'Resultado', pl_ev_text: 'Valoración del resultado',
    pl_conseguido: 'Conseguido', pl_parcial: 'Parcialmente conseguido', pl_no_conseguido: 'No conseguido', pl_pending: 'Pendiente de evaluar', pl_empty: 'Todavía no hay problemas en el plan de cuidados.', pl_hint: 'Plan: problema → causa → objetivo → intervenciones → evaluación.',
    inf_new: 'Nuevo informe', inf_type: 'Tipo de informe', inf_alta: 'Informe de alta', inf_traspaso: 'Informe de traspaso', inf_summary: 'Resumen del proceso', inf_state: 'Estado al alta / traspaso', inf_reco: 'Recomendaciones y continuidad de cuidados',
    ev_title: 'Pruebas complementarias y eventos', ev_prueba: 'Prueba', ev_evento: 'Evento', ev_day: 'Día', ev_none: 'Todavía no hay pruebas ni eventos disponibles.', ev_future: 'Se libera el día', ev_title_f: 'Título', ev_body: 'Resultado / descripción',
    ev_add: 'Añadir', ev_hint: 'El alumnado solo ve lo que ya toca según el día del caso de cada historia.',
    pr_title: 'Prescripciones médicas', pr_add: 'Nueva prescripción', pr_drug: 'Medicamento', pr_dose: 'Dosis', pr_route: 'Vía', pr_freq: 'Frecuencia (texto)', pr_times: 'Horas (HH:MM separadas por comas)', pr_prn: 'Si precisa (sin horas fijas)', pr_start: 'Desde el día', pr_end: 'Hasta el día', pr_notes: 'Notas',
    pr_off: 'Suspender', pr_on: 'Reactivar', pr_suspended: 'Suspendida', pr_help: 'Las prescripciones las define el profesorado. El alumnado ve las que ya toca según el día del caso y registra las administraciones. El perfil TCAE solo puede registrar vía oral y tópica.', pr_has: 'Tiene administraciones registradas: suspéndela en lugar de borrarla.',
    ch_vitals: 'Gráficas de constantes', ch_none: 'Hacen falta al menos dos registros para dibujar la gráfica.', ch_band: 'Franja gris: rango orientativo de adulto.', ba_shifts: 'Balance por turnos', ba_M: 'Mañana (7–15 h)', ba_T: 'Tarde (15–23 h)', ba_N: 'Noche (23–7 h)', ba_24: '24 h', ba_in: 'E', ba_out: 'S',
    gr_title: 'Notas del alumnado', gr_rubric: 'Rúbrica de evaluación', gr_rubric_help: 'Cada criterio se puntúa de 0 a 4. La nota (0–10) es la media ponderada por el peso de cada criterio.', gr_crit_es: 'Criterio (castellano)', gr_crit_ca: 'Criterio (catalán)', gr_w: 'Peso', gr_add: 'Añadir criterio', gr_csv: 'Exportar notas (CSV)', gr_send: 'Enviar al Campus', gr_send_h: 'Enviar notas publicadas al Campus', gr_send_help: 'Crea (o actualiza) una prueba por actividad en la asignatura elegida: todas las historias con la misma consigna forman una sola prueba, con la nota de cada alumno que la tenga publicada. En el Campus la prueba queda oculta hasta que la publiques. Si ya has editado una nota a mano en el Campus, no se sobrescribe.', gr_subject: 'Asignatura', gr_cat: 'Categoría', gr_teoria: 'Teoría', gr_practica: 'Prácticas', gr_seguimiento: 'Seguimiento', gr_ra: 'Unidad (UD/RA)', gr_nora: 'Sin unidad', gr_weight: 'Peso', gr_ptitle: 'Título de la prueba', gr_sent: 'Enviado: {n} notas', gr_kept: '{n} conservadas porque se editaron a mano en el Campus', gr_miss: 'No encontrados o sin matrícula en esa asignatura: {n}', gr_nosync: 'Sincroniza el alumnado desde Usuarios para cargar las asignaturas del Campus.', gr_pubn: '{n} publicadas', gr_pub1: '1 publicada', gr_empty: 'Todavía no hay notas. Se ponen en la pestaña «Evaluación» de cada historia.',
    gr_student: 'Alumno/a', gr_case: 'Caso', gr_mark: 'Nota', gr_pub: 'Publicada', gr_publish: 'Publicar la nota al alumno', gr_comment: 'Comentario de evaluación', gr_saved: 'Nota guardada', gr_none: 'Todavía no hay nota publicada.', gr_open: 'Abrir',
    lv0: '0 · No evidenciado', lv1: '1 · Insuficiente', lv2: '2 · Suficiente', lv3: '3 · Notable', lv4: '4 · Excelente', yes: 'Sí', no: 'No',
    prev_btn: 'Ver como alumno', prev_exit: 'Salir de la vista de alumno', prev_ro: 'Vista de alumno: solo lectura, no se guarda nada', prev_on: 'Vista de alumno', login_email: 'Correo (solo profesorado; vacío para administración)', login_email_ph: 'correo@centro.es', teachers_h: 'Profesorado', teachers_help: 'Cuentas de profesorado con correo y contraseña propios. Entran desde la pantalla de inicio de sesión, sin pasar por el Campus.', t_name: 'Nombre', t_email: 'Correo', t_pw: 'Contraseña (mínimo 10 caracteres)', t_add: 'Añadir profesorado', t_remove: 'Quitar acceso', t_none: 'Todavía no hay profesorado adicional.', t_added: 'Profesorado añadido', unpublished: 'nota sin publicar', cl_title: 'Clasificación', cl_subjects: 'Asignaturas', cl_topics: 'Temas', cl_topics_ph: 'Añadir tema…', cl_add: 'Añadir', cl_remove: 'Quitar', cl_selected: 'Seleccionados: {n}', cl_clear: 'Deseleccionar', cl_saved: 'Clasificación guardada', cl_none_sync: 'No hay asignaturas cargadas: sincroniza el alumnado del Campus (Alumnado → Sincronizar).', cl_all_subj: 'Todas las asignaturas', cl_unclassified: 'Sin clasificar', cl_all_topics: 'Todos los temas', cl_search: 'Buscar paciente, diagnóstico o tema…', col_class: 'Asignaturas y temas', cl_pick_subj: 'Asignatura…', cl_no_match: 'Ningún paciente coincide con el filtro.', cl_help: 'Sirve para ordenar tus pacientes y filtrarlos en la lista. Los temas son etiquetas libres: crea las que quieras.', cl_showing: '{a} de {b} pacientes', pdf_case: 'Descargar el caso en PDF', pdf_students: 'Versión para el alumnado', pdf_full: 'Versión completa (con notas del docente)', pdf_day: 'Hasta el día', pdf_help: 'La versión para el alumnado no incluye las notas del docente y solo muestra pruebas, eventos y prescripciones hasta el día indicado.', bc_title: 'Entradas y salidas por día', bc_in: 'Entradas', bc_diu: 'Diuresis', bc_other: 'Otras salidas', bc_net: 'Balance', bc_help: 'Cada día va de las 07:00 a las 07:00. Pasa el ratón (o toca) sobre una barra para ver los ml.', dy_title: 'Día {n} de {m}', dy_finish: 'Terminar el día {n}', dy_confirm: 'Vas a terminar el día {n} y pasar al día {m}. Verás las pruebas, los eventos y las prescripciones nuevos. Lo del día {n} seguirá visible, pero ya no podrás añadirle ni corregir registros: solo tu profesor puede reabrirlo.', dy_pending: 'Te quedan tareas de este día sin hacer:', dy_now: 'Ahora estás en el día {n}', dy_last: 'Último día', dy_closed: 'Ese día ya está cerrado: solo tu profesor puede reabrirlo.', dy_help: 'Cuando termines el día, pulsa el botón para pasar al siguiente. Los días terminados quedan cerrados.', dy_d: 'Día ', day_short: 'D', cs_day: 'Día', pace_title: 'Ritmo', pace_teacher: 'Lo marca el profesor', pace_student: 'Por días: lo marca el alumno', pace_teacher_short: 'lo marca el profesor', pace_student_short: 'por días (el alumno)', pace_cap: 'Último día', pace_auto: 'Automático', pace_save: 'Guardar ritmo', pace_saved: 'Ritmo guardado', pace_help: 'Con «por días», el alumno (o el equipo) termina cada día y pasa al siguiente; los días terminados quedan cerrados. Para reabrir un día, retrocede el «Día del caso» con − y el alumno vuelve a ese día. El último día es el de la última prueba o prescripción, o el que pongas aquí.', tab_seg: 'Seguimiento', seg_empty: 'Todavía no hay historias asignadas de este paciente.', seg_none: 'Sin consigna', seg_students: 'Alumnado', seg_tasks: 'Tareas', seg_records: 'Registros', seg_last: 'Última actividad', seg_grade: 'Nota', seg_open: 'Abrir', seg_eval: 'Evaluar', seg_help: 'Qué ha hecho cada alumno o grupo en cada actividad. Abre una historia para leer sus registros y evaluarla.',
    win_from: 'Disponible desde', win_to: 'Hasta', win_save: 'Guardar fechas', win_help: 'Vacío = sin límite. Antes de la fecha el alumnado ve la historia bloqueada; después de la fecha de fin puede consultarla pero ya no registrar.', win_from_on: 'Disponible desde {d}', win_ended_on: 'Finalizada el {d}', win_until: 'Hasta el {d}', win_saved: 'Fechas guardadas', go_none: 'No tienes asignada esta actividad todavía.',
    stu_work: 'Ver trabajo', stu_title: 'Trabajo de', stu_pdf: 'Descargar PDF', stu_none: 'Este alumno no tiene historias asignadas.', stu_patient: 'Paciente', stu_activity: 'Actividad', stu_state: 'Estado', stu_zip: 'Descargar todos (ZIP de PDF)', stu_zip_help: 'Un PDF por alumno con todo lo que ha introducido, comentarios y notas incluidos.',
    cu_title: 'Borrar datos del alumnado', cu_help: 'Elimina lo que ha introducido el alumnado (registros y comentarios). Los pacientes, las consignas y las prescripciones no se tocan. No se puede deshacer: descarga antes los informes si los necesitas.', cu_all: 'Todo el alumnado (todas las historias)', cu_patient: 'Un paciente (todas sus historias)', cu_student: 'Solo este alumno', cu_grades: 'Borrar también las notas', cu_charts: 'Borrar también las asignaciones (las historias)', cu_counts: 'Se borrarán — registros: {r} · comentarios: {c} · notas: {g}. Historias asignadas: {h} (solo se quitan si marcas la opción).', cu_type: 'Escribe BORRAR para confirmar', cu_btn: 'Borrar datos', cu_done: 'Datos borrados', cu_pick: 'Elige un paciente', cs_link: 'Enlace para el Campus (lleva al alumno a su historia de esta actividad)', cs_copy: 'Copiar enlace', cs_copied: 'Enlace copiado',
    tab_consignas: 'Consignas', cs_title: 'Consigna', cs_assign: 'Consigna', cs_pick: 'Sin consigna', cs_new: 'Nueva consigna', cs_title_f: 'Título', cs_body: 'Enunciado (lo que debe hacer el alumnado)', cs_due: 'Entrega (opcional)', cs_tasks: 'Tareas', cs_add_task: 'Añadir tarea', cs_task_text: 'Texto de la tarea', cs_min: 'Registros mínimos', cs_saved: 'Consigna guardada', cs_confirm_del: '¿Borrar esta consigna? Las historias que la usan se quedan sin consigna.', cs_empty: 'Este paciente aún no tiene consignas. Crea una para decir al alumnado qué debe hacer; puedes crear varias y usar el mismo paciente en actividades distintas.', cs_help: 'La consigna se asigna al repartir el caso (pestaña Asignación) o desde la propia historia. Las tareas se marcan solas cuando el alumno hace el registro correspondiente.', cs_progress: '{a} de {b} hechas', cs_due_on: 'Entrega', cs_edit: 'Editar', cs_cancel: 'Cancelar', imp_consignas: 'Consignas ({n})',
    ck_nota: 'Nota de evolución', ck_constantes: 'Constantes', ck_balance: 'Balance hídrico', ck_cuidado: 'Cuidado realizado', ck_medicacion: 'Medicación', ck_escala: 'Escala', ck_valoracion: 'Valoración', ck_plan: 'Plan de cuidados', ck_plan_eval: 'Evaluación del plan', ck_informe: 'Informe', ck_libre: 'Libre (sin comprobación)',
    imp_show_tpl: 'Ver la plantilla', imp_lang: 'Idioma de la plantilla', imp_lang_ca: 'Català', imp_lang_es: 'Castellano', imp_lang_help: 'El texto que pegues puede estar en catalán o en castellano: se reconoce solo.', example_btn: 'Crear caso de ejemplo', ex_ca: 'Ejemplo en catalán', ex_es: 'Ejemplo en castellano', example_help: 'Crea una paciente simulada (EPOC con neumonía) con prescripciones, pruebas por días y registros de muestra, para ver cómo queda.', example_done: 'Caso de ejemplo creado', role_teacher: 'Profesorado', make_teacher: 'Dar acceso de profesorado', remove_teacher: 'Quitar acceso de profesorado', patient_summary: 'Datos del paciente',
  });
  Object.assign(window.I18N.ca, {
    imp_title: 'Importar cas clínic', imp_btn: 'Importar cas', imp_intro: "Genera el cas amb la teva IA i enganxa'l aquí: es crea el pacient amb la fitxa, al·lèrgies, prescripcions i proves o esdeveniments per dia.", imp_step1: '1. Copia la plantilla i passa-la a la IA', imp_step1_help: "Abans d'enviar-la, omple les quatre dades de «Datos del caso que quiero» (tema, nivell, idioma i durada).", imp_copy: 'Copiar plantilla', imp_copied: 'Plantilla copiada', imp_step2: "2. Enganxa aquí el que et torni la IA", imp_paste_ph: 'Enganxa aquí el text del cas…', imp_review: 'Revisar', imp_create: 'Crear cas', imp_errors: 'Errors', imp_warnings: 'Avisos', imp_line: 'línia', imp_will: 'Es crearà', imp_pat: 'Pacient', imp_fields: '{n} camps de la fitxa', imp_allergies: '{n} al·lèrgies', imp_no_allergies: 'sense al·lèrgies conegudes', imp_orders: 'Prescripcions ({n})', imp_events: 'Proves i esdeveniments ({n})', imp_day: 'dia', imp_blocked: 'Corregeix els errors marcats a la fitxa i torna a prémer «Revisar».', imp_skipped: "Les línies amb error s'ometran; la resta s'importa.", imp_done: 'Cas creat', nav_grades: 'Notes', tab_mar: 'Medicació', tab_escalas: 'Escales', tab_valoracion: 'Valoració', tab_plan: 'Pla de cures', tab_pruebas: 'Proves i evolució', tab_informe: 'Informe', tab_eval: 'Avaluació', tab_presc: 'Prescripcions', tab_linea: 'Línia temporal',
    r_medicacion: 'Administració de medicació', r_escala: 'Escala de valoració', r_valoracion: 'Valoració per patrons', r_plan: 'Problema del pla de cures', r_plan_eval: 'Avaluació del pla', r_informe: "Informe d'infermeria",
    day_case: 'Dia del cas', day_next: 'Avançar dia', day_prev: 'Retrocedir dia', print: 'Imprimir / desar PDF', print_back: "Tornar a la història",
    mar_date: 'Data', mar_drug: 'Medicament', mar_sched: 'Pauta', mar_prn: 'Si cal', mar_none: 'No hi ha prescripcions actives per a aquest dia del cas.', mar_nurse_only: 'Només infermeria', mar_register: 'Registrar', mar_hist: 'Administracions registrades',
    mar_five: "He comprovat els cinc correctes: pacient, medicament, dosi, via i hora.", mar_order: 'Prescripció', mar_slot: 'Hora de la pauta', mar_state: 'Estat', mar_offslot: 'Fora de pauta / si cal', mar_supervised: "Medicació oral o tòpica: es registra sota supervisió d'infermeria.",
    st_administrada: 'Administrada', st_rechazada: 'Rebutjada', st_omitida: 'Omesa', st_retrasada: 'Endarrerida',
    rt_oral: 'Oral', rt_topica: 'Tòpica', rt_sc: 'Subcutània', rt_im: 'Intramuscular', rt_iv: 'Intravenosa', rt_inhalatoria: 'Inhalatòria', rt_rectal: 'Rectal', rt_oftalmica: 'Oftàlmica', rt_otica: 'Òtica', rt_sng: 'Sonda nasogàstrica', rt_otra: 'Altra',
    sc_new: 'Nova escala', sc_pick: 'Escala', sc_total: 'Puntuació', sc_level: 'Resultat', sc_incomplete: 'Respon tots els apartats.', sc_last: 'Última valoració', sc_none: 'Sense valorar', sc_hist: "Historial d'escales",
    pat_assess: 'Valorar', pat_altered: 'Patró alterat', pat_ok: 'Sense alteració', pat_text: 'Troballes', pat_none: 'Sense valorar', pat_previous: 'valoracions anteriors',
    pl_new: 'Nou problema', pl_problem: "Problema / diagnòstic d'infermeria", pl_cause: 'Relacionat amb / causa', pl_goal: 'Objectiu (resultat esperat)', pl_interv: 'Intervencions', pl_prio: 'Prioritat', pl_high: 'Alta', pl_mid: 'Mitjana', pl_low: 'Baixa', pl_eval: 'Avaluar', pl_result: 'Resultat', pl_ev_text: 'Valoració del resultat',
    pl_conseguido: 'Aconseguit', pl_parcial: 'Parcialment aconseguit', pl_no_conseguido: 'No aconseguit', pl_pending: "Pendent d'avaluar", pl_empty: 'Encara no hi ha problemes al pla de cures.', pl_hint: 'Pla: problema → causa → objectiu → intervencions → avaluació.',
    inf_new: 'Nou informe', inf_type: "Tipus d'informe", inf_alta: "Informe d'alta", inf_traspaso: 'Informe de trasllat', inf_summary: 'Resum del procés', inf_state: "Estat a l'alta / trasllat", inf_reco: 'Recomanacions i continuïtat de cures',
    ev_title: 'Proves complementàries i esdeveniments', ev_prueba: 'Prova', ev_evento: 'Esdeveniment', ev_day: 'Dia', ev_none: 'Encara no hi ha proves ni esdeveniments disponibles.', ev_future: "S'allibera el dia", ev_title_f: 'Títol', ev_body: 'Resultat / descripció',
    ev_add: 'Afegir', ev_hint: "L'alumnat només veu el que ja toca segons el dia del cas de cada història.",
    pr_title: 'Prescripcions mèdiques', pr_add: 'Nova prescripció', pr_drug: 'Medicament', pr_dose: 'Dosi', pr_route: 'Via', pr_freq: 'Freqüència (text)', pr_times: 'Hores (HH:MM separades per comes)', pr_prn: 'Si cal (sense hores fixes)', pr_start: 'Des del dia', pr_end: 'Fins al dia', pr_notes: 'Notes',
    pr_off: 'Suspendre', pr_on: 'Reactivar', pr_suspended: 'Suspesa', pr_help: "Les prescripcions les defineix el professorat. L'alumnat veu les que ja toca segons el dia del cas i registra les administracions. El perfil TCAE només pot registrar via oral i tòpica.", pr_has: 'Té administracions registrades: suspèn-la en lloc d\'esborrar-la.',
    ch_vitals: 'Gràfiques de constants', ch_none: 'Calen almenys dos registres per dibuixar la gràfica.', ch_band: "Franja grisa: rang orientatiu d'adult.", ba_shifts: 'Balanç per torns', ba_M: 'Matí (7–15 h)', ba_T: 'Tarda (15–23 h)', ba_N: 'Nit (23–7 h)', ba_24: '24 h', ba_in: 'E', ba_out: 'S',
    gr_title: "Notes de l'alumnat", gr_rubric: "Rúbrica d'avaluació", gr_rubric_help: "Cada criteri es puntua de 0 a 4. La nota (0–10) és la mitjana ponderada pel pes de cada criteri.", gr_crit_es: 'Criteri (castellà)', gr_crit_ca: 'Criteri (català)', gr_w: 'Pes', gr_add: 'Afegir criteri', gr_csv: 'Exportar notes (CSV)', gr_send: 'Enviar al Campus', gr_send_h: 'Enviar notes publicades al Campus', gr_send_help: "Crea (o actualitza) una prova per activitat a l'assignatura triada: totes les històries amb la mateixa consigna formen una sola prova, amb la nota de cada alumne que la tingui publicada. Al Campus la prova queda oculta fins que la publiquis. Si ja has editat una nota a mà al Campus, no se sobreescriu.", gr_subject: 'Assignatura', gr_cat: 'Categoria', gr_teoria: 'Teoria', gr_practica: 'Pràctiques', gr_seguimiento: 'Seguiment', gr_ra: 'Unitat (UD/RA)', gr_nora: 'Sense unitat', gr_weight: 'Pes', gr_ptitle: 'Títol de la prova', gr_sent: 'Enviat: {n} notes', gr_kept: "{n} conservades perquè es van editar a mà al Campus", gr_miss: 'No trobats o sense matrícula en aquesta assignatura: {n}', gr_nosync: "Sincronitza l'alumnat des d'Usuaris per carregar les assignatures del Campus.", gr_pubn: '{n} publicades', gr_pub1: '1 publicada', gr_empty: "Encara no hi ha notes. Es posen a la pestanya «Avaluació» de cada història.",
    gr_student: 'Alumne/a', gr_case: 'Cas', gr_mark: 'Nota', gr_pub: 'Publicada', gr_publish: "Publicar la nota a l'alumne", gr_comment: "Comentari d'avaluació", gr_saved: 'Nota desada', gr_none: 'Encara no hi ha nota publicada.', gr_open: 'Obrir',
    lv0: '0 · No evidenciat', lv1: '1 · Insuficient', lv2: '2 · Suficient', lv3: '3 · Notable', lv4: '4 · Excel·lent', yes: 'Sí', no: 'No',
    prev_btn: 'Veure com a alumne', prev_exit: "Sortir de la vista d'alumne", prev_ro: "Vista d'alumne: només lectura, no es desa res", prev_on: "Vista d'alumne", login_email: 'Correu (només professorat; buit per a administració)', login_email_ph: 'correu@centre.cat', teachers_h: 'Professorat', teachers_help: 'Comptes de professorat amb correu i contrasenya propis. Entren des de la pantalla d\'inici de sessió, sense passar pel Campus.', t_name: 'Nom', t_email: 'Correu', t_pw: 'Contrasenya (mínim 10 caràcters)', t_add: 'Afegir professorat', t_remove: 'Treure accés', t_none: 'Encara no hi ha professorat addicional.', t_added: 'Professorat afegit', unpublished: 'nota sense publicar', cl_title: 'Classificació', cl_subjects: 'Assignatures', cl_topics: 'Temes', cl_topics_ph: 'Afegir tema…', cl_add: 'Afegir', cl_remove: 'Treure', cl_selected: 'Seleccionats: {n}', cl_clear: 'Desseleccionar', cl_saved: 'Classificació desada', cl_none_sync: "No hi ha assignatures carregades: sincronitza l'alumnat del Campus (Alumnat → Sincronitzar).", cl_all_subj: 'Totes les assignatures', cl_unclassified: 'Sense classificar', cl_all_topics: 'Tots els temes', cl_search: 'Cercar pacient, diagnòstic o tema…', col_class: 'Assignatures i temes', cl_pick_subj: 'Assignatura…', cl_no_match: 'Cap pacient coincideix amb el filtre.', cl_help: "Serveix per ordenar els teus pacients i filtrar-los a la llista. Els temes són etiquetes lliures: crea'n les que vulguis.", cl_showing: '{a} de {b} pacients', pdf_case: 'Descarregar el cas en PDF', pdf_students: "Versió per a l'alumnat", pdf_full: 'Versió completa (amb notes del docent)', pdf_day: 'Fins al dia', pdf_help: "La versió per a l'alumnat no inclou les notes del docent i només mostra proves, esdeveniments i prescripcions fins al dia indicat.", bc_title: 'Entrades i sortides per dia', bc_in: 'Entrades', bc_diu: 'Diüresi', bc_other: 'Altres sortides', bc_net: 'Balanç', bc_help: 'Cada dia va de les 07:00 a les 07:00. Passa el ratolí (o toca) sobre una barra per veure els ml.', dy_title: 'Dia {n} de {m}', dy_finish: 'Acabar el dia {n}', dy_confirm: "Estàs a punt d'acabar el dia {n} i passar al dia {m}. Veuràs les proves, els esdeveniments i les prescripcions nous. El del dia {n} seguirà visible, però ja no hi podràs afegir ni corregir registres: només el teu professor el pot reobrir.", dy_pending: 'Et queden tasques d\'aquest dia per fer:', dy_now: 'Ara ets al dia {n}', dy_last: 'Darrer dia', dy_closed: "Aquest dia ja està tancat: només el teu professor el pot reobrir.", dy_help: "Quan acabis el dia, prem el botó per passar al següent. Els dies acabats queden tancats.", dy_d: 'Dia ', day_short: 'D', cs_day: 'Dia', pace_title: 'Ritme', pace_teacher: 'El marca el professor', pace_student: "Per dies: el marca l'alumne", pace_teacher_short: 'el marca el professor', pace_student_short: "per dies (l'alumne)", pace_cap: 'Darrer dia', pace_auto: 'Automàtic', pace_save: 'Desar ritme', pace_saved: 'Ritme desat', pace_help: "Amb «per dies», l'alumne (o l'equip) acaba cada dia i passa al següent; els dies acabats queden tancats. Per reobrir un dia, retrocedeix el «Dia del cas» amb − i l'alumne torna a aquell dia. El darrer dia és el de la darrera prova o prescripció, o el que posis aquí.", tab_seg: 'Seguiment', seg_empty: "Encara no hi ha històries assignades d'aquest pacient.", seg_none: 'Sense consigna', seg_students: 'Alumnat', seg_tasks: 'Tasques', seg_records: 'Registres', seg_last: 'Última activitat', seg_grade: 'Nota', seg_open: 'Obrir', seg_eval: 'Avaluar', seg_help: "Què ha fet cada alumne o grup en cada activitat. Obre una història per llegir els seus registres i avaluar-la.",
    win_from: 'Disponible des de', win_to: 'Fins a', win_save: 'Desar dates', win_help: "Buit = sense límit. Abans de la data l'alumnat veu la història bloquejada; després de la data de fi pot consultar-la però ja no registrar.", win_from_on: 'Disponible des del {d}', win_ended_on: 'Finalitzada el {d}', win_until: 'Fins al {d}', win_saved: 'Dates desades', go_none: "Encara no tens assignada aquesta activitat.",
    stu_work: 'Veure treball', stu_title: 'Treball de', stu_pdf: 'Descarregar PDF', stu_none: "Aquest alumne no té històries assignades.", stu_patient: 'Pacient', stu_activity: 'Activitat', stu_state: 'Estat', stu_zip: 'Descarregar tots (ZIP de PDF)', stu_zip_help: "Un PDF per alumne amb tot el que ha introduït, comentaris i notes inclosos.",
    cu_title: "Esborrar dades de l'alumnat", cu_help: "Elimina el que ha introduït l'alumnat (registres i comentaris). Els pacients, les consignes i les prescripcions no es toquen. No es pot desfer: descarrega abans els informes si els necessites.", cu_all: "Tot l'alumnat (totes les històries)", cu_patient: 'Un pacient (totes les seves històries)', cu_student: 'Només aquest alumne', cu_grades: 'Esborrar també les notes', cu_charts: 'Esborrar també les assignacions (les històries)', cu_counts: "S'esborraran — registres: {r} · comentaris: {c} · notes: {g}. Històries assignades: {h} (només es treuen si marques l'opció).", cu_type: 'Escriu ESBORRAR per confirmar', cu_btn: 'Esborrar dades', cu_done: 'Dades esborrades', cu_pick: 'Tria un pacient', cs_link: "Enllaç per al Campus (porta l'alumne a la seva història d'aquesta activitat)", cs_copy: 'Copiar enllaç', cs_copied: 'Enllaç copiat',
    tab_consignes: 'Consignes', tab_consignas: 'Consignes', cs_title: 'Consigna', cs_assign: 'Consigna', cs_pick: 'Sense consigna', cs_new: 'Nova consigna', cs_title_f: 'Títol', cs_body: "Enunciat (el que ha de fer l'alumnat)", cs_due: 'Lliurament (opcional)', cs_tasks: 'Tasques', cs_add_task: 'Afegir tasca', cs_task_text: 'Text de la tasca', cs_min: 'Registres mínims', cs_saved: 'Consigna desada', cs_confirm_del: "Esborrar aquesta consigna? Les històries que la fan servir es queden sense consigna.", cs_empty: "Aquest pacient encara no té consignes. Crea'n una per dir a l'alumnat què ha de fer; en pots crear diverses i fer servir el mateix pacient en activitats diferents.", cs_help: "La consigna s'assigna en repartir el cas (pestanya Assignació) o des de la mateixa història. Les tasques es marquen soles quan l'alumne fa el registre corresponent.", cs_progress: '{a} de {b} fetes', cs_due_on: 'Lliurament', cs_edit: 'Editar', cs_cancel: 'Cancel·lar', imp_consignas: 'Consignes ({n})',
    ck_nota: "Nota d'evolució", ck_constantes: 'Constants', ck_balance: 'Balanç hídric', ck_cuidado: 'Cura realitzada', ck_medicacion: 'Medicació', ck_escala: 'Escala', ck_valoracion: 'Valoració', ck_plan: 'Pla de cures', ck_plan_eval: "Avaluació del pla", ck_informe: 'Informe', ck_libre: 'Lliure (sense comprovació)',
    imp_show_tpl: 'Veure la plantilla', imp_lang: 'Idioma de la plantilla', imp_lang_ca: 'Català', imp_lang_es: 'Castellano', imp_lang_help: 'El text que enganxis pot estar en català o en castellà: es reconeix sol.', example_btn: 'Crear cas d\'exemple', ex_ca: 'Exemple en català', ex_es: 'Exemple en castellà', example_help: "Crea una pacient simulada (MPOC amb pneumònia) amb prescripcions, proves per dies i registres de mostra, per veure com queda.", example_done: "Cas d'exemple creat", role_teacher: 'Professorat', make_teacher: "Donar accés de professorat", remove_teacher: "Treure l'accés de professorat", patient_summary: 'Dades del pacient',
  });

  /* ---------- utilidades ---------- */
  const NS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, v);
    for (let i = 2; i < arguments.length; i++) { const c = arguments[i]; if (c != null) el.appendChild(c.nodeType ? c : document.createTextNode(String(c))); }
    return el;
  }
  const today = () => nowInput().slice(0, 10);
  const lvName = (key, lv) => { const s = SCALES[key]; const l = s.levels[lv]; return l ? (lang() === 'ca' ? l[1] : l[0]) : lv; };
  const lvChip = (key, r) => h('span', { class: 'chip ' + (SCALES[key].bad(r.nivel) ? 'red' : 'grn') }, lvName(key, r.nivel));
  const canNurse = (X) => !X.staff && X.open && X.role === 'enfermeria';
  const canWrite = (X) => !X.staff && X.open;
  const canWriteOn = (X, date) => canWrite(X) && (X.c.chart.pace !== 'student' || date === X.c.chart.case_date);
  const dayControl = (chartId, day, refresh) => h('span', { class: 'row daybox' }, h('span', { class: 'mut' }, t('day_case') + ':'),
    h('button', { class: 'sm', 'aria-label': t('day_prev'), disabled: day <= 1, onclick: async () => { try { await api('PUT', '/api/charts/' + chartId, { day: day - 1 }); refresh(); } catch (e) { fail(e); } } }, '−'),
    h('b', null, day), h('button', { class: 'sm', 'aria-label': t('day_next'), onclick: async () => { try { await api('PUT', '/api/charts/' + chartId, { day: day + 1 }); refresh(); } catch (e) { fail(e); } } }, '+'));

  /* ---------- formularios de registro ---------- */
  function shell(type, X, bodyNodes, getData, done, when) {
    const w = h('input', { type: 'datetime-local', value: when || (X.caseDate ? X.caseDate + 'T' + nowInput().slice(11) : nowInput()), min: X.caseDate ? X.caseDate + 'T00:00' : null, max: X.caseDate ? X.caseDate + 'T23:59' : null });
    return h('form', {
      class: 'panel formp', onsubmit: async (e) => {
        e.preventDefault(); let data; try { data = getData(); } catch (er) { toast(er.message, true); return; }
        try { await api('POST', '/api/charts/' + X.chartId + '/records', { type, data, occurred: w.value, replaces_id: X.replaces || undefined }); toast(t('saved')); done(true); } catch (er) { fail(er); }
      },
    }, h('div', { class: 'ph' }, t('r_' + type) + (X.replaces ? ' — ' + t('replaces') + ' #' + X.replaces : '')),
      h('div', { class: 'pb' }, field(t('when'), w), bodyNodes, h('p', { class: 'row' }, h('button', { class: 'pri', type: 'submit' }, t('register')), h('button', { type: 'button', onclick: () => done(false) }, t('cancel')))));
  }
  const sel = (opts, val) => h('select', null, opts.map(([v, l]) => h('option', { value: v, selected: String(v) === String(val) }, l)));

  const forms = {
    medicacion(X, done) {
      const pf = X.prefill || {}, list = (X.orders || []).filter((o) => o.active && (X.role !== 'tcae' || TCAE_ROUTES.includes(o.route)));
      if (!list.length) return h('div', { class: 'panel' }, h('div', { class: 'pb' }, t('mar_none'), h('p', null, h('button', { onclick: () => done(false) }, t('cancel')))));
      const ordSel = sel(list.map((o) => [o.id, o.drug + ' ' + o.dose + ' · ' + t('rt_' + o.route)]), pf.order_id);
      const slotSel = h('select'); const fill = () => { const o = list.find((x) => String(x.id) === ordSel.value); clear(slotSel); slotSel.appendChild(h('option', { value: '' }, t('mar_offslot'))); (o ? o.times : []).forEach((s) => slotSel.appendChild(h('option', { value: s, selected: s === pf.slot }, s))); };
      ordSel.addEventListener('change', fill); fill();
      const st = sel(['administrada', 'rechazada', 'omitida', 'retrasada'].map((v) => [v, t('st_' + v)]), 'administrada'), obs = h('input', { type: 'text' }), five = h('input', { type: 'checkbox' });
      return shell('medicacion', X, [h('div', { class: 'cols' }, field(t('mar_order'), ordSel), field(t('mar_slot'), slotSel), field(t('mar_state'), st)), field(t('obs'), obs),
        h('label', { class: 'row' }, five, t('mar_five')), X.role === 'tcae' ? h('p', { class: 'mut' }, t('mar_supervised')) : null],
      () => { if (st.value === 'administrada' && !five.checked) throw new Error(t('mar_five')); return { order_id: ordSel.value, slot: slotSel.value, estado: st.value, obs: obs.value }; }, done,
      pf.date && pf.slot ? pf.date + 'T' + pf.slot : null);
    },
    escala(X, done) {
      const pf = X.prefill || {}; let key = pf.scale || 'barthel'; const sc0 = sel(Object.keys(SCALES).map((k) => [k, pick(SCALES[k])]), key);
      const box = h('div'), res = h('div', { class: 'sc-res' }), obs = h('input', { type: 'text' }); let inputs = {};
      const calc = () => {
        const s = SCALES[key]; let tot = 0, all = true; Object.keys(s.items).forEach((k) => { const v = inputs[k].value; if (v === '') all = false; else tot += Number(v); });
        clear(res); add(res, all ? [h('b', null, t('sc_total') + ': ' + tot + ' / ' + s.max + ' '), h('span', { class: 'chip ' + (s.bad(s.level(tot)) ? 'red' : 'grn') }, lvName(key, s.level(tot)))] : h('span', { class: 'mut' }, t('sc_incomplete')));
      };
      const draw = () => { const s = SCALES[key]; inputs = {}; clear(box); add(box, h('div', { class: 'cols' }, Object.entries(s.items).map(([k, it]) => { inputs[k] = h('select', { onchange: calc }, h('option', { value: '' }, '—'), it.opts.map((o) => h('option', { value: o.v }, o.v + ' · ' + pick(o)))); return field(pick(it), inputs[k]); }))); calc(); };
      sc0.addEventListener('change', () => { key = sc0.value; draw(); }); draw();
      return shell('escala', X, [field(t('sc_pick'), sc0), box, res, field(t('obs'), obs)], () => { const items = {}; for (const k of Object.keys(inputs)) { if (inputs[k].value === '') throw new Error(t('sc_incomplete')); items[k] = inputs[k].value; } return { scale: key, items, obs: obs.value }; }, done);
    },
    valoracion(X, done) {
      const pf = X.prefill || {}, pat = sel(Object.keys(PATRONES).map((k) => [k, PATRONES[k][lang() === 'ca' ? 1 : 0]]), pf.patron), alt = h('input', { type: 'checkbox' }), txt = h('textarea', { required: true });
      return shell('valoracion', X, [h('div', { class: 'cols' }, field(t('tab_valoracion'), pat)), field(t('pat_text'), txt), h('label', { class: 'row' }, alt, t('pat_altered'))], () => ({ patron: pat.value, alterado: alt.checked, texto: txt.value }), done);
    },
    plan(X, done) {
      const dl = h('datalist', { id: 'dx-sug' }, ['Riesgo de caídas', 'Riesgo de úlcera por presión', 'Riesgo de infección', 'Dolor agudo', 'Intolerancia a la actividad', 'Déficit de autocuidado: higiene', 'Déficit de autocuidado: alimentación', 'Déficit de autocuidado: uso del retrete', 'Estreñimiento', 'Diarrea', 'Patrón respiratorio ineficaz', 'Hipertermia', 'Ansiedad', 'Alteración del patrón del sueño', 'Conocimientos deficientes sobre el régimen terapéutico', 'Deterioro de la integridad cutánea', 'Retención urinaria', 'Riesgo de deshidratación', 'Desequilibrio nutricional por defecto', 'Aislamiento social'].map((x) => h('option', { value: x })));
      const prob = h('input', { type: 'text', list: 'dx-sug', required: true }), cause = h('input', { type: 'text' }), goal = h('textarea', { required: true }), iv = h('textarea', { required: true }), pr = sel([['alta', t('pl_high')], ['media', t('pl_mid')], ['baja', t('pl_low')]], 'media');
      return shell('plan', X, [dl, h('p', { class: 'mut' }, t('pl_hint')), h('div', { class: 'cols' }, field(t('pl_problem'), prob), field(t('pl_cause'), cause), field(t('pl_prio'), pr)), field(t('pl_goal'), goal), field(t('pl_interv'), iv)],
        () => ({ problema: prob.value, causa: cause.value, objetivo: goal.value, intervenciones: iv.value, prioridad: pr.value }), done);
    },
    plan_eval(X, done) {
      const pf = X.prefill || {}, res = sel(['conseguido', 'parcial', 'no_conseguido'].map((v) => [v, t('pl_' + v)]), 'conseguido'), txt = h('textarea');
      return shell('plan_eval', X, [h('p', { class: 'mut' }, pf.title || ''), field(t('pl_result'), res), field(t('pl_ev_text'), txt)], () => ({ plan_id: pf.plan_id, resultado: res.value, texto: txt.value }), done);
    },
    informe(X, done) {
      const tp = sel([['alta', t('inf_alta')], ['traspaso', t('inf_traspaso')]], 'alta'), r = h('textarea', { required: true }), es = h('textarea'), rc = h('textarea');
      return shell('informe', X, [field(t('inf_type'), tp), field(t('inf_summary'), r), field(t('inf_state'), es), field(t('inf_reco'), rc)], () => ({ tipo: tp.value, resumen: r.value, estado: es.value, recomendaciones: rc.value }), done);
    },
  };

  /* ---------- resúmenes de una línea (actividad del profesorado) ---------- */
  function summary(r) {
    const d = r.data;
    if (r.type === 'medicacion') return d.farmaco + ' ' + d.dosis + ' (' + t('rt_' + d.via) + ') — ' + t('st_' + d.estado) + (d.slot ? ' · ' + d.slot : '');
    if (r.type === 'escala') return pick(SCALES[d.scale] || { es: d.scale }) + ': ' + d.total + ' — ' + lvName(d.scale, d.nivel);
    if (r.type === 'valoracion') return PATRONES[d.patron][lang() === 'ca' ? 1 : 0] + (d.alterado ? ' ⚠' : '') + ': ' + d.texto;
    if (r.type === 'plan') return d.problema + ' → ' + d.objetivo;
    if (r.type === 'plan_eval') return t('pl_' + d.resultado) + (d.texto ? ': ' + d.texto : '');
    if (r.type === 'informe') return t('inf_' + d.tipo) + ': ' + d.resumen;
    return '';
  }

  /* ---------- pestañas de la historia ---------- */
  function histTable(X, rows, heads) { return X.tbl(heads, rows); }
  const live = (X, ty) => X.byType(ty).filter((r) => !r.void_at);

  function tabMar(X) {
    const orders = X.c.orders.filter((o) => o.active), box = h('div'); let date = X.c.chart.pace === 'student' ? X.c.chart.case_date : today();
    const states = (o, slot) => live(X, 'medicacion').filter((r) => r.data.order_id === o.id && (slot ? r.data.slot === slot : true) && r.occurred.slice(0, 10) === date);
    const draw = () => {
      clear(box);
      if (!orders.length) return add(box, panel(null, empty(t('mar_none'))));
      const nurseOnly = (o) => X.role === 'tcae' && !TCAE_ROUTES.includes(o.route);
      const rows = orders.map((o) => {
        const range = o.end_day && X.c.chart.day > o.end_day;
        const cells = o.prn ? [h('span', { class: 'chip gry' }, t('mar_prn')), ...states(o).map((r) => h('span', { class: 'chip grn', title: r.author }, fmtDT(r.occurred).slice(6) + ' ' + t('st_' + r.data.estado)))] :
          o.times.map((s) => { const st = states(o, s)[0]; return st ? h('span', { class: 'slot ' + (st.data.estado === 'administrada' ? 'ok' : 'warn'), title: st.author + (st.data.obs ? ' — ' + st.data.obs : '') }, s + ' ' + t('st_' + st.data.estado)) : canWriteOn(X, date) && !nurseOnly(o) ? h('button', { class: 'slot add', onclick: () => X.openForm('medicacion', null, { order_id: o.id, slot: s, date }) }, s + ' · ' + t('mar_register')) : h('span', { class: 'slot' }, s); });
        if (o.prn && canWriteOn(X, date) && !nurseOnly(o)) cells.push(h('button', { class: 'slot add', onclick: () => X.openForm('medicacion', null, { order_id: o.id, date }) }, '+ ' + t('mar_register')));
        return h('tr', { class: range ? 'void' : '' }, h('td', null, h('b', null, o.drug), h('div', { class: 'sub' }, o.dose + ' · ' + t('rt_' + o.route))), h('td', null, o.prn ? t('mar_prn') : o.freq || o.times.join(' · '), o.notes ? h('div', { class: 'sub' }, o.notes) : null, X.staff ? h('div', { class: 'sub' }, t('pr_start') + ' ' + o.start_day + (o.end_day ? ' · ' + t('pr_end') + ' ' + o.end_day : '')) : null),
          h('td', null, h('div', { class: 'slots' }, cells, nurseOnly(o) && !X.staff ? h('span', { class: 'chip amb' }, t('mar_nurse_only')) : null)));
      });
      add(box, panel(null, h('div', { class: 'tw' }, h('table', { class: 'grid mar' }, h('thead', null, h('tr', null, [t('mar_drug'), t('mar_sched'), t('mar_date') + ' ' + fmtD(date)].map((x) => h('th', null, x)))), h('tbody', null, rows))), { flush: true }));
    };
    const di = h('input', { type: 'date', value: date, onchange: (e) => { date = e.target.value || today(); draw(); } });
    draw();
    const hist = live(X, 'medicacion').length || X.byType('medicacion').length;
    return [h('div', { class: 'toolbar row' }, field(t('mar_date'), di), h('span', { class: 'mut' }, t('day_case') + ' ' + X.c.chart.day)), box,
      hist ? panel(t('mar_hist'), X.tbl([t('col_time'), t('mar_drug'), t('mar_slot'), t('mar_state'), t('col_author'), ''], X.byType('medicacion').map((r) => h('tr', { class: r.void_at ? 'void' : '' }, X.timeCell(r), h('td', null, h('span', { class: 'vv' }, r.data.farmaco + ' ' + r.data.dosis), h('div', { class: 'sub' }, t('rt_' + r.data.via))), h('td', null, r.data.slot || '—'), h('td', null, h('span', { class: 'chip ' + (r.data.estado === 'administrada' ? 'grn' : 'amb') }, t('st_' + r.data.estado)), r.data.obs ? h('div', { class: 'sub' }, r.data.obs) : null, X.voidInfo(r), X.cmts(r)), X.who(r), h('td', null, X.actions(r))))), { flush: true }) : null];
  }

  function tabEscalas(X) {
    const recs = X.byType('escala'), lv = live(X, 'escala');
    const cards = Object.keys(SCALES).map((k) => { const r = lv.find((x) => x.data.scale === k); return h('div', { class: 'panel sc-card' }, h('div', { class: 'pb' }, h('div', { class: 'sub' }, pick(SCALES[k])), r ? [h('div', { class: 'sc-big' }, r.data.total, h('span', { class: 'sc-max' }, ' / ' + SCALES[k].max)), lvChip(k, r.data), h('div', { class: 'sub' }, fmtDT(r.occurred) + ' · ' + r.author)] : h('div', { class: 'mut' }, t('sc_none')), canNurse(X) ? h('p', null, h('button', { class: 'sm', onclick: () => X.openForm('escala', null, { scale: k }) }, t('sc_new'))) : null)); });
    return [h('div', { class: 'sc-grid' }, cards), panel(t('sc_hist'), X.tbl([t('col_time'), t('sc_pick'), t('sc_total'), t('sc_level'), t('col_author'), ''], recs.map((r) => h('tr', { class: r.void_at ? 'void' : '' }, X.timeCell(r), h('td', null, h('span', { class: 'vv' }, pick(SCALES[r.data.scale]))), h('td', null, r.data.total), h('td', null, lvChip(r.data.scale, r.data), r.data.obs ? h('div', { class: 'sub' }, r.data.obs) : null, X.voidInfo(r), X.cmts(r)), X.who(r), h('td', null, X.actions(r))))), { flush: true })];
  }

  function tabValoracion(X) {
    const lv = live(X, 'valoracion');
    return h('div', { class: 'sc-grid pat' }, Object.keys(PATRONES).map((k, i) => {
      const all = lv.filter((r) => r.data.patron === k), r = all[0];
      return h('div', { class: 'panel' + (r && r.data.alterado ? ' warn' : '') }, h('div', { class: 'ph' }, (i + 1) + '. ' + PATRONES[k][lang() === 'ca' ? 1 : 0], r ? h('span', { class: 'chip ' + (r.data.alterado ? 'red' : 'grn') }, r.data.alterado ? t('pat_altered') : t('pat_ok')) : null),
        h('div', { class: 'pb' }, r ? [h('div', { class: 'body' }, r.data.texto), h('div', { class: 'sub' }, fmtDT(r.occurred) + ' · ' + r.author + (all.length > 1 ? ' · +' + (all.length - 1) + ' ' + t('pat_previous') : '')), X.cmts(r), h('div', { class: 'row' }, X.actions(r))] : h('span', { class: 'mut' }, t('pat_none')),
          canNurse(X) ? h('p', null, h('button', { class: 'sm', onclick: () => X.openForm('valoracion', null, { patron: k }) }, t('pat_assess'))) : null));
    }));
  }

  function tabPlan(X) {
    const plans = X.byType('plan'), evs = live(X, 'plan_eval');
    const cards = plans.map((p) => {
      const mine = evs.filter((e) => e.data.plan_id === p.id), last = mine[0];
      return h('div', { class: 'panel plan' + (p.void_at ? ' void' : '') }, h('div', { class: 'ph' }, p.data.problema, h('span', { class: 'chip ' + (p.data.prioridad === 'alta' ? 'red' : p.data.prioridad === 'media' ? 'amb' : 'gry') }, t('pl_' + { alta: 'high', media: 'mid', baja: 'low' }[p.data.prioridad])), last ? h('span', { class: 'chip ' + (last.data.resultado === 'conseguido' ? 'grn' : last.data.resultado === 'parcial' ? 'amb' : 'red') }, t('pl_' + last.data.resultado)) : h('span', { class: 'chip gry' }, t('pl_pending'))),
        h('div', { class: 'pb' }, h('dl', { class: 'ficha' }, p.data.causa ? h('div', null, h('dt', null, t('pl_cause')), h('dd', null, p.data.causa)) : null, h('div', null, h('dt', null, t('pl_goal')), h('dd', null, p.data.objetivo)), h('div', null, h('dt', null, t('pl_interv')), h('dd', null, p.data.intervenciones))),
          mine.map((e) => h('div', { class: 'cm' }, h('b', null, fmtDT(e.occurred) + ' · ' + t('pl_' + e.data.resultado) + ': '), e.data.texto || '', h('span', { class: 'sub' }, ' — ' + e.author))), X.voidInfo(p), X.cmts(p), h('div', { class: 'sub' }, fmtDT(p.occurred) + ' · ' + p.author),
          h('div', { class: 'row' }, !p.void_at && canNurse(X) ? h('button', { class: 'sm pri', onclick: () => X.openForm('plan_eval', null, { plan_id: p.id, title: p.data.problema }) }, t('pl_eval')) : null, X.actions(p))));
    });
    return [canNurse(X) ? h('p', null, h('button', { class: 'pri', onclick: () => X.openForm('plan') }, '+ ' + t('pl_new'))) : null, cards.length ? cards : panel(null, empty(t('pl_empty')))];
  }

  function tabInforme(X) {
    const rs = X.byType('informe');
    return [canNurse(X) ? h('p', null, h('button', { class: 'pri', onclick: () => X.openForm('informe') }, '+ ' + t('inf_new'))) : null, rs.length ? rs.map((r) => h('div', { class: 'panel' + (r.void_at ? ' void' : '') }, h('div', { class: 'ph' }, t('inf_' + r.data.tipo), h('span', { class: 'sub' }, fmtDT(r.occurred) + ' · ' + r.author)),
      h('div', { class: 'pb' }, h('dl', { class: 'ficha' }, [['inf_summary', r.data.resumen], ['inf_state', r.data.estado], ['inf_reco', r.data.recomendaciones]].filter((x) => x[1]).map(([k, v]) => h('div', null, h('dt', null, t(k)), h('dd', null, v)))), X.voidInfo(r), X.cmts(r), h('div', { class: 'row' }, X.actions(r))))) : panel(null, empty(t('no_records')))];
  }

  /* tarjeta de prueba o evento: tipo con color + título a la izquierda, acciones a la derecha */
  const evCard = (e, o) => h('div', { class: 'ev ev-' + e.kind + (o.faded ? ' faded' : '') }, h('div', { class: 'ev-h' }, h('span', { class: 'ev-kind' }, t('ev_' + e.kind)), h('b', { class: 'ev-t' }, e.title), o.actions || null), e.body ? h('div', { class: 'ev-b' }, e.body) : null);
  function eventList(events, dayNow, staff) {
    if (!events.length) return panel(null, empty(t('ev_none')));
    const days = [...new Set(events.map((e) => e.day))];
    return h('div', { class: 'tl' }, days.map((d) => h('div', { class: 'tl-day' }, h('div', { class: 'tl-h' }, t('ev_day') + ' ' + d, staff && d > dayNow ? h('span', { class: 'chip amb' }, t('ev_future') + ' ' + d) : null),
      events.filter((e) => e.day === d).map((e) => evCard(e, { faded: staff && e.day > dayNow })))));
  }
  const tabPruebas = (X) => [h('div', { class: 'toolbar row' }, h('b', null, t('ev_title')), X.staff ? dayControl(X.id, X.c.chart.day, X.refresh) : h('span', { class: 'mut' }, t('day_case') + ' ' + X.c.chart.day)), eventList(X.c.events, X.c.chart.day, X.staff)];

  /* Evaluación con rúbrica */
  function tabEval(X) {
    const g = X.c.grades, rub = g.rubric, lbl = (c) => pick(c);
    if (!X.staff) {
      const m = g.list[0]; if (!m) return panel(null, empty(t('gr_none')));
      return panel(t('tab_eval'), [h('div', { class: 'sc-big' }, m.total == null ? '—' : m.total, h('span', { class: 'sc-max' }, ' / 10')), h('table', { class: 'grid' }, h('tbody', null, rub.map((c) => h('tr', null, h('td', null, lbl(c)), h('td', { class: 'r' }, m.scores[c.id] != null ? t('lv' + m.scores[c.id]) : '—'))))), m.comment ? h('div', { class: 'cm' }, m.comment) : null]);
    }
    return X.c.members.map((mb) => {
      const cur = g.list.find((x) => x.user_id === mb.id) || { scores: {}, comment: '', published: false };
      const sels = {}; const tot = h('b'); const calc = () => { let sw = 0, acc = 0; rub.forEach((c) => { const v = sels[c.id].value; if (v !== '') { sw += c.w; acc += (c.w * Number(v)) / 4; } }); tot.textContent = sw ? (Math.round((acc / sw) * 100) / 10) + ' / 10' : '—'; };
      const cm = h('textarea', { value: cur.comment }), pub = h('input', { type: 'checkbox', checked: cur.published });
      rub.forEach((c) => { sels[c.id] = h('select', { onchange: calc }, h('option', { value: '' }, '—'), [0, 1, 2, 3, 4].map((v) => h('option', { value: v, selected: cur.scores[c.id] === v }, t('lv' + v)))); });
      calc();
      return panel(mb.name + (X.c.chart.kind === 'team' ? '' : ''), [h('div', { class: 'cols' }, rub.map((c) => field(lbl(c) + ' (×' + c.w + ')', sels[c.id]))), field(t('gr_comment'), cm), h('label', { class: 'row' }, pub, t('gr_publish')),
        h('p', { class: 'row' }, h('span', null, t('gr_mark') + ': '), tot, h('button', { class: 'pri', onclick: async () => { const scores = {}; rub.forEach((c) => { scores[c.id] = sels[c.id].value; }); try { await api('PUT', '/api/charts/' + X.id + '/grades/' + mb.id, { scores, comment: cm.value, published: pub.checked }); toast(t('gr_saved')); X.refresh(); } catch (e) { fail(e); } } }, t('save')))]);
    });
  }

  function extraTabs(X) {
    const n = (ty) => X.byType(ty).length, out = [['mar', t('tab_mar'), n('medicacion')], ['escalas', t('tab_escalas'), n('escala')], ['valoracion', t('tab_valoracion'), n('valoracion')], ['plan', t('tab_plan'), n('plan')], ['pruebas', t('tab_pruebas'), X.c.events.length], ['informe', t('tab_informe'), n('informe')]];
    if (X.staff || X.c.grades.list.length) out.push(['eval', t('tab_eval')]);
    return out;
  }
  function chartTab(tab, X) {
    return { mar: tabMar, escalas: tabEscalas, valoracion: tabValoracion, plan: tabPlan, pruebas: tabPruebas, informe: tabInforme, eval: tabEval }[tab] ? { mar: tabMar, escalas: tabEscalas, valoracion: tabValoracion, plan: tabPlan, pruebas: tabPruebas, informe: tabInforme, eval: tabEval }[tab](X) : null;
  }

  /* ---------- gráficas ---------- */
  const SERIES = [
    ['ta', 'ta', 'mmHg', [['ta_sis', 'S'], ['ta_dia', 'D']], [90, 140]], ['fc', 'fc', 'lpm', [['fc', '']], [60, 100]], ['temp', 'temp', '°C', [['temp', '']], [36, 37.5]], ['spo2', 'spo2', '%', [['spo2', '']], [92, 100]],
    ['fr', 'fr', 'rpm', [['fr', '']], [12, 20]], ['glucemia', 'glucemia', 'mg/dl', [['glucemia', '']], [70, 180]], ['dolor', 'dolor', '/10', [['dolor', '']], [0, 3]],
  ];
  function lineChart(label, unit, keys, band, recs) {
    const W = 360, H = 130, L = 36, R = 10, T = 12, B = 24;
    const pts = keys.map(([k]) => recs.filter((r) => r.data[k] != null).map((r) => ({ x: new Date(r.occurred).getTime(), v: r.data[k], r })));
    const all = pts.flat(); if (all.length < 2) return null;
    const xs = all.map((p) => p.x), x0 = Math.min(...xs), x1 = Math.max(...xs), vs = all.map((p) => p.v).concat(band);
    let y0 = Math.min(...vs), y1 = Math.max(...vs); const pad = (y1 - y0) * 0.12 || 1; y0 -= pad; y1 += pad;
    const X = (x) => L + (x1 === x0 ? (W - L - R) / 2 : ((x - x0) / (x1 - x0)) * (W - L - R)), Y = (v) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
    const s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': label + ' (' + unit + ')', class: 'lc' });
    s.appendChild(svg('rect', { x: L, y: Y(band[1]), width: W - L - R, height: Math.max(0, Y(band[0]) - Y(band[1])), class: 'band' }));
    [y0 + pad, (y0 + y1) / 2, y1 - pad].forEach((v) => { s.appendChild(svg('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: 'gl' })); s.appendChild(svg('text', { x: L - 4, y: Y(v) + 3, class: 'ax', 'text-anchor': 'end' }, Math.round(v * 10) / 10)); });
    s.appendChild(svg('text', { x: L, y: H - 6, class: 'ax' }, fmtDT(new Date(x0 - new Date().getTimezoneOffset() * 60000).toISOString())));
    s.appendChild(svg('text', { x: W - R, y: H - 6, class: 'ax', 'text-anchor': 'end' }, fmtDT(new Date(x1 - new Date().getTimezoneOffset() * 60000).toISOString())));
    pts.forEach((line, i) => {
      line.sort((a, b) => a.x - b.x);
      s.appendChild(svg('polyline', { points: line.map((p) => X(p.x) + ',' + Y(p.v)).join(' '), class: 'ln l' + i }));
      line.forEach((p) => s.appendChild(svg('circle', { cx: X(p.x), cy: Y(p.v), r: 3, class: 'pt l' + i }, svg('title', null, label + ' ' + p.v + ' ' + unit + ' · ' + fmtDT(p.r.occurred)))));
    });
    return h('div', { class: 'panel chart' }, h('div', { class: 'ph' }, label, h('span', { class: 'sub' }, unit + (keys.length > 1 ? ' · ' + keys.map((k, i) => (i ? '■ ' : '● ') + k[1]).join(' ') : ''))), h('div', { class: 'pb' }, s));
  }
  function vitalCharts(cols) {
    const recs = cols.filter((r) => !r.void_at), charts = SERIES.map(([k, lk, unit, keys, band]) => lineChart(HC.plain(lk), unit, keys, band, recs)).filter(Boolean);
    return charts.length ? h('div', null, h('div', { class: 'chart-grid' }, charts), h('p', { class: 'mut' }, t('ch_band'))) : h('div', { class: 'panel' }, h('div', { class: 'pb mut' }, t('ch_none')));
  }

  /* entradas (azul) y salidas (diuresis + otras) por día de 07:00 a 07:00, últimos 10 días */
  function balanceChart(recs) {
    const days = {};
    recs.filter((r) => !r.void_at).forEach((r) => {
      let day = r.occurred.slice(0, 10); const hr = parseInt(r.occurred.slice(11, 13), 10);
      if (hr < 7) { const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() - 1); day = d.toISOString().slice(0, 10); }
      const o = (days[day] = days[day] || { inn: 0, diu: 0, out: 0 });
      if (r.data.dir === 'ingesta') o.inn += r.data.ml; else if (r.data.via === 'diuresis') o.diu += r.data.ml; else o.out += r.data.ml;
    });
    const dk = Object.keys(days).sort().slice(-10); if (!dk.length) return null;
    const gw = 92, L = 46, Rm = 10, T = 18, B = 42, Hh = 210, W = Math.max(L + Rm + dk.length * gw, 560);
    const max = Math.max(...dk.map((k) => Math.max(days[k].inn, days[k].diu + days[k].out)), 1), Y = (v) => T + (1 - v / max) * (Hh - T - B), base = Y(0);
    const s = svg('svg', { viewBox: '0 0 ' + W + ' ' + Hh, role: 'img', 'aria-label': t('bc_title'), class: 'lc bc', style: 'width:' + Math.min(W * 1.5, 900) + 'px;max-width:100%' });
    [0, max / 2, max].forEach((v) => { s.appendChild(svg('line', { x1: L, x2: W - Rm, y1: Y(v), y2: Y(v), class: 'gl' })); s.appendChild(svg('text', { x: L - 4, y: Y(v) + 3, class: 'ax', 'text-anchor': 'end' }, Math.round(v))); });
    const bar = (x, v, y0, cls, label) => { const h0 = Math.max(0, Y(y0) - Y(y0 + v)); if (!h0) return; s.appendChild(svg('rect', { x, y: Y(y0 + v), width: 30, height: h0, class: cls }, svg('title', null, label + ': ' + v + ' ml'))); };
    dk.forEach((k, i) => {
      const o = days[k], x = L + i * gw + 12, out = o.diu + o.out, net = o.inn - out;
      bar(x, o.inn, 0, 'b-in', t('bc_in')); bar(x + 34, o.diu, 0, 'b-diu', t('bc_diu')); bar(x + 34, o.out, o.diu, 'b-out', t('bc_other'));
      if (o.inn) s.appendChild(svg('text', { x: x + 15, y: Y(o.inn) - 3, class: 'ax', 'text-anchor': 'middle' }, o.inn));
      if (out) s.appendChild(svg('text', { x: x + 49, y: Y(out) - 3, class: 'ax', 'text-anchor': 'middle' }, out));
      s.appendChild(svg('text', { x: x + 32, y: Hh - 24, class: 'ax', 'text-anchor': 'middle' }, fmtD(k).slice(0, 5)));
      s.appendChild(svg('text', { x: x + 32, y: Hh - 10, class: 'ax net' + (net < 0 ? ' neg' : ''), 'text-anchor': 'middle' }, t('bc_net') + ' ' + (net > 0 ? '+' : '') + net));
    });
    s.appendChild(svg('line', { x1: L, x2: W - Rm, y1: base, y2: base, class: 'gl' }));
    const sw = (cls, label) => h('span', { class: 'sw-key' }, h('i', { class: 'sw ' + cls }), label);
    return h('div', { class: 'panel chart bc-panel' }, h('div', { class: 'ph' }, t('bc_title'), h('span', { class: 'sub' }, 'ml')),
      h('div', { class: 'pb' }, h('div', { class: 'bc-scroll' }, s), h('div', { class: 'row bc-leg' }, sw('b-in', t('bc_in')), sw('b-diu', t('bc_diu')), sw('b-out', t('bc_other'))), h('p', { class: 'mut' }, t('bc_help'))));
  }

  function balanceShifts(recs) {
    const days = {}; recs.filter((r) => !r.void_at).forEach((r) => {
      let day = r.occurred.slice(0, 10); const hr = parseInt(r.occurred.slice(11, 13), 10), sh = hr >= 7 && hr < 15 ? 'M' : hr >= 15 && hr < 23 ? 'T' : 'N';
      if (hr < 7) { const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() - 1); day = d.toISOString().slice(0, 10); }
      const o = (days[day] = days[day] || { M: [0, 0], T: [0, 0], N: [0, 0] }); o[sh][r.data.dir === 'ingesta' ? 0 : 1] += r.data.ml;
    });
    const dk = Object.keys(days).sort().reverse(); if (!dk.length) return null;
    const cell = (a) => (a[0] || a[1] ? t('ba_in') + ' ' + a[0] + ' · ' + t('ba_out') + ' ' + a[1] + ' · ' + (a[0] - a[1] > 0 ? '+' : '') + (a[0] - a[1]) : '—');
    return panel(t('ba_shifts'), h('div', { class: 'tw' }, h('table', { class: 'grid' }, h('thead', null, h('tr', null, [t('bal_day'), t('ba_M'), t('ba_T'), t('ba_N'), t('ba_24')].map((x) => h('th', null, x)))),
      h('tbody', null, dk.map((k) => { const o = days[k], tot = [o.M[0] + o.T[0] + o.N[0], o.M[1] + o.T[1] + o.N[1]]; return h('tr', null, h('td', null, fmtD(k)), h('td', null, cell(o.M)), h('td', null, cell(o.T)), h('td', null, cell(o.N)), h('td', null, h('b', null, cell(tot)))); })))), { flush: true });
  }

  /* ---------- profesorado: prescripciones y línea temporal por paciente ---------- */
  async function patientTab(tab, X) {
    if (tab === 'consignas') return consignasTab(X);
    if (tab === 'seguimiento') return seguimientoTab(X);
    const plan = await api('GET', '/api/patients/' + X.id + '/plan'), refresh = () => X.refresh();
    if (tab === 'prescripciones') {
      const f = {}; const form = (o) => {
        const i = (k, v, extra) => (f[k] = h('input', Object.assign({ type: 'text', value: v == null ? '' : v }, extra || {})));
        f.route = sel(ROUTES.map((r) => [r, t('rt_' + r)]), o ? o.route : 'oral'); f.prn = h('input', { type: 'checkbox', checked: !!(o && o.prn) });
        return h('div', { class: 'pb' }, h('div', { class: 'cols' }, field(t('pr_drug'), i('drug', o && o.drug)), field(t('pr_dose'), i('dose', o && o.dose)), field(t('pr_route'), f.route), field(t('pr_freq'), i('freq', o && o.freq)), field(t('pr_times'), i('times', o && o.times.join(','), { placeholder: '08:00,16:00,00:00' })), field(t('pr_start'), i('start_day', o ? o.start_day : 1, { inputmode: 'numeric' })), field(t('pr_end'), i('end_day', o && o.end_day || '', { inputmode: 'numeric' })), field(t('pr_notes'), i('notes', o && o.notes))), h('label', { class: 'row' }, f.prn, t('pr_prn')));
      };
      const read = () => ({ drug: f.drug.value, dose: f.dose.value, route: f.route.value, freq: f.freq.value, times: f.times.value, prn: f.prn.checked, start_day: f.start_day.value, end_day: f.end_day.value, notes: f.notes.value });
      const add1 = h('details', { class: 'panel' }, h('summary', null, t('pr_add')), form(null), h('p', { class: 'pb' }, h('button', { class: 'pri', onclick: async () => { try { await api('POST', '/api/patients/' + X.id + '/orders', read()); refresh(); } catch (e) { fail(e); } } }, t('save'))));
      const rows = plan.orders.map((o) => h('tr', { class: o.active ? '' : 'void' }, h('td', null, h('b', null, o.drug), h('div', { class: 'sub' }, o.dose + ' · ' + t('rt_' + o.route))), h('td', null, o.prn ? t('mar_prn') : o.times.join(' · ') + (o.freq ? ' (' + o.freq + ')' : '')), h('td', null, t('ev_day') + ' ' + o.start_day + (o.end_day ? '–' + o.end_day : '+')), h('td', null, o.active ? '' : h('span', { class: 'chip amb' }, t('pr_suspended'))),
        h('td', null, h('div', { class: 'row' }, h('button', { class: 'sm', onclick: async () => { try { await api('PUT', '/api/orders/' + o.id, { active: !o.active }); refresh(); } catch (e) { fail(e); } } }, o.active ? t('pr_off') : t('pr_on')),
          h('button', { class: 'sm danger', onclick: async () => { try { await api('DELETE', '/api/orders/' + o.id); refresh(); } catch (e) { if (e.status === 409) toast(t('pr_has'), true); else fail(e); } } }, t('delete'))))));
      return [h('p', { class: 'mut' }, t('pr_help')), add1, panel(t('pr_title'), rows.length ? h('div', { class: 'tw' }, h('table', { class: 'grid' }, h('tbody', null, rows))) : empty(t('mar_none')), { flush: true })];
    }
    const kind = sel([['prueba', t('ev_prueba')], ['evento', t('ev_evento')]], 'prueba'), day = h('input', { type: 'text', inputmode: 'numeric', value: '1' }), title = h('input', { type: 'text' }), body = h('textarea');
    const add1 = h('details', { class: 'panel', open: !plan.events.length }, h('summary', null, t('ev_add')), h('div', { class: 'pb' }, h('div', { class: 'cols' }, field(t('tipo'), kind), field(t('ev_day'), day), field(t('ev_title_f'), title)), field(t('ev_body'), body), h('p', null, h('button', { class: 'pri', onclick: async () => { try { await api('POST', '/api/patients/' + X.id + '/events', { kind: kind.value, day: day.value, title: title.value, body: body.value }); refresh(); } catch (e) { fail(e); } } }, t('save')))));
    return [h('p', { class: 'mut' }, t('ev_hint')), add1, h('div', { class: 'tl' }, [...new Set(plan.events.map((e) => e.day))].map((d) => h('div', { class: 'tl-day' }, h('div', { class: 'tl-h' }, t('ev_day') + ' ' + d),
      plan.events.filter((e) => e.day === d).map((e) => evCard(e, { actions: h('button', { class: 'sm danger', onclick: async () => { try { await api('DELETE', '/api/events/' + e.id); refresh(); } catch (er) { fail(er); } } }, t('delete')) })))))];
  }

  /* ---------- impresión de la historia completa ---------- */
  function printView(c) {
    const d = c.patient.data, recs = c.records.filter((r) => !r.void_at), by = (ty) => recs.filter((r) => r.type === ty).slice().reverse();
    const sec = (title, rows) => (rows.length ? h('section', { class: 'pd-sec' }, h('h2', null, title), rows) : null);
    const line = (r, txt) => h('div', { class: 'pd-line' }, h('b', null, fmtDT(r.occurred)), ' ', txt, h('span', { class: 'sub' }, ' — ' + r.author));
    const al = d.alergias || [];
    return h('div', { class: 'print-doc' },
      h('div', { class: 'pd-head' }, h('div', null, h('h1', null, (d.apellidos || '') + ', ' + (d.nombre || '')), h('div', { class: 'sub' }, [d.nhc && 'NHC ' + d.nhc, d.fecha_nacimiento && fmtD(d.fecha_nacimiento), d.unidad, d.habitacion && 'H ' + d.habitacion, d.cama && 'C ' + d.cama].filter(Boolean).join(' · ')), h('div', null, al.length ? '⚠ ' + t('allergies') + ': ' + al.map((a) => a.agente).join(', ') : d.sin_alergias ? t('allergies_none') : ''), h('div', { class: 'sub' }, t('members') + ': ' + c.members.map((m) => m.name).join(', '))),
        h('div', { class: 'noprint row' }, h('button', { class: 'pri', onclick: () => window.print() }, t('print')), h('button', { onclick: () => { location.hash = '#/chart/' + c.chart.id; } }, t('print_back')))),
      sec(t('patient_summary'), d.diagnostico_medico ? [h('div', { class: 'pd-line' }, d.diagnostico_medico + (d.motivo_ingreso ? ' — ' + d.motivo_ingreso : ''))] : []),
      sec(t('tab_constantes'), by('constantes').map((r) => line(r, window.HC.recSummary(r)))), sec(t('tab_balance'), by('balance').map((r) => line(r, window.HC.recSummary(r)))),
      sec(t('tab_mar'), by('medicacion').map((r) => line(r, summary(r)))), sec(t('tab_escalas'), by('escala').map((r) => line(r, summary(r)))), sec(t('tab_valoracion'), by('valoracion').map((r) => line(r, summary(r)))),
      sec(t('tab_plan'), by('plan').map((r) => h('div', { class: 'pd-line' }, h('b', null, r.data.problema), ' (' + t('pl_' + { alta: 'high', media: 'mid', baja: 'low' }[r.data.prioridad]) + ') — ' + r.data.objetivo + ' | ' + r.data.intervenciones, by('plan_eval').filter((e) => e.data.plan_id === r.id).map((e) => h('div', { class: 'sub' }, '↳ ' + fmtDT(e.occurred) + ' ' + t('pl_' + e.data.resultado) + (e.data.texto ? ': ' + e.data.texto : '')))))),
      sec(t('tab_evolucion'), by('nota').map((r) => line(r, window.HC.recSummary(r)))), sec(t('tab_cuidados'), by('cuidado').map((r) => line(r, window.HC.recSummary(r)))), sec(t('tab_informe'), by('informe').map((r) => line(r, summary(r)))),
      sec(t('ev_title'), c.events.map((e) => h('div', { class: 'pd-line' }, h('b', null, t('ev_day') + ' ' + e.day + ' · ' + e.title), e.body ? ' — ' + e.body : ''))));
  }

  /* ---------- profesorado: notas y rúbrica ---------- */
  async function viewGrades() {
    const [{ grades, rubric, campus }] = await Promise.all([api('GET', '/api/grades')]);
    const rows = rubric.map((c) => ({ es: c.es, ca: c.ca, w: c.w })), box = h('div');
    const drawR = () => { clear(box); rows.forEach((r, i) => add(box, h('div', { class: 'row rub' }, h('input', { type: 'text', value: r.es, placeholder: t('gr_crit_es'), 'aria-label': t('gr_crit_es'), oninput: (e) => { r.es = e.target.value; } }), h('input', { type: 'text', value: r.ca, placeholder: t('gr_crit_ca'), 'aria-label': t('gr_crit_ca'), oninput: (e) => { r.ca = e.target.value; } }), h('input', { type: 'number', min: 1, max: 10, value: r.w, 'aria-label': t('gr_w'), oninput: (e) => { r.w = e.target.value; } }), h('button', { class: 'sm danger', onclick: () => { rows.splice(i, 1); drawR(); } }, '✕')))); };
    drawR();
    const gradeRow = (g) => h('tr', null, h('td', null, g.name, h('div', { class: 'sub' }, g.email)), h('td', null, g.code + ' ' + g.patient), h('td', null, g.chart), h('td', { class: 'r' }, h('b', null, g.total == null ? '—' : g.total)), h('td', null, h('span', { class: 'chip ' + (g.published ? 'grn' : 'gry') }, g.published ? t('yes') : t('no'))), h('td', null, h('button', { class: 'sm', onclick: () => { location.hash = '#/chart/' + g.chart_id + '/eval'; } }, t('gr_open'))));
    const rub = h('details', { class: 'panel' }, h('summary', null, t('gr_rubric')), h('div', { class: 'pb' }, h('p', { class: 'mut' }, t('gr_rubric_help')), box, h('p', { class: 'row' }, h('button', { onclick: () => { rows.push({ es: '', ca: '', w: 1 }); drawR(); } }, '+ ' + t('gr_add')), h('button', { class: 'pri', onclick: async () => { try { await api('PUT', '/api/rubric', { rubric: rows }); toast(t('ok')); } catch (e) { fail(e); } } }, t('save')))));
    const fill = (k, n) => t(k).replace('{n}', n);
    const groups = {}; grades.filter((g) => g.published && g.total != null).forEach((g) => { const key = g.consigna_id ? 'k' + g.consigna_id : 'p' + g.patient_id; (groups[key] = groups[key] || { id: key, ttl: g.consigna || g.chart, title: (g.consigna || g.chart) + ' · ' + g.code + ' ' + g.patient, list: [] }).list.push(g); });
    const sendPanel = (gr) => {
      const counts = {}; gr.list.forEach((g) => (g.subjects || []).forEach((sl) => { counts[sl] = (counts[sl] || 0) + 1; }));
      const best = (campus || []).map((c) => c.slug).sort((a, b) => (counts[b] || 0) - (counts[a] || 0))[0] || '';
      const sub = h('select', { 'aria-label': t('gr_subject') }, (campus || []).map((c) => h('option', { value: c.slug, selected: c.slug === best }, c.title)));
      const cat = h('select', { 'aria-label': t('gr_cat') }, ['practica', 'teoria', 'seguimiento'].map((k) => h('option', { value: k }, t('gr_' + k))));
      const ra = h('select', { 'aria-label': t('gr_ra') });
      const drawRa = () => { clear(ra); add(ra, h('option', { value: '' }, t('gr_nora'))); ((campus || []).find((c) => c.slug === sub.value) || { ras: [] }).ras.forEach((r) => add(ra, h('option', { value: r.id }, ((r.code ? r.code + ' ' : '') + r.title).trim()))); };
      sub.addEventListener('change', drawRa); drawRa();
      const wt = h('input', { type: 'number', min: 0.1, max: 100, step: 0.1, value: 1, 'aria-label': t('gr_weight') }), ti = h('input', { type: 'text', value: gr.ttl, 'aria-label': t('gr_ptitle') }), out = h('p', { class: 'mut', role: 'status' });
      const go = h('button', { class: 'pri', onclick: async () => { out.textContent = ''; try { const r = await api('POST', '/api/send-campus', { group: gr.id, slug: sub.value, kind: cat.value, ra_id: ra.value || null, weight: wt.value, title: ti.value }); toast(fill('gr_sent', r.saved)); out.textContent = [fill('gr_sent', r.saved), r.kept ? fill('gr_kept', r.kept) : '', r.missing && r.missing.length ? fill('gr_miss', r.missing.length) : ''].filter(Boolean).join('. ') + '.'; } catch (e) { fail(e); } } }, t('gr_send'));
      return h('details', { class: 'panel' }, h('summary', null, t('gr_send') + ': ' + gr.title + ' (' + (gr.list.length === 1 ? t('gr_pub1') : fill('gr_pubn', gr.list.length)) + ')'), h('div', { class: 'pb' }, h('p', { class: 'mut' }, t('gr_send_help')),
        h('div', { class: 'row' }, field(t('gr_subject'), sub), field(t('gr_cat'), cat), field(t('gr_ra'), ra), field(t('gr_weight'), wt)), field(t('gr_ptitle'), ti), h('p', { class: 'row' }, go), out));
    };
    const sendBox = Object.values(groups).length ? (campus && campus.length ? h('div', null, h('h2', { class: 'sec-h' }, t('gr_send_h')), Object.values(groups).map(sendPanel)) : panel(null, empty(t('gr_nosync')))) : null;
    HC.show(h('div', { class: 'pg-title' }, h('h1', null, t('gr_title')), h('a', { class: 'btn', href: '/api/grades.csv', download: '' }, t('gr_csv'))), rub, sendBox,
      grades.length ? panel(null, h('div', { class: 'tw' }, h('table', { class: 'grid' }, h('thead', null, h('tr', null, [t('gr_student'), t('gr_case'), t('col_chart'), t('gr_mark'), t('gr_pub'), ''].map((x, i) => h('th', { class: i === 3 ? 'r' : '' }, x)))), h('tbody', null, grades.map(gradeRow)))), { flush: true }) : panel(null, empty(t('gr_empty'))));
  }

  /* ---------- profesorado: importar un caso desde texto plano ---------- */
  async function viewImport() {
    const { templates } = await api('GET', '/api/import/template');
    let template = templates.ca;
    const fill = (k, n) => t(k).replace('{n}', n);
    const tpl = h('textarea', { class: 'mono', readonly: true, rows: 14, 'aria-label': t('imp_step1'), value: template });
    const tl = h('select', { 'aria-label': t('imp_lang'), onchange: (e) => { template = templates[e.target.value]; tpl.value = template; } }, h('option', { value: 'ca' }, t('imp_lang_ca')), h('option', { value: 'es' }, t('imp_lang_es')));
    const copy = h('button', { class: 'pri', onclick: async () => { try { await navigator.clipboard.writeText(template); } catch (_) { tpl.select(); document.execCommand('copy'); } toast(t('imp_copied')); } }, t('imp_copy'));
    const txt = h('textarea', { class: 'mono', rows: 14, placeholder: t('imp_paste_ph'), 'aria-label': t('imp_step2') }), out = h('div', { role: 'status' });
    const list = (items) => h('ul', { class: 'imp-list' }, items.map((x) => h('li', null, x.line ? h('span', { class: 'mut' }, t('imp_line') + ' ' + x.line + ': ') : null, x.msg)));
    const run = async (commit) => {
      clear(out);
      try {
        const r = await api('POST', '/api/import', { text: txt.value, commit });
        if (commit) { toast(t('imp_done') + ' ' + r.code); location.hash = '#/patient/' + r.id; return; }
        const p = r.patient; setTimeout(() => out.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
        add(out, [r.errors.length ? panel(t('imp_errors') + ' (' + r.errors.length + ')', h('div', null, list(r.errors), h('p', { class: 'mut' }, r.can_commit ? t('imp_skipped') : t('imp_blocked')))) : null,
          r.warnings.length ? panel(t('imp_warnings') + ' (' + r.warnings.length + ')', list(r.warnings)) : null]);
        if (!p) return;
        add(out, panel(t('imp_will'), h('div', null,
          h('p', null, h('b', null, t('imp_pat') + ': '), p.nombre + ' ' + p.apellidos, p.diagnostico ? ' — ' + p.diagnostico : '', h('span', { class: 'mut' }, ' · ' + fill('imp_fields', r.filled) + ' · ' + (p.alergias ? fill('imp_allergies', p.alergias) : p.sin_alergias ? t('imp_no_allergies') : ''))),
          h('h3', { class: 'sec-h' }, fill('imp_orders', r.orders.length)), r.orders.length ? h('ul', { class: 'imp-list' }, r.orders.map((o) => h('li', null, [o.drug, o.dose, o.route, o.prn ? 'PRN' : String(o.times || '').replace(/,/g, ', '), t('imp_day') + ' ' + o.start_day + (o.end_day ? '–' + o.end_day : '+')].filter(Boolean).join(' · ')))) : h('p', { class: 'mut' }, '—'),
          h('h3', { class: 'sec-h' }, fill('imp_events', r.events.length)), r.events.length ? h('ul', { class: 'imp-list' }, r.events.map((e) => h('li', null, t('imp_day') + ' ' + e.day + ' · ' + e.kind + ' · ' + e.title))) : h('p', { class: 'mut' }, '—'),
          h('h3', { class: 'sec-h' }, fill('imp_consignas', (r.consignas || []).length)), (r.consignas || []).length ? h('ul', { class: 'imp-list' }, r.consignas.map((k) => h('li', null, k.title + ' · ' + k.tasks + ' ' + t('cs_tasks').toLowerCase()))) : h('p', { class: 'mut' }, '—'),
          r.can_commit ? h('p', { class: 'row' }, h('button', { class: 'pri', onclick: () => run(true) }, t('imp_create'))) : null)));
      } catch (e) { fail(e); }
    };
    const mkEx = (lg, label) => h('button', { onclick: async () => { try { const r = await api('POST', '/api/import/example', { lang: lg }); toast(t('example_done') + ' ' + r.code); location.hash = '#/chart/' + r.chart_id; } catch (e) { fail(e); } } }, label);
    const ex = h('details', { class: 'imp-ex' }, h('summary', null, t('example_btn')), h('p', { class: 'mut' }, t('example_help')), h('p', { class: 'row' }, mkEx('ca', t('ex_ca')), mkEx('es', t('ex_es'))));
    HC.show(h('div', { class: 'pg-title' }, h('h1', null, t('imp_title'))), h('p', { class: 'mut' }, t('imp_intro') + ' ' + t('imp_lang_help')),
      panel(t('imp_step1'), h('div', null, h('p', { class: 'mut' }, t('imp_step1_help')), h('p', { class: 'row' }, h('label', { class: 'row' }, t('imp_lang') + ':', tl), copy), h('details', null, h('summary', null, t('imp_show_tpl')), tpl))),
      panel(t('imp_step2'), h('div', null, txt, h('p', { class: 'row' }, h('button', { class: 'pri', onclick: () => run(false) }, t('imp_review'))), out)), ex);
  }

  /* ---------- consignas: enunciado y tareas de una actividad ---------- */
  const TASK_KINDS = ['nota', 'constantes', 'balance', 'cuidado', 'medicacion', 'escala', 'valoracion', 'plan', 'plan_eval', 'informe', 'libre'];
  const ckLabel = (k) => t('ck_' + k);
  function consignaCard(c, open) {
    const k = c.consigna; if (!k) return null;
    const typed = k.tasks.filter((x) => x.done != null), done = typed.filter((x) => x.done).length;
    const items = k.tasks.map((x) => h('li', { class: x.done ? 'ok' : '' }, h('span', { class: 'ck', 'aria-hidden': 'true' }, x.done == null ? '•' : x.done ? '✓' : '○'), ' ', x.day ? h('span', { class: 'chip' + (x.day === c.chart.day && c.chart.pace === 'student' ? ' grn' : '') }, t('dy_d') + x.day) : null, x.day ? ' ' : null, x.text,
      x.done != null ? h('span', { class: 'mut' }, ' · ' + ckLabel(x.kind) + (x.min > 1 ? ' ' + Math.min(x.count, x.min) + '/' + x.min : '')) : null, x.done ? h('span', { class: 'sr' }, ' (' + t('yes') + ')') : null));
    return h('details', { class: 'panel consigna', open: !!open }, h('summary', null, t('cs_title') + ': ' + k.title, typed.length ? h('span', { class: 'chip ' + (done === typed.length ? 'grn' : '') }, t('cs_progress').replace('{a}', done).replace('{b}', typed.length)) : null, k.due ? h('span', { class: 'chip amb' }, t('cs_due_on') + ' ' + fmtD(k.due)) : null),
      h('div', { class: 'pb' }, k.body ? h('p', { class: 'cs-body' }, k.body) : null, items.length ? h('ul', { class: 'cs-tasks' }, items) : null));
  }
  function consignaControl(chartId, list, current, refresh) {
    if (!list || !list.length) return null;
    const sel = h('select', { 'aria-label': t('cs_assign'), onchange: async (e) => { try { await api('PUT', '/api/charts/' + chartId, { consigna_id: e.target.value || null }); refresh(); } catch (er) { fail(er); } } },
      h('option', { value: '' }, t('cs_pick')), list.map((k) => h('option', { value: k.id, selected: k.id === current }, k.title)));
    return h('span', { class: 'row' }, h('span', { class: 'mut' }, t('cs_title') + ':'), sel);
  }
  async function consignasTab(X) {
    const { consignas } = await api('GET', '/api/patients/' + X.id + '/consignas'), refresh = () => X.refresh(); let editing = null;
    const form = (k) => {
      const ti = h('input', { type: 'text', value: k ? k.title : '', 'aria-label': t('cs_title_f') }), bo = h('textarea', { rows: 4, value: k ? k.body : '', 'aria-label': t('cs_body') }), du = h('input', { type: 'date', value: k ? k.due : '', 'aria-label': t('cs_due') });
      const tasks = (k ? k.tasks : []).map((x) => Object.assign({}, x)), box = h('div', { class: 'cs-edit' });
      const draw = () => { clear(box); tasks.forEach((x, i) => add(box, h('div', { class: 'row' },
        h('select', { 'aria-label': t('cs_tasks'), onchange: (e) => { x.kind = e.target.value; if (x.kind !== 'libre' && !x.min) x.min = 1; draw(); } }, TASK_KINDS.map((kd) => h('option', { value: kd, selected: kd === x.kind }, ckLabel(kd)))),
        x.kind === 'libre' ? null : h('input', { type: 'number', min: 1, max: 20, value: x.min || 1, 'aria-label': t('cs_min'), title: t('cs_min'), style: 'width:70px', oninput: (e) => { x.min = e.target.value; } }),
        h('input', { type: 'number', min: 1, max: 60, value: x.day || '', placeholder: t('cs_day'), title: t('cs_day'), 'aria-label': t('cs_day'), style: 'width:70px', oninput: (e) => { x.day = e.target.value; } }),
        h('input', { type: 'text', value: x.text || '', placeholder: t('cs_task_text'), 'aria-label': t('cs_task_text'), style: 'flex:1 1 220px', oninput: (e) => { x.text = e.target.value; } }),
        h('button', { class: 'sm danger', 'aria-label': t('delete'), onclick: () => { tasks.splice(i, 1); draw(); } }, '✕')))); };
      draw();
      return h('div', { class: 'pb' }, h('div', { class: 'cols' }, field(t('cs_title_f'), ti), field(t('cs_due'), du)), field(t('cs_body'), bo), h('h3', { class: 'sec-h' }, t('cs_tasks')), box,
        h('p', { class: 'row' }, h('button', { onclick: () => { tasks.push({ kind: 'constantes', min: 1, text: '' }); draw(); } }, '+ ' + t('cs_add_task')),
          h('button', { class: 'pri', onclick: async () => { try { const body = { title: ti.value, body: bo.value, due: du.value, tasks }; if (k) await api('PUT', '/api/consignas/' + k.id, body); else await api('POST', '/api/patients/' + X.id + '/consignas', body); toast(t('cs_saved')); refresh(); } catch (e) { fail(e); } } }, t('save')),
          h('button', { onclick: refresh }, t('cs_cancel'))));
    };
    const show1 = (k) => h('div', { class: 'panel consigna' }, h('div', { class: 'ph' }, k.title, k.due ? h('span', { class: 'chip amb' }, t('cs_due_on') + ' ' + fmtD(k.due)) : null),
      h('div', { class: 'pb' }, k.body ? h('p', { class: 'cs-body' }, k.body) : null, k.tasks.length ? h('ul', { class: 'cs-tasks' }, k.tasks.map((x) => h('li', null, h('span', { class: 'ck', 'aria-hidden': 'true' }, x.kind === 'libre' ? '•' : '○'), ' ', x.day ? h('span', { class: 'chip' }, t('dy_d') + x.day) : null, x.day ? ' ' : null, x.text, h('span', { class: 'mut' }, ' · ' + ckLabel(x.kind) + (x.min > 1 ? ' ×' + x.min : ''))))) : null,
        h('p', { class: 'row' }, h('span', { class: 'mut' }, t('cs_link') + ':'), h('input', { type: 'text', readonly: true, value: HC.campus() + '/api/historia/sso?to=consigna/' + k.id, 'aria-label': t('cs_link'), style: 'flex:1 1 320px' }), h('button', { class: 'sm', onclick: async (e) => { const inp = e.target.previousSibling; try { await navigator.clipboard.writeText(inp.value); } catch (_) { inp.select(); document.execCommand('copy'); } toast(t('cs_copied')); } }, t('cs_copy'))),
        h('p', { class: 'row' }, h('button', { class: 'sm', onclick: () => { const holder = box1[k.id]; holder.replaceChildren(form(k)); } }, t('cs_edit')),
          h('button', { class: 'sm danger', onclick: async () => { if (!confirm(t('cs_confirm_del'))) return; try { await api('DELETE', '/api/consignas/' + k.id); refresh(); } catch (e) { fail(e); } } }, t('delete')))));
    const box1 = {}, wrap = (k) => (box1[k.id] = h('div', null, show1(k)));
    const nuevo = h('details', { class: 'panel' }, h('summary', null, '+ ' + t('cs_new')), form(null));
    return [h('p', { class: 'mut' }, t('cs_help')), consignas.length ? consignas.map(wrap) : panel(null, empty(t('cs_empty'))), nuevo];
  }

  /* ---------- clasificación de pacientes: asignaturas y temas ---------- */
  const subjTitle = (opt, slug) => (opt.subjects.find((x) => x.slug === slug) || { title: slug }).title;
  const classChips = (opt, p) => [(p.subjects || []).map((x) => h('span', { class: 'chip' }, subjTitle(opt, x))), (p.topics || []).map((x) => h('span', { class: 'chip tag' }, '#' + x))];
  async function classifyPanel(patient, refresh) {
    const opt = await api('GET', '/api/class-options'); const subs = new Set(patient.subjects || []); let topics = (patient.topics || []).slice();
    const tbox = h('div', { class: 'row' }), dl = h('datalist', { id: 'topic-list' }, opt.topics.map((x) => h('option', { value: x.name }))), inp = h('input', { type: 'text', list: 'topic-list', placeholder: t('cl_topics_ph'), 'aria-label': t('cl_topics'), style: 'max-width:240px' });
    const drawT = () => { clear(tbox); topics.forEach((x, i) => add(tbox, h('span', { class: 'chip tag' }, '#' + x, ' ', h('button', { class: 'link', 'aria-label': t('cl_remove') + ' ' + x, onclick: () => { topics.splice(i, 1); drawT(); } }, '✕')))); };
    const addT = () => { const v = inp.value.trim(); if (v && !topics.some((x) => x.toLowerCase() === v.toLowerCase())) { topics.push(v); drawT(); } inp.value = ''; };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addT(); } }); drawT();
    return h('details', { class: 'panel', open: !!((patient.subjects || []).length || (patient.topics || []).length) }, h('summary', null, t('cl_title'), ' ', classChips(opt, patient)),
      h('div', { class: 'pb' }, h('p', { class: 'mut' }, t('cl_help')), h('h3', { class: 'sec-h' }, t('cl_subjects')),
        opt.subjects.length ? h('div', { class: 'row' }, opt.subjects.map((x) => h('label', { class: 'row' }, h('input', { type: 'checkbox', checked: subs.has(x.slug), onchange: (e) => { e.target.checked ? subs.add(x.slug) : subs.delete(x.slug); } }), x.title))) : h('p', { class: 'mut' }, t('cl_none_sync')),
        h('h3', { class: 'sec-h' }, t('cl_topics')), tbox, h('p', { class: 'row' }, inp, dl, h('button', { onclick: addT }, t('cl_add'))),
        h('p', null, h('button', { class: 'pri', onclick: async () => { addT(); try { await api('PUT', '/api/patients/' + patient.id + '/classify', { subjects: [...subs], topics }); toast(t('cl_saved')); refresh(); } catch (e) { fail(e); } } }, t('save')))));
  }
  /* lista de pacientes con filtros por asignatura y tema, y clasificación de varios a la vez */
  async function viewPatients() {
    const [{ patients }, opt] = await Promise.all([api('GET', '/api/patients'), api('GET', '/api/class-options')]);
    const f = { q: '', subj: '', topic: '' }, sel = new Set(), table = h('div'), bar = h('div'), count = h('span', { class: 'mut' });
    const norm = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const visible = () => patients.filter((p) => {
      const d = p.data; if (f.subj === '__none' ? (p.subjects || []).length : f.subj && !(p.subjects || []).includes(f.subj)) return false;
      if (f.topic && !(p.topics || []).some((x) => x.toLowerCase() === f.topic.toLowerCase())) return false;
      return !f.q || norm([HC.name(d), p.code, d.nhc, d.diagnostico_medico, d.unidad, (p.topics || []).join(' ')].join(' ')).includes(norm(f.q));
    });
    const drawBar = () => {
      clear(bar); if (!sel.size) return;
      const ss = h('select', { 'aria-label': t('cl_pick_subj'), style: 'max-width:260px' }, h('option', { value: '' }, t('cl_pick_subj')), opt.subjects.map((x) => h('option', { value: x.slug }, x.title)));
      const ti = h('input', { type: 'text', list: 'topic-list-b', placeholder: t('cl_topics_ph'), 'aria-label': t('cl_topics'), style: 'max-width:200px' }), tl = h('datalist', { id: 'topic-list-b' }, opt.topics.map((x) => h('option', { value: x.name })));
      const go = (mode) => async () => { const sj = ss.value ? [ss.value] : [], tp = ti.value.trim() ? [ti.value.trim()] : []; if (!sj.length && !tp.length) return; try { await api('POST', '/api/patients/classify', { ids: [...sel], [mode + '_subjects']: sj, [mode + '_topics']: tp }); toast(t('cl_saved')); viewPatients(); } catch (e) { fail(e); } };
      add(bar, h('div', { class: 'panel' }, h('div', { class: 'pb row' }, h('b', null, t('cl_selected').replace('{n}', sel.size)), ss, ti, tl, h('button', { class: 'pri sm', onclick: go('add') }, t('cl_add')), h('button', { class: 'sm', onclick: go('remove') }, t('cl_remove')), h('button', { class: 'link', onclick: () => { sel.clear(); draw(); } }, t('cl_clear')))));
    };
    const draw = () => {
      const v = visible(); clear(table); count.textContent = t('cl_showing').replace('{a}', v.length).replace('{b}', patients.length); drawBar();
      if (!v.length) return add(table, panel(null, empty(patients.length ? t('cl_no_match') : t('patients_empty'))));
      const all = h('input', { type: 'checkbox', 'aria-label': t('select_all'), checked: v.every((p) => sel.has(p.id)), onchange: (e) => { v.forEach((p) => (e.target.checked ? sel.add(p.id) : sel.delete(p.id))); draw(); } });
      const rows = v.map((p) => { const d = p.data, age = HC.ageOf(d.fecha_nacimiento);
        return h('tr', { class: 'clk', onclick: () => { location.hash = '#/patient/' + p.id; } },
          h('td', { onclick: (e) => e.stopPropagation() }, h('input', { type: 'checkbox', 'aria-label': HC.name(d), checked: sel.has(p.id), onchange: (e) => { e.target.checked ? sel.add(p.id) : sel.delete(p.id); drawBar(); } })),
          h('td', null, h('a', { href: '#/patient/' + p.id, onclick: (e) => e.stopPropagation() }, HC.name(d)), h('div', { class: 'sub' }, d.nhc || p.code)),
          h('td', null, h('div', { class: 'tags' }, classChips(opt, p))), h('td', null, (age !== '' ? age + ' ' + t('age_years') : '') + (d.sexo ? ' / ' + t('sex_' + d.sexo) : '')),
          h('td', null, d.diagnostico_medico || ''), h('td', { class: 'r' }, p.charts), h('td', { class: 'r' }, p.records), h('td', null, p.archived ? h('span', { class: 'chip amb' }, t('archived')) : h('span', { class: 'chip grn' }, t('status_open')))); });
      add(table, panel(null, h('div', { class: 'tw' }, h('table', { class: 'grid' }, h('thead', null, h('tr', null, h('th', null, all), [t('col_patient'), t('col_class'), t('col_age'), t('col_dx'), t('col_students'), t('col_records'), t('col_state')].map((x, i) => h('th', { class: i === 4 || i === 5 ? 'r' : '' }, x)))), h('tbody', null, rows))), { flush: true }));
    };
    const search = h('input', { type: 'search', placeholder: t('cl_search'), 'aria-label': t('cl_search'), oninput: (e) => { f.q = e.target.value; draw(); } });
    const ss = h('select', { 'aria-label': t('cl_subjects'), onchange: (e) => { f.subj = e.target.value; draw(); } }, h('option', { value: '' }, t('cl_all_subj')), h('option', { value: '__none' }, t('cl_unclassified')), opt.subjects.map((x) => h('option', { value: x.slug }, x.title)));
    const ts = h('select', { 'aria-label': t('cl_topics'), onchange: (e) => { f.topic = e.target.value; draw(); } }, h('option', { value: '' }, t('cl_all_topics')), opt.topics.map((x) => h('option', { value: x.name }, x.name + ' (' + x.count + ')')));
    draw();
    HC.show(h('div', { class: 'pg-title' }, h('h1', null, t('worklist')), h('div', { class: 'row' }, h('button', { onclick: () => { location.hash = '#/import'; } }, t('imp_btn')), h('button', { class: 'pri', onclick: () => { location.hash = '#/patient/new'; } }, '+ ' + t('new_patient')))),
      patients.length ? h('div', { class: 'toolbar row' }, search, ss, ts, count) : null, bar, table);
  }

  /* ---------- el caso en PDF ---------- */
  function casePdfBar(id) {
    const day = h('input', { type: 'number', min: 1, max: 60, value: 1, style: 'width:70px', 'aria-label': t('pdf_day') });
    const link = (full, label, cls) => h('a', { class: 'btn ' + (cls || ''), download: '', href: '#', onclick: (e) => { e.currentTarget.href = '/api/patients/' + id + '/case.pdf?lang=' + lang().toUpperCase() + (full ? '&full=1' : '&day=' + (parseInt(day.value, 10) || 1)); } }, label);
    return h('div', { class: 'panel' }, h('div', { class: 'pb' }, h('div', { class: 'row' }, h('b', null, t('pdf_case') + ':'), link(false, t('pdf_students'), 'pri'), h('label', { class: 'row' }, t('pdf_day'), day), link(true, t('pdf_full'))), h('p', { class: 'mut' }, t('pdf_help'))));
  }

  /* ---------- ritmo por días ---------- */
  /* alumno: «Día N de M» y botón para terminar el día (con aviso si quedan tareas de ese día) */
  function dayBar(c, refresh) {
    const ch = c.chart; if (ch.pace !== 'student' || HC.role() === 'admin' || HC.role() === 'teacher') return null;
    const last = ch.day >= ch.cap, k = c.consigna, pending = k ? k.tasks.filter((x) => x.day === ch.day && x.done === false) : [];
    const btn = !last && ch.status === 'open' ? h('button', { class: 'pri', onclick: async () => {
      const msg = t('dy_confirm').replace(/\{n\}/g, ch.day).replace('{m}', ch.day + 1) + (pending.length ? '\n\n' + t('dy_pending') + '\n- ' + pending.map((x) => x.text).join('\n- ') : '');
      if (!confirm(msg)) return;
      try { await api('POST', '/api/charts/' + ch.id + '/advance'); toast(t('dy_now').replace('{n}', ch.day + 1)); refresh(); } catch (e) { fail(e); }
    } }, t('dy_finish').replace('{n}', ch.day)) : null;
    return h('div', { class: 'panel daybar' }, h('div', { class: 'pb row' }, h('b', null, t('dy_title').replace('{n}', ch.day).replace('{m}', ch.cap)), last ? h('span', { class: 'chip grn' }, t('dy_last')) : null, btn, ch.status === 'open' ? h('span', { class: 'mut' }, t('dy_help')) : null));
  }
  /* profesorado: ritmo de una historia y último día */
  function paceControl(chartId, chart, refresh) {
    const sel = h('select', { 'aria-label': t('pace_title') }, [['teacher', t('pace_teacher')], ['student', t('pace_student')]].map(([v, l]) => h('option', { value: v, selected: (chart.pace || 'teacher') === v }, l)));
    const cap = h('input', { type: 'number', min: 1, max: 60, value: chart.max_day || '', placeholder: t('pace_auto') + ' (' + chart.cap + ')', 'aria-label': t('pace_cap'), style: 'width:170px' });
    return h('details', { class: 'win' }, h('summary', null, t('pace_title') + ': ' + (chart.pace === 'student' ? t('pace_student_short') + ' · ' + t('day_case') + ' ' + chart.day + '/' + chart.cap : t('pace_teacher_short'))),
      h('div', { class: 'row' }, h('label', { class: 'row' }, t('pace_title'), sel), h('label', { class: 'row' }, t('pace_cap'), cap),
        h('button', { class: 'sm pri', onclick: async () => { try { await api('PUT', '/api/charts/' + chartId, { pace: sel.value, max_day: cap.value || null }); toast(t('pace_saved')); refresh(); } catch (e) { fail(e); } } }, t('pace_save'))),
      h('p', { class: 'mut' }, t('pace_help')));
  }

  /* ---------- fechas de acceso de una historia ---------- */
  function windowControl(chartId, chart, refresh) {
    const f = h('input', { type: 'date', value: chart.opens || '', 'aria-label': t('win_from') }), u = h('input', { type: 'date', value: chart.closes || '', 'aria-label': t('win_to') });
    return h('details', { class: 'win' }, h('summary', null, chart.opens || chart.closes ? t('win_from') + ' ' + (chart.opens ? fmtD(chart.opens) : '—') + ' · ' + t('win_to') + ' ' + (chart.closes ? fmtD(chart.closes) : '—') : t('win_from') + ' / ' + t('win_to')),
      h('div', { class: 'row' }, h('label', { class: 'row' }, t('win_from'), f), h('label', { class: 'row' }, t('win_to'), u), h('button', { class: 'sm pri', onclick: async () => { try { await api('PUT', '/api/charts/' + chartId, { opens: f.value, closes: u.value }); toast(t('win_saved')); refresh(); } catch (e) { fail(e); } } }, t('win_save'))),
      h('p', { class: 'mut' }, t('win_help')));
  }

  /* ---------- seguimiento: qué ha hecho cada alumno o grupo ---------- */
  const grade10 = (g) => (g ? String(g.total).replace('.', ',') + (g.published ? '' : '*') : '—');
  async function seguimientoTab(X) {
    const { groups } = await api('GET', '/api/patients/' + X.id + '/seguimiento');
    if (!groups.length) return panel(null, empty(t('seg_empty')));
    const ticks = (p) => p.map((x) => (x.done == null ? '•' : x.done ? '✓' : '○')).join(' ');
    return [h('p', { class: 'mut' }, t('seg_help')), groups.map((g) => panel(g.consigna ? g.consigna.title + (g.consigna.due ? ' · ' + t('cs_due_on') + ' ' + fmtD(g.consigna.due) : '') : t('seg_none'),
      h('div', { class: 'tw' }, h('table', { class: 'grid' }, h('thead', null, h('tr', null, [t('col_chart'), t('seg_students'), t('seg_tasks'), t('seg_records'), t('seg_last'), t('seg_grade'), ''].map((x, i) => h('th', { class: i === 3 ? 'r' : '' }, x)))),
        h('tbody', null, g.charts.map((c) => h('tr', null,
          h('td', null, h('a', { href: '#/chart/' + c.id }, c.name || '#' + c.id), h('div', { class: 'sub' }, c.kind === 'team' ? t('team') : t('individual')), c.pace === 'student' ? h('div', null, h('span', { class: 'chip' }, t('dy_title').replace('{n}', c.day).replace('{m}', c.cap))) : null, c.window === 'scheduled' ? h('div', null, h('span', { class: 'chip' }, t('win_from_on').replace('{d}', fmtD(c.opens)))) : c.window === 'ended' ? h('div', null, h('span', { class: 'chip amb' }, t('win_ended_on').replace('{d}', fmtD(c.closes)))) : null),
          h('td', null, c.members.map((m) => h('div', null, h('a', { href: '#/student/' + m.id }, m.name), h('span', { class: 'mut' }, ' · ' + m.records)))),
          h('td', null, g.consigna ? h('span', null, ticks(c.progress), ' ', h('span', { class: 'mut' }, c.progress.filter((x) => x.done).length + '/' + c.progress.filter((x) => x.done != null).length)) : '—'),
          h('td', { class: 'r' }, c.records), h('td', null, c.last ? fmtDT(c.last) : '—'),
          h('td', null, c.members.map((m) => h('div', null, grade10(m.grade)))),
          h('td', null, h('div', { class: 'row' }, h('button', { class: 'sm', onclick: () => { location.hash = '#/chart/' + c.id; } }, t('seg_open')), h('button', { class: 'sm', onclick: () => { location.hash = '#/chart/' + c.id + '/eval'; } }, t('seg_eval'))))))))),
      { flush: true })), h('p', { class: 'mut' }, '* ' + t('unpublished'))];
  }

  /* ---------- borrar datos del alumnado ---------- */
  function cleanupPanel(opts) {
    let scope = opts.scope, pid = opts.pid || '', counts = null;
    const info = h('p', { class: 'mut', role: 'status' }), word = h('input', { type: 'text', autocomplete: 'off', 'aria-label': t('cu_type'), placeholder: t('cu_type') });
    const gr = h('input', { type: 'checkbox', checked: true }), ch = h('input', { type: 'checkbox' }), btn = h('button', { class: 'danger', disabled: true }, t('cu_btn'));
    const targetId = () => (scope === 'student' ? opts.id : scope === 'patient' ? pid : '');
    const load = async () => { counts = null; btn.disabled = true; info.textContent = ''; if (scope === 'patient' && !pid) return; try { counts = await api('GET', '/api/cleanup?scope=' + scope + '&id=' + targetId()); info.textContent = t('cu_counts').replace('{r}', counts.records).replace('{c}', counts.comments).replace('{g}', counts.grades).replace('{h}', counts.charts); btn.disabled = false; } catch (e) { fail(e); } };
    const sel = opts.choices ? h('select', { 'aria-label': t('cu_title'), onchange: (e) => { scope = e.target.value; pSel.hidden = scope !== 'patient'; load(); } }, opts.choices.map(([v, l]) => h('option', { value: v }, l))) : null;
    const pSel = h('select', { 'aria-label': t('cu_pick'), hidden: scope !== 'patient', onchange: (e) => { pid = e.target.value; load(); } }, h('option', { value: '' }, t('cu_pick')), (opts.patients || []).map((p) => h('option', { value: p.id }, p.code + ' ' + ((p.data.apellidos || '') + ' ' + (p.data.nombre || '')).trim())));
    btn.onclick = async () => { try { await api('POST', '/api/cleanup', { scope, id: targetId(), confirm: word.value, grades: gr.checked, charts: ch.checked }); toast(t('cu_done')); word.value = ''; (opts.refresh || (() => {}))(); load(); } catch (e) { fail(e); } };
    if (!sel) load();
    return h('details', { class: 'panel danger-zone' }, h('summary', null, t('cu_title')), h('div', { class: 'pb' }, h('p', { class: 'mut' }, t('cu_help')),
      sel ? h('p', { class: 'row' }, sel, pSel) : null, info, h('div', { class: 'row' }, h('label', { class: 'row' }, gr, t('cu_grades')), h('label', { class: 'row' }, ch, t('cu_charts'))),
      h('p', { class: 'row' }, word, btn)));
  }
  function dataPanel(patients) {
    return h('details', { class: 'panel' }, h('summary', null, t('stu_zip') + ' · ' + t('cu_title')), h('div', { class: 'pb' },
      h('p', { class: 'mut' }, t('stu_zip_help')), h('p', null, h('a', { class: 'btn', href: '/api/reports.zip?lang=' + lang().toUpperCase(), download: '' }, t('stu_zip'))),
      cleanupPanel({ scope: HC.role() === 'admin' ? 'all' : 'patient', choices: (HC.role() === 'admin' ? [['all', t('cu_all')]] : []).concat([['patient', t('cu_patient')]]), patients })));
  }

  /* ---------- ficha de un alumno: su trabajo y su informe ---------- */
  async function viewStudent(id) {
    const w = await api('GET', '/api/students/' + id + '/work');
    const rows = w.charts.map((c) => h('tr', null, h('td', null, h('a', { href: '#/chart/' + c.id }, c.patient), h('div', { class: 'sub' }, c.code + (c.name ? ' · ' + c.name : ''))),
      h('td', null, c.consigna ? [c.consigna.title, h('div', { class: 'sub' }, c.consigna.total ? c.consigna.done + '/' + c.consigna.total : '')] : '—'), h('td', { class: 'r' }, c.records), h('td', null, c.last ? fmtDT(c.last) : '—'), h('td', null, grade10(c.grade)),
      h('td', null, c.window === 'scheduled' ? h('span', { class: 'chip' }, t('win_from_on').replace('{d}', fmtD(c.opens))) : c.window === 'ended' ? h('span', { class: 'chip amb' }, t('win_ended_on').replace('{d}', fmtD(c.closes))) : h('span', { class: 'chip ' + (c.status === 'open' ? 'grn' : 'amb') }, c.status === 'open' ? t('status_open') : t('status_closed'))),
      h('td', null, h('button', { class: 'sm', onclick: () => { location.hash = '#/chart/' + c.id; } }, t('seg_open')))));
    HC.show(h('div', { class: 'pg-title' }, h('button', { class: 'link', onclick: () => { history.length > 1 ? history.back() : (location.hash = '#/students'); } }, t('back')),
      h('a', { class: 'btn pri', href: '/api/students/' + id + '/report.pdf?lang=' + lang().toUpperCase(), download: '' }, t('stu_pdf'))),
      h('h1', null, t('stu_title') + ' ' + w.user.name), h('p', { class: 'mut' }, w.user.email),
      w.charts.length ? panel(null, h('div', { class: 'tw' }, h('table', { class: 'grid' }, h('thead', null, h('tr', null, [t('stu_patient'), t('stu_activity'), t('seg_records'), t('seg_last'), t('seg_grade'), t('stu_state'), ''].map((x, i) => h('th', { class: i === 2 ? 'r' : '' }, x)))), h('tbody', null, rows))), { flush: true }) : panel(null, empty(t('stu_none'))),
      h('p', { class: 'mut' }, '* ' + t('unpublished')),
      cleanupPanel({ scope: 'student', id, refresh: () => viewStudent(id) }));
  }

  function previewControl(chartId) {
    const go = (profile) => async () => { try { await api('POST', '/api/charts/' + chartId + '/preview', { profile }); location.hash = '#/chart/' + chartId; location.reload(); } catch (e) { fail(e); } };
    return h('span', { class: 'row', role: 'group', 'aria-label': t('prev_btn') }, h('span', { class: 'mut' }, t('prev_btn') + ':'), h('button', { class: 'sm', onclick: go('enfermeria') }, t('p_enfermeria')), h('button', { class: 'sm', onclick: go('tcae') }, t('p_tcae')));
  }
  function teachersPanel(list, refresh) {
    const nm = h('input', { type: 'text', 'aria-label': t('t_name'), placeholder: t('t_name') }), em = h('input', { type: 'email', 'aria-label': t('t_email'), placeholder: t('t_email'), autocomplete: 'off' }), pw = h('input', { type: 'password', 'aria-label': t('t_pw'), placeholder: t('t_pw'), autocomplete: 'new-password' });
    const rows = list.filter((u) => u.active).map((u) => h('tr', null, h('td', null, u.name, h('div', { class: 'sub' }, u.email)), h('td', null, u.last_login ? fmtISO(u.last_login) : '—'),
      h('td', { class: 'r' }, h('button', { class: 'sm danger', onclick: async () => { try { await api('DELETE', '/api/teachers/' + u.id); refresh(); } catch (e) { fail(e); } } }, t('t_remove')))));
    return h('details', { class: 'panel' }, h('summary', null, t('teachers_h'), ' ', h('span', { class: 'chip' }, rows.length)), h('div', { class: 'pb' }, h('p', { class: 'mut' }, t('teachers_help')),
      rows.length ? h('div', { class: 'tw' }, h('table', { class: 'grid' }, h('tbody', null, rows))) : h('p', { class: 'mut' }, t('t_none')),
      h('div', { class: 'cols' }, nm, em, pw), h('p', null, h('button', { class: 'pri', onclick: async () => { try { await api('POST', '/api/teachers', { name: nm.value, email: em.value, password: pw.value }); toast(t('t_added')); refresh(); } catch (e) { fail(e); } } }, t('t_add')))));
  }

  window.HCX = { dayBar, paceControl, balanceChart, viewImport, viewPatients, classifyPanel, casePdfBar, viewStudent, dataPanel, windowControl, consignaCard, consignaControl, previewControl, teachersPanel, forms, summary, extraTabs, chartTab, vitalCharts, balanceShifts, patientTab, printView, viewGrades, dayControl };
})();
