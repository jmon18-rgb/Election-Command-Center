/* Scheduling compatibility only. No model, source admission, clocks or votes
 * are created here. Every old and new envelope must pass the installed pure
 * admission validator at the caller's current time before reuse is permitted. */
(function(root,factory){const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.JointCountSnapshotPolicy=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const routes=Object.freeze({'SC-SEN':87409,'MI-07':87207,'PA-08':87383,'AZ-06':86922,'PA-07':87382,
  'OH-SEN':87527,'ME-SEN':87188,'IA-SEN':87151,'KS-SEN':87162,'TX-SEN':87438,'WI-01':87483,
  'WI-03':87485,'MI-04':87204,'PA-10':87385,'NY-17':87319,'NE-SEN':87254});
 const frameFields=['contextKey','modelRevision','frameKind','countContext','sourceRows','descriptiveRows','historyRevision','pollingAt'];
 const payloadKeys=new Set(['basis','publicBasis','envelopes','variants','args']);
 const argKeys=new Set(['samples','seed','now','independentSenateCredit','contextKey','marginSummaryCodes','nationalShift',
  'errorMultiplier','live','rehearsal','explainControl','voteSeatWeights','senateCorrelationResearch']);
 const envelopeKeys=new Set(['snapshot','baseline','reference','baseline_year','baseline_scenario','rehearsal']);
 const snapshotKeys=new Set(['status','source_url','race_code','snapshot_updated_at','timestamp_scope','county_identities_matched',
  'counties','live_votes_accepted','method_split_reported','completion_verified','may_move_national_needle']);
 const neKeys=['candidate_contrast','contrast_supported','candidates','write_in_reporting','caucus_credit_assumed'];
 const meKeys=['other_votes_scope','round','ranked_choice_scope'];
 const countyKeys=new Set(['county','county_fips','dem_votes','rep_votes','other_votes','vote_method','completion_verified']);
 const neCountyKeys=new Set(['county','county_fips','osborn_votes','ricketts_votes','other_votes','other_candidates','vote_method','completion_verified']);
 const nePeople=Object.freeze({220702:['Pete Ricketts','Republican'],220703:['Mike Marvin','Legal Marijuana Now'],
  220704:['Robin Richards','Nebraska Working People'],220705:['Chuck Conboy','America First'],220706:['Dan Osborn','Independent']});
 const waURL='https://results.votewa.gov/results/public/api/elections/washington/20261103/data/ballot-item/54c40000-9064-bbec-4779-08df15c0a82a';
 const waTransport='https://raw.githubusercontent.com/jmon18-rgb/Election-Command-Center/official-results-cache/data/washington_house_03_official_latest.json';
 const waKeys=new Set([...snapshotKeys,'source_published_at','collection_fetched_at','transport_url','collection_selected_payload_sha256',
  'collection_payload_integrity_verified','collection_original_response_sha256','collection_original_response_hash_recomputed','transport_note',
  'remaining_status','official_remaining','remaining_revision']);
 const waEnvelopeKeys=new Set([...envelopeKeys,'remaining_geography']);
 const vaURL='https://enr.elections.virginia.gov/results/public/api/elections/virginia/2026-November-General/data/ballot-item/01000000-f030-c43d-fd71-08df1fee52e7';
 const vaTransport='https://raw.githubusercontent.com/jmon18-rgb/Election-Command-Center/official-virginia-results-cache/data/virginia_house_02_official_latest.json';
 const vaKeys=new Set([...snapshotKeys,'source_last_updated','source_published_at','source_test_data','model_method_scope','authoritative_race_call',
  'collection_fetched_at','transport_url','collection_selected_payload_sha256','collection_payload_integrity_verified','collection_original_response_sha256',
  'collection_original_response_hash_recomputed','transport_note','typed_usage']);
 const vaCountyKeys=new Set([...countyKeys,'methods']);
 const vaClocks=['snapshot_updated_at','election_as_of','source_published_at','source_last_updated'];
 const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
 const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k),plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
 const outcome=(kind,reason)=>Object.freeze({kind,reason});
 const hard=reason=>outcome('HARD_INVALIDATION',reason);
 // Reject cycles, accessors and non-value objects without invoking getters or
 // toJSON. Acyclic aliases and explicit undefined metadata remain comparable.
 function valueTree(value,path=new Set()){
  if(value===null||value===undefined||['string','boolean'].includes(typeof value))return true;
  if(typeof value==='number')return Number.isFinite(value);
  if(typeof value!=='object'||path.has(value)||(!Array.isArray(value)&&!plain(value)))return false;
  const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(descriptors);
  if(keys.some(k=>typeof k!=='string'||!own(descriptors[k],'value')))return false;
  if(Array.isArray(value)&&(keys.length!==value.length+1||keys.some(k=>k!=='length'&&(!/^(?:0|[1-9]\d*)$/.test(k)||Number(k)>=value.length))))return false;
  path.add(value);for(const key of keys){if(key==='length'&&Array.isArray(value))continue;
   if(!valueTree(descriptors[key].value,path)){path.delete(value);return false;}}
  path.delete(value);return true;
 }
 function same(a,b){
  if(Object.is(a,b))return true;if(a===null||b===null||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const ak=Object.keys(a).sort(),bk=Object.keys(b).sort();if(ak.length!==bk.length||ak.some((k,i)=>k!==bk[i]))return false;
  return ak.every(k=>same(a[k],b[k]));
 }
 const omit=(x,keys)=>Object.fromEntries(Object.keys(x).filter(k=>!keys.includes(k)).map(k=>[k,x[k]]));
 const only=(x,keys)=>plain(x)&&Object.keys(x).every(k=>keys.has(k));
 const count=n=>Number.isSafeInteger(n)&&n>=0;
 function stamp(text){return typeof text==='string'&&/(?:Z|[+-]\d\d:\d\d)$/.test(text)&&Number.isFinite(Date.parse(text))?Date.parse(text):NaN;}
 function callMap(live,now){
  if(!plain(live))return false;
  return Object.values(live).every(row=>plain(row)&&row.mode==='source_called'&&['D','R'].includes(row.winnerParty)&&
   row.source==='civicAPI'&&Number.isFinite(stamp(row.asOf))&&stamp(row.asOf)<=now);
 }
 function people(rows,ids){
  if(!Array.isArray(rows)||rows.length!==ids.length)return null;
  const found=new Map();for(const row of rows){
   if(!only(row,new Set(['provider_id','name','party','votes']))||!ids.includes(row.provider_id)||found.has(row.provider_id)||
    !count(row.votes)||row.name!==nePeople[row.provider_id]?.[0]||row.party!==nePeople[row.provider_id]?.[1])return null;
   found.set(row.provider_id,row);
  }return found;
 }
 function countyPair(a,b,independent){
  const keys=independent?neCountyKeys:countyKeys,fields=independent?['osborn_votes','ricketts_votes','other_votes']:['dem_votes','rep_votes','other_votes'];
  if(!only(a,keys)||!only(b,keys)||!same(omit(a,fields.concat('other_candidates')),omit(b,fields.concat('other_candidates')))||
   a.vote_method!=='combined_not_reported'||a.completion_verified!==false||
   typeof a.county!=='string'||typeof a.county_fips!=='string'||fields.some(k=>!count(a[k])||!count(b[k])||b[k]<a[k])||
   !count(fields.reduce((sum,k)=>sum+a[k],0))||!count(fields.reduce((sum,k)=>sum+b[k],0)))return false;
  if(independent){const ids=[220703,220704,220705],old=people(a.other_candidates,ids),next=people(b.other_candidates,ids);
   if(!old||!next||ids.some(id=>next.get(id).votes<old.get(id).votes)||
    ids.reduce((sum,id)=>sum+old.get(id).votes,0)!==a.other_votes||ids.reduce((sum,id)=>sum+next.get(id).votes,0)!==b.other_votes)return false;
  }return true;
 }
 function snapshotPair(a,b){
  const code=a.race_code,independent=code==='NE-SEN',keys=new Set([...snapshotKeys,...(independent?neKeys:code==='ME-SEN'?meKeys:[])]);
  if(!own(routes,code)||b.race_code!==code||!only(a,keys)||!only(b,keys)||
   a.source_url!=='https://civicapi.org/api/v2/race/'+routes[code]||b.source_url!==a.source_url||
   !same(omit(a,['snapshot_updated_at','counties','candidates']),omit(b,['snapshot_updated_at','counties','candidates']))||
   a.status!=='VALIDATED_COUNTY_COUNTS_METHOD_MIX_UNRESOLVED'||a.live_votes_accepted!==true||a.method_split_reported!==false||
   a.completion_verified!==false||a.may_move_national_needle!==false||
   !Number.isFinite(stamp(a.snapshot_updated_at))||!Number.isFinite(stamp(b.snapshot_updated_at))||stamp(b.snapshot_updated_at)<stamp(a.snapshot_updated_at)||
   !Array.isArray(a.counties)||!Array.isArray(b.counties)||a.counties.length!==b.counties.length||
   a.counties.some((row,i)=>!countyPair(row,b.counties[i],independent)))return false;
  // A revision cannot alter counts under the same source publication clock.
  if(stamp(a.snapshot_updated_at)===stamp(b.snapshot_updated_at)&&(!same(a.counties,b.counties)||!same(a.candidates,b.candidates)))return false;
  if(independent){
   if(a.candidate_contrast!=='NE_OSBORN_RICKETTS_V1'||a.contrast_supported!==true||a.caucus_credit_assumed!==false)return false;
   const ids=[220702,220703,220704,220705,220706],old=people(a.candidates,ids),next=people(b.candidates,ids);
   if(!old||!next||ids.some(id=>next.get(id).votes<old.get(id).votes))return false;
   for(const [snapshot,roster]of [[a,old],[b,next]])for(const id of ids){const sum=snapshot.counties.reduce((n,c)=>n+(id===220702?c.ricketts_votes:id===220706?c.osborn_votes:c.other_candidates.find(row=>row.provider_id===id).votes),0);
    if(!count(sum)||roster.get(id).votes!==sum)return false;}
  }return true;
 }
 function deepCopy(value){if(value===null||typeof value!=='object')return value;return Array.isArray(value)?value.map(deepCopy):Object.fromEntries(Object.keys(value).map(key=>[key,deepCopy(value[key])]));}
 function deepFreeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))deepFreeze(child);Object.freeze(value);}return value;}
 const hasRemaining=s=>own(s,'official_remaining')||own(s,'remaining_revision')||s.remaining_status!=='NO_REMAINING_SOURCE';
 function footprint(compiled){const used=compiled?.official_remaining_sensitivity;return plain(used)&&Array.isArray(used.county_fips)&&used.county_fips.length>0&&
  used.whole_counties===used.county_fips.length&&new Set(used.county_fips).size===used.county_fips.length?used:null;}
 function capturedUsage(envelope,at,validateEnvelope,washington){
  if(!Number.isFinite(at)||typeof washington?.remainingCapture!=='function'||typeof washington?.remainingCurrent!=='function')return null;
  const compiled=validateEnvelope(envelope,at),used=footprint(compiled);
  if(compiled?.schema!=='national-county-likelihood-v1'||compiled.code!=='WA-03'||compiled.source_url!==waURL||!used)return null;
  const projection=washington.remainingCapture(envelope.snapshot.remaining_revision,used.county_fips,envelope.snapshot.snapshot_updated_at);
  if(!projection||washington.remainingCurrent(projection,at)!==true)return null;
  return {projection:deepCopy(projection),likelihood_footprint:deepCopy(used)};
 }
 // Retain the original compiler's used sensitivity footprint at capture,
 // not all available rows or a later max clock. This is not final ESS admission.
 // This creates only typed RAM metadata; no native/raw response is copied.
 function captureRemainingUsage(frame,{validateEnvelope,washington}={}){
  try{if(!plain(frame)||!valueTree(frame)||typeof validateEnvelope!=='function'||!Number.isFinite(frame.payload?.args?.now)||!Array.isArray(frame.payload?.envelopes))return null;
   const rows=frame.payload.envelopes.filter(e=>e?.snapshot?.race_code==='WA-03');if(rows.length>1)return null;
   if(!rows.length||!hasRemaining(rows[0].snapshot))return deepFreeze({});
   const used=capturedUsage(rows[0],frame.payload.args.now,validateEnvelope,washington);return used?deepFreeze({'WA-03':used}):null;
  }catch{return null;}
 }
 function remainingPair(old,fresh,previous,next,admissions,now,validateEnvelope,washington){
  const a=old.snapshot,b=fresh.snapshot;
  if(!hasRemaining(a)&&!hasRemaining(b))return (!own(previous,'remainingUsage')||same(previous.remainingUsage,{}))&&(!own(next,'remainingUsage')||same(next.remainingUsage,{}));
  if(!hasRemaining(a)||!hasRemaining(b)||a.remaining_status!=='VALIDATED_WHOLE_COUNTY_ESTIMATES'||b.remaining_status!==a.remaining_status||
   !a.official_remaining||!b.official_remaining||!a.remaining_revision||!b.remaining_revision||
   !same(a.official_remaining,b.official_remaining)||!same(a.remaining_revision,b.remaining_revision)||
   typeof washington?.remainingCapture!=='function'||typeof washington?.remainingCurrent!=='function')return false;
  const frozen=capturedUsage(old,previous.payload.args.now,validateEnvelope,washington),incoming=capturedUsage(fresh,next.payload.args.now,validateEnvelope,washington);
  if(!frozen||!incoming||!same(previous.remainingUsage,{'WA-03':frozen})||!same(next.remainingUsage,{'WA-03':incoming})||
   washington.remainingCurrent(frozen.projection,now)!==true||washington.remainingCurrent(incoming.projection,now)!==true||
   !same(omit(frozen.projection,['counts_stamp']),omit(incoming.projection,['counts_stamp']))||!same(frozen.likelihood_footprint,incoming.likelihood_footprint))return false;
  return same(footprint(admissions[0]),frozen.likelihood_footprint)&&same(footprint(admissions[1]),incoming.likelihood_footprint);
 }
 function officialPair(old,fresh,previous,next,admissions,now,validateEnvelope,washington){
  const a=old.snapshot,b=fresh.snapshot,dynamic=['snapshot_updated_at','source_published_at','collection_fetched_at','collection_selected_payload_sha256','collection_original_response_sha256','counties'];
  if(typeof washington?.receiptCurrent!=='function'||typeof washington?.publicationCurrent!=='function'||!only(a,waKeys)||!only(b,waKeys)||
   a.race_code!=='WA-03'||b.race_code!==a.race_code||a.source_url!==waURL||b.source_url!==waURL||a.transport_url!==waTransport||b.transport_url!==waTransport||
   !same(omit(a,dynamic),omit(b,dynamic))||a.status!=='VALIDATED_COUNTY_COUNTS_METHOD_MIX_UNRESOLVED'||a.live_votes_accepted!==true||
   a.timestamp_scope!=='official_state_snapshot_not_independent_county_batch_publication_times'||a.method_split_reported!==false||a.completion_verified!==false||a.may_move_national_needle!==false||
   a.collection_payload_integrity_verified!==true||b.collection_payload_integrity_verified!==true||a.collection_original_response_hash_recomputed!==false||b.collection_original_response_hash_recomputed!==false||
   !hash(a.collection_selected_payload_sha256)||!hash(b.collection_selected_payload_sha256)||
   ![a.collection_original_response_sha256,b.collection_original_response_sha256].every(value=>value===null||hash(value))||
   !Array.isArray(a.counties)||!Array.isArray(b.counties)||a.counties.length!==7||b.counties.length!==7||a.counties.some((row,i)=>!countyPair(row,b.counties[i],false)))return false;
  for(const snapshot of [a,b]){const total=snapshot.counties.reduce((n,row)=>n+row.dem_votes+row.rep_votes+row.other_votes,0);
   if(!count(total)||washington.receiptCurrent(snapshot.collection_fetched_at,now)!==true||
    washington.publicationCurrent(snapshot.snapshot_updated_at,snapshot.source_published_at,total,now)!==true)return false;}
  for(const key of ['snapshot_updated_at','source_published_at','collection_fetched_at'])if(!Number.isFinite(stamp(a[key]))||!Number.isFinite(stamp(b[key]))||stamp(b[key])<stamp(a[key]))return false;
  const vectorChanged=!same(a.counties,b.counties),nativeChanged=vectorChanged||a.snapshot_updated_at!==b.snapshot_updated_at||a.source_published_at!==b.source_published_at;
  if(vectorChanged&&stamp(b.snapshot_updated_at)<=stamp(a.snapshot_updated_at))return false;
  if(nativeChanged&&(a.collection_selected_payload_sha256===b.collection_selected_payload_sha256||stamp(b.collection_fetched_at)<=stamp(a.collection_fetched_at)))return false;
  // A refetch may change unselected response bytes. Its original hash remains
  // opaque/unrecomputed here; it cannot authenticate or alter selected counts.
  if(!nativeChanged&&(a.collection_selected_payload_sha256!==b.collection_selected_payload_sha256||
   a.collection_original_response_sha256!==b.collection_original_response_sha256&&stamp(b.collection_fetched_at)<=stamp(a.collection_fetched_at)))return false;
  return remainingPair(old,fresh,previous,next,admissions,now,validateEnvelope,washington);
 }
 function virginiaProjectionStatic(p){return {...omit(p,['collection_fetched_at','selected_hash','native','localities']),localities:p.localities.map(row=>({...omit(row,['reported_at','candidates']),candidates:row.candidates.map(person=>({...omit(person,['votes','methods']),methods:person.methods.map(method=>omit(method,['votes'])).sort((a,b)=>a.id.localeCompare(b.id))})).sort((a,b)=>a.native_id.localeCompare(b.native_id))})).sort((a,b)=>a.county_fips.localeCompare(b.county_fips))};}
 function virginiaSnapshotStatic(s){return {...omit(s,['typed_usage','collection_fetched_at','collection_selected_payload_sha256','collection_original_response_sha256','snapshot_updated_at','source_last_updated','source_published_at','counties']),counties:s.counties.map(row=>({...omit(row,['dem_votes','rep_votes','other_votes','methods']),methods:Object.keys(row.methods).sort()})).sort((a,b)=>a.county_fips.localeCompare(b.county_fips))};}
 // Original parser-produced cells/clocks survive aggregate projection loss.
 // The injected helpers bind fixed native IDs and exact original current rules;
 // a selected-payload hash is never authentication of original HTTP bytes.
 function virginiaPair(a,b,now,virginia){
  if(typeof virginia?.current!=='function'||typeof virginia?.matchesSnapshot!=='function'||!only(a,vaKeys)||!only(b,vaKeys)||
   a.race_code!=='VA-02'||b.race_code!==a.race_code||a.source_url!==vaURL||b.source_url!==vaURL||a.transport_url!==vaTransport||b.transport_url!==vaTransport||
   [a,b].some(s=>s.status!=='VALIDATED_COUNTY_COUNTS_METHOD_MIX_UNRESOLVED'||s.live_votes_accepted!==true||s.method_split_reported!==true||
    s.timestamp_scope!=='official_contest_reporting_snapshot_not_independent_locality_batch_capture'||s.source_test_data!==false||
    s.completion_verified!==false||s.may_move_national_needle!==false||s.authoritative_race_call!==false||
    s.collection_payload_integrity_verified!==true||s.collection_original_response_hash_recomputed!==false||!hash(s.collection_selected_payload_sha256)||
    !(s.collection_original_response_sha256===null||hash(s.collection_original_response_sha256))||!plain(s.typed_usage)||
    !Array.isArray(s.counties)||s.counties.length!==8||s.counties.some(row=>!only(row,vaCountyKeys))))return false;
  const p=a.typed_usage,q=b.typed_usage;
  if(virginia.matchesSnapshot(p,a)!==true||virginia.matchesSnapshot(q,b)!==true||virginia.current(p,now)!==true||virginia.current(q,now)!==true||
   !same(virginiaProjectionStatic(p),virginiaProjectionStatic(q))||!same(virginiaSnapshotStatic(a),virginiaSnapshotStatic(b)))return false;
  const oldReceipt=stamp(p.collection_fetched_at),newReceipt=stamp(q.collection_fetched_at);
  if(!Number.isFinite(oldReceipt)||!Number.isFinite(newReceipt)||newReceipt<oldReceipt||vaClocks.some(k=>stamp(q.native[k])<stamp(p.native[k])))return false;
  let changed=false;const incoming=new Map(q.localities.map(row=>[row.county_fips,row]));
  for(const row of p.localities){const next=incoming.get(row.county_fips);if(!next)return false;
   const oldAt=stamp(row.reported_at),newAt=stamp(next.reported_at);if(!Number.isFinite(oldAt)||!Number.isFinite(newAt)||newAt<oldAt)return false;
   let rowChanged=false;const people=new Map(next.candidates.map(person=>[person.native_id,person]));
   for(const person of row.candidates){const fresh=people.get(person.native_id);if(!fresh||fresh.votes<person.votes)return false;if(fresh.votes!==person.votes)rowChanged=true;
    const methods=new Map(fresh.methods.map(method=>[method.id,method]));for(const method of person.methods){const freshMethod=methods.get(method.id);if(!freshMethod||freshMethod.votes<method.votes)return false;if(freshMethod.votes!==method.votes)rowChanged=true;}}
   if(rowChanged&&!(newAt>oldAt))return false;changed=changed||rowChanged;
  }
  if(changed)return newReceipt>oldReceipt&&p.selected_hash!==q.selected_hash&&vaClocks.every(k=>stamp(q.native[k])>stamp(p.native[k]));
  // The first VA slice accepts unchanged selected content/refetches, while
  // unexplained source-only changes retain the hard refresh boundary.
  return p.selected_hash===q.selected_hash&&same(p.native,q.native)&&same(p.localities,q.localities)&&a.collection_original_response_sha256===b.collection_original_response_sha256;
 }
 function classify(previous,next,{now,validateEnvelope,washington,virginia}={}){
  try{
   if(!Number.isFinite(now)||typeof validateEnvelope!=='function')return hard('CURRENT_ADMISSION_VALIDATOR_REQUIRED');
   if(!plain(previous)||!plain(next)||!valueTree(previous)||!valueTree(next))return hard('INVALID_FRAME_VALUE');
   if(previous.frameKind!=='LIVE'||next.frameKind!=='LIVE'||typeof previous.countContext!=='string'||!previous.countContext||
    frameFields.some(k=>!own(previous,k)||!own(next,k)||!same(previous[k],next[k])))return hard('MODEL_CONTEXT_CHANGED');
   const a=previous.payload,b=next.payload;
   if(!only(a,payloadKeys)||!only(b,payloadKeys)||!plain(a.basis)||!plain(b.basis)||
    ![a.publicBasis,b.publicBasis].every(value=>value===null||plain(value))||!Array.isArray(a.variants)||!Array.isArray(b.variants)||
    !same(omit(a,['envelopes','args']),omit(b,['envelopes','args']))||!only(a.args,argKeys)||!only(b.args,argKeys)||
    !same(omit(a.args,['now']),omit(b.args,['now']))||a.args.contextKey!==previous.contextKey||b.args.contextKey!==next.contextKey||
    a.args.independentSenateCredit!=='no_credit'||a.args.rehearsal===true||
    !Number.isFinite(a.args.now)||!Number.isFinite(b.args.now)||a.args.now>now||b.args.now>now||b.args.now<a.args.now||
    !callMap(a.args.live,now)||!callMap(b.args.live,now))return hard('MODEL_INPUTS_CHANGED');
   if(!Array.isArray(a.envelopes)||!a.envelopes.length||a.envelopes.length>18||!Array.isArray(b.envelopes)||a.envelopes.length!==b.envelopes.length)return hard('EVIDENCE_SET_CHANGED');
   const seen=new Set();
   for(let i=0;i<a.envelopes.length;i++){
    const old=a.envelopes[i],fresh=b.envelopes[i];
    const isWA=old?.snapshot?.race_code==='WA-03',isVA=old?.snapshot?.race_code==='VA-02',keys=isWA?waEnvelopeKeys:envelopeKeys;
    if(!only(old,keys)||!only(fresh,keys)||!plain(old.snapshot)||!plain(fresh.snapshot)||
     old.rehearsal===true||fresh.rehearsal===true||!same(omit(old,['snapshot']),omit(fresh,['snapshot'])))return hard('EVIDENCE_CONTRACT_CHANGED');
    const code=old.snapshot.race_code;
    // Official paths need the original pure admission guards. Unsupported
    // cache routes and unknown source contracts retain the hard path.
    if(!own(routes,code)&&!isWA&&!isVA)return hard('SOURCE_REQUIRES_HARD_REFRESH');
    if(isWA&&(typeof washington?.receiptCurrent!=='function'||typeof washington?.publicationCurrent!=='function'))return hard('SOURCE_REQUIRES_HARD_REFRESH');
    if(isVA&&(typeof virginia?.current!=='function'||typeof virginia?.matchesSnapshot!=='function'))return hard('SOURCE_REQUIRES_HARD_REFRESH');
    if(seen.has(code)||fresh.snapshot.race_code!==code)return hard('EVIDENCE_SET_CHANGED');seen.add(code);
    const admissions=[];for(const envelope of [old,fresh]){
     const validated=validateEnvelope(envelope,now);
     if(!validated||validated.schema!=='national-county-likelihood-v1'||validated.code!==code||
      validated.source_url!==envelope.snapshot.source_url||validated.as_of!==envelope.snapshot.snapshot_updated_at)return hard('CURRENT_ADMISSION_FAILED');
     admissions.push(validated);
    }
    if(isVA?!virginiaPair(old.snapshot,fresh.snapshot,now,virginia):isWA?!officialPair(old,fresh,previous,next,admissions,now,validateEnvelope,washington):!snapshotPair(old.snapshot,fresh.snapshot))return hard('COUNT_OR_SOURCE_REVISION_CHANGED');
   }
   return outcome('MONOTONE_COUNTS_ONLY','SAME_CONTRACT_NONDECREASING_COUNTS_AND_CLOCKS');
  }catch{return hard('CURRENT_ADMISSION_FAILED');}
 }
 return Object.freeze({VERSION:'joint-count-snapshot-policy-v3',classify,captureRemainingUsage});
});
