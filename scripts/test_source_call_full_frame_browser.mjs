// Fixed fictional full election, actual native Worker and current tracked assets.
// Numerical support/responsiveness evidence, never source delivery or calibration.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const require=createRequire(import.meta.url),root=resolve(import.meta.dirname,'..'),out=resolve(root,process.env.UI_REVIEW_OUTPUT_DIR||'artifacts/readiness/ui-review/source-call-full-frame');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_URL||'playwright');
mkdirSync(out,{recursive:true});
const worker=readFileSync(resolve(root,'scripts/joint_model_worker.js')),controller=readFileSync(resolve(root,'scripts/joint_model_worker_controller.js')),
 surface={document:{},ChamberControlModel:{},NationalCountyLikelihood:{}};
surface.self=surface;surface.window=surface;
vm.runInNewContext(worker.toString('utf8'),surface,{filename:'joint_model_worker.js'});
const runner=surface.JointModelWorkerRunner,manifest={imports:Array.from(runner.IMPORTS,row=>({...row})),modelRevision:runner.MODEL_REVISION},
 allowed=['election_night_poll_closings_2026','washington_remaining_source','washington_remaining_scenarios','source_call_conditioning','chamber_control_model','national_county_likelihood'];
assert.deepEqual(manifest.imports.map(row=>row.name),allowed,'Only the exact six installed model dependencies may be served');
assert.equal(require('./check_joint_model_worker_assets.cjs').inspect(worker.toString('utf8'),name=>readFileSync(resolve(root,'scripts',name+'.js'))).ok,true,'Actual tracked worker imports must match current exact source bytes');
const core=new Map(),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const row of manifest.imports){assert.match(row.stamp,/^[a-f0-9]{12}$/);core.set('/scripts/'+row.name+'.js?v='+row.stamp,readFileSync(resolve(root,'scripts',row.name+'.js')));}
const workerStamp=hash(worker).slice(0,12),controllerStamp=hash(controller).slice(0,12);
core.set('/scripts/joint_model_worker.js?v='+workerStamp,worker);core.set('/scripts/joint_model_worker_controller.js?v='+controllerStamp,controller);
const html='<!doctype html><meta charset=utf-8><title>Fictional complete conditional frame</title><button id=interaction>Model is running; this remains usable</button><output id=clicked>0</output>'+manifest.imports.map(row=>'<script src="/scripts/'+row.name+'.js?v='+row.stamp+'"></script>').join('')+
 '<script src="/scripts/joint_model_worker.js?v='+workerStamp+'"></script><script src="/scripts/joint_model_worker_controller.js?v='+controllerStamp+'"></script><script>document.querySelector("#interaction").onclick=()=>document.querySelector("#clicked").textContent=String(+document.querySelector("#clicked").textContent+1)</script>';
