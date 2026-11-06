// window.QA_HOST = { browserFolders: false } (a page hosting GatorQA, e.g. floridaphysics.com): no page opens, lists or
// reads a folder, and folder paths are typed. Without it (or with any other value) the folder features work as before.
// Synthetic lists only; runs the real app.js functions against a small stand-in DOM.
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const source = fs.readFileSync('portal/static/app.js', 'utf8');
const part = (from, to) => { const i = source.indexOf(from), j = source.indexOf(to, i); assert(i >= 0 && j > i, from); return source.slice(i, j); };

class Node {
  constructor(tag) { Object.assign(this, { tagName: tag, attributes: {}, childNodes: [], parentNode: null, listeners: {}, dataset: {} }); }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  append(...kids) { for (const kid of kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false)) { const n = kid instanceof Node ? kid : new Text(String(kid)); n.parentNode = this; this.childNodes.push(n); } }
  replaceChildren(...kids) { this.childNodes = []; this.append(...kids); }
  remove() { if (this.parentNode) this.parentNode.childNodes = this.parentNode.childNodes.filter((n) => n !== this); this.parentNode = null; }
  get textContent() { return this.text ?? this.childNodes.map((n) => n.textContent).join(''); }
  set textContent(text) { this.replaceChildren(String(text)); }
  get isConnected() { let n = this; while (n.parentNode) n = n.parentNode; return n === document.body; }
  click() { return Promise.all((this.listeners.click || []).map((fn) => fn({}))); }
  find(test) { return [this, ...this.childNodes.flatMap((n) => n.find(test))].filter(test); }
}
class Text extends Node { constructor(text) { super('#text'); this.text = text; } }
const document = { body: new Node('body'), hidden: false, createElement(tag) { const n = new Node(tag); this.created.push(n); return n; }, createTextNode: (t) => new Text(t) };
const html = (n) => n instanceof Text ? n.text : `<${n.tagName}${Object.entries({ ...n.attributes, class: n.className, value: n.value, checked: n.checked }).filter(([, v]) => v !== undefined).map(([k, v]) => ` ${k}="${v}"`).join('')}>${n.childNodes.map(html).join('')}</${n.tagName}>`;
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

