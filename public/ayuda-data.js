/* Ayuda de Historia clínica: guía del alumnado y guía del profesorado, en castellano y catalán.
   Los textos son propios y de confianza (se insertan como HTML). Bloques: lead, h2, p, leg, box, flow, faq, img. */
window.HC_HELP = {
  es: {
    ui: { tip: 'Consejo', warn: 'Ojo', print: 'Imprimir / guardar PDF', student: 'Alumnado', teacher: 'Profesorado', toc: 'En esta guía' },
    student: {
      title: 'Guía del alumnado', subtitle: 'Cómo registrar tu trabajo con el paciente simulado, paso a paso',
      sections: [
        ['1 · Qué es la Historia clínica', [
          ['lead', 'Una aplicación para practicar como en un hospital: cuidas a un <b>paciente simulado</b> (ficticio) y vas anotando lo que haces —constantes, medicación, cuidados, valoraciones— en su historia clínica. Funciona en el ordenador y en el móvil.'],
          ['leg', [
            ['✓', '<b>Todo es ficticio.</b> Los pacientes y sus datos están inventados con fines docentes.'],
            ['✓', '<b>Lo que escribes queda guardado</b> con tu nombre y la hora, como en una historia real. No se borra: si te equivocas, lo <b>anulas</b> y lo corriges (ver sección 7).'],
            ['✓', '<b>Tu profesor lo revisa</b> y puede dejarte comentarios y una nota.'],
            ['✓', '<b>Idioma:</b> catalán o castellano; cámbialo con el botón <b>CA / ES</b> de la barra superior.'],
          ]],
          ['h2', 'El recorrido en un vistazo'],
          ['flow', [['1', 'Entra', 'Desde el Campus, sin otra contraseña'], ['2', 'Abre tu historia', 'En «Mis pacientes»'], ['3', 'Lee la consigna', 'Qué se te pide y hasta cuándo'], ['4', 'Registra', 'Constantes, medicación, cuidados…'], ['5', 'Consulta tu nota', 'Cuando tu profesor la publique']]],
        ]],
        ['2 · Cómo entrar', [
          ['p', 'No tienes que crear ninguna cuenta ni recordar otra contraseña. Entra en el <b>Campus</b>, abre la <b>asignatura</b> y pulsa el botón <b>«Abrir la historia clínica»</b> (también hay un botón <b>Historia clínica</b> en «Mi espacio»). Te identifica automáticamente.'],
          ['box', 'tip', 'Si ves «Enlace de acceso no válido o caducado», vuelve a entrar desde el Campus: cada enlace de acceso funciona una sola vez y caduca en un minuto.'],
          ['box', 'warn', 'Si el Campus te dice que estás «suplantando a un alumno», sal de la vista «Ver como alumno» (es una herramienta del profesorado).'],
        ]],
        ['3 · Mis pacientes', [
          ['lead', 'Al entrar ves la lista de pacientes que tu profesor te ha asignado. Pulsa uno para abrir <b>tu historia</b>.'],
          ['img', 's-lista', 0.95],
          ['leg', [
            ['✓', '<b>Individual o de equipo:</b> la etiqueta «Individual» o «Equipo» te dice si trabajas solo o con compañeros (en equipo veis los registros de todos).'],
            ['✓', '<b>Consigna:</b> debajo del paciente aparece la actividad y cuántas tareas llevas hechas (por ejemplo 2/4).'],
            ['✓', '<b>«Disponible desde…»:</b> la historia aún no está abierta. Se activará sola en esa fecha.'],
            ['✓', '<b>«Finalizada»:</b> ya pasó la fecha de fin. Puedes consultarla, pero no registrar más.'],
          ]],
        ]],
        ['4 · La consigna: tu actividad', [
          ['lead', 'Arriba de la historia está la <b>consigna</b>: lo que tienes que hacer, la fecha de entrega (si la hay) y una lista de tareas.'],
          ['img', 's-historia', 0.95],
          ['leg', [
            ['✓', 'Las tareas con <b>✓</b> se marcan solas cuando haces el registro que piden (por ejemplo, dos tomas de constantes). No hay que avisar a nadie.'],
            ['✓', 'Las tareas con <b>•</b> («libres») no se comprueban solas: las valorará tu profesor.'],
            ['✓', 'Si una tarea lleva una etiqueta <b>Día 2</b>, hay que hacerla ese día; la del día en que estás aparece resaltada.'],
            ['✓', 'Puedes plegar la consigna con la flecha para ganar espacio.'],
          ]],
        ]],
        ['5 · La historia del paciente', [
          ['p', 'La franja superior resume al paciente: edad, ubicación, <b>alergias (en rojo)</b>, <b>aislamiento</b> y dieta. Mírala siempre antes de actuar. Debajo están las pestañas:'],
          ['leg', [
            ['•', '<b>Resumen:</b> datos del ingreso, últimas constantes y última nota.'],
            ['•', '<b>Evolución, Constantes, Balance hídrico, Cuidados:</b> tus registros, en tabla y con gráficas.'],
            ['•', '<b>Medicación:</b> la hoja de administración con las prescripciones.'],
            ['•', '<b>Escalas, Valoración, Plan de cuidados, Informe:</b> el trabajo propio de enfermería.'],
            ['•', '<b>Pruebas y evolución:</b> resultados y sucesos que ocurren en el caso.'],
            ['•', '<b>Ficha:</b> todos los datos del paciente.'],
          ]],
          ['box', 'tip', '<b>El «día del caso».</b> El caso avanza por días y cada día trae pruebas, sucesos y prescripciones nuevos. Según cómo lo haya preparado tu profesor, <b>él</b> va liberando los días o <b>tú</b> avanzas por días (ver abajo). Si algo no aparece todavía, es que aún no toca.'],
          ['h2', 'Si trabajas por días'],
          ['leg', [
            ['✓', 'Arriba de la historia verás <b>«Día 2 de 5»</b> y el botón <b>«Terminar el día 2»</b>. Registra lo de ese día y pulsa el botón cuando acabes.'],
            ['✓', 'Al pulsar te avisamos de lo que te queda pendiente de ese día. Es solo un aviso: puedes seguir igualmente.'],
            ['✓', 'Al pasar al día siguiente aparecen las pruebas, sucesos y prescripciones nuevos. <b>Los días terminados quedan cerrados</b>: puedes verlos, pero ya no añadir ni corregir registros. Solo tu profesor puede reabrirlos.'],
            ['✓', 'La fecha de cada registro es la del día del caso: tú solo eliges la hora.'],
          ]],
        ]],
        ['6 · Qué puedes registrar', [
          ['img', 's-form', 0.95],
          ['leg', [
            ['✓', '<b>Nota de evolución:</b> lo que observas y haces (turno y tipo: evolución, incidencia, educación, traspaso).'],
            ['✓', '<b>Constantes:</b> tensión, frecuencia cardiaca y respiratoria, temperatura, saturación, glucemia, dolor. Los valores fuera de rango se marcan solos.'],
            ['✓', '<b>Balance hídrico:</b> ingestas y eliminaciones en ml; se suman por día y por turno.'],
            ['✓', '<b>Cuidado realizado:</b> eliges la acción de una lista (higiene, movilización, aislamiento…) y su resultado.'],
            ['✓', '<b>Medicación:</b> en la pestaña «Medicación» pulsas la hora de la pauta y confirmas los <b>cinco correctos</b> (paciente, fármaco, dosis, vía y hora) antes de registrar.'],
            ['✓', '<b>Escalas:</b> Barthel, Braden, Norton, Glasgow y Downton; la puntuación y el nivel se calculan solos.'],
            ['✓', '<b>Valoración por patrones</b> (Gordon), <b>plan de cuidados</b> (problema, causa, objetivo, intervenciones y su evaluación) e <b>informe</b> de alta o de traspaso.'],
          ]],
          ['box', 'warn', '<b>Perfil Enfermería o TCAE.</b> Según tu asignatura, la aplicación te asigna un perfil. El perfil TCAE (auxiliar) registra constantes, balance, notas, cuidados y medicación <b>solo por vía oral o tópica</b>; la valoración, las escalas, el plan de cuidados y el informe son de enfermería. Lo que no puedes hacer no aparece o se rechaza con un aviso.'],
        ]],
        ['7 · Si te equivocas', [
          ['p', 'Un registro no se edita ni se borra, igual que en una historia real. En su fila tienes dos botones:'],
          ['leg', [
            ['✓', '<b>Anular:</b> escribes el motivo y el registro queda tachado, visible pero sin valor.'],
            ['✓', '<b>Corregir:</b> abre un formulario con los datos para crear uno nuevo; el original queda señalado como sustituido.'],
            ['✓', 'Tu profesor puede dejar <b>comentarios</b> bajo un registro; los verás bajo el registro.'],
          ]],
        ]],
        ['8 · Tu nota', [
          ['p', 'Cuando tu profesor publique la nota, la verás en la pestaña <b>Evaluación</b> de tu historia, con la puntuación de cada criterio y su comentario. Mientras no la publique, no se ve. También puede aparecer en las notas del Campus.'],
        ]],
        ['9 · Imprimir o guardar tu trabajo', [
          ['p', 'En la pestaña Resumen, el botón <b>«Imprimir / guardar PDF»</b> prepara toda tu historia lista para imprimir; en el cuadro de impresión de tu navegador elige «Guardar como PDF».'],
        ]],
        ['10 · Si algo falla', [
          ['faq', [
            ['No me aparece ningún paciente', 'Todavía no te han asignado ninguno, o es de otro grupo. Avisa a tu profesor.'],
            ['La historia sale bloqueada con «Disponible desde…»', 'Es normal: se abrirá sola en esa fecha.'],
            ['No puedo registrar nada', 'Puede que la historia esté cerrada o finalizada (solo lectura), o que esa acción sea de enfermería y tu perfil sea TCAE.'],
            ['Me equivoqué en un valor', 'Usa «Anular» con el motivo y «Corregir» para escribir el correcto (sección 7).'],
            ['No puedo corregir un registro de un día anterior', 'Si trabajas por días, los días terminados están cerrados. Pídele a tu profesor que reabra ese día.'],
            ['Me sale que mi acceso está desactivado', 'Pídele a tu profesor que lo reactive.'],
            ['Las cosas salen en otro idioma', 'Cambia el idioma con el botón CA / ES de la barra superior. Los datos del paciente están escritos en el idioma que eligió tu profesor.'],
          ]],
        ]],
      ],
    },
    teacher: {
      title: 'Guía del profesorado', subtitle: 'Cómo preparar un caso, asignarlo, corregirlo y llevar las notas al Campus',
      sections: [
        ['1 · Visión general', [
          ['lead', 'Historia clínica es una aplicación aparte, conectada al Campus: el alumnado entra con un clic desde su asignatura y el profesorado trabaja aquí. Un <b>paciente</b> (el caso) puede usarse en varias <b>actividades</b> (consignas) y en varias asignaturas.'],
          ['flow', [['1', 'Prepara el caso', 'Crea o importa un paciente'], ['2', 'Escribe la consigna', 'Qué debe hacer el alumnado'], ['3', 'Asigna', 'A alumnos o equipos, con fechas'], ['4', 'Sigue y corrige', 'Seguimiento y evaluación'], ['5', 'Lleva las notas', 'Al Campus, por actividad']]],
          ['box', 'tip', 'Para ver cómo queda sin preparar nada, entra en <b>Pacientes → Importar caso</b> y pulsa «Ejemplo en catalán» o «Ejemplo en castellano»: crea una paciente completa con consignas y registros de muestra.'],
        ]],
        ['2 · Primera puesta en marcha', [
          ['leg', [
            ['✓', '<b>En el Campus,</b> en Editar asignatura → «Herramientas y opciones», marca <b>«Historia clínica simulada»</b> en cada asignatura donde quieras que el alumnado vea el acceso.'],
            ['✓', '<b>Aquí,</b> en <b>Alumnado → Sincronizar alumnado del Campus</b>: trae al alumnado y sus asignaturas (y las unidades RA/UD para las notas). Repítelo cuando haya altas nuevas.'],
            ['✓', '<b>Perfil Enfermería / TCAE:</b> se asigna solo según la asignatura («Perfil según asignatura del Campus»). Puedes cambiarlo alumno a alumno.'],
            ['✓', '<b>Más profesorado:</b> solo la administración, en Alumnado → Profesorado, con correo y contraseña propios. Entran desde el inicio de sesión rellenando su correo.'],
          ]],
          ['box', 'warn', 'No se puede dar acceso de profesorado a un alumno desde la lista de alumnado. Las cuentas de profesorado son aparte.'],
        ]],
        ['3 · Crear pacientes', [
          ['lead', 'Tres formas: a mano, importando un caso escrito por una IA, o con el caso de ejemplo.'],
          ['img', 't-importar', 0.95],
          ['leg', [
            ['✓', '<b>A mano:</b> «+ Nuevo paciente». La ficha lleva filiación, ingreso, antecedentes, alergias, <b>tipo de aislamiento</b> (contacto, gotas, aérea, protector), dieta, riesgos y dos campos <b>solo para profesorado</b>: notas del docente y objetivos de aprendizaje.'],
            ['✓', '<b>Importar con IA:</b> «Importar caso». Elige el idioma de la plantilla, <b>copia la plantilla</b> (rellena antes los cuatro datos: tema, nivel, idioma y duración), pásasela a tu IA, pega lo que te devuelva y pulsa <b>Revisar</b>. Te marca los errores por línea; si todo está bien, <b>Crear caso</b>. El texto puede estar en catalán o castellano.'],
            ['✓', 'La plantilla pide la ficha, alergias, prescripciones, <b>consignas</b>, pruebas y eventos por día y los <b>temas</b>. Puedes dejar vacío lo que no quieras.'],
          ]],
          ['box', 'tip', 'Un caso se puede reutilizar tantas veces como quieras con consignas distintas; no hace falta duplicar el paciente.'],
        ]],
        ['4 · Clasificar los pacientes', [
          ['p', 'Cada paciente puede pertenecer a una o varias <b>asignaturas</b> del Campus y llevar <b>temas</b> (etiquetas libres como Respiratorio o Aislamiento).'],
          ['img', 't-lista', 0.95],
          ['leg', [
            ['✓', '<b>Uno a uno:</b> en la pestaña Ficha, panel «Clasificación».'],
            ['✓', '<b>En bloque:</b> marca varios pacientes en la lista, elige la asignatura o escribe el tema y pulsa Añadir o Quitar.'],
            ['✓', '<b>Filtros:</b> buscador, asignatura (con «Sin clasificar») y tema. Los pacientes que ya tenías aparecen sin clasificar.'],
          ]],
        ]],
        ['5 · Prescripciones y línea temporal', [
          ['leg', [
            ['✓', '<b>Prescripciones</b> (pestaña del paciente): fármaco, dosis, vía, pauta, horas, desde/hasta qué día y «si precisa». El alumnado las administra en la hoja de medicación con los cinco correctos.'],
            ['✓', '<b>Línea temporal:</b> pruebas (analíticas, radiografías…) y eventos (fiebre, caída…) con el <b>día del caso</b> en que ocurren.'],
            ['✓', '<b>Día del caso:</b> cada historia tiene un contador (− / +). El alumnado solo ve lo que ya toca por día; tú lo ves todo, con la marca «se libera el día N». Si prefieres que cada alumno avance a su ritmo, usa el <b>ritmo por días</b> (sección 7).'],
          ]],
        ]],
        ['6 · Consignas (actividades)', [
          ['lead', 'La consigna es lo que se pide al alumnado con ese paciente. Un mismo paciente puede tener varias.'],
          ['img', 't-consignas', 0.95],
          ['leg', [
            ['✓', 'Cada consigna tiene <b>título, enunciado</b>, fecha de entrega opcional y <b>tareas</b>.'],
            ['✓', 'Cada tarea es de un <b>tipo</b> (nota, constantes, balance, cuidado, medicación, escala, valoración, plan, informe) con un mínimo de registros, y <b>se marca sola</b> cuando el alumno los hace. El tipo «libre» no se comprueba. Cada tarea puede llevar un <b>día</b> (1, 2…): entonces solo cuentan los registros hechos ese día.'],
            ['✓', 'Al pie de cada consigna tienes un <b>enlace para el Campus</b> que lleva al alumno directamente a su historia de esa actividad: pégalo como material o en el enunciado de una tarea o cuestionario.'],
          ]],
        ]],
        ['7 · Asignar a alumnos o equipos', [
          ['img', 't-asignar', 0.95],
          ['leg', [
            ['✓', 'Pestaña <b>Asignación</b>: elige el modo (<b>individual</b>, una historia por alumno, o <b>equipo</b>), la <b>consigna</b>, y marca al alumnado (filtra por asignatura o busca).'],
            ['✓', '<b>Disponible desde / Hasta:</b> programa el acceso (vacío = sin límite). Antes de la fecha el alumno ve la historia bloqueada; después del fin puede consultarla pero no registrar. Se puede cambiar luego en la propia historia.'],
            ['✓', '<b>Ritmo:</b> «Lo marca el profesor» (tú mueves el día del caso; ideal en clase) o «Por días: lo marca el alumno» (cada alumno o equipo pulsa «Terminar el día N» y pasa al siguiente). Puedes fijar el <b>último día</b>; si no, es el de la última prueba o prescripción. Lo cambias después en el desplegable «Ritmo» de la historia.'],
            ['✓', '<b>Días cerrados:</b> en el modo por días, los días terminados quedan cerrados para el alumno (ni añadir ni corregir). Para <b>reabrir un día</b>, retrocede el «Día del caso» con − en su historia: el alumno vuelve a ese día. En Seguimiento ves en qué día va cada uno.'],
            ['✓', '<b>Cerrar una historia</b> la deja en solo lectura cuando quieras (pestaña Historias del paciente).'],
          ]],
        ]],
        ['8 · Seguimiento y corrección', [
          ['lead', '¿Qué ha hecho cada alumno o grupo? Tres sitios:'],
          ['img', 't-seguimiento', 0.95],
          ['leg', [
            ['✓', '<b>Pestaña Seguimiento</b> del paciente: por consigna, quién ha hecho qué (tareas ✓ ○), registros, última actividad y nota. Botones «Abrir» y «Evaluar».'],
            ['✓', '<b>Alumnado → Ver trabajo:</b> la ficha de un alumno con todas sus historias, progreso y nota.'],
            ['✓', '<b>Dentro de una historia:</b> lees todos los registros (filtra por miembro en los equipos), <b>comentas</b> cualquier registro y, en la pestaña <b>Evaluación</b>, puntúas con la rúbrica.'],
          ]],
          ['box', 'tip', 'Como profesor <b>no escribes registros</b> en una historia: solo lees, comentas y evalúas.'],
        ]],
        ['9 · Evaluar con la rúbrica', [
          ['leg', [
            ['✓', 'La <b>rúbrica</b> se edita en la pestaña <b>Notas</b>: criterios con peso y puntuación de 0 a 4. La nota es de 0 a 10, ponderada.'],
            ['✓', 'En cada historia, <b>Evaluación</b>: puntúas cada criterio, escribes un comentario y marcas <b>«Publicada»</b> para que el alumno la vea. Sin publicar, solo la ves tú.'],
            ['✓', '<b>Exportar notas (CSV)</b> desde la pestaña Notas.'],
          ]],
        ]],
        ['10 · Llevar las notas al Campus', [
          ['img', 't-notas', 0.95],
          ['leg', [
            ['✓', 'En <b>Notas → Enviar al Campus</b> hay un panel por <b>actividad</b>: todas las historias con la misma consigna forman <b>una sola prueba</b> en el Campus (si no hay consigna, se agrupan por paciente).'],
            ['✓', 'Eliges <b>asignatura, categoría</b> (teoría, prácticas o seguimiento; obligatoria), <b>unidad</b> (UD/RA) y <b>peso</b>. Solo se envían las notas <b>publicadas</b>.'],
            ['✓', 'En el Campus la prueba queda <b>oculta</b> hasta que la publiques. Si reenvías, se actualizan las notas sin duplicar la prueba, y <b>no se pisan</b> la categoría, la unidad, el peso ni las notas que hayas editado a mano allí.'],
          ]],
        ]],
        ['11 · Ver como alumno y PDF', [
          ['leg', [
            ['✓', '<b>Ver como alumno:</b> en cada historia, botones «Enfermería» y «TCAE». Ves exactamente lo que ve el alumnado (con el día del caso aplicado), en solo lectura. Sales con el botón de la franja amarilla.'],
            ['✓', '<b>PDF del caso</b> (pestaña Ficha): versión para el alumnado (sin notas del docente, hasta el día que elijas) o versión completa.'],
            ['✓', '<b>PDF por alumno</b> (Alumnado → Ver trabajo → Descargar PDF): todo lo que ha introducido, con comentarios, anulaciones, consigna y nota. En Alumnado también hay un <b>ZIP con un PDF por alumno</b>.'],
            ['✓', '<b>Imprimir una historia</b> desde su pestaña Resumen.'],
          ]],
        ]],
        ['12 · Fin de curso, privacidad y auditoría', [
          ['leg', [
            ['✓', '<b>Borrar datos del alumnado</b> (Alumnado, o la ficha de cada alumno): de todo el alumnado (administración), de un paciente o de un alumno. Muestra antes cuántos registros, comentarios y notas se borrarán y pide escribir BORRAR. Opcionalmente quita también las notas y las asignaciones. Pacientes, consignas y prescripciones no se tocan.'],
            ['✓', 'Descarga antes los informes (ZIP) si los necesitas: <b>no se puede deshacer</b>. Las notas ya enviadas al Campus no se borran allí.'],
            ['✓', '<b>Auditoría:</b> cada acción importante (altas, notas, borrados, envíos) queda registrada con quién y cuándo.'],
            ['✓', '<b>Archivar</b> un paciente lo oculta del trabajo sin perder nada.'],
            ['✓', '<b>Eliminar un caso por completo:</b> pestaña Ficha, al final, «Eliminar este caso». Muestra lo que se borrará (historias, registros, notas, prescripciones, consignas…) y pide escribir BORRAR. No se puede deshacer.'],
          ]],
        ]],
        ['13 · Catálogo de cuidados', [
          ['p', 'El <b>Catálogo de cuidados</b> es la lista de acciones que el alumnado elige al registrar un «Cuidado realizado» (higiene, movilización, control de infección y aislamiento…). Cada acción indica si la puede registrar <b>enfermería, auxiliar o ambos</b>. Puedes añadir, renombrar, activar o desactivar acciones.'],
        ]],
        ['14 · Preguntas frecuentes', [
          ['faq', [
            ['¿Puedo usar el mismo paciente en dos asignaturas?', 'Sí. Clasifícalo en las dos y crea una consigna para cada una; asigna cada consigna a su grupo.'],
            ['Un alumno terminó un día por error', 'Retrocede el «Día del caso» con − en su historia: vuelve a ese día y puede corregir. Después avanzará de nuevo.'],
            ['¿Cómo hago un cuestionario sobre el caso?', 'Créalo en el Campus (cuestionarios) y pon en su enunciado o como material el enlace de la consigna: el alumno abre su historia con un clic.'],
            ['El alumno dice que no ve el caso', 'Comprueba que está asignado, que la fecha de inicio no es futura y que la historia no está cerrada. «Ver como alumno» te lo confirma.'],
            ['Cambié la asignatura de un alumno en el Campus', 'Pulsa «Sincronizar alumnado del Campus» en Alumnado.'],
            ['No salen asignaturas para clasificar', 'Falta sincronizar con el Campus (Alumnado → Sincronizar).'],
            ['Importé un caso y falló una línea', 'La vista previa dice qué línea y por qué. Corrige el texto y vuelve a pulsar Revisar; las líneas con error se omiten.'],
          ]],
        ]],
      ],
    },
  },

  ca: {
    ui: { tip: 'Consell', warn: 'Compte', print: 'Imprimir / desar PDF', student: 'Alumnat', teacher: 'Professorat', toc: 'En aquesta guia' },
    student: {
      title: "Guia de l'alumnat", subtitle: "Com registrar el teu treball amb el pacient simulat, pas a pas",
      sections: [
        ["1 · Què és la Història clínica", [
          ['lead', "Una aplicació per practicar com en un hospital: cuides un <b>pacient simulat</b> (fictici) i vas anotant el que fas —constants, medicació, cures, valoracions— a la seva història clínica. Funciona a l'ordinador i al mòbil."],
          ['leg', [
            ['✓', "<b>Tot és fictici.</b> Els pacients i les seves dades són inventats amb finalitats docents."],
            ['✓', "<b>El que escrius queda desat</b> amb el teu nom i l'hora, com en una història real. No s'esborra: si t'equivoques, ho <b>anul·les</b> i ho corregeixes (vegeu la secció 7)."],
            ['✓', "<b>El teu professor ho revisa</b> i et pot deixar comentaris i una nota."],
            ['✓', "<b>Idioma:</b> català o castellà; canvia'l amb el botó <b>CA / ES</b> de la barra superior."],
          ]],
          ['h2', "El recorregut d'un cop d'ull"],
          ['flow', [['1', 'Entra', 'Des del Campus, sense cap altra contrasenya'], ['2', 'Obre la teva història', 'A «Els meus pacients»'], ['3', 'Llegeix la consigna', "Què se't demana i fins quan"], ['4', 'Registra', 'Constants, medicació, cures…'], ['5', 'Consulta la teva nota', 'Quan el professor la publiqui']]],
        ]],
        ['2 · Com entrar', [
          ['p', "No has de crear cap compte ni recordar una altra contrasenya. Entra al <b>Campus</b>, obre l'<b>assignatura</b> i prem el botó <b>«Obrir la història clínica»</b> (també hi ha un botó <b>Història clínica</b> a «El meu espai»). T'identifica automàticament."],
          ['box', 'tip', "Si veus «Enllaç d'accés no vàlid o caducat», torna a entrar des del Campus: cada enllaç d'accés funciona una sola vegada i caduca en un minut."],
          ['box', 'warn', "Si el Campus et diu que estàs «suplantant un alumne», surt de la vista «Veure com a alumne» (és una eina del professorat)."],
        ]],
        ['3 · Els meus pacients', [
          ['lead', "En entrar veus la llista de pacients que el teu professor t'ha assignat. Prem-ne un per obrir <b>la teva història</b>."],
          ['img', 's-lista', 0.95],
          ['leg', [
            ['✓', "<b>Individual o d'equip:</b> l'etiqueta «Individual» o «Equip» et diu si treballes sol o amb companys (en equip veieu els registres de tots)."],
            ['✓', "<b>Consigna:</b> sota el pacient apareix l'activitat i quantes tasques portes fetes (per exemple 2/4)."],
            ['✓', "<b>«Disponible des de…»:</b> la història encara no està oberta. S'activarà sola en aquesta data."],
            ['✓', "<b>«Finalitzada»:</b> ja ha passat la data de fi. La pots consultar, però no registrar-hi res més."],
          ]],
        ]],
        ["4 · La consigna: la teva activitat", [
          ['lead', "A dalt de la història hi ha la <b>consigna</b>: el que has de fer, la data de lliurament (si n'hi ha) i una llista de tasques."],
          ['img', 's-historia', 0.95],
          ['leg', [
            ['✓', "Les tasques amb <b>✓</b> es marquen soles quan fas el registre que demanen (per exemple, dues preses de constants). No cal avisar ningú."],
            ['✓', "Les tasques amb <b>•</b> («lliures») no es comproven soles: les valorarà el teu professor."],
            ['✓', "Si una tasca porta una etiqueta <b>Dia 2</b>, s'ha de fer aquell dia; la del dia en què ets apareix ressaltada."],
            ['✓', "Pots plegar la consigna amb la fletxa per guanyar espai."],
          ]],
        ]],
        ['5 · La història del pacient', [
          ['p', "La franja superior resumeix el pacient: edat, ubicació, <b>al·lèrgies (en vermell)</b>, <b>aïllament</b> i dieta. Mira-la sempre abans d'actuar. A sota hi ha les pestanyes:"],
          ['leg', [
            ['•', "<b>Resum:</b> dades de l'ingrés, darreres constants i darrera nota."],
            ['•', "<b>Evolució, Constants, Balanç hídric, Cures:</b> els teus registres, en taula i amb gràfiques."],
            ['•', "<b>Medicació:</b> el full d'administració amb les prescripcions."],
            ['•', "<b>Escales, Valoració, Pla de cures, Informe:</b> la feina pròpia d'infermeria."],
            ['•', "<b>Proves i evolució:</b> resultats i successos que ocorren en el cas."],
            ['•', "<b>Fitxa:</b> totes les dades del pacient."],
          ]],
          ['box', 'tip', "<b>El «dia del cas».</b> El cas avança per dies i cada dia porta proves, successos i prescripcions nous. Segons com l'hagi preparat el teu professor, <b>ell</b> va alliberant els dies o <b>tu</b> avances per dies (vegeu a sota). Si alguna cosa encara no apareix, és que encara no toca."],
          ['h2', 'Si treballes per dies'],
          ['leg', [
            ['✓', "A dalt de la història veuràs <b>«Dia 2 de 5»</b> i el botó <b>«Acabar el dia 2»</b>. Registra el d'aquell dia i prem el botó quan acabis."],
            ['✓', "En prémer-lo t'avisem del que et queda pendent d'aquell dia. És només un avís: pots continuar igualment."],
            ['✓', "En passar al dia següent apareixen les proves, successos i prescripcions nous. <b>Els dies acabats queden tancats</b>: els pots veure, però ja no hi pots afegir ni corregir registres. Només el teu professor els pot reobrir."],
            ['✓', "La data de cada registre és la del dia del cas: tu només tries l'hora."],
          ]],
        ]],
        ['6 · Què pots registrar', [
          ['img', 's-form', 0.95],
          ['leg', [
            ['✓', "<b>Nota d'evolució:</b> el que observes i fas (torn i tipus: evolució, incidència, educació, traspàs)."],
            ['✓', "<b>Constants:</b> tensió, freqüència cardíaca i respiratòria, temperatura, saturació, glucèmia, dolor. Els valors fora de rang es marquen sols."],
            ['✓', "<b>Balanç hídric:</b> ingestes i eliminacions en ml; se sumen per dia i per torn."],
            ['✓', "<b>Cura realitzada:</b> tries l'acció d'una llista (higiene, mobilització, aïllament…) i el seu resultat."],
            ['✓', "<b>Medicació:</b> a la pestanya «Medicació» prems l'hora de la pauta i confirmes els <b>cinc correctes</b> (pacient, fàrmac, dosi, via i hora) abans de registrar."],
            ['✓', "<b>Escales:</b> Barthel, Braden, Norton, Glasgow i Downton; la puntuació i el nivell es calculen sols."],
            ['✓', "<b>Valoració per patrons</b> (Gordon), <b>pla de cures</b> (problema, causa, objectiu, intervencions i la seva avaluació) i <b>informe</b> d'alta o de traspàs."],
          ]],
          ['box', 'warn', "<b>Perfil Infermeria o TCAI.</b> Segons la teva assignatura, l'aplicació t'assigna un perfil. El perfil TCAI (auxiliar) registra constants, balanç, notes, cures i medicació <b>només per via oral o tòpica</b>; la valoració, les escales, el pla de cures i l'informe són d'infermeria. El que no pots fer no apareix o es rebutja amb un avís."],
        ]],
        ["7 · Si t'equivoques", [
          ['p', "Un registre no s'edita ni s'esborra, igual que en una història real. A la seva fila tens dos botons:"],
          ['leg', [
            ['✓', "<b>Anul·lar:</b> escrius el motiu i el registre queda ratllat, visible però sense valor."],
            ['✓', "<b>Corregir:</b> obre un formulari amb les dades per crear-ne un de nou; l'original queda assenyalat com a substituït."],
            ['✓', "El teu professor pot deixar <b>comentaris</b> sota un registre; els veuràs sota el registre."],
          ]],
        ]],
        ['8 · La teva nota', [
          ['p', "Quan el teu professor publiqui la nota, la veuràs a la pestanya <b>Avaluació</b> de la teva història, amb la puntuació de cada criteri i el seu comentari. Mentre no la publiqui, no es veu. També pot aparèixer a les notes del Campus."],
        ]],
        ['9 · Imprimir o desar el teu treball', [
          ['p', "A la pestanya Resum, el botó <b>«Imprimir / desar PDF»</b> prepara tota la teva història llesta per imprimir; al quadre d'impressió del navegador tria «Desar com a PDF»."],
        ]],
        ['10 · Si alguna cosa falla', [
          ['faq', [
            ["No em surt cap pacient", "Encara no t'han assignat cap, o és d'un altre grup. Avisa el teu professor."],
            ["La història surt bloquejada amb «Disponible des de…»", "És normal: s'obrirà sola en aquesta data."],
            ["No puc registrar res", "Pot ser que la història estigui tancada o finalitzada (només lectura), o que aquesta acció sigui d'infermeria i el teu perfil sigui TCAI."],
            ["M'he equivocat en un valor", "Fes servir «Anul·lar» amb el motiu i «Corregir» per escriure el correcte (secció 7)."],
            ["No puc corregir un registre d'un dia anterior", "Si treballes per dies, els dies acabats estan tancats. Demana al teu professor que reobri aquell dia."],
            ["Em diu que el meu accés està desactivat", "Demana al teu professor que el reactivi."],
            ["Les coses surten en un altre idioma", "Canvia l'idioma amb el botó CA / ES de la barra superior. Les dades del pacient estan escrites en l'idioma que va triar el teu professor."],
          ]],
        ]],
      ],
    },
    teacher: {
      title: 'Guia del professorat', subtitle: "Com preparar un cas, assignar-lo, corregir-lo i portar les notes al Campus",
      sections: [
        ['1 · Visió general', [
          ['lead', "Història clínica és una aplicació a part, connectada al Campus: l'alumnat hi entra amb un clic des de la seva assignatura i el professorat treballa aquí. Un <b>pacient</b> (el cas) es pot fer servir en diverses <b>activitats</b> (consignes) i en diverses assignatures."],
          ['flow', [['1', 'Prepara el cas', 'Crea o importa un pacient'], ['2', 'Escriu la consigna', "Què ha de fer l'alumnat"], ['3', 'Assigna', 'A alumnes o equips, amb dates'], ['4', 'Segueix i corregeix', 'Seguiment i avaluació'], ['5', 'Porta les notes', 'Al Campus, per activitat']]],
          ['box', 'tip', "Per veure com queda sense preparar res, entra a <b>Pacients → Importar cas</b> i prem «Exemple en català» o «Exemple en castellà»: crea una pacient completa amb consignes i registres de mostra."],
        ]],
        ['2 · Primera posada en marxa', [
          ['leg', [
            ['✓', "<b>Al Campus,</b> a Editar assignatura → «Eines i opcions», marca <b>«Història clínica simulada»</b> a cada assignatura on vulguis que l'alumnat vegi l'accés."],
            ['✓', "<b>Aquí,</b> a <b>Alumnat → Sincronitzar alumnat del Campus</b>: porta l'alumnat i les seves assignatures (i les unitats RA/UD per a les notes). Repeteix-ho quan hi hagi altes noves."],
            ['✓', "<b>Perfil Infermeria / TCAI:</b> s'assigna sol segons l'assignatura («Perfil segons assignatura del Campus»). El pots canviar alumne a alumne."],
            ['✓', "<b>Més professorat:</b> només l'administració, a Alumnat → Professorat, amb correu i contrasenya propis. Entren des de l'inici de sessió omplint el seu correu."],
          ]],
          ['box', 'warn', "No es pot donar accés de professorat a un alumne des de la llista d'alumnat. Els comptes de professorat són a part."],
        ]],
        ['3 · Crear pacients', [
          ['lead', "Tres maneres: a mà, important un cas escrit per una IA, o amb el cas d'exemple."],
          ['img', 't-importar', 0.95],
          ['leg', [
            ['✓', "<b>A mà:</b> «+ Nou pacient». La fitxa porta filiació, ingrés, antecedents, al·lèrgies, <b>tipus d'aïllament</b> (contacte, gotes, aèria, protector), dieta, riscos i dos camps <b>només per al professorat</b>: notes del docent i objectius d'aprenentatge."],
            ['✓', "<b>Importar amb IA:</b> «Importar cas». Tria l'idioma de la plantilla, <b>copia la plantilla</b> (omple abans les quatre dades: tema, nivell, idioma i durada), passa-la a la teva IA, enganxa el que et torni i prem <b>Revisar</b>. Et marca els errors per línia; si tot és correcte, <b>Crear cas</b>. El text pot estar en català o castellà."],
            ['✓', "La plantilla demana la fitxa, al·lèrgies, prescripcions, <b>consignes</b>, proves i esdeveniments per dia i els <b>temes</b>. Pots deixar buit el que no vulguis."],
          ]],
          ['box', 'tip', "Un cas es pot reutilitzar tantes vegades com vulguis amb consignes diferents; no cal duplicar el pacient."],
        ]],
        ['4 · Classificar els pacients', [
          ['p', "Cada pacient pot pertànyer a una o diverses <b>assignatures</b> del Campus i portar <b>temes</b> (etiquetes lliures com Respiratori o Aïllament)."],
          ['img', 't-lista', 0.95],
          ['leg', [
            ['✓', "<b>Un a un:</b> a la pestanya Fitxa, quadre «Classificació»."],
            ['✓', "<b>En bloc:</b> marca diversos pacients a la llista, tria l'assignatura o escriu el tema i prem Afegir o Treure."],
            ['✓', "<b>Filtres:</b> cercador, assignatura (amb «Sense classificar») i tema. Els pacients que ja tenies apareixen sense classificar."],
          ]],
        ]],
        ['5 · Prescripcions i línia temporal', [
          ['leg', [
            ['✓', "<b>Prescripcions</b> (pestanya del pacient): fàrmac, dosi, via, pauta, hores, des de/fins a quin dia i «si cal». L'alumnat les administra al full de medicació amb els cinc correctes."],
            ['✓', "<b>Línia temporal:</b> proves (analítiques, radiografies…) i esdeveniments (febre, caiguda…) amb el <b>dia del cas</b> en què ocorren."],
            ['✓', "<b>Dia del cas:</b> cada història té un comptador (− / +). L'alumnat només veu el que ja toca per dia; tu ho veus tot, amb la marca «s'allibera el dia N». Si prefereixes que cada alumne avanci al seu ritme, fes servir el <b>ritme per dies</b> (secció 7)."],
          ]],
        ]],
        ['6 · Consignes (activitats)', [
          ['lead', "La consigna és el que es demana a l'alumnat amb aquest pacient. Un mateix pacient en pot tenir diverses."],
          ['img', 't-consignas', 0.95],
          ['leg', [
            ['✓', "Cada consigna té <b>títol, enunciat</b>, data de lliurament opcional i <b>tasques</b>."],
            ['✓', "Cada tasca és d'un <b>tipus</b> (nota, constants, balanç, cura, medicació, escala, valoració, pla, informe) amb un mínim de registres, i <b>es marca sola</b> quan l'alumne els fa. El tipus «lliure» no es comprova. Cada tasca pot portar un <b>dia</b> (1, 2…): llavors només compten els registres fets aquell dia."],
            ['✓', "Al peu de cada consigna tens un <b>enllaç per al Campus</b> que porta l'alumne directament a la seva història d'aquesta activitat: enganxa'l com a material o a l'enunciat d'una tasca o qüestionari."],
          ]],
        ]],
        ['7 · Assignar a alumnes o equips', [
          ['img', 't-asignar', 0.95],
          ['leg', [
            ['✓', "Pestanya <b>Assignació</b>: tria el mode (<b>individual</b>, una història per alumne, o <b>equip</b>), la <b>consigna</b>, i marca l'alumnat (filtra per assignatura o cerca)."],
            ['✓', "<b>Disponible des de / Fins a:</b> programa l'accés (buit = sense límit). Abans de la data l'alumne veu la història bloquejada; després del final la pot consultar però no registrar. Es pot canviar després a la mateixa història."],
            ['✓', "<b>Ritme:</b> «El marca el professor» (tu mous el dia del cas; ideal a classe) o «Per dies: el marca l'alumne» (cada alumne o equip prem «Acabar el dia N» i passa al següent). Pots fixar el <b>darrer dia</b>; si no, és el de la darrera prova o prescripció. El canvies després al desplegable «Ritme» de la història."],
            ['✓', "<b>Dies tancats:</b> en el mode per dies, els dies acabats queden tancats per a l'alumne (ni afegir ni corregir). Per <b>reobrir un dia</b>, retrocedeix el «Dia del cas» amb − a la seva història: l'alumne torna a aquell dia. A Seguiment veus en quin dia va cadascú."],
            ['✓', "<b>Tancar una història</b> la deixa en només lectura quan vulguis (pestanya Històries del pacient)."],
          ]],
        ]],
        ['8 · Seguiment i correcció', [
          ['lead', "Què ha fet cada alumne o grup? Tres llocs:"],
          ['img', 't-seguimiento', 0.95],
          ['leg', [
            ['✓', "<b>Pestanya Seguiment</b> del pacient: per consigna, qui ha fet què (tasques ✓ ○), registres, darrera activitat i nota. Botons «Obrir» i «Avaluar»."],
            ['✓', "<b>Alumnat → Veure treball:</b> la fitxa d'un alumne amb totes les seves històries, progrés i nota."],
            ['✓', "<b>Dins d'una història:</b> llegeixes tots els registres (filtra per membre als equips), <b>comentes</b> qualsevol registre i, a la pestanya <b>Avaluació</b>, puntues amb la rúbrica."],
          ]],
          ['box', 'tip', "Com a professor <b>no escrius registres</b> en una història: només llegeixes, comentes i avalues."],
        ]],
        ['9 · Avaluar amb la rúbrica', [
          ['leg', [
            ['✓', "La <b>rúbrica</b> s'edita a la pestanya <b>Notes</b>: criteris amb pes i puntuació de 0 a 4. La nota és de 0 a 10, ponderada."],
            ['✓', "A cada història, <b>Avaluació</b>: puntues cada criteri, escrius un comentari i marques <b>«Publicada»</b> perquè l'alumne la vegi. Sense publicar, només la veus tu."],
            ['✓', "<b>Exportar notes (CSV)</b> des de la pestanya Notes."],
          ]],
        ]],
        ['10 · Portar les notes al Campus', [
          ['img', 't-notas', 0.95],
          ['leg', [
            ['✓', "A <b>Notes → Enviar al Campus</b> hi ha un quadre per <b>activitat</b>: totes les històries amb la mateixa consigna formen <b>una sola prova</b> al Campus (si no hi ha consigna, s'agrupen per pacient)."],
            ['✓', "Tries <b>assignatura, categoria</b> (teoria, pràctiques o seguiment; obligatòria), <b>unitat</b> (UD/RA) i <b>pes</b>. Només s'envien les notes <b>publicades</b>."],
            ['✓', "Al Campus la prova queda <b>oculta</b> fins que la publiquis. Si reenvies, s'actualitzen les notes sense duplicar la prova, i <b>no es trepitgen</b> la categoria, la unitat, el pes ni les notes que hagis editat a mà allà."],
          ]],
        ]],
        ['11 · Veure com a alumne i PDF', [
          ['leg', [
            ['✓', "<b>Veure com a alumne:</b> a cada història, botons «Infermeria» i «TCAI». Veus exactament el que veu l'alumnat (amb el dia del cas aplicat), en només lectura. Surts amb el botó de la franja groga."],
            ['✓', "<b>PDF del cas</b> (pestanya Fitxa): versió per a l'alumnat (sense notes del docent, fins al dia que triïs) o versió completa."],
            ['✓', "<b>PDF per alumne</b> (Alumnat → Veure treball → Descarregar PDF): tot el que ha introduït, amb comentaris, anul·lacions, consigna i nota. A Alumnat també hi ha un <b>ZIP amb un PDF per alumne</b>."],
            ['✓', "<b>Imprimir una història</b> des de la seva pestanya Resum."],
          ]],
        ]],
        ['12 · Final de curs, privacitat i auditoria', [
          ['leg', [
            ['✓', "<b>Esborrar dades de l'alumnat</b> (Alumnat, o la fitxa de cada alumne): de tot l'alumnat (administració), d'un pacient o d'un alumne. Mostra abans quants registres, comentaris i notes s'esborraran i demana escriure ESBORRAR. Opcionalment treu també les notes i les assignacions. Pacients, consignes i prescripcions no es toquen."],
            ['✓', "Descarrega abans els informes (ZIP) si els necessites: <b>no es pot desfer</b>. Les notes ja enviades al Campus no s'hi esborren."],
            ['✓', "<b>Auditoria:</b> cada acció important (altes, notes, esborrats, enviaments) queda registrada amb qui i quan."],
            ['✓', "<b>Arxivar</b> un pacient l'amaga del treball sense perdre res."],
            ['✓', "<b>Eliminar un cas per complet:</b> pestanya Fitxa, al final, «Eliminar aquest cas». Mostra el que s'esborrarà (històries, registres, notes, prescripcions, consignes…) i demana escriure ESBORRAR. No es pot desfer."],
          ]],
        ]],
        ['13 · Catàleg de cures', [
          ['p', "El <b>Catàleg de cures</b> és la llista d'accions que l'alumnat tria en registrar una «Cura realitzada» (higiene, mobilització, control d'infecció i aïllament…). Cada acció indica si la pot registrar <b>infermeria, auxiliar o tots dos</b>. Pots afegir, canviar el nom, activar o desactivar accions."],
        ]],
        ['14 · Preguntes freqüents', [
          ['faq', [
            ["Puc fer servir el mateix pacient en dues assignatures?", "Sí. Classifica'l en les dues i crea una consigna per a cada una; assigna cada consigna al seu grup."],
            ["Un alumne ha acabat un dia per error", "Retrocedeix el «Dia del cas» amb − a la seva història: torna a aquell dia i pot corregir. Després avançarà de nou."],
            ["Com faig un qüestionari sobre el cas?", "Crea'l al Campus (qüestionaris) i posa a l'enunciat o com a material l'enllaç de la consigna: l'alumne obre la seva història amb un clic."],
            ["L'alumne diu que no veu el cas", "Comprova que està assignat, que la data d'inici no és futura i que la història no està tancada. «Veure com a alumne» ho confirma."],
            ["He canviat l'assignatura d'un alumne al Campus", "Prem «Sincronitzar alumnat del Campus» a Alumnat."],
            ["No surten assignatures per classificar", "Falta sincronitzar amb el Campus (Alumnat → Sincronitzar)."],
            ["He importat un cas i ha fallat una línia", "La vista prèvia diu quina línia i per què. Corregeix el text i torna a prémer Revisar; les línies amb error s'ometen."],
          ]],
        ]],
      ],
    },
  },
};
