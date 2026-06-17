'use strict';

// Idempotent bootstrap: creates the commissioner account, default league
// settings, and a starter bylaws constitution the first time the DB is empty.
// Safe to run repeatedly — it only inserts what's missing.

const bcrypt = require('bcryptjs');
const { db, getSetting, setSetting } = require('./db');
const config = require('./config');

function ensureSettings() {
  const b = config.bootstrap;
  const defaults = {
    leagueName: b.leagueName,
    currentSeason: b.currentSeason,
    salaryCap: b.salaryCap,
    rosterMax: b.rosterMax,
    rosterMin: b.rosterMin,
    minContractYears: b.minContractYears,
    maxContractYears: b.maxContractYears,
  };
  for (const [k, v] of Object.entries(defaults)) {
    if (getSetting(k) === null) setSetting(k, v);
  }
}

function ensureCommissioner() {
  const existing = db.prepare("SELECT COUNT(*) c FROM users WHERE role = 'commissioner'").get();
  if (existing.c > 0) return null;
  const hash = bcrypt.hashSync(config.bootstrap.commissionerPassword, 10);
  db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(
    config.bootstrap.commissionerUsername,
    hash,
    'commissioner'
  );
  return {
    username: config.bootstrap.commissionerUsername,
    password: config.bootstrap.commissionerPassword,
  };
}

const STARTER_BYLAWS = [
  {
    slug: 'constitution',
    title: 'League Constitution & Overview',
    category: 'Foundational',
    sort_order: 0,
    body_md: `# League Constitution

This is the home of all **Dynasty League Pierce** bylaws. Edit any article in-app;
every change is saved to the amendment history so we always know what the rules
were at any point in time.

## How rules change
1. A member proposes an amendment.
2. The league votes per the voting rules below.
3. The commissioner records the amendment here.

> Tip: Use clear, numbered rules. The trade & cap tools reference the values in
> **League Settings**, so keep dollar/roster figures there in sync with these articles.
`,
  },
  {
    slug: 'salary-cap',
    title: 'Salary Cap & Contracts',
    category: 'Finance',
    sort_order: 1,
    body_md: `# Salary Cap & Contracts

- The league operates under a hard salary cap (see **League Settings** for the current figure).
- Contracts run multiple seasons with a set salary per season.
- Cutting a player may incur **dead cap** charged in the season(s) of the cut.
- A team may **never** exceed the cap. Proposed trades that put a team over the cap are invalid.

_Adjust the specific dollar amounts and dead-cap formula to match your RSO settings._
`,
  },
  {
    slug: 'rosters',
    title: 'Roster Rules',
    category: 'Roster',
    sort_order: 2,
    body_md: `# Roster Rules

- Maximum roster size and minimum roster size are defined in **League Settings**.
- Rosters must satisfy minimum size by the in-season deadline.
- IR/taxi rules go here.
`,
  },
  {
    slug: 'trades',
    title: 'Trades',
    category: 'Transactions',
    sort_order: 3,
    body_md: `# Trades

- Trades may include players (with their contracts) and draft picks.
- Both teams must remain cap-compliant after the trade — the **Trade Analyzer** enforces this.
- Veto rules and trade deadline go here.
`,
  },
  {
    slug: 'draft',
    title: 'Rookie Draft & Picks',
    category: 'Draft',
    sort_order: 4,
    body_md: `# Rookie Draft & Picks

- Draft order, rounds, and pick-trading rules go here.
`,
  },
  {
    slug: 'voting',
    title: 'Voting & Amendments',
    category: 'Governance',
    sort_order: 5,
    body_md: `# Voting & Amendments

- Quorum and majority needed to pass an amendment.
- Voting window length.
- Commissioner tie-breaking authority.
`,
  },
];

function ensureBylaws() {
  const count = db.prepare('SELECT COUNT(*) c FROM bylaws').get();
  if (count.c > 0) return 0;
  const insert = db.prepare(
    'INSERT INTO bylaws (slug, title, category, body_md, sort_order) VALUES (?, ?, ?, ?, ?)'
  );
  const insertRev = db.prepare(
    'INSERT INTO bylaw_revisions (bylaw_id, body_md, note) VALUES (?, ?, ?)'
  );
  const tx = db.transaction(() => {
    for (const b of STARTER_BYLAWS) {
      const info = insert.run(b.slug, b.title, b.category, b.body_md, b.sort_order);
      insertRev.run(info.lastInsertRowid, b.body_md, 'Initial version');
    }
  });
  tx();
  return STARTER_BYLAWS.length;
}

function seed({ quiet = false } = {}) {
  ensureSettings();
  const cred = ensureCommissioner();
  const bylawsAdded = ensureBylaws();
  if (!quiet) {
    if (cred) {
      console.log('\n=== Commissioner account created ===');
      console.log(`  username: ${cred.username}`);
      console.log(`  password: ${cred.password}`);
      console.log('  >>> Log in and change this password immediately. <<<\n');
    }
    if (bylawsAdded) console.log(`Seeded ${bylawsAdded} starter bylaw articles.`);
  }
  return { cred, bylawsAdded };
}

if (require.main === module) {
  seed();
  console.log('Seed complete.');
}

module.exports = { seed };
