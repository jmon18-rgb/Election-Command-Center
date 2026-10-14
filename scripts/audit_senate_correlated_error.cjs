#!/usr/bin/env node
'use strict';
/* Research-only: Senate error covariance, not Silver's odds or any paid CSV.
 * Historical poll compilation has field-end dates, not verification that a
 * poll was actually published by the retrospective cutoff. Only 3 cycles.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const model=require('./chamber_control_model.js');
const read=n=>JSON.parse(fs.readFileSync(path.join(__dirname,'..','data',n+'.json'),'utf8'));
const historical=read('historical_senate_horizon_backtest');
assert.equal(historical.first_publication_dates_available,false);
assert.equal(historical.schema_version,'senate-horizon-fieldwork-research-v1');
function cycleStats(days){
 const rows=historical.records[String(days)];
 assert(Array.isArray(rows)&&rows.length>=39);
 const byYear=historical.election_cycles.map(year=>{
  const errors=rows.filter(x=>x.cycle===year).map(r=>r.poll_margin-r.actual_margin);
  assert(errors.length>=10);
  const mean=errors.reduce((a,b)=>a+b,0)/errors.length;
  const residualVariance=errors.reduce((a,e)=>a+(e-mean)**2,0)/(errors.length-1);
  return {year,races:errors.length,mean_poll_minus_result:+mean.toFixed(3),
   within_cycle_sd:+Math.sqrt(residualVariance).toFixed(3),
   mean_sampling_variance:residualVariance/errors.length};
 });
 const means=byYear.map(x=>x.mean_poll_minus_result);
 const avg=means.reduce((a,b)=>a+b)/means.length;
 const between=means.reduce((a,b)=>a+(b-avg)**2,0)/(means.length-1);
 const sampling=byYear.reduce((a,b)=>a+b.mean_sampling_variance,0)/byYear.length;
 return {days_before_election:days,years:byYear.map(({mean_sampling_variance,...rest})=>rest),
  between_cycle_means_sd:+Math.sqrt(between).toFixed(3),
  subtractive_sampling_correction_variance:+sampling.toFixed(3),
  rough_shared_error_sd:+Math.sqrt(Math.max(0,between-sampling)).toFixed(3),
  caveat:'ONLY THREE CYCLES; 2020/2022/2024; curated fieldwork proxy. No 2026 correlation calibration.'};
}
const horizons=[30,20,14,7].map(cycleStats);
const sources={seats:read('seat_universe'),history:read('house_history_2024_staging'),
 geography:read('house_geography_bridge'),senateHistory:read('senate_history_2020_2022_2024'),
 odds:read('race_probabilities'),polls:read('polling_estimates'),
 presidential:read('presidential_2024_by_2026_district_staging')};
const basis=model.prepare(sources,{senatePriorMode:'current_2026'});
assert.equal(basis.senate_current_context.model_revision,'late_2026_horizon_error_budget_v4');
const samples=6000,opts={samples,seed:20261103};
const original=model.simulate(basis,opts);
const variants=[
 {id:'production',label:'Current joint model',nationalScale:1,chamberScale:1},
 {id:'moderate',label:'Reduced common error sensitivity',nationalScale:.8,chamberScale:.65},
 {id:'lower',label:'Lower shared-error sensitivity',nationalScale:.65,chamberScale:.55}
];
const originalByCode=new Map(original.race_probabilities.map(x=>[x.race_code,x]));
const sims=variants.map(v=>{
 const out=model.simulate(basis,{...opts,
  senateCorrelationResearch:{nationalScale:v.nationalScale,chamberScale:v.chamberScale}});
 assert.equal(out.house_dem_control_pct,original.house_dem_control_pct);
 assert.deepEqual(out.race_probabilities.filter(x=>x.office==='house'),
  original.race_probabilities.filter(x=>x.office==='house'));
 assert.deepEqual(out.race_probabilities.filter(x=>x.office==='governor'),
  original.race_probabilities.filter(x=>x.office==='governor'));
 assert.equal(out.senate_correlation_research.unmodified_total_sigma_each_senate_race,true);
 const delta=out.race_probabilities.filter(x=>x.office==='senate').map(r=>{
  const ref=originalByCode.get(r.race_code);
  assert.equal(r.model_dem_margin_points,ref.model_dem_margin_points);
  assert.equal(r.sigma_points,ref.sigma_points,
   'Covariance sensitivity must conserve exact full Senate margin sigma');
  assert(Math.abs(r.dem_beats_rep_pct-ref.dem_beats_rep_pct)<3.0,
   'A pure correlation swap should not materially change race-level marginals');
  return {race_code:r.race_code,
   delta_d_win_pp:+(r.dem_beats_rep_pct-ref.dem_beats_rep_pct).toFixed(2)};
 });
 return {id:v.id,label:v.label,scales:{national:v.nationalScale,chamber:v.chamberScale},
  shared_senate_across_state_sigma_points:
   out.senate_correlation_research.senate_common_shared_sigma_points,
  individual_race_sigma_unchanged:true,
  senate_dem_control_pct:out.senate_dem_control_pct,
  house_dem_control_pct:out.house_dem_control_pct,
  both_dem_control_pct:out.blue_both_including_tsunami,
  expected_senate_dem_seats:out.means.senate_dem_seats,
  max_individual_race_odds_change_pp:Math.max(...delta.map(x=>Math.abs(x.delta_d_win_pp))),
  selected_races:delta.filter(x=>['NC-SEN','GA-SEN','MN-SEN','ME-SEN','TX-SEN','MI-SEN','NE-SEN'].includes(x.race_code))};
});
assert.deepEqual(sims[0].selected_races.map(x=>x.delta_d_win_pp),Array(7).fill(0));
assert.equal(sims[0].senate_dem_control_pct,original.senate_dem_control_pct);
assert(horizons[1].rough_shared_error_sd>0);
const output={
 status:'RESEARCH_ONLY_THREE_CYCLE_SENATE_SHARED_ERROR_ATTRIBUTION',
 since:2020,historical_horizons:horizons,
 raw_historic_poll_publication_timestamps_unavailable:true,
 full_2026_fundamentals_covariance_backtested:false,
 calibration_parameter_promotion_permitted:false,
 private_silver_csv_data_used:false,
 historical_notes:'Cycle-mean residual SD after within-cycle sampling correction is an approximate common-mode proxy; it confounds poll bias, selection and unmodeled candidate effects. Three cycles cannot identify an optimum correlation coefficient.',
 samples,original_shared_senate_across_state_sigma_points:
  sims[0].shared_senate_across_state_sigma_points,
 unchanged_house_and_governor_race_probabilities:true,
 unchanged_each_senate_race_error_width:true,
 scenarios:sims
};
if(process.argv.includes('--json'))console.log(JSON.stringify(output,null,2));
else{
 console.log('Senate correlated-error attribution (RESEARCH ONLY; NOT new default odds)');
 console.table(horizons.map(h=>({days:h.days_before_election,
  sd_cycle_means:h.between_cycle_means_sd,
  rough_shared_error_sd:h.rough_shared_error_sd,
  cycles:h.years.map(x=>x.year+': '+x.mean_poll_minus_result).join('; ')})));
 console.table(sims.map(s=>({case:s.id,
  shared_sigma:s.shared_senate_across_state_sigma_points,
  d_senate_control_pct:s.senate_dem_control_pct,
  d_both_pct:s.both_dem_control_pct,
  max_race_change_pp:s.max_individual_race_odds_change_pp})));
}
