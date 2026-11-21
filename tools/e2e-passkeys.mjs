// Recorrido de las llaves de acceso (huella) del profesorado en un Chrome REAL con autenticador virtual (CDP). NO es un movil real, ni Safari, ni Windows Hello.
// Lanza su propio servidor con datos inventados y temporales y su propio Chrome, y los cierra al terminar. Uso: npm run e2e:llaves
import { openChrome, sleep } from './lib-chrome.mjs';
import { arrancar } from './lib-sembrar.mjs';

const results = [];
const check = (name, ok, extra = '') => { results.push([name, !!ok]); console.log((ok ? 'OK    ' : 'FALLO ') + name + (ok || extra === '' ? '' : ' -> ' + extra)); };

const S = await arrancar();
const csp = (await fetch(S.base + '/')).headers.get('content-security-policy') || '';
const email = 'profe.llaves@example.test', pw = 'una-contrasena-larga-1';
check('alta de profesorado de prueba', (await S.call('POST', '/api/teachers', { email, name: 'Profe de Llaves', password: pw }, S.admin)).status === 200);

const B = await openChrome({ prefix: 'historia-llaves', csp });
const desborda = () => B.ev('document.documentElement.scrollWidth > window.innerWidth + 1');
const logout = async () => { await B.ev("fetch('/api/logout',{method:'POST',headers:{'X-Requested-With':'historia','Content-Type':'application/json'},body:'{}'}).then(()=>1)"); };
const passwordLogin = async () => {
  await B.goto(S.base + '/'); await B.waitFor('!!document.querySelector(".en-card details")'); await B.ev('document.querySelector(".en-card details").open = true');
  await B.setVal('#en-em', email); await B.setVal('#en-pw', pw); await B.submit('#en-pw');
  return B.waitFor('!!document.querySelector(".dc-nav .dc-nav__item")');
};
try {
  await B.send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false });
  const A = await B.addAuthenticator();
  // sin llaves: el boton no se ofrece
  await B.goto(S.base + '/'); await B.waitFor('!!document.querySelector(".en-card details")'); await sleep(500);
  check('entrada sin llaves en el servidor: no aparece «Entrar con huella»', !(await B.ev('document.body.innerText.includes("Entrar con huella o llave")')));
  check('entrar con la contrasena (profesorado)', await passwordLogin());
  check('cabecera: acceso «Huella y llaves de acceso» solo para profesorado', await B.ev('!!document.querySelector(".dc-header a[href=\\"#/security\\"]")'));
  await B.ev('location.hash = "#/security"');
  check('Seguridad: aparece el asistente con «Añadir este dispositivo»', await B.waitFor('!!document.querySelector("#dc-llaves") && document.body.innerText.includes("Añadir este dispositivo")'));
  check('Seguridad: sin desborde a 1200 px y a 360 px', !(await desborda()) && (await B.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 740, deviceScaleFactor: 1, mobile: true }), await sleep(200), !(await desborda())));
  await B.send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false });
  await B.clickText(/Añadir este dispositivo/);
  check('asistente: crea la llave y COMPRUEBA que se puede entrar con ella', await B.waitFor('document.body.innerText.includes("Listo: la próxima vez")', 12000), await B.text());
  const creds = (await B.send('WebAuthn.getCredentials', { authenticatorId: A })).result.credentials.map((c) => ({ rk: c.isResidentCredential, rp: c.rpId }));
  check('la llave del dispositivo es descubrible y del dominio correcto', creds.length === 1 && creds[0].rk === true && creds[0].rp === 'localhost', JSON.stringify(creds));
  check('la lista muestra la llave (una sola: aviso de anadir otro dispositivo)', await B.waitFor('document.querySelectorAll("#dc-llaves .dc-list > li").length === 1 && document.body.innerText.includes("Solo tienes una llave")'));
  // entrar con la huella
  await logout(); await B.goto(S.base + '/');
  check('con marca local el panel de profesorado se abre solo y ofrece la huella', await B.waitFor('document.querySelector(".en-card details").open && document.body.innerText.includes("Entrar con huella o llave")'));
  await B.clickText(/Entrar con huella o llave/);
  check('entrar con huella abre la sesion del profesorado', await B.waitFor('!!document.querySelector(".dc-nav .dc-nav__item")', 10000));
  check('es la cuenta del profesor (no otra)', (await B.ev('fetch("/api/me").then(r=>r.json()).then(j=>j.email)')) === email);
  // la contrasena sigue entrando
  await logout(); check('la contrasena sigue entrando con la llave registrada', await passwordLogin());
  // un autenticador sin llaves: mensaje claro, no se rompe
  await logout(); await B.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId: A }); await B.addAuthenticator(); await B.goto(S.base + '/');
  await B.waitFor('document.body.innerText.includes("Entrar con huella o llave")'); await B.clickText(/Entrar con huella o llave/);
  check('dispositivo sin llave: explica que hay que usar la contrasena y anadir el dispositivo', await B.waitFor('/no tiene llave|Cancelado|Se agotó/.test(document.querySelector("#en-msg").innerText)', 8000), await B.ev('document.querySelector("#en-msg").innerText'));
  // quitar la llave
  check('contrasena tras el intento fallido', await passwordLogin());
  await B.ev('location.hash = "#/security"'); await B.waitFor('document.querySelectorAll("#dc-llaves .dc-list > li").length === 1');
  await B.clickText(/Quitar/, 'document.querySelector("#dc-llaves")'); await sleep(300);
  await B.clickText(/Quitar/, 'document.querySelector("#dc-llaves dialog")');
  check('quitar la llave la saca de la lista', await B.waitFor('document.querySelectorAll("#dc-llaves .dc-list > li").length === 0'));
  await logout(); await B.goto(S.base + '/'); await B.waitFor('!!document.querySelector(".en-card details")'); await sleep(600);
  check('sin llaves vuelve a no ofrecerse la huella', !(await B.ev('document.body.innerText.includes("Entrar con huella o llave")')));
  // se ignoran el ruido del entorno (extensiones tipo AdGuard que inyectan scripts, el reescrito de cabeceras de esta herramienta) y el 401 esperado de /api/me antes de entrar
  const ruido = B.log.filter((l) => !/adguard|FETCHERR|status of 401.*\/api\/(me|passkeys)/i.test(l));
  check('sin errores de consola, sin dialogos nativos y sin infracciones de CSP de la app', ruido.length === 0, JSON.stringify(ruido.slice(0, 4)));
} catch (e) { check('el recorrido no se interrumpe', false, String(e && e.stack || e)); }
await B.close(); S.stop();
const bad = results.filter((r) => !r[1]);
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' comprobaciones');
process.exit(bad.length ? 1 : 0);
