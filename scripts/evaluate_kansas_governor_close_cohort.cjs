'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {forecast}=require('./iowa_county_needle.js');
const data=require('../data/kansas_governor_close_cohort_official.json');
const plan=require('../data/kansas_governor_close_cohort_evaluation_plan.json');
const baseline=data.years[plan.baseline_year],outcome=data.years[plan.outcome_year];
const truth=100*(outcome.statewide.D-outcome.statewide.R)/(outcome.statewide.D+outcome.statewide.R);
if(!Number.isFinite(truth))throw Error('Missing official governor outcome');
const total=c=>c.records.total.dem_votes+c.records.total.rep_votes,share=c=>c.records.total.dem_votes/total(c);
const orders={baseline_small_counties_first:(a,b)=>total(a)-total(b),baseline_large_counties_first:(a,b)=>total(b)-total(a),
 baseline_democratic_counties_first:(a,b)=>share(b)-share(a),baseline_republican_counties_first:(a,b)=>share(a)-share(b)};
const actual=new Map(outcome.counties.map(c=>[c.county,c.records.total])),snapshots=[];
for(const order of plan.orders)for(const fraction of plan.county_fractions){
 // Freeze release order from the baseline only, never hidden outcome votes.
 const observations=[...baseline.counties].sort(orders[order]).slice(0,Math.ceil(105*fraction))
  .map(c=>({county:c.county,...actual.get(c.county)}));
 const f=forecast({baseline,observations,expected_county_count:105,
  prior_margin_points:plan.prior_margin_points,prior_sigma_points:plan.prior_sigma_points});
 const n=f.counted_dem_votes+f.counted_rep_votes,naive=100*(f.counted_dem_votes-f.counted_rep_votes)/n;
 snapshots.push({order,fraction_of_baseline_counties_revealed:fraction,counted_two_party_votes:n,
  projected_margin:f.projected_margin_points,dem_win_probability:f.dem_win_probability,
  model_error:f.projected_margin_points-truth,naive_error:naive-truth,scenario_band:f.scenario_margin_band,
  modeled_remaining_two_party_votes:f.modeled_remaining_two_party_votes,
  remaining_vote_scenario_band:f.modeled_remaining_two_party_votes_band,
  actual_remaining_two_party_votes:outcome.statewide.D+outcome.statewide.R-n});
}
const bytes=fs.readFileSync(path.join(__dirname,'iowa_county_needle.js'));
const blob=crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
const mean=values=>values.reduce((a,b)=>a+b,0)/values.length,y=Number(truth>0);
const report={status:blob===plan.frozen_model_blob?'FROZEN_FIRST_USE_CLOSE_COHORT_NOT_CALIBRATION':'REUSED_CLOSE_COHORT_DEVELOPMENT_NOT_CALIBRATION',
 model_blob:blob,original_frozen_model_blob:plan.frozen_model_blob,outcome_seen_before_this_model_source:blob!==plan.frozen_model_blob,
 baseline_year:plan.baseline_year,outcome_year:plan.outcome_year,office:'Governor, not Senate',truth_margin:truth,
 prior:'Neutral six-point stress prior, not historical polls',prior_only_margin_mae:Math.abs(truth-plan.prior_margin_points),
 prior_only_dem_win_probability:.5,prior_only_brier_score:.25,prior_only_log_loss:Math.log(2),
 model_margin_mae:mean(snapshots.map(r=>Math.abs(r.model_error))),naive_margin_mae:mean(snapshots.map(r=>Math.abs(r.naive_error))),
 model_brier_score:mean(snapshots.map(r=>(r.dem_win_probability-y)**2)),
 model_log_loss:mean(snapshots.map(r=>-Math.log(Math.max(1e-15,y?r.dem_win_probability:1-r.dem_win_probability)))),
 scenario_band_contains_truth:snapshots.filter(r=>r.scenario_band[0]<=truth&&r.scenario_band[1]>=truth).length,
 remaining_vote_band_contains_truth:snapshots.filter(r=>r.remaining_vote_scenario_band[0]<=r.actual_remaining_two_party_votes&&r.remaining_vote_scenario_band[1]>=r.actual_remaining_two_party_votes).length,
 partial_scenarios:snapshots.length,interval_calibrated:false,actual_release_times:false,
 limitations:['One close governor election, not validated Senate transfer','Four-year same-office baseline includes the same Democratic candidate',
  'Combined county history lacks methods and verified completion','Assumed orders are chosen from baseline only; not recorded publication times',
  'Correlated snapshots are not independent elections; no parameter changes after evaluation'],snapshots};
const frozenPath=path.join(__dirname,'../data/kansas_governor_close_cohort_frozen_evaluation.json');
if(blob===plan.frozen_model_blob&&fs.existsSync(frozenPath)){
 require('node:assert/strict').deepEqual(report,JSON.parse(fs.readFileSync(frozenPath)),
  'The frozen first-use model must reproduce its original close-election evaluation');
}
const dir=path.join(__dirname,'../artifacts/readiness/kansas');fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,'governor-close-cohort-evaluation.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,snapshots:undefined}));
