// Isolated actual Worker, exact tracked math and fictional/saved synthetic
// inputs. No owner/private CSV or native election requests are made.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const require=createRequire(import.meta.url),root=resolve(import.meta.dirname,'..');
const out=resolve(root,process.env.UI_REVIEW_OUTPUT_DIR||'artifacts/readiness/ui-review/model-worker');mkdirSync(out,{recursive:true});
const workerSource=readFileSync(resolve(import.meta.dirname,'joint_model_worker.js'));
// Read the safe main registration rather than relying on an ignored manifest.
// Any accidental worker imports/messages during normal registration fail here.
const manifestSurface={document:{},postMessage(){throw Error('MAIN_MESSAGE_DURING_MANIFEST_READ');},importScripts(){throw Error('MAIN_IMPORT_DURING_MANIFEST_READ');}};
manifestSurface.self=manifestSurface;manifestSurface.window=manifestSurface;
vm.runInNewContext(workerSource.toString('utf8'),{self:manifestSurface,window:manifestSurface,document:manifestSurface.document,Set,Map,URL,ArrayBuffer});
const manifest={modelRevision:manifestSurface.JointModelWorkerRunner.MODEL_REVISION,imports:Array.from(manifestSurface.JointModelWorkerRunner.IMPORTS,row=>({...row}))};
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_URL||'playwright');
const fixture=require(resolve(root,'scripts/fictional_call_basis.cjs'));
const now=Date.parse('2026-11-04T04:06:00Z'),base=fixture({largeBags:true});base.senate.find(row=>row.code==='OH-SEN').mean=0;
const counts=[require(resolve(root,'scripts/ohio_test_fixture.cjs')).envelope(0,now),
 require(resolve(root,'scripts/michigan_house_07_test_fixture.cjs')).envelope(1,now),
 require(resolve(root,'scripts/nebraska_test_fixture.cjs')).envelope(1,now)];

const workerStamp=createHash('sha256').update(workerSource).digest('hex').slice(0,12);
const controllerSource=readFileSync(resolve(import.meta.dirname,'joint_model_worker_controller.js'));
const controllerStamp=createHash('sha256').update(controllerSource).digest('hex').slice(0,12);
const allowed=new Map(manifest.imports.map(row=>['/scripts/'+row.name+'.js?v='+row.stamp,readFileSync(resolve(root,'scripts',row.name+'.js'))]));
allowed.set('/scripts/joint_model_worker_controller.js?v='+controllerStamp,controllerSource);
const requests=[],unexpected=[];
const html='<!doctype html><meta charset="utf-8"><title>Isolated model worker proof</title><button id="tick">Interaction while model runs</button><output id="clicks">0</output>'+manifest.imports.map(row=>'<script src="/scripts/'+row.name+'.js?v='+row.stamp+'"></script>').join('')+
 '<script>window.mainProtocolEvents=[];window.addEventListener("message",event=>{if(event.data?.protocol==="joint-model-worker-v1")mainProtocolEvents.push(event.data.type)});window.mainMessageHandler=()=>{};window.onmessage=mainMessageHandler;</script>'+
 '<script src="/scripts/joint_model_worker.js?v='+workerStamp+'"></script><script src="/scripts/joint_model_worker_controller.js?v='+controllerStamp+'"></script>'+
 '<script>document.querySelector("#tick").onclick=()=>document.querySelector("#clicks").textContent=String(+document.querySelector("#clicks").textContent+1)</script>';
