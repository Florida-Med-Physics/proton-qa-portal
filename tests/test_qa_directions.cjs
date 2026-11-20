// Synthetic checks of a list's directions ([direction: section] in an item's directions; Setup QA's Result Type
// "Direction"): the tag round trip leaves the rest of the field byte for byte and never shows as directions; the test
// form saves a Direction as a Text item with the tag; numbering (blockNumbers) gives a direction no number and counts on
// across it, so the tests around it number and join rows as if it were not there; the QA form keeps directions out of
// its rows and its history request and lists them behind the section's ⓘ. A Text item records nothing while it has no
// answer in either build, which is why a direction needs nothing from the code that saves and judges a run.
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
  QADerived: { read: () => null, encode: (d) => d } };
vm.createContext(context);
for (const part of [between('const TYPE_LABELS', '\n'), between('// Directions are shown with the test', 'function infoDisclosure('), between('const directionsText=', '\n'),
  between('function helpText(', 'function fitTextarea('), between('function sectionNumber(', 'function checkNumber('), between('const AXIS_NAME', '// Rotations of one thing')])
  vm.runInContext(part, context);
vm.runInContext('this.api = { isDirection, typeLabel, withDirectionMark, testFormData, sectionDirections, blockNumbers, sharedRows, directionsParts, joinDirections, helpText, TYPE_LABELS };', context);
const { isDirection, typeLabel, withDirectionMark, testFormData, sectionDirections, blockNumbers, sharedRows, directionsParts, joinDirections, helpText, TYPE_LABELS } = context.api;
const TAG = '[direction: section]';

// 1. The tag round trip (Setup QA's Result Type), for the kinds of directions the seed lists carry.
const seed = JSON.parse(fs.readFileSync('portal/seed.json', 'utf8'));
const samples = [...new Set(seed.templates.flatMap((t) => t.checks.map((c) => c.description || '')).filter((d) => !d.includes(TAG))), '', 'Plain directions', 'Line one\nline two', 'Source: only a source line'];
assert.ok(samples.length > 20);
for (const d of samples) {
  const on = withDirectionMark(d, true);
  assert.ok(isDirection({ type: 'text', description: on }), d);
  assert.equal(on.split(TAG).length, 2, 'one tag');
  assert.equal(withDirectionMark(on, true), on, 'adding it twice changes nothing');
  assert.equal(withDirectionMark(on, false), d, `removing it leaves the field as it was: ${JSON.stringify(d)}`);
  assert.equal(isDirection({ type: 'text', description: d }), false);
  for (const type of ['boolean', 'status', 'numeric', 'choice']) assert.equal(isDirection({ type, description: on }), false, 'only a Text item: a test of another type is still asked for');
  // The tag is never part of the words people read or edit, and an edit of those words keeps it.
  assert.equal(directionsParts(on).text, directionsParts(d).text);
  assert.ok(isDirection({ type: 'text', description: joinDirections(directionsParts(on), 'New words') }));
  const shown = helpText(on);
  assert.ok(!shown || !shown.text.includes('direction:'), 'never shown as directions');
}
assert.equal(withDirectionMark('Do this.\nSource: SOP 12', true), 'Do this. [direction: section]\nSource: SOP 12', 'a Source line stays last');
assert.equal(isDirection(null), false);
assert.equal(isDirection({}), false);

// 2. The test form and the labels: a Direction is saved as a Text item with the tag; any other type drops the tag.
assert.equal(TYPE_LABELS.direction, 'Direction');
assert.deepEqual(J(testFormData({ name: 'Remove the range shifter.', type: 'direction', description: 'Template 1.11. [Section: Setup and Safety]' })),
  { name: 'Remove the range shifter.', type: 'text', description: `Template 1.11. [Section: Setup and Safety] ${TAG}` });
assert.deepEqual(J(testFormData({ name: 'A', type: 'boolean', description: `Template 1.11. ${TAG}` })), { name: 'A', type: 'boolean', description: 'Template 1.11.' });
assert.deepEqual(J(testFormData({ name: 'A', type: 'numeric', description: 'Plain' })), { name: 'A', type: 'numeric', description: 'Plain' }, 'a test is saved as before');
assert.equal(typeLabel({ type: 'text', description: TAG }), 'Direction');
assert.equal(typeLabel({ type: 'text', description: '' }), 'Text');
assert.equal(typeLabel({ type: 'boolean' }), 'Pass / fail');

