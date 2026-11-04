// Synthetic checks of "Same row as the test above" ([row: with above] in a test's directions): Setup QA's box adds and
// removes the tag and leaves the rest of the field byte for byte; the tag never shows as directions; numbering
// (blockNumbers) gives a joined test the number of the test above it and the next row the next number, and ignores the
// tag on the first test of a list or section, across categories and after an X/Y/Z block; the PDF report numbers alike;
// a list without the tag numbers and prints as before; the shared cell names each input with its unit.
// The QA form and a saved run are checked in a browser by tests/test_shared_rows_page.cjs.
// Run with node tests/test_shared_rows.cjs from the repository root.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('portal/static/app.js', 'utf8');
const between = (from, to) => { const a = source.indexOf(from), b = source.indexOf(to, a + 1); assert.ok(a >= 0 && b > a, `${from} … ${to}`); return source.slice(a, b); };

// A small stand-in for the page's el(): enough to read tags, attributes and text.
function el(tag, props, ...kids) {
  const node = { tag, props: props || {}, kids: [] };
  for (const kid of kids.flat(Infinity)) if (kid !== null && kid !== undefined && kid !== false) node.kids.push(kid);
  Object.defineProperty(node, 'text', { get() { return this.kids.map((k) => (typeof k === 'object' ? k.text : String(k))).join(''); } });
  return node;
}
const context = { el, Blob, QADerived: { read: () => null } };
vm.createContext(context);
for (const part of [between('const REVIEW_LABEL', 'function reviewChip('), between('function capitalize(', 'function decimalsOf('),
  between('// Directions are shown with the test', 'function infoDisclosure('), between('function helpText(', 'function fitTextarea('),
  between('function sectionNumber(', 'function checkNumber('), between('const AXIS_NAME', '// Rotations of one thing'),
  between('function qaReportPdf(', 'function downloadWorkbookBlob(')])
  vm.runInContext(part, context);
const { withRowMark, helpText, directionsParts, joinDirections, blockNumbers, sharedRows, sharedCell, qaReportPdf } = context;
const TAG = '[row: with above]';
const J = (x) => JSON.parse(JSON.stringify(x));   // answers from node:vm, compared as plain values

// 1. The tag round trip in Setup QA (the box), for the kinds of directions the seed lists carry.
const seed = JSON.parse(fs.readFileSync('portal/seed.json', 'utf8'));
const hdr = seed.templates.find((t) => t.name === 'Daily QA – HDR Flexitron').checks;
assert.ok(!JSON.stringify(seed).includes('[row:'), 'the seed lists carry no row tag');
const samples = [...new Set(hdr.map((c) => c.description)), '', 'Plain directions', 'Line one\nline two', 'Source: only a source line', '  spaced  '];
for (const d of samples) {
  const on = withRowMark(d, true);
  assert.equal(on.split(TAG).length, 2, `one tag: ${JSON.stringify(d)}`);
  assert.equal(withRowMark(on, true), on, 'ticking twice adds nothing');
  assert.equal(withRowMark(on, false), d, `unticking gives the field back byte for byte: ${JSON.stringify(d)}`);
  assert.equal(withRowMark(d, false), d, 'unticking an untagged field changes nothing');
  // Hidden wherever directions are shown or edited, and kept when the directions are edited.
  assert.equal(helpText(on)?.text ?? null, helpText(d)?.text ?? null);
  assert.equal(helpText(on, { inline: true })?.text ?? null, helpText(d, { inline: true })?.text ?? null);
  assert.equal(directionsParts(on).text, directionsParts(d).text);
  assert.ok(J(directionsParts(on).tags).includes(TAG));
  assert.ok(joinDirections(directionsParts(on), 'Edited directions').includes(TAG));
  assert.equal(withRowMark(joinDirections(directionsParts(on), 'Edited directions'), false).includes(TAG), false);
}
// The tag goes before the Source lines, which the directions drop whole.
assert.equal(withRowMark('Template 1.06. [Section: HDR treatment-day QA] \nSource: 10-20-2026.pdf, check 6.', true),
  'Template 1.06. [Section: HDR treatment-day QA]  [row: with above]\nSource: 10-20-2026.pdf, check 6.');

// 2. Numbering: the HDR list as seeded, then with the three sets joined (rows 1.09, 1.10, 1.13, 1.14, 1.23, 1.24).
const items = hdr.map((c, i) => ({ ...c, test_id: i + 1 }));
const plain = blockNumbers(items);
assert.deepEqual([...plain.values()], items.map((_, i) => `1.${String(i + 1).padStart(2, '0')}`), 'without the tag: 1.01 … 1.26');
const joinNames = ['Source air kerma strength — decay table Sk', 'Source air kerma strength — difference', 'Position verification — ruler reading',
  'Position verification — console minus ruler', 'Dwell time — measured time', 'Dwell time — difference'];
assert.deepEqual(joinNames.map((n) => plain.get(items.find((i) => i.name === n).test_id)), ['1.09', '1.10', '1.13', '1.14', '1.23', '1.24']);
const joined = items.map((i) => (joinNames.includes(i.name) ? { ...i, description: withRowMark(i.description, true) } : i));
const numbers = blockNumbers(joined);
const byName = (n) => numbers.get(joined.find((i) => i.name === n).test_id);
assert.deepEqual(['Source air kerma strength — TCS Sk', 'Source air kerma strength — decay table Sk', 'Source air kerma strength — difference'].map(byName), ['1.08', '1.08', '1.08']);
assert.equal(byName('Position verification'), '1.09');                    // the old 1.11 takes the next number
assert.deepEqual(['Position verification — console distance', 'Position verification — ruler reading', 'Position verification — console minus ruler'].map(byName), ['1.10', '1.10', '1.10']);
assert.equal(byName('Emergency stop test'), '1.11');
assert.deepEqual(['Dwell time — set time', 'Dwell time — measured time', 'Dwell time — difference'].map(byName), ['1.18', '1.18', '1.18']);
assert.equal(byName('Position indicator light test'), '1.20');
const rows = sharedRows(joined, numbers);
assert.equal(rows.length, 20);
assert.deepEqual(J(rows.filter((r) => r.length > 1).map((r) => r.map((t) => t.name.split(' — ')[1]))),
  [['TCS Sk', 'decay table Sk', 'difference'], ['console distance', 'ruler reading', 'console minus ruler'], ['set time', 'measured time', 'difference']]);
