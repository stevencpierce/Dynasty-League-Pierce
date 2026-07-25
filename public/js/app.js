// ---------------------------------------------------------------------------
// Dynasty League Pierce — single-page frontend
// ---------------------------------------------------------------------------
const state = {
  user: null,
  settings: {},
  teams: [],
  route: 'dashboard',
};

// ---- Helpers ---------------------------------------------------------------
const $ = (sel, root = document) => root.querySelector(sel);
const view = () => $('#view');

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function money(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}K`;
  return `$${v.toLocaleString()}`;
}
const fullMoney = (n) => `$${(Number(n) || 0).toLocaleString()}`;

// Renders the per-team multi-year contract usage vs. league limits.
function contractLimitsHtml(limits) {
  if (!limits) return '';
  // Show longest deals first (4, 3, 2); skip the unlimited 1-year row.
  const rows = Object.entries(limits)
    .filter(([len, info]) => info.max != null)
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([len, info]) => {
      const cls = info.over ? 'pill bad' : 'pill good';
      return `<div class="card" style="text-align:center">
        <div class="label">${len}-yr deals</div>
        <div class="stat" style="font-size:20px">${info.used} / ${info.max}</div>
        <span class="${cls}">${info.over ? 'OVER LIMIT' : 'OK'}</span>
      </div>`;
    })
    .join('');
  if (!rows) return '';
  return `<h2 style="margin-top:6px">Contract Limits</h2><div class="grid cols-3 mb">${rows}</div>`;
}

function toast(msg, kind = '') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `toast ${kind}`;
  setTimeout(() => t.classList.add('hidden'), 3200);
}

const isCommish = () => state.user && state.user.role === 'commissioner';
const commishOnly = (html) => (isCommish() ? html : '');

async function safe(fn) {
  try { await fn(); } catch (e) { toast(e.message || 'Something went wrong', 'bad'); }
}

// ---- Boot ------------------------------------------------------------------
async function boot() {
  const { settings } = await API.get('/api/settings');
  state.settings = settings || {};
  if (settings && settings.leagueName) {
    $('#league-name').textContent = settings.leagueName;
    document.title = settings.leagueName;
  }
  const { user } = await API.get('/api/auth/me');
  state.user = user;
  if (user) {
    await afterLogin();
  } else {
    renderLogin();
  }
}

async function afterLogin() {
  $('#topbar').classList.remove('hidden');
  $('#user-label').textContent = `${state.user.username} (${state.user.role})`;
  try { state.teams = (await API.get('/api/league/teams')).teams; } catch { state.teams = []; }
  buildNav();
  navigate(state.route);
}

// ---- Navigation ------------------------------------------------------------
const NAV = [
  { key: 'dashboard', label: 'Cap Dashboard' },
  { key: 'teams', label: 'Teams & Rosters' },
  { key: 'trades', label: 'Trade Analyzer' },
  { key: 'bylaws', label: 'Bylaws' },
  { key: 'extras', label: 'League History' },
  { key: 'admin', label: 'Admin', commish: true },
];

function buildNav() {
  const nav = $('#nav');
  nav.innerHTML = NAV.filter((n) => !n.commish || isCommish())
    .map((n) => `<button class="nav-link" data-route="${n.key}">${n.label}</button>`)
    .join('');
  nav.querySelectorAll('.nav-link').forEach((b) =>
    b.addEventListener('click', () => navigate(b.dataset.route))
  );
}

function navigate(route) {
  state.route = route;
  document.querySelectorAll('.nav-link').forEach((b) =>
    b.classList.toggle('active', b.dataset.route === route)
  );
  const fn = VIEWS[route] || VIEWS.dashboard;
  safe(fn);
}

// ===========================================================================
// VIEWS
// ===========================================================================
const VIEWS = {};

// ---- Login -----------------------------------------------------------------
function renderLogin() {
  $('#topbar').classList.add('hidden');
  view().innerHTML = `
    <div class="login-wrap">
      <div class="panel">
        <h1>🏈 ${esc(state.settings.leagueName || 'Dynasty League Pierce')}</h1>
        <p class="subtitle">Commissioner & member sign-in</p>
        <form id="login-form">
          <label class="field"><span>Username</span><input name="username" autocomplete="username" required></label>
          <label class="field"><span>Password</span><input name="password" type="password" autocomplete="current-password" required></label>
          <button class="btn" style="width:100%">Sign in</button>
        </form>
      </div>
    </div>`;
  $('#login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    safe(async () => {
      const { user } = await API.post('/api/auth/login', {
        username: f.get('username'),
        password: f.get('password'),
      });
      state.user = user;
      toast(`Welcome, ${user.username}!`, 'good');
      await afterLogin();
    });
  });
}

// ---- Cap Dashboard ---------------------------------------------------------
VIEWS.dashboard = async () => {
  const season = state.settings.currentSeason;
  const { table, cap } = await API.get(`/api/cap/table?season=${season}`);
  const rows = table
    .map(
      (r) => `<tr>
        <td>${esc(r.name)}</td>
        <td class="num">${money(r.committed)}</td>
        <td class="num">${money(r.deadCap)}</td>
        <td class="num">${money(r.used)}</td>
        <td class="num"><span class="${r.available < 0 ? 'bad' : 'good'}">${money(r.available)}</span></td>
        <td class="num">${r.rosterSize}</td>
        <td>${r.overCap ? '<span class="pill bad">OVER</span>' : '<span class="pill good">OK</span>'}</td>
      </tr>`
    )
    .join('');
  view().innerHTML = `
    <div class="flex-between">
      <div><h1>Cap Dashboard</h1><p class="subtitle">Season ${season} · Salary cap ${money(cap)}</p></div>
    </div>
    <div class="panel">
      <table>
        <thead><tr>
          <th>Team</th><th class="num">Salaries</th><th class="num">Dead Cap</th>
          <th class="num">Used</th><th class="num">Available</th><th class="num">Roster</th><th>Status</th>
        </tr></thead>
        <tbody>${rows || '<tr><td colspan="7" class="muted">No teams yet. Add teams in Admin or import a roster CSV.</td></tr>'}</tbody>
      </table>
    </div>`;
};

// ---- Teams & Rosters -------------------------------------------------------
VIEWS.teams = async () => {
  const { teams } = await API.get('/api/league/teams');
  state.teams = teams;
  const options = teams.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
  view().innerHTML = `
    <h1>Teams & Rosters</h1>
    <p class="subtitle">View each franchise's contracts and per-season cap hits.</p>
    <label class="field" style="max-width:340px"><span>Select team</span>
      <select id="team-select">${options || '<option>No teams yet</option>'}</select>
    </label>
    <div id="roster-area"></div>`;
  const sel = $('#team-select');
  if (sel && teams.length) {
    sel.addEventListener('change', () => loadRoster(Number(sel.value)));
    loadRoster(Number(sel.value));
  }
};

async function loadRoster(teamId) {
  const season = state.settings.currentSeason;
  const [{ contracts }, capInfo] = await Promise.all([
    API.get(`/api/league/teams/${teamId}/roster`),
    API.get(`/api/cap/team/${teamId}?season=${season}`),
  ]);
  const active = contracts.filter((c) => c.status === 'active');
  const rows = active
    .map((c) => {
      const thisYear = (c.salaries && c.salaries[String(season)]) || 0;
      const years = `${c.start_season}–${c.end_season}`;
      return `<tr>
        <td>${esc(c.player_name)}</td>
        <td>${esc(c.position || '')}</td>
        <td>${esc(c.nfl_team || '')}</td>
        <td>${years}</td>
        <td class="num">${money(thisYear)}</td>
        ${commishOnly(`<td class="right"><button class="btn small danger" data-cut="${c.id}">Cut</button></td>`)}
      </tr>`;
    })
    .join('');
  $('#roster-area').innerHTML = `
    <div class="grid cols-3 mb">
      <div class="card"><div class="label">Used (${season})</div><div class="stat">${money(capInfo.used)}</div></div>
      <div class="card"><div class="label">Available</div><div class="stat ${capInfo.available < 0 ? 'bad' : 'good'}">${money(capInfo.available)}</div></div>
      <div class="card"><div class="label">Active Roster</div><div class="stat">${capInfo.rosterSize}</div></div>
    </div>
    ${contractLimitsHtml(capInfo.contractLimits)}
    <div class="panel">
      <table>
        <thead><tr><th>Player</th><th>Pos</th><th>NFL</th><th>Years</th><th class="num">${season} Salary</th>${commishOnly('<th></th>')}</tr></thead>
        <tbody>${rows || '<tr><td colspan="6" class="muted">No active contracts.</td></tr>'}</tbody>
      </table>
    </div>`;
  if (isCommish()) {
    $('#roster-area').querySelectorAll('[data-cut]').forEach((b) =>
      b.addEventListener('click', () =>
        safe(async () => {
          if (!confirm('Cut this player? (You can record dead cap in Admin.)')) return;
          await API.post(`/api/league/contracts/${b.dataset.cut}/cut`, {});
          toast('Player cut', 'good');
          loadRoster(teamId);
        })
      )
    );
  }
}

// ---- Trade Analyzer --------------------------------------------------------
VIEWS.trades = async () => {
  const { teams } = await API.get('/api/league/teams');
  state.teams = teams;
  const teamOpts = teams.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
  view().innerHTML = `
    <h1>Trade Analyzer</h1>
    <p class="subtitle">Build a trade between two teams; we check cap & roster compliance for season ${state.settings.currentSeason}.</p>
    <div class="grid cols-2">
      <div class="panel">
        <h2 style="margin-top:0">Team A</h2>
        <select id="teamA" class="mb">${teamOpts}</select>
        <div id="assetsA" class="mt"></div>
      </div>
      <div class="panel">
        <h2 style="margin-top:0">Team B</h2>
        <select id="teamB" class="mb">${teamOpts}</select>
        <div id="assetsB" class="mt"></div>
      </div>
    </div>
    <div class="mt"><button id="analyze" class="btn">Analyze Trade</button>
      ${commishOnly('<button id="save-trade" class="btn ghost">Save Proposal</button>')}</div>
    <div id="trade-result" class="mt"></div>`;

  const teamA = $('#teamA');
  const teamB = $('#teamB');
  if (teams.length > 1) teamB.selectedIndex = 1;
  const selected = { A: [], B: [] };

  async function renderAssets(side) {
    const teamId = Number((side === 'A' ? teamA : teamB).value);
    const { contracts } = await API.get(`/api/league/teams/${teamId}/roster`);
    const active = contracts.filter((c) => c.status === 'active');
    const season = state.settings.currentSeason;
    $(`#assets${side}`).innerHTML =
      `<div class="label mb">Players to send</div>` +
      (active
        .map((c) => {
          const sal = (c.salaries && c.salaries[String(season)]) || 0;
          return `<label class="tag-row" style="margin-bottom:6px">
            <input type="checkbox" style="width:auto" data-side="${side}" data-cid="${c.id}" data-from="${teamId}">
            <span>${esc(c.player_name)} <span class="muted">${esc(c.position || '')} · ${money(sal)}</span></span>
          </label>`;
        })
        .join('') || '<p class="muted">No active contracts.</p>');
    selected[side] = [];
    $(`#assets${side}`).querySelectorAll('input[type=checkbox]').forEach((cb) =>
      cb.addEventListener('change', () => {
        selected[side] = [...$(`#assets${side}`).querySelectorAll('input:checked')].map((x) => ({
          cid: Number(x.dataset.cid),
          from: Number(x.dataset.from),
        }));
      })
    );
  }

  function buildPayload() {
    const aId = Number(teamA.value);
    const bId = Number(teamB.value);
    const assets = [];
    for (const a of selected.A) assets.push({ type: 'contract', contractId: a.cid, from: aId, to: bId });
    for (const b of selected.B) assets.push({ type: 'contract', contractId: b.cid, from: bId, to: aId });
    return { season: state.settings.currentSeason, assets };
  }

  teamA.addEventListener('change', () => renderAssets('A'));
  teamB.addEventListener('change', () => renderAssets('B'));
  await renderAssets('A');
  await renderAssets('B');

  $('#analyze').addEventListener('click', () =>
    safe(async () => {
      const result = await API.post('/api/trades/validate', buildPayload());
      renderTradeResult(result);
    })
  );
  const saveBtn = $('#save-trade');
  if (saveBtn)
    saveBtn.addEventListener('click', () =>
      safe(async () => {
        await API.post('/api/trades', buildPayload());
        toast('Trade proposal saved', 'good');
      })
    );
};

