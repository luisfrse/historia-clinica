'use strict';
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'student',            -- admin | teacher | student
  profile TEXT NOT NULL DEFAULT 'enfermeria',      -- enfermeria | tcae (qué puede registrar)
  profile_manual INTEGER NOT NULL DEFAULT 0,       -- 1 = fijado a mano; la sincronización no lo cambia
  lang TEXT NOT NULL DEFAULT 'es', subjects TEXT NOT NULL DEFAULT '[]', active INTEGER NOT NULL DEFAULT 1,
  created TEXT NOT NULL, last_login TEXT);
CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, exp INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sso_used (jti TEXT PRIMARY KEY, exp INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, who TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '');

-- Ficha base del paciente: la define el profesorado; el alumnado nunca la modifica.
CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, data TEXT NOT NULL DEFAULT '{}',
  archived INTEGER NOT NULL DEFAULT 0, created TEXT NOT NULL, created_by INTEGER, updated TEXT);
CREATE TABLE IF NOT EXISTS patient_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  ts TEXT NOT NULL, who TEXT NOT NULL, data TEXT NOT NULL);

-- Historia de trabajo: individual (1 alumno) o de equipo (varios). Los registros pertenecen a la historia.
CREATE TABLE IF NOT EXISTS charts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'individual', name TEXT NOT NULL DEFAULT '', day INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'open', created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS chart_members (
  chart_id INTEGER NOT NULL REFERENCES charts(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'enfermeria', PRIMARY KEY (chart_id, user_id));
CREATE INDEX IF NOT EXISTS idx_cm_user ON chart_members(user_id);
CREATE INDEX IF NOT EXISTS idx_charts_patient ON charts(patient_id);

-- Registros del alumnado: solo se añaden. Se anulan con motivo, nunca se borran ni se editan.
CREATE TABLE IF NOT EXISTS records (
  id INTEGER PRIMARY KEY AUTOINCREMENT, chart_id INTEGER NOT NULL REFERENCES charts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id), author_role TEXT NOT NULL DEFAULT 'enfermeria',
  type TEXT NOT NULL, data TEXT NOT NULL DEFAULT '{}', occurred TEXT NOT NULL, created TEXT NOT NULL,
  replaces_id INTEGER, void_at TEXT, void_by INTEGER, void_reason TEXT);
CREATE INDEX IF NOT EXISTS idx_rec_chart ON records(chart_id, occurred);
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT, chart_id INTEGER NOT NULL REFERENCES charts(id) ON DELETE CASCADE,
  record_id INTEGER REFERENCES records(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id),
  text TEXT NOT NULL, created TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_com_chart ON comments(chart_id);

-- Catálogo editable de cuidados/actividades (propio, no copia de taxonomías con copyright).
CREATE TABLE IF NOT EXISTS catalog (
  id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL DEFAULT 'cuidado', grp TEXT NOT NULL DEFAULT '',
  name_es TEXT NOT NULL, name_ca TEXT NOT NULL DEFAULT '', roles TEXT NOT NULL DEFAULT 'enfermeria,tcae',
  active INTEGER NOT NULL DEFAULT 1, ord INTEGER NOT NULL DEFAULT 0);

-- Prescripciones del caso (las define el profesorado; el alumnado solo registra administraciones).
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  drug TEXT NOT NULL, dose TEXT NOT NULL DEFAULT '', route TEXT NOT NULL DEFAULT 'oral', freq TEXT NOT NULL DEFAULT '',
  times TEXT NOT NULL DEFAULT '', prn INTEGER NOT NULL DEFAULT 0, start_day INTEGER NOT NULL DEFAULT 1, end_day INTEGER,
  notes TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1, created TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_orders_patient ON orders(patient_id);
-- Línea temporal del caso: pruebas complementarias y eventos que se liberan por días.
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'prueba', day INTEGER NOT NULL DEFAULT 1, title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '', created TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_events_patient ON events(patient_id);
-- Evaluación: nota por alumno y caso con rúbrica.
CREATE TABLE IF NOT EXISTS grades (
  chart_id INTEGER NOT NULL REFERENCES charts(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scores TEXT NOT NULL DEFAULT '{}', total REAL, comment TEXT NOT NULL DEFAULT '', published INTEGER NOT NULL DEFAULT 0,
  by_email TEXT NOT NULL DEFAULT '', updated TEXT NOT NULL, PRIMARY KEY (chart_id, user_id));
`;

function open(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, 'historia.db'));
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA secure_delete = ON;');
  db.exec(SCHEMA);
  for (const sql of [`CREATE TABLE IF NOT EXISTS consignas (id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE, title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '', due TEXT NOT NULL DEFAULT '', tasks TEXT NOT NULL DEFAULT '[]', created TEXT NOT NULL)`, 'ALTER TABLE charts ADD COLUMN consigna_id INTEGER', "ALTER TABLE charts ADD COLUMN opens TEXT NOT NULL DEFAULT ''", "ALTER TABLE charts ADD COLUMN closes TEXT NOT NULL DEFAULT ''", 'ALTER TABLE users ADD COLUMN pw TEXT', "ALTER TABLE charts ADD COLUMN pace TEXT NOT NULL DEFAULT 'teacher'", 'ALTER TABLE charts ADD COLUMN max_day INTEGER', "ALTER TABLE charts ADD COLUMN start_date TEXT NOT NULL DEFAULT ''", 'ALTER TABLE records ADD COLUMN day INTEGER', "ALTER TABLE patients ADD COLUMN subjects TEXT NOT NULL DEFAULT '[]'", "ALTER TABLE patients ADD COLUMN topics TEXT NOT NULL DEFAULT '[]'", 'ALTER TABLE sessions ADD COLUMN as_user INTEGER']) { try { db.exec(sql); } catch (_) { /* ya existe */ } }
  const norm = (v) => (v === undefined ? null : v);
  return {
    raw: db,
    all: (sql, ...p) => db.prepare(sql).all(...p.map(norm)),
    get: (sql, ...p) => db.prepare(sql).get(...p.map(norm)),
    run: (sql, ...p) => db.prepare(sql).run(...p.map(norm)),
    tx(fn) { db.exec('BEGIN'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { try { db.exec('ROLLBACK'); } catch (_) {} throw e; } },
    getSetting(k, d = '') { const r = db.prepare('SELECT v FROM settings WHERE k = ?').get(k); return r ? r.v : d; },
    setSetting(k, v) { db.prepare('INSERT INTO settings (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').run(k, String(v)); },
  };
}
module.exports = { open };
