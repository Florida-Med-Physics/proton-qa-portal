// Browser regression for the tables of a list's own repeated measurements on the QA form (Brook, 2026-11-25: "Compress",
// "Make it tabular"), on the browser build (docs/, the seeded proton monthly list on GTR1, synthetic values only, a
// fresh isolated browser context):
//  - range and XRV are a titled table with a row per energy or gantry angle, each row's limits in the Warning ± and
//    Action ± columns (Brook, 2026-11-26: the title says them only while those columns are hidden); typed tables are
//    not closable and stay open;
//  - output and spot QA are a titled table with a row per gantry angle and energy and a column per value (charge and
//    dose; position deviation, σx, σy, skewness), named once in a head row with the baseline and limits they share;
//  - a block has one number, in the list's own sections (XRV 3.01, range 4.01, spot QA 5.01, output 6.01); a row's
//    fields line up under their headings; typing judges each field; the dose follows the charge and the constants of
//    the chamber chosen, which are look-ups from Setup QA's Equipment and never typed (synthetic values, given here to
//    the first sample chamber through the app's own /api/tests);
//  - Show unfinished only, the + for notes and Next unanswered work on such rows; nothing scrolls sideways, and on a
//    narrow window each row is a card whose fields say their own names;
//  - another list's form has no such table (the PBS daily list's Sphinx tables are a row per energy or spot).
// Serve docs locally (port 8791), then run with Playwright available in NODE_PATH: node tests/test_monthly_tables_page.cjs
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
    const lists = await p.evaluate(async () => { const gtr1 = (await api('GET', '/api/machines')).find((m) => m.name === 'GTR1').id; const all = (await api('GET', '/api/assignments')).filter((x) => x.machine_id === gtr1);
      return { monthly: all.find((x) => /Monthly QA template – Proton/.test(x.queue_name)).id, daily: all.find((x) => /PBS DailyQA/.test(x.queue_name)).id }; });
    const open = async (hash) => { await p.evaluate((h) => { location.hash = h; }, hash); await p.waitForSelector('.measure-table'); await p.waitForTimeout(400); };
    // The chamber's constants are look-ups from the chamber chosen (Setup QA, Equipment), blank in the seed. The first
    // sample chamber gets synthetic values, written to the list's own four tests as that page's Save writes them.
    const constants = { 'N_Dw [cGy/nC]': 5, k_Q: 1, k_s: 1, k_pol: 1 }, sampleChamber = 'SAMPLE chamber A — placeholder';
    const lookups = await p.evaluate(async ({ constants, sampleChamber }) => {
      const list = (await api('GET', '/api/queues')).find((q) => /Monthly QA template – Proton/.test(q.name)).id, found = [];
      for (const t of (await api('GET', '/api/tests')).filter((t) => t.owner_queue_id === list && Object.hasOwn(constants, t.name))) {
        const rule = QADerived.read(t.description);
        found.push([t.name, rule.kind, rule.inputs.map((x) => x.name), rule.values.map((row) => [row.choice, row.value])]);
        await api('PUT', `/api/tests/${t.id}`, { name: t.name, category: t.category, unit: t.unit, description: t.description, expected: t.expected, warn: t.warn, fail: t.fail, tol_mode: t.tol_mode,
          active: t.active, owner_queue_id: t.owner_queue_id, type: 'derived', derived: { kind: 'lookup', inputs: rule.inputs, values: rule.values.map((row) => ({ choice: row.choice, value: row.choice === sampleChamber ? constants[t.name] : row.value })) } });
      }
      return found;
    }, { constants, sampleChamber });
    assert.deepEqual(lookups, Object.keys(constants).map((name) => [name, 'lookup', ['Chamber (model / serial)'], [[sampleChamber, null], ['SAMPLE chamber B — placeholder', null]]]), 'four look-ups from the chamber, no value made up in the seed');
    await open(`#/perform/${lists.monthly}`);
    const block = (title) => p.locator('.measure-block', { has: p.locator('.measure-title strong', { hasText: new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) });
    const field = (name) => p.getByLabel(name, { exact: true });
    const x = async (locator) => Math.round((await locator.boundingBox()).x);

    // 1. Four blocks, one number each, in the list's order: each is the first of its own section.
    const titles = await p.locator('.measure-block .measure-title').evaluateAll((nodes) => nodes.map((n) => [n.querySelector('.measure-n')?.textContent, n.querySelector('strong').textContent]));
    const numbered = Object.fromEntries(titles.map(([n, t]) => [t, n]));
    for (const title of ['XRV ISO difference [mm]', 'Output', 'Range R90 (Zebra) [mm]', 'Spot QA']) assert.match(numbered[title] || '', /^\d\.\d\d$/, `${title} is a numbered block`);
    assert.deepEqual([numbered['XRV ISO difference [mm]'], numbered['Range R90 (Zebra) [mm]'], numbered['Spot QA'], numbered.Output], ['3.01', '4.01', '5.01', '6.01']);

    // 2. Range and XRV: a row per energy or angle, each row's limits in the Warning ± and Action ± columns (the title
    // says them only while those columns are hidden), no ⓘ repeated on the rows. Typed, the tables are open and stay so.
    const range = block('Range R90 (Zebra) [mm]'), xrv = block('XRV ISO difference [mm]');
    assert.equal(await range.locator('tr[data-qa-entry]').count(), 17);
    assert.deepEqual((await range.locator('tr[data-qa-entry] td.qa-label strong').allTextContents()).slice(0, 3), ['70 MeV', '80 MeV', '90 MeV']);
    assert.deepEqual(await range.locator('tr[data-qa-entry] td.qa-warn').allTextContents(), Array(17).fill('±0.75'));
    assert.deepEqual(await range.locator('tr[data-qa-entry] td.qa-action').allTextContents(), Array(17).fill('±1'));
    assert.equal(await range.locator('tr[data-qa-entry] td.qa-warn').first().isVisible(), true, 'the limit columns show at this width');
    assert.equal(await range.locator('.measure-title .qa-limits.qa-limits-under').textContent(), 'Warning ±0.75 mm · Action ±1 mm', 'what the title says once the columns are hidden');
    assert.equal(await range.locator('.measure-title .qa-limits').isVisible(), false, 'the title does not repeat them');
    assert.equal(await p.locator('.measure-closable, .measure-closed, .measure-toggle').count(), 0, 'a typed table is not closable');
    assert.equal(await range.locator('tr[data-qa-entry]').first().isVisible(), true);
    assert.equal(await range.locator('tr[data-qa-entry] .qa-calculation-info').count(), 0, 'the block\'s ⓘ says it once');
    assert.equal(await range.locator('.measure-title .qa-calculation-info').count(), 1);
    assert.equal(await range.locator('.matrix-table').count(), 0);
    assert.deepEqual(await xrv.locator('tr[data-qa-entry] td.qa-label strong').allTextContents(), ['G000', 'G060', 'G120', 'G180']);
    assert.equal(await xrv.locator('th[data-col="test"]').first().textContent(), 'Gantry');
    assert.equal(await xrv.locator('tr[data-qa-entry] .qa-calculation-info').count(), 0);

    // 3. Output: a row per gantry angle and energy, charge and dose side by side under their headings.
    const output = block('Output');
    assert.equal(await output.locator('.matrix-table').count(), 1);
    const rows = output.locator('tr.qa-matrix-row:not(.qa-matrix-head)');
    assert.deepEqual(await rows.locator('.qa-matrix-rowlabel').allTextContents(), ['G0 · 70 MeV', 'G0 · 120 MeV', 'G0 · 180 MeV', 'G0 · 225 MeV', 'G90 · 70 MeV', 'G90 · 120 MeV', 'G90 · 180 MeV', 'G90 · 225 MeV']);
    const head = output.locator('tr.qa-matrix-head');
    assert.equal(await head.count(), 1);
    assert.deepEqual(await head.locator('.qa-shared-name > span').allTextContents(), ['Charge [nC]', 'Dose [cGy]']);
    assert.equal(await head.locator('.qa-matrix-rowlabel').textContent(), 'Energy');
    assert.deepEqual(await head.locator('.qa-shared-info').allTextContents(), ['Warning ±1.5 % · Action ±2 %'], 'the dose column says its limits once');
    assert.equal(await rows.locator('.qa-shared-info').count(), 0, 'no row repeats them');
    assert.equal(await rows.locator('.qa-calculation-info').count(), 0, 'a column\'s ⓘ is in its heading');
    for (const energy of ['70', '225']) for (const [k, what] of [[0, 'charge [nC]'], [1, 'dose [cGy]']])
      assert.equal(await x(field(`Output G0 – ${energy} MeV – ${what}`)), await x(field(`Output G90 – 120 MeV – ${what}`)), `${what} boxes in one column`);
    assert.ok(Math.abs(await x(head.locator('.qa-shared-field').nth(1)) - await x(output.locator('.qa-shared-field', { has: field('Output G0 – 70 MeV – dose [cGy]') }))) <= 1, 'a heading over its column');
    assert.equal(await field('Output G0 – 70 MeV – dose [cGy]').getAttribute('readonly'), '', 'the dose is calculated');
    assert.equal(await field('Output G0 – 70 MeV – charge [nC]').getAttribute('readonly'), null, 'the charge is typed, never taken for a Sphinx value');
    // The dose follows the charge: M × kTP × N_Dw × k_Q × k_s × k_pol, the four constants filled from the chamber chosen.
    for (const name of Object.keys(constants)) { assert.equal(await field(name).getAttribute('readonly'), '', `${name} is not typed`); assert.equal(await field(name).inputValue(), '', `${name} is blank until a chamber is chosen`); }
    assert.equal(await field('Chamber (model / serial)').inputValue(), '', 'no chamber is chosen for you');
    await field('Chamber (model / serial)').selectOption(sampleChamber);
    for (const [name, value] of [['Chamber temperature [°C]', '22'], ['Air pressure [hPa]', '1013.25'], ['Output G0 – 70 MeV – charge [nC]', '30']]) { await field(name).fill(value); await field(name).blur(); }
    await p.waitForTimeout(300);
    assert.deepEqual(await Promise.all(Object.keys(constants).map((name) => field(name).evaluate((n) => Number(n.dataset.derivedValue)))), Object.values(constants), 'the chamber\'s constants');
    assert.equal(Number(await field('Output G0 – 70 MeV – dose [cGy]').inputValue()), 150);
    assert.equal(await field('Output G90 – 70 MeV – dose [cGy]').inputValue(), '', 'another row is untouched');

    // 4. Spot QA: four values per row; each is judged where it is typed.
    const spot = block('Spot QA'), spotRows = spot.locator('tr.qa-matrix-row:not(.qa-matrix-head)');
    assert.equal(await spotRows.count(), 6);
    assert.deepEqual(await spot.locator('tr.qa-matrix-head .qa-shared-name > span').allTextContents(), ['Position deviation [mm]', 'σx [%]', 'σy [%]', 'Skewness'], 'σ is not capitalised');
    assert.deepEqual(await spot.locator('tr.qa-matrix-head .qa-shared-info').allTextContents(),
      ['Baseline 0 mm · Warning ±1 mm · Action ±2 mm', 'Warning ±7.5 % · Action ±10 %', 'Warning ±7.5 % · Action ±10 %', 'Baseline 0 · Warning ±0.1 · Action ±0.15']);
    assert.equal(await spotRows.first().locator('input:not(.note-input):not([type=hidden])').count(), 4);
    const judged = async (name, value) => { await field(name).fill(value); await field(name).blur(); return (await spot.locator('.qa-shared-field', { has: field(name) }).locator('.chip').allTextContents()).join(' '); };
    assert.match(await judged('Spot QA G0 – 100 MeV – position deviation [mm]', '0.4'), /PASS/i);
    assert.match(await judged('Spot QA G0 – 100 MeV – skewness', '0.12'), /WARNING/i);
    assert.match(await judged('Spot QA G90 – 220 MeV – skewness', '0.2'), /ACTION/i);
    assert.equal(await spot.locator('.qa-shared-field', { has: field('Spot QA G0 – 160 MeV – σx [%]') }).locator('.chip').count(), 0, 'an empty field shows no verdict');

    // 5. The + opens a note for every value of its row; the row's trend button is there.
    await spotRows.first().locator('button.note-btn').click();
    assert.equal(await spotRows.first().locator('.note-input:visible').count(), 4);
    assert.equal(await spotRows.first().locator('td.qa-trends button').count(), 1);

    // 6. Show unfinished only keeps the head row and the block's number with its rows; Next unanswered lands on a field.
    const widths = async () => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await p.getByLabel('Show unfinished only').check(); await p.waitForTimeout(300);
    assert.equal(await spot.locator('tr.qa-matrix-head').isVisible(), true);
    assert.equal(await spot.locator('td.qa-n-span').count(), 1);
    assert.ok(Math.abs(await x(spot.locator('tr.qa-matrix-head .qa-shared-field').first()) - await x(spot.locator('tr.qa-matrix-row:not(.qa-matrix-head):visible .qa-shared-field').first())) <= 1, 'still lined up');
    await p.getByLabel('Show unfinished only').uncheck();
    await p.getByRole('button', { name: 'Next unanswered' }).click(); await p.waitForTimeout(400);
    assert.ok(await p.evaluate(() => !!document.activeElement && document.activeElement !== document.body), 'something has the focus');

    // 7. Nothing scrolls sideways at a computer's, a tablet's and a phone's width; narrow, a row is a card whose fields
    // say their names and the head row is gone.
    assert.equal(await widths(), 0, '1600');
    for (const width of [1280, 1000, 390]) {
      await p.setViewportSize({ width, height: 900 }); await p.waitForTimeout(400);
      assert.equal(await widths(), 0, `no sideways scroll at ${width}`);
    }
    assert.equal(await spot.locator('tr.qa-matrix-head').isVisible(), false);
    assert.equal(await spotRows.first().locator('.qa-shared-name > span').first().isVisible(), true);
    assert.equal(await spotRows.first().locator('.qa-shared-name > span').first().textContent(), 'Position deviation [mm]');
    await p.setViewportSize({ width: 1600, height: 900 });

    // 8. Another list has no such table: the PBS daily list's Sphinx tables are a row per energy or spot.
    await p.getByRole('button', { name: 'Discard', exact: true }).click().catch(() => {});
    const leave = p.locator('dialog[open]'); if (await leave.count()) await leave.getByRole('button', { name: /Discard|Leave|Yes/ }).first().click().catch(() => {});
    await open(`#/perform/${lists.daily}`);
    assert.equal(await p.locator('.matrix-table').count(), 0);
    assert.ok(await p.locator('.measure-table.energy-table').count() > 5, 'the Sphinx tables');
    assert.deepEqual(errors, []);
    console.log('Monthly tables: range and XRV a row per energy or angle with their limits in the Warning ± and Action ± columns, open; output and spot QA a column per value under a head row; one number per block, in its own section; fields line up and are judged as typed; the dose follows the charge and the chosen chamber\'s constants; notes, unfinished-only and narrow windows work; the PBS daily form has no such table.');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
