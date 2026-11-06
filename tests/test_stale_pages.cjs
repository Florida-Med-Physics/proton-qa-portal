// Synthetic checks that a page left while it is still loading stops drawing. On a slow site Setup QA showed Review QA's
// "Awaiting Physics Review" and "Recently reviewed" tables under its own heading: Review QA's late replies were still
// drawn into the one page container. The real route(), api(), apiBatch(), page(), logout(), Review QA, Setup QA, Machine
// Trends and draft-saving code (and the real "Add them", list editor "New test", Import Folder and run measurements
// reads) run in node:vm with a tiny DOM stand-in and a server whose replies the test releases one by one.
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
// A GET /api/batch (apiBatch) waits as one entry per path it asks for; the test answers each path as if it had been
// asked alone, and the batch replies once every one of its paths is answered (a 401 on any path answers it at once).
const BATCH = /^\/api\/batch\?paths=(.*)$/;
const serve = (method, path, body) => new Promise((resolve) => {
  const batch = method === 'GET' && BATCH.exec(path);
  if (batch) {
    const paths = JSON.parse(decodeURIComponent(batch[1]));
    const group = { resolve, left: paths.length, results: [] };
    paths.forEach((p, index) => { pending.push({ method: 'GET', path: p, group, index }); received.push(`GET ${p}`); });
    return;
  }
  pending.push({ method, path, body, resolve }); received.push(`${method} ${path}`); sent[`${method} ${path}`] = body;
});
function release(key, { status = 200, last = false } = {}) {
  const matches = pending.filter((r) => `${r.method} ${r.path}` === key);
  assert.ok(matches.length, `nothing waits for ${key}; waiting: ${pending.map((r) => `${r.method} ${r.path}`).join(', ')}`);
  const r = last ? matches.at(-1) : matches[0];
  pending.splice(pending.indexOf(r), 1);
  if (r.group) {
    if (status === 401) {
      for (const other of pending.filter((p) => p.group === r.group)) pending.splice(pending.indexOf(other), 1);
      return r.group.resolve([401, { error: 'Synthetic 401' }]);
    }
    r.group.results[r.index] = status === 200 ? { ok: true, value: reply(r) } : { ok: false, error: `Synthetic ${status}` };
    if (--r.group.left === 0) r.group.resolve([200, r.group.results]);
    return;
  }
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
    'GET /api/assignments': () => [schedule],   // every machine's lists (machineSchedules picks machine 7's)
    'GET /api/assignments/21/template': () => ({ assignment: { id: 21 }, queue: { name: 'Synthetic daily list' }, items: [] }),
    'PUT /api/assignments/21': () => ({ ...schedule, active: body.active ? 1 : 0 }),
    'PUT /api/assignments/5/draft': () => ({ saved_at: '2026-11-04T09:30:00' }),
    'POST /api/logout': () => ({}),
    'POST /api/password': () => ({}),
    'POST /api/tests': () => ({ id: 99 }),
    'GET /api/tests': () => [{ id: 99, name: 'Synthetic test', active: 1 }],
    'PUT /api/assignments/21/tests': () => ({}),
    'POST /api/assignments/21/sphinx/tests': () => ({ added: [11, 12] }),
    'POST /api/assignments/21/sphinx/preview': () => ({ matched: [] }),
    'GET /api/assignments/21/files': () => ({ permission: 'granted', files: [{ path: 'synthetic-1.xls' }] }),
    'GET /api/assignments/21/file?path=synthetic-1.xls': () => ({ name: 'synthetic-1.xls', data: 'c3ludGhldGlj' }),
    'POST /api/assignments/21/sphinx/import': () => ({ imported: [{ id: 501, overall: 'pass' }], skipped: [] }),
  }[key]();
}
const toasts = [], dialogs = [];
let signIns = 0;
const context = {
  app, Promise, URLSearchParams, Date, Number, String, Object, Set, Map, setTimeout, clearTimeout,
  window: {}, location: { hash: '#/' }, state: { user: { id: 1, username: 'synthetic', role: 'physicist' }, actingRole: null },
  sessionStorage: { removeItem() {} }, document: { addEventListener() {}, getElementById: () => null }, requestAnimationFrame: (fn) => fn(),
  localStorage: { getItem: () => null, setItem() {} }, browserFolders: () => true, trendExportFolders: { get: async () => null },
  modal: (title) => { dialogs.push(title); },
  fetch: (path, init) => serve(init.method, path, init.body === undefined ? undefined : JSON.parse(init.body)).then(([status, data]) => ({ status, ok: status < 400, json: async () => data })),
  el: node, renderShell() {}, renderLogin() { signIns++; app.replaceChildren(node('form', {}, 'Sign in')); }, toast: (message) => toasts.push(message),
  can: (right) => ['perform', 'review', 'configure'].includes(right), activeRole: () => 'physicist', confirm: () => true,
  chip: (status, label) => node('span', {}, label || status), reviewChip: (r) => node('span', {}, r.review_status), qaTrashButton: () => node('button', {}, 'Restore'),
  machineLabel: (name) => node('span', {}, name), shortDate: (d) => d, fixedTable: (cols, rows, empty) => node('table', {}, rows.length ? rows : empty),
  table: (heads, rows) => node('table', {}, rows), filterBox: () => node('input'), select: (name, options, value) => node('select', { name, value }),
  MODALITIES: ['Proton', 'Photon'], modalityOf: () => 'Proton', machineOrder: (a, b) => a.name.localeCompare(b.name), FREQ_ORDER: { daily: 0, monthly: 2 }, scheduleOrder: () => 0, QADerived: { value: (input) => input.value },
  trendSourceNumberer: () => (p) => p, trendFileTools: () => node('div', {}, 'Import Folder', 'Export CSV'),
  // Stand-in for the chart overview: it waits for what the real one waits for (the period's history, which renderTrends
  // has already asked for; the lists and templates come from renderTrends).
  async renderTrendOverview(machines, machineId, range, listId, templates, historyRequest) {
    const { histories } = await (historyRequest || context.machineHistory(machineId, { from: context.rangeStart(range) }));
    app.append(node('section', {}, `Overview from ${[...new Set(Object.values(histories).flat().map((p) => p.qa_date))].join(', ')}`));
  },
  // Stand-in for the QA form: its real first lines (they take the "Add them" request to apply the Sphinx file again), the
  // real draft-saving code (Mark in Progress) under a page heading, the real "Add them" button, and a copy of its last line.
  async renderPerform(assignmentId) {
    const applySphinxOnLoad = context.takeSphinxFlag(assignmentId);
    context.page('Synthetic Gantry A · Synthetic daily list', 'Daily');
    const draftNote = node('span', { class: 'muted small' });
    app.append(node('div', { class: 'submit-bar' }, draftNote));
    context.form = context.draftForm(assignmentId, draftNote);
    context.addThem = context.addThemButton(assignmentId);
    if (applySphinxOnLoad && context.state.sphinxFile) await context.api('POST', `/api/assignments/${assignmentId}/sphinx/preview`, { file: context.state.sphinxFile });
  },
  // A page whose last step is a write that fails after the person has left it.
  async renderAccount() { context.page('My account'); await context.api('POST', '/api/password', {}); },
  // Stand-in for a run's page: its heading, then the real read for its measurements (the list's template and the run's
  // history in one batch, drawn without whatever failed), then the measurements.
  async renderRun(id) {
    context.page(`Synthetic run ${id}`);
    await context.runMeasurementsRead({ id: Number(id), assignment_id: 21, machine_id: 7, qa_date: '2026-11-03', results: [{ test_id: 5 }] });
    app.append(node('section', {}, 'Synthetic measurements'));
  },
};
for (const name of ['renderHome', 'renderDashboard', 'renderAdmin', 'renderMachines', 'renderMachine', 'renderLimits', 'renderQueueEditor', 'renderTests',
  'renderRuns', 'renderSearch', 'renderUsers', 'renderAudit', 'recordHistoryDialog', 'machineForm', 'scheduleDialog', 'copyDialog', 'archiveList', 'deleteList', 'scheduleForm', 'scheduleData']) context[name] = async () => {};
