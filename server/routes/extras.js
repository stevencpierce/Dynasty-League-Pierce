'use strict';

const express = require('express');
const { db } = require('../db');
const { requireCommissioner } = require('../auth');

const router = express.Router();

// ---- Record book -----------------------------------------------------------
router.get('/records', (req, res) => {
  res.json({ records: db.prepare('SELECT * FROM records ORDER BY category, season DESC').all() });
});

router.post('/records', requireCommissioner, (req, res) => {
  const { category, description, holder, value, season } = req.body || {};
  if (!category || !description) return res.status(400).json({ error: 'category and description required' });
  const info = db
    .prepare('INSERT INTO records (category, description, holder, value, season) VALUES (?, ?, ?, ?, ?)')
    .run(category, description, holder || null, value || null, season || null);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.delete('/records/:id', requireCommissioner, (req, res) => {
  db.prepare('DELETE FROM records WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---- Awards / champions ----------------------------------------------------
router.get('/awards', (req, res) => {
  const rows = db
    .prepare(
      `SELECT a.*, t.name AS team_name FROM awards a
       LEFT JOIN teams t ON t.id = a.team_id ORDER BY a.season DESC, a.name`
    )
    .all();
  res.json({ awards: rows });
});

router.post('/awards', requireCommissioner, (req, res) => {
  const { season, name, team_id, winner, note } = req.body || {};
  if (!season || !name) return res.status(400).json({ error: 'season and name required' });
  const info = db
    .prepare('INSERT INTO awards (season, name, team_id, winner, note) VALUES (?, ?, ?, ?, ?)')
    .run(season, name, team_id || null, winner || null, note || null);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.delete('/awards/:id', requireCommissioner, (req, res) => {
  db.prepare('DELETE FROM awards WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---- Power rankings --------------------------------------------------------
router.get('/power-rankings', (req, res) => {
  const season = Number(req.query.season);
  const week = req.query.week != null ? Number(req.query.week) : null;
  let rows;
  if (week != null) {
    rows = db
      .prepare(
        `SELECT pr.*, t.name AS team_name FROM power_rankings pr
         JOIN teams t ON t.id = pr.team_id
         WHERE pr.season = ? AND pr.week = ? ORDER BY pr.rank`
      )
      .all(season, week);
  } else {
    rows = db
      .prepare(
        `SELECT pr.*, t.name AS team_name FROM power_rankings pr
         JOIN teams t ON t.id = pr.team_id
         WHERE pr.season = ? ORDER BY pr.week DESC, pr.rank`
      )
      .all(season);
  }
  res.json({ rankings: rows });
});

router.post('/power-rankings', requireCommissioner, (req, res) => {
  const { season, week, team_id, rank, note } = req.body || {};
  if (!season || !team_id || !rank) return res.status(400).json({ error: 'season, team_id, rank required' });
  const info = db
    .prepare('INSERT INTO power_rankings (season, week, team_id, rank, note) VALUES (?, ?, ?, ?, ?)')
    .run(season, week || 0, team_id, rank, note || null);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.delete('/power-rankings/:id', requireCommissioner, (req, res) => {
  db.prepare('DELETE FROM power_rankings WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
