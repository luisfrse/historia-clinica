'use strict';
/* Escalas de valoración enfermera de uso común. Se usan en el servidor (validación y cálculo)
   y en el navegador (formulario). Son instrumentos clínicos de dominio público. */
(function (root) {
  const o = (v, es, ca) => ({ v, es, ca });
  const yn = (es, ca) => ({ es, ca, opts: [o(0, 'No', 'No'), o(1, 'Sí', 'Sí')] });

  const SCALES = {
    barthel: {
      es: 'Índice de Barthel (actividades básicas de la vida diaria)', ca: 'Índex de Barthel (activitats bàsiques de la vida diària)', min: 0, max: 100,
      items: {
        comer: { es: 'Comer', ca: 'Menjar', opts: [o(0, 'Dependiente', 'Dependent'), o(5, 'Necesita ayuda', 'Necessita ajuda'), o(10, 'Independiente', 'Independent')] },
        lavarse: { es: 'Lavarse (bañarse)', ca: 'Rentar-se (banyar-se)', opts: [o(0, 'Dependiente', 'Dependent'), o(5, 'Independiente', 'Independent')] },
        vestirse: { es: 'Vestirse', ca: 'Vestir-se', opts: [o(0, 'Dependiente', 'Dependent'), o(5, 'Necesita ayuda', 'Necessita ajuda'), o(10, 'Independiente', 'Independent')] },
        arreglarse: { es: 'Arreglarse', ca: 'Arreglar-se', opts: [o(0, 'Dependiente', 'Dependent'), o(5, 'Independiente', 'Independent')] },
        deposicion: { es: 'Deposición', ca: 'Deposició', opts: [o(0, 'Incontinente', 'Incontinent'), o(5, 'Accidente ocasional', 'Accident ocasional'), o(10, 'Continente', 'Continent')] },
        miccion: { es: 'Micción', ca: 'Micció', opts: [o(0, 'Incontinente o sondado', 'Incontinent o sondat'), o(5, 'Accidente ocasional', 'Accident ocasional'), o(10, 'Continente', 'Continent')] },
        retrete: { es: 'Uso del retrete', ca: 'Ús del vàter', opts: [o(0, 'Dependiente', 'Dependent'), o(5, 'Necesita ayuda', 'Necessita ajuda'), o(10, 'Independiente', 'Independent')] },
        traslado: { es: 'Traslado sillón-cama', ca: 'Trasllat butaca-llit', opts: [o(0, 'Incapaz', 'Incapaç'), o(5, 'Gran ayuda', 'Gran ajuda'), o(10, 'Ayuda mínima', 'Ajuda mínima'), o(15, 'Independiente', 'Independent')] },
        deambulacion: { es: 'Deambulación', ca: 'Deambulació', opts: [o(0, 'Inmóvil', 'Immòbil'), o(5, 'Independiente en silla de ruedas', 'Independent en cadira de rodes'), o(10, 'Anda con ayuda', 'Camina amb ajuda'), o(15, 'Independiente', 'Independent')] },
        escaleras: { es: 'Subir y bajar escaleras', ca: 'Pujar i baixar escales', opts: [o(0, 'Incapaz', 'Incapaç'), o(5, 'Necesita ayuda', 'Necessita ajuda'), o(10, 'Independiente', 'Independent')] },
      },
      level(t) { return t >= 100 ? 'independiente' : t >= 60 ? 'leve' : t >= 40 ? 'moderada' : t >= 20 ? 'grave' : 'total'; },
      levels: { independiente: ['Independiente', 'Independent'], leve: ['Dependencia leve', 'Dependència lleu'], moderada: ['Dependencia moderada', 'Dependència moderada'], grave: ['Dependencia grave', 'Dependència greu'], total: ['Dependencia total', 'Dependència total'] },
      bad: (lv) => lv !== 'independiente' && lv !== 'leve',
    },
    braden: {
      es: 'Escala de Braden (riesgo de úlceras por presión)', ca: 'Escala de Braden (risc d\'úlceres per pressió)', min: 6, max: 23,
      items: {
        percepcion: { es: 'Percepción sensorial', ca: 'Percepció sensorial', opts: [o(1, 'Completamente limitada', 'Completament limitada'), o(2, 'Muy limitada', 'Molt limitada'), o(3, 'Ligeramente limitada', 'Lleugerament limitada'), o(4, 'Sin limitaciones', 'Sense limitacions')] },
        humedad: { es: 'Exposición a la humedad', ca: 'Exposició a la humitat', opts: [o(1, 'Constantemente húmeda', 'Constantment humida'), o(2, 'Muy húmeda', 'Molt humida'), o(3, 'Ocasionalmente húmeda', 'Ocasionalment humida'), o(4, 'Raramente húmeda', 'Rarament humida')] },
        actividad: { es: 'Actividad', ca: 'Activitat', opts: [o(1, 'En cama', 'Al llit'), o(2, 'En silla', 'A la cadira'), o(3, 'Deambula ocasionalmente', 'Deambula ocasionalment'), o(4, 'Deambula frecuentemente', 'Deambula freqüentment')] },
        movilidad: { es: 'Movilidad', ca: 'Mobilitat', opts: [o(1, 'Completamente inmóvil', 'Completament immòbil'), o(2, 'Muy limitada', 'Molt limitada'), o(3, 'Ligeramente limitada', 'Lleugerament limitada'), o(4, 'Sin limitaciones', 'Sense limitacions')] },
        nutricion: { es: 'Nutrición', ca: 'Nutrició', opts: [o(1, 'Muy pobre', 'Molt pobra'), o(2, 'Probablemente inadecuada', 'Probablement inadequada'), o(3, 'Adecuada', 'Adequada'), o(4, 'Excelente', 'Excel·lent')] },
        friccion: { es: 'Roce y peligro de lesiones cutáneas', ca: 'Fregament i perill de lesions cutànies', opts: [o(1, 'Problema', 'Problema'), o(2, 'Problema potencial', 'Problema potencial'), o(3, 'No existe problema aparente', 'No hi ha problema aparent')] },
      },
      level(t) { return t <= 9 ? 'muy_alto' : t <= 12 ? 'alto' : t <= 14 ? 'moderado' : t <= 18 ? 'bajo' : 'sin'; },
      levels: { muy_alto: ['Riesgo muy alto', 'Risc molt alt'], alto: ['Riesgo alto', 'Risc alt'], moderado: ['Riesgo moderado', 'Risc moderat'], bajo: ['Riesgo bajo', 'Risc baix'], sin: ['Sin riesgo', 'Sense risc'] },
      bad: (lv) => lv === 'muy_alto' || lv === 'alto' || lv === 'moderado',
    },
    norton: {
      es: 'Escala de Norton (riesgo de úlceras por presión)', ca: 'Escala de Norton (risc d\'úlceres per pressió)', min: 5, max: 20,
      items: {
        fisico: { es: 'Estado físico general', ca: 'Estat físic general', opts: [o(1, 'Muy malo', 'Molt dolent'), o(2, 'Pobre', 'Pobre'), o(3, 'Mediano', 'Mitjà'), o(4, 'Bueno', 'Bo')] },
        mental: { es: 'Estado mental', ca: 'Estat mental', opts: [o(1, 'Estuporoso o comatoso', 'Estuporós o comatós'), o(2, 'Confuso', 'Confús'), o(3, 'Apático', 'Apàtic'), o(4, 'Alerta', 'Alerta')] },
        actividad: { es: 'Actividad', ca: 'Activitat', opts: [o(1, 'Encamado', 'Enllitat'), o(2, 'Sentado', 'Assegut'), o(3, 'Camina con ayuda', 'Camina amb ajuda'), o(4, 'Ambulante', 'Ambulant')] },
        movilidad: { es: 'Movilidad', ca: 'Mobilitat', opts: [o(1, 'Inmóvil', 'Immòbil'), o(2, 'Muy limitada', 'Molt limitada'), o(3, 'Disminuida', 'Disminuïda'), o(4, 'Total', 'Total')] },
        incontinencia: { es: 'Incontinencia', ca: 'Incontinència', opts: [o(1, 'Urinaria y fecal', 'Urinària i fecal'), o(2, 'Urinaria habitual', 'Urinària habitual'), o(3, 'Ocasional', 'Ocasional'), o(4, 'Ninguna', 'Cap')] },
      },
      level(t) { return t <= 9 ? 'muy_alto' : t <= 12 ? 'alto' : t <= 14 ? 'medio' : 'minimo'; },
      levels: { muy_alto: ['Riesgo muy alto', 'Risc molt alt'], alto: ['Riesgo alto', 'Risc alt'], medio: ['Riesgo medio', 'Risc mitjà'], minimo: ['Riesgo mínimo', 'Risc mínim'] },
      bad: (lv) => lv === 'muy_alto' || lv === 'alto' || lv === 'medio',
    },
    glasgow: {
      es: 'Escala de coma de Glasgow', ca: 'Escala de coma de Glasgow', min: 3, max: 15,
      items: {
        ocular: { es: 'Apertura ocular', ca: 'Obertura ocular', opts: [o(1, 'Ninguna', 'Cap'), o(2, 'Al dolor', 'Al dolor'), o(3, 'A la voz', 'A la veu'), o(4, 'Espontánea', 'Espontània')] },
        verbal: { es: 'Respuesta verbal', ca: 'Resposta verbal', opts: [o(1, 'Ninguna', 'Cap'), o(2, 'Sonidos incomprensibles', 'Sons incomprensibles'), o(3, 'Palabras inapropiadas', 'Paraules inapropiades'), o(4, 'Confusa', 'Confusa'), o(5, 'Orientada', 'Orientada')] },
        motora: { es: 'Respuesta motora', ca: 'Resposta motora', opts: [o(1, 'Ninguna', 'Cap'), o(2, 'Extensión (descerebración)', 'Extensió (descerebració)'), o(3, 'Flexión anormal (decorticación)', 'Flexió anormal (decorticació)'), o(4, 'Retirada al dolor', 'Retirada al dolor'), o(5, 'Localiza el dolor', 'Localitza el dolor'), o(6, 'Obedece órdenes', 'Obeeix ordres')] },
      },
      level(t) { return t >= 13 ? 'leve' : t >= 9 ? 'moderado' : 'grave'; },
      levels: { leve: ['Alteración leve o normal', 'Alteració lleu o normal'], moderado: ['Alteración moderada', 'Alteració moderada'], grave: ['Alteración grave', 'Alteració greu'] },
      bad: (lv) => lv !== 'leve',
    },
    downton: {
      es: 'Escala de Downton (riesgo de caídas)', ca: 'Escala de Downton (risc de caigudes)', min: 0, max: 13,
      items: {
        caidas: yn('Caídas previas', 'Caigudes prèvies'), tranquilizantes: yn('Toma tranquilizantes o sedantes', 'Pren tranquil·litzants o sedants'), diureticos: yn('Toma diuréticos', 'Pren diürètics'),
        hipotensores: yn('Toma antihipertensivos (no diuréticos)', 'Pren antihipertensius (no diürètics)'), antiparkinsonianos: yn('Toma antiparkinsonianos', 'Pren antiparkinsonians'), antidepresivos: yn('Toma antidepresivos', 'Pren antidepressius'),
        otros_med: yn('Toma otros medicamentos', 'Pren altres medicaments'), visual: yn('Déficit visual', 'Dèficit visual'), auditivo: yn('Déficit auditivo', 'Dèficit auditiu'), extremidades: yn('Déficit en extremidades', 'Dèficit en extremitats'),
        confuso: yn('Estado mental: confuso o desorientado', 'Estat mental: confús o desorientat'), deambulacion: yn('Deambulación insegura, con ayuda o imposible', 'Deambulació insegura, amb ajuda o impossible'), edad: yn('Edad de 70 años o más', 'Edat de 70 anys o més'),
      },
      level(t) { return t >= 3 ? 'alto' : 'bajo'; },
      levels: { alto: ['Riesgo alto de caídas (3 o más)', 'Risc alt de caigudes (3 o més)'], bajo: ['Riesgo bajo', 'Risc baix'] },
      bad: (lv) => lv === 'alto',
    },
  };

  /* Calcula puntuación y nivel. Lanza Error('escala') si falta un ítem o un valor no es válido. */
  function compute(key, items) {
    const sc = SCALES[key]; if (!sc) throw new Error('escala');
    items = items && typeof items === 'object' ? items : {};
    const clean = {}; let total = 0;
    for (const [k, it] of Object.entries(sc.items)) {
      const v = Number(items[k]);
      if (items[k] === '' || items[k] == null || !it.opts.some((x) => x.v === v)) throw new Error('escala');
      clean[k] = v; total += v;
    }
    const lv = sc.level(total);
    return { scale: key, items: clean, total, nivel: lv, alerta: sc.bad(lv) };
  }

  /* Patrones funcionales de salud (M. Gordon). */
  const PATRONES = {
    percepcion: ['Percepción y manejo de la salud', 'Percepció i maneig de la salut'], nutricional: ['Nutricional-metabólico', 'Nutricional-metabòlic'], eliminacion: ['Eliminación', 'Eliminació'],
    actividad: ['Actividad y ejercicio', 'Activitat i exercici'], sueno: ['Sueño y descanso', 'Son i descans'], cognitivo: ['Cognitivo-perceptivo', 'Cognitiu-perceptiu'], autopercepcion: ['Autopercepción y autoconcepto', 'Autopercepció i autoconcepte'],
    rol: ['Rol y relaciones', 'Rol i relacions'], sexualidad: ['Sexualidad y reproducción', 'Sexualitat i reproducció'], afrontamiento: ['Adaptación y tolerancia al estrés', 'Adaptació i tolerància a l\'estrès'], valores: ['Valores y creencias', 'Valors i creences'],
  };

  const api = { SCALES, compute, PATRONES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HC_SCALES = api;
})(typeof window !== 'undefined' ? window : globalThis);
