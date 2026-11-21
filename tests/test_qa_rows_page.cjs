// Browser regression for the QA form's rows of several tests and for a test's Reference, on the browser build (docs/,
// the seeded PBS daily list on GTR1, synthetic values only, a fresh isolated browser context):
//  - tests on one row ("Same row as the test above") are a row of the table: the last test is the row's value, under
//    Measured with its baseline and unit in their columns; the tests before it are answered beside their names in the
//    Test column, name and box on one line; everything lines up with the rows around it, like a spreadsheet;
//  - an X / Y pair is a titled block: its number and name, its baseline and limits under the name, "X: [ ] Y: [ ]" below;
//  - a test's Reference (the report its check comes from) is behind its ⓘ, and behind a block's for its tests; Setup
//    QA's test form reads and writes it in a box of its own.
// Serve docs locally (port 8791), then run with Playwright available in NODE_PATH: node tests/test_qa_rows_page.cjs
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
    const open = async (hash, ready = '.measure-table') => { await p.evaluate((h) => { location.hash = h; }, hash); await p.waitForSelector(ready); await p.waitForTimeout(300); };
    const dialog = p.locator('dialog[open]');
    const closeDialog = async () => { await dialog.getByRole('button', { name: 'Close', exact: true }).click(); await dialog.waitFor({ state: 'detached' }); };
    await open(`#/perform/${list}`);

    // 1. A row of two tests: the drop-down beside its name, the factor it sets under Measured.
    const rowOf = (label) => p.locator('tr[data-qa-entry]', { has: p.getByLabel(label, { exact: true }) });
    const chamber = rowOf('Chamber');
    assert.equal(await chamber.count(), 1);
    assert.equal(await chamber.getAttribute('class'), 'qa-inline-row');
    assert.equal(await chamber.locator('td.qa-n').textContent(), '3.03');
    assert.equal(await chamber.locator('td.qa-shared-cell').count(), 0, 'no merged cell');
    assert.equal(await chamber.locator('td.qa-label .qa-inline-title').textContent(), 'Chamber');
    assert.deepEqual(await chamber.locator('td.qa-label .qa-inline-name').allTextContents(), ['Cal. Factor(Proton), Gy/C'], 'the drop-down is named by the row; the factor keeps the rest of its name');
    assert.equal(await chamber.locator('td.qa-label select[aria-label="Chamber"]').count(), 1, 'answered beside its name');
    assert.equal(await chamber.locator('td.qa-measured input[aria-label="Chamber Cal. Factor(Proton), Gy/C"]').count(), 1, 'the row\'s value is under Measured');
    assert.equal((await chamber.locator('td.qa-unit').textContent()).trim(), 'Gy/C');
    const middle = async (locator) => { const b = await locator.boundingBox(); return b.y + b.height / 2; };
    assert.ok(Math.abs(await middle(chamber.locator('.qa-inline-title')) - await middle(chamber.getByLabel('Chamber', { exact: true }))) <= 8, 'the name is on the same line as its drop-down');
    // The same for the electrometer, and for the charge with its dose (one row, one number).
    const [electrometer, output] = [rowOf('Electrometer'), rowOf('Daily output: Charge [nC]')];
    assert.deepEqual([await electrometer.locator('td.qa-n').textContent(), await electrometer.locator('.qa-inline-title').textContent(), await electrometer.locator('.qa-inline-name').allTextContents()], ['3.04', 'Electrometer', ['Calibration Factor']]);
    assert.deepEqual([await output.locator('td.qa-n').textContent(), await output.locator('.qa-inline-title').textContent(), await output.locator('.qa-inline-name').allTextContents()], ['3.06', 'Daily output', ['Charge [nC]', 'Dose [cGy]']], 'a unit in the name is not said again');
    assert.equal(await output.locator('td.qa-label input[aria-label="Daily output: Charge [nC]"]').count(), 1);
    assert.equal(await output.locator('td.qa-measured input[aria-label="Daily output: Dose [cGy]"]').count(), 1);
    assert.match((await output.locator('td.qa-baseline').textContent()).trim(), /^150(\.0+)? cGy$/, 'the dose\'s baseline in the Baseline column');
    assert.equal((await output.locator('td.qa-unit').textContent()).trim(), 'cGy');
    assert.ok(Math.abs(await middle(output.locator('.qa-inline-title')) - await middle(output.getByLabel('Daily output: Charge [nC]', { exact: true }))) <= 8);
    // Lined up like a spreadsheet: every row's value starts at the same place under Measured, every name where the
    // names are, and the drop-downs of the two rows under one another.
    const left = async (locator) => Math.round((await locator.boundingBox()).x);
    const measured = [];
    for (const label of ['[MU] Delivered MU (Record in IC2)', 'Chamber Cal. Factor(Proton), Gy/C', 'Electrometer Calibration Factor', 'Overall Calibration Factor [Gy/C]', 'Daily output: Dose [cGy]'])
      measured.push(await left(p.locator(`td.qa-measured input[aria-label="${label}"]`)));
    assert.equal(new Set(measured).size, 1, `values under Measured: ${measured}`);
    const names = [await left(rowOf('[MU] Delivered MU (Record in IC2)').locator('td.qa-label strong')), await left(chamber.locator('.qa-inline-title')), await left(electrometer.locator('.qa-inline-title')), await left(output.locator('.qa-inline-title'))];
    assert.equal(new Set(names).size, 1, `names in the Test column: ${names}`);
    assert.equal(await left(chamber.getByLabel('Chamber', { exact: true })), await left(electrometer.getByLabel('Electrometer', { exact: true })), 'the drop-downs under one another');
    // It works as before: a choice sets its factor; the charge gives the dose, judged in the row's own Result cell.
    await p.getByLabel('Chamber Temperature, °C', { exact: true }).fill('22');
    await p.getByLabel('Air Pressure [kPa]', { exact: true }).fill('101.3');
    await chamber.getByLabel('Chamber', { exact: true }).selectOption({ index: 1 });
    await electrometer.getByLabel('Electrometer', { exact: true }).selectOption({ index: 1 });
    assert.notEqual(await p.getByLabel('Chamber Cal. Factor(Proton), Gy/C', { exact: true }).inputValue(), '');
    assert.notEqual(await p.getByLabel('Overall Calibration Factor [Gy/C]', { exact: true }).inputValue(), '');
    await p.getByLabel('Daily output: Charge [nC]', { exact: true }).fill('15');
    const dose = Number(await p.getByLabel('Daily output: Dose [cGy]', { exact: true }).inputValue());
    assert.ok(dose > 0, `a dose from the charge: ${dose}`);
    assert.match(await output.locator('td.qa-result').textContent(), /Δ/, 'its deviation from the baseline under Result');
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'nothing scrolls sideways');
    // "Next unanswered" reaches a test answered beside its name.
    await electrometer.getByLabel('Electrometer', { exact: true }).selectOption({ index: 0 });
    assert.equal(await electrometer.evaluate((row) => !!row.querySelector('select[aria-label="Electrometer"]')), true);

    // 2. An X / Y pair: a titled block like X / Y / Z. Its number and name, what the two share under the name, then
    // "X: [ ] Y: [ ]" on the row below.
    const pair = p.locator('.measure-block', { has: p.locator('.measure-title strong', { hasText: /^Isocenter Coincidence \[X-ray vs\. Proton Beam\]$/ }) });
    assert.equal(await pair.count(), 1);
    assert.equal(await pair.locator('.measure-title .measure-n').textContent(), '3.20');
    assert.match(await pair.locator('.measure-title .qa-limits').textContent(), /^Baseline 0(\.0+)? mm · Warning ±0\.5 mm · Action ±1 mm$/);
    assert.equal(await pair.locator('tr[data-qa-entry]').count(), 1);
    assert.deepEqual(await pair.locator('.qa-shared-field .qa-shared-name > span').allTextContents(), ['X', 'Y'], 'the unit is with the limits, once');
    const [title, x, y] = [await pair.locator('.measure-title strong').boundingBox(), await pair.locator('input[aria-label$="X offset [mm]"]').boundingBox(), await pair.locator('input[aria-label$="Y offset [mm]"]').boundingBox()];
    assert.ok(x.y > title.y + title.height && Math.abs(x.y - y.y) <= 1 && y.x > x.x + x.width, 'X and Y side by side on the row below the name');
    assert.equal(await pair.locator('.qa-shared-field .qa-shared-name > span').first().evaluate((s) => getComputedStyle(s, '::after').content), '":"');
    // Its fields start where the X / Y / Z blocks' do.
    const xyz = p.locator('.measure-block', { has: p.locator('.measure-title strong', { hasText: 'Mechanical-to-kV/kV Isocenter' }) }).first();
    assert.equal(await left(pair.locator('.qa-shared-field input').first()), await left(xyz.locator('.qa-shared-field input').first()), 'X under X');

    // 3. The report a check comes from, behind its ⓘ: a block's (said once for its tests), a calculated value's, and
    // nothing where a test has neither directions nor a reference.
    const reference = async (button, text) => {
      await button.click();
      assert.equal(await dialog.locator('.qa-reference').count(), 1);
      assert.equal(await dialog.locator('.qa-reference .directions-label').textContent(), 'Reference');
      assert.equal((await dialog.locator('.qa-reference').textContent()).replace(/^Reference/, ''), text);
      await closeDialog();
    };
    await reference(xyz.locator('.measure-title').getByRole('button', { name: 'Test details', exact: true }), 'TG-224, Mechanical: laser position accuracy 0.2 cm');
    await reference(pair.locator('.measure-title').getByRole('button', { name: 'Test details', exact: true }), 'TG-224, Imaging: X-ray and proton beam isocenter coincidence < 1 mm');
    const distal = p.locator('.measure-block', { has: p.locator('.measure-title strong', { hasText: /^Distal Depth \[mm\]$/ }) });
    await reference(distal.locator('.measure-title').getByRole('button', { name: 'Test details', exact: true }), 'TG-224, Dosimetry: distal depth 1 mm at the distal 90 % depth dose');
    await reference(output.getByRole('button', { name: 'Calculation details: Dose [cGy]', exact: true }), 'TG-224, Dosimetry: output < 3 % for different energies on different days with one consistent field');
    const mu = rowOf('[MU] Delivered MU (Record in IC2)');
    assert.equal(await mu.locator('button.qa-calculation-info').count(), 0, 'nothing to say: no ⓘ');

    // 4. Setup QA: a test's Reference is a box of its own in the test form; Instructions does not repeat it. Saved, it is
    // the last line of the test's field, and the QA form shows it; cleared, the field is as it was.
    const stored = () => p.evaluate(async () => (await api('GET', '/api/tests')).find((t) => t.name === '[MU] Delivered MU (Record in IC2)').description);
    const was = await stored();
    assert.doesNotMatch(was, /Reference:/);
    const edit = async (fill) => {
      await open(`#/queues/${queue}`, 'table.list-editor tr.compact');
      await p.getByRole('button', { name: 'Edit test: [MU] Delivered MU (Record in IC2)', exact: true }).click();
      await dialog.waitFor();
      const shown = { reference: await dialog.locator('input[name=reference]').inputValue(), instructions: await dialog.locator('textarea[name=description]').inputValue() };
      await dialog.locator('input[name=reference]').fill(fill);
      await dialog.getByRole('button', { name: 'Save', exact: true }).click();
      await dialog.waitFor({ state: 'detached' }); await p.waitForTimeout(800);
      return shown;
    };
    assert.deepEqual(await edit('Synthetic report, section 1'), { reference: '', instructions: was });
    assert.equal(await stored(), `${was}\nReference: Synthetic report, section 1`);
    await open(`#/perform/${list}`);
    await reference(rowOf('[MU] Delivered MU (Record in IC2)').getByRole('button', { name: 'Test details', exact: true }), 'Synthetic report, section 1');
    assert.deepEqual(await edit(''), { reference: 'Synthetic report, section 1', instructions: was }, 'its own box; Instructions as before');
    assert.equal(await stored(), was, 'cleared: the field as it was');

    assert.deepEqual(errors, []);
    console.log('QA rows on the page: tests on one row are a row of the table (the last under Measured with its baseline and unit, the others beside their names, all lined up with the rows around them); an X / Y pair is a titled block; a Reference behind a test\'s and a block\'s ⓘ, read and written in Setup QA\'s test form.');
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exit(1); });
