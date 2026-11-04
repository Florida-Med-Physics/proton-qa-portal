// Synthetic checks of the Machine Trends display: two-decimal formatter and axis ticks, the summary table under each chart,
// shared limit bands, which groups lead each QA list as key checks, and two spots at one energy. Run with
// node tests/test_trend_summary.cjs from the repo root.
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
for (const missing of [null, undefined, '', ' ', 'n/a', NaN, Infinity, true, false, [], {}]) assert.equal(fmt2(missing), '—');
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

// --- Charts, with a tiny stand-in for the page's el/svg (records tag, attributes and children). ---
const node = (tag, props, ...kids) => ({ tag, props: props || {}, kids: kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false), addEventListener() {} });
const text = (n) => (n && typeof n === 'object' ? n.kids.map(text).join('') : String(n ?? ''));
const all = (n, tag) => (n && typeof n === 'object' ? [...(n.tag === tag ? [n] : []), ...n.kids.flatMap((k) => all(k, tag))] : []);
Object.assign(context, { el: node, svg: node, shortDate: (d) => d, sig: String, sigSigned: String, bandValue: () => null, pointTooltip() {}, hidePointTooltip() {}, trendRunHref: () => '', location: {}, FORECAST_DAYS: 28 });
for (const [from, to] of [['function niceTicks(', 'function seriesStats('], ['function trendPlotPoints(', 'function trendExclusionNote('],
  ['function trendSummaryTable(', '// Limit bands on a Δ chart'], ['function drawSeries(', 'function axisLegend(']])
  vm.runInContext(between(from, to), context);
const num = (t) => Number(String(t).replace('−', '-').replace('+', ''));

// Two-decimal axes: every tick is a whole multiple of 0.01, so its label is exactly the value of its gridline (a 0.025
// step would print 77.63 on the 77.625 line); no two labels alike. Charts elsewhere keep their own ticks.
for (let k = 0; k < 2000; k++) {
  const lo = -1 + (k % 97) * 0.731, span = 0.04 + (k % 13) * 0.0123 + (k % 7) * 0.31 * (k % 3);
  const { ticks } = context.niceTicks(lo, lo + span, 5, true);
  assert(ticks.length >= 2 && ticks.length <= 7, `${ticks.length} ticks for ${lo} + ${span}`);
  for (const v of ticks) assert(Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, `tick ${v} is not a whole 0.01`);
  assert.equal(new Set(ticks.map((v) => fmt2(v))).size, ticks.length);
}
assert.equal(+(context.niceTicks(77.59, 77.71, 5).ticks[1] - context.niceTicks(77.59, 77.71, 5).ticks[0]).toFixed(6), 0.025);   // QA forms: unchanged
const series = (values) => values.map((value, i) => ({ qa_date: `2026-10-${String(1 + i).padStart(2, '0')}`, value, expected: null, warn: null, fail: null, tol_mode: 'absolute', status: 'pass' }));
const ticksOf = (chart) => { const out = []; chart.kids.forEach((k, i) => { const t = chart.kids[i + 1]; if (k.tag === 'line' && k.props.class === 'axis' && t?.tag === 'text') out.push([k.props.y1, text(t)]); }); return out; };
const flat = ticksOf(context.drawSeries([{ label: '100 MeV', points: series([77.60, 77.62, 77.65, 77.68, 77.70, 77.66]) }], 'mm', { compact: true, fixed2: true, prediction: false }));
assert.deepEqual(flat.map(([, t]) => t), ['77.60', '77.62', '77.64', '77.66', '77.68', '77.70']);
const [[y0, t0], [y1, t1]] = [flat[0], flat.at(-1)];
for (const [yv, t] of flat) assert(Math.abs(num(t0) + ((yv - y0) * (num(t1) - num(t0))) / (y1 - y0) - num(t)) < 1e-9, `label ${t} sits on its own gridline`);

// Plotted points: each value worked out once gives exactly the points the earlier formula kept (filtered copy per point).
const earlier = (points, delta) => {
  const value = (p) => (delta ? context.asDeviation(p).dev : p.value);
  const finite = points.filter((p) => Number.isFinite(value(p)));
  if (finite.length < 5) return finite;
  return finite.filter((point, index) => {
    const other = finite.filter((_, i) => i !== index).map(value);
    const mean = other.reduce((sum, v) => sum + v, 0) / other.length;
    const sd = Math.sqrt(other.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (other.length - 1));
    return Math.abs(value(point) - mean) <= Math.max(5 * sd, 1e-12);
  });
};
let seed = 11; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
for (let k = 0; k < 600; k++) {
  const base = [77.7, 0, -49.4, 158.5][k % 4], points = Array.from({ length: 1 + (k % 40) }, (_, i) => ({ qa_date: `2026-10-${String(1 + (i % 28)).padStart(2, '0')}`,
    value: rnd() < 0.03 ? null : base + (rnd() < 0.06 ? 30 : 0.1) * (rnd() - 0.5) * (k % 5), expected: rnd() < 0.1 ? null : base, warn: 0.5, fail: 1, tol_mode: k % 7 ? 'absolute' : 'percent' }));
  for (const delta of [false, true]) assert.deepEqual(context.trendPlotPoints(points, delta).map((p) => points.indexOf(p)), earlier(points, delta).map((p) => points.indexOf(p)));
}

