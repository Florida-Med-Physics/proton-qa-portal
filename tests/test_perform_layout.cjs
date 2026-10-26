// Browser regression: serve docs locally, then run with Playwright available in NODE_PATH.
// Uses a fresh isolated browser context; never changes the user's stored QA data.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.PORTAL_TEST_URL || 'http://127.0.0.1:8791/';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(base);
    await page.waitForSelector('[name=password]');
    await page.locator('[name=username]').fill('Admin');
    await page.locator('[name=password]').fill('Admin');
    await page.locator('button[type=submit]').click();
    await page.waitForSelector('nav');
    await page.goto(`${base}#/perform/1`);
    await page.waitForSelector('.qa-n');
    for (const width of [2560, 1900, 1660, 1280, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const zoom of [1, 1.5, 2]) {
        await page.evaluate(z => { document.documentElement.style.zoom = z; }, zoom);
        const overlaps = await page.evaluate(() => {
          const errors = [];
          for (const cell of document.querySelectorAll('.measure-table th,.measure-table td')) {
            if (!cell.getClientRects().length || cell.closest('.quick-trend') || cell.colSpan > 1) continue;
            const bounds = cell.getBoundingClientRect();
            const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
            let text;
            while ((text = walker.nextNode())) {
              if (!text.textContent.trim() || !text.parentElement.getClientRects().length) continue;
              const range = document.createRange();
              range.selectNodeContents(text);
              for (const rect of range.getClientRects()) {
                if (rect.right > bounds.right + 1 || rect.left < bounds.left - 1) errors.push(text.textContent.trim());
              }
            }
          }
          return errors;
        });
        assert.deepEqual(overlaps, [], `${width}px at ${zoom * 100}% zoom`);
      }
    }
    console.log('All QA cell text fits at six screen widths and three zoom levels.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
