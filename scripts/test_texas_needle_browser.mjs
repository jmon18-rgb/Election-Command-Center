import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,mkdirSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_URL||'playwright');
const root=resolve(import.meta.dirname,'..');
const reference=JSON.parse(readFileSync(resolve(root,'data/texas_county_fips_reference.json')));
const history=JSON.parse(readFileSync(resolve(root,'data/texas_senate_2024_county_baseline_official.json')));
const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.mp3':'audio/mpeg','.jpg':'image/jpeg'};
const server=createServer((req,res)=>{const p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const f=resolve(root,'.'+(p==='/'?'/index.html':p));
 if(!f.startsWith(root+sep)||!existsSync(f)||!statSync(f).isFile()){res.writeHead(404).end();return;}
 res.writeHead(200,{'content-type':types[extname(f)]||'application/octet-stream'}).end(readFileSync(f));});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
function packet(share,stamp,test=false,fraction=.65){
 const totals=[0,0],region_results=Object.fromEntries(history.counties.map(c=>{
  const n=Math.floor((c.dem_votes+c.rep_votes)*fraction),d=Math.floor(n*share),r=n-d;totals[0]+=d;totals[1]+=r;
  return [c.county_fips,{name:c.county,type:'County',fips:c.county_fips,percent_reporting:100,candidates:[
   {name:'James Talarico',party:'Democratic',votes:d},{name:'Ken Paxton',party:'Republican',votes:r},
   {name:'Ted Brown',party:'Libertarian',votes:0}]}];
 }));
 return {country:'US',province:'TX',district:null,municipality:null,election_scope:'General',election_type:'US Senate',
  election_name:'Texas US Senate',election_date:'2026-11-03T05:00:00.000Z',test_data:test,last_updated:stamp,region_results,
  candidates:[{name:'James Talarico',party:'Democratic',votes:totals[0]},
   {name:'Ken Paxton',party:'Republican',votes:totals[1]},{name:'Ted Brown',party:'Libertarian',votes:0}]};
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
 for(const width of [1366,390]){
  const context=await browser.newContext({viewport:{width,height:width===1366?768:844},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];let scenario='test',blueStamp='2026-11-04T03:07:00Z';page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-11-04T03:05:00Z')});
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());if(url.hostname==='127.0.0.1')return route.continue();
   if(url.href!=='https://civicapi.org/api/v2/race/87438')return route.abort();
   if(scenario==='outage')return route.fulfill({status:503,body:'unavailable'});
   return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},
    body:JSON.stringify(packet(scenario==='red'?.3:.6,scenario==='withdrawn'?'2026-11-04T03:07:10Z':scenario==='blue'?blueStamp:'2026-11-04T03:06:00Z',scenario==='test',scenario==='withdrawn'?0:.65))});
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'domcontentloaded'});
  await page.locator('[data-page="electionNight"]').click();await page.locator('#enMode2026').click();
  const host=page.locator('#enTexasRaceNeedle');
  await page.waitForFunction(()=>document.querySelector('[data-tx="state"]')?.textContent.includes('TEST DATA'));
  assert.equal(await host.locator('[data-tx="chance"]').textContent(),'—');
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),'ecc:county-source-revision:2026:TX-SEN:v1'),null,'Provider test votes never persist a source revision');
  const national=await page.evaluate(()=>JSON.stringify(jointLastResult.probabilities));
  scenario='red';await page.clock.setSystemTime(new Date('2026-11-04T03:06:00Z'));
  await host.locator('[data-tx="refresh"]').click();
  await page.waitForFunction(()=>Boolean(window.enTexasPilotController?.status().projection));
  const first=await page.evaluate(()=>enTexasPilotController.status().projection.dem_win_probability);
  const projection=await page.evaluate(()=>enTexasPilotController.status().projection);
  const input=packet(.3,'2026-11-04T03:06:00Z');
  assert.equal(projection.counted_dem_votes,input.candidates[0].votes);
  assert.equal(projection.counted_rep_votes,input.candidates[1].votes);
  assert.equal(projection.historical_method_split_reported,false);
  assert.equal(projection.observed_method_votes_inferred,false);
  assert.equal(projection.interval_calibrated,false);
  assert.equal(projection.may_move_national_needle,false);
  assert(projection.modeled_remaining_two_party_votes>=0);
  assert(projection.modeled_remaining_two_party_votes_band.every(Number.isFinite));
  assert(projection.modeled_remaining_two_party_votes_band[1]>projection.modeled_remaining_two_party_votes_band[0]);

  const starting=await page.evaluate(()=>({used:enTexasPilotController.status().projection.assumptions.prior_margin_points,
   linked:jointPulseBaseline.race_probabilities.find(r=>r.race_code==='TX-SEN').model_dem_margin_points}));
  assert.equal(starting.used,starting.linked,'Texas uses the same underlying starting margin as its linked race model');
  assert.match(await host.locator('[data-tx="votes"]').textContent(),/254\/254/);
  assert.match(await host.locator('[data-tx="remaining"]').textContent(),/turnout scenario range/);
  scenario='conflict';await page.clock.setSystemTime(new Date('2026-11-04T03:06:30Z'));
  await host.locator('[data-tx="refresh"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-tx="state"]')?.textContent.includes('requires a newer'));
  assert.equal(await host.locator('[data-tx="chance"]').textContent(),'—');
  scenario='blue';await page.clock.setSystemTime(new Date('2026-11-04T03:07:00Z'));
  await host.locator('[data-tx="refresh"]').click();
  await page.waitForFunction(first=>window.enTexasPilotController?.status().projection?.dem_win_probability>first+.3,first);
  assert.equal(await page.evaluate(()=>JSON.stringify(jointLastResult.probabilities)),national);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),'ecc:county-source-revision:2026:TX-SEN:v1')!==null,true,'Validated positive inputs persist ordering metadata');
  scenario='withdrawn';await page.clock.setSystemTime(new Date('2026-11-04T03:07:15Z'));
  await host.locator('[data-tx="refresh"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-tx="state"]')?.textContent.includes('No genuine'));
  assert.equal(await host.locator('[data-tx="chance"]').textContent(),'—');
  scenario='blue';await page.clock.setSystemTime(new Date('2026-11-04T03:07:25Z'));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof jointPulseBaseline!=='undefined'&&jointPulseBaseline?.race_probabilities?.some(r=>r.race_code==='TX-SEN'));
  await page.locator('[data-page="electionNight"]').click();await page.locator('#enMode2026').click();
  await page.waitForFunction(()=>window.enTexasPilotController&&!enTexasPilotController.status().busy&&!/Waiting|Select|Checking/.test(enTexasPilotController.status().phase));
  await page.waitForFunction(()=>Boolean(CompetitiveNeedlePrior.read(jointPulseBaseline,'TX-SEN')));
  await page.clock.setSystemTime(new Date('2026-11-04T03:07:35Z'));
  await host.locator('[data-tx="refresh"]').click();
  await page.waitForFunction(()=>!enTexasPilotController.status().busy&&!enTexasPilotController.status().phase.includes('No genuine'));
  assert.equal(await host.locator('[data-tx="chance"]').textContent(),'—','Reload must not resurrect older positive counts after a newer zero-count withdrawal');
  assert.match(await host.locator('[data-tx="state"]').textContent(),/requires a newer/);
  blueStamp='2026-11-04T03:07:45Z';await page.clock.setSystemTime(new Date(blueStamp));
  await host.locator('[data-tx="refresh"]').click();
  await page.waitForFunction(()=>Boolean(enTexasPilotController.status().projection));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  scenario='outage';await page.clock.setSystemTime(new Date('2026-11-04T03:09:00Z'));
  await host.locator('[data-tx="refresh"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-tx="state"]')?.textContent.includes('unavailable'));
  assert.equal(await host.locator('[data-tx="chance"]').textContent(),'—');
  scenario='blue';await page.clock.setSystemTime(new Date('2026-11-04T03:11:00Z'));
  await host.locator('[data-tx="refresh"]').click();
  await page.waitForFunction(()=>Boolean(window.enTexasPilotController?.status().projection));
  assert.equal(await page.evaluate(()=>enCivicBreaker.status().consecutive),0,
   'Validated Texas recovery resets the shared provider failure count');
  mkdirSync(resolve(root,'artifacts/readiness'),{recursive:true});
  await host.screenshot({path:resolve(root,`artifacts/readiness/texas-needle-${width}.png`)});
  await page.locator('#enMode2024').click();
  await page.waitForFunction(()=>!window.enTexasPilotController?.status().projection);
  assert.equal(await host.locator('[data-tx="chance"]').textContent(),'—','Archive mode removes the live probability');
  assert.equal(await page.evaluate(()=>JSON.stringify(jointLastResult.probabilities)),national,'Corrections and recovery cannot write national odds');
  // A missing protection asset withholds this estimate without taking down
  // the independent national model or core election-night page.
  await page.route('**/scripts/competitive_source_revision.js*',route=>route.abort());
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('[data-page="electionNight"]').click();await page.locator('#enMode2026').click();
  await page.waitForFunction(()=>enTexasPilotController?.status().phase.includes('revision guard unavailable'));
  assert.equal(await host.locator('[data-tx="chance"]').textContent(),'—');
  await page.waitForFunction(()=>Boolean(jointLastResult?.probabilities));
  assert.deepEqual(errors,[]);console.log(`${width}px Texas: validated source changes race probability, test/clock/outage gates and national isolation PASS`);
  await context.close();
 }
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