function renderTradeResult(r) {
  const verdict = r.valid
    ? '<span class="pill good">VALID</span>'
    : '<span class="pill bad">INVALID</span>';
  const reasons = (r.reasons || []).map((x) => `<li>${esc(x)}</li>`).join('');
  const teams = (r.teams || [])
    .map(
      (t) => `<div class="card">
        <div class="flex-between"><strong>${esc(t.teamName)}</strong>
          <span class="${t.availableAfter < 0 ? 'pill bad' : 'pill good'}">${money(t.availableAfter)} left</span></div>
        <div class="muted" style="font-size:13px;margin-top:6px">
          Cap used ${money(t.capBefore)} → <strong>${money(t.capAfter)}</strong><br>
          Roster ${t.rosterBefore} → ${t.rosterAfter}
        </div>
        ${t.incoming.length ? `<div style="margin-top:8px"><span class="label">In</span> ${t.incoming.map((i) => esc(i.label)).join(', ')}</div>` : ''}
        ${t.outgoing.length ? `<div><span class="label">Out</span> ${t.outgoing.map((i) => esc(i.label)).join(', ')}</div>` : ''}
      </div>`
    )
    .join('');
  $('#trade-result').innerHTML = `
    <div class="panel">
      <div class="flex-between"><h2 style="margin:0">Result ${verdict}</h2><span class="muted">Season ${r.season}</span></div>
      ${reasons ? `<ul style="color:var(--bad)">${reasons}</ul>` : '<p class="muted">No cap or roster violations detected.</p>'}
      <div class="grid cols-2 mt">${teams}</div>
    </div>`;
}

