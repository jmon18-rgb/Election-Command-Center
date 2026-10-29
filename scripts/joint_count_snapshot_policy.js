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
 function classify(previous,next,{now,validateEnvelope}={}){
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
    if(!only(old,envelopeKeys)||!only(fresh,envelopeKeys)||!plain(old.snapshot)||!plain(fresh.snapshot)||
     old.rehearsal===true||fresh.rehearsal===true||!same(omit(old,['snapshot']),omit(fresh,['snapshot'])))return hard('EVIDENCE_CONTRACT_CHANGED');
    const code=old.snapshot.race_code;
    // Official caches/remaining estimates need their own shorter receipt and
    // method-cell validation. They deliberately retain the old hard path.
    if(!own(routes,code))return hard('SOURCE_REQUIRES_HARD_REFRESH');
    if(seen.has(code)||fresh.snapshot.race_code!==code)return hard('EVIDENCE_SET_CHANGED');seen.add(code);
    for(const envelope of [old,fresh]){
     const validated=validateEnvelope(envelope,now);
     if(!validated||validated.schema!=='national-county-likelihood-v1'||validated.code!==code||
      validated.source_url!==envelope.snapshot.source_url||validated.as_of!==envelope.snapshot.snapshot_updated_at)return hard('CURRENT_ADMISSION_FAILED');
    }
    if(!snapshotPair(old.snapshot,fresh.snapshot))return hard('COUNT_OR_SOURCE_REVISION_CHANGED');
   }
   return outcome('MONOTONE_COUNTS_ONLY','SAME_CONTRACT_NONDECREASING_COUNTS_AND_CLOCKS');
  }catch{return hard('CURRENT_ADMISSION_FAILED');}
 }
 return Object.freeze({VERSION:'joint-count-snapshot-policy-v1',classify});
});
