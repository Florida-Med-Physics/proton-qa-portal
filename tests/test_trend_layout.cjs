const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const source = fs.readFileSync('portal/static/app.js', 'utf8');
const context = {}; vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('const AXIS_NAME ='), source.indexOf('// Deviation from expected')), context);
vm.runInContext(source.slice(source.indexOf('function trendDisplayName('), source.indexOf('async function renderTrendOverview(')), context);
const items = [
  {test_id: 1, name: 'Spot 3 [100 MeV] – Position X', category: 'Spot', unit: 'mm'},
  {test_id: 2, name: 'Spot 4 [100 MeV] – Position Y', category: 'Spot', unit: 'mm'},
  {test_id: 3, name: 'Spot 5 [120 MeV] – Position X', category: 'Spot', unit: 'mm'}
];
const groups = context.axisGroups(items.map(i => ({...i, name: context.trendDisplayName(i.name)})));
assert.equal(groups.length, 2);
assert.equal(groups[0].members.length, 2);
assert.equal(groups[0].members[0].axis, 'X');
assert.equal(groups[0].members[1].axis, 'Y');
assert.equal(groups[0].base, '[100 MeV] – Position');
assert.equal(items[0].name, 'Spot 3 [100 MeV] – Position X');
assert.equal(context.trendDisplayName('Spot 140 MeV – Position X'), 'Spot 140 MeV – Position X');
console.log('Energy labels and shared X/Y grouping preserve saved names and separate energies.');
