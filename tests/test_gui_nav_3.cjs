// Synthetic checks for the third round of GUI and navigation changes (display, layout and navigation only). The real
// app.js code runs in node:vm on small stand-in elements; nothing here reads stored data. Synthetic people, machines and
// lists only. Run with node tests/test_gui_nav_3.cjs from the repository root.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('portal/static/app.js', 'utf8');
assert.equal(fs.readFileSync('docs/app.js', 'utf8'), source, 'docs/app.js is out of step: copy portal/static/app.js');
const css = fs.readFileSync('portal/static/app.css', 'utf8').replace(/\r\n/g, '\n');
assert.equal(fs.readFileSync('docs/app.css', 'utf8').replace(/\r\n/g, '\n'), css, 'docs/app.css is out of step: copy portal/static/app.css');
const between = (from, to) => { const a = source.indexOf(from), b = source.indexOf(to, a + 1); assert.ok(a >= 0 && b > a, `${from} … ${to}`); return source.slice(a, b); };
// GatorQA's phone rules (floridaphysics.com moves this 1200px block to 767px).
const phoneBlock = (() => { const i = css.indexOf('@media(max-width:1200px){\n  main { padding: 18px 14px 48px; }'); assert.ok(i >= 0, 'phone block'); return css.slice(i, css.indexOf('\n}\n', i)); })();
const phoneRules = [...css.matchAll(/@media ?\(max-width: ?1200px\) ?\{([\s\S]*?)\n\}/g)].map((m) => m[1]).join('\n');

// A small stand-in DOM: enough for el(), chip() and the page builders below.
class Node {
  constructor(tag) { Object.assign(this, { tagName: tag, attributes: {}, childNodes: [], parentNode: null, listeners: {}, dataset: {}, style: {}, hidden: false, className: '' }); }
  setAttribute(key, value) { this.attributes[key] = String(value); if (key === 'hidden') this.hidden = true; }
  getAttribute(key) { return this.attributes[key] ?? null; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  append(...kids) { for (const kid of kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false)) { const n = kid instanceof Node ? kid : new Text(String(kid)); n.parentNode = this; this.childNodes.push(n); } }
  prepend(...kids) { const old = this.childNodes; this.childNodes = []; this.append(...kids); this.childNodes.push(...old); }
  replaceChildren(...kids) { this.childNodes = []; this.append(...kids); }
  get children() { return this.childNodes.filter((n) => !(n instanceof Text)); }
  get textContent() { return this.text ?? this.childNodes.map((n) => n.textContent).join(''); }
  set textContent(text) { this.replaceChildren(String(text)); }
  fire(type, event = {}) { return Promise.all((this.listeners[type] || []).map((fn) => fn(event))); }
  find(test) { return [this, ...this.childNodes.flatMap((n) => n.find(test))].filter(test); }
  querySelector() { return null; }
}
class Text extends Node { constructor(text) { super('#text'); this.text = text; } }
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
const dom = (extra = {}) => {
  const document = { body: new Node('body'), createElement: (tag) => new Node(tag), createTextNode: (t) => new Text(t), createElementNS: (ns, tag) => new Node(tag) };
  const app = new Node('main');
  const context = { document, Node, app, console, URLSearchParams, setTimeout, ...extra };
  vm.createContext(context);
  vm.runInContext(between('function el(', 'const REVIEW_LABEL') + between('function capitalize(', 'function decimalsOf('), context);
  return context;
};
const cells = (row) => row.children.map((td) => td.textContent);

(async () => {
// 1. Review QA and Past results on a phone: compact cards with no column names. A row's words flow over three lines
// (date and machine; the QA list on a line of its own; who, result and review), about 90-120 px a card instead of 213-247.
{
  for (const rule of ['#app:is([data-page="review"], [data-page="runs"]) .fixed-table tbody tr { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 10px;',
    '#app:is([data-page="review"], [data-page="runs"]) .fixed-table tbody td { display: block; width: auto; max-width: 100%; min-width: 0; padding: 0; border: 0; text-align: left; }',
    '#app:is([data-page="review"], [data-page="runs"]) .fixed-table tbody td:nth-child(3)', '#app[data-page="review"] .fixed-table thead,', '#app[data-page="runs"] .fixed-table thead,'])
    assert.ok(phoneBlock.includes(rule), rule);
  assert.doesNotMatch(phoneBlock, /#app\[data-page="(review|runs)"\] td\[data-label\]::before/, 'no column name before each value');
  // The rule above puts the third cell on its own line: on both pages that is the QA list.
  const review = between('async function renderReview(', 'async function renderRuns(');
  for (const cols of ['waitingCols', 'reviewedCols', 'trashCols']) assert.match(review, new RegExp(String.raw`const ${cols} = \[\["Date", "\d+%"\], \["Machine", "\d+%"\], \["QA list"`), cols);
  assert.match(between('async function renderRuns(', '// A self-contained PDF'), /fixedTable\(\[\["Date", "18%"\], \["Machine", "14%"\], \["QA list", "38%"\]/);
}

console.log('GUI and navigation 3: Review QA and Past results as compact phone cards.');
})().catch((err) => { console.error(err); process.exit(1); });
