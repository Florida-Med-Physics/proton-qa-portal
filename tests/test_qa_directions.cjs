// Synthetic checks of a list's directions (Setup QA's Result Type "Direction: section" and "Direction: test below";
// [direction: section] and [direction: next] in an item's directions): the tag round trip leaves the rest of the field
// byte for byte and never shows as directions; the test form saves a direction as a Text item with the tag; numbering
// (blockNumbers) gives a direction no number and counts on across it, so the tests around it number and join rows as if
// it were not there; the QA form keeps directions out of its rows and its history request, lists a section's behind the
// section's ⓘ and hands the others to the test below them. A Text item records nothing while it has no answer in either
// build, which is why a direction needs nothing from the code that saves and judges a run.
// The QA form and Setup QA are checked in a browser by tests/test_qa_directions_page.cjs.
// Run with node tests/test_qa_directions.cjs from the repository root.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('portal/static/app.js', 'utf8');
assert.equal(fs.readFileSync('docs/app.js', 'utf8'), source, 'docs/app.js is out of step: run python build_pages.py');
const between = (from, to, text = source) => { const a = text.indexOf(from), b = text.indexOf(to, a + 1); assert.ok(a >= 0 && b > a, `${from} … ${to}`); return text.slice(a, b); };
const J = (x) => JSON.parse(JSON.stringify(x));   // answers from node:vm, compared as plain values

// A small stand-in for the page's el(): enough to read tags, attributes and text.
function el(tag, props, ...kids) {
  const node = { tag, props: props || {}, kids: [] };
  for (const kid of kids.flat(Infinity)) if (kid !== null && kid !== undefined && kid !== false) node.kids.push(kid);
  Object.defineProperty(node, 'text', { get() { return this.kids.map((k) => (typeof k === 'object' ? k.text : String(k))).join(''); } });
  Object.defineProperty(node, 'lastChild', { get() { const k = this.kids.at(-1); return typeof k === 'object' ? k : { textContent: String(k) }; } });
  return node;
}
const opened = [];
const context = { el, infoPopup: (content, label) => { opened.push({ content, label }); return el('button', { 'aria-label': label }, 'ⓘ'); },
  QADerived: { read: () => null, encode: (d) => d }, derivedExplanation: () => null, qaStepLabel: () => null, qaDisplayName: (item) => item.name };
vm.createContext(context);
for (const part of [between('const TYPE_LABELS', '\n'), between('// Directions are shown with the test', 'function infoDisclosure('), between('function testDetailsButton(', 'function qaColgroup('),
  between("// A group's directions (an X / Y / Z or per-energy table)", 'function helpText('), between('function helpText(', 'function fitTextarea('),
  between('function sectionNumber(', 'function checkNumber('), between('const AXIS_NAME', '// Rotations of one thing')])
  vm.runInContext(part, context);
vm.runInContext('this.api = { isDirection, directionKind, directionType, typeLabel, withDirectionMark, testFormData, directionsList, sectionDirections, testDetailsButton, performDirections, blockNumbers, sharedRows, directionsParts, joinDirections, helpText, TYPE_LABELS };', context);
const { isDirection, directionKind, directionType, typeLabel, withDirectionMark, testFormData, directionsList, sectionDirections, testDetailsButton, performDirections, blockNumbers, sharedRows, directionsParts, joinDirections, helpText, TYPE_LABELS } = context.api;
const TAGS = { section: '[direction: section]', next: '[direction: next]' };

