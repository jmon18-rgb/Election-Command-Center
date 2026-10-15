/* Verified county × voting-mode comparator, RESEARCH ONLY.
 * Ingests *two independently source-attributed years* and reports precisely
 * what matched local units actually did. It cannot create national swing,
 * a win probability, ballots outstanding or an official race call.
 */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.CountyModeNeedle=factory();
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const MODES=new Set(['election_day','early_in_person','mail']);
 const START=Date.parse('2026-11-03T05:00:00Z'),MAX_STALENESS=3*3600000;
 const numeric=n=>Number.isSafeInteger(n)&&n>=0;
 function audit(record,now=Date.now()){
  if(!record||record.source_kind!=='official_state_elections'||
      !/^https:\/\/[^\s]+/.test(record.source_url||''))
   throw Error('Missing original official-source provenance');
  if(!/^[A-Z]{2}$/.test(record.state||'')||
     !/^\d{5}$/.test(record.county_fips||'')||
     !MODES.has(record.mode))throw Error('Invalid county or voting-method identity');
  if(record.historical?.year!==2024||record.current?.year!==2026||
     record.same_geography_verified!==true||
     record.same_vote_method_definition_verified!==true||
     record.historical.county_fips!==record.county_fips||
     record.current.county_fips!==record.county_fips||
     record.historical.mode!==record.mode||record.current.mode!==record.mode)
   throw Error('Unverified exact county×mode historical comparison');
  const t=Date.parse(record.current.updated_at||'');
  if(!Number.isFinite(t)||t<START||t>now+15*60000||now-t>MAX_STALENESS)
   throw Error('Unavailable/stale/future 2026 local vote timestamp');
  const old=record.historical,newVotes=record.current;
  for(const obj of [old,newVotes])
   if(!numeric(obj.dem_votes)||!numeric(obj.rep_votes)||
      obj.dem_votes+obj.rep_votes<1)throw Error('Invalid reported vote total');
  if(!Number.isFinite(newVotes.estimated_fraction_counted)||
      newVotes.estimated_fraction_counted<0||
      newVotes.estimated_fraction_counted>1||
      !['official_ballots_counted','documented_local_method'].includes(newVotes.reporting_basis))
   throw Error('No defensible estimated share of ballots counted');
  if(newVotes.estimated_fraction_counted<.80)
   return {qualified:false,key:record.county_fips+'|'+record.mode,
    reason:'Less than 80% of estimated ballots counted'};
  const prior=100*(old.dem_votes-old.rep_votes)/(old.dem_votes+old.rep_votes);
  const actual=100*(newVotes.dem_votes-newVotes.rep_votes)/
   (newVotes.dem_votes+newVotes.rep_votes);
  return {qualified:true,key:record.county_fips+'|'+record.mode,
   state:record.state,county_fips:record.county_fips,mode:record.mode,
   observed_2026_d_minus_r_points:+actual.toFixed(2),
   observed_2024_d_minus_r_points:+prior.toFixed(2),
   unadjusted_two_year_change_points:+(actual-prior).toFixed(2),
   votes_recorded:newVotes.dem_votes+newVotes.rep_votes,
   documented_fraction_counted:newVotes.estimated_fraction_counted,
   reviewed_source_url:record.source_url,source_time:record.current.updated_at};
 }
 function compare({records=[],now=Date.now()}={}){
  if(!Array.isArray(records))throw Error('County-mode feed must be a list');
  const keys=new Set(),qualified=[],notReady=[];
  for(const rec of records){
   const result=audit(rec,now);
   if(keys.has(result.key))throw Error('Duplicate county/mode can double-count votes');
   keys.add(result.key);
   if(result.qualified)qualified.push(result);
   else notReady.push(result);
  }
  const distinct=new Set(qualified.map(x=>x.county_fips)).size;
  const count=qualified.reduce((a,x)=>a+x.votes_recorded,0);
  // Useful only as a summary of OBSERVED eligible units. The same voter
  // can appear in exactly one county×mode. No statewide completion claims.
  const localSufficient=distinct>=3&&count>=10000;
  const sumW=qualified.reduce((a,x)=>a+Math.min(x.votes_recorded,20000),0);
  const descriptive=localSufficient&&sumW>0?
   qualified.reduce((a,x)=>a+Math.min(x.votes_recorded,20000)*
      x.unadjusted_two_year_change_points,0)/sumW:null;
  return Object.freeze({
   status:localSufficient?'OBSERVED_LOCAL_COUNTY_MODE_CHANGES_ONLY':
    'INSUFFICIENT_COMPLETED_LOCAL_COUNTY_MODE_UNITS',
   exact_counties:distinct,completed_mode_units:qualified.length,
   qualifying_two_party_votes:count,unready_mode_units:notReady.length,
   county_mode_results:qualified,unready:notReady,
   sampled_units_unadjusted_change_points:descriptive===null?null:+descriptive.toFixed(2),
   geography_calibrated_national_swing:false,
   shared_model_update_allowed:false,source_calls:0,
   ballots_remaining_forecast:null,
   limitations:'Selected completed counties/modes are not a representative US/state sample. '+
    'Voter turnout, candidate/presidential election difference and reporting order remain unmodeled.'
  });
 }
 return Object.freeze({MODES,START,MAX_STALENESS,audit,compare});
});
