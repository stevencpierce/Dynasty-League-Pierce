'use strict';

const express = require('express');
const { db } = require('../db');
const { requireCommissioner } = require('../auth');

const router = express.Router();

// Minimal RFC-4180-ish CSV parser (handles quoted fields, embedded commas/quotes).
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    if (row.some((c) => c.trim() !== '')) rows.push(row);
  }
  return rows;
}

function parseSalaries(spec) {
  // "2026:12000000;2027:13000000" -> { "2026": 12000000, ... }
  const out = {};
  for (const part of String(spec || '').split(/[;|]/)) {
    const [season, amount] = part.split(':');
    if (season && amount) {
      const s = season.trim();
      const a = Number(String(amount).replace(/[$,_\s]/g, ''));
      if (s && Number.isFinite(a)) out[s] = a;
    }
  }
  return out;
}

function findOrCreateTeam(name) {
  const existing = db.prepare('SELECT id FROM teams WHERE name = ?').get(name);
  if (existing) return existing.id;
  return db.prepare('INSERT INTO teams (name) VALUES (?)').run(name).lastInsertRowid;
}

function findOrCreatePlayer(name, position, nflTeam) {
  const existing = db.prepare('SELECT id FROM players WHERE name = ?').get(name);
  if (existing) return existing.id;
  return db
    .prepare('INSERT INTO players (name, position, nfl_team) VALUES (?, ?, ?)')
    .run(name, position || null, nflTeam || null).lastInsertRowid;
}

/*
 Import rosters + contracts from CSV. Expected header (case-insensitive):
   team, player, position, nfl_team, start_season, end_season, salaries
 where `salaries` looks like "2026:12000000;2027:13000000".
 Body: { csv: "<raw csv text>" }
*/
router.post('/contracts', requireCommissioner, (req, res) => {
  const { csv } = req.body || {};
  if (!csv || typeof csv !== 'string') return res.status(400).json({ error: 'csv text required' });

  const rows = parseCsv(csv);
  if (rows.length < 2) return res.status(400).json({ error: 'CSV needs a header row and at least one data row' });

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name) => header.indexOf(name);
  const ti = idx('team');
  const pi = idx('player');
  if (ti === -1 || pi === -1) {
    return res.status(400).json({ error: "CSV must include at least 'team' and 'player' columns" });
  }
  const posI = idx('position');
  const nflI = idx('nfl_team');
  const startI = idx('start_season');
  const endI = idx('end_season');
  const salI = idx('salaries');

  const result = { teams: 0, players: 0, contracts: 0, errors: [] };
  const teamSeen = new Set();
  const playerSeen = new Set();

  const tx = db.transaction(() => {
    for (let r = 1; r < rows.length; r++) {
      const cols = rows[r];
      const teamName = (cols[ti] || '').trim();
      const playerName = (cols[pi] || '').trim();
      if (!teamName || !playerName) {
        result.errors.push(`Row ${r + 1}: missing team or player`);
        continue;
      }
      const teamId = findOrCreateTeam(teamName);
      if (!teamSeen.has(teamName)) {
        teamSeen.add(teamName);
        result.teams++;
      }
      const playerId = findOrCreatePlayer(
        playerName,
        posI > -1 ? (cols[posI] || '').trim() : null,
        nflI > -1 ? (cols[nflI] || '').trim() : null
      );
      if (!playerSeen.has(playerName)) {
        playerSeen.add(playerName);
        result.players++;
      }
      const salaries = salI > -1 ? parseSalaries(cols[salI]) : {};
      const seasons = Object.keys(salaries).map(Number);
      const start = startI > -1 && cols[startI] ? Number(cols[startI]) : (seasons.length ? Math.min(...seasons) : null);
      const end = endI > -1 && cols[endI] ? Number(cols[endI]) : (seasons.length ? Math.max(...seasons) : null);
      if (!start || !end) {
        result.errors.push(`Row ${r + 1} (${playerName}): could not determine contract seasons`);
        continue;
      }
      db.prepare(
        `INSERT INTO contracts (player_id, team_id, start_season, end_season, salaries, status)
         VALUES (?, ?, ?, ?, ?, 'active')`
      ).run(playerId, teamId, start, end, JSON.stringify(salaries));
      result.contracts++;
    }
  });
  tx();

  res.json(result);
});

module.exports = router;