// 1. The tag round trip (Setup QA's Result Type), for the kinds of directions the seed lists carry.
const seed = JSON.parse(fs.readFileSync('portal/seed.json', 'utf8'));
const samples = [...new Set(seed.templates.flatMap((t) => t.checks.map((c) => c.description || '')).filter((d) => !d.includes('[direction:'))), '', 'Plain directions', 'Line one\nline two', 'Source: only a source line'];
assert.ok(samples.length > 20);
// The seed's own directions: in the PBS daily list only. The seven setup steps are their section's (after its fields);
// seventeen instructions of the next section are for the test below them (the room lasers check; the kV/kV isocenter
// block; the CBCT correction vector block; the gantry-90 kV/kV correction vector block; the BB alignment check); three
// steps, up to delivering the beam, are the Sphinx Measurements section's. Each is a Text item with its tag and no unit.
const seeded = seed.templates.flatMap((t) => t.checks.filter((c) => (c.description || '').includes('[direction:')).map((c) => ({ ...c, list: t.name })));
assert.deepEqual(seeded.map((c) => directionKind(c)), [...Array(7).fill('section'), ...Array(17).fill('next'), 'section', 'section', 'section']);
for (const c of seeded) {
  assert.equal(c.list, 'PBS DailyQA Template - Sphinx');
  assert.equal(c.unit, undefined);
  assert.match(c.description, /^Template \d\.\d+[a-z]?\. \[Section: (Setup and Safety|Mechanical and Imaging|Sphinx Measurements)\] \[direction: (section|next)\]$/);
}
const pbs = seed.templates.find((t) => t.name === 'PBS DailyQA Template - Sphinx').checks.map((c, i) => ({ ...c, test_id: i + 1 }));
const setup = pbs.filter((c) => /\[Section: Setup and Safety\]/.test(c.description || ''));
assert.deepEqual(setup.map((c) => directionKind(c)), [null, null, null, null, null, null, null, 'section', 'section', 'section', 'section', 'section', 'section', 'section']);
const seedNumbers = blockNumbers(pbs);
assert.deepEqual(setup.filter((c) => !isDirection(c)).map((c) => seedNumbers.get(c.test_id)), ['1.01', '1.02', '1.03', '1.04', '1.05', '1.06', '1.07']);
const imaging = pbs.filter((c) => /\[Section: Mechanical and Imaging\]/.test(c.description || '')).slice(0, 32);
assert.deepEqual(imaging.map((c) => directionKind(c)), ['next', null, 'next', 'next', null, null, null, null, 'next', 'next', 'next', 'next', 'next', null, null, null, null, 'next', 'next', 'next', 'next', 'next', 'next', null, null, null, null, 'next', 'next', 'next', null, null]);
assert.deepEqual(imaging.map((c) => seedNumbers.get(c.test_id) || ''), ['', '2.01', '', '', '2.02', '2.02', '2.02', '2.02', '', '', '', '', '', '2.03', '2.03', '2.03', '2.03', '', '', '', '', '', '', '2.04', '2.04', '2.04', '2.04', '', '', '', '2.05', '2.06'],
  'the lasers check, the kV/kV isocenter block, the CBCT correction vector block, the kV/kV correction vector block, then the check after it');
assert.equal(imaging[12].name, 'DO NOT APPLY Correction');
// The kV/kV correction vector block ends its steps with recording the vector and then applying the correction (the
// CBCT block ends with not applying it), and takes the CBCT block's baselines and limits ("Same as 2.03").
assert.deepEqual(imaging.slice(21, 23).map((c) => c.name), ['Record the correction vector from the isocenter before moving the couch.', 'Apply the recorded correction vector and move the couch.']);
assert.deepEqual(imaging.slice(23, 26).map((c) => c.name), ['X', 'Y', 'Z'].map((axis) => `Mechanical-to-kV/kV Correction Vector ${axis} [cm]`));
// Three steps are directions of the Sphinx Measurements section (Brook, 2026-11-20: "put the instructions into the Sphinx
// Measurements (i) that included 2.06, 2.07, and 3.01"): first in it, side by side, so its checks start at the delivered MU.
const sphinx = pbs.filter((c) => /\[Section: Sphinx Measurements\]/.test(c.description || ''));
assert.deepEqual(sphinx.slice(0, 4).map((c) => [c.name, directionKind(c), seedNumbers.get(c.test_id) || '']),
  [['Retract panels A and B.', 'section', ''], ['Go to MyQA, open your machine QA, connect Sphinx, and measure the background.', 'section', ''], ['Deliver the beam.', 'section', ''],
    ['[MU] Delivered MU (Record in IC2)', null, '3.01']]);