// ---- Bylaws ----------------------------------------------------------------
VIEWS.bylaws = async () => {
  const { bylaws } = await API.get('/api/bylaws');
  const byCat = {};
  bylaws.forEach((b) => { (byCat[b.category] = byCat[b.category] || []).push(b); });
  const listHtml = Object.entries(byCat)
    .map(
      ([cat, items]) =>
        `<div class="bylaw-cat">${esc(cat)}</div>` +
        items.map((b) => `<button class="bylaw-item" data-slug="${esc(b.slug)}">${esc(b.title)}</button>`).join('')
    )
    .join('');
  view().innerHTML = `
    <div class="flex-between">
      <div><h1>League Bylaws</h1><p class="subtitle">Constitution & rules with full amendment history.</p></div>
      <div class="tag-row">
        <input id="bylaw-search" placeholder="Search bylaws…" style="width:200px">
        ${commishOnly('<button id="new-bylaw" class="btn small">+ New Article</button>')}
      </div>
    </div>
    <div class="bylaw-layout panel">
      <div class="bylaw-list" id="bylaw-list">${listHtml || '<p class="muted">No bylaws yet.</p>'}</div>
      <div id="bylaw-content"><p class="muted">Select an article.</p></div>
    </div>`;

  const listEl = $('#bylaw-list');
  listEl.querySelectorAll('.bylaw-item').forEach((b) =>
    b.addEventListener('click', () => {
      listEl.querySelectorAll('.bylaw-item').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      showBylaw(b.dataset.slug);
    })
  );
  const first = listEl.querySelector('.bylaw-item');
  if (first) { first.classList.add('active'); showBylaw(first.dataset.slug); }

  $('#bylaw-search').addEventListener('input', (e) =>
    safe(async () => {
      const q = e.target.value.trim();
      if (!q) return;
      const { results } = await API.get(`/api/bylaws/search?q=${encodeURIComponent(q)}`);
      $('#bylaw-content').innerHTML = `<h2>Search: "${esc(q)}"</h2>` +
        (results.map((r) => `<div class="card mb"><button class="bylaw-item" data-slug="${esc(r.slug)}"><strong>${esc(r.title)}</strong></button><div class="muted">${esc(r.excerpt)}…</div></div>`).join('') || '<p class="muted">No matches.</p>');
      $('#bylaw-content').querySelectorAll('.bylaw-item').forEach((b) =>
        b.addEventListener('click', () => showBylaw(b.dataset.slug)));
    })
  );

  const newBtn = $('#new-bylaw');
  if (newBtn) newBtn.addEventListener('click', () => editBylaw(null));
};

