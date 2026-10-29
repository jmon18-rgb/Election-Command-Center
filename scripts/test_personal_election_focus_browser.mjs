// Isolated synthetic/fixture UI checks, never an actual-results or calibration claim.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,mkdirSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_URL||'playwright');
const root=resolve(import.meta.dirname,'..'),types={'.html':'text/html','.js':'application/javascript','.json':'application/json','.svg':'image/svg+xml'};
const out=resolve(root,process.env.UI_REVIEW_OUTPUT_DIR||'artifacts/readiness');mkdirSync(out,{recursive:true});
const server=createServer((req,res)=>{const file=resolve(root,'.'+(new URL(req.url,'http://localhost').pathname==='/'?'/index.html':decodeURIComponent(new URL(req.url,'http://localhost').pathname)));
 if(!file.startsWith(root+sep)||!existsSync(file)||!statSync(file).isFile()){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(readFileSync(file));});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
 for(const width of [1366,390]){
  const context=await browser.newContext({viewport:{width,height:width===390?844:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-10-27T19:00:00Z')});
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
  await page.locator('[data-page="electionNight"]').click();await page.locator('#enMode2026').click();
  await page.waitForFunction(()=>document.querySelectorAll('#enPersonalFocus article svg').length===18);
  assert.equal(await page.locator('#enPersonalFocus article').count(),19);
  assert.match(await page.locator('#enPersonalFocus [data-race="AK-SEN"]').innerText(),/Needle pending/);
  assert.match(await page.locator('#enPersonalFocus [data-race="NE-SEN"]').innerText(),/Osborn.*model chance vs Ricketts.*Independent; no assumed Democratic caucus/s);
  assert.doesNotMatch(await page.locator('#enPersonalFocus [data-race="MI-SEN"]').innerText(),/Own county returns used/);
  const same=await page.evaluate(()=>Array.from(document.querySelectorAll('#enPersonalFocus article')).filter(e=>e.dataset.race!=='AK-SEN').every(e=>{
   const r=jointLastResult.race_probabilities.find(x=>x.race_code===e.dataset.race);return e.querySelector('svg').getAttribute('aria-label').includes(r.dem_beats_rep_pct.toFixed(1)+' percent');}));assert(same);
  const liveBefore=await page.evaluate(()=>JSON.stringify(jointLastResult.probabilities));
  const ia=page.locator('#enPersonalFocus [data-race="IA-SEN"]'),distribution=ia.locator('.personal-focus-margin');
  assert.equal(await distribution.count(),1,'Current shared simulation supplies a selected race range');
  assert.equal(await page.locator('#enPersonalFocus [data-race="AK-SEN"] .personal-focus-margin').count(),0);
  const sameRange=await ia.evaluate(card=>{const d=jointLastResult.race_probabilities.find(r=>r.race_code==='IA-SEN').margin_distribution;return {text:card.querySelector('.personal-focus-margin').textContent,median:d.p50,conditioning:d.conditioning};});
  assert.equal(sameRange.conditioning,'POLLING_BASELINE');assert.match(sameRange.text,/Middle 90%/);
  const help=distribution.locator('summary');await help.click();
  assert.match(await distribution.innerText(),/not a calibrated final-vote interval/);
  await page.evaluate(()=>renderPersonalElectionFocus());
  assert.equal(await help.evaluate(e=>e===document.activeElement),true,'Range explanation keeps keyboard focus after redraw');
  assert.equal(await distribution.locator('details').evaluate(e=>e.open),true);
  await page.keyboard.press('Space');assert.equal(await distribution.locator('details').evaluate(e=>e.open),false);
  const geometry=await distribution.locator('.personal-focus-margin-strip').evaluate(e=>{const r=e.getBoundingClientRect();return {width:r.width,children:[...e.children].map(c=>{const b=c.getBoundingClientRect();return {left:b.left-r.left,right:b.right-r.left,height:b.height};})};});
  assert(geometry.width>150);assert(geometry.children.every(r=>r.left>=-3&&r.right<=geometry.width+3&&r.height>0),'Margin marks render within their explicitly labelled scale');
  await ia.screenshot({path:resolve(out,'margin-range-'+width+'.png')});
  await help.click();
  await page.evaluate(()=>{const called=structuredClone(jointLastResult);called.race_probabilities.find(r=>r.race_code==='IA-SEN').provider_called_party='D';PersonalElectionFocus.render(document.querySelector('#enPersonalFocus'),called,jointPulseBaseline,{closes:ElectionNightPollClosings2026});});
  assert.equal(await distribution.count(),0,'A source call must not fabricate a final margin');
  assert.equal(await ia.locator('h4').evaluate(e=>e===document.activeElement),true,'Removed range returns its reader to the same race heading');
  await page.evaluate(()=>renderPersonalElectionFocus());assert.equal(await distribution.count(),1);
  assert.equal(await page.evaluate(()=>JSON.stringify(jointLastResult.probabilities)),liveBefore,'Range interactions and synthetic display calls leave the live model unchanged');
  await page.locator('#enNationalRehearsal > summary').click();
  await page.locator('#enNationalRehearsal > details > summary').click();
  await page.waitForFunction(()=>document.querySelectorAll('#enPersonalFocusPreview article').length===19);
  assert(await page.locator('#enPersonalFocusPreview .personal-focus-margin').count()>0,'Rehearsal receives its own same-draw summaries');
  assert.match(await page.locator('#enPersonalFocusPreview').innerText(),/SIMULATED.*FICTIONAL COUNTS/s);
  await page.locator('#enNationalNext').click();await page.waitForFunction(()=>document.querySelector('#enNationalStage').textContent.includes('2/5'));
  const ksPreview=page.locator('#enPersonalFocusPreview [data-race="KS-SEN"]');
  assert.match(await ksPreview.locator('.personal-focus-performance').innerText(),/Even margin points vs expected/,'Expected blue counties show no added performance surprise');
  await ksPreview.locator(':scope > details > summary').click();assert.match(await ksPreview.innerText(),/not county polls|not confidence intervals/);
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
  await previewHistory.screenshot({path:resolve(out,'outlook-history-'+width+'.png')});
  // Return to the surprise frame to retain the existing county disclosure drill.
  await page.locator('#enNationalNext').click();await page.locator('#enNationalNext').click();await page.locator('#enNationalNext').click();
  await page.waitForFunction(()=>document.querySelector('#enNationalStage').textContent.includes('3/5'));
  await ksPreview.locator(':scope > details > summary').click();
  assert.match(await ksPreview.innerText(),/Largest 6 of/);
  await ksPreview.screenshot({path:resolve(out,'matched-performance-'+width+'.png')});
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
  const liveHistory=await page.evaluate(async()=>{const context=jointUsesPrivateContext()?'LOCAL_RESEARCH_VARIANT':'PUBLIC';await jointRender(true);await jointWhenIdle();const first=enOutlookHistory.events(context).length;await jointRender(true);await jointWhenIdle();
   const same=enOutlookHistory.events(context).length===first,old=jointNationalShift;jointNationalShift=old+.5;await jointRender(true);await jointWhenIdle();
   const change=enOutlookHistory.events(context)[0]?.kind||null;jointNationalShift=old;await jointRender(true);await jointWhenIdle();return{first,same,change};});
  assert.deepEqual(liveHistory,{first:1,same:true,change:'BASELINE_CHANGE'},'Actual controller logs baseline/settings changes, never calls them returns');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true);
  await page.locator('#enPersonalFocus').screenshot({path:resolve(out,'personal-focus-'+width+'.png')});
  await page.locator('#enMode2024').click();assert.equal(await page.locator('#enPersonalFocus').isHidden(),true);assert.deepEqual(errors,[]);
  // Start the separate missing-asset bootstrap at the original pre-close clock,
  // rather than carrying the preceding post-close history drill into startup.
  await page.clock.setSystemTime(new Date('2026-10-27T19:00:00Z'));
  await page.route('**/personal_election_focus.js*',route=>route.abort());await page.reload({waitUntil:'domcontentloaded'});await page.locator('[data-page="electionNight"]').click();await page.locator('#enMode2026').click();await page.waitForFunction(()=>jointLastResult?.probabilities);assert.equal(await page.evaluate(()=>typeof window.PersonalElectionFocus),'undefined');assert.deepEqual(errors,[]);
  await context.close();console.log(width+'px owner Senate/House same-model needles, disclosure, synthetic admission/withdrawal, archive and optional-script fallback PASS');
 }
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
