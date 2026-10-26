'use strict';
const fs=require('node:fs'),path=require('node:path');
const {forecast}=require('./iowa_county_needle.js');
const {baselineFor}=require('./kansas_county_needle.cjs');
const facts=require('../data/kansas_senate_county_facts_official.json');
const baseline=baselineFor(2020),outcome=facts.years['2022'];
const truth=100*(outcome.statewide.D-outcome.statewide.R)/(outcome.statewide.D+outcome.statewide.R);
if(!Number.isFinite(truth))throw Error('Invalid official Kansas outcome');
const share=c=>c.dem_votes/(c.dem_votes+c.rep_votes);
const orders={small_counties_first:(a,b)=>a.dem_votes+a.rep_votes-b.dem_votes-b.rep_votes,
 large_counties_first:(a,b)=>b.dem_votes+b.rep_votes-a.dem_votes-a.rep_votes,
 democratic_counties_first:(a,b)=>share(b)-share(a),republican_counties_first:(a,b)=>share(a)-share(b)};
const snapshots=[];
for(const [order,sort] of Object.entries(orders))for(const fraction of [.1,.25,.5,.75]){
 const observations=[...outcome.counties].sort(sort).slice(0,Math.ceil(105*fraction));
 const f=forecast({baseline,observations,expected_county_count:105,prior_margin_points:0});
 const naive=100*(f.counted_dem_votes-f.counted_rep_votes)/(f.counted_dem_votes+f.counted_rep_votes);
 snapshots.push({order,fraction_of_counties_revealed:fraction,projected_margin:f.projected_margin_points,
  model_error:f.projected_margin_points-truth,naive_error:naive-truth,dem_win_probability:f.dem_win_probability,
  scenario_band:f.scenario_margin_band,remaining_vote_scenario_band:f.modeled_remaining_two_party_votes_band,
  actual_remaining_two_party_votes:outcome.statewide.D+outcome.statewide.R-f.counted_dem_votes-f.counted_rep_votes});
}
const mean=values=>values.reduce((a,b)=>a+b,0)/values.length,y=Number(truth>0);
const report={status:'KANSAS_HISTORICAL_DEVELOPMENT_STRESS_TEST_NOT_CALIBRATION',baseline_year:2020,outcome_year:2022,
 truth_margin:truth,prior_margin:0,prior_only_margin_mae:Math.abs(truth),prior_only_brier_score:.25,
 prior_only_log_loss:Math.log(2),model_margin_mae:mean(snapshots.map(r=>Math.abs(r.model_error))),
 naive_margin_mae:mean(snapshots.map(r=>Math.abs(r.naive_error))),
 model_brier_score:mean(snapshots.map(r=>(r.dem_win_probability-y)**2)),
 model_log_loss:mean(snapshots.map(r=>-Math.log(Math.max(1e-15,y?r.dem_win_probability:1-r.dem_win_probability)))),
 scenario_band_contains_truth:snapshots.filter(r=>r.scenario_band[0]<=truth&&r.scenario_band[1]>=truth).length,
 remaining_vote_band_contains_truth:snapshots.filter(r=>r.remaining_vote_scenario_band[0]<=r.actual_remaining_two_party_votes&&r.remaining_vote_scenario_band[1]>=r.actual_remaining_two_party_votes).length,
 partial_scenarios:snapshots.length,interval_calibrated:false,actual_release_times:false,
 limitations:['Different Senate class and presidential-to-midterm turnout',
  'Neutral prior is a deliberate stress assumption, not historical polling',
  'Whole county totals revealed in assumed orders, not an actual election-night replay',
  'No method data: unseen method composition remains unresolved',
  'Sixteen correlated snapshots of one noncompetitive election cannot calibrate a close-race needle'],snapshots};
const dir=path.join(__dirname,'../artifacts/readiness/kansas');fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,'partial-forecast-evaluation.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,snapshots:undefined}));
