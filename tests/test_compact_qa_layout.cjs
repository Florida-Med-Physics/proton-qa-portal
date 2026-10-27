const assert=require('node:assert/strict');const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const p=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(process.env.PORTAL_TEST_URL||'http://127.0.0.1:8791/');await p.locator('[name=username]').fill('Admin');await p.locator('[name=password]').fill('Admin');await p.locator('button[type=submit]').click();await p.waitForSelector('.dashboard-count');
 const run=await p.evaluate(async()=>(await api('POST','/api/assignments/13/runs',{results:[]})).id);
 for(const path of ['perform/13',`runs/${run}`,'perform/1']){
  await p.evaluate(path=>location.hash='#/'+path,path);await p.waitForSelector('.measure-table');
  for(const width of [1280,1366,1600,1920]){
   await p.setViewportSize({width,height:900});await p.waitForTimeout(100);
   const bad=await p.locator('.measure-table thead tr:first-child th').evaluateAll(cells=>cells.filter(c=>c.getClientRects().length&&(c.scrollWidth>c.clientWidth+1||getComputedStyle(c).whiteSpace!=='nowrap')).map(c=>c.textContent));
   assert.deepEqual(bad,[],`Crumpled heading at ${path}/${width}`);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   assert.equal(await p.locator('.submit-bar').evaluate(e=>getComputedStyle(e).position),'static');
  }
  if(path==='perform/13'){
   const first=p.locator('.hdr-qa-table tbody tr:not(.quick-trend)').first();
   assert((await first.textContent()).includes('Safety setup & TCS self-test'));
   assert.equal(await first.locator('.qa-sub').count(),0);
   assert((await first.boundingBox()).height<150);
   await first.getByRole('button',{name:'Test details',exact:true}).click();await p.waitForSelector('dialog.calculation-dialog');await p.getByRole('button',{name:'Close',exact:true}).click();
   const input=p.getByLabel('Survey meter Cs-137 check source reading',{exact:true});await input.fill('0.035');await input.scrollIntoViewIfNeeded();await input.focus();const rect=await input.boundingBox();await p.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);const before=await p.evaluate(()=>scrollY);await p.mouse.wheel(0,400);await p.waitForTimeout(150);assert((await p.evaluate(()=>scrollY))>before);assert.equal(await input.inputValue(),'0.035');
   await p.setViewportSize({width:390,height:844});await p.evaluate(()=>scrollTo(0,0));await p.waitForTimeout(100);assert.equal(await p.locator('.submit-bar').isVisible(),true);const footer=await p.locator('.submit-bar').boundingBox();assert(footer.y>844,'Submit bar covers phone tests');
  }
 }
 assert.deepEqual(errors,[]);console.log('Unbroken desktop headings, compact HDR rows, scrollable number fields and non-sticky submit controls verified.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
