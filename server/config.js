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
    leagueName: 'Dynasty League Pierce',
    currentSeason: 2026,
    // Reality Sports Online style defaults (dollars).
    salaryCap: 200000000, // $200M
    rosterMax: 25,
    rosterMin: 18,
    minContractYears: 1,
    maxContractYears: 4,
  },
};
