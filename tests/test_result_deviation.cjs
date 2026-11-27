// Synthetic checks: the deviation sits in brackets after the Result chip, "(Δ +0.30 mm)", on the QA form (following the
// value as it is typed) and on a saved run; there is no Deviation column. Run with node tests/test_result_deviation.cjs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('portal/static/app.js', 'utf8');
const css = fs.readFileSync('portal/static/app.css', 'utf8');
const between = (from, to) => { const a = source.indexOf(from), b = source.indexOf(to, a + 1); assert.ok(a >= 0 && b > a, `${from} … ${to}`); return source.slice(a, b); };

// A small stand-in for the page's el(): enough to read the text and class of what would be drawn.
function el(tag, props, ...kids) {
  const node = { tag, props: props || {}, kids: [], listeners: {},
    replaceChildren(...k) { assert.ok(k.every((x) => x !== null && x !== undefined && x !== false), 'a cell would read "null"'); this.kids = k; },
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    get text() { return this.kids.map((k) => (typeof k === 'object' ? k.text : String(k))).join(''); } };
  for (const kid of kids.flat(Infinity)) if (kid !== null && kid !== undefined && kid !== false) node.kids.push(kid);
  return node;
}
const context = { el, QADerived: { value: (input) => input.value, setInput() {} }, refresh() {} };
vm.createContext(context);
for (const part of [between('const present =', 'for (const method of'), between('const STATUS_LABEL', 'const REVIEW_LABEL'),
  between('function capitalize(', 'function decimalsOf('), between('function fmt(', 'function today('), between('const signed =', '\n'),
  between('function deviationText(', '// Shell, login, routing'), between('const QA_COLUMNS = [', 'const QA_COLUMNS_HIDDEN'), between('function qaHeaders(', 'function testDetailsButton(')])
  vm.runInContext(part, context);
const text = (node) => (node ? node.text : null);

// Same digits and sign as the old green / yellow / red badge, in brackets, unit after the number.
const signed = vm.runInContext('signed', context);
const oldBadge = (v, limits, unit) => `Δ ${signed(v - limits.expected)} ${unit || ''}`.trim();
const ref = { expected: 100, warn: 0.5, fail: 1, tol_mode: 'absolute' };
assert.equal(text(context.deviationText(100.3, ref, 'mm')), '(Δ +0.30 mm)');
assert.equal(text(context.deviationText(99.25, ref, 'mm')), '(Δ −0.75 mm)');
assert.equal(text(context.deviationText(100, ref, 'mm')), '(Δ +0.00 mm)');
assert.equal(text(context.deviationText(100.3, ref, '')), '(Δ +0.30)');
for (const v of [100.004, 100.005, 99.995, 112.345, 87.6549, 0, -3.21]) for (const unit of ['mm', 'MU', ''])
  assert.equal(text(context.deviationText(v, ref, unit)), `(${oldBadge(v, ref, unit)})`);
// A percent limit: just the percent, the number it is judged on (Brook: "Just one").
assert.equal(text(context.deviationText(101.2, { ...ref, tol_mode: 'percent' }, 'MU')), '(Δ +1.20 %)');
assert.equal(text(context.deviationText(0.3, { ...ref, expected: 0, tol_mode: 'percent' }, 'MU')), '(Δ +0.30 MU)');   // no percent of 0
assert.equal(context.deviationText(100.3, ref, 'mm').props.class, 'result-dev');   // plain; the chip carries the colour
// One piece that never breaks inside a number and its unit.
const pieces = (node) => node.kids.map((k) => (typeof k === 'object' ? [k.tag, k.text] : k));
assert.deepEqual(pieces(context.deviationText(99.7, ref, 'mm')), [['span', '(Δ −0.30 mm)']]);
assert.deepEqual(pieces(context.deviationText(97.4, { ...ref, tol_mode: 'percent' }, 'cGy')), [['span', '(Δ −2.60 %)']]);
// Nothing without a reference or a value.
for (const [v, limits] of [[100.3, { ...ref, expected: null }], [100.3, { ...ref, expected: undefined }], [100.3, null], [null, ref], [NaN, ref], [undefined, ref]])
  assert.equal(context.deviationText(v, limits, 'mm'), null);

