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
    // Max number of active multi-year contracts a team may hold, by length.
    // null = unlimited. 2026: 2-year limit raised from 3 to 6.
    contractLimits: b.contractLimits,
    practiceSquadSlots: b.practiceSquadSlots,
    irSlots: b.irSlots,
    irDfrSlots: b.irDfrSlots,
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

// Real league bylaws, sourced from the 2026 Rules Clarification. Commissioners
// can edit any of these in-app; every change is snapshotted to the amendment
// history. Placeholder sections (draft, voting) are marked TODO for you to fill.
const STARTER_BYLAWS = [
  {
    slug: 'constitution',
    title: 'League Constitution & Overview',
    category: 'Foundational',
    sort_order: 0,
    body_md: `# Astoria Dynasty League — Constitution

Welcome to the home of all league bylaws. The league is a **dynasty, salary-cap**
format with **multi-year contracts**, run on **Reality Sports Online (RSO)**.

Every article here is editable by the commissioner in-app, and every change is
saved to the **amendment history** — so we always know exactly what the rules
were at any point in time.

## How rules change
1. A member proposes an amendment.
2. The league votes per the voting rules.
3. The commissioner records the amendment here (with a note explaining the change).

> The cap dashboard, roster views, and trade analyzer read the numbers in
> **League Settings**, so those stay in sync with these written rules.
`,
  },
  {
    slug: 'salary-cap',
    title: 'Salary Cap & Contract Limits',
    category: 'Finance',
    sort_order: 1,
    body_md: `# Salary Cap & Contract Limits

The league operates under a **hard salary cap**. A team may **never** exceed the
cap — trades that would put a team over are invalid.

## Contract lengths
Free agents signed in the auction can have contracts of **1, 2, 3, or 4 years**.
There are **hard limits** on how many long-term deals each team may hold:

| Contract length | Max per team |
| :-: | :-: |
| 4 years | **1 player** |
| 3 years | **2 players** |
| 2 years | **6 players** |
| 1 year | **Unlimited** |

### 2026 adjustment
For **2026**, the **2-year contract limit was increased from 3 to 6 players**.
This gives more flexibility to lock in depth and rebuild core pieces without
burning through the 3-year and 4-year slots.

## Strategy notes
- **4-year deals** — elite, long-term building blocks (use your one wisely).
- **3-year deals** — second-tier assets / role players you want to lock in (you get 2).
- **2-year deals** — depth and role players (you get 6 as of 2026).
- **1-year deals** — flexibility and short-term needs (unlimited within cap space).

## Dead cap
Cutting a player may incur **dead cap** charged in the season(s) of the cut.
`,
  },
  {
    slug: 'rosters',
    title: 'Rosters',
    category: 'Roster',
    sort_order: 2,
    body_md: `# Rosters

- **Active roster:** 25 players. All active players count against the salary cap.
- **Practice squad:** 3 slots (see the Practice Squad article) — do **not** count
  against the 25-man roster or the cap.
- **Injured Reserve:** 2 IR slots + 2 IR-DFR slots (see the Injured Reserve article).

Roster limits are enforced in the app's roster and trade tools.
`,
  },
  {
    slug: 'practice-squad',
    title: 'Practice Squad (new 2026)',
    category: 'Roster',
    sort_order: 3,
    body_md: `# Practice Squad (NEW in 2026)

A **3-slot** roster where you can stash young, developing players during the season.

## Timing
- Players can **only** be added to the practice squad **after the free-agent auction, during the season**.
- You **cannot** add players before or during the auction. This is an in-season tool only.

## Eligibility
- Only players with **two full NFL seasons or less** are eligible.
  - A player entering their **3rd** NFL season is eligible; a player entering their **4th** is not.
- Rookies drafted in our league **cannot** go to the practice squad (they go to the active roster).

## Roster & cap impact
- Practice-squad slots **don't count** against your 25-man active roster.
- Practice-squad players **don't count** against your salary cap.
- Effectively free roster space for development.

## Contracts
- Practice-squad players have **no multi-year contracts** — they're in-season FAAB pickups.

## Activation
- You can move a practice-squad player to your active roster at any time (needs an open active spot).
- **One-way only:** once activated, they **cannot** return to the practice squad.

## Poaching
- Other teams can attempt to **poach** your practice-squad players with FAAB bids.
- You get **right of first refusal** within the waiver wait period (**currently 1 day**).
- Activate the player within that window and the poach fails; otherwise the poaching team gets them.
`,
  },
  {
    slug: 'injured-reserve',
    title: 'Injured Reserve (IR & IR-DFR)',
    category: 'Roster',
    sort_order: 4,
    body_md: `# Injured Reserve

You have **2 IR** slots and **2 IR-DFR** (Designated for Return) slots.

## Standard IR
- Player sits **indefinitely** until you move them off IR.
- No automatic return date. Use for season-ending / long-term injuries.

## IR-DFR (Designated for Return)
- Player returns after **exactly 6 weeks**.
- After 6 weeks they **automatically** move to your active roster (you must have space).
- RSO tracks the 6-week clock and notifies you when eligible.

## Cap impact
- Players on IR / IR-DFR **still count against the salary cap** — they free up a
  roster spot, not cap space.
`,
  },
  {
    slug: 'trades',
    title: 'Trades',
    category: 'Transactions',
    sort_order: 5,
    body_md: `# Trades

- Trades may include players (with their contracts) and draft picks.
- **Both teams must remain cap-compliant** after the trade — the **Trade Analyzer** enforces this.
- _TODO: record the trade deadline and any veto/review rules here._
`,
  },
  {
    slug: 'draft',
    title: 'Rookie Draft & Picks',
    category: 'Draft',
    sort_order: 6,
    body_md: `# Rookie Draft & Picks

- Rookies drafted in our league go to the **active roster** (not the practice squad).
- _TODO: record draft order, number of rounds, and pick-trading rules here._
`,
  },
  {
    slug: 'voting',
    title: 'Voting & Amendments',
    category: 'Governance',
    sort_order: 7,
    body_md: `# Voting & Amendments

- _TODO: quorum and majority needed to pass an amendment._
- _TODO: voting window length._
- _TODO: commissioner tie-breaking authority._
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
