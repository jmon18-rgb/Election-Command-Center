import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,mkdirSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_URL||'playwright');
const root=resolve(import.meta.dirname,'..');
const reference=JSON.parse(readFileSync(resolve(root,'data/iowa_county_fips_reference.json')));
const history=JSON.parse(readFileSync(resolve(root,'data/iowa_senate_county_modes_official.json')));
const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.mp3':'audio/mpeg','.jpg':'image/jpeg'};
const server=createServer((req,res)=>{const p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const f=resolve(root,'.'+(p==='/'?'/index.html':p));
 if(!f.startsWith(root+sep)||!existsSync(f)||!statSync(f).isFile()){res.writeHead(404).end();return;}
 res.writeHead(200,{'content-type':types[extname(f)]||'application/octet-stream'}).end(readFileSync(f));});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
function packet(scenario){
 const blue=scenario==='live-d'||scenario==='same-clock';
 const fraction=blue?.5:.1,share=blue?.6:.4;
 const totals=[0,0,0];
 const region_results=Object.fromEntries(reference.counties.map(c=>{
  const b=history.years['2022'].counties.find(r=>r.county===c.county).records.total;
  const n=Math.floor((b.dem_votes+b.rep_votes)*fraction),d=Math.floor(n*share),r=n-d;
  totals[0]+=r;totals[1]+=d;totals[2]++;
  return [c.fips,{name:c.county,type:'County',fips:c.fips,percent_reporting:100,candidates:[
   {name:'Ashley Hinson',party:'Republican',votes:r},{name:'Josh Turek',party:'Democratic',votes:d},
   {name:'Thomas Laehn',party:'Libertarian',votes:1}]}];
 }));
 return {country:'US',province:'IA',district:null,municipality:null,election_name:'Iowa US Senate',
  election_type:'US Senate',election_scope:'General',election_date:'2026-11-03T05:00:00.000Z',
  last_updated:scenario==='live-d'?'2026-11-04T03:07:00Z':'2026-11-04T03:06:00Z',test_data:scenario==='test',candidates:[
   {name:'Ashley Hinson',party:'Republican',votes:totals[0]},
   {name:'Josh Turek',party:'Democratic',votes:totals[1]},
   {name:'Thomas Laehn',party:'Libertarian',votes:totals[2]}],region_results};
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
 for(const width of [1366,390]){
  const context=await browser.newContext({viewport:{width,height:width===1366?768:844},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];let scenario='test',requests=0,release=null;
  page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-11-04T03:05:00Z')});
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());if(url.hostname==='127.0.0.1')return route.continue();
   if(url.href==='https://civicapi.org/api/v2/race/87151'){
    requests++;
    if(scenario==='delayed')return new Promise(resolve=>{release=async()=>{
     await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},
      body:JSON.stringify(packet('live-d'))});resolve();};});
    return scenario==='outage'?route.fulfill({status:503,body:'unavailable'}):route.fulfill({status:200,
     contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(packet(scenario))});
   }
   return route.abort();
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'domcontentloaded'});
  await page.locator('[data-page="electionNight"]').click();await page.locator('#enMode2026').click();
  const host=page.locator('#enIowaRaceNeedle');
  await page.waitForFunction(()=>document.querySelector('#enIowaRaceNeedle [data-iowa="state"]')?.textContent.includes('TEST DATA'));
  assert.equal(await host.locator('[data-iowa="chance"]').textContent(),'—','Real provider test flag excludes even positive fixture votes');
  const national=await page.evaluate(()=>JSON.stringify(jointLastResult.probabilities));
  scenario='live-r';await page.clock.setSystemTime(new Date('2026-11-04T03:06:00Z'));
  await host.locator('[data-iowa="refresh"]').click();
  await page.waitForFunction(()=>Boolean(window.enIowaPilotController?.status().projection));
  const first=await page.evaluate(()=>window.enIowaPilotController.status().projection.dem_win_probability);
  assert.match(await host.locator('[data-iowa="state"]').textContent(),/source-validated returns/);
  assert.match(await host.locator('[data-iowa="votes"]').textContent(),/99\/99 counties/);
  assert.match(await host.locator('[data-iowa="remaining"]').textContent(),/turnout scenario range/);
  scenario='same-clock';await page.clock.setSystemTime(new Date('2026-11-04T03:06:30Z'));
  await host.locator('[data-iowa="refresh"]').click();
  await page.waitForFunction(()=>document.querySelector('#enIowaRaceNeedle [data-iowa="state"]')?.textContent.includes('requires a newer'));
  assert.equal(await host.locator('[data-iowa="chance"]').textContent(),'—','Same-clock count changes cannot silently move a probability');
  scenario='live-d';await page.clock.setSystemTime(new Date('2026-11-04T03:07:00Z'));
  await host.locator('[data-iowa="refresh"]').click();
  await page.waitForFunction(first=>window.enIowaPilotController?.status().projection?.dem_win_probability>first+.01,first);
  assert.notEqual(await host.locator('[data-iowa="chance"]').textContent(),'—');
  assert.equal(await page.evaluate(()=>JSON.stringify(jointLastResult.probabilities)),national,
   'Iowa partial-return probabilities cannot change national control odds');
  const beforePreview=await page.locator('#enCoverageReconciliation').textContent();
  scenario='delayed';await page.clock.setSystemTime(new Date('2026-11-04T03:08:00Z'));
  await host.locator('[data-iowa="refresh"]').click();
  await page.waitForFunction(()=>window.enIowaPilotController?.status().busy);
  await host.locator('[data-iowa="preview"]').click();
  await page.waitForFunction(()=>document.querySelector('#enIowaRaceNeedle [data-iowa="state"]')?.textContent.includes('HISTORICAL SCENARIO'));
  assert(release,'Delayed provider response was intercepted');await release();
  await page.waitForFunction(()=>!window.enIowaPilotController.status().busy);
  assert.equal(await page.evaluate(()=>window.enIowaPilotController.status().preview),true,
   'Late live response cannot overwrite a historical scenario');
  await host.locator('[data-iowa="next"]').click();
  await page.waitForFunction(()=>document.querySelector('#enIowaRaceNeedle [data-iowa="state"]')?.textContent.includes('2/5'));
  assert.equal(await page.locator('#enCoverageReconciliation').textContent(),beforePreview,
   'Historical scenario does not write historical votes into live source counts');
  assert.match(await host.locator('[data-iowa="scope"]').textContent(),/not actual election-night timestamps/);
  mkdirSync(resolve(root,'artifacts/readiness'),{recursive:true});
  await host.screenshot({path:resolve(root,`artifacts/readiness/iowa-needle-${width}.png`)});
  for(let i=0;i<3;i++)await host.locator('[data-iowa="next"]').click();
  await page.waitForFunction(()=>document.querySelector('#enIowaRaceNeedle [data-iowa="state"]')?.textContent.includes('CERTIFIED RESULT'));
  assert.equal(await host.locator('[data-iowa="chance"]').textContent(),'R won');
  assert.match(await host.locator('[data-iowa="margin"]').textContent(),/R \+12.2/);
  assert.equal(await host.locator('[data-iowa="source-link"]').textContent(),'Iowa Secretary of State');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'No horizontal overflow');
  scenario='outage';await page.clock.setSystemTime(new Date('2026-11-04T03:09:00Z'));
  await host.locator('[data-iowa="preview"]').click();
  await page.waitForFunction(()=>document.querySelector('#enIowaRaceNeedle [data-iowa="state"]')?.textContent.includes('Source unavailable'));
  assert.equal(await host.locator('[data-iowa="chance"]').textContent(),'—');
  scenario='live-d';await page.clock.setSystemTime(new Date('2026-11-04T03:11:00Z'));
  await host.locator('[data-iowa="refresh"]').click();
  await page.waitForFunction(()=>Boolean(window.enIowaPilotController.status().projection));
  assert.equal(await page.evaluate(()=>enCivicRequestPool.status().concurrency_limit),4);
  assert.deepEqual(errors,[]);assert(requests>=6);
  console.log(`${width}px: full county response -> changing race probability, test exclusion, historical isolation, outage and unchanged national odds PASS`);
  await context.close();
 }
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
