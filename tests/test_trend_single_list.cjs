// Synthetic checks: Machine Trends shows one QA list at a time. With no list named it opens the machine's list with the
// most recorded runs (counted in the history the page already reads; ties keep the menu order), a therapist still sees
// only the lists they see today, and Export CSV exports the list on screen. Uses the browser backend (docs/local-backend.js)
// in node:vm with its seeded synthetic lists. Run with node tests/test_trend_single_list.cjs from the repository root.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('portal/static/app.js', 'utf8');
const between = (from, to) => { const a = source.indexOf(from), b = source.indexOf(to, a + 1); assert.ok(a >= 0 && b > a, `${from} … ${to}`); return source.slice(a, b); };
const app = {};
vm.createContext(app);
vm.runInContext(between('function busiestList(', 'async function renderTrends('), app);

// Runs, not measurements: a run counts once however many results it holds and however many tests it appears under.
const point = (assignment_id, run_id) => ({ assignment_id, run_id, qa_date: '2026-10-01', value: 0 });
const menu = [{ id: 1, queue_name: 'Synthetic daily' }, { id: 2, queue_name: 'Synthetic monthly' }, { id: 3, queue_name: 'Synthetic SRS' }];
assert.equal(app.busiestList(menu, { 10: [point(1, 1), point(1, 1), point(1, 2), point(2, 3), point(2, 4), point(2, 5)], 11: [point(1, 1), point(1, 2), point(1, 1)] }).id, 2);
assert.equal(app.busiestList(menu, { 10: [point(2, 7), point(3, 8)] }).id, 2);                    // a tie keeps the menu order
assert.equal(app.busiestList(menu, {}).id, 1);
assert.equal(app.busiestList(menu, null).id, 1);
assert.equal(app.busiestList([menu[0], menu[2]], { 10: [point(2, 1), point(2, 2), point(3, 3)] }).id, 3);   // lists off the menu never win
assert.equal(app.busiestList([{ id: '3' }, { id: 1 }], { 10: [point(1, 1), point(3, 2), point(3, 4)] }).id, '3');