assert.equal(pbs.filter((c) => /\[Section: Mechanical and Imaging\]/.test(c.description || '')).some((c) => /Retract panels|Go to MyQA/.test(c.name)), false);
// What reads as one line is one row with one number ("Whenever theres nC and cGy, keep it on the same row"): the
// delivered MU with the beam's irradiation time (3.01); the chamber, its factor, the electrometer, its factor and the
// overall factor, five tests on one line (3.02); the charge with the dose (3.03); the coincidence X offset with Y (3.17).
const joined = pbs.filter((c) => /\[row: with above\]/.test(c.description || '')).map((c) => [pbs[c.test_id - 2].name, c.name, seedNumbers.get(pbs[c.test_id - 2].test_id), seedNumbers.get(c.test_id)]);
assert.deepEqual(joined, [['[MU] Delivered MU (Record in IC2)', 'Beam Irradiation Time [min:s]', '3.01', '3.01'],
  ['Chamber', 'Chamber Cal. Factor(Proton), Gy/C', '3.02', '3.02'], ['Chamber Cal. Factor(Proton), Gy/C', 'Electrometer', '3.02', '3.02'],
  ['Electrometer', 'Electrometer Calibration Factor', '3.02', '3.02'], ['Electrometer Calibration Factor', 'Overall Calibration Factor [Gy/C]', '3.02', '3.02'],
  ['Daily output: Charge [nC]', 'Daily output: Dose [cGy]', '3.03', '3.03'],
  ['Isocenter Coincidence [X-ray vs. Proton Beam]: X offset [mm]', 'Isocenter Coincidence [X-ray vs. Proton Beam]: Y offset [mm]', '3.17', '3.17']]);
assert.deepEqual(imaging.slice(23, 26).map((c) => [c.expected, c.warn, c.fail, c.tol_mode, c.unit]), imaging.slice(13, 16).map((c) => [c.expected, c.warn, c.fail, c.tol_mode, c.unit]));
assert.ok(imaging.slice(23, 26).every((c) => !/Record the correction vector/.test(c.description)), 'its own direction is a step now');
// Its 3D is set up as the CBCT block's is: the same formula over its own axes, baseline 0, no limits.
const [cbct3d, kv3d] = [imaging[16], imaging[26]];
assert.deepEqual([cbct3d.name, kv3d.name], ['Mechanical-to-CBCT Correction Vector [cm]', 'Mechanical-to-kV/kV Correction Vector [cm]']);
const ruleOf = (c) => JSON.parse(decodeURIComponent(/\[derived: ([^\]]+)\]/.exec(c.description)[1]));
assert.equal(ruleOf(kv3d).formula, ruleOf(cbct3d).formula);
assert.deepEqual([kv3d.type, kv3d.unit, kv3d.expected, kv3d.warn, kv3d.fail, kv3d.tol_mode, kv3d.category], [cbct3d.type, cbct3d.unit, cbct3d.expected, cbct3d.warn, cbct3d.fail, cbct3d.tol_mode, cbct3d.category]);
assert.match(kv3d.description, /\[calc: 3d-offset\]/);
// The BB alignment check (2.05) has three steps above it, in Brook's order (2026-11-20).
assert.deepEqual(imaging.slice(27, 30).map((c) => c.name), ['Apply the correction vector.', 'Reacquire kV/kV.', 'Align to the central BB for Sphinx output measurements.']);
assert.equal(imaging[30].name, 'Acquire another kV/kV image to verify BB alignment at the isocenter. Manually realign if needed.');
assert.ok(pbs.every((c) => !/Record the correction vector only/.test(c.description || '')), 'the CBCT block\'s old direction is gone: step 5 says it');
assert.deepEqual(imaging.filter((c) => !isDirection(c)).slice(1, 9).map((c) => c.name), ['Mechanical-to-kV/kV Isocenter X [cm]', 'Mechanical-to-kV/kV Isocenter Y [cm]', 'Mechanical-to-kV/kV Isocenter Z [cm]', 'Mechanical-to-kV/kV Isocenter [cm]',
  'Mechanical-to-CBCT Correction Vector X [cm]', 'Mechanical-to-CBCT Correction Vector Y [cm]', 'Mechanical-to-CBCT Correction Vector Z [cm]', 'Mechanical-to-CBCT Correction Vector [cm]']);
// Each block's 3D names its axes as they are now, and the default limits table knows the kV/kV axes by both names.
for (const c of imaging.filter((x) => /\[derived: /.test(x.description))) {
  const inputs = JSON.parse(decodeURIComponent(/\[derived: ([^\]]+)\]/.exec(c.description)[1])).inputs;
  assert.deepEqual(inputs.map((i) => i.name), ['X', 'Y', 'Z'].map((axis) => c.name.replace(' [cm]', ` ${axis} [cm]`)));
  for (const i of inputs) assert.equal(pbs.filter((x) => x.name === i.name && (x.category || '') === i.category && x.type === 'numeric').length, 1, i.name);
}
assert.deepEqual(seed.pbs_imaging_defaults.map((r) => r.name), ['[Ortho - kV/kV] PPS 2 XRAY Offset X [cm]', '[Ortho - kV/kV] PPS 2 XRAY Offset Y [cm]', '[Ortho - kV/kV] PPS 2 XRAY Offset Z [cm]',
  'Mechanical-to-kV/kV Isocenter X [cm]', 'Mechanical-to-kV/kV Isocenter Y [cm]', 'Mechanical-to-kV/kV Isocenter Z [cm]']);
