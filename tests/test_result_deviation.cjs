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
  between('function deviationText(', '// Shell, login, routing'), between('function qaHeaders(', 'function testDetailsButton(')])
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

// No Deviation column on either page; the columns, widths and spans agree on nine columns.
assert.deepEqual(Array.from(context.qaHeaders(), (th) => th.text), ['#', 'Test', 'Measured', 'Unit', 'Result', 'Baseline', 'History', 'Note', 'Trend']);
const perform = between('async function renderPerform(', 'async function renderQueues(');
const review = between('async function renderReviewMeasurements(', 'async function renderRun(');
for (const [name, code] of [['QA form', perform], ['saved run', review]]) {
  assert.doesNotMatch(code, /qa-dev|deltaBadge|'Deviation'/, name);
  assert.deepEqual([...code.matchAll(/colspan\s*:\s*(\d+)/g)].map((m) => m[1]).filter((n, i, all) => all.indexOf(n) === i), ['9'], name);
}
assert.match(perform, /Array\.from\(\{ length: 6 \}, \(\) => el\("th", \{\}\)\),\s*el\("th", \{ class: "history-cell" \}/);   // 6 + History + Note + Trend
assert.match(review, /el\('div',\{class:'status-cell'\},chip\(r\.status\),r\.type==='numeric'&&!missing\?deviationText\(r\.value_num,limits,unit\):null\)/);
const order = /for\(const name of \[([^\]]+)\]\)/.exec(between('function orderMeasurementRow(', 'function performDirections('))[1];
assert.equal(order, "'qa-n','qa-label','qa-measured','qa-unit','qa-result','qa-baseline','history-cell','qa-comment','qa-trends'");
const fit = between('function fitQaTable(', 'function orderMeasurementRow(');
const widths = /const widths=\[(.*?)\];/.exec(fit)[1].split(',');
assert.equal(widths.length, 9);
assert.match(fit, /Array\.from\(\{length:9\}/);
const fixed = widths.filter((w) => /^'\d+px'$/.test(w)).reduce((sum, w) => sum + parseInt(w.slice(1), 10), 0);
assert.equal(fixed, Number(/wrap\.clientWidth-(\d+)-320/.exec(fit)[1]), 'the history count must use the fixed column total');
// Result is sized for the QA form's one reading size (22 px on desktop, forced on every element of the form): measured in
// Chrome, the WARNING chip is 128 px and "(Δ −12.35 mm)" 146 px, with a 6 px gap and 8 px cell padding each side.
assert.match(css, /#app\[data-page\^="perform\/"\], #app\[data-page\^="runs\/"\] \{ --qa-form-font-size:22px; \}/);
const result = parseInt(widths[4].slice(1), 10);
assert.equal(widths[4], "'300px'");
assert.ok(result >= 128 + 6 + 146 + 2 * 8, '"WARNING (Δ −12.35 mm)" must fit on one line');
// Every other column keeps its width; Result takes 32 px more than the old Deviation (140) + Result (128) pair.
assert.equal(fixed, 72 + 156 + 76 + 132 + 72 + 80 + result);
assert.equal(result - (140 + 128), 32);
assert.match(perform, /const widths = \["100px", "auto", "190px", "100px", "300px", "150px", "424px", "130px", "100px"\];/);
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
    console.log('Result shows PASS (Δ +0.30 mm) with the old digits, follows typing, nine columns on both pages, PDF Deviation line kept.');
  }).catch((e) => { console.error(e); process.exit(1); });
