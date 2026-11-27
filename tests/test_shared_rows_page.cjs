// Browser check of "Same row as the test above" on the browser build (docs/, seeded HDR Flexitron daily list with a
// synthetic baseline of 12 on TCS Sk and decay-table Sk, synthetic values, a fresh throwaway browser profile): Setup QA
// offers the box only where it can join; ticking it joins the TCS Sk / decay-table Sk / difference, console / ruler /
// difference and dwell-time sets; the QA form then shows each set as one numbered line of the table: one cell over the
// columns a test on a row of its own has (Test to Result), every test answered beside its own name (name, box, unit,
// its deviation or verdict, the baseline and limits it has for itself, its note); names that start alike say those
// words once, in bold, with the baseline and limits the judged tests share under them; the difference follows the
// typed values with its verdict (a PASS alone, its Δ on the chip); its calculation details keep the equation's
// letters; the saved run shows the same line with what was recorded (each test's note under it, nothing left for the
// Note column); the PDF numbers alike; unticking gives back the same QA form, byte for byte; the line's History is
// the judged difference's, and says so. Headless
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

  // The QA form: one row per set, numbered 1.08 / 1.10 / 1.18. A set is one line of the table, in one cell over the
  // table's shared columns: every test is answered beside its own name, its unit after its box, in list order. Names
  // that start alike say those words once (the line's title, with the baseline and limits its judged test has under
  // it); each test keeps the rest of its name, with a capital.
  await go(form, formReady);
  const rows = await page(`[...document.querySelectorAll('.hdr-qa-table tr[data-qa-entry]')].map((r) => [r.querySelector('.qa-n').textContent,
    r.querySelector('.qa-line-title')?.textContent || '', [...r.querySelectorAll('.qa-line-field')].map((f) => [f.querySelector(':scope > .qa-line-name')?.textContent || '', f.querySelector(':scope > .qa-line-unit')?.textContent || '']),
    [...r.querySelectorAll('.qa-line-field > input.result-input')].map((i) => i.getAttribute('aria-label')), r.className, r.querySelectorAll(':scope > td.qa-measured.qa-shared-cell.qa-line-cell').length,
    (r.querySelector('.qa-line-head .qa-limits')?.textContent || '').replace(/Baseline (\\d+)\\.0+(?!\\d)/g, 'Baseline $1')])`);
  assert.equal(rows.length, 20);
  assert.deepEqual(rows.map((r) => r[0]), Array.from({ length: 20 }, (_, i) => `1.${String(i + 1).padStart(2, '0')}`));
  assert.deepEqual(rows[7].slice(1), ['', [['TCS Sk', 'mGy·m²·h⁻¹'], ['Decay-table Sk', 'mGy·m²·h⁻¹'], ['Source strength difference', '%']],
    ['Source air kerma strength — TCS Sk', 'Source air kerma strength — decay table Sk', 'Source air kerma strength — difference'], 'qa-line-row', 1, ''], 'no words in common: no title, each test says its own baseline and limits');
  assert.deepEqual([...rows[9].slice(1, 3), rows[9][6]], ['Position', [['Console', 'mm'], ['Ruler', 'mm'], ['Difference', 'mm']], 'Baseline 0 mm · Action ±1 mm']);
  assert.deepEqual([...rows[17].slice(1, 3), rows[17][6]], ['Dwell time', [['Set', 's'], ['Measured', 's'], ['Difference', '%']], 'Baseline 0 % · Action ±2 %']);
  assert.deepEqual([rows[8][0], rows[8][2]], ['1.09', []], 'the old 1.11 is 1.09');
  assert.deepEqual(rows.map((r, i) => (r[4] === 'qa-line-row' || r[5] ? i : null)).filter((i) => i !== null), [7, 9, 17], 'a line for each set, and only there');
  assert.deepEqual(await page(`[document.querySelectorAll('.hdr-qa-table td.qa-shared-cell').length, document.querySelectorAll('[class*="qa-inline"]').length]`), [3, 0], 'one merged cell for each set; no row is drawn the old way');
  assert.deepEqual(await page(`[...document.querySelectorAll('.hdr-qa-table tr.qa-line-row')].map((r) => ['td.qa-label', 'td.qa-baseline', 'td.qa-unit', 'td.qa-warn', 'td.qa-action', 'td.qa-result'].map((s) => r.querySelectorAll(':scope > ' + s).length).join(''))`), Array(3).fill('000000'),
    'a line has no cell of its own for a name, a baseline, a unit, a limit or a result');
  // Untick (before anything is typed or saved): the QA form is exactly as before; then tick again.
  await tick(false);
  await go(form, formReady);
  assert.equal(await formHtml(), before, 'the QA form is byte-identical once the boxes are cleared');
  await tick(true);
  await go(form, formReady);
  // Typing follows through to the calculated difference and its verdict (synthetic values; seeded Action ±1 %).
  const shared = `[...document.querySelectorAll('.hdr-qa-table tr[data-qa-entry]')][7]`;
  const typeIn = (i, v) => page(`(() => { const x = ${shared}.querySelectorAll('.qa-line-field > input.result-input')[${i}]; x.value = '${v}'; x.dispatchEvent(new Event('input')); })()`);
  // What a test says of itself, after its box: its verdict or deviation as it reads, then its baseline and limits.
  const beside = async (i) => (await page(`[...${shared}.querySelectorAll('.qa-line-field')[${i}].querySelectorAll(':scope > .status-cell, :scope > .qa-line-limits')].map((x) => x.innerText).join(' ').replace(/\\s+/g, ' ').trim()`)).replace(/Baseline (\d+)\.0+(?!\d)/g, 'Baseline $1');   // decimals follow the history
  assert.deepEqual([await beside(0), await beside(1), await beside(2)], ['Baseline 12 mGy·m²·h⁻¹', 'Baseline 12 mGy·m²·h⁻¹', 'Baseline 0 % · Action ±1 %'], 'each test its own baseline and limits');
  // Lined up with the rows around it: each line's one cell runs from where a test's name starts to where its Result
  // ends in a row of one test, over as many of the shared columns as the table shows; it starts where the names start.
  assert.deepEqual(await page(`(() => { const rows = [...document.querySelectorAll('.hdr-qa-table tr[data-qa-entry]')], edge = (n, side) => Math.round(n.getBoundingClientRect()[side]), one = rows[4];
    const shown = [...one.closest('table').querySelectorAll(':scope > colgroup > col')].filter((c) => ['test', 'baseline', 'measured', 'unit', 'warn', 'action', 'result'].includes(c.dataset.col)).length;
    return [7, 9, 17].map((i) => { const cell = rows[i].querySelector(':scope > td.qa-line-cell'); return [cell.colSpan === shown, edge(cell, 'left') - edge(one.querySelector('td.qa-label'), 'left'), edge(cell, 'right') - edge(one.querySelector('td.qa-result'), 'right'),
      edge(rows[i].querySelector('.qa-line-title, .qa-line-name'), 'left') - edge(one.querySelector('td.qa-label strong'), 'left')]; }); })()`), Array(3).fill([true, 0, 0, 0]), 'one cell from Test to Result, like the rows around it');
  // In a line every name is next to its own box: on its line, a few px before it, nearer than to the box before.
  const gaps = () => page(`[7, 9, 17].flatMap((i) => [...[...document.querySelectorAll('.hdr-qa-table tr[data-qa-entry]')][i].querySelectorAll('.qa-line-field')].map((f) => { const at = (n) => n.getBoundingClientRect(), name = at(f.querySelector(':scope > .qa-line-name')), box = at(f.querySelector(':scope > input.result-input')), prev = f.previousElementSibling && at(f.previousElementSibling.querySelector(':scope > input.result-input'));
    const gap = box.left - name.right, level = Math.abs(name.top + name.height / 2 - box.top - box.height / 2), before = prev && Math.abs(prev.top - box.top) <= 8 ? name.left - prev.right : null;
    return level <= 8 && gap >= 0 && gap <= 12 && (before === null || gap < before) ? '' : f.querySelector(':scope > .qa-line-name').textContent + ': ' + JSON.stringify({ gap, level, before }); }).filter(Boolean))`);
  assert.deepEqual(await gaps(), [], 'every name beside its own box');
  await typeIn(0, '12.2'); await typeIn(1, '12');
  assert.equal(await page(`${shared}.querySelectorAll('.qa-line-field > input.result-input')[2].value`), '1.67');
  assert.deepEqual([await beside(0), await beside(1), await beside(2)], ['(Δ +0.20 mGy·m²·h⁻¹) Baseline 12 mGy·m²·h⁻¹', '(Δ +0.00 mGy·m²·h⁻¹) Baseline 12 mGy·m²·h⁻¹', 'ACTION (Δ +1.67 %) Baseline 0 % · Action ±1 %'],
    'the deviation of a test with a baseline after its box (no "Recorded" chip where nothing is judged); the difference\'s verdict after its own box');
  await typeIn(0, '12.05');
  // A passing test on a line says PASS alone: its deviation is on the chip.
  assert.deepEqual([await beside(2), await page(`${shared}.querySelectorAll('.qa-line-field')[2].querySelector(':scope > .status-cell .chip').title`)], ['PASS Baseline 0 % · Action ±1 %', '(Δ +0.42 %)']);
  await sleep(300);   // (the Test column is fitted a frame after a change)
  assert.deepEqual(await gaps(), [], 'every name beside its own box, answered');
  // The row's details button is the calculation's and says whose; the equation keeps its letters (both inputs are 1.08).
  assert.deepEqual(await page(`[...${shared}.querySelectorAll('button.qa-calculation-info')].map((b) => b.getAttribute('aria-label'))`), ['Calculation details: Source strength difference']);
  await page(`${shared}.querySelector('.qa-calculation-info').click()`);
  assert.match(await page(`document.querySelector('dialog.calculation-dialog').innerText`), /Calculated: 100\*\(A-B\)\/B\s*A = Test 1\.08 · Source air kerma strength — TCS Sk; B = Test 1\.08 · Source air kerma strength — decay table Sk/);
  await page(`document.querySelector('dialog.calculation-dialog').close()`);
  // The + opens a note for each test, with the test: none is left for the Note column.
  await page(`${shared}.querySelector('.note-btn').click()`);
  assert.deepEqual(await page(`[[...${shared}.querySelectorAll('.qa-line-field')].map((f) => f.querySelectorAll(':scope > .note-input:not([hidden])').length), ${shared}.querySelectorAll('td.qa-comment .note-input').length]`), [[1, 1, 1], 0], 'a note for each test');
  await page(`(() => { const set = (x, v) => { x.value = v; x.dispatchEvent(new Event('input')); }; set(${shared}.querySelectorAll('.qa-line-field .note-input')[1], 'synthetic decay note'); set(${shared}.querySelectorAll('.qa-line-field .note-input')[2], 'synthetic difference note'); })()`);
  assert.equal(await page('document.documentElement.scrollWidth > document.documentElement.clientWidth'), false, 'nothing scrolls sideways');

  // Submit; the saved run keeps one result per test and shows the same line.
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
  // As on the QA form: one line of the table, in one cell over its columns. Each test is beside its own name with what
  // was recorded, its unit, its deviation or verdict (PASS alone, its Δ on the chip), its baseline and limits, and its
  // note under it; nothing is left for the Note column.
  const t = `(s) => (s || '').replace(/\\s+/g, ' ').trim()`;
  assert.deepEqual(await page(`(() => { const t = ${t}, r = ${runRow}, fields = [...r.querySelectorAll('.qa-line-field')]; return [r.querySelector('.qa-n').textContent, r.className, r.querySelectorAll(':scope > td.qa-measured.qa-shared-cell.qa-line-cell').length,
    fields.map((f) => t(f.innerText)), fields.map((f) => ['.qa-line-name', '.qa-line-value', '.qa-line-unit', '.qa-shared-note'].map((s) => f.querySelector(':scope > ' + s)?.textContent || '')),
    ['td.qa-label', 'td.qa-baseline', 'td.qa-unit', 'td.qa-result'].map((s) => r.querySelectorAll(':scope > ' + s).length), r.querySelector('.qa-line-field .chip.pass')?.title || '', t(r.querySelector('td.qa-comment').innerText),
    [...r.querySelectorAll('button.qa-calculation-info')].map((b) => b.getAttribute('aria-label'))]; })()`),
    ['1.08', 'qa-line-row', 1, ['TCS Sk 12.05 mGy·m²·h⁻¹ (Δ +0.05 mGy·m²·h⁻¹) Baseline 12 mGy·m²·h⁻¹', 'Decay-table Sk 12 mGy·m²·h⁻¹ (Δ +0.00 mGy·m²·h⁻¹) Baseline 12 mGy·m²·h⁻¹ synthetic decay note',
      'Source strength difference 0.417 % PASS ⓘ Baseline 0 % · Action ±1 % synthetic difference note'],
      [['TCS Sk', '12.05', 'mGy·m²·h⁻¹', ''], ['Decay-table Sk', '12', 'mGy·m²·h⁻¹', 'synthetic decay note'], ['Source strength difference', '0.417', '%', 'synthetic difference note']],
      [0, 0, 0, 0], '(Δ +0.42 %)', '', ['Calculation details: Source strength difference']],
    'each reading and the difference beside its own name, with its own note; nothing in the Note column');
  assert.deepEqual(await page(`(() => { const rows = [...document.querySelectorAll('.review-measure-table tr[data-test-id]')]; return ['1.10', '1.18'].map((n) => rows.find((r) => r.querySelector('.qa-n').textContent === n)).map((r) => [r.querySelector('.qa-n').textContent, r.className, r.querySelector('.qa-line-title')?.textContent || '', [...r.querySelectorAll('.qa-line-name')].map((n) => n.textContent), r.querySelector('td.qa-comment').innerText.trim()]); })()`),
    [['1.10', 'qa-line-row', 'Position', ['Console', 'Ruler', 'Difference'], '—'], ['1.18', 'qa-line-row', 'Dwell time', ['Set', 'Measured', 'Difference'], '—']], 'names that start alike say those words once; without a note the Note column has its dash');
  assert.deepEqual(await page(`[document.querySelectorAll('[class*="qa-inline"]').length, document.documentElement.scrollWidth > document.documentElement.clientWidth]`), [0, false], 'no row is drawn the old way; nothing scrolls sideways');
  const pdf = await page(`localApi('GET', '/api/runs/${runId}').then((r) => qaReportPdf(r).text())`);
  assert.deepEqual([...pdf.matchAll(/\((\d+)\. ([^)]*)\) Tj/g)].map((m) => m[1]).slice(6, 12), ['7', '8', '8', '8', '9', '10']);
  // In the card layout the line keeps its readings, each with its note, and nothing runs off the page.
  await send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 1000, deviceScaleFactor: 1, mobile: false });
  await go(`#/runs`, `document.querySelector('#app') && !document.querySelector('.review-measure-table')`);
  await go(`#/runs/${runId}`, `document.querySelector('.review-measure-table')`);
  assert.equal(await page(`${runRow}.querySelectorAll('.qa-line-field').length`), 3);
  assert.deepEqual(await page(`[...${runRow}.querySelectorAll('.qa-shared-note')].map((n) => [n.textContent, getComputedStyle(n).display !== 'none' && n.getBoundingClientRect().height > 0])`), [['synthetic decay note', true], ['synthetic difference note', true]], 'each test\'s note is shown with it');
  assert.equal(await page('document.documentElement.scrollWidth > document.documentElement.clientWidth'), false, 'nothing scrolls sideways at 1024');
  // Back on the QA form (at the first width), the line's History (now one run) is the judged difference's, and says
  // whose it is: a line holds several numbers.
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  await go(form, formReady);
  const history = await page(`[${shared}.querySelector('.history-cell .qa-shared-name')?.textContent || '', ${shared}.querySelector('.history-cell .hist-row')?.textContent || '']`);
  assert.deepEqual(errors, []);
  assert.deepEqual([history[0], /0\.417 %/.test(history[1])], ['Source strength difference', true], `the difference's history, named for it: ${JSON.stringify(history)}`);
  console.log('Same row: Setup QA box where it can join, one numbered line of the QA table in one cell over its columns, every test beside its own name with a live verdict, equation letters, notes, saved run, PDF, a clean undo, and the difference\'s History.');
})().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => {
  try { browser?.kill(); } catch {}
  server.close();
  setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} }, 500);
});
