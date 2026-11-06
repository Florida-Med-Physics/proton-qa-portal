// Synthetic checks for the third round of GUI and navigation changes (display, layout and navigation only). The real
// app.js code runs in node:vm on small stand-in elements; nothing here reads stored data. Synthetic people, machines and
// lists only. Run with node tests/test_gui_nav_3.cjs from the repository root.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('portal/static/app.js', 'utf8');
assert.equal(fs.readFileSync('docs/app.js', 'utf8'), source, 'docs/app.js is out of step: copy portal/static/app.js');
const css = fs.readFileSync('portal/static/app.css', 'utf8').replace(/\r\n/g, '\n');
assert.equal(fs.readFileSync('docs/app.css', 'utf8').replace(/\r\n/g, '\n'), css, 'docs/app.css is out of step: copy portal/static/app.css');
const between = (from, to) => { const a = source.indexOf(from), b = source.indexOf(to, a + 1); assert.ok(a >= 0 && b > a, `${from} … ${to}`); return source.slice(a, b); };
// GatorQA's phone rules (floridaphysics.com moves this 1200px block to 767px).
const phoneBlock = (() => { const i = css.indexOf('@media(max-width:1200px){\n  main { padding: 18px 14px 48px; }'); assert.ok(i >= 0, 'phone block'); return css.slice(i, css.indexOf('\n}\n', i)); })();
const phoneRules = [...css.matchAll(/@media ?\(max-width: ?1200px\) ?\{([\s\S]*?)\n\}/g)].map((m) => m[1]).join('\n');

// A small stand-in DOM: enough for el(), chip() and the page builders below.
class Node {
  constructor(tag) { Object.assign(this, { tagName: tag, attributes: {}, childNodes: [], parentNode: null, listeners: {}, dataset: {}, style: {}, hidden: false, className: '' }); }
  setAttribute(key, value) { this.attributes[key] = String(value); if (key === 'hidden') this.hidden = true; }
  getAttribute(key) { return this.attributes[key] ?? null; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  append(...kids) { for (const kid of kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false)) { const n = kid instanceof Node ? kid : new Text(String(kid)); n.parentNode = this; this.childNodes.push(n); } }
  prepend(...kids) { const old = this.childNodes; this.childNodes = []; this.append(...kids); this.childNodes.push(...old); }
  replaceChildren(...kids) { this.childNodes = []; this.append(...kids); }
  get children() { return this.childNodes.filter((n) => !(n instanceof Text)); }
  get textContent() { return this.text ?? this.childNodes.map((n) => n.textContent).join(''); }
  set textContent(text) { this.replaceChildren(String(text)); }
  fire(type, event = {}) { return Promise.all((this.listeners[type] || []).map((fn) => fn(event))); }
  find(test) { return [this, ...this.childNodes.flatMap((n) => n.find(test))].filter(test); }
  querySelector() { return null; }
}
class Text extends Node { constructor(text) { super('#text'); this.text = text; } }
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
const dom = (extra = {}) => {
  const document = { body: new Node('body'), createElement: (tag) => new Node(tag), createTextNode: (t) => new Text(t), createElementNS: (ns, tag) => new Node(tag) };
  const app = new Node('main');
  const context = { document, Node, app, console, URLSearchParams, setTimeout, ...extra };
  vm.createContext(context);
  vm.runInContext(between('function el(', 'const REVIEW_LABEL') + between('function capitalize(', 'function decimalsOf('), context);
  return context;
};
const cells = (row) => row.children.map((td) => td.textContent);

