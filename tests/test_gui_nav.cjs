// Synthetic checks for the GUI and navigation changes (display and navigation only). The real helpers run in node:vm;
// nothing here reads stored data. Run with node tests/test_gui_nav.cjs from the repository root.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('portal/static/app.js', 'utf8');
assert.equal(fs.readFileSync('docs/app.js', 'utf8'), source, 'docs/app.js is out of step: run python build_pages.py');
const between = (from, to) => { const a = source.indexOf(from), b = source.indexOf(to, a + 1); assert.ok(a >= 0 && b > a, `${from} … ${to}`); return source.slice(a, b); };
const context = {};
vm.createContext(context);
const run = (code) => vm.runInContext(code, context);
let markInProgress;   // section 10 sets it; it runs with the other async checks at the end

// 1. History shows the answer of a Pass / Fail or Yes / No test, never "1.000 Pass/Fail".
run(between('function answerWord(', '// Machine Trends shows numbers'));
assert.equal(context.answerWord('boolean', 'Yes/No', 1), 'Yes');
assert.equal(context.answerWord('boolean', 'Yes/No', 0), 'No');
assert.equal(context.answerWord('boolean', 'Pass/Fail', 0), 'Fail');
assert.equal(context.answerWord('boolean', 'Pass/Fail', 1), 'Pass');
assert.equal(context.answerWord('boolean', '', 1), 'Pass');
assert.equal(context.answerWord('status', '', null, 'warn'), 'Warning');
assert.equal(context.answerWord('status', '', null, 'recorded'), '—');
const form = between('      const histChips = (it, unit) => {', '      const refCell = (it, unit) =>');
assert.match(form, /answered \? el\("span", \{ class: `hist \$\{h\.status\}`, title: `\$\{dateLabel\(h\.qa_date\)\}: \$\{answerWord\(/);
const review = between('async function renderReviewMeasurements(', 'async function renderRun(');
assert.doesNotMatch(review, /h\.value\?'Pass':'Fail'/, 'the saved run uses the same words as the form');
assert.match(review, /fmt\(h\.value,dp\)/, 'the saved run History uses one decimal count per table');

// 3. A saved run: its title names the machine, its limits line reads as on the QA form, the therapist's own Yes on the
// form is not a sign-off, and the way back fits the role.
context.el = (tag, props, ...kids) => ({ tag, props: props || {}, textContent: kids.flat(Infinity).join('') });
run(between('function fmt(', '// A Pass / Fail or Yes / No answer'));
run(between('function qaLimitsLine(', 'const TYPE_LABELS'));
const line = (limits, unit) => context.qaLimitsLine(limits, unit)?.textContent ?? null;
assert.equal(line({ expected: 100, warn: 0.5, fail: 1, tol_mode: 'absolute' }, 'mm'), 'Warning ±0.5 mm · Action ±1 mm');
assert.equal(line({ expected: 0, warn: null, fail: 1, tol_mode: 'percent' }, 'mGy'), 'Action ±1 %');
assert.equal(line({ expected: 12, warn: null, fail: null, tol_mode: 'absolute' }, 'mm'), null, 'no limits: nothing, not "No limits"');
assert.equal(line({ expected: null, warn: null, fail: null }, ''), null);
assert.equal(line({ criterion: 'wl-max-delta' }, 'mm'), 'Pass < 1 mm · Action ≥ 1 mm');
assert.equal(line({ warn: 2, fail: 3 }, undefined), 'Warning ±2 · Action ±3');
assert.match(between('    const measureTable = (members,', '      const numberCell = (it) =>'), /const limitsLine = \(it, unit\) => \(it\.type === "numeric" \? qaLimitsLine\(it\.limits, unit\) : null\);/);
assert.doesNotMatch(review, /limitsText/, 'the saved run no longer says "No limits" or repeats the baseline in its limits line');
assert.match(review, /r\.type==='numeric'\?qaLimitsLine\(limits,unit\):null/);
assert.match(review, /\[p\.r\.expected!=null\?`Baseline \$\{fmt\(p\.r\.expected\)\}`:null,qaLimitsLine\(p\.limits,p\.unit\)\?\.textContent\]\.filter\(Boolean\)\.join\(' · '\)/);
assert.match(review, /const original=r\.value_num==null\|\|r\.value_num&&!run\.therapist_approved_by\?'':r\.value_num\?'pass':'fail';/);
const runPage = between('async function renderRun(', 'function bandValue(');
assert.match(runPage, /page\(`\$\{run\.machine_name\} · \$\{run\.queue_name\}`, shortDate\(run\.qa_date\)/);
// The way back is where the run was opened from: Perform QA after Submit (or a last result there), Machine Trends from
// a chart (tests/test_gui_nav_3.cjs), otherwise Review QA, the tab that holds runs, for every role (an MPA who opened it
// from Review QA goes back there).
assert.match(runPage, /const back = from === 'perform' \? \['#\/perform-qa', 'Perform QA'\] : from === 'trends' \? \[`#\/trends\?machine_id=\$\{run\.machine_id\}&list=\$\{run\.assignment_id\}`, 'Machine Trends'\] : \['#\/review', 'Review QA'\];/);
assert.match(runPage, /el\("a",\{class:"button",href:back\[0\],onclick:backClick\},`Back to \$\{back\[1\]\}`\)/);
assert.match(runPage, /`\$\{therapistMode&&run\.therapist_approved_by&&run\.review_ready!==false\?'Done — back':'Back'\} to \$\{back\[1\]\}`/);
assert.doesNotMatch(runPage, /can\('review'\)\|\|can\('therapist_approve'\) \?/, 'not by role');
assert.match(source, /location\.hash = `#\/runs\/\$\{result\.id\}\?from=perform`;/, 'Submit opens the run with the way back to Perform QA');
assert.match(source, /href: `#\/runs\/\$\{last\.id\}\?from=perform` \}, shortDate\(last\.qa_date\)/, 'so does a last result on Perform QA');
assert.doesNotMatch(runPage, /'Review results'|test below/);
// The bottom bar speaks only to a therapist with a sign-off to give; otherwise the button alone (the status is shown above,
// and a run in Trash is not "Awaiting" anything).
assert.match(runPage, /role:'status'\},therapistMode&&!run\.trashed_at&&run\.therapist_approval_required&&run\.review_status==='pending'\?\(.*?\):null\)/);
assert.doesNotMatch(runPage, /reviewStatusText\(run\)/, 'the bar does not repeat the review status');
assert.match(fs.readFileSync('portal/static/app.css', 'utf8'), /\.review-section \.measure-wrap \{ margin:12px; width:auto; \}/);

