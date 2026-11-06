// Synthetic checks of the "Record past imports as history…" dialog (app.js recordHistoryDialog) with a stand-in
// page: it shows the live dry-run count in plain words, offers a machine's lists once a machine is chosen, can only
// confirm when something would change (and not while a new machine's lists are loading), and Confirm records and
// reloads the page. Only a Physicist or Admin sees the button. Run with node tests/test_record_history_dialog.cjs from the repository root.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('portal/static/app.js', 'utf8');
assert.equal(fs.readFileSync('docs/app.js', 'utf8'), source, 'docs/app.js is out of step: run python build_pages.py');

// The button sits on Data Administration, under Import folders, for the review right only (it was on Review QA).
const admin = source.slice(source.indexOf('async function renderAdmin()'), source.indexOf('async function renderUsers()'));
assert.match(admin, /if \(can\("review"\)\) app\.append\(el\("p", \{\}, el\("button", \{ type: "button", onclick: \(\) => recordHistoryDialog\(\)[^\n]*"Record past imports as history…"\)\)\);/);
assert.doesNotMatch(source.slice(source.indexOf('async function renderReview()'), source.indexOf('async function renderRuns()')), /recordHistoryDialog/);

function node(tag, props = {}, kids = []) {
  const listeners = {};
  return { tag, props, kids, value: props.value ?? '', textContent: kids.filter((k) => typeof k === 'string').join(''), disabled: false,
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    fire(type) { return Promise.all((listeners[type] || []).map((fn) => fn())); },
    replaceChildren(...k) { this.kids = k; } };
}
const calls = [], toasts = [];
let dialog = null, routed = 0;
// Answers that can be held back, to check what the dialog shows while they are on their way.
const slow = { lists: null, count: null };
const held = () => { let release; const promise = new Promise((resolve) => { release = resolve; }); return [promise, release]; };
const counts = (body) => body.assignment_id === 21 ? 0 : body.machine_id === 7 ? 1 : 307;
const context = {
  setTimeout, Promise, Number, String, machineOrder: (a, b) => a.name.localeCompare(b.name),
  Date: class extends Date { constructor(...a) { super(...(a.length ? a : ['2026-11-04T09:30:00'])); } },
  el: (tag, props, ...kids) => node(tag, props || {}, kids.flat()),
  select: (name, options, value) => node('select', { name, value: String(value ?? '') }, options.map(([v, label]) => node('option', { value: v }, [label]))),
  field: (label, input) => node('div', { label }, [input]),
  modal(title, body, onSave, saveLabel) {
    const submit = node('button', { type: 'submit' });
    dialog = { title, body, onSave, saveLabel, submit, querySelector: (s) => (s === 'button[type=submit]' ? submit : null) };
    return dialog;
  },
  api: async (method, path, body) => {
    calls.push([method, path, body]);
    if (path === '/api/machines') return [{ id: 7, name: 'Synthetic Gantry A' }, { id: 8, name: 'Synthetic Gantry B' }];
    if (path === '/api/machines/7/assignments') return [{ id: 21, queue_name: 'Synthetic Sphinx daily' }, { id: 22, queue_name: 'Synthetic Sphinx other' }];
    if (path === '/api/machines/8/assignments') { await slow.lists; return [{ id: 31, queue_name: 'Synthetic Sphinx daily' }]; }
    if (path === '/api/runs/record-history') { if (body.dry_run) await slow.count; return body.dry_run ? { count: counts(body), runs: [] } : { count: counts(body) }; }
    throw new Error(`unexpected ${method} ${path}`);
  },
  toast: (message) => toasts.push(message),
  route: () => { routed++; },
};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('async function recordHistoryDialog()'), source.indexOf('async function renderReview()')) + '\nthis.open = recordHistoryDialog;', context);
// Values made inside the vm are copied into this realm so deepEqual compares values, not the vm's prototypes.
const plain = (x) => JSON.parse(JSON.stringify(x));
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

