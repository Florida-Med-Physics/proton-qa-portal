// Perform QA is for doing QA: it shows the to-do count, the lists and "All past results", and no longer asks for or lists
// runs waiting for review (Review QA does). Synthetic dashboard data, renderDashboard run in node:vm with a tiny DOM stand-in.
// Run with node tests/test_perform_page.cjs from the repository root.
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const source = fs.readFileSync('portal/static/app.js', 'utf8');
const from = source.indexOf('async function renderDashboard('), to = source.indexOf("// Click a list's name", from);
assert(from >= 0 && to > from);
const node = (tag, props, ...kids) => ({ tag, props: props || {}, kids: kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false), dataset: {} });
const text = (n) => (n && typeof n === 'object' ? n.kids.map(text).join('') : String(n ?? ''));
const queue = (id, name, frequency, state) => ({ id, queue_name: name, frequency, state, schedule: frequency, last_run: null, history_counts: { pass: 3 } });
const dashboard = { today: '2026-11-04', machines: [
  { id: 1, name: 'GTR1', kind: 'Proton gantry', pending_review: 4, queues: [queue(1, 'PBS DailyQA Template - Sphinx', 'daily', 'overdue'), queue(2, 'Monthly QA template', 'monthly', 'ok')] },
  { id: 2, name: 'GTR5', kind: 'Proton gantry', pending_review: 2, queues: [queue(3, 'PBS DailyQA Template - Sphinx', 'daily', 'due')] }] };
for (const role of ['physicist', 'therapist']) {
  const calls = [], shown = [];
  const context = {
    api: async (method, path) => { calls.push(`${method} ${path}`); if (path === '/api/dashboard') return dashboard; return [{ id: 9, qa_date: '2026-11-02', machine_name: 'GTR1', queue_name: 'PBS DailyQA Template - Sphinx', overall: 'pass' }]; },
    applyDashboardRoleView: (d) => d, databaseBanner: async () => null, page: (title, sub) => shown.push(node('h1', {}, title, sub)),
    app: { append: (...kids) => shown.push(...kids) }, el: node, can: (right) => right === 'perform' || (role === 'physicist' && right === 'review'),
    chip: (status, label) => node('span', {}, label || status), table: (heads, rows) => node('table', {}, heads, rows), fixedTable: (cols, rows) => node('table', {}, cols.map((c) => c[0]), rows),
    modalityHead: (name, count) => node('h2', {}, name, ' ', count), machineLabel: (name) => node('span', {}, name), shortDate: (d) => d, personName: (a, b) => a || b,
    scheduleStatus: (q) => q.state, historyRing: () => node('a', {}), MODALITIES: ['Proton', 'Photon'], modalityOf: (kind) => (/proton/i.test(kind) ? 'Proton' : 'Photon'),
    kindRank: () => 0, FREQ_ORDER: { daily: 0, monthly: 1 }, Date,
  };
  vm.createContext(context);
  vm.runInContext(source.slice(from, to), context);
  (async () => {
    await context.renderDashboard();
    const page = shown.map(text).join('\n');
    assert.deepEqual(calls, ['GET /api/dashboard'], `${role}: only the dashboard is requested`);
    assert(!/review/i.test(page), `${role}: nothing about review on Perform QA`);
    assert(page.includes('2 QA lists to do.') && page.includes('All past results'), `${role}: to-do count and the past results link`);
    assert.equal((page.match(/PBS DailyQA Template - Sphinx/g) || []).length, 2); assert(page.includes('Monthly QA template'));
    console.log(`${role}: Perform QA shows the to-do count, the lists and All past results, and requests no pending runs.`);
  })().catch((e) => { console.error(e); process.exit(1); });
}