// 4. Approve opens the next run waiting for this physicist: never this run, their own, one not ready, or one waiting for a
// therapist's sign-off; an Admin (not acting as a physicist) skips runs that need one.
{
  const ctx = { state: { user: { id: 5 } }, role: 'physicist' };
  vm.createContext(ctx);
  vm.runInContext(`function activeRole() { return role; }\n${between('const mayApprove =', 'function bandValue(')}\nthis.next = nextToApprove; this.may = mayApprove;`, ctx);
  const r = (id, more = {}) => ({ id, review_status: 'pending', review_ready: true, performed_by: 9, therapist_approval_required: false, therapist_approved_by: null, ...more });
  // Newest first, as the API and Review QA list them (qa_date, then id, descending).
  const day = (d) => `2026-11-${String(d).padStart(2, '0')}`;
  const runs = [r(16, { qa_date: day(9) }), r(10, { qa_date: day(8) }), r(11, { qa_date: day(7), performed_by: 5 }), r(12, { qa_date: day(6), review_ready: false }),
    r(13, { qa_date: day(5), therapist_approval_required: true }), r(14, { qa_date: day(4), review_status: 'approved' }),
    r(15, { qa_date: day(3), therapist_approval_required: true, therapist_approved_by: 2 }), r(9, { qa_date: day(3) })];
  const at = (id) => runs.find((x) => x.id === id);
  assert.equal(ctx.next(runs, at(10)).id, 15, 'the next one down: skips this run, own runs, review_ready false, unsigned therapist runs and decided runs');
  assert.equal(ctx.next(runs, at(16)).id, 10, 'from the top, the one below');
  assert.equal(ctx.next(runs, at(15)).id, 9, 'same date: the lower id comes next');
  assert.equal(ctx.next(runs, at(9)).id, 16, 'after the last one, back to the top');
  assert.equal(ctx.next(runs.filter((x) => x.id !== 10), at(10)).id, 15, 'the approved run is no longer in the list');
  ctx.role = 'admin';
  assert.equal(ctx.next(runs, at(10)).id, 9, 'an Admin not acting as a physicist does not approve therapist-signed runs');
  assert.equal(ctx.next([r(10, { qa_date: day(8) })], at(10)), undefined, 'none left');
  assert.equal(ctx.next([], at(10)), undefined);
  assert.match(runPage, /can\("review"\) && mayApprove\(run\)\) \{/);
}

