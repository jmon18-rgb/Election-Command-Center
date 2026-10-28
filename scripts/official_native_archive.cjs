'use strict';
// Exact already-received bodies only. This module never performs a source GET.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const wa=require('./washington_official_house_source.js'),remaining=require('./washington_remaining_source.js'),va=require('./virginia_official_house_source.js');
const sealed=require('./official_native_archive_crypto.cjs');
const REPO='jmon18-rgb/Election-Command-Center',END=Date.parse('2026-11-04T17:00:00Z');
const REQUIRED_FREE_BYTES=1818622848+16*1024*1024;
const SOURCES=Object.freeze({wa03:{start:Date.parse('2026-11-04T04:00:00Z'),requests:4,bytes:8388608,kinds:{counts:{url:wa.URL,limit:2097152},remaining:{url:remaining.URL,limit:1000000}}},va02:{start:Date.parse('2026-11-04T00:00:00Z'),requests:1,bytes:2500000,kinds:{counts:{url:va.URL,limit:2500000}}}});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const iso=t=>Number.isFinite(t)?new Date(t).toISOString():null;
const message=e=>String(e?.message||e).slice(0,240);
function headers(response){return Object.fromEntries(['content-type','cache-control','last-modified','date'].map(k=>[k,response?.headers?.get(k)?.slice(0,500)||null]));}
function completedAt(clock){try{return iso(clock());}catch{return null;}}
async function retain(sink,evidence){if(typeof sink!=='function')return;try{await sink(evidence);}catch(error){console.error('Original-body retention failed separately from source admission: '+message(error));}}
function eligibility({source,env=process.env,now=Date.now()}={}){
 const spec=SOURCES[source];
 if(!spec)return 'UNKNOWN_SOURCE';
 if(env.OFFICIAL_NATIVE_ARCHIVE_APPROVED!=='true')return 'CAPACITY_NOT_APPROVED';
 if(env.OFFICIAL_NATIVE_ARCHIVE_NO_PAID_STORAGE!=='true')return 'NO_PAID_STORAGE_NOT_VERIFIED';
 const free=Number(env.OFFICIAL_NATIVE_ARCHIVE_FREE_BYTES),at=Date.parse(env.OFFICIAL_NATIVE_ARCHIVE_CAPACITY_AT||'');
 if(!Number.isSafeInteger(free)||free<REQUIRED_FREE_BYTES)return 'INSUFFICIENT_VERIFIED_FREE_CAPACITY';
 if(!Number.isFinite(at)||at>now||now-at>24*60*60*1000)return 'CAPACITY_VERIFICATION_EXPIRED_OR_MISSING';
 if(env.GITHUB_REPOSITORY!==REPO||env.GITHUB_EVENT_NAME!=='schedule'||env.GITHUB_RUN_ATTEMPT!=='1'||!/^\d+$/.test(env.GITHUB_RUN_ID||''))return 'NOT_FIRST_SCHEDULED_ATTEMPT';
 if(!Number.isFinite(now)||now<spec.start||now>=END)return 'OUTSIDE_FIRST_NIGHT';
 return null;
}
function createArchive({source,root,runId,attempt='1',codeSha,workflowSha=codeSha,publicKey,clock=Date.now,onError=console.error}={}){
 const spec=SOURCES[source];
 if(!spec||!/^\d+$/.test(runId||'')||attempt!=='1'||!(/^[a-f0-9]{40}$/).test(codeSha||''))throw Error('Invalid archive job identity');
 const keyInfo=sealed.publicInfo(publicKey);
 const directory=path.resolve(root),state={schema:'official-native-first-night-archive-v1',repository:REPO,source,run_id:runId,run_attempt:attempt,code_sha:codeSha,workflow_sha:workflowSha,retention_days:30,cutoff_at:iso(END),encryption_key_fingerprint:keyInfo.fingerprint,requests:[],bodies:{},publisher_outcomes:[],capture_errors:[]};
 let initialized=false,sequence=0,total=0,activeReceipt=null;
 const warn=error=>{state.capture_errors.push(message(error));try{onError('Original-body retention failure; source admission unchanged: '+message(error));}catch{}};
 function init(){if(initialized)return;fs.mkdirSync(directory,{recursive:true});if(fs.existsSync(path.join(directory,'manifest.json')))throw Error('Archive directory already has a manifest');for(const d of ['bodies','requests','outcomes'])fs.mkdirSync(path.join(directory,d),{recursive:true});initialized=true;}
 function manifest(){fs.writeFileSync(path.join(directory,'manifest.json'),JSON.stringify(state,null,2)+'\n',{mode:0o600});}
 function write(relative,value){const destination=path.resolve(directory,relative);if(!destination.startsWith(directory+path.sep))throw Error('Archive path escaped fixed directory');fs.writeFileSync(destination,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});}
 function record(e){
  activeReceipt=null;
  const kind=spec.kinds[e.kind],start=Date.parse(e.request_started_at),complete=Date.parse(e.body_completed_at||''),failed=clock();
  if(!kind||e.source_url!==kind.url)throw Error('Unapproved native archive source');
  if(!Number.isFinite(start)||start<spec.start||start>=END)return;
  if(e.raw&&(!Number.isFinite(complete)||complete<start||complete>=END))return;
  if(!e.raw&&(!Number.isFinite(failed)||failed<start||failed>=END))return;
  if(sequence>=spec.requests)throw Error('Per-job archive request bound exceeded');
  init();sequence++;
  const receipt={schema:'official-native-request-receipt-v1',sequence,source_url:kind.url,kind:e.kind,request_started_at:e.request_started_at,body_completed_at:e.raw?e.body_completed_at:null,failed_at:e.raw?null:iso(failed),http_status:e.http_status??null,headers:e.headers,body_scope:'Exact bounded Fetch response Buffer, never JSON reserialized. Fetch content-encoding decoding can precede capture; not wire/TLS archival.',complete_body:false,body_path:null,original_response_sha256:null,body_bytes:null,collector_status:e.result.status,collector_error:e.result.error||null,collector_fetched_at:e.result.fetched_at,observed_source_stamp:e.result.observed_source_stamp||null,snapshot_updated_at:e.result.snapshot_updated_at||null,source_published_at:e.result.source_published_at||null,selected_payload_sha256:e.result.selected_payload_sha256||null,source_test_data:e.result.source_test_data??null,run_id:runId,run_attempt:attempt,code_sha:codeSha};
  if(e.raw){
   if(!Buffer.isBuffer(e.raw)||e.raw.length>kind.limit)throw Error('Complete raw body exceeds existing source bound');
   const digest=sha(e.raw);if(digest!==e.result.original_response_sha256)throw Error('Raw body hash differs from collector original hash');
   const relative='bodies/'+digest+'.enc',destination=path.join(directory,relative);
   if(!state.bodies[digest]){
    if(total+e.raw.length>spec.bytes)throw Error('Per-job raw storage bound exceeded');
    const encrypted=sealed.seal(e.raw,publicKey),cipherHash=sha(encrypted),partial=path.join(directory,'.partial-'+sequence);
    try{fs.writeFileSync(partial,encrypted,{flag:'wx',mode:0o600});if(sha(fs.readFileSync(partial))!==cipherHash)throw Error('Retained encrypted bytes failed readback');if(fs.existsSync(destination))throw Error('Unindexed archive body already exists');fs.renameSync(partial,destination);}finally{if(fs.existsSync(partial))fs.unlinkSync(partial);}
    state.bodies[digest]={path:relative,bytes:e.raw.length,sha256:digest,encrypted_bytes:encrypted.length,encrypted_sha256:cipherHash};total+=e.raw.length;
   }else if(sha(fs.readFileSync(destination))!==state.bodies[digest].encrypted_sha256)throw Error('Same-job deduplicated body failed integrity');
   Object.assign(receipt,{complete_body:true,body_path:relative,original_response_sha256:digest,body_bytes:e.raw.length});
  }
  const relative='requests/'+String(sequence).padStart(4,'0')+'-'+e.kind+'.json';write(relative,receipt);state.requests.push({sequence,path:relative});activeReceipt=sequence;manifest();
 }
 return {enabled:true,record:async e=>{try{record(e);}catch(error){warn(error);try{if(initialized)manifest();}catch{}}},publication:outcome=>{if(!initialized||activeReceipt===null)return;try{const value={receipt_sequence:activeReceipt,status:outcome.error?'ERROR':outcome.observe_only?'OBSERVE_ONLY':outcome.changed?'CHANGED':'UNCHANGED',branch:outcome.branch||null,commit:outcome.commit||null,error:outcome.error?message(outcome.error):null};const relative='outcomes/'+String(sequence).padStart(4,'0')+'.json';write(relative,value);state.publisher_outcomes.push({sequence,path:relative});manifest();}catch(error){warn(error);}},summary:()=>({requests:state.requests.length,unique_bodies:Object.keys(state.bodies).length,raw_bytes:total,errors:[...state.capture_errors]})};
}
function createForWorkflow({source,env=process.env,now=Date.now(),clock=Date.now,workspace=process.cwd(),codeSha}={}){
 const reason=eligibility({source,env,now});if(reason)return {enabled:false,reason,publication:()=>{}};
 try{
  codeSha??=require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:workspace,encoding:'utf8'}).trim();
  const publicKey=fs.readFileSync(path.join(workspace,'data/official_native_archive_public_key.pem'),'utf8');
  const sink=createArchive({source,root:path.join(workspace,'artifacts/readiness/official-native-'+source),runId:env.GITHUB_RUN_ID,attempt:env.GITHUB_RUN_ATTEMPT,codeSha,workflowSha:env.GITHUB_SHA,publicKey,clock});
  return {...sink,record:async evidence=>{const at=evidence.raw?Date.parse(evidence.body_completed_at||''):clock(),reason=eligibility({source,env,now:at});if(reason){console.error('Original-body capture excluded: '+reason);return;}await sink.record(evidence);}};
 }catch(error){console.error('Original-body archive disabled: '+message(error));return {enabled:false,reason:'ARCHIVE_INITIALIZATION_FAILED',publication:()=>{}};}
}
module.exports={REPO,END,REQUIRED_FREE_BYTES,SOURCES,headers,completedAt,retain,eligibility,createArchive,createForWorkflow};
