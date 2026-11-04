// Synthetic checks of the Machine Trends display: two-decimal formatter, the summary table under each chart, shared
// limit bands, and which groups lead each QA list as key checks. Run with node tests/test_trend_summary.cjs from the repo root.
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const source = fs.readFileSync('portal/static/app.js', 'utf8');
const between = (from, to) => { const a = source.indexOf(from), b = source.indexOf(to, a); assert(a >= 0 && b > a, `${from} … ${to}`); return source.slice(a, b); };
const context = {}; vm.createContext(context);
for (const [from, to] of [['function fmt(', 'function today('], ['const MEASURE_RULES', 'function blockNumbers('],
  ['const AXIS_NAME =', '// Deviation from expected'], ['function asDeviation(', 'const latest ='], ['function seriesStats(', '// One chart for one or more series'],
  ['function trendSummary(', 'function trendSummaryTable('], ['function trendSharedLimits(', '// Machine Trends passes'],
  ['function trendDisplayName(', 'function trendGroupChart(']])
  vm.runInContext(between(from, to), context);
const plain = (x) => JSON.parse(JSON.stringify(x));             // values from the vm realm, compared by value

// Two decimal places, a true minus sign, no "−0.00", and "—" for a missing value. fmt itself is unchanged.
const { fmt2, fmt } = context;
assert.equal(fmt2(77.6783), '77.68'); assert.equal(fmt2(0.1404), '0.14'); assert.equal(fmt2(100), '100.00'); assert.equal(fmt2('158.5'), '158.50');
assert.equal(fmt2(-0.37), '−0.37'); assert.equal(fmt2(-0.001), '0.00'); assert.equal(fmt2(-0.001, true), '0.00');
assert.equal(fmt2(0.31, true), '+0.31'); assert.equal(fmt2(-0.31, true), '−0.31'); assert.equal(fmt2(0, true), '0.00');
for (const missing of [null, undefined, '', 'n/a', NaN, Infinity]) assert.equal(fmt2(missing), '—');
assert.equal(fmt(77.7), '77.7'); assert.equal(fmt(101.325), '101.325');

// Summary rows: Baseline = latest saved baseline; Mean, SD of all results; "Farthest from mean" is the result farthest
// from the series mean (here 10.90), not the one farthest from the baseline (9.50), with its date.
const day = (iso, year) => new Date(iso + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(year ? { year: 'numeric' } : {}) });
const pts = (values, expected, start = 1) => values.map((value, i) => ({ qa_date: `2026-10-${String(start + i).padStart(2, '0')}`, value, expected, warn: 0.5, fail: 1, tol_mode: 'absolute' }));
const [row] = context.trendSummary([{ label: '100 MeV', points: pts([10, 10, 10, 10.9, 9.5], 11) }]);
assert.equal(row.label, '100 MeV'); assert.equal(row.color, 'single'); assert.equal(row.n, 5);
assert.equal(row.baseline, '11.00'); assert.equal(row.mean, '10.08'); assert.equal(row.sd, fmt2(Math.sqrt(((3 * 0.08 ** 2) + 0.82 ** 2 + 0.58 ** 2) / 4)));
assert.equal(row.farthest, '10.90'); assert.equal(row.qa_date, '2026-10-04'); assert.equal(row.date, day('2026-10-04'));
// On a Δ chart the same rows are Δ from each result's saved baseline, signed; Baseline stays the saved baseline.
const [d] = context.trendSummary([{ label: '100 MeV', points: pts([10, 10, 10, 10.9, 9.5], 11) }], true);
assert.equal(d.baseline, '11.00'); assert.equal(d.mean, '−0.92'); assert.equal(d.farthest, '−0.10'); assert.equal(d.date, day('2026-10-04'));
// Rows take the chart's series colours; one result has no SD; dates gain the year when the period spans two years.
const multi = context.trendSummary([{ label: '100 MeV', points: pts([77.7], 77.7) }, { label: '150 MeV', points: [{ qa_date: '2025-12-30', value: 158.4, expected: 158.5 }, { qa_date: '2026-01-02', value: 158.9, expected: 158.5 }] }]);
assert.deepEqual(multi.map(r => r.color), ['axis-0', 'axis-1']); assert.equal(multi[0].sd, '—'); assert.equal(multi[0].mean, '77.70');
assert.equal(multi[1].date, day('2025-12-30', true));
assert.equal(context.trendSummary([{ label: 'Spot', colorIndex: 4, points: pts([1, 2], 1) }])[0].color, 'axis-4');
assert.equal(context.trendSummary([{ label: 'No reference', points: pts([1.234, 1.236], null) }])[0].baseline, '—');