async function showBylaw(slug) {
  const { bylaw } = await API.get(`/api/bylaws/${slug}`);
  const { revisions } = await API.get(`/api/bylaws/${slug}/revisions`);
  $('#bylaw-content').innerHTML = `
    <div class="flex-between">
      <h2 style="margin-top:0">${esc(bylaw.title)}</h2>
      ${commishOnly(`<div class="tag-row"><button class="btn small" id="edit-bylaw">Edit</button><button class="btn small danger" id="del-bylaw">Delete</button></div>`)}
    </div>
    <div class="prose">${bylaw.html}</div>
    <h2>Amendment History</h2>
    <table><thead><tr><th>When</th><th>Note</th><th>By</th></tr></thead>
    <tbody>${revisions.map((r) => `<tr><td>${esc(r.created_at)}</td><td>${esc(r.note || '')}</td><td>${esc(r.editor || '—')}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">No history.</td></tr>'}</tbody></table>`;
  if (isCommish()) {
    $('#edit-bylaw').addEventListener('click', () => editBylaw(bylaw));
    $('#del-bylaw').addEventListener('click', () =>
      safe(async () => {
        if (!confirm(`Delete "${bylaw.title}"? This cannot be undone.`)) return;
        await API.del(`/api/bylaws/${slug}`);
        toast('Bylaw deleted', 'good');
        VIEWS.bylaws();
      })
    );
  }
}

