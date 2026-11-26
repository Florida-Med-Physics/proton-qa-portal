// A list's own repeated measurements are one table on the QA form (Brook, 2026-11-25: "Compress", "Make it tabular"):
// names like "<what> – <energy> MeV[ – <which>] [unit]" and "<what> — G<angle> [unit]" (the proton monthly list's range,
// output, spot QA and XRV rows). The parser is checked here on its own; tests/test_monthly_tables_page.cjs checks the
// page. Run with node tests/test_list_tables.cjs from the repository root.
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const source = fs.readFileSync('portal/static/app.js', 'utf8');
const between = (from, to) => { const a = source.indexOf(from), b = source.indexOf(to, a); assert(a >= 0 && b > a, `${from} … ${to}`); return source.slice(a, b); };
const context = {}; vm.createContext(context);
vm.runInContext(between('const MEASURE_RULES', '// A value the Sphinx export reports once'), context);
vm.runInContext('this.api = { measureParts, listMeasureParts, tableParts, tableKey };', context);
const { measureParts, listMeasureParts, tableParts, tableKey } = context.api;
const plain = (x) => JSON.parse(JSON.stringify(x));

// Range: a row per energy, one value.
assert.deepEqual(plain(listMeasureParts('Range R90 (Zebra) – 70 MeV [mm]')), { block: 'Range R90 (Zebra)', column: '', unitTag: '[mm]', rowHeader: 'Energy', rowLabel: '70 MeV', sortKey: 70 });
assert.equal(tableParts('Range R90 (Zebra) – 225 MeV [mm]').metricLabel, 'Range R90 (Zebra) [mm]');
// Output and spot QA: the gantry angle after the name belongs to the row, so both angles share one table; what follows
// the energy is the column.
assert.deepEqual(plain(listMeasureParts('Output G0 – 70 MeV – charge [nC]')), { block: 'Output', column: 'charge', unitTag: '[nC]', rowHeader: 'Energy', rowLabel: 'G0 · 70 MeV', sortKey: 70 });
assert.deepEqual(plain(listMeasureParts('Output G90 – 225 MeV – dose [cGy]')), { block: 'Output', column: 'dose', unitTag: '[cGy]', rowHeader: 'Energy', rowLabel: 'G90 · 225 MeV', sortKey: 900225 });
assert.deepEqual(plain(listMeasureParts('Spot QA G0 – 100 MeV – σx [%]')), { block: 'Spot QA', column: 'σx', unitTag: '[%]', rowHeader: 'Energy', rowLabel: 'G0 · 100 MeV', sortKey: 100 });
assert.deepEqual(plain(listMeasureParts('Spot QA G90 – 160 MeV – skewness')), { block: 'Spot QA', column: 'skewness', unitTag: '', rowHeader: 'Energy', rowLabel: 'G90 · 160 MeV', sortKey: 900160 });
// XRV: a row per gantry angle.
assert.deepEqual(plain(listMeasureParts('XRV ISO difference — G000 [mm]')), { block: 'XRV ISO difference', column: '', unitTag: '[mm]', rowLabel: 'G000', rowHeader: 'Gantry', sortKey: 0 });
assert.equal(listMeasureParts('XRV ISO difference — G180 [mm]').sortKey, 180);
// Rows sort by angle, then energy.
const order = ['Output G90 – 70 MeV – charge [nC]', 'Output G0 – 225 MeV – charge [nC]', 'Output G0 – 70 MeV – charge [nC]'].map((n) => listMeasureParts(n)).sort((a, b) => a.sortKey - b.sortKey).map((p) => p.rowLabel);
assert.deepEqual(order, ['G0 · 70 MeV', 'G0 · 225 MeV', 'G90 · 70 MeV']);

// One table per block: every value of its rows, whatever its unit. A Sphinx-style measurement is per metric and unit, as before.
const key = (name, unit) => tableKey({ unit }, tableParts(name));
assert.equal(key('Output G0 – 70 MeV – charge [nC]', 'nC'), key('Output G90 – 180 MeV – dose [cGy]', 'cGy'));
assert.notEqual(key('Output G0 – 70 MeV – charge [nC]', 'nC'), key('Range R90 (Zebra) – 70 MeV [mm]', 'mm'));
assert.equal(key('Energy [100.00 MeV]: Distal Depth [mm]', 'mm'), 'distal|mm');
assert.equal(tableParts('Energy [100.00 MeV]: Distal Depth [mm]').block, undefined);
assert.deepEqual(plain(tableParts('Spot 1 [226.4 MeV] – Position X')), plain(measureParts('Spot 1 [226.4 MeV] – Position X')));

// Not a table: a single value, a name without an energy or angle, other dashes and letters.
for (const name of ['XRV — max over all angles [mm]', 'Couch rotational accuracy — T090 [deg]', 'Snout extension accuracy [mm]', 'Couch angle 0° – BB walkout X [mm]',
  'Temp. & Press. Correction kTP', 'Daily output: Charge [nC]', 'HU constancy — water insert [HU]', '', null, undefined])
  assert.equal(listMeasureParts(name), null, String(name));

// The Sphinx parser is untouched, and it alone says what an export fills: a typed monthly value must never become a
// read-only "measured by Sphinx" field.
for (const name of ['Range R90 (Zebra) – 70 MeV [mm]', 'Output G0 – 70 MeV – charge [nC]', 'Spot QA G0 – 100 MeV – σx [%]', 'Spot QA G0 – 100 MeV – skewness', 'XRV ISO difference — G000 [mm]'])
  assert.equal(measureParts(name), null, name);
assert.match(source, /const sphinxList = t\.items\.some\(\(i\) => i\.type === "numeric" && measureParts\(i\.name\)\);/);
assert.match(source, /const fromFile = !!measureParts\(item\.name\) \|\|/);
assert.doesNotMatch(between('const sphinxList =', 'const numbers = blockNumbers'), /tableParts/);

// Only the proton monthly list has such names among the built-in lists, so no other list's form changes.
const seed = JSON.parse(fs.readFileSync('portal/seed.json', 'utf8'));
const withTables = seed.templates.filter((t) => t.checks.some((c) => c.type === 'numeric' && !measureParts(c.name) && listMeasureParts(c.name))).map((t) => t.name);
assert.deepEqual(withTables, ['Monthly QA template – Proton gantry (TG-224)']);
const monthly = seed.templates.find((t) => t.name === withTables[0]).checks.filter((c) => c.type === 'numeric' && listMeasureParts(c.name));
const blocks = {};
for (const c of monthly) { const p = listMeasureParts(c.name); (blocks[p.block] = blocks[p.block] || { rows: new Set(), columns: new Set() }).rows.add(p.rowLabel); blocks[p.block].columns.add(p.column); }
assert.deepEqual(Object.fromEntries(Object.entries(blocks).map(([name, b]) => [name, [b.rows.size, [...b.columns]]])), {
  'XRV ISO difference': [4, ['']], Output: [8, ['charge', 'dose']], 'Range R90 (Zebra)': [17, ['']], 'Spot QA': [6, ['position deviation', 'σx', 'σy', 'skewness']] });
console.log('A list\'s own repeated measurements parse into tables: range and XRV a value per row, output and spot QA a column per value, both gantry angles in one table; Sphinx fields untouched.');
