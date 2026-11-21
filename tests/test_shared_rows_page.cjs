// Browser check of "Same row as the test above" on the browser build (docs/, seeded HDR Flexitron daily list with a
// synthetic baseline of 12 on TCS Sk and decay-table Sk, synthetic values, a fresh throwaway browser profile): Setup QA
// offers the box only where it can join; ticking it joins the TCS Sk / decay-table Sk / difference, console / ruler /
// difference and dwell-time sets; the QA form then shows each set as one numbered row of the table: the last test (the
// difference) is the row's value, under Measured with its baseline, unit and result in their columns, and the tests
// before it are answered beside their names in the Test column (name and unit, input, deviation, baseline, note); the
// difference follows the typed values with its verdict; its calculation details keep the equation's letters; the saved
// run shows one row with each note under its test; the PDF numbers alike; unticking gives back the same QA form, byte
// for byte. Headless
// Chrome or Edge over the DevTools protocol (no Playwright needed); skipped when neither is installed (set CHROME_PATH).
// Run with node tests/test_shared_rows_page.cjs from the repository root.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const browserPath = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => p && fs.existsSync(p));
if (!browserPath) { console.log('Skipped: no Chrome or Edge found (set CHROME_PATH).'); process.exit(0); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const docs = path.resolve('docs');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const file = path.join(docs, decodeURIComponent(new URL(req.url, 'http://x').pathname.replace(/^\/$/, '/index.html')));
  if (!file.startsWith(docs) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
});
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'shared-rows-'));
let browser;

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const site = `http://127.0.0.1:${server.address().port}/`;
  const port = 9300 + Math.floor(Math.random() * 600);
  browser = spawn(browserPath, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
  let target;
  for (let i = 0; i < 80 && !target; i++) { await sleep(250); target = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json()).then((l) => l.find((t) => t.type === 'page')).catch(() => null); }
  assert.ok(target, 'the browser started');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const waiting = new Map(), errors = [];
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); } else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; waiting.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const page = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result.result.value; };
  const until = async (expr, what) => { for (let i = 0; i < 240; i++) { if (await page(expr).catch(() => false)) return; await sleep(250); } throw new Error(`timed out: ${what || expr}`); };
  const go = async (hash, ready) => { await page(`location.hash = ${JSON.stringify(hash)}`); await sleep(300); await until(ready); await sleep(500); };
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: site });
  await until(`document.querySelector('[name=password]')`, 'the sign-in form');
  await page(`(() => { document.querySelector('[name=username]').value = 'Admin'; document.querySelector('[name=password]').value = 'Admin'; document.querySelector('button[type=submit]').click(); })()`);
  await until(`document.querySelector('nav') && !document.querySelector('[name=password]')`, 'signed in');
  const { assignment, queue } = await page(`(async () => { const ms = await localApi('GET', '/api/machines'); const m = ms.find((x) => x.name === 'HDR Flexitron');
    const a = (await localApi('GET', '/api/machines/' + m.id + '/assignments')).find((x) => /Daily QA – HDR Flexitron/.test(x.queue_name)); return { assignment: a.id, queue: a.queue_id }; })()`);
  const form = `#/perform/${assignment}`, formReady = `document.querySelectorAll('.hdr-qa-table tr[data-qa-entry]').length > 10`;
  const formHtml = () => page(`document.querySelector('#app').innerHTML`);
  const editorReady = `document.querySelectorAll('.list-editor tr.compact').length > 10`;
  const save = async () => {
    await page(`[...document.querySelectorAll('.template-save-bar button')].find((b) => b.textContent.startsWith('Save')).click()`);
    await until(`document.querySelector('.template-save-bar .chip.due')?.hidden !== false`, 'saved'); await sleep(1500);
  };
  // Setup QA offers the box only where it can join: not on the first test of a list or of a section (Big Bore CT: 1.01-4.01).
  const ct = await page(`localApi('GET', '/api/queues').then((qs) => qs.find((q) => /Big Bore CT/.test(q.name)).id)`);
  await go(`#/queues/${ct}`, editorReady);
  const boxes = await page(`[...document.querySelectorAll('.list-editor tr.compact')].map((r) => (r.querySelector('.inline-test-name strong')?.textContent || '') + (r.querySelector('.same-row') ? '[ ]' : ''))`);
  assert.deepEqual(boxes.filter((x) => x.endsWith('.01:')), ['1.01:', '2.01:', '3.01:', '4.01:'], 'no box on the first test of a section');
  assert.equal(boxes.filter((x) => x.endsWith('[ ]')).length, boxes.length - 4);
  // A synthetic baseline of 12 on TCS Sk and decay-table Sk (no limits), as on the user's list.
  await go(`#/queues/${queue}`, editorReady);
  assert.equal(await page(`(() => { let n = 0; for (const row of document.querySelectorAll('.list-editor tr.compact')) if (/— (TCS Sk|decay table Sk)$/.test(row.querySelector('.inline-test-name textarea')?.value || '')) {
    const x = row.children[3].querySelector('input[type=number]'); x.value = '12'; x.dispatchEvent(new Event('input')); x.dispatchEvent(new Event('change')); n++; } return n; })()`), 2);
  await save();
  await go(form, formReady);
  const before = await formHtml();
  assert.equal(await page(`document.querySelectorAll('.qa-shared').length`), 0, 'no shared rows on the seeded list');

  // Setup QA: tick "Same row as the test above" on the six tests, save.
  const joinNames = ['decay table Sk', 'Source air kerma strength — difference', 'ruler reading', 'console minus ruler', 'Dwell time — measured time', 'Dwell time — difference'];
  const tick = async (on) => {
    await go(`#/queues/${queue}`, editorReady);
    // Each click redraws the list, so the next box is looked up afresh.
    const clicked = await page(`(() => { let n = 0; for (let more = true; more;) { more = false; for (const row of document.querySelectorAll('.list-editor tr.compact')) {
      const name = row.querySelector('.inline-test-name textarea')?.value || '', box = row.querySelector('.same-row input');
      if (box && ${JSON.stringify(joinNames)}.some((x) => name.includes(x)) && box.checked !== ${on}) { box.click(); n++; more = true; break; } } } return n; })()`);
    assert.equal(clicked, 6);
    await save();
  };
  await tick(true);
  const editor = await page(`[...document.querySelectorAll('.list-editor tr.compact')].map((r) => (r.querySelector('.inline-test-name strong')?.textContent || '') + (r.querySelector('.same-row input')?.checked ? '+' : ''))`);
  assert.deepEqual(editor.slice(7, 14), ['1.08:', '+', '+', '1.09:', '1.10:', '+', '+'], 'Setup QA: a joined test has no number of its own');

  // The QA form: one row per set, numbered 1.08 / 1.10 / 1.18. A set is a row of the table: its last test is the row's
  // value (under Measured, with its own Baseline, Unit and Result cells); the tests before it are answered beside their
  // names in the Test column, each named with its unit, in list order. Names that start alike say those words once.
  await go(form, formReady);
  const rows = await page(`[...document.querySelectorAll('.hdr-qa-table tr[data-qa-entry]')].map((r) => [r.querySelector('.qa-n').textContent,
    r.querySelector('.qa-inline-title')?.textContent || '', [...r.querySelectorAll('.qa-inline-name')].map((n) => n.textContent),
    [...r.querySelectorAll('.qa-inline-field > input.result-input, td.qa-measured input.result-input')].map((i) => i.getAttribute('aria-label'))])`);
  assert.equal(rows.length, 20);
  assert.deepEqual(rows.map((r) => r[0]), Array.from({ length: 20 }, (_, i) => `1.${String(i + 1).padStart(2, '0')}`));
  assert.deepEqual(rows[7].slice(1), ['', ['TCS Sk (mGy·m²·h⁻¹)', 'Decay-table Sk (mGy·m²·h⁻¹)', 'Source strength difference'],
    ['Source air kerma strength — TCS Sk', 'Source air kerma strength — decay table Sk', 'Source air kerma strength — difference']]);
  assert.deepEqual(rows[9].slice(1, 3), ['Position', ['console (mm)', 'ruler (mm)', 'difference']]);
  assert.deepEqual(rows[17].slice(1, 3), ['Dwell time', ['set (s)', 'measured (s)', 'difference']]);
  assert.deepEqual([rows[8][0], rows[8][2]], ['1.09', []], 'the old 1.11 is 1.09');
  assert.equal(await page(`document.querySelectorAll('.hdr-qa-table td.qa-shared-cell').length`), 0, 'no merged cell: every row keeps the table\'s columns');
  // Untick (before anything is typed or saved): the QA form is exactly as before; then tick again.
  await tick(false);
  await go(form, formReady);
  assert.equal(await formHtml(), before, 'the QA form is byte-identical once the boxes are cleared');
  await tick(true);
  await go(form, formReady);
  // Typing follows through to the calculated difference and its verdict (synthetic values; seeded Action ±1 %).
  const shared = `[...document.querySelectorAll('.hdr-qa-table tr[data-qa-entry]')][7]`;
  const typeIn = (i, v) => page(`(() => { const x = ${shared}.querySelectorAll('.qa-inline-field > input.result-input')[${i}]; x.value = '${v}'; x.dispatchEvent(new Event('input')); })()`);
  // What a test says of itself: beside its box for the first two; in the row's own cells for the difference.
  const beside = async (i) => (await page(`[...${shared}.querySelectorAll('.qa-inline-field')[${i}].querySelectorAll('.status-cell, .qa-inline-limits')].map((x) => x.innerText).join(' ').replace(/\\s+/g, ' ').trim()`)).replace(/Baseline (\d+)\.0+(?!\d)/g, 'Baseline $1');   // decimals follow the history
  const own = () => page(`[...['td.qa-baseline', 'td.qa-unit', 'td.qa-result'].map((s) => ${shared}.querySelector(s).innerText), [...${shared}.querySelector('td.qa-label').children].filter((x) => !x.classList.contains('qa-test-title')).map((x) => x.innerText).join(' ')].map((s) => s.replace(/\\s+/g, ' ').trim())`);
  assert.deepEqual([await beside(0), await beside(1), await own()], ['Baseline 12', 'Baseline 12', ['0 %', '%', '', 'Action ±1 %']], 'each test its own baseline and limits');
  // Lined up like a spreadsheet: the row's value is where every row's value is.
  assert.equal(await page(`(() => { const left = (row) => Math.round(row.querySelector('td.qa-measured input.result-input').getBoundingClientRect().left); const rows = [...document.querySelectorAll('.hdr-qa-table tr[data-qa-entry]')]; return left(rows[7]) === left(rows[4]) && left(rows[9]) === left(rows[4]); })()`), true, 'under Measured, like the rows around it');
  await typeIn(0, '12.2'); await typeIn(1, '12');
  assert.equal(await page(`${shared}.querySelector('td.qa-measured input').value`), '1.67');
  assert.deepEqual([await beside(0), await beside(1), (await own())[2]], ['(Δ +0.20 mGy·m²·h⁻¹) Baseline 12', '(Δ +0.00 mGy·m²·h⁻¹) Baseline 12', 'ACTION(Δ +1.67 %)'],
    'the deviation of a test with a baseline beside its box (no "Recorded" chip where nothing is judged); the row\'s verdict under Result');
  await typeIn(0, '12.05');
  assert.match((await own())[2], /^PASS ?\(Δ \+0\.42 %\)$/);
  // The row's details button is the calculation's and says whose; the equation keeps its letters (both inputs are 1.08).
  assert.deepEqual(await page(`[...${shared}.querySelectorAll('button.qa-calculation-info')].map((b) => b.getAttribute('aria-label'))`), ['Calculation details: Source strength difference']);
  await page(`${shared}.querySelector('.qa-calculation-info').click()`);
  assert.match(await page(`document.querySelector('dialog.calculation-dialog').innerText`), /Calculated: 100\*\(A-B\)\/B\s*A = Test 1\.08 · Source air kerma strength — TCS Sk; B = Test 1\.08 · Source air kerma strength — decay table Sk/);
  await page(`document.querySelector('dialog.calculation-dialog').close()`);
  // The + opens a note for each test: beside the first two, in the Note column for the row's own.
  await page(`${shared}.querySelector('.note-btn').click()`);
  assert.deepEqual(await page(`[${shared}.querySelectorAll('.qa-inline-field .note-input:not([hidden])').length, ${shared}.querySelectorAll('td.qa-comment .note-input:not([hidden])').length]`), [2, 1], 'a note for each test');
  await page(`(() => { const set = (x, v) => { x.value = v; x.dispatchEvent(new Event('input')); }; set(${shared}.querySelectorAll('.qa-inline-field .note-input')[1], 'synthetic decay note'); set(${shared}.querySelector('td.qa-comment .note-input'), 'synthetic difference note'); })()`);
  assert.equal(await page('document.documentElement.scrollWidth > document.documentElement.clientWidth'), false, 'nothing scrolls sideways');

  // Submit; the saved run keeps one result per test and shows the same row.
  await page(`(() => { for (const b of document.querySelectorAll('.hdr-qa-table .segmented button.pass')) b.click(); })()`);
  await page(`[...document.querySelectorAll('.submit-bar button')].find((b) => b.textContent === 'Submit for review').click()`);
  await until(`/^#\\/runs\\/\\d+/.test(location.hash) && document.querySelector('.review-measure-table')`, 'the saved run');
  await sleep(800);
  const runId = await page(`parseInt(location.hash.split('/')[2], 10)`);   // #/runs/<id>?from=perform
  const run = await page(`localApi('GET', '/api/runs/${runId}')`);
  const saved = Object.fromEntries(run.results.map((r) => [r.name, r]));
  assert.equal(saved['Source air kerma strength — TCS Sk'].value_num, 12.05);
  assert.equal(saved['Source air kerma strength — decay table Sk'].value_num, 12);
  assert.equal(saved['Source air kerma strength — difference'].status, 'pass');
  assert.deepEqual(['TCS Sk', 'decay table Sk', 'difference'].map((n) => saved[`Source air kerma strength — ${n}`].comment || ''), ['', 'synthetic decay note', 'synthetic difference note']);
  const runRow = `[...document.querySelectorAll('.review-measure-table tr[data-test-id]')][7]`;
  assert.deepEqual(await page(`(() => { const r = ${runRow}; return [r.querySelector('.qa-n').textContent, [...r.querySelectorAll('.qa-shared-field')].map((f) => f.innerText.replace(/\\s+/g, ' ').trim()), r.querySelector('td.qa-comment').textContent]; })()`),
    ['1.08', ['TCS Sk (mGy·m²·h⁻¹) 12.05 (Δ +0.05 mGy·m²·h⁻¹) Baseline 12', 'Decay-table Sk (mGy·m²·h⁻¹) 12 (Δ +0.00 mGy·m²·h⁻¹) Baseline 12 synthetic decay note',
      'Source strength difference (%) ⓘ 0.417 PASS(Δ +0.42 %) Baseline 0 · Action ±1 % synthetic difference note'], ''], 'each note under its test, its limits as on the QA form; the Note column left empty');
  const pdf = await page(`localApi('GET', '/api/runs/${runId}').then((r) => qaReportPdf(r).text())`);
  assert.deepEqual([...pdf.matchAll(/\((\d+)\. ([^)]*)\) Tj/g)].map((m) => m[1]).slice(6, 12), ['7', '8', '8', '8', '9', '10']);
  // Back on the QA form, the row's History (now one run) is its own value's: the judged difference.
  await go(form, formReady);
  assert.match(await page(`${shared}.querySelector('.history-cell').textContent`), /0\.417 %/, 'the difference\'s history');
  assert.equal(await page(`${shared}.querySelectorAll('.history-cell .qa-shared-name').length`), 0);
  // In the card layout the empty Note cell is not shown either.
  await send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 1000, deviceScaleFactor: 1, mobile: false });
  await go(`#/runs`, `document.querySelector('#app') && !document.querySelector('.review-measure-table')`);
  await go(`#/runs/${runId}`, `document.querySelector('.review-measure-table')`);
  assert.equal(await page(`getComputedStyle(${runRow}.querySelector('td.qa-comment')).display`), 'none');
  assert.equal(await page('document.documentElement.scrollWidth > document.documentElement.clientWidth'), false, 'nothing scrolls sideways at 1024');
  assert.deepEqual(errors, []);
  console.log('Same row: Setup QA box where it can join, one numbered row of the QA table with its last test in the columns, the others beside their names and a live verdict, equation letters, notes, saved run, PDF, and a clean undo.');
})().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => {
  try { browser?.kill(); } catch {}
  server.close();
  setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} }, 500);
});