// The QA form: the Result cell is rebuilt on every keystroke, chip first and the bracket after it.
const entrySource = between('      const statusCell = el("div", { class: "status-cell" });', '      input.addEventListener("change", update);');
vm.runInContext(`this.makeEntry = (item, input) => { const comment = {}, note = {};\n${entrySource}\nreturn { statusCell }; };`, context);
const typeInto = (item) => {
  const input = el('input'); input.value = ''; input.dataset = {};
  const { statusCell } = context.makeEntry(item, input);
  return (value) => { input.value = value; input.listeners.input.forEach((fn) => fn()); return statusCell.kids.map((k) => [k.props.class, k.text]); };
};
const type = typeInto({ type: 'numeric', name: 'Synthetic offset', unit: 'mm', limits: ref });
assert.deepEqual(type('100.3'), [['chip pass', 'PASS'], ['result-dev', '(Δ +0.30 mm)']]);
assert.deepEqual(type('100.75'), [['chip warn', 'WARNING'], ['result-dev', '(Δ +0.75 mm)']]);
assert.deepEqual(type('98.8'), [['chip fail', 'ACTION'], ['result-dev', '(Δ −1.20 mm)']]);
assert.deepEqual(type(''), []);
assert.deepEqual(typeInto({ type: 'numeric', name: 'No reference', unit: 'mm', limits: { expected: null, warn: null, fail: null } })('4.2'), [['chip recorded', 'Recorded']]);
assert.deepEqual(typeInto({ type: 'numeric', name: 'Unitless', unit: 'unitless', limits: ref })('100.3'), [['chip pass', 'PASS'], ['result-dev', '(Δ +0.30)']]);
assert.deepEqual(typeInto({ type: 'boolean', name: 'Interlock', unit: '', limits: {} })('pass'), []);

