// Synthetic checks for the QA table's columns (QA_COLUMNS in app.js): the order a page starts with, what a person may
// hide and move, where the choice is kept, and the short labels of the PBS daily steps. The real code runs in node:vm
// with a stand-in for the browser's storage; nothing here reads stored data. Run with node tests/test_qa_columns.cjs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('portal/static/app.js', 'utf8');
assert.equal(fs.readFileSync('docs/app.js', 'utf8'), source, 'docs/app.js is out of step: run python build_pages.py');
const between = (from, to) => { const a = source.indexOf(from), b = source.indexOf(to, a + 1); assert.ok(a >= 0 && b > a, `${from} … ${to}`); return source.slice(a, b); };
const J = (x) => JSON.parse(JSON.stringify(x));   // answers from node:vm, compared as plain values

function page({ storage = true } = {}) {
  const kept = new Map();
  const localStorage = { getItem: (k) => { if (!storage) throw new Error('no storage'); return kept.has(k) ? kept.get(k) : null; },
    setItem: (k, v) => { if (!storage) throw new Error('no storage'); kept.set(k, String(v)); } };
  const context = { state: { user: { id: 7 } }, localStorage, kept };
  vm.createContext(context);
  vm.runInContext(between('const QA_COLUMNS = [', 'function qaHeaders(') + '\nthis.qaColumns = qaColumns; this.saveQaColumnChoice = saveQaColumnChoice; this.QA_COLUMNS = QA_COLUMNS;', context);
  return context;
}
const keys = (cols) => J(cols.map((c) => c.key));

// 1. What a page starts with: Baseline, Measured, then Result; the QA form without History, a saved run with it.
{
  const p = page();
  assert.deepEqual(keys(p.qaColumns('perform').all), ['n', 'test', 'baseline', 'measured', 'unit', 'result', 'history', 'comment', 'trends']);
  assert.deepEqual(keys(p.qaColumns('perform').shown), ['n', 'test', 'baseline', 'measured', 'unit', 'result', 'comment', 'trends'], 'the QA form starts without History');
  assert.deepEqual(keys(p.qaColumns('review').shown), ['n', 'test', 'baseline', 'measured', 'unit', 'result', 'history', 'comment', 'trends'], 'a saved run starts with every column');
  assert.deepEqual(J(p.qaColumns('perform').all.map((c) => c.label)), ['#', 'Test', 'Baseline', 'Measured', 'Unit', 'Result', 'History', 'Note', 'Trend']);
}

// 2. A person's choice: any order after # and Test; anything hidden but #, Test, Measured and Result.
{
  const p = page();
  p.saveQaColumnChoice('perform', { order: ['result', 'measured', 'trends', 'baseline', 'unit', 'history', 'comment'], hidden: ['unit', 'comment'] });
  assert.deepEqual(keys(p.qaColumns('perform').shown), ['n', 'test', 'result', 'measured', 'trends', 'baseline', 'history'], 'the order and the hidden columns as chosen; History shown once chosen');
  assert.deepEqual(keys(p.qaColumns('review').shown), ['n', 'test', 'baseline', 'measured', 'unit', 'result', 'history', 'comment', 'trends'], 'each page keeps its own');
  p.saveQaColumnChoice('perform', { order: ['n', 'bogus', 'trends', 'test'], hidden: ['n', 'test', 'measured', 'result', 'bogus', 'baseline'] });
  assert.deepEqual(keys(p.qaColumns('perform').all), ['n', 'test', 'trends', 'baseline', 'measured', 'unit', 'result', 'history', 'comment'], '# and Test stay first; unknown names are dropped; columns not named follow in their usual order');
  assert.deepEqual(keys(p.qaColumns('perform').shown), ['n', 'test', 'trends', 'measured', 'unit', 'result', 'history', 'comment'], '#, Test, Measured and Result cannot be hidden');
  p.saveQaColumnChoice('perform', null);
  assert.deepEqual(keys(p.qaColumns('perform').shown), ['n', 'test', 'baseline', 'measured', 'unit', 'result', 'comment', 'trends'], 'Reset: the page\'s own columns again');
}

// 3. Kept in this browser, per person; where the browser keeps nothing, for the visit.
{
  const p = page();
  p.saveQaColumnChoice('perform', { order: ['measured', 'baseline'], hidden: [] });
  assert.deepEqual(JSON.parse(p.kept.get('gatorqa-columns-v1')), { 7: { perform: { order: ['measured', 'baseline'], hidden: [] } } });
  p.state.user = { id: 8 };
  assert.deepEqual(keys(p.qaColumns('perform').shown).slice(2, 4), ['baseline', 'measured'], 'another person on the same computer has their own');
  p.state.user = { id: 7 };
  assert.deepEqual(keys(p.qaColumns('perform').shown).slice(2, 4), ['measured', 'baseline']);
  // A fresh page (the same browser later) reads the stored choice.
  const later = page();
  later.kept.set('gatorqa-columns-v1', p.kept.get('gatorqa-columns-v1'));
  assert.deepEqual(keys(later.qaColumns('perform').shown).slice(2, 4), ['measured', 'baseline']);
  later.kept.set('gatorqa-columns-v1', '{not json');
  later.state.user = { id: 9 };
  assert.deepEqual(keys(later.qaColumns('perform').shown).slice(2, 4), ['baseline', 'measured'], 'unreadable storage: the usual columns');
  const priv = page({ storage: false });
  assert.deepEqual(keys(priv.qaColumns('perform').shown).slice(2, 4), ['baseline', 'measured']);
  priv.saveQaColumnChoice('perform', { order: ['measured', 'baseline'], hidden: ['unit'] });
  assert.deepEqual(keys(priv.qaColumns('perform').shown).slice(2, 5), ['measured', 'baseline', 'result'], 'a private window: the choice still applies for the visit');
}

