'use strict';
/* Catálogo inicial propio de cuidados y actividades (editable en la app). No reproduce textos con copyright.
   [grupo, nombre_es, nombre_ca, quién lo registra]. E = solo enfermería; EA = enfermería y auxiliar (TCAE). */
const E = 'enfermeria', EA = 'enfermeria,tcae';

const G = {
  hig: ['Higiene y confort', "Higiene i confort"],
  mov: ['Movilidad y posturas', 'Mobilitat i postures'],
  upp: ['Piel y prevención de úlceras', 'Pell i prevenció de nafres'],
  nut: ['Nutrición e hidratación', 'Nutrició i hidratació'],
  eli: ['Eliminación', 'Eliminació'],
  con: ['Constantes y control', 'Constants i control'],
  seg: ['Seguridad y prevención', 'Seguretat i prevenció'],
  inf: ['Control de infección y aislamiento', "Control d'infecció i aïllament"],
  uni: ['Unidad, material y logística', 'Unitat, material i logística'],
  col: ['Colaboración con enfermería', 'Col·laboració amb infermeria'],
  pre: ['Preparación para pruebas y cirugía', 'Preparació per a proves i cirurgia'],
  com: ['Atención al paciente y familia', 'Atenció al pacient i família'],
  esp: ['Cuidados por colectivo', 'Cures per col·lectiu'],
  fin: ['Final de vida', 'Final de vida'],
  reg: ['Registro y comunicación', 'Registre i comunicació'],
  proc: ['Procedimientos de enfermería', "Procediments d'infermeria"],
  edu: ['Educación y valoración', 'Educació i valoració'],
};

