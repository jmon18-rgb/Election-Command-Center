// Fictional winner events in a separate browser. This is numerical/UI engineering
// evidence, not election-source delivery, empirical calibration or owner acceptance.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),fiction=require('./fictional_call_basis.cjs');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_URL||'playwright');
const root=resolve(import.meta.dirname,'..'),out=resolve(root,process.env.UI_REVIEW_OUTPUT_DIR||'artifacts/readiness/ui-review/source-call-conditioning');
mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'application/javascript','.json':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg'};
const server=createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname,file=resolve(root,'.'+(p==='/'?'/index.html':decodeURIComponent(p)));
 if(!file.startsWith(root+sep)||!existsSync(file)||!statSync(file).isFile())return res.writeHead(404).end();
 res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'}).end(readFileSync(file));});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));let browser;const proofs=[];
try{
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
 for(const [width,height]of [[1366,900],[390,844]]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage(),errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-10-28T19:00:00Z')});
  await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname==='127.0.0.1')return route.continue();external.push(u.hostname);return route.abort();});
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
  await page.locator('[data-page="electionNight"]').click();await page.locator('#enMode2026').click();
  await page.waitForFunction(()=>jointLastResult?.probabilities&&document.querySelectorAll('#enPersonalFocus article').length===19);
  await page.clock.pauseAt(new Date('2026-10-28T19:00:10Z'));
  const liveBefore=await page.evaluate(()=>JSON.stringify(jointLastResult));
  const costStart=process.hrtime.bigint(),performance=await page.evaluate(()=>{
   const result=NationalCountyLikelihood.condition(ChamberControlModel,jointBasis,[],{samples:3000,seed:20261103,independentSenateCredit:'no_credit',marginSummaryCodes:jointMarginSummaryCodes(),contextKey:'PUBLIC',live:{'IA-SEN':{mode:'source_called',winnerParty:'D'}}}).result;
   return {status:result.source_call_conditioning.status,particles:result.samples,ess:result.source_call_conditioning.effective_sample_size,minimum:result.source_call_conditioning.minimum_effective_sample_size,helper_in_revision:jointHistoryRevision().includes('source_call_conditioning.js?v=')};
  });
  performance.wall_elapsed_ms_including_driver=Number(process.hrtime.bigint()-costStart)/1e6;
  performance.hardware_scope='Same desktop host;390px is a phone viewport, not physical phone speed';
  assert.equal(performance.particles,3000);assert.equal(performance.helper_in_revision,true);
  assert.equal(performance.status,'CONDITIONED');assert(performance.ess>=performance.minimum);
  const multiStart=process.hrtime.bigint(),multipleCalls=await page.evaluate(basis=>{
   const result=ChamberControlModel.simulate(basis,{samples:3000,seed:19760408,independentSenateCredit:'no_credit',marginSummaryCodes:['IA-SEN','ME-SEN','MI-07'],live:{'IA-SEN':{mode:'source_called',winnerParty:'D'},'FICTION-FL-01':{mode:'source_called',winnerParty:'D'},'FICTION-FL-02':{mode:'source_called',winnerParty:'R'},'FICTION-TX-01':{mode:'source_called',winnerParty:'R'},'MI-07':{mode:'source_called',winnerParty:'D'},'NE-SEN':{mode:'source_called',winnerParty:'R'}}});
   return {status:result.source_call_conditioning.status,ess:result.source_call_conditioning.effective_sample_size,minimum:result.source_call_conditioning.minimum_effective_sample_size,particles:result.samples,redraw_bag_sizes:[28,38,52],call_count:6};
  },fiction({largeBags:true}));
  multipleCalls.wall_elapsed_ms_including_driver=Number(process.hrtime.bigint()-multiStart)/1e6;
  assert.equal(multipleCalls.status,'CONDITIONED');assert(multipleCalls.ess>=multipleCalls.minimum);
  const report=await page.evaluate(basis=>{
   const codes=new Set([...basis.house,...basis.senate,...basis.governors].map(row=>row.code));
   const args={samples:3000,seed:19760408,independentSenateCredit:'no_credit',marginSummaryCodes:jointMarginSummaryCodes().filter(code=>codes.has(code))},baseline=ChamberControlModel.simulate(basis,args);
   const result=ChamberControlModel.simulate(basis,{...args,live:{'IA-SEN':{mode:'source_called',winnerParty:'D'}}});
   window.callReview={basis,args,baseline,result};
   PersonalElectionFocus.render(document.querySelector('#enPersonalFocus'),result,baseline,{closes:ElectionNightPollClosings2026,simulated:true});
   const get=(r,c)=>r.race_probabilities.find(x=>x.race_code===c);
   return {status:result.source_call_conditioning.status,ess:result.source_call_conditioning.effective_sample_size,minimum:result.source_call_conditioning.minimum_effective_sample_size,peer_moved:get(result,'ME-SEN').dem_beats_rep_pct!==get(baseline,'ME-SEN').dem_beats_rep_pct,peer_called:get(result,'ME-SEN').provider_called_party,range_tag:get(result,'ME-SEN').margin_distribution.conditioning};
  },fiction({largeBags:true}));
  assert.equal(report.status,'CONDITIONED');assert(report.ess>=report.minimum);assert.equal(report.peer_moved,true);assert.equal(report.peer_called,null);assert.equal(report.range_tag,'VALIDATED_CALL_IMPORTANCE_RESAMPLED');
  const me=page.locator('#enPersonalFocus [data-race="ME-SEN"]'),ia=page.locator('#enPersonalFocus [data-race="IA-SEN"]');
  assert.match(await me.innerText(),/Broader validated-call context; own county returns are not admitted/);
  assert.match(await me.innerText(),/First-choice evidence; final RCV transfers separate/);
  assert.match(await ia.innerText(),/SIMULATED · D victory/);assert.equal(await ia.locator('.personal-focus-margin').count(),0);
  assert.equal(await page.locator('#enPersonalFocus [data-race="AK-SEN"] .personal-focus-margin').count(),0);
  await me.locator('.personal-focus-margin summary').click();assert.match(await me.innerText(),/broader validated-call context through shared model factors/);
  await me.locator('.personal-focus-margin summary').press('Space');assert.equal(await me.locator('.personal-focus-margin details').evaluate(e=>e.open),false);
  await me.scrollIntoViewIfNeeded();await me.screenshot({path:resolve(out,'broader-call-context-'+width+'.png')});
  await page.evaluate(()=>{const {basis,args,baseline}=callReview;callReview.corrected=ChamberControlModel.simulate(basis,{...args,live:{'IA-SEN':{mode:'source_called',winnerParty:'R'}}});PersonalElectionFocus.render(document.querySelector('#enPersonalFocus'),callReview.corrected,baseline,{closes:ElectionNightPollClosings2026,simulated:true});});
  assert.match(await ia.innerText(),/SIMULATED · R victory/);
  const withdrawn=await page.evaluate(()=>{const {basis,args,baseline}=callReview,result=ChamberControlModel.simulate(basis,{...args,live:{}});PersonalElectionFocus.render(document.querySelector('#enPersonalFocus'),result,baseline,{closes:ElectionNightPollClosings2026,simulated:true});return JSON.stringify(result)===JSON.stringify(baseline);});
  assert.equal(withdrawn,true);assert.equal(await page.locator('#enPersonalFocus .personal-focus-call-status').count(),0);
  assert.doesNotMatch(await me.innerText(),/Broader validated-call context/);
  await page.evaluate(()=>{const {basis,args,baseline}=callReview,unsupported=structuredClone(basis);unsupported.senate.find(x=>x.code==='IA-SEN').sigma=0;const result=ChamberControlModel.simulate(unsupported,{...args,live:{'IA-SEN':{mode:'source_called',winnerParty:'D'}}});if(result.source_call_conditioning.status!=='WITHHELD')throw Error('Unsupported conditional law must withhold covariance');PersonalElectionFocus.render(document.querySelector('#enPersonalFocus'),result,baseline,{closes:ElectionNightPollClosings2026,simulated:true});});
  assert.match(await page.locator('#enPersonalFocus .personal-focus-call-status').innerText(),/Broader call update withheld.*Validated race winners remain fixed/);
  assert.match(await ia.innerText(),/SIMULATED · D victory/);assert.doesNotMatch(await me.innerText(),/Broader validated-call context/);
  await page.locator('#enPersonalFocus .personal-focus-call-status').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,'withheld-call-context-'+width+'.png')});
  assert.equal(await page.evaluate(()=>JSON.stringify(jointLastResult)),liveBefore,'Fictional display review must leave the live model unchanged');
  await page.evaluate(()=>renderPersonalElectionFocus());
  assert.equal(await page.evaluate(()=>JSON.stringify(jointLastResult)),liveBefore);
  assert.doesNotMatch(await page.locator('#enPersonalFocus').innerText(),/SIMULATED|Broader call update withheld/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true);assert.deepEqual(errors,[]);
  proofs.push({width,height,public_basis_3000_particle_browser_cost:performance,multiple_calls_realistic_bag_browser_cost:multipleCalls,fictional_call_test:report,retraction_exact:true,unsupported_transfer_withheld:true,live_model_unchanged:true,horizontal_overflow:false,blocked_external_requests:external.length});
  await context.close();console.log(width+'px validated-call same-draw range/context/correction/retraction/withheld/live-isolation PASS;3000 browser particles '+Math.round(performance.wall_elapsed_ms_including_driver)+'ms including driver');
 }
 writeFileSync(resolve(out,'source-call-conditioning-browser.json'),JSON.stringify({at:new Date().toISOString(),scope:'Isolated actual browser/synthetic calls; public basis timing; no source delivery/calibration/human acceptance',proofs},null,2)+'\n');
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
