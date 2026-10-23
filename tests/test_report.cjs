// Synthetic-only report regression checks; run with node tests/test_report.cjs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('portal/static/app.js', 'utf8');
const context = { Blob };
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('function qaReportPdf('), source.indexOf('async function downloadQaReport')), context);
(async () => {
  const run = { id: 42, queue_name: 'Synthetic QA', machine_name: 'GTR5', qa_date: '2026-10-22', overall: 'warn', review_status: 'pending', results: Array.from({ length: 40 }, (_, i) => ({ name: `Synthetic ${i} (X)`, type: 'numeric', value_num: 0, expected: 0, warn: 0, fail: 1, unit: 'mm', status: 'pass' })) };
  const pdf = await context.qaReportPdf(run).text();
  assert.ok(pdf.startsWith('%PDF-1.4'));
  assert.ok(pdf.includes('Machine: GTR5'));
  assert.ok(pdf.includes('Review: pending'));
  assert.ok(pdf.includes('Baseline: 0 mm'));
  assert.ok(pdf.includes('Warning: +/- 0 mm'));
  assert.ok(pdf.includes('Synthetic 39'));
  const xref = Number(/startxref\n(\d+)/.exec(pdf)[1]);
  assert.equal(pdf.slice(xref, xref + 4), 'xref');
  for (const match of pdf.matchAll(/(\d{10}) 00000 n/g)) assert.match(pdf.slice(Number(match[1])), /^\d+ 0 obj/);
  console.log('PDF content, zero values, pagination and cross-reference offsets pass.');
})();
