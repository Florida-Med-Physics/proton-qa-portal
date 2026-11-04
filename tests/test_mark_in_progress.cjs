// Synthetic checks: the QA form's draft button reads "Mark in Progress", still saves the draft, and no page or guide
// still tells people to use "Save draft". Run with node tests/test_mark_in_progress.cjs from the repository root.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('portal/static/app.js', 'utf8');

// The button: its label, and its click still writes the draft (persistDraft).
const button = source.slice(source.indexOf('  const saveDraft = el('), source.indexOf('  const footer = el('));
assert.match(button, /\}, "Mark in Progress"\);/);
assert.match(button, /await persistDraft\(\);/);

// A failed save points to the renamed button.
const input = { item: { test_id: 1 }, input: { value: '1.5' }, comment: { value: '' } };
const sent = [];
const context = { inputs: [input], qaDate: { value: '2026-10-22' }, runComment: { value: '' }, draftNote: {}, assignmentId: 1, setTimeout, clearTimeout, toast() {},
  QADerived: { value: (x) => x.value },
  api: async (method, path, data) => { sent.push([method, path, data]); throw new Error('Synthetic network failure'); } };
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('  let autosaveTimer, autosaveStopped'), source.indexOf('  const saveDraft = el(')) + '\nthis.persist = persistDraft;', context);

(async () => {
  await context.persist();
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].slice(0, 2), ['PUT', '/api/assignments/1/draft']);
  assert.equal(context.draftNote.textContent, 'Not saved - use Mark in Progress');
  // Nothing a person reads still says "Save draft"; the browser build carries the same interface.
  for (const file of ['portal/static/app.js', 'docs/app.js', 'portal/static/index.html', 'docs/index.html', 'docs/USER_GUIDE.txt', 'README.md'])
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /save draft/i, file);
  assert.equal(fs.readFileSync('docs/app.js', 'utf8'), source, 'docs/app.js is out of step: run python build_pages.py');
  console.log('Mark in Progress saves the draft; a failed save names it; no page or guide says Save draft.');
})().catch((e) => { console.error(e); process.exit(1); });
