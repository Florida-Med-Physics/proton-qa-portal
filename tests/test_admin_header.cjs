const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
const p=await b.newPage();await p.goto('http://127.0.0.1:8791/');await p.locator('[name=username]').fill('Admin');await p.locator('[name=password]').fill('Admin');await p.locator('button[type=submit]').click();await p.waitForSelector('.dashboard-count');
for(const theme of ['light','dark'])for(const width of [768,900,1024,1200,1280,1366,1440,1920]){
 await p.setViewportSize({width,height:1000});await p.evaluate(t=>document.documentElement.dataset.theme=t,theme);
 const results=await p.evaluate(()=>{
 const bar=document.querySelector('.topbar'),nav=document.querySelector('#nav');
 const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return s.display!=='none'&&r.width>0&&r.left>=0&&r.right<=innerWidth+1&&r.top>=bar.getBoundingClientRect().top&&r.bottom<=bar.getBoundingClientRect().bottom+1;};
 return {tabs:[...nav.querySelectorAll('a')].map(a=>({label:a.textContent||'Home',visible:visible(a)})),controls:[...document.querySelectorAll('.who > *')].map(e=>({label:e.textContent||'Search',visible:visible(e)})),overflow:bar.scrollWidth>bar.clientWidth+1||nav.scrollWidth>nav.clientWidth+1};});
 assert(results.tabs.length>=6);assert(results.tabs.every(t=>t.visible),JSON.stringify({width,theme,...results}));assert(results.controls.every(t=>t.visible),JSON.stringify({width,theme,...results}));assert(!results.overflow);
}
await p.setViewportSize({width:390,height:844});await p.getByRole('button',{name:'Menu ☰',exact:true}).click();assert(await p.getByRole('link',{name:'Setup QA',exact:true}).isVisible());
await p.setViewportSize({width:1366,height:900});await p.screenshot({path:'/private/tmp/admin-header-desktop.png'});
console.log('All Admin tabs and account controls fit at 768–1920px in both themes; phone menu works.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
