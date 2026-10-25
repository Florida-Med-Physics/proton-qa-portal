// Synthetic client-side parsing, CSV and objective trend-signal checks.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('portal/static/app.js','utf8');
const context={filterRange:(points)=>points,judgedByList:(item,points)=>points.map(p=>({...p,status:'pass'}))};vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('const TEMPLATE_IMPORT_COLUMNS'),source.indexOf('async function renderNewTemplate()')),context);
vm.runInContext(source.slice(source.indexOf('function trendCsvCell('),source.indexOf('async function saveTrendCsv(')),context);
vm.runInContext(source.slice(source.indexOf('function trendPattern('),source.indexOf('function trendInsightsCard(')),context);
const rows=[['Monthly QA'],['Test','Category','Baseline','Warning','Action','Unit','Instructions'],['Zero reference','Output','0','0','1','mm','Check output'],['Percent warning','Output','100','2%','3%','Gy','Source procedure'],['Text check','Safety','','','','','No numeric limits'],['Unknown criterion','Safety','','< 2','','mm','']];
const mapping=context.templateImportMapping(rows);assert.equal(mapping.row,1);const tests=context.templateTestsFromRows(rows,mapping.row,mapping.map);assert.equal(tests.length,4);assert.equal(tests[0].expected,0);assert.equal(tests[0].warn,0);assert.equal(tests[1].tol_mode,'percent');assert.equal(tests[1].warn,2);assert.equal(tests[2].type,'text');assert.equal(tests[3].warn,null);assert(tests[3].description.includes('< 2'));
assert(context.trendCsvCell('=SUM(A1)').startsWith('"\''));assert.equal(context.trendCsvCell(0),'"0"');assert.equal(context.trendCsvCell('a"b'),'"a""b"');
const item={test_id:1,type:'numeric',name:'Synthetic',unit:'mm',limits:{expected:0,warn:1,fail:2,tol_mode:'absolute'}};
const exported=context.trendCsvRows({name:'G5'},[{assignment:{id:2},queue:{name:'Synthetic QA'},items:[item]}],{1:[{assignment_id:2,run_id:1,qa_date:'2026-10-22',value:0,expected:0,warn:1,fail:2,tol_mode:'absolute',status:'warn'},{assignment_id:3,run_id:2,qa_date:'2026-10-22',value:99}]},'all',[]);assert.equal(exported.length,2);assert.equal(exported[1][6],0);assert.equal(exported[1][11],'WARNING');assert.equal(exported[1][16],'PASS');
const points=Array.from({length:6},(_,i)=>({qa_date:`2026-10-${10+i}`,value:i,expected:0,warn:1,tol_mode:'absolute'}));assert.equal(context.trendPattern(points).direction,'Rising');assert.equal(context.trendPattern(points.map(p=>({...p,value:0}))),null);assert.equal(context.trendPattern(points.slice(0,4)),null);assert.equal(context.trendPattern(points.map(p=>({...p,qa_date:'2026-10-22'}))),null);
console.log('Template column detection, conservative criteria parsing, CSV scope/zero values and trend-signal evidence checks pass.');
