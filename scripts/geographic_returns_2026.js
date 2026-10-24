/* Strict county-level election-night observation validator.
 * No forecasts, calls, or zero-vote substitutions for missing source data.
 */
(function(root,factory){
 // Browser scripts may load before the shared poll-close module. Resolve
 // at read-time rather than capturing an undefined global during startup.
 const api=factory(()=>typeof module!=='undefined'&&module.exports?
  require('./election_night_poll_closings_2026.js'):
  root?.ElectionNightPollClosings2026);
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.GeographicReturns2026=api;
})(typeof window!=='undefined'?window:null,function(getCloses){
 'use strict';
 const ELECTION='2026-11-03';
 const hasOwn=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
 const whole=x=>Number.isSafeInteger(x)&&x>=0;
 function validate(row){
  if(!row||typeof row!=='object'||Array.isArray(row))return null;
  if(row.election_date!==ELECTION||row.election_type!=='General'||
    row.is_test!==false||row.verified_source!==true)return null;
  if(typeof row.provider!=='string'||!/^[-_a-zA-Z0-9]{2,40}$/.test(row.provider)||
     typeof row.provider_race_id!=='string'||!row.provider_race_id.trim())return null;
  if(!['House','Senate','Governor'].includes(row.office)||
     typeof row.state!=='string'||!/^[A-Z]{2}$/.test(row.state)||
     typeof row.county_id!=='string'||!/^[0-9]{5}$/.test(row.county_id)||
     row.county_id.slice(0,2)!==row.state_fips)return null;
  if(typeof row.race_key!=='string'||!/^[A-Z]{2}-(?:[0-9]{2}|SEN|GOV)$/.test(row.race_key)||
     row.race_key.slice(0,2)!==row.state)return null;
  if((row.office==='House'&&!/^[A-Z]{2}-[0-9]{2}$/.test(row.race_key))||
     (row.office==='Senate'&&!row.race_key.endsWith('-SEN'))||
     (row.office==='Governor'&&!row.race_key.endsWith('-GOV')))return null;
  if(typeof row.updated_at!=='string'||!/^2026-11-(?:0[3-9]|[12][0-9]|30)T/.test(row.updated_at)||
     !Number.isFinite(Date.parse(row.updated_at)))return null;
  // County replay/bridge must not silently accept a post-election fetch of
  // a PRE-close result timestamp, even when the envelope is marked verified.
  const closes=getCloses();
  if(!closes||typeof closes.floorFor!=='function')return null;
  const floor=closes.floorFor(row.race_key);
  if(!Number.isFinite(floor)||
     (row.ballots_reported>0&&Date.parse(row.updated_at)<floor))return null;
  if(!['partial','final'].includes(row.reporting_status)||
     !whole(row.ballots_reported)||!Array.isArray(row.candidates)||
     row.candidates.length<2||row.candidates.length>20)return null;
  const seen=new Set();let sum=0;
  for(const c of row.candidates){
   if(!c||typeof c.name!=='string'||!c.name.trim()||
      typeof c.party!=='string'||!c.party.trim()||!whole(c.votes)||
      seen.has(c.name.toLowerCase()))return null;
   seen.add(c.name.toLowerCase());sum+=c.votes;
   if(!Number.isSafeInteger(sum))return null;
  }
  if(sum>row.ballots_reported)return null;
  return Object.freeze({...row,candidates:row.candidates.map(c=>Object.freeze({...c}))});
 }
 function reconcile(previous,incoming){
  const next=validate(incoming);
  if(!next)return {accepted:false,reason:'INVALID_OR_UNVERIFIED'};
  if(!previous)return {accepted:true,row:next};
  const prev=validate(previous);
  if(!prev)return {accepted:false,reason:'INVALID_PREVIOUS'};
  const identity=['provider','provider_race_id','election_date','race_key','county_id'];
  if(identity.some(k=>prev[k]!==next[k]))return {accepted:false,reason:'IDENTITY_MISMATCH'};
  if(Date.parse(next.updated_at)<=Date.parse(prev.updated_at))
   return {accepted:false,reason:'STALE_OR_DUPLICATE'};
  if(prev.reporting_status==='final'&&next.reporting_status!=='final')
   return {accepted:false,reason:'FINAL_REGRESSION'};
  // Later revisions may reduce prior count; authenticated corrections cannot
  // be assumed monotonic, but they must be explicitly identified as revisions.
  if(next.ballots_reported<prev.ballots_reported&&next.revision!==true)
   return {accepted:false,reason:'UNMARKED_DECREASE'};
  return {accepted:true,row:next};
 }
 return Object.freeze({validate,reconcile});
});
