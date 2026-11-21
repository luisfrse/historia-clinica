// Prueba de extremo a extremo en un Chrome REAL (sin interfaz). NO es un móvil real ni Safari.
// Recorre: cabeceras (CSP estricta, fuentes en local), entrada (error con intentos que quedan, administración), panel de profesorado, alumnado por SSO,
// pestañas de la historia, alta de un registro, anulación con diálogo propio (sin diálogos nativos), desbordes a 360 px y objetivos táctiles < 44 px.
// Uso: npm run e2e      (Chrome en la ruta habitual de Windows/Linux, o la variable CHROME)
import { openChrome, sleep } from './lib-chrome.mjs';
import { arrancar } from './lib-sembrar.mjs';

const results = [];
const check = (name, ok, extra = '') => { results.push([name, !!ok]); console.log((ok ? 'OK    ' : 'FALLO ') + name + (extra ? ' · ' + extra : '')); };

const S = await arrancar();
const r0 = await fetch(S.base + '/');
const csp = r0.headers.get('content-security-policy') || '';
check('CSP estricta (sin unsafe-inline ni orígenes externos)', csp.includes("style-src 'self'") && csp.includes("font-src 'self'") && !/unsafe-inline|https?:\/\//.test(csp), csp);
const f = await fetch(S.base + '/dc/fuentes/bricolage-latin.woff2');
check('fuentes en local con tipo font/woff2', f.ok && (f.headers.get('content-type') || '') === 'font/woff2');
const m = await fetch(S.base + '/manifest.webmanifest');
check('manifiesto servido', m.ok && (await m.json()).theme_color === '#0d1a2a');

const B = await openChrome({ prefix: 'historia-e2e', csp });
const metrics = (w, h, mobile) => B.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
const pequenos = () => B.ev(`[...document.querySelectorAll('.dc-main button, .dc-main a, .dc-main input:not([type=hidden]), .dc-main select, .dc-nav a, .dc-header a, .dc-header button')].filter(e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && r.height < 43.5 && !(e.tagName === 'A' && !e.className && e.closest('p,li,td,dd,dt,div.sub')) && e.type !== 'checkbox' && e.type !== 'radio'; }).map(e => (e.tagName + '.' + e.className + ' ' + (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 25) + ' ' + Math.round(e.getBoundingClientRect().height))).slice(0, 12)`);
const desborda = () => B.ev('document.documentElement.scrollWidth > window.innerWidth + 1');
const ir = async (hash) => { await B.ev(`location.hash = ${JSON.stringify(hash)}`); await sleep(500); await B.waitFor('!document.querySelector(".dc-spinner")', 6000); await sleep(150); };
try {
  await metrics(1200, 900, false); await B.goto(S.base + '/');
  check('entrada: se ve el botón del Campus y el acceso de profesorado', await B.waitFor('!!document.querySelector(".en-card a[href*=campus]") && !!document.querySelector(".en-card details")'));
  await B.ev('document.querySelector(".en-card details").open = true');
  await B.setVal('#en-pw', 'mal-puesta'); await B.submit('#en-pw');
  check('entrada: contraseña mala dice cuántos intentos quedan', await B.waitFor('/Quedan|Queden|Te quedan|Et queden/.test(document.querySelector("#en-msg") ? document.querySelector("#en-msg").textContent : "") && document.querySelector("#en-pw").getAttribute("aria-invalid") === "true"'));
  await B.setVal('#en-pw', S.adminPw); await B.submit('#en-pw');
  check('administración entra con su contraseña', await B.waitFor('!!document.querySelector(".dc-nav .dc-nav__item")'));
  check('navegación del profesorado: 5 destinos', (await B.ev('document.querySelectorAll(".dc-nav .dc-nav__item").length')) === 5);
  check('panel de profesorado: resumen y alerta de sin asignar', await B.waitFor('document.querySelectorAll(".kpi").length >= 4 && !!document.querySelector(".kpi.alert")'));
  for (const h of ['#/students', '#/catalog', '#/grades', '#/audit', '#/patient/' + S.pid, '#/patient/' + S.pid + '/seguimiento', '#/patient/' + S.pid + '/asignar', '#/chart/' + S.charts.marta.id, '#/chart/' + S.charts.marta.id + '/eval', '#/import', '#/help']) {
    await ir(h);
    check('profesorado ' + h + ': pinta y sin desborde', (await B.ev('!!document.querySelector(".dc-main > *") && !document.querySelector(".dc-state--error")')) && !(await desborda()));
  }
  await ir('#/patient/' + S.pid + '/seguimiento');
  check('seguimiento: barras de progreso por historia y alerta de sin actividad', (await B.ev('document.querySelectorAll(".prog .dc-meter").length')) >= 3 && (await B.ev('document.body.innerText.includes("Sin actividad")')));
  // alumnado
  await B.send('Network.clearBrowserCookies'); await B.goto(S.ssoUrl({ email: S.personas[0][2], name: S.personas[0][1], lang: 'es' }));
  check('alumnado: sin navegación inferior y con tarjetas', await B.waitFor('!!document.querySelector(".pt-card") && document.querySelector("#nav").hidden'));
  await metrics(360, 740, true);
  check('alumnado 360 px: sin desborde en inicio', !(await desborda()));
  await ir('#/chart/' + S.charts.marta.id);
  for (const tab of ['', '/evolucion', '/constantes', '/balance', '/cuidados', '/mar', '/escalas', '/valoracion', '/plan', '/pruebas', '/informe', '/ficha', '/imprimir']) {
    await ir('#/chart/' + S.charts.marta.id + tab);
    check('alumnado 360 px pestaña ' + (tab || 'resumen') + ': pinta y sin desborde', (await B.ev('!!document.querySelector(".dc-main > *") && !document.querySelector(".dc-state--error")')) && !(await desborda()));
  }
  await ir('#/chart/' + S.charts.marta.id + '/constantes');
  check('constantes: gráficas con tabla alternativa y marca de fuera de rango', (await B.ev('document.querySelectorAll("svg.lc").length')) >= 5 && (await B.ev('document.querySelectorAll(".chart details.alt table").length')) >= 5 && (await B.ev('document.querySelectorAll(".flow .hi svg, .flow .lo svg").length')) > 0);
  const chico = await pequenos(); check('objetivos táctiles ≥ 44 px en constantes (360 px)', Array.isArray(chico) && chico.length === 0, JSON.stringify(chico));
  for (const tab of ['', '/balance', '/mar', '/cuidados', '/evolucion']) { await ir('#/chart/' + S.charts.marta.id + tab); const c = await pequenos(); check('objetivos táctiles ≥ 44 px en ' + (tab || 'resumen') + ' (360 px)', Array.isArray(c) && c.length === 0, JSON.stringify(c)); }
  // nota nueva
  await ir('#/chart/' + S.charts.marta.id + '/evolucion');
  await B.clickText(/^\+ Nota/); await sleep(300);
  await B.setVal('.formp textarea', 'Nota de prueba escrita por la prueba de extremo a extremo.');
  await B.submit('.formp textarea');
  check('registro: se guarda la nota', await B.waitFor('document.body.innerText.includes("Nota de prueba escrita")'));
  // anular con diálogo propio
  await B.clickText(/^Anular/); await sleep(300);
  check('anular: diálogo propio con motivo (no prompt nativo)', await B.waitFor('!!document.querySelector("dialog[open] textarea")'));
  await B.setVal('dialog[open] textarea', 'Anulada por la prueba'); await B.submit('dialog[open] textarea');
  check('anular: queda tachada con el motivo', await B.waitFor('document.body.innerText.includes("Anulada por la prueba")'));
  // tema oscuro por botón
  await metrics(1200, 900, false); await B.ev('document.querySelector(".dc-header button[aria-label^=Tema], .dc-header button[title^=Cambiar]") && 0');
  const sinNativos = !B.log.some((l) => l.startsWith('DIALOGO NATIVO'));
  check('sin diálogos nativos (alert/confirm/prompt)', sinNativos);
  const errs = B.log.filter((l) => !/status of 401|adguard|FETCHERR/i.test(l));
  check('sin errores de consola ni violaciones de CSP', errs.length === 0, errs.slice(0, 3).join(' | '));
} finally { await B.close(); await S.stop(); }
const fallos = results.filter((r) => !r[1]);
console.log('\n' + (results.length - fallos.length) + ' de ' + results.length + ' comprobaciones correctas' + (fallos.length ? '; FALLAN: ' + fallos.map((r) => r[0]).join(' | ') : ''));
process.exit(fallos.length ? 1 : 0);
