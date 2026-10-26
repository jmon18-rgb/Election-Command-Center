// Owned-repository transport for the official source, not an independent second
// vote observation. Reparse the original selected objects before accepting counts.
(function(root,factory){const api=factory(typeof module!=='undefined'&&module.exports?require('./washington_official_house_source.js'):root?.WashingtonOfficialHouseSource);
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.WashingtonOfficialCache=api;
})(typeof window!=='undefined'?window:null,function(source){
 'use strict';
 const BRANCH='official-results-cache',PATH='data/washington_house_03_official_latest.json';
 const URL='https://raw.githubusercontent.com/jmon18-rgb/Election-Command-Center/'+BRANCH+'/'+PATH;
 const fetchURL=(now=Date.now())=>URL+'?minute='+Math.floor(now/60000);
 async function parse(record,reference,{now=Date.now(),source_url=URL}={}){
  if(source_url!==URL||!source||!Number.isFinite(now)||record?.schema!=='official-wa03-collection-v1'||record.source_url!==source.URL||record.may_move_national_needle!==false)
   throw Error('Unverified official WA cache identity');
  const receipt=Date.parse(record.fetched_at);
  const receiptLimit=now<Date.parse('2026-11-04T17:00:00Z')?15*60000:30*60000;
  if(!Number.isFinite(receipt)||!/(?:Z|[+-]\d\d:\d\d)$/.test(record.fetched_at||'')||receipt>now+60000||now-receipt>receiptLimit)
   throw Error('Official collector receipt missing/future/stale');
  if(record.status==='SOURCE_UNAVAILABLE'){
   if(record.payload!==null)throw Error('Unavailable official source cannot carry counts');
   return {status:'SOURCE_UNAVAILABLE',source_url:source.URL,counties:[],live_votes_accepted:false,
    may_move_national_needle:false,collection_fetched_at:record.fetched_at,reason:String(record.error||'Official source unavailable').slice(0,240)};
  }
  if(!['NO_REPORTED_VOTES','VALIDATED_COUNTY_COUNTS_METHOD_MIX_UNRESOLVED'].includes(record.status)||!record.payload||record.http_status!==200||record.source_test_data!==false)
   throw Error('Unverified official collection status');
  const text=JSON.stringify(record.payload);
  if(text.length>128000||!/^[a-f0-9]{64}$/.test(record.selected_payload_sha256||''))throw Error('Unbounded/unverified selected official payload');
  const subtle=globalThis.crypto?.subtle;
  if(!subtle)throw Error('Official cache integrity verifier unavailable');
  const bytes=await subtle.digest('SHA-256',new TextEncoder().encode(text));
  const digest=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
  if(digest!==record.selected_payload_sha256)throw Error('Official cache integrity mismatch');
  const parsed=source.parse(record.payload,reference,{now});
  if(parsed.status!==record.status||parsed.snapshot_updated_at!==record.snapshot_updated_at||parsed.source_published_at!==record.source_published_at)
   throw Error('Official cache/source clocks or status disagree');
  return {...parsed,collection_fetched_at:record.fetched_at,transport_url:URL,
   transport_note:'Official source via owned repository cache; collection, scheduling and cache delay possible; publication speed unproven'};
 }
 return Object.freeze({URL,BRANCH,PATH,fetchURL,parse});
});