const LIST = { id: 7, queue_name: 'Synthetic Daily QA', import_folder: 'G1 Sphinx', frequency: 'daily', interval_days: null, weekdays: '0,1,2,3,4', start_date: '2026-11-02', active: 1 };
// One fresh copy of the folder-related app.js code per case. calls records every request and every folder, IndexedDB,
// timer and listener use, in order.
function load({ host, localApi = true, picker = true, role = 'physicist' } = {}) {
  const calls = [], bodies = [];
  document.body.childNodes = []; document.created = [];
  const app = new Node('main'); document.body.append(app);
  const window = { QA_HOST: host, addEventListener: (type) => calls.push(`listen ${type}`), removeEventListener() {}, dispatchEvent() {},
    localFolders: new Proxy({}, { get: (_, name) => async () => { calls.push(`localFolders.${name}`); return 'G1 Sphinx'; } }) };
  if (localApi) window.localApi = () => {};
  if (picker) window.showDirectoryPicker = async () => { calls.push('showDirectoryPicker'); return { name: 'G1 Sphinx' }; };
  const context = { window, document, Node, app, URLSearchParams, state: { user: { id: 1, role }, actingRole: null },
    api: async function api(method, path, body) {
      // Several GETs in one request (apiBatch): each answered as on its own, recorded as one request.
      const batch = /^\/api\/batch\?paths=(.*)$/.exec(path);
      if (batch) { calls.push(`GET /api/batch`); const each = []; for (const p of JSON.parse(decodeURIComponent(batch[1]))) each.push({ ok: true, value: await api('GET', p) }); return each; }
      calls.push(`${method} ${path}`); bodies.push(body);
      if (path === '/api/machines') return [{ id: 1, name: 'G1', active: 1 }];
      if (path === '/api/machines/1/assignments') return [{ ...LIST }];
      if (path === '/api/assignments') return [{ ...LIST, machine_id: 1 }];   // every machine's lists at once (Data Administration)
      if (path.endsWith('/files')) return { folder: 'G1 Sphinx', permission: 'granted', files: [{ name: 'G1_11022026.xls', path: 'G1_11022026.xls', modified: '2026-11-02T06:10:00', size: 10 }] };
      if (path.includes('/file?')) return { name: 'G1_11022026.xls', data: '' };
      if (path.endsWith('/sphinx/import')) return { imported: [], skipped: [] };
      if (path.endsWith('/template')) return { assignment: { id: 7 }, queue: { name: LIST.queue_name }, items: [{ test_id: 1, type: 'numeric', name: 'Output', unit: '%', limits: { expected: 0, warn: 1, fail: 2, tol_mode: 'absolute' } }] };
      if (/\/machines\/1\/trends(\?|$)/.test(path)) {
        const point = { assignment_id: 7, run_id: 3, qa_date: '2026-11-02', value: 0.4, expected: 0, warn: 1, fail: 2, tol_mode: 'absolute', status: 'pass' };
        // Machine Trends and Export CSV ask for the history in parts (machineHistory); one part holds it all here.
        return /[?&]page=/.test(path) ? { series: [[point]], tests: { 1: 0 }, next: null, token: 't-1', order: {} } : { 1: [point] };
      }
      return method === 'PUT' ? { id: 7 } : null;
    },
    indexedDB: { open(name) { calls.push(`indexedDB ${name}`); const request = {}; setTimeout(() => { request.error = new Error('synthetic'); request.onerror(); }); return request; } },
    localStorage: { getItem: () => null, setItem() {} },
    setTimeout: (fn, ms) => (ms >= 1000 ? 0 : setTimeout(fn, ms)), setInterval: (fn, ms) => { calls.push(`setInterval ${ms}`); return 0; }, clearInterval() {},
    toast: (message) => calls.push(`toast ${message}`), modal: (title) => calls.push(`modal ${title}`), route: async () => {}, today: () => '2026-11-04',
    URL: { createObjectURL: () => 'blob:synthetic', revokeObjectURL() {} }, Blob: class { constructor(parts) { this.parts = parts; } },
    filterRange: (points) => points, judgedByList: (item, points) => points.map((p) => ({ ...p, status: 'pass' })), sig: String, trendRunHref: () => '#',
    readFileBase64: async (file) => ({ name: file.name, data: '' }), logout() {}, importUserSpreadsheet() {}, userForm() {},
    databaseLocationCard: () => new Node('section'), dbSwitchForm: () => new Node('form') };
  context.request = context.api;   // Import Folder reads its files with request() (see api() in app.js)
  vm.createContext(context);
  for (const code of [part('const ROLE_LABEL', 'const STATE_LABEL'), part('function el(', 'function svg('), part('function activeRole(', 'let toastTimer;'),
    part('function machineSchedules(', '// A site that hosts'), part('function browserFolders(', 'function formData('), part('function field(', 'function modal('), part('function importFolderField(', 'function scheduleData('),
    part('const trendExportFolders', 'function trendPattern('), part('function trendPattern(', 'async function renderTrends('),
    part('function rangeStart(', 'function stats('),
    part('const RIGHTS = [', 'function importUserSpreadsheet('), part('async function renderAdmin(', 'async function renderUsers('),
    `function chip(status, label) { return el("span", { class: "chip " + status }, label); }
     function page(title, subtitle, actions) { app.replaceChildren(el("div", { class: "page-head" }, el("h1", {}, title), el("div", {}, actions || []))); }
     function table(headers, rows, emptyText) { return rows.length ? el("table", {}, el("thead", {}, el("tr", {}, headers.map((h) => el("th", {}, h)))), el("tbody", {}, rows)) : el("div", { class: "card empty" }, emptyText); }
     function fixedTable(columns, rows, emptyText) { return table(columns.map(([h]) => h), rows, emptyText); }
     this.autoLine = (t) => ${/const autoLine = (.+);\r?\n/.exec(source)[1]};`]) vm.runInContext(code, context);
  return { context, calls, bodies, app, buttons: (node) => node.find((n) => n.tagName === 'button').map((b) => b.textContent) };
}
const FOLDER_USE = /\/files$|\/file\?|showDirectoryPicker|localFolders|indexedDB|setInterval|listen import-folder-changed/;
const noFolderUse = (calls) => { assert.deepEqual(calls.filter((c) => FOLDER_USE.test(c)), []); assert(!document.created.some((n) => 'webkitdirectory' in n.attributes)); };
const OFF = { browserFolders: false };

