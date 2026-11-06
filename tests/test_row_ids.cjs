// Synthetic-only checks that every row the browser rules (docs/local-backend.js) keep in a table has its own id. A
// host that stores rows by id (floridaphysics.com stores one item per row) keeps only one of several rows without an
// id, so a row added without insert() is a row lost there. Covers the two start-up passes that used to add rows
// without one (re-creating the PBS daily list, folding a per-machine copy back into its list), the start-up repair of
// a state that already holds such rows, a restore of one, and every kind of write a session makes.
// The limits below are synthetic markers (1000 + k and so on), not clinical values.
// Run with node tests/test_row_ids.cjs from the repository root.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const LIBS = ['xlsx.full.min.js', 'wl-import.js', 'derived.js', 'mapped-import.js', 'seed-data.js', 'monthly-workbook-data.js', 'local-backend.js']
  .map((f) => [f, fs.readFileSync(`docs/${f}`, 'utf8')]);
const TABLES = ['users', 'machines', 'tests', 'queues', 'queue_items', 'assignments', 'overrides', 'runs', 'results', 'audit'];
const PBS = 'PBS DailyQA Template - Sphinx';
const copy = (v) => JSON.parse(JSON.stringify(v));

/* The rules in a context of their own over a fake IndexedDB holding `state` (none: a fresh browser, which seeds).
 * store.state is what the last save put there (a copy in this realm). Saves run as soon as the request settles. */
