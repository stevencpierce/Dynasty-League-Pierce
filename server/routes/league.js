'use strict';

const express = require('express');
const { db } = require('../db');
const { requireCommissioner } = require('../auth');

const router = express.Router();

// ---- Teams -----------------------------------------------------------------
router.get('/teams', (req, res) => {
  res.json({ teams: db.prepare('SELECT * FROM teams ORDER BY name').all() });
});

router.post('/teams', requireCommissioner, (req, res) => {
  const { name, owner_name, division, logo_url } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const info = db
    .prepare('INSERT INTO teams (name, owner_name, division, logo_url) VALUES (?, ?, ?, ?)')
    .run(name, owner_name || null, division || null, logo_url || null);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/teams/:id', requireCommissioner, (req, res) => {
  const { name, owner_name, division, logo_url } = req.body || {};
  const info = db
    .prepare('UPDATE teams SET name = ?, owner_name = ?, division = ?, logo_url = ? WHERE id = ?')
    .run(name, owner_name || null, division || null, logo_url || null, req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Team not found' });
  res.json({ ok: true });
});

router.delete('/teams/:id', requireCommissioner, (req, res) => {
  db.prepare('DELETE FROM teams WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Full roster (active contracts + player info) for a team.
router.get('/teams/:id/roster', (req, res) => {
  const rows = db
    .prepare(
      `SELECT c.*, p.name AS player_name, p.position, p.nfl_team
       FROM contracts c JOIN players p ON p.id = c.player_id
       WHERE c.team_id = ? ORDER BY c.status, p.name`
    )
    .all(req.params.id);
  const contracts = rows.map((r) => ({ ...r, salaries: safeJson(r.salaries) }));
  res.json({ contracts });
});

// ---- Players ---------------------------------------------------------------
router.get('/players', (req, res) => {
  const q = (req.query.q || '').trim();
  const stmt = q
    ? db.prepare('SELECT * FROM players WHERE name LIKE ? ORDER BY name LIMIT 100')
    : db.prepare('SELECT * FROM players ORDER BY name LIMIT 100');
  res.json({ players: q ? stmt.all(`%${q}%`) : stmt.all() });
});

router.post('/players', requireCommissioner, (req, res) => {
  const { name, position, nfl_team } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const info = db
    .prepare('INSERT INTO players (name, position, nfl_team) VALUES (?, ?, ?)')
    .run(name, position || null, nfl_team || null);
  res.status(201).json({ id: info.lastInsertRowid });
});

// ---- Contracts -------------------------------------------------------------
router.post('/contracts', requireCommissioner, (req, res) => {
  const { player_id, team_id, start_season, end_season, salaries, status } = req.body || {};
  if (!player_id || !team_id || !start_season || !end_season) {
    return res.status(400).json({ error: 'player_id, team_id, start_season, end_season required' });
  }
  const info = db
    .prepare(
      `INSERT INTO contracts (player_id, team_id, start_season, end_season, salaries, status)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      player_id,
      team_id,
      start_season,
      end_season,
      JSON.stringify(salaries || {}),
      status || 'active'
    );
  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/contracts/:id', requireCommissioner, (req, res) => {
  const { team_id, start_season, end_season, salaries, status } = req.body || {};
  const info = db
    .prepare(
      `UPDATE contracts SET team_id = COALESCE(?, team_id),
        start_season = COALESCE(?, start_season),
        end_season = COALESCE(?, end_season),
        salaries = COALESCE(?, salaries),
        status = COALESCE(?, status)
       WHERE id = ?`
    )
    .run(
      team_id || null,
      start_season || null,
      end_season || null,
      salaries ? JSON.stringify(salaries) : null,
      status || null,
      req.params.id
    );
  if (info.changes === 0) return res.status(404).json({ error: 'Contract not found' });
  res.json({ ok: true });
});

// Cut a player: mark contract cut and optionally book dead cap.
router.post('/contracts/:id/cut', requireCommissioner, (req, res) => {
  const { deadCap } = req.body || {};
  const c = db.prepare('SELECT * FROM contracts WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Contract not found' });
  const tx = db.transaction(() => {
    db.prepare("UPDATE contracts SET status = 'cut' WHERE id = ?").run(c.id);
    if (Array.isArray(deadCap)) {
      for (const d of deadCap) {
        if (d && d.season && d.amount) {
          db.prepare('INSERT INTO dead_cap (team_id, season, amount, note) VALUES (?, ?, ?, ?)').run(
            c.team_id,
            d.season,
            d.amount,
            d.note || 'Buyout'
          );
        }
      }
    }
  });
  tx();
  res.json({ ok: true });
});

router.delete('/contracts/:id', requireCommissioner, (req, res) => {
  db.prepare('DELETE FROM contracts WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---- Dead cap --------------------------------------------------------------
router.get('/dead-cap/:teamId', (req, res) => {
  res.json({
    deadCap: db.prepare('SELECT * FROM dead_cap WHERE team_id = ? ORDER BY season').all(req.params.teamId),
  });
});

router.post('/dead-cap', requireCommissioner, (req, res) => {
  const { team_id, season, amount, note } = req.body || {};
  if (!team_id || !season || amount == null) {
    return res.status(400).json({ error: 'team_id, season, amount required' });
  }
  const info = db
    .prepare('INSERT INTO dead_cap (team_id, season, amount, note) VALUES (?, ?, ?, ?)')
    .run(team_id, season, amount, note || null);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.delete('/dead-cap/:id', requireCommissioner, (req, res) => {
  db.prepare('DELETE FROM dead_cap WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---- Draft picks -----------------------------------------------------------
router.get('/picks', (req, res) => {
  const rows = db
    .prepare(
      `SELECT dp.*, t.name AS team_name, ot.name AS original_team_name
       FROM draft_picks dp
       JOIN teams t ON t.id = dp.team_id
       LEFT JOIN teams ot ON ot.id = dp.original_team
       ORDER BY dp.season, dp.round`
    )
    .all();
  res.json({ picks: rows });
});

router.post('/picks', requireCommissioner, (req, res) => {
  const { team_id, original_team, season, round, note } = req.body || {};
  if (!team_id || !season || !round) return res.status(400).json({ error: 'team_id, season, round required' });
  const info = db
    .prepare('INSERT INTO draft_picks (team_id, original_team, season, round, note) VALUES (?, ?, ?, ?, ?)')
    .run(team_id, original_team || team_id, season, round, note || null);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.delete('/picks/:id', requireCommissioner, (req, res) => {
  db.prepare('DELETE FROM draft_picks WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---- Standings -------------------------------------------------------------
router.get('/standings', (req, res) => {
  const season = Number(req.query.season);
  const rows = db
    .prepare(
      `SELECT s.*, t.name AS team_name, t.division FROM standings s
       JOIN teams t ON t.id = s.team_id
       WHERE s.season = ? ORDER BY s.wins DESC, s.points_for DESC`
    )
    .all(season);
  res.json({ standings: rows });
});

router.put('/standings', requireCommissioner, (req, res) => {
  const { team_id, season, wins, losses, ties, points_for, points_against } = req.body || {};
  if (!team_id || !season) return res.status(400).json({ error: 'team_id and season required' });
  db.prepare(
    `INSERT INTO standings (team_id, season, wins, losses, ties, points_for, points_against)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(team_id, season) DO UPDATE SET
       wins = excluded.wins, losses = excluded.losses, ties = excluded.ties,
       points_for = excluded.points_for, points_against = excluded.points_against`
  ).run(team_id, season, wins || 0, losses || 0, ties || 0, points_for || 0, points_against || 0);
  res.json({ ok: true });
});

function safeJson(s) {
  try {
    return JSON.parse(s || '{}');
  } catch {
    return {};
  }
}

module.exports = router;