(async () => {
  await context.open();
  await settle();
  assert.deepEqual([dialog.title, dialog.saveLabel], ['Record past imports as history', 'Confirm']);
  const [machineField, listField, untilField, count] = dialog.body.kids;
  assert.deepEqual([machineField, listField, untilField].map((f) => f.props.label), ['Machine', 'QA list', 'QA dates up to']);
  const [machine, list, until] = [machineField, listField, untilField].map((f) => f.kids[0]);
  assert.deepEqual(plain(machine.kids.map((o) => [o.props.value, o.textContent])), [['', 'All'], [7, 'Synthetic Gantry A'], [8, 'Synthetic Gantry B']]);
  assert.deepEqual(plain(list.kids.map((o) => o.textContent)), ['All']);
  assert.equal(until.value, '2026-11-03', 'QA dates up to starts at yesterday');
  assert.deepEqual(plain(calls.at(-1)), ['POST', '/api/runs/record-history', { until: '2026-11-03', machine_id: null, assignment_id: null, dry_run: true }]);
  assert.equal(count.textContent, '307 imported Sphinx runs will be recorded as history. Their results and verdicts are kept; they will no longer wait for review.');
  assert.equal(dialog.submit.disabled, false);

  machine.value = '7'; await machine.fire('change'); await settle();
  assert.deepEqual(plain(list.kids.map((o) => [o.props.value, o.textContent])), [['', 'All'], [21, 'Synthetic Sphinx daily'], [22, 'Synthetic Sphinx other']]);
  assert.equal(count.textContent, '1 imported Sphinx run will be recorded as history. Their results and verdicts are kept; they will no longer wait for review.');
  list.value = '21'; await list.fire('change'); await settle();
  assert.deepEqual(plain(calls.at(-1)[2]), { until: '2026-11-03', machine_id: 7, assignment_id: 21, dry_run: true });
  assert.equal(count.textContent, 'No imported Sphinx runs up to that date are waiting for review.');
  assert.equal(dialog.submit.disabled, true, 'nothing to record: Confirm is off');
  until.value = ''; await until.fire('change'); await settle();
  assert.deepEqual([count.textContent, dialog.submit.disabled], ['Choose a date.', true]);

  list.value = ''; until.value = '2026-10-31'; await until.fire('change'); await settle();
  assert.equal(dialog.submit.disabled, false);
  const sent = calls.length;
  await dialog.onSave({});
  assert.deepEqual(plain(calls.slice(sent)), [['POST', '/api/runs/record-history', { until: '2026-10-31', machine_id: 7, assignment_id: null }]]);
  assert.deepEqual([toasts, routed], [['1 run recorded as history'], 1]);

  // Choosing another machine: until its lists are in and counted, the old count is gone and Confirm waits, even when an
  // older count arrives in the meantime.
  await context.open(); await settle();
  const [machine2, , until2] = dialog.body.kids.slice(0, 3).map((f) => f.kids[0]), count2 = dialog.body.kids[3];
  machine2.value = '7'; await machine2.fire('change'); await settle();
  assert.deepEqual([count2.textContent.split(' will')[0], dialog.submit.disabled], ['1 imported Sphinx run', false]);
  const [countHeld, releaseCount] = held(), [listsHeld, releaseLists] = held();
  slow.count = countHeld; slow.lists = listsHeld;
  until2.value = '2026-11-02'; const olderCount = until2.fire('change'); await settle();
  machine2.value = '8'; const newLists = machine2.fire('change'); await settle();
  assert.deepEqual([count2.textContent, dialog.submit.disabled], ['Counting…', true]);
  releaseCount(); await olderCount; await settle();
  assert.deepEqual([count2.textContent, dialog.submit.disabled], ['Counting…', true], 'the older count for gantry A is not shown');
  releaseLists(); await newLists; await settle();
  assert.deepEqual(plain(calls.at(-1)), ['POST', '/api/runs/record-history', { until: '2026-11-02', machine_id: 8, assignment_id: null, dry_run: true }]);
  assert.deepEqual([count2.textContent.split(' will')[0], dialog.submit.disabled], ['307 imported Sphinx runs', false]);
  console.log('Record past imports as history: live count in plain words, lists follow the machine, Confirm only when something changes and never on an old count, then records and reloads.');
})().catch((e) => { console.error(e); process.exit(1); });