// The page: no "All QA lists", the menu lists only this machine's lists, a named list still opens, CSV follows the list.
const trends = between('async function renderTrends(', '// Users, audit, account');
assert.doesNotMatch(trends, /All QA lists/);
assert.match(trends, /select\("list", lists\.map\(\(a\) => \[a\.id, a\.queue_name\]\), listId,/);
assert.match(trends, /\.filter\(\(a\) => a\.active && \(activeRole\(\)!=='therapist'\|\|a\.frequency!=='monthly'\)\)/);   // as before
assert.match(trends, /let listId = lists\.some\(\(a\) => String\(a\.id\) === params\.get\("list"\)\) \? params\.get\("list"\) : "";/);
assert.match(trends, /if \(!listId && lists\.length\) \{[\s\S]{0,200}?listId = String\(busiestList\(lists, await historyRequest\)\.id\);/);
assert.match(trends, /renderTrendOverview\(machines, machineId, range, listId, templates, historyRequest\)/);
assert.match(between('async function renderTrendOverview(', 'function renderTrendDetail('), /historyRequest \|\| api\('GET', `\/api\/machines\/\$\{machineId\}\/trends`\)/);
assert.match(between('function trendFileTools(', 'function trendPattern('), /const targets = lists\.filter\(\(a\) => String\(a\.id\) === String\(listId\)\);/);

// End to end with the browser backend's seeded lists and synthetic runs on GTR1.
function fakeIndexedDb() {
  const store = {};
  const later = (req, fn) => queueMicrotask(() => { try { req.result = fn(); req.onsuccess && req.onsuccess(); } catch (err) { req.error = err; req.onerror && req.onerror(); } });
  const objectStore = { get(k) { const r = {}; later(r, () => store[k]); return r; }, put(v, k) { const r = {}; later(r, () => { store[k] = v; }); return r; }, delete(k) { const r = {}; later(r, () => { delete store[k]; }); return r; } };
  const db = { createObjectStore() {}, transaction() { return { objectStore: () => objectStore }; } };
  return { open() { const r = {}; later(r, () => db); return r; } };
}
let userId = null;
const ctx = { console, queueMicrotask, structuredClone, TextEncoder, TextDecoder, URL, URLSearchParams, atob, btoa, crypto: globalThis.crypto, setTimeout, clearTimeout,
  indexedDB: fakeIndexedDb(), sessionStorage: { getItem: (k) => k === 'qa_portal_password_user' && userId ? String(userId) : null, setItem() {}, removeItem() {} },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
ctx.window = ctx; ctx.self = ctx;
vm.createContext(ctx);
for (const f of ['xlsx.full.min.js', 'wl-import.js', 'derived.js', 'mapped-import.js', 'seed-data.js', 'monthly-workbook-data.js', 'local-backend.js'])
  vm.runInContext(fs.readFileSync(`docs/${f}`, 'utf8'), ctx, { filename: f });
const api = (method, path, body) => ctx.localApi(method, path, body || {}, {}).then((x) => x === undefined ? x : JSON.parse(JSON.stringify(x)));

(async () => {
  for (let id = 1; id < 20 && !userId; id++) { userId = id; const me = await api('GET', '/api/me').catch(() => null); if (!me || !me.user || me.user.role !== 'admin') userId = null; }
  assert.ok(userId, 'a seeded admin account');
  const gtr1 = (await api('GET', '/api/machines')).find((m) => m.name === 'GTR1');
  const assignments = await api('GET', `/api/machines/${gtr1.id}/assignments`);
  const daily = assignments.find((a) => a.active && /PBS DailyQA/.test(a.queue_name));
  const monthly = assignments.find((a) => a.active && a.frequency === 'monthly');
  assert.ok(daily && monthly, 'GTR1 has a daily and a monthly list');
  const measured = async (a) => (await api('GET', `/api/assignments/${a.id}/template`)).items
    .filter((i) => i.type === 'numeric' && !/\[(?:calc|derived):/.test(i.description || ''));
  const [dailyTests, monthlyTests] = [await measured(daily), await measured(monthly)];
  const record = (a, tests, qa_date) => api('POST', `/api/assignments/${a.id}/runs`, { qa_date, results: tests.map((i) => ({ test_id: i.test_id, value: i.limits.expected ?? 1 })) });
  // Daily: 2 runs of 12 measurements. Monthly: 3 runs of 1 measurement - fewer measurements, more runs.
  for (const d of ['2026-10-01', '2026-10-02']) await record(daily, dailyTests.slice(0, 12), d);
  for (const d of ['2026-10-03', '2026-10-04', '2026-10-05']) await record(monthly, monthlyTests.slice(0, 1), d);
  const menuFor = (role) => assignments.filter((a) => a.active && (role !== 'therapist' || a.frequency !== 'monthly'));
  const history = await api('GET', `/api/machines/${gtr1.id}/trends`);
  assert.equal(app.busiestList(menuFor('admin'), history).id, monthly.id);
  assert.equal(app.busiestList(menuFor('therapist'), history).id, daily.id);   // monthly lists stay hidden from therapists
  // One more daily run makes a tie (3 and 3): the list earlier in the menu opens.
  await record(daily, dailyTests.slice(0, 1), '2026-10-06');
  const tied = app.busiestList(menuFor('admin'), await api('GET', `/api/machines/${gtr1.id}/trends`));
  assert.equal(tied.id, menuFor('admin').find((a) => a.id === daily.id || a.id === monthly.id).id);
  console.log('Machine Trends: one list at a time, busiest list by runs (ties keep menu order), therapist menu unchanged, CSV follows the list.');
})().catch((e) => { console.error(e); process.exit(1); });
