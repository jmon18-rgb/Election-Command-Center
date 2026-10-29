/* Latest-snapshot coordinator for the unchanged correlated model. Private
 * inputs/results stay in RAM; this module has no fetch, storage or logging. */
(function(root,factory){const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.JointModelWorkerController=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const PROTOCOL='joint-model-worker-v1',endingKeys=['blue_tsunami','blue_wave','shrug','red_dawn'];
 const safeText=value=>typeof value==='string'&&value.length>0;
 const safeTag=value=>typeof value==='string'&&/^[A-Z0-9_:-]{1,100}$/.test(value);
 const summary=(value,samples)=>Boolean(value&&typeof value==='object'&&value.samples===samples&&
  value.probabilities&&endingKeys.every(key=>Number.isFinite(value.probabilities[key])&&value.probabilities[key]>=0&&value.probabilities[key]<=100)&&
  Math.abs(endingKeys.reduce((sum,key)=>sum+value.probabilities[key],0)-100)<=.1&&
  !Object.hasOwn(value,'proposal_only')&&!Object.hasOwn(value,'call_log_weights')&&!Object.hasOwn(value,'county_draws'));
 function validBundle(value,request){
  const samples=request?.payload?.args?.samples;
  if(!Number.isInteger(samples)||samples<300||samples>30000||!value||typeof value!=='object'||
   !summary(value.result,samples)||!summary(value.baseline,samples)||!value.diagnostics||typeof value.diagnostics!=='object')return false;
  const expectedPublic=Boolean(request.payload.publicBasis);
  if(expectedPublic?!value.publicComparison:value.publicComparison!==null&&value.publicComparison!==undefined)return false;
  if(expectedPublic&&(!summary(value.publicComparison.result,samples)||!summary(value.publicComparison.baseline,samples)||
   !value.publicComparison.diagnostics||typeof value.publicComparison.diagnostics!=='object'))return false;
  if(value.variants!==undefined&&(value.variants===null||typeof value.variants!=='object'||Array.isArray(value.variants)))return false;
  if(JSON.stringify(Object.keys(value.variants||{}).sort())!==JSON.stringify((request.payload.variants||[]).map(row=>row.id).sort()))return false;
  // Existing open-only research variants retain their original fixed 3k draw
  // budget even when an offline caller chooses another primary sample count.
  for(const row of Object.values(value.variants||{}))if(!row||typeof row!=='object'||
   (row.result!==null&&!summary(row.result,3000))||(row.errorCode!==null&&!safeTag(row.errorCode)))return false;
  return true;
 }
 function create({workerFactory=null,timeoutMs=null,clone=typeof structuredClone==='function'?structuredClone:null,
  schedule=callback=>queueMicrotask(callback),setTimer=(callback,delay)=>setTimeout(callback,delay),clearTimer=timer=>clearTimeout(timer),
  validateResult=validBundle,enabled=true}={}){
  if(timeoutMs!==null&&(!Number.isFinite(timeoutMs)||timeoutMs<=0))throw Error('A worker deadline must be a positive explicit duration');
  if(typeof schedule!=='function'||typeof setTimer!=='function'||typeof clearTimer!=='function'||typeof validateResult!=='function')throw Error('Invalid worker coordinator dependencies');
  let epoch=0,sequence=0,current=null,queued=null,ownedWorker=null,timer=null,disposed=false;
  const tickets=new WeakMap(),idleWaiters=new Set();
  const idle=()=>!queued&&!ownedWorker&&(!current||['READY','ADMITTED','CANCELLED','UNAVAILABLE'].includes(current.state));
  const signalIdle=()=>{if(!idle())return;for(const resolve of idleWaiters)resolve();idleWaiters.clear();};
  const metadata=job=>({protocol:PROTOCOL,requestId:job.requestId,epoch:job.epoch,signature:job.signature,
   contextKey:job.contextKey,modelRevision:job.modelRevision,frameKind:job.frameKind});
  const currentJob=job=>!disposed&&enabled&&current===job&&job.epoch===epoch;
  const clearDeadline=()=>{if(timer!==null){clearTimer(timer);timer=null;}};
  function releaseWorker(){
   clearDeadline();const worker=ownedWorker;ownedWorker=null;
   if(worker){try{worker.onmessage=null;worker.onerror=null;worker.onmessageerror=null;}catch{}
    try{worker.terminate();}catch{}}
  }
  function settle(job,decision){
   if(job.settled)return;job.settled=true;job.resolve(decision);
  }
  function cancelJob(job,reason,notify=true){
   if(!job)return;job.payload=null;job.state='CANCELLED';
   settle(job,{status:'CANCELLED',reason:safeTag(reason)?reason:'CANCELLED'});if(notify)signalIdle();
  }
  function fallback(job,reason){
   if(!currentJob(job))return;releaseWorker();queued=null;job.state='FALLBACK_REQUIRED';
   settle(job,{status:'SYNC_FALLBACK_REQUIRED',reason,ticket:job.ticket});
  }
  function exactIdentity(message,job){return message&&message.protocol===PROTOCOL&&
   ['requestId','epoch','signature','contextKey','modelRevision','frameKind'].every(key=>message[key]===job[key]);}
  function unavailable(job,reason){
   job.payload=null;job.state='UNAVAILABLE';const decision={status:'UNAVAILABLE',reason,ticket:job.ticket};job.promise=Promise.resolve(decision);signalIdle();return decision;
  }
  function start(job){
   if(queued!==job||!currentJob(job))return;queued=null;job.state='RUNNING';
   if(typeof workerFactory!=='function'){fallback(job,'WORKER_UNAVAILABLE');return;}
   let worker;
   try{worker=workerFactory();}catch{fallback(job,'WORKER_CONSTRUCTION_FAILED');return;}
   if(!worker||typeof worker.postMessage!=='function'||typeof worker.terminate!=='function'){
    try{worker?.terminate?.();}catch{}fallback(job,'WORKER_UNAVAILABLE');return;
   }
   ownedWorker=worker;
   worker.onmessage=event=>{
    // Even a retained callback from an already terminated worker is inert.
    if(ownedWorker!==worker||!currentJob(job)||job.state!=='RUNNING')return;
    const message=event?.data;
    if(message?.protocol===PROTOCOL&&message.type==='READY'){
     if(message.modelRevision!==job.modelRevision)fallback(job,'WORKER_REVISION_MISMATCH');
     else if(message.available===false)fallback(job,'WORKER_STATIC_MODEL_UNAVAILABLE');return;
    }
    if(!exactIdentity(message,job)){fallback(job,'WORKER_IDENTITY_MISMATCH');return;}
    if(message.type==='ERROR'){fallback(job,'WORKER_MODEL_ERROR');return;}
    if(message.type!=='RESULT'){fallback(job,'WORKER_PROTOCOL_ERROR');return;}
    let valid=false;try{valid=validateResult(message.payload,{...metadata(job),payload:job.payload})===true;}catch{}
    if(!valid){fallback(job,'INVALID_WORKER_MODEL_RESULT');return;}
    releaseWorker();job.state='READY';job.payload=null;
    settle(job,{status:'READY',source:'WORKER',ticket:job.ticket,payload:message.payload});signalIdle();
   };
   worker.onerror=()=>{if(ownedWorker===worker&&currentJob(job))fallback(job,'WORKER_RUNTIME_ERROR');};
   worker.onmessageerror=()=>{if(ownedWorker===worker&&currentJob(job))fallback(job,'WORKER_MESSAGE_ERROR');};
   if(timeoutMs!==null)timer=setTimer(()=>{if(ownedWorker===worker&&currentJob(job))fallback(job,'WORKER_TIMEOUT');},timeoutMs);
   try{worker.postMessage({...metadata(job),type:'RUN',payload:job.payload});}
   catch{fallback(job,'WORKER_POST_MESSAGE_FAILED');}
  }
  function cancel(reason='CANCELLED',notify=true){
   epoch++;releaseWorker();queued=null;const old=current;current=null;cancelJob(old,reason,notify);if(notify)signalIdle();
  }
  function submit(request){
   if(disposed||!enabled)return Promise.resolve({status:'SKIPPED',reason:disposed?'DISPOSED':'DISABLED'});
   if(!request||!safeText(request.signature)||!safeText(request.modelRevision)||!safeTag(request.contextKey)||!safeTag(request.frameKind)||
    !request.payload||typeof request.payload!=='object'){cancel('INVALID_REQUEST');return Promise.resolve({status:'REJECTED',reason:'INVALID_REQUEST_METADATA'});}
   if(!request.force&&current&&['QUEUED','RUNNING','READY','ADMITTED','FALLBACK_REQUIRED'].includes(current.state)&&
    ['signature','contextKey','modelRevision','frameKind'].every(key=>request[key]===current[key]))return current.promise;
   cancel('SUPERSEDED',false);
   let payload;try{if(typeof clone!=='function')throw Error();payload=clone(request.payload);}catch{signalIdle();return Promise.resolve({status:'REJECTED',reason:'MODEL_INPUT_SNAPSHOT_FAILED'});}
   const job={...Object.fromEntries(['signature','contextKey','modelRevision','frameKind'].map(key=>[key,request[key]])),
    requestId:++sequence,epoch,payload,state:'QUEUED',settled:false};
   job.promise=new Promise(resolve=>{job.resolve=resolve;});
   job.ticket=Object.freeze(metadata(job));tickets.set(job.ticket,job);current=job;queued=job;
   try{schedule(()=>start(job));}catch{queued=null;fallback(job,'WORKER_SCHEDULING_FAILED');}
   return job.promise;
  }
  function isCurrent(ticket){const job=ticket&&tickets.get(ticket);return Boolean(job&&currentJob(job)&&
   ['RUNNING','QUEUED','READY','ADMITTED','FALLBACK_REQUIRED'].includes(job.state));}
  function runSynchronousFallback(ticket,compute){
   const job=ticket&&tickets.get(ticket);
   if(!job||!currentJob(job)||job.state!=='FALLBACK_REQUIRED')return {status:'CANCELLED',reason:'STALE_FALLBACK'};
   if(typeof compute!=='function')return unavailable(job,'SYNCHRONOUS_RUNNER_UNAVAILABLE');
   let payload;
   try{payload=compute(job.payload);}
   catch{return currentJob(job)?unavailable(job,'SYNCHRONOUS_MODEL_FAILED'):{status:'CANCELLED',reason:'STALE_FALLBACK'};}
   if(!currentJob(job))return {status:'CANCELLED',reason:'STALE_FALLBACK'};
   if(payload&&typeof payload.then==='function')return unavailable(job,'ASYNCHRONOUS_FALLBACK_NOT_ALLOWED');
   let valid=false;try{valid=validateResult(payload,{...metadata(job),payload:job.payload})===true;}catch{}
   if(!valid)return unavailable(job,'INVALID_SYNCHRONOUS_MODEL_RESULT');
   job.state='READY';job.payload=null;const decision={status:'READY',source:'SYNCHRONOUS_FALLBACK',ticket:job.ticket,payload};job.promise=Promise.resolve(decision);signalIdle();return decision;
  }
  function admit(ticket){
   const job=ticket&&tickets.get(ticket);if(!job||!currentJob(job)||job.state!=='READY')return false;
   job.state='ADMITTED';signalIdle();return true;
  }
  return Object.freeze({submit,cancel,isCurrent,runSynchronousFallback,admit,
   withhold(ticket,reason='MODEL_UPDATE_WITHHELD'){
    const job=ticket&&tickets.get(ticket);if(!job||!currentJob(job)||job.state!=='FALLBACK_REQUIRED')return {status:'CANCELLED',reason:'STALE_WITHHOLD'};
    return unavailable(job,safeTag(reason)?reason:'MODEL_UPDATE_WITHHELD');
   },
   whenIdle(){return idle()?Promise.resolve():new Promise(resolve=>idleWaiters.add(resolve));},
   setEnabled(value,reason='DISABLED'){const next=Boolean(value);if(!next){enabled=false;cancel(reason);}else if(!disposed)enabled=true;},
   dispose(){if(disposed)return;cancel('DISPOSED');disposed=true;enabled=false;},
   state(){return Object.freeze({enabled,disposed,epoch,active:Boolean(ownedWorker),queued:Boolean(queued),status:current?.state||'IDLE'});}});
 }
 return Object.freeze({PROTOCOL,create,validBundle});
});
