'use strict';
// Bounded server-side source collection. No publisher, schedule or national input is enabled by this module.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('./washington_official_house_source.js');
const remaining=require('./washington_remaining_source.js');
const archive=require('./official_native_archive.cjs');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const MAX_BODY=2*1024*1024;
async function body(response,limit=MAX_BODY){
 if(!response.body)throw Error('Missing official response body');
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{while(true){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;
  if(size>limit)throw Error('Official response exceeds bounded body limit');chunks.push(Buffer.from(next.value));}}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 return Buffer.concat(chunks);
}
async function collect({fetchImpl=global.fetch,now=Date.now(),reference,evidenceSink,clock=Date.now}={}){
 if(!Number.isFinite(now))throw Error('Invalid collector clock');
 const out={schema:'official-wa03-collection-v1',source_url:api.URL,fetched_at:new Date(now).toISOString(),
  status:'SOURCE_UNAVAILABLE',payload:null,may_move_national_needle:false,
  timing_scope:'request-to-body only, not source availability or comparative publication lag'};
 const started=performance.now();let response=null,raw=null,completed=null;
 try{
  const r=response=await fetchImpl(api.URL,{signal:AbortSignal.timeout(20000),headers:{Accept:'application/json'}});
  out.http_status=r.status;out.cache_control=r.headers.get('cache-control');
  if(r.status!==200||!r.headers.get('content-type')?.toLowerCase().includes('application/json')){
   await r.body?.cancel().catch(()=>{});throw Error('Official HTTP/content type unavailable');
  }
  raw=await body(r);completed=archive.completedAt(clock);out.request_to_body_ms=Math.round(performance.now()-started);out.original_response_sha256=hash(raw);
  const original=JSON.parse(raw.toString('utf8'));
  out.observed_source_stamp=original?.election?.asOf||null;
  out.source_test_data=original?.election?.isProduction!==true;
  out.observed_positive_candidate_counts=original?.ballotItemWithBreakdown?.summaryResults?.ballotOptions?.some(c=>Number.isSafeInteger(c.voteCount)&&c.voteCount>0)??null;
  const parsed=api.parse(original,reference,{now});
  out.status=parsed.status;out.snapshot_updated_at=parsed.snapshot_updated_at;out.source_published_at=parsed.source_published_at;
  // Select original objects; never alter candidate votes, IDs or source clocks.
  const e=original.election;
  const payload={jurisdiction:{shortName:original.jurisdiction.shortName},
   election:Object.fromEntries(['id','name','electionDate','isPrimary','isProduction','isOfficialResults','asOf','publishDate'].map(k=>[k,e[k]])),
   ballotItems:original.ballotItems.filter(x=>x.id===original.ballotItemWithBreakdown.id),
   ballotItemWithBreakdown:original.ballotItemWithBreakdown};
  const selected=api.parse(payload,reference,{now});
  if(JSON.stringify(selected)!==JSON.stringify(parsed))throw Error('Selected source objects failed independent reparse');
  out.payload=payload;out.selected_payload_sha256=hash(JSON.stringify(payload));
  out.selection_scope='Original official contest objects; unrelated races omitted, no vote transformation';
  return out;
 }catch(error){out.status='SOURCE_UNAVAILABLE';out.payload=null;out.error=String(error.message).slice(0,240);return out;}finally{await archive.retain(evidenceSink,{kind:'counts',source_url:api.URL,request_started_at:out.fetched_at,body_completed_at:completed,http_status:out.http_status??null,headers:archive.headers(response),raw,result:out});}
}
async function collectRemaining({fetchImpl=global.fetch,now=Date.now(),countsStamp,evidenceSink,clock=Date.now}={}){
 const out={schema:'official-wa-remaining-collection-v1',source_url:remaining.URL,fetched_at:new Date(now).toISOString(),status:'SOURCE_UNAVAILABLE',payload:null,timing_scope:'Request-to-body only; not publication availability or comparative lag'};
 const started=performance.now();let response=null,raw=null,completed=null;
 try{
  const r=response=await fetchImpl(remaining.URL,{redirect:'error',signal:AbortSignal.timeout(20000),headers:{Accept:'application/json'}});out.http_status=r.status;out.cache_control=r.headers.get('cache-control');
  if(r.status!==200||!r.headers.get('content-type')?.toLowerCase().includes('application/json')){await r.body?.cancel().catch(()=>{});throw Error('Remaining HTTP/content type unavailable');}
  raw=await body(r,1000000);completed=archive.completedAt(clock);out.request_to_body_ms=Math.round(performance.now()-started);out.original_response_sha256=hash(raw);out.payload=JSON.parse(raw.toString('utf8'));out.status='COLLECTED_OFFICIAL_ESTIMATES';
  remaining.parse(out,{now,counts_stamp:countsStamp});if(JSON.stringify(out.payload).length>48000)throw Error('Remaining selected body cap');out.selected_payload_sha256=hash(JSON.stringify(out.payload));
 }catch(error){out.status='SOURCE_UNAVAILABLE';out.payload=null;out.error=String(error.message).slice(0,240);}
 try{return out;}finally{await archive.retain(evidenceSink,{kind:'remaining',source_url:remaining.URL,request_started_at:out.fetched_at,body_completed_at:completed,http_status:out.http_status??null,headers:archive.headers(response),raw,result:out});}
}
module.exports={collect,collectRemaining,MAX_BODY};
if(require.main===module){
 const reference=JSON.parse(fs.readFileSync('data/washington_house_03_county_fips_reference.json','utf8'));
 collect({reference}).then(out=>{fs.writeFileSync('artifacts/readiness/washington-official-collection.json',JSON.stringify(out,null,2)+'\n');
  console.log(JSON.stringify({...out,payload:out.payload?'validated original contest objects':null}));});
}
