'use strict';
/* Plantilla y caso de ejemplo en catalán para la importación de casos (el lector de import.js entiende los dos idiomas). */

const TEMPLATE_CA = `Ets docent d'Infermeria i TCAI i prepares un cas clínic FICTICI i realista per a una simulació d'història clínica amb alumnat.
Respon NOMÉS amb el text de sota, ja emplenat, sense explicacions, sense Markdown, sense negretes i sense canviar els noms dels apartats ni dels camps.
Regles:
- Totes les dades són inventades (res de persones reals). Tria noms i cognoms habituals.
- Dates en format AAAA-MM-DD. Hores en format HH:MM. Pes en kg i talla en cm, només nombres.
- Sexe: H, D o A (altre). Grup sanguini: A+, A-, B+, B-, AB+, AB-, 0+ o 0-.
- Tipus d'aïllament: cap o un o diversos de contacte, gotes, aeri i protector (les precaucions estàndard es donen sempre i no s'escriuen). Si hi ha aïllament, explica a «Aïllament» el microorganisme i les mesures.
- Via d'administració: oral, topica, sc, im, iv, inhalatoria, rectal, oftalmica, otica, sng o altra.
- Si una dada no escau, deixa el camp buit (no escriguis «N/A»).
- Cada prescripció i cada prova o esdeveniment va en una línia que comença per «- », amb les dades separades per « | ». A «Hores» posa «si cal» per a les pautes a demanda.
- Els dies són els de l'ingrés: «Dia 1» és el primer. Reparteix les proves i els esdeveniments al llarg de diversos dies perquè el cas avanci.
- Substitueix les línies d'exemple per les prescripcions i els esdeveniments reals del cas, i no copiïs les línies de capçalera.
- Escriu de 2 a 3 consignes diferents per poder reutilitzar el cas amb activitats diferents. Tipus de tasca: nota, constants, balanc, cura, medicacio, escala, valoracio, pla, informe i lliure (sense comprovació automàtica). Afegeix «x2» després del tipus per demanar dos registres. Si l'alumnat treballa el cas dia a dia, indica al final de cada tasca el número del dia en què s'ha de fer (per exemple «| 2»); si la tasca val per a qualsevol dia, no hi posis res. Si alguna cosa no escau, esborra les línies d'exemple.
- «Notes del docent» i «Objectius d'aprenentatge» només els veurà el professorat: inclou l'evolució esperada, els punts clau i els errors típics de l'alumnat.
- Escriu el contingut en català.

DADES DEL CAS QUE VULL (edita-ho abans d'enviar-lo):
Tema o patologia: (per exemple, MPOC aguditzada)
Nivell de l'alumnat: (per exemple, 1r de Cures Auxiliars d'Infermeria)
Idioma del contingut: català
Durada de l'ingrés: (per exemple, 5 dies)

[FITXA]
Nom:
Cognoms:
Sexe:
Data de naixement:
NHC:
Unitat:
Habitació:
Llit:
Data d'ingrés:
Procedència:
Motiu d'ingrés:
Malaltia actual:
Diagnòstic mèdic:
Antecedents personals:
Antecedents familiars:
Intervencions prèvies:
Medicació habitual:
Pes:
Talla:
Grup sanguini:
Autonomia:
Hàbits:
Situació social:
Contacte familiar:
Dieta:
Tipus d'aïllament: (cap, o un o diversos separats per comes: contacte, gotes, aeri, protector)
Aïllament: (detalls: microorganisme, motiu, mesures)
Riscos:
Notes del docent:
Objectius d'aprenentatge:
Temes: (de 2 a 4 etiquetes separades per comes, per exemple: Respiratori, MPOC, Oxigenoteràpia)

[AL·LÈRGIES]
- Agent | Reacció | Gravetat (lleu, moderada o greu)
(Si no té al·lèrgies conegudes, escriu només: Cap)

[PRESCRIPCIONS]
- Fàrmac | Dosi | Via | Pauta | Hores | Dies | Notes
- Exemple: Paracetamol | 1 g | oral | cada 8 h | 08:00, 16:00, 00:00 | 1-5 | Si febre o dolor
- Exemple a demanda: Salbutamol | 2 inhalacions | inhalatoria | si cal | si cal | 1-5 |

[CONSIGNES]
Consigna 1: (títol curt de l'activitat)
Enunciat: (què ha de fer l'alumnat, en 2 a 4 frases adreçades a ell)
Lliurament: (AAAA-MM-DD, opcional)
Tasques:
- tipus | Text de la tasca | Dia (opcional)
- Exemple: constants x2 | Registra les constants d'ingrés i una segona presa | 1
- Exemple: medicacio | Administra la medicació del matí | 2
- Exemple: lliure | Prepara una explicació per a la pacient
Consigna 2: (una altra activitat diferent amb el mateix pacient)
Enunciat:
Tasques:
- tipus | Text de la tasca

[PROVES I ESDEVENIMENTS]
- Dia | prova o esdeveniment | Títol | Descripció
- Exemple: 1 | prova | Radiografia de tòrax | Infiltrat a la base dreta.
- Exemple: 2 | esdeveniment | Febre vespertina | Temperatura de 38,5 °C a les 18:00.
`;