const ITEMS = [
  /* Higiene y confort */
  ['hig', 'Higiene completa en cama', 'Higiene completa al llit', EA],
  ['hig', 'Higiene parcial / aseo asistido', 'Higiene parcial / aseig assistit', EA],
  ['hig', 'Ducha asistida', 'Dutxa assistida', EA],
  ['hig', 'Higiene bucal', 'Higiene bucal', EA],
  ['hig', 'Higiene y cuidado de prótesis dental', 'Higiene i cura de pròtesi dental', EA],
  ['hig', 'Lavado de cabello (en cama o en ducha)', 'Rentat de cabell (al llit o a la dutxa)', EA],
  ['hig', 'Peinado y cuidado del cabello', 'Pentinat i cura del cabell', EA],
  ['hig', 'Afeitado', 'Afaitat', EA],
  ['hig', 'Corte y cuidado de uñas (manos y pies)', 'Tall i cura d\'ungles (mans i peus)', EA],
  ['hig', 'Higiene de pies y revisión de la piel', 'Higiene de peus i revisió de la pell', EA],
  ['hig', 'Higiene perineal / genital', 'Higiene perineal / genital', EA],
  ['hig', 'Higiene ocular y de oídos', 'Higiene ocular i d\'oïdes', EA],
  ['hig', 'Cuidado de la piel e hidratación', 'Cura de la pell i hidratació', EA],
  ['hig', 'Masaje de confort', 'Massatge de confort', EA],
  ['hig', 'Ayuda para vestirse y desvestirse', 'Ajuda per vestir-se i despullar-se', EA],
  ['hig', 'Cambio de pijama / ropa del paciente', 'Canvi de pijama / roba del pacient', EA],
  ['hig', 'Cambio de ropa de cama (cama desocupada)', 'Canvi de roba de llit (llit desocupat)', EA],
  ['hig', 'Cambio de ropa de cama con paciente encamado', 'Canvi de roba de llit amb pacient enllitat', EA],
  ['hig', 'Confort ambiental (temperatura, luz, ruido, ventilación)', 'Confort ambiental (temperatura, llum, soroll, ventilació)', EA],
  ['hig', 'Facilitar el descanso y el sueño', 'Facilitar el descans i la son', EA],

  /* Movilidad y posturas */
  ['mov', 'Cambio postural', 'Canvi postural', EA],
  ['mov', 'Posición decúbito supino / lateral / prono', 'Posició decúbit supí / lateral / pron', EA],
  ['mov', 'Posición Fowler / semi-Fowler / sentado', 'Posició Fowler / semi-Fowler / assegut', EA],
  ['mov', 'Movilización del paciente encamado en la cama', 'Mobilització del pacient enllitat al llit', EA],
  ['mov', 'Movilización y transferencia cama-sillón', 'Mobilització i transferència llit-cadira', EA],
  ['mov', 'Transferencia con grúa o ayudas técnicas', 'Transferència amb grua o ajudes tècniques', EA],
  ['mov', 'Traslado en silla de ruedas', 'Trasllat en cadira de rodes', EA],
  ['mov', 'Traslado en camilla', 'Trasllat en llitera', EA],
  ['mov', 'Deambulación asistida', 'Deambulació assistida', EA],
  ['mov', 'Apoyo con bastón, andador o muletas', 'Suport amb bastó, caminador o crosses', EA],
  ['mov', 'Ejercicios de movilización pasiva / activa pautados', 'Exercicis de mobilització passiva / activa pautats', EA],
  ['mov', 'Medidas antiedema (elevación de miembros, medias de compresión)', 'Mesures antiedema (elevació d\'extremitats, mitges de compressió)', EA],

  /* Piel y prevención de úlceras */
  ['upp', 'Prevención de úlceras por presión (medidas)', 'Prevenció de nafres per pressió (mesures)', EA],
  ['upp', 'Colocación de colchón antiescaras / superficie especial', 'Col·locació de matalàs antiescares / superfície especial', EA],
  ['upp', 'Protección de talones y prominencias óseas', 'Protecció de talons i prominències òssies', EA],
  ['upp', 'Vigilancia de la piel y comunicación de lesiones', 'Vigilància de la pell i comunicació de lesions', EA],
  ['upp', 'Aplicación de ácidos grasos hiperoxigenados / cremas pautadas', 'Aplicació d\'àcids grassos hiperoxigenats / cremes pautades', EA],

  /* Nutrición e hidratación */
  ['nut', 'Reparto de dietas y preparación de la bandeja', 'Repartiment de dietes i preparació de la safata', EA],
  ['nut', 'Comprobación de la dieta prescrita y alergias alimentarias', 'Comprovació de la dieta prescrita i al·lèrgies alimentàries', EA],
  ['nut', 'Ayuda en la ingesta', 'Ajuda en la ingesta', EA],
  ['nut', 'Alimentación completa del paciente dependiente', 'Alimentació completa del pacient dependent', EA],
  ['nut', 'Alimentación con espesantes / textura modificada (disfagia)', 'Alimentació amb espessidors / textura modificada (disfàgia)', EA],
  ['nut', 'Fomento de la hidratación y control de líquidos', 'Foment de la hidratació i control de líquids', EA],
  ['nut', 'Control de dieta y de lo ingerido', 'Control de dieta i de la ingesta', EA],
  ['nut', 'Registro de rechazo o dificultad para comer', 'Registre de rebuig o dificultat per menjar', EA],
  ['nut', 'Colaboración en nutrición enteral (preparación, posición, vigilancia)', 'Col·laboració en nutrició enteral (preparació, posició, vigilància)', EA],

  /* Eliminación */
  ['eli', 'Ayuda con la cuña, botella o inodoro', 'Ajuda amb el gibrell, ampolla o vàter', EA],
  ['eli', 'Cambio de absorbente / dispositivo de incontinencia', 'Canvi d\'absorbent / dispositiu d\'incontinència', EA],
  ['eli', 'Higiene tras la eliminación', 'Higiene després de l\'eliminació', EA],
  ['eli', 'Medición de diuresis', 'Mesura de diüresi', EA],
  ['eli', 'Vaciado y registro de bolsa colectora de orina', 'Buidatge i registre de bossa col·lectora d\'orina', EA],
  ['eli', 'Vaciado y cambio de bolsa de ostomía (colaboración)', 'Buidatge i canvi de bossa d\'ostomia (col·laboració)', EA],
  ['eli', 'Control de deposiciones y vómitos (número, aspecto)', 'Control de deposicions i vòmits (nombre, aspecte)', EA],
  ['eli', 'Recogida de muestra de orina', 'Recollida de mostra d\'orina', EA],
  ['eli', 'Recogida de muestra de heces', 'Recollida de mostra de femta', EA],
  ['eli', 'Recogida de muestra de esputo', 'Recollida de mostra d\'esput', EA],
  ['eli', 'Colaboración en enema de limpieza / extracción manual', 'Col·laboració en ènema de neteja / extracció manual', EA],

  /* Constantes y control */
  ['con', 'Toma de tensión arterial', 'Presa de tensió arterial', EA],
  ['con', 'Toma de frecuencia cardiaca / pulso', 'Presa de freqüència cardíaca / pols', EA],
  ['con', 'Toma de frecuencia respiratoria', 'Presa de freqüència respiratòria', EA],
  ['con', 'Toma de temperatura', 'Presa de temperatura', EA],
  ['con', 'Saturación de oxígeno (pulsioximetría)', 'Saturació d\'oxigen (pulsioximetria)', EA],
  ['con', 'Peso, talla e índice de masa corporal', 'Pes, talla i índex de massa corporal', EA],
  ['con', 'Medición de perímetros (abdominal, cintura, extremidades)', 'Mesura de perímetres (abdominal, cintura, extremitats)', EA],
  ['con', 'Registro de constantes en la gráfica', 'Registre de constants a la gràfica', EA],
  ['con', 'Vigilancia del nivel de conciencia y del estado general', 'Vigilància del nivell de consciència i de l\'estat general', EA],
  ['con', 'Valoración del dolor (escala) y aviso a enfermería', 'Valoració del dolor (escala) i avís a infermeria', EA],

  /* Seguridad y prevención */
  ['seg', 'Identificación del paciente (pulsera, comprobación)', 'Identificació del pacient (polsera, comprovació)', EA],
  ['seg', 'Medidas de seguridad (barandillas, timbre, calzado)', 'Mesures de seguretat (baranes, timbre, calçat)', EA],
  ['seg', 'Prevención de caídas (entorno, acompañamiento, ayudas)', 'Prevenció de caigudes (entorn, acompanyament, ajudes)', EA],
  ['seg', 'Vigilancia de paciente desorientado o con riesgo de fuga', 'Vigilància de pacient desorientat o amb risc de fuga', EA],
  ['seg', 'Colaboración en medidas de sujeción prescritas y su vigilancia', 'Col·laboració en mesures de subjecció prescrites i la seva vigilància', EA],
  ['seg', 'Vigilancia de vías, sondas y drenajes (posición, fugas, tirones)', 'Vigilància de vies, sondes i drenatges (posició, fuites, estirades)', EA],
  ['seg', 'Aviso a enfermería por cambio o signo de alarma', 'Avís a infermeria per canvi o signe d\'alarma', EA],

  /* Control de infección y aislamiento */
  ['inf', 'Higiene de manos', 'Higiene de mans', EA],
  ['inf', 'Colocación y retirada de equipo de protección individual (EPI)', 'Col·locació i retirada d\'equip de protecció individual (EPI)', EA],
  ['inf', 'Aplicación de medidas de aislamiento (contacto, gotas, aéreo)', 'Aplicació de mesures d\'aïllament (contacte, gotes, aeri)', EA],
  ['inf', 'Gestión de residuos sanitarios (clasificación y eliminación)', 'Gestió de residus sanitaris (classificació i eliminació)', EA],
  ['inf', 'Desinfección y limpieza de material y superficies', 'Desinfecció i neteja de material i superfícies', EA],
  ['inf', 'Manejo de ropa y material contaminado', 'Maneig de roba i material contaminat', EA],

  /* Unidad, material y logística */
  ['uni', 'Preparación de la habitación / acogida al ingreso', 'Preparació de l\'habitació / acollida a l\'ingrés', EA],
  ['uni', 'Limpieza y preparación de la unidad tras el alta o traslado', 'Neteja i preparació de la unitat després de l\'alta o trasllat', EA],
  ['uni', 'Reposición y control de stock del carro y del almacén', 'Reposició i control d\'estoc del carro i del magatzem', EA],
  ['uni', 'Comprobación de caducidades del material', 'Comprovació de caducitats del material', EA],
  ['uni', 'Comprobación del carro de paradas y del material de emergencia', 'Comprovació del carro d\'aturades i del material d\'emergència', EA],
  ['uni', 'Preparación y envío de material para esterilizar', 'Preparació i enviament de material per esterilitzar', EA],
  ['uni', 'Manejo de equipos de esterilización y control del material estéril', 'Maneig d\'equips d\'esterilització i control del material estèril', EA],
  ['uni', 'Pedido y reposición de farmacia / lencería / material', 'Comanda i reposició de farmàcia / llenceria / material', EA],
  ['uni', 'Transporte de muestras, historias y documentación', 'Transport de mostres, històries i documentació', EA],
  ['uni', 'Etiquetado e identificación de muestras', 'Etiquetatge i identificació de mostres', EA],
  ['uni', 'Mantenimiento del orden del control y de la sala de curas', 'Manteniment de l\'ordre del control i de la sala de cures', EA],

  /* Colaboración con enfermería */
  ['col', 'Preparación del material para curas y procedimientos', 'Preparació del material per a cures i procediments', EA],
  ['col', 'Ayuda a enfermería en curas (sujeción, posición, material)', 'Ajuda a infermeria en cures (subjecció, posició, material)', EA],
  ['col', 'Colaboración en sondaje vesical o nasogástrico (preparación y posición)', 'Col·laboració en sondatge vesical o nasogàstric (preparació i posició)', EA],
  ['col', 'Colaboración en la canalización de vías y extracciones', 'Col·laboració en la canalització de vies i extraccions', EA],
  ['col', 'Colaboración en oxigenoterapia y aerosolterapia (vigilancia del material)', 'Col·laboració en oxigenoteràpia i aerosolteràpia (vigilància del material)', EA],
  ['col', 'Administración de medicación por vía oral o tópica bajo supervisión de enfermería', 'Administració de medicació per via oral o tòpica sota supervisió d\'infermeria', EA],
  ['col', 'Colaboración en emergencias y reanimación', 'Col·laboració en emergències i reanimació', EA],

  /* Preparación para pruebas y cirugía */
  ['pre', 'Preparación del paciente para pruebas (ayuno, vestimenta, información)', 'Preparació del pacient per a proves (dejuni, vestimenta, informació)', EA],
  ['pre', 'Preparación preoperatoria (rasurado, higiene, ayuno)', 'Preparació preoperatòria (rasurat, higiene, dejuni)', EA],
  ['pre', 'Acompañamiento y traslado a pruebas, quirófano o consulta', 'Acompanyament i trasllat a proves, quiròfan o consulta', EA],
  ['pre', 'Recepción y cuidados básicos en el postoperatorio inmediato (confort, vigilancia)', 'Recepció i cures bàsiques en el postoperatori immediat (confort, vigilància)', EA],

  /* Atención al paciente y familia */
  ['com', 'Acogida e información de normas del servicio', 'Acollida i informació de normes del servei', EA],
  ['com', 'Acompañamiento y apoyo emocional', 'Acompanyament i suport emocional', EA],
  ['com', 'Comunicación adaptada (déficit sensorial, idioma, cognitivo)', 'Comunicació adaptada (dèficit sensorial, idioma, cognitiu)', EA],
  ['com', 'Respeto a la intimidad y a las creencias del paciente', 'Respecte a la intimitat i a les creences del pacient', EA],
  ['com', 'Atención e información básica a familiares y acompañantes', 'Atenció i informació bàsica a familiars i acompanyants', EA],
  ['com', 'Inventario y custodia de pertenencias', 'Inventari i custòdia de pertinences', EA],
  ['com', 'Colaboración en el alta (pertenencias, traslado, recomendaciones)', 'Col·laboració en l\'alta (pertinences, trasllat, recomanacions)', EA],

  /* Cuidados por colectivo */
  ['esp', 'Higiene y baño del lactante / recién nacido', 'Higiene i bany del lactant / nounat', EA],
  ['esp', 'Cuidados del cordón umbilical y del pañal (pediatría)', 'Cures del cordó umbilical i del bolquer (pediatria)', EA],
  ['esp', 'Alimentación con biberón y control de tomas', 'Alimentació amb biberó i control de preses', EA],
  ['esp', 'Cuidados de la persona mayor dependiente (rutinas, autonomía)', 'Cures de la persona gran dependent (rutines, autonomia)', EA],
  ['esp', 'Estimulación cognitiva y orientación a la realidad', 'Estimulació cognitiva i orientació a la realitat', EA],
  ['esp', 'Actividades de ocio y animación', 'Activitats d\'oci i animació', EA],
  ['esp', 'Contención verbal y vigilancia en salud mental', 'Contenció verbal i vigilància en salut mental', EA],
  ['esp', 'Cuidados de la persona encamada de larga duración', 'Cures de la persona enllitada de llarga durada', EA],
  ['esp', 'Cuidados de la persona con movilidad reducida / amputación', 'Cures de la persona amb mobilitat reduïda / amputació', EA],

  /* Final de vida */
  ['fin', 'Cuidados de confort al paciente en situación terminal', 'Cures de confort al pacient en situació terminal', EA],
  ['fin', 'Apoyo a la familia en el duelo', 'Suport a la família en el dol', EA],
  ['fin', 'Cuidados post mortem (amortajamiento) y traslado', 'Cures post mortem (amortallament) i trasllat', EA],

  /* Registro y comunicación */
  ['reg', 'Registro de actividades de cuidado en la hoja de enfermería', 'Registre d\'activitats de cura al full d\'infermeria', EA],
  ['reg', 'Comunicación de incidencias a enfermería', 'Comunicació d\'incidències a infermeria', EA],
  ['reg', 'Traspaso de información entre turnos', 'Traspàs d\'informació entre torns', EA],
  ['reg', 'Registro de dieta, líquidos y eliminaciones', 'Registre de dieta, líquids i eliminacions', EA],

  /* Procedimientos de enfermería (solo enfermería) */
  ['proc', 'Cura de herida quirúrgica', 'Cura de ferida quirúrgica', E],
  ['proc', 'Cura de úlcera por presión', 'Cura de nafra per pressió', E],
  ['proc', 'Canalización de vía venosa periférica', 'Canalització de via venosa perifèrica', E],
  ['proc', 'Control y mantenimiento de vía venosa', 'Control i manteniment de via venosa', E],
  ['proc', 'Administración de medicación (oral, parenteral)', 'Administració de medicació (oral, parenteral)', E],
  ['proc', 'Sondaje vesical', 'Sondatge vesical', E],
  ['proc', 'Sondaje nasogástrico', 'Sondatge nasogàstric', E],
  ['proc', 'Extracción de muestras sanguíneas', 'Extracció de mostres sanguínies', E],
  ['proc', 'Glucemia capilar', 'Glucèmia capil·lar', EA],
  ['proc', 'Oxigenoterapia', 'Oxigenoteràpia', E],
  ['proc', 'Aspiración de secreciones', 'Aspiració de secrecions', E],
  ['proc', 'Cuidados de ostomía', 'Cures d\'ostomia', E],
  ['proc', 'Electrocardiograma', 'Electrocardiograma', E],

  /* Educación y valoración (solo enfermería) */
  ['edu', 'Educación sanitaria al paciente / familia', 'Educació sanitària al pacient / família', E],
  ['edu', 'Valoración del riesgo (caídas, úlceras, etc.)', 'Valoració del risc (caigudes, nafres, etc.)', E],
];