function editBylaw(bylaw) {
  const isNew = !bylaw;
  $('#bylaw-content').innerHTML = `
    <h2 style="margin-top:0">${isNew ? 'New Article' : 'Edit: ' + esc(bylaw.title)}</h2>
    <label class="field"><span>Title</span><input id="b-title" value="${esc(bylaw?.title || '')}"></label>
    <label class="field"><span>Category</span><input id="b-cat" value="${esc(bylaw?.category || 'General')}"></label>
    <label class="field"><span>Body (Markdown)</span><textarea id="b-body">${esc(bylaw?.body_md || '')}</textarea></label>
    ${isNew ? '' : '<label class="field"><span>Amendment note</span><input id="b-note" placeholder="e.g. Raised cap to $210M"></label>'}
    <button class="btn" id="b-save">Save</button>
    <button class="btn ghost" id="b-cancel">Cancel</button>`;
  $('#b-cancel').addEventListener('click', () => (isNew ? VIEWS.bylaws() : showBylaw(bylaw.slug)));
  $('#b-save').addEventListener('click', () =>
    safe(async () => {
      const payload = {
        title: $('#b-title').value,
        category: $('#b-cat').value,
        body_md: $('#b-body').value,
      };
      if (isNew) {
        const { slug } = await API.post('/api/bylaws', payload);
        toast('Article created', 'good');
        await VIEWS.bylaws();
        showBylaw(slug);
      } else {
        payload.note = $('#b-note').value || 'Amended';
        await API.put(`/api/bylaws/${bylaw.slug}`, payload);
        toast('Bylaw amended', 'good');
        showBylaw(bylaw.slug);
      }
    })
  );
}

