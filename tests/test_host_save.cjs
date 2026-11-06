// Synthetic-only checks of save() in the browser backend (docs/local-backend.js) in node:vm: a page hosting these
// rules may set window.QA_HOST.saveState, and each save then hands it the live state instead of putting a copy in
// the browser's storage. Without it (or with only QA_HOST.browserFolders) a save stores a copy, as before.
// Run with node tests/test_host_save.cjs from the repository root.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const LIBS = ['xlsx.full.min.js', 'wl-import.js', 'derived.js', 'mapped-import.js', 'seed-data.js', 'monthly-workbook-data.js', 'local-backend.js']
  .map((f) => [f, fs.readFileSync(`docs/${f}`, 'utf8')]);

/* The rules in a context of their own over an empty IndexedDB. `host`: window.QA_HOST, or none. Every put is recorded
 * by key; console.error calls are recorded; saves run as soon as the request settles (the 150 ms debounce kept). */
function load(host) {
  const store = {}, puts = [], errors = [], events = [], timers = new Set();
  let userId = null;
  const later = (req, fn) => queueMicrotask(() => { try { req.result = fn(); req.onsuccess && req.onsuccess(); } catch (err) { req.error = err; req.onerror && req.onerror(); } });
  const objectStore = {
    get(k) { const r = {}; later(r, () => store[k]); return r; },
    put(v, k) { const r = {}; later(r, () => { puts.push(k); store[k] = v; }); return r; },
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
  if (host !== undefined) ctx.QA_HOST = host;
  ctx.window = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  for (const [f, text] of LIBS) vm.runInContext(text, ctx, { filename: f });
  const settle = async () => {
    while (timers.size) await new Promise((r) => setImmediate(r));
    for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
  };
  // One request, then whatever save it scheduled. Answers are copied into this realm.
  const api = async (method, path, body) => {
    const x = await ctx.localApi(method, path, body || {}, {});
    events.push(`answered ${method} ${path}`);
    return x === undefined ? x : JSON.parse(JSON.stringify(x));
  };
  return { ctx, store, puts, errors, events, settle, api, signIn: (id) => { userId = id; } };
}

/* Sign in as the seeded Admin (the browser build keeps the signed-in id in sessionStorage), and find a list to save a
 * draft of. The first request seeds the portal, which is a save. */
async function start(p) {
  for (let id = 1; id < 20; id++) {
    p.signIn(id);
    const me = await p.api('GET', '/api/me').catch(() => null);
    await p.settle();
    if (me && me.user && me.user.role === 'admin') {
      const machines = await p.api('GET', '/api/machines');
      const gtr1 = machines.find((m) => m.name === 'GTR1');
      const list = (await p.api('GET', `/api/machines/${gtr1.id}/assignments`))[0];
      return list.id;
    }
  }
  throw new Error('no seeded admin account');
}
const draft = (n) => ({ qa_date: '2026-11-05', comment: `synthetic ${n}`, results: [] });

(async () => {
  // 1. No QA_HOST, and a QA_HOST without saveState: a save puts a copy of the state under "state", as before.
  for (const host of [undefined, { browserFolders: false }]) {
    const p = load(host);
    const list = await start(p);
    const before = p.puts.filter((k) => k === 'state').length;
    assert.ok(before >= 1, 'seeding saved the state');
    await p.api('PUT', `/api/assignments/${list}/draft`, draft(1));
    await p.settle();
    assert.equal(p.puts.filter((k) => k === 'state').length, before + 1, 'one save, one put');
    const stored = p.store.state;
    const text = JSON.stringify(stored);
    assert.match(text, /synthetic 1/);
    await p.api('PUT', `/api/assignments/${list}/draft`, draft(2));
    assert.equal(JSON.stringify(stored), text, 'the stored value is a copy: a later change does not reach it');
    await p.settle();
    assert.notEqual(p.store.state, stored, 'the next save puts a new copy');
    assert.match(JSON.stringify(p.store.state), /synthetic 2/);
    assert.deepEqual(p.errors, []);
  }

  // 2. QA_HOST.saveState: called after the handler, once per debounced save, with the live state; "state" never put.
  {
    const got = [];
    let p;
    p = load({ browserFolders: false, saveState(S) { got.push(S); p.events.push('saveState'); } });
    const list = await start(p);
    assert.ok(got.length >= 1, 'seeding handed the state over');
    assert.ok(!p.puts.includes('state'), 'nothing put under "state"');
    got.length = 0; p.events.length = 0;

    await p.api('PUT', `/api/assignments/${list}/draft`, draft(1));
    await p.settle();
    assert.deepEqual(p.events, [`answered PUT /api/assignments/${list}/draft`, 'saveState'], 'called after the handler answered');
    assert.equal(got.length, 1);
    const first = got[0];
    assert.equal(Object.getPrototypeOf(first), vm.runInContext('Object.prototype', p.ctx), 'the state itself, not a copy made here');

    // Two requests before the save runs: one debounced save, one call.
    got.length = 0; p.events.length = 0;
    await Promise.all([p.api('PUT', `/api/assignments/${list}/draft`, draft(2)), p.api('GET', '/api/dashboard')]);
    await p.settle();
    assert.equal(got.length, 1, 'once per debounced save');
    assert.equal(p.events.at(-1), 'saveState');
    assert.equal(got[0], first, 'the same live state on both saves');
    assert.match(JSON.stringify(first), /synthetic 2/, 'the second request\'s change is on it');
    assert.doesNotMatch(JSON.stringify(first), /synthetic 1"/, 'and the first draft was replaced on it');
    assert.ok(!p.puts.includes('state'), 'still nothing put under "state"');
    assert.deepEqual(p.errors, []);

    // A page view saves nothing: no call.
    got.length = 0;
    await p.api('GET', `/api/assignments/${list}/draft`);
    await p.settle();
    assert.equal(got.length, 0);
  }

  // 3. A saveState that throws: caught and logged as "Could not save"; the request still answers. A host must never
  //    throw, since that save is then lost.
  {
    const p = load({ saveState() { throw new Error('synthetic host failure'); } });
    const list = await start(p);
    p.errors.length = 0;
    const answer = await p.api('PUT', `/api/assignments/${list}/draft`, draft(3));
    await p.settle();
    assert.ok(answer, 'the request answered');
    assert.equal(p.errors.length, 1);
    assert.match(p.errors[0], /^Could not save .*synthetic host failure/);
    assert.ok(!p.puts.includes('state'), 'nothing put under "state"');
  }

  console.log('save() puts a copy without QA_HOST.saveState, and hands a hosting page the live state with it.');
})().catch((e) => { console.error(e); process.exit(1); });
