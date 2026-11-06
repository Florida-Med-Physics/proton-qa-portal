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
// The repeated names row is collapsed with the class "repeat", never removed with hidden: screen readers still read each
// cell's column names (Measured, Unit, Result…) from it.
const classList = () => { const on = new Set(); return { toggle: (c, force) => { if (force) on.add(c); else on.delete(c); return !!force; }, contains: (c) => on.has(c) }; };
const block = (cols, { rows = 2, answered = 0, dates = true } = {}) => {
  const names = { hidden: false, classList: classList() }, entries = Array.from({ length: rows }, (_, i) => ({ hidden: i < answered }));
  return { hidden: false, dataset: { cols }, names, querySelectorAll: (sel) => (sel === 'tr[data-qa-entry]' ? entries : []),
    querySelector: (sel) => (sel === 'tr.qa-col-names' ? names : sel === 'tr.hist-dates' ? (dates ? {} : null) : null) };
};
const shown = (blocks) => blocks.map((b) => (b.hidden ? 'hidden' : b.names.hidden ? 'names removed' : b.names.classList.contains('repeat') ? 'dates' : 'names'));
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
const css = fs.readFileSync('portal/static/app.css', 'utf8');
assert.equal(fs.readFileSync('docs/app.css', 'utf8'), css, 'docs/app.css is out of step: run python build_pages.py');
assert.ok(css.includes('.measure-table tr.qa-col-names.repeat > th { height:0 !important; padding-top:0 !important; padding-bottom:0 !important; border:0 !important; line-height:0 !important; font-size:0 !important; overflow:hidden; }'),
  'the repeated names row takes no room on screen');

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

// 3a. A saved run's note sits behind a pencil, as on the QA form (Brook: comments behind a pencil icon): the note on hover,
// in full in a box on a click; no note, a dash. The narrow Note column then never holds a paragraph.
const shown2 = [];
const notes = { document: { body: { append: (d) => shown2.push(d) } },
  el: (tag, props, ...kids) => ({ tag, props: props || {}, kids: kids.flat(Infinity), attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, addEventListener() {}, showModal() {} }) };
vm.createContext(notes);
vm.runInContext(between('function infoPopup(', 'function qaDisplayName('), notes);
const pencil = notes.noteButton('Synthetic note: chamber re-seated.');
assert.deepEqual([pencil.tag, pencil.className, pencil.textContent, pencil.title, pencil.attrs['aria-label']],
  ['button', 'icon-btn note-btn has-note', '✎', 'Synthetic note: chamber re-seated.', 'Note: Synthetic note: chamber re-seated.']);
pencil.props.onclick();
assert.equal(shown2.length, 1, 'a click opens the note in a box');
assert.deepEqual([shown2[0].tag, shown2[0].kids[0].kids[0], shown2[0].kids[1].props.class, shown2[0].kids[1].kids[0]], ['dialog', 'Note', 'pre', 'Synthetic note: chamber re-seated.']);
assert.match(between('async function renderReviewMeasurements(', 'async function renderRun('), /el\('td',\{class:'qa-comment','data-label':'Comment'\},shared\?shared\.comment:r\.comment\?noteButton\(r\.comment\):'—'\)/);

// 5. Phone: Mark in Progress stays in the QA form's bar beside Submit (the same button and handler); the drawer keeps the
// date, the draft note and Cancel. The bar's phone layout is in GatorQA's 1200px block (floridaphysics.com moves it to 767px).
const footer = between('  const saveDraft = el(', '  refresh();');
assert.match(footer, /const saveDraft = el\("button", \{ type: "button", class: "save-draft", onclick: async \(\) => \{/);
assert.match(footer, /phoneDrawer\(footer, \[footer\.children\[0\], draftNote, footer\.children\[5\]\], 'Date & draft options'\);/);
assert.doesNotMatch(footer, /phoneDrawer\([^;]*saveDraft/, 'Mark in Progress is not moved into the drawer');
const cssLF = css.replace(/\r\n/g, '\n');
const phoneStart = cssLF.indexOf('@media (max-width: 1200px) {\n  html, body { max-width: 100%; }');
assert.ok(phoneStart >= 0, "GatorQA's phone block");
const phoneRules = cssLF.slice(phoneStart, cssLF.indexOf('\n}\n', phoneStart));
for (const rule of ['.submit-bar:has(> .save-draft) { grid-template-columns:minmax(0,1fr) minmax(0,1fr); }',
  '.submit-bar > .save-draft { grid-column:1; grid-row:2; min-height:48px; font-size:17px; }',
  '.submit-bar:has(> .save-draft) > button.primary { grid-column:2; grid-row:2; }']) assert.ok(phoneRules.includes(rule), rule);
assert.match(css, /\.submit-bar > button\.primary \{ grid-column:2; grid-row:1;/, "other bars (a saved run's) keep their layout");

console.log('GUI and navigation 2: no repeated column names under a table with the same columns (first shown keeps them); limits read Warning ± / Action ±; a saved run note behind a pencil; Mark in Progress beside Submit on a phone.');
