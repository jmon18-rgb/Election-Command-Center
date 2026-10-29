// Owned-repository transport for the official source, not an independent second
// vote observation. Reparse the original selected objects before accepting counts.
(function(root,factory){const api=factory(typeof module!=='undefined'&&module.exports?require('./virginia_official_house_source.js'):root?.VirginiaOfficialHouseSource,typeof module!=='undefined'&&module.exports?require('./virginia_official_usage.js'):root?.VirginiaOfficialUsage);
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.VirginiaOfficialCache=api;
})(typeof window!=='undefined'?window:null,function(source,usage){
 'use strict';
 const BRANCH='official-virginia-results-cache',PATH='data/virginia_house_02_official_latest.json';
 const URL='https://raw.githubusercontent.com/jmon18-rgb/Election-Command-Center/'+BRANCH+'/'+PATH;
 const fetchURL=(now=Date.now())=>URL+'?minute='+Math.floor(now/60000);
 function receiptCurrent(fetchedAt,now=Date.now()){
  const receipt=Date.parse(fetchedAt);
  const receiptLimit=now<Date.parse('2026-11-04T17:00:00Z')?15*60000:30*60000;
  return Number.isFinite(now)&&Number.isFinite(receipt)&&/(?:Z|[+-]\d\d:\d\d)$/.test(fetchedAt||'')&&
   receipt<=now+60000&&now-receipt<=receiptLimit;
 }
 async function parse(record,reference,{now=Date.now(),source_url=URL}={}){
  if(typeof usage?.ownInputs!=='function'||typeof usage?.freeze!=='function')throw Error('Owned VA collection snapshot unavailable');
  const owned=usage.ownInputs(record,reference);record=owned.record;reference=owned.reference;
  if(source_url!==URL||!source||!Number.isFinite(now)||record?.schema!=='official-va02-collection-v1'||record.source_url!==source.URL||record.may_move_national_needle!==false)
   throw Error('Unverified official VA cache identity');
  if(!receiptCurrent(record.fetched_at,now))throw Error('Official collector receipt missing/future/stale');
  if(record.status==='SOURCE_UNAVAILABLE'){
   if(record.payload!==null)throw Error('Unavailable official source cannot carry counts');
   return {status:'SOURCE_UNAVAILABLE',source_url:source.URL,counties:[],live_votes_accepted:false,
    may_move_national_needle:false,collection_fetched_at:record.fetched_at,reason:String(record.error||'Official source unavailable').slice(0,240)};
  }
  if(!['NO_REPORTED_VOTES','VALIDATED_COUNTY_COUNTS_METHOD_MIX_UNRESOLVED'].includes(record.status)||!record.payload||record.http_status!==200||record.source_test_data!==false)
   throw Error('Unverified official collection status');
  const text=JSON.stringify(record.payload);
  if(text.length>192000||!/^[a-f0-9]{64}$/.test(record.selected_payload_sha256||''))throw Error('Unbounded/unverified selected official payload');
  const subtle=globalThis.crypto?.subtle;
  if(!subtle)throw Error('Official cache integrity verifier unavailable');
  const bytes=await subtle.digest('SHA-256',new TextEncoder().encode(text));
  const digest=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
  if(digest!==record.selected_payload_sha256)throw Error('Official cache integrity mismatch');
  const parsed=source.parse(record.payload,reference,{now,typedUsage:true});
  if(parsed.status!==record.status||parsed.snapshot_updated_at!==record.snapshot_updated_at||parsed.source_published_at!==record.source_published_at)
   throw Error('Official cache/source clocks or status disagree');
  const {native_usage,...aggregate}=parsed;if(!native_usage)throw Error('Typed VA native source projection missing');
  const typed_usage=usage.freeze({...native_usage,schema:'already-admitted-va02-typed-usage-v2',transport_url:URL,collection_fetched_at:record.fetched_at,selected_hash:digest,integrity_verified:true});
  return {...aggregate,typed_usage,collection_fetched_at:record.fetched_at,transport_url:URL,
   collection_selected_payload_sha256:digest,collection_payload_integrity_verified:true,
   collection_original_response_sha256:/^[a-f0-9]{64}$/.test(record.original_response_sha256||'')?record.original_response_sha256:null,
   collection_original_response_hash_recomputed:false,
   transport_note:'Official source via owned repository cache; collection, scheduling and cache delay possible; publication speed unproven'};
 }
 return Object.freeze({URL,BRANCH,PATH,fetchURL,parse,receiptCurrent});
});