// 4. Approve and Reject: sent once (the buttons stay off until the next page is drawn); a page opened while the decision
// is on its way stays as it is (the decision still finishes with its toast); a refused decision can be sent again.
async function decisions() {
  const decideSource = between('      const decide = (decision) => async () => {', '      const buttons = [');
  const make = ({ left = false, fail = false, decision = 'approved' } = {}) => {
    const log = [];
    const ctx = { routeGen: 1, state: { user: { id: 5 } }, location: { hash: '#/runs/10' }, error: { textContent: '' }, comment: { value: '' }, id: '10',
      run: { id: 10, qa_date: '2026-11-08' }, buttons: [{ disabled: false }, { disabled: false }], toast: (t) => log.push(`toast ${t}`), route: () => { log.push('route'); },
      nextToApprove: (list, run) => list.find((x) => x.id !== run.id), log };
    ctx.api = async (method, path) => {
      log.push(`${method} ${path}`);
      if (method === 'POST') { if (left) ctx.routeGen++; if (fail) throw new Error('Refused'); return {}; }
      return [{ id: 10 }, { id: 9 }];
    };
    vm.createContext(ctx);
    vm.runInContext(`${decideSource}\nthis.decide = decide;`, ctx);
    return { ctx, go: () => ctx.decide(decision)() };
  };
  let t = make();
  await t.go();
  assert.equal(t.ctx.location.hash, '#/runs/9', 'Approve opens the next run');
  assert.deepEqual(t.ctx.buttons.map((b) => b.disabled), [true, true], 'and its buttons stay off while it loads');
  t = make({ left: true });
  await t.go();
  assert.equal(t.ctx.location.hash, '#/runs/10', 'another page was opened meanwhile: no jump to the next run');
  assert.deepEqual(t.ctx.log, ['POST /api/runs/10/review', 'toast Approved'], 'the approval still finishes with its toast, and no list is read');
  t = make({ fail: true });
  await t.go();
  assert.deepEqual([t.ctx.error.textContent, t.ctx.buttons.map((b) => b.disabled), t.ctx.location.hash], ['Refused', [false, false], '#/runs/10'], 'refused: say so, try again');
  t = make({ decision: 'rejected' });
  await t.go();
  assert.deepEqual(t.ctx.log, ['POST /api/runs/10/review', 'toast Rejected', 'route'], 'Reject stays on the run and redraws it');
  t = make({ decision: 'rejected', left: true });
  await t.go();
  assert.deepEqual(t.ctx.log, ['POST /api/runs/10/review', 'toast Rejected'], 'not the page opened meanwhile');
}

