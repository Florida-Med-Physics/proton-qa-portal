// Synthetic checks that a page left while it is still loading stops drawing. On a slow site Setup QA showed Review QA's
// "Awaiting Physics Review" and "Recently reviewed" tables under its own heading: Review QA's late replies were still
// drawn into the one page container. The real route(), api(), page(), logout(), Review QA, Setup QA, Machine Trends
// and draft-saving code run in node:vm with a tiny DOM stand-in and a server whose replies the test releases one by one.
// Run with node tests/test_stale_pages.cjs from the repository root.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('portal/static/app.js', 'utf8');
assert.equal(fs.readFileSync('docs/app.js', 'utf8'), source, 'docs/app.js is out of step: run python build_pages.py');
const between = (from, to) => { const a = source.indexOf(from), b = source.indexOf(to, a + 1); assert.ok(a >= 0 && b > a, `${from} … ${to}`); return source.slice(a, b); };

// A few DOM nodes: enough for the pages to build their trees and for the test to read the text on screen.
const flat = (kids) => kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false);
const text = (n) => (n && typeof n === 'object' ? n.kids.map(text).join(' ') : String(n ?? ''));
const find = (n, cls) => { for (const k of n.kids || []) { if (typeof k !== 'object') continue; if (` ${k.props.class || ''} `.includes(` ${cls} `)) return k; const f = find(k, cls); if (f) return f; } return null; };
const all = (n, test, out = []) => { for (const k of n.kids || []) if (typeof k === 'object') { if (test(k)) out.push(k); all(k, test, out); } return out; };
function node(tag, props, ...kids) {
  const n = { tag, props: props || {}, kids: flat(kids), dataset: {}, style: { removeProperty() {} }, checked: !!(props || {}).checked,
    classList: { add: (...c) => { n.props.class = [n.props.class, ...c].filter(Boolean).join(' '); } },
    append: (...k) => { n.kids.push(...flat(k)); }, replaceChildren: (...k) => { n.kids = flat(k); }, addEventListener() {},
    querySelector: (sel) => find(n, sel.replace(/^\./, '')), querySelectorAll: () => [],
    get textContent() { return text(n); }, set textContent(t) { n.kids = [String(t)]; } };
  return n;
}
const app = node('main');
const shown = () => text(app);
const count = (pattern) => (shown().match(pattern) || []).length;

