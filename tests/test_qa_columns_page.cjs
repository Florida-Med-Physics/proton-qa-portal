// Browser regression for the QA table's columns and the tidied QA form: serve docs locally (port 8791), then run with
// Playwright available in NODE_PATH. Uses a fresh isolated browser context and the demo accounts; synthetic values only.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.PORTAL_TEST_URL || 'http://127.0.0.1:8791/';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const p = await browser.newPage({ viewport: { width: 1600, height: 900 } }), errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(base);
    await p.locator('[name=username]').fill('Admin'); await p.locator('[name=password]').fill('Admin'); await p.locator('button[type=submit]').click();
    await p.waitForSelector('.dashboard-count');
    const list = await p.evaluate(async () => { const gtr1 = (await api('GET', '/api/machines')).find((m) => m.name === 'GTR1').id; return (await api('GET', '/api/assignments')).find((a) => /PBS DailyQA/.test(a.queue_name) && a.machine_id === gtr1).id; });
    const open = async (hash) => { await p.evaluate((h) => { location.hash = h; }, hash); await p.waitForSelector('.measure-table'); await p.waitForTimeout(200); };
    // What is on screen: the names of the first table's columns, and the cells of its first row, left to right.
    const headings = () => p.locator('.measure-table').first().locator('thead tr').first().locator('th').evaluateAll((cells) => cells.filter((c) => c.getClientRects().length).map((c) => c.textContent));
    const firstRow = () => p.locator('.measure-table tbody tr[data-qa-entry]').first().evaluate((row) => [...row.children].filter((c) => c.getClientRects().length).map((c) => c.className.split(' ').find((n) => /^(qa-|history-cell)/.test(n))));
    const dialog = p.locator('dialog[open]');
    const columns = async (act) => { await p.getByRole('button', { name: 'Columns', exact: true }).click(); await dialog.waitFor(); await act(); await dialog.getByRole('button', { name: 'Done', exact: true }).click(); await p.waitForTimeout(150); };

    // 1. The QA form starts with Baseline, Measured, then Result, and without History; one names row per section.
    await open(`#/perform/${list}`);
    assert.deepEqual(await headings(), ['#', 'Test', 'Baseline', 'Measured', 'Unit', 'Result', 'Note', 'Trend']);
    assert.deepEqual(await firstRow(), ['qa-n', 'qa-label', 'qa-baseline', 'qa-measured', 'qa-unit', 'qa-result', 'qa-comment', 'qa-trends']);
    const names = await p.evaluate(() => [...document.querySelectorAll('.card.section')].map((box) => [...box.querySelectorAll('tr.qa-col-names')].filter((row) => !row.classList.contains('repeat')).length));
    assert.deepEqual(names, names.map(() => 1), 'each section names its columns once');
    assert.equal(await p.locator('.measure-table tr.hist-dates:visible').count(), 0);
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'nothing scrolls sideways');

    // 2. Instructions are one click away, not on the page: the protocol, a group's directions, a step's instruction.
    assert.equal(await p.locator('.card.instructions').count(), 0);
    assert.equal(await p.locator('.measure-title .qa-sub').count(), 0);
    await p.getByRole('button', { name: 'Protocol', exact: true }).click();
    assert.match(await dialog.textContent(), /Protocol/); await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    const instruction = 'Please remove the range shifter to prevent collisions and beam delivery.';
    const step = p.locator('tr[data-qa-entry]', { has: p.getByRole('button', { name: `${instruction}: yes`, exact: true }) });
    assert.equal(await step.locator('.qa-label strong').textContent(), 'Remove the range shifter');
    assert.equal(await step.locator('.qa-label strong').getAttribute('title'), instruction);
    await step.getByRole('button', { name: 'Test details', exact: true }).click();
    assert.ok((await dialog.textContent()).includes(instruction), 'the instruction, word for word'); await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await step.locator('.qa-label strong').click();
    assert.ok((await dialog.textContent()).includes(instruction), 'the label opens it too'); await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    const group = p.locator('.measure-block', { has: p.locator('.measure-title', { hasText: 'Gantry 90°' }) }).first();   // X / Y / Z with the same directions and no calculated row
    await group.locator('.measure-title').getByRole('button', { name: 'Test details', exact: true }).click();
    assert.match(await dialog.textContent(), /Record the correction vector/); await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    assert.equal(await group.locator('tbody .qa-calculation-info').count(), 0, 'its rows do not repeat the group\'s directions');
    assert.equal(await p.getByLabel('How Sphinx imports work', { exact: true }).count(), 1);

    // 3. The Columns box: show History, move Result ahead of Measured, hide Unit. What was typed stays.
    const temperature = p.getByLabel('Chamber Temperature, °C', { exact: true });
    await temperature.fill('22.4');
    await columns(async () => {
      await dialog.getByRole('checkbox', { name: 'History', exact: true }).check();
      await dialog.getByRole('button', { name: 'Move earlier: Result', exact: true }).click();
      await dialog.getByRole('button', { name: 'Move earlier: Result', exact: true }).click();
      await dialog.getByRole('checkbox', { name: 'Unit', exact: true }).uncheck();
      assert.equal(await dialog.getByRole('checkbox', { name: 'Measured', exact: true }).isDisabled(), true, 'Measured always shows');
      assert.equal(await dialog.getByRole('checkbox', { name: 'Result', exact: true }).isDisabled(), true, 'Result always shows');
    });
    const chosen = ['#', 'Test', 'Baseline', 'Result', 'Measured', 'History', 'Note', 'Trend'];
    assert.deepEqual(await headings(), chosen);
    assert.deepEqual(await firstRow(), ['qa-n', 'qa-label', 'qa-baseline', 'qa-result', 'qa-measured', 'history-cell', 'qa-comment', 'qa-trends']);
    assert.equal(await temperature.inputValue(), '22.4', 'nothing typed is lost');
    assert.equal(await p.locator('.measure-table').first().locator('colgroup col').count(), chosen.length, 'as many widths as columns');
    assert.equal(await p.locator('.measure-table td.qa-unit:visible').count(), 0);
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    // Kept for next time on this computer; a saved run keeps its own columns (every one, History included).
    await p.reload(); await p.waitForSelector('.measure-table'); await p.waitForTimeout(200);
    assert.deepEqual(await headings(), chosen);
    const run = await p.evaluate(async (id) => (await api('POST', `/api/assignments/${id}/runs`, { results: [] })).id, list);
    await open(`#/runs/${run}`);
    assert.deepEqual(await headings(), ['#', 'Test', 'Baseline', 'Measured', 'Unit', 'Result', 'History', 'Note', 'Trend']);
    assert.equal(await p.getByRole('button', { name: 'Columns', exact: true }).count(), 1);
    await columns(async () => { await dialog.getByRole('checkbox', { name: 'Trend', exact: true }).uncheck(); });
    assert.deepEqual(await headings(), ['#', 'Test', 'Baseline', 'Measured', 'Unit', 'Result', 'History', 'Note']);
    // Reset: the page's own columns again.
    await open(`#/perform/${list}`);
    assert.deepEqual(await headings(), chosen, 'the QA form kept its own');
    await columns(async () => { await dialog.getByRole('button', { name: 'Reset', exact: true }).click(); });
    assert.deepEqual(await headings(), ['#', 'Test', 'Baseline', 'Measured', 'Unit', 'Result', 'Note', 'Trend']);

    // 4. A phone's cards are as before: no Columns button, each row its test, answer and verdict.
    await columns(async () => { await dialog.getByRole('checkbox', { name: 'Baseline', exact: true }).uncheck(); });
    await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(200);
    assert.equal(await p.getByRole('button', { name: 'Columns', exact: true }).isVisible(), false);
    // (A row with nothing to judge leaves its empty Result out, as before; the temperature typed above has a verdict.)
    const card = (row) => row.evaluate((tr) => [...tr.children].filter((c) => getComputedStyle(c).display !== 'none').map((c) => (c.classList.contains('qa-label') ? 'Test' : c.classList.contains('qa-measured') ? 'Measured' : c.classList.contains('qa-result') ? 'Result' : 'Extra')));
    await temperature.fill('22.4');
    assert.deepEqual(await card(p.locator('tr[data-qa-entry]', { has: temperature })), ['Test', 'Measured', 'Result']);
    const shownOnCards = await p.locator('tr[data-qa-entry]').evaluateAll((rows) => [...new Set(rows.flatMap((tr) => [...tr.children].filter((c) => getComputedStyle(c).display !== 'none')
      .map((c) => (c.classList.contains('qa-label') ? 'Test' : c.classList.contains('qa-measured') ? 'Measured' : c.classList.contains('qa-result') ? 'Result' : 'Extra'))))].sort());
    assert.deepEqual(shownOnCards, ['Measured', 'Result', 'Test'], 'no card shows a column of the table');
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await step.locator('.qa-label strong').click();
    assert.ok((await dialog.textContent()).includes(instruction), 'on a phone the label opens the instruction'); await dialog.getByRole('button', { name: 'Close', exact: true }).click();

    assert.deepEqual(errors, []);
    console.log('QA columns on the page: new default order without History; one names row per section; instructions behind ⓘ and Protocol; the Columns box shows, hides, reorders, keeps what was typed and is remembered per page; Reset; phone cards unchanged.');
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exit(1); });