vm.createContext(context);
const addThem = between('can("configure") ? el("button", { onclick: async () => {', '} }, "Add them")');
const newTest = between('const newCheck = el("button"', 'const error = el("p", { class: "error" });');
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
  `this.takeSphinxFlag = (assignmentId) => {\n${between('  const applySphinxOnLoad = state.applySphinxOnLoad', '  const t = await api(')}  return applySphinxOnLoad;\n};`,
  `this.addThemButton = (assignmentId) => ${addThem.slice(addThem.indexOf('async () => {'))}};`,
  // The list editor's "New test" save for one machine, with the editor's own state reduced to what it uses.
  `this.newTestSave = (valuesFor) => {
    const id = '1', tests = [], byId = {}, items = [], machineSelections = {}, machineValues = {};
    const draw = () => {}, machineName = () => 'Synthetic Gantry A', save = async () => {};
    ${between('  const reloadMachine = async () => {', '  const customizeButton = el(')}
    return ${newTest.slice(newTest.indexOf('async (data) => {'), newTest.indexOf('}); } }, "New test");') + 1)};
  };`,
  `this.realTrendFileTools = (() => {\n${between('function trendFileTools(', 'function trendPattern(')}\nreturn trendFileTools;\n})();`,
  `this.runMeasurementsRead = async (run) => {\n${between('  const runTests=[...new Set(run.results', '  const numbers=blockNumbers(')}  return { template, history };\n};`,
].join('\n'), context);

