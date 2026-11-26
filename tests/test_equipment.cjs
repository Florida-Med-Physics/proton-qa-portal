// Setup QA's Equipment page works on the QA lists' own tests: a device-selection test ([device: chamber] or [device:
// electrometer], multiple choice) and the tests a device fills (a lookup with a value per device). Checked here on
// synthetic tests, without a page: what the page shows, what Save writes, and what connecting a list writes. The page
// itself is checked in tests/test_equipment_page.cjs. Run with node tests/test_equipment.cjs from the repository root.
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const source = fs.readFileSync('portal/static/app.js', 'utf8');
const between = (from, to) => { const a = source.indexOf(from), b = source.indexOf(to, a); assert(a >= 0 && b > a, `${from} … ${to}`); return source.slice(a, b); };
const context = { window: {} }; vm.createContext(context);
vm.runInContext(fs.readFileSync('portal/static/derived.js', 'utf8'), context);
vm.runInContext('var QADerived = window.QADerived;', context);
vm.runInContext(between('function choiceOptions(', 'function defaultDerivedRule('), context);
vm.runInContext(between('const DEVICE_KINDS =', 'async function renderEquipment()'), context);
vm.runInContext('this.api = { equipmentModel, equipmentSaves, equipmentConnection, deviceKindOf, QADerived };', context);
const { equipmentModel, equipmentSaves, equipmentConnection, deviceKindOf, QADerived } = context.api;
const plain = (x) => JSON.parse(JSON.stringify(x));

const choicesTag = (list) => `[choices: ${encodeURIComponent(JSON.stringify(list))}]`;
const lookup = (name, category, values, extra = {}) => QADerived.encode('', { kind: 'lookup', inputs: [{ name, category }], values });
let id = 0;
const test = (owner, name, category, type, description, more = {}) => ({ id: ++id, owner_queue_id: owner, name, category, type, unit: more.unit || '', description, expected: null, warn: null, fail: null, tol_mode: 'absolute', active: 1, ...more });
const A = 'SYNTHETIC chamber A', B = 'SYNTHETIC chamber B';
const tests = [
  test(6, 'Chamber', 'Device Selection', 'choice', `Template 3.03. [Section: Sphinx] [device: chamber] ${choicesTag([A, B])}`),
  test(6, 'Chamber Cal. Factor', 'Device Selection', 'numeric', `Template 3.04.${lookup('Chamber', 'Device Selection', [{ choice: A, value: 11 }, { choice: B, value: 22 }])} [row: with above]`, { unit: 'Gy/C', warn: 1, fail: 2, expected: 10 }),
  test(6, 'Electrometer', 'Device Selection', 'choice', `[device: electrometer] ${choicesTag(['SYNTHETIC electrometer'])}`),
  test(6, 'Electrometer Factor', 'Device Selection', 'numeric', lookup('Electrometer', 'Device Selection', [{ choice: 'SYNTHETIC electrometer', value: 1.001 }])),
  test(8, 'Chamber (model / serial)', 'Conditions', 'choice', `[device: chamber] ${choicesTag([A])}`),                       // another list, one device fewer
  test(8, 'N_Dw [cGy/nC]', 'Conditions', 'numeric', lookup('Chamber (model / serial)', 'Conditions', [{ choice: A, value: 5 }])),
  test(8, 'Dose', 'Output', 'numeric', QADerived.encode('', { inputs: [{ name: 'N_Dw [cGy/nC]', category: 'Conditions' }], formula: 'A*2' })),   // a calculation, not a lookup
  test(6, 'Shift', 'Other', 'choice', choicesTag(['Day', 'Night'])),                                                         // a choice that is no device
  test(6, 'Shift factor', 'Other', 'numeric', lookup('Shift', 'Other', [{ choice: 'Day', value: 1 }, { choice: 'Night', value: 2 }])),
];
assert.equal(deviceKindOf(tests[0]), 'chamber'); assert.equal(deviceKindOf(tests[2]), 'electrometer'); assert.equal(deviceKindOf(tests[7]), null);

// What the page shows: a table per kind; every device any list offers; a column per test a device fills, a list's together.
const [chambers, electrometers] = equipmentModel(tests);
assert.deepEqual([chambers.kind, chambers.one, chambers.many], ['chamber', 'Chamber', 'Chambers']);
assert.deepEqual(plain(chambers.selections.map((t) => t.name)), ['Chamber', 'Chamber (model / serial)']);
assert.deepEqual(plain(chambers.factors.map((f) => f.test.name)), ['Chamber Cal. Factor', 'N_Dw [cGy/nC]'], 'lookups from a chamber only: no calculation, no other choice');
assert.deepEqual(plain(chambers.devices), [{ name: A, values: { 2: 11, 6: 5 } }, { name: B, values: { 2: 22, 6: null } }], 'a list that lacks a device has no value for it');
assert.deepEqual(plain(electrometers.devices), [{ name: 'SYNTHETIC electrometer', values: { 4: 1.001 } }]);
assert.equal(equipmentModel([]).every((g) => !g.selections.length && !g.devices.length), true);

