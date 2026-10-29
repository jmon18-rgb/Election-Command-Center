// Synthetic browser fixtures only; no raw returns are archived as live evidence.
import assert from 'node:assert/strict';import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,mkdirSync} from 'node:fs';import {resolve,extname,sep} from 'node:path';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{fixture}=require('./washington_test_fixture.cjs'),cache=require('./washington_official_cache.js');
const {fixture:remainingFixture}=require('./washington_remaining_test_fixture.cjs');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_URL||'playwright');
const root=resolve(import.meta.dirname,'..'),types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.mp3':'audio/mpeg'};
const server=createServer((req,res)=>{const f=resolve(root,'.'+(new URL(req.url,'http://localhost').pathname==='/'?'/index.html':new URL(req.url,'http://localhost').pathname));
 if(!f.startsWith(root+sep)||!existsSync(f)||!statSync(f).isFile()){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':types[extname(f)]||'application/octet-stream'}).end(readFileSync(f));});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));async function assertOfficialAdmissionPath(page,code){
 const observed=await page.evaluate(code=>{
  const controller=code==='WA-03'?enWashingtonHouse03Controller:enVirginiaHouse02Controller;
  const snapshot=controller.status().evidence?.snapshot;
  const event=enOfficialAdmissionAudit.events().find(e=>e.code===code&&e.kind==='ADMITTED');
  return {snapshot,event,version:ChamberControlModel.VERSION,pollingAt:jointBasis.generated_from_sources.model_polling_at,
   kernel:document.querySelector('script[src*="/national_county_likelihood.js?"]').getAttribute('src'),exportEnabled:!document.querySelector('#enExportChanges').disabled};
 },code);
 assert(observed.event,'Actual parser/controller/national-model path must create an admission receipt');
 assert.equal(observed.snapshot.collection_payload_integrity_verified,true);
 assert.match(observed.event.selected_hash,/^[a-f0-9]{64}$/);
 assert.equal(observed.event.selected_hash,observed.snapshot.collection_selected_payload_sha256,'Parser metadata survives the controller evidence envelope');
 assert.equal(observed.event.original_hash,observed.snapshot.collection_original_response_sha256);
 assert.equal(observed.event.original_hash_recomputed,false);
 assert.equal(observed.event.receipt_at,observed.snapshot.collection_fetched_at);
 assert.equal(observed.event.source_at,observed.snapshot.snapshot_updated_at);
 assert.equal(observed.event.model_version,observed.version);
 assert.equal(observed.event.polling_at,observed.pollingAt);
 assert.equal(observed.event.kernel_revision,observed.kernel);
 assert(observed.event.model_revision.includes(observed.version)&&observed.event.model_revision.includes(observed.pollingAt));
 assert.equal(observed.event.provenance_status,'VERIFIED_SELECTED_PAYLOAD');
 assert.equal(observed.exportEnabled,true);
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
 for(const width of [1366,390]){
  const context=await browser.newContext({viewport:{width,height:width===1366?768:844}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  let stamp='2026-11-04T04:05:00Z',statsStamp=stamp,mode='health',requests=0;
  await page.clock.install({time:new Date('2026-11-04T04:05:05Z')});
  await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname==='127.0.0.1')return route.continue();
   if(u.origin+u.pathname!==cache.URL)return route.abort();requests++;
   if(mode==='outage')return route.fulfill({status:503,body:'unavailable'});
   let record=await fixture({stamp,margin:mode==='red'?-12:12,zero:mode==='zero',correction:mode==='correction'?200:0});
   if(mode==='health'){record.status='SOURCE_UNAVAILABLE';record.payload=null;record.error='Official source not yet reporting';}
   if(mode==='corrupt')record.payload.ballotItemWithBreakdown.voteTotal++;
   if(mode.startsWith('remaining_')){record.official_remaining=remainingFixture({stamp:statsStamp,estimate:mode==='remaining_large'?500000:100});if(mode==='remaining_bad_hash')record.official_remaining.selected_payload_sha256='bad';}
   return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(record)});
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
  await page.locator('[data-page="electionNight"]').click();await page.locator('#enMode2026').click();
  await page.waitForFunction(()=>window.enWashingtonHouse03Controller&&!enWashingtonHouse03Controller.status().busy&&jointLastResult?.probabilities&&!/Waiting|Checking/.test(enWashingtonHouse03Controller.status().phase));
  const baseline=await page.evaluate(()=>JSON.stringify(jointPulseBaseline.probabilities));
  mode='blue';await page.clock.runFor(61000);
  await page.waitForFunction(()=>jointLastResult?.county_results_update?.used.some(e=>e.code==='WA-03'));await assertOfficialAdmissionPath(page,'WA-03');
  const blue=await page.evaluate(()=>({p:jointLastResult.probabilities,base:JSON.stringify(jointPulseBaseline.probabilities),used:jointLastResult.county_results_update.used,calls:jointLastResult.race_probabilities.filter(r=>r.provider_called_party).length}));
  assert.notEqual(JSON.stringify(blue.p),baseline);assert.equal(blue.base,baseline);assert.equal(blue.calls,0);assert.equal(blue.used.length,1);
  assert.match(await page.locator('#enNationalWashingtonHouseSource').textContent(),/several minutes/);
  assert.match(await page.locator('#jointNightNeedle').textContent(),/Washington official · collected copy/);
  assert.match(await page.locator('#jointNightNeedle').textContent(),/1 House district in Washington, not national House coverage/);
  mkdirSync(resolve(root,'artifacts/readiness'),{recursive:true});
  await page.locator('#jointNightNeedle').scrollIntoViewIfNeeded();
  await page.screenshot({path:resolve(root,'artifacts/readiness/synthetic-washington-national-'+width+'.png'),fullPage:false});
  assert.equal(await page.evaluate(()=>enWashingtonHouse03Controller.status().automatic_poll_interval_ms),60000);
  const before=requests;await page.evaluate(()=>enWashingtonHouse03Controller.tick(true));assert.equal(requests,before,'Manual refresh cannot bypass the one-minute owned-cache floor');
  async function update(next,minute,sourceMinute=minute){mode=next;stamp='2026-11-04T04:'+sourceMinute+':00Z';statsStamp='2026-11-04T04:'+minute+':00Z';await page.clock.setSystemTime(new Date('2026-11-04T04:'+minute+':05Z'));
   await page.evaluate(async()=>{await enWashingtonHouse03Controller.tick(true);await jointRender(true);await jointWhenIdle();});}
  await update('correction','08');assert.equal(await page.evaluate(()=>enOfficialAdmissionAudit.events().find(e=>e.code==='WA-03').kind),'CORRECTION');const corrected=await page.evaluate(()=>jointLastResult.county_results_update.used[0].counted_two_party_votes);
  assert.equal(corrected,blue.used[0].counted_two_party_votes-200);
  await update('red','10');assert.notDeepEqual(await page.evaluate(()=>jointLastResult.probabilities),blue.p);
  await update('blue','12','05');assert.equal(await page.evaluate(()=>enWashingtonHouse03Controller.status().evidence),null,'Older source cannot resurrect after a newer correction');
  await update('zero','14');assert.equal(await page.evaluate(()=>enOfficialAdmissionAudit.events().find(e=>e.code==='WA-03').kind),'WITHDRAWN');assert.equal(await page.evaluate(()=>JSON.stringify(jointLastResult.probabilities)),baseline);
  await update('red','16','10');assert.equal(await page.evaluate(()=>enWashingtonHouse03Controller.status().evidence),null,'Durable zero revision blocks replay of old positive counts');
  await update('blue','18');await update('outage','20');assert.equal(await page.evaluate(()=>JSON.stringify(jointLastResult.probabilities)),baseline);
  await update('corrupt','22');assert.equal(await page.evaluate(()=>enWashingtonHouse03Controller.status().evidence),null);
  await page.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,value:true}));await page.clock.setSystemTime(new Date('2026-11-04T04:24:05Z'));
  const paused=requests;await page.evaluate(()=>enWashingtonHouse03Controller.tick(true));assert.equal(requests,paused);
  await page.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,value:false}));
  await update('blue','26');
  const beforeRemaining=await page.evaluate(()=>JSON.stringify(jointLastResult.probabilities));
  await update('remaining_small','28','26');
  const small=await page.evaluate(()=>({p:jointLastResult.probabilities,used:jointLastResult.county_results_update.used[0]}));
  assert.equal(small.used.official_remaining_sensitivity.whole_counties,6);assert(!small.used.official_remaining_sensitivity.county_fips.includes('53067'));
  assert.equal(small.used.as_of,'2026-11-04T04:26:00Z');
  assert.equal(small.used.official_remaining_sensitivity.as_of,'2026-11-04T04:28:00.000Z');
  assert.equal(await page.evaluate(()=>jointPulseRows.find(r=>r.race_code==='WA-03').asOf),'2026-11-04T04:28:00.000Z');
  assert.match(await page.locator('#jointNightNeedle').textContent(),/historical\/official estimate sensitivity/);
  assert.match(await page.locator('#jointNightNeedle').textContent(),/Thurston historical; not exact ballots/);
  await page.locator('#jointNightNeedle').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(root,'artifacts/readiness/synthetic-washington-remaining-'+width+'.png'),fullPage:false});
  await update('remaining_large','30','26');
  assert.notDeepEqual(await page.evaluate(()=>jointLastResult.probabilities),small.p,'Updated estimates change national outlook even when counted votes/stamp stay identical');
  assert.equal(await page.evaluate(()=>JSON.stringify(jointPulseBaseline.probabilities)),baseline);
  await update('remaining_bad_hash','32','26');assert.equal(await page.evaluate(()=>JSON.stringify(jointLastResult.probabilities)),beforeRemaining,'Supplement integrity failure falls back to valid counts-only forecast');
  await update('remaining_small','34','26');assert.equal(await page.evaluate(()=>jointLastResult.county_results_update.used[0].official_remaining_sensitivity.whole_counties),6);
  // An old cached supplement cannot resurrect after a newer accepted estimate.
  statsStamp='2026-11-04T04:28:00Z';await page.clock.setSystemTime(new Date('2026-11-04T04:36:05Z'));await page.evaluate(async()=>{await enWashingtonHouse03Controller.tick(true);await jointRender(true);await jointWhenIdle();});
  assert.equal(await page.evaluate(()=>jointLastResult.county_results_update.used[0].official_remaining_sensitivity),undefined);
  await page.locator('#enMode2024').click();await page.evaluate(()=>enWashingtonHouse03Controller.tick());
  assert.equal(await page.evaluate(()=>enWashingtonHouse03Controller.status().evidence),null);assert.deepEqual(errors,[]);
  console.log(width+'px official WA03 NATIONAL: counts and paired whole-county remaining sensitivity, same-count estimate updates, correction/old-reply/integrity recovery, hidden/archive/manual gates PASS (SYNTHETIC)');
  await context.close();
 }
 const fallback=await browser.newContext(),safePage=await fallback.newPage(),fallbackErrors=[];safePage.on('pageerror',e=>fallbackErrors.push(e.message));
 await safePage.clock.install({time:new Date('2026-11-04T04:05:05Z')});
 await safePage.route('**/*',route=>{const u=new URL(route.request().url());return u.hostname==='127.0.0.1'&&!u.pathname.endsWith('/washington_official_cache.js')?route.continue():route.abort();});
 await safePage.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
 await safePage.locator('[data-page="electionNight"]').click();await safePage.locator('#enMode2026').click();
 await safePage.waitForFunction(()=>jointLastResult?.probabilities&&window.enNewYorkHouse17Controller&&window.enTexasPilotController);
 assert.equal(await safePage.evaluate(()=>window.enWashingtonHouse03Controller),undefined);assert.deepEqual(fallbackErrors,[]);
 await fallback.close();console.log('Missing optional official cache helper preserves the national baseline and existing county controllers PASS');
 for(const missing of ['washington_remaining_source.js','washington_remaining_scenarios.js']){
  const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-11-04T04:05:05Z')});
  await page.route('**/*',async route=>{const u=new URL(route.request().url());
   if(u.hostname==='127.0.0.1')return u.pathname.endsWith('/'+missing)?route.abort():route.continue();
   if(u.origin+u.pathname!==cache.URL)return route.abort();
   const record=await fixture();record.official_remaining=remainingFixture();return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(record)});
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});await page.locator('[data-page="electionNight"]').click();await page.locator('#enMode2026').click();
  await page.waitForFunction(()=>jointLastResult?.county_results_update?.used.some(e=>e.code==='WA-03'));
  assert.equal(await page.evaluate(()=>jointLastResult.county_results_update.used[0].official_remaining_sensitivity),undefined);assert.deepEqual(errors,[]);
  await context.close();console.log('Missing '+missing+' retains validated counts-only national path PASS');
 }
}finally{if(browser)await browser.close();await new Promise(ok=>server.close(ok));}