function load(state) {
  const store = state ? { state: copy(state) } : {}, errors = [], timers = new Set();
  let userId = null;
  const later = (req, fn) => queueMicrotask(() => { try { req.result = fn(); req.onsuccess && req.onsuccess(); } catch (err) { req.error = err; req.onerror && req.onerror(); } });
  const objectStore = {
    get(k) { const r = {}; later(r, () => store[k]); return r; },
    put(v, k) { const r = {}; later(r, () => { store[k] = copy(v); }); return r; },   // a copy in this realm
    delete(k) { const r = {}; later(r, () => { delete store[k]; }); return r; },
  };
  const db = { createObjectStore() {}, transaction() { return { objectStore: () => objectStore }; } };
  const ctx = {
    console: { ...console, error: (...a) => { errors.push(a.map(String).join(' ')); } },
    queueMicrotask, structuredClone, TextEncoder, TextDecoder, URL, URLSearchParams, atob, btoa, crypto: globalThis.crypto,
    setTimeout: (fn, ms, ...a) => { const h = setTimeout(() => { timers.delete(h); fn(...a); }, 0); timers.add(h); return h; },
    clearTimeout: (h) => { timers.delete(h); clearTimeout(h); },
    indexedDB: { open() { const r = {}; later(r, () => db); return r; } },
    sessionStorage: { getItem: (k) => (k === 'qa_portal_password_user' && userId ? String(userId) : null), setItem() {}, removeItem() {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  };
  ctx.window = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  for (const [f, text] of LIBS) vm.runInContext(text, ctx, { filename: f });
  const settle = async () => {
    while (timers.size) await new Promise((r) => setImmediate(r));
    for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
  };
  const api = async (method, path, body) => {
    const x = await ctx.localApi(method, path, body || {}, {});
    await settle();
    return x === undefined ? x : copy(x);
  };
  // Start-up runs on the first request; sign in as the seeded Admin.
  const start = async () => {
    for (let id = 1; id < 40; id++) {
      userId = id;
      const me = await api('GET', '/api/me').catch(() => null);
      if (me && me.user && me.user.role === 'admin') return id;
    }
    throw new Error('no seeded admin account');
  };
  return { ctx, store, errors, settle, api, start, signIn: (id) => { userId = id; }, seed: () => copy(ctx.PORTAL_SEED) };
}

/* Every row of every table: an object with a positive whole-number id of its own, and each counter at or past its
 * table's largest id (so the next insert() cannot reuse one). */
function checkIds(s, label) {
  for (const t of TABLES) {
    const seen = new Set();
    let top = 0;
    for (const r of s[t]) {
      assert.ok(r && Number.isInteger(r.id) && r.id > 0, `${label}: a ${t} row without its own id: ${JSON.stringify(r).slice(0, 160)}`);
      assert.ok(!seen.has(r.id), `${label}: two ${t} rows with id ${r.id}`);
      seen.add(r.id);
      if (r.id > top) top = r.id;
    }
    assert.ok(s.seq[t] >= top, `${label}: the ${t} counter (${s.seq[t]}) is behind its largest id (${top})`);
  }
}
const withoutId = (r) => { const c = { ...r }; delete c.id; return JSON.stringify(c); };
const withoutTimes = (s) => JSON.stringify(s, (k, v) => (k === 'at' || k === 'created_at' || k === 'saved_at' ? '' : v));

(async () => {
  // 1. A fresh browser: seeding and start-up.
  const fresh = load();
  await fresh.start();
  const seeded = copy(fresh.store.state);
  checkIds(seeded, 'seeded');
  const seed = fresh.seed();
  const pbsChecks = seed.templates.find((t) => t.name === PBS).checks;

  // 2. The shared PBS daily list renamed (Setup QA): the next start-up re-creates the list under the seed name and the
  //    PBS daily protocol pass fills it. Each of its queue items gets an id; positions follow the template.
  {
    const p = load(seeded);
    await p.start();
    const pbs = seeded.queues.find((q) => q.name === PBS);
    await p.api('POST', `/api/queues/${pbs.id}/rename`, { name: 'Synthetic renamed PBS list' });
    const renamed = copy(p.store.state);
    checkIds(renamed, 'after the rename');
    const next = load(renamed);
    await next.start();
    const s = next.store.state;
    checkIds(s, 'start-up after the PBS list was renamed');
    const again = s.queues.find((q) => q.name === PBS);
    assert.ok(again && again.id !== pbs.id, 'the PBS list was re-created under the seed name');
    const items = s.queue_items.filter((i) => i.queue_id === again.id).sort((a, b) => a.position - b.position);
    assert.equal(items.length, pbsChecks.length, 'every check of the template is on the re-created list');
    assert.deepEqual(items.map((i) => i.position), pbsChecks.map((c, k) => k));
    assert.deepEqual(items.map((i) => s.tests.find((t) => t.id === i.test_id).name), pbsChecks.map((c) => c.name));
    assert.deepEqual(items.map((i) => Object.keys(i)), items.map(() => ['queue_id', 'test_id', 'position', 'id']), 'the same fields as before, id last as insert() puts it');
    // The rows that were there before are untouched.
    const before = new Map(renamed.queue_items.map((i) => [i.id, JSON.stringify(i)]));
    for (const i of s.queue_items) if (before.has(i.id)) assert.equal(JSON.stringify(i), before.get(i.id));
    assert.equal(s.queue_items.length, renamed.queue_items.length + pbsChecks.length);
  }

  // 3. A PBS daily list from before the protocol revision that misses some of its checks (here: the last two taken
  //    off, the list kept because one check's directions were edited, and the revision not yet applied). Start-up
  //    adds the missing checks; their queue items get ids.
  {
    const s = copy(seeded);
    const pbs = s.queues.find((q) => q.name === PBS);
    const items = s.queue_items.filter((i) => i.queue_id === pbs.id).sort((a, b) => a.position - b.position);
    const gone = items.slice(-2), kept = items.slice(0, -2);
    s.queue_items = s.queue_items.filter((i) => !gone.includes(i));
    s.tests = s.tests.filter((t) => !gone.some((i) => i.test_id === t.id));
    const edited = s.tests.find((t) => t.id === kept[3].test_id);
    edited.description = `${edited.description || ''} Synthetic local edit.`;
    s.audit = s.audit.filter((a) => !(a.action === seed.pbs_daily_protocol_revision.id && a.entity_id === pbs.id));
    const p = load(s);
    await p.start();
    const after = p.store.state;
    checkIds(after, 'start-up adding the missing PBS checks');
    const now = after.queue_items.filter((i) => i.queue_id === pbs.id).sort((a, b) => a.position - b.position);
    assert.deepEqual(now.map((i) => after.tests.find((t) => t.id === i.test_id).name), pbsChecks.map((c) => c.name), 'the list holds every check again, in order');
    for (const i of kept) assert.ok(now.some((n) => n.id === i.id && n.test_id === i.test_id), 'the queue items already there keep their ids');
  }

  // 4. A state that still holds a per-machine copy of a list (the model before 2026-10-22) whose own limits differ
  //    from the shared list: start-up folds the copy back and keeps each machine's values as that schedule's own
  //    values (overrides). Each gets an id, and the values are the copy's.
  {
    const s = copy(seeded);
    const src = s.queues.find((q) => q.name === PBS);
    const srcItems = s.queue_items.filter((i) => i.queue_id === src.id).sort((a, b) => a.position - b.position);
    const copyId = ++s.seq.queues;
    s.queues.push({ id: copyId, name: 'Synthetic per-machine copy', description: '', active: 1, is_template: 0, template_id: src.id });
    const own = new Map();
    for (const it of srcItems) {
      const t = s.tests.find((x) => x.id === it.test_id);
      const tid = ++s.seq.tests;
      s.tests.push({ ...t, id: tid, owner_queue_id: copyId });
      const limits = { expected: null, warn: null, fail: null, tol_mode: null };
      if (t.type === 'numeric' && own.size < 3) {
        Object.assign(limits, { expected: 1000 + own.size, warn: 2000 + own.size, fail: 3000 + own.size, tol_mode: 'absolute' });   // synthetic markers
        own.set(t.id, limits);
      }
      s.queue_items.push({ id: ++s.seq.queue_items, queue_id: copyId, test_id: tid, position: it.position, ...limits });
    }
    const machines = s.machines.filter((m) => ['GTR1', 'GTR2'].includes(m.name)).map((m) => m.id);
    const moved = s.assignments.filter((a) => a.queue_id === src.id && machines.includes(a.machine_id));
    assert.equal(moved.length, 2);
    for (const a of moved) a.queue_id = copyId;
    const p = load(s);
    await p.start();
    const after = p.store.state;
    checkIds(after, 'start-up folding a per-machine copy back');
    assert.ok(!after.queues.some((q) => q.id === copyId), 'the copy was folded back');
    const made = after.overrides.filter((o) => moved.some((a) => a.id === o.assignment_id));
    assert.equal(made.length, moved.length * own.size, 'one row per schedule and differing check');
    for (const a of moved) for (const [testId, limits] of own) {
      const o = made.find((x) => x.assignment_id === a.id && x.test_id === testId);
      assert.deepEqual({ expected: o.expected, warn: o.warn, fail: o.fail, tol_mode: o.tol_mode }, limits, 'the machine keeps its own values');
    }
  }

  // 5. A state that already holds rows without an id (as the two passes above left them before this fix), a counter
  //    behind and a counter missing. Start-up gives each such row the next id of its table in table order, changes
  //    nothing else, logs it once, and a second start-up stores exactly the same state. Two instances starting from
  //    the same state give the same ids.
  const damaged = copy(seeded);
  const stripped = damaged.queue_items.slice(-3);
  for (const i of stripped) delete i.id;
  const a0 = damaged.assignments[0], t0 = damaged.queue_items.find((i) => i.queue_id === a0.queue_id).test_id;
  damaged.overrides.push({ assignment_id: a0.id, test_id: t0, expected: 1001, warn: 2001, fail: 3001, tol_mode: 'absolute' },   // synthetic markers
    { assignment_id: damaged.assignments[1].id, test_id: t0, expected: 1002, warn: 2002, fail: 3002, tol_mode: 'absolute' });
  damaged.seq.audit -= 3;
  delete damaged.seq.overrides;
  {
    const p = load(damaged);
    await p.start();
    const s = p.store.state;
    checkIds(s, 'start-up over a state with rows without an id');
    const n = damaged.seq.queue_items;
    assert.deepEqual(s.queue_items.slice(-3).map((i) => i.id), [n + 1, n + 2, n + 3], 'the next ids, in table order');
    assert.deepEqual(s.overrides.map((o) => o.id), [1, 2], 'a missing counter starts from the largest id (none)');
    for (const t of TABLES) if (t !== 'audit') {
      assert.deepEqual(s[t].map(withoutId), damaged[t].map(withoutId), `${t}: nothing in the rows changed but the ids given`);
      damaged[t].forEach((r, i) => { if (r.id != null) assert.equal(s[t][i].id, r.id, `${t}: an id already there moved`); });
    }
    assert.deepEqual(s.audit.slice(0, damaged.audit.length), damaged.audit);
    const logged = s.audit.slice(damaged.audit.length);
    assert.deepEqual(logged.map((x) => [x.action, x.entity, JSON.parse(x.detail)]), [['upgrade', 'ids', { given: { queue_items: 3, overrides: 2 } }]], 'logged once');
    assert.ok(logged[0].id > Math.max(...damaged.audit.map((x) => x.id)), 'the log row has an id of its own');

    const other = load(damaged);
    await other.start();
    assert.equal(withoutTimes(other.store.state), withoutTimes(s), 'another instance gives the same ids');

    const repaired = copy(s), again = load(repaired);
    await again.start();
    assert.equal(JSON.stringify(again.store.state), JSON.stringify(repaired), 'a second start-up changes nothing');
  }

  // 6. Restore (Data Administration) of the same state: what the restore stores already has its ids, and the
  //    restore's own audit row does not reuse an id (the counter was behind).
  {
    const p = load(seeded);
    await p.start();
    await p.api('POST', '/api/restore', { exported_at: 'synthetic', state: damaged });
    const s = p.store.state;
    checkIds(s, 'restore of a state with rows without an id');
    assert.equal(s.audit.at(-1).action, 'restore');
    // The overrides counter was missing: the next values for a machine still get proper ids.
    const tpl = await p.api('GET', `/api/assignments/${a0.id}/template`);
    const numeric = tpl.items.find((i) => i.type === 'numeric');
    await p.api('PUT', `/api/assignments/${a0.id}/overrides`, { overrides: [{ test_id: numeric.test_id, expected: 1003, warn: 2003, fail: 3003, tol_mode: 'absolute' }] });   // synthetic markers
    checkIds(p.store.state, 'values for a machine after the restore');
  }

  // 7. Every kind of write a session makes keeps every row's id its own.
  {
    const p = load(seeded);
    const admin = await p.start();
    const write = async (label, method, path, body) => {
      const x = await p.api(method, path, body);
      checkIds(p.store.state, label);
      return x;
    };
    const day = '2026-11-02';
    const machine = (await write('new machine', 'POST', '/api/machines', { name: 'Synthetic Gantry', kind: 'Proton gantry' })).id;
    const m = (await p.api('GET', '/api/machines')).find((x) => x.id === machine);
    await write('machine edited', 'PUT', `/api/machines/${machine}`, { ...m, notes: 'synthetic' });
    const list = (await write('new list', 'POST', '/api/queues', { name: 'Synthetic list', items: [] })).id;
    const t1 = (await write('new numeric check', 'POST', '/api/tests', { name: 'Synthetic reading', type: 'numeric', unit: 'mm', owner_queue_id: list, expected: 0, warn: 1, fail: 2 })).id;   // synthetic markers
    const t2 = (await write('new yes/no check', 'POST', '/api/tests', { name: 'Synthetic check done?', type: 'boolean', owner_queue_id: list })).id;
    await write('list saved', 'PUT', `/api/queues/${list}`, { name: 'Synthetic list', items: [{ test_id: t1 }, { test_id: t2 }] });
    const test = (await p.api('GET', '/api/tests')).find((x) => x.id === t1);
    await write('check edited', 'PUT', `/api/tests/${t1}`, { ...test, description: 'Synthetic directions.' });
    await write('list from a starter', 'POST', '/api/templates', { name: 'Synthetic starter copy', starter: seed.templates[0].name });
    await write('list from checks', 'POST', '/api/templates', { name: 'Synthetic checklist', tests: [{ name: 'Synthetic item', type: 'boolean' }] });
    const dup = (await write('list duplicated', 'POST', `/api/queues/${list}/duplicate`, { name: 'Synthetic list copy' })).id;
    await write('list renamed', 'POST', `/api/queues/${dup}/rename`, { name: 'Synthetic list copy renamed' });
    const sched = (await write('list scheduled', 'POST', '/api/assignments', { machine_id: machine, queue_id: list, frequency: 'daily', weekdays: [0, 1, 2, 3, 4], start_date: '2026-10-01' })).id;
    await write('values for this machine', 'PUT', `/api/assignments/${sched}/overrides`, { overrides: [{ test_id: t1, expected: 1, warn: 2, fail: 3, tol_mode: 'absolute' }] });   // synthetic markers
    await write('values for this machine again', 'PUT', `/api/assignments/${sched}/overrides`, { overrides: [{ test_id: t1, expected: 4, warn: 5, fail: 6, tol_mode: 'absolute' }, { test_id: t2, expected: null, warn: null, fail: null }] });
    await write('draft saved', 'PUT', `/api/assignments/${sched}/draft`, { qa_date: day, comment: 'synthetic', results: [] });
    const run = (await write('run submitted', 'POST', `/api/assignments/${sched}/runs`, { qa_date: day, results: [{ test_id: t1, value: 4.5 }, { test_id: t2, value: 'yes' }] })).id;
    await write('draft cleared', 'POST', `/api/assignments/${sched}/draft/clear`, {});
    // A run is reviewed by someone other than the person who performed it.
    const reviewer = (await write('user added', 'POST', '/api/users', { username: 'synthetic.physicist', full_name: 'Synthetic Physicist', role: 'physicist', password: globalThis.crypto.randomUUID() })).id;
    p.signIn(reviewer);
    await write('run reviewed', 'POST', `/api/runs/${run}/review`, { decision: 'approved', comment: 'synthetic' });
    p.signIn(admin);
    const run2 = (await write('second run', 'POST', `/api/assignments/${sched}/runs`, { qa_date: '2026-11-03', results: [{ test_id: t1, value: 4 }] })).id;
    await write('run trashed', 'POST', `/api/runs/${run2}/trash`, { trashed: true, reason: 'synthetic' });
    await write('run restored', 'POST', `/api/runs/${run2}/trash`, { trashed: false });
    await write('past imports recorded', 'POST', '/api/runs/record-history', { until: day, assignment_id: sched });
    await write('list re-evaluated', 'POST', `/api/queues/${list}/reevaluate`, {});
    await write('schedule re-evaluated', 'POST', `/api/assignments/${sched}/reevaluate`, {});
    await write('checks for this machine', 'PUT', `/api/assignments/${sched}/tests`, { excluded: [t2], added: [] });
    await write('schedule duplicated', 'POST', `/api/assignments/${sched}/duplicate`, { name: 'Synthetic machine list' });
    await write('schedule archived', 'POST', `/api/assignments/${sched}/archive`, { archived: true });
    await write('schedule restored', 'POST', `/api/assignments/${sched}/archive`, { archived: false });
    await write('list archived', 'POST', `/api/queues/${dup}/archive`, { archived: true });
    await write('list deleted', 'POST', `/api/queues/${dup}/delete`, {});
    await write('user edited', 'PUT', `/api/users/${reviewer}`, { full_name: 'Synthetic Physicist Two', role: 'physicist', active: true });
    const backup = await p.api('GET', '/api/backup');
    await write('restore', 'POST', '/api/restore', backup);
    // And the next start-up over all of it.
    const next = load(p.store.state);
    await next.start();
    checkIds(next.store.state, 'start-up after the session');
    assert.deepEqual(p.errors, []);
  }

  console.log('Every row GatorQA keeps in a table has an id of its own: start-up passes, the start-up repair, restore and every kind of write.');
})().catch((e) => { console.error(e); process.exit(1); });
