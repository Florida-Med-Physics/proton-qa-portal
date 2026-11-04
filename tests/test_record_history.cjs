// Past Sphinx imports recorded as history (POST /api/runs/record-history) and Sphinx imports split by history_before,
// in the browser backend (docs/local-backend.js) under node:vm, on synthetic report grids only. The same checks run
// against service.py in tests/test_record_history.py; the refusals, word for word, come from
// tests/record_history_cases.json for both. Run with node tests/test_record_history.cjs from the repository root.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const CASES = JSON.parse(fs.readFileSync('tests/record_history_cases.json', 'utf8'));
const REFUSED = 'You do not have permission to do that.';

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
const copy = (x) => x === undefined ? x : JSON.parse(JSON.stringify(x));
const ids = {};
const as = (role, method, path, body, actingRole) => {
  userId = ids[role];
  return ctx.localApi(method, path, body || {}, actingRole ? { actingRole } : {}).then(copy);
};
const api = (method, path, body) => as('admin', method, path, body);
const refusal = (promise) => promise.then(() => assert.fail('expected a refusal'), (err) => err.message);

// A synthetic Sphinx report in the export's layout (the grid in tests/test_sphinx.py), finished on 2026-10-<n>.
function sphinxFile(name, n) {
  const rows = [];
  const put = (cells) => { const row = []; for (const [c, t] of cells) row[c] = t; rows.push(row); };
  const measure = (metric, warn, fail, expected, result, status, setup) =>
    put([...(setup ? [[4, setup[0]], [6, setup[1]]] : []), [9, metric], [16, warn], [18, fail], [22, expected], [24, result], [28, status]]);
  put([[0, `synthetic-site ${name}`], [13, 'GX']]); put([]);
  put([[0, 'Test Name'], [2, 'User\nFinishing Date'], [4, 'Setup'], [7, 'Acceptance Criteria']]);
  put([[0, 'Sphinx'], [2, 'synthetic-user'], [4, 'Image']]);
  put([[0, 'Other'], [2, `10/${String(n).padStart(2, '0')}/2026 6:00:00 AM`]]);
  put([[4, 'Integration Time'], [11, '90.000 sec']]); put([[4, 'Energy']]); put([[28, 'Passed']]); put([[4, 'Energy [100.00 MeV]']]);
  measure('Distal Depth', '± 0.9 mm', '± 1.0 mm', '77.8 mm', '77.7 mm', 'Passed', ['X Start', '71.0 mm']);
  measure('DFO', '± 0.9 mm', '± 1.0 mm', '2.1 mm', '2.1 mm', 'Passed', ['X Stop', '98.0 mm']);
  put([[4, 'Spot']]); put([[4, 'Spot 1 [ 120 MeV ]']]);
  measure('Intensity', '± 2.50 %', '± 3.00 %', '68.36 %', '71.75 %', 'Failed');
  put([[4, 'Output']]); put([[28, 'Passed']]);
  measure('Absolute Dose', '± 1.00 %', '± 2.00 %', '100.000 cGy', '101.500 cGy', 'Passed', ['PPC-05', '']);
  put([[14, 'Date'], [21, 'Name / Signature']]);
  const book = ctx.XLSX.utils.book_new();
  ctx.XLSX.utils.book_append_sheet(book, ctx.XLSX.utils.aoa_to_sheet(rows), 'ReportTestRepositoryFlatS');
  return { name: `${name}.xls`, data: ctx.XLSX.write(book, { type: 'base64', bookType: 'xlsx' }) };
}