// 4. A table with a shared row ("Same row as the test above"): the columns its one cell covers stay side by side, in the
// person's order, ahead of the others, so every row sits under its headings.
{
  const p = page();
  p.saveQaColumnChoice('perform', { order: ['comment', 'result', 'history', 'measured', 'baseline', 'unit', 'trends'], hidden: [] });
  assert.deepEqual(keys(p.qaColumns('perform', true).all), ['n', 'test', 'result', 'measured', 'baseline', 'unit', 'comment', 'history', 'trends']);
  assert.deepEqual(keys(p.qaColumns('perform', false).all), ['n', 'test', 'comment', 'result', 'history', 'measured', 'baseline', 'unit', 'trends']);
}

// 5. The fixed widths the History count is worked out from: every column but Test (what is left) and History (its dates).
{
  const cols = J(page().QA_COLUMNS);
  assert.equal(cols.filter((c) => c.key !== 'history').reduce((sum, c) => sum + c.width, 0), 888);
  assert.deepEqual(cols.filter((c) => c.pinned).map((c) => c.key), ['n', 'test']);
  assert.deepEqual(cols.filter((c) => c.always).map((c) => c.key), ['measured', 'result']);
}

// 6. PBS daily steps: a short label on the QA form and a saved run, for Pass / Fail and Yes / No steps only, and only
// while the test still carries the instruction as its name. Every labelled instruction is a step of the seed list (a
// test, or a direction: a list that still has the step as a test shows its label), so a reworded step cannot keep an old
// label unnoticed.
{
  const context = {};
  vm.createContext(context);
  vm.runInContext(between('const QA_STEP_LABELS = {', '// A test\'s name as the QA form') + between('function qaDisplayName(', '// ── The QA table\'s columns')
    + '\nthis.QA_STEP_LABELS = QA_STEP_LABELS; this.qaStepLabel = qaStepLabel; this.qaDisplayName = qaDisplayName;', context);
  const labels = J(context.QA_STEP_LABELS);
  const seed = JSON.parse(fs.readFileSync('portal/seed.json', 'utf8'));
  const steps = seed.templates.find((t) => t.name === 'PBS DailyQA Template - Sphinx').checks.filter((c) => c.type === 'boolean' || c.type === 'status' || /\[direction: (?:section|next)\]/.test(c.description || '')).map((c) => c.name);
  assert.ok(Object.keys(labels).length >= 15);
  // A step reworded in the seed keeps its label under the earlier wording too, for a list that still carries it.
  const earlier = ['Visually check that the room lasers align with the BB; offset must be less than 2 mm.'];
  for (const name of earlier) { assert.ok(Object.hasOwn(labels, name)); assert.ok(!steps.includes(name), `no longer the seed's wording: ${name}`); }
  for (const [name, label] of Object.entries(labels)) {
    assert.ok(steps.includes(name) || earlier.includes(name), `not a step of the PBS daily list: ${name}`);
    assert.ok(label.length <= 60 && label.length < name.length, `${label}: shorter than its instruction, 60 characters at most`);
    assert.doesNotMatch(label, /null|undefined|\[object/);
  }
  const step = { type: 'boolean', category: 'Safety', name: 'Please remove the range shifter to prevent collisions and beam delivery.' };
  assert.equal(context.qaStepLabel(step), 'Remove the range shifter');
  assert.equal(context.qaDisplayName(step), 'Remove the range shifter');
  assert.equal(context.qaStepLabel({ ...step, type: 'numeric' }), null, 'never a measured value');
  assert.equal(context.qaStepLabel({ ...step, name: `${step.name} (edited)` }), null, 'a renamed step shows its own name');
  assert.equal(context.qaDisplayName({ ...step, name: 'toString' }), 'toString', 'only the list\'s own names');
  // No millimetres in what the PBS daily form shows of its checks: the lasers check reads in cm.
  const lasers = 'Visually check that the room lasers align with the BB; offset must be less than 0.2 cm.';
  assert.ok(steps.includes(lasers));
  assert.equal(labels[lasers], 'Room lasers align with BB (offset < 0.2 cm)');
  const pbs = seed.templates.find((t) => t.name === 'PBS DailyQA Template - Sphinx').checks;
  const outsideSphinx = pbs.filter((c) => !/\[Section: Sphinx Measurements\]/.test(c.description || ''));
  assert.equal(outsideSphinx.length, 52);
  for (const c of outsideSphinx) { assert.doesNotMatch(c.name, /\bmm\b/, c.name); assert.notEqual(c.unit, 'mm', c.name); assert.doesNotMatch((c.description || '').replace(/\[derived: [^\]]+\]/, ''), /\bmm\b/, c.name); }
  assert.equal(context.qaDisplayName({ type: 'boolean', category: 'HDR treatment-day QA', name: 'Video system operational' }), 'Video system', 'HDR names as before');
  // The instruction itself stays one click away: the details box of a labelled step carries the full name.
  assert.match(between('function testDetailsButton(', 'function qaColgroup('), /const step=!calculation&&!!qaStepLabel\(item\);/);
  assert.match(between('function testDetailsButton(', 'function qaColgroup('), /el\(step\?'p':'strong',\{class:step\?'qa-step-text':null\},item\.name\)/);
}

console.log('QA columns: Baseline, Measured, Result by default; History off on the QA form; a choice per person and page that survives odd storage; shared rows keep their columns together; PBS step labels match the seed list.');
