// Browser check of "Same row as the test above" on the browser build (docs/, seeded HDR Flexitron daily list, synthetic
// values, a fresh throwaway browser profile): ticking the box in Setup QA joins the TCS Sk / decay-table Sk / difference,
// console / ruler / difference and dwell-time sets; the QA form then shows each set as one numbered row with every input
// named and in order, the difference following the typed values with its verdict; the saved run shows the same row; the
// PDF numbers alike; unticking gives back the same QA form, byte for byte. Headless Chrome or Edge over the DevTools
// protocol (no Playwright needed); skipped when neither is installed (set CHROME_PATH to choose one).
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
  await go(form, formReady);
  const before = await formHtml();
  assert.equal(await page(`document.querySelectorAll('.qa-shared').length`), 0, 'no shared rows on the seeded list');

  // Setup QA: tick "Same row as the test above" on the six tests, save.
  const joinNames = ['decay table Sk', 'Source air kerma strength — difference', 'ruler reading', 'console minus ruler', 'Dwell time — measured time', 'Dwell time — difference'];
  const tick = async (on) => {
    await go(`#/queues/${queue}`, `document.querySelectorAll('.list-editor tr.compact').length > 20`);
    // Each click redraws the list, so the next box is looked up afresh.
    const clicked = await page(`(() => { let n = 0; for (let more = true; more;) { more = false; for (const row of document.querySelectorAll('.list-editor tr.compact')) {
      const name = row.querySelector('.inline-test-name textarea')?.value || '', box = row.querySelector('.same-row input');
      if (box && ${JSON.stringify(joinNames)}.some((x) => name.includes(x)) && box.checked !== ${on}) { box.click(); n++; more = true; break; } } } return n; })()`);
    assert.equal(clicked, 6);
    await page(`[...document.querySelectorAll('.template-save-bar button')].find((b) => b.textContent.startsWith('Save')).click()`);
    await until(`document.querySelector('.template-save-bar .chip.due')?.hidden !== false`, 'saved'); await sleep(1500);
  };
  await tick(true);
  const editor = await page(`[...document.querySelectorAll('.list-editor tr.compact')].map((r) => (r.querySelector('.inline-test-name strong')?.textContent || '') + (r.querySelector('.same-row input')?.checked ? '+' : ''))`);
  assert.deepEqual(editor.slice(7, 14), ['1.08:', '+', '+', '1.09:', '1.10:', '+', '+'], 'Setup QA: a joined test has no number of its own');

  // The QA form: one row per set, numbered 1.08 / 1.10 / 1.18; each input named with its unit, in list order.
  await go(form, formReady);
  const rows = await page(`[...document.querySelectorAll('.hdr-qa-table tr[data-qa-entry]')].map((r) => [r.querySelector('.qa-n').textContent,
    [...r.querySelectorAll('.qa-shared-name')].map((n) => n.textContent), [...r.querySelectorAll('.qa-shared input')].map((i) => i.getAttribute('aria-label'))])`);
  assert.equal(rows.length, 20);
  assert.deepEqual(rows.map((r) => r[0]), Array.from({ length: 20 }, (_, i) => `1.${String(i + 1).padStart(2, '0')}`));
  assert.deepEqual(rows[7].slice(1), [['TCS Sk (mGy·m²·h⁻¹)', 'Decay-table Sk (mGy·m²·h⁻¹)', 'Source strength difference (%)'],
    ['Source air kerma strength — TCS Sk', 'Source air kerma strength — decay table Sk', 'Source air kerma strength — difference']]);
  assert.deepEqual(rows[9][1], ['Position — console (mm)', 'Position — ruler (mm)', 'Position difference (mm)']);
  assert.deepEqual(rows[17][1], ['Dwell time — set (s)', 'Dwell time — measured (s)', 'Dwell time difference (%)']);
  assert.deepEqual([rows[8][0], rows[8][1]], ['1.09', []], 'the old 1.11 is 1.09');
  // Untick (before anything is typed or saved): the QA form is exactly as before; then tick again.
  await tick(false);
  await go(form, formReady);
  assert.equal(await formHtml(), before, 'the QA form is byte-identical once the boxes are cleared');
  await tick(true);
  await go(form, formReady);
  // Typing follows through to the calculated difference and its verdict (synthetic values; seeded Action ±1 %).
  const shared = `[...document.querySelectorAll('.hdr-qa-table tr[data-qa-entry]')][7]`;
  const typeIn = (i, v) => page(`(() => { const x = ${shared}.querySelectorAll('.qa-shared input')[${i}]; x.value = '${v}'; x.dispatchEvent(new Event('input')); })()`);
  await typeIn(0, '12.2'); await typeIn(1, '12');
  assert.equal(await page(`${shared}.querySelectorAll('.qa-shared input')[2].value`), '1.67');
  assert.match(await page(`${shared}.querySelector('.qa-result').textContent`), /^ACTION\s*\(Δ \+1\.67 %\)$/);
  await typeIn(0, '12.05');
  assert.match(await page(`${shared}.querySelector('.qa-result').textContent`), /^PASS\s*\(Δ \+0\.42 %\)$/);
  assert.match(await page(`${shared}.querySelector('.qa-baseline').textContent`), /^0(\.0+)? %$/, 'the baseline of the judged test only');
  assert.equal(await page(`${shared}.querySelectorAll('.qa-comment .note-input').length`), 3, 'a comment for each test');
  assert.equal(await page('document.documentElement.scrollWidth > document.documentElement.clientWidth'), false, 'nothing scrolls sideways');

  // Submit; the saved run keeps one result per test and shows the same row.
  await page(`(() => { for (const b of document.querySelectorAll('.hdr-qa-table .segmented button.pass')) b.click(); })()`);
  await page(`[...document.querySelectorAll('.submit-bar button')].find((b) => b.textContent === 'Submit for review').click()`);
  await until(`/^#\\/runs\\/\\d+/.test(location.hash) && document.querySelector('.review-measure-table')`, 'the saved run');
  await sleep(800);
  const runId = await page(`Number(location.hash.split('/')[2])`);
  const run = await page(`localApi('GET', '/api/runs/${runId}')`);
  const saved = Object.fromEntries(run.results.map((r) => [r.name, r]));
  assert.equal(saved['Source air kerma strength — TCS Sk'].value_num, 12.05);
  assert.equal(saved['Source air kerma strength — decay table Sk'].value_num, 12);
  assert.equal(saved['Source air kerma strength — difference'].status, 'pass');
  const runRow = await page(`(() => { const r = [...document.querySelectorAll('.review-measure-table tr[data-test-id]')][7]; return [r.querySelector('.qa-n').textContent,
    [...r.querySelectorAll('.qa-shared-field')].map((f) => f.innerText.replace(/\\s+/g, ' ')), r.querySelector('.qa-result').textContent.replace(/\\s+/g, ' ')]; })()`);
  assert.deepEqual(runRow.slice(0, 2), ['1.08', ['TCS Sk (mGy·m²·h⁻¹) 12.05', 'Decay-table Sk (mGy·m²·h⁻¹) 12', 'Source strength difference (%) 0.417']]);
  assert.match(runRow[2], /^PASS ?\(Δ \+0\.42 %\)$/);
  const pdf = await page(`localApi('GET', '/api/runs/${runId}').then((r) => qaReportPdf(r).text())`);
  assert.deepEqual([...pdf.matchAll(/\((\d+)\. ([^)]*)\) Tj/g)].map((m) => m[1]).slice(6, 12), ['7', '8', '8', '8', '9', '10']);
  assert.deepEqual(errors, []);
  console.log('Same row: Setup QA box, one numbered row on the QA form with named inputs and live verdict, saved run, PDF, and a clean undo.');
})().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => {
  try { browser?.kill(); } catch {}
  server.close();
  setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} }, 500);
});