const settle = async () => { for (let i = 0; i < 20; i++) await new Promise((resolve) => setImmediate(resolve)); };
// What a click on a link does: the hash changes and the hashchange listener calls route() (never awaited).
const go = async (hash) => { context.location.hash = hash; context.route(); await settle(); };
const trends = (days, part) => `GET /api/machines/7/trends?from=${context.rangeStart(String(days))}&page=${part}`;
// Setup QA asks once: its lists, the machines and every machine's schedules, in one batch.
const loadSetup = async () => { release('GET /api/queues'); release('GET /api/machines'); release('GET /api/assignments'); await settle(); };
// Machine Trends asks one step at a time: the machines and every machine's lists (one batch), then the list's template
// (a batch of one), and only then the period's history in parts (start, p2). loadTrendLists answers the first two steps;
// each scenario answers the history itself.
const loadTrendLists = async () => { release('GET /api/machines'); release('GET /api/assignments'); await settle(); release('GET /api/assignments/21/template'); await settle(); };
const setupOnly = (label) => {
  assert.match(shown(), /Setup QA[\s\S]*QA Template Lists[\s\S]*Machine Schedules/, label);
  assert.doesNotMatch(shown(), /Review QA|Awaiting Physics Review|Recently reviewed|Awaiting Therapy Review|Trash/, label);
  assert.equal(count(/QA Template Lists/g), 1, label);
};
const reviewOnly = (label) => {
  assert.match(shown(), /Review QA[\s\S]*Awaiting Physics Review[\s\S]*Awaiting Therapy Review[\s\S]*Recently reviewed[\s\S]*Trash/, label);   // a physicist's queue first, Trash last
  assert.doesNotMatch(shown(), /Setup QA|QA Template Lists|Machine Schedules/, label);
  assert.equal(count(/Awaiting Physics Review/g), 1, label);
};

