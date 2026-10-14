/* Bottom-up 2026 election-environment research, WITHOUT treating a
 * nationally unrepresentative set of polled battlegrounds as a poll.
 * Does not update headline or synthesize unseen polls. */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.JackBottomUpEnvironment=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 const clip=(x,lo,hi)=>Math.min(hi,Math.max(lo,x));
 const rounded=x=>Math.round(x*1000)/1000;
 function evaluate(polls,pres){
  if(!polls||!Array.isArray(polls.house)||!Array.isArray(polls.senate_all)||
    !finite(polls.generic_ballot?.dem_minus_rep)||
    pres?.schema_version!=='presidential-district-lean-staging-v1'||
    pres.district_map_year_claimed!==2026||pres.records?.length!==435)
   throw Error('Missing geography-correct polling input');
  const districts=new Map(),stateTotals=new Map();
  let nationalDem=0,nationalRep=0;
  for(const row of pres.records){
   if(districts.has(row.race_code)||
      !Number.isSafeInteger(row.dem_pres_2024_votes)||row.dem_pres_2024_votes<=0||
      !Number.isSafeInteger(row.rep_pres_2024_votes)||row.rep_pres_2024_votes<=0)
    throw Error('Invalid or duplicate presidential geography '+row.race_code);
   districts.set(row.race_code,row);
   let totals=stateTotals.get(row.state)||{dem:0,rep:0};
   totals.dem+=row.dem_pres_2024_votes;
   totals.rep+=row.rep_pres_2024_votes;
   stateTotals.set(row.state,totals);
   nationalDem+=row.dem_pres_2024_votes;
   nationalRep+=row.rep_pres_2024_votes;
  }
  if(districts.size!==435)throw Error('Incomplete presidential geography');
  const margin=(d,r)=>100*(d-r)/(d+r);
  const national2024=margin(nationalDem,nationalRep);
  const generic=polls.generic_ballot.dem_minus_rep;
  const qualified=[],rejects={inadequate_polling:0,stale:0,not_competitive:0,missing_geography:0};
  for(const [office,races] of [['house',polls.house],['senate',polls.senate_all]]){
   for(const r of races){
    if(!['multi_poll','single_poll'].includes(r.status)||!finite(r.dem_minus_rep))continue;
    const n=r.independent_pollsters,age=r.poll_diagnostics?.latest_poll_age_days;
    if(!Number.isInteger(n)||n<2||r.contributing_pollsters<3){rejects.inadequate_polling++;continue}
    if(!finite(age)||age>21){rejects.stale++;continue}
    const geo=office==='house'?districts.get(r.race_code):stateTotals.get(r.state);
    if(!geo){rejects.missing_geography++;continue}
    const geoMargin=office==='house'?margin(geo.dem_pres_2024_votes,geo.rep_pres_2024_votes):
     margin(geo.dem,geo.rep);
    // CANTOR-inspired similarity, not a copy: disregard districts farther
    // than 20 pts from nationwide 2024 geography. One state's eight
    // polled congressional districts must not represent eight states.
    const distance=Math.abs(geoMargin-national2024);
    if(distance>20){rejects.not_competitive++;continue}
    const quality=Math.min(1,n/4)*Math.max(.45,1-age/45)*
     (office==='house'?.70:1);
    // Large implausible differences can be caused by a candidate rather
    // than national swing; cap influence, don't mislabel a local effect.
    const rawSwing=r.dem_minus_rep-geoMargin;
    qualified.push({office,race_code:r.race_code,state:r.state,
     presidential_2024_margin:rounded(geoMargin),
     poll_margin:rounded(r.dem_minus_rep),raw_swing_points:rounded(rawSwing),
     capped_swing_points:rounded(clip(rawSwing,-22,22)),
     capped_local_outlier:Math.abs(rawSwing)>22,
     weight:quality,independent_firms:n,latest_age_days:age});
   }
  }
  if(qualified.length<12)throw Error('Insufficient independent 2026 race polling');
  qualified.sort((a,b)=>a.office.localeCompare(b.office)||
    a.race_code.localeCompare(b.race_code));
  const stateGroups=new Map();
  for(const row of qualified){const group=stateGroups.get(row.state)||[];
   group.push(row);stateGroups.set(row.state,group);}
  // Equal weight per state; 1+ Senate and 10 House seats in the same
  // state cannot dominate the national snapshot via duplicate geography.
  const stateSummaries=[...stateGroups].map(([state,items])=>{
   const denom=items.reduce((a,r)=>a+r.weight,0);
   return {state,number_qualifying_races:items.length,
    swing_points:items.reduce((a,r)=>a+r.capped_swing_points*r.weight,0)/denom};
  }).sort((a,b)=>a.swing_points-b.swing_points);
  if(stateSummaries.length<8)throw Error('Too few independently sampled states');
  // Trim one extreme state at each end when enough independent states.
  const removed=Math.floor(stateSummaries.length*.10);
  const kept=stateSummaries.slice(removed,stateSummaries.length-removed);
  const estimate=kept.reduce((a,r)=>a+r.swing_points,0)/kept.length;
  const delta=estimate-(generic-national2024);
  const result={
   schema_version:'bottom-up-2026-poll-environment-shadow-v1',
   status:'SELECTION_BIASED_OBSERVATIONAL_DIAGNOSTIC_NOT_HEADLINE',
   polling_generated_at:polls.generated_at,
   presidential_geography_year:2026,
   presidential_2024_national_two_party_margin_points:rounded(national2024),
   generic_ballot_2026_d_minus_r_points:rounded(generic),
   generic_implied_vs_2024_presidential_swing_points:rounded(generic-national2024),
   independent_polling_estimated_presidential_to_race_swing_points:rounded(estimate),
   bottom_up_implied_national_margin_points:rounded(national2024+estimate),
   bottom_up_minus_generic_environment_points:rounded(delta),
   candidate_specific_effects_removed:false,
   candidate_quality_calibration_available:false,
   total_qualifying_races:qualified.length,
   states_with_qualified_races:stateSummaries.length,
   trimmed_states_each_tail:removed,
   qualifying_house_races:qualified.filter(x=>x.office==='house').length,
   qualifying_senate_races:qualified.filter(x=>x.office==='senate').length,
   excluded:rejects,
   state_swing_samples:stateSummaries.map(x=>({...x,swing_points:rounded(x.swing_points)})),
   examples:qualified.filter(x=>['MN-SEN','TX-SEN','PA-10','AZ-01'].includes(x.race_code)),
   notes:[
    'Uses current 2026 independent polling only, compared with 2024 presidential margins on 2026 House boundaries or state totals.',
    'Election-day congressional vs past presidential vote is not necessarily the generic ballot; differing ballot electorates and candidate quality are unmodeled.',
    'Polled races are disproportionately competitive or newsworthy, not a random nationally representative sample.',
    'Selection and candidate bias prevent promoting this environmental gap to a 2026 headline forecast without holdout validation.',
    'State capping, moderate geo-lean inclusion, and trimming are robustness choices, not Silver proprietary coefficients.'
   ]
  };
  return result;
 }
 return Object.freeze({evaluate});
});
