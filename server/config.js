'use strict';

const path = require('path');

// Centralized configuration. Most league-specific values live in the DB
// `settings` table (editable in-app); these are process/bootstrap defaults.
module.exports = {
  port: Number(process.env.PORT) || 3000,
  dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'league.db'),
  sessionSecret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
  // Used only the very first time the DB is created.
  bootstrap: {
    commissionerUsername: process.env.COMMISH_USER || 'commissioner',
    commissionerPassword: process.env.COMMISH_PASS || 'changeme',
    leagueName: 'Astoria Dynasty League',
    currentSeason: 2026,
    // Reality Sports Online style defaults (dollars).
    salaryCap: 200000000, // $200M
    rosterMax: 25,
    rosterMin: 18,
    minContractYears: 1,
    maxContractYears: 4,
    // Max active multi-year contracts per team, by length (null = unlimited).
    // 2026: 2-year limit raised from 3 to 6.
    contractLimits: { 4: 1, 3: 2, 2: 6, 1: null },
    practiceSquadSlots: 3,
    irSlots: 2,
    irDfrSlots: 2,
  },
};
