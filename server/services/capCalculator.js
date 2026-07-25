'use strict';

const { db, getSetting } = require('../db');

// Returns the salary a contract counts against the cap in a given season (0 if
// the contract is not active that season).
function contractSalaryForSeason(contract, season) {
  if (contract.status !== 'active') return 0;
  if (season < contract.start_season || season > contract.end_season) return 0;
  let salaries = {};
  try {
    salaries = JSON.parse(contract.salaries || '{}');
  } catch {
    salaries = {};
  }
  const v = salaries[String(season)];
  return Number.isFinite(Number(v)) ? Number(v) : 0;
}

// Active contract count for a team in a season (= roster size for that season).
function teamRosterSize(teamId, season) {
  const rows = db
    .prepare("SELECT * FROM contracts WHERE team_id = ? AND status = 'active'")
    .all(teamId);
  return rows.filter((c) => season >= c.start_season && season <= c.end_season).length;
}

// Full cap picture for one team in one season.
function teamCap(teamId, season) {
  const cap = Number(getSetting('salaryCap', 0));
  const contracts = db
    .prepare("SELECT * FROM contracts WHERE team_id = ? AND status = 'active'")
    .all(teamId);

  let committed = 0;
  let activeCount = 0;
  for (const c of contracts) {
    const s = contractSalaryForSeason(c, season);
    if (season >= c.start_season && season <= c.end_season) activeCount += 1;
    committed += s;
  }

  const deadRow = db
    .prepare('SELECT COALESCE(SUM(amount),0) dead FROM dead_cap WHERE team_id = ? AND season = ?')
    .get(teamId, season);
  const dead = Number(deadRow.dead) || 0;

  const used = committed + dead;
  return {
    teamId,
    season,
    cap,
    committed,
    deadCap: dead,
    used,
    available: cap - used,
    rosterSize: activeCount,
    overCap: used > cap,
  };
}

// Cap table for every team in a season, sorted by available space descending.
function capTable(season) {
  const teams = db.prepare('SELECT id, name FROM teams ORDER BY name').all();
  return teams
    .map((t) => ({ name: t.name, ...teamCap(t.id, season) }))
    .sort((a, b) => b.available - a.available);
}

// A contract's length in years (inclusive of both endpoints).
function contractLength(c) {
  return Math.max(1, c.end_season - c.start_season + 1);
}

// How many active multi-year contracts a team holds by length, vs. the league
// limits. Returns e.g. { "2": { used: 7, max: 6, over: true }, ... }.
function contractLengthUsage(teamId) {
  const limits = getSetting('contractLimits', {}) || {};
  const contracts = db
    .prepare("SELECT * FROM contracts WHERE team_id = ? AND status = 'active'")
    .all(teamId);
  const counts = {};
  for (const c of contracts) {
    const len = contractLength(c);
    counts[len] = (counts[len] || 0) + 1;
  }
  const usage = {};
  for (const len of new Set([...Object.keys(counts), ...Object.keys(limits)])) {
    const max = limits[len];
    const used = counts[len] || 0;
    usage[len] = {
      used,
      max: max == null ? null : Number(max),
      over: max != null && used > Number(max),
    };
  }
  return usage;
}

module.exports = {
  contractSalaryForSeason,
  teamRosterSize,
  teamCap,
  capTable,
  contractLength,
  contractLengthUsage,
};
