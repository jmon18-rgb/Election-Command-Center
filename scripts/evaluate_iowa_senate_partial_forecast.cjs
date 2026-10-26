'use strict';
const fs=require('node:fs'),path=require('node:path');
const {forecast,cellsFromOfficialYear}=require('./iowa_senate_partial_forecast.cjs');
const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/iowa_senate_county_modes_official.json'),'utf8'));
const baseline=cellsFromOfficialYear(raw.years['2020']);
const outcomes=new Map(cellsFromOfficialYear(raw.years['2022']).map(r=>[r.county+'|'+r.mode,r]));
const truth=100*(raw.years['2022'].statewide.dem_votes-raw.years['2022'].statewide.rep_votes)/
 (raw.years['2022'].statewide.dem_votes+raw.years['2022'].statewide.rep_votes);
const orderings={absentee_first:(a,b)=>Number(b.mode==='absentee')-Number(a.mode==='absentee'),
 election_day_first:(a,b)=>Number(b.mode==='election_day')-Number(a.mode==='election_day'),
 small_counties_first:(a,b)=>a.dem_votes+a.rep_votes-b.dem_votes-b.rep_votes,
 large_counties_first:(a,b)=>b.dem_votes+b.rep_votes-a.dem_votes-a.rep_votes};
const scenarios=[];
for(const [name,order] of Object.entries(orderings)){
 const ordered=[...baseline].sort(order);
 const snapshots=[];
 for(const fraction of [.1,.25,.5,.75,1]){
  const observations=ordered.slice(0,Math.ceil(ordered.length*fraction)).map(r=>({...outcomes.get(r.county+'|'+r.mode),complete:true}));
  const f=forecast({baseline,observations,prior_margin_points:0,prior_sigma_points:6});
  const d=observations.reduce((s,r)=>s+r.dem_votes,0),r=observations.reduce((s,r)=>s+r.rep_votes,0);
  snapshots.push({fraction_of_units_revealed:fraction,actual_counted_two_party_votes:d+r,
   projected_margin:f.projected_d_minus_r_margin_points,
   model_error_points:f.projected_d_minus_r_margin_points-truth,
   naive_counted_margin:100*(d-r)/(d+r),naive_error_points:100*(d-r)/(d+r)-truth,
   dem_win_probability:f.dem_win_probability,remaining:f.modeled_remaining_two_party_votes,
   model_interval_90:f.model_margin_interval_90_points});
 }
 scenarios.push({name,snapshots});
}
const partial=scenarios.flatMap(s=>s.snapshots.filter(x=>x.fraction_of_units_revealed<1));
const result={status:'HISTORICAL_VOTES_ASSUMED_RELEASE_ORDER_EXPERIMENT_NOT_CLOCK_CALIBRATION',
 baseline_year:2020,evaluation_year:2022,evaluation_seat:'Different Iowa Senate class; same statewide office',
 prior:'Prespecified neutral margin and 6-point sigma; NOT a reconstructed 2022 polling forecast',
 truth_margin:truth,model_partial_mae:partial.reduce((s,x)=>s+Math.abs(x.model_error_points),0)/partial.length,
 naive_partial_mae:partial.reduce((s,x)=>s+Math.abs(x.naive_error_points),0)/partial.length,
 model_interval_contains_truth_partial:partial.filter(x=>x.model_interval_90[0]<=truth&&x.model_interval_90[1]>=truth).length,
 partial_scenarios:partial.length,
 actual_historical_reporting_order:false,interval_calibrated:false,live_source_connected:false,scenarios};
if(require.main===module){const out=path.join(__dirname,'../artifacts/readiness/iowa');fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,'historical-scenario-evaluation.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));}
module.exports=result;
