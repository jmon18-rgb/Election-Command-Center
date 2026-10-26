import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,mkdirSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_URL||'playwright');
const root=resolve(import.meta.dirname,'..');
const reference=JSON.parse(readFileSync(resolve(root,'data/kansas_county_fips_reference.json')));
const history=JSON.parse(readFileSync(resolve(root,'data/kansas_senate_county_facts_official.json')));
const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.mp3':'audio/mpeg','.jpg':'image/jpeg'};
const server=createServer((req,res)=>{const p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const f=resolve(root,'.'+(p==='/'?'/index.html':p));
 if(!f.startsWith(root+sep)||!existsSync(f)||!statSync(f).isFile()){res.writeHead(404).end();return;}
 res.writeHead(200,{'content-type':types[extname(f)]||'application/octet-stream'}).end(readFileSync(f));});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
function packet(share,stamp,test=false){
 const totals=[0,0],region_results=Object.fromEntries(history.years['2020'].counties.map(c=>{
  const n=Math.floor((c.dem_votes+c.rep_votes)*.65),d=Math.floor(n*share),r=n-d;totals[0]+=d;totals[1]+=r;
  return [c.county_fips,{name:c.county,type:'County',fips:c.county_fips,percent_reporting:100,candidates:[
   {name:'Adam Hamilton',party:'Democratic',votes:d},{name:'Roger Marshall',party:'Republican',votes:r},
   {name:'David C Graham',party:'Libertarian',votes:0}]}];
 }));
 return {country:'US',province:'KS',district:null,municipality:null,election_scope:'General',election_type:'US Senate',
  election_name:'Kansas US Senate',election_date:'2026-11-03T05:00:00.000Z',test_data:test,last_updated:stamp,region_results,
  candidates:[{name:'Adam Hamilton',party:'Democratic',votes:totals[0]},
   {name:'Roger Marshall',party:'Republican',votes:totals[1]},{name:'David C Graham',party:'Libertarian',votes:0}]};
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
 for(const width of [1366,390]){
  const context=await browser.newContext({viewport:{width,height:width===1366?768:844},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];let scenario='test';page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-11-04T03:05:00Z')});
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());if(url.hostname==='127.0.0.1')return route.continue();
   if(url.href!=='https://civicapi.org/api/v2/race/87162')return route.abort();
   if(scenario==='outage')return route.fulfill({status:503,body:'unavailable'});
   return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},
    body:JSON.stringify(packet(scenario==='red'?.3:.6,scenario==='blue'?'2026-11-04T03:07:00Z':'2026-11-04T03:06:00Z',scenario==='test'))});
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'domcontentloaded'});
  await page.locator('[data-page="electionNight"]').click();await page.locator('#enMode2026').click();
  const host=page.locator('#enKansasRaceNeedle');
  await page.waitForFunction(()=>document.querySelector('[data-ks="state"]')?.textContent.includes('TEST DATA'));
  assert.equal(await host.locator('[data-ks="chance"]').textContent(),'—');
  const national=await page.evaluate(()=>JSON.stringify(jointLastResult.probabilities));
  scenario='red';await page.clock.setSystemTime(new Date('2026-11-04T03:06:00Z'));
  await host.locator('[data-ks="refresh"]').click();
  await page.waitForFunction(()=>Boolean(window.enKansasPilotController?.status().projection));
  const first=await page.evaluate(()=>enKansasPilotController.status().projection.dem_win_probability);
  const starting=await page.evaluate(()=>({used:enKansasPilotController.status().projection.assumptions.prior_margin_points,
   linked:jointPulseBaseline.race_probabilities.find(r=>r.race_code==='KS-SEN').model_dem_margin_points}));
  assert.equal(starting.used,starting.linked,'Kansas uses the same underlying starting margin as its linked race model');
  assert.match(await host.locator('[data-ks="votes"]').textContent(),/105\/105/);
  assert.match(await host.locator('[data-ks="remaining"]').textContent(),/turnout scenario range/);
  scenario='conflict';await page.clock.setSystemTime(new Date('2026-11-04T03:06:30Z'));
  await host.locator('[data-ks="refresh"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-ks="state"]')?.textContent.includes('requires a newer'));
  assert.equal(await host.locator('[data-ks="chance"]').textContent(),'—');
  scenario='blue';await page.clock.setSystemTime(new Date('2026-11-04T03:07:00Z'));
  await host.locator('[data-ks="refresh"]').click();
  await page.waitForFunction(first=>window.enKansasPilotController?.status().projection?.dem_win_probability>first+.3,first);
  assert.equal(await page.evaluate(()=>JSON.stringify(jointLastResult.probabilities)),national);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  scenario='outage';await page.clock.setSystemTime(new Date('2026-11-04T03:09:00Z'));
  await host.locator('[data-ks="refresh"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-ks="state"]')?.textContent.includes('unavailable'));
  assert.equal(await host.locator('[data-ks="chance"]').textContent(),'—');
  scenario='blue';await page.clock.setSystemTime(new Date('2026-11-04T03:11:00Z'));
  await host.locator('[data-ks="refresh"]').click();
  await page.waitForFunction(()=>Boolean(window.enKansasPilotController?.status().projection));
  assert.equal(await page.evaluate(()=>enCivicBreaker.status().consecutive),0,
   'Validated Kansas recovery resets the shared provider failure count');
  await page.locator('#enMode2024').click();
  await page.waitForFunction(()=>!window.enKansasPilotController?.status().projection);
  assert.equal(await host.locator('[data-ks="chance"]').textContent(),'—','Archive mode removes the live probability');
  assert.deepEqual(errors,[]);console.log(`${width}px Kansas: validated source changes race probability, test/clock/outage gates and national isolation PASS`);
  await context.close();
 }
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