for (const r of seed.pbs_imaging_defaults) assert.deepEqual([r.unit, r.expected, r.warn, r.fail, r.tol_mode], ['cm', 0, 0.15, 0.2, 'absolute'], 'the limits themselves are as they were');
// The CBCT block's baselines and limits, as Brook gave them (2026-11-20): X −5, Y −1, Z +4.5 cm; Warning ±0.15, Action ±0.2.
assert.deepEqual(['X', 'Y', 'Z'].map((axis) => { const c = pbs.find((x) => x.name === `Mechanical-to-CBCT Correction Vector ${axis} [cm]`); return [c.expected, c.warn, c.fail, c.tol_mode, c.unit]; }),
  [[-5, 0.15, 0.2, 'absolute', 'cm'], [-1, 0.15, 0.2, 'absolute', 'cm'], [4.5, 0.15, 0.2, 'absolute', 'cm']]);
for (const d of samples) for (const [kind, TAG] of Object.entries(TAGS)) {
  const on = withDirectionMark(d, kind);
  assert.equal(directionKind({ type: 'text', description: on }), kind, d);
  assert.equal(on.split(TAG).length, 2, 'one tag');
  assert.equal(withDirectionMark(on, kind), on, 'setting it twice changes nothing');
  assert.equal(withDirectionMark(on, null), d, `removing it leaves the field as it was: ${JSON.stringify(d)}`);
  const other = kind === 'next' ? 'section' : 'next';
  assert.equal(withDirectionMark(on, other), withDirectionMark(d, other), 'one kind replaces the other');
  assert.equal(isDirection({ type: 'text', description: d }), false);
  for (const type of ['boolean', 'status', 'numeric', 'choice']) assert.equal(isDirection({ type, description: on }), false, 'only a Text item: a test of another type is still asked for');
  // The tag is never part of the words people read or edit, and an edit of those words keeps it.
  assert.equal(directionsParts(on).text, directionsParts(d).text);
  assert.equal(directionKind({ type: 'text', description: joinDirections(directionsParts(on), 'New words') }), kind);
  const shown = helpText(on);
  assert.ok(!shown || !shown.text.includes('direction:'), 'never shown as directions');
}
assert.equal(withDirectionMark('Do this.\nSource: SOP 12', 'next'), 'Do this. [direction: next]\nSource: SOP 12', 'a Source line stays last');
assert.equal(withDirectionMark('Do this.', true), 'Do this. [direction: section]');
assert.equal(isDirection(null), false);
assert.equal(isDirection({}), false);
assert.equal(directionKind({ type: 'text', description: '[direction: elsewhere]' }), null, 'only the two kinds');

// 2. The test form and the labels: a direction is saved as a Text item with its tag; any other type drops the tag.
assert.equal(TYPE_LABELS.direction, 'Direction: section');
assert.equal(TYPE_LABELS.direction_next, 'Direction: test below');
assert.deepEqual(J(testFormData({ name: 'Remove the range shifter.', type: 'direction', description: 'Template 1.11. [Section: Setup and Safety]' })),
  { name: 'Remove the range shifter.', type: 'text', description: `Template 1.11. [Section: Setup and Safety] ${TAGS.section}` });
assert.deepEqual(J(testFormData({ name: 'Insert the panels.', type: 'direction_next', description: `Template 2.03. ${TAGS.section}` })),
  { name: 'Insert the panels.', type: 'text', description: `Template 2.03. ${TAGS.next}` });
assert.deepEqual(J(testFormData({ name: 'A', type: 'boolean', description: `Template 1.11. ${TAGS.next}` })), { name: 'A', type: 'boolean', description: 'Template 1.11.' });
assert.deepEqual(J(testFormData({ name: 'A', type: 'numeric', description: 'Plain' })), { name: 'A', type: 'numeric', description: 'Plain' }, 'a test is saved as before');
assert.equal(typeLabel({ type: 'text', description: TAGS.section }), 'Direction: section');
assert.equal(typeLabel({ type: 'text', description: TAGS.next }), 'Direction: test below');
assert.equal(directionType({ type: 'text', description: TAGS.next }), 'direction_next');
assert.equal(directionType({ type: 'text', description: '' }), null);
assert.equal(typeLabel({ type: 'text', description: '' }), 'Text');
assert.equal(typeLabel({ type: 'boolean' }), 'Pass / fail');