// No Deviation column on either page; the columns, widths and spans agree on eleven columns, all read from QA_COLUMNS
// (Baseline, Measured, Result in that order since 2026-11-19, the limits in columns of their own, Warning ± and Action ±,
// since 2026-11-26; a person may reorder and hide them: tests/test_qa_columns.cjs).
const columns = Array.from(vm.runInContext('QA_COLUMNS', context));   // a plain array of this realm, so it compares with the ones built here
assert.deepEqual(Array.from(context.qaHeaders(), (th) => th.text), ['#', 'Test', 'Baseline', 'Measured', 'Unit', 'Warning ±', 'Action ±', 'Result', 'History', 'Note', 'Trend']);
assert.deepEqual(Array.from(context.qaHeaders('Energy'), (th) => [th.props['data-col'], th.props.title]).slice(0, 3), [['n', '#'], ['test', 'Energy'], ['baseline', 'Baseline']]);
const perform = between('async function renderPerform(', 'function importSphinxDialog(');
const review = between('async function renderReviewMeasurements(', 'async function renderRun(');
for (const [name, code] of [['QA form', perform], ['saved run', review]]) {
  assert.doesNotMatch(code, /qa-dev|deltaBadge|'Deviation'/, name);
  // No span is typed as a number, which a new column would leave behind: a row across the table (a quick trend, a
  // phone's extras) spans QA_COLUMNS, a line of tests the columns its one cell covers (layoutQaTable then sets both to
  // the columns shown).
  assert.deepEqual([...code.matchAll(/colspan\s*:\s*([^,})\s]+)/g)].map((m) => m[1]).filter((n, i, all) => all.indexOf(n) === i).sort(), ['QA_COLUMNS.length', 'QA_SHARED_COLUMNS.length'], name);
}
assert.match(source, /const QA_SHARED_COLUMNS = \['test', 'baseline', 'measured', 'unit', 'warn', 'action', 'result'\];/);
assert.match(perform, /dates\.length \? qaDatesRow\(dates\.map\(dateSlot\)\) : null/);
const datesRow = context.qaDatesRow(['a', 'b']);   // one heading cell per column; History's holds the dates
assert.deepEqual(datesRow.kids.map((th) => th.props['data-col']), columns.map((c) => c.key));
assert.deepEqual(datesRow.kids.filter((th) => th.props.class === 'history-cell').map((th) => th.text), ['ab']);
// A saved run: the chip, then the bracket; the chip also carries the Δ as its title (a line of tests shows PASS alone).
assert.match(review, /const deviation=r\.type==='numeric'&&!missing\?deviationText\(r\.value_num,limits,unit\):null,verdict=chip\(r\.status\);\s*if\(deviation\)verdict\.title=deviation\.textContent;/);
assert.match(review, /result:el\('div',\{class:'status-cell'\},verdict,deviation\)\}/);
assert.deepEqual(columns.map((c) => c.cls), ['qa-n', 'qa-label', 'qa-baseline', 'qa-measured', 'qa-unit', 'qa-warn', 'qa-action', 'qa-result', 'history-cell', 'qa-comment', 'qa-trends']);
assert.match(between('function orderMeasurementRow(', '// Puts a QA table\'s cells'), /for\(const c of QA_COLUMNS\) \{\s*const cell=\[\.\.\.row\.children\]\.find\(x=>x\.classList\.contains\(c\.cls\)\);if\(cell\)row\.append\(cell\);/);
const fit = between('function fitQaTable(', 'function orderMeasurementRow(');
assert.equal(columns.length, 11);
const fixed = columns.filter((c) => c.key !== 'history').reduce((sum, c) => sum + c.width, 0);
assert.match(fit, /const fixed=shown\.reduce\(\(sum,c\)=>sum\+\(c\.key==='history'\?0:c\.width\),0\);/, 'the history count uses the total of the columns shown');
assert.match(fit, /Math\.floor\(\(wrap\.clientWidth-fixed-320\)\/144\)/);
// Result is sized for the QA form's one reading size (22 px on desktop, forced on every element of the form): measured in
// Chrome, the WARNING chip is 128 px and "(Δ −12.35 mm)" 146 px, with a 6 px gap, 8 px cell padding each side and, since
// a QA table is a grid of cells (2026-11-27), the cell's hairlines (1 px in all: each is shared with a neighbour).
assert.match(css, /#app\[data-page\^="perform\/"\], #app\[data-page\^="runs\/"\] \{ --qa-form-font-size:22px; \}/);
assert.match(css, /#app \.measure-table th, #app \.measure-table td \{ border:1px solid var\(--border\); \}/);
const result = columns.find((c) => c.key === 'result').width;
assert.equal(result, 300);
assert.ok(result >= 128 + 6 + 146 + 2 * 8 + 1, '"WARNING (Δ −12.35 mm)" must fit on one line');
// #, Measured, Unit and Baseline gave up some width when the limits took columns of their own (Warning ± 140, Action ±
// 124: each as wide as its heading needs); Result keeps its own, 32 px more than the old Deviation (140) + Result (128) pair.
assert.equal(fixed, 64 + 148 + 70 + 124 + 140 + 124 + 72 + 80 + result);
assert.equal(result - (140 + 128), 32);
assert.doesNotMatch(css, /qa-dev|\.delta\b/);
assert.match(css, /\.result-dev \{[^}]*color: var\(--muted\)/);
// No size of its own (the form's reading size wins anyway); the pieces never break inside; phones leave it out, as they
// left out the Deviation column (only the test, answer and verdict).
assert.doesNotMatch(css, /\.result-dev[^{]*\{[^}]*font-size/);
assert.match(css, /\.result-dev > span \{ white-space: nowrap; \}/);
const phone = css.slice(css.indexOf('/* Compact phone entry: only the test, measured value and verdict. */'));
assert.match(phone.slice(0, phone.indexOf('\n}\n')), /\.measure-table \.result-dev \{ display:none; \}/);
assert.equal(fs.readFileSync('docs/app.css', 'utf8'), css, 'docs/app.css is out of step: run python build_pages.py');

// The PDF report keeps its own "Deviation:" line.
// One test per row here; the PDF's numbering of shared rows is checked in tests/test_shared_rows.cjs.
const report = { Blob, blockNumbers: () => new Map(), sharedRows: (list) => list.map((r) => [r]) };
vm.createContext(report);
for (const part of [between('const REVIEW_LABEL', 'function reviewChip('), between('function capitalize(', 'function decimalsOf('), between('function qaReportPdf(', 'async function downloadQaReport')])
  vm.runInContext(part, report);
report.qaReportPdf({ id: 7, queue_name: 'Synthetic QA', machine_name: 'Synthetic machine', qa_date: '2026-10-22', overall: 'pass', review_status: 'pending',
  results: [{ name: 'Synthetic offset', type: 'numeric', value_num: 100.3, expected: 100, warn: 0.5, fail: 1, unit: 'mm', status: 'pass' }] }).text()
  .then((pdf) => {
    assert.ok(pdf.includes('Deviation: 0.3 mm'));
    console.log('Result shows PASS (Δ +0.30 mm) with the old digits, follows typing, eleven columns on both pages, PDF Deviation line kept.');
  }).catch((e) => { console.error(e); process.exit(1); });
