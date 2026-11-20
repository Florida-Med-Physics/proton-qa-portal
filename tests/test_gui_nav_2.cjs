// Synthetic checks for the second round of GUI and navigation changes (display and layout only). The real code runs in
// node:vm on stand-in elements; nothing here reads stored data. Run with node tests/test_gui_nav_2.cjs from the repository root.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('portal/static/app.js', 'utf8');
assert.equal(fs.readFileSync('docs/app.js', 'utf8'), source, 'docs/app.js is out of step: run python build_pages.py');
const between = (from, to) => { const a = source.indexOf(from), b = source.indexOf(to, a + 1); assert.ok(a >= 0 && b > a, `${from} … ${to}`); return source.slice(a, b); };

// 1. QA form: in a section, a table under one with the same columns does not name them again (History's dates still show
// when History is on); the first table of a section names them, and so does the first one shown when "Show unfinished
// only" hides the tables above it. A table's columns are named on its block (data-cols) by layoutQaTable.
const measureTable = between('    const measureTable = (members,', '    const shortName = (it) =>');
assert.match(measureTable, /el\("thead", \{\}, el\("tr", \{ class: "qa-col-names" \}, qaHeaders\(firstHeader\)\),/, 'every table builds its names row');
assert.match(measureTable, /dates\.length \? qaDatesRow\(dates\.map\(dateSlot\)\) : null/, 'and its date row, as before');
assert.match(measureTable, /layoutQaTable\(tableEl, "perform"\);/, 'and is laid out in the person\'s columns');
assert.match(between('function layoutQaTable(', 'function qaHeadings('), /block\.dataset\.cols = `\$\{shown\.map\(\(c\) => c\.key\)\.join\(' '\)\}\|\$\{history \? dates : 0\}\|\$\{table\.querySelector\('\.seg\.warn'\) \? 'wide' : ''\}`;/, 'the block names its columns');
assert.match(between('  const refresh = () => {', '  const named = t.items.some('), /block\.hidden=unfinishedOnly&&!visible\.length;[\s\S]*qaHeadings\(blocks\);/, 'after hiding finished tables, the names rows are thinned');
const form = {};
vm.createContext(form);
vm.runInContext(between('function qaHeadings(', '// The Columns box') + '\nthis.qaHeadings = qaHeadings;', form);
// The repeated names row is collapsed with the class "repeat", never removed with hidden: screen readers still read each
// cell's column names (Measured, Unit, Result…) from it.
const classList = () => { const on = new Set(); return { toggle: (c, force) => { if (force) on.add(c); else on.delete(c); return !!force; }, contains: (c) => on.has(c) }; };
const block = (cols, { hidden = false } = {}) => {
  const names = { hidden: false, classList: classList() };
  return { hidden, dataset: { cols }, names, querySelector: (sel) => (sel === 'tr.qa-col-names' ? names : null) };
};
const shown = (blocks) => blocks.map((b) => (b.hidden ? 'hidden' : b.names.hidden ? 'names removed' : b.names.classList.contains('repeat') ? 'collapsed' : 'names'));
const thin = (blocks) => { form.qaHeadings(blocks); return shown(blocks); };
const PLAIN = 'n test baseline measured unit result comment trends|0|', DATED = 'n test baseline measured unit result history comment trends|3|';
assert.deepEqual(thin([block(PLAIN), block(PLAIN), block(PLAIN), block(PLAIN)]), ['names', 'collapsed', 'collapsed', 'collapsed'], 'one names row for a section of like tables');
assert.deepEqual(thin([block(DATED), block(DATED), block(DATED.replace('|3|', '|2|'))]), ['names', 'collapsed', 'names'], 'other number of dates (other History width): names again');
assert.deepEqual(thin([block(PLAIN), block(PLAIN + 'wide'), block(PLAIN)]), ['names', 'names', 'names'], 'a wider Measured (Pass / Warning / Fail buttons): names again');
assert.deepEqual(thin([block(PLAIN), block('n test measured result|0|'), block('n test measured result|0|')]), ['names', 'names', 'collapsed'], 'other columns (a table with a shared row keeps its own order): names again');
const unfinished = [block(PLAIN, { hidden: true }), block(PLAIN), block(PLAIN)];
assert.deepEqual(thin(unfinished), ['hidden', 'names', 'collapsed'], 'unfinished only: the first table shown gets the names');
unfinished[0].hidden = false;
assert.deepEqual(thin(unfinished), ['names', 'collapsed', 'collapsed'], 'and back');
const css = fs.readFileSync('portal/static/app.css', 'utf8');
assert.equal(fs.readFileSync('docs/app.css', 'utf8'), css, 'docs/app.css is out of step: run python build_pages.py');
assert.ok(css.includes('.measure-table tr.qa-col-names.repeat > th { height:0 !important; padding-top:0 !important; padding-bottom:0 !important; border:0 !important; line-height:0 !important; font-size:0 !important; overflow:hidden; }'),
  'the repeated names row takes no room on screen');
assert.ok(css.includes('#app .measure-table tr.qa-col-names.repeat > th { font-size:0 !important; }'), 'not even its text, which the form sizes with !important');

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
// 3b. The note's box never scrolls sideways: a long unbroken path or file name wraps inside it (the box is outside #app,
// so the table cells' overflow-wrap does not reach it).
assert.match(css, /\.calculation-dialog \.pre \{ overflow-wrap:anywhere; \}/, 'a note with a long unbroken path wraps in its box');

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
  '.submit-bar > .save-draft { grid-column:1; grid-row:2; min-height:48px; }',
  '.submit-bar:has(> .save-draft) > button.primary { grid-column:2; grid-row:2; }',
  // The two buttons the same height, each label on one line down to 350-360 px: 17px at most (the form sets every size
  // through --qa-form-font-size with !important, so a plain font-size here never applied) and narrower side padding.
  '.submit-bar:has(> .save-draft) > button { align-self:stretch; padding-left:8px; padding-right:8px; --qa-form-font-size:min(17px, 1em); }']) assert.ok(phoneRules.includes(rule), rule);
