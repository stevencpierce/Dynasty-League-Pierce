'use strict';

const express = require('express');
const { getSetting } = require('../db');
const { capTable, teamCap, contractLengthUsage } = require('../services/capCalculator');

const router = express.Router();

router.get('/table', (req, res) => {
  const season = Number(req.query.season) || Number(getSetting('currentSeason'));
  res.json({ season, cap: Number(getSetting('salaryCap', 0)), table: capTable(season) });
});

router.get('/team/:id', (req, res) => {
  const season = Number(req.query.season) || Number(getSetting('currentSeason'));
  res.json({ ...teamCap(Number(req.params.id), season), contractLimits: contractLengthUsage(Number(req.params.id)) });
});

module.exports = router;