// Save writes only what changes, each test with everything else as it was.
const copy = (group) => group.devices.map((d) => ({ name: d.name, values: { ...d.values } }));
assert.deepEqual(plain(equipmentSaves(electrometers, copy(electrometers))), [], 'nothing changed, nothing written');
// (Opening the page already finds the monthly list one chamber short: saving brings it level, with no value made up.)
const level = plain(equipmentSaves(chambers, copy(chambers)));
assert.deepEqual(level.map((s) => [s.id, s.body.type]), [[5, 'choice'], [6, 'derived']]);
assert.deepEqual(level[0].body.choices, [A, B]);
assert.deepEqual(level[1].body.derived.values, [{ choice: A, value: 5 }, { choice: B, value: null }]);
// A value typed, a device renamed and one added: every list of the kind follows.
const edited = copy(chambers);
edited[0].values[6] = 5.5; edited[1].name = 'SYNTHETIC chamber B2'; edited.push({ name: ' SYNTHETIC chamber C ', values: { 2: 33 } });
const saves = plain(equipmentSaves(chambers, edited));
assert.deepEqual(saves.map((s) => s.id), [1, 5, 2, 6]);
for (const s of saves.slice(0, 2)) assert.deepEqual(s.body.choices, [A, 'SYNTHETIC chamber B2', 'SYNTHETIC chamber C'], 'names are trimmed');
assert.deepEqual(saves[2].body.derived, { kind: 'lookup', inputs: [{ name: 'Chamber', category: 'Device Selection' }],
  values: [{ choice: A, value: 11 }, { choice: 'SYNTHETIC chamber B2', value: 22 }, { choice: 'SYNTHETIC chamber C', value: 33 }] });
assert.deepEqual(saves[3].body.derived.values, [{ choice: A, value: 5.5 }, { choice: 'SYNTHETIC chamber B2', value: null }, { choice: 'SYNTHETIC chamber C', value: null }]);
// A test keeps its name, category, unit, limits, baseline and the rest of its field; the back end rewrites only the tag.
assert.deepEqual([saves[2].body.name, saves[2].body.category, saves[2].body.unit, saves[2].body.expected, saves[2].body.warn, saves[2].body.fail, saves[2].body.tol_mode, saves[2].body.active, saves[2].body.owner_queue_id],
  ['Chamber Cal. Factor', 'Device Selection', 'Gy/C', 10, 1, 2, 'absolute', 1, 6]);
assert.equal(saves[2].body.description, tests[1].description);
assert.match(QADerived.encode(saves[2].body.description, saves[2].body.derived), /^Template 3\.04\. \[row: with above\] \[derived: /, 'its number and its row mark stay');
// Removing a device removes it everywhere.
assert.deepEqual(plain(equipmentSaves(chambers, copy(chambers).slice(0, 1))).map((s) => [s.id, s.body.choices || s.body.derived.values.map((v) => v.choice)]), [[1, [A]], [2, [A]]]);
// Refused: no name, a name twice, something that is not a number.
for (const [bad, why] of [[[{ name: ' ', values: {} }], 'Give every device a name.'], [[{ name: A, values: {} }, { name: ` ${A} `, values: {} }], 'Two devices have the same name.'],
  [[{ name: 'x'.repeat(201), values: {} }], 'A device name can be up to 200 characters.'], [[{ name: A, values: { 2: 'abc' } }], 'Chamber Cal. Factor: give a number, or leave it blank.']])
  assert.throws(() => equipmentSaves(chambers, bad), { message: why });

// Connecting a list: its naming test becomes the selection with the kind's devices; the ticked tests get a blank lookup.
const names = test(9, 'Chamber used', 'Setup', 'text', 'Template 1.02. [Section: Setup] Write the chamber.'), nd = test(9, 'N_Dw', 'Setup', 'numeric', 'Template 1.03. From the certificate.', { unit: 'cGy/nC', expected: 5, warn: 0.1 });
const connect = plain(equipmentConnection(chambers, names, [nd]));
assert.deepEqual(connect.map((s) => [s.id, s.body.type]), [[names.id, 'choice'], [nd.id, 'derived']]);
assert.equal(connect[0].body.description, 'Template 1.02. [Section: Setup] Write the chamber. [device: chamber]');
assert.deepEqual(connect[0].body.choices, [A, B]);
assert.deepEqual(connect[1].body.derived, { kind: 'lookup', inputs: [{ name: 'Chamber used', category: 'Setup' }], values: [{ choice: A, value: null }, { choice: B, value: null }] }, 'no value is made up');
assert.deepEqual([connect[1].body.unit, connect[1].body.expected, connect[1].body.warn], ['cGy/nC', 5, 0.1]);
assert.doesNotThrow(() => QADerived.validate(connect[1].body.derived));
assert.equal(plain(equipmentConnection(equipmentModel([])[0], names, []))[0].body.choices.length, 0, 'a first list can be connected before any device exists');
console.log('Equipment model: a table per kind from the lists\' own tests; Save writes only what changes and keeps the rest of each test; a device is added, renamed and removed for every list; connecting a list makes no value up.');
