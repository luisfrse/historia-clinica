// «Dispositivo de confianza» de Historia clínica en un Chrome REAL (sin interfaz) con autenticador virtual. NO es un móvil real.
// Recorre: casilla desmarcada con la caducidad (14 días) -> entrada sin casilla (no hay token) -> entrada con casilla (alta, cookie HttpOnly/Secure/Strict) -> lista en Seguridad ->
// reapertura sin pedir nada -> rotación -> confirmación reforzada al descargar un informe (contraseña) -> reutilización de un token rotado (familia revocada) -> caducidad ->
// alta también con huella -> revocar desde Seguridad -> salir quita la confianza -> el alumnado no puede.
// Con --capturas <carpeta>: casilla, lista y confirmación a 390 y 1200, claro y oscuro.   Uso: npm run e2e:confianza      (Chrome en la ruta habitual, o la variable CHROME)
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openChrome, sleep } from './lib-chrome.mjs';
import { arrancar } from './lib-sembrar.mjs';

const capIdx = process.argv.indexOf('--capturas'), CAP = capIdx > 0 ? path.resolve(process.argv[capIdx + 1]) : null;
if (CAP) fs.mkdirSync(CAP, { recursive: true });
const results = [];
const check = (name, ok, extra = '') => { results.push([name, !!ok]); console.log((ok ? 'OK    ' : 'FALLO ') + name + (ok || extra === '' ? '' : ' -> ' + extra)); };

