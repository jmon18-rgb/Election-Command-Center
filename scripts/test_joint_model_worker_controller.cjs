'use strict';
// Controller lifecycle tests use synthetic packets and a deterministic fake
// worker/scheduler. They do not claim computation speed or model calibration.
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const vm=require('node:vm');
const api=require('./joint_model_worker_controller.js');
const revision='./scripts/engine.js?v=fixed|./scripts/kernel.js?v=fixed';
const summary=(marker=0)=>({samples:3000,probabilities:{blue_tsunami:20,blue_wave:30,shrug:40,red_dawn:10},marker});
const bundle=(marker=0,publicBasis=false,variantIds=[])=>({result:summary(marker),baseline:summary(),diagnostics:{used:[],status:'SYNTHETIC_ONLY'},
 publicComparison:publicBasis?{result:summary(marker+1),baseline:summary(),diagnostics:{used:[]}}:null,
 variants:Object.fromEntries(variantIds.map(id=>[id,{result:summary(marker+2),errorCode:null}]))});
const request=(signature='INITIAL',changes={})=>({signature,contextKey:'PUBLIC',modelRevision:revision,frameKind:'LIVE',
 payload:{basis:{privateLikeMargin:3},envelopes:[],publicBasis:null,args:{samples:3000,now:1793764800000,contextKey:'PUBLIC'},variants:[]},...changes});
