// Browser regression for Setup QA's Equipment page (Brook, 2026-11-25: "Put in equipment inventory", "Chamber
// selection", "Ndw … aren't editable"), on the browser build (docs/, the seeded lists, synthetic devices and values
// only, a fresh isolated browser context):
//  - the page lists the chambers and electrometers the QA lists choose from, a row per device and a column per test a
//    device fills, read from the lists' own tests (the PBS daily list's sample placeholders to begin with);
//  - Connect a QA List makes a list's test that names the chamber a choice from the page and fills the ticked tests
//    from the chamber chosen (the proton monthly list's N_Dw, k_Q, k_s, k_pol);
//  - a device added, renamed or removed, and a value typed, are saved to every list of that kind; names must be unique;
//  - on the QA form the chamber is chosen, never pre-filled, and its values are filled and cannot be typed over; the
//    dose follows them.
// Serve docs locally (port 8791), then run with Playwright available in NODE_PATH: node tests/test_equipment_page.cjs
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.PORTAL_TEST_URL || 'http://127.0.0.1:8791/';
const shots = process.env.EQUIPMENT_SHOTS || '';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const p = await browser.newPage({ viewport: { width: 1600, height: 900 } }), errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(base);
    await p.locator('[name=username]').fill('Admin'); await p.locator('[name=password]').fill('Admin'); await p.locator('button[type=submit]').click();
    await p.waitForSelector('.dashboard-count');
    const open = async (hash, ready) => { await p.evaluate((h) => { location.hash = h; }, hash); await p.waitForSelector(ready); await p.waitForTimeout(400); };
    const card = (name) => p.locator(`section.equipment-card[aria-label="${name}"]`);
    const names = (c) => c.locator('tbody tr td:first-child input').evaluateAll((list) => list.map((i) => i.value));
    const heads = (c) => c.locator('thead tr:last-child th').allTextContents();
    const lists = (c) => c.locator('thead tr.equipment-lists th').evaluateAll((list) => list.filter((th) => th.textContent).map((th) => [th.textContent, th.colSpan]));
    const saved = async (c) => { await c.getByRole('button', { name: 'Save', exact: true }).click(); await p.waitForSelector('.equipment-card'); await p.waitForTimeout(500); };

    // 1. Setup QA links to it; it shows what the lists already hold: the sample chambers and electrometers of the two
    // seeded lists that choose one (PBS daily, Eyeline daily), each list's filled test a column of its own.
    await open('#/setup', '.section-head');
    await p.getByRole('link', { name: 'Equipment', exact: true }).click();
    await p.waitForSelector('.equipment-card');
    assert.equal(await p.locator('h1').textContent(), 'Equipment');
    const chambers = card('Chambers'), electrometers = card('Electrometers');
    assert.deepEqual(await names(chambers), ['SAMPLE chamber A — placeholder', 'SAMPLE chamber B — placeholder']);
    const before = await heads(chambers);
    assert.deepEqual(before, ['Chamber', 'Chamber Cal. Factor(Proton), Gy/C', 'Chamber Cal. Factor [Gy/C]', ''], 'a list\'s columns together, lists in their own order');
    assert.deepEqual(await lists(chambers), [['PBS DailyQA Template - Sphinx', 1], ['Eyeline Daily QA template', 1]], 'each list is named once, over its tests');
    assert.match(await chambers.textContent(), /Sample devices and placeholder values\. Replace them with your own\./);
    assert.match(await chambers.textContent(), /Chosen on: .*PBS DailyQA Template - Sphinx: Chamber/);
    assert.match(await chambers.textContent(), /Chosen on: .*Eyeline Daily QA template: Chamber/);
    assert.deepEqual(await names(electrometers), ['SAMPLE electrometer A — placeholder', 'SAMPLE electrometer B — placeholder']);
    assert.equal(await chambers.getByRole('button', { name: 'Save', exact: true }).isDisabled(), true, 'nothing to save yet');

    // 2. Connect the proton monthly list: its chamber test becomes the choice, the four constants are filled from it.
    await chambers.getByRole('button', { name: 'Connect a QA List…' }).click();
    const dialog = p.locator('dialog[open]');
    await dialog.getByLabel('QA list').selectOption({ label: 'Monthly QA template – Proton gantry (TG-224)' });
    await p.waitForFunction(() => !document.querySelector('dialog[open] select[name=selection]').disabled);
    await dialog.getByLabel('Test that names the chamber').selectOption({ label: 'Chamber (model / serial)' });
    assert.deepEqual(await dialog.locator('.equipment-filled label').allTextContents(), ['N_Dw [cGy/nC]', 'k_Q', 'k_s', 'k_pol'], 'the typed numbers after it in its category, not the calculated kTP before it');
    for (const name of ['N_Dw [cGy/nC]', 'k_Q', 'k_s', 'k_pol']) await dialog.getByLabel(name, { exact: true }).check();
    await dialog.getByRole('button', { name: 'Connect', exact: true }).click();
    await dialog.waitFor({ state: 'detached' }); await p.waitForSelector('.equipment-card'); await p.waitForTimeout(500);
    assert.deepEqual(await heads(chambers), [...before.slice(0, -1), 'N_Dw [cGy/nC]', 'k_Q', 'k_s', 'k_pol', '']);
    assert.deepEqual((await lists(chambers)).at(-1), ['Monthly QA template – Proton gantry (TG-224)', 4]);
    assert.match(await chambers.textContent(), /Chosen on: .*Monthly QA template – Proton gantry \(TG-224\): Chamber \(model \/ serial\)/);
    const cell = (c, device, test) => c.getByLabel(`${device}: ${test}`, { exact: true });
    assert.equal(await cell(chambers, 'SAMPLE chamber A — placeholder', 'N_Dw [cGy/nC]').inputValue(), '', 'no value is made up for a connected test');
    assert.equal(await cell(chambers, 'SAMPLE chamber A — placeholder', 'Chamber Cal. Factor(Proton), Gy/C').inputValue(), '100000000');

    // 3. A chamber is added once, for every list; its values are typed here. Names must be given and unique.
    await chambers.getByRole('button', { name: '＋ Chamber' }).click();
    assert.equal(await chambers.locator('tbody tr').count(), 3);
    await chambers.getByRole('button', { name: 'Save', exact: true }).click();
    assert.equal(await chambers.locator('[role=status]').textContent(), 'Give every device a name.');
    await chambers.getByLabel('Chamber 3: name').fill('SAMPLE chamber A — placeholder');
    await chambers.getByRole('button', { name: 'Save', exact: true }).click();
    assert.equal(await chambers.locator('[role=status]').textContent(), 'Two devices have the same name.');
    await chambers.getByLabel('Chamber 3: name').fill('SYNTHETIC chamber C');
    for (const [test, value] of [['N_Dw [cGy/nC]', '5'], ['k_Q', '1.02'], ['k_s', '1.003'], ['k_pol', '0.999']]) await chambers.locator('tbody tr').nth(2).locator(`input[aria-label$=": ${test}"]`).fill(value);
    if (shots) await p.screenshot({ path: `${shots}/equipment-1600.png` });
    await saved(chambers);
    assert.deepEqual(await names(chambers), ['SAMPLE chamber A — placeholder', 'SAMPLE chamber B — placeholder', 'SYNTHETIC chamber C']);
    assert.equal(await cell(chambers, 'SYNTHETIC chamber C', 'k_Q').inputValue(), '1.02');
    assert.equal(await cell(chambers, 'SYNTHETIC chamber C', 'Chamber Cal. Factor(Proton), Gy/C').inputValue(), '', 'a value not given stays blank');
    const offered = () => p.evaluate(async () => (await api('GET', '/api/tests')).filter((t) => /\[device: chamber\]/.test(t.description)).map((t) => [t.name, JSON.parse(decodeURIComponent(/\[choices: ([^\]]+)\]/.exec(t.description)[1]))]));
    const choices = await offered();
    assert.deepEqual(choices.map(([name]) => name).sort(), ['Chamber', 'Chamber', 'Chamber (model / serial)'], 'three lists choose a chamber now');
    for (const [name, list] of choices) assert.deepEqual(list, ['SAMPLE chamber A — placeholder', 'SAMPLE chamber B — placeholder', 'SYNTHETIC chamber C'], `${name} offers it`);

    // 4. On the monthly form the chamber is chosen (nothing pre-filled) and fills its four constants, which cannot be typed.
    const monthly = await p.evaluate(async () => { const gtr1 = (await api('GET', '/api/machines')).find((m) => m.name === 'GTR1').id; return (await api('GET', '/api/assignments')).find((x) => x.machine_id === gtr1 && /Monthly QA template – Proton/.test(x.queue_name)).id; });
    await open(`#/perform/${monthly}`, '.measure-table');
    const field = (name) => p.getByLabel(name, { exact: true });
    const chamber = field('Chamber (model / serial)');
    assert.equal(await chamber.evaluate((n) => n.tagName), 'SELECT');
    assert.equal(await chamber.inputValue(), '', 'no chamber is chosen for you');
    assert.deepEqual(await chamber.locator('option').allTextContents(), ['Choose…', 'SAMPLE chamber A — placeholder', 'SAMPLE chamber B — placeholder', 'SYNTHETIC chamber C']);
    for (const name of ['N_Dw [cGy/nC]', 'k_Q', 'k_s', 'k_pol']) { assert.equal(await field(name).getAttribute('readonly'), '', `${name} is not typed`); assert.equal(await field(name).inputValue(), ''); }
    await chamber.selectOption('SYNTHETIC chamber C'); await p.waitForTimeout(300);
    assert.deepEqual(await Promise.all(['N_Dw [cGy/nC]', 'k_Q', 'k_s', 'k_pol'].map((name) => field(name).evaluate((n) => Number(n.dataset.derivedValue)))), [5, 1.02, 1.003, 0.999]);
    assert.deepEqual(await Promise.all(['N_Dw [cGy/nC]', 'k_Q', 'k_s', 'k_pol'].map((name) => field(name).inputValue())), ['5', '1.02', '1.003', '0.999'], 'a device\'s value reads as it was typed, not rounded to three figures');
    const box = await chamber.boundingBox();
    assert.ok(box.width >= 200, `the chamber's name has room (${Math.round(box.width)} px)`);
    for (const [name, value] of [['Chamber temperature [°C]', '22'], ['Air pressure [hPa]', '1013.25'], ['Output G0 – 70 MeV – charge [nC]', '30']]) { await field(name).fill(value); await field(name).blur(); }
    await p.waitForTimeout(300);
    assert.equal(await field('Temp. & Press. Correction kTP').inputValue(), '1.00', 'a calculated value keeps three figures');
    const dose = Number(await field('Output G0 – 70 MeV – dose [cGy]').evaluate((n) => n.dataset.derivedValue));
    assert.ok(Math.abs(dose - 30 * 5 * 1.02 * 1.003 * 0.999) < 1e-9, `dose ${dose}`);
    await chamber.selectOption('SAMPLE chamber A — placeholder'); await p.waitForTimeout(300);
    assert.equal(await field('N_Dw [cGy/nC]').inputValue(), '', 'a chamber with no value leaves its tests blank');
    assert.equal(await field('Output G0 – 70 MeV – dose [cGy]').inputValue(), '', 'and the dose with them');
    if (shots) { await chamber.selectOption('SYNTHETIC chamber C'); await p.waitForTimeout(300); await p.locator('details.section').first().screenshot({ path: `${shots}/monthly-chamber-1600.png` }); }
    await p.getByRole('button', { name: 'Discard', exact: true }).click().catch(() => {});
    const leave = p.locator('dialog[open]'); if (await leave.count()) await leave.getByRole('button', { name: /Discard|Leave|Yes/ }).first().click().catch(() => {});

    // 5. Renamed or removed here, a device is renamed or removed in every list.
    await open('#/equipment', '.equipment-card');
    await chambers.getByLabel('Chamber 3: name').fill('SYNTHETIC chamber C2');
    await saved(chambers);
    await chambers.getByRole('button', { name: 'Remove SAMPLE chamber B — placeholder' }).click();
    await saved(chambers);
    assert.deepEqual(await names(chambers), ['SAMPLE chamber A — placeholder', 'SYNTHETIC chamber C2']);
    assert.equal(await cell(chambers, 'SYNTHETIC chamber C2', 'N_Dw [cGy/nC]').inputValue(), '5', 'a renamed device keeps its values');
    for (const [name, list] of await offered()) assert.deepEqual(list, ['SAMPLE chamber A — placeholder', 'SYNTHETIC chamber C2'], `${name} follows`);
    assert.deepEqual(await names(electrometers), ['SAMPLE electrometer A — placeholder', 'SAMPLE electrometer B — placeholder'], 'the other kind is untouched');

    // 6. The PBS daily form still chooses its chamber and takes its factor from it.
    const daily = await p.evaluate(async () => { const gtr1 = (await api('GET', '/api/machines')).find((m) => m.name === 'GTR1').id; return (await api('GET', '/api/assignments')).find((x) => x.machine_id === gtr1 && /PBS DailyQA/.test(x.queue_name)).id; });
    await open(`#/perform/${daily}`, '.measure-table');
    assert.deepEqual(await field('Chamber').locator('option').allTextContents(), ['Choose…', 'SAMPLE chamber A — placeholder', 'SYNTHETIC chamber C2']);
    await field('Chamber').selectOption('SAMPLE chamber A — placeholder'); await p.waitForTimeout(300);
    assert.equal(Number(await field('Chamber Cal. Factor(Proton), Gy/C').evaluate((n) => n.dataset.derivedValue)), 100000000);
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
    // The Equipment page fits a computer's and a tablet's window; a phone scrolls its table inside its own frame.
    await open('#/equipment', '.equipment-card');
    for (const width of [1600, 1280, 1000, 390]) {
      await p.setViewportSize({ width, height: 900 }); await p.waitForTimeout(300);
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, `the page does not scroll sideways at ${width}`);
    }
    await p.setViewportSize({ width: 1600, height: 900 });
    // A nine-digit factor and a long device name show whole in their boxes at a laptop's width (no stepper arrows in the way).
    await p.setViewportSize({ width: 1440, height: 900 }); await p.waitForTimeout(300);
    const clipped = await chambers.locator('tbody input').evaluateAll((list) => list.filter((i) => i.value && i.scrollWidth > i.clientWidth + 1).map((i) => `${i.getAttribute('aria-label')} = ${i.value}`));
    assert.deepEqual(clipped, [], 'no value is cut off');
    assert.equal(await chambers.getByLabel('SAMPLE chamber A — placeholder: Chamber Cal. Factor(Proton), Gy/C', { exact: true }).inputValue(), '100000000');
    await p.setViewportSize({ width: 1600, height: 900 });
    assert.deepEqual(errors, []);
    console.log('Equipment: one list of chambers and electrometers read from the QA lists; a list is connected from the page; a device is added, renamed and removed for every list; the monthly form chooses its chamber and is filled from it, never typed.');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
