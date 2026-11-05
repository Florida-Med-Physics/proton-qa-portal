// Synthetic checks for the GUI and navigation changes (display and navigation only). The real helpers run in node:vm;
// nothing here reads stored data. Run with node tests/test_gui_nav.cjs from the repository root.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('portal/static/app.js', 'utf8');
assert.equal(fs.readFileSync('docs/app.js', 'utf8'), source, 'docs/app.js is out of step: run python build_pages.py');
const between = (from, to) => { const a = source.indexOf(from), b = source.indexOf(to, a + 1); assert.ok(a >= 0 && b > a, `${from} … ${to}`); return source.slice(a, b); };
const context = {};
vm.createContext(context);
const run = (code) => vm.runInContext(code, context);

// 1. History shows the answer of a Pass / Fail or Yes / No test, never "1.000 Pass/Fail".
run(between('function answerWord(', '// Machine Trends shows numbers'));
assert.equal(context.answerWord('boolean', 'Yes/No', 1), 'Yes');
assert.equal(context.answerWord('boolean', 'Yes/No', 0), 'No');
assert.equal(context.answerWord('boolean', 'Pass/Fail', 0), 'Fail');
assert.equal(context.answerWord('boolean', 'Pass/Fail', 1), 'Pass');
assert.equal(context.answerWord('boolean', '', 1), 'Pass');
assert.equal(context.answerWord('status', '', null, 'warn'), 'Warning');
assert.equal(context.answerWord('status', '', null, 'recorded'), '—');
const form = between('      const histChips = (it, unit) => {', '      const refCell = (it, unit) =>');
assert.match(form, /answered \? el\("span", \{ class: `hist \$\{h\.status\}`, title: `\$\{dateLabel\(h\.qa_date\)\}: \$\{answerWord\(/);
const review = between('async function renderReviewMeasurements(', 'async function renderRun(');
assert.doesNotMatch(review, /h\.value\?'Pass':'Fail'/, 'the saved run uses the same words as the form');
assert.match(review, /fmt\(h\.value,dp\)/, 'the saved run History uses one decimal count per table');

console.log('GUI and navigation: History words.');