assert.doesNotMatch(phoneRules, /\.submit-bar[^{]*\{[^}]*font-size:17px/, 'no font-size the form-wide rule overrides');
assert.match(css, /\.submit-bar > button\.primary \{ grid-column:2; grid-row:1;/, "other bars (a saved run's) keep their layout");

// 6. Machine Trends statistics on a phone: a long series name may wrap after an underscore and before a bracket besides its
// spaces (never inside a word), so a narrow table fits; a short symbol such as k_Q stays whole; the text is unchanged.
const wraps = { el: (tag, props, ...kids) => ({ tag, props: props || {}, kids: kids.flat(Infinity) }) };
vm.createContext(wraps);
vm.runInContext(between('function seriesNameWraps(', 'function trendSummaryTable('), wraps);
const pieces = (name) => wraps.seriesNameWraps(name).map((k) => (typeof k === 'string' ? k : `<${k.tag}>`)).join('');
assert.equal(pieces('Field1_Exp_IsoDepth [cm]'), 'Field1_<wbr>Exp_<wbr>IsoDepth [cm]');
assert.equal(pieces('Chamber Cal. Factor(Proton), Gy/C'), 'Chamber Cal. Factor<wbr>(Proton), Gy/C');
assert.equal(pieces('k_Q'), 'k_Q'); assert.equal(pieces(null), ''); assert.equal(pieces('Chamber k_pol'), 'Chamber k_pol'); assert.equal(pieces('Range (D90) [cm]'), 'Range (D90) [cm]');
assert.match(between('function trendSummaryTable(', '// Limit bands on a Δ chart'), /el\("th", \{ scope: "row" \}, el\("span", \{ class: `key-swatch line \$\{r\.color\}`, "aria-hidden": "true" \}\), seriesNameWraps\(r\.label\)\)/);

console.log('GUI and navigation 2: no repeated column names under a table with the same columns (first shown keeps them); limits read Warning ± / Action ±; a saved run note behind a pencil; Mark in Progress beside Submit on a phone.');
