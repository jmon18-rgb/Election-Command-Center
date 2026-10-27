/* Bounded browser-local receipt audit. Evidence, not a vote feed or calibration. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.OfficialAdmissionAudit=api;})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const KEY='bluewaves_official_admissions_v1',MAX_EVENTS=120,MAX_BYTES=150000,WINDOW=72*60*60*1000;
 const CODES=['WA-03','VA-02'],hash=x=>/^[a-f0-9]{64}$/.test(x||''),iso=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&/(?:Z|[+-]\d\d:\d\d)$/.test(x);
 const headers=['source_snapshot_at','source_published_at','collection_fetched_at','selected_payload_sha256','original_response_sha256','original_hash_recomputed','model_revision','remaining_selected_payload_sha256','remaining_fetched_at','model_context','source_url','transport_url','model_version','polling_lineage_at','kernel_revision','audit_provenance_status'];
 function create({storage,now=()=>Date.now()}={}){
  let events=[],states={};
  const stamp=()=>new Date(now()).toISOString();
  const nullableTime=x=>x===null||iso(x),nullableHash=x=>x===null||hash(x);
  const valid=e=>e&&CODES.includes(e.code)&&['ADMITTED','REVISION','CORRECTION','SUPPLEMENT_CHANGE','MODEL_REEVALUATION','WITHDRAWN','INACTIVE','RECOVERED','AUDIT_METADATA_UNAVAILABLE','AUDIT_METADATA_RECOVERED'].includes(e.kind)&&iso(e.observed_at)&&nullableTime(e.source_at)&&nullableTime(e.receipt_at)&&nullableHash(e.selected_hash)&&['VERIFIED_SELECTED_PAYLOAD','PREVIOUS_ADMISSION_ONLY','UNAVAILABLE'].includes(e.provenance_status)&&typeof e.model_revision==='string'&&e.model_revision.length<=600;
  try{const raw=storage?.getItem(KEY);if(raw&&raw.length<=MAX_BYTES){const d=JSON.parse(raw);if(d.schema===1&&Array.isArray(d.events)&&d.events.length<=MAX_EVENTS&&d.events.every(valid))events=d.events.filter(e=>now()-Date.parse(e.observed_at)<=WINDOW&&Date.parse(e.observed_at)<=now()+60000);}}
  catch{} // Exported history is local evidence only; never restore active inputs.
  function save(){try{const text=JSON.stringify({schema:1,events});if(text.length<=MAX_BYTES)storage?.setItem(KEY,text);}catch{}}
  function prune(){const before=events.length,time=now();events=events.filter(e=>time-Date.parse(e.observed_at)<=WINDOW&&Date.parse(e.observed_at)<=time+60000);if(events.length!==before)save();}
  prune();
  function append(e){events.unshift(e);events=events.slice(0,MAX_EVENTS);while(events.length&&JSON.stringify({schema:1,events}).length>MAX_BYTES)events.pop();save();}
  function observe({active,simulated=false,envelopes=[],used=[],modelRevision,modelVersion,pollingAt,kernelRevision,modelContext='PUBLIC',reason='NO_LONGER_ADMITTED'}={}){
   prune();
   const time=now();if(simulated||time<Date.parse('2026-11-03T05:00:00Z')||typeof modelRevision!=='string'||modelRevision.length>600)return false;
   if(!Array.isArray(envelopes)||!Array.isArray(used))return false;
   if(envelopes.some(e=>e?.rehearsal===true))return false;
   const admitted=new Map(),usedCodes=new Set(active?used.filter(x=>CODES.includes(x.code)).map(x=>x.code):[]);
   const lineageOk=typeof modelVersion==='string'&&modelVersion.length>0&&modelVersion.length<=100&&iso(pollingAt)&&/^\.\/scripts\/national_county_likelihood\.js\?v=[a-f0-9]{12}$/.test(kernelRevision||'');
   if(active)for(const decision of used){
    if(!CODES.includes(decision.code))continue;
    const e=envelopes.find(x=>x?.snapshot?.race_code===decision.code),s=e?.snapshot;
    if(!lineageOk||!s||e.rehearsal||s.live_votes_accepted!==true||s.status!=='VALIDATED_COUNTY_COUNTS_METHOD_MIX_UNRESOLVED'||s.collection_payload_integrity_verified!==true||!hash(s.collection_selected_payload_sha256)||!iso(s.snapshot_updated_at)||!iso(s.collection_fetched_at)||!iso(s.source_published_at)||!Array.isArray(s.counties)||s.counties.length>8)continue;
    const rows=s.counties.map(c=>({fips:c.county_fips,d:c.dem_votes,r:c.rep_votes}));
    if(rows.some(c=>!/^\d{5}$/.test(c.fips)||![c.d,c.r].every(x=>Number.isSafeInteger(x)&&x>=0)))continue;
    const total=rows.reduce((n,c)=>n+c.d+c.r,0);if(total<=0)continue;
    const supplement=decision.official_remaining_sensitivity?s.official_remaining:null;
    const current={code:decision.code,source_at:s.snapshot_updated_at,published_at:s.source_published_at,receipt_at:s.collection_fetched_at,
     selected_hash:s.collection_selected_payload_sha256,original_hash:hash(s.collection_original_response_sha256)?s.collection_original_response_sha256:null,
     original_hash_recomputed:false,remaining_hash:hash(supplement?.selected_payload_sha256)?supplement.selected_payload_sha256:null,
     remaining_receipt_at:iso(supplement?.fetched_at)?supplement.fetched_at:null,total,rows,source_url:s.source_url||'',transport_url:s.transport_url||'',model_revision:modelRevision,model_version:modelVersion,polling_at:pollingAt,kernel_revision:kernelRevision,provenance_status:'VERIFIED_SELECTED_PAYLOAD',model_context:modelContext==='PUBLIC'?'PUBLIC':'LOCAL_RESEARCH_VARIANT'};
    admitted.set(current.code,current);
   }
   for(const code of CODES){
    const old=states[code],current=admitted.get(code);
    if(!current&&usedCodes.has(code)){
     if(!old?.audit_missing){const previous=old?.selected_hash?old:{code,source_at:null,published_at:null,receipt_at:null,selected_hash:null,original_hash:null,original_hash_recomputed:false,remaining_hash:null,remaining_receipt_at:null,total:null,rows:[],model_context:modelContext==='PUBLIC'?'PUBLIC':'LOCAL_RESEARCH_VARIANT'};
      append({...previous,rows:undefined,active:undefined,audit_missing:undefined,kind:'AUDIT_METADATA_UNAVAILABLE',observed_at:stamp(),before:previous.total,after:null,model_revision:modelRevision,model_version:modelVersion||null,polling_at:iso(pollingAt)?pollingAt:null,kernel_revision:kernelRevision||null,model_context:modelContext==='PUBLIC'?'PUBLIC':'LOCAL_RESEARCH_VARIANT',provenance_status:old?.selected_hash?'PREVIOUS_ADMISSION_ONLY':'UNAVAILABLE',reason:'MODEL_STILL_ADMITTED_PROVENANCE_UNAVAILABLE'});
      states[code]={...previous,model_revision:modelRevision,provenance_status:old?.selected_hash?'PREVIOUS_ADMISSION_ONLY':'UNAVAILABLE',active:true,audit_missing:true};
     }
     continue; // Missing logging metadata is not a model/source withdrawal.
    }
    if(!current){if(old?.active){append({...old,rows:undefined,active:undefined,kind:active?'WITHDRAWN':'INACTIVE',observed_at:stamp(),before:old.total,after:null,
     model_revision:modelRevision,model_version:modelVersion||null,polling_at:iso(pollingAt)?pollingAt:null,kernel_revision:kernelRevision||null,
     model_context:modelContext==='PUBLIC'?'PUBLIC':'LOCAL_RESEARCH_VARIANT',reason:active?reason:'LEFT_LIVE_MODE'});states[code]={...old,active:false};}continue;}
    const signature=x=>[x.selected_hash,x.remaining_hash,x.model_revision,x.model_context].join('|');
    if(old?.active&&!old.audit_missing&&signature(old)===signature(current))continue; // Refreshes do not invent new batches.
    const correction=old&&current.rows.some(c=>{const p=old.rows.find(p=>p.fips===c.fips);return p&&(c.d<p.d||c.r<p.r);});
    const kind=!old?'ADMITTED':!old.active?'RECOVERED':old.audit_missing?'AUDIT_METADATA_RECOVERED':correction?'CORRECTION':old.selected_hash!==current.selected_hash?'REVISION':old.remaining_hash!==current.remaining_hash?'SUPPLEMENT_CHANGE':'MODEL_REEVALUATION';
    append({...current,rows:undefined,kind,candidate_votes_revised:Boolean(correction),observed_at:stamp(),before:old?.active?old.total:null,after:current.total,reason:'USED_BY_LIVE_NATIONAL_MODEL'});
    states[code]={...current,active:true};
   }
   return true;
  }
  function csvRows(){prune();return events.map(e=>[e.code==='WA-03'?'Washington official national input':'Virginia official national input',2026,'House',e.code,e.observed_at,e.kind,e.before??'',e.after??'',e.after===null||e.before===null?'':e.after-e.before,'',e.candidate_votes_revised||e.kind==='CORRECTION'?'YES':'',
   'Browser-observed model decision; provenance '+e.provenance_status+'; original hash is collector claim only; '+e.reason,e.source_at||'',e.published_at||'',e.receipt_at||'',e.selected_hash||'',e.original_hash||'','NO',e.model_revision,e.remaining_hash||'',e.remaining_receipt_at||'',e.model_context,e.source_url||'',e.transport_url||'',e.model_version||'',e.polling_at||'',e.kernel_revision||'',e.provenance_status]);}
  return Object.freeze({observe,csvRows,events:()=>{prune();return events.map(e=>({...e}));}});
 }
 return Object.freeze({create,headers,KEY,MAX_EVENTS,MAX_BYTES});
});