// 3. Numbers: a direction of either kind has none; the tests around it count on, and a test under a direction joins the
// test above it.
const item = (test_id, name, type, description, category = 'Safety') => ({ test_id, name, type, description, category });
const list = [
  item(1, 'Performed By', 'text', 'Template 1.01. [Section: Setup and Safety]'),
  item(2, 'Connect the cable.', 'text', `Template 1.02. [Section: Setup and Safety] ${TAGS.section}`),
  item(3, 'Temperature', 'numeric', 'Template 1.03. [Section: Setup and Safety]'),
  item(4, 'Launch the software.', 'text', `Template 1.04. [Section: Setup and Safety] ${TAGS.next}`),
  item(5, 'Pressure', 'numeric', 'Template 1.05. [Section: Setup and Safety] [row: with above]'),
  item(6, 'Lasers', 'boolean', 'Template 2.01. [Section: Imaging]'),
  item(7, 'Retract the panel.', 'text', `Template 2.02. [Section: Imaging] ${TAGS.next}`),
];
const numbers = blockNumbers(list);
assert.deepEqual(J([...numbers]), [[1, '1.01'], [3, '1.02'], [5, '1.02'], [6, '2.01']]);
assert.deepEqual(J([...numbers.joined]), [5], 'the test under a direction joins the test above the direction');
const tests = list.filter((i) => !isDirection(i));
assert.deepEqual(J(sharedRows(tests, numbers).map((row) => row.map((i) => i.test_id))), [[1], [3, 5], [6]]);
assert.deepEqual(J([...blockNumbers(tests)]), J([...numbers]), 'the same numbers as the list without its directions');
assert.deepEqual(J([...blockNumbers(list.filter(isDirection))]), [], 'a list of directions only has no numbers');

// 4. The lists behind an ⓘ: directions in the list's order, each with its own Directions text when it has any.
assert.equal(directionsList([]), null);
assert.equal(directionsList(null), null);
assert.equal(sectionDirections([], 'Setup and Safety'), null);
const info = sectionDirections([list[1], { ...list[3], description: `${list[3].description}\nOn the MOSAIQ2 computer.` }], 'Setup and Safety');
assert.equal(info.props.class, 'qa-section-info');
assert.equal(typeof info.props.onclick, 'function', 'a click on it does not fold the section');
assert.equal(opened.at(-1).label, 'Directions: Setup and Safety');
assert.equal(opened.at(-1).content.tag, 'ol');
assert.deepEqual(opened.at(-1).content.kids.map((li) => li.text), ['Connect the cable.', 'Launch the software.On the MOSAIQ2 computer.']);
assert.equal(opened.at(-1).content.kids[1].kids[1].props.class, 'qa-step-more');
// A test's ⓘ and a group's ⓘ list the directions above it (item.steps), ahead of its own; a test with neither has no ⓘ.
assert.equal(testDetailsButton(list[2], list, numbers), null);
assert.equal(performDirections(list[2], 'Temperature'), null);
const steps = [list[3], list[6]];
assert.ok(testDetailsButton({ ...list[2], steps }, list, numbers));
assert.deepEqual(opened.at(-1).content.kids.map((k) => k.tag), ['strong', 'ol']);
assert.deepEqual(opened.at(-1).content.kids[1].kids.map((li) => li.text), ['Launch the software.', 'Retract the panel.']);
// What the test itself says is the last step of the same list: one list, no Directions box beside it.
assert.ok(testDetailsButton({ ...list[2], steps, description: `${list[2].description} Read the probe.` }, list, numbers));
assert.deepEqual(opened.at(-1).content.kids.map((k) => k.tag), ['strong', 'ol']);
assert.deepEqual(opened.at(-1).content.kids[1].kids.map((li) => li.text), ['Launch the software.', 'Retract the panel.', 'Read the probe.']);
assert.equal(opened.at(-1).content.kids[1].kids[2].props.class, 'qa-step-own');
assert.ok(performDirections({ ...list[2], steps }, 'Offset [cm]'));
assert.deepEqual(opened.at(-1).content.kids.map((k) => k.tag), ['strong', 'ol']);
assert.equal(opened.at(-1).content.kids[0].text, 'Offset [cm]');
assert.ok(performDirections({ ...list[2], steps, description: `${list[2].description} Record the vector only.` }, 'Offset [cm]'));
assert.deepEqual(opened.at(-1).content.kids.map((k) => k.tag), ['strong', 'ol']);
assert.deepEqual(opened.at(-1).content.kids[1].kids.map((li) => li.text), ['Launch the software.', 'Retract the panel.', 'Record the vector only.']);
// Without directions above it, a test's own Directions are shown as before.
assert.ok(performDirections({ ...list[2], description: `${list[2].description} Record the vector only.` }, 'Offset [cm]'));
assert.deepEqual(opened.at(-1).content.kids.map((k) => k.tag), ['strong', 'div']);
assert.equal(opened.at(-1).content.kids[1].props.class, 'directions pre');

