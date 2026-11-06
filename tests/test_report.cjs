// Synthetic-only report regression checks; run with node tests/test_report.cjs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('portal/static/app.js', 'utf8');
const between = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
// qaReportPdf with the helpers it calls; one test per row (shared-row numbering is checked in test_shared_rows.cjs).
const context = { Blob, blockNumbers: () => new Map(), sharedRows: (list) => list.map((r) => [r]) };
vm.createContext(context);
for (const part of [between('const REVIEW_LABEL', 'function reviewChip('), between('function capitalize(', 'function decimalsOf('), between('function qaReportPdf(', 'async function downloadQaReport')])
  vm.runInContext(part, context);
(async () => {
  const run = { id: 42, queue_name: 'Synthetic QA', machine_name: 'GTR5', qa_date: '2026-10-22', overall: 'warn', review_status: 'pending', results: Array.from({ length: 40 }, (_, i) => ({ name: `Synthetic ${i} (X)`, type: 'numeric', value_num: 0, expected: 0, warn: 0, fail: 1, unit: 'mm', status: 'pass' })) };
  const pdf = await context.qaReportPdf(run).text();
  assert.ok(pdf.startsWith('%PDF-1.4'));
  assert.ok(pdf.includes('Machine: GTR5'));
  assert.ok(pdf.includes('Review: Awaiting Physics Review'));
  assert.ok(pdf.includes('Baseline: 0 mm'));
  assert.ok(pdf.includes('Warning: +/- 0 mm'));
  assert.ok(pdf.includes('Synthetic 39'));
  const xref = Number(/startxref\n(\d+)/.exec(pdf)[1]);
  assert.equal(pdf.slice(xref, xref + 4), 'xref');
  for (const match of pdf.matchAll(/(\d{10}) 00000 n/g)) assert.match(pdf.slice(Number(match[1])), /^\d+ 0 obj/);
  console.log('PDF content, zero values, pagination and cross-reference offsets pass.');
})();
