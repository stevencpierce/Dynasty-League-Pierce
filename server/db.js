'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// --- Schema -----------------------------------------------------------------
db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'member',     -- 'commissioner' | 'member'
  team_id       INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS teams (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  owner_name TEXT,
  division   TEXT,
  logo_url   TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS players (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  name     TEXT NOT NULL,
  position TEXT,
  nfl_team TEXT
);

-- A contract ties a player to a team. Per-season salaries are stored as a JSON
-- object: {"2026": 12000000, "2027": 13000000}. status: active|cut|expired.
CREATE TABLE IF NOT EXISTS contracts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id    INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_id      INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  start_season INTEGER NOT NULL,
  end_season   INTEGER NOT NULL,
  salaries     TEXT NOT NULL DEFAULT '{}',
  status       TEXT NOT NULL DEFAULT 'active',
  signed_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Dead cap from cuts/buyouts charged to a team for a given season.
CREATE TABLE IF NOT EXISTS dead_cap (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  season  INTEGER NOT NULL,
  amount  INTEGER NOT NULL DEFAULT 0,
  note    TEXT
);

CREATE TABLE IF NOT EXISTS draft_picks (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id       INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  original_team INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  season        INTEGER NOT NULL,
  round         INTEGER NOT NULL,
  note          TEXT
);

CREATE TABLE IF NOT EXISTS standings (
  team_id        INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  season         INTEGER NOT NULL,
  wins           INTEGER NOT NULL DEFAULT 0,
  losses         INTEGER NOT NULL DEFAULT 0,
  ties           INTEGER NOT NULL DEFAULT 0,
  points_for     REAL    NOT NULL DEFAULT 0,
  points_against REAL    NOT NULL DEFAULT 0,
  PRIMARY KEY (team_id, season)
);

-- Trades are stored with their full payload + validation result as JSON so the
-- analyzer's verdict is preserved alongside the proposal.
CREATE TABLE IF NOT EXISTS trades (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  status      TEXT NOT NULL DEFAULT 'proposed',  -- proposed|accepted|vetoed|completed
  payload     TEXT NOT NULL,
  validation  TEXT,
  notes       TEXT,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bylaws (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT UNIQUE NOT NULL,
  title      TEXT NOT NULL,
  category   TEXT NOT NULL DEFAULT 'General',
  body_md    TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Every edit to a bylaw is snapshotted here = full amendment history.
CREATE TABLE IF NOT EXISTS bylaw_revisions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  bylaw_id   INTEGER NOT NULL REFERENCES bylaws(id) ON DELETE CASCADE,
  body_md    TEXT NOT NULL,
  note       TEXT,
  edited_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS records (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  category    TEXT NOT NULL,
  description TEXT NOT NULL,
  holder      TEXT,
  value       TEXT,
  season      INTEGER
);

CREATE TABLE IF NOT EXISTS awards (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  season  INTEGER NOT NULL,
  name    TEXT NOT NULL,
  team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  winner  TEXT,
  note    TEXT
);

CREATE TABLE IF NOT EXISTS power_rankings (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  season  INTEGER NOT NULL,
  week    INTEGER NOT NULL DEFAULT 0,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  rank    INTEGER NOT NULL,
  note    TEXT
);
`);

// --- Settings helpers -------------------------------------------------------
const getSettingStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
const setSettingStmt = db.prepare(
  'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
);

function getSetting(key, fallback = null) {
  const row = getSettingStmt.get(key);
  if (!row) return fallback;
  try {
    return JSON.parse(row.value);
  } catch {
    return row.value;
  }
}

function setSetting(key, value) {
  setSettingStmt.run(key, JSON.stringify(value));
}

function allSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = {};
  for (const r of rows) {
    try {
      out[r.key] = JSON.parse(r.value);
    } catch {
      out[r.key] = r.value;
    }
  }
  return out;
}

module.exports = { db, getSetting, setSetting, allSettings };
