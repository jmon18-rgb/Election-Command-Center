// Fictional winner events in a separate browser. This is numerical/UI engineering
// evidence, not election-source delivery, empirical calibration or owner acceptance.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url),fiction=require('./fictional_call_basis.cjs');
const rareNow=Date.parse('2026-11-04T04:06:00Z'),rareCounts=[require('./ohio_test_fixture.cjs').envelope(8,rareNow),require('./michigan_house_07_test_fixture.cjs').envelope(-3,rareNow),require('./nebraska_test_fixture.cjs').envelope(-2,rareNow)];
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_URL||'playwright');
const root=resolve(import.meta.dirname,'..'),out=resolve(root,process.env.UI_REVIEW_OUTPUT_DIR||'artifacts/readiness/ui-review/source-call-conditioning');
mkdirSync(out,{recursive:true});
const dashboard=process.env.DASHBOARD_TEST_URL?new URL(process.env.DASHBOARD_TEST_URL):null;
if(dashboard){assert.equal(dashboard.origin,'https://jmon18-rgb.github.io');assert.equal(dashboard.pathname,'/Election-Command-Center/');assert.equal(dashboard.username,'');assert.equal(dashboard.password,'');assert.equal(dashboard.search,'');assert(['','#electionNight'].includes(dashboard.hash));}
const publishedMain=dashboard?execFileSync('git',['rev-parse','origin/main'],{cwd:root,encoding:'utf8'}).trim():null;
if(dashboard){assert.equal(process.env.DASHBOARD_TEST_MAIN,publishedMain,'Root must verify final CURRENT-main Pages and bytes before published execution');assert(/^\d+$/.test(process.env.DASHBOARD_TEST_PAGES_RUN||''),'Root must supply its verified final successful Pages run');}
const pinFiles=['index.html','scripts/personal_election_focus.js','scripts/source_call_conditioning.js','scripts/chamber_control_model.js','scripts/national_county_likelihood.js','scripts/joint_model_worker.js','scripts/joint_model_worker_controller.js','scripts/joint_count_snapshot_policy.js'],
 pinned=Object.fromEntries(pinFiles.map(file=>[file,dashboard?execFileSync('git',['show',publishedMain+':'+file],{cwd:root,maxBuffer:16*1024*1024}):readFileSync(resolve(root,file))])),
 sha256=body=>createHash('sha256').update(body).digest('hex'),
 reviewedTags=dashboard?Object.fromEntries(pinFiles.filter(file=>file!=='index.html').map(file=>{const tags=pinned['index.html'].toString('utf8').match(/<script[^>]+src="([^"]+)"[^>]*>/g)||[],tag=tags.find(tag=>tag.includes(file+'?'));assert(tag,'Published index references '+file);return [file,tag.match(/src="([^"]+)"/)[1]];})):null;
