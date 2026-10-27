// Isolated synthetic/fixture UI checks, never an actual-results or calibration claim.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,mkdirSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_URL||'playwright');
const root=resolve(import.meta.dirname,'..'),types={'.html':'text/html','.js':'application/javascript','.json':'application/json','.svg':'image/svg+xml'};
const server=createServer((req,res)=>{const file=resolve(root,'.'+(new URL(req.url,'http://localhost').pathname==='/'?'/index.html':decodeURIComponent(new URL(req.url,'http://localhost').pathname)));
 if(!file.startsWith(root+sep)||!existsSync(file)||!statSync(file).isFile()){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(readFileSync(file));});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
 for(const width of [1366,390]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-10-27T19:00:00Z')});
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
  await page.locator('[data-page="electionNight"]').click();await page.locator('#enMode2026').click();
  await page.waitForFunction(()=>document.querySelectorAll('#enPersonalFocus article svg').length===17);
  assert.equal(await page.locator('#enPersonalFocus article').count(),18);
  assert.match(await page.locator('#enPersonalFocus [data-race="AK-SEN"]').innerText(),/Needle pending/);
  assert.match(await page.locator('#enPersonalFocus [data-race="NE-SEN"]').innerText(),/Osborn.*model win chance/s);
  assert.doesNotMatch(await page.locator('#enPersonalFocus [data-race="MI-SEN"]').innerText(),/Own county returns used/);
  const same=await page.evaluate(()=>Array.from(document.querySelectorAll('#enPersonalFocus article')).filter(e=>e.dataset.race!=='AK-SEN').every(e=>{
   const r=jointLastResult.race_probabilities.find(x=>x.race_code===e.dataset.race);return e.querySelector('svg').getAttribute('aria-label').includes(r.dem_beats_rep_pct.toFixed(1)+' percent');}));assert(same);
  const liveBefore=await page.evaluate(()=>JSON.stringify(jointLastResult.probabilities));
  await page.locator('#enNationalRehearsal > summary').click();
  await page.locator('#enNationalRehearsal > details > summary').click();
  await page.waitForFunction(()=>document.querySelectorAll('#enPersonalFocusPreview article').length===18);
  assert.match(await page.locator('#enPersonalFocusPreview').innerText(),/SIMULATED.*FICTIONAL COUNTS/s);
  await page.locator('#enNationalNext').click();await page.waitForFunction(()=>document.querySelector('#enNationalStage').textContent.includes('2/5'));
  const ksPreview=page.locator('#enPersonalFocusPreview [data-race="KS-SEN"]');
  assert.match(await ksPreview.locator('.personal-focus-performance').innerText(),/Even margin points vs expected/,'Expected blue counties show no added performance surprise');
  await ksPreview.locator('details > summary').click();assert.match(await ksPreview.innerText(),/not county polls|not confidence intervals/);
  await page.locator('#enNationalNext').click();await page.waitForFunction(()=>document.querySelector('#enNationalStage').textContent.includes('3/5'));
  assert.match(await ksPreview.locator('.personal-focus-performance').innerText(),/D\+3\.0 margin points vs expected/);
  const previewHistory=page.locator('#enPersonalFocusPreview .personal-focus-history');await previewHistory.locator(':scope > summary').click();
  assert.match(await previewHistory.innerText(),/SIMULATED/);assert.match(await previewHistory.innerText(),/model observations since/);
  await previewHistory.locator('.personal-focus-history-entry details > summary').first().click();
  assert.match(await previewHistory.innerText(),/Polling lineage:/);
  await page.locator('#enNationalNext').click();await page.waitForFunction(()=>document.querySelector('#enNationalStage').textContent.includes('4/5'));
  assert.match(await previewHistory.innerText(),/correction/);assert.equal(await previewHistory.evaluate(e=>e.open),true,'History disclosure remains open through updates');
  await page.locator('#enNationalNext').click();await page.waitForFunction(()=>document.querySelector('#enNationalStage').textContent.includes('5/5'));
  assert.match(await previewHistory.innerText(),/withdrawal/);
  assert.equal(await page.evaluate(()=>enOutlookHistory.events('PUBLIC').length+enOutlookHistory.events('LOCAL_RESEARCH_VARIANT').length),0,'Pre-election preview cannot populate either live history context');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,'Expanded history must wrap model revision strings on mobile');
  mkdirSync(resolve(root,'artifacts/readiness'),{recursive:true});await previewHistory.screenshot({path:resolve(root,'artifacts/readiness/outlook-history-'+width+'.png')});
  // Return to the surprise frame to retain the existing county disclosure drill.
  await page.locator('#enNationalNext').click();await page.locator('#enNationalNext').click();await page.locator('#enNationalNext').click();
  await page.waitForFunction(()=>document.querySelector('#enNationalStage').textContent.includes('3/5'));
  await ksPreview.locator('details > summary').click();
  assert.match(await ksPreview.innerText(),/Largest 6 of/);
  mkdirSync(resolve(root,'artifacts/readiness'),{recursive:true});await ksPreview.screenshot({path:resolve(root,'artifacts/readiness/matched-performance-'+width+'.png')});
  assert.equal(await page.locator('#enPersonalFocus .personal-focus-performance').count(),0,'Simulated performance cannot leak into live cards');
  assert.equal(await page.evaluate(()=>JSON.stringify(jointLastResult.probabilities)),liveBefore,'Preview must not change the live joint model');
  assert.doesNotMatch(await page.locator('#enPersonalFocus').innerText(),/SIMULATED/);
  await page.locator('#enNationalRehearsal > summary').click();
  const restored=await page.evaluate(async()=>{
   const inputs=await NationalNeedleRehearsal.load(p=>fetch('./'+p).then(r=>r.json())),args={samples:900,seed:20261103,rehearsal:true,now:NationalNeedleRehearsal.now};
   const sample=NationalCountyLikelihood.condition(ChamberControlModel,jointBasis,NationalNeedleRehearsal.stage(inputs,2,jointBasis),args);
   jointLastResult=sample.result;jointPulseBaseline=sample.baseline;renderPersonalElectionFocus();
   const admitted=document.querySelector('#enPersonalFocus [data-race="IA-SEN"]').textContent.includes('Own county returns used nationally');
   const empty=NationalCountyLikelihood.condition(ChamberControlModel,jointBasis,[],args);jointLastResult=empty.result;jointPulseBaseline=empty.baseline;renderPersonalElectionFocus();
   return {admitted,withdrawn:!document.querySelector('#enPersonalFocus [data-race="IA-SEN"]').textContent.includes('Own county returns used nationally'),same:JSON.stringify(empty.result.probabilities)===JSON.stringify(sample.baseline.probabilities)};
  });assert.deepEqual(restored,{admitted:true,withdrawn:true,same:true});
  await page.clock.setSystemTime(new Date('2026-11-04T03:00:00Z'));
  const liveHistory=await page.evaluate(()=>{const context=jointUsesPrivateContext()?'LOCAL_RESEARCH_VARIANT':'PUBLIC';jointRender(true);const first=enOutlookHistory.events(context).length;jointRender(true);
   const same=enOutlookHistory.events(context).length===first,old=jointNationalShift;jointNationalShift=old+.5;jointRender(true);
   const change=enOutlookHistory.events(context)[0]?.kind||null;jointNationalShift=old;jointRender(true);return{first,same,change};});
  assert.deepEqual(liveHistory,{first:1,same:true,change:'BASELINE_CHANGE'},'Actual controller logs baseline/settings changes, never calls them returns');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true);
  mkdirSync(resolve(root,'artifacts/readiness'),{recursive:true});await page.locator('#enPersonalFocus').screenshot({path:resolve(root,'artifacts/readiness/personal-focus-'+width+'.png')});
  await page.locator('#enMode2024').click();assert.equal(await page.locator('#enPersonalFocus').isHidden(),true);assert.deepEqual(errors,[]);
  await page.route('**/personal_election_focus.js*',route=>route.abort());await page.reload({waitUntil:'domcontentloaded'});await page.locator('[data-page="electionNight"]').click();await page.locator('#enMode2026').click();await page.waitForFunction(()=>jointLastResult?.probabilities);assert.deepEqual(errors,[]);
  await context.close();console.log(width+'px owner Senate/House same-model needles, disclosure, synthetic admission/withdrawal, archive and optional-script fallback PASS');
 }
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
