// Audits every seeded machine and assigned template in an isolated browser context.
// Checks source results, shared machine history, displayed trend metadata and retests.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1600,height:1000}});
    await page.goto(process.env.PORTAL_TEST_URL||'http://127.0.0.1:8791/');
    await page.locator('[name=username]').fill('Admin');await page.locator('[name=password]').fill('Admin');
    await page.locator('button[type=submit]').click();await page.waitForSelector('.dashboard-count');
    const audit=await page.evaluate(async()=>{
      const machines=(await api('GET','/api/machines')).filter(m=>m.active);
      const runs=[],templates=[],failures=[],covered=new Set(),statuses=new Set();let checked=0,derived=0;
      for(const machine of machines){
        const assignments=(await api('GET',`/api/machines/${machine.id}/assignments`)).filter(a=>a.active);
        for(const assignment of assignments){
          const t=await api('GET',`/api/assignments/${assignment.id}/template`);templates.push(t);
          for(const scenario of ['baseline','warning','failure']){
            const results=[];
            for(const item of t.items){
              if(item.type==='numeric'){
                if(QADerived.read(item.description)||/\[calc:/.test(item.description||''))continue;
                const limits=item.limits||{},base=limits.expected??0;
                const band=limits.tol_mode==='percent'?Math.abs(base)/100:1;
                let value=base;
                if(scenario==='warning')value=base+(limits.warn!=null?limits.warn*band:0)+(limits.fail!=null&&limits.warn!=null?(limits.fail-limits.warn)*band/2:0);
                if(scenario==='failure')value=base+(limits.fail!=null?Math.max(Math.abs(limits.fail*band)*2,1):5);
                results.push({test_id:item.test_id,value});
              }else if(item.type==='boolean')results.push({test_id:item.test_id,value:scenario==='failure'?'fail':'pass'});
              else if(item.type==='status')results.push({test_id:item.test_id,value:scenario==='baseline'?'pass':scenario==='warning'?'warn':'fail'});
            }
            const saved=await api('POST',`/api/assignments/${assignment.id}/runs`,{qa_date:'2026-10-21',results});
            runs.push({machine,assignment,run:await api('GET','/api/runs/'+saved.id),template:t});
          }
        }
      }
      const histories=new Map();for(const m of machines)histories.set(m.id,await api('GET',`/api/machines/${m.id}/trends`));
      for(const {machine,assignment,run,template}of runs){
        const history=histories.get(machine.id);
        for(const result of run.results){
          if(result.value_num==null)continue;
          const point=(history[result.test_id]||[]).find(p=>p.run_id===run.id&&p.source_test_id===result.test_id);
          if(!point){failures.push(`${machine.name}/${assignment.queue_name}/${result.name}: missing source point`);continue;}
          const item=template.items.find(i=>i.test_id===result.test_id),limits=item.limits||{};
          const changed={...item,limits:{...limits,expected:999999,warn:0,fail:0}};
          const chart=judgedByList(changed,[point])[0];
          for(const field of ['expected','warn','fail','tol_mode','status'])if(chart[field]!==result[field])failures.push(`${machine.name}/${assignment.queue_name}/${result.name}: ${field} differs (${chart[field]} vs ${result[field]})`);
          if(chart.value!==result.value_num)failures.push(`${result.name}: measurement differs`);
          if(trendRunHref(chart)!==`#/runs/${run.id}?test_id=${result.test_id}`)failures.push(`${result.name}: wrong source link`);
          checked++;statuses.add(result.status);covered.add(`${machine.name}|${assignment.queue_name}`);
          if(QADerived.read(result.description)||/\[calc:/.test(result.description||''))derived++;
        }
      }
      return {machines:machines.map(m=>m.name),assignments:templates.length,runs:runs.length,checked,derived,statuses:[...statuses],covered:[...covered],failures};
    });
    assert.deepEqual(audit.failures,[]);assert(audit.checked>100);assert(audit.statuses.includes('pass'));assert(audit.statuses.includes('fail'));assert(audit.derived>0);
    console.log(JSON.stringify(audit,null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
