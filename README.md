# 🏈 Dynasty League Pierce

A for-fun management platform for our dynasty fantasy football league, built in
the spirit of **Reality Sports Online** (multi-year contracts + salary cap).

Because RSO has no public API, this app **owns its own data**: the commissioner
imports rosters/contracts (CSV) or enters them by hand, and everything else —
the cap dashboard, trade analyzer, and bylaws — runs off that.

## Features

- **Cap Dashboard** — per-season committed salary + dead cap vs. the league cap → cap space and over-cap flags for every team.
- **Teams & Rosters** — each franchise's active contracts with per-season cap hits; commissioner can cut players.
- **Trade Analyzer** — build a trade between two teams and instantly check cap & roster compliance, with a pass/fail verdict and reasons. Commissioners can save proposals.
- **Bylaws** — your league constitution in Markdown, organized by category, **searchable**, with a full **amendment history** (every edit is snapshotted).
- **League History** — champions/awards, a record book, and weekly power rankings.
- **Admin** — league settings (cap, roster sizes, season), team & member management, and CSV import.
- **Auth** — session logins with commissioner (admin) and member roles.

## Quick start

```bash
npm install
npm start
```

Then open <http://localhost:3000>.

On first run the app creates a commissioner account and prints the credentials
to the console:

```
username: commissioner
password: changeme
```

**Log in and change the password immediately** (Admin → Members → Change Password).

### Configuration

Environment variables (all optional):

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `DB_PATH` | `data/league.db` | SQLite file location |
| `SESSION_SECRET` | dev placeholder | **Set this in production** |
| `COMMISH_USER` / `COMMISH_PASS` | `commissioner` / `changeme` | First-run admin credentials |

League-specific values (cap, roster limits, current season, league name) live in
the database and are editable in **Admin → League Settings**.

## Importing your roster

RSO doesn't expose an API, so paste a CSV (from a spreadsheet or RSO export) into
**Admin → Import Roster CSV**. Header columns (any order):

```
team, player, position, nfl_team, start_season, end_season, salaries
```

The `salaries` column packs per-season amounts like:

```
2026:45000000;2027:47000000;2028:49000000
```

`start_season`/`end_season` are inferred from the salary years if omitted.

## Tech

Node.js + Express · better-sqlite3 · session auth (bcryptjs) · vanilla-JS SPA
(no build step) · Markdown via `marked`.

## Project layout

```
server/
  index.js              Express app + middleware
  db.js                 SQLite schema + settings helpers
  seed.js               First-run bootstrap (commissioner, settings, starter bylaws)
  auth.js               Auth helpers & role middleware
  config.js             Bootstrap defaults / env
  services/
    capCalculator.js    Per-season cap math
    tradeValidator.js   Trade simulation + verdict
  routes/               REST endpoints (auth, league, cap, trades, bylaws, extras, settings, importer)
public/
  index.html, css/, js/ Frontend SPA
```
