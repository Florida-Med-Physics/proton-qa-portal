// Synthetic-only checks of the browser backend (docs/local-backend.js) in node:vm: the trends window returns exactly the
// full history cut by test, date and count; the runs list judges review readiness as a single run does.
// Run with node tests/test_backend_windows.cjs from the repository root.
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
let userId = null;
const ctx = { console, queueMicrotask, structuredClone, TextEncoder, TextDecoder, URL, URLSearchParams, atob, btoa, crypto: globalThis.crypto, setTimeout, clearTimeout,
  indexedDB: fakeIndexedDb(), sessionStorage: { getItem: (k) => k === 'qa_portal_password_user' && userId ? String(userId) : null, setItem() {}, removeItem() {} },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
ctx.window = ctx; ctx.self = ctx;
vm.createContext(ctx);
for (const f of ['xlsx.full.min.js', 'wl-import.js', 'derived.js', 'mapped-import.js', 'seed-data.js', 'monthly-workbook-data.js', 'local-backend.js'])
  vm.runInContext(fs.readFileSync(`docs/${f}`, 'utf8'), ctx, { filename: f });
// Answers are copied into this realm so deepEqual compares values, not the vm's prototypes.
const api = (method, path, body) => ctx.localApi(method, path, body || {}, {}).then((x) => x === undefined ? x : JSON.parse(JSON.stringify(x)));

(async () => {
  // Sign in as the seeded Admin by id (the browser build keeps the signed-in id in sessionStorage).
  for (let id = 1; id < 20 && !userId; id++) { userId = id; const me = await api('GET', '/api/me').catch(() => null); if (!me || !me.user || me.user.role !== 'admin') userId = null; }
  assert.ok(userId, 'a seeded admin account');
  const machines = await api('GET', '/api/machines');
  const gtr1 = machines.find((m) => m.name === 'GTR1');
  const pbs = (await api('GET', `/api/machines/${gtr1.id}/assignments`)).find((a) => /PBS DailyQA/.test(a.queue_name));
  const t = await api('GET', `/api/assignments/${pbs.id}/template`);
  const numeric = t.items.filter((i) => i.type === 'numeric' && i.limits.expected !== null && !/\[calc:/.test(i.description || ''));
  const days = ['2026-10-01', '2026-10-02', '2026-10-02', '2026-10-05', '2026-10-06'];
  for (const [k, qa_date] of days.entries())    // synthetic values: the reference plus a small offset
    await api('POST', `/api/assignments/${pbs.id}/runs`, { qa_date, results: numeric.slice(0, 12).map((i) => ({ test_id: i.test_id, value: i.limits.expected + k * 0.01 })) });
  const full = await api('GET', `/api/machines/${gtr1.id}/trends`);
  const ids = numeric.slice(0, 12).map((i) => i.test_id);
  assert.ok(ids.every((id) => full[id] && full[id].length === days.length));
  const pick = (want, until, last) => Object.fromEntries(Object.entries(full).filter(([k]) => want.includes(Number(k)))
    .map(([k, v]) => { const p = until ? v.filter((x) => x.qa_date <= until) : v; return [k, last ? p.slice(-last) : p]; }));
  assert.deepEqual(await api('GET', `/api/machines/${gtr1.id}/trends?tests=${ids.join(',')}&last=60`), pick(ids, '', 60));
  assert.deepEqual(await api('GET', `/api/machines/${gtr1.id}/trends?tests=${ids.slice(0, 3).join(',')}&last=2`), pick(ids.slice(0, 3), '', 2));
  assert.deepEqual(await api('GET', `/api/machines/${gtr1.id}/trends?tests=${ids[0]}&until=2026-10-02&last=61`), pick([ids[0]], '2026-10-02', 61));
  assert.deepEqual((await api('GET', `/api/trend?machine_id=${gtr1.id}&test_id=${ids[1]}`)).points, full[ids[1]]);
  // ASCII digits only, the same grammar as service.py trend_window (tests/test_shared_history.py).
  for (const [name, value] of [['tests', 'x'], ['last', '0'], ['last', '2.5'], ['until', '10/02/2026'], ['tests', '0x10'], ['last', '0x3C'], ['tests', '1_0'],
    ['last', '6_0'], ['tests', '٥'], ['last', '٥'], ['until', '٢٠٢٦-01-01'], ['tests', '1e1'], ['last', '+5'], ['last', '5.0'],
    ['tests', '1,,2'], ['until', '2026-1-01']])
    await assert.rejects(api('GET', `/api/machines/${gtr1.id}/trends?${name}=${encodeURIComponent(value)}`), { message: new RegExp(`^${name}: `) });
  assert.deepEqual(await api('GET', `/api/machines/${gtr1.id}/trends?tests=00${ids[0]}&last=60&until=2026-10-05`), pick([ids[0]], '2026-10-05', 60));
  // Review readiness: the list (one index per call) agrees with opening each run (a scan per run). Two runs are signed
  // off by the therapist step (as Admin), so both answers occur.
  for (const r of (await api('GET', '/api/runs?limit=400')).filter((r) => r.therapist_approval_required).slice(0, 2))
    await ctx.localApi('POST', `/api/runs/${r.id}/therapist-approve`, {}, { actingRole: 'therapist' });
  const runs = await api('GET', '/api/runs?limit=400');
  assert.ok(runs.some((r) => r.review_ready) && runs.some((r) => !r.review_ready));
  assert.equal(runs.length, days.length);
  for (const r of runs) assert.equal(r.review_ready, (await api('GET', `/api/runs/${r.id}`)).review_ready);
  const pending = await api('GET', '/api/runs?review_status=pending&limit=50');
  assert.deepEqual(pending.map((r) => r.id), runs.filter((r) => r.review_ready && r.review_status === 'pending').map((r) => r.id));
  const dash = await api('GET', '/api/dashboard');
  assert.equal(dash.machines.find((m) => m.id === gtr1.id).pending_review, pending.filter((r) => r.machine_id === gtr1.id).length);
  console.log('Trend windows match the full history; review readiness agrees between the runs list, a run and the Dashboard.');
})().catch((e) => { console.error(e); process.exit(1); });
