// Browser regression for a list's directions (Setup QA's Result Type "Direction: section" and "Direction: test below"; the
// ⓘ beside a section's title, a test or a group on the QA form): serve docs locally (port 8791), then run with Playwright
// available in NODE_PATH. Uses a fresh isolated browser context and the demo accounts; synthetic values only.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.PORTAL_TEST_URL || 'http://127.0.0.1:8791/';
// The setup steps of the PBS daily list, in the list's order: instructions, with nothing to measure or judge.
const STEPS = [
  'Please connect the power cord and the chamber cable to the electrometer (DOSE-X) in the control room, then turn on the electrometer.',
  "Please log in to the 'MOSAIQ2' computer and launch the myQA software.",
  'Place the H-index 3 bar at step 3.',
  "Please setup the Sphinx (index: H3) and move the couch BARS to the patient's right side to prevent potential collision during CBCT.",
  'Please remove the range shifter to prevent collisions and beam delivery.',
  'Please connect the chamber cable in the treatment room.',
  'Send the daily QA chart for this gantry from MOSAIQ to TCS and accept it at TCS.',
];
// Instructions for the test below them: the first for the room lasers check, the other two for the X / Y / Z offset group.
const BEFORE_LASERS = ['Use the hand pendant → Set-up to align PPS, gantry and snout automatically at the isocenter, one at a time.'];
const BEFORE_OFFSET = ['Insert panels A and B.', 'Capture kV/kV images and align finely to the center of the BB image. Record the offset below, then move the couch to correct it.'];
const LASERS = 'Visually check that the room lasers align with the BB; offset must be less than 2 mm.';
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
    const tests = (names = STEPS) => p.evaluate(async (wanted) => (await api('GET', '/api/tests')).filter((t) => wanted.includes(t.name)).map((t) => ({ id: t.id, name: t.name, type: t.type, unit: t.unit, description: t.description })), names);
    const editor = async () => { await p.evaluate((h) => { location.hash = h; }, `#/queues/${queue}`); await p.waitForSelector('table.list-editor tr.compact'); await p.waitForTimeout(200); };
    const rows = p.locator('table.list-editor tr.compact');
    const rowOf = async (name) => rows.nth(await rows.evaluateAll((all, n) => all.findIndex((r) => r.querySelector('.inline-test-name textarea')?.value === n), name));
    const save = async () => { await p.getByRole('button', { name: 'Save template', exact: true }).click(); await p.locator('.chip.due', { hasText: 'Unsaved changes' }).waitFor({ state: 'hidden' }); await p.waitForTimeout(300); };

    // 1. Setup QA: Result Type "Direction: section" on each setup step and "Direction: test below" on the three
    // instructions of the next section, then Save. A list that already carries them is left as it is.
    await editor();
    let changed = 0;
    for (const [names, kind] of [[STEPS, 'direction'], [[...BEFORE_LASERS, ...BEFORE_OFFSET], 'direction_next']]) for (const name of names) {
      const type = (await rowOf(name)).locator('select[aria-label^="Result type"]');
      if (await type.inputValue() !== kind) { await type.selectOption(kind); changed++; }
    }
    if (changed) await save();
    assert.deepEqual(await (await rowOf(STEPS[0])).locator('select[aria-label^="Result type"] option').allTextContents(),
      ['Numeric', 'Pass / fail', 'Pass / warning / fail', 'Text', 'Multiple choice', 'Derived', 'Direction: section', 'Direction: test below']);
    for (const name of STEPS) {
      const row = await rowOf(name);
      assert.equal(await row.locator('select[aria-label^="Result type"]').inputValue(), 'direction');
      assert.equal(await row.locator('.inline-test-name > strong').count(), 0, 'a direction has no number');
      assert.equal(await row.locator('.inline-test-name > .direction-tag').textContent(), 'ⓘ');
      assert.match(await row.textContent(), /Not recorded/);
    }
    // Stored as a Text item with the tag: nothing else about the item changes, and its section stays.
    const stored = await tests();
    assert.equal(stored.length, STEPS.length);
    for (const t of stored) { assert.equal(t.type, 'text'); assert.match(t.description, /\[Section: Setup and Safety\].*\[direction: section\]/); }
    const ids = stored.map((t) => t.id);
    // The tests around them count on: the section's seven fields, then the next section.
    const numbered = await rows.evaluateAll((all) => all.map((r) => r.querySelector('.inline-test-name > strong')?.textContent).filter(Boolean).slice(0, 8));
    assert.deepEqual(numbered, ['1.01:', '1.02:', '1.03:', '1.04:', '1.05:', '1.06:', '1.07:', '2.01:']);
    const below = await tests([...BEFORE_LASERS, ...BEFORE_OFFSET]);
    assert.equal(below.length, 3);
    for (const t of below) { assert.equal(t.type, 'text'); assert.match(t.description, /\[Section: Mechanical and Imaging\].*\[direction: next\]/); }
    for (const name of [...BEFORE_LASERS, ...BEFORE_OFFSET]) {
      const row = await rowOf(name);
      assert.equal(await row.locator('.inline-test-name > strong').count(), 0);
      assert.match(await row.locator('.inline-test-name > .direction-tag').getAttribute('title'), /the test below it/);
    }
    assert.equal(await (await rowOf(LASERS)).locator('.inline-test-name > strong').textContent(), '2.01:', 'the test under a direction takes the next number');

    // 2. The QA form: the section's directions are a numbered list behind the ⓘ beside its title; its rows are its tests.
    await p.evaluate((h) => { location.hash = h; }, `#/perform/${list}`);
    await p.waitForSelector('.measure-table'); await p.waitForTimeout(300);
    const section = p.locator('.card.section').first();
    assert.equal(await section.locator(':scope > summary strong').textContent(), 'Setup and Safety');
    assert.deepEqual(await section.locator('tr[data-qa-entry] td.qa-n').allTextContents(), ['1.01', '1.02', '1.03', '1.04', '1.05', '1.06', '1.07']);
    assert.equal(await p.locator('tr[data-qa-entry]').evaluateAll((all, direction) => all.filter((r) => direction.includes(Number(r.dataset.qaEntry))).length, ids), 0, 'no row for a direction');
    for (const name of STEPS) assert.equal(await p.getByRole('button', { name: `${name}: yes`, exact: true }).count() + await p.getByRole('button', { name: `${name}: pass`, exact: true }).count(), 0, 'nothing to answer');
    assert.match(await section.locator(':scope > summary .section-summary').textContent(), /^3 to do$/, 'only what is entered counts: temperature, pressure and their correction');
    const info = section.locator(':scope > summary .qa-section-info button');
    assert.equal(await info.getAttribute('aria-label'), 'Directions: Setup and Safety');
    const [title, button] = [await section.locator(':scope > summary strong').boundingBox(), await info.boundingBox()];
    assert.ok(button.x >= title.x + title.width && button.x - (title.x + title.width) < 40, 'beside the title');
    await info.click();
    assert.equal(await dialog.locator('h2').textContent(), 'Directions: Setup and Safety');
    assert.deepEqual(await dialog.locator('ol.qa-steps > li').allTextContents(), STEPS, 'every direction, word for word, in the list\'s order');
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    assert.equal(await section.evaluate((d) => d.open), true, 'opening the directions does not fold the section');
    // With the keyboard, too.
    await info.focus(); await p.keyboard.press('Enter');
    assert.equal(await dialog.locator('ol.qa-steps > li').count(), STEPS.length);
    await p.keyboard.press('Escape');
    assert.equal(await section.evaluate((d) => d.open), true);
    // A section whose directions all belong to the test below them has no ⓘ in its title.
    const imaging = p.locator('.card.section').nth(1);
    assert.equal(await imaging.locator(':scope > summary strong').textContent(), 'Mechanical and Imaging');
    assert.equal(await imaging.locator(':scope > summary .qa-section-info').count(), 0);

    // 2b. A direction for the test below: behind that test's ⓘ, ahead of the test's own instruction; no row of its own.
    const lasers = p.locator('tr[data-qa-entry]', { has: p.getByRole('button', { name: `${LASERS}: yes`, exact: true }) });
    assert.equal(await lasers.locator('td.qa-n').textContent(), '2.01');
    for (const name of [...BEFORE_LASERS, ...BEFORE_OFFSET]) assert.equal(await p.getByRole('button', { name: `${name}: pass`, exact: true }).count(), 0, 'nothing to answer');
    await lasers.getByRole('button', { name: 'Test details', exact: true }).click();
    assert.deepEqual(await dialog.locator('ol.qa-steps > li').allTextContents(), BEFORE_LASERS);
    assert.equal(await dialog.locator('.qa-step-text').textContent(), LASERS, 'the test\'s own instruction is there too');
    assert.equal(await dialog.evaluate((d) => !!(d.querySelector('ol.qa-steps').compareDocumentPosition(d.querySelector('.qa-step-text')) & Node.DOCUMENT_POSITION_PRECEDING)), true, 'the test\'s name, then the steps');
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    // Above a group (X / Y / Z): its steps are behind the ⓘ in the group's title, in the list's order, not on a row.
    const offset = p.locator('.measure-block', { has: p.locator('.measure-title', { hasText: 'PPS 2 XRAY Offset' }) }).first();
    assert.equal(await offset.locator('td.qa-n').textContent(), '2.02');
    await offset.locator('.measure-title').getByRole('button', { name: 'Test details', exact: true }).click();
    assert.deepEqual(await dialog.locator('ol.qa-steps > li').allTextContents(), BEFORE_OFFSET);
    assert.match(await dialog.locator('strong').first().textContent(), /PPS 2 XRAY Offset/);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    assert.equal(await offset.locator('tbody .qa-calculation-info').evaluateAll((all) => all.filter((b) => /Insert panels/.test(b.getAttribute('aria-label') || '')).length), 0);
    for (const axis of ['X', 'Y', 'Z']) assert.equal(await offset.locator('.qa-shared-field', { hasText: `${axis} (cm)` }).getByRole('button', { name: /^Test details/ }).count(), 0, 'an axis does not repeat the group\'s steps');
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'nothing scrolls sideways');

    // 3. A run records nothing for a direction, and a blank direction never lowers the run's verdict.
    const run = await p.evaluate(async (id) => { const made = await api('POST', `/api/assignments/${id}/runs`, { results: [] }); return api('GET', `/api/runs/${made.id}`); }, list);
    assert.ok(run.results.length > 50);
    assert.equal(run.results.filter((r) => ids.includes(r.test_id) || below.some((t) => t.id === r.test_id)).length, 0, 'no result for a direction');
    await p.evaluate((h) => { location.hash = h; }, `#/runs/${run.id}`);
    await p.waitForSelector('.measure-table'); await p.waitForTimeout(300);
    for (const name of [...STEPS, ...BEFORE_LASERS, ...BEFORE_OFFSET]) assert.equal(await p.getByText(name, { exact: true }).count(), 0, 'a saved run shows what was recorded');

    // 4. A phone: the ⓘ is in the section's title there too.
    await p.evaluate((h) => { location.hash = h; }, `#/perform/${list}`);
    await p.waitForSelector('.measure-table');
    await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300);
    await p.locator('.card.section').first().locator(':scope > summary .qa-section-info button').click();
    assert.deepEqual(await dialog.locator('ol.qa-steps > li').allTextContents(), STEPS);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    // A card shows no ⓘ: the name of a test with directions above it opens them.
    await p.locator('tr[data-qa-entry]', { has: p.getByRole('button', { name: `${LASERS}: yes`, exact: true }) }).locator('.qa-label strong').click();
    assert.deepEqual(await dialog.locator('ol.qa-steps > li').allTextContents(), BEFORE_LASERS);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await p.setViewportSize({ width: 1600, height: 900 });

    // 5. Back to a test: its type as chosen, the tag gone, its number and its row again.
    await editor();
    await (await rowOf(STEPS[2])).locator('select[aria-label^="Result type"]').selectOption('boolean');
    await save();
    const back = (await tests()).find((t) => t.name === STEPS[2]);
    assert.equal(back.type, 'boolean');
    assert.doesNotMatch(back.description, /direction/);
    assert.equal(await (await rowOf(STEPS[2])).locator('.inline-test-name > strong').textContent(), '1.08:');
    await p.evaluate((h) => { location.hash = h; }, `#/perform/${list}`);
    await p.waitForSelector('.measure-table'); await p.waitForTimeout(300);
    assert.equal(await p.getByRole('button', { name: `${STEPS[2]}: pass`, exact: true }).count(), 1);
    await p.locator('.card.section').first().locator(':scope > summary .qa-section-info button').click();
    assert.deepEqual(await dialog.locator('ol.qa-steps > li').allTextContents(), STEPS.filter((s) => s !== STEPS[2]));
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();

    assert.deepEqual(errors, []);
    console.log('QA directions on the page: Setup QA marks a step as a direction for its section or for the test below (a Text item with the tag, no number); the QA form lists a section\'s behind the ⓘ beside its title and a test\'s or group\'s behind its own ⓘ, and draws only tests; a run records nothing for one; phones too; a direction turns back into a test.');
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exit(1); });