let requests=[],unexpected=[];
const server=createServer((req,res)=>{requests.push(req.url);if(req.url==='/')return res.writeHead(200,{'content-type':'text/html'}).end(html);if(core.has(req.url))return res.writeHead(200,{'content-type':'application/javascript'}).end(core.get(req.url));if(req.url==='/favicon.ico')return res.writeHead(204).end();unexpected.push(req.url);res.writeHead(404).end();});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));let browser;
try{
 const origin='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
 const viewports=process.argv[2]?[[Number(process.argv[2]),Number(process.argv[2])===390?844:900]]:[[1366,900],[390,844]];
 assert(viewports.every(([width])=>width===1366||width===390));
 for(const [width,height] of viewports)for(const composition of ['near_complete','balanced_partial']){
  requests=[];unexpected=[];
  const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block'}),page=await context.newPage(),external=[],errors=[];
  page.on('pageerror',error=>errors.push(error.message));await context.route('**/*',route=>{if(new URL(route.request().url()).origin===origin)return route.continue();external.push(route.request().url());return route.abort();});
  await page.goto(origin+'/',{waitUntil:'load'});
  const base=require('./fictional_call_basis.cjs')({largeBags:true}),basis=structuredClone(base);basis.senate.find(row=>row.code==='ME-SEN').mean+=3;
  const excluded=new Set(['FICTION-FL-01','FICTION-TX-01','FICTION-CA-01']);let live;
  if(composition==='near_complete'){
   const pool=[...base.senate,...base.governors,...base.house].filter(row=>(!row.nonrep_independent_proxy||row.mean<0)&&!excluded.has(row.code));
   live=Object.fromEntries(pool.slice(0,200).map(row=>[row.code,{mode:'source_called',winnerParty:row.mean>=0?'D':'R'}]));
  }else{
   // A different valid composition exercises both nonzero DP dimensions, with
   // roughly one third D calls, R calls and uncalled slots in every large bag.
   live={};excluded.clear();const largeCodes=new Set();
   for(const state of ['FL','TX','CA']){const rows=base.house.filter(row=>row.code.startsWith('FICTION-'+state+'-')),k=Math.floor(rows.length/3);
    for(const [i,row] of rows.entries()){largeCodes.add(row.code);if(i<2*k)live[row.code]={mode:'source_called',winnerParty:i<k?'D':'R'};else excluded.add(row.code);}}
   for(const row of [...base.senate,...base.governors,...base.house].filter(row=>(!row.nonrep_independent_proxy||row.mean<0)&&!largeCodes.has(row.code))){if(Object.keys(live).length>=200)break;live[row.code]={mode:'source_called',winnerParty:row.mean>=0?'D':'R'};}
  }
  const categoryCounts=Object.fromEntries(['FL','TX','CA'].map(state=>{const rows=base.house.filter(row=>row.code.startsWith('FICTION-'+state+'-'));return [state,{bag_slots:base.redrawn_state_distributions[state].length,D:rows.filter(row=>live[row.code]?.winnerParty==='D').length,R:rows.filter(row=>live[row.code]?.winnerParty==='R').length,uncalled:rows.filter(row=>!live[row.code]).length}];}));
  if(composition==='balanced_partial')assert.deepEqual(categoryCounts,{FL:{bag_slots:28,D:9,R:9,uncalled:10},TX:{bag_slots:38,D:12,R:12,uncalled:14},CA:{bag_slots:52,D:17,R:17,uncalled:18}});
  const now=Date.parse('2026-11-04T04:06:00Z'),summaryExcluded=composition==='near_complete'?[...excluded]:[...excluded].filter((_,i)=>i%10===0),
   args={samples:3000,seed:20261103,now,independentSenateCredit:'no_credit',contextKey:'LOCAL_RESEARCH_VARIANT',live,marginSummaryCodes:['OH-SEN','NE-SEN','MI-07',...summaryExcluded]},
   envelopes=[require('./ohio_test_fixture.cjs').envelope(-18,now),require('./michigan_house_07_test_fixture.cjs').envelope(1,now),require('./nebraska_test_fixture.cjs').envelope(1,now)],
   shadow=structuredClone(base),presidential=structuredClone(base);shadow.house[150].mean+=2;presidential.house[151].mean-=2;
  assert.equal(Object.keys(live).length,200);
  const payload={basis,envelopes,args,publicBasis:base,variants:[{id:'house_shadow',basis:shadow},{id:'presidential_shadow',basis:presidential},{id:'correlation_moderate'},{id:'correlation_lower'}]};
  await page.evaluate(({payload,revision})=>{
   const ref=document.querySelector('script[src*="/joint_model_worker.js?"]')?.getAttribute('src');
   window.proof={controller:JointModelWorkerController.create({workerFactory:()=>new Worker(ref),timeoutMs:30000}),finished:false,ticks:0,expectedCalls:Object.entries(payload.args.live)};
   proof.timer=setInterval(()=>proof.ticks++,20);proof.started=performance.now();
   proof.promise=proof.controller.submit({signature:'FICTIONAL_FULL200_COMPLETE_FRAME',contextKey:'LOCAL_RESEARCH_VARIANT',modelRevision:revision,frameKind:'LIVE',payload}).then(decision=>{proof.finished=true;clearInterval(proof.timer);proof.elapsed=performance.now()-proof.started;return decision;});
  },{payload,revision:manifest.modelRevision});
  await page.locator('#interaction').click();assert.equal(await page.evaluate(()=>!proof.finished&&+document.querySelector('#clicked').textContent===1),true,'UI events must remain usable while actual Worker does all frame work');
  const report=await page.evaluate(async()=>{
   const decision=await proof.promise,report={decision:decision.status,elapsed_ms:proof.elapsed,deadline_ms:30000,timer_ticks:proof.ticks,source:decision.source||null};
   if(decision.status==='READY'){
    const bundle=decision.payload,results=[['primary',bundle.result],['public',bundle.publicComparison?.result],...Object.entries(bundle.variants).filter(([,row])=>row.result).map(([id,row])=>[id,row.result])];
    report.outputs=results.map(([id,result])=>({id,samples:result?.samples,status:result?.source_call_conditioning?.status,ess:result?.source_call_conditioning?.effective_sample_size,
     all_200_winner_flags:proof.expectedCalls.every(([code,call])=>result?.race_probabilities.find(row=>row.race_code===code)?.provider_called_party===call.winnerParty),no_credit:result?.senate_independent_credit_mode,holdovers:result?.senate_dem_holdovers}));
    report.optional_errors=Object.fromEntries(Object.entries(bundle.variants).filter(([,row])=>row.errorCode).map(([id,row])=>[id,row.errorCode]));
    report.county_contexts=Object.fromEntries([['primary',bundle.diagnostics],['public',bundle.publicComparison.diagnostics]].map(([id,diagnostics])=>[id,{codes:diagnostics.used.map(row=>row.code),reporting_nodes:diagnostics.reporting_error?.quadrature_nodes}]));
    report.admitted=proof.controller.admit(decision.ticket);report.rejected_second_admission=!proof.controller.admit(decision.ticket);
    report.raw_or_cache_fields_exposed=/"(?:call_log_weights|transportCache|transport_margins|county_draws|seeds)"/.test(JSON.stringify(bundle));
   }else{report.reason=decision.reason;proof.controller.withhold(decision.ticket,'COMPLETE_FRAME_DEADLINE_OR_SUPPORT_FAILED');}
   proof.controller.dispose();return report;
  });
  const expectedIds=['house_shadow','presidential_shadow','primary','public'],expectedErrors={correlation_moderate:'VARIANT_DISABLED_BY_LIVE_CALLS',correlation_lower:'VARIANT_DISABLED_BY_LIVE_CALLS'},
   ids=report.outputs?.map(row=>row.id).sort(),exactIds=JSON.stringify(ids)===JSON.stringify(expectedIds),exactErrors=JSON.stringify(report.optional_errors)===JSON.stringify(expectedErrors),
   outputOK=exactIds&&report.outputs.every(row=>row.status==='CONDITIONED'&&row.ess>=1500&&row.samples===3000&&row.all_200_winner_flags&&row.no_credit==='no_credit'&&row.holdovers===34),
   expectedCountyContexts={primary:{codes:['OH-SEN','MI-07','NE-SEN'],reporting_nodes:61},public:{codes:['OH-SEN','MI-07','NE-SEN'],reporting_nodes:61}},exactCountyContexts=JSON.stringify(report.county_contexts)===JSON.stringify(expectedCountyContexts),
   status=report.decision==='READY'&&report.source==='WORKER'&&report.elapsed_ms<=30000&&outputOK&&exactErrors&&exactCountyContexts&&report.admitted&&report.rejected_second_admission&&!report.raw_or_cache_fields_exposed&&unexpected.length===0&&external.length===0&&errors.length===0?'PASS':'GATE_FAILED';
  const receipt={schema:'source-call-complete-frame-portable-browser-v1',status,width,height,composition,categoryCounts,modelRevision:manifest.modelRevision,
   source_sha256:Object.fromEntries(['source_call_conditioning','chamber_control_model','national_county_likelihood'].map(name=>[name,hash(readFileSync(resolve(root,'scripts',name+'.js')))])),
   report,exact_four_conditioned_output_ids:exactIds,exact_two_live_call_disabled_correlation_variants:exactErrors,exact_primary_and_public_county_context:exactCountyContexts,static_self_requests_only:unexpected.length===0&&external.length===0,request_count:requests.length,errors,
   limitations:['Fixed fictional200call full476fixture and synthetic Ohio/Michigan/Nebraska county envelopes.','390px is a desktop viewport, not physical phone performance.','No actual source delivery or independent accuracy/calibration is established.']};
  writeFileSync(resolve(out,'complete-frame-'+(composition==='near_complete'?'all':'balanced')+'-'+width+'.json'),JSON.stringify(receipt,null,2)+'\n');
  assert.equal(receipt.status,'PASS',JSON.stringify(receipt));assert.deepEqual(ids,expectedIds);assert.deepEqual(report.optional_errors,expectedErrors);
  assert.deepEqual(report.county_contexts,expectedCountyContexts);assert(report.timer_ticks>0);assert.deepEqual(unexpected,[]);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  console.log(width+'px '+composition+' actual Worker complete private+PUBLIC+two House frame PASS; '+Math.round(report.elapsed_ms)+'ms, 3000 particles, four ESS gates');await context.close();
 }
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