// The synthetic server: every request waits until the test answers it.
const pending = [], received = [], sent = {};
const serve = (method, path, body) => new Promise((resolve) => { pending.push({ method, path, body, resolve }); received.push(`${method} ${path}`); sent[`${method} ${path}`] = body; });
function release(key, { status = 200, last = false } = {}) {
  const matches = pending.filter((r) => `${r.method} ${r.path}` === key);
  assert.ok(matches.length, `nothing waits for ${key}; waiting: ${pending.map((r) => `${r.method} ${r.path}`).join(', ')}`);
  const r = last ? matches.at(-1) : matches[0];
  pending.splice(pending.indexOf(r), 1);
  r.resolve(status === 200 ? [200, reply(r)] : [status, { error: `Synthetic ${status}` }]);
}
const run = (id, review_status) => ({ id, review_status, review_ready: true, qa_date: '2026-11-03', machine_name: 'Synthetic Gantry A', queue_name: 'Synthetic daily list', overall: 'pass', performer: 'synthetic' });
const schedule = { id: 21, machine_id: 7, queue_id: 1, queue_name: 'Synthetic daily list', active: 1, archived: 0, frequency: 'daily', interval_days: 1, weekdays: '0,1,2,3,4', start_date: '2026-01-01', schedule: 'Daily', override_count: 0 };
function reply({ method, path, body }) {
  const key = `${method} ${path}`;
  const trends = /^GET \/api\/machines\/7\/trends\?from=([\d-]+)&page=(\w+)$/.exec(key);
  // Each part of a period's history carries the period's first date, so the page shows which period it drew.
  if (trends) return { token: 'synthetic', order: {}, tests: { 5: 0 }, series: [[{ assignment_id: 21, run_id: trends[2] === 'start' ? 1 : 2, qa_date: trends[1], value: 1 }]], next: trends[2] === 'start' ? 'p2' : null };
  return {
    'GET /api/runs?limit=400': () => [run(1, 'pending'), run(2, 'approved')],
    'GET /api/runs?trashed=1&limit=200': () => [run(3, 'pending')],
    'GET /api/queues': () => [{ id: 1, name: 'Synthetic daily list', active: 1, item_count: 3 }],
    'GET /api/machines': () => [{ id: 7, name: 'Synthetic Gantry A', kind: 'Proton gantry', active: 1 }],
    'GET /api/machines/7/assignments': () => [schedule],
    'GET /api/assignments/21/template': () => ({ assignment: { id: 21 }, queue: { name: 'Synthetic daily list' }, items: [] }),
    'PUT /api/assignments/21': () => ({ ...schedule, active: body.active ? 1 : 0 }),
    'PUT /api/assignments/5/draft': () => ({ saved_at: '2026-11-04T09:30:00' }),
    'POST /api/logout': () => ({}),
    'POST /api/password': () => ({}),
  }[key]();
}
const toasts = [];
let signIns = 0;
const context = {
  app, Promise, URLSearchParams, Date, Number, String, Object, Set, Map, setTimeout, clearTimeout,
  window: {}, location: { hash: '#/' }, state: { user: { id: 1, username: 'synthetic', role: 'physicist' }, actingRole: null },
  sessionStorage: { removeItem() {} }, document: { addEventListener() {}, getElementById: () => null }, requestAnimationFrame: (fn) => fn(),
  fetch: (path, init) => serve(init.method, path, init.body === undefined ? undefined : JSON.parse(init.body)).then(([status, data]) => ({ status, ok: status < 400, json: async () => data })),
  el: node, renderShell() {}, renderLogin() { signIns++; app.replaceChildren(node('form', {}, 'Sign in')); }, toast: (message) => toasts.push(message),
  can: (right) => ['perform', 'review', 'configure'].includes(right), activeRole: () => 'physicist', confirm: () => true,
  chip: (status, label) => node('span', {}, label || status), reviewChip: (r) => node('span', {}, r.review_status), reviewRowActions: () => node('a', {}, 'Open'),
  machineLabel: (name) => node('span', {}, name), shortDate: (d) => d, fixedTable: (cols, rows, empty) => node('table', {}, rows.length ? rows : empty),
  table: (heads, rows) => node('table', {}, rows), filterBox: () => node('input'), select: (name, options, value) => node('select', { name, value }),
  MODALITIES: ['Proton', 'Photon'], modalityOf: () => 'Proton', FREQ_ORDER: { daily: 0, monthly: 2 }, QADerived: { value: (input) => input.value },
  trendSourceNumberer: () => (p) => p, trendFileTools: () => node('div', {}, 'Import Folder', 'Export CSV'),
  // Stand-in for the chart overview: it asks for what the real one asks for (the machine's lists, the period's history).
  async renderTrendOverview(machines, machineId, range, listId, templates, historyRequest) {
    await context.api('GET', `/api/machines/${machineId}/assignments`);
    const { histories } = await historyRequest;
    app.append(node('section', {}, `Overview from ${[...new Set(Object.values(histories).flat().map((p) => p.qa_date))].join(', ')}`));
  },
  // Stand-in for the QA form: the real draft-saving code (Mark in Progress) under a page heading.
  async renderPerform(assignmentId) {
    context.page('Synthetic Gantry A · Synthetic daily list', 'Daily');
    const draftNote = node('span', { class: 'muted small' });
    app.append(node('div', { class: 'submit-bar' }, draftNote));
    context.form = context.draftForm(assignmentId, draftNote);
  },
  // A page whose last step is a write that fails after the person has left it.
  async renderAccount() { context.page('My account'); await context.api('POST', '/api/password', {}); },
};
for (const name of ['renderHome', 'renderDashboard', 'renderAdmin', 'renderMachines', 'renderMachine', 'renderLimits', 'renderQueues', 'renderQueueEditor', 'renderTests',
  'renderRuns', 'renderRun', 'renderSearch', 'renderUsers', 'renderAudit', 'recordHistoryDialog', 'modal', 'machineForm', 'scheduleDialog', 'copyDialog', 'archiveList', 'deleteList', 'scheduleForm', 'scheduleData']) context[name] = async () => {};
