// Isolated browser regression: historical verdicts, precision, retests and exact source links.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(process.env.PORTAL_TEST_URL||'http://127.0.0.1:8791/');
    await page.locator('[name=username]').fill('Admin');await page.locator('[name=password]').fill('Admin');
    await page.locator('button[type=submit]').click();await page.waitForSelector('.dashboard-count');
    const sample=await page.evaluate(async()=>{
      const daily=await api('GET','/api/assignments/1/template');
      const item=daily.items.find(i=>i.name.includes('150')&&/Distal Depth/i.test(i.name));
      if(!item)throw Error('Synthetic test requires a distal-depth item');
      const baseline=item.limits.expected;
      const failed=await api('POST','/api/assignments/1/runs',{qa_date:'2026-10-21',results:[{test_id:item.test_id,value:baseline+5}]});
      const passed=await api('POST','/api/assignments/1/runs',{qa_date:'2026-10-21',results:[{test_id:item.test_id,value:baseline}]});
      const assignments=await api('GET','/api/machines/1/assignments');const monthlyAssignment=assignments.find(a=>/monthly/i.test(a.queue_name));const monthly=await api('GET',`/api/assignments/${monthlyAssignment.id}/template`);
      const other=monthly.items.find(i=>i.name===item.name)||monthly.items.find(i=>i.name.includes('150')&&/Distal Depth/i.test(i.name));
      return {failed:failed.id,passed:passed.id,test:item.test_id,monthlyTest:other?.test_id||item.test_id,monthlyAssignment:other?monthlyAssignment.id:1,baseline,number:blockNumbers(daily.items).get(item.test_id)};
    });
    await page.evaluate(s=>location.hash=`#/trends?machine_id=1&list=${s.monthlyAssignment}&test_id=${s.monthlyTest}&range=all`,sample);
    await page.waitForSelector('.trend-result-link');
    const failure=page.locator(`.trend-result-link[href="#/runs/${sample.failed}?test_id=${sample.test}"]`);
    const success=page.locator(`.trend-result-link[href="#/runs/${sample.passed}?test_id=${sample.test}"]`);
    assert.equal(await failure.count(),1);assert.equal(await success.count(),1);
    assert((await failure.textContent()).includes(`Test ${sample.number}`));
    assert((await failure.textContent()).includes(String(sample.baseline+5)));
    assert.equal(await failure.locator('.chip.fail').count(),1);
    assert.equal(await success.locator('.chip.pass').count(),1);
    assert((await page.locator('.trend-statistics').textContent()).includes(`Baseline: ${sample.baseline}`));
    await failure.click();await page.waitForSelector('.selected-qa-result');
    assert(page.url().includes(`/runs/${sample.failed}?test_id=${sample.test}`));
    assert.equal(await page.locator('.selected-qa-result').getAttribute('data-test-id'),String(sample.test));
    assert.equal(await page.locator('.selected-qa-result .qa-result .chip.fail').count(),1);
    const result=await page.evaluate(id=>api('GET','/api/runs/'+id),sample.failed);
    assert.equal(result.results.find(r=>r.test_id===sample.test).expected,sample.baseline);
    await page.evaluate(s=>location.hash=`#/trends?machine_id=1&list=${s.monthlyAssignment}&test_id=${s.monthlyTest}&range=all`,sample);
    await page.waitForSelector('.dot.st-fail');await page.locator('.dot.st-fail').first().click();
    await page.waitForSelector('.selected-qa-result');
    assert(page.url().includes(`/runs/${sample.failed}?test_id=${sample.test}`));
    const latestFail=await page.evaluate(async s=>(await api('POST','/api/assignments/1/runs',{qa_date:'2026-10-22',results:[{test_id:s.test,value:s.baseline+5}]})).id,sample);
    await page.evaluate(()=>location.hash='#/trends?machine_id=1&list=1&range=all');
    const alert=page.locator(`a[href="#/runs/${latestFail}?test_id=${sample.test}"]`).first();
    await alert.waitFor();assert((await alert.textContent()).includes(`Test ${sample.number}`));
    await alert.click();await page.waitForSelector('.selected-qa-result');
    assert(page.url().includes(`/runs/${latestFail}?test_id=${sample.test}`));
    assert.deepEqual(errors,[]);
    console.log('Exact test/run links, same-day failing retests, recorded baselines/verdicts and measurement precision verified.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
