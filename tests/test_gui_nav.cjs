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
assert.equal(line({ expected: 100, warn: 0.5, fail: 1, tol_mode: 'absolute' }, 'mm'), 'WARNING ±0.5 mm · ACTION ±1 mm');
assert.equal(line({ expected: 0, warn: null, fail: 1, tol_mode: 'percent' }, 'mGy'), 'ACTION ±1 %');
assert.equal(line({ expected: 12, warn: null, fail: null, tol_mode: 'absolute' }, 'mm'), null, 'no limits: nothing, not "No limits"');
assert.equal(line({ expected: null, warn: null, fail: null }, ''), null);
assert.equal(line({ criterion: 'wl-max-delta' }, 'mm'), 'PASS < 1 mm · FAIL ≥ 1 mm');
assert.equal(line({ warn: 2, fail: 3 }, undefined), 'WARNING ±2 · ACTION ±3');
assert.match(between('    const measureTable = (members,', '      const numberCell = (it) =>'), /const limitsLine = \(it, unit\) => \(it\.type === "numeric" \? qaLimitsLine\(it\.limits, unit\) : null\);/);
assert.doesNotMatch(review, /limitsText/, 'the saved run no longer says "No limits" or repeats the baseline in its limits line');
assert.match(review, /r\.type==='numeric'\?qaLimitsLine\(limits,unit\):null/);
assert.match(review, /\[p\.r\.expected!=null\?`Baseline \$\{fmt\(p\.r\.expected\)\}`:null,qaLimitsLine\(p\.limits,p\.unit\)\?\.textContent\]\.filter\(Boolean\)\.join\(' · '\)/);
assert.match(review, /const original=r\.value_num==null\|\|r\.value_num&&!run\.therapist_approved_by\?'':r\.value_num\?'pass':'fail';/);
const runPage = between('async function renderRun(', 'function bandValue(');
assert.match(runPage, /page\(`\$\{run\.machine_name\} · \$\{run\.queue_name\}`, shortDate\(run\.qa_date\)/);
assert.match(runPage, /const back = can\('review'\)\|\|can\('therapist_approve'\) \? \['#\/review','Back to Review QA'\] : \['#\/perform-qa','Back to Perform QA'\];/);
assert.doesNotMatch(runPage, /'Review results'|test below/);
assert.match(runPage, /therapistMode&&run\.therapist_approval_required&&run\.review_status==='pending'\?/);
assert.match(fs.readFileSync('portal/static/app.css', 'utf8'), /\.review-section \.measure-wrap \{ margin:12px; width:auto; \}/);

// 4. Approve opens the next run waiting for this physicist: never this run, their own, one not ready, or one waiting for a
// therapist's sign-off; an Admin (not acting as a physicist) skips runs that need one.
{
  const ctx = { state: { user: { id: 5 } }, role: 'physicist' };
  vm.createContext(ctx);
  vm.runInContext(`function activeRole() { return role; }\n${between('const mayApprove =', 'function bandValue(')}\nthis.next = nextToApprove; this.may = mayApprove;`, ctx);
  const r = (id, more = {}) => ({ id, review_status: 'pending', review_ready: true, performed_by: 9, therapist_approval_required: false, therapist_approved_by: null, ...more });
  const runs = [r(10), r(11, { performed_by: 5 }), r(12, { review_ready: false }), r(13, { therapist_approval_required: true }), r(14, { review_status: 'approved' }),
    r(15, { therapist_approval_required: true, therapist_approved_by: 2 }), r(16)];
  assert.equal(ctx.next(runs, '10').id, 15, 'skips this run, own runs, review_ready false, unsigned therapist runs and decided runs');
  assert.equal(ctx.next(runs, 15).id, 10);
  ctx.role = 'admin';
  assert.equal(ctx.next(runs, 10).id, 16, 'an Admin not acting as a physicist does not approve therapist-signed runs');
  assert.equal(ctx.next([r(10)], 10), undefined, 'none left');
  assert.equal(ctx.next([], 10), undefined);
  const decide = between('      const decide = (decision) => async () => {', '      const actions=el(');
  assert.match(decide, /nextToApprove\(await api\("GET", "\/api\/runs\?review_status=pending&limit=400"\)\.catch\(\(\) => \[\]\), id\);\s*location\.hash = next \? `#\/runs\/\$\{next\.id\}` : "#\/review";/);
  assert.match(decide, /if \(decision !== "approved"\) \{ toast\("Rejected"\); route\(\); return; \}/, 'Reject stays and redraws');
  assert.match(runPage, /can\("review"\) && mayApprove\(run\)\) \{/);
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
  assert.match(css, /\.runs-filters select \{ width:auto; max-width:100%; \}/);
  const phone = [...css.matchAll(/#app\[data-page="review"\]([^,{\n]*)/g)].map((m) => m[1]);
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

// 2. A new page opens at its top; a new query on the same page keeps the place; every hash change still draws the page.
async function navigation() {
  const listeners = {}, routes = [];
  let scrolls = [];
  // route() empties the page while it loads, so the browser is back at the top until the page is drawn again.
  const nav = { location: { hash: '#/perform-qa' }, window: { addEventListener: (type, fn) => { listeners[type] = fn; } }, URLSearchParams, routeGen: 0, scrollY: 0, requestAnimationFrame: (fn) => fn(),
    scrollTo: (x, y) => { scrolls.push([x, y]); nav.scrollY = y; }, route: async () => { nav.routeGen++; nav.scrollY = 0; routes.push(nav.location.hash); } };
  vm.createContext(nav);
  vm.runInContext(between('// A new page opens at its top;', 'api("GET", "/api/me")'), nav);
  const change = async (hash, y = 1200) => { nav.scrollY = y; scrolls = []; nav.location.hash = hash; await listeners.hashchange(); return scrolls; };
  assert.deepEqual(await change('#/perform/1'), [[0, 0]], 'a new page opens at its top');
  assert.deepEqual(await change('#/perform-qa', 5000), [[0, 0]]);
  assert.deepEqual(await change('#/trends?a=1'), [[0, 0]]);
  assert.deepEqual(await change('#/trends?a=2', 1500), [[0, 1500]], 'a new query on the same page keeps the place once drawn');
  assert.deepEqual(await change('#/trends?a=2&test_id=7', 1500), [[0, 0]], "one test's trend opens at its top");
  assert.deepEqual(await change('#/trends?a=2&test_id=8', 900), [[0, 0]]);
  assert.deepEqual(await change('#/trends?a=3&test_id=8', 900), [[0, 900]]);
  assert.deepEqual(await change('#/trends?a=3', 900), [[0, 0]]);
  assert.deepEqual(await change('#/runs?machine_id=1'), [[0, 0]]);
  assert.deepEqual(await change('#/runs?machine_id=2', 0), [], 'nothing to keep at the top');
  assert.deepEqual(await change('#/review'), [[0, 0]]);
  assert.deepEqual(await change('#/review?stage=physics', 300), [[0, 300]]);   // the jump to the heading follows, in the next frame
  // Another page opened while this one loads: its place is not applied there.
  nav.route = async () => { nav.routeGen += 2; routes.push(nav.location.hash); };
  assert.deepEqual(await change('#/review?stage=therapy', 300), []);
  assert.deepEqual(routes, ['#/perform/1', '#/perform-qa', '#/trends?a=1', '#/trends?a=2', '#/trends?a=2&test_id=7', '#/trends?a=2&test_id=8', '#/trends?a=3&test_id=8', '#/trends?a=3',
    '#/runs?machine_id=1', '#/runs?machine_id=2', '#/review', '#/review?stage=physics', '#/review?stage=therapy'], 'route is always called');
  // Saving the shared list in the list editor redraws it where it was.
  assert.match(source, /if\(result\)\{location\.hash=`#\/queues\/\$\{result\.id\}`;if\(!isNew\)\{const y=scrollY;await route\(\);requestAnimationFrame\(\(\)=>scrollTo\(0,y\)\);\}\}else draw\(\);/);
}

(async () => {
  await navigation();
  console.log('GUI and navigation: History words; new pages open at the top.');
})().catch((e) => { console.error(e); process.exit(1); });