vm.createContext(context);
vm.runInContext([
  between('// route() numbers each page it draws', '// A site that hosts these pages'),
  between('const qaTableObservers = new Set();', 'function table('),
  between('async function logout()', 'function queryParams()'),
  between('function queryParams()', '// Proton gantries, then Photon'),
  between('// Setup QA: shared QA template lists', '// Browser-only build: the whole database can live'),
  between('async function renderReview()', 'async function renderRuns()'),
  between('// First QA date a period shows', 'function stats(points)'),
  between('function busiestList(', 'function userForm('),
  `this.draftForm = (assignmentId, draftNote) => {
    const inputs = [{ item: { test_id: 3 }, input: { value: '226.4' }, comment: { value: '' } }], qaDate = { value: '2026-11-04' }, runComment = { value: 'Synthetic draft' };
    ${between('  let autosaveTimer, autosaveStopped', '  const saveDraft = el(')}
    return { persistDraft, draftNote };
  };`,
].join('\n'), context);

// "Add them" (adds a Sphinx file's other tests, then redraws the QA form to apply the file again) is taken by that redraw
// before it waits for anything, so a redraw the person leaves cannot hand the file to the next QA list they open.
const perform = between('async function renderPerform(', 'function importSphinxDialog(');
assert.match(perform, /^async function renderPerform\(assignmentId\) \{\r?\n  \/\/[^\n]*\n  const applySphinxOnLoad = state\.applySphinxOnLoad;\r?\n  state\.applySphinxOnLoad = false;\r?\n  const t = await api\(/);
assert.deepEqual(perform.match(/state\.applySphinxOnLoad[^;]*;/g), ['state.applySphinxOnLoad;', 'state.applySphinxOnLoad = false;', 'state.applySphinxOnLoad = true;']);
assert.match(perform, /\n  if \(applySphinxOnLoad && state\.sphinxFile\) await applySphinx\(\);\r?\n\}/);

const settle = async () => { for (let i = 0; i < 20; i++) await new Promise((resolve) => setImmediate(resolve)); };
// What a click on a link does: the hash changes and the hashchange listener calls route() (never awaited).
const go = async (hash) => { context.location.hash = hash; context.route(); await settle(); };
const trends = (days, part) => `GET /api/machines/7/trends?from=${context.rangeStart(String(days))}&page=${part}`;
const loadSetup = async () => { release('GET /api/queues'); release('GET /api/machines'); await settle(); release('GET /api/machines/7/assignments'); await settle(); };
const setupOnly = (label) => {
  assert.match(shown(), /Setup QA[\s\S]*QA Template Lists[\s\S]*Machine Schedules/, label);
  assert.doesNotMatch(shown(), /Review QA|Awaiting Physics Review|Recently reviewed|Awaiting Therapy Review|Trash/, label);
  assert.equal(count(/QA Template Lists/g), 1, label);
};
const reviewOnly = (label) => {
  assert.match(shown(), /Review QA[\s\S]*Awaiting Therapy Review[\s\S]*Trash[\s\S]*Awaiting Physics Review[\s\S]*Recently reviewed/, label);
  assert.doesNotMatch(shown(), /Setup QA|QA Template Lists|Machine Schedules/, label);
  assert.equal(count(/Awaiting Physics Review/g), 1, label);
};

(async () => {
  // 1. Review QA, then Setup QA before Review QA has its trash list: Review's late reply draws nothing under Setup QA.
  await go('#/review');
  release('GET /api/runs?limit=400'); await settle();
  assert.match(shown(), /Review QA[\s\S]*Awaiting Therapy Review/);
  await go('#/setup');
  assert.match(shown(), /Setup QA/);
  release('GET /api/runs?trashed=1&limit=200'); await settle();
  assert.doesNotMatch(shown(), /Awaiting Physics Review|Recently reviewed/, 'Review QA stopped');
  await loadSetup();
  setupOnly('Review QA, then Setup QA');
  assert.equal(pending.length, 0);
  console.log('Review QA, then Setup QA while Review QA loads: Setup QA shows only its own lists and schedules.');

  // 2. The reverse: Setup QA's late lists and machines arrive once Review QA has drawn its heading.
  await go('#/setup');
  await go('#/review');
  release('GET /api/runs?limit=400'); await settle();
  release('GET /api/queues'); release('GET /api/machines'); await settle();
  assert.ok(!pending.some((r) => r.path.endsWith('/assignments')), 'Setup QA stopped: it asks for no machine schedules');
  release('GET /api/runs?trashed=1&limit=200'); await settle();
  reviewOnly('Setup QA, then Review QA');
  assert.equal(pending.length, 0);
  console.log('Setup QA, then Review QA while Setup QA loads: Review QA shows only its own tables.');

  // 3. The same page opened again with another query while the first is loading (Review QA, then its physics link).
  await go('#/review');
  await go('#/review?stage=physics');
  release('GET /api/runs?limit=400'); release('GET /api/runs?limit=400'); await settle();
  release('GET /api/runs?trashed=1&limit=200'); await settle();
  reviewOnly('Review QA opened twice');
  assert.equal(count(/Review QA/g), 1);
  assert.equal(pending.length, 0);
  console.log('The same page opened again mid-load: one copy of it, loaded.');

  // 4. Machine Trends: the period changes while the old period's history is still arriving.
  await go('#/trends?machine_id=7&range=90');
  release('GET /api/machines'); await settle();
  release('GET /api/machines/7/assignments'); await settle();
  release(trends(90, 'start')); release('GET /api/assignments/21/template'); await settle();   // still waits for part 2 to pick the list
  await go('#/trends?machine_id=7&list=21&range=30');
  release('GET /api/machines'); await settle();
  release('GET /api/machines/7/assignments'); await settle();
  release(trends(30, 'start')); release('GET /api/assignments/21/template'); await settle();
  assert.match(shown(), /Machine Trends/);
  const asked = received.length;
  release(trends(90, 'p2')); await settle();                                                     // the old period's last part, late
  assert.equal(received.length, asked, 'the old period asks for nothing more');
  release('GET /api/machines/7/assignments'); release(trends(30, 'p2')); await settle();
  assert.match(shown(), new RegExp(`Overview from ${context.rangeStart('30')}$`));
  assert.doesNotMatch(shown(), new RegExp(context.rangeStart('90')));
  assert.equal(count(/Machine Trends/g), 1);
  // … and while the old period's page is drawn and its overview is still loading.
  await go('#/trends?machine_id=7&list=21&range=90');
  release('GET /api/machines'); await settle();
  release('GET /api/machines/7/assignments'); await settle();
  release(trends(90, 'start')); release('GET /api/assignments/21/template'); await settle();
  assert.match(shown(), /Machine Trends/);                                                       // 90 days drawn, its overview waits
  await go('#/trends?machine_id=7&list=21&range=365');
  release('GET /api/machines'); await settle();
  release('GET /api/machines/7/assignments', { last: true }); await settle();
  release(trends(365, 'start')); release('GET /api/assignments/21/template'); await settle();    // 365 days drawn, its overview waits
  release('GET /api/machines/7/assignments'); release(trends(90, 'p2')); await settle();          // the 90-day overview's late replies
  assert.doesNotMatch(shown(), /Overview/);
  release('GET /api/machines/7/assignments'); release(trends(365, 'p2')); await settle();
  assert.match(shown(), new RegExp(`Overview from ${context.rangeStart('365')}$`));
  assert.equal(count(/Overview/g), 1);
  assert.equal(count(/Machine Trends/g), 1);
  assert.equal(pending.length, 0);
  console.log('Machine Trends, period changed mid-load: only the new period is shown.');

  // 5. Mark in Progress (PUT draft), then another page: the save completes and its note updates, on the page it came from.
  await go('#/perform/5');
  const draft = context.form.persistDraft();
  assert.equal(context.form.draftNote.textContent, 'Saving…');
  await go('#/setup');
  release('PUT /api/assignments/5/draft'); await draft; await settle();
  assert.deepEqual(received.filter((k) => k.startsWith('PUT')), ['PUT /api/assignments/5/draft']);
  assert.deepEqual(JSON.parse(JSON.stringify(sent['PUT /api/assignments/5/draft'])), { qa_date: '2026-11-04', comment: 'Synthetic draft', results: [{ test_id: 3, value: '226.4', comment: '' }] });
  assert.equal(context.form.draftNote.textContent, 'Saved 09:30:00');
  assert.doesNotMatch(shown(), /Saved|Saving|Synthetic Gantry A · Synthetic daily list/, 'nothing is drawn on the new page');
  await loadSetup();
  setupOnly('after a draft save');
  assert.deepEqual(toasts, []);
  console.log('A draft save started before leaving the QA form completes; nothing of it is drawn on the next page.');

  // 6. A save that redraws its own page with route() (Setup QA: Set Inactive) still redraws it.
  const active = all(app, (n) => n.props.role === 'switch')[0];
  active.checked = false;
  active.props.onchange({ target: active }); await settle();
  release('PUT /api/assignments/21'); await settle();
  assert.deepEqual(toasts, ['Set inactive: it stays on the machine but is not scheduled']);
  await loadSetup();
  setupOnly('redrawn after a save');
  // Redrawn twice in a row (a save and a hash change together): one copy, loaded.
  context.route(); context.route(); await settle();
  release('GET /api/queues'); release('GET /api/machines'); release('GET /api/queues'); release('GET /api/machines'); await settle();
  release('GET /api/machines/7/assignments'); await settle();
  setupOnly('redrawn twice');
  assert.equal(pending.length, 0);
  console.log('A save that redraws its page with route() still redraws it, once.');

  // 7. A late failure on a page that was left draws no error on the next page.
  await go('#/review');
  await go('#/setup');
  release('GET /api/runs?limit=400', { status: 500 }); await settle();
  await loadSetup();
  setupOnly('after a late failure');
  await go('#/account');
  await go('#/setup');
  release('POST /api/password', { status: 500 }); await settle();
  await loadSetup();
  setupOnly('after a late failed write');
  assert.doesNotMatch(shown(), /Synthetic 500/);
  console.log('A late failure on a page that was left draws no error card.');

  // 8. Signing in: a 401 still shows the sign-in form; signing out while a page loads leaves the form alone.
  await go('#/review');
  release('GET /api/runs?limit=400', { status: 401 }); await settle();
  assert.deepEqual([signIns, context.state.user, shown()], [1, null, 'Sign in']);
  context.state.user = { id: 1, username: 'synthetic', role: 'physicist' };
  context.route(); await settle();
  release('GET /api/runs?limit=400'); await settle(); release('GET /api/runs?trashed=1&limit=200'); await settle();
  reviewOnly('signed in again');
  await go('#/setup');
  const out = context.logout(); await settle();
  release('POST /api/logout'); await out; context.route(); await settle();
  assert.equal(shown(), 'Sign in');
  release('GET /api/queues'); release('GET /api/machines'); await settle();
  assert.equal(shown(), 'Sign in', 'the page left at sign-out draws nothing on the sign-in form');
  assert.equal(pending.length, 0);
  context.state.user = { id: 1, username: 'synthetic', role: 'physicist' };
  console.log('A 401 still shows the sign-in form; signing in again loads the page; signing out mid-load leaves the form alone.');

  // 9. The browser-only build and a host's bridge (window.localApi) answer through the same rule.
  context.window.localApi = (method, path, body) => serve(method, path, body).then(([status, data]) => (status === 200 ? data : Promise.reject(new Error(data.error))));
  await go('#/review');
  release('GET /api/runs?limit=400'); await settle();
  await go('#/setup');
  release('GET /api/runs?trashed=1&limit=200'); await settle();
  await loadSetup();
  setupOnly('window.localApi');
  assert.equal(pending.length, 0);
  console.log('window.localApi: Review QA, then Setup QA while Review QA loads: Setup QA shows only its own content.');
})().catch((e) => { console.error(e); process.exit(1); });