// ---- League History (records, awards, power rankings) ----------------------
VIEWS.extras = async () => {
  const season = state.settings.currentSeason;
  const [{ awards }, { records }, { rankings }] = await Promise.all([
    API.get('/api/extras/awards'),
    API.get('/api/extras/records'),
    API.get(`/api/extras/power-rankings?season=${season}`),
  ]);
  view().innerHTML = `
    <h1>League History</h1>
    <p class="subtitle">Champions, the record book, and current power rankings.</p>

    <div class="flex-between"><h2>🏆 Champions & Awards</h2>${commishOnly('<button class="btn small" id="add-award">+ Add</button>')}</div>
    <div class="panel"><table><thead><tr><th>Season</th><th>Award</th><th>Winner</th><th>Note</th>${commishOnly('<th></th>')}</tr></thead>
      <tbody>${awards.map((a) => `<tr><td>${a.season}</td><td>${esc(a.name)}</td><td>${esc(a.team_name || a.winner || '')}</td><td>${esc(a.note || '')}</td>${commishOnly(`<td class="right"><button class="btn small danger" data-del-award="${a.id}">×</button></td>`)}</tr>`).join('') || `<tr><td colspan="5" class="muted">No awards recorded.</td></tr>`}</tbody></table></div>

    <div class="flex-between"><h2>📖 Record Book</h2>${commishOnly('<button class="btn small" id="add-record">+ Add</button>')}</div>
    <div class="panel"><table><thead><tr><th>Category</th><th>Record</th><th>Holder</th><th>Value</th><th>Season</th>${commishOnly('<th></th>')}</tr></thead>
      <tbody>${records.map((r) => `<tr><td>${esc(r.category)}</td><td>${esc(r.description)}</td><td>${esc(r.holder || '')}</td><td>${esc(r.value || '')}</td><td>${r.season || ''}</td>${commishOnly(`<td class="right"><button class="btn small danger" data-del-record="${r.id}">×</button></td>`)}</tr>`).join('') || `<tr><td colspan="6" class="muted">No records yet.</td></tr>`}</tbody></table></div>

    <div class="flex-between"><h2>📊 Power Rankings (${season})</h2>${commishOnly('<button class="btn small" id="add-ranking">+ Add</button>')}</div>
    <div class="panel"><table><thead><tr><th>Rank</th><th>Week</th><th>Team</th><th>Note</th>${commishOnly('<th></th>')}</tr></thead>
      <tbody>${rankings.map((r) => `<tr><td>${r.rank}</td><td>${r.week || '—'}</td><td>${esc(r.team_name)}</td><td>${esc(r.note || '')}</td>${commishOnly(`<td class="right"><button class="btn small danger" data-del-ranking="${r.id}">×</button></td>`)}</tr>`).join('') || `<tr><td colspan="5" class="muted">No rankings yet.</td></tr>`}</tbody></table></div>`;

  if (!isCommish()) return;
  const teamOpts = state.teams.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('');

  $('#add-award')?.addEventListener('click', () => simpleForm('Add Award', [
    { name: 'season', label: 'Season', value: season },
    { name: 'name', label: 'Award name', placeholder: 'League Champion' },
    { name: 'team_id', label: 'Team', type: 'select', options: teamOpts },
    { name: 'note', label: 'Note', required: false },
  ], async (d) => { await API.post('/api/extras/awards', d); toast('Award added', 'good'); VIEWS.extras(); }));

  $('#add-record')?.addEventListener('click', () => simpleForm('Add Record', [
    { name: 'category', label: 'Category', placeholder: 'Single-game points' },
    { name: 'description', label: 'Description' },
    { name: 'holder', label: 'Holder', required: false },
    { name: 'value', label: 'Value', required: false },
    { name: 'season', label: 'Season', required: false, value: season },
  ], async (d) => { await API.post('/api/extras/records', d); toast('Record added', 'good'); VIEWS.extras(); }));

  $('#add-ranking')?.addEventListener('click', () => simpleForm('Add Power Ranking', [
    { name: 'season', label: 'Season', value: season },
    { name: 'week', label: 'Week (0 = preseason)', value: 0 },
    { name: 'team_id', label: 'Team', type: 'select', options: teamOpts },
    { name: 'rank', label: 'Rank' },
    { name: 'note', label: 'Note', required: false },
  ], async (d) => { await API.post('/api/extras/power-rankings', d); toast('Ranking added', 'good'); VIEWS.extras(); }));

  const delMap = [
    ['data-del-award', '/api/extras/awards/'],
    ['data-del-record', '/api/extras/records/'],
    ['data-del-ranking', '/api/extras/power-rankings/'],
  ];
  for (const [attr, base] of delMap) {
    view().querySelectorAll(`[${attr}]`).forEach((b) =>
      b.addEventListener('click', () => safe(async () => {
        await API.del(base + b.getAttribute(attr));
        VIEWS.extras();
      }))
    );
  }
};

