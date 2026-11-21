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
    // The Column Chooser: a small window, opened from its button, open while `act` runs.
    const box = p.locator('.qa-columns-pop');
    const chooser = p.getByRole('button', { name: 'Column Chooser', exact: true });
    const columns = async (act) => { await chooser.click(); await box.waitFor(); await act(); await box.getByRole('button', { name: 'Close', exact: true }).click(); await box.waitFor({ state: 'detached' }); await p.waitForTimeout(150); };

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
    const instruction = 'Acquire another kV/kV image to verify BB alignment at the isocenter. Manually realign if needed.';
    const step = p.locator('tr[data-qa-entry]', { has: p.getByRole('button', { name: `${instruction}: pass`, exact: true }) });
    assert.equal(await step.locator('.qa-label strong').textContent(), 'Verify BB alignment with another kV/kV');
    assert.equal(await step.locator('.qa-label strong').getAttribute('title'), instruction);
    await step.getByRole('button', { name: 'Test details', exact: true }).click();
    assert.ok((await dialog.textContent()).includes(instruction), 'the instruction, word for word'); await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await step.locator('.qa-label strong').click();
    assert.ok((await dialog.textContent()).includes(instruction), 'the label opens it too'); await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    const group = p.locator('.measure-block', { has: p.locator('.measure-title', { hasText: 'Mechanical-to-kV/kV Correction Vector' }) }).first();   // X / Y / Z (and their 3D) with their directions in the title
    await group.locator('.measure-title').getByRole('button', { name: 'Test details', exact: true }).click();
    assert.match(await dialog.textContent(), /Record the correction vector/); await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    assert.equal(await group.locator('.qa-shared-field').evaluateAll((fields) => fields.slice(0, 3).filter((f) => f.querySelector('.qa-calculation-info')).length), 0, 'its axes do not repeat the group\'s directions');
    // An X / Y / Z group is one row: its axes side by side, each with its own answer and verdict, the 3D worked out.
    assert.equal(await group.locator('tr[data-qa-entry]').count(), 1);
    assert.deepEqual(await group.locator('.qa-shared-field .qa-shared-name > span').allTextContents(), ['X', 'Y', 'Z', '3D'], 'the unit is in the block\'s name');
    assert.equal(await group.locator('.measure-title strong').textContent(), 'Mechanical-to-kV/kV Correction Vector [cm]');
    // Each field reads "X: [ ]": its letter beside its box, on one line.
    const [letter, boxX] = [await group.locator('.qa-shared-field .qa-shared-name').first().boundingBox(), await group.locator('.qa-shared-field input[type=number]').first().boundingBox()];
    assert.ok(letter.x + letter.width <= boxX.x && letter.y + letter.height / 2 > boxX.y && letter.y + letter.height / 2 < boxX.y + boxX.height, 'the letter is beside its box');
    assert.equal(await group.locator('.qa-shared-field .qa-shared-name > span').first().evaluate((s) => getComputedStyle(s, '::after').content), '":"');
    const offset = p.locator('.measure-block', { has: p.locator('.measure-title', { hasText: 'Mechanical-to-kV/kV Isocenter' }) }).first();
    assert.equal(await offset.locator('tr[data-qa-entry]').count(), 1);
    assert.match(await offset.locator('.measure-title').textContent(), /Baseline 0 cm · Warning ±0\.15 cm · Action ±0\.2 cm$/, 'what the axes share is in the title');
    const [groupName, groupLimits] = [await offset.locator('.measure-title strong').boundingBox(), await offset.locator('.measure-title .qa-limits').boundingBox()];
    assert.ok(groupLimits.y >= groupName.y + groupName.height - 2 && Math.abs(groupLimits.x - groupName.x) <= 2, 'under the group\'s name, at the left');
    for (const [axis, value] of [['X', '0.05'], ['Y', '0.17'], ['Z', '-0.25']]) await p.getByLabel(`Mechanical-to-kV/kV Isocenter ${axis} [cm]`, { exact: true }).fill(value);
    assert.deepEqual((await offset.locator('.qa-shared-field').allTextContents()).map((text) => text.replace(/\s+/g, ' ').trim()),
      ['XPASS(Δ +0.05 cm)', 'YWARNING(Δ +0.17 cm)', 'ZACTION(Δ −0.25 cm)', '3DⓘRecorded(Δ +0.31 cm)']);
    assert.equal(await p.getByLabel('Mechanical-to-kV/kV Isocenter [cm]', { exact: true }).inputValue(), '0.306');
    const tops = await offset.locator('.qa-shared-field').evaluateAll((fields) => fields.map((f) => Math.round(f.getBoundingClientRect().top)));
    assert.equal(new Set(tops).size, 1, 'all on one line');
    assert.equal(await offset.locator('table').evaluate((table) => table.querySelector('tr.quick-trend td').colSpan + 1 === table.querySelectorAll('colgroup col').length), true, 'its quick trend spans the columns beside the number');
    assert.equal(await p.getByLabel('How Sphinx imports work', { exact: true }).count(), 1);
    // The Sphinx import is a row of the Sphinx Measurements section: under the section's title, above its tables, and
    // named for what it does (Brook, 2026-11-20). The steps up to delivering the beam are the section's directions.
    const sphinx = p.locator('.card.section', { has: p.locator(':scope > summary strong', { hasText: /^Sphinx Measurements$/ }) });
    assert.equal(await p.locator('.qa-import').count(), 1);
    assert.equal(await sphinx.locator(':scope > .qa-import').count(), 1, 'inside its section');
    assert.equal(await sphinx.locator(':scope > .qa-import strong').first().textContent(), 'Import Sphinx Measurements');
    assert.equal(await p.getByText('Import measurements', { exact: true }).count(), 0);
    assert.equal(await sphinx.evaluate((box) => box.firstElementChild.nextElementSibling === box.querySelector(':scope > .qa-import')), true, 'right under the section\'s title');
    const [importRow, firstTable] = [await sphinx.locator(':scope > .qa-import').boundingBox(), await sphinx.locator('table').first().boundingBox()];
    assert.ok(importRow.y + importRow.height <= firstTable.y + 1, 'above the section\'s tables');
    await sphinx.locator(':scope > summary .qa-section-info button').click();
    assert.deepEqual(await dialog.locator('ol.qa-steps > li').allTextContents(), ['Retract panels A and B.', 'Go to MyQA, open your machine QA, connect Sphinx, and measure the background.', 'Deliver the beam.']);
    await p.keyboard.press('Escape');
    assert.equal(await sphinx.evaluate((d) => d.open), true, 'the section stays open');
    // What Sphinx measures is filled from its file, never typed: the homogeneity and the coincidence offsets too.
    for (const name of ['Field Homogeneity [%]', 'Isocenter Coincidence [X-ray vs. Proton Beam]: X offset [mm]', 'Isocenter Coincidence [X-ray vs. Proton Beam]: Y offset [mm]', 'Energy [100.00 MeV]: Distal Depth [mm]']) {
      const field = p.getByLabel(name, { exact: true });
      assert.equal(await field.getAttribute('readonly'), '', name);
      assert.equal(await field.getAttribute('placeholder'), 'from file', name);
    }
    for (const name of ['Daily output: Charge [nC]', '[MU] Delivered MU (Record in IC2)', 'Chamber Temperature, °C']) assert.equal(await p.getByLabel(name, { exact: true }).getAttribute('readonly'), null, `${name}: typed`);
    // One row, one number, for what reads as one line: the charge with its dose, each factor with its instrument, X with Y.
    for (const [first, second] of [['Daily output: Charge [nC]', 'Daily output: Dose [cGy]'], ['Isocenter Coincidence [X-ray vs. Proton Beam]: X offset [mm]', 'Isocenter Coincidence [X-ray vs. Proton Beam]: Y offset [mm]'],
      ['Chamber', 'Chamber Cal. Factor(Proton), Gy/C'], ['Electrometer', 'Electrometer Calibration Factor']]) {
      const same = await p.evaluate(([a, b]) => { const row = (name) => { const f = [...document.querySelectorAll('[aria-label]')].find((x) => x.getAttribute('aria-label') === name && x.closest('tr[data-qa-entry]')); return f && f.closest('tr[data-qa-entry]'); }; return !!row(a) && row(a) === row(b); }, [first, second]);
      assert.equal(same, true, `${first} and ${second} share a row`);
    }

    // 3. The Column Chooser: small, opening under its button, and the page stays in use behind it. Show History, move Result left
    // of Measured, hide Unit. What was typed stays.
    const temperature = p.getByLabel('Chamber Temperature, °C', { exact: true });
    await temperature.fill('22.4');
    await columns(async () => {
      const [pop, button] = [await box.boundingBox(), await chooser.boundingBox()];
      assert.ok(pop.width <= 300 && pop.height <= 500, `a small window: ${pop.width} x ${pop.height}`);
      assert.ok(pop.y >= button.y + button.height && Math.abs(pop.x + pop.width - (button.x + button.width)) <= 2, 'under its button');
      assert.equal(await p.locator('dialog[open]').count(), 0, 'not a window over the page');
      assert.equal(await chooser.getAttribute('aria-expanded'), 'true');
      assert.equal(await box.locator('.qa-columns-title strong').textContent(), 'Column Chooser');
      assert.deepEqual(await box.locator('li label').allTextContents(), ['Baseline', 'Measured', 'Unit', 'Result', 'History', 'Note', 'Trend'], 'top to bottom is left to right');
      await box.getByRole('checkbox', { name: 'History', exact: true }).check();
      await box.getByRole('button', { name: 'Move left: Result', exact: true }).click();
      assert.equal(await p.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Move left: Result', 'the arrow just used keeps the keyboard');
      await box.getByRole('button', { name: 'Move left: Result', exact: true }).click();
      await box.getByRole('checkbox', { name: 'Unit', exact: true }).uncheck();
      assert.equal(await box.getByRole('checkbox', { name: 'Measured', exact: true }).isDisabled(), true, 'Measured always shows');
      assert.equal(await box.getByRole('checkbox', { name: 'Result', exact: true }).isDisabled(), true, 'Result always shows');
      assert.equal(await box.getByRole('button', { name: 'Move left: Baseline', exact: true }).isDisabled(), true, 'nothing left of the first');
    });
    const chosen = ['#', 'Test', 'Baseline', 'Result', 'Measured', 'History', 'Note', 'Trend'];
    assert.deepEqual(await headings(), chosen);
    assert.equal(await chooser.getAttribute('aria-expanded'), 'false');
    // Escape closes it too, and so does its button; a click elsewhere does not: it stays open while the form is used.
    await chooser.click(); await box.waitFor();
    await p.keyboard.press('Escape'); await box.waitFor({ state: 'detached' });
    await chooser.click(); await box.waitFor();
    await p.locator('.page-head h1').click(); await p.waitForTimeout(150);
    assert.equal(await box.count(), 1, 'still open after a click elsewhere');
    await chooser.click(); await box.waitFor({ state: 'detached' });
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
    assert.equal(await chooser.count(), 1);
    await columns(async () => { await box.getByRole('checkbox', { name: 'Trend', exact: true }).uncheck(); });
    assert.deepEqual(await headings(), ['#', 'Test', 'Baseline', 'Measured', 'Unit', 'Result', 'History', 'Note']);
    // Reset: the page's own columns again.
    await open(`#/perform/${list}`);
    assert.deepEqual(await headings(), chosen, 'the QA form kept its own');
    await columns(async () => { await box.getByRole('button', { name: 'Reset', exact: true }).click(); });
    const usual = ['#', 'Test', 'Baseline', 'Measured', 'Unit', 'Result', 'Note', 'Trend'];
    assert.deepEqual(await headings(), usual);

    // A heading dragged left or right moves its column on every table of the page, and the choice is kept. Dropped on
    // the left half of a heading it lands before it, on the right half after it; # and Test stay first.
    const heading = (key) => p.locator('.measure-table').first().locator(`tr.qa-col-names th[data-col="${key}"]`);
    const drag = async (key, onto, side) => { const target = await heading(onto).boundingBox(); await heading(key).dragTo(heading(onto), { targetPosition: { x: side === 'left' ? 4 : target.width - 4, y: target.height / 2 } }); await p.waitForTimeout(150); };
    assert.equal(await heading('result').getAttribute('draggable'), 'true');
    assert.equal(await heading('test').getAttribute('draggable'), null, 'Test stays where it is');
    assert.equal(await heading('n').getAttribute('draggable'), null);
    await temperature.fill('22.4');
    await drag('result', 'baseline', 'left');
    assert.deepEqual(await headings(), ['#', 'Test', 'Result', 'Baseline', 'Measured', 'Unit', 'Note', 'Trend']);
    assert.deepEqual(await firstRow(), ['qa-n', 'qa-label', 'qa-result', 'qa-baseline', 'qa-measured', 'qa-unit', 'qa-comment', 'qa-trends'], 'the rows follow their headings');
    await drag('result', 'unit', 'right');
    assert.deepEqual(await headings(), ['#', 'Test', 'Baseline', 'Measured', 'Unit', 'Result', 'Note', 'Trend']);
    await drag('trends', 'test', 'right');
    assert.deepEqual(await headings(), ['#', 'Test', 'Trend', 'Baseline', 'Measured', 'Unit', 'Result', 'Note'], 'dropped on Test: first after it');
    assert.equal(await temperature.inputValue(), '22.4', 'nothing typed is lost');
    assert.equal(await p.locator('.qa-drop-before, .qa-drop-after, .qa-col-dragging').count(), 0, 'no marks left behind');
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    // Every table moved, a hidden column kept its place (History, between Result and Note), and the box shows the order.
    const orders = await p.locator('.measure-table').evaluateAll((tables) => [...new Set(tables.filter((t) => !t.querySelector('td.qa-shared-cell')).map((t) => [...t.querySelectorAll('tr.qa-col-names th')].map((th) => th.dataset.col).join(' ')))]);
    assert.deepEqual(orders, ['n test trends baseline measured unit result history comment'], 'one order on every table');
    await columns(async () => {
      assert.deepEqual(await box.locator('li label').allTextContents(), ['Trend', 'Baseline', 'Measured', 'Unit', 'Result', 'History', 'Note']);
      // A heading dragged while the window is open (moved to the left, off the headings): its list follows.
      const bar0 = await box.locator('.qa-columns-title').boundingBox();
      await p.mouse.move(bar0.x + 40, bar0.y + 10); await p.mouse.down(); await p.mouse.move(160, 420, { steps: 6 }); await p.mouse.up();
      await drag('measured', 'baseline', 'left');
      assert.deepEqual(await box.locator('li label').allTextContents(), ['Trend', 'Measured', 'Baseline', 'Unit', 'Result', 'History', 'Note']);
    });
    await p.reload(); await p.waitForSelector('.measure-table'); await p.waitForTimeout(200);
    assert.deepEqual(await headings(), ['#', 'Test', 'Trend', 'Measured', 'Baseline', 'Unit', 'Result', 'Note'], 'kept for next time');
    await columns(async () => { await box.getByRole('button', { name: 'Reset', exact: true }).click(); });
    assert.deepEqual(await headings(), usual);

    // The Column Chooser is a small window over the page (Brook, 2026-11-20: like the one in Mosaiq and Aria): a
    // right-click on a heading opens it there, it stays open while the form is used, and it is moved by its title. A
    // name dragged up or down its list moves the column; a name dragged onto a heading puts the column there, shown; a
    // heading dragged into the window hides its column (never Measured or Result).
    await heading('unit').click({ button: 'right' }); await box.waitFor();
    const [opened, unitHeading] = [await box.boundingBox(), await heading('unit').boundingBox()];
    // (At the pointer, the middle of the heading, or as near as keeps the whole window on screen.)
    const pointer = { x: unitHeading.x + unitHeading.width / 2, y: unitHeading.y + unitHeading.height / 2 };
    assert.ok(Math.abs(opened.x - Math.min(pointer.x, 1600 - opened.width - 8)) <= 2 && Math.abs(opened.y - Math.min(pointer.y, 900 - opened.height - 8)) <= 2, `opened at the pointer: ${JSON.stringify([opened, pointer])}`);
    await temperature.fill('22.5');
    assert.equal(await box.count(), 1, 'it stays open while the form is used');
    const titleBar = await box.locator('.qa-columns-title').boundingBox();
    await p.mouse.move(titleBar.x + 40, titleBar.y + 10); await p.mouse.down(); await p.mouse.move(titleBar.x - 20, titleBar.y - 30, { steps: 4 }); await p.mouse.up();   // (up and left: it opened as low as fits)
    const moved = await box.boundingBox();
    assert.ok(Math.abs(moved.x - (opened.x - 60)) <= 2 && Math.abs(moved.y - (opened.y - 40)) <= 2, `moved by its title: ${JSON.stringify([opened, moved])}`);
    // Out of the way of the headings (at the left, over the test names), with the first table's headings in view.
    await p.evaluate(() => scrollTo(0, 0));
    const bar = await box.locator('.qa-columns-title').boundingBox();
    await p.mouse.move(bar.x + 40, bar.y + 10); await p.mouse.down(); await p.mouse.move(160, 420, { steps: 6 }); await p.mouse.up();
    assert.ok((await box.boundingBox()).x < 200, 'moved to the left');
    const listed = () => box.locator('li').evaluateAll((items) => items.map((li) => li.dataset.col));
    await box.locator('li[data-col="unit"]').dragTo(box.locator('li[data-col="baseline"]'), { targetPosition: { x: 60, y: 3 } }); await p.waitForTimeout(150);
    assert.deepEqual(await listed(), ['unit', 'baseline', 'measured', 'result', 'history', 'comment', 'trends'], 'a name dragged up the list');
    assert.deepEqual(await headings(), ['#', 'Test', 'Unit', 'Baseline', 'Measured', 'Result', 'Note', 'Trend']);
    const resultHeading = await heading('result').boundingBox();
    await box.locator('li[data-col="history"]').dragTo(heading('result'), { targetPosition: { x: 4, y: resultHeading.height / 2 } }); await p.waitForTimeout(150);
    assert.deepEqual(await headings(), ['#', 'Test', 'Unit', 'Baseline', 'Measured', 'History', 'Result', 'Note', 'Trend'], 'a name dropped on a heading: its column is shown there');
    assert.equal(await box.getByRole('checkbox', { name: 'History', exact: true }).isChecked(), true);
    await heading('unit').dragTo(box.locator('p')); await p.waitForTimeout(150);
    assert.deepEqual(await headings(), ['#', 'Test', 'Baseline', 'Measured', 'History', 'Result', 'Note', 'Trend'], 'a heading dropped in the window: its column is hidden');
    assert.equal(await box.getByRole('checkbox', { name: 'Unit', exact: true }).isChecked(), false);
    await heading('measured').dragTo(box.locator('p')); await p.waitForTimeout(150);
    assert.deepEqual(await headings(), ['#', 'Test', 'Baseline', 'Measured', 'History', 'Result', 'Note', 'Trend'], 'Measured always shows');
    assert.equal(await temperature.inputValue(), '22.5', 'nothing typed is lost');
    assert.equal(await p.locator('.qa-drop-before, .qa-drop-after, .qa-col-dragging, .qa-drop-hide').count(), 0, 'no marks left behind');
    await box.getByRole('button', { name: 'Reset', exact: true }).click();
    assert.deepEqual(await headings(), usual);
    // Leaving the page takes the window with it.
    await p.evaluate(() => { location.hash = '#/queues'; }); await p.waitForTimeout(600);
    assert.equal(await box.count(), 0, 'gone with its page');
    await open(`#/perform/${list}`);
    assert.equal(await chooser.getAttribute('aria-expanded'), 'false');

    // 4. A phone's cards are as before: no Column Chooser, each row its test, answer and verdict.
    await columns(async () => { await box.getByRole('checkbox', { name: 'Baseline', exact: true }).uncheck(); });
    await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(200);
    assert.equal(await chooser.isVisible(), false);
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
    console.log('QA columns on the page: new default order without History; one names row per section; instructions behind ⓘ and Protocol; the Column Chooser is a small window (its button or a right-click on a heading) that shows, hides, moves left and right, takes dragged names and headings, keeps what was typed and is remembered per page; a heading dragged left or right moves its column on every table; Reset; phone cards unchanged.');
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exit(1); });
