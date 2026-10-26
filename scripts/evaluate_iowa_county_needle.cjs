'use strict';
const fs=require('node:fs'),path=require('node:path');
const {forecast}=require('./iowa_county_needle.js');
const independent=process.argv.includes('--independent');
const {years}=require(independent?'../data/iowa_senate_independent_county_modes_official.json':'../data/iowa_senate_county_modes_official.json');
const [baseYear,outcomeYear]=independent?['2014','2016']:['2020','2022'];
const truth=100*(years[outcomeYear].statewide.dem_votes-years[outcomeYear].statewide.rep_votes)/
 (years[outcomeYear].statewide.dem_votes+years[outcomeYear].statewide.rep_votes);
const cells=years[baseYear].counties.flatMap(c=>['absentee','election_day'].map(mode=>({county:c.county,mode,...c.records[mode]})));
const outcomes=new Map(years[outcomeYear].counties.map(c=>[c.county,c.records]));
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
 const f=forecast({baseline:years[baseYear],observations:[...seen.values()],prior_margin_points:0});
 const naive=100*(f.counted_dem_votes-f.counted_rep_votes)/(f.counted_dem_votes+f.counted_rep_votes);
 snapshots.push({order,fraction_of_historical_units_revealed:fraction,
  counted_two_party_votes:f.counted_dem_votes+f.counted_rep_votes,naive_counted_margin:naive,
  projected_margin:f.projected_margin_points,error_points:f.projected_margin_points-truth,
  naive_error_points:naive-truth,dem_win_probability:f.dem_win_probability,
  modeled_remaining_two_party_votes:f.modeled_remaining_two_party_votes,scenario_band:f.scenario_margin_band});
 const row=snapshots.at(-1);
 row.remaining_vote_scenario_band=f.modeled_remaining_two_party_votes_band;
 row.actual_remaining_two_party_votes=years[outcomeYear].statewide.dem_votes+years[outcomeYear].statewide.rep_votes-
  f.counted_dem_votes-f.counted_rep_votes;
}
const bytes=fs.readFileSync(path.join(__dirname,'iowa_county_needle.js'));
const modelBlob=require('node:crypto').createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
const firstUnseenModel='c097eafd3c125caf3937c8c9ceefb2d7e49af9fd';
const result={status:independent?(modelBlob===firstUnseenModel?'UNSEEN_ELECTION_STRESS_TEST_NOT_CALIBRATION':
 'REUSED_OUTCOME_DEVELOPMENT_STRESS_TEST_NOT_CALIBRATION'):'DEVELOPMENT_SCENARIOS_NOT_INDEPENDENT_CALIBRATION',
 model_blob_sha1:modelBlob,baseline_year:Number(baseYear),outcome_year:Number(outcomeYear),
 actual_release_times:false,model_tuned_using_this_election:!independent||modelBlob!==firstUnseenModel,
 first_unseen_model_blob_sha1:independent?firstUnseenModel:null,prior:'Neutral stress test, not reconstructed polls',
 limitations:independent?'Different Senate class and midterm-to-presidential turnout; wrong-prior stress test, not representative close-race calibration':
  'Outcome used for development; different Senate class and presidential-to-midterm turnout',
 truth_margin:truth,partial_scenarios:snapshots.length,
 model_margin_mae:snapshots.reduce((s,r)=>s+Math.abs(r.error_points),0)/snapshots.length,
 naive_margin_mae:snapshots.reduce((s,r)=>s+Math.abs(r.naive_error_points),0)/snapshots.length,
 scenario_band_contains_truth:snapshots.filter(r=>r.scenario_band[0]<=truth&&r.scenario_band[1]>=truth).length,
 remaining_vote_band_contains_truth:snapshots.filter(r=>r.remaining_vote_scenario_band[0]<=r.actual_remaining_two_party_votes&&
  r.remaining_vote_scenario_band[1]>=r.actual_remaining_two_party_votes).length,
 snapshots};
const dir=path.join(__dirname,'../artifacts/readiness/iowa');fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,independent?'combined-county-unseen-election-evaluation.json':'combined-county-development-evaluation.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,snapshots:undefined}));