const server=createServer((req,res)=>{
 requests.push(req.url);
 if(req.url==='/')return res.writeHead(200,{'content-type':'text/html'}).end(html);
 if(req.url==='/scripts/joint_model_worker.js?v='+workerStamp)return res.writeHead(200,{'content-type':'application/javascript'}).end(workerSource);
 if(req.url==='/scripts/joint_model_worker.js?v='+workerStamp+'&broken=1')return res.writeHead(200,{'content-type':'application/javascript'}).end('throw Error("WORKER_STARTUP_TEST_FAILURE")');
 if(allowed.has(req.url))return res.writeHead(200,{'content-type':'application/javascript'}).end(allowed.get(req.url));
 if(req.url==='/favicon.ico')return res.writeHead(204).end();
 unexpected.push(req.url);res.writeHead(404).end();
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));let browser;const proofs=[];
const origin='http://127.0.0.1:'+server.address().port;
try{
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
 const context=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block'}),page=await context.newPage(),external=[],pageErrors=[];
 await context.route('**/*',route=>{if(new URL(route.request().url()).origin===origin)return route.continue();external.push(route.request().url());return route.abort();});
 page.on('pageerror',error=>pageErrors.push(error.message));await page.goto(origin+'/',{waitUntil:'load'});
 await page.evaluate(({workerStamp,modelRevision})=>{
  window.workerReview={workerStamp,modelRevision,sequence:0,responses:[]};
  window.createModelWorker=async(extra='')=>{
   const worker=new Worker('/scripts/joint_model_worker.js?v='+workerStamp+extra),pending=new Map();
   const ready=new Promise((resolve,reject)=>{worker.onerror=()=>reject(Error('WORKER_STARTUP_FAILED'));worker.onmessage=event=>{
    const message=event.data;workerReview.responses.push(message.type);
    if(message.type==='READY')resolve(message);
    else{const slot=pending.get(message.requestId);if(slot){pending.delete(message.requestId);slot.resolve(message);}}
   };});
   const status=await ready;
   return {worker,status,run:request=>new Promise((resolve,reject)=>{pending.set(request.requestId,{resolve,reject});worker.postMessage(request);})};
  };
  window.expectedVariants=(request,primary)=>{
   const out={},a=request.payload.args;
   for(const item of request.payload.variants||[]){const correlation=item.id.startsWith('correlation_');
    if(correlation&&Object.keys(a.live||{}).length){out[item.id]={result:null,errorCode:'VARIANT_DISABLED_BY_LIVE_CALLS'};continue;}
    if(correlation&&(primary.diagnostics.used||[]).length){out[item.id]={result:null,errorCode:'VARIANT_DISABLED_BY_COUNTY_RETURNS'};continue;}
    try{
     const options={samples:3000,seed:20261103,independentSenateCredit:'no_credit',nationalShift:a.nationalShift??0,errorMultiplier:a.errorMultiplier??1};
     if(correlation)options.senateCorrelationResearch=item.id==='correlation_moderate'?{nationalScale:.8,chamberScale:.65}:{nationalScale:.65,chamberScale:.55};else options.live=a.live||{};
     out[item.id]={result:ChamberControlModel.simulate(correlation?request.payload.basis:item.basis,options),errorCode:null};
    }catch{out[item.id]={result:null,errorCode:'OPTIONAL_VARIANT_UNAVAILABLE'};}
   }return out;
  };
  window.expectedPayload=request=>{
   const p=request.payload,primary=NationalCountyLikelihood.condition(ChamberControlModel,p.basis,p.envelopes,p.args);
   const fields=b=>({result:b.result,baseline:b.baseline,diagnostics:b.diagnostics});
   return {...fields(primary),publicComparison:p.publicBasis?fields(NationalCountyLikelihood.condition(ChamberControlModel,p.publicBasis,p.envelopes,{...p.args,contextKey:'PUBLIC'})):null,
    variants:expectedVariants(request,primary)};
  };
 },{workerStamp,modelRevision:manifest.modelRevision});
 const workerReady=await page.evaluate(async()=>{workerReview.runner=await createModelWorker();return workerReview.runner.status;});
 assert.equal(workerReady.available,true);assert.equal(workerReady.modelRevision,manifest.modelRevision);
 assert.equal(await page.evaluate(()=>window.onmessage===mainMessageHandler&&mainProtocolEvents.length===0&&JointModelWorkerRunner.MODEL_REVISION===workerReview.modelRevision),true,'Normal script registration cannot import, replace main handlers or emit worker messages');
 const args={samples:3000,seed:20261103,now,independentSenateCredit:'no_credit',contextKey:'PUBLIC',live:{},marginSummaryCodes:['IA-SEN','OH-SEN','MI-07','ME-SEN','NE-SEN']};
 const live=(code,party)=>({[code]:{mode:'source_called',winnerParty:party}});
 const privateBasis=structuredClone(base);privateBasis.senate.find(row=>row.code==='ME-SEN').mean+=3;
 const shadow=structuredClone(base);shadow.house[150].mean+=2;const presidential=structuredClone(base);presidential.house[151].mean-=2;
 const cases=[
  {name:'no_calls_no_counts',basis:base,envelopes:[],args},
  {name:'calls_only_no_credit',basis:base,envelopes:[],args:{...args,live:{...live('IA-SEN','D'),...live('NE-SEN','R')}}},
  {name:'counts_only',basis:base,envelopes:counts,args},
  {name:'county_returns_disable_uncounted_stress_variants',basis:base,envelopes:counts,args,variants:[{id:'correlation_moderate'},{id:'correlation_lower'}]},
  {name:'same_race_call_and_counts',basis:base,envelopes:counts,args:{...args,live:live('OH-SEN','D')}},
  {name:'private_and_public_atomic',basis:privateBasis,publicBasis:base,envelopes:[],args:{...args,contextKey:'LOCAL_RESEARCH_VARIANT',live:live('IA-SEN','D')}},
  {name:'four_optional_variants',basis:base,envelopes:[],args,variants:[{id:'house_shadow',basis:shadow},{id:'presidential_shadow',basis:presidential},{id:'correlation_moderate'},{id:'correlation_lower'}]},
  {name:'optional_failure_and_live_disabled',basis:base,envelopes:[],args:{...args,live:live('IA-SEN','D')},variants:[{id:'house_shadow',basis:{}},{id:'correlation_moderate'}]},
  {name:'archive_pure_polling',basis:base,envelopes:[],args,frameKind:'POLLING_ARCHIVE_BASELINE'}
 ];
 let epoch=0;
 function requestFor(item){return {protocol:'joint-model-worker-v1',type:'RUN',requestId:++epoch,epoch,signature:'fictional-signature-'+epoch,
  contextKey:item.args.contextKey,modelRevision:manifest.modelRevision,frameKind:item.frameKind||'LIVE',payload:{basis:item.basis,envelopes:item.envelopes,args:item.args,publicBasis:item.publicBasis||null,variants:item.variants||[]}};}
 for(const item of cases){const request=requestFor(item),result=await page.evaluate(async request=>{
   const expected=expectedPayload(request),actual=await workerReview.runner.run(request);
   if(actual.type!=='RESULT')throw Error('EXPECTED_RESULT_'+actual.error?.code);
   for(const key of ['requestId','epoch','signature','contextKey','modelRevision','frameKind'])if(actual[key]!==request[key])throw Error('IDENTITY_MISMATCH_'+key);
   if(JSON.stringify(actual.payload)!==JSON.stringify(expected))throw Error('WORKER_SYNC_EQUALITY_FAILED');
   if(JSON.stringify(JointModelWorkerRunner.run(request.payload,{contextKey:request.contextKey,frameKind:request.frameKind}))!==JSON.stringify(expected))throw Error('SAME_MAIN_FALLBACK_RUNNER_EQUALITY_FAILED');
   if((actual.payload.diagnostics.used||[]).length&&!Object.keys(request.payload.args.live||{}).length){for(const [id,variant]of Object.entries(actual.payload.variants))if(id.startsWith('correlation_')&&(variant.result!==null||variant.errorCode!=='VARIANT_DISABLED_BY_COUNTY_RETURNS'))throw Error('COUNTY_STRESS_COMPARISON_MUST_BE_DISABLED');}
   return {status:actual.payload.result.source_call_conditioning?.status||'NO_CALL_CONSTRAINT',no_credit:actual.payload.result.senate_independent_credit_mode,
    public_comparison:actual.payload.publicComparison!==null,variant_ids:Object.keys(actual.payload.variants),exact_bundle_equal:true};
  },request);assert.equal(result.no_credit,'no_credit');proofs.push({name:item.name,...result});}

 // Actual 200-call work stays in the worker while ordinary main-thread events
 // and timers continue. 390px is a viewport, not a physical-phone CPU claim.
 const pool=[...base.senate,...base.governors,...base.house].filter(row=>!row.nonrep_independent_proxy||row.mean<0);
 const many=Object.fromEntries(pool.slice(0,200).map(row=>[row.code,{mode:'source_called',winnerParty:row.mean>=0?'D':'R'}]));
 for(const width of [1366,390]){
  await page.setViewportSize({width,height:width===390?844:900});
  const request=requestFor({basis:base,envelopes:[],args:{...args,live:many}});
  await page.evaluate(request=>{workerReview.ticks=0;workerReview.finished=false;workerReview.timer=setInterval(()=>workerReview.ticks++,10);
   workerReview.job=workerReview.runner.run(request).then(value=>{workerReview.finished=true;clearInterval(workerReview.timer);return value;});},request);
  await page.locator('#tick').click();
  const during=await page.evaluate(()=>({pending:!workerReview.finished,ticks:workerReview.ticks,clicks:+document.querySelector('#clicks').textContent}));
  assert.equal(during.pending,true);assert(during.clicks>0);
  const completed=await page.evaluate(async()=>{const actual=await workerReview.job;return {type:actual.type,status:actual.payload?.result.source_call_conditioning?.status,ticks:workerReview.ticks};});
  assert.equal(completed.type,'RESULT');assert(completed.ticks>0);proofs.push({name:'responsive_200_calls_'+width,main_thread_interaction_while_pending:true,timer_ticks:completed.ticks,status:completed.status});
 }
 const cancellation=await page.evaluate(async({basis,args,many})=>{
  const controller=JointModelWorkerController.create({workerFactory:()=>new Worker('/scripts/joint_model_worker.js?v='+workerReview.workerStamp)});
  const common={contextKey:'PUBLIC',modelRevision:workerReview.modelRevision,frameKind:'LIVE'};
  const old=controller.submit({...common,signature:'actual-200-call-inflight',payload:{basis,envelopes:[],args:{...args,live:many},publicBasis:null,variants:[]}});
  await new Promise(resolve=>setTimeout(resolve,50));
  const withdrawn=controller.submit({...common,signature:'actual-withdrawal',payload:{basis,envelopes:[],args,publicBasis:null,variants:[]}});
  const [before,after]=await Promise.all([old,withdrawn]);
  const equal=JSON.stringify(after.payload)===JSON.stringify(JointModelWorkerRunner.run({basis,envelopes:[],args,publicBasis:null,variants:[]},{contextKey:'PUBLIC',frameKind:'LIVE'}));
  const first=controller.admit(after.ticket),second=controller.admit(after.ticket);controller.dispose();
  return {old:before.status,current:after.status,equal,first,second};
 },{basis:base,args,many});
 assert.deepEqual(cancellation,{old:'CANCELLED',current:'READY',equal:true,first:true,second:false});
 proofs.push({name:'actual_controller_withdrawal_cancels_running_worker',...cancellation});
 for(const [name,change,code]of [
  ['stale_revision',r=>{r.modelRevision='WRONG_REVISION';},'INVALID_REQUEST'],
  ['archive_retains_calls',r=>{r.frameKind='POLLING_ARCHIVE_BASELINE';r.payload.args.live=live('IA-SEN','D');},'INVALID_REQUEST'],
  ['raw_capture_request',r=>{r.payload.args.captureCountyDraws=['IA-SEN'];},'INVALID_REQUEST'],
  ['unknown_variant',r=>{r.payload.variants=[{id:'https://example.invalid/source'}];},'INVALID_REQUEST'],
  ['private_public_atomic_failure',r=>{r.payload.publicBasis={private_marker:'DO_NOT_ECHO_PRIVATE_INPUT'};},'MODEL_COMPUTATION_FAILED']
 ]){
  const request=requestFor({basis:base,envelopes:[],args:{...args}});change(request);
  const message=await page.evaluate(r=>workerReview.runner.run(r),request);
  assert.equal(message.type,'ERROR');assert.equal(message.error.code,code);assert.equal(message.payload,undefined);assert(!JSON.stringify(message).includes('DO_NOT_ECHO_PRIVATE_INPUT'));
  proofs.push({name,error_code:code,no_partial_or_raw_result:true});
 }
 // A real import failure is unavailable, not an empty/model-looking result.
 await context.route('**/scripts/source_call_conditioning.js?*',route=>route.abort());
 const missing=await page.evaluate(async request=>{const runner=await createModelWorker();const result=await runner.run(request);runner.worker.terminate();return {ready:runner.status,result};},requestFor({basis:base,envelopes:[],args}));
 assert.equal(missing.ready.available,false);assert.equal(missing.result.error.code,'STATIC_MODEL_UNAVAILABLE');assert.equal(missing.result.payload,undefined);
 await context.unroute('**/scripts/source_call_conditioning.js?*');
 assert.deepEqual(pageErrors,[],'No errors before the deliberately broken startup fixture');
 const startup=await page.evaluate(async()=>{try{const r=await createModelWorker('&broken=1');r.worker.terminate();return 'UNEXPECTED_READY';}catch{return 'WORKER_STARTUP_FAILED';}});
 assert.equal(startup,'WORKER_STARTUP_FAILED');
 const fallback=await page.evaluate(async({basis,args})=>{
  const controller=JointModelWorkerController.create({workerFactory:()=>new Worker('/scripts/joint_model_worker.js?v='+workerReview.workerStamp+'&broken=1')});
  const decision=await controller.submit({signature:'actual-failed-worker-fallback',contextKey:'PUBLIC',modelRevision:workerReview.modelRevision,frameKind:'LIVE',payload:{basis,envelopes:[],args,publicBasis:null,variants:[]}});
  const ready=controller.runSynchronousFallback(decision.ticket,payload=>JointModelWorkerRunner.run(payload,{contextKey:'PUBLIC',frameKind:'LIVE'}));
  const admitted=controller.admit(ready.ticket);controller.dispose();return {failed:decision.status,ready:ready.status,source:ready.source,admitted};
 },{basis:base,args});
 assert.deepEqual(fallback,{failed:'SYNC_FALLBACK_REQUIRED',ready:'READY',source:'SYNCHRONOUS_FALLBACK',admitted:true});
 await page.evaluate(()=>workerReview.runner.worker.terminate());
 assert.deepEqual(unexpected,[]);assert.deepEqual(external,[]);
 // Both startup-failure decisions are asserted above. Browsers can suppress
 // forwarding the second error to the page when its handler terminates that
 // worker immediately; every forwarded error must still be the known fixture.
 assert(pageErrors.every(message=>message==='WORKER_STARTUP_TEST_FAILURE'),'No unexpected browser errors');
 const receipt={schema:'actual-model-worker-browser-proof-v1',status:'PASS',at:new Date().toISOString(),worker_sha256:createHash('sha256').update(workerSource).digest('hex'),
  modelRevision:manifest.modelRevision,source_imports:manifest.imports,proofs,static_self_requests_only:true,external_requests:0,
  startup_import_and_runtime_errors_whitelisted:true,no_partial_private_public_bundle:true,no_rawproposal_responses:true,
  main_entry_handler_and_import_safe:true,same_runner_synchronous_fallback_exact:true,actual_controller_cancellation_and_fallback:true,
  limitations:['All race/call inputs are fictional or existing public synthetic county fixtures.','No actual election-night delivery, predictive calibration or physical-phone performance is established.','No private inputs, raw model results or numeric basis tables are written to this receipt.']};
 writeFileSync(resolve(out,'actual-worker-browser-proof.json'),JSON.stringify(receipt,null,2)+'\n');
 console.log('Actual Worker PASS: exact same-sync bundles, calls/counts/no_credit, atomic PUBLIC comparison, variants, both-viewport responsiveness, static-only requests and failure protocol.');
 await context.close();
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