const types={'.html':'text/html','.js':'application/javascript','.json':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg'};
const server=dashboard?null:createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname,key=p==='/'?'index.html':decodeURIComponent(p).slice(1),file=resolve(root,'.'+(p==='/'?'/index.html':decodeURIComponent(p)));
 if(!file.startsWith(root+sep)||!existsSync(file)||!statSync(file).isFile())return res.writeHead(404).end();
 res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'}).end(pinned[key]||readFileSync(file));});
if(server)await new Promise(ok=>server.listen(0,'127.0.0.1',ok));let browser;const proofs=[];
try{
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
 for(const [width,height]of [[1366,900],[390,844]]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage(),errors=[],external=[],served=new Map(),requestedPins=new Set(),servedChecks=[],servedFailures=[];
  page.on('pageerror',e=>errors.push(e.message));
  if(dashboard)context.on('response',response=>{const url=new URL(response.url());if(url.origin!==dashboard.origin)return;const file=url.pathname===dashboard.pathname?'index.html':url.pathname.startsWith(dashboard.pathname)?url.pathname.slice(dashboard.pathname.length):null;if(!pinFiles.includes(file)||requestedPins.has(file))return;requestedPins.add(file);
   servedChecks.push(response.body().then(body=>{assert.equal(response.status(),200,'Actual published pinned response succeeds: '+file);assert(body.equals(pinned[file]),'Actual served bytes match final origin/main: '+file);served.set(file,sha256(body));}).catch(error=>servedFailures.push(error.message)));});
  await page.clock.install({time:new Date('2026-10-28T19:00:00Z')});
  await context.route('**/*',route=>{const u=new URL(route.request().url());if(dashboard?u.origin===dashboard.origin&&u.pathname.startsWith(dashboard.pathname):u.hostname==='127.0.0.1')return route.continue();external.push(u.hostname);return route.abort();});
  await page.goto(dashboard?.href||'http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
  if(dashboard){const actual=await page.evaluate(files=>Object.fromEntries(files.map(file=>[file,document.querySelector('script[src*="'+file+'?"]')?.getAttribute('src')||null])),Object.keys(reviewedTags));assert.deepEqual(actual,reviewedTags,'Actual published script identities match final origin/main index');}
  await page.locator('[data-page="electionNight"]').click();await page.locator('#enMode2026').click();
  await page.waitForFunction(()=>jointLastResult?.probabilities&&document.querySelectorAll('#enPersonalFocus article').length===19);
  await page.clock.pauseAt(new Date('2026-10-28T19:00:10Z'));
  const liveBefore=await page.evaluate(()=>JSON.stringify(jointLastResult));
  const costStart=process.hrtime.bigint(),performance=await page.evaluate(()=>{
   const result=NationalCountyLikelihood.condition(ChamberControlModel,jointBasis,[],{samples:3000,seed:20261103,independentSenateCredit:'no_credit',marginSummaryCodes:jointMarginSummaryCodes(),contextKey:'PUBLIC',live:{'IA-SEN':{mode:'source_called',winnerParty:'D'}}}).result;
   return {status:result.source_call_conditioning.status,particles:result.samples,ess:result.source_call_conditioning.effective_sample_size,minimum:result.source_call_conditioning.minimum_effective_sample_size,helper_in_revision:jointHistoryRevision().includes('source_call_conditioning@'+document.querySelector('script[src*="/source_call_conditioning.js?"]').getAttribute('src').split('?v=')[1])};
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
  const lateStart=process.hrtime.bigint(),late=await page.evaluate(()=>{
   const {basis,args,baseline}=callReview,pool=[...basis.senate,...basis.governors,...basis.house].filter(row=>!row.nonrep_independent_proxy||row.mean<0),chosen=pool.slice(0,200);
   const live=Object.fromEntries(chosen.map(row=>[row.code,{mode:'source_called',winnerParty:row.mean>=0?'D':'R'}]));
   const result=ChamberControlModel.simulate(basis,{...args,seed:20261103,live});
   PersonalElectionFocus.render(document.querySelector('#enPersonalFocus'),result,baseline,{closes:ElectionNightPollClosings2026,simulated:true});
   return {call_count:chosen.length,status:result.source_call_conditioning.status,reason:result.source_call_conditioning.reason,ess:result.source_call_conditioning.effective_sample_size,minimum:result.source_call_conditioning.minimum_effective_sample_size,
    valid_winners_preserved:chosen.every(row=>result.race_probabilities.find(x=>x.race_code===row.code).provider_called_party===(row.mean>=0?'D':'R')),
    called_ranges_suppressed:result.race_probabilities.filter(row=>row.provider_called_party).every(row=>row.margin_distribution==null),
    uncalled_ranges_conditioned:result.race_probabilities.filter(row=>!row.provider_called_party&&row.margin_distribution).every(row=>row.margin_distribution.conditioning==='VALIDATED_CALL_IMPORTANCE_RESAMPLED')};
  });
  late.wall_elapsed_ms_including_driver=Number(process.hrtime.bigint()-lateStart)/1e6;
  assert.equal(late.call_count,200);assert.equal(late.status,'CONDITIONED');assert(late.ess>=late.minimum);assert.equal(late.valid_winners_preserved,true);assert.equal(late.called_ranges_suppressed,true);assert.equal(late.uncalled_ranges_conditioned,true);
  assert.match(await page.locator('#enPersonalFocus .personal-focus-call-status').innerText(),/Validated calls inform related races through shared model factors/);
  assert.doesNotMatch(await page.locator('#enPersonalFocus .personal-focus-call-status').innerText(),/withheld/i);
  assert.match(await ia.innerText(),/SIMULATED · D victory/);assert.equal(await ia.locator('.personal-focus-margin').count(),0);
  const withheld=await page.evaluate(({basis,envelopes,now})=>{
   const {args}=callReview,update=NationalCountyLikelihood.condition(ChamberControlModel,basis,envelopes,{...args,samples:3000,seed:20261103,now,live:{'OH-SEN':{mode:'source_called',winnerParty:'D'}}}),result=update.result;
   PersonalElectionFocus.render(document.querySelector('#enPersonalFocus'),result,update.baseline,{closes:ElectionNightPollClosings2026,simulated:true});
   const oh=result.race_probabilities.find(row=>row.race_code==='OH-SEN');
   return {status:result.source_call_conditioning.status,reason:result.source_call_conditioning.reason,ess:update.diagnostics.call_support.effective_sample_size,minimum:update.diagnostics.call_support.minimum_effective_sample_size,
    particles:result.samples,valid_winner_preserved:oh.provider_called_party==='D'&&oh.dem_beats_rep_pct===100,called_margin:oh.margin_distribution??null,
    used_codes:update.diagnostics.used.map(row=>row.code),call_weights_tempered:result.source_call_conditioning.call_weights_tempered};
  },{basis:fiction(),envelopes:rareCounts,now:rareNow});
  assert.equal(withheld.particles,3000);assert.equal(withheld.status,'WITHHELD');assert.equal(withheld.reason,'WITHHELD_LOW_EFFECTIVE_SAMPLE_SUPPORT');assert(withheld.ess<withheld.minimum);assert.equal(withheld.valid_winner_preserved,true);assert.equal(withheld.called_margin,null);assert.equal(withheld.call_weights_tempered,false);assert.deepEqual(withheld.used_codes,['OH-SEN','MI-07','NE-SEN']);
  assert.match(await page.locator('#enPersonalFocus .personal-focus-call-status').innerText(),/Broader call update withheld.*Validated race winners remain fixed/);
  const ohio=page.locator('#enPersonalFocus [data-race="OH-SEN"]');assert.match(await ohio.innerText(),/SIMULATED · D victory/);assert.equal(await ohio.locator('.personal-focus-margin').count(),0);assert.doesNotMatch(await me.innerText(),/Broader validated-call context/);
  await page.locator('#enPersonalFocus .personal-focus-call-status').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,'withheld-call-context-'+width+'.png')});
  assert.equal(await page.evaluate(()=>JSON.stringify(jointLastResult)),liveBefore,'Fictional display review must leave the live model unchanged');
  await page.evaluate(()=>renderPersonalElectionFocus());
  assert.equal(await page.evaluate(()=>JSON.stringify(jointLastResult)),liveBefore);
  assert.doesNotMatch(await page.locator('#enPersonalFocus').innerText(),/SIMULATED|Broader call update withheld/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true);assert.deepEqual(errors,[]);
  if(dashboard){await Promise.all(servedChecks);assert.deepEqual(servedFailures,[]);assert.deepEqual([...served.keys()].sort(),pinFiles.slice().sort(),'Every published pinned index/helper/engine/kernel/worker/controller response was observed and byte-checked');}
  proofs.push({width,height,public_basis_3000_particle_browser_cost:performance,multiple_calls_realistic_bag_browser_cost:multipleCalls,late_200_call_conditioning_and_cost:late,fixed_rare_call_count_overlap_withheld:withheld,fictional_call_test:report,retraction_exact:true,unsupported_transfer_withheld:true,live_model_unchanged:true,horizontal_overflow:false,blocked_external_requests:external.length,...(dashboard?{actual_published_script_identities_match:true,actual_served_pinned_sha256:Object.fromEntries(served)}:{})});
  await context.close();console.log(width+'px validated-call same-draw range/context/correction/retraction/withheld/live-isolation PASS;3000 browser particles '+Math.round(performance.wall_elapsed_ms_including_driver)+'ms including driver');
 }
 if(dashboard)assert.equal(execFileSync('git',['rev-parse','origin/main'],{cwd:root,encoding:'utf8'}).trim(),publishedMain,'Final origin/main remains unchanged through the published check');
 writeFileSync(resolve(out,'source-call-conditioning-browser.json'),JSON.stringify({at:new Date().toISOString(),status:'PASS',scope:dashboard?'Actual published HTTPS browser with RAM-only fictional calls/counts, actual served pinned bytes, providers blocked; no local server or HTML/script route overrides.':'Isolated actual browser/synthetic calls; public basis timing; no source delivery/calibration/human acceptance',...(dashboard?{publication_url:dashboard.href,final_current_main:publishedMain,final_current_main_pages:Number(process.env.DASHBOARD_TEST_PAGES_RUN)}:{}),local_server_started:!dashboard,source_sha256:Object.fromEntries(pinFiles.map(file=>[file,sha256(pinned[file])])),actual_native_provider_gets:0,calibration:'NOT_ESTABLISHED',human_acceptance:'NOT_RUN',proofs},null,2)+'\n');
}finally{await browser?.close();if(server)await new Promise(ok=>server.close(ok));}