assert.deepEqual(J(rows.map((r) => numbers.get(r[0].test_id))), Array.from({ length: 20 }, (_, i) => `1.${String(i + 1).padStart(2, '0')}`), 'one number per row, in order');

// Where the tag is ignored: the first test of the list, the first of a section (numbered or named), the test after a
// different category, and after an X/Y/Z block (each keeps its own number); a measurement family keeps its number.
const t = (id, name, extra = {}) => ({ test_id: id, name, type: 'numeric', unit: 'mm', category: 'Mechanical', description: '', ...extra });
const tagged = (x) => ({ ...x, description: withRowMark(x.description, true) });
const edge = [tagged(t(1, 'First test')), t(2, 'Second'), tagged(t(3, 'Third')),
  tagged(t(4, 'Other category', { category: 'Imaging' })), tagged(t(5, 'Same category again', { category: 'Imaging' })),
  t(6, 'Couch X'), t(7, 'Couch Y'), t(8, 'Couch Z'), tagged(t(9, 'After the axes')),
  tagged(t(10, 'Next section', { description: 'Template 3.01.' })), tagged(t(11, 'In section 3', { description: 'Template 3.02.' })),
  t(12, 'Named A', { description: '[Section: Morning]', category: 'X' }), tagged(t(13, 'Named B', { description: '[Section: Evening]', category: 'X' }))];
const en = blockNumbers(edge);
assert.deepEqual(edge.map((x) => en.get(x.test_id)), ['2.01', '2.02', '2.02', '2.03', '2.03', '2.04', '2.04', '2.04', '2.05', '3.01', '3.01', '4.01', '4.02']);
assert.deepEqual(J(sharedRows(edge, en).map((r) => r.map((x) => x.test_id))),
  [[1], [2, 3], [4, 5], [6], [7], [8], [9], [10, 11], [12], [13]], 'X/Y/Z rows stay one per axis');
const family = [t(1, 'Energy [100 MeV] – Distal Depth'), tagged(t(2, 'Energy [150 MeV] – Distal Depth')), tagged(t(3, 'Plain after'))];
assert.deepEqual([...blockNumbers(family).values()], ['2.01', '2.01', '2.02']);
assert.deepEqual(J(sharedRows(family, blockNumbers(family)).map((r) => r.length)), [1, 1, 1]);

// 3. The PDF report numbers a shared row's tests alike; without the tag it is 1, 2, 3, … as before.
const titles = async (results) => [...(await qaReportPdf({ id: 9, queue_name: 'Synthetic HDR', machine_name: 'Synthetic', qa_date: '2026-11-04', overall: 'pass', review_status: 'pending', results }).text())
  .matchAll(/\((\d+)\. ([^)]*)\) Tj/g)].map((m) => `${m[1]}. ${m[2]}`);
const asResults = (list) => list.map((i) => ({ ...i, value_num: i.type === 'numeric' ? 1 : null, value_text: null, status: 'recorded' }));
(async () => {
  const before = await titles(asResults(items));
  assert.deepEqual(before.map((x) => Number(x.split('.')[0])), items.map((_, i) => i + 1));
  const after = await titles(asResults(joined));
  assert.deepEqual(after.slice(7, 11), ['8. Source air kerma strength - TCS Sk', '8. Source air kerma strength - decay table Sk', '8. Source air kerma strength - difference', '9. Position verification']);
  assert.equal(after.at(-1), '20. Position indicator light test');

  // 4. The shared cell: one cell over Test, Measured and Unit; each input named with its unit, in list order.
  const cell = sharedCell([[{ test_id: 1 }, 'TCS Sk', 'mGy·m²·h⁻¹', el('input')], [{ test_id: 2 }, 'Decay-table Sk', 'mGy·m²·h⁻¹', el('input')], [{ test_id: 3 }, 'Source strength difference', '%', el('input')]],
    (x) => (x.test_id === 3 ? el('button', {}, 'ⓘ') : null), el('span', { class: 'qa-limits' }, 'ACTION ±1 %'));
  assert.equal(cell.tag, 'td'); assert.equal(cell.props.colspan, 3); assert.equal(cell.props.class, 'qa-measured qa-shared-cell');
  const [shared] = cell.kids, fields = shared.kids.filter((k) => k.props.class === 'qa-shared-field');
  assert.deepEqual(fields.map((f) => [f.props['data-test-id'], f.kids[0].text, f.kids[1].tag]),
    [[1, 'TCS Sk (mGy·m²·h⁻¹)', 'input'], [2, 'Decay-table Sk (mGy·m²·h⁻¹)', 'input'], [3, 'Source strength difference (%)', 'input']]);
  assert.equal(shared.kids.at(-1).text, 'ⓘACTION ±1 %');
  assert.ok(!/null|undefined|\[object/.test(cell.text));
  console.log('Row tag: round trip, hidden in directions; numbering with joined rows and edge cases; PDF numbers; shared cell labels.');
})().catch((e) => { console.error(e); process.exit(1); });