(async () => {
  // Switch off, in the worst case for it: the page has localApi and a browser that could open folders.
  for (const role of ['physicist', 'therapist']) {
    const { context, calls, bodies, app, buttons } = load({ host: OFF, role });
    // Schedule editor: a typed path, saved with the schedule, and a one-line hint.
    { const node = context.importFolderField(LIST), input = node.find((n) => n.tagName === 'input');
      assert.equal(input.length, 1); assert.equal(input[0].attributes.name, 'import_folder'); assert.equal(input[0].value, LIST.import_folder);
      assert.match(node.textContent, /The scheduled import on a UFHPTI computer reads this folder\./); assert.deepEqual(buttons(node), []); }
    // A new list (Add a QA list, or "Schedule on machines", which may create several at once) gets no folder field, so
    // one typed folder is never saved on several lists.
    const fresh = context.importFolderField({});
    assert.deepEqual(fresh.find((n) => n.tagName === 'input'), []); assert.deepEqual(buttons(fresh), []);
    assert.match(fresh.textContent, /Save this list first, then type its folder under Change schedule or in Data Administration\./);
    // Perform QA: no folder line, so autoReadLine never runs (its only call is behind autoLine).
    assert.equal(context.autoLine({ assignment: LIST }), null);
    // Machine Trends: Export CSV only, saved by the browser's download; no remembered export folder is looked up.
    const tools = context.trendFileTools({ id: 1, name: 'G1' }, [{ ...LIST }], String(LIST.id), '90', []);
    assert.deepEqual(buttons(tools), ['Export CSV']);
    await tools.find((n) => n.tagName === 'button')[0].click();
    assert(document.created.some((n) => n.tagName === 'a' && n.download)); assert(calls.includes('toast Exported 1 results to Downloads'));
    assert.equal(context.trendInsightsCard([]).find((n) => n.tagName === 'p')[0].textContent, 'No measurements in this period. Choose another period.');
    // Data Administration: typed paths for Physicist/Admin, plain text for others, no Status column, no scanning.
    await context.renderAdmin(); await settle();
    const folders = app.find((n) => n.tagName === 'table').at(-1);
    assert.deepEqual(folders.find((n) => n.tagName === 'th').map((n) => n.textContent), ['Machine', 'QA list', 'Folder']);
    assert.equal(folders.find((n) => n.tagName === 'tr').at(-1).childNodes.length, 3);
    assert(app.textContent.includes('Import folders' + 'New files in these folders are imported by the scheduled import on a UFHPTI computer.'));
    const cell = folders.find((n) => n.className === 'folder-cell')[0], input = cell.find((n) => n.tagName === 'input')[0];
    if (role === 'therapist') { assert.equal(input, undefined); assert.equal(cell.textContent, 'G1 Sphinx'); }
    else {
      assert.equal(input.value, 'G1 Sphinx'); input.value = '  Daily QA\\G5 Sphinx ';
      await cell.find((n) => n.tagName === 'button')[0].click(); await settle();
      assert.equal(calls.at(-2), 'PUT /api/assignments/7'); assert.equal(bodies.at(-1).import_folder, 'Daily QA\\G5 Sphinx'); assert.equal(calls.at(-1), 'toast Folder saved');
    }
    noFolderUse(calls);
  }
  // Server build with the switch off: the same typed paths and no scanning.
  { const { context, calls } = load({ host: OFF, localApi: false, picker: false }); context.importFolderField(LIST); await context.renderAdmin(); await settle(); noFolderUse(calls); }

  // Switch absent (or any value but false): today's folder features.
  const snapshots = new Map();
  for (const host of [undefined, {}, { browserFolders: true }, null]) {
    const shots = [];
    for (const localApi of [true, false]) {
      const { context, calls, app, buttons } = load({ host, localApi });
      const field = context.importFolderField(LIST);
      assert.deepEqual(buttons(field), localApi ? ['Choose folder…', 'Clear'] : []); assert(!field.textContent.includes('scheduled import'));
      assert.notEqual(context.autoLine({ assignment: LIST }), null);
      const tools = context.trendFileTools({ id: 1, name: 'G1' }, [{ ...LIST }], String(LIST.id), '90', []);
      assert.deepEqual(buttons(tools), ['Import Folder', 'Export CSV']); assert(calls.includes('indexedDB qa-trend-export-folders'));
      await tools.find((n) => n.tagName === 'button')[0].click(); await settle();
      if (localApi) assert.deepEqual(calls.filter((c) => FOLDER_USE.test(c)).slice(1), ['localFolders.choose', 'GET /api/assignments/7/files', 'GET /api/assignments/7/file?path=G1_11022026.xls']);
      else assert(document.created.some((n) => n.tagName === 'input' && 'webkitdirectory' in n.attributes));
      assert.match(context.trendInsightsCard([]).textContent, /Choose another period or use Import Folder\./);
      await context.renderAdmin(); await settle();
      assert.deepEqual(app.find((n) => n.tagName === 'th').map((n) => n.textContent).slice(-4), ['Machine', 'QA list', 'Folder', 'Status']);
      assert(calls.includes('setInterval 60000') && calls.includes('listen import-folder-changed') && calls.includes('POST /api/assignments/7/sphinx/import'));
      shots.push(html(field), html(tools), html(app), calls.join('\n'));
    }
    snapshots.set(JSON.stringify(host), shots);
  }
  const [first, ...others] = snapshots.values();
  for (const shots of others) assert.deepEqual(shots, first);
  console.log('With QA_HOST.browserFolders false no page opens, lists or reads a folder and paths are typed; without it the folder features are unchanged.');
})().catch((err) => { console.error(err); process.exit(1); });
