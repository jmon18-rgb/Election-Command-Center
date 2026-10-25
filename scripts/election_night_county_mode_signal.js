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
 // A historical county/mode datum must compare the SAME ballot office and
 // elected seat, not an arbitrarily selected 2024 presidential/Senate year.
 // 2026 regular Senate Class II was last elected in 2020; FL/OH Class III
 // specials were last elected in 2022. House seats last ran in 2024.
 // Governors last ran in 2022 except biennial NH and VT (2024).
 // The unit's 2026 geography still needs an independently verified crosswalk.
 const HOUSE_SEATS=Object.freeze({"AK":1,"AL":7,"AR":4,"AZ":9,"CA":52,"CO":8,"CT":5,"DE":1,"FL":28,"GA":14,"HI":2,"IA":4,"ID":2,"IL":17,"IN":9,"KS":4,"KY":6,"LA":6,"MA":9,"MD":8,"ME":2,"MI":13,"MN":8,"MO":8,"MS":4,"MT":2,"NC":14,"ND":1,"NE":3,"NH":2,"NJ":12,"NM":3,"NV":4,"NY":26,"OH":15,"OK":5,"OR":6,"PA":17,"RI":2,"SC":7,"SD":1,"TN":9,"TX":38,"UT":4,"VA":11,"VT":1,"WA":10,"WI":8,"WV":2,"WY":1});
 const SENATE_RACES=new Set(["AK","AL","AR","CO","DE","FL-special","GA","IA","ID","IL","KS","KY","LA","MA","ME","MI","MN","MS","MT","NC","NE","NH","NJ","NM","OH-special","OK","OR","RI","SC","SD","TN","TX","VA","WV","WY"]);
 const GOVERNOR_RACES=new Set(["AK","AL","AR","AZ","CA","CO","CT","FL","GA","HI","IA","ID","IL","KS","MA","MD","ME","MI","MN","NE","NH","NM","NV","NY","OH","OK","OR","PA","RI","SC","SD","TN","TX","VT","WI","WY"]);
 function baselineYear(input){
  const office=input?.office,code=input?.race_code,kind=input?.election_kind;
  if(typeof code!=='string'||!['regular','special'].includes(kind))
   return null;
  const state=code.slice(0,2);
  if(office==='house'){
   const n=HOUSE_SEATS[state],number=code.slice(3);
   if(kind!=='regular'||!Number.isInteger(n)||
      !/^[A-Z]{2}-\\d{2}$/.test(code)||
      !(n===1?number==='00':number!=='00'&&Number(number)>=1&&Number(number)<=n))
    return null;
   return 2024;
  }
  if(office==='governor'){
   if(kind!=='regular'||code!==state+'-GOV'||!GOVERNOR_RACES.has(state))return null;
   return state==='NH'||state==='VT'?2024:2022;
  }
  if(office==='senate'){
   if(code!==state+'-SEN')return null;
   const special=state==='FL'||state==='OH';
   if(!SENATE_RACES.has(state+(special?'-special':''))||
      kind!==(special?'special':'regular'))return null;
   return special?2022:2020;
  }
  return null;
 }

 const goodInt=n=>Number.isSafeInteger(n)&&n>=0;
 const goodLink=u=>typeof u==='string'&&/^https:\/\//.test(u);
 const fail=why=>Object.freeze({eligible:false,reason:why,may_move_national_needle:false});
 function isCanonicalCounty(state,fips){
  const canonical=typeof module!=='undefined'&&module.exports?
   require('./election_night_state_county_fips_2026.js'):
   typeof window!=='undefined'?window.ElectionNightStateCountyFIPS2026:null;
  return canonical?.matches?.(state,canonical.PREFIX?.[state],fips)===true;
 }
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
    !/^[A-Z]{2}-(?:SEN|GOV|\d{2})$/.test(input.race_code||'')||
    (input.office==='senate'&&!input.race_code.endsWith('-SEN'))||
    (input.office==='governor'&&!input.race_code.endsWith('-GOV'))||
    (input.office==='house'&&!/^[A-Z]{2}-\d{2}$/.test(input.race_code)))
   return fail('race_identity_unverified');
  const historicalYear=baselineYear(input);
  if(historicalYear===null)return fail('race_identity_unverified');
  if(input.baseline_source?.election_year!==historicalYear||
     input.baseline_source?.office!==input.office)
   return fail('historical_election_or_office_mismatch');
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
  if(!Array.isArray(input.units)||!input.units.length||input.units.length>5000||
    !goodInt(input.expected_statewide_two_party_ballots)||
    input.expected_statewide_two_party_ballots<10000)
   return fail('unverified_total_ballot_denominator');
  const seen=new Set(),counties=new Set();
  let observed=0,coveredExpected=0,localWeightedResidual=0;
  for(const x of input.units){
   const county=typeof x?.geography_id==='string'?
    /^([A-Z]{2}):([0-9]{5})@2026$/.exec(x.geography_id):null;
   if(!x||!county||county[1]!==input.race_code.slice(0,2)||
      !isCanonicalCounty(county[1],county[2])||
      !['early','election_day','mail'].includes(x.vote_mode))
    return fail('invalid_unit_geometry_or_mode');
   const id=x.geography_id+'|'+x.vote_mode;
   if(seen.has(id))return fail('duplicate_county_mode');
   seen.add(id);counties.add(x.geography_id);
   const b=x.baseline,o=x.observed;
   if(!b||b.year!==historicalYear||b.office!==input.office||
       b.race_code!==input.race_code||
       b.geography_id!==x.geography_id||
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
   if(!Number.isSafeInteger(observed)||!Number.isSafeInteger(coveredExpected)||
      !Number.isFinite(localWeightedResidual))
    return fail('inconsistent_reported_or_expected_votes');
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
 return Object.freeze({evaluate,baselineYear});
});
