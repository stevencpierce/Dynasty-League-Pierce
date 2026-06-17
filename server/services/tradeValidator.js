'use strict';

const { db, getSetting } = require('../db');
const { teamCap, contractSalaryForSeason } = require('./capCalculator');

/*
 Trade payload shape:
 {
   season: 2026,                       // season the trade takes effect (defaults to currentSeason)
   assets: [
     { type: 'contract', contractId, from, to },
     { type: 'pick',     pickId,     from, to }
   ]
 }
 `from`/`to` are team ids. Validation simulates the post-trade roster + cap for
 each involved team and returns a pass/fail verdict with human-readable reasons.
*/
function validateTrade(payload) {
  const season = Number(payload.season) || Number(getSetting('currentSeason'));
  const cap = Number(getSetting('salaryCap', 0));
  const rosterMax = Number(getSetting('rosterMax', 0));
  const assets = Array.isArray(payload.assets) ? payload.assets : [];

  const reasons = [];
  const warnings = [];

  // Gather involved teams.
  const teamIds = new Set();
  for (const a of assets) {
    if (a.from) teamIds.add(Number(a.from));
    if (a.to) teamIds.add(Number(a.to));
  }
  if (teamIds.size < 2) {
    return { valid: false, season, reasons: ['A trade must involve at least two teams.'], warnings, teams: [] };
  }

  // Pre-load contracts referenced in the trade.
  const contractCache = {};
  for (const a of assets.filter((x) => x.type === 'contract')) {
    const c = db.prepare('SELECT * FROM contracts WHERE id = ?').get(Number(a.contractId));
    if (!c) {
      reasons.push(`Contract #${a.contractId} not found.`);
      continue;
    }
    contractCache[a.contractId] = c;
    if (c.team_id !== Number(a.from)) {
      reasons.push(`Contract #${a.contractId} is not owned by the sending team.`);
    }
    if (c.status !== 'active') {
      reasons.push(`Contract #${a.contractId} is not active and cannot be traded.`);
    }
  }

  const teamResults = [];
  for (const teamId of teamIds) {
    const before = teamCap(teamId, season);
    let salaryDelta = 0;
    let rosterDelta = 0;
    const incoming = [];
    const outgoing = [];

    for (const a of assets) {
      if (a.type !== 'contract') continue;
      const c = contractCache[a.contractId];
      if (!c) continue;
      const seasonSalary = contractSalaryForSeason(c, season);
      const playerRow = db.prepare('SELECT name FROM players WHERE id = ?').get(c.player_id);
      const label = playerRow ? playerRow.name : `player#${c.player_id}`;
      const onRosterThisSeason = season >= c.start_season && season <= c.end_season;
      if (Number(a.to) === teamId) {
        salaryDelta += seasonSalary;
        if (onRosterThisSeason) rosterDelta += 1;
        incoming.push({ label, salary: seasonSalary });
      }
      if (Number(a.from) === teamId) {
        salaryDelta -= seasonSalary;
        if (onRosterThisSeason) rosterDelta -= 1;
        outgoing.push({ label, salary: seasonSalary });
      }
    }

    const usedAfter = before.used + salaryDelta;
    const rosterAfter = before.rosterSize + rosterDelta;
    const teamName = (db.prepare('SELECT name FROM teams WHERE id = ?').get(teamId) || {}).name || `Team #${teamId}`;

    if (usedAfter > cap) {
      reasons.push(
        `${teamName} would be $${((usedAfter - cap) / 1e6).toFixed(2)}M over the cap in ${season}.`
      );
    }
    if (rosterMax && rosterAfter > rosterMax) {
      reasons.push(`${teamName} would have ${rosterAfter} players, over the ${rosterMax} max.`);
    }

    teamResults.push({
      teamId,
      teamName,
      incoming,
      outgoing,
      capBefore: before.used,
      capAfter: usedAfter,
      availableAfter: cap - usedAfter,
      rosterBefore: before.rosterSize,
      rosterAfter,
    });
  }

  return {
    valid: reasons.length === 0,
    season,
    cap,
    rosterMax,
    reasons,
    warnings,
    teams: teamResults,
  };
}

module.exports = { validateTrade };
