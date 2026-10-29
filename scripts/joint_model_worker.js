/* Same-origin computation worker. Model sources are imported unchanged. Private
 * basis values exist only in this worker/request RAM, never logs or storage. */
(function(){
 'use strict';
 const PROTOCOL='joint-model-worker-v1';
 const IMPORTS=Object.freeze(([{"name":"election_night_poll_closings_2026","stamp":"39c725fe013b"},{"name":"washington_remaining_source","stamp":"9db3bb46dde1"},{"name":"washington_remaining_scenarios","stamp":"1a313f060a7e"},{"name":"source_call_conditioning","stamp":"26c1be0c0e7a"},{"name":"chamber_control_model","stamp":"d98ce3f4cdf1"},{"name":"national_county_likelihood","stamp":"3a42f78b20e5"}]).map(Object.freeze));
 const MODEL_REVISION="./scripts/source_call_conditioning.js?v=26c1be0c0e7a|./scripts/chamber_control_model.js?v=d98ce3f4cdf1|./scripts/national_county_likelihood.js?v=3a42f78b20e5";
 const ERROR_CODES=Object.freeze(['INVALID_REQUEST','STATIC_MODEL_UNAVAILABLE','MODEL_COMPUTATION_FAILED','INVALID_MODEL_RESULT']);
 const VARIANT_IDS=Object.freeze(['house_shadow','presidential_shadow','correlation_moderate','correlation_lower']);
 const FRAME_KINDS=Object.freeze(['LIVE','POLLING_ARCHIVE_BASELINE','REHEARSAL']);
 const ARG_KEYS=new Set(['samples','seed','now','independentSenateCredit','contextKey','marginSummaryCodes','nationalShift',
  'errorMultiplier','live','rehearsal','explainControl','voteSeatWeights','senateCorrelationResearch']);
 const mainDocument=typeof document!=='undefined'&&typeof window!=='undefined'&&self===window;
 let available=false;
 try{if(!mainDocument){
  // Several unchanged pure helpers publish their UMD API to `window`. Provide
  // that alias only while loading exact static assets; this is still a worker.
  self.window=self;
  for(const asset of IMPORTS){
   const url=new URL('./'+asset.name+'.js?v='+asset.stamp,self.location.href);
   if(url.origin!==self.location.origin||!['http:','https:'].includes(url.protocol))throw Error('STATIC_MODEL_UNAVAILABLE');
   importScripts(url.href);
  }
  delete self.window;}
  // On MAIN the existing math owns optional-helper withholding. A missing
  // proposal helper must not disable an otherwise usable polling/count model.
  // A failed Worker import still reaches catch and marks the worker unavailable.
  available=Boolean(self.ChamberControlModel&&self.NationalCountyLikelihood);
 }catch{try{delete self.window;}catch{}available=false;}
 const plain=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
 const finite=value=>typeof value==='number'&&Number.isFinite(value);
 function identity(message){
  const text=(value,maximum)=>typeof value==='string'&&value.length<=maximum?value:null;
  return {protocol:PROTOCOL,requestId:Number.isSafeInteger(message?.requestId)&&message.requestId>0?message.requestId:null,epoch:Number.isSafeInteger(message?.epoch)?message.epoch:null,
   signature:text(message?.signature,1000000),contextKey:text(message?.contextKey,128),modelRevision:text(message?.modelRevision,4096),frameKind:text(message?.frameKind,128)};
 }
 function valid(message){
  const p=message?.payload,a=p?.args;
  if(!plain(message)||message.protocol!==PROTOCOL||message.type!=='RUN'||
    !Number.isSafeInteger(message.requestId)||message.requestId<=0||
    !Number.isSafeInteger(message.epoch)||message.epoch<0||typeof message.signature!=='string'||!message.signature||message.signature.length>1000000||
    typeof message.contextKey!=='string'||!message.contextKey||message.contextKey.length>128||message.modelRevision!==MODEL_REVISION||
    !FRAME_KINDS.includes(message.frameKind)||!plain(p)||!plain(p.basis)||!Array.isArray(p.envelopes)||p.envelopes.length>18||
    !plain(a)||Object.keys(a).some(key=>!ARG_KEYS.has(key))||a.contextKey!==message.contextKey||a.independentSenateCredit!=='no_credit'||
    !Number.isInteger(a.samples)||a.samples<300||a.samples>30000||!Number.isInteger(a.seed)||a.seed<0||a.seed>4294967295||!finite(a.now)||
    a.live!==undefined&&!plain(a.live)||p.publicBasis!==undefined&&p.publicBasis!==null&&!plain(p.publicBasis))return false;
  if(message.frameKind==='POLLING_ARCHIVE_BASELINE'&&(Object.keys(a.live||{}).length||p.envelopes.length||a.rehearsal===true))return false;
  if(message.frameKind==='REHEARSAL'&&(a.rehearsal!==true||Object.keys(a.live||{}).length))return false;
  const variants=p.variants??[];
  if(!Array.isArray(variants)||variants.length>4||new Set(variants.map(item=>item?.id)).size!==variants.length||
     variants.some(item=>!plain(item)||!VARIANT_IDS.includes(item.id)||Object.keys(item).some(key=>!['id','basis'].includes(key))))return false;
  return true;
 }
 function coherent(result,samples){
  if(!plain(result)||result.samples!==samples||result.schema_version!==self.ChamberControlModel.VERSION||result.status!=='EXPERIMENTAL_UNCALIBRATED'||
     result.senate_independent_credit_mode!=='no_credit'||!plain(result.probabilities)||!Array.isArray(result.race_probabilities))return false;
  const probabilities=['blue_tsunami','blue_wave','shrug','red_dawn'].map(key=>result.probabilities[key]);
  if(probabilities.some(value=>!finite(value)||value<0||value>100)||Math.abs(probabilities.reduce((sum,value)=>sum+value,0)-100)>.05)return false;
  // Keep optional-result quarantine at least as strict as final admission:
  // malformed research output cannot discard an otherwise valid primary.
  const rawKeys=new Set(['proposal_only','county_draws','call_proposal_draws','call_log_weights','log_weights','seeds','source_indices','weights','fingerprint','basis','publicBasis','localNormals','redrawMargins','redrawUniforms','transport_margins','transportCache','transportCacheChecksum']);
  function publicFields(item,path){
   if(item===null||item===undefined||typeof item==='string'||typeof item==='boolean')return true;
   if(typeof item==='number')return Number.isFinite(item);
   if(typeof item!=='object'||ArrayBuffer.isView(item))return false;
   const tag=Object.prototype.toString.call(item);
   if(!['[object Object]','[object Array]'].includes(tag)||path.has(item))return false;
   path.add(item);
   try{return Object.entries(item).every(([key,child])=>!rawKeys.has(key)&&publicFields(child,path));}
   finally{path.delete(item);} // Acyclic result/baseline aliases are legitimate.
  }
  try{return publicFields(result,new WeakSet());}catch{return false;}
 }
 function compute(basis,envelopes,args){
  const bundle=self.NationalCountyLikelihood.condition(self.ChamberControlModel,basis,envelopes,args);
  if(!plain(bundle)||!coherent(bundle.result,args.samples)||!coherent(bundle.baseline,args.samples)||!plain(bundle.diagnostics))throw Error('INVALID_MODEL_RESULT');
  return {result:bundle.result,baseline:bundle.baseline,diagnostics:bundle.diagnostics};
 }
 function variantsFor(request,primary){
  const p=request.payload,a=p.args,output={};
  for(const variant of p.variants||[]){
   const correlation=variant.id.startsWith('correlation_');
   if(correlation&&Object.keys(a.live||{}).length){output[variant.id]={result:null,errorCode:'VARIANT_DISABLED_BY_LIVE_CALLS'};continue;}
   if(correlation&&(primary.diagnostics.used||[]).length){output[variant.id]={result:null,errorCode:'VARIANT_DISABLED_BY_COUNTY_RETURNS'};continue;}
   if(!correlation&&!plain(variant.basis)){output[variant.id]={result:null,errorCode:'OPTIONAL_VARIANT_UNAVAILABLE'};continue;}
   try{
    const options={samples:3000,seed:20261103,independentSenateCredit:'no_credit',nationalShift:a.nationalShift??0,errorMultiplier:a.errorMultiplier??1};
    if(correlation)options.senateCorrelationResearch=variant.id==='correlation_moderate'?{nationalScale:.8,chamberScale:.65}:{nationalScale:.65,chamberScale:.55};
    else options.live=a.live||{};
    const result=self.ChamberControlModel.simulate(correlation?p.basis:variant.basis,options);
    output[variant.id]=coherent(result,3000)?{result,errorCode:null}:{result:null,errorCode:'OPTIONAL_VARIANT_UNAVAILABLE'};
   }catch{output[variant.id]={result:null,errorCode:'OPTIONAL_VARIANT_UNAVAILABLE'};}
  }
  return output;
 }
 function runRequest(request){
  if(!valid(request))throw Error('INVALID_REQUEST');
  if(!available)throw Error('STATIC_MODEL_UNAVAILABLE');
  // No result is returned until primary AND optional public comparison finish.
  // This prevents mixing a private forecast with a previous public baseline.
  const p=request.payload,primary=compute(p.basis,p.envelopes,p.args);
  const publicComparison=p.publicBasis?compute(p.publicBasis,p.envelopes,{...p.args,contextKey:'PUBLIC'}):null;
  return {...primary,publicComparison,variants:variantsFor(request,primary)};
 }
 // Safe as a normal MAIN script: register a pure synchronous fallback API,
 // without imports, message handlers or postMessage calls on the page.
 self.JointModelWorkerRunner=Object.freeze({PROTOCOL,MODEL_REVISION,IMPORTS,VARIANT_IDS,FRAME_KINDS,
  run(payload,{contextKey=payload?.args?.contextKey,frameKind='LIVE'}={}){
   try{return runRequest({protocol:PROTOCOL,type:'RUN',requestId:1,epoch:0,signature:'SYNCHRONOUS_SAME_RUNNER',contextKey,
    modelRevision:MODEL_REVISION,frameKind,payload});}
   catch(error){throw Error(ERROR_CODES.includes(error?.message)?error.message:'MODEL_COMPUTATION_FAILED');}
  }});
 if(mainDocument)return;
 self.onmessage=event=>{
  const request=event.data,id=identity(request);
  if(!valid(request)){self.postMessage({...id,type:'ERROR',error:{code:'INVALID_REQUEST',recoverable:true}});return;}
  if(!available){self.postMessage({...id,type:'ERROR',error:{code:'STATIC_MODEL_UNAVAILABLE',recoverable:true}});return;}
  try{
   self.postMessage({...id,type:'RESULT',payload:runRequest(request)});
  }catch(error){
   const code=ERROR_CODES.includes(error?.message)?error.message:'MODEL_COMPUTATION_FAILED';
   self.postMessage({...id,type:'ERROR',error:{code,recoverable:true}});
  }
 };
 self.postMessage({protocol:PROTOCOL,type:'READY',modelRevision:MODEL_REVISION,available,
  ...(available?{}:{errorCode:'STATIC_MODEL_UNAVAILABLE'})});
})();
