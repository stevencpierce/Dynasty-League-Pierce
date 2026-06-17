'use strict';

const express = require('express');
const { allSettings, setSetting } = require('../db');
const { requireCommissioner } = require('../auth');

const router = express.Router();

// Numeric settings that should always be coerced to numbers.
const NUMERIC_KEYS = new Set([
  'currentSeason',
  'salaryCap',
  'rosterMax',
  'rosterMin',
  'minContractYears',
  'maxContractYears',
]);

router.get('/', (req, res) => {
  res.json({ settings: allSettings() });
});

router.put('/', requireCommissioner, (req, res) => {
  const updates = req.body || {};
  for (const [k, v] of Object.entries(updates)) {
    setSetting(k, NUMERIC_KEYS.has(k) ? Number(v) : v);
  }
  res.json({ settings: allSettings() });
});

module.exports = router;
