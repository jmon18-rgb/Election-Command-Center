'use strict';
const fs=require('node:fs'),path=require('node:path');
const {forecast}=require('./iowa_county_needle.js');
const {years}=require('../data/iowa_senate_county_modes_official.json');
const truth=100*(years['2022'].statewide.dem_votes-years['2022'].statewide.rep_votes)/
 (years['2022'].statewide.dem_votes+years['2022'].statewide.rep_votes);
const cells=years['2020'].counties.flatMap(c=>['absentee','election_day'].map(mode=>({county:c.county,mode,...c.records[mode]})));
const outcomes=new Map(years['2022'].counties.map(c=>[c.county,c.records]));
const orders={absentee_first:(a,b)=>Number(b.mode==='absentee')-Number(a.mode==='absentee'),
 election_day_first:(a,b)=>Number(b.mode==='election_day')-Number(a.mode==='election_day'),
 small_units_first:(a,b)=>a.dem_votes+a.rep_votes-b.dem_votes-b.rep_votes,
 large_units_first:(a,b)=>b.dem_votes+b.rep_votes-a.dem_votes-a.rep_votes};
const snapshots=[];
for(const [order,sort] of Object.entries(orders))for(const fraction of [.1,.25,.5,.75]){
 const seen=new Map();
 for(const c of [...cells].sort(sort).slice(0,Math.ceil(cells.length*fraction))){
  const row=seen.get(c.county)||{county:c.county,dem_votes:0,rep_votes:0},actual=outcomes.get(c.county)[c.mode];
  row.dem_votes+=actual.dem_votes;row.rep_votes+=actual.rep_votes;seen.set(c.county,row);
 }
 const f=forecast({baseline:years['2020'],observations:[...seen.values()],prior_margin_points:0});
 const naive=100*(f.counted_dem_votes-f.counted_rep_votes)/(f.counted_dem_votes+f.counted_rep_votes);
 snapshots.push({order,fraction_of_historical_units_revealed:fraction,
  counted_two_party_votes:f.counted_dem_votes+f.counted_rep_votes,naive_counted_margin:naive,
  projected_margin:f.projected_margin_points,error_points:f.projected_margin_points-truth,
  naive_error_points:naive-truth,dem_win_probability:f.dem_win_probability,
  modeled_remaining_two_party_votes:f.modeled_remaining_two_party_votes,scenario_band:f.scenario_margin_band});
}
const result={status:'DEVELOPMENT_SCENARIOS_NOT_INDEPENDENT_CALIBRATION',baseline_year:2020,outcome_year:2022,
 actual_release_times:false,model_tuned_using_this_election:true,prior:'Neutral stress test, not reconstructed polls',
 truth_margin:truth,partial_scenarios:snapshots.length,
 model_margin_mae:snapshots.reduce((s,r)=>s+Math.abs(r.error_points),0)/snapshots.length,
 naive_margin_mae:snapshots.reduce((s,r)=>s+Math.abs(r.naive_error_points),0)/snapshots.length,
 scenario_band_contains_truth:snapshots.filter(r=>r.scenario_band[0]<=truth&&r.scenario_band[1]>=truth).length,
 snapshots};
const dir=path.join(__dirname,'../artifacts/readiness/iowa');fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,'combined-county-development-evaluation.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,snapshots:undefined}));