const EXAMPLE_CA = `[FITXA]
Nom: Carme
Cognoms: Ruiz Soto
Sexe: D
Edat: 78
NHC: 482915
Unitat: Medicina Interna
Habitació: 214
Llit: B
Data d'ingrés: avui
Procedència: Urgències
Motiu d'ingrés: Dispnea progressiva de 3 dies, augment de la tos amb expectoració purulenta i febre de 38 °C.
Malaltia actual: Pacient amb MPOC coneguda que acudeix a Urgències per empitjorament de la dispnea habitual, amb tos i expectoració groguenca-verdosa des de fa 3 dies. A Urgències: SpO2 88 % basal, sibilàncies espiratòries i crepitants a la base dreta. Radiografia amb infiltrat a la base dreta. S'ingressa amb diagnòstic d'aguditzament de MPOC amb probable pneumònia.
Diagnòstic mèdic: Aguditzament de MPOC amb pneumònia de base dreta
Antecedents personals: MPOC GOLD III des de fa 8 anys. Hipertensió arterial. Exfumadora de 40 paquets-any (va deixar de fumar fa 5 anys). Diabetis mellitus tipus 2 en tractament oral.
Antecedents familiars: Pare traspassat per infart de miocardi. Mare amb diabetis.
Intervencions prèvies: Colecistectomia fa 15 anys.
Medicació habitual: Enalapril 10 mg/24 h, metformina 850 mg/12 h, tiotropi inhalat 18 mcg/24 h, salbutamol a demanda.
Pes: 68
Talla: 158
Grup sanguini: A+
Autonomia: Independent per a les activitats bàsiques; necessita ajuda amb les escales. Fa servir ulleres.
Hàbits: Dorm unes 6 hores, amb dos coixins. Dieta diabètica. Camina cada dia a prop de casa.
Situació social: Vídua, viu sola en un primer pis amb ascensor. La seva filla la visita cada dia.
Contacte familiar: Marta (filla) 600 000 000
Dieta: Diabètica, 1.500 kcal, sense sal afegida
Tipus d'aïllament: cap
Aïllament: Cap
Riscos: Risc de caigudes per dispnea i debilitat. Risc d'úlceres per pressió moderat. Risc de broncoaspiració baix.
Notes del docent: Cas per treballar la valoració respiratòria i l'oxigenoteràpia. Errors típics: pujar el flux d'oxigen sense control en pacient amb MPOC (objectiu SpO2 88-92 %), no registrar la glucèmia en pacient diabètica que rep corticoides, i oblidar l'educació sanitària sobre l'ús de l'inhalador. Evolució esperada: millora progressiva amb febre el dia 2 i pic de glucèmia el dia 3.
Temes: Respiratori, MPOC, Oxigenoteràpia, Diabetis
Objectius d'aprenentatge: Valorar el patró respiratori. Administrar oxigenoteràpia amb seguretat. Aplicar els cinc correctes en l'administració de medicació (via oral, intravenosa, subcutània i inhalada). Registrar constants i balanç hídric. Elaborar un pla de cures amb el problema «Neteja ineficaç de les vies aèries».

[AL·LÈRGIES]
- Penicil·lina | Urticària generalitzada | greu
- Làtex | Dermatitis de contacte | lleu

[PRESCRIPCIONS]
- Paracetamol | 1 g | oral | cada 8 h | 08:00, 16:00, 00:00 | 1-5 | Si dolor o febre superior a 37,5 °C
- Levofloxacina | 500 mg | iv | cada 24 h | 10:00 | 1-5 | Diluït en 100 ml de sèrum fisiològic, en 60 minuts
- Enoxaparina | 40 mg | sc | cada 24 h | 20:00 | 1-5 | Rotar la zona de punció
- Prednisona | 30 mg | oral | cada 24 h | 08:00 | 1-4 | Amb l'esmorzar
- Metformina | 850 mg | oral | cada 12 h | 09:00, 21:00 | 1-5 | Amb els àpats
- Salbutamol | 2 inhalacions | inhalatoria | si cal | si cal | 1-5 | Si dispnea o sibilàncies

[CONSIGNES]
Consigna 1: Torn de matí: valoració i administració
Enunciat: Ets la infermera del torn de matí i reps la pacient a planta. Valora-la, registra les seves constants, administra la medicació de les 08:00 i anota l'evolució del torn.
Tasques:
- constants x2 | Registra les constants d'ingrés i una segona presa a mig matí
- valoracio | Fes la valoració per patrons (respiratori i activitat)
- medicacio x2 | Administra el paracetamol i la levofloxacina del matí
- nota | Escriu una nota d'evolució del torn
Consigna 2: Pla de cures i educació sanitària
Enunciat: Amb la informació dels tres primers dies, elabora el pla de cures de la pacient i prepara l'educació per a l'alta.
Tasques:
- pla | Elabora el problema «Neteja ineficaç de les vies aèries» amb objectiu i intervencions | 4
- escala | Valora el risc d'úlceres amb l'escala Braden | 4
- informe | Redacta l'informe de traspàs al torn següent | 5
- lliure | Prepara una explicació breu sobre l'ús de l'inhalador | 5

[PROVES I ESDEVENIMENTS]
- 1 | prova | Radiografia de tòrax | Infiltrat alveolar a la base dreta. Hiperinsuflació pulmonar.
- 1 | prova | Analítica d'ingrés | Leucòcits 14.200/µl, PCR 85 mg/l, glucèmia 168 mg/dl, creatinina 0,9 mg/dl.
- 2 | esdeveniment | Febre vespertina | Temperatura de 38,5 °C a les 18:00, amb calfreds. S'administra paracetamol i s'avisa el metge.
- 2 | prova | Gasometria arterial | pH 7,36, pCO2 48 mmHg, pO2 62 mmHg, HCO3 27 mEq/l amb 2 l/min d'oxigen.
- 3 | esdeveniment | Hiperglucèmia per corticoides | Glucèmia capil·lar de 245 mg/dl abans del sopar. S'avisa el metge, que pauta insulina ràpida segons pauta.
- 4 | prova | Hemocultius | Negatius a les 72 hores.
- 5 | esdeveniment | Preparació de l'alta | Saturació 94 % sense oxigen. Es revisa amb la pacient l'ús de l'inhalador i els signes d'alarma.
`;

module.exports = { TEMPLATE_CA, EXAMPLE_CA };
