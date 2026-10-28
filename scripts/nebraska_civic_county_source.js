// Named-candidate counts, never Democratic ballots or inferred caucus credit.
(function(root,factory){const api=factory(typeof module!=='undefined'&&module.exports?require('./election_night_poll_closings_2026.js'):root?.ElectionNightPollClosings2026);
 if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.NebraskaCivicCountySource=api;
})(typeof window!=='undefined'?window:null,function(closes){
 'use strict';
 const URL='https://civicapi.org/api/v2/race/87254',AXIS='NE_OSBORN_RICKETTS_V1';
 const PINNED=Object.freeze([['Pete Ricketts','Republican',220702,'RICKETTS'],['Mike Marvin','Legal Marijuana Now',220703,'OTHER'],['Robin Richards','Nebraska Working People',220704,'OTHER'],['Chuck Conboy','America First',220705,'OTHER'],['Dan Osborn','Independent',220706,'OSBORN']].map(Object.freeze));
 const count=n=>Number.isSafeInteger(n)&&n>=0,name=s=>typeof s==='string'?s.trim().replace(/\s+/g,' '):null;
 const MAX_BYTES=256*1024;
 async function readResponse(response){
  const declared=response.headers?.get?.('content-length');
  if(declared!==null&&declared!==undefined&&(!/^\d+$/.test(declared)||Number(declared)>MAX_BYTES))throw Error('NE response exceeds byte limit');
  if(response.body?.getReader){const reader=response.body.getReader(),chunks=[];let length=0;
   try{while(true){const r=await reader.read();if(r.done)break;length+=r.value.byteLength;if(length>MAX_BYTES){await reader.cancel();throw Error('NE response exceeds byte limit');}chunks.push(r.value);}}finally{reader.releaseLock();}
   const bytes=new Uint8Array(length);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}
   return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  }
  // Test-only response objects may omit browser stream APIs. Native responses
  // must always take the bounded byte path above.
  if(typeof Response==='function'&&response instanceof Response)throw Error('NE native response body unavailable');
  const data=await response.json();if(new TextEncoder().encode(JSON.stringify(data)).length>MAX_BYTES)throw Error('NE fixture exceeds byte limit');return data;
 }
 const flags=x=>['test_data','test','is_test','mock','is_mock','is_disputed'].some(k=>Object.hasOwn(x,k)&&x[k]!==false)||['active','live'].some(k=>Object.hasOwn(x,k)&&x[k]!==true);
 function parse(detail,reference,{source_url=URL,now=Date.now()}={}){
  if(source_url!==URL||!Number.isFinite(now))throw Error('Unverified NE source URL/clock');
  if(detail?.country!=='US'||detail.province!=='NE'||detail.district!==null||detail.municipality!==null||detail.election_scope!=='General'||detail.election_type!=='US Senate'||detail.election_name!=='Nebraska US Senate'||detail.election_date!=='2026-11-03T05:00:00.000Z')throw Error('Wrong exact2026 NE Senate identity');
  if(reference?.schema!=='independent-ne-county-native-crosswalk-v1'||reference.state!=='NE'||reference.source_sha256!=='3c337402b5c6e8d5aa26b4278ccf4edc8989f2683765b3ffbf22296cdb2df3a0'||reference.counties?.length!==93)throw Error('Missing independent NE geography');
  const refs=new Map(reference.counties.map(c=>[c.native_key,c]));
  if(refs.size!==93||new Set(reference.counties.map(c=>c.fips)).size!==93||new Set(reference.counties.map(c=>c.county)).size!==93||reference.counties.some(c=>!/^31\d{3}$/.test(c.fips)||!c.native_key||!c.native_name||!c.county))throw Error('Duplicate/invalid NE geography');
  if(!detail.region_results||Array.isArray(detail.region_results)||Object.keys(detail.region_results).length!==93)throw Error('Full93county NE payload required');
  const rows=Object.entries(detail.region_results).map(([key,raw])=>{const ref=refs.get(key);if(!ref||raw?.name!==ref.native_name||raw.type!=='County'||raw.fips!==ref.fips)throw Error('NE county key/name/type/FIPS mismatch');return {raw,ref};});
  if(detail.test_data===true)return {status:'TEST_DATA_NOT_LIVE',county_identities_matched:93,counties:[],source_url:URL,live_votes_accepted:false,may_move_national_needle:false};
  if(detail.test_data!==false||flags(detail)||detail.round!==1)throw Error('Unverified/test/disputed NE round');
  const stamp=Date.parse(detail.last_updated);
  if(!Number.isFinite(stamp)||!/(?:Z|[+-]\d\d:\d\d)$/.test(detail.last_updated||'')||stamp>now+15*60000||now-stamp>180*60000)throw Error('Missing/future/stale NE source time');
  if(!Array.isArray(detail.candidates)||detail.candidates.length!==5)throw Error('Exact five NE candidates required');
  const roster=new Map();
  for(const c of detail.candidates){const n=name(c.name),p=PINNED.find(p=>p[0]===n);if(!p||p[1]!==c.party||p[2]!==c.candidate_id||roster.has(n)||!count(c.votes)||flags(c))throw Error('NE candidate ID/name/party/count changed');roster.set(n,{name:n,party:p[1],provider_id:p[2],axis:p[3],votes:c.votes,sum:0});}
  const counties=rows.map(({raw,ref})=>{
   if(flags(raw)||!Array.isArray(raw.candidates)||raw.candidates.length!==5)throw Error('Unverified NE county candidates');
   const seen=new Set(),other=[];let support=0,opponent=0,totalOther=0;
   for(const c of raw.candidates){const n=name(c.name),p=roster.get(n);if(!p||seen.has(n)||p.party!==c.party||(Object.hasOwn(c,'candidate_id')&&c.candidate_id!==p.provider_id)||!count(c.votes)||flags(c))throw Error('NE county candidate/count mismatch');seen.add(n);p.sum+=c.votes;if(!count(p.sum))throw Error('NE count overflow');
    if(p.axis==='OSBORN')support=c.votes;else if(p.axis==='RICKETTS')opponent=c.votes;else{totalOther+=c.votes;other.push({provider_id:p.provider_id,name:n,party:p.party,votes:c.votes});}
   }
   if(!count(support+opponent+totalOther))throw Error('NE county total overflow');
   return {county:ref.county,county_fips:ref.fips,osborn_votes:support,ricketts_votes:opponent,other_votes:totalOther,other_candidates:other.sort((a,b)=>a.provider_id-b.provider_id),vote_method:'combined_not_reported',completion_verified:false};
  });
  if([...roster.values()].some(c=>c.sum!==c.votes))throw Error('NE county/state candidate totals disagree');
  const candidates=[...roster.values()].map(({sum,axis,...c})=>c),total=candidates.reduce((s,c)=>s+c.votes,0);
  if(!count(total)||!closes?.allowed('NE-SEN',total,detail.last_updated,now))throw Error('Pre-close/unverified NE publication');
  const namedMax=Math.max(roster.get('Dan Osborn').votes,roster.get('Pete Ricketts').votes);
  const contrastSupported=!total||!candidates.some(c=>![220702,220706].includes(c.provider_id)&&c.votes>=namedMax);
  return {status:total?'VALIDATED_COUNTY_COUNTS_METHOD_MIX_UNRESOLVED':'NO_REPORTED_VOTES',source_url:URL,race_code:'NE-SEN',candidate_contrast:AXIS,contrast_supported:contrastSupported,candidates,snapshot_updated_at:detail.last_updated,timestamp_scope:'provider_race_snapshot_not_independent_county_update_times',county_identities_matched:93,counties,live_votes_accepted:total>0,method_split_reported:false,completion_verified:false,may_move_national_needle:false,write_in_reporting:'Not separately identified in reviewed native candidate contract; unknown, not zero',caucus_credit_assumed:false};
 }
 return Object.freeze({URL,AXIS,MAX_BYTES,parse,readResponse});
});