// ---- Admin -----------------------------------------------------------------
VIEWS.admin = async () => {
  if (!isCommish()) { view().innerHTML = '<p class="muted">Commissioner access required.</p>'; return; }
  const s = state.settings;
  const cl = s.contractLimits || {};
  const { users } = await API.get('/api/auth/users');
  const teamOpts = state.teams.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
  view().innerHTML = `
    <h1>Admin</h1>
    <p class="subtitle">League settings, teams, members, and data import.</p>

    <h2>⚙️ League Settings</h2>
    <div class="panel grid cols-2">
      ${settingField('leagueName', 'League name', s.leagueName, 'text')}
      ${settingField('currentSeason', 'Current season', s.currentSeason)}
      ${settingField('salaryCap', 'Salary cap ($)', s.salaryCap)}
      ${settingField('rosterMax', 'Max roster size', s.rosterMax)}
      ${settingField('rosterMin', 'Min roster size', s.rosterMin)}
      ${settingField('maxContractYears', 'Max contract years', s.maxContractYears)}
    </div>
    <h2>📑 Contract Limits (max per team)</h2>
    <div class="panel grid cols-3">
      <label class="field"><span>4-year deals</span><input data-limit="4" type="number" value="${esc(cl[4] ?? '')}"></label>
      <label class="field"><span>3-year deals</span><input data-limit="3" type="number" value="${esc(cl[3] ?? '')}"></label>
      <label class="field"><span>2-year deals</span><input data-limit="2" type="number" value="${esc(cl[2] ?? '')}"></label>
      <div style="grid-column:1/-1"><button class="btn" id="save-settings">Save Settings</button></div>
    </div>

    <h2>🏟️ Teams</h2>
    <div class="panel">
      <table><thead><tr><th>Name</th><th>Owner</th><th>Division</th><th></th></tr></thead>
      <tbody id="teams-body">${state.teams.map((t) => `<tr><td>${esc(t.name)}</td><td>${esc(t.owner_name || '')}</td><td>${esc(t.division || '')}</td><td class="right"><button class="btn small danger" data-del-team="${t.id}">Delete</button></td></tr>`).join('') || '<tr><td colspan="4" class="muted">No teams.</td></tr>'}</tbody></table>
      <div class="row mt">
        <input id="nt-name" placeholder="Team name" style="flex:2">
        <input id="nt-owner" placeholder="Owner" style="flex:1">
        <input id="nt-div" placeholder="Division" style="flex:1">
        <button class="btn" id="add-team">Add Team</button>
      </div>
    </div>

    <h2>👥 Members</h2>
    <div class="panel">
      <table><thead><tr><th>Username</th><th>Role</th><th>Team</th><th></th></tr></thead>
      <tbody>${users.map((u) => `<tr><td>${esc(u.username)}</td><td>${esc(u.role)}</td><td>${esc((state.teams.find((t) => t.id === u.team_id) || {}).name || '')}</td><td class="right"><button class="btn small ghost" data-reset="${u.id}">Reset PW</button> <button class="btn small danger" data-del-user="${u.id}">Delete</button></td></tr>`).join('')}</tbody></table>
      <div class="row mt">
        <input id="nu-name" placeholder="Username" style="flex:1">
        <input id="nu-pass" placeholder="Password" style="flex:1">
        <select id="nu-role" style="flex:1"><option value="member">member</option><option value="commissioner">commissioner</option></select>
        <select id="nu-team" style="flex:1"><option value="">(no team)</option>${teamOpts}</select>
        <button class="btn" id="add-user">Add</button>
      </div>
      <p class="muted mt">Change your own password: <button class="btn small ghost" id="change-pw">Change Password</button></p>
    </div>

    <h2>📥 Import Roster CSV</h2>
    <div class="panel">
      <p class="muted">RSO has no public API, so paste an exported/spreadsheet CSV here. Header columns (any order):
      <code>team, player, position, nfl_team, start_season, end_season, salaries</code>.
      The <code>salaries</code> field uses <code>2026:12000000;2027:13000000</code> format.</p>
      <textarea id="csv-input" placeholder="team,player,position,nfl_team,start_season,end_season,salaries&#10;Gridiron Goblins,Patrick Mahomes,QB,KC,2026,2028,2026:45000000;2027:47000000;2028:49000000"></textarea>
      <button class="btn mt" id="import-csv">Import</button>
      <div id="import-result" class="mt"></div>
    </div>`;

  // Settings
  $('#save-settings').addEventListener('click', () => safe(async () => {
    const payload = {};
    view().querySelectorAll('[data-setting]').forEach((el) => { payload[el.dataset.setting] = el.value; });
    const limits = { 1: null };
    view().querySelectorAll('[data-limit]').forEach((el) => {
      limits[el.dataset.limit] = el.value === '' ? null : Number(el.value);
    });
    payload.contractLimits = limits;
    const { settings } = await API.put('/api/settings', payload);
    state.settings = settings;
    $('#league-name').textContent = settings.leagueName;
    toast('Settings saved', 'good');
  }));

  // Teams
  $('#add-team').addEventListener('click', () => safe(async () => {
    const name = $('#nt-name').value.trim();
    if (!name) return toast('Team name required', 'bad');
    await API.post('/api/league/teams', { name, owner_name: $('#nt-owner').value, division: $('#nt-div').value });
    state.teams = (await API.get('/api/league/teams')).teams;
    toast('Team added', 'good'); VIEWS.admin();
  }));
  view().querySelectorAll('[data-del-team]').forEach((b) => b.addEventListener('click', () => safe(async () => {
    if (!confirm('Delete this team and all its contracts?')) return;
    await API.del(`/api/league/teams/${b.dataset.delTeam}`);
    state.teams = (await API.get('/api/league/teams')).teams;
    VIEWS.admin();
  })));

  // Users
  $('#add-user').addEventListener('click', () => safe(async () => {
    await API.post('/api/auth/users', {
      username: $('#nu-name').value, password: $('#nu-pass').value,
      role: $('#nu-role').value, team_id: $('#nu-team').value || null,
    });
    toast('Member added', 'good'); VIEWS.admin();
  }));
  view().querySelectorAll('[data-del-user]').forEach((b) => b.addEventListener('click', () => safe(async () => {
    if (!confirm('Delete this user?')) return;
    await API.del(`/api/auth/users/${b.dataset.delUser}`); VIEWS.admin();
  })));
  view().querySelectorAll('[data-reset]').forEach((b) => b.addEventListener('click', () => safe(async () => {
    const pw = prompt('New password (min 6 chars):');
    if (!pw) return;
    await API.post(`/api/auth/users/${b.dataset.reset}/reset-password`, { newPassword: pw });
    toast('Password reset', 'good');
  })));
  $('#change-pw').addEventListener('click', () => safe(async () => {
    const cur = prompt('Current password:'); if (cur == null) return;
    const nw = prompt('New password (min 6 chars):'); if (!nw) return;
    await API.post('/api/auth/change-password', { currentPassword: cur, newPassword: nw });
    toast('Password changed', 'good');
  }));

  // Import
  $('#import-csv').addEventListener('click', () => safe(async () => {
    const csv = $('#csv-input').value;
    if (!csv.trim()) return toast('Paste CSV first', 'bad');
    const r = await API.post('/api/import/contracts', { csv });
    state.teams = (await API.get('/api/league/teams')).teams;
    $('#import-result').innerHTML = `<div class="card">Imported <strong>${r.contracts}</strong> contracts, ${r.teams} new teams, ${r.players} new players.${r.errors.length ? `<div class="muted mt">${r.errors.length} skipped:<br>${r.errors.map(esc).join('<br>')}</div>` : ''}</div>`;
    toast('Import complete', 'good');
  }));
};