(async () => {
  // 1. Review QA, then Setup QA before Review QA has its runs and trash (one batch): Review's late reply draws nothing
  //    under Setup QA.
  await go('#/review');
  release('GET /api/runs?limit=400'); await settle();
  await go('#/setup');
  assert.match(shown(), /Setup QA/);
  release('GET /api/runs?trashed=1&limit=200'); await settle();
  assert.doesNotMatch(shown(), /Awaiting Physics Review|Recently reviewed/, 'Review QA stopped');
  await loadSetup();
  setupOnly('Review QA, then Setup QA');
  assert.equal(pending.length, 0);
  console.log('Review QA, then Setup QA while Review QA loads: Setup QA shows only its own lists and schedules.');

  // 2. The reverse: Setup QA's lists, machines and schedules (one batch) arrive late, once Review QA is drawn (Review QA
  //    draws its heading and tables together, when its own batch is answered).
  await go('#/setup');
  await go('#/review');
  release('GET /api/runs?limit=400'); release('GET /api/runs?trashed=1&limit=200'); await settle();
  reviewOnly('Review QA drawn');
  await loadSetup();                                                          // Setup QA's batch, late
  reviewOnly('Setup QA, then Review QA');
  assert.equal(pending.length, 0);
  console.log('Setup QA, then Review QA while Setup QA loads: Review QA shows only its own tables.');

  // 3. The same page opened again with another query while the first is loading (Review QA, then its physics link). The
  //    physics link's batch is answered first; the first opening's batch, answered after it, draws nothing over it.
  await go('#/review');
  await go('#/review?stage=physics');
  release('GET /api/runs?limit=400', { last: true }); release('GET /api/runs?trashed=1&limit=200', { last: true }); await settle();
  reviewOnly('Review QA, physics link');
  const drawn = app.kids[0];
  release('GET /api/runs?limit=400'); release('GET /api/runs?trashed=1&limit=200'); await settle();
  assert.equal(app.kids[0], drawn, 'the first opening, answered late, does not draw the page again');
  reviewOnly('Review QA opened twice');
  assert.equal(count(/Review QA/g), 1);
  assert.equal(pending.length, 0);
  console.log('The same page opened again mid-load: one copy of it, loaded.');

  // 4. Machine Trends: the period changes while the old period's history is still arriving.
  await go('#/trends?machine_id=7&range=90');
  await loadTrendLists();
  release(trends(90, 'start')); await settle();                                                  // still waits for part 2 to pick the list
  await go('#/trends?machine_id=7&list=21&range=30');
  await loadTrendLists();                                                                        // 30 days drawn, its overview waits
  release(trends(30, 'start')); await settle();
  assert.match(shown(), /Machine Trends/);
  const asked = received.length;
  release(trends(90, 'p2')); await settle();                                                     // the old period's last part, late
  assert.equal(received.length, asked, 'the old period asks for nothing more');
  release(trends(30, 'p2')); await settle();
  assert.match(shown(), new RegExp(`Overview from ${context.rangeStart('30')}$`));
  assert.doesNotMatch(shown(), new RegExp(context.rangeStart('90')));
  assert.equal(count(/Machine Trends/g), 1);
  // … and while the old period's page is drawn and its overview is still loading.
  await go('#/trends?machine_id=7&list=21&range=90');
  await loadTrendLists();
  release(trends(90, 'start')); await settle();
  assert.match(shown(), /Machine Trends/);                                                       // 90 days drawn, its overview waits for part 2
  await go('#/trends?machine_id=7&list=21&range=365');
  await loadTrendLists();
  release(trends(365, 'start')); await settle();                                                 // 365 days drawn, its overview waits
  release(trends(90, 'p2')); await settle();                                                     // the 90-day overview's late reply
  assert.doesNotMatch(shown(), /Overview/);
  release(trends(365, 'p2')); await settle();
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
  await loadSetup(); await loadSetup();                                       // the first redraw's batch (left), then the second's
  setupOnly('redrawn twice');
  assert.equal(pending.length, 0);
  console.log('A save that redraws its page with route() still redraws it, once.');

  // 7. A late failure on a page that was left draws no error on the next page.
  await go('#/review');
  await go('#/setup');
  release('GET /api/runs?limit=400', { status: 500 }); release('GET /api/runs?trashed=1&limit=200'); await settle();
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
  await loadSetup();                                                          // Setup QA's batch, late
  assert.equal(shown(), 'Sign in', 'the page left at sign-out draws nothing on the sign-in form');
  assert.equal(pending.length, 0);
  context.state.user = { id: 1, username: 'synthetic', role: 'physicist' };
  // The session ends while a page waits on a read it would draw without (.catch: a run's template and history, one
  // batch): that page stops at the sign-in form too. The 401 answers the whole batch.
  await go('#/runs/3');
  release('GET /api/machines/7/trends?tests=5&until=2026-11-03&last=61', { status: 401 }); await settle();
  assert.deepEqual([context.state.user, shown()], [null, 'Sign in'], 'nothing drawn under the sign-in form');
  assert.equal(pending.length, 0);
  context.state.user = { id: 1, username: 'synthetic', role: 'physicist' };
  console.log('A 401 still shows the sign-in form, with nothing of the page under it; signing in again loads the page; signing out mid-load leaves the form alone.');

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

  // 10. The list editor's "New test" for one machine creates the test, reads it back, adds it to the machine and reads
  // the machine's list again. A page drawn meanwhile (Back, say) does not stop that save half-way.
  await go('#/queues/1');
  let saved = false;
  context.newTestSave('21')({ name: 'Synthetic test', type: 'numeric' }).then(() => { saved = true; }); await settle();
  release('POST /api/tests'); await settle();
  await go('#/tests');                                                        // while the new test is read back
  release('GET /api/tests'); await settle();
  release('PUT /api/assignments/21/tests'); await settle();
  await go('#/queues/1');                                                     // while the machine's list is read again
  release('GET /api/assignments/21/template'); await settle();
  assert.ok(saved, 'the save finished, so its dialog closes');
  assert.deepEqual(JSON.parse(JSON.stringify(sent['PUT /api/assignments/21/tests'])), { excluded: [], added: [99] });
  assert.equal(toasts.at(-1), 'Synthetic Gantry A-only test added');
  assert.equal(pending.length, 0);
  console.log('List editor "New test" for one machine: a page drawn mid-save does not stop the save.');

  // 11. "Add them" on one list's QA form adds the file's other tests, then redraws that form to apply the file again.
  // If the person has opened another list's form meanwhile, that form does not apply the first list's file.
  context.state.sphinxFile = { name: 'synthetic-gantry-A.xls', data: 'c3ludGhldGlj' };
  await go('#/perform/21');
  context.addThem(); await settle();
  await go('#/perform/35');
  release('POST /api/assignments/21/sphinx/tests'); await settle();          // its redraw is of list 35's form
  assert.ok(!received.includes('POST /api/assignments/35/sphinx/preview'), "list 35's form applies no file of list 21");
  await go('#/perform/21');
  context.addThem(); await settle();
  release('POST /api/assignments/21/sphinx/tests'); await settle();
  release('POST /api/assignments/21/sphinx/preview'); await settle();         // on its own form it is applied again
  assert.deepEqual(toasts.slice(-2), ['Added 2 tests to the list', 'Added 2 tests to the list']);
  assert.equal(pending.length, 0);
  context.state.sphinxFile = null;
  console.log('"Add them": another list\'s form opened meanwhile does not apply the file; its own form does.');

  // 12. Machine Trends "Import Folder" (browser build), left while a file is read: every file is still imported, the
  // summary opens, and the page opened meanwhile is not drawn again. On Machine Trends, the import redraws it.
  context.window.showDirectoryPicker = () => {};
  context.window.localFolders = { choose: async () => 'Synthetic folder' };
  const importFolder = async () => {
    const tools = context.realTrendFileTools({ id: 7, name: 'Synthetic Gantry A' }, [{ id: 21, queue_name: 'Synthetic daily list', import_folder: '' }], '21', '90', []);
    tools.kids.find((k) => text(k) === 'Import Folder').props.onclick(); await settle();
    release('GET /api/assignments/21/files'); await settle();
  };
  await go('#/trends?machine_id=7&list=21&range=90');
  await importFolder();
  await go('#/setup');                                                        // left while the file is read
  release('GET /api/machines'); release('GET /api/assignments'); await settle();   // Machine Trends' late batch
  await loadSetup();
  release('GET /api/assignments/21/file?path=synthetic-1.xls'); await settle();
  const before = received.length;
  release('POST /api/assignments/21/sphinx/import'); await settle();
  assert.equal(received.length, before, 'Setup QA is not drawn again');
  setupOnly('after a folder import ended');
  assert.deepEqual(dialogs, ['Folder import complete']);
  await go('#/trends?machine_id=7&list=21&range=90');
  await importFolder();
  release('GET /api/assignments/21/file?path=synthetic-1.xls'); await settle();
  release('POST /api/assignments/21/sphinx/import'); await settle();
  assert.equal(pending.filter((r) => `${r.method} ${r.path}` === 'GET /api/machines').length, 2, 'Machine Trends drawn again');
  await go('#/tests');
  for (let i = 0; i < 2; i++) { release('GET /api/machines'); release('GET /api/assignments'); } await settle();
  assert.equal(pending.length, 0);
  console.log('Import Folder left mid-import: all files imported, summary shown, the other page not redrawn; on Machine Trends it redraws.');
})().catch((e) => { console.error(e); process.exit(1); });