// 5. Review QA: your role's queue first, Trash last, one heading style, no buttons in the rows, one empty text.
{
  const reviewPage = between('async function renderReview()', 'async function renderRuns()');
  assert.doesNotMatch(source, /reviewRowActions/);
  assert.doesNotMatch(fs.readFileSync('portal/static/app.css', 'utf8'), /qa-review-actions/);
  assert.match(reviewPage, /app\.append\(can\("review"\) \? \[physics, therapy\] : \[therapy, physics\],/);
  assert.ok(reviewPage.indexOf('"Recently reviewed"') < reviewPage.indexOf('`Trash ('), 'Trash comes last');
  assert.equal((reviewPage.match(/"Nothing is waiting for review\."/g) || []).length, 1, 'one empty text for both queues');
  assert.doesNotMatch(reviewPage, /You are caught up/);
  assert.match(reviewPage, /const waitingCols = \[\["Date", "14%"\], \["Machine", "14%"\], \["QA list", "36%"\], \["Performed by", "22%"\], \["Result", "14%"\]\];/);
  for (const cols of reviewPage.matchAll(/const \w+Cols = (\[\[.*?\]\]);/g)) assert.equal(JSON.parse(cols[1]).reduce((sum, [, w]) => sum + parseFloat(w), 0), 100, cols[1]);
}

// 6. Past results: the year once, the limit stated with a way to the rest, filters on one line, phone cards.
{
  const runsPage = between('async function renderRuns()', '// A self-contained PDF exporter');
  assert.doesNotMatch(runsPage, /qa_date\.slice\(0, 4\)/, 'shortDate already has the year');
  assert.match(runsPage, /page\("Past results", "Newest first\."\);/);
  assert.match(runsPage, /el\("form", \{ class: "row runs-filters" \}/);
  assert.match(runsPage, /fixedTable\(\[\["Date", "18%"\], \["Machine", "14%"\], \["QA list", "38%"\], \["Result", "12%"\], \["Review", "18%"\]\]/);
  assert.match(runsPage, /`Newest \$\{runs\.length\} shown\.`, limit < 1000 \?/);
  const css = fs.readFileSync('portal/static/app.css', 'utf8');
  // On a phone the three filters keep the full width (stacked, one width), as before; side by side above it.
  assert.match(css, /@media \(min-width: 641px\) \{ \.runs-filters select \{ width:auto; max-width:100%; \} \}/);
  assert.doesNotMatch(css.replace(/@media \(min-width: 641px\) \{[^\n]*\n/, ''), /\.runs-filters select/);
  // Review QA's two queue headings are as wide as the tables under them (both builds).
  assert.match(css, /#app\[data-page="review"\] \.modality-head \{ max-width: none; \}/);
  const phone = [...css.matchAll(/#app\[data-page="review"\]([^,{\n]*)/g)].map((m) => m[1]).filter((rule) => !/modality-head/.test(rule));   // Past results has no queue headings
  for (const rule of phone) assert.ok(css.includes(`#app[data-page="runs"]${rule}`), `phone card rule for Past results: ${rule}`);
}

// 7. Calmer tables and form: no zebra or vertical rules, no grey "Recorded" chip in result cells, "Choose…", a trend
// button only for a measured value (and no empty Trends field on phones).
{
  const css = fs.readFileSync('portal/static/app.css', 'utf8');
  assert.doesNotMatch(css, /\.fixed-table tbody tr:nth-child\(even\) td \{ background: color-mix/);
  assert.doesNotMatch(css, /^th \+ th, td \+ td \{ border-left: 1px/m);
  assert.match(css, /\.measure-table \.status-cell \.chip\.recorded \{ display:none; \}/);
  assert.match(css, /\.fixed-table tbody tr:hover td \{ background: var\(--surface-2\); \}/, 'the hover highlight stays');
  assert.equal(fs.readFileSync('docs/app.css', 'utf8'), css, 'docs/app.css is out of step: run python build_pages.py');
  assert.doesNotMatch(source, /Choose an answer…/);
  assert.match(source, /choiceOptions\(item\.description\)\.length\?'Choose…':/);
  assert.match(source, /el\("td", \{class:"qa-trends"\}, main\.it\.type === "numeric" \? trend : null\)\);/);
  assert.match(source, /if \(!cell\.firstChild\) return;/);
  assert.match(source, /phoneDrawer\(extras, secondary\.filter\(cell=>cell\.firstChild\)\.map\(cell=>cell\.firstChild\), 'Comment, history & trends'\);/);
}

// 8. Machine Trends: fewer words; a ring with nothing judged shows "—", not "0% passed"; category headings without "_".
{
  run(`const CATEGORY_LABEL = { Spot: "Spot Characteristics" };\n${between('const categoryLabel =', '\n')}\nthis.categoryLabel = categoryLabel;`);
  assert.equal(context.categoryLabel('AI_PBS_Daily_Imaging'), 'AI PBS Daily Imaging');
  assert.equal(context.categoryLabel('Spot'), 'Spot Characteristics');
  assert.equal(context.categoryLabel(''), '');
  assert.equal(context.categoryLabel(null), null);
  const ring = { el: (tag, props, ...kids) => ({ tag, props: props || {}, kids: kids.flat(Infinity).filter((k) => k != null && k !== false) }) };
  vm.createContext(ring);
  vm.runInContext(`${between('function trendPassCounts(', 'function trendStatistics(')}\nthis.ring = trendPassRing; this.breakdown = trendPassBreakdown;`, ring);
  const words = (n) => (typeof n === 'object' ? n.kids.map(words).join(' ') : String(n));
  // Rings are green / red only: a measurement with no Warning or Action (nothing judged) has no ring, never "0% passed".
  assert.equal(ring.ring([{ status: 'recorded' }, { status: 'recorded' }], 'Air Pressure [kPa]'), null);
  assert.equal(ring.ring([], 'Nothing'), null);
  const mixed = ring.ring([{ status: 'pass' }, { status: 'recorded' }], 'Mixed');
  assert.equal(words(mixed), '50% passed', 'mixed cases are unchanged');
  assert.equal(ring.breakdown([{ label: 'X', points: [{ status: 'recorded' }] }]), null, 'no rings: no "Pass rate by energy"');
  assert.deepEqual(ring.breakdown([{ label: 'X', points: [{ status: 'recorded' }] }, { label: 'Y', points: [{ status: 'pass' }] }]).kids.map((k) => k.kids[0].kids[0]), ['Y'], 'only the judged ones');
  const panels = between("      const panels = ['X', 'Y'].map(axis => {", '      }).filter(Boolean);');
  assert.match(panels, /breakdown && el\('details', \{ class: 'small' \}, el\('summary', \{\}, 'Pass rate by energy'\), breakdown\)/);
  // Another machine or QA list opens at its top (newPage()); a new period keeps the place.
  const head = between('async function renderTrends()', 'app.querySelector(".page-head").classList.add("sticky-head", "trends-head");');
  assert.equal((head.match(/onchange: \(?e\)? => \{ newPage\(\); go\(\{ machine_id: /g) || []).length, 2, 'machine and list');
  assert.doesNotMatch(head.slice(head.indexOf('select("range"')), /newPage/, 'not the period');
  const trends = between('async function renderTrendOverview(', 'function renderTrendDetail(') + between('async function renderTrends()', '// Users, audit, account');
  assert.doesNotMatch(trends, /Pass rate for the selected period|Organized by QA list|Charts use each result/);
  assert.doesNotMatch(fs.readFileSync('portal/static/app.css', 'utf8'), /trend-pass-explainer/);
}

// 9. Setup: one list of lists (Setup QA), "Values for this machine", one machine order (GTR1 first, as on the Dashboard).
{
  assert.doesNotMatch(source, /master copy|Instantiate|async function renderQueues\(/);
  // An old #/queues link becomes #/setup, so the address, the page's layout (data-page) and its phone cards are Setup QA's.
  assert.match(source, /\[\/\^#\\\/queues\$\/, \(\) => location\.replace\("#\/setup"\)\],/);
  assert.match(source, /el\("a", \{ class: "button", href: "#\/setup" \}, "Back"\),\s*saveBtn = /);
  assert.doesNotMatch(source, /Set tolerances for this machine|Adjust limits for this machine|`Limits: \$\{/);
  // "tolerances" is left only in the list editor's Machine-Specific Tolerances dialog (a Playwright test names it).
  const left = source.split('\n').filter((l) => /tolerances/.test(l) && !/^\s*\/\//.test(l));
  assert.ok(left.every((l) => /machine-tolerances|MachineTolerances|open machine tolerances/.test(l)), left.join('\n'));
  run(`const MODALITIES = ["Proton", "Photon", "Brachytherapy", "Simulation"];\n${between('const modalityOf =', '// A table with fixed column widths')}\nthis.machineOrder = machineOrder;`);
  const machines = [['MRI Sim', 'MRI simulator'], ['Ethos', 'Varian Ethos'], ['GTR5', 'Proton gantry'], ['Eyeline GTR4', 'Proton eyeline'], ['HDR Flexitron', 'HDR brachytherapy'],
    ['Big Bore CT (7064)', 'CT simulator'], ['GTR1', 'Proton gantry'], ['TrueBeam', 'Linac'], ['GTR2', 'Proton gantry']].map(([name, kind]) => ({ name, kind }));
  assert.deepEqual(machines.sort(context.machineOrder).map((m) => m.name), ['GTR1', 'GTR2', 'GTR5', 'Eyeline GTR4', 'TrueBeam', 'Ethos', 'HDR Flexitron', 'Big Bore CT (7064)', 'MRI Sim']);
  assert.equal((source.match(/\.slice\(\)\.sort\(machineOrder\)/g) || []).length, 3, 'Machine Trends, Past results and Record past imports');
}

// 10. Buttons that finish what they say: Mark in Progress saves, then goes back to Perform QA (a failed save stays on the
// form); a refused backup shows its error.
{
  const button = between('  const saveDraft = el(', '  const footer = el(');
  markInProgress = async (outcome) => {
    const ctx = { routeGen: 3, location: { hash: '#/perform/8' }, draftNote: { textContent: 'Unsaved changes' }, toasts: [], clearTimeout() {}, autosaveTimer: 0,
      el: (tag, props) => ({ tag, props }) };
    ctx.toast = (t) => ctx.toasts.push(t);
    ctx.persistDraft = async () => { if (outcome === 'left') ctx.routeGen++; ctx.draftNote.textContent = outcome === 'failed' ? 'Not saved - use Mark in Progress' : 'Saved 10:00:00'; };
    vm.createContext(ctx);
    vm.runInContext(`${button}\nthis.saveDraft = saveDraft;`, ctx);
    await ctx.saveDraft.props.onclick();
    return [ctx.location.hash, ctx.toasts.join()];
  };
  const backup = source.slice(source.indexOf('}, "Save backup")') - 700, source.indexOf('}, "Save backup")'));
  assert.match(backup, /catch \(err\) \{\s*toast\(err\.message, true\);/);
}

// The list editor opened read-only (a therapist or MPA following a link) never shows "null" under Import blocks.
assert.match(source, /importBlocksBox\.replaceChildren\(\.\.\.present\(\[el\('h2',\{\},'Import blocks'\),/);

// 2. A new page opens at its top as it is drawn (not before it has loaded); Back and Forward return to where a page was
// left; a new query on the same page keeps the place; another machine or list on Machine Trends opens at its top; every
// hash change still draws the page.
async function navigation() {
  let log = [];
  const entries = [{ hash: '#/perform-qa', state: null }];
  let at = 0;
  const nav = { location: { hash: '#/perform-qa' }, window: { addEventListener: (type, fn) => { nav.listeners[type] = fn; } }, listeners: {}, URLSearchParams, URL, Map, Math,
    routeGen: 0, topOnDraw: null, scrollY: 0, requestAnimationFrame: (fn) => fn(), routes: [],
    history: { scrollRestoration: 'auto', get state() { return entries[at].state; }, replaceState(state) { entries[at].state = state; } },
    scrollTo: (x, y) => { log.push([x, y]); nav.scrollY = y; },
    app: { style: { removeProperty() {} }, dataset: {}, replaceChildren() {} }, el: () => ({}),
    // route() empties the page and draws it (page()) once its data is in.
    route: async () => { nav.routeGen++; nav.routes.push(nav.location.hash); await null; log.push('draw'); nav.page('Page'); } };
  vm.createContext(nav);
  vm.runInContext(`${between('const qaTableObservers = new Set();', 'function table(')}\nthis.page = page;`, nav);
  vm.runInContext(`${between('// A new page opens at its top', 'api("GET", "/api/me")')}\nthis.newPage = newPage;`, nav);
  assert.equal(nav.history.scrollRestoration, 'manual', 'GatorQA puts the place back itself');
  // The browser's hashchange event names the address it left (oldURL).
  const arrive = async (old) => { log = []; await nav.listeners.hashchange({ oldURL: `http://127.0.0.1/gatorqa/index.html${old}` }); return log; };
  const change = async (hash, y = 1200) => { const old = nav.location.hash; nav.scrollY = y; entries.splice(at + 1, Infinity, { hash, state: null }); at++; nav.location.hash = hash; return arrive(old); };
  const back = async (y) => { const old = nav.location.hash; nav.scrollY = y; at--; nav.location.hash = entries[at].hash; return arrive(old); };
  const forward = async (y) => { const old = nav.location.hash; nav.scrollY = y; at++; nav.location.hash = entries[at].hash; return arrive(old); };
  assert.deepEqual(await change('#/perform/1'), ['draw', [0, 0]], 'a new page opens at its top, as it is drawn');
  // Each new entry notes the GatorQA page it was opened from (gatorqaFrom), which the Back buttons go Back to; the page
  // the tab opened on (a bookmark, a link from elsewhere) came from none, so its Back buttons follow their links.
  assert.equal(entries[0].state.gatorqaFrom, undefined, 'opened on its own: from no GatorQA page');
  assert.equal(entries[1].state.gatorqaFrom, '#/perform-qa', 'a new entry: the page it was opened from');
  assert.deepEqual(await change('#/perform-qa', 5000), ['draw', [0, 0]]);
  assert.deepEqual(await change('#/trends?a=1'), ['draw', [0, 0]]);
  assert.deepEqual(await change('#/trends?a=2', 1500), ['draw', [0, 1500]], 'a new query on the same page keeps the place once drawn');
  assert.deepEqual(await change('#/trends?a=2&test_id=7', 1500), ['draw', [0, 0]], "one test's trend opens at its top");
  assert.deepEqual(await change('#/trends?a=2&test_id=8', 900), ['draw', [0, 0]]);
  assert.deepEqual(await change('#/trends?a=3&test_id=8', 900), ['draw', [0, 900]]);
  assert.deepEqual(await change('#/trends?a=3', 900), ['draw', [0, 0]]);
  nav.scrollY = 1500; nav.newPage();
  assert.deepEqual(await change('#/trends?a=3&machine_id=2', 1500), ['draw', [0, 0]], 'another machine or list on Machine Trends opens at its top');
  assert.deepEqual(await change('#/trends?a=4&machine_id=2', 1500), ['draw', [0, 1500]], 'then a new period keeps the place again');
  assert.deepEqual(await change('#/runs?machine_id=1'), ['draw', [0, 0]]);
  assert.deepEqual(await change('#/runs?machine_id=2', 0), ['draw', [0, 0]], 'nothing to keep at the top');
  assert.deepEqual(await change('#/review'), ['draw', [0, 0]]);
  assert.deepEqual(await change('#/review?stage=physics', 300), ['draw', [0, 300]]);   // the jump to the heading follows, in the next frame
  // Back and Forward: the place the page was left (the argument), once it is drawn again.
  assert.deepEqual(await change('#/runs/5', 3000), ['draw', [0, 0]]);
  assert.deepEqual(await back(800), ['draw', [0, 3000]], 'Back to Review QA: where it was left');
  assert.deepEqual(await forward(100), ['draw', [0, 800]], 'Forward to the run: where it was left');
  assert.deepEqual(await back(900), ['draw', [0, 100]], 'Review QA was last left at 100');
  assert.deepEqual(await back(3000), ['draw', [0, 300]]);
  assert.deepEqual([nav.location.hash, nav.history.state.gatorqaFrom], ['#/review', '#/runs?machine_id=2'], 'Back and Forward keep where an entry came from');
  assert.deepEqual(await change('#/runs/7', 300), ['draw', [0, 0]], 'a new page after Back: at its top');
  assert.deepEqual(await back(0), ['draw', [0, 300]]);
  // Another page opened while this one loads: its place is not applied there, and the page drawn meanwhile is not moved.
  nav.route = async () => { nav.routeGen += 2; nav.routes.push(nav.location.hash); };
  assert.deepEqual(await change('#/review?stage=therapy', 300), []);
  assert.deepEqual(await change('#/setup', 300), []);
  assert.deepEqual(nav.routes, ['#/perform/1', '#/perform-qa', '#/trends?a=1', '#/trends?a=2', '#/trends?a=2&test_id=7', '#/trends?a=2&test_id=8', '#/trends?a=3&test_id=8', '#/trends?a=3',
    '#/trends?a=3&machine_id=2', '#/trends?a=4&machine_id=2', '#/runs?machine_id=1', '#/runs?machine_id=2', '#/review', '#/review?stage=physics', '#/runs/5', '#/review?stage=physics',
    '#/runs/5', '#/review?stage=physics', '#/review', '#/runs/7', '#/review', '#/review?stage=therapy', '#/setup'], 'route is always called');
  // A redraw of the same page (route() after a save) does not move it.
  log = []; nav.route = async () => { nav.routeGen++; nav.page('Page'); };
  await nav.route();
  assert.deepEqual(log, []);
}

// The list editor's Save finishes, also when the editor was opened with a query (#/queues/6?assignment=1): a new address
// is drawn by the hashchange listener (which keeps the place on the same list), only the same address is drawn here.
async function editorSave() {
  const tail = between('      // Saving keeps your place in the list', 'saveTemplateChanges=save;').replace(/\s*\};\s*$/, '');   // the end of save()
  const make = (hash) => {
    const ctx = { location: {}, routeGen: 0, scrollY: 4000, drawn: [], scrolls: [], setTimeout, requestAnimationFrame: (fn) => fn(), toast() {} };
    // As api(): a page's reads never settle once another page (or the same page again) is being drawn.
    ctx.route = () => { const gen = ++ctx.routeGen; ctx.drawn.push(ctx.location.hash); return new Promise((done) => setTimeout(() => { if (gen === ctx.routeGen) done(); }, 5)); };
    let current = hash;
    Object.defineProperty(ctx.location, 'hash', { get: () => current, set: (v) => { if (v !== current) { current = v; setTimeout(() => ctx.route(), 0); } } });   // hashchange
    ctx.scrollTo = (x, y) => ctx.scrolls.push(y);
    ctx.draw = () => ctx.drawn.push('draw');
    vm.createContext(ctx);
    vm.runInContext(`this.tail = async (result, isNew) => {\n${tail}\n};`, ctx);
    return ctx;
  };
  const settles = (promise) => Promise.race([promise.then(() => true), new Promise((r) => setTimeout(() => r(false), 60))]);
  let ctx = make('#/queues/6?assignment=1');
  assert.equal(await settles(ctx.tail({ id: 6 }, false)), true, 'opened with a query: the save finishes (its dialog closes)');
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual([ctx.location.hash, ctx.drawn], ['#/queues/6', ['#/queues/6']], 'drawn once, by the hashchange listener');
  ctx = make('#/queues/6');
  assert.equal(await settles(ctx.tail({ id: 6 }, false)), true);
  assert.deepEqual([ctx.drawn, ctx.scrolls], [['#/queues/6'], [4000]], 'the same address: drawn here, where it was');
  ctx = make('#/queues/new');
  assert.equal(await settles(ctx.tail({ id: 7 }, true)), true);
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual([ctx.location.hash, ctx.drawn], ['#/queues/7', ['#/queues/7']], 'a new list opens at its address');
  ctx = make('#/queues/6');
  await ctx.tail(undefined, false);
  assert.deepEqual(ctx.drawn, ['draw'], 'machine values only: the editor is drawn again in place');
}


(async () => {
  await navigation();
  await editorSave();
  await decisions();
  assert.deepEqual(await markInProgress('saved'), ['#/perform-qa', 'Saved for later'], 'Mark in Progress: saved, back to Perform QA');
  assert.deepEqual(await markInProgress('failed'), ['#/perform/8', ''], "not saved: stay on the form (the note and the save's own toast say so)");
  assert.deepEqual(await markInProgress('left'), ['#/perform/8', 'Saved for later'], 'another page opened meanwhile: saved, no jump to Perform QA');
  console.log('GUI and navigation: History words, the saved run and its way back, the next run to approve (sent once, not after leaving), Review QA and Past results order, calmer tables, Machine Trends rings, Setup wording and machine order, Mark in Progress and Save backup; new pages open at the top as drawn, Back returns to the place, the editor save finishes.');
})().catch((e) => { console.error(e); process.exit(1); });
