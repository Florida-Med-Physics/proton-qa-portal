const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const source = fs.readFileSync('portal/static/app.js', 'utf8');
const context = {}; vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('const AXIS_NAME ='), source.indexOf('// Deviation from expected')), context);
vm.runInContext(source.slice(source.indexOf('function trendDisplayName('), source.indexOf('async function renderTrendOverview(')), context);
vm.runInContext(source.slice(source.indexOf('function trendGroups('), source.indexOf('async function renderTrendOverview(')), context);
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

const depths = context.trendGroups([
 {test_id: 10, name: 'Energy [100 MeV] – Distal Depth', unit: 'mm'},
 {test_id: 11, name: 'Energy [200 MeV] – Distal Depth', unit: 'mm'}
]);
assert.equal(depths.length, 1);
assert.equal(depths[0].base, 'Distal Depths');
assert.equal(depths[0].members.length, 2);
assert.equal(depths[0].members[0].axis, '100 MeV');

for (const metric of ['Distal Fall Off', 'Proximal Depth', 'Width', 'DFO']) {
 const grouped = context.trendGroups([100, 200, 225].map((energy, index) => ({test_id: index + 20, name: `Energy [${energy} MeV] – ${metric}`, unit: 'mm', category: 'Energy'})));
 assert.equal(grouped.length, 1);
 assert.equal(grouped[0].members.length, 3);
}
const positions = context.trendGroups([100,200].flatMap((energy,index) => ['X','Y'].map((axis,n) => ({test_id: index*2+n+30, name: `[${energy} MeV] – Position ${axis}`, unit: 'mm', category: 'Spot'}))));
assert.equal(positions.length, 2);
assert.equal(positions[0].members.length, 2);
assert.equal(positions[0].base, 'Position X');
assert.equal(positions[1].base, 'Position Y');
assert.equal(positions[0].members[0].axis, '100 MeV');

const csvOrder = context.trendGroups([
 {test_id: 80, name: 'Energy [225 MeV] – Width', category: 'Energy', unit: 'mm'},
 {test_id: 81, name: 'Energy [100 MeV] – Width', category: 'Energy', unit: 'mm'},
 {test_id: 82, name: 'Energy [225 MeV] – Distal Depth', category: 'Energy', unit: 'mm'}
]);
assert.equal(csvOrder[0].base, 'Width');
assert.equal(csvOrder[0].members[0].axis, '225 MeV');
assert.equal(csvOrder[0].members[1].axis, '100 MeV');

vm.runInContext(source.slice(source.indexOf('function trendPlotPoints('), source.indexOf('function trendExclusionNote(')), context);
const ordinary = Array.from({length:15}, (_,i) => ({value: (i%3-1)*0.2}));
const gross = {value: -30000};
const retained = context.trendPlotPoints([...ordinary, gross]);
assert.equal(retained.length, 15);
assert(!retained.includes(gross));
assert.equal(context.trendPlotPoints(ordinary).length, 15);
assert.equal(context.trendPlotPoints([{value:0},{value:0},{value:-30000}]).length, 3);
assert.equal(context.trendPlotPoints([{value:1},{value:1},{value:1},{value:1},{value:99}]).length, 4);

const iso = context.trendGroups(['X','Y'].map((axis,index) => ({test_id: 100+index, name: `Isocenter Coincidence [X-ray vs. Proton Beam]: ${axis} offset [mm]`, unit: 'mm', category: 'Coincidence'})));
assert.equal(iso.length, 1);
assert.equal(iso[0].members.length, 2);
assert.equal(iso[0].members[0].axis, 'X');
assert.equal(iso[0].members[1].axis, 'Y');