const S = await arrancar();
const dbFile = path.join(S.dir, 'historia.db');
const dbx = (sql, ...p) => { const d = new DatabaseSync(dbFile); try { d.prepare(sql).run(...p); } finally { d.close(); } };
const dbq = (sql, ...p) => { const d = new DatabaseSync(dbFile); try { return d.prepare(sql).all(...p); } finally { d.close(); } };
const csp = (await fetch(S.base + '/')).headers.get('content-security-policy') || '';
const TRUST = '__Host-hc-trust';
let B;
try {
  B = await openChrome({ prefix: 'historia-confianza', csp });
  const { send, ev, waitFor, click, clickText, setVal, submit, goto, text, log, media } = B;
  await send('Network.enable');
  const A = await B.addAuthenticator();
  const api = (method, p, body) => ev(`fetch(${JSON.stringify(p)},{method:${JSON.stringify(method)},credentials:'same-origin',headers:{'X-Requested-With':'historia','Content-Type':'application/json'}${body === undefined ? '' : ',body:JSON.stringify(' + JSON.stringify(body) + ')'}}).then(async r=>JSON.stringify({s:r.status,j:await r.json().catch(()=>null)}))`).then((x) => JSON.parse(x));
  const cookies = async () => (await send('Network.getCookies', { urls: [S.base] })).result.cookies;
  const trustCookie = async () => (await cookies()).find((c) => c.name === TRUST);
  const dropSess = () => send('Network.deleteCookies', { name: 'hid', url: S.base });
  const inApp = (ms = 12000) => waitFor('!!document.querySelector(".dc-nav .dc-nav__item")', ms);
  const onLogin = () => waitFor('!!document.querySelector(".en-card details") && !!document.querySelector("#en-pw")', 10000);
  const shot = async (name) => {
    if (!CAP) return;
    for (const th of ['claro', 'oscuro']) for (const w of [390, 1200]) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: w === 390 ? 900 : 800, deviceScaleFactor: 1, mobile: w === 390 });
      await media(th); await sleep(300);
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
      fs.writeFileSync(path.join(CAP, `${name}-${w}-${th}.png`), Buffer.from(r.result.data, 'base64'));
    }
    await send('Emulation.clearDeviceMetricsOverride'); await media('claro');
  };
  const openLogin = async () => { await goto(S.base + '/'); await onLogin(); await ev('document.querySelector(".en-card details").open = true'); await waitFor('!!document.querySelector("#dc-trust")'); };
  const pwLogin = async ({ trust }) => { await openLogin(); if (trust) await click('#dc-trust'); await setVal('#en-pw', S.adminPw); await submit('#en-pw'); return inApp(); };
  const logout = () => api('POST', '/api/logout', {});

  // 1. la casilla
  await openLogin();
  check('la casilla «Confiar en este dispositivo» existe, desmarcada por defecto, con la caducidad (14 días) a la vista',
    await ev('(()=>{const c=document.querySelector("#dc-trust");return !!c&&c.checked===false&&document.querySelector(".dc-entrada__trust").innerText.includes("14 días")})()'), await text());
  log.length = 0;

  // 2. sin casilla no hay token
  check('entrada completa (contraseña de administración) sin marcar la casilla: entra', await pwLogin({ trust: false }));
  check('sin casilla NO hay cookie de confianza ni dispositivo en el servidor', !(await trustCookie()) && dbq('SELECT COUNT(*) n FROM dc_trust')[0].n === 0 && (await api('GET', '/api/trust/list')).j.devices.length === 0);
  check('pedir el alta sin la petición explícita (trust:true) se rechaza', (await api('POST', '/api/trust/enroll', {})).s === 400);
  await logout();

  // 3. con casilla: alta
  await openLogin(); await click('#dc-trust'); await ev('document.querySelector("#dc-trust").scrollIntoView()'); await shot('casilla-marcada');
  await setVal('#en-pw', S.adminPw); await submit('#en-pw');
  check('entrada completa marcando la casilla: entra', await inApp());
  const c1 = await trustCookie();
  check('alta: cookie __Host-hc-trust HttpOnly + Secure + SameSite=Strict, 256 bits (43 caracteres) y 14 días', c1 && c1.httpOnly && c1.secure && c1.sameSite === 'Strict' && /^[A-Za-z0-9_-]{43}$/.test(c1.value) && Math.round((c1.expires - Date.now() / 1000) / 86400) === 14, JSON.stringify(c1 && { ...c1, value: '…' }));
  check('el servidor guarda solo el hash y lo audita', dbq('SELECT hash FROM dc_trust')[0].hash.length === 64 && !JSON.stringify(dbq('SELECT * FROM dc_trust')).includes(c1.value) && dbq("SELECT COUNT(*) n FROM audit WHERE action='confianza-alta'")[0].n === 1);
  await ev('location.hash = "#/security"');
  check('Seguridad muestra «Dispositivos de confianza» con este dispositivo, último uso y caducidad', await waitFor('!!document.querySelector("#confianza-lista li") && document.querySelector("#confianza-lista").innerText.includes("Este dispositivo")'), await ev('(document.querySelector("#dc-confianza")||{}).innerText'));
  await ev('document.querySelector("#dc-confianza").scrollIntoView()'); await shot('lista');

  // 4. reapertura sin pedir nada, rotación
  await dropSess(); await goto(S.base + '/');
  check('reapertura: entra directo, sin contraseña ni huella', await inApp(), await ev('document.body.innerText.slice(0,120)'));
  const c2 = await trustCookie();
  check('rotación: el token cambió en el uso', c2 && c2.value !== c1.value);
  const me = (await api('GET', '/api/me')).j;
  check('la sesión restaurada es de confianza y SIN acceso reciente; es la cuenta de administración', me.trusted === true && me.strong === false && me.role === 'admin');

  // 5. confirmación reforzada al descargar
  await goto(S.base + '/#/grades'); await waitFor('!!document.querySelector("a[href=\\"/api/grades.csv\\"]")');
  check('exportar sin confirmar está bloqueado en el servidor (403 stepup)', (await api('GET', '/api/grades.csv')).j && (await api('GET', '/api/grades.csv')).s === 403);
  await click('a[href="/api/grades.csv"]');
  check('descargar las notas desde una sesión de confianza abre «Confirma que eres tú»', await waitFor('!!document.querySelector("dialog[open]") && document.querySelector("dialog[open]").innerText.includes("Confirma que eres tú")'), await text());
  await shot('stepup');
  await setVal('dialog[open] input[type=password]', 'mala-mala-mala'); await click('#su-go');
  check('contraseña mala en la confirmación: error claro', await waitFor('document.querySelector("dialog[open]")?.innerText.includes("No coincide")'));
  await setVal('dialog[open] input[type=password]', S.adminPw); await click('#su-go');
  check('con la contraseña correcta la confirmación se cierra y la sesión pasa a acceso reciente', await waitFor('!document.querySelector("dialog[open]")') && (await api('GET', '/api/me')).j.strong === true, await text());
  check('ya con acceso reciente, exportar no vuelve a pedir', (await api('GET', '/api/grades.csv')).s === 200);
  dbx('UPDATE sessions SET strong_until = 0');
  check('al caducar el acceso reciente, vuelve a pedir confirmar', (await api('GET', '/api/grades.csv')).j.error === 'stepup');
  const rawStu = await S.call('POST', '/api/trust/enroll', { trust: true }, S.ck.marta);
  check('el alumnado no puede dar de alta un dispositivo de confianza', rawStu.status === 403);

  // 6. reutilización de un token ya rotado
  const good = await trustCookie();
  dbx('UPDATE dc_trust SET rotated = rotated - 60000'); await dropSess(); await send('Network.setCookie', { name: TRUST, value: c1.value, url: S.base, httpOnly: true, secure: true, sameSite: 'Strict' });
  await goto(S.base + '/');
  check('un token ya rotado reaparece: no entra, vuelve la entrada completa y se limpia la cookie', await onLogin() && !(await trustCookie()));
  check('la familia queda revocada (también el token legítimo más reciente) y auditada', dbq('SELECT COUNT(*) n FROM dc_trust')[0].n === 0 && dbq("SELECT COUNT(*) n FROM audit WHERE action='confianza-reutilizado'")[0].n === 1);
  await send('Network.setCookie', { name: TRUST, value: good.value, url: S.base, httpOnly: true, secure: true, sameSite: 'Strict' }); await goto(S.base + '/');
  check('el token legítimo tampoco entra: hay que repetir el acceso completo', await onLogin());

  // 7. caducidad
  await pwLogin({ trust: true }); await dropSess();
  dbx('UPDATE dc_trust SET expires = ?', Date.now() - 1000); await goto(S.base + '/');
  check('pasados los 14 días sin usarlo: caduca, vuelve la entrada completa y se retira la cookie', await onLogin() && !(await trustCookie()) && dbq("SELECT COUNT(*) n FROM audit WHERE action='confianza-caducada'")[0].n === 1);

  // 8. alta también con huella
  await pwLogin({ trust: false }); await ev('location.hash = "#/security"');
  await waitFor('document.body.innerText.includes("Añadir este dispositivo")'); await clickText(/Añadir este dispositivo/);
  check('se añade la llave del dispositivo (asistente con comprobación)', await waitFor('document.body.innerText.includes("Listo: la próxima vez")', 12000), await text());
  await logout(); await goto(S.base + '/'); await onLogin(); await waitFor('document.body.innerText.includes("Entrar con huella o llave")');
  await click('#dc-trust'); await clickText(/Entrar con huella o llave/);
  check('entrar con huella marcando la casilla también da de alta el dispositivo', await inApp(10000) && !!(await trustCookie()) && dbq('SELECT COUNT(*) n FROM dc_trust')[0].n === 1, await text());
  // la sesión de confianza confirma con la llave
  await dropSess(); await goto(S.base + '/'); await inApp();
  await goto(S.base + '/#/grades'); await waitFor('!!document.querySelector("a[href=\\"/api/grades.csv\\"]")'); await click('a[href="/api/grades.csv"]');
  await waitFor('!!document.querySelector("#su-key")'); await click('#su-key');
  check('la confirmación con huella o llave concede el acceso reciente', await waitFor('!document.querySelector("dialog[open]")', 10000) && (await api('GET', '/api/me')).j.strong === true, await text());

  // 9. revocar desde Seguridad (con una sesión de acceso completo: revocar cierra las sesiones de ese dispositivo); salir
  await logout(); await pwLogin({ trust: true });
  await ev('location.hash = "#/security"'); await waitFor('!!document.querySelector("#confianza-lista li")');
  await clickText(/^Revocar$/, 'document.querySelector("#confianza-lista")'); await waitFor('!!document.querySelector("dialog[open]")'); await clickText(/^Revocar$/, 'document.querySelector("dialog[open]")');
  check('revocar este dispositivo desde Seguridad: desaparece de la lista y se retira la cookie', await waitFor('!!document.querySelector("#confianza-vacio")') && !(await trustCookie()) && dbq('SELECT COUNT(*) n FROM dc_trust')[0].n === 0, await ev('(document.querySelector("#dc-confianza")||{}).innerText'));
  await logout(); await pwLogin({ trust: true }); await logout();
  check('«Salir» quita también la confianza de este dispositivo', dbq('SELECT COUNT(*) n FROM dc_trust')[0].n === 0 && !(await trustCookie()));

  // 10. limpieza
  check('ningún alert/confirm/prompt nativo en todo el recorrido', !log.some((l) => l.startsWith('DIALOGO NATIVO')));
  const bad = log.filter((l) => !/adguard|FETCHERR|favicon|Failed to load resource|net::ERR_ABORTED|status of (401|403)/i.test(l));
  check('sin errores de consola ni de CSP', bad.length === 0, bad.slice(0, 3).join(' | ').slice(0, 500));
} catch (e) { console.error(e); check('la prueba terminó sin excepciones', false, String(e && e.message)); }
finally { if (B) await B.close(); await S.stop(); }
const failed = results.filter((r) => !r[1]);
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones correctas`);
process.exit(failed.length ? 1 : 0);
