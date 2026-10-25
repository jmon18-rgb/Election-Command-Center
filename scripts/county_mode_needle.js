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
 // Share previous SAME-SEAT election cycle with the 2026 county-mode
 // research gate. A 2024 presidential baseline cannot be mislabeled as
 // the prior North Carolina Class II Senate election (2020).
 function previousSeatYear(record){
  const research=typeof module!=='undefined'&&module.exports?
   require('./election_night_county_mode_signal.js'):
   typeof window!=='undefined'?window.ElectionNightCountySignal:null;
  return research?.baselineYear?.(record)??null;
 }
 const numeric=n=>Number.isSafeInteger(n)&&n>=0;
 // Resolve the canonical 50-state county FIPS checker at evaluation time:
 // the browser may load this research adapter before its source module.
 function canonicalCounty(state,fips){
  const identity=typeof module!=='undefined'&&module.exports?
   require('./election_night_state_county_fips_2026.js'):
   typeof window!=='undefined'?window.ElectionNightStateCountyFIPS2026:null;
  return identity?.matches?.(state,identity.PREFIX?.[state],fips)===true;
 }
 // Resolve the shared 50-state election close schedule when auditing.
 // An otherwise recent county/mode payload published BEFORE local close
 // cannot become valid simply because the dashboard clock advanced.
 function votesReleased(state,sourceStamp,total,now){
  const closes=typeof window!=='undefined'?
   window.ElectionNightPollClosings2026:
   typeof require==='function'?require('./election_night_poll_closings_2026.js'):null;
  return Boolean(closes&&typeof closes.allowed==='function'&&
   closes.allowed(state+'-SEN',total,sourceStamp,now));
 }
 function audit(record,now=Date.now()){
  if(!record||record.source_kind!=='official_state_elections'||
      !/^https:\/\/[^\s]+/.test(record.source_url||''))
   throw Error('Missing original official-source provenance');
  if(!/^[A-Z]{2}$/.test(record.state||'')||
     !/^\d{5}$/.test(record.county_fips||'')||
     !canonicalCounty(record.state,record.county_fips)||
     !MODES.has(record.mode))throw Error('Invalid county or voting-method identity');
  const historicalYear=previousSeatYear(record);
  if(historicalYear===null||
     record.historical?.year!==historicalYear||
     record.historical?.office!==record.office||
     record.historical?.race_code!==record.race_code||
     record.current?.year!==2026||
     record.current.office!==record.office||
     record.current.race_code!==record.race_code||
     record.same_geography_verified!==true||
     record.same_vote_method_definition_verified!==true||
     record.historical.county_fips!==record.county_fips||
     record.current.county_fips!==record.county_fips||
     record.historical.mode!==record.mode||record.current.mode!==record.mode)
   throw Error('Unverified exact county×mode historical comparison');
  // Require an explicit source timezone; Date.parse otherwise treats a
  // naive local-clock string as a plausible reported election result.
  if(typeof record.current.updated_at!=='string'||
     !/^2026-11-(?:0[3-9]|[12][0-9]|30)T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(record.current.updated_at))
   throw Error('Unavailable/stale/future 2026 local vote timestamp');
  const t=Date.parse(record.current.updated_at||'');
  if(!Number.isFinite(t)||t<START||t>now+15*60000||now-t>MAX_STALENESS)
   throw Error('Unavailable/stale/future 2026 local vote timestamp');
  const old=record.historical,newVotes=record.current;
  for(const obj of [old,newVotes])
   if(!numeric(obj.dem_votes)||!numeric(obj.rep_votes)||
      !Number.isSafeInteger(obj.dem_votes+obj.rep_votes)||
      obj.dem_votes+obj.rep_votes<1)throw Error('Invalid reported vote total');
  if(!votesReleased(record.state,newVotes.updated_at,
     newVotes.dem_votes+newVotes.rep_votes,now))
   throw Error('Pre-close or unverified 2026 local vote release');
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
   previous_same_seat_election_year:historicalYear,
   previous_same_seat_office:record.office,
   observed_previous_election_d_minus_r_points:+prior.toFixed(2),
   unadjusted_previous_election_change_points:+(actual-prior).toFixed(2),
   votes_recorded:newVotes.dem_votes+newVotes.rep_votes,
   documented_fraction_counted:newVotes.estimated_fraction_counted,
   reviewed_source_url:record.source_url,source_time:record.current.updated_at};
 }
 function compare({records=[],now=Date.now()}={}){
  if(!Array.isArray(records)||records.length>5000)
   throw Error('County-mode feed must be a bounded list');
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
  // A simple average of modes from two different states has no defined
  // election-level reference population. Preserve eligible county detail
  // but withhold the combined residual until a state-specific model exists.
  const states=[...new Set(qualified.map(x=>x.state))].sort();
  const mixedStates=states.length>1;
  const localSufficient=!mixedStates&&distinct>=3&&count>=10000&&
   Number.isSafeInteger(count);
  const sumW=qualified.reduce((a,x)=>a+Math.min(x.votes_recorded,20000),0);
  const descriptive=localSufficient&&sumW>0?
   qualified.reduce((a,x)=>a+Math.min(x.votes_recorded,20000)*
      x.unadjusted_previous_election_change_points,0)/sumW:null;
  return Object.freeze({
   status:mixedStates?'MIXED_STATES_NO_LOCAL_MODE_SUMMARY':
    localSufficient?'OBSERVED_LOCAL_COUNTY_MODE_CHANGES_ONLY':
    'INSUFFICIENT_COMPLETED_LOCAL_COUNTY_MODE_UNITS',
   state_scope:states,
   exact_counties:distinct,completed_mode_units:qualified.length,
   qualifying_two_party_votes:count,unready_mode_units:notReady.length,
   county_mode_results:qualified,unready:notReady,
   sampled_units_unadjusted_change_points:descriptive===null?null:+descriptive.toFixed(2),
   geography_calibrated_national_swing:false,
   shared_model_update_allowed:false,source_calls:0,
   ballots_remaining_forecast:null,
   limitations:'Selected completed counties/modes are not a representative US/state sample. '+
    'Comparisons require matching office, seat and 2026 geographic boundaries; '+
    'candidate, turnout, electorate composition and reporting order remain unmodeled.'
  });
 }
 return Object.freeze({MODES,START,MAX_STALENESS,audit,compare});
});
