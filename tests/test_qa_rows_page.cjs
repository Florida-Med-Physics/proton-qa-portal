// Browser regression for the QA form's lines of several tests and for a test's Reference, on the browser build (docs/,
// the seeded PBS daily list on GTR1, synthetic values only, a fresh isolated browser context):
//  - tests on one row ("Same row as the test above") are one line of the table (tr.qa-line-row): one number and one
//    cell over the columns a test on a row of its own has (Test to Result); every test is answered beside its own name,
//    its unit and its verdict after its box ("Dose [cGy]" is next to the dose, not a column away from it); the words
//    the names share are said once, in bold, with the baseline the tests share under them ("Daily output", "Baseline
//    150.0 cGy"); the one value a device on the line fills (the chamber's calibration factor) has no name of its own
//    and follows its device;
//  - an X / Y pair is a titled block: its number and name, its baseline and limits under the name, "X: [ ] Y: [ ]" below;
//  - a test's Reference (the report its check comes from) is behind its ⓘ, and behind a block's for its tests; Setup
//    QA's test form reads and writes it in a box of its own;
//  - a saved run shows the same lines, what was recorded where the boxes were; an X / Y pair as rows of their own.
// Serve docs locally (port 8791), then run with Playwright available in NODE_PATH: node tests/test_qa_rows_page.cjs
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.PORTAL_TEST_URL || 'http://127.0.0.1:8791/';
const SHARED = ['test', 'baseline', 'measured', 'unit', 'warn', 'action', 'result'];   // the columns a line's one cell covers (QA_SHARED_COLUMNS)
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

    // What a line shows, read from the page: its number, its title and what its tests share (when their names start
    // alike), and field by field the name, whose box it is (a drop-down, a box, a recorded value, "Unanswered"), what
    // it holds, the unit, the verdict as it reads, the ⓘ, and where they are, in px:
    //   gap, level   from the end of the name to its box, and how far their middles are apart (a few px on one line);
    //   before       from the field before it to the name, when that field is on the same line of the cell;
    //   follows      for a value with no name: from the field before it to the value, when both are on one line;
    //   unitGap, verdictGap   from the box to its unit, and from the box (or its unit) to its verdict.
    const lineOf = (row) => row.evaluate((tr) => {
      const at = (n) => { const b = n.getBoundingClientRect(); return { left: b.left, right: b.right, middle: b.top + b.height / 2 }; };
      const text = (n) => (n ? n.textContent : null), px = (x) => Math.round(x * 10) / 10;
      const answerOf = (f) => f.querySelector(':scope > input:not(.note-input), :scope > select, :scope > .qa-line-value, :scope > .review-measured');
      return { n: tr.querySelector('td.qa-n').textContent, cls: tr.className, title: text(tr.querySelector('.qa-line-head .qa-line-title')), shared: text(tr.querySelector('.qa-line-head .qa-limits')),
        // (a device and the one value it fills are wrapped together, .qa-line-pair, so they never part: the fields are read in order wherever they sit)
        fields: [...tr.querySelectorAll('.qa-line-fields .qa-line-field')].map((f, k, all) => {
          const name = f.querySelector(':scope > .qa-line-name'), answer = answerOf(f), unit = f.querySelector(':scope > .qa-line-unit'), verdict = f.querySelector(':scope > .status-cell'), a = at(answer);
          const prev = k ? all[k - 1] : null, from = prev && Math.abs(at(answerOf(prev)).middle - a.middle) <= 8 ? px((name ? at(name).left : a.left) - at(prev).right) : null;
          return { name: text(name), title: f.getAttribute('title'), label: answer.getAttribute('aria-label'), box: answer.matches('.qa-line-value') ? 'value' : answer.matches('.review-measured') ? 'unanswered' : answer.tagName.toLowerCase(),
            value: 'value' in answer ? answer.value : answer.textContent, unit: text(unit), verdict: verdict && verdict.innerText.trim() ? verdict.innerText.replace(/\s+/g, ' ').trim() : null,
            info: [...f.querySelectorAll(':scope > button.qa-calculation-info')].map((b) => b.getAttribute('aria-label')),
            gap: name ? px(a.left - at(name).right) : null, level: name ? px(Math.abs(at(name).middle - a.middle)) : null, before: name ? from : null, follows: name ? null : from,
            unitGap: unit ? px(at(unit).left - a.right) : null, verdictGap: verdict && verdict.innerText.trim() ? px(at(verdict).left - (unit ? at(unit).right : a.right)) : null };
        }) };
    });
    // A name is beside its own box: on its line, the box a few px after the name, nearer than the field before it is.
    const beside = (line, what) => { for (const f of line.fields) if (f.name !== null) assert.ok(f.level <= 8 && f.gap >= 0 && f.gap <= 12 && (f.before === null || f.gap < f.before), `${what}: "${f.name}" is beside its own box: ${JSON.stringify(f)}`); };
    // A value its device fills has no name: it comes right after the device, on its line, with its unit.
    const afterDevice = (f, what) => assert.ok(f.name === null && f.follows !== null && f.follows >= 0 && f.follows <= 24 && (f.unit === null || (f.unitGap >= 0 && f.unitGap <= 12)), `${what}: ${JSON.stringify(f)}`);
    // A line is the row's number and one cell, from where a test's name starts to where its Result ends in the rows
    // around it: as many of those columns as the table shows.
    const oneCell = async (row, what) => {
      const c = await row.evaluate((tr, shared) => {
        const cell = tr.querySelector(':scope > td.qa-measured.qa-shared-cell.qa-line-cell'), name = tr.querySelector(':scope > td.qa-label.qa-line-label'), table = tr.closest('table'), edge = (n, side) => Math.round(n.getBoundingClientRect()[side]);
        const own = [...table.querySelectorAll(':scope > tbody > tr')].find((r) => r.querySelector(':scope > td.qa-label') && r.querySelector(':scope > td.qa-result'));   // a test on a row of its own
        const shown = [...table.querySelectorAll(':scope > colgroup > col')].map((col) => col.dataset.col).filter((key) => shared.includes(key));
        return { titled: !!name, values: cell.classList.contains('qa-values-cell'), cells: ['td.qa-n', 'td.qa-measured', 'td.qa-label', 'td.qa-baseline', 'td.qa-unit', 'td.qa-warn', 'td.qa-action', 'td.qa-result'].map((s) => tr.querySelectorAll(`:scope > ${s}`).length), span: cell.colSpan, shown,
          edges: [edge(cell, 'left'), edge(cell, 'right')], nameEdges: name ? [edge(name, 'left'), edge(name, 'right')] : null,
          columns: [edge(own.querySelector(':scope > td.qa-label'), 'left'), edge(own.querySelector(':scope > td.qa-label'), 'right'), edge(own.querySelector(':scope > td.qa-result'), 'right')] };
      }, SHARED);
      // A line with a title (Brook, 2026-11-27): its name in the Test column, like any test's, and its values in one cell
      // at the right, from the first column after Test to Result. A line without one is one cell from Test to Result.
      assert.equal(c.values, c.titled, `${what}: a values cell exactly when the line has a name of its own`);
      assert.deepEqual(c.cells, [1, 1, c.titled ? 1 : 0, 0, 0, 0, 0, 0], `${what}: its number${c.titled ? ', its name' : ''} and one cell; no cell of its own for a baseline, a unit, a limit or a result`);
      assert.equal(c.span, c.shown.length - (c.titled ? 1 : 0), `${what}: the cell covers the shared columns the table shows (${c.shown})${c.titled ? ' but Test' : ''}`);
      if (c.titled) { assert.deepEqual(c.nameEdges, c.columns.slice(0, 2), `${what}: its name is in the Test column`); assert.deepEqual(c.edges, [c.columns[1], c.columns[2]], `${what}: its values run from where the Test column ends to where Result ends`); }
      else assert.deepEqual(c.edges, [c.columns[0], c.columns[2]], `${what}: from where a test's name starts to where its Result ends`);
      return c;
    };

    // 1. A line of several tests: one row of the table, one number, one cell. The chamber's line has five tests and no
    // title (their names share no first word): the chamber and the electrometer are chosen beside their names, the
    // value each one sets comes right after it with no name of its own (its box still carries the test's name, and the
    // field says it on hover), then the overall factor beside its name.
    const rowOf = (label) => p.locator('tr[data-qa-entry]', { has: p.getByLabel(label, { exact: true }) });
    const chamber = rowOf('Chamber');
    assert.equal(await chamber.count(), 1);
    assert.equal(await chamber.getAttribute('class'), 'qa-line-row');
    assert.equal(await chamber.locator('td.qa-n').textContent(), '3.02');
    assert.deepEqual((await oneCell(chamber, 'the chamber\'s line')).shown, SHARED, 'at this width the cell covers Test, Baseline, Measured, Unit, Warning ±, Action ± and Result');
    assert.equal(await p.locator('[class*="qa-inline"]').count(), 0, 'no row is drawn the old way');
    let line = await lineOf(chamber);
    assert.deepEqual([line.title, line.shared], [null, null], 'no words in common: no title');
    assert.deepEqual(line.fields.map((f) => [f.name, f.label, f.box, f.title, f.unit, f.info]), [['Chamber', 'Chamber', 'select', null, null, []],
      [null, 'Chamber Cal. Factor(Proton), Gy/C', 'input', 'Chamber Cal. Factor(Proton), Gy/C', 'Gy/C', []], ['Electrometer', 'Electrometer', 'select', null, null, []],
      [null, 'Electrometer Calibration Factor', 'input', 'Electrometer Calibration Factor', null, []],
      ['Overall Calibration Factor [Gy/C]', 'Overall Calibration Factor [Gy/C]', 'input', null, null, ['Calculation details: Overall Calibration Factor [Gy/C]']]],
      'each test beside its own name; a value its device sets has no name and no ⓘ, and says its unit; a unit in the name is not said again');
    beside(line, 'the chamber\'s line');
    afterDevice(line.fields[1], 'the chamber\'s factor comes right after the Chamber drop-down');
    // The charge with its dose (one line, one number): the words their names share are the line's name, in bold, with
    // the dose's baseline under it; then "Charge [nC] [ ]" and "Dose [cGy] [ ]", each name next to its own box.
    const output = rowOf('Daily output: Charge [nC]');
    assert.deepEqual([await output.getAttribute('class'), await output.locator('td.qa-n').textContent()], ['qa-line-row', '3.03']);
    await oneCell(output, 'the daily output line');
    line = await lineOf(output);
    assert.equal(line.title, 'Daily output');
    assert.match(line.shared, /^Baseline 150(\.0+)? cGy$/, 'the dose\'s baseline, once, with the title');
    assert.deepEqual(line.fields.map((f) => [f.name, f.label, f.box, f.title, f.unit, f.info]), [['Charge [nC]', 'Daily output: Charge [nC]', 'input', null, null, []],
      ['Dose [cGy]', 'Daily output: Dose [cGy]', 'input', null, null, ['Calculation details: Dose [cGy]']]], 'a unit in the name is not said again; the box keeps the test\'s full name');
    beside(line, 'the daily output line');
    assert.ok(line.fields[1].gap <= 12 && line.fields[1].gap < line.fields[1].before, `"Dose [cGy]" is next to the dose's box, nearer than to the charge's: ${JSON.stringify(line.fields[1])}`);
    const [title, shared, charge] = [await output.locator('.qa-line-head .qa-line-title').boundingBox(), await output.locator('.qa-line-head .qa-limits').boundingBox(), await output.locator('.qa-line-name').first().boundingBox()];
    assert.ok(shared.y >= title.y + title.height - 1 && Math.abs(shared.x - title.x) <= 1, 'the baseline under the title, starting where it starts');
    assert.ok(charge.x >= title.x + title.width && charge.y < shared.y + shared.height, 'the fields after the title, on its line');
    assert.equal(await output.locator('.qa-line-head .qa-line-title').evaluate((s) => Number(getComputedStyle(s).fontWeight) >= 600), true, 'the title in bold');
    // The delivered MU with the beam's irradiation time: no words in common, so no title; the MU says its own baseline
    // beside its box, and only the time has something behind an ⓘ.
    const mu = rowOf('[MU] Delivered MU (Record in IC2)');
    assert.deepEqual([await mu.getAttribute('class'), await mu.locator('td.qa-n').textContent()], ['qa-line-row', '3.01']);
    await oneCell(mu, 'the delivered MU line');
    line = await lineOf(mu);
    assert.deepEqual([line.title, line.shared], [null, null]);
    assert.deepEqual(line.fields.map((f) => [f.name, f.label, f.box, f.title, f.unit, f.info]), [['[MU] Delivered MU (Record in IC2)', '[MU] Delivered MU (Record in IC2)', 'input', null, null, []],
      ['Beam Irradiation Time [min:s]', 'Beam Irradiation Time [min:s]', 'input', null, null, ['Test details: Beam Irradiation Time [min:s]']]]);
    assert.match(await mu.locator('.qa-line-field').first().locator('.qa-line-limits').textContent(), /^Baseline 587\.20* MU$/, 'its own baseline, beside it');
    beside(line, 'the delivered MU line');
    // Lined up with the rows around them: every line starts where a test's name starts (the next test, on a row of its own).
    const left = async (locator) => Math.round((await locator.boundingBox()).x);
    const starts = [await left(mu.locator('.qa-line-name').first()), await left(chamber.locator('.qa-line-name').first()), await left(output.locator('.qa-line-title')), await left(rowOf('Sphinx acquisition date and time').locator('td.qa-label strong'))];
    assert.equal(new Set(starts).size, 1, `where the lines and the names start: ${starts}`);
    // It works as before: a choice sets its factor; the charge gives the dose, judged right after its own box.
    await p.getByLabel('Chamber Temperature, °C', { exact: true }).fill('22');
    await p.getByLabel('Air Pressure [kPa]', { exact: true }).fill('101.3');
    await chamber.getByLabel('Chamber', { exact: true }).selectOption({ index: 1 });
    await chamber.getByLabel('Electrometer', { exact: true }).selectOption({ index: 1 });
    const devices = [await chamber.getByLabel('Chamber', { exact: true }).inputValue(), await chamber.getByLabel('Electrometer', { exact: true }).inputValue()];
    assert.notEqual(await p.getByLabel('Chamber Cal. Factor(Proton), Gy/C', { exact: true }).inputValue(), '');
    assert.notEqual(await p.getByLabel('Overall Calibration Factor [Gy/C]', { exact: true }).inputValue(), '');
    await p.getByLabel('Daily output: Charge [nC]', { exact: true }).fill('15');
    const dose = Number(await p.getByLabel('Daily output: Dose [cGy]', { exact: true }).inputValue());
    assert.ok(dose > 0, `a dose from the charge: ${dose}`);
    await p.waitForTimeout(300);   // (the Test column is fitted to its section a frame after a change: measure once it has settled)
    line = await lineOf(output);
    assert.match(line.fields[1].verdict, /Δ/, 'its deviation from the baseline after its box');
    assert.ok(line.fields[1].verdictGap >= 0 && line.fields[1].verdictGap <= 12, `the dose's verdict right after its box: ${JSON.stringify(line.fields[1])}`);
    assert.match(await output.locator('.qa-line-field').nth(1).locator('.status-cell .chip').getAttribute('title'), /Δ/, 'the deviation is on the chip too');
    assert.equal(line.fields[0].verdict, null, 'the charge is not judged');
    // With the boxes filled every name is still beside its own box, and the chamber's factor beside the chamber.
    beside(line, 'the daily output line, answered');
    line = await lineOf(chamber);
    beside(line, 'the chamber\'s line, answered');
    afterDevice(line.fields[1], 'the chamber\'s factor comes right after the Chamber drop-down, answered');
    afterDevice(line.fields[3], 'the electrometer\'s factor comes right after the Electrometer drop-down, answered');
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'nothing scrolls sideways');
    // "Next unanswered" reaches a test answered on a line.
    await chamber.getByLabel('Electrometer', { exact: true }).selectOption({ index: 0 });
    assert.equal(await chamber.evaluate((row) => !!row.querySelector('.qa-line-field select[aria-label="Electrometer"]')), true);

    // 2. An X / Y pair: one row of the table, like an X / Y / Z group (Brook, 2026-11-27: "Put the X Y Z part on the right
    // side and think about column alignment"). Its number in the # column; its name, with what the two share under it,
    // in the Test column; "X: [ ] Y: [ ]" at the right, in the same slots as every group's X and Y.
    const pair = p.locator('tr.qa-axis-row[data-qa-entry]', { has: p.locator('td.qa-axis-label strong', { hasText: /^Isocenter Coincidence \[X-ray vs\. Proton Beam\]$/ }) });
    assert.equal(await pair.count(), 1);
    assert.equal(await pair.locator('td.qa-n').textContent(), '3.17');
    assert.match(await pair.locator('td.qa-axis-label .qa-limits').textContent(), /^Baseline 0(\.0+)? mm · Warning ±0\.5 mm · Action ±1 mm$/);
    assert.equal(await p.locator('.measure-block', { has: pair }).locator('.measure-title').count(), 0, 'no title band above it');
    assert.deepEqual(await pair.locator('.qa-shared-field .qa-shared-name > span').allTextContents(), ['X', 'Y'], 'the unit is with the limits, once');
    const [pairName, x, y] = [await pair.locator('td.qa-axis-label').boundingBox(), await pair.locator('input[aria-label$="X offset [mm]"]').boundingBox(), await pair.locator('input[aria-label$="Y offset [mm]"]').boundingBox()];
    assert.ok(x.x >= pairName.x + pairName.width && Math.abs(x.y - y.y) <= 1 && y.x > x.x + x.width, 'X and Y side by side, at the right of the name');
    assert.equal(await pair.locator('.qa-shared-field .qa-shared-name > span').first().evaluate((s) => getComputedStyle(s, '::after').content), '":"');
    // Column alignment: an axis is as far into its values cell in every group (a slot each for X, Y, Z and 3D), and the
    // groups of one section, whose tables share their columns, have X under X and Y under Y.
    const xyz = p.locator('tr.qa-axis-row', { has: p.locator('td.qa-axis-label strong', { hasText: 'Mechanical-to-kV/kV Isocenter' }) }).first();
    const cbct = p.locator('tr.qa-axis-row', { has: p.locator('td.qa-axis-label strong', { hasText: 'Mechanical-to-CBCT Correction Vector' }) }).first();
    const slots = (row) => row.evaluate((tr) => { const cell = tr.querySelector(':scope > td.qa-values-cell').getBoundingClientRect(); return [...tr.querySelectorAll('.qa-shared-field input.result-input')].map((i) => Math.round(i.getBoundingClientRect().left - cell.left)); });   // (the boxes that are answered, not their notes)
    const [inPair, inXyz, inCbct] = [await slots(pair), await slots(xyz), await slots(cbct)];
    assert.deepEqual(inPair, inXyz.slice(0, 2), 'the pair\'s X and Y are in the X and Y slots');
    assert.deepEqual(inCbct.slice(0, 3), inXyz.slice(0, 3), 'every group\'s X, Y and Z are in the same slots');
    assert.equal(await left(cbct.locator('.qa-shared-field input').first()), await left(xyz.locator('.qa-shared-field input').first()), 'X under X');
    for (const row of [pair, xyz]) assert.deepEqual(await row.evaluate((tr) => ['td.qa-n', 'td.qa-label', 'td.qa-values-cell'].map((s) => tr.querySelectorAll(`:scope > ${s}`).length)), [1, 1, 1], 'number, name, values');

    // 3. The report a check comes from, behind its ⓘ: a block's (said once for its tests), a calculated value's, and
    // nothing where a test has neither directions nor a reference.
    const reference = async (button, text) => {
      await button.click();
      assert.equal(await dialog.locator('.qa-reference').count(), 1);
      assert.equal(await dialog.locator('.qa-reference .directions-label').textContent(), 'Reference');
      assert.equal((await dialog.locator('.qa-reference').textContent()).replace(/^Reference/, ''), text);
      await closeDialog();
    };
    await reference(xyz.locator('td.qa-axis-label').getByRole('button', { name: 'Test details', exact: true }), 'TG-224, Mechanical: laser position accuracy 0.2 cm');
    await reference(pair.locator('td.qa-axis-label').getByRole('button', { name: 'Test details', exact: true }), 'TG-224, Imaging: X-ray and proton beam isocenter coincidence < 1 mm');
    const distal = p.locator('.measure-block', { has: p.locator('.measure-title strong', { hasText: /^Distal Depth \[mm\]$/ }) });
    await reference(distal.locator('.measure-title').getByRole('button', { name: 'Test details', exact: true }), 'TG-224, Dosimetry: distal depth 1 mm at the distal 90 % depth dose');
    await reference(output.getByRole('button', { name: 'Calculation details: Dose [cGy]', exact: true }), 'TG-224, Dosimetry: output < 3 % for different energies on different days with one consistent field');
    assert.equal(await mu.locator('.qa-line-field').first().locator('button.qa-calculation-info').count(), 0, 'nothing to say: no ⓘ');

    // 4. Setup QA: a test's Reference is a box of its own in the test form; Instructions does not repeat it. Saved, it is
    // the last line of the test's field, and the QA form shows it (behind the ⓘ of the test's own field, named for it);
    // cleared, the field is as it was.
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
    await reference(rowOf('[MU] Delivered MU (Record in IC2)').locator('.qa-line-field').first().getByRole('button', { name: 'Test details: [MU] Delivered MU (Record in IC2)', exact: true }), 'Synthetic report, section 1');
    assert.deepEqual(await edit(''), { reference: 'Synthetic report, section 1', instructions: was }, 'its own box; Instructions as before');
    assert.equal(await stored(), was, 'cleared: the field as it was');

    // 5. A saved run: the same lines in its table, one cell over the table's columns, what was recorded where the boxes
    // were. First an empty synthetic run: every test of a line says "Unanswered" beside its name, with no unit and no
    // verdict. An X / Y pair's tests are rows of their own there, like the axes of X / Y / Z, under the one number.
    const savedLine = (name) => p.locator('.review-measure-table tr[data-test-id]', { has: p.locator('.qa-line-title, .qa-line-name', { hasText: new RegExp(`^${name}$`) }) });
    const empty = await p.evaluate(async (id) => (await api('POST', `/api/assignments/${id}/runs`, { results: [] })).id, list);
    await open(`#/runs/${empty}`, '.review-measure-table');
    assert.equal(await p.locator('[class*="qa-inline"]').count(), 0, 'no row is drawn the old way on a saved run');
    line = await lineOf(savedLine('Chamber'));
    assert.deepEqual([line.n, line.cls, line.title, line.shared, line.fields.map((f) => [f.name, f.title, f.box, f.unit, f.verdict])], ['3.02', 'qa-line-row', null, null,
      [['Chamber', null, 'unanswered', null, null], [null, 'Chamber Cal. Factor(Proton), Gy/C', 'unanswered', null, null], ['Electrometer', null, 'unanswered', null, null],
        [null, 'Electrometer Calibration Factor', 'unanswered', null, null], ['Overall Calibration Factor [Gy/C]', null, 'unanswered', null, null]]]);
    assert.ok(line.fields.every((f) => f.value === 'Unanswered'));
    beside(line, 'an empty run, the chamber\'s line');
    line = await lineOf(savedLine('Daily output'));
    assert.deepEqual([line.n, line.cls, line.title, line.fields.map((f) => [f.name, f.title, f.box, f.value, f.unit, f.verdict])], ['3.03', 'qa-line-row', 'Daily output',
      [['Charge [nC]', null, 'unanswered', 'Unanswered', null, null], ['Dose [cGy]', null, 'unanswered', 'Unanswered', null, null]]]);
    assert.match(line.shared, /^Baseline 150(\.0+)? cGy$/);
    beside(line, 'an empty run, the daily output line');
    for (const [row, what] of [[savedLine('Chamber'), 'an empty run, the chamber\'s line'], [savedLine('Daily output'), 'an empty run, the daily output line']]) await oneCell(row, what);
    const pairRows = p.locator('.review-measure-table tr[data-test-id]', { has: p.locator('td.qa-label strong', { hasText: /^Isocenter Coincidence \[X-ray vs\. Proton Beam\]: [XY] offset \[mm\]$/ }) });
    assert.deepEqual(await pairRows.evaluateAll((rows) => rows.map((r) => [r.querySelector('td.qa-n').textContent, r.querySelector('td.qa-label strong').textContent.replace(/^.*: /, ''), r.className])),
      [['3.17', 'X offset [mm]', ''], ['3.17', 'Y offset [mm]', '']], 'X and Y each a row of its own, under the one number');
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'nothing scrolls sideways');
    // Then a run with the synthetic values typed above: each recorded value beside its own name (the chamber's factor
    // right after the chamber, with its unit), the dose with its deviation after it, the title and the baseline once.
    const ids = await p.evaluate(async (id) => Object.fromEntries((await api('GET', `/api/assignments/${id}/template`)).items.map((i) => [i.name, i.test_id])), list);
    const answers = [['Chamber Temperature, °C', 22], ['Air Pressure [kPa]', 101.3], ['Chamber', devices[0]], ['Electrometer', devices[1]], ['Daily output: Charge [nC]', 15]].map(([name, value]) => ({ test_id: ids[name], value }));
    assert.ok(answers.every((a) => Number.isInteger(a.test_id)), 'the tests answered are in the list');
    const run = await p.evaluate(async ([id, results]) => (await api('POST', `/api/assignments/${id}/runs`, { results })).id, [list, answers]);
    await open(`#/runs/${run}`, '.review-measure-table');
    line = await lineOf(savedLine('Chamber'));
    assert.deepEqual([line.n, line.cls, line.title, line.shared], ['3.02', 'qa-line-row', null, null]);
    assert.deepEqual(line.fields.map((f) => [f.name, f.title, f.box, f.unit, f.info]), [['Chamber', null, 'value', null, []], [null, 'Chamber Cal. Factor(Proton), Gy/C', 'value', 'Gy/C', []],
      ['Electrometer', null, 'value', null, []], [null, 'Electrometer Calibration Factor', 'value', null, []],
      ['Overall Calibration Factor [Gy/C]', null, 'value', null, ['Calculation details: Overall Calibration Factor [Gy/C]']]], 'the same line, what was recorded where the boxes were');
    assert.deepEqual([line.fields[0].value, line.fields[2].value], devices, 'the devices chosen');
    assert.ok(line.fields.every((f) => f.value.trim() !== '' && f.value !== 'Unanswered'), 'each factor is recorded');
    beside(line, 'a saved run, the chamber\'s line');
    afterDevice(line.fields[1], 'a saved run: the chamber\'s factor comes right after the chamber');
    afterDevice(line.fields[3], 'a saved run: the electrometer\'s factor comes right after the electrometer (the two never part)');
    line = await lineOf(savedLine('Daily output'));
    assert.deepEqual([line.n, line.cls, line.title], ['3.03', 'qa-line-row', 'Daily output']);
    assert.match(line.shared, /^Baseline 150(\.0+)? cGy$/);
    assert.deepEqual(line.fields.map((f) => [f.name, f.title, f.box, f.unit, f.info]), [['Charge [nC]', null, 'value', null, []], ['Dose [cGy]', null, 'value', null, ['Calculation details: Dose [cGy]']]]);
    assert.equal(line.fields[0].value, '15');
    assert.ok(Math.abs(Number(line.fields[1].value) - dose) < 0.5, `the dose the form showed (${dose}): ${line.fields[1].value}`);
    beside(line, 'a saved run, the daily output line');
    assert.ok(line.fields[1].gap <= 12 && line.fields[1].gap < line.fields[1].before, `a saved run: "Dose [cGy]" is next to the dose, nearer than to the charge: ${JSON.stringify(line.fields[1])}`);
    assert.match(line.fields[1].verdict, /Δ/, 'the dose\'s deviation after it');
    assert.ok(line.fields[1].verdictGap >= 0 && line.fields[1].verdictGap <= 12, `a saved run: the dose's verdict right after it: ${JSON.stringify(line.fields[1])}`);
    for (const [row, what] of [[savedLine('Chamber'), 'a saved run, the chamber\'s line'], [savedLine('Daily output'), 'a saved run, the daily output line']]) {
      await oneCell(row, what);
      assert.equal((await row.locator('td.qa-comment').textContent()).trim(), '—', `${what}: no note`);
    }
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'nothing scrolls sideways');

    assert.deepEqual(errors, []);
    console.log('QA rows on the page: tests on one row are one line of the table (one number, one cell from Test to Result, each test beside its own name with its unit and verdict after its box, the shared words and baseline once, a device\'s value right after its device); an X / Y pair is a titled block; a Reference behind a test\'s and a block\'s ⓘ, read and written in Setup QA\'s test form; a saved run shows the same lines.');
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exit(1); });
