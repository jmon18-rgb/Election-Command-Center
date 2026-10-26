'use strict';
// Bounded server-side source collection. No publisher, schedule or national input is enabled by this module.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('./washington_official_house_source.js');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const MAX_BODY=2*1024*1024;
async function body(response){
 if(!response.body)throw Error('Missing official response body');
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{while(true){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;
  if(size>MAX_BODY)throw Error('Official response exceeds bounded body limit');chunks.push(Buffer.from(next.value));}}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 return Buffer.concat(chunks);
}
async function collect({fetchImpl=global.fetch,now=Date.now(),reference}={}){
 if(!Number.isFinite(now))throw Error('Invalid collector clock');
 const out={schema:'official-wa03-collection-v1',source_url:api.URL,fetched_at:new Date(now).toISOString(),
  status:'SOURCE_UNAVAILABLE',payload:null,may_move_national_needle:false,
  timing_scope:'request-to-body only, not source availability or comparative publication lag'};
 const started=performance.now();
 try{
  const r=await fetchImpl(api.URL,{signal:AbortSignal.timeout(20000),headers:{Accept:'application/json'}});
  out.http_status=r.status;out.cache_control=r.headers.get('cache-control');
  if(r.status!==200||!r.headers.get('content-type')?.toLowerCase().includes('application/json'))throw Error('Official HTTP/content type unavailable');
  const raw=await body(r);out.request_to_body_ms=Math.round(performance.now()-started);out.original_response_sha256=hash(raw);
  const original=JSON.parse(raw.toString('utf8')),parsed=api.parse(original,reference,{now});
  out.status=parsed.status;out.snapshot_updated_at=parsed.snapshot_updated_at;out.source_published_at=parsed.source_published_at;
  if(!parsed.live_votes_accepted)return out;
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
 }catch(error){out.status='SOURCE_UNAVAILABLE';out.payload=null;out.error=String(error.message).slice(0,240);return out;}
}
module.exports={collect,MAX_BODY};
if(require.main===module){
 const reference=JSON.parse(fs.readFileSync('data/washington_house_03_county_fips_reference.json','utf8'));
 collect({reference}).then(out=>{fs.writeFileSync('artifacts/readiness/washington-official-collection.json',JSON.stringify(out,null,2)+'\n');
  console.log(JSON.stringify({...out,payload:out.payload?'validated original contest objects':null}));});
}
