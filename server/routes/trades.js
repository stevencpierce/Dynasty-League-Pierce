'use strict';

const express = require('express');
const { db } = require('../db');
const { requireAuth, requireCommissioner } = require('../auth');
const { validateTrade } = require('../services/tradeValidator');

const router = express.Router();

// Analyze a proposed trade without saving it.
router.post('/validate', requireAuth, (req, res) => {
  const result = validateTrade(req.body || {});
  res.json(result);
});

// Save a proposed trade along with its validation snapshot.
router.post('/', requireAuth, (req, res) => {
  const payload = req.body || {};
  const validation = validateTrade(payload);
  const info = db
    .prepare('INSERT INTO trades (status, payload, validation, notes, created_by) VALUES (?, ?, ?, ?, ?)')
    .run('proposed', JSON.stringify(payload), JSON.stringify(validation), payload.notes || null, req.session.userId);
  res.status(201).json({ id: info.lastInsertRowid, validation });
});

router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM trades ORDER BY created_at DESC LIMIT 100').all();
  res.json({
    trades: rows.map((r) => ({
      ...r,
      payload: safeJson(r.payload),
      validation: r.validation ? safeJson(r.validation) : null,
    })),
  });
});

// Commissioner: update trade status (accepted/vetoed/completed).
router.put('/:id/status', requireCommissioner, (req, res) => {
  const { status } = req.body || {};
  const allowed = ['proposed', 'accepted', 'vetoed', 'completed'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'invalid status' });
  const info = db.prepare('UPDATE trades SET status = ? WHERE id = ?').run(status, req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Trade not found' });
  res.json({ ok: true });
});

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

module.exports = router;
