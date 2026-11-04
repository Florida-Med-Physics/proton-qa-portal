// A therapist sign-off given before a run was recorded as history (POST /api/runs/record-history keeps it, but the run no
// longer asks for one) still shows on the run page and in the PDF report. app.js renderRun and qaReportPdf run under
// node:vm with a stand-in page, on synthetic runs only. Run with node tests/test_record_history_signoff.cjs from the
// repository root.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('portal/static/app.js', 'utf8');
assert.equal(fs.readFileSync('docs/app.js', 'utf8'), source, 'docs/app.js is out of step: run python build_pages.py');
const between = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));

const base = { id: 1, queue_name: 'Synthetic Sphinx daily', machine_name: 'Synthetic Gantry A', qa_date: '2026-10-02', overall: 'pass',
  performer_name: 'Synthetic Admin', performer: 'admin', performed_by: 1, performed_at: '2026-11-04T09:00:00', source: 'sphinx',
  comment: 'Imported from synthetic.xls. Sphinx finished 2026-10-02 06:00:00.', results: [], review_ready: true };
const signed = { therapist_approved_by: 2, therapist_approver_name: 'Synthetic Therapist', therapist_approved_at: '2026-10-02T07:00:00' };
const unsigned = { therapist_approved_by: null, therapist_approver_name: null, therapist_approved_at: null };
const runs = {
  recordedSigned: { ...base, ...signed, review_status: 'imported', therapist_approval_required: false },
  recordedUnsigned: { ...base, ...unsigned, review_status: 'imported', therapist_approval_required: false },
  waitingSigned: { ...base, ...signed, review_status: 'pending', therapist_approval_required: true },
};

// ---- the PDF report ----
const report = { Blob };
vm.createContext(report);
for (const part of [between('const REVIEW_LABEL', 'function reviewChip('), between('function capitalize(', 'function decimalsOf('), between('function qaReportPdf(', 'async function downloadQaReport')])
  vm.runInContext(part, report);
const reportLines = async (run) => (await report.qaReportPdf(run).text()).split('\n').map((l) => /^BT .*?\((.*)\) Tj ET$/.exec(l)?.[1]).filter((l) => /^(Therapist approval|Overall):/.test(l || ''));

// ---- the run page (renderRun), with a stand-in page that keeps the text of what it shows ----
const node = (tag, props = {}, kids = []) => ({ tag, props, kids: kids.flat(Infinity).filter((k) => k != null && k !== false && k !== '') });
const text = (n) => typeof n === 'string' ? n : (n.kids || []).map(text).join('');
let shown = [];
const page = {
  el: (tag, props, ...kids) => node(tag, props || {}, kids), page: () => {}, toast: () => {}, route: () => {}, downloadQaReport: async () => {},
  window: {}, qaTrashButton: () => null, personName: (name, user) => name || user, shortDate: (d) => d, chip: (s) => s, reviewChip: (run) => run.review_status,
  app: { append: (...n) => shown.push(...n), querySelectorAll: () => [], style: { setProperty() {} } },
  renderReviewMeasurements: async () => {}, can: (perm) => perm === 'review', activeRole: () => 'physicist', state: { user: { id: 99 } },
  queryParams: () => new URLSearchParams(''), requestAnimationFrame: () => {}, therapistReviewCheck: () => false,
  ResizeObserver: class { observe() {} }, qaTableObservers: new Set(),
};
vm.createContext(page);
vm.runInContext(between('async function renderRun(', 'function bandValue(') + '\nthis.renderRun = renderRun;', page);
async function runPage(run) {
  shown = [];
  page.api = async (method, path) => { assert.equal(`${method} ${path}`, `GET /api/runs/${run.id}`); return run; };
  await page.renderRun(run.id);
  const facts = shown.find((n) => n.tag === 'dl');
  const rows = [];
  for (let i = 0; i < facts.kids.length; i += 2) rows.push([text(facts.kids[i]), text(facts.kids[i + 1])]);
  return { facts: Object.fromEntries(rows), signedText: shown.map(text).filter((t) => t.includes('Signed by')).length };
}

(async () => {
  const signedBy = 'Signed by Synthetic Therapist · 2026-10-02 07:00:00';
  // Recorded as history after the therapist signed: the sign-off is still shown, once, beside the run's other facts.
  assert.deepEqual(await reportLines(runs.recordedSigned), ['Overall: PASS | Review: Historical import', 'Therapist approval: Synthetic Therapist | 2026-10-02T07:00:00']);
  const recorded = await runPage(runs.recordedSigned);
  assert.equal(recorded.facts['Therapist review'], signedBy);
  assert.equal(recorded.signedText, 1);
  // Never signed: nothing about a therapist, as before.
  assert.deepEqual(await reportLines(runs.recordedUnsigned), ['Overall: PASS | Review: Historical import']);
  const plain = await runPage(runs.recordedUnsigned);
  assert.equal('Therapist review' in plain.facts, false);
  assert.equal(plain.signedText, 0);
  // Still waiting with a sign-off: shown in the review card only, as before.
  assert.deepEqual(await reportLines(runs.waitingSigned), ['Overall: PASS | Review: Awaiting Physics Review', 'Therapist approval: Synthetic Therapist | 2026-10-02T07:00:00']);
  const waiting = await runPage(runs.waitingSigned);
  assert.equal('Therapist review' in waiting.facts, false);
  assert.equal(waiting.signedText, 1);
  console.log('A therapist sign-off kept on a run recorded as history shows on the run page and in the PDF report; other runs show as before.');
})().catch((e) => { console.error(e); process.exit(1); });
