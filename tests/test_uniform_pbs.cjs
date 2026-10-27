const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
const page=await browser.newPage();await page.goto('http://127.0.0.1:8791/');await page.locator('[name=username]').fill('Admin');await page.locator('[name=password]').fill('Admin');await page.locator('button[type=submit]').click();await page.waitForSelector('.dashboard-count');
const before=await page.evaluate(()=>api('GET','/api/assignments/1/template'));
assert.equal(before.items.filter(i=>/Spot \d/.test(i.name)).length,42);
await page.evaluate(async()=>{
 const db=await new Promise(r=>{const q=indexedDB.open('proton-qa-portal',1);q.onsuccess=()=>r(q.result);});
 const state=await new Promise(r=>{const q=db.transaction('kv').objectStore('kv').get('state');q.onsuccess=()=>r(q.result);});
 const a=state.assignments.find(a=>a.id===1),q=state.queues.find(q=>q.id===a.queue_id),base=state.tests.find(t=>t.owner_queue_id===q.id&&t.name==='Spot 6 [120.6 MeV] – Sigma X');
 const id=Math.max(...state.tests.map(t=>t.id))+1;state.tests.push({...base,id,name:'Spot 2 [120 MeV] – Sigma X'});
 a.test_selection={added:[id],excluded:[base.id]};
 await new Promise(r=>{const tx=db.transaction('kv','readwrite');tx.objectStore('kv').put(state,'state');tx.oncomplete=r;});db.close();
});
await page.reload();await page.waitForSelector('.dashboard-count');
const after=await page.evaluate(async()=>{const templates=await Promise.all([1,3,5].map(id=>api('GET',`/api/assignments/${id}/template`)));return templates.map(t=>({names:t.items.map(i=>i.name),extra:t.all_items.filter(i=>i.machine_only).length}));});
assert.deepEqual(after[0].names,after[1].names);assert.deepEqual(after[0].names,after[2].names);assert(after.every(t=>t.extra===0));
const imported=await page.evaluate(async()=>{
 const rows=[['synthetic-site'],[],['Test Name','','User\nFinishing Date','','Setup'],['Sphinx','','synthetic-user','','Image'],['Other','','10/21/2026 5:35:11 AM'],[,,,, 'Spot'],[,,,, 'Spot 2 [121.83 MeV]']];
 const measurement=(name,metric)=>{const row=[];row[9]=metric;row[16]='± 0.25';row[18]='± 0.3';row[22]='0';row[24]='0.086';row[28]='Passed';rows.push(row);};measurement('','Skewness X');rows.push([,,,, 'Spot 9 [80 MeV]']);measurement('','Skewness X');
 const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(rows),'ReportTestRepositoryFlatS');
 const bytes=XLSX.write(book,{type:'base64',bookType:'xlsx'});
 const preview=await api('POST','/api/assignments/1/sphinx/preview',{file:{name:'GTR1_DailyQA_10212026.xlsx',data:bytes}});
 const template=await api('GET','/api/assignments/1/template');return {matched:preview.matched.map(m=>template.items.find(i=>i.test_id===m.test_id).name),unmatched:preview.unmatched};
});
assert.deepEqual(imported.matched,['Spot 6 [120.6 MeV] – Skewness X']);assert.equal(imported.unmatched.length,0);
console.log('G1/G2/G5 use identical shared tests; legacy additions cleaned up; renumbered energy match verified; extra spot ignored.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
