#!/usr/bin/env node
// Probe exact missing 2026 House/Senate race widgets, never create votes.
'use strict';
const TARGETS=[
 ['House|AK-00','ak-house-00','house','AK','00'],
 ['House|DE-00','de-house-00','house','DE','00'],
 ['House|ND-00','nd-house-00','house','ND','00'],
 ['House|NH-01','nh-house-01','house','NH','01'],
 ['House|NH-02','nh-house-02','house','NH','02'],
 ['House|SD-00','sd-house-00','house','SD','00'],
 ['House|WY-00','wy-house-00','house','WY','00'],
 ['Senate|MA','ma-senate','senate','MA',null],
];
async function probe([key,slug,office,state,district]){
 const url='https://watch.vote/api/widgets/race/'+slug;
 const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),16000);
 try{
  const response=await fetch(url,{signal:abort.signal,headers:{Accept:'application/json'}});
  const cors=response.headers.get('access-control-allow-origin')||'';
  const text=await response.text();
  let payload=null;try{payload=JSON.parse(text)}catch{}
  const valid=response.status===200&&payload&&payload.version===1&&
   payload.raceSlug===slug&&payload.raceId==='2026-'+slug&&
   payload.electionDate==='2026-11-03'&&
   payload.office===office&&payload.state?.code===state&&
   (district===null?payload.district===null:String(payload.district).padStart(2,'0')===district)&&
   (payload.results===null||(typeof payload.results==='object'&&!Array.isArray(payload.results)))&&
   cors==='*';
  return {key,http_status:response.status,cors,verified_exact_2026_endpoint:Boolean(valid),
   advertised_race_id:payload?.raceId||null,
   advertised_office:payload?.office||null,
   advertised_state:payload?.state?.code||null,
   advertised_district:payload?.district??null,
   result_state:payload?.results===null?'no_live_results_yet':
    (payload?.results?'provider_record_present_unvalidated':'unexpected'),
   error_code:!response.ok?payload?.error||null:null};
 }catch(error){return {key,http_status:null,verified_exact_2026_endpoint:false,
   error_code:error.name==='AbortError'?'TIMEOUT':error.name};}
 finally{clearTimeout(timer)}
}
(async()=>{
 const rows=[];for(const target of TARGETS)rows.push(await probe(target));
 const verified=rows.filter(x=>x.verified_exact_2026_endpoint).length;
 console.log(JSON.stringify({schema:'watch-vote-2026-eight-gap-exact-identity-probe-v1',
  checked_at:new Date().toISOString(),verified,requested:TARGETS.length,
  all_exact_widget_sources_verified:verified===TARGETS.length,
  browser_2026_vote_ingestion_enabled:false,
  live_votes_verified:false,rows},null,2));
 if(verified!==TARGETS.length)process.exitCode=1;
})().catch(error=>{console.error('Probe error',error.message);process.exitCode=1});