(async () => {
  // Sign in as the seeded Admin by id (the browser build keeps the signed-in id in sessionStorage), then find one
  // account per role.
  for (let id = 1; id < 20 && !ids.admin; id++) { userId = id; const me = await ctx.localApi('GET', '/api/me', {}, {}).catch(() => null); if (me && me.user && me.user.role === 'admin') ids.admin = id; }
  assert.ok(ids.admin, 'a seeded admin account');
  for (const u of await api('GET', '/api/users')) if (u.active && !ids[u.role]) ids[u.role] = u.id;
  for (const role of ['physicist', 'therapist', 'mpa']) assert.ok(ids[role], `a seeded ${role} account`);

  // One daily list on two machines, with a therapist sign-off step, and a second list on gantry A.
  const gantryA = (await api('POST', '/api/machines', { name: 'Synthetic Gantry A' })).id;
  const gantryB = (await api('POST', '/api/machines', { name: 'Synthetic Gantry B' })).id;
  const daily = (await api('POST', '/api/queues', { name: 'Synthetic Sphinx daily', items: [] })).id;
  const sign = (await api('POST', '/api/tests', { name: 'QA reviewed by therapist?', type: 'boolean', owner_queue_id: daily })).id;
  await api('PUT', `/api/queues/${daily}`, { name: 'Synthetic Sphinx daily', items: [{ test_id: sign }] });
  const other = (await api('POST', '/api/queues', { name: 'Synthetic Sphinx other', items: [] })).id;
  const sched = async (machine_id, queue_id) => (await api('POST', '/api/assignments', { machine_id, queue_id, frequency: 'daily', weekdays: [0, 1, 2, 3, 4, 5, 6], start_date: '2026-01-01' })).id;
  const dailyA = await sched(gantryA, daily), dailyB = await sched(gantryB, daily), otherA = await sched(gantryA, other);
  const imp = async (assignment, name, n, options) => {
    const result = await api('POST', `/api/assignments/${assignment}/sphinx/import`, { files: [sphinxFile(name, n)], ...options });
    assert.equal(result.imported.length, 1, JSON.stringify(result.skipped));
    return result.imported[0].run_id;
  };
  const run = (id) => api('GET', `/api/runs/${id}`);
  const state = async () => (await api('GET', '/api/backup')).state;

  // ---- history_before: one import split at a date; a file exactly on it waits for review ----
  for (const historical of [true, false, undefined]) {
    const files = [4, 2, 3].map((n) => sphinxFile(`split-${historical}-${n}`, n));
    const result = await api('POST', `/api/assignments/${dailyB}/sphinx/import`, { files, history_before: '2026-10-03', ...(historical === undefined ? {} : { historical }) });
    assert.deepEqual(result.imported.map((x) => x.qa_date), ['2026-10-04', '2026-10-02', '2026-10-03']);
    const runs = await Promise.all(result.imported.map((x) => run(x.run_id)));
    assert.deepEqual(runs.map((r) => [r.review_status, r.therapist_approval_required]), [['pending', true], ['imported', false], ['pending', true]]);
    if (historical !== undefined) continue;
    // Each half is exactly what historical: true / false gives for the same values (another file, another machine).
    const shape = (r) => r.results.map((x) => [x.name, x.value_num, x.expected, x.warn, x.fail, x.tol_mode, x.status, x.comment]);
    assert.deepEqual(shape(runs[1]), shape(await run(await imp(dailyA, 'same-2-history', 2, { historical: true }))));
    assert.deepEqual(shape(runs[2]), shape(await run(await imp(dailyA, 'same-3-pending', 3, { historical: false }))));
    assert.notDeepEqual(shape(runs[1]), shape(runs[2]));   // the synthetic dose is judged differently by the two rules
  }
  // Without it (or null) nothing changes: historical decides.
  assert.equal((await run(await imp(dailyB, 'null-before', 6, { history_before: null, historical: false }))).review_status, 'pending');
  assert.equal((await run(await imp(dailyB, 'no-before', 6, {}))).review_status, 'imported');
  for (const value of CASES.bad_dates)
    assert.equal(await refusal(api('POST', `/api/assignments/${dailyA}/sphinx/import`, { files: [sphinxFile('refused', 2)], history_before: value })),
      'history_before: give a date as YYYY-MM-DD.', JSON.stringify(value));
  assert.equal(await refusal(api('POST', `/api/assignments/${dailyA}/sphinx/import`, { files: [], history_before: '2026-10-32' })), 'history_before: give a date as YYYY-MM-DD.');
  assert.equal(await refusal(api('POST', `/api/assignments/${dailyA}/sphinx/import`, { files: [], history_before: '2026-10-03' })), 'Choose one or more Sphinx .xls files.');
  for (const [role, acting] of [['therapist'], ['mpa'], ['admin', 'therapist']])
    assert.equal(await refusal(as(role, 'POST', `/api/assignments/${dailyA}/sphinx/import`, { files: [sphinxFile('refused', 2)], history_before: 'bad' }, acting)), REFUSED);
  for (const value of CASES.good_dates) await imp(dailyB, `good-${value}`, 2, { history_before: value });
  // Clear the split runs out of the way (as history, gantry B only) so the selection below starts from known runs.
  await as('physicist', 'POST', '/api/runs/record-history', { until: '2026-10-31', machine_id: gantryB });
  await as('physicist', 'POST', '/api/runs/record-history', { until: '2026-10-31', machine_id: gantryA });

  // ---- the runs record-history chooses from ----
  const r = {};
  for (const [name, n] of [['first', 1], ['signed', 2], ['on_until', 3], ['later', 4], ['trashed', 1], ['approved', 1], ['rejected', 1]])
    r[name] = await imp(dailyA, name, n, { historical: false });
  r.other_machine = await imp(dailyB, 'other_machine', 1, { historical: false });
  r.other_list = await imp(otherA, 'other_list', 2, { historical: false });
  r.history = await imp(dailyA, 'history', 1, {});
  // Performed on the form: one filled in from a Sphinx file (source 'sphinx'), one typed in.
  r.form_sphinx = (await as('therapist', 'POST', `/api/assignments/${dailyA}/runs`, { qa_date: '2026-10-01', results: [], source_ref: 'synthetic-form-file', comment: 'Done at the console' })).id;
  r.form_manual = (await as('therapist', 'POST', `/api/assignments/${dailyA}/runs`, { qa_date: '2026-10-01', results: [] })).id;
  await as('physicist', 'POST', `/api/runs/${r.trashed}/trash`, { trashed: true });
  for (const name of ['signed', 'approved', 'rejected']) await as('therapist', 'POST', `/api/runs/${r[name]}/therapist-approve`);
  await as('physicist', 'POST', `/api/runs/${r.approved}/review`, { decision: 'approved' });
  await as('physicist', 'POST', `/api/runs/${r.rejected}/review`, { decision: 'rejected', comment: 'Synthetic rejection' });
  assert.equal((await run(r.form_sphinx)).source, 'sphinx');
  assert.equal((await run(r.first)).therapist_approval_required, true);

  // ---- dry runs pick only waiting file imports, and change nothing ----
  const before = await state();
  const dry = (body) => as('physicist', 'POST', '/api/runs/record-history', { until: '2026-10-03', dry_run: true, ...body });
  const sorted = (list) => list.slice().sort((a, b) => a - b);
  assert.deepEqual(await dry({}), { count: 5, runs: sorted([r.first, r.signed, r.on_until, r.other_machine, r.other_list]) });
  assert.deepEqual((await dry({ machine_id: gantryA })).runs, sorted([r.first, r.signed, r.on_until, r.other_list]));
  assert.deepEqual((await dry({ machine_id: gantryA, assignment_id: dailyA })).runs, [r.first, r.signed, r.on_until]);
  assert.deepEqual((await dry({ assignment_id: dailyB })).runs, [r.other_machine]);
  assert.deepEqual((await dry({ until: '2026-10-01' })).runs, sorted([r.first, r.other_machine]));
  assert.deepEqual(await dry({ until: '2026-09-30' }), { count: 0, runs: [] });
  for (const value of CASES.good_dates) await dry({ until: value });

  // ---- refusals: permission first, then the same words as service.py ----
  for (const [role, acting] of [['therapist'], ['mpa'], ['admin', 'therapist'], ['admin', 'mpa']])
    for (const body of [{ until: '2026-10-03' }, { until: '2026-10-03', dry_run: true }, { until: 'not a date' }])
      assert.equal(await refusal(as(role, 'POST', '/api/runs/record-history', body, acting)), REFUSED, `${role} ${acting || ''}`);
  for (const [body, message] of CASES.refused)
    assert.equal(await refusal(as('physicist', 'POST', '/api/runs/record-history', body)), message, JSON.stringify(body));
  for (const value of CASES.bad_dates)
    assert.equal(await refusal(dry({ until: value })), 'until: give a date as YYYY-MM-DD.', JSON.stringify(value));
  assert.equal(await refusal(dry({ machine_id: gantryB, assignment_id: dailyA })), 'That schedule is not on that machine.');
  assert.deepEqual(await state(), before);
  for (const [role, acting] of [['physicist'], ['admin'], ['admin', 'physicist']])
    assert.equal((await as(role, 'POST', '/api/runs/record-history', { until: '2026-10-03', dry_run: true }, acting)).count, 5);

  // ---- recording: only the review state changes; one audit entry per run ----
  assert.deepEqual(await api('POST', '/api/runs/record-history', { until: '2026-10-03', assignment_id: dailyA }), { count: 3 });
  const after = await state(), chosen = [r.first, r.signed, r.on_until];
  const runsBefore = new Map(before.runs.map((x) => [x.id, x]));
  for (const now of after.runs) {
    const was = runsBefore.get(now.id);
    if (chosen.includes(now.id)) {
      assert.deepEqual([now.review_status, now.therapist_approval_required], ['imported', false]);
      assert.deepEqual({ ...now, review_status: 0, therapist_approval_required: 0 }, { ...was, review_status: 0, therapist_approval_required: 0 });
    } else assert.deepEqual(now, was);
  }
  assert.deepEqual(after.results, before.results);
  const signer = runsBefore.get(r.signed);
  assert.ok(signer.therapist_approved_by && signer.therapist_approved_at);
  const entries = after.audit.slice(before.audit.length);
  assert.deepEqual(entries.map((e) => [e.action, e.entity, e.entity_id, e.user_id]), chosen.map((id) => ['record_history', 'run', id, ids.admin]));
  const detail = Object.fromEntries(entries.map((e) => [e.entity_id, JSON.parse(e.detail)]));
  assert.deepEqual(detail[r.first], { previous: { review_status: 'pending', therapist_approval_required: true, therapist_approved_by: null, therapist_approved_at: null }, until: '2026-10-03' });
  assert.deepEqual(detail[r.signed].previous, { review_status: 'pending', therapist_approval_required: true, therapist_approved_by: signer.therapist_approved_by, therapist_approved_at: signer.therapist_approved_at });
  // They leave every review queue (the Dashboard counts come from these); the rest still wait.
  const waiting = (await api('GET', '/api/runs?limit=1000')).filter((x) => x.review_status === 'pending').map((x) => x.id);
  assert.deepEqual(sorted(waiting), sorted([r.later, r.other_machine, r.other_list, r.form_sphinx, r.form_manual]));
  assert.deepEqual(await dry({ assignment_id: dailyA }), { count: 0, runs: [] });
  assert.deepEqual(await as('physicist', 'POST', '/api/runs/record-history', { until: '2026-10-04', dry_run: false }), { count: 3 });
  assert.equal((await run(r.later)).review_status, 'imported');
  // View As: an Admin acting as a physicist may, and the audit keeps who did it and as what.
  const viewAs = await as('admin', 'POST', `/api/assignments/${dailyA}/sphinx/import`, { files: [sphinxFile('view-as', 5)], historical: false });
  assert.deepEqual(await as('admin', 'POST', '/api/runs/record-history', { until: '2026-10-05' }, 'physicist'), { count: 1 });
  const last = (await state()).audit.at(-1);
  assert.deepEqual([last.action, last.entity_id, last.user_id, JSON.parse(last.detail).acting_role], ['record_history', viewAs.imported[0].run_id, ids.admin, 'physicist']);
  console.log('history_before splits an import at its date; record-history picks only waiting Sphinx file imports, dry runs change nothing, refusals match service.py, and recording keeps results, verdicts and sign-offs with one audit entry per run.');
})().catch((e) => { console.error(e); process.exit(1); });
