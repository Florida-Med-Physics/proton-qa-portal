// Browser regression for the tabular QA form (Brook, 2026-11-26: "Make this look a lot more tabular", "make each row
// have much less height", "don't automatically show it … I'm trying to reduce the amount of scrolling required";
// 2026-11-27: "Make this more cell like/tabular", "Each QA list to run should have much smaller row heights"), on the
// browser build (docs/, the seeded PBS daily and proton monthly lists on GTR1, synthetic values only, fresh isolated
// browser contexts):
//  - a test is one line of the table: its limits are in the Warning ± and Action ± columns, its Baseline is a number
//    alone, and no line of limits shows under its name while those columns do;
//  - the tables a Sphinx file fills start closed, one line each saying "from file", then the worst verdict with the
//    worst row and its Δ; a table opens and closes from its Show / Hide and from its title line, never by itself (not
//    even for an ACTION); Next unanswered opens the one it lands in, so the focus is never inside a closed table;
//  - closed, the Sphinx Measurements section is at most half as tall as with every table open (in this build's large
//    type; about a fifth at the website's size): less scrolling;
//  - rows are short: a plain one-test row of the proton monthly form is 48 px at most where its name fits on one
//    line (1920 px in this build's large type), a row of the
//    Perform QA list 44 px at most with its schedule on the line of its name;
//  - on a computer a QA table is a grid of cells: every body cell has a left and a right border, a one-test row's
//    Measured box fills its cell, and in a matrix a verdict follows its box on the same line;
//  - the proton monthly form has its eight sections in order and its combined lines (0.05, 2.01, 2.03, 2.12), each one
//    row of the table with its fields in order;
//  - nothing scrolls sideways at 1600, 1280, 1000 and 390 px on either form; where the limit columns have no room
//    (1000 px: a window narrowed to it, and one opened at it) they are left out and the limits are under the name.
// What is measured of the layout (heights, positions, what shows at a width) is collected as it is met and judged
// once, at the end, so one run names every shortfall; everything else is asserted where it is checked.
// Serve docs locally (port 8791), then run with Playwright available in NODE_PATH: node tests/test_tabular_form_page.cjs
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.PORTAL_TEST_URL || 'http://127.0.0.1:8791/';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const errors = [], shortfalls = [];
    const fits = (ok, shortfall) => { if (!ok) shortfalls.push(shortfall); };
    // A signed-in page of its own (a fresh context), its window `width` px wide, and GTR1's two lists there.
    const signIn = async (width) => {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(base);
      await page.locator('[name=username]').fill('Admin'); await page.locator('[name=password]').fill('Admin'); await page.locator('button[type=submit]').click();
      await page.waitForSelector('.dashboard-count');
      const lists = await page.evaluate(async () => { const gtr1 = (await api('GET', '/api/machines')).find((m) => m.name === 'GTR1').id; const all = (await api('GET', '/api/assignments')).filter((x) => x.machine_id === gtr1);
        return { monthly: all.find((x) => /Monthly QA template – Proton/.test(x.queue_name)), daily: all.find((x) => /PBS DailyQA/.test(x.queue_name)) }; });
      return { page, lists };
    };
    // (A table's width settles a frame or two after it is drawn: the Test column is fitted section by section.)
    const open = async (page, list) => { await page.evaluate((id) => { location.hash = `#/perform/${id}`; }, list.id);
      await page.waitForFunction((name) => (document.querySelector('h1')?.textContent || '').includes(name) && !!document.querySelector('.measure-table'), list.queue_name); await page.waitForTimeout(500); };
    const limits = async (page, list) => { const t = await page.evaluate((id) => api('GET', `/api/assignments/${id}/template`), list.id); return (name) => { const item = t.items.find((i) => i.name === name); return { ...item.limits, unit: item.unit }; }; };
    const block = (page, title) => page.locator('.measure-block', { has: page.locator('.measure-title strong', { hasText: new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) });
    const row = (page, name) => page.locator('tr[data-qa-entry]', { has: page.getByLabel(name, { exact: true }) });
    const sideways = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    // Where a test's limits show: its two limit cells, the headings over them, the line under its name.
    const limitsShown = (page, name) => row(page, name).evaluate((tr) => { const shown = (n) => !!n && n.getClientRects().length > 0;
      return { cells: ['td.qa-warn', 'td.qa-action'].filter((cell) => shown(tr.querySelector(cell))).length, headings: [...tr.closest('table').querySelectorAll('thead th[data-col="warn"], thead th[data-col="action"]')].filter(shown).length, under: shown(tr.querySelector('.qa-limits-under')) }; });
    // A QA table is a grid of cells on a computer: every body cell has a rule on its left and on its right, and in a
    // one-test row the box (typed, calculated or from a file) fills its Measured cell.
    const cells = async (page, form) => {
      const seen = await page.evaluate(() => {
        const shown = (n) => n.getClientRects().length > 0, ruled = (n) => { const s = getComputedStyle(n); return ['Left', 'Right'].every((side) => s[`border${side}Style`] !== 'none' && parseFloat(s[`border${side}Width`]) > 0); };
        const body = [...document.querySelectorAll('.measure-table > tbody > tr > td')].filter(shown);
        const boxes = [...document.querySelectorAll('.measure-table > tbody > tr[data-qa-entry] > td.qa-measured:not(.qa-shared-cell)')].filter(shown).map((td) => [td, td.querySelector(':scope > .result-input, :scope > .text-input')]).filter(([, box]) => box);
        return { cells: body.length, open: body.filter((td) => !ruled(td)).map((td) => `${td.className}: ${td.textContent.trim().slice(0, 30)}`), boxes: boxes.length,
          loose: boxes.map(([td, box]) => [box.getAttribute('aria-label'), Math.round((td.getBoundingClientRect().width - box.getBoundingClientRect().width) * 10) / 10]).filter(([, gap]) => Math.abs(gap) > 2) };
      });
      assert.ok(seen.cells > 100 && seen.boxes > 20, `${form}: ${seen.cells} cells and ${seen.boxes} boxes to look at`);
      fits(!seen.open.length, `${form}, 1600 px: ${seen.open.length} body cells lack a left or a right border (${seen.open.slice(0, 3).join('; ')})`);
      fits(!seen.loose.length, `${form}, 1600 px: the Measured box of ${seen.loose.length} one-test rows does not fill its cell (${seen.loose.slice(0, 3).map(([name, gap]) => `${name}: ${gap} px narrower`).join('; ')})`);
    };
    // No sideways scroll at a computer's, a laptop's, a tablet's and a phone's width; narrowed to the tablet's, where
    // the limit columns have no room, they are left out and the limits are on the line under the name.
    const widths = async (page, form, name) => {
      for (const width of [1600, 1280, 1000, 390]) {
        await page.setViewportSize({ width, height: 900 }); await page.waitForTimeout(400);
        fits(await sideways(page) === 0, `${form}: the page scrolls sideways at ${width} px`);
        if (width !== 1000) continue;
        const at = await limitsShown(page, name);
        fits(at.cells === 0 && at.headings === 0, `${form}, narrowed to 1000 px: the limit columns still show`);
        fits(at.under, `${form}, narrowed to 1000 px: the limits of "${name}" are not on the line under its name`);
      }
      await page.setViewportSize({ width: 1600, height: 900 }); await page.waitForTimeout(400);
    };

    // 1. The PBS daily form, 1600 px wide. A test is one line: the headings name the two limit columns, a single test
    // says its limits there (the seed's own, read from the list), its Baseline is a number alone, and the line of
    // limits under its name does not show.
    const { page: p, lists } = await signIn(1600);
    await open(p, lists.daily);
    const daily = await limits(p, lists.daily);
    assert.deepEqual(await p.locator('.measure-table').first().locator('thead tr.qa-col-names th:visible').allTextContents(), ['#', 'Test', 'Baseline', 'Measured', 'Unit', 'Warning ±', 'Action ±', 'Result', 'Note', 'Trend']);
    const homogeneity = row(p, 'Field Homogeneity [%]'), fh = daily('Field Homogeneity [%]');
    assert.ok([fh.expected, fh.warn, fh.fail].every((v) => typeof v === 'number') && fh.tol_mode !== 'percent', 'the seed gives it a baseline and both limits');
    assert.equal(await homogeneity.locator('td.qa-warn').textContent(), `±${fh.warn}`);
    assert.equal(await homogeneity.locator('td.qa-action').textContent(), `±${fh.fail}`);
    assert.deepEqual(await limitsShown(p, 'Field Homogeneity [%]'), { cells: 2, headings: 2, under: false }, 'in its two columns, not under its name');
    const baseline = await homogeneity.locator('td.qa-baseline').textContent();
    assert.match(baseline, /^-?\d+(\.\d+)?$/, 'the Baseline is a number alone');
    assert.equal(Number(baseline), fh.expected);
    assert.equal(await homogeneity.locator('td.qa-unit').textContent(), fh.unit, 'the Unit column says the unit');
    assert.equal(await homogeneity.locator('.qa-limits-under').count(), 1, 'the line under the name is kept for when the columns are gone');

    // 2. The tables a file fills start closed: one line each, its name and "from file".
    const sphinx = ['Distal Depth [mm]', 'Distal Fall Off [mm]', 'Proximal Depth [mm]', 'Width [mm]', 'Position X', 'Position Y', 'Sigma X', 'Sigma Y', 'Skewness X', 'Skewness Y', 'Intensity'];
    const closed = () => p.locator('.measure-block.measure-closable.measure-closed > .measure-title > strong').allTextContents();
    assert.deepEqual(await p.locator('.measure-block.measure-closable > .measure-title > strong').allTextContents(), sphinx);
    assert.deepEqual(await closed(), sphinx, 'every one starts closed');
    for (const title of sphinx) {
      const b = block(p, title);
      assert.equal(await b.locator('.measure-wrap').isVisible(), false, `${title}: its table is hidden`);
      assert.equal(await b.locator('.measure-summary').textContent(), 'from file', `${title}: nothing read yet`);
      assert.equal(await b.locator('button.measure-toggle').textContent(), 'Show');
      assert.equal(await b.locator('button.measure-toggle').getAttribute('aria-expanded'), 'false');
    }

    // 3. Less scrolling, the point of it: closed, the section is at most half as tall as with every table open. (This
    // build's type is large, 22 px, so a line of several tests wraps here; at the website's size it is about a fifth.)
    // (While they are open: the grid of cells, over every row of the form.)
    const section = p.locator('details.section', { has: p.locator('summary > strong', { hasText: /^Sphinx Measurements$/ }) });
    const height = async () => Math.round((await section.boundingBox()).height);
    const closedHeight = await height();
    for (const title of sphinx) await block(p, title).locator('button.measure-toggle').click();
    await p.waitForTimeout(400);
    assert.deepEqual(await closed(), [], 'each opens from its Show');
    for (const title of sphinx) {
      const b = block(p, title);
      assert.equal(await b.locator('tr[data-qa-entry]').first().isVisible(), true, `${title}: its rows show`);
      assert.equal(await b.locator('button.measure-toggle').textContent(), 'Hide');
      assert.equal(await b.locator('button.measure-toggle').getAttribute('aria-expanded'), 'true');
    }
    const openHeight = await height();
    fits(closedHeight * 2 <= openHeight, `PBS daily, 1600 px: the Sphinx Measurements section is ${closedHeight} px tall with its tables closed, more than half of the ${openHeight} px it is with them open`);
    await cells(p, 'PBS daily');
    for (const title of sphinx) await block(p, title).locator('button.measure-toggle').click();
    await p.waitForTimeout(400);
    assert.deepEqual(await closed(), sphinx, 'and closes from its Hide');
    assert.equal(await height(), closedHeight);

    // 4. Filled as an import fills them (the value, then an input event, on each read-only field), a closed table says
    // its worst verdict and names the worst row with its Δ. It never opens by itself, not even for an ACTION.
    // Synthetic values, from each row's own baseline and limits: the baseline, then one row beyond its Action limit
    // and one between its limits.
    const depth = block(p, 'Distal Depth [mm]'), summary = depth.locator('.measure-summary');
    const fields = await depth.locator('tr[data-qa-entry]').evaluateAll((rows) => rows.map((tr) => { const input = tr.querySelector('td.qa-measured input');
      return { name: input.getAttribute('aria-label'), label: tr.querySelector('td.qa-label strong').textContent, readOnly: input.readOnly, placeholder: input.placeholder }; }));
    assert.equal(fields.length, 3);
    for (const f of fields) {
      assert.deepEqual([f.readOnly, f.placeholder], [true, 'from file'], `${f.name} is read from the file, not typed`);
      Object.assign(f, daily(f.name));
      assert.ok([f.expected, f.warn, f.fail].every((v) => typeof v === 'number') && f.warn < f.fail && f.tol_mode !== 'percent', `${f.name} has a baseline and both limits`);
    }
    const fill = (values) => depth.locator('tr[data-qa-entry] td.qa-measured input').evaluateAll((inputs, values) => inputs.forEach((input, i) => { if (values[i] === null) return; input.value = String(values[i]); input.dispatchEvent(new Event('input')); }), values);
    const said = async () => ({ verdict: await summary.locator('.chip').allTextContents(), row: await summary.locator('.measure-summary-row').allTextContents(), also: await summary.locator('.muted.small').allTextContents(), closed: await depth.evaluate((n) => n.classList.contains('measure-closed')) });
    await fill([fields[0].expected, fields[1].expected, null]);
    assert.deepEqual(await said(), { verdict: ['PASS'], row: [], also: ['2 of 3'], closed: true }, 'two rows read, both at their baselines');
    await fill([null, null, fields[2].expected]);
    assert.deepEqual(await said(), { verdict: ['PASS'], row: [], also: [], closed: true }, 'every row at its baseline');
    const worst = `${fields[1].label} (Δ +${(2 * fields[1].fail).toFixed(2)} ${fields[1].unit})`;
    await fill([null, fields[1].expected + 2 * fields[1].fail, null]);
    assert.deepEqual(await said(), { verdict: ['ACTION'], row: [worst], also: [], closed: true }, 'a row beyond its Action limit is named, and the table stays closed');
    await fill([null, null, fields[2].expected + (fields[2].warn + fields[2].fail) / 2]);
    assert.deepEqual(await said(), { verdict: ['ACTION'], row: [worst], also: ['1 more'], closed: true }, 'the worst row is the one named');

    // 5. It opens and closes from its Show / Hide and from its title line; open, its rows say the same verdicts.
    const toggle = depth.locator('button.measure-toggle'), shows = async () => [await depth.evaluate((n) => n.classList.contains('measure-closed')), await depth.locator('tr[data-qa-entry]').first().isVisible(), await toggle.getAttribute('aria-expanded'), await toggle.textContent()];
    await toggle.click();
    assert.deepEqual(await shows(), [false, true, 'true', 'Hide']);
    assert.deepEqual(await depth.locator('tr[data-qa-entry] td.qa-result .chip').allTextContents(), ['PASS', 'ACTION', 'WARNING']);
    await toggle.click();
    assert.deepEqual(await shows(), [true, false, 'false', 'Show']);
    await depth.locator('.measure-title > strong').click();
    assert.deepEqual(await shows(), [false, true, 'true', 'Hide'], 'a click on the title line opens it');
    await depth.locator('.measure-title > strong').click();
    assert.deepEqual(await shows(), [true, false, 'false', 'Show'], 'and closes it');
    assert.deepEqual(await closed(), sphinx);

    // 6. Next unanswered never leaves the focus inside a closed table: it opens the one it lands in (the first that
    // still lacks its values), and no other.
    const next = p.getByRole('button', { name: 'Next unanswered' });
    let landed = null;
    for (let i = 1; i <= 60 && !landed; i++) {
      await next.click();
      const at = await p.evaluate(() => { const a = document.activeElement, table = a && a.closest('.measure-closable');
        return { focused: !!a && a !== document.body, inClosed: !!(a && a.closest('.measure-closed')), seen: !!a && a.getClientRects().length > 0, table: table ? table.querySelector('.measure-title > strong').textContent : null }; });
      assert.deepEqual([at.focused, at.inClosed, at.seen], [true, false, true], `Next unanswered, click ${i}: something that shows has the focus, outside any closed table`);
      landed = at.table;
    }
    assert.equal(landed, 'Distal Fall Off [mm]', 'it reaches the first table a file fills that lacks its values');
    assert.deepEqual(await closed(), sphinx.filter((title) => title !== landed), 'only that one was opened');

    // 7. The daily form at four widths.
    await widths(p, 'PBS daily', 'Field Homogeneity [%]');

    // 8. The proton monthly form: its eight sections in order, and its combined lines, each one row of the table with
    // its fields in order (the maximum radial displacement last).
    await open(p, lists.monthly);
    const monthly = await limits(p, lists.monthly);
    const names = ['Chamber and conditions', 'Safety', 'Mechanical', 'Isocentricity / XRV', 'Range / Zebra', 'Spot Characteristics / Sphinx', 'Output', 'Imaging'];
    assert.deepEqual(await p.locator('h2.section-head').allTextContents(), names.map((name, n) => `${n}.0 ${name}`));
    assert.deepEqual(await p.locator('details.section > summary > strong').allTextContents(), names);
    assert.deepEqual(await p.locator('tr.qa-line-row').evaluateAll((rows) => rows.map((tr) => [tr.querySelector('td.qa-n').textContent, tr.querySelector('.qa-line-title')?.textContent ?? null, [...tr.querySelectorAll('.qa-line-field')].map((f) => f.querySelector('.qa-line-name')?.textContent ?? null)])), [
      ['0.05', null, ['Chamber (model / serial)', 'N_Dw [cGy/nC]', 'k_Q', 'k_s', 'k_pol']],
      ['2.01', 'Couch translational accuracy [mm]', ['X (lateral)', 'Y (longitudinal)', 'Z (vertical)']],
      ['2.03', 'Couch accuracy [deg]', ['Pitch', 'Roll', 'Yaw']],
      ['2.12', 'Couch isocentricity [mm]', ['Range of ΔX (max − min)', 'Range of ΔY (max − min)', 'Range of ΔZ (max − min)', 'Max radial displacement']]]);
    assert.equal(await p.locator('.measure-closable, .measure-closed').count(), 0, 'typed tables are not closable');

    // 9. Rows are short: a plain one-test row (the Safety section's Pass / Fail rows, a typed number) is 48 px at most.
    // Measured at 1920 px, where every one of these names fits on one line in this build's large type.
    await p.setViewportSize({ width: 1920, height: 900 }); await p.waitForTimeout(500);
    const plain = await p.locator('details.section', { has: p.locator('summary > strong', { hasText: /^Safety$/ }) }).locator('tr[data-qa-entry]').evaluateAll((rows) => rows.map((tr) => [tr.querySelector('td.qa-n').textContent, tr.querySelector('.qa-test-name').textContent, Math.round(tr.getBoundingClientRect().height)]));
    assert.equal(plain.length, 7);
    plain.push(await row(p, 'Couch trueness (vertical sag) [mm]').evaluate((tr) => [tr.querySelector('td.qa-n').textContent, tr.querySelector('.qa-test-name').textContent, Math.round(tr.getBoundingClientRect().height)]));
    for (const [n, name, tall] of plain) fits(tall <= 48, `proton monthly, 1920 px: row ${n} ${name} is ${tall} px tall (48 px at most)`);
    await p.setViewportSize({ width: 1600, height: 900 }); await p.waitForTimeout(500);

    // 10. The grid of cells here too. In a matrix (several values per row) the table's general headings row is
    // collapsed, its own head row names the columns, and a verdict follows its box on the same line: PASS alone, its Δ
    // on the chip; a WARNING or an ACTION says its Δ. Synthetic values, from each test's own baseline and limits.
    await cells(p, 'proton monthly');
    const spot = block(p, 'Spot QA');
    assert.equal(await spot.locator('thead tr.qa-col-names').count(), 1);
    fits(await spot.locator('thead tr.qa-col-names').evaluate((tr) => tr.getBoundingClientRect().height) <= 1, 'proton monthly, 1600 px: the general headings row of the Spot QA matrix is not collapsed');
    assert.equal(await spot.locator('tr.qa-matrix-head').isVisible(), true);
    const emptyRow = await spot.locator('tr.qa-matrix-row:not(.qa-matrix-head)').last().evaluate((tr) => Math.round(tr.getBoundingClientRect().height));
    const judged = async (name, offset) => {
      const input = p.getByLabel(name, { exact: true }), l = monthly(name);
      assert.ok([l.expected, l.warn, l.fail].every((v) => typeof v === 'number') && l.warn < l.fail && l.tol_mode !== 'percent', `${name} has a baseline and both limits`);
      await input.fill(String(l.expected + offset(l))); await input.blur();
      return spot.locator('.qa-shared-field', { has: input }).evaluate((field) => { const box = field.querySelector('input:not(.note-input):not([type=hidden])').getBoundingClientRect(), chip = field.querySelector('.chip'), c = chip.getBoundingClientRect(), delta = field.querySelector('.result-dev');
        return { verdict: chip.textContent, title: chip.title, delta: delta && delta.getClientRects().length ? delta.textContent : null, beside: c.left >= box.right - 1 && (c.top + c.bottom) / 2 > box.top && (c.top + c.bottom) / 2 < box.bottom, row: Math.round(field.closest('tr').getBoundingClientRect().height) }; });
    };
    for (const [name, verdict, offset] of [['Spot QA G0 – 100 MeV – position deviation [mm]', 'PASS', (l) => l.warn / 2], ['Spot QA G0 – 160 MeV – skewness', 'WARNING', (l) => (l.warn + l.fail) / 2], ['Spot QA G90 – 220 MeV – skewness', 'ACTION', (l) => 2 * l.fail]]) {
      const at = await judged(name, offset);
      assert.equal(at.verdict, verdict, name);
      assert.match(at.title, /^\(Δ \+\d+\.\d\d( \S+)?\)$/, `${name}: the Δ is on its chip`);
      assert.equal(at.delta, verdict === 'PASS' ? null : at.title, `${name}: ${verdict === 'PASS' ? 'PASS alone' : `${verdict} says its Δ`}`);
      fits(at.beside, `proton monthly, 1600 px: in the Spot QA matrix the ${verdict} of "${name}" is not beside its box on the same line (its row is ${at.row} px tall, an empty one ${emptyRow} px)`);
    }

    // 11. The monthly form at four widths.
    await widths(p, 'proton monthly', 'Couch trueness (vertical sag) [mm]');

    // 12. The Perform QA list: one short line per list, its schedule on the line of its name.
    await p.evaluate(() => { location.hash = '#/perform-qa'; }); await p.waitForSelector('td.list-cell'); await p.waitForTimeout(400);
    const toRun = await p.locator('td.list-cell').evaluateAll((listed) => listed.map((cell) => {
      const name = cell.querySelector('.list-name'), schedule = name.querySelector('.muted.small'), words = document.createRange();
      words.selectNode([...name.childNodes].find((n) => n.nodeType === 3));   // the name itself, without its schedule
      const title = words.getBoundingClientRect(), s = schedule && schedule.getBoundingClientRect();
      return { list: words.toString(), tall: Math.round(cell.parentElement.getBoundingClientRect().height * 10) / 10, schedule: schedule ? schedule.textContent : null,
        sameLine: !s || (s.width > 0 && s.left >= title.right - 1 && Math.abs((s.top + s.bottom) - (title.top + title.bottom)) / 2 <= 4) };
    }));
    assert.ok(toRun.length >= 10 && toRun.filter((r) => r.schedule).length >= 5, `${toRun.length} lists to run, ${toRun.filter((r) => r.schedule).length} with a schedule to say`);
    for (const r of toRun) {
      fits(r.tall <= 44, `Perform QA list, 1600 px: the row of ${r.list} is ${r.tall} px tall (44 px at most)`);
      fits(r.sameLine, `Perform QA list, 1600 px: the schedule of ${r.list} (${r.schedule}) is not on the line of its name`);
    }
    assert.equal(await sideways(p), 0);

    // 13. A tablet opens a form in a window 1000 px wide (not one narrowed to it): the limit columns have no room
    // there either, so the limits are on the line under the name.
    const { page: tablet, lists: there } = await signIn(1000);
    for (const [form, list, name] of [['PBS daily', there.daily, 'Field Homogeneity [%]'], ['proton monthly', there.monthly, 'Couch trueness (vertical sag) [mm]']]) {
      await open(tablet, list);
      fits(await sideways(tablet) === 0, `${form}: the page scrolls sideways when opened at 1000 px`);
      const at = await limitsShown(tablet, name);
      fits(at.cells === 0 && at.headings === 0, `${form}, opened at 1000 px: the limit columns show`);
      fits(at.under, `${form}, opened at 1000 px: the limits of "${name}" show nowhere on its card (no limit columns, and the line under its name is hidden)`);
    }

    assert.deepEqual(errors, [], 'no page errors');
    assert.equal(shortfalls.length, 0, `the layout the tabular form is meant to have, and does not:\n  - ${shortfalls.join('\n  - ')}`);
    console.log('Tabular form: limits in their own columns and the Baseline a number alone; the tables a file fills closed, one line with the worst verdict and row, opened by hand or by Next unanswered; the section at most half as tall; short rows on the monthly form and the Perform QA list; a grid of cells with boxes that fill them, matrix verdicts beside their boxes; the monthly sections and combined lines in order; no sideways scroll at four widths, the limits under the name where the columns have no room.');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
