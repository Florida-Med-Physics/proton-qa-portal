// Synthetic checks of two things the QA form and Setup QA share:
//  - what tests on one row ("Same row as the test above") are called together (joinedNames): the words their names start
//    with are the row's name, each test keeps the rest; an X / Y pair is a block like X / Y / Z;
//  - a test's Reference, the report its check comes from: a "Reference: …" line of its directions field, read and
//    written without touching the field's markers, shown behind the test's ⓘ and saved from Setup QA's test form.
// The seed's references are checked against where they come from: the department's own TG-224 notes, kept in the seed's
// "Daily QA template – Proton gantry (TG-224)". Nothing here is validated for clinical use.
// The real functions are taken from portal/static/app.js and run in node:vm with a small stand-in for the page.
// Run with node tests/test_qa_rows.cjs from the repository root.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('portal/static/app.js', 'utf8');
assert.equal(fs.readFileSync('docs/app.js', 'utf8'), source, 'docs/app.js is out of step: run python build_pages.py');
const between = (from, to) => { const a = source.indexOf(from), b = source.indexOf(to, a + 1); assert.ok(a >= 0 && b > a, `${from} … ${to}`); return source.slice(a, b); };
const J = (x) => JSON.parse(JSON.stringify(x));

function el(tag, props, ...kids) {
  const node = { tag, props: props || {}, kids: [] };
  for (const kid of kids.flat(Infinity)) if (kid !== null && kid !== undefined && kid !== false) node.kids.push(kid);
  Object.defineProperty(node, 'text', { get() { return this.kids.map((k) => (typeof k === 'object' ? k.text : String(k))).join(''); } });
  Object.defineProperty(node, 'textContent', { get() { return this.text; } });
  Object.defineProperty(node, 'lastChild', { get() { const k = this.kids.at(-1); return typeof k === 'object' ? k : { textContent: String(k) }; } });
  return node;
}
const opened = [];
const context = { el, infoPopup: (content, label) => { opened.push({ content, label }); return el('button', { 'aria-label': label }, 'ⓘ'); },
  QADerived: { read: (d) => (/\[derived: /.test(d || '') ? {} : null), encode: (d) => d }, derivedExplanation: () => null, qaStepLabel: () => null, qaDisplayName: (item) => item.name };
vm.createContext(context);
for (const part of [between('const TYPE_LABELS', '\n'), between('// Directions are shown with the test', 'function infoDisclosure('), between('function testDetailsButton(', 'function qaColgroup('),
  between("// A group's directions (an X / Y / Z or per-energy table)", 'function helpText('), between('function helpText(', 'function fitTextarea('),
  between('// What tests on one row are called together', '// A shared row is one cell over the Test')])
  vm.runInContext(part, context);
vm.runInContext('this.api = { joinedNames, unitNamed, referenceOf, withReference, referenceLine, testFormData, testDetailsButton, performDirections, directionsParts, joinDirections, withRowMark, withDirectionMark, helpText };', context);
const { joinedNames, unitNamed, referenceOf, withReference, testFormData, testDetailsButton, performDirections, directionsParts, joinDirections, withRowMark, withDirectionMark, helpText } = context.api;

// 1. Tests on one row: the words the names share, and what is left of each.
assert.deepEqual(J(joinedNames(['Daily output: Charge [nC]', 'Daily output: Dose [cGy]'])), { title: 'Daily output', labels: ['Charge [nC]', 'Dose [cGy]'], axes: null });
assert.deepEqual(J(joinedNames(['Chamber', 'Chamber Cal. Factor(Proton), Gy/C'])), { title: 'Chamber', labels: ['', 'Cal. Factor(Proton), Gy/C'], axes: null }, 'the name itself is the first test\'s');
assert.deepEqual(J(joinedNames(['Electrometer', 'Electrometer Calibration Factor'])), { title: 'Electrometer', labels: ['', 'Calibration Factor'], axes: null });
assert.deepEqual(J(joinedNames(['Position — console', 'Position — ruler', 'Position difference'])), { title: 'Position', labels: ['console', 'ruler', 'difference'], axes: null }, 'three tests; the dash is not part of a name');
// Named for the axes of one thing: an X / Y block under the words they share (what they end with alike is left out).
assert.deepEqual(J(joinedNames(['Isocenter Coincidence [X-ray vs. Proton Beam]: X offset [mm]', 'Isocenter Coincidence [X-ray vs. Proton Beam]: Y offset [mm]'])),
  { title: 'Isocenter Coincidence [X-ray vs. Proton Beam]', labels: ['X offset [mm]', 'Y offset [mm]'], axes: ['X', 'Y'] });
assert.deepEqual(J(joinedNames(['Couch X', 'Couch Y', 'Couch Z'])).axes, ['X', 'Y', 'Z']);
assert.equal(J(joinedNames(['Field size X1 [cm]', 'Field size X2 [cm]'])).axes, null, 'X1 and X2 are not axes');
// Nothing shared: each test keeps its whole name.
assert.equal(joinedNames(['TCS Sk', 'Decay-table Sk', 'Source strength difference']), null);
assert.equal(joinedNames(['Temperature', 'Pressure']), null);
assert.equal(joinedNames(['Only one']), null);
assert.equal(joinedNames(['', 'Something']), null);
assert.equal(joinedNames(['– X', '– Y']), null, 'a dash alone is not a name');
// A unit already in the name is not said again after it.
for (const [name, unit, said] of [['Charge [nC]', 'nC', true], ['Cal. Factor(Proton), Gy/C', 'Gy/C', true], ['Dose (cGy)', 'cGy', true], ['TCS Sk', 'mGy·m²·h⁻¹', false], ['Dose', 'cGy', false],
  ['Time', 's', false], ['mass', 'm', false], ['Ratio [%]', '%', true], ['Anything', '', false]])
  assert.equal(unitNamed(name, unit), said, `${name} / ${unit}`);

// 2. A Reference line: read without the field's markers, written as the last line, the rest of the field as it was.
const FIELD = 'Template 3.09. [Section: Sphinx Measurements] [calc: dose] [derived: %7B%22formula%22%3A%22A*B%22%7D] [row: with above]';
assert.equal(referenceOf(FIELD), '');
assert.equal(referenceOf(''), '');
assert.equal(referenceOf(null), '');
const withRef = withReference(FIELD, '  TG-224,   Dosimetry: output < 3 %  ');
assert.equal(withRef, `${FIELD}\nReference: TG-224, Dosimetry: output < 3 %`);
assert.equal(referenceOf(withRef), 'TG-224, Dosimetry: output < 3 %');
assert.equal(withReference(withRef, ''), FIELD, 'cleared: the field as it was');
assert.equal(withReference(withRef, 'MPPG 8.b'), `${FIELD}\nReference: MPPG 8.b`, 'replaced, never doubled');
assert.equal(withReference('', 'TG-142'), 'Reference: TG-142');
assert.equal(withReference('Do this.\nSource: SOP 12', 'TG-142'), 'Do this.\nSource: SOP 12\nReference: TG-142');
// A marker written after the line (a calculation saved later) is not part of the reference, and stays in the field.
const appended = `${withRef} [derived: %7B%22formula%22%3A%22A%2BB%22%7D]`;
assert.equal(referenceOf(appended), 'TG-224, Dosimetry: output < 3 %');
assert.equal(withReference(appended, 'TG-224'), `${FIELD} [derived: %7B%22formula%22%3A%22A%2BB%22%7D]\nReference: TG-224`);
// The directions' words leave the line out; editing them, or ticking a box, keeps it last.
assert.equal(helpText(withRef), null, 'markers and a reference only: no directions');
assert.equal(helpText('Template 1.01. Read the gauge.\nReference: TG-224').lastChild.textContent, 'Read the gauge.');
const parts = directionsParts('Template 1.01. [Section: Setup] Read the gauge.\nReference: TG-224');
assert.equal(parts.text, 'Read the gauge.');
assert.equal(joinDirections(parts, 'Read the gauge twice.'), 'Template 1.01. [Section: Setup] Read the gauge twice.\nReference: TG-224');
assert.equal(withRowMark('Read the gauge.\nReference: TG-224', true), 'Read the gauge. [row: with above]\nReference: TG-224');
assert.equal(withDirectionMark('Read the gauge.\nReference: TG-224', 'next'), 'Read the gauge. [direction: next]\nReference: TG-224');

// 3. Setup QA's test form: its Reference box is saved as the line; the Instructions box does not show it.
assert.deepEqual(J(testFormData({ name: 'Output', type: 'numeric', description: 'Template 3.09. Read it.', reference: 'TG-224, Dosimetry: output < 3 %' })),
  { name: 'Output', type: 'numeric', description: 'Template 3.09. Read it.\nReference: TG-224, Dosimetry: output < 3 %' });
assert.deepEqual(J(testFormData({ name: 'Output', type: 'numeric', description: 'Template 3.09. Read it.\nReference: old', reference: '' })).description, 'Template 3.09. Read it.\nReference: old',
  'a line typed into Instructions stays when the box is empty');
assert.deepEqual(J(testFormData({ name: 'Output', type: 'numeric', description: 'Template 3.09. Read it.\nReference: old', reference: 'new' })).description, 'Template 3.09. Read it.\nReference: new');
assert.deepEqual(J(testFormData({ name: 'Output', type: 'numeric', description: 'Template 3.09. Read it.' })), { name: 'Output', type: 'numeric', description: 'Template 3.09. Read it.' }, 'a form without the box: the field as typed');
assert.equal('reference' in testFormData({ name: 'x', type: 'numeric', description: '', reference: 'TG-224' }), false, 'not a field of its own in what is saved');
assert.deepEqual(J(testFormData({ name: 'Step', type: 'direction_next', description: 'Template 2.01.', reference: 'TG-224' })), { name: 'Step', type: 'text', description: 'Template 2.01. [direction: next]\nReference: TG-224' });
const form = between('function testForm(', 'async function renderTests(');
assert.match(form, /field\("Instructions", el\("textarea", \{ name: "description" \}, withReference\(t\.description, ""\)\), "wide"\)/);
assert.match(form, /field\("Reference", el\("input", \{ name: "reference", value: referenceOf\(t\.description\)/);

// 4. The QA form: the reference is the last thing behind a test's ⓘ; a test with nothing else still gets the ⓘ; a block
// (X / Y / Z, per energy) says each of its tests' references once.
const last = () => opened.at(-1).content.kids.at(-1);
assert.equal(testDetailsButton({ name: 'Plain', type: 'numeric', description: 'Template 1.01.' }, [], new Map()), null);
assert.ok(testDetailsButton({ name: 'Output', type: 'numeric', description: 'Template 1.01.\nReference: TG-224, Dosimetry: output < 3 %' }, [], new Map()), 'a reference alone opens a details box');
assert.deepEqual([last().props.class, last().text], ['qa-reference', 'ReferenceTG-224, Dosimetry: output < 3 %']);
testDetailsButton({ name: 'Output', type: 'numeric', description: 'Template 1.01. Read the gauge.\nReference: TG-142' }, [], new Map());
assert.deepEqual(opened.at(-1).content.kids.map((k) => k.props.class || k.tag), ['strong', 'directions pre', 'qa-reference'], 'the name, the directions, then the reference');
testDetailsButton({ name: 'Check', type: 'boolean', description: 'Template 1.01. Look.\nReference: TG-224', steps: [{ name: 'First do this.', description: '' }] }, [], new Map());
assert.deepEqual(opened.at(-1).content.kids.map((k) => k.props.class || k.tag), ['strong', 'qa-steps', 'qa-reference'], 'after the steps');
const axes = ['X', 'Y', 'Z'].map((a) => ({ name: `Offset ${a} [cm]`, type: 'numeric', description: 'Template 2.02.\nReference: TG-224, Mechanical: laser position accuracy 0.2 cm' }));
assert.ok(performDirections(axes[0], 'Offset [cm]', axes));
assert.equal(last().text, 'ReferenceTG-224, Mechanical: laser position accuracy 0.2 cm', 'said once for the block');
assert.ok(performDirections({ name: 'A', type: 'numeric', description: '' }, 'Block', [{ description: '\nReference: TG-224' }, { description: '\nReference: TG-142' }, { description: '' }]));
assert.equal(last().text, 'ReferenceTG-224; TG-142');
assert.equal(performDirections({ name: 'A', type: 'numeric', description: '' }, 'Block', [{ description: '' }]), null);

// 5. Where the seed's references come from. Only the PBS daily list carries any, and each is one of the department's
// own TG-224 notes in its TG-224 daily list (found here word for word), on the checks that list ties it to. Outside the
// Sphinx measurements the PBS daily list reads in cm, so those two say the same criteria in cm. To be checked against
// the report itself by the reviewing physicist: nothing here is recalled from it.
const seed = JSON.parse(fs.readFileSync('portal/seed.json', 'utf8'));
const checks = (name) => seed.templates.find((t) => t.name === name).checks;
const department = checks('Daily QA template – Proton gantry (TG-224)').map((c) => c.description || '').join('\n');
const FROM = {
  'TG-224, Mechanical: laser position accuracy 0.2 cm': ['*TG-224: Mechanical Laser Position accuracy: 2mm', /^Mechanical-to-kV\/kV Isocenter( [XYZ])? \[cm\]$/, 4],
  'TG-224, Mechanical: couch translational motion < 0.1 cm': ['**TG-224: Mechanical: Couch translational motion should be < 1mm', /^Mechanical-to-kV\/kV Correction Vector( [XYZ])? \[cm\]$/, 4],
  'TG-224, Imaging: X-ray and proton beam isocenter coincidence < 1 mm': ['- X-ray and proton beam isocenter coincidence < 1mm (Spot)', /^Isocenter Coincidence \[X-ray vs\. Proton Beam\]: [XY] offset \[mm\]$/, 2],
  'TG-224, Dosimetry: output < 3 % for different energies on different days with one consistent field': ['- Output < 3% for different energies on different days with one consistent field.  (Output)', /^Daily output: Dose \[cGy\]$/, 1],
  'TG-224, Dosimetry: distal depth 1 mm at the distal 90 % depth dose': ['- Distal Depth: 1mm at distal 90% depth dose. (Energy)', /^Energy \[[\d.]+ MeV\]: Distal Depth \[mm\]$/, 3],
  'TG-224, Dosimetry: spot position 2 mm / 1 mm absolute / relative': ['- Spot position: 2mm/1mm absolute/relative. (Spot)', /^Spot \d+ \[[\d.]+ MeV\] – Position [XY]$/, 12],
};
assert.ok(department.includes('Completing TG-224'));
for (const [, [note]] of Object.entries(FROM)) assert.ok(department.includes(note), `the department's note: ${note}`);
assert.deepEqual(seed.templates.filter((t) => t.checks.some((c) => referenceOf(c.description))).map((t) => t.name), ['PBS DailyQA Template - Sphinx']);
const referenced = checks('PBS DailyQA Template - Sphinx').filter((c) => referenceOf(c.description));
assert.equal(referenced.length, 26);
for (const c of referenced) {
  const from = FROM[referenceOf(c.description)];
  assert.ok(from, `a reference with no source: ${c.name}: ${referenceOf(c.description)}`);
  assert.match(c.name, from[1], `${referenceOf(c.description)} is not tied to ${c.name}`);
  assert.ok(c.description.endsWith(`\nReference: ${referenceOf(c.description)}`), `last in the field: ${c.name}`);
}
for (const [text, [, names, count]] of Object.entries(FROM)) assert.equal(referenced.filter((c) => referenceOf(c.description) === text && names.test(c.name)).length, count, text);

console.log('QA rows and references: what tests on one row are called together (shared words, X / Y pairs, nothing shared); a unit said once; a Reference line read, written and kept through edits; Setup QA\'s Reference box; behind a test\'s and a block\'s ⓘ; every seed reference is one of the department\'s TG-224 notes.');
