// Capturas de las pantallas clave (390 y 1200 px, claro y oscuro, castellano y catalán) con Chrome real y DATOS SEMBRADOS inventados (lib-sembrar.mjs).
// El servidor corre en un directorio temporal; ningún dato real se toca. Imprime también los desbordes horizontales y los errores de consola/CSP.
// Uso: node tools/capturas.mjs [carpeta]       (por defecto docs/capturas)      Chrome: ruta habitual o variable CHROME;  SOLO=login,mine para repetir solo esas pantallas
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openChrome, sleep } from './lib-chrome.mjs';
import { arrancar } from './lib-sembrar.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'docs', 'capturas'));
const ONLY = process.env.SOLO ? process.env.SOLO.split(',') : null;
fs.mkdirSync(OUT, { recursive: true });

const S = await arrancar();
const B = await openChrome({ prefix: 'historia-capturas' });
const problemas = [];
const metrics = (w, h, mobile) => B.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
const tema = (theme) => B.media(theme);

async function ir(hash) { await B.ev(`location.hash = ${JSON.stringify(hash)}`); await sleep(600); await B.waitFor('!document.querySelector(".dc-spinner")', 6000); await sleep(150); }
async function foto(file, w, mobile) {
  const alto = await B.ev('Math.min(5200, Math.max(document.documentElement.scrollHeight, 640))');
  await metrics(w, alto, mobile); await sleep(250);
  const desborda = await B.ev('document.documentElement.scrollWidth > window.innerWidth + 1');
  if (desborda) problemas.push('DESBORDE horizontal ' + file);
  const r = await B.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, file + '.png'), Buffer.from(r.result.data, 'base64'));
}

// pantallas: [id, ruta, quién, idiomas]
const D = { es: 'es', ca: 'ca' };
const SC = [
  ['login', null, 'nadie', ['es', 'ca']],
  ['login-error', 'LOGIN_ERR', 'nadie', ['es']],
  ['alumnado-inicio', '#/', 'marta', ['es', 'ca']],
  ['alumnado-resumen', '#/chart/{CH}', 'marta', ['es', 'ca']],
  ['alumnado-constantes', '#/chart/{CH}/constantes', 'marta', ['es', 'ca']],
  ['alumnado-balance', '#/chart/{CH}/balance', 'marta', ['es']],
  ['alumnado-cuidados', '#/chart/{CH}/cuidados', 'marta', ['es']],
  ['alumnado-evolucion', '#/chart/{CH}/evolucion', 'marta', ['es']],
  ['alumnado-medicacion', '#/chart/{CH}/mar', 'marta', ['es']],
  ['alumnado-ficha', '#/chart/{CH}/ficha', 'marta', ['es']],
  ['alumnado-imprimir', '#/chart/{CH}/imprimir', 'marta', ['es']],
  ['ayuda', '#/help', 'marta', ['es']],
  ['prof-pacientes', '#/', 'admin', ['es', 'ca']],
  ['prof-paciente', '#/patient/{PID}', 'admin', ['es']],
  ['prof-seguimiento', '#/patient/{PID}/seguimiento', 'admin', ['es', 'ca']],
  ['prof-asignar', '#/patient/{PID}/asignar', 'admin', ['es']],
  ['prof-historia', '#/chart/{CH}', 'admin', ['es']],
  ['prof-alumnado', '#/students', 'admin', ['es']],
  ['prof-notas', '#/grades', 'admin', ['es']],
  ['prof-catalogo', '#/catalog', 'admin', ['es']],
  ['prof-auditoria', '#/audit', 'admin', ['es']],
];
const VISTAS = [[390, 844, true, 'm'], [1200, 900, false, 'd']];

try {
  for (const lang of ['es', 'ca']) {
    for (const quien of ['nadie', 'marta', 'admin']) {
      const lista = SC.filter((s) => s[2] === quien && s[3].includes(lang) && (!ONLY || ONLY.includes(s[0])));
      if (!lista.length) continue;
      await B.send('Network.clearBrowserCookies'); await metrics(1200, 900, false); await tema('claro');
      if (quien === 'nadie') await B.goto(S.base + '/');
      else {
        const o = quien === 'admin' ? { email: 'admin@example.test', name: 'Administración Ejemplo', admin: true, lang } : { email: S.personas.find((p) => p[0] === quien)[2], name: S.personas.find((p) => p[0] === quien)[1], lang };
        await B.goto(S.ssoUrl(o));
      }
      await B.waitFor('!!document.querySelector(".dc-main > *")', 6000); await sleep(400);
      if (quien !== 'nadie' && (await B.ev('document.documentElement.lang')) !== lang) { await B.click('.hdr-lang'); await sleep(700); }
      for (const [id, ruta, , ] of lista) {
        for (const theme of ['claro', 'oscuro']) {
          for (const [w, h, mobile, tag] of VISTAS) {
            await metrics(w, h, mobile); await tema(theme);
            if (quien === 'nadie') {
              await B.goto(S.base + '/'); await B.ev(`localStorage.setItem('x','')`); await sleep(300);
              if (lang === 'ca') await B.clickText(/Català|Catal/); await sleep(300);
              if (id === 'login-error') {
                await B.ev('document.querySelector(".en-card details").open = true');
                await B.setVal('#en-pw', 'contraseña-equivocada'); await B.submit('#en-pw'); await B.waitFor('!!document.querySelector("#en-msg .dc-alert")', 4000);
              }
            } else await ir(ruta.replace('{CH}', S.charts.marta.id).replace('{PID}', S.pid));
            await foto(`${lang}-${id}-${tag}-${theme}`, w, mobile);
          }
        }
        console.log('  hecho ' + lang + ' ' + id);
      }
    }
  }
  if (B.log.length) problemas.push(...B.log.map((l) => 'CONSOLA ' + l));
} finally { await B.close(); await S.stop(); }
console.log(problemas.length ? 'PROBLEMAS:\n' + [...new Set(problemas)].join('\n') : 'Sin desbordes ni errores de consola.');
console.log('Capturas en ' + OUT + ' (' + fs.readdirSync(OUT).length + ' ficheros)');
