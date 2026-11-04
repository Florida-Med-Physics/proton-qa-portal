// Fewer requests per page, same answers. Synthetic records only. The real app.js pages run in node:vm on a small stand-in
// DOM against the real browser backend (docs/local-backend.js, its own node:vm), and every request is recorded with the
// round trip ("step") it went out in: requests sent before any of them is answered share a step. On the shared site every
// request is a server call with its own fixed cost, and requests in a row add up, so these numbers are what to keep low:
//   Dashboard and Review QA one request; Machine Trends 3 steps of one request each (on one list), nothing asked twice;
//   a run's review one request after the run; Data Administration, Setup QA and Machines one request; Submit one save.
//   No page sends two requests side by side: on such a site the second would need a second server, which may first have
//   to start or catch up with the latest records. (A batch, GET /api/batch, is shown as its paths.)
// The backend answers are checked too: GET /api/assignments is every machine's GET /api/machines/:id/assignments in
// GET /api/machines order; GET /api/batch answers each path as it would be answered on its own; POST .../runs with
// clear_draft: true clears that person's draft of that list in the same save (tests/test_page_requests.py checks the
// server build). Run with node tests/test_page_requests.cjs from the
// repository root.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// ── A stand-in DOM: elements, text, attributes, classes, simple selectors (tag, #id, .class, [attr], [attr=v], :not(),
// :disabled, :first-child, descendant and child combinators, comma lists). Enough for the pages below; no layout.
function dom() {
  const compile = (text) => split(text, ',').map((group) => {
    const parts = []; let s = group.trim(), comb = ' ';
    while (s) {
      if (s[0] === '>') { comb = '>'; s = s.slice(1).trimStart(); continue; }
      let i = 0, depth = 0, quote = null;
      for (; i < s.length; i++) { const c = s[i]; if (quote) { if (c === quote) quote = null; } else if (c === '"' || c === "'") quote = c; else if (c === '(' || c === '[') depth++; else if (c === ')' || c === ']') depth--; else if (!depth && (c === ' ' || c === '>')) break; }
      parts.push({ comb, test: compound(s.slice(0, i)) }); s = s.slice(i).trimStart(); comb = ' ';
    }
    return parts;
  });
  const split = (s, sep) => { const out = []; let depth = 0, cur = ''; for (const c of s) { if (c === '(' || c === '[') depth++; if (c === ')' || c === ']') depth--; if (c === sep && !depth) { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out; };
  function compound(s) {
    const tests = [], re = /([a-zA-Z][\w-]*|\*)|#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]*)))?\]|:not\(((?:[^()]|\([^()]*\))*)\)|:([\w-]+)/y;
    for (let i = 0; i < s.length;) {
      re.lastIndex = i; const m = re.exec(s); if (!m) throw new Error(`stand-in DOM: selector "${s}"`); i = re.lastIndex;
      if (m[1]) { if (m[1] !== '*') tests.push((n) => n.localName === m[1].toLowerCase()); }
      else if (m[2]) tests.push((n) => n.getAttribute('id') === m[2]);
      else if (m[3]) tests.push((n) => n.classList.contains(m[3]));
      else if (m[4]) { const v = m[5] ?? m[6] ?? m[7]; tests.push((n) => n.hasAttribute(m[4]) && (v === undefined || n.getAttribute(m[4]) === v)); }
      else if (m[8] !== undefined) { const inner = compile(m[8]); tests.push((n) => !matches(n, inner)); }
      else if (m[9] === 'disabled') tests.push((n) => !!n.disabled);
      else if (m[9] === 'first-child') tests.push((n) => n.parentNode && n.parentNode.children[0] === n);
      else throw new Error(`stand-in DOM: :${m[9]}`);
    }
    return (n) => n.nodeType === 1 && tests.every((t) => t(n));
  }
  const chain = (n, parts, k) => parts[k].test(n) && (k === 0 || (parts[k].comb === '>' ? !!n.parentElement && chain(n.parentElement, parts, k - 1)
    : (() => { for (let p = n.parentElement; p; p = p.parentElement) if (chain(p, parts, k - 1)) return true; return false; })()));
  const matches = (n, groups) => groups.some((parts) => chain(n, parts, parts.length - 1));
  class Node {
    constructor(type) { this.nodeType = type; this.childNodes = []; this.parentNode = null; }
    get parentElement() { return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null; }
    get firstChild() { return this.childNodes[0] || null; }
    get isConnected() { let n = this; while (n.parentNode) n = n.parentNode; return n === document; }
    remove() { if (this.parentNode) { this.parentNode.childNodes.splice(this.parentNode.childNodes.indexOf(this), 1); this.parentNode = null; } }
  }
  class Text extends Node { constructor(t) { super(3); this.data = String(t); } get textContent() { return this.data; } set textContent(v) { this.data = String(v); } }
  class Comment extends Node { constructor(t) { super(8); this.data = String(t); } get textContent() { return ''; } }
  class Element extends Node {
    constructor(tag, svg) {
      super(1); this.localName = svg ? tag : tag.toLowerCase(); this.svg = !!svg; this.attrs = new Map(); this.props = {}; this.listeners = {}; this.dataset = {};
      const styles = new Map();
      this.style = new Proxy({}, { get: (_, k) => (k === 'setProperty' ? (a, b) => styles.set(a, b) : k === 'removeProperty' ? (a) => styles.delete(a) : styles.get(k) ?? ''), set: (_, k, v) => { styles.set(k, v); return true; } });
      const classes = () => (this.getAttribute('class') || '').split(/\s+/).filter(Boolean);
      this.classList = { contains: (c) => classes().includes(c), add: (...c) => this.setAttribute('class', [...new Set([...classes(), ...c])].join(' ')),
        remove: (...c) => this.setAttribute('class', classes().filter((x) => !c.includes(x)).join(' ')),
        toggle: (c, force) => { const on = force === undefined ? !classes().includes(c) : !!force; if (on) this.classList.add(c); else this.classList.remove(c); return on; } };
    }
    get tagName() { return this.svg ? this.localName : this.localName.toUpperCase(); }
    get className() { return this.getAttribute('class') || ''; } set className(v) { this.setAttribute('class', v); }
    get id() { return this.getAttribute('id') || ''; }
    get hidden() { return this.hasAttribute('hidden'); } set hidden(v) { if (v) this.setAttribute('hidden', ''); else this.removeAttribute('hidden'); }
    get value() { if (this.props.value !== undefined) return this.props.value; if (this.localName === 'select') { const o = this.querySelectorAll('option'); return (o.find((x) => x.hasAttribute('selected')) || o[0] || { value: '' }).value; } return this.localName === 'textarea' ? this.textContent : this.attrs.get('value') ?? (this.localName === 'option' ? this.textContent : ''); }
    set value(v) { this.props.value = String(v); }
    get checked() { return this.props.checked ?? this.hasAttribute('checked'); } set checked(v) { this.props.checked = !!v; }
    get disabled() { return this.props.disabled ?? this.hasAttribute('disabled'); } set disabled(v) { this.props.disabled = !!v; }
    get open() { return this.props.open ?? this.hasAttribute('open'); } set open(v) { this.props.open = !!v; }
    get type() { return this.getAttribute('type') || ''; } get name() { return this.getAttribute('name') || ''; }
    get href() { return this.getAttribute('href') || ''; } set href(v) { this.setAttribute('href', v); }
    set title(v) { this.setAttribute('title', v); } set download(v) { this.setAttribute('download', v); }
    set tabIndex(v) { this.props.tabIndex = v; }
    setAttribute(k, v) { k = String(k).toLowerCase(); this.attrs.set(k, String(v)); if (k.startsWith('data-')) this.dataset[k.slice(5).replace(/-(.)/g, (_, c) => c.toUpperCase())] = String(v); }
    getAttribute(k) { k = String(k).toLowerCase(); return this.attrs.has(k) ? this.attrs.get(k) : null; }
    hasAttribute(k) { return this.attrs.has(String(k).toLowerCase()); }
    removeAttribute(k) { this.attrs.delete(String(k).toLowerCase()); }
    get children() { return this.childNodes.filter((n) => n.nodeType === 1); }
    get tBodies() { return this.children.filter((n) => n.localName === 'tbody'); }
    get elements() { return this.querySelectorAll('input, select, textarea, button'); }
    adopt(kid) { const n = kid instanceof Node ? kid : new Text(kid); n.remove(); n.parentNode = this; return n; }
    append(...kids) { for (const k of kids) this.childNodes.push(this.adopt(k)); }
    appendChild(k) { this.append(k); return k; }
    prepend(...kids) { this.childNodes.unshift(...kids.map((k) => this.adopt(k))); }
    replaceChildren(...kids) { for (const n of this.childNodes.splice(0)) n.parentNode = null; this.append(...kids); }
    insertBefore(n, ref) { if (!ref) return this.appendChild(n); const x = this.adopt(n); this.childNodes.splice(this.childNodes.indexOf(ref), 0, x); return n; }
    before(...kids) { const p = this.parentNode; for (const k of kids) { const x = p.adopt(k); p.childNodes.splice(p.childNodes.indexOf(this), 0, x); } }
    after(...kids) { const p = this.parentNode; let at = p.childNodes.indexOf(this) + 1; for (const k of kids) { const x = p.adopt(k); p.childNodes.splice(at++, 0, x); } }
    get textContent() { return this.childNodes.map((n) => n.textContent).join(''); }
    set textContent(v) { this.replaceChildren(); if (v !== '' && v != null) this.append(String(v)); }
    addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); }
    removeEventListener(t, fn) { this.listeners[t] = (this.listeners[t] || []).filter((f) => f !== fn); }
    dispatchEvent(e) { e.target ||= this; for (const fn of this.listeners[e.type] || []) fn.call(this, e); return true; }
    click() { this.dispatchEvent({ type: 'click', preventDefault() {}, stopPropagation() {} }); }
    focus() {} blur() {} scrollIntoView() {} showModal() { this.open = true; } close() { this.open = false; } setCustomValidity() {} reportValidity() { return true; }
    getBoundingClientRect() { return { x: 0, y: 0, top: 0, left: 0, right: 800, bottom: 20, width: 800, height: 20 }; }
    get offsetWidth() { return 800; } get offsetHeight() { return 20; } get clientWidth() { return 800; } get scrollWidth() { return 800; }
    getBBox() { return { x: 0, y: 0, width: 40, height: 12 }; } getComputedTextLength() { return 40; }
    querySelectorAll(sel) { const g = compile(sel), out = []; const walk = (n) => { for (const c of n.children) { if (matches(c, g)) out.push(c); walk(c); } }; walk(this); return out; }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    closest(sel) { const g = compile(sel); for (let n = this; n && n.nodeType === 1; n = n.parentElement) if (matches(n, g)) return n; return null; }
    matches(sel) { return matches(this, compile(sel)); }
  }
  const document = new Node(9);
  Object.assign(document, { hidden: false, activeElement: null,
    createElement: (t) => new Element(t), createElementNS: (ns, t) => new Element(t, true), createTextNode: (t) => new Text(t), createComment: (t) => new Comment(t),
    getElementById: (id) => document.documentElement.querySelector(`#${id}`), querySelector: (s) => document.documentElement.querySelector(s),
    querySelectorAll: (s) => document.documentElement.querySelectorAll(s), addEventListener() {}, removeEventListener() {} });
  document.documentElement = new Element('html'); document.documentElement.parentNode = document; document.childNodes.push(document.documentElement);
  document.body = new Element('body'); document.documentElement.append(document.body);
  for (const [id, tag, parent] of [['topbar', 'div'], ['nav', 'div', 'topbar'], ['who', 'div', 'topbar'], ['app', 'main'], ['toast', 'div']]) {
    const n = new Element(tag); n.setAttribute('id', id); (parent ? document.getElementById(parent) : document.body).append(n);
  }
  return { document, Node, Element };
}

