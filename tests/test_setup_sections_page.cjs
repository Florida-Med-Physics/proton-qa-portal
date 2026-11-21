// Browser regression for adding a test or a block to a section in Setup QA (the ＋ Test and ＋ Block of a section's
// title in the list editor), on the browser build (docs/, the seeded PBS daily list, synthetic names and values only, a
// fresh isolated browser context): what is added goes to the end of its section with the section's number and name
// already in its field, the list is saved, and the QA form draws it there: X, Y, Z as a titled block, other fields as
// one row under the block's name, a single test as a row of its own.
// Serve docs locally (port 8791), then run with Playwright available in NODE_PATH: node tests/test_setup_sections_page.cjs
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
    const { list, queue } = await p.evaluate(async () => { const gtr1 = (await api('GET', '/api/machines')).find((m) => m.name === 'GTR1').id; const a = (await api('GET', '/api/assignments')).find((x) => /PBS DailyQA/.test(x.queue_name) && x.machine_id === gtr1); return { list: a.id, queue: a.queue_id }; });
    const dialog = p.locator('dialog[open]');
    const editor = async () => { await p.evaluate((h) => { location.hash = h; }, `#/queues/${queue}`); await p.waitForSelector('table.list-editor tr.compact'); await p.waitForTimeout(300); };
    const items = () => p.evaluate(async (q) => { const tests = Object.fromEntries((await api('GET', '/api/tests')).map((t) => [t.id, t])); return (await api('GET', `/api/queues/${q}`)).items.map((i) => tests[i.test_id]).map((t) => ({ name: t.name, type: t.type, unit: t.unit, category: t.category, description: t.description, expected: t.expected, warn: t.warn, fail: t.fail })); }, queue);
    const before = await items();
    const saved = async () => { await dialog.waitFor({ state: 'detached' }); await p.waitForSelector('table.list-editor tr.compact'); await p.waitForTimeout(600); };

    // 1. Every section's title offers the two; a search hides them (a filtered list has no end to add to).
    await editor();
    const titles = await p.locator('table.list-editor tr.section-row .section-row-line > span:first-child').allTextContents();
    assert.deepEqual(titles, ['1.0 Setup and Safety', '2.0 Mechanical and Imaging', '3.0 Sphinx Measurements', '4.0 Final safety checks']);
    assert.equal(await p.getByRole('button', { name: /^Add a test to /, exact: false }).count(), 4);
    assert.equal(await p.getByRole('button', { name: /^Add a block to /, exact: false }).count(), 4);
    await p.getByLabel('Find tests', { exact: true }).fill('chamber'); await p.waitForTimeout(200);
    assert.equal(await p.locator('.section-tools').count(), 0);
    await p.getByLabel('Find tests', { exact: true }).fill(''); await p.waitForTimeout(200);

    // 2. ＋ Block, X / Y / Z: three numeric tests at the end of the section, numbered on, named for the block and the axis.
    await p.getByRole('button', { name: 'Add a block to 2.0 Mechanical and Imaging', exact: true }).click();
    assert.equal(await dialog.locator('h2').textContent(), 'New block in 2.0 Mechanical and Imaging');
    assert.equal(await dialog.locator('input[name=fields]').inputValue(), 'X, Y, Z');
    await dialog.locator('input[name=block]').fill('Synthetic shift');
    await dialog.locator('input[name=unit]').fill('cm');
    await dialog.locator('input[name=expected]').fill('0');
    await dialog.locator('input[name=warn]').fill('0.1');
    await dialog.getByRole('button', { name: 'Add block', exact: true }).click();
    await saved();
    let now = await items();
    const imaging = (all) => all.filter((t) => /\[Section: Mechanical and Imaging\]/.test(t.description || ''));
    const added = imaging(now).slice(imaging(before).length);
    assert.equal(now.length, before.length + 3);
    assert.deepEqual(imaging(now).slice(0, imaging(before).length), imaging(before), 'the section\'s tests as they were, the new ones after them');
    const lastNumber = Math.max(...imaging(before).map((t) => parseInt(/^Template 2\.(\d+)/.exec(t.description)[1], 10)));
    assert.deepEqual(added.map((t) => [t.name, t.type, t.unit, t.expected, t.warn, t.fail, t.description]), ['X', 'Y', 'Z'].map((axis, i) =>
      [`Synthetic shift ${axis} [cm]`, 'numeric', 'cm', 0, 0.1, null, `Template 2.${String(lastNumber + 1 + i).padStart(2, '0')}. [Section: Mechanical and Imaging]`]), 'no row tag: X, Y, Z are a block by their names; a limit left blank stays blank');
    assert.equal(new Set(added.map((t) => t.category)).size, 1);
    assert.equal(added[0].category, imaging(before).at(-1).category, 'the category of the section\'s last test');

    // 3. ＋ Block, other fields: the second shares the first one's row. A name already in the list is refused before anything is made.
    await p.getByRole('button', { name: 'Add a block to 3.0 Sphinx Measurements', exact: true }).click();
    await dialog.locator('input[name=block]').fill('Synthetic gap');
    await dialog.locator('input[name=fields]').fill('In, Out');
    await dialog.locator('input[name=unit]').fill('mm');
    await dialog.getByRole('button', { name: 'Add block', exact: true }).click();
    await saved();
    now = await items();
    const gap = now.filter((t) => t.name.startsWith('Synthetic gap'));
    assert.deepEqual(gap.map((t) => [t.name, /\[row: with above\]/.test(t.description), /\[Section: Sphinx Measurements\]/.test(t.description), t.expected, t.warn, t.fail]),
      [['Synthetic gap In [mm]', false, true, null, null, null], ['Synthetic gap Out [mm]', true, true, null, null, null]]);
    assert.equal(now.filter((t) => /\[Section: Sphinx Measurements\]/.test(t.description || '')).at(-1).name, 'Synthetic gap Out [mm]', 'at the end of its section');
    await p.getByRole('button', { name: 'Add a block to 3.0 Sphinx Measurements', exact: true }).click();
    await dialog.locator('input[name=block]').fill('Synthetic gap');
    await dialog.locator('input[name=fields]').fill('Out, Up');
    await dialog.locator('input[name=unit]').fill('mm');
    await dialog.getByRole('button', { name: 'Add block', exact: true }).click();
    await p.waitForTimeout(400);
    assert.match(await dialog.locator('p.error').textContent(), /A test named 'Synthetic gap Out \[mm\]' is already in this list\./);
    await dialog.locator('input[name=fields]').fill('Only');
    await dialog.getByRole('button', { name: 'Add block', exact: true }).click(); await p.waitForTimeout(300);
    assert.match(await dialog.locator('p.error').textContent(), /two or more fields/);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal((await items()).length, now.length, 'nothing made by a refused block');

    // 4. ＋ Test: the usual test form, with the section's number and name already in Instructions.
    await p.getByRole('button', { name: 'Add a test to 4.0 Final safety checks', exact: true }).click();
    assert.equal(await dialog.locator('h2').textContent(), 'New test in 4.0 Final safety checks');
    const safety = before.filter((t) => /\[Section: Final safety checks\]/.test(t.description || ''));
    const nextSafety = Math.max(...safety.map((t) => parseInt(/^Template 4\.(\d+)/.exec(t.description)[1], 10))) + 1;
    assert.equal(await dialog.locator('textarea[name=description]').inputValue(), `Template 4.${String(nextSafety).padStart(2, '0')}. [Section: Final safety checks]`);
    assert.equal(await dialog.locator('input[name=category]').inputValue(), safety.at(-1).category);
    await dialog.locator('input[name=name]').fill('Synthetic final check');
    await dialog.locator('select[name=type]').selectOption('boolean');
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await saved();
    now = await items();
    assert.equal(now.at(-1).name, 'Synthetic final check');
    assert.equal(now.length, before.length + 6);

    // 5. The QA form draws them where they were added: the X / Y / Z block, the row of two under the block's name, the test.
    await p.evaluate((h) => { location.hash = h; }, `#/perform/${list}`); await p.waitForSelector('.measure-table'); await p.waitForTimeout(400);
    const shift = p.locator('.measure-block', { has: p.locator('.measure-title strong', { hasText: /^Synthetic shift \[cm\]$/ }) });
    assert.equal(await shift.locator('tr[data-qa-entry]').count(), 1);
    assert.deepEqual(await shift.locator('.qa-shared-field .qa-shared-name > span').allTextContents(), ['X', 'Y', 'Z']);
    assert.match(await shift.locator('.measure-title .qa-limits').textContent(), /^Baseline 0(\.0+)? cm · Warning ±0\.1 cm$/);
    const gapRow = p.locator('tr.qa-inline-row', { has: p.getByLabel('Synthetic gap In [mm]', { exact: true }) });
    assert.deepEqual([await gapRow.locator('.qa-inline-title').textContent(), await gapRow.locator('.qa-inline-name').allTextContents()], ['Synthetic gap', ['In [mm]', 'Out [mm]']]);
    assert.equal(await gapRow.locator('td.qa-measured input[aria-label="Synthetic gap Out [mm]"]').count(), 1);
    const numberOf = (row) => row.locator('td.qa-n').textContent();
    const final = p.locator('tr[data-qa-entry]', { has: p.getByRole('button', { name: 'Synthetic final check: pass', exact: true }) });
    assert.equal(await final.count(), 1);
    assert.match(await numberOf(final), /^4\.\d\d$/);
    assert.equal(await p.locator('.card.section').last().locator('tr[data-qa-entry]').last().evaluate((row, id) => row === document.querySelector(`tr[data-qa-entry] button[aria-label="Synthetic final check: pass"]`).closest('tr')), true, 'the last row of the last section');
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);

    assert.deepEqual(errors, []);
    console.log('Setup QA sections: ＋ Test and ＋ Block on every section\'s title; an X / Y / Z block and a row of named fields added at the end of their section with its number and name; a taken name refused before anything is made; the usual test form prefilled; the QA form draws each where it was added.');
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exit(1); });
