#!/usr/bin/env node
'use strict';
/*
 * SAME joint election draws yield both House seat counts and a reference-
 * turnout-weighted national D-R margin. This is not official 2026 vote share.
 */
const fs=require('node:fs'),path=require('node:path');
const assert=require('node:assert/strict');
const model=require('./chamber_control_model.js');
const read=n=>JSON.parse(fs.readFileSync(path.join(__dirname,'..','data',n+'.json'),'utf8'));
const pres=read('presidential_2024_by_2026_district_staging');
const src={seats:read('seat_universe'),history:read('house_history_2024_staging'),
 geography:read('house_geography_bridge'),senateHistory:read('senate_history_2020_2022_2024'),
 odds:read('race_probabilities'),polls:read('polling_estimates')};
const basis=model.prepare(src);
assert.equal(pres.status,'historical_presidential_votes_from_external_model_source_not_forecast');
assert.equal(pres.election_year,2024);
assert.equal(pres.district_map_year_claimed,2026);
assert.equal(pres.records.length,435);
assert(pres.external_source_blob_sha);
const weights=pres.records.map(r=>({race_code:r.race_code,
 reference_two_party_votes:r.dem_pres_2024_votes+r.rep_pres_2024_votes}));
const samples=9000,seed=20261103;
const baseline=model.simulate(basis,{samples,seed});
const weighed=model.simulate(basis,{samples,seed,voteSeatWeights:weights,
 voteSeatWeightLabel:'2024_presidential_two_party_ballots_by_2026_district_reference'});
assert.deepEqual(weighed.race_probabilities,baseline.race_probabilities,
 'Optional reference-weighted vote calculation must not move any race odds');
assert.deepEqual(weighed.probabilities,baseline.probabilities,
 'Optional reference-weighted vote calculation must not move scenarios');
assert.deepEqual(weighed.means,baseline.means,
 'Optional reference-weighted vote calculation must not move chamber seats');
assert.deepEqual(weighed.seat_intervals_90_pct,baseline.seat_intervals_90_pct);
assert.equal(baseline.vote_seat_explanation,undefined);
const result=weighed.vote_seat_explanation;
assert.equal(result.verified_districts,435);
assert(result.weight_total>1e8);
assert.equal(result.status,'EXPERIMENTAL_VOTE_SEAT_REFERENCE_WEIGHTED_NOT_ACTUAL_2026_VOTE');
assert.equal(result.bins.reduce((a,x)=>a+x.sample_count,0),samples);
assert(Math.abs(result.bins.reduce((a,x)=>a+x.expected_dem_house_seats*x.sample_count,0)/samples-
 weighed.means.house_dem_seats)<.02);
assert(Math.abs(result.bins.reduce((a,x)=>a+x.dem_house_control_pct*x.sample_count,0)/samples-
 weighed.house_dem_control_pct)<.02);
assert(Math.abs(result.bins.reduce((a,x)=>a+x.dem_senate_control_pct*x.sample_count,0)/samples-
 weighed.senate_dem_control_pct)<.02);
assert(Math.abs(result.bins.reduce((a,x)=>a+x.dem_both_control_pct*x.sample_count,0)/samples-
 weighed.blue_both_including_tsunami)<.02);
assert(result.bins.every(x=>x.dem_margin_bin_from===x.dem_margin_bin_to-1&&
 x.sample_count>0&&x.sample_share_pct>0));
assert.throws(()=>model.simulate(basis,{samples:300,voteSeatWeights:weights.slice(1)}),
 /requires 435/);
assert.throws(()=>model.simulate(basis,{samples:300,voteSeatWeights:
 weights.map((x,i)=>i===2?weights[0]:x)}),/duplicated/);
assert.throws(()=>model.simulate(basis,{samples:300,voteSeatWeights:
 weights.map((x,i)=>i===2?{...x,reference_two_party_votes:-1}:x)}),/Invalid or duplicated/);
const index=weights.findIndex(x=>x.race_code==='PA-10');
assert(index>=0);
const missing=weights.map((x,i)=>i===index?{...x,race_code:'PA-100'}:x);
assert.throws(()=>model.simulate(basis,{samples:300,voteSeatWeights:missing}),/Missing 2026-district/);
const report={status:'EXPERIMENTAL_VOTE_SEAT_SAME_DRAW_REFERENCE_ONLY',
 as_of:src.polls.generated_at,
 source_presidential_sha:pres.external_source_blob_sha,
 votes_reference_year:2024,district_geography_year:2026,
 reference_weight_note:'2024 presidential two-party ballots as FIXED 2026 district relative turnout weights; not a 2026 House popular-vote forecast',
 samples,seed,headline:{
  house_dem_control_pct:weighed.house_dem_control_pct,
  senate_dem_control_pct:weighed.senate_dem_control_pct,
  both_dem_control_pct:weighed.blue_both_including_tsunami,
  mean_dem_house_seats:weighed.means.house_dem_seats,
 },
 simulated_mean_weighted_house_margin:result.simulated_mean_weighted_dem_margin_points,
 bins:result.bins,
 caveats:[
  'Condition on SAME draws of a simulated reference-turnout-weighted D-R two-party margin, not on a mechanically shifted forecast or an actual observed national House popular vote.',
  'House and presidential turnout, uncontested-district vote estimates, district-specific 2026 turnout, independent candidacies and third-party votes are not modeled.',
  'No Silver Bulletins subscription forecast or subscriber CSV is used or copied. External comparison requires running a separate noncommitted private script.',
  'Low-count bins require simulation confidence intervals and must not be presented as precise public odds.',
  'No central forecast probability changed. Historical full-model calibration remains required.'
 ]
};
if(process.argv.includes('--json'))console.log(JSON.stringify(report,null,2));
else{
 console.log('SAME-DRAW REFERENCE-TURNOUT-WEIGHTED HOUSE VOTE->SEATS (EXPERIMENTAL)');
 console.log('National House weighted-margin mean:',report.simulated_mean_weighted_house_margin,
  'Expected D seats:',weighed.means.house_dem_seats,'House control:',weighed.house_dem_control_pct+'%');
 console.table(report.bins.filter(b=>b.sample_count>=30).map(b=>({
  vote_range:'D '+b.dem_margin_bin_from+' to '+b.dem_margin_bin_to,
  draws:b.sample_count,d_seats:b.expected_dem_house_seats,
  house_d_control:b.dem_house_control_pct,
  senate_d_control:b.dem_senate_control_pct,
  both_d_control:b.dem_both_control_pct
 })));
 console.log('Purely synthetic model-weighted vote share. NOT an actual House popular vote.');
}