// ── The browser backend, and app.js on top of it with every request recorded by step. ─────────────────────────────────
const NOW = Date.parse('2026-11-04T15:00:00Z');
class FixedDate extends Date { constructor(...a) { if (a.length) super(...a); else super(NOW); } static now() { return NOW; } }
function fakeIndexedDb() {
  const store = {};
  const later = (req, fn) => queueMicrotask(() => { try { req.result = fn(); req.onsuccess && req.onsuccess(); } catch (err) { req.error = err; req.onerror && req.onerror(); } });
  const objectStore = { get(k) { const r = {}; later(r, () => store[k]); return r; }, put(v, k) { const r = {}; later(r, () => { store[k] = v; }); return r; }, delete(k) { const r = {}; later(r, () => { delete store[k]; }); return r; } };
  const db = { createObjectStore() {}, transaction() { return { objectStore: () => objectStore }; } };
  return { open() { const r = {}; later(r, () => db); return r; } };
}
async function backend() {
  let userId = null;
  const ctx = { console, queueMicrotask, structuredClone, TextEncoder, TextDecoder, URL, URLSearchParams, atob, btoa, crypto: globalThis.crypto, setTimeout, clearTimeout, Date: FixedDate,
    indexedDB: fakeIndexedDb(), sessionStorage: { getItem: (k) => k === 'qa_portal_password_user' && userId ? String(userId) : null, setItem() {}, removeItem() {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
  ctx.window = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  for (const f of ['xlsx.full.min.js', 'wl-import.js', 'derived.js', 'mapped-import.js', 'seed-data.js', 'monthly-workbook-data.js', 'local-backend.js'])
    vm.runInContext(fs.readFileSync(`docs/${f}`, 'utf8'), ctx, { filename: f });
  const call = (method, path, body, options) => ctx.localApi(method, path, body || {}, options || {});
  const api = (method, path, body) => call(method, path, body).then((x) => x === undefined ? x : JSON.parse(JSON.stringify(x)));
  const users = [];
  for (let id = 1; id < 20; id++) { userId = id; const me = await api('GET', '/api/me').catch(() => null); if (me && me.user) users.push(me.user); }
  const as = (role) => { userId = users.find((u) => u.role === role).id; };
  as('admin');
  return { call, api, as };
}
function pages(B, { reply = (path, x) => x } = {}) {
  const { document, Node, Element } = dom();
  const pending = [], sent = [];   // sent: each request's body, in order
  const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
  const ctx = { console, document, Node, HTMLElement: Element, HTMLInputElement: function () {}, Date: FixedDate, URLSearchParams, TextEncoder, TextDecoder, Intl, structuredClone, queueMicrotask,
    location: { hash: '#/', reload() {} }, URL: { createObjectURL: () => 'blob:synthetic', revokeObjectURL() {} }, crypto: globalThis.crypto, atob, btoa,
    setTimeout: (fn, ms, ...a) => setTimeout(fn, Math.min(ms || 0, 5), ...a), clearTimeout, setInterval: () => 0, clearInterval() {},
    requestAnimationFrame: (fn) => setTimeout(fn, 0), sessionStorage: memory(), localStorage: memory(), indexedDB: fakeIndexedDb(),
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), ResizeObserver: class { observe() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} }, getComputedStyle: () => ({ getPropertyValue: () => '' }),
    Event: class { constructor(type) { this.type = type; } }, CustomEvent: class { constructor(type, o) { this.type = type; this.detail = o && o.detail; } },
    Blob: class {}, navigator: {}, scrollTo() {}, scrollX: 0, scrollY: 0, addEventListener() {}, removeEventListener() {}, dispatchEvent() {}, confirm: () => true,
    Math: Object.assign(Object.create(Math), { random: () => 0.5 }), QA_HOST: { browserFolders: false } };
  ctx.window = ctx; ctx.self = ctx;
  ctx.localApi = (method, path, body, options) => new Promise((resolve, reject) => pending.push({ method, path, body, options, resolve, reject }));
  vm.createContext(ctx);
  const copy = vm.runInContext('(text) => JSON.parse(text)', ctx);
  for (const f of ['theme.js', 'hdr-import.js', 'derived.js', 'wl-import.js', 'xlsx.full.min.js', 'mapped-import.js', 'monthly-workbook-data.js', 'monthly-workbooks.js', 'app.js'])
    vm.runInContext(fs.readFileSync(`portal/static/${f}`, 'utf8'), ctx, { filename: f });
  const settle = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 1)); };
  // Answers what the pages ask for, one step at a time, until they stop asking. Returns the steps, as "METHOD path".
  async function answer() {
    const steps = [];
    for (;;) {
      await settle();
      if (!pending.length) { await settle(); if (!pending.length) return steps; }
      const batch = pending.splice(0), step = [];
      steps.push(step);
      await Promise.allSettled(batch.map((r) => {
        const many = /^\/api\/batch\?paths=(.*)$/.exec(r.path);
        step.push(many ? `GET /api/batch [${JSON.parse(decodeURIComponent(many[1])).join(', ')}]` : `${r.method} ${r.path.replace(/(tests=)[\d,]+/, '$1…')}`);
        return B.call(r.method, r.path, r.body, { actingRole: r.options && r.options.actingRole }).then((x) => r.resolve(x === undefined ? x : copy(JSON.stringify(reply(r.path, x)))), (e) => r.reject(new Error(e.message)));
      }));
      sent.push(...batch.map((r) => r.body));
    }
  }
  const app = document.getElementById('app');
  return {
    app, document, answer, sent, run: (code) => vm.runInContext(code, ctx),
    async open(hash) {
      ctx.location.hash = hash;
      const done = vm.runInContext('route()', ctx), steps = await answer(); await done;
      const error = app.querySelector('.card.error'); assert.equal(error, null, `${hash}: ${error && error.textContent}`);
      return steps;
    },
  };
}