(async () => {
// 1. Review QA and Past results on a phone: compact cards with no column names. A row's words flow over three lines
// (date and machine; the QA list on a line of its own; who, result and review), about 90-120 px a card instead of 213-247.
{
  for (const rule of ['#app:is([data-page="review"], [data-page="runs"], [data-page="admin"]) .fixed-table tbody tr { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 10px;',
    '#app:is([data-page="review"], [data-page="runs"], [data-page="admin"]) .fixed-table tbody td { display: block; width: auto; max-width: 100%; min-width: 0; padding: 0; border: 0; text-align: left; }',
    '#app:is([data-page="review"], [data-page="runs"]) .fixed-table tbody td:nth-child(3)', '#app[data-page="review"] .fixed-table thead,', '#app[data-page="runs"] .fixed-table thead,'])
    assert.ok(phoneBlock.includes(rule), rule);
  assert.doesNotMatch(phoneBlock, /#app\[data-page="(review|runs)"\] td\[data-label\]::before/, 'no column name before each value');
  // The rule above puts the third cell on its own line: on both pages that is the QA list.
  const review = between('async function renderReview(', 'async function renderRuns(');
  for (const cols of ['waitingCols', 'reviewedCols', 'trashCols']) assert.match(review, new RegExp(String.raw`const ${cols} = \[\["Date", "\d+%"\], \["Machine", "\d+%"\], \["QA list"`), cols);
  assert.match(between('async function renderRuns(', '// A self-contained PDF'), /fixedTable\(\[\["Date", "18%"\], \["Machine", "14%"\], \["QA list", "38%"\]/);
}


// 2. Data Administration: what each role may do is one table, shown to every role; an admin also gets the people, with
// their role (no rights columns), active accounts first. Import folders: one example, a quiet Save that shows once the
// folder is changed. On a phone (GatorQA's 1200px block) its tables become cards: nothing scrolls sideways.
{
  const users = [
    { id: 1, username: 'old.admin', full_name: 'Admin', role: 'admin', active: 0 },
    { id: 2, username: 'physicist.a@example.invalid', full_name: 'Physicist A', role: 'physicist', active: 1 },
    { id: 3, username: 'therapist.a@example.invalid', full_name: '', role: 'therapist', active: 1 },
    { id: 4, username: 'old.mpa', full_name: 'MPA', role: 'mpa', active: 0 },
    { id: 5, username: 'mpa.a@example.invalid', full_name: 'MPA A', role: 'mpa', active: 1 }];
  const lists = [{ id: 7, machine_id: 1, queue_name: 'Synthetic Daily QA', import_folder: '', frequency: 'daily', weekdays: '0,1,2,3,4', start_date: '2026-11-02', active: 1 },
    { id: 8, machine_id: 1, queue_name: 'Synthetic Monthly QA', import_folder: 'G1 Monthly', frequency: 'monthly', weekdays: '', start_date: '2026-11-02', active: 1 }];
  const run = async (role) => {
    const calls = [];
    const c = dom({ window: { QA_HOST: { browserFolders: false }, localApi: () => {} }, state: { user: { id: 9, role }, actingRole: null },
      api: async (method, path, body) => { calls.push([method, path, body]); return {}; },
      apiBatch: async (paths) => paths.map((p) => (p === '/api/users' ? users : p === '/api/machines' ? [{ id: 1, name: 'G1', active: 1 }] : lists)),
      page: () => {}, toast: (m) => calls.push(['toast', m]), modal() {}, route() {}, logout() {}, importUserSpreadsheet() {}, userForm() {}, databaseLocationCard: () => new Node('section') });
    vm.runInContext(between('const ROLE_LABEL', 'const STATE_LABEL') + between('function activeRole(', 'let toastTimer;') + between('function machineSchedules(', '// Several GETs')
      + between('function browserFolders(', 'function formData(') + between('function importFolderField(', 'function scheduleData(')
      + between('const RIGHTS = [', 'function importUserSpreadsheet(') + between('async function renderAdmin(', 'async function renderUsers(')
      + 'function fixedTable(columns, rows) { return el("div", { class: "table-wrap fixed-wrap", "data-cols": columns.map(([h]) => h).join("|") }, el("table", { class: "fixed-table" }, el("tbody", {}, rows))); }', c);
    await c.renderAdmin(); await settle();
    const tables = c.app.find((n) => n.attributes['data-cols'] !== undefined);
    return { c, calls, tables, byCols: (cols) => tables.find((t) => t.attributes['data-cols'] === cols) };
  };
  const roleCols = 'Role|Perform QA|Review and approve|Therapist sign-off|Set up QA lists, machines, limits and folders|Manage users';
  for (const role of ['admin', 'physicist', 'therapist', 'mpa']) {
    const { c, tables, byCols } = await run(role);
    const rights = byCols(roleCols);
    assert.ok(rights, `${role}: what each role may do`);
    assert.match(rights.className, /\brole-rights\b/);
    const rows = rights.find((n) => n.tagName === 'tr');
    assert.deepEqual(rows.map((r) => r.children[0].textContent), ['Admin', 'Physicist', 'Therapist', 'MPA']);
    assert.deepEqual(rows.map((r) => r.children.slice(1).map((td) => (/\bhas-right\b/.test(td.className) ? '✓' : /\bno-right\b/.test(td.className) ? '—' : '?')).join('')),
      ['✓✓—✓✓', '✓✓—✓—', '✓—✓——', '✓————'], 'the same rights as before, marked for the phone cards');
    const people = byCols('Username|Name|Role|Status|');
    if (role !== 'admin') { assert.equal(people, undefined); assert.equal(tables.length, 2, 'roles and folders only'); continue; }
    const personRows = people.find((n) => n.tagName === 'tr');
    assert.deepEqual(personRows.map((r) => r.children[0].textContent), ['physicist.a@example.invalid', 'therapist.a@example.invalid', 'mpa.a@example.invalid', 'old.admin', 'old.mpa'], 'active first, then disabled, each in the server order');
    assert.deepEqual(cells(personRows[1]), ['therapist.a@example.invalid', '', 'Therapist', 'Active', 'Edit'], 'no rights columns; no name is an empty cell');
    assert.ok(personRows.every((r) => r.className === 'person-row'));
    assert.ok(c.app.textContent.indexOf('Rights come from each person') < c.app.textContent.indexOf('What each role may do:'), 'the people, then what each role may do');
  }
  // Import folders on a host without browser folders: typed paths, one example, Save quiet and shown only after a change.
  const { tables, calls } = await run('physicist');
  const folders = tables.find((t) => t.attributes['data-cols'] === 'Machine|QA list|Folder');
  const inputs = folders.find((n) => n.tagName === 'input'), saves = folders.find((n) => n.tagName === 'button');
  assert.deepEqual(inputs.map((i) => i.attributes.placeholder ?? null), ['e.g. G:\\My Drive\\…\\ProtonDaily\\G1 Sphinx', null], 'one example, on the first row');
  assert.deepEqual(saves.map((b) => [b.className, b.hidden, b.textContent]), [['small', true, 'Save'], ['small', true, 'Save']], 'quiet and hidden until changed');
  assert.deepEqual(inputs.map((i) => i.attributes['aria-label']), ['Folder for G1 · Synthetic Daily QA', 'Folder for G1 · Synthetic Monthly QA']);
  inputs[1].value = 'G1 Monthly '; await inputs[1].fire('input'); assert.equal(saves[1].hidden, true, 'the same folder: nothing to save');
  inputs[1].value = 'G1 Monthly 2'; await inputs[1].fire('input'); assert.equal(saves[1].hidden, false, 'changed: Save shows');
  await saves[1].fire('click'); await settle();
  assert.deepEqual(calls.filter(([m]) => m === 'PUT').map(([, p, b]) => [p, b.import_folder]), [['/api/assignments/8', 'G1 Monthly 2']], 'the same save as before');
  assert.equal(saves[1].hidden, true, 'saved: Save hides again');
  assert.ok(folders.find((n) => n.className === 'folder-cell').length === 2 && folders.find((n) => /folder-field/.test(n.className)).length === 2);
  // Phone: Data Administration's tables are cards (no column names, nothing sideways); the person's username, the role
  // and a list's folder each take a line; a role card lists the rights it has.
  for (const rule of ['#app[data-page="admin"] .fixed-table colgroup,', '#app[data-page="admin"] .fixed-table thead,', '#app[data-page="admin"] .fixed-wrap,',
    '#app[data-page="admin"] .fixed-table tbody,',
    '#app:is([data-page="review"], [data-page="runs"], [data-page="admin"]) .fixed-table tbody tr { display: flex; flex-wrap: wrap;',
    '#app[data-page="admin"] .fixed-table tbody tr.person-row > td:first-child,', '#app[data-page="admin"] .fixed-table tbody td.folder-cell { flex: 1 0 100%; overflow-wrap: anywhere; }',
    '#app[data-page="admin"] .role-rights td.no-right, #app[data-page="admin"] .role-rights td.has-right > .tick { display: none; }',
    '#app[data-page="admin"] .role-rights td.has-right::before { content: attr(data-label); }']) assert.ok(phoneBlock.includes(rule), rule);
  assert.match(css, /\.folder-cell \.folder-field > input \{ flex: 1 1 auto; width: auto; min-width: 0; \}/, 'the folder field and its Save share the cell');
  // floridaphysics.com shows this table from 768 px (cards from 767 px): Machine at 18% keeps "TrueBeam" whole there (at
  // 14% it broke "TrueBea|m" from 768 to about 785 px); the QA list keeps its 36%.
  assert.match(between('async function renderAdmin(', 'async function renderUsers('), /: \[\["Machine", "18%"\], \["QA list", "36%"\], \["Folder", "46%"\]\],\n/, 'Machine 18%');
}

// 3. Perform QA: an as-needed list says "As needed" once (Status), with no schedule line under its name and no date in
// the chip (its last run is under Last result); other lists are unchanged. On a phone each card is shorter: the list's
// name beside its ▶, "Status" on one line, the History ring left to the Dashboard and Machine Trends.
{
  const c = dom({ window: {}, state: { user: { id: 9, role: 'therapist' }, actingRole: null }, Date, shortDate: (iso) => `D${iso}`,
    api: async () => ({ today: '2026-11-06', machines: [{ id: 3, name: 'HDR', kind: 'HDR brachytherapy', queues: [
      { id: 21, queue_name: 'Synthetic Source Exchange', frequency: 'asneeded', state: 'ready', schedule: 'As needed (run on the days it applies)', last_done: '2026-10-13', last_run: { id: 5, overall: 'recorded', qa_date: '2026-10-13' }, history_counts: {} },
      { id: 22, queue_name: 'Synthetic Daily', frequency: 'daily', state: 'overdue', schedule: 'Daily (weekdays)', next_due: '2026-11-03', history_counts: { pass: 3 } }] }] }),
    databaseBanner: async () => null, page: () => {}, machineLabel: (n) => n });
  vm.runInContext(`function historyRing() { return el('a', { class: 'history-rate' }, '100%'); }
    function fixedTable(columns, rows) { return el('table', { 'data-cols': columns.map(([h]) => h).join('|') }, rows); }
    function modalityHead(name) { return el('h2', {}, name); }`, c);
  vm.runInContext(between('const ROLE_LABEL', 'const STATE_LABEL') + between('const FREQ_LABEL', 'const WEEKDAYS') + between('function activeRole(', 'let toastTimer;')
    + between('const FREQ_ORDER', 'function frequentQaAssignments(') + between('function applyDashboardRoleView(', 'async function renderHome(')
    + between('const MODALITIES', '// A table with fixed column widths') + between('async function renderDashboard(', '// Click a list'), c);
  await c.renderDashboard();
  const rows = c.app.find((n) => n.tagName === 'tr' && n.className !== 'machine-row');
  assert.deepEqual(rows.map((r) => r.children.slice(0, 3).map((td) => td.textContent)),
    [['▶Synthetic Daily' + 'Daily (weekdays)', 'Overdue since D2026-11-03', 'No runs yet'],
     ['▶Synthetic Source Exchange', 'As needed', 'Recorded D2026-10-13']], 'as needed once; the date once, under Last result');
  assert.match(source, /if \(a\.state === "ready"\) return a\.last_done \? `As needed · last run \$\{shortDate\(a\.last_done\)\}` : "As needed";/, 'Setup QA and the machine page keep the last-run date');
  for (const rule of [' #app[data-page="perform-qa"] td[data-label]:not(:first-child)::before { content:attr(data-label); color:var(--muted); font-size:14px; flex:none; }',
    ' #app[data-page="perform-qa"] .fixed-table td.list-cell { justify-content:flex-start; }',
    ' #app[data-page="perform-qa"] .fixed-table tbody tr:not(.machine-row) > td:nth-child(4) { display:none; }']) assert.ok(phoneRules.includes(rule), rule);
  assert.match(phoneRules, /#app\[data-page="perform-qa"\] \.fixed-table td \{ display:flex;[^}]*padding:4px 0;/);
  assert.match(between('async function renderDashboard(', '// Click a list'), /fixedTable\(\[\["QA list", "40%"\], \["Status", "24%"\], \["Last result", "24%"\], \["History", "12%"\]\], rows\)/, 'History is the 4th cell');
}

// 4. List editor on a phone: the table's frame scrolls sideways, which makes it the pinned column row's scroll box; the
// row then sat --sticky-top (131-168 px) down inside the table, over tests 1.01-1.03. On a phone it scrolls away.
{
  assert.ok(phoneRules.includes('  .table-wrap { display:block; width:100%; overflow-x:auto; }\n  /* That frame would hold the list editor\'s pinned column row, which then sat over its first tests: it scrolls away. */\n  table.list-editor thead th { position:static; }'),
    'the column row is static wherever its frame scrolls sideways');
  assert.match(css, /^table\.list-editor thead th \{ position: sticky; top: var\(--sticky-top, 0px\);/m, 'a computer keeps the pinned column row');
}

// 5. View As keeps the page when the chosen role may open its tab (the tabs' own test), else opens the Dashboard; no
// "Active" beside the menu; the banner names the person once: "Viewing as Therapist · saved as <name> (Admin)".
{
  const c = dom({ state: { user: { id: 1, role: 'admin' }, actingRole: null } });
  vm.runInContext(between('function activeRole(', 'let toastTimer;') + between('const NAV = [', 'function personIcon(') + between('function mayOpenTab(', 'function renderShell('), c);
  const lands = (role, hash) => { c.state.actingRole = role === 'admin' ? null : role; return c.mayOpenTab(hash) ? hash : '#/'; };
  assert.deepEqual(['therapist', 'admin', 'physicist', 'mpa'].map((r) => lands(r, '#/review')), ['#/review', '#/review', '#/review', '#/review']);
  assert.deepEqual(['therapist', 'mpa', 'physicist'].map((r) => lands(r, '#/admin')), ['#/', '#/', '#/admin'], 'Data Administration needs configure');
  assert.equal(lands('therapist', '#/queues/6'), '#/', 'a list editor is under Setup QA');
  assert.equal(lands('therapist', '#/trends?machine_id=2&range=90'), '#/trends?machine_id=2&range=90');
  assert.equal(lands('mpa', '#/runs/2053'), '#/runs/2053', 'a saved run is under Review QA');
  assert.equal(lands('therapist', '#/search?q=PBS'), '#/search?q=PBS', 'a page in no tab stays');
  assert.equal(lands('therapist', ''), '', 'the Dashboard stays');
  const control = between('function viewAsControl(', 'function mayOpenTab(');
  assert.match(control, /if\(!mayOpenTab\(location\.hash\)\)location\.hash='#\/';renderShell\(\);route\(\);/);
  assert.doesNotMatch(control, /'Active'/);
  assert.match(between('function renderShell(', 'function machineColorClass('), /`Viewing as \$\{ROLE_LABEL\[state\.actingRole\]\} · saved as \$\{personName\(state\.user\.full_name,state\.user\.username\)\} \(Admin\)`/);
}

// 6. Machine Trends. (a) A machine's lists in the Dashboard's order (daily first, then by name), in the menu and for the
// busiest-list tie (a new install opens the daily list, not the monthly one). (b) A test opened on the overview opens and
// is drawn again when the overview is drawn again (Back, "← All tests", another period); one closed is closed again.
// (c) "← All tests" on a test opened from the overview goes Back (its place and open tests); otherwise it is a link.
// (d) Nothing to show: one card that says why, without Export CSV or the trend summary.
{
  const order = dom();
  vm.runInContext(between('const FREQ_ORDER', 'function frequentQaAssignments('), order);
  const menu = [{ id: 1, queue_name: 'Monthly QA template', frequency: 'monthly' }, { id: 2, queue_name: 'Synthetic SRS', frequency: 'asneeded' },
    { id: 3, queue_name: 'PBS DailyQA Template', frequency: 'daily' }, { id: 4, queue_name: 'Another daily', frequency: 'daily' }];
  assert.deepEqual([...menu].sort(vm.runInContext('scheduleOrder', order)).map((a) => a.id), [4, 3, 1, 2]);
  const trends = between('async function renderTrends()', '// Users, audit, account');
  assert.match(trends, /\.filter\(\(a\) => a\.active && \(activeRole\(\)!=='therapist'\|\|a\.frequency!=='monthly'\)\)\.sort\(scheduleOrder\) : \[\];/, 'the menu, the templates and the busiest-list tie in that order');
  const c = dom({ window: {}, location: { hash: '#/trends?machine_id=1&list=7&range=90' }, rangeStart: () => '', filterRange: (p) => p, judgedByList: (i, p) => p,
    trendSourceNumberer: () => (p) => p, trendDisplayName: (n) => n, categoryLabel: (c) => c, trendPassRing: () => null, browserFolders: () => false, can: () => true,
    trendKeyCheck: (g) => (g.base === 'Distal Depth [mm]' ? 'depth' : null), trendGroups: (items) => items.map((i) => ({ base: i.name, category: 'Range', members: [i] })) });
  vm.runInContext(between('async function renderTrendOverview(', 'function renderTrendDetail(') + between('const openTrendGroups = new Set();', 'async function renderTrends()')
    + `function trendGroupChart(g) { return el('figure', {}, g.base); }
       function trendInsightsCard() { return el('section', { class: 'card trend-insights' }, 'Trend summary'); }`, c);
  const item = (test_id, name, points = 3) => ({ test_id, name, type: 'numeric', points: Array.from({ length: points }, (_, k) => ({ qa_date: `2026-10-0${k + 1}`, run_id: k + 1 })) });
  const template = (items) => ({ assignment: { id: 7 }, queue: { name: 'Synthetic daily' }, items });
  const histories = (items) => Object.fromEntries(items.map((i) => [i.test_id, i.points]));
  // The toolbar renderTrends puts above the overview (trendFileTools): Import Folder where the page offers it, Export CSV.
  const firstWithClass = (node, sel) => node.find((n) => n !== node && n.className.split(/\s+/).includes(sel.slice(1)))[0] || null;
  const removable = (n) => Object.assign(n, { querySelector: (sel) => firstWithClass(n, sel), remove: () => { n.parentNode.childNodes = n.parentNode.childNodes.filter((k) => k !== n); } });
  c.app.querySelector = (sel) => firstWithClass(c.app, sel);
  const draw = async (items, lists = [{ id: 7 }], templates = [template(items)]) => {
    c.app.childNodes = [];
    c.app.append(removable(c.el('div', { class: 'row trend-file-tools' }, c.can('perform') && c.browserFolders() ? removable(c.el('button', { type: 'button' }, 'Import Folder')) : null,
      removable(c.el('button', { type: 'button', class: 'trend-export' }, 'Export CSV')))));
    await c.renderTrendOverview([{ id: 1, name: 'G1' }], '1', '90', '7', templates, Promise.resolve({ histories: histories(items), order: {} }), lists);
    return c.app;
  };
  const tests = [item(1, 'Distal Depth [mm]'), item(2, 'Proximal Depth [mm]'), item(3, 'Distal Fall Off [mm]')];
  const charts = (app) => Object.fromEntries(app.find((n) => n.tagName === 'details').map((d) => [d.childNodes[0].textContent, d.open ? (d.childNodes[1].childNodes.length ? 'open, drawn' : 'open, empty') : 'closed']));
  let app = await draw(tests);
  assert.deepEqual(charts(app), { 'Distal Depth [mm]': 'open, drawn', 'Proximal Depth [mm]': 'closed', 'Distal Fall Off [mm]': 'closed' }, 'key checks open, the rest closed');
  const fallOff = app.find((n) => n.tagName === 'details' && n.childNodes[0].textContent === 'Distal Fall Off [mm]')[0];
  fallOff.open = true; await fallOff.fire('toggle');
  app = await draw(tests);
  assert.deepEqual(charts(app), { 'Distal Depth [mm]': 'open, drawn', 'Proximal Depth [mm]': 'closed', 'Distal Fall Off [mm]': 'open, drawn' }, 'drawn again: the test opened before is open');
  const again = app.find((n) => n.tagName === 'details' && n.childNodes[0].textContent === 'Distal Fall Off [mm]')[0];
  again.open = false; await again.fire('toggle');
  assert.deepEqual(charts(await draw(tests)), { 'Distal Depth [mm]': 'open, drawn', 'Proximal Depth [mm]': 'closed', 'Distal Fall Off [mm]': 'closed' }, 'closed again: closed');
  // (c) "← All tests" goes Back only when the page before it in this tab is the overview (its history entry notes the page
  // it was opened from, gatorqaFrom). After a run's "Full trend" (the same address), a QA form or another period it is the
  // link to the overview; round 3 compared addresses and went Back to the run, the form or the other period.
  const allTests = trends.match(/testIds\.length \? el\("a", \{ class: "button", onclick: (\(e\) => \{[^\n]*\}),\n\s+href: `#\/trends\?\$\{new URLSearchParams\(Object\.entries\(\{ machine_id: machineId, list: listId, range \}\)/)[1];
  const testPage = '#/trends?machine_id=1&list=1&test_id=179&range=365';
  const clickAllTests = (from) => {
    const did = [];
    const ctx = vm.createContext({ URLSearchParams, location: { hash: testPage }, trendBack: testPage, history: { length: 6, state: { gatorqaEntry: 0.5, ...(from && { gatorqaFrom: from }) }, back: () => did.push('back') } });
    vm.runInContext(between('const pageKey = ', 'const places = '), ctx);
    vm.runInContext(`(${allTests})`, ctx)({ preventDefault: () => did.push('preventDefault') });
    return did.join(' ') || 'link';
  };
  assert.equal(clickAllTests('#/trends?machine_id=1&list=1&range=365'), 'preventDefault back', 'opened from the overview: Back, to its place and open tests');
  assert.equal(clickAllTests('#/trends'), 'preventDefault back', 'the overview as its tab opens it');
  assert.equal(clickAllTests('#/runs/2053?from=trends'), 'link', "after a run's Full trend: the overview, not the run");
  assert.equal(clickAllTests('#/perform/1'), 'link', "after a QA form's Full trend: the overview, not the form");
  assert.equal(clickAllTests('#/trends?machine_id=1&list=1&test_id=179&range=90'), 'link', 'after another period: the overview, not that period');
  assert.equal(clickAllTests(undefined), 'link', 'opened on its own');
  assert.doesNotMatch(source, /\btrendBack\b/, 'no address is remembered for it');
  // (d) One card, no Export CSV (removed), no trend summary. Import Folder stays where the page offers it (GatorQA's own
  // builds, a role that performs QA) and there is a list to import into, and only then does the card say to import.
  const toolbar = () => c.app.find((n) => /trend-file-tools/.test(n.className)).map((row) => row.children.map((b) => b.textContent).join(' + '));
  const empty = async (...args) => { const a = await draw(...args); return [a.find((n) => n.className === 'card empty').map((n) => n.textContent), a.find((n) => /trend-insights/.test(n.className)).length, toolbar()]; };
  assert.deepEqual(await empty([], [], []), [['Nothing scheduled.'], 0, []], 'a machine with no QA list');
  assert.deepEqual(await empty([], [{ id: 7 }], [template([{ test_id: 9, name: 'Source check', type: 'boolean' }])]), [['This list has no measured values.'], 0, []], 'a list with no measured tests');
  assert.deepEqual(await empty([item(1, 'Distal Depth [mm]', 0)]), [['No QA recorded on G1 in this period.'], 0, []], 'nothing recorded in the period');
  c.browserFolders = () => true;
  assert.deepEqual(await empty([item(1, 'Distal Depth [mm]', 0)]), [['No QA recorded on G1 in this period. Import reports or choose a longer period.'], 0, ['Import Folder']],
    'the browser build can import here: Import Folder stays, Export CSV goes');
  assert.deepEqual(await empty([], [], []), [['Nothing scheduled.'], 0, []], 'no list to import into: no toolbar');
  c.can = (right) => right !== 'perform';
  assert.deepEqual(await empty([item(1, 'Distal Depth [mm]', 0)]), [['No QA recorded on G1 in this period.'], 0, []], 'a role that cannot import is not told to');
  c.can = () => true;
  await draw(tests);
  assert.deepEqual(toolbar(), ['Import Folder + Export CSV'], 'with something to show, both');
  assert.match(between('function trendFileTools(', 'function trendPattern('), /const exportButton = el\('button', \{ type: 'button', class: 'trend-export', onclick:/, 'the button the empty page removes');
}

// 7. Links into and out of Machine Trends. A run opened from it (a chart dot, a value, an insight) says from=trends, and
// its "Back to Machine Trends" goes Back, to the place it was left (a long values table opened there opens again); a ring
// with no result yet and the trends icon of a machine with no list are not links to a page that cannot show anything.
{
  const c = dom();
  vm.runInContext(between('function trendRunHref(', 'function pointTooltip(') + between('function historyRing(', 'async function renderDashboard('), c);
  assert.equal(c.trendRunHref({ run_id: 17, source_test_id: 42 }), '#/runs/17?test_id=42&from=trends');
  assert.equal(c.trendRunHref({ run_id: 17 }), '#/runs/17?from=trends');
  assert.match(between('function renderTrendDetail(', 'function stat('), /el\('a',\{href:`#\/runs\/\$\{row\.run_id\}\?from=trends`\},row\.qa_date\)/, "a value's date");
  const run = between('async function renderRun(', 'function bandValue(');
  // Back only when the page before it in this tab is Machine Trends (gatorqaFrom); otherwise its link, to the run's own
  // machine and list. Round 3 went Back whenever the tab had history: out of GatorQA after a bookmark or a link from
  // another page, or to Review QA when the address was pasted there; and a new tab opened GTR1 for any machine.
  assert.match(run, /from === 'trends' \? \[`#\/trends\?machine_id=\$\{run\.machine_id\}&list=\$\{run\.assignment_id\}`, 'Machine Trends'\]/);
  const backClick = run.match(/const backClick = from === 'trends' \? (\(e\) => \{[^\n]*\}) : null;/)[1];
  const clickRunBack = (from, length = 5) => {
    const did = [];
    const ctx = vm.createContext({ history: { length, state: { gatorqaEntry: 1, ...(from && { gatorqaFrom: from }) }, back: () => did.push('back') } });
    vm.runInContext(`(${backClick})`, ctx)({ preventDefault: () => did.push('preventDefault') });
    return did.join(' ') || 'link';
  };
  assert.equal(clickRunBack('#/trends?machine_id=1&list=1&test_id=179&range=365'), 'preventDefault back', 'opened from Machine Trends: Back, to the place left there');
  assert.equal(clickRunBack('#/trends?machine_id=1'), 'preventDefault back');
  assert.equal(clickRunBack('#/review'), 'link', 'the address pasted on Review QA: Machine Trends, not Review QA');
  assert.equal(clickRunBack(undefined), 'link', 'a bookmark or a link from another page: Machine Trends, not out of GatorQA');
  assert.equal(clickRunBack(undefined, 1), 'link', 'a new tab');
  assert.equal((run.match(/href:back\[0\],onclick:backClick\}/g) || []).length, 2, 'both Back buttons');
  const detail = between('function renderTrendDetail(', 'function stat(');
  assert.match(detail, /open:rows\.length<=20\|\|openTrendGroups\.has\(key\)/);
  assert.match(detail, /card\.addEventListener\('toggle',\(\)=>\{if\(card\.open\)openTrendGroups\.add\(key\);else openTrendGroups\.delete\(key\);\}\);/);
  const ring = (counts) => { const r = c.historyRing(counts, '#/trends?machine_id=9&list=14', 'HDR'); return [r.tagName, r.getAttribute('href'), r.textContent]; };
  assert.deepEqual(ring({}), ['span', null, '—'], 'no result yet: no link');
  assert.deepEqual(ring({ recorded: 2 }), ['a', '#/trends?machine_id=9&list=14', '—'], 'unjudged values still have a trend');
  assert.deepEqual(ring({ pass: 3 }), ['a', '#/trends?machine_id=9&list=14', '100%']);
  assert.match(between('async function renderHome(', '// Dark mode on/off'), /m\.queues\.length\?el\('a',\{class:'icon-link',href:`#\/trends\?machine_id=\$\{m\.id\}`/, 'the trends icon only for a machine with a list');
}

// 8. The machine page (from Dashboard and Setup QA machine names): its lists in the Dashboard's order (daily first) with a
// green ▶ before each active list (no Start button on due lists only); a therapist's without monthly lists, as on the
// Dashboard and Perform QA; "Schedule a QA list" and the machine's own actions in one ⋮ menu after it; ⋮ per list.
{
  const assignments = [
    { id: 31, queue_id: 3, queue_name: 'Monthly QA template', frequency: 'monthly', state: 'upcoming', active: 1, next_due: '2026-11-30', schedule: 'Monthly (due at month end)' },
    { id: 32, queue_id: 4, queue_name: 'PBS DailyQA Template', frequency: 'daily', state: 'overdue', active: 1, next_due: '2026-11-03', schedule: 'Daily (weekdays)' },
    { id: 33, queue_id: 5, queue_name: 'Paused daily', frequency: 'daily', state: 'due', active: 0, next_due: '2026-11-06', schedule: 'Daily (weekdays)' }];
  const draw = async (role) => {
    const c = dom({ state: { user: { id: 1, role }, actingRole: null }, shortDate: (d) => d, Date,
      api: async (method, path) => (path === '/api/machines' ? [{ id: 1, name: 'G1', kind: 'Proton gantry', active: 1 }] : assignments.map((a) => ({ ...a }))),
      page: (title, subtitle, actions) => { c.head = actions; }, modal() {}, toast() {}, route() {}, importSphinxDialog() {}, machineForm() {}, retireMachine() {}, deleteMachine() {} });
    vm.runInContext(between('const FREQ_LABEL', 'const WEEKDAYS') + between('function activeRole(', 'let toastTimer;') + between('const FREQ_ORDER', 'function frequentQaAssignments(')
      + between('async function renderMachine(', 'async function renderLimits('), c);
    await c.renderMachine('1');
    const cards = c.app.find((n) => n.className === 'card list-row');
    return { c, cards, names: cards.map((card) => card.find((n) => n.tagName === 'strong')[0].textContent), dots: cards.map((card) => card.find((n) => n.className === 'start-dot').map((a) => a.getAttribute('href'))[0] || null),
      buttons: cards.flatMap((card) => card.find((n) => /\bbutton\b/.test(n.className)).map((n) => n.textContent)) };
  };
  const admin = await draw('admin');
  assert.deepEqual(admin.names, ['Paused daily', 'PBS DailyQA Template', 'Monthly QA template'], 'daily first, then by name');
  assert.deepEqual(admin.dots, [null, '#/perform/32', '#/perform/31'], 'a ▶ before every active list, due or not');
  assert.deepEqual(admin.buttons, ['History', 'History', 'History'], 'no Start or More buttons');
  assert.deepEqual(admin.cards.map((card) => card.find((n) => n.tagName === 'summary').map((s) => [s.textContent, s.className])[0]), [['⋮', 'icon-action'], ['⋮', 'icon-action'], ['⋮', 'icon-action']]);
  assert.deepEqual([...admin.c.head].map((n) =>  // (an array from the page's realm)
    (n.tagName === 'details' ? `⋮ ${n.find((m) => m.tagName === 'button').map((b) => b.textContent).join(' / ')}` : n.textContent)),
    ['Schedule a QA list', '⋮ Edit machine / Retire machine / Delete machine'], 'the main action, then the menu');
  const therapist = await draw('therapist');
  assert.deepEqual(therapist.names, ['Paused daily', 'PBS DailyQA Template'], 'no monthly list for a therapist');
  assert.equal(therapist.c.head.length, 0);
  assert.ok(css.includes('  .list-row > .chip { justify-self: start; }') && css.includes('  .list-row details.more .menu { left: 0; right: auto; }'), 'phone: the status at its width, the menu on screen');
  assert.ok(css.includes('.page-head details.more .menu { min-width: 0; white-space: nowrap; }'));
  // On a phone the ⋮ menus (the only way to Edit, Retire or Delete a machine) are a finger's size, 44 px as the ▶ beside
  // them (they were 32 px, smaller than the buttons they replaced); Setup QA's ⋮ and ✎ buttons are not changed here.
  assert.ok(phoneBlock.includes('  .page-head details.more > summary.icon-action, .list-row details.more > summary.icon-action { width: 44px; height: 44px; }'), 'phone: ⋮ 44 px');
  assert.doesNotMatch(source, /\bstartable\(/, 'nothing left uses startable');
}

// 9. "Values for this machine": Back, and Save, go back to where it was opened from (Setup QA, the machine page, the list
// editor), or to Setup QA when it was opened on its own (it sent everyone to the old machine page); its column says Baseline.
{
  const limits = between('async function renderLimits(', '// ---------------------------------------------------------------------------\n// Performing a QA list');
  assert.match(limits, /table\(\["Test", "Baseline", "Warning ±", "Action ±", "Limits are"\], rows\)/);
  // Back only to a GatorQA page it was opened from (gatorqaFrom). Round 3 went Back whenever the tab had history, which left
  // GatorQA after a bookmark or a link from another page, and in the browser-only build lost a Save made just before.
  const limitsBack = limits.match(/const back = (\(\) => \{[^\n]*\});/)[1];
  const leave = (from, length = 4) => {
    const did = [];
    const ctx = vm.createContext({ history: { length, state: { gatorqaEntry: 1, ...(from && { gatorqaFrom: from }) }, back: () => did.push('back') }, location: { set hash(h) { did.push(h); } } });
    vm.runInContext(`(${limitsBack})`, ctx)();
    return did.join(' ');
  };
  assert.equal(leave('#/setup'), 'back', 'opened from Setup QA: Back there, to the place left');
  assert.equal(leave('#/machines/1'), 'back', 'from the machine page');
  assert.equal(leave('#/queues/6'), 'back', 'from the list editor');
  assert.equal(leave(undefined), '#/setup', 'opened on its own after another page in the tab: Setup QA, not out of GatorQA');
  assert.equal(leave(undefined, 1), '#/setup', 'a new tab');
  assert.match(limits, /el\("a", \{ class: "button", href: "#\/setup", onclick: \(e\) => \{ e\.preventDefault\(\); back\(\); \} \}, "Back"\)/);
  assert.match(limits, /toast\("Limits saved"\);\n\s+back\(\);/);
  assert.doesNotMatch(limits, /#\/machines\//, 'never the old machine page');
}

// 10. QA form: the Protocol box starts closed at every width (on floridaphysics.com the 1200px test means 767px, so it
// opened on every computer, 105-148 px of transcription notes above the first test); one click opens it.
{
  const form = between('async function renderPerform(', 'const inputs = [];');
  assert.match(form, /app\.append\(el\("details", \{ class: "card instructions" \}, el\("summary", \{\}, el\("strong", \{\}, "Protocol"\)\)/);
  assert.doesNotMatch(form, /instructions", open:/);
}

// 11. List editor opened read-only (a therapist or MPA by link): no "Import blocks" card, which offers nothing to them.
{
  const editor = between('async function renderQueueEditor(', 'function choiceOptions(');
  assert.match(editor, /const editable = can\("configure"\);/);
  assert.match(editor, /\n  if\(editable\)\{drawImportBlocks\(\);app\.append\(importBlocksBox\);\}/);
  assert.equal((editor.match(/app\.append\(importBlocksBox\)/g) || []).length, 1);
}

// 12. Search without setup rights: a QA list opens where it is performed (its QA form when on one machine, else Perform
// QA), not the read-only list editor; only lists scheduled somewhere, and a therapist sees no monthly list (Dashboard).
{
  const queues = [{ id: 5, name: 'Synthetic SRS', machines: 'LinacA', active: 1 }, { id: 6, name: 'Synthetic PBS daily', machines: 'G1, G2', active: 1 },
    { id: 8, name: 'Synthetic monthly', machines: 'G1', active: 1 }, { id: 9, name: 'Synthetic unscheduled', machines: '', active: 1 }];
  const schedules = [{ id: 9, queue_id: 5, active: 1, frequency: 'asneeded' }, { id: 1, queue_id: 6, active: 1, frequency: 'daily' }, { id: 4, queue_id: 6, active: 1, frequency: 'daily' },
    { id: 2, queue_id: 8, active: 1, frequency: 'monthly' }];
  const links = async (role) => {
    const asked = [];
    const c = dom({ state: { user: { id: 1, role }, actingRole: null }, location: { hash: '#/search?q=Synthetic' },
      api: async (m, path) => { asked.push(path); return path === '/api/queues' ? queues : path === '/api/assignments' ? schedules : path === '/api/tests' ? [] : []; },
      page() {}, categoryLabel: (x) => x });
    vm.runInContext(between('function activeRole(', 'let toastTimer;') + between('function queryParams(', '// -----') + between('async function renderSearch(', '// Folder handles stay')
      + 'function fixedTable(cols, rows) { return el("table", {}, rows); }', c);
    await c.renderSearch();
    return { asked, links: c.app.find((n) => n.tagName === 'a').map((a) => `${a.textContent} ${a.getAttribute('href')}`) };
  };
  const admin = await links('admin');
  assert.deepEqual(admin.links, ['Synthetic SRS #/queues/5', 'Synthetic PBS daily #/queues/6', 'Synthetic monthly #/queues/8', 'Synthetic unscheduled #/queues/9'], 'setup rights: the list editor, as before');
  assert.ok(!admin.asked.includes('/api/assignments'));
  assert.deepEqual((await links('mpa')).links, ['Synthetic SRS #/perform/9', 'Synthetic PBS daily #/perform-qa', 'Synthetic monthly #/perform/2']);
  assert.deepEqual((await links('therapist')).links, ['Synthetic SRS #/perform/9', 'Synthetic PBS daily #/perform-qa'], 'no monthly list for a therapist');
}

// 13. "Record past imports as history…" (a one-off clean-up) is a quiet button on Data Administration under Import folders,
// for the review right, not a permanent top button on Review QA (tests/test_record_history_dialog.cjs checks the dialog).
{
  assert.doesNotMatch(between('async function renderReview()', 'async function renderRuns()'), /Record past imports/);
  const admin = between('async function renderAdmin()', 'async function renderUsers()');
  assert.ok(admin.indexOf('Record past imports as history…') > admin.indexOf('rows, "No QA lists are scheduled yet."'), 'under the Import folders table');
  // A normal (secondary) button, 37 px tall as on Review QA and as Save backup below it; "small" made it 29 px on a phone.
  assert.match(admin, /el\("button", \{ type: "button", onclick: \(\) => recordHistoryDialog\(\)/);
  assert.doesNotMatch(admin.slice(admin.indexOf('recordHistoryDialog()') - 200, admin.indexOf('recordHistoryDialog()')), /class: "small"/, 'not a small button');
  for (const p of ['README.md', 'docs/USER_GUIDE.txt']) assert.match(fs.readFileSync(p, 'utf8'), /Record past imports as history…(\*\*)? on Data Administration, under Import folders/, p);
}

console.log('GUI and navigation 3: Review QA and Past results as compact phone cards; Data Administration cards on a phone, one rights table, quiet folder Save; Perform QA says As needed once and its phone cards are shorter; the list editor column row no longer covers tests on a phone; View As keeps the page its role may open; Machine Trends lists daily first, keeps open tests after Back, All tests goes Back, one empty card; a run from Machine Trends goes back there and empty rings are not links; the machine page lists daily first with a start button before each list; Values for this machine goes back where it came from; the Protocol box starts closed; no Import blocks card on a read-only list; a search opens a list where it is performed; Record past imports moves to Data Administration.');
})().catch((err) => { console.error(err); process.exit(1); });
