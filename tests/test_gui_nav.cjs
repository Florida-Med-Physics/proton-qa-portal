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
