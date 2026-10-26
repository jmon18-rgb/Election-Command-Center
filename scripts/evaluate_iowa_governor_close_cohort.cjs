'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {forecast}=require('./iowa_county_needle.js');
const data=require('../data/iowa_governor_close_cohort_official.json');
const baseline=data.years['2010'],outcome=data.years['2018'];
const cells=baseline.counties.flatMap(c=>['absentee','election_day'].map(mode=>({county:c.county,mode,...c.records.total})));
const observationsByCounty=new Map(outcome.counties.map(c=>[c.county,c.records]));
const truth=100*(outcome.statewide.dem_votes-outcome.statewide.rep_votes)/(outcome.statewide.dem_votes+outcome.statewide.rep_votes);
const orders={absentee_first:(a,b)=>Number(b.mode==='absentee')-Number(a.mode==='absentee'),
 election_day_first:(a,b)=>Number(b.mode==='election_day')-Number(a.mode==='election_day'),
 small_counties_first:(a,b)=>a.dem_votes+a.rep_votes-b.dem_votes-b.rep_votes,
 large_counties_first:(a,b)=>b.dem_votes+b.rep_votes-a.dem_votes-a.rep_votes};
const snapshots=[];
for(const [order,sort] of Object.entries(orders))for(const fraction of [.1,.25,.5,.75]){
 const combined=new Map();
 for(const cell of [...cells].sort(sort).slice(0,Math.ceil(cells.length*fraction))){
  const row=combined.get(cell.county)||{county:cell.county,dem_votes:0,rep_votes:0};
  const actual=observationsByCounty.get(cell.county)[cell.mode];
  row.dem_votes+=actual.dem_votes;row.rep_votes+=actual.rep_votes;combined.set(cell.county,row);
 }
 const f=forecast({baseline,observations:[...combined.values()],prior_margin_points:0,prior_sigma_points:6});
 const naive=100*(f.counted_dem_votes-f.counted_rep_votes)/(f.counted_dem_votes+f.counted_rep_votes);
 snapshots.push({order,fraction_of_outcome_units_revealed:fraction,projected_margin:f.projected_margin_points,
  dem_win_probability:f.dem_win_probability,model_error:f.projected_margin_points-truth,
  naive_error:naive-truth,modeled_remaining_two_party_votes:f.modeled_remaining_two_party_votes,
  actual_remaining_two_party_votes:outcome.statewide.dem_votes+outcome.statewide.rep_votes-f.counted_dem_votes-f.counted_rep_votes,
  remaining_vote_scenario_band:f.modeled_remaining_two_party_votes_band,
  historical_method_split_reported:f.historical_method_split_reported,scenario_band:f.scenario_margin_band});
}
const bytes=fs.readFileSync(path.join(__dirname,'iowa_county_needle.js'));
const blob=crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
const firstModel='b4d96dec2e620f5988897cd8c15df02374720037';
const report={status:blob===firstModel?'SEPARATE_FIRST_USE_CLOSE_ELECTION_CHECK_NOT_CALIBRATION':'REUSED_CLOSE_ELECTION_DEVELOPMENT_CHECK_NOT_CALIBRATION',
 model_blob_sha1:blob,first_evaluation_model_blob_sha1:firstModel,outcome_seen_before_this_model_source:blob!==firstModel,
 baseline_year:2010,outcome_year:2018,outcome_margin:truth,same_office:true,office:'Governor, not Senate',
 prior:'Neutral six-point uncertainty stress prior, not reconstructed historical polling',
 limits:['Eight-year baseline gap','One election with correlated assumed release scenarios',
  'No recorded historical publication times','Historical baseline methods unreported; no split inferred',
  'Different office from the 2026 Senate pilot; no validated transfer or national update'],
 actual_historical_release_times:false,interval_calibrated:false,partial_scenarios:snapshots.length,
 model_partial_mae:snapshots.reduce((s,r)=>s+Math.abs(r.model_error),0)/snapshots.length,
 naive_partial_mae:snapshots.reduce((s,r)=>s+Math.abs(r.naive_error),0)/snapshots.length,
 scenario_band_contains_truth:snapshots.filter(r=>r.scenario_band[0]<=truth&&r.scenario_band[1]>=truth).length,snapshots};
report.remaining_vote_band_contains_truth=snapshots.filter(r=>r.remaining_vote_scenario_band[0]<=r.actual_remaining_two_party_votes&&
 r.remaining_vote_scenario_band[1]>=r.actual_remaining_two_party_votes).length;
const dir=path.join(__dirname,'../artifacts/readiness/iowa');fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,'governor-close-cohort-evaluation.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,snapshots:undefined}));