function harness(changes={}){
 const tasks=[],timers=new Map(),workers=[];let counter=0,active=0,maxActive=0;
 class FakeWorker{
  constructor(){this.terminated=false;workers.push(this);active++;maxActive=Math.max(active,maxActive);}
  postMessage(message){this.message=structuredClone(message);this.savedMessage=this.onmessage;this.savedError=this.onerror;this.savedMessageError=this.onmessageerror;}
  reply(payload=bundle()){this.savedMessage?.({data:{...this.message,type:'RESULT',payload}});}
  error(code='MODEL_COMPUTATION_FAILED'){this.savedMessage?.({data:{...this.message,type:'ERROR',error:{code,recoverable:true}}});}
  emit(message){this.savedMessage?.({data:message});}
  terminate(){if(!this.terminated){this.terminated=true;active--;}}
 }
 const controller=api.create({workerFactory:()=>new FakeWorker(),timeoutMs:1000,schedule:fn=>tasks.push(fn),
  setTimer:fn=>{const id=++counter;timers.set(id,fn);return id;},clearTimer:id=>timers.delete(id),...changes});
 return {controller,workers,timers,tasks,flush(){while(tasks.length)tasks.shift()();},get active(){return active;},get maxActive(){return maxActive;}};
}
async function main(){
 let cases=0;
 {
  const h=harness(),input=request(),p=h.controller.submit(input);input.payload.basis.privateLikeMargin=99;
  assert.equal(h.workers.length,0);assert.equal(h.controller.state().queued,true);h.flush();
  assert.equal(h.workers[0].message.payload.basis.privateLikeMargin,3,'Capture payload immediately, before the scheduling gap');
  assert.equal(h.workers[0].message.protocol,api.PROTOCOL);assert.equal(h.workers[0].message.epoch,h.controller.state().epoch);
  h.workers[0].reply(bundle(7));const out=await p;assert.equal(out.status,'READY');assert.equal(out.payload.result.marker,7);
  assert.equal(h.controller.admit({...out.ticket}),false,'A forged metadata copy is not an admission ticket');
  assert.equal(h.controller.admit(out.ticket),true);assert.equal(h.controller.admit(out.ticket),false,'Admit once');
  assert.equal(h.active,0);assert.equal(h.timers.size,0);await h.controller.whenIdle();cases++;
 }
 {
  const h=harness(),a=h.controller.submit(request('A')),b=h.controller.submit(request('B')),c=h.controller.submit(request('C'));
  assert.equal((await a).status,'CANCELLED');assert.equal((await b).status,'CANCELLED');h.flush();
  assert.equal(h.workers.length,1,'Only latest queued snapshot dispatches');assert.equal(h.workers[0].message.signature,'C');
  h.workers[0].reply();assert.equal((await c).status,'READY');assert.equal(h.maxActive,1);cases++;
 }
 {
  const h=harness(),input=request(),first=h.controller.submit(input);assert.equal(h.controller.submit(input),first,'Identical pending calculation joins one promise');h.flush();
  const old=h.workers[0],next=h.controller.submit(request('SOURCE_WITHDRAWN'));
  assert.equal(old.terminated,true,'Withdrawal terminates old work immediately, before replacement dispatch');
  assert.equal((await first).status,'CANCELLED');h.flush();old.reply(bundle(99));old.savedError?.({message:'never copied private error'});
  assert.equal(h.controller.state().status,'RUNNING');h.workers[1].reply(bundle(2));assert.equal((await next).payload.result.marker,2);assert.equal(h.maxActive,1);cases++;
 }
 {
  const h=harness(),first=h.controller.submit(request('CALL_D'));h.flush();const old=h.workers[0];
  const latest=h.controller.submit(request('CALL_CORRECTED_R'));h.flush();old.reply(bundle(99));h.workers[1].reply(bundle(1));
  assert.equal((await first).status,'CANCELLED');const done=await latest;assert.equal(h.controller.admit(done.ticket),true);cases++;
 }
 {
  const h=harness(),p=h.controller.submit(request());h.flush();h.workers[0].reply();const done=await p;
  const newer=h.controller.submit(request('NEW_CONTEXT',{contextKey:'LOCAL_RESEARCH_VARIANT',payload:{...request().payload,args:{...request().payload.args,contextKey:'LOCAL_RESEARCH_VARIANT'}}}));
  assert.equal(h.controller.admit(done.ticket),false,'Completed old-context output cannot be admitted later');h.flush();h.workers[1].reply();assert.equal((await newer).status,'READY');cases++;
 }
 {
  const h=harness(),p=h.controller.submit(request());h.flush();const later=h.controller.submit({...request(),force:true,payload:{...request().payload,args:{...request().payload.args,errorMultiplier:1.2}}});
  assert.equal((await p).status,'CANCELLED','Explicit settings/basis invalidation also supersedes same signature');h.flush();assert.equal(h.workers.length,2);
  h.workers[1].reply();assert.equal((await later).status,'READY');cases++;
 }
 {
  const h=harness({workerFactory:null}),input=request(),p=h.controller.submit(input);input.payload.basis.privateLikeMargin=99;h.flush();const need=await p;
  assert.equal(need.status,'SYNC_FALLBACK_REQUIRED');assert.equal(need.reason,'WORKER_UNAVAILABLE');
  const done=h.controller.runSynchronousFallback(need.ticket,snapshot=>{assert.equal(snapshot.basis.privateLikeMargin,3);return bundle(5);});
  assert.equal(done.status,'READY');assert.equal(h.controller.admit(done.ticket),true);assert.equal((await h.controller.submit(request())).status,'READY');cases++;
 }
 for(const [name,changes,trigger,reason]of [
  ['construction',{workerFactory:()=>{throw Error('PRIVATE ERROR MUST NOT ESCAPE');}},null,'WORKER_CONSTRUCTION_FAILED'],
  ['invalidFactory',{workerFactory:()=>({})},null,'WORKER_UNAVAILABLE'],
  ['postMessage',{workerFactory:()=>({postMessage(){throw Error('PRIVATE');},terminate(){}})},null,'WORKER_POST_MESSAGE_FAILED'],
  ['runtime',{},w=>w.savedError({message:'PRIVATE'}),'WORKER_RUNTIME_ERROR'],
  ['messageDecode',{},w=>w.savedMessageError({data:'PRIVATE'}),'WORKER_MESSAGE_ERROR'],
  ['workerModel',{},w=>w.error(),'WORKER_MODEL_ERROR'],
  ['readyUnavailable',{},w=>w.emit({protocol:api.PROTOCOL,type:'READY',modelRevision:revision,available:false}),'WORKER_STATIC_MODEL_UNAVAILABLE'],
  ['revision',{},w=>w.emit({protocol:api.PROTOCOL,type:'READY',modelRevision:'old',available:true}),'WORKER_REVISION_MISMATCH']
 ]){
  const h=harness(changes),p=h.controller.submit(request());h.flush();trigger?.(h.workers[0]);const need=await p;
  assert.equal(need.status,'SYNC_FALLBACK_REQUIRED',name);assert.equal(need.reason,reason,name);assert(!JSON.stringify(need).includes('PRIVATE ERROR'));
  assert.equal(h.controller.runSynchronousFallback(need.ticket,()=>bundle()).status,'READY');assert.equal(h.active,0);cases++;
 }
 {
  const h=harness(),p=h.controller.submit(request());h.flush();const old=h.workers[0];[...h.timers.values()][0]();const need=await p;
  assert.equal(need.reason,'WORKER_TIMEOUT');assert.equal(old.terminated,true);const newJob=h.controller.submit(request('NEW_AFTER_TIMEOUT'));let computed=false;
  assert.equal(h.controller.runSynchronousFallback(need.ticket,()=>{computed=true;return bundle();}).status,'CANCELLED');assert.equal(computed,false);
  h.flush();old.reply();h.workers[1].reply();assert.equal((await newJob).status,'READY');cases++;
 }
 {
  const h=harness(),p=h.controller.submit(request());h.flush();[...h.timers.values()][0]();const need=await p;
  assert.equal(h.controller.withhold(need.ticket,'WORKER_TIMEOUT').status,'UNAVAILABLE','Root can decline a costly synchronous timeout retry');
  assert.equal(h.controller.runSynchronousFallback(need.ticket,()=>{throw Error('Must not run');}).status,'CANCELLED');
  await h.controller.whenIdle();assert.equal(h.controller.state().status,'UNAVAILABLE');cases++;
 }
 for(const field of ['requestId','epoch','signature','contextKey','modelRevision','frameKind','protocol']){
  const h=harness(),p=h.controller.submit(request());h.flush();const w=h.workers[0];w.emit({...w.message,type:'RESULT',payload:bundle(),[field]:'MISMATCH'});
  assert.equal((await p).reason,'WORKER_IDENTITY_MISMATCH',field);cases++;
 }
 {
  const h=harness(),p=h.controller.submit(request());h.flush();h.workers[0].reply({result:{proposal_only:true},baseline:summary(),diagnostics:{}});
  const need=await p;assert.equal(need.reason,'INVALID_WORKER_MODEL_RESULT');assert.equal(h.controller.runSynchronousFallback(need.ticket,()=>({})).reason,'INVALID_SYNCHRONOUS_MODEL_RESULT');cases++;
 }
 for(const reason of ['DOCUMENT_HIDDEN','ARCHIVE_TRANSITION','PRIVATE_CONTEXT_DISABLED','SETTINGS_CHANGED']){
  const h=harness(),p=h.controller.submit(request());h.flush();const old=h.workers[0];h.controller.cancel(reason);assert.equal((await p).reason,reason);old.reply();
  assert.equal(h.controller.state().status,'IDLE');assert.equal(h.active,0);cases++;
 }
 {
  const h=harness(),p=h.controller.submit(request());h.flush();h.controller.setEnabled(false,'DOCUMENT_HIDDEN');assert.equal((await p).status,'CANCELLED');
  assert.equal((await h.controller.submit(request())).status,'SKIPPED');h.controller.setEnabled(true);
  const archive=h.controller.submit(request('ARCHIVE_POLLING',{frameKind:'POLLING_ARCHIVE_BASELINE'}));h.flush();h.workers[1].reply();assert.equal((await archive).status,'READY');cases++;
 }
 {
  const h=harness({workerFactory:null}),p=h.controller.submit(request());h.flush();const need=await p;
  const done=h.controller.runSynchronousFallback(need.ticket,()=>{h.controller.cancel('WITHDRAWN_DURING_FALLBACK');return bundle(77);});
  assert.equal(done.status,'CANCELLED','Revalidate after fallback computation');assert.equal(h.controller.admit(need.ticket),false);cases++;
 }
 {
  const h=harness({workerFactory:null}),p=h.controller.submit(request());h.flush();const need=await p;
  assert.equal(h.controller.runSynchronousFallback(need.ticket,()=>Promise.resolve(bundle())).reason,'ASYNCHRONOUS_FALLBACK_NOT_ALLOWED');cases++;
 }
 {
  const h=harness(),p=h.controller.submit(request());h.flush();const invalid=h.controller.submit({...request(),signature:''});
  assert.equal((await p).reason,'INVALID_REQUEST');assert.equal((await invalid).status,'REJECTED');assert.equal(h.active,0);cases++;
 }
 {
  const h=harness(),p=h.controller.submit(request());h.flush();let idle=false;const waiter=h.controller.whenIdle().then(()=>{idle=true;});
  const newer=h.controller.submit(request('LATEST'));await Promise.resolve();assert.equal(idle,false,'whenIdle follows replacement work');h.flush();h.workers[1].reply();
  await newer;await waiter;assert.equal(idle,true);assert.equal((await p).status,'CANCELLED');cases++;
 }
 {
  const h=harness(),p=h.controller.submit(request('WITH_PUBLIC_AND_VARIANT',{payload:{...request().payload,publicBasis:{fake:true},variants:[{id:'house_shadow',basis:{fake:true}}]}}));h.flush();
  h.workers[0].reply(bundle(2,true,['house_shadow']));assert.equal((await p).status,'READY','Public comparison and optional variants arrive atomically');cases++;
 }
 {
  const input=request('OFFLINE_SMALLER_PRIMARY',{payload:{...request().payload,args:{...request().payload.args,samples:900},variants:[{id:'house_shadow',basis:{fake:true}}]}}),out=bundle(1,false,['house_shadow']);
  out.result.samples=900;out.baseline.samples=900;assert.equal(api.validBundle(out,input),true,'Optional research retains fixed3k budget independently of an offline primary budget');cases++;
 }
 {
  const h=harness(),p=h.controller.submit(request());h.flush();h.controller.dispose();assert.equal((await p).reason,'DISPOSED');
  h.controller.setEnabled(true);assert.equal((await h.controller.submit(request())).reason,'DISPOSED');assert.equal(h.controller.state().disposed,true);cases++;
 }
 // Every public output path uses the same recursive guard, including when the
 // optional controller script was not loaded. Alias sharing is not a cycle.
 {
  const html=readFileSync(resolve(__dirname,'../index.html'),'utf8').replaceAll('\r\n','\n');
  const body=html.slice(html.indexOf('function jointFallbackBundleValid('),html.indexOf('function jointPublicBundleValid(')).trim();
  assert.equal(body.replace('jointFallbackBundleValid','validBundle'),api.validBundle.toString().trim(),'Inline optional-asset fallback and controller guard stay exactly equal');
  const inline=vm.runInNewContext('('+body+')');
  const input=request('ALIASES',{payload:{...request().payload,publicBasis:{fake:true},variants:[{id:'house_shadow',basis:{fake:true}}]}});
  const shared=summary(),out={result:shared,baseline:shared,diagnostics:{used:[],optional:undefined},publicComparison:{result:shared,baseline:shared,diagnostics:{used:[]}},variants:{house_shadow:{result:shared,errorCode:null}}};
  for(const validate of [api.validBundle,inline])assert.equal(validate(out,input),true,'Acyclic result/baseline/PUBLIC/variant aliases are legitimate');
  for(const place of ['result','baseline','diagnostics','publicResult','publicBaseline','publicDiagnostics','variant'])for(const value of [NaN,Infinity,-Infinity]){
   const candidate=bundle(1,true,['house_shadow']);
   const host={result:candidate.result,baseline:candidate.baseline,diagnostics:candidate.diagnostics,publicResult:candidate.publicComparison.result,publicBaseline:candidate.publicComparison.baseline,publicDiagnostics:candidate.publicComparison.diagnostics,variant:candidate.variants.house_shadow.result}[place];
   host.deep={nested:[{value}]};
   for(const validate of [api.validBundle,inline])assert.equal(validate(candidate,input),false,'Reject nonfinite nested '+place);
  }
  cases++;
 }
 {
  const input=request(),foreign=vm.runInNewContext('({typed:new Float64Array([1,2]),buffer:new ArrayBuffer(8),view:new DataView(new ArrayBuffer(8))})');
  for(const raw of [new Float64Array([1,2]),new ArrayBuffer(8),new DataView(new ArrayBuffer(8)),foreign.typed,foreign.buffer,foreign.view]){
   const out=bundle();out.diagnostics.deep={raw};assert.equal(api.validBundle(out,input),false,'Reject raw buffer/view across realms');
  }
  for(const key of ['proposal_only','county_draws','call_proposal_draws','call_log_weights','log_weights','seeds','source_indices','weights','fingerprint','basis','publicBasis','localNormals','redrawMargins','redrawUniforms','transport_margins','transportCache','transportCacheChecksum','typed_usage','native_usage']){
   const out=bundle();out.result.deep={[key]:[1]};assert.equal(api.validBundle(out,input),false,'Raw proposal/private key '+key+' cannot escape');
  }
  const cyclic=bundle();cyclic.diagnostics.back=cyclic;assert.equal(api.validBundle(cyclic,input),false,'Reject a true public-output cycle');
  const getter=bundle();Object.defineProperty(getter.result,'bad',{enumerable:true,get(){throw Error('PRIVATE');}});assert.equal(api.validBundle(getter,input),false,'Malformed getter cannot escape or be admitted');cases++;
 }
 {
  const h=harness(),p=h.controller.submit(request());h.flush();const bad=bundle();bad.result.house_dem_control_pct=NaN;h.workers[0].reply(bad);
  const need=await p;assert.equal(need.reason,'INVALID_WORKER_MODEL_RESULT');
  const fallback=bundle();fallback.diagnostics.raw=new Float64Array([1]);
  assert.equal(h.controller.runSynchronousFallback(need.ticket,()=>fallback).reason,'INVALID_SYNCHRONOUS_MODEL_RESULT','Fallback has the same recursive admission guard');assert.equal(h.controller.admit(need.ticket),false);cases++;
 }
 {
  const worker=readFileSync(resolve(__dirname,'joint_model_worker.js'),'utf8').replaceAll('\r\n','\n'),controller=api.validBundle.toString();
  const fields=/function publicFields\(item,path\)\{[\s\S]*?\n  \}/,keys=/const rawKeys=new Set\(\[[^\n]+/;
  assert.equal(worker.match(fields)?.[0],controller.match(fields)?.[0],'Runner optional quarantine uses exactly the final recursive public-field guard');
  assert.equal(worker.match(keys)?.[0],controller.match(keys)?.[0],'Known raw/cache private field names remain identical');
  assert.match(worker,/result\.samples!==samples/);assert.match(worker,/coherent\(bundle\.result,args\.samples\)/);assert.match(worker,/coherent\(result,3000\)/,'Optional runner result must retain its fixed3k sample budget');cases++;
 }
  {
   const html=readFileSync(resolve(__dirname,'../index.html'),'utf8').replaceAll('\r\n','\n');
   const body=html.slice(html.indexOf('function jointFallbackBundleValid('),html.indexOf('function jointPublicBundleValid(')).trim(),inline=vm.runInNewContext('('+body+')');
   const input=request('RAW_VIRGINIA_METADATA',{payload:{...request().payload,publicBasis:{fake:true},variants:[{id:'house_shadow',basis:{fake:true}}]}});
   for(const key of ['typed_usage','native_usage'])for(const place of ['result','baseline','diagnostics','publicResult','publicBaseline','publicDiagnostics','variant']){
    const candidate=bundle(1,true,['house_shadow']);
    const host={result:candidate.result,baseline:candidate.baseline,diagnostics:candidate.diagnostics,publicResult:candidate.publicComparison.result,publicBaseline:candidate.publicComparison.baseline,publicDiagnostics:candidate.publicComparison.diagnostics,variant:candidate.variants.house_shadow.result}[place];
    host.nested={[key]:{candidate_method_cells:[[1,2]],native_clocks:['FICTIONAL']}};
    for(const validate of [api.validBundle,inline])assert.equal(validate(candidate,input),false,'Virginia original-input metadata cannot escape through '+place+'/'+key);
   }
   for(const schema of ['validated-va02-native-usage-v1','already-admitted-va02-typed-usage-v2'])for(const place of ['result','baseline','diagnostics','publicResult','publicBaseline','publicDiagnostics','variant']){
    const candidate=bundle(1,true,['house_shadow']);
    const host={result:candidate.result,baseline:candidate.baseline,diagnostics:candidate.diagnostics,publicResult:candidate.publicComparison.result,publicBaseline:candidate.publicComparison.baseline,publicDiagnostics:candidate.publicComparison.diagnostics,variant:candidate.variants.house_shadow.result}[place];
    host.arbitrary_alias={schema,localities:[]};
    for(const validate of [api.validBundle,inline])assert.equal(validate(candidate,input),false,'Raw VA schema alias cannot escape through '+place);
   }
   cases++;
  }
 {
  const text=readFileSync(resolve(__dirname,'../index.html'),'utf8'),body=text.slice(text.indexOf('function jointFallbackBundleValid('),text.indexOf('function jointPublicBundleValid(')).trim(),inline=vm.runInNewContext('('+body+')');
  const input=request('RAW_COUNT_GUIDE',{payload:{...request().payload,publicBasis:{fake:true},variants:[{id:'house_shadow',basis:{fake:true}}]}});
  for(const place of ['result','baseline','diagnostics','publicResult','publicBaseline','publicDiagnostics','variant'])for(const form of ['private_key','schema_alias']){
   const candidate=bundle(1,true,['house_shadow']),host={result:candidate.result,baseline:candidate.baseline,diagnostics:candidate.diagnostics,publicResult:candidate.publicComparison.result,publicBaseline:candidate.publicComparison.baseline,publicDiagnostics:candidate.publicComparison.diagnostics,variant:candidate.variants.house_shadow.result}[place];
   const serializedGuide=JSON.parse(JSON.stringify({schema:'PROPOSAL_ONLY_MARGINAL_COUNT_GUIDE_V2',codes:['OH-SEN'],likelihoodPower:.5,evaluate(){}}));
   host.nested=form==='private_key'?{countProposalGuide:{codes:['OH-SEN'],likelihoodPower:.5}}:{unrelated_alias:serializedGuide};
   for(const validate of [api.validBundle,inline])assert.equal(validate(candidate,input),false,'Count guide '+form+' cannot escape through '+place);
  }
  const valid=bundle(1,true,['house_shadow']);valid.diagnostics.count_target={reference_normalizers_frozen:true,county_likelihood_applied_once:true};
  for(const validate of [api.validBundle,inline])assert.equal(validate(valid,input),true,'Existing public fixed-target metadata remains allowed');cases++;
 }
 console.log('Model worker controller PASS: '+cases+' synthetic lifecycle cases; latest-only queue, immutable input snapshot, single active worker, exact identity, stale-result/fallback rejection, correction/context/settings/hidden/archive handling and atomic public/variant results. No speed/calibration claim.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