// Limit bands on a several-series chart only when every result carries the same Warning ± / Action ± in the unit.
assert.equal(context.trendSharedLimits([{ points: pts([1, 2], 1) }, { points: pts([3], 3) }]), true);
assert.equal(context.trendSharedLimits([{ points: pts([1], 1) }, { points: pts([3], 3).map(p => ({ ...p, warn: 0.25, fail: 0.3 })) }]), false);
assert.equal(context.trendSharedLimits([{ points: pts([100], 100).map(p => ({ ...p, tol_mode: 'percent' })) }, { points: pts([200], 200).map(p => ({ ...p, tol_mode: 'percent' })) }]), false);

// Key checks, both name styles: distal depth, then spot position X/Y; never Distal Fall Off, skewness or others.
const groupOf = (names, category = 'Energy') => context.trendGroups(names.map((name, i) => ({ test_id: i + 1, name: context.trendDisplayName(name), category, unit: 'mm' })));
const key = (names, category) => plain(groupOf(names, category).map(g => [g.base, context.trendKeyCheck(g)]));
assert.deepEqual(key(['Energy [100 MeV] – Distal Depth', 'Energy [150 MeV] – Distal Depth', 'Energy [100 MeV] – Distal Fall Off']), [['Distal Depths', 'depth'], ['Distal Fall Off', null]]);
assert.deepEqual(key(['Energy [100.00 MeV]: Distal Depth [mm]', 'Energy [200.00 MeV]: Distal Depth [mm]', 'Energy [100.00 MeV]: Distal Fall Off [mm]', 'Energy [100.00 MeV]: Proximal Depth [mm]'], 'Dosimetry'),
  [['Distal Depth [mm]', 'depth'], ['Distal Fall Off [mm]', null], ['Proximal Depth [mm]', null]]);
const spotNames = [[1, 225], [2, 200]].flatMap(([spot, mev]) => ['Position X', 'Position Y', 'Skewness X', 'Skewness Y', 'Sigma X'].map(m => `Spot ${spot} [${mev} MeV] – ${m}`));
assert.deepEqual(key(spotNames, 'Spot'), [['Spot Position', 'position'], ['Skewness', null], ['Sigma', null]]);
const spots = groupOf(spotNames, 'Spot');
assert.deepEqual(plain(spots[0].members.map(m => m.axis)), ['225 MeV · X', '225 MeV · Y', '200 MeV · X', '200 MeV · Y']);
assert.deepEqual(key(['Energy [225.00 MeV]: Spot Position X [mm]', 'Energy [225.00 MeV]: Spot Position Y [mm]'], 'Spot'), [['Spot Position', 'position']]);
assert.equal(context.trendAxisSplit(spots[0]), true);
assert.equal(context.trendAxisSplit(groupOf(['Energy [100 MeV] – Distal Depth', 'Energy [150 MeV] – Distal Depth'])[0]), false);
assert.equal(context.trendKeyCheck(context.trendGroups([{ test_id: 1, name: 'Isocenter Coincidence [X-ray vs. Proton Beam]: X offset [mm]', unit: 'mm' }, { test_id: 2, name: 'Isocenter Coincidence [X-ray vs. Proton Beam]: Y offset [mm]', unit: 'mm' }])[0]), null);
console.log('Two-decimal formatter, summary rows (Farthest from mean), shared limit bands and key-check detection on both name styles verified.');
