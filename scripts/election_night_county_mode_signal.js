/* County x voting-method signal gate — 2026 Election Night research.
 * No actual source is plugged in; NEVER modifies race/chamber probabilities.
 * Source schema requires both 2024 baseline and 2026 count to be reported
 * on IDENTICAL county / mode / 2026 boundary IDs with full state exposure.
 */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.ElectionNightCountySignal=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const start=Date.parse('2026-11-03T05:00:00Z');
 const goodInt=n=>Number.isSafeInteger(n)&&n>=0;
 const goodLink=u=>typeof u==='string'&&/^https:\/\//.test(u);
 const fail=why=>Object.freeze({eligible:false,reason:why,may_move_national_needle:false});
 // A valid election-cycle date is not evidence that precincts in THIS
 // state have finished voting. Require both publication and viewer clock
 // to clear the canonical state earliest-close rule, never just a
 // plausible 2026 result envelope downloaded after the fact.
 function actualPollsClosed(raceCode,sourceTime,now){
  const closes=typeof window!=='undefined'?
   window.ElectionNightPollClosings2026:
   typeof require==='function'?require('./election_night_poll_closings_2026.js'):null;
  return Boolean(closes&&typeof closes.allowed==='function'&&
   closes.allowed(raceCode,1,sourceTime,now));
 }
 function evaluate(input,now=Date.now()){
  if(input?.election!=='2026-11-03'||!['senate','house','governor'].includes(input.office)||
    !/^[A-Z]{2}-(?:SEN|GOV|\d{2})$/.test(input.race_code||''))
   return fail('race_identity_unverified');
  const t=Date.parse(input.as_of||'');
  if(!Number.isFinite(t)||t<start||t>now+15*60000||now-t>180*60000)
   return fail('source_timestamp_not_current');
  if(!actualPollsClosed(input.race_code,input.as_of,now))
   return fail('state_poll_closure_not_satisfied');
  if(input.is_test!==false||input.source?.is_test!==false)
   return fail('live_source_not_confirmed_nonmock');
  if(input.source?.validated!==true||input.baseline_source?.validated!==true||
    !goodLink(input.source.url)||!goodLink(input.baseline_source.url))
   return fail('source_provenance_missing');
  if(!Array.isArray(input.units)||!input.units.length||
    !goodInt(input.expected_statewide_two_party_ballots)||
    input.expected_statewide_two_party_ballots<10000)
   return fail('unverified_total_ballot_denominator');
  const seen=new Set(),counties=new Set();
  let observed=0,coveredExpected=0,localWeightedResidual=0;
  for(const x of input.units){
   if(!x||!/^\w{2}:\w[\w-]{1,70}@2026$/.test(x.geography_id||'')||
      x.geography_id.slice(0,2)!==input.race_code.slice(0,2)||
      !['early','election_day','mail'].includes(x.vote_mode))
    return fail('invalid_unit_geometry_or_mode');
   const id=x.geography_id+'|'+x.vote_mode;
   if(seen.has(id))return fail('duplicate_county_mode');
   seen.add(id);counties.add(x.geography_id);
   const b=x.baseline,o=x.observed;
   if(!b||b.year!==2024||b.geography_id!==x.geography_id||
       b.vote_mode!==x.vote_mode||b.exact_geography_match!==true)
    return fail('historical_geography_or_vote_mode_mismatch');
   if(![b.dem,b.rep,o?.dem,o?.rep,x.expected_final_two_party_ballots].every(goodInt)||
       b.dem+b.rep<100||o.dem+o.rep<100||
       x.expected_final_two_party_ballots<o.dem+o.rep ||
       x.expected_final_two_party_ballots<100)
    return fail('inconsistent_reported_or_expected_votes');
   if(!Number.isFinite(x.reporting_fraction)||x.reporting_fraction<0||
      x.reporting_fraction>1)return fail('invalid_reporting_fraction');
   // A count of 75% precincts is NOT sufficient. This must come from
   // source-verified estimated ballots and counties must be representative.
   const ballots=o.dem+o.rep;
   if(Math.abs(ballots/x.expected_final_two_party_ballots-x.reporting_fraction)>.10)
    return fail('precinct_count_confused_with_ballots');
   const bShare=b.dem/(b.dem+b.rep),share=o.dem/ballots;
   localWeightedResidual+=ballots*(share-bShare);
   observed+=ballots;coveredExpected+=x.expected_final_two_party_ballots;
  }
  const stateDen=input.expected_statewide_two_party_ballots;
  if(coveredExpected>stateDen*1.05)return fail('local_ballot_universe_exceeds_state');
  const geographicCoverage=coveredExpected/stateDen;
  const totalFraction=observed/stateDen;
  if(counties.size<3||coveredExpected<15000||geographicCoverage<.80||
     totalFraction<.65)return fail('reporting_geography_insufficient');
  // Two-party D-minus-R margin changes twice as fast as Democratic share.
  const observedResidualPoints=200*localWeightedResidual/observed;
  // Diagnostic only: selection effects and different electorate/office
  // comparability are not certified by the presence of geographic matches.
  return Object.freeze({
   eligible:true,kind:'LOCAL_COUNTY_MODE_RESIDUAL_NOT_NATIONAL_FORECAST',
   county_count:counties.size,county_method_cells:seen.size,
   reported_two_party_ballots:observed,
   estimated_state_ballots:stateDen,
   state_ballot_fraction:Math.round(1000*totalFraction)/1000,
   matched_geography_fraction:Math.round(1000*geographicCoverage)/1000,
   observed_d_minus_r_residual_points:Math.round(1000*observedResidualPoints)/1000,
   methods:[...new Set(input.units.map(x=>x.vote_mode))].sort(),
   as_of:input.as_of,
   may_move_national_needle:false,
   interpretation:'Historical comparable county x vote method residual, no validated uncertainty calibration. No race call, statewide nowcast, or chamber adjustment.'
  });
 }
 return Object.freeze({evaluate});
});
