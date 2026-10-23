/* Browser-only 506-race observation health. No guessed vote counts or
 * probabilities. A source identity path is NOT a source-reported vote.
 * Uses only already-validated Open America / civicAPI result snapshots.
 */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.ElectionNightLiveCoverage=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const START=Date.parse('2026-11-03T23:00:00Z');
 const count={House:435,Senate:35,Governor:36};
 const stateSet=new Set('AR AZ CO CT FL GA IA ID IN LA MI MN NC PA RI SC TX UT VA VT WA WV'.split(' '));
 const known=new Set(['PRIMARY_NOT_LOADED','PRIMARY_RACE_MISSING','PRIMARY_PUBLISHED_NO_VOTES',
  'PRIMARY_OBSERVED_RECENT','PRIMARY_OBSERVED_STALE','PRIMARY_UNTRUSTED',
  'SECONDARY_NOT_QUERIED','SECONDARY_OBSERVED_RECENT','SECONDARY_OBSERVED_STALE',
  'SECONDARY_UNVERIFIED','SECONDARY_SOURCE_ID_UNKNOWN']);
 const validTime=(at,now)=>{
  const t=Date.parse(at||'');
  return Number.isFinite(t)&&t>=START&&t<=now+15*60000;
 };
 const within=(at,now)=>validTime(at,now)&&now-Date.parse(at)<=180*60000;
 function audit(ledger,primary={},civic={},now=Date.now()){
  if(!ledger||ledger.status!=='SOURCE_IDENTITY_AUDIT_NOT_LIVE_RESULTS_COVERAGE'||
   ledger.election!=='2026-11-03'||!Array.isArray(ledger.races)||
   ledger.races.length!==506||!Number.isFinite(now))
   return {ready:false,reason:'Nationwide 506-race identity ledger unavailable',
    may_move_national_needle:false};
  const seen=new Set(),tally={House:0,Senate:0,Governor:0};
  const statuses={House:{},Senate:{},Governor:{}},senate=[];
  let observedTotal=0;
  for(const r of ledger.races){
   if(!r||!Object.prototype.hasOwnProperty.call(count,r.office)||
    typeof r.key!=='string'||r.id!==r.office+'|'+r.key||
    seen.has(r.id)||!(/^[A-Z]{2}/.test(r.key)))return {ready:false,
      reason:'Invalid or duplicate nationwide race identity',may_move_national_needle:false};
   seen.add(r.id);tally[r.office]++;
   const inPrimary=stateSet.has(r.state)&&r.provider_scope==='Open America 22-state scope';
   const outside=!stateSet.has(r.state)&&r.provider_scope==='outside primary';
   if(!inPrimary&&!outside)return {ready:false,reason:'Provider scope conflict',
    may_move_national_needle:false};
   let status;
   if(inPrimary){
    const snap=primary[r.office];
    if(!snap)status='PRIMARY_NOT_LOADED';
    else if(snap.year!==2026||snap.office!==r.office||
      snap.source!=='state'&&snap.source!==''||snap.api!==1||
      !snap.races||typeof snap.races!=='object'||Array.isArray(snap.races))
     status='PRIMARY_UNTRUSTED';
    else{
     const item=snap.races[r.key];
     if(!item)status='PRIMARY_RACE_MISSING';
     else if(!Number.isSafeInteger(item.total)||item.total<0||
       item.called!==false||!Array.isArray(item.cands))status='PRIMARY_UNTRUSTED';
     else if(item.total===0)status='PRIMARY_PUBLISHED_NO_VOTES';
     else if(within(snap.as_of,now)&&snap.stale!==true)status='PRIMARY_OBSERVED_RECENT';
     else status='PRIMARY_OBSERVED_STALE';
    }
   }else{
    const c=civic[r.id];
    if(c){
     if(c.provider!=='civicAPI'||c.office!==r.office||c.key!==r.key||
       !Number.isSafeInteger(c.race_id)||c.race_id<=0||
       !Number.isSafeInteger(c.total)||c.total<0||
       typeof c.source_url!=='string'||!/^https:\/\/civicapi\.org\/api\/v2\/race\/\d+$/.test(c.source_url)||
       !Array.isArray(c.candidates))
      status='SECONDARY_UNVERIFIED';
     else if(c.total===0)status='SECONDARY_NOT_QUERIED';
     else status=within(c.last_updated,now)?'SECONDARY_OBSERVED_RECENT':'SECONDARY_OBSERVED_STALE';
    }else if(r.source_identity_status==='NO_CURATED_PROVIDER_ID')
     status='SECONDARY_SOURCE_ID_UNKNOWN';
    else status='SECONDARY_NOT_QUERIED';
   }
   if(!known.has(status))return {ready:false,reason:'Unexpected provider result state',
    may_move_national_needle:false};
   statuses[r.office][status]=(statuses[r.office][status]||0)+1;
   if(status.endsWith('_OBSERVED_RECENT'))observedTotal++;
   if(r.office==='Senate')senate.push({race:r.id,status});
  }
  if(seen.size!==506||Object.keys(tally).some(k=>tally[k]!==count[k])||
     senate.length!==35)return {ready:false,reason:'Missing national ballot identities',
      may_move_national_needle:false};
  return Object.freeze({ready:true,status:'OBSERVED_SOURCE_REPORTING_ONLY',
   checked_at:new Date(now).toISOString(),current_races_observed:observedTotal,
   offices:Object.fromEntries(Object.keys(count).map(k=>[k,{
    total:count[k],recent:(statuses[k].PRIMARY_OBSERVED_RECENT||0)+
     (statuses[k].SECONDARY_OBSERVED_RECENT||0),
    by_status:statuses[k]}])),
   senate:senate.sort((a,b)=>a.race.localeCompare(b.race)),
   provider_verified_professional_calls:0,
   may_move_national_needle:false,
   missing_is_zero_votes:false});
 }
 function render(summaryHost,senateHost,result,doc){
  if(!summaryHost||!senateHost||!doc)return false;
  summaryHost.replaceChildren();senateHost.replaceChildren();
  const create=(parent,tag,value)=>{
   const node=doc.createElement(tag);node.textContent=value;parent.appendChild(node);return node};
  if(!result?.ready){
   create(summaryHost,'span',result?.reason||'Live coverage audit unavailable');
   return false;
  }
  const o=result.offices;
  create(summaryHost,'span','SOURCE-OBSERVED RACES · House '+o.House.recent+'/435 · Senate '+
   o.Senate.recent+'/35 · Governors '+o.Governor.recent+
   '/36. Missing or unqueried ≠ zero votes; not professional calls or nationwide vote completeness.');
  create(senateHost,'p','All 35 Senate ballot identities · only source-validated, timely positive candidate counts count as reported. Source IDs alone do not count.');
  for(const entry of result.senate){
   const section=doc.createElement('div');
   create(section,'strong',entry.race.replace('Senate|',''));
   create(section,'span',' · '+entry.status.toLowerCase().replaceAll('_',' '));
   senateHost.appendChild(section);
  }
  return true;
 }
 return Object.freeze({audit,render});
});