(async () => {
  const B = await backend();
  // Synthetic history: two dated runs on every active list of every active machine; then an archived list on GTR1 and a
  // retired machine (both keep their history).
  const machines = await B.api('GET', '/api/machines');
  for (const m of machines.filter((x) => x.active)) for (const a of (await B.api('GET', `/api/machines/${m.id}/assignments`)).filter((x) => x.active)) {
    const items = (await B.api('GET', `/api/assignments/${a.id}/template`)).items.filter((i) => i.type === 'numeric' && !/\[(?:calc|derived):/.test(i.description || '')).slice(0, 6);
    for (const qa_date of ['2026-10-27', '2026-11-03']) await B.api('POST', `/api/assignments/${a.id}/runs`, { qa_date, results: items.map((i) => ({ test_id: i.test_id, value: i.limits.expected ?? 1 })) });
  }
  const gtr1 = machines.find((m) => m.name === 'GTR1');
  const gtr1Lists = await B.api('GET', `/api/machines/${gtr1.id}/assignments`);
  const pbs = gtr1Lists.find((a) => a.active && /PBS DailyQA/.test(a.queue_name)), monthly = gtr1Lists.find((a) => a.active && a.id !== pbs.id);
  await B.api('POST', `/api/assignments/${monthly.id}/archive`, { archived: true });
  const retired = machines.filter((m) => m.active && m.id !== gtr1.id).at(-1);
  await B.api('PUT', `/api/machines/${retired.id}`, { ...retired, active: false });
  const trashed = (await B.api('GET', '/api/runs?limit=1'))[0];
  await B.api('POST', `/api/runs/${trashed.id}/trash`, { trashed: true });

  // GET /api/assignments: every machine's lists, machine by machine in GET /api/machines order.
  const ordered = await B.api('GET', '/api/machines'), all = await B.api('GET', '/api/assignments');
  const each = [];
  for (const m of ordered) each.push(...await B.api('GET', `/api/machines/${m.id}/assignments`));
  assert.deepEqual(all, each);
  assert.ok(all.some((a) => a.archived) && ordered.some((m) => !m.active), 'an archived list and a retired machine are included');

  // clear_draft: only with true, only this person's draft of this list, in the submit's own save.
  const draft = (id) => B.api('PUT', `/api/assignments/${id}/draft`, { qa_date: '2026-11-04', comment: 'synthetic', results: [] });
  const hasDraft = async (id) => (await B.api('GET', `/api/assignments/${id}/draft`)) !== null;
  const otherList = all.find((a) => a.active && a.machine_id !== gtr1.id && !ordered.find((m) => m.id === a.machine_id && !m.active));
  B.as('therapist'); await draft(pbs.id); await draft(otherList.id);
  B.as('physicist'); await draft(pbs.id);
  B.as('therapist');
  const submit = (body) => B.api('POST', `/api/assignments/${pbs.id}/runs`, { qa_date: '2026-11-04', results: [], ...body });
  assert.deepEqual(Object.keys(await submit({})), ['id', 'overall']);
  for (const clear_draft of ['true', 1, null, false]) assert.equal('draft_cleared' in await submit({ clear_draft }), false);
  assert.equal(await hasDraft(pbs.id), true);
  await assert.rejects(submit({ qa_date: '2026-11-05', clear_draft: true }), /future/);
  assert.equal(await hasDraft(pbs.id), true, 'a refused submit keeps the draft');
  const done = await submit({ clear_draft: true });
  assert.deepEqual(done, { id: done.id, overall: done.overall, draft_cleared: true });
  assert.deepEqual([await hasDraft(pbs.id), await hasDraft(otherList.id)], [false, true]);
  B.as('physicist'); assert.equal(await hasDraft(pbs.id), true, "another person's draft of the list stays");

  // GET /api/batch: each path answered, in order, as it would be on its own (errors word for word); what is refused.
  const single = (p) => B.api('GET', p).then((value) => ({ ok: true, value }), (e) => ({ ok: false, error: e.message }));
  const ask = (paths) => B.api('GET', `/api/batch?paths=${encodeURIComponent(JSON.stringify(paths))}`);
  const mix = ['/api/machines', `/api/assignments/${pbs.id}/template`, '/api/runs?limit=3', '/api/users', '/api/trend?machine_id=1', '/api/nothing', '/api/queues/999999', '/api/assignments'];
  for (const role of ['therapist', 'admin']) {
    B.as(role);
    const each = []; for (const p of mix) each.push(await single(p));
    assert.deepEqual(await ask(mix), each);
    assert.ok(each.some((r) => !r.ok) && each.some((r) => r.ok));
  }
  const refused = ['/api/me', '/api/batch', '/api/backup', '/api/dbfile', '/api/dbinfo', `/api/assignments/${pbs.id}/draft`, `/api/assignments/${pbs.id}/files`, `/api/assignments/${pbs.id}/file?path=x`];
  assert.deepEqual(await ask(refused), refused.map((p) => ({ ok: false, error: `${p.split('?')[0]} cannot be asked for in a batch.` })));
  for (const bad of [undefined, '', 'x', '[]', '{}', '[1]', '["api/machines"]', JSON.stringify(Array(21).fill('/api/machines'))])
    await assert.rejects(B.api('GET', `/api/batch${bad === undefined ? '' : `?paths=${encodeURIComponent(bad)}`}`), { message: 'paths: give a JSON list of 1 to 20 paths, each starting /api/.' });

  // The pages, as an Admin and as a Therapist.
  const batch = (...paths) => `GET /api/batch [${paths.join(', ')}]`;
  for (const role of ['admin', 'therapist']) {
    B.as(role);
    const P = pages(B);
    await P.answer();                                                                       // GET /api/me, then the Dashboard
    assert.deepEqual(await P.open('#/'), [[batch('/api/dashboard', '/api/runs?limit=400')]]);
    assert.deepEqual(await P.open('#/review'), [[batch('/api/runs?limit=400', '/api/runs?trashed=1&limit=200')]]);
    assert.match(P.app.textContent, /Trash \(\d+\)/);

    // Machine Trends: the machines and every machine's lists in one step, then each list's template, then the period's
    // history; one request at a time, nothing asked twice.
    const visible = (await B.api('GET', `/api/machines/${gtr1.id}/assignments`)).filter((a) => a.active && (role !== 'therapist' || a.frequency !== 'monthly'));
    const from = new FixedDate(); from.setDate(from.getDate() - 90);   // the default period, as rangeStart('90') gives it
    const day = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`;
    const trends = await P.open('#/trends');
    const templates = batch(...visible.map((a) => `/api/assignments/${a.id}/template`));
    assert.deepEqual(trends, [[batch('/api/machines', '/api/assignments')], [templates], [`GET /api/machines/${gtr1.id}/trends?from=${day}&page=start`]]);
    const shown = visible.find((a) => String(a.id) === P.app.querySelector('select[name=list]').value);   // the one list shown
    assert.deepEqual([...P.app.querySelectorAll('.trend-organized-list > h2')].map((h) => h.textContent), [shown.queue_name]);
    const testId = (await B.api('GET', `/api/assignments/${pbs.id}/template`)).items.find((i) => i.type === 'numeric').test_id;
    assert.deepEqual(await P.open(`#/trends?machine_id=${gtr1.id}&list=${pbs.id}&test_id=${testId}&range=365`),
      [[batch('/api/machines', '/api/assignments')], [templates], [`GET /api/trend?machine_id=${gtr1.id}&test_id=${testId}`]]);
    // Several tests (a group): their trends in one request, answered as each on its own.
    const groupIds = (await B.api('GET', `/api/assignments/${pbs.id}/template`)).items.filter((i) => i.type === 'numeric').slice(0, 3).map((i) => i.test_id);
    assert.deepEqual(await P.open(`#/trends?machine_id=${gtr1.id}&list=${pbs.id}&test_id=${groupIds.join(',')}&range=365`),
      [[batch('/api/machines', '/api/assignments')], [templates], [batch(...groupIds.map((id) => `/api/trend?machine_id=${gtr1.id}&test_id=${id}`))]]);

    // A run's review: the run, then its list's template and its tests' history in one request (shown as on the page,
    // each with its numbers and history).
    const run = (await B.api('GET', '/api/runs?limit=400')).find((r) => !r.trashed_at && r.assignment_id === pbs.id);
    const full = await B.api('GET', `/api/runs/${run.id}`);
    const tests = [...new Set(full.results.map((r) => r.test_id))].join(',');
    assert.ok(tests, 'the run has results');
    assert.deepEqual(await P.open(`#/runs/${run.id}`), [[`GET /api/runs/${run.id}`],
      [batch(`/api/assignments/${pbs.id}/template`, `/api/machines/${full.machine_id}/trends?tests=${tests}&until=${full.qa_date}&last=61`)]]);
    assert.ok(P.app.querySelectorAll('tbody tr').length >= full.results.length, 'every result is shown');

    // Data Administration: one step; the folder table lists each active machine's lists, as each machine's own reply has them.
    // (Then GET /api/dbfile for the browser build's database card, shown to a Physicist or Admin: answered in the page,
    // never sent to a server.)
    assert.deepEqual(await P.open('#/admin'), [[batch(...(role === 'admin' ? ['/api/users'] : []), '/api/machines', '/api/assignments')], ...(role === 'admin' ? [['GET /api/dbfile']] : [])]);
    const rows = P.app.querySelectorAll('table').at(-1).querySelectorAll('tbody tr').map((tr) => tr.children.slice(0, 2).map((td) => td.textContent).join(' · '));
    const expected = [];
    for (const m of ordered.filter((x) => x.active)) for (const a of await B.api('GET', `/api/machines/${m.id}/assignments`)) expected.push(`${m.name} · ${a.queue_name}`);
    assert.deepEqual(rows, expected);

    // apiBatch: more than 20 paths go as several batches side by side; an answer that failed is thrown, as on its own.
    const many = Array.from({ length: 25 }, (_, i) => `/api/runs?limit=${i + 1}`), asked = P.run(`apiBatch(${JSON.stringify(many)})`);
    assert.deepEqual((await P.answer()).map((step) => step.length), [2]);
    assert.deepEqual(JSON.parse(JSON.stringify(await asked)), await Promise.all(many.map((p) => B.api('GET', p))));
    const refusedHere = P.run('apiBatch(["/api/machines", "/api/users"])').then(() => null, (err) => err.message);
    await P.answer();
    assert.equal(await refusedHere, role === 'therapist' ? (await single('/api/users')).error : null);

    if (role === 'admin') {
      assert.deepEqual(await P.open('#/setup'), [[batch('/api/queues', '/api/machines', '/api/assignments')]]);
      assert.deepEqual(await P.open('#/machines'), [[batch('/api/machines', '/api/assignments', '/api/queues')]]);
      // Setup QA → a list → Schedule on machines: one request for every machine's schedules.
      await P.open(`#/queues/${pbs.queue_id}`);
      P.app.querySelectorAll('button').find((b) => b.textContent === 'Schedule on machines').click();
      assert.deepEqual(await P.answer(), [['GET /api/assignments']]);
      const ticked = P.document.body.querySelectorAll('dialog [name=machines]').filter((c) => c.checked).map((c) => Number(c.value));
      assert.deepEqual(ticked, all.filter((a) => a.queue_id === pbs.queue_id && a.active && ordered.find((m) => m.id === a.machine_id).active).map((a) => a.machine_id).sort((x, y) => ordered.findIndex((m) => m.id === x) - ordered.findIndex((m) => m.id === y)));
    }

    // Submit on the QA form: one save, which also clears the draft. A server that does not say it cleared the draft (an
    // older build) is asked to, as before.
    for (const older of [false, true]) {
      await draft(pbs.id);
      const Q = older ? pages(B, { reply: (path, x) => { if (/\/runs$/.test(path)) delete x.draft_cleared; return x; } }) : P;
      if (older) await Q.answer();
      await Q.open(`#/perform/${pbs.id}`);
      Q.app.querySelectorAll('button.primary').find((b) => b.textContent === 'Submit for review').click();
      const before = Q.sent.length, steps = await Q.answer();
      assert.deepEqual(steps, [[`POST /api/assignments/${pbs.id}/runs`], ...(older ? [[`POST /api/assignments/${pbs.id}/draft/clear`]] : [])]);
      assert.equal(Q.sent[before].clear_draft, true);
      assert.equal(await hasDraft(pbs.id), false);
    }
  }
  console.log("Dashboard, Review QA, Data Administration, Setup QA and Machines one request; Machine Trends 3 steps of one request, nothing asked twice; a run's review one request after the run; Submit one save that clears the draft (older servers: as before); GET /api/assignments is every machine's list; a batch answers each path as on its own.");
})().catch((e) => { console.error(e); process.exit(1); });
