// Synthetic draft writes stay ordered and stop after completion.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('portal/static/app.js', 'utf8');
const writes = [];
let activeWrites = 0;
const input = { item: { test_id: 1 }, input: { value: '1' }, comment: { value: '' } };
const context = { inputs: [input], qaDate: { value: '2026-10-22' }, runComment: { value: 'Synthetic draft' }, draftNote: {}, assignmentId: 1, setTimeout, clearTimeout, toast() {},
  api: async (method, path, data) => { assert.equal(++activeWrites, 1); await new Promise((r) => setTimeout(r, 5)); writes.push(data); activeWrites--; return { saved_at: '2026-10-22T22:00:00' }; } };
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('  let autosaveTimer, autosaveStopped'), source.indexOf('  const saveDraft = el(')) + '\nthis.persist = persistDraft; this.stop = () => { autosaveStopped = true; };', context);
(async () => {
  const first = context.persist(); input.input.value = '2'; const second = context.persist();
  await Promise.all([first, second]);
  assert.deepEqual(writes.map((x) => x.results[0].value), ['1', '2']);
  context.stop(); await context.persist(); assert.equal(writes.length, 2);
  console.log('Autosave snapshots, write ordering and completion stop pass.');
})();
