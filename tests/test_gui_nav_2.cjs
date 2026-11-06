// Synthetic checks for the second round of GUI and navigation changes (display and layout only). The real code runs in
// node:vm on stand-in elements; nothing here reads stored data. Run with node tests/test_gui_nav_2.cjs from the repository root.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('portal/static/app.js', 'utf8');
assert.equal(fs.readFileSync('docs/app.js', 'utf8'), source, 'docs/app.js is out of step: run python build_pages.py');
const between = (from, to) => { const a = source.indexOf(from), b = source.indexOf(to, a + 1); assert.ok(a >= 0 && b > a, `${from} … ${to}`); return source.slice(a, b); };

// 1. QA form: a table under one with the same columns (same first heading, as many History dates) shows its dates but
// not the column names again; the first table of a section keeps them, and so does the first one shown when
// "Show unfinished only" hides the tables above it.
const measureTable = between('    const measureTable = (members,', '    const shortName = (it) =>');
assert.match(measureTable, /el\("thead", \{\}, el\("tr", \{ class: "qa-col-names" \}, qaHeaders\(firstHeader\)\),/, 'every table builds its names row');
assert.match(measureTable, /dates\.length \? el\("tr", \{ class: "hist-dates" \}/, 'and its date row, as before');
assert.match(measureTable, /el\("div", \{ class: "measure-block", "data-cols": `\$\{firstHeader\}\|\$\{dates\.length\}` \}/, 'the block names its columns');
const thinning = between('      let above=null;', '  const named = t.items.some(').replace(/\s*\}\s*\};\s*$/, '');
const form = {};
vm.createContext(form);
vm.runInContext(`this.thin = (s, unfinishedOnly) => {\n${thinning}\n};`, form);
const block = (cols, { rows = 2, answered = 0, dates = true } = {}) => {
  const names = { hidden: false }, entries = Array.from({ length: rows }, (_, i) => ({ hidden: i < answered }));
  return { hidden: false, dataset: { cols }, names, querySelectorAll: (sel) => (sel === 'tr[data-qa-entry]' ? entries : []),
    querySelector: (sel) => (sel === 'tr.qa-col-names' ? names : sel === 'tr.hist-dates' ? (dates ? {} : null) : null) };
};
const shown = (blocks) => blocks.map((b) => (b.hidden ? 'hidden' : b.names.hidden ? 'dates' : 'names'));
const thin = (blocks, unfinishedOnly = false) => { form.thin({ box: { querySelectorAll: () => blocks } }, unfinishedOnly); return shown(blocks); };
assert.deepEqual(thin([block('Test|3'), block('Energy|3'), block('Energy|3'), block('Energy|3'), block('Test|3')]),
  ['names', 'names', 'dates', 'dates', 'names'], 'per-energy tables under the first: dates only');
assert.deepEqual(thin([block('Axis|3'), block('Axis|3'), block('Energy|3')]), ['names', 'dates', 'names'], 'other first heading: names again');
assert.deepEqual(thin([block('Energy|3'), block('Energy|2')]), ['names', 'names'], 'other number of dates (other History width): names again');
assert.deepEqual(thin([block('Energy|0', { dates: false }), block('Energy|0', { dates: false })]), ['names', 'names'], 'a table with no date row keeps its names');
const unfinished = [block('Test|3'), block('Energy|3', { answered: 2 }), block('Energy|3'), block('Energy|3')];
assert.deepEqual(thin(unfinished, true), ['names', 'hidden', 'names', 'dates'], 'unfinished only: the first table shown gets the names');
unfinished.forEach((b) => { b.querySelectorAll('tr[data-qa-entry]').forEach((r) => { r.hidden = false; }); });
assert.deepEqual(thin(unfinished, false), ['names', 'names', 'dates', 'dates'], 'and back');

// 2. Limits read "Warning ±" / "Action ±" (never WARNING / ACTION / FAIL; the verdict chips keep PASS / WARNING / ACTION).
const words = { el: (tag, props, ...kids) => ({ tag, props: props || {}, textContent: kids.flat(Infinity).join('') }) };
vm.createContext(words);
vm.runInContext(between('function fmt(', '// A Pass / Fail or Yes / No answer') + between('function limitsText(', 'const TYPE_LABELS'), words);
const limitsLine = (limits, unit) => words.qaLimitsLine(limits, unit)?.textContent ?? null;
assert.equal(limitsLine({ expected: 100, warn: 0.5, fail: 1 }, 'mm'), 'Warning ±0.5 mm · Action ±1 mm');
assert.equal(limitsLine({ expected: 0, warn: 2, fail: 3, tol_mode: 'percent' }, 'mGy'), 'Warning ±2 % · Action ±3 %');
assert.equal(limitsLine({ criterion: 'wl-max-delta' }, 'mm'), 'Pass < 1 mm · Action ≥ 1 mm');
assert.equal(words.limitsText({ expected: 100, warn: 0.5, fail: 1 }, 'mm'), '100 mm · Warning ±0.5 mm · Action ±1 mm', "a Sphinx file's differing limits");
assert.doesNotMatch(between('function limitsText(', 'const TYPE_LABELS'), /WARNING ±|ACTION ±|FAIL|warning ±|action ±/);

console.log('GUI and navigation 2: no repeated column names under a table with the same columns (first shown keeps them); limits read Warning ± / Action ±.');
