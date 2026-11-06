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
}

console.log('GUI and navigation 3: Review QA and Past results as compact phone cards; Data Administration cards on a phone, one rights table, quiet folder Save.');
})().catch((err) => { console.error(err); process.exit(1); });