// 5. The QA form: a direction for the test below waits for that test (item.steps); one for the section, or one with no
// test below it in its section, goes to the section's ⓘ; none is a row or part of the history request. In a group the
// title's ⓘ carries the steps and a row's own ⓘ does not repeat them. Setup QA saves one through the list's test updates.
const perform = between('async function renderPerform(', 'async function renderQueueEditor(');
assert.match(perform, /if \(kind === "next"\) \{ if \(!waiting\.has\(key\)\) waiting\.set\(key, \[\]\); waiting\.get\(key\)\.push\(item\); \}\n\s+else if \(kind\) \{ if \(!directionsOf\.has\(key\)\) directionsOf\.set\(key, \[\]\); directionsOf\.get\(key\)\.push\(item\); \}\n\s+else \{ item\.steps = waiting\.get\(key\)\?\.length \? waiting\.get\(key\) : null; waiting\.delete\(key\); byCategory\.get\(key\)\.push\(item\); \}/);
assert.match(perform, /for \(const \[key, left\] of waiting\) directionsOf\.set\(key, \[\.\.\.\(directionsOf\.get\(key\) \|\| \[\]\), \.\.\.left\]\);/);
assert.match(perform, /sectionDirections\(directionsOf\.get\(key\) \|\| \[\], categoryLabel\(category\)\), summary\), rows\);/);
assert.match(perform, /trends\?tests=\$\{t\.items\.filter\(\(i\) => !isDirection\(i\)\)\.map\(\(i\) => i\.test_id\)\.join\(","\)\}&last=60/);
assert.match(perform, /testDetailsButton\(axisRow \? \{ \.\.\.p\.it, steps: null \} : p\.it, t\.items, numbers\)/);
assert.match(perform, /testDetailsButton\(firstHeader === "Test" \? it : \{ \.\.\.it, steps: null \}, t\.items, numbers\)/);
assert.match(perform, /required: item\.type !== "text"/, 'a Text item is never required');
const editor = between('async function renderQueueEditor(', 'function testForm(');
assert.match(editor, /const kind=\{direction:'section',direction_next:'next'\}\[e\.target\.value\]; if\(isDirection\(t\)&&!kind\)editDefinition\('description',withDirectionMark\(t\.description,null\)\); if\(kind\)\{t\.type='text';t\.description=withDirectionMark\(QADerived\.encode\(t\.description,null\),kind\);testUpdates\.set\(t\.id,\{\.\.\.\(testUpdates\.get\(t\.id\)\|\|\{\}\),type:'text',description:t\.description,derived:null\}\);/);
assert.equal((source.match(/\.\.\.testFormData\(data\)/g) || []).length, 4, 'every test form saves through testFormData (a section\'s ＋ Test too)');

// 6. Both builds record nothing for a Text item without an answer, so a direction never reaches a run's results.
assert.match(fs.readFileSync('docs/local-backend.js', 'utf8'), /String\(value\)\.trim\(\) === ""\) \{ if \(item\.type !== "text"\) rows\.push\(/);
assert.match(fs.readFileSync('portal/service.py', 'utf8'), /if item\["type"\] != "text":\n\s+results\.append\(\(item, None, "recorded", _text\(raw, "comment"\)\)\)\n\s+continue/);

console.log('QA directions: the tag round trip for both kinds; a direction is a Text item with its tag; no number, and the tests around it number as without it; a section\'s list and a test\'s steps behind their ⓘ; the QA form and Setup QA route them; no build records one.');
