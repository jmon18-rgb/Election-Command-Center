/* Deterministic county snapshot ingestion. No implied zero votes or forecast. */
(function(root,factory){
 const api=factory(typeof module!=='undefined'&&module.exports?
  require('./geographic_swing_bridge_2026'):root.GeographicSwingBridge2026);
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.GeographicCountyBatch2026=api;
})(typeof window!=='undefined'?window:null,function(bridge){
 'use strict';
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 // Internal eligibility metadata travels with last-good AUDIT counts, including
 // ordinary JSON round-trips. It is not a source timestamp or a vote revision.
 const quarantineSchema='county-advisory-quarantine-v1';
 const revisionProblems=new Set(['UNMARKED_DECREASE','UNMARKED_CANDIDATE_DECREASE',
  'UNMARKED_CANDIDATE_REMOVAL','UNMARKED_CANDIDATE_PARTY_CHANGE',
  'FINAL_REGRESSION','IDENTITY_MISMATCH','CONFLICTING_STALE_OR_DUPLICATE']);
 function validQuarantine(value){
  return value&&typeof value==='object'&&!Array.isArray(value)&&
   value.schema===quarantineSchema&&revisionProblems.has(value.reason)&&
   typeof value.source_updated_at==='string'&&
   /(?:Z|[+-]\d\d:\d\d)$/.test(value.source_updated_at)&&
   Number.isFinite(Date.parse(value.source_updated_at));
 }
 function sameSnapshot(old,incoming){
  const fields=['provider','provider_race_id','race_key','county_id',
   'updated_at','ballots_reported','reporting_status'];
  return old&&incoming&&fields.every(k=>old[k]===incoming[k])&&
   Array.isArray(old.candidates)&&Array.isArray(incoming.candidates)&&
   JSON.stringify(old.candidates)===JSON.stringify(incoming.candidates);
 }
 function quarantine(old,incoming,reason){
  // This path is reached only for validated identity/revision conflicts.
  // Retain malformed prior metadata rather than inventing a recovery clock.
  if(own(old,'advisory_quarantine')&&!validQuarantine(old.advisory_quarantine))return old;
  const stamps=[old.updated_at,incoming.updated_at,
   ...(own(old,'advisory_quarantine')?[old.advisory_quarantine.source_updated_at]:[])];
  const source_updated_at=stamps.reduce((latest,stamp)=>Date.parse(stamp)>Date.parse(latest)?stamp:latest);
  return Object.freeze({...old,advisory_quarantine:Object.freeze({
   schema:quarantineSchema,source_updated_at,reason})});
 }
 function process(previous,observations,baselines={},now=Date.now()){
  if(!bridge||!Number.isFinite(now)||!Array.isArray(observations)||!observations.length||
     observations.length>10000||!previous||typeof previous!=='object'||
     Array.isArray(previous)||!baselines||typeof baselines!=='object')
   return {accepted:false,reason:'INVALID_BATCH'};
  const next=Object.assign(Object.create(null),previous);
  const updates=[],rejected=[];
  for(const incoming of observations){
   // Never trust caller-controlled dictionary keys as geographic identity.
   const id=typeof incoming?.race_key==='string'&&
    typeof incoming?.county_id==='string'?
    incoming.race_key+'|'+incoming.county_id:null;
   if(!id||!/^([A-Z]{2}-(?:SEN|GOV|\d{2}))\|\d{5}$/.test(id)){
    rejected.push({id:null,reason:'INVALID_IDENTITY'});continue;
   }
   const old=own(next,id)?next[id]:null;
   const base=own(baselines,id)?baselines[id]:null;
   const outcome=bridge.apply(old,incoming,base,now);
   if(!outcome.accepted){
    const reason=outcome.reason==='STALE_OR_DUPLICATE'&&!sameSnapshot(old,incoming)?
     'CONFLICTING_STALE_OR_DUPLICATE':outcome.reason;
    if(old&&revisionProblems.has(reason))next[id]=quarantine(old,incoming,reason);
    rejected.push({id,reason:outcome.reason});continue;
   }
   if(old&&own(old,'advisory_quarantine')){
    const held=old.advisory_quarantine;
    if(!validQuarantine(held)||incoming.revision!==true||
       Date.parse(incoming.updated_at)<=Math.max(Date.parse(old.updated_at),Date.parse(held.source_updated_at))){
     rejected.push({id,reason:'ADVISORY_QUARANTINE_REQUIRES_NEWER_REVISION'});continue;
    }
   }
   // Provider fields cannot create/clear internal eligibility metadata.
   const {advisory_quarantine:ignored,...clean}=outcome.row;
   next[id]=Object.freeze(clean);
   updates.push({id,mode:outcome.mode,swing:outcome.swing});
  }
  return {accepted:true,rows:next,updates,rejected,
   may_move_national_needle:false};
 }
 return Object.freeze({process});
});