function settingField(key, label, value, type = 'number') {
  return `<label class="field"><span>${esc(label)}</span><input data-setting="${key}" type="${type}" value="${esc(value ?? '')}"></label>`;
}

// Generic modal-ish inline form rendered into a toast-like overlay panel.
function simpleForm(title, fields, onSubmit) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:200';
  wrap.innerHTML = `<div class="panel" style="max-width:420px;width:90%">
    <h2 style="margin-top:0">${esc(title)}</h2>
    ${fields.map((f) => f.type === 'select'
      ? `<label class="field"><span>${esc(f.label)}</span><select data-f="${f.name}">${f.options}</select></label>`
      : `<label class="field"><span>${esc(f.label)}</span><input data-f="${f.name}" value="${esc(f.value ?? '')}" placeholder="${esc(f.placeholder || '')}"></label>`
    ).join('')}
    <button class="btn" data-ok>Save</button> <button class="btn ghost" data-cancel>Cancel</button>
  </div>`;
  document.body.appendChild(wrap);
  wrap.querySelector('[data-cancel]').addEventListener('click', () => wrap.remove());
  wrap.querySelector('[data-ok]').addEventListener('click', () => {
    const d = {};
    wrap.querySelectorAll('[data-f]').forEach((el) => { d[el.dataset.f] = el.value; });
    safe(async () => { await onSubmit(d); wrap.remove(); });
  });
}

// ---- Logout ----------------------------------------------------------------
$('#logout-btn').addEventListener('click', () =>
  safe(async () => {
    await API.post('/api/auth/logout');
    state.user = null;
    $('#topbar').classList.add('hidden');
    renderLogin();
  })
);

// Go.
boot().catch((e) => {
  view().innerHTML = `<div class="panel">Failed to load: ${esc(e.message)}</div>`;
});
