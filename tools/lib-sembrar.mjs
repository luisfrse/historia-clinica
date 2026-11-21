// Arranca un servidor de Historia clínica en un directorio temporal y lo llena de DATOS INVENTADOS (personas ficticias, correos example.test)
// para las capturas y la prueba de extremo a extremo. No toca ninguna base real: DATA_DIR es temporal y el puerto es libre.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { free, sleep } from './lib-chrome.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SSO = require('../lib/sso');

export async function arrancar() {
  const port = await free(), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'historia-sembrada-'));
  const secret = crypto.randomBytes(24).toString('base64url'), adminPw = crypto.randomBytes(12).toString('base64url') + '-Aa1';
  const base = 'http://localhost:' + port;
  const srv = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(ROOT, 'server.js')], { env: { ...process.env, PORT: String(port), DATA_DIR: dir, SSO_SECRET: secret, ADMIN_PASSWORD: adminPw }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; srv.stdout.on('data', (d) => { out += d; }); srv.stderr.on('data', (d) => { out += d; });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(base + '/')).ok) break; } catch { /* aún no */ } await sleep(100); }

  const token = (o) => SSO.sign({ iss: 'campus', jti: crypto.randomUUID(), iat: Date.now(), exp: Date.now() + 60e3, lang: 'es', subjects: [], ...o }, secret);
  const ssoUrl = (o) => base + '/sso?t=' + encodeURIComponent(token(o));
  async function call(method, url, body, cookie) {
    const r = await fetch(base + url, { method, redirect: 'manual', headers: { 'X-Requested-With': 'historia', 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    let j = null; try { j = await r.json(); } catch { /* sin cuerpo */ }
    return { status: r.status, json: j, cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
  }
  const login = async (o) => { const r = await fetch(ssoUrl(o), { redirect: 'manual' }); return (r.headers.get('set-cookie') || '').split(';')[0]; };
  const hace = (dias, hm) => { const d = new Date(Date.now() - dias * 864e5), p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + hm; };

  // ---- datos inventados ----
  const admin = await login({ email: 'admin@example.test', name: 'Administración Ejemplo', admin: true });
  const personas = [['marta', 'Marta Ferrer Puig', 'marta.ferrer@example.test'], ['pau', 'Pau Soler Vidal', 'pau.soler@example.test'], ['jana', 'Jana Roca Mas', 'jana.roca@example.test'], ['nil', 'Nil Casas Prat', 'nil.casas@example.test']];
  const ck = {}, ids = {};
  for (const lang of ['es', 'ca']) for (const [k, name, email] of personas) { const c = await login({ email, name, lang, subjects: [] }); if (lang === 'es') ck[k] = c; }
  const users = (await call('GET', '/api/users', null, admin)).json.users;
  for (const [k, , email] of personas) ids[k] = users.find((u) => u.email === email).id;
  const ex = (await call('POST', '/api/import/example', { lang: 'es' }, admin)).json;
  const pid = ex.id;
  const cons = (await call('GET', '/api/patients/' + pid + '/consignas', null, admin)).json.consignas;
  const consId = cons && cons[0] ? cons[0].id : null;
  await call('POST', '/api/patients/' + pid + '/assign', { mode: 'individual', user_ids: [ids.marta, ids.pau, ids.jana], consigna_id: consId }, admin);
  // un segundo paciente sin asignar (para que se vea la alerta del panel)
  await call('POST', '/api/patients', { nombre: 'Mateo', apellidos: 'Vidal Roca', sexo: 'M', fecha_nacimiento: '1957-06-14', unidad: 'Medicina interna', habitacion: '212', cama: '1', diagnostico_medico: 'Insuficiencia cardiaca', sin_alergias: true, dieta: 'Hiposódica' }, admin);
  const chartOf = async (k) => (await call('GET', '/api/my/charts', null, ck[k])).json.charts.find((c) => c.patient_id === pid || c.kind === 'individual' || true);
  const charts = {}; for (const k of ['marta', 'pau', 'jana']) charts[k] = (await call('GET', '/api/my/charts', null, ck[k])).json.charts.filter((c) => c.kind === 'individual').pop();
  const cat = (await call('GET', '/api/catalog', null, ck.marta)).json.items;
  const post = (k, type, data, occurred) => call('POST', '/api/charts/' + charts[k].id + '/records', { type, data, occurred }, ck[k]);
  const recs = [];
  const C = [[148, 92, 104, 24, 38.4, 90, 4], [140, 88, 98, 22, 37.8, 91, 3], [134, 82, 92, 20, 37.2, 93, 2], [130, 80, 88, 20, 36.9, 94, 1], [126, 78, 82, 18, 36.8, 96, 1]];
  C.forEach((v, i) => recs.push(post('marta', 'constantes', { ta_sis: v[0], ta_dia: v[1], fc: v[2], fr: v[3], temp: v[4], spo2: v[5], dolor: v[6], glucemia: i === 3 ? 212 : 128 }, hace(2 - Math.floor(i / 2), i % 2 ? '20:00' : '08:00'))));
  [['ingesta', 'oral', 600, 1, '09:00'], ['ingesta', 'iv', 500, 1, '14:00'], ['eliminacion', 'diuresis', 700, 1, '15:00'], ['ingesta', 'oral', 450, 0, '10:00'], ['eliminacion', 'diuresis', 520, 0, '12:00'], ['eliminacion', 'vomito', 80, 0, '13:00']].forEach(([dir_, via, ml, d, hm]) => recs.push(post('marta', 'balance', { dir: dir_, via, ml }, hace(d, hm))));
  recs.push(post('marta', 'nota', { turno: 'M', tipo: 'evolucion', texto: 'Paciente consciente y orientada. Disnea de pequeños esfuerzos, mejor que ayer. Tolera la dieta. Refiere tos con expectoración clara.' }, hace(0, '09:30')));
  recs.push(post('marta', 'nota', { turno: 'T', tipo: 'educacion', texto: 'Se explica el uso del inhalador y la técnica de respiración con labios fruncidos. Repite la técnica correctamente.' }, hace(1, '17:00')));
  const cu = cat.filter((c) => c.roles.split(',').includes('enfermeria')).slice(0, 3);
  cu.forEach((c, i) => recs.push(post('marta', 'cuidado', { catalog_id: c.id, resultado: ['realizado', 'realizado', 'rechazado'][i], obs: i === 2 ? 'Prefiere hacerlo más tarde.' : '' }, hace(0, '1' + i + ':00'))));
  recs.push(post('pau', 'constantes', { ta_sis: 122, ta_dia: 76, fc: 78, fr: 16, temp: 36.6, spo2: 97 }, hace(0, '08:00')));
  recs.push(post('pau', 'nota', { turno: 'M', tipo: 'evolucion', texto: 'Sin cambios relevantes durante el turno.' }, hace(0, '10:00')));
  const done = await Promise.all(recs);
  const bad = done.filter((r) => r.status !== 200);
  if (bad.length) console.error('Aviso: ' + bad.length + ' registros sembrados fallaron: ' + JSON.stringify(bad.slice(0, 2)));
  // un comentario del profesorado y un registro anulado, para ver ambos estados
  const mrecs = (await call('GET', '/api/charts/' + charts.marta.id, null, ck.marta)).json.records;
  const nota = mrecs.find((r) => r.type === 'nota'), cons1 = mrecs.find((r) => r.type === 'constantes');
  if (nota) await call('POST', '/api/charts/' + charts.marta.id + '/comments', { text: 'Buena descripción. Añade qué has hecho ante la disnea.', record_id: nota.id }, admin);
  if (cons1) { await post('marta', 'constantes', { ta_sis: 600, ta_dia: 80 }, hace(0, '07:00')); }
  const mid = (await call('GET', '/api/charts/' + charts.marta.id, null, ck.marta)).json.records.find((r) => r.type === 'balance');
  if (mid) await call('POST', '/api/records/' + mid.id + '/void', { reason: 'Error de transcripción: eran 450 ml.' }, ck.marta);

  const stop = async () => { try { srv.kill(); } catch { /* ya parado */ } await sleep(300); try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* Windows retiene el fichero un momento */ } };
  return { base, port, call, ssoUrl, login, admin, adminPw, ck, ids, charts, pid, consId, personas, stop, log: () => out };
}
