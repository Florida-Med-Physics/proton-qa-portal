// Synthetic-only checks of paged machine trends in the browser backend (docs/local-backend.js in node:vm) and of
// app.js machineHistory, which Machine Trends and the CSV export use: joining the parts gives exactly the unpaged reply
// for the same window; parts stay within the byte budget; ties (even repeated result ids) are neither lost nor
// repeated; the order map is Machine Trends' former answer; a change while the parts arrive starts again; bad input is
// refused with the same text as service.py (tests/test_trend_pages.py).
// Run with node tests/test_trend_pages.cjs from the repository root.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fakeIndexedDb() {
  const store = {};
  const later = (req, fn) => queueMicrotask(() => { try { req.result = fn(); req.onsuccess && req.onsuccess(); } catch (err) { req.error = err; req.onerror && req.onerror(); } });
  const objectStore = { get(k) { const r = {}; later(r, () => store[k]); return r; }, put(v, k) { const r = {}; later(r, () => { store[k] = v; }); return r; }, delete(k) { const r = {}; later(r, () => { delete store[k]; }); return r; } };
  const db = { createObjectStore() {}, transaction() { return { objectStore: () => objectStore }; } };
  return { open() { const r = {}; later(r, () => db); return r; } };
}
const source = fs.readFileSync('docs/local-backend.js', 'utf8');
const DEFAULT_BUDGET = Number(/const TREND_PAGE_BYTES=(\d+);/.exec(source)[1]);
// One browser backend whose page budget is set to budget (the constant is replaced in the source it runs, and
// api.setBudget changes it later, for this test only).
async function backend(budget) {
  let userId = null;
  const ctx = { console, queueMicrotask, structuredClone, TextEncoder, TextDecoder, URL, URLSearchParams, atob, btoa, crypto: globalThis.crypto, setTimeout, clearTimeout,
    indexedDB: fakeIndexedDb(), sessionStorage: { getItem: (k) => k === 'qa_portal_password_user' && userId ? String(userId) : null, setItem() {}, removeItem() {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
  ctx.window = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  for (const f of ['xlsx.full.min.js', 'wl-import.js', 'derived.js', 'mapped-import.js', 'seed-data.js', 'monthly-workbook-data.js'])
    vm.runInContext(fs.readFileSync(`docs/${f}`, 'utf8'), ctx, { filename: f });
  const code = source.replace(/const TREND_PAGE_BYTES=\d+;/, `let TREND_PAGE_BYTES=${budget};window.setTrendPageBytes=(n)=>{TREND_PAGE_BYTES=n;};`);
  assert.ok(code.includes(`let TREND_PAGE_BYTES=${budget};`));
  vm.runInContext(code, ctx, { filename: 'local-backend.js' });
  // Answers are copied into this realm so deepEqual compares values, not the vm's prototypes.
  const api = (method, path, body) => ctx.localApi(method, path, body || {}, {}).then((x) => x === undefined ? x : JSON.parse(JSON.stringify(x)));
  api.setBudget = (n) => ctx.setTrendPageBytes(n);
  for (let id = 1; id < 20 && !userId; id++) { userId = id; const me = await api('GET', '/api/me').catch(() => null); if (!me || !me.user || me.user.role !== 'admin') userId = null; }
  assert.ok(userId, 'a seeded admin account');
  return api;
}
// app.js rangeStart / filterRange / machineHistory, run against the api given.
function client(api) {
  const app = fs.readFileSync('portal/static/app.js', 'utf8');
  const c = { api, URLSearchParams };
  vm.createContext(c);
  vm.runInContext(app.slice(app.indexOf('// First QA date a period shows'), app.indexOf('function stats(points)')), c);
  return c;
}
// Machine Trends' former order computation (app.js renderTrendOverview), verbatim, on an unpaged reply.
function oldOrder(histories, template) {
  const imported = Object.entries(histories).flatMap(([testId, points]) => points.filter(p => p.source === 'sphinx' && String(p.assignment_id) === String(template.assignment.id)).map(p => ({ ...p, testId })));
  const newest = imported.reduce((id, p) => Math.max(id, p.run_id), 0);
  return new Map(imported.filter(p => p.run_id === newest).map(p => [String(p.testId), p.source_order]));
}
// The same refusals, word for word, are checked in tests/test_trend_pages.py.
const REFUSED = [
  [{ from: '2026-9-01' }, 'from: give a date as YYYY-MM-DD.'],
  [{ from: '٢٠٢٦-01-01' }, 'from: give a date as YYYY-MM-DD.'],
  [{ from: '2026-09-01T00' }, 'from: give a date as YYYY-MM-DD.'],
  [{ page: 'x' }, 'page: give start, or the next value from the previous page.'],
  [{ page: 'Start' }, 'page: give start, or the next value from the previous page.'],
  [{ page: '0' }, 'page: give start, or the next value from the previous page.'],
  [{ page: '012' }, 'page: give start, or the next value from the previous page.'],
  [{ page: '-1' }, 'page: give start, or the next value from the previous page.'],
  [{ page: '1.5' }, 'page: give start, or the next value from the previous page.'],
  [{ page: '12\n' }, 'page: give start, or the next value from the previous page.'],
  [{ page: ' 12' }, 'page: give start, or the next value from the previous page.'],
  [{ page: '1234567890123456' }, 'page: give start, or the next value from the previous page.'],
  [{ page: '١٢' }, 'page: give start, or the next value from the previous page.'],
  [{ page: '2026-09-01.1.2.1' }, 'page: give start, or the next value from the previous page.'],
  [{ page: 'start', last: '5' }, 'page: cannot be combined with last.'],
  [{ page: '12', last: '5' }, 'page: cannot be combined with last.'],
  [{ page: 'x', from: 'x' }, 'from: give a date as YYYY-MM-DD.'],
];
const query = (q) => new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined)).toString();

(async () => {
  const api = await backend(DEFAULT_BUDGET);
  const machines = await api('GET', '/api/machines');
  const gtr1 = machines.find((m) => m.name === 'GTR1');
  const pbs = (await api('GET', `/api/machines/${gtr1.id}/assignments`)).find((a) => /PBS DailyQA/.test(a.queue_name));
  const t = await api('GET', `/api/assignments/${pbs.id}/template`);
  const numeric = t.items.filter((i) => i.type === 'numeric' && i.limits.expected !== null && !/\[calc:/.test(i.description || '')).slice(0, 6);
  const days = ['2026-10-01', '2026-10-02', '2026-10-02', '2026-10-03', '2026-10-05', '2026-10-05', '2026-10-06', '2026-10-08'];
  const runs = [];
  for (const [k, qa_date] of days.entries())    // synthetic values: the reference plus a small offset
    runs.push((await api('POST', `/api/assignments/${pbs.id}/runs`, { qa_date, results: numeric.map((i, j) => ({ test_id: i.test_id, value: i.limits.expected + k * 0.01 + j * 1e-7 })) })).id);
  // Through a backup: a second test with the same history key (one series, two test ids), a repeated result id
  // (an exact tie of qa_date, run and source_order), and two runs marked as Sphinx imports, the newer on 2026-10-02.
  const { state } = await api('GET', '/api/backup');
  const twin = { ...state.tests.find((x) => x.id === numeric[0].test_id), id: Math.max(...state.tests.map((x) => x.id)) + 1, owner_queue_id: null };
  state.tests.push(twin);
  if (state.seq && typeof state.seq === 'object') state.seq.tests = Math.max(state.seq.tests || 0, twin.id);
  const repeated = state.results.find((r) => r.run_id === runs[3] && r.test_id === numeric[1].test_id);
  state.results.push({ ...repeated, value_num: repeated.value_num + 0.5 });
  for (const run of state.runs) if (run.id === runs[0] || run.id === runs[2]) run.source = 'sphinx';
  await api('POST', '/api/restore', { state, exported_at: 'synthetic' });
  const apis = { [DEFAULT_BUDGET]: api };
  for (const budget of [1, 900, 3000]) { apis[budget] = await backend(budget); await apis[budget]('POST', '/api/restore', { state, exported_at: 'synthetic' }); }

  const whole = await api('GET', `/api/machines/${gtr1.id}/trends`);
  assert.ok(whole[twin.id], 'the twin test is in the reply');
  assert.deepEqual(whole[twin.id], whole[numeric[0].test_id]);
  assert.equal(whole[numeric[1].test_id].filter((p) => p.run_id === runs[3]).length, 2, 'the repeated result id is in the series twice');

  // Parts join to the unpaged reply for each window and budget, within the budget, each series once per part.
  const windows = [{}, { until: '2026-10-05' }, { from: '2026-10-03' }, { from: '2026-10-02', until: '2026-10-06' }, { tests: String(twin.id) },
    { tests: `${numeric[0].test_id},${numeric[1].test_id}`, from: '2026-10-03' }, { from: '2026-12-01' }];
  let manyParts = 0, tieSplit = false;
  const keyOf = (p) => `${p.qa_date}|${p.run_id}|${p.source_order}`;
  for (const q of windows) {
    const unpaged = await api('GET', `/api/machines/${gtr1.id}/trends?${query(q)}`);
    const tokens = new Set();
    for (const [budget, call] of Object.entries(apis)) {
      const joined = {}, parts = [];
      let sent = 0, lastKey = null;
      for (let page = 'start'; page;) {
        const part = await call('GET', `/api/machines/${gtr1.id}/trends?${query({ ...q, page })}`);
        parts.push(part);
        assert.equal(part.token, parts[0].token);
        assert.equal('order' in part, parts.length === 1);
        const points = part.series.reduce((n, s) => n + s.length, 0);
        assert.ok(Buffer.byteLength(JSON.stringify(part)) <= Number(budget) || points <= 1, `${JSON.stringify(q)} budget ${budget}`);
        assert.deepEqual([...new Set(Object.values(part.tests))].sort((a, b) => a - b), part.series.map((_, i) => i));
        for (const [id, i] of Object.entries(part.tests)) (joined[id] ||= []).push(...part.series[i]);
        // The cursor counts the points sent so far; a tie (a repeated result id) can fall either side of it.
        sent += points;
        if (part.next !== null) assert.equal(part.next, String(sent));
        const keys = part.series.flat().map(keyOf).sort();
        if (lastKey !== null && keys.includes(lastKey)) tieSplit = true;
        lastKey = keys.length ? keys[keys.length - 1] : lastKey;
        assert.ok(part.next !== page && parts.length < 5000, 'each part moves on');
        page = part.next;
      }
      assert.deepEqual(joined, unpaged, `${JSON.stringify(q)} budget ${budget}`);
      const distinct = new Map(Object.values(unpaged).map((v) => [JSON.stringify(v), v.length]));   // each shared series once
      if (Number(budget) === 1) assert.equal(parts.length, Math.max(1, [...distinct.values()].reduce((n, k) => n + k, 0)), 'one point per part');
      manyParts = Math.max(manyParts, parts.length);
      tokens.add(parts[0].token);
    }
    assert.equal(tokens.size, 1, 'the token does not depend on the budget');
  }
  assert.ok(manyParts > 20 && tieSplit, 'tiny budgets give many parts, and a part boundary between two points with a repeated result id');

  // Unpaged from= is the whole history cut by date.
  const cut = (from) => Object.fromEntries(Object.entries(whole).map(([k, v]) => [k, v.filter((p) => p.qa_date >= from)]).filter(([, v]) => v.length));
  assert.deepEqual(await api('GET', `/api/machines/${gtr1.id}/trends?from=2026-10-03`), cut('2026-10-03'));

  // The order map is the overview's former answer from the whole history, also when the newest import is before from.
  for (const q of [{}, { from: '2026-10-03' }, { from: '2026-10-08' }]) {
    const { order } = await apis[900]('GET', `/api/machines/${gtr1.id}/trends?${query({ ...q, page: 'start' })}`);
    for (const id of new Set([pbs.id, ...Object.values(whole).flat().map((p) => p.assignment_id)]))
      assert.deepEqual(new Map(Object.entries(order[String(id)] || {})), oldOrder(whole, { assignment: { id } }));
    assert.ok(Object.keys(order[pbs.id]).includes(String(twin.id)));
    assert.ok(Object.values(whole).flat().filter((p) => p.run_id === runs[2]).every((p) => p.qa_date < '2026-10-03'));
  }

  // Each part is exactly as large as fits: for every budget from 250 to 1500 bytes, the first two parts are the greedy
  // parts built here from the whole answer: within the budget (or a single point), and one more point would not fit.
  const sweep = apis[3000];
  for (const q of [{}, { from: '2026-10-03' }]) {
    sweep.setBudget(1e9);
    const full = await sweep('GET', `/api/machines/${gtr1.id}/trends?${query({ ...q, page: 'start' })}`);
    assert.equal(full.next, null);
    const members = full.series.map((_, i) => Object.keys(full.tests).filter((id) => full.tests[id] === i));
    const before = (a, b) => a.qa_date < b.qa_date ? -1 : a.qa_date > b.qa_date ? 1 : a.run_id - b.run_id || a.source_order - b.source_order;
    const all = full.series.flatMap((pts, s) => pts.map((p) => ({ p, s }))).sort((a, b) => before(a.p, b.p));
    const build = (a, b) => {
      const part = { series: [], tests: {}, next: b < all.length ? String(b) : null, token: full.token };
      if (a === 0) part.order = full.order;
      const index = new Map();
      for (const { p, s } of all.slice(a, b)) {
        if (!index.has(s)) { index.set(s, part.series.length); for (const id of members[s]) part.tests[id] = part.series.length; part.series.push([]); }
        part.series[index.get(s)].push(p);
      }
      return part;
    };
    const bytes = (part) => Buffer.byteLength(JSON.stringify(part));
    for (let budget = 250; budget <= 1500; budget++) {
      sweep.setBudget(budget);
      let at = 0;
      for (let page = 'start', n = 0; page && n < 2; n++) {
        const part = await sweep('GET', `/api/machines/${gtr1.id}/trends?${query({ ...q, page })}`);
        const k = part.series.reduce((m, s) => m + s.length, 0);
        assert.deepEqual(part, build(at, at + k), `${JSON.stringify(q)} budget ${budget} part ${n + 1}`);
        assert.ok(k === 1 || bytes(part) <= budget, `${JSON.stringify(q)} budget ${budget}: within the budget`);
        if (at + k < all.length) assert.ok(bytes(build(at, at + k + 1)) > budget, `${JSON.stringify(q)} budget ${budget}: one more point would not fit`);
        at += k; page = part.next;
      }
    }
  }
  sweep.setBudget(3000);
  // The token covers the order map too: a change before from that alters only the order map changes it.
  const was = await sweep('GET', `/api/machines/${gtr1.id}/trends?from=2026-10-03&page=start`);
  const { state: unmarked } = await sweep('GET', '/api/backup');
  for (const run of unmarked.runs) if (run.id === runs[2]) run.source = 'manual';
  await sweep('POST', '/api/restore', { state: unmarked, exported_at: 'synthetic' });
  const now = await sweep('GET', `/api/machines/${gtr1.id}/trends?from=2026-10-03&page=start`);
  assert.deepEqual([now.series, now.tests, now.next], [was.series, was.tests, was.next]);
  assert.notDeepEqual(now.order, was.order);
  assert.notEqual(now.token, was.token);
  // ...but a test added to a series that has no points from from on is in no part, so the token stays.
  const spare = t.items.find((i) => i.type === 'numeric' && i.limits.expected !== null && !/\[calc:/.test(i.description || '') && !whole[i.test_id]);
  assert.ok(spare, 'a numeric test with no history yet');
  await sweep('POST', `/api/assignments/${pbs.id}/runs`, { qa_date: '2026-09-20', results: [{ test_id: spare.test_id, value: spare.limits.expected }] });
  const quiet = async (q) => { const parts = []; for (let page = 'start'; page;) { const part = await sweep('GET', `/api/machines/${gtr1.id}/trends?${query({ ...q, page })}`); parts.push(part); page = part.next; } return parts; };
  const [lonely, lonelyAll] = [await quiet({ from: '2026-10-03' }), await quiet({})];
  const { state: plusTwin } = await sweep('GET', '/api/backup');
  const spareTwin = { ...plusTwin.tests.find((x) => x.id === spare.test_id), id: Math.max(...plusTwin.tests.map((x) => x.id)) + 1, owner_queue_id: null };
  plusTwin.tests.push(spareTwin);
  if (plusTwin.seq && typeof plusTwin.seq === 'object') plusTwin.seq.tests = Math.max(plusTwin.seq.tests || 0, spareTwin.id);
  await sweep('POST', '/api/restore', { state: plusTwin, exported_at: 'synthetic' });
  assert.deepEqual(await quiet({ from: '2026-10-03' }), lonely, 'nothing in any part changed, token included');
  const twinned = await quiet({});
  assert.ok(twinned.some((part) => String(spareTwin.id) in part.tests), 'the twin shares the old series');
  assert.notEqual(twinned[0].token, lonelyAll[0].token, 'without from the answer changed, and so did the token');

  // Odd stored values, which only a restored backup can hold: QA dates that are not YYYY-MM-DD, two of them put one way
  // round by localeCompare (each series' own order) and the other by < (the order of the parts). The cursor counts
  // places, not stored values, so they page like any other, and each series keeps its own order.
  const odd = JSON.parse(JSON.stringify(state));
  const oddDates = { [runs[4]]: '2026-10-05 08:00', [runs[5]]: '2026-10-05 0800', [runs[6]]: '2026-10-06T08:00' };
  for (const run of odd.runs) if (oddDates[run.id]) run.qa_date = oddDates[run.id];
  const oddApi = await backend(1);
  await oddApi('POST', '/api/restore', { state: odd, exported_at: 'synthetic' });
  const oddWhole = await oddApi('GET', `/api/machines/${gtr1.id}/trends`);
  const oddSeries = oddWhole[numeric[0].test_id].map((p) => p.qa_date);
  assert.ok(oddSeries.indexOf('2026-10-05 08:00') < oddSeries.indexOf('2026-10-05 0800') && '2026-10-05 0800' < '2026-10-05 08:00', 'the two orders disagree here');
  assert.ok(oddSeries.includes('2026-10-06T08:00'));
  const cutOf = (h, from) => Object.fromEntries(Object.entries(h).map(([k, v]) => [k, v.filter((p) => p.qa_date >= from)]).filter(([, v]) => v.length));
  for (const budget of [1, 900, DEFAULT_BUDGET]) {
    oddApi.setBudget(budget);
    for (const from of ['', '2026-10-05']) {
      const { histories } = await client(oddApi).machineHistory(gtr1.id, { from });
      assert.deepEqual(JSON.parse(JSON.stringify(histories)), from ? cutOf(oddWhole, from) : oddWhole, `odd dates, budget ${budget}, from ${from}`);
    }
  }

  // Refusals: the same text as service.py trend_window.
  for (const [q, message] of REFUSED)
    await assert.rejects(api('GET', `/api/machines/${gtr1.id}/trends?${query(q)}`), (err) => { assert.equal(err.message, message); return true; });

  // app.js machineHistory: the unpaged reply for the period, fresh objects per test, and the order map.
  const small = client(apis[900]);
  for (const from of ['', '2026-10-03', '2026-10-06', 'NaN-NaN-NaN']) {
    const { histories, order } = await small.machineHistory(gtr1.id, { from });
    assert.deepEqual(JSON.parse(JSON.stringify(histories)), /^\d{4}/.test(from) ? cut(from) : whole);
    assert.deepEqual(JSON.parse(JSON.stringify(order)), (await api('GET', `/api/machines/${gtr1.id}/trends?page=start`)).order);
    assert.notEqual(histories[twin.id], histories[numeric[0].test_id]);
    assert.notEqual(histories[twin.id][0], histories[numeric[0].test_id][0]);
  }
  assert.equal(small.rangeStart('all'), '');
  // A run saved while the parts arrive: machineHistory starts again and returns the new answer.
  let calls = [], changeOnce = true;
  const changing = client(async (method, path) => {
    calls.push(path);
    if (calls.length === 2 && changeOnce) { changeOnce = false; await apis[900]('POST', `/api/assignments/${pbs.id}/runs`, { qa_date: '2026-10-07', results: [{ test_id: numeric[2].test_id, value: numeric[2].limits.expected }] }); }
    return apis[900](method, path);
  });
  const again = await changing.machineHistory(gtr1.id, { from: '2026-10-03' });
  assert.equal(calls.filter((p) => p.endsWith('page=start')).length, 2, 'started again once');
  const after = await apis[900]('GET', `/api/machines/${gtr1.id}/trends?from=2026-10-03`);
  assert.deepEqual(JSON.parse(JSON.stringify(again.histories)), after);
  assert.ok(after[numeric[2].test_id].some((p) => p.qa_date === '2026-10-07'));
  // Changing on every part: three tries, then a plain message.
  calls = [];
  let value = 0;
  const restless = client(async (method, path) => {
    calls.push(path);
    if (!path.endsWith('page=start')) await apis[900]('POST', `/api/assignments/${pbs.id}/runs`, { qa_date: '2026-10-07', results: [{ test_id: numeric[3].test_id, value: numeric[3].limits.expected + (value += 0.001) }] });
    return apis[900](method, path);
  });
  await assert.rejects(restless.machineHistory(gtr1.id, {}), (err) => { assert.equal(err.message, 'The results changed while they were loading (3 tries). Try again in a moment.'); return true; });
  assert.equal(calls.filter((p) => p.endsWith('page=start')).length, 3);
  console.log(`Paged trends join to the unpaged reply for every window and budget (up to ${manyParts} parts), within the budget; ties, the order map, restarts and refusals match.`);
})().catch((e) => { console.error(e); process.exit(1); });