// Shared limit bands are judged date by date: limits changed for the whole list part-way through keep the bands; a series
// carrying other limits (or none) on a date removes them.
const lim = (values, base, limits, start = 1) => pts(values, base, start).map((p, i) => ({ ...p, ...limits(i + start) }));
const retol = (d) => (d <= 2 ? { warn: 1, fail: 2 } : { warn: 0.5, fail: 1 });
assert.equal(context.trendSharedLimits([{ points: lim([1, 1, 1, 1], 1, retol) }, { points: lim([3, 3, 3, 3], 3, retol) }]), true);
assert.equal(context.trendSharedLimits([{ points: lim([1, 1, 1, 1], 1, retol) }, { points: lim([3, 3, 3, 3], 3, () => ({})) }]), false);
assert.equal(context.trendSharedLimits([{ points: lim([1, 1], 1, () => ({})) }, { points: lim([3, 3], 3, () => ({ warn: null, fail: null })) }]), false);
// The Δ bands run over every series' dates, not only the first series': here the first series starts on Oct 4.
const spread = context.drawSeries([{ label: '226.4 MeV', points: lim([10.1, 10, 9.9, 10], 10, () => ({}), 4) }, { label: '201 MeV', points: lim([5, 5.1, 4.9, 5, 5.05, 5], 5, () => ({}), 1) }],
  'mm', { compact: true, delta: true, prediction: false, fixed2: true });
const xs = (tag) => all(spread, tag).flatMap((n) => (tag === 'circle' ? [n.props.cx] : n.props.points.split(' ').map((q) => Number(q.split(',')[0]))));
assert.equal(Math.min(...xs('polygon')), Math.min(...xs('circle')));
assert.equal(all(spread, 'polygon').length, 3);

// The summary table is a named region (keyboard-scrollable on a phone) with a caption; its first column says what it holds.
const box = context.trendSummaryTable([{ label: '201 MeV', points: pts([10.1, 10.2], 10) }], 'mm', true, 'Position X');
assert.equal(box.props.role, 'region'); assert.equal(box.props.tabindex, '0'); assert.equal(box.props['aria-label'], 'Δ Position X summary (mm)');
assert.equal(text(all(box, 'caption')[0]), 'Δ Position X summary (mm)');
assert.equal(all(box, 'th')[0].props['aria-label'], 'Series (mm)'); assert.equal(text(all(box, 'th')[0]), 'mm');
assert.equal(all(context.trendSummaryTable([{ label: '201 MeV', points: pts([0.1, 0.2], 0) }], 'unitless', false, 'Skewness X'), 'th')[0].props['aria-label'], 'Series');
assert.deepEqual(all(box, 'td').map(text), ['10.00', '+0.15', '0.07', '+0.10', day('2026-10-01')]);
// A result without a value never counts, also on a Δ chart (where value − baseline would read as −baseline).
const [gap] = context.trendSummary([{ label: '100 MeV', points: [...pts([1.234], 1.2), pts([null], 1.2, 2)[0], ...pts([1.25], 1.2, 3)] }], true);
assert.equal(gap.n, 2); assert.equal(gap.mean, '+0.04');

// Two spots at one energy keep their spot number, so their lines, colours and rows stay apart; other spots are unchanged.
const twin = context.trendGroups([[1, 225], [4, 225], [2, 200]].flatMap(([spot, mev]) => ['X', 'Y'].map((a) => `Spot ${spot} [${mev} MeV] – Position ${a}`))
  .map((n, i) => ({ test_id: i + 1, saved_name: n, name: context.trendDisplayName(n), category: 'Spot', unit: 'mm' })));
assert.deepEqual(plain(twin[0].members.map((m) => m.axis)), ['Spot 1 · 225 MeV · X', 'Spot 1 · 225 MeV · Y', 'Spot 4 · 225 MeV · X', 'Spot 4 · 225 MeV · Y', '200 MeV · X', '200 MeV · Y']);
assert.equal(context.trendKeyCheck(twin[0]), 'position'); assert.equal(context.trendAxisSplit(twin[0]), true);
console.log('Two-decimal ticks sit on their gridlines, plotted points unchanged, limit bands judged by date over every series, summary table named, two spots at one energy kept apart.');