// 3. Numbers: a direction has none; the tests around it count on, and a test under a direction joins the test above it.
const item = (test_id, name, type, description, category = 'Safety') => ({ test_id, name, type, description, category });
const list = [
  item(1, 'Performed By', 'text', 'Template 1.01. [Section: Setup and Safety]'),
  item(2, 'Connect the cable.', 'text', `Template 1.02. [Section: Setup and Safety] ${TAG}`),
  item(3, 'Temperature', 'numeric', 'Template 1.03. [Section: Setup and Safety]'),
  item(4, 'Launch the software.', 'text', `Template 1.04. [Section: Setup and Safety] ${TAG}`),
  item(5, 'Pressure', 'numeric', 'Template 1.05. [Section: Setup and Safety] [row: with above]'),
  item(6, 'Lasers', 'boolean', 'Template 2.01. [Section: Imaging]'),
  item(7, 'Retract the panel.', 'text', `Template 2.02. [Section: Imaging] ${TAG}`),
];
const numbers = blockNumbers(list);
assert.deepEqual(J([...numbers]), [[1, '1.01'], [3, '1.02'], [5, '1.02'], [6, '2.01']]);
assert.deepEqual(J([...numbers.joined]), [5], 'the test under a direction joins the test above the direction');
const tests = list.filter((i) => !isDirection(i));
assert.deepEqual(J(sharedRows(tests, numbers).map((row) => row.map((i) => i.test_id))), [[1], [3, 5], [6]]);
assert.deepEqual(J([...blockNumbers(tests)]), J([...numbers]), 'the same numbers as the list without its directions');
assert.deepEqual(J([...blockNumbers(list.filter(isDirection))]), [], 'a list of directions only has no numbers');

// 4. The section's ⓘ: the directions in the list's order, each with its own Directions text when it has any; none, no ⓘ.
assert.equal(sectionDirections([], 'Setup and Safety'), null);
const info = sectionDirections([list[1], { ...list[3], description: `${list[3].description}\nOn the MOSAIQ2 computer.` }], 'Setup and Safety');
assert.equal(info.props.class, 'qa-section-info');
assert.equal(typeof info.props.onclick, 'function', 'a click on it does not fold the section');
assert.equal(opened.at(-1).label, 'Directions: Setup and Safety');
assert.equal(opened.at(-1).content.tag, 'ol');
assert.deepEqual(opened.at(-1).content.kids.map((li) => li.text), ['Connect the cable.', 'Launch the software.On the MOSAIQ2 computer.']);
assert.equal(opened.at(-1).content.kids[1].kids[1].props.class, 'qa-step-more');

// 5. The QA form: directions are kept out of its rows and its history request and handed to the section's ⓘ; Setup QA
// shows and saves one through the list's own test updates.
const perform = between('async function renderPerform(', 'async function renderQueueEditor(');
assert.match(perform, /if \(isDirection\(item\)\) \{ if \(!directionsOf\.has\(key\)\) directionsOf\.set\(key, \[\]\); directionsOf\.get\(key\)\.push\(item\); \}\n\s+else byCategory\.get\(key\)\.push\(item\);/);
assert.match(perform, /sectionDirections\(directionsOf\.get\(key\) \|\| \[\], categoryLabel\(category\)\), summary\), rows\);/);
assert.match(perform, /trends\?tests=\$\{t\.items\.filter\(\(i\) => !isDirection\(i\)\)\.map\(\(i\) => i\.test_id\)\.join\(","\)\}&last=60/);
assert.match(perform, /required: item\.type !== "text"/, 'a Text item is never required');
const editor = between('async function renderQueueEditor(', 'function testForm(');
assert.match(editor, /if\(e\.target\.value==='direction'\)\{t\.type='text';t\.description=withDirectionMark\(QADerived\.encode\(t\.description,null\),true\);testUpdates\.set\(t\.id,\{\.\.\.\(testUpdates\.get\(t\.id\)\|\|\{\}\),type:'text',description:t\.description,derived:null\}\);/);
assert.match(editor, /if\(isDirection\(t\)&&e\.target\.value!=='direction'\)editDefinition\('description',withDirectionMark\(t\.description,false\)\);/);
assert.equal((source.match(/\.\.\.testFormData\(data\)/g) || []).length, 3, 'every test form saves through testFormData');

// 6. Both builds record nothing for a Text item without an answer, so a direction never reaches a run's results.
assert.match(fs.readFileSync('docs/local-backend.js', 'utf8'), /String\(value\)\.trim\(\) === ""\) \{ if \(item\.type !== "text"\) rows\.push\(/);
assert.match(fs.readFileSync('portal/service.py', 'utf8'), /if item\["type"\] != "text":\n\s+results\.append\(\(item, None, "recorded", _text\(raw, "comment"\)\)\)\n\s+continue/);

console.log('QA directions: the tag round trip; a Direction is a Text item with the tag; no number, and the tests around it number as without it; the section ⓘ lists them in order; the QA form and Setup QA route them; no build records one.');