const SEED = ITEMS.map((it) => [G[it[0]][0], it[1], it[2], it[3], G[it[0]][1]]);

/* Idempotente: añade las entradas que falten (por nombre) una vez por versión del catálogo,
   sin tocar lo que el profesorado haya editado ni reactivar lo que haya desactivado. */
function seedCatalog(db) {
  /* Una sola vez: la glucemia capilar pasa a poder registrarla también el auxiliar. */
  if (!db.getSetting('catalog_fix_glucemia')) { db.run("UPDATE catalog SET roles = 'enfermeria,tcae' WHERE name_es = 'Glucemia capilar'"); db.setSetting('catalog_fix_glucemia', '1'); }
  const KEY = 'catalog_seed_v2';
  if (db.getSetting(KEY)) return;
  const have = new Set(db.all('SELECT name_es FROM catalog').map((r) => r.name_es));
  let ord = db.get('SELECT COALESCE(MAX(ord), 0) n FROM catalog').n;
  db.tx(() => {
    SEED.forEach((s) => { if (have.has(s[1])) db.run('UPDATE catalog SET grp = ? WHERE name_es = ?', s[0], s[1]); });
    SEED.forEach((s) => { if (!have.has(s[1])) db.run('INSERT INTO catalog (kind, grp, name_es, name_ca, roles, ord) VALUES (?,?,?,?,?,?)', 'cuidado', s[0], s[1], s[2], s[3], ++ord); });
    db.setSetting(KEY, '1');
  });
}
module.exports = { seedCatalog, SEED };
