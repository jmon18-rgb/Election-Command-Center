#!/usr/bin/env node
'use strict';
/*
 * Transparent retrospective probability scorecard and 2026 whole-race
 * uncertainty comparison. Not a held-out validation of the FULL 2026 model:
 * historic poll release timestamps and current candidate fundamentals are
 * unavailable. No manual Roy Cooper/Jon Ossoff race adjustments.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const model=require('./chamber_control_model.js');
const load=x=>JSON.parse(fs.readFileSync(path.join(__dirname,'..','data',x+'.json'),'utf8'));
const historic=load('historical_senate_poll_backtest');
const source={seats:load('seat_universe'),history:load('house_history_2024_staging'),
 geography:load('house_geography_bridge'),senateHistory:load('senate_history_2020_2022_2024'),
 odds:load('race_probabilities'),polls:load('polling_estimates'),
 presidential:load('presidential_2024_by_2026_district_staging')};
assert.equal(historic.schema_version,'historical-poll-backtest-v1');
assert.equal(historic.poll_source_first_publication_dates_available,false);
assert.equal(historic.cutoff_days_before_election,7);
assert.equal(historic.records.length,42);
const normalCDF=z=>{
 const t=1/(1+.2316419*Math.abs(z));
 const density=.3989422804014327*Math.exp(-.5*z*z);
 const phi=1-density*t*(.319381530+t*(-.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));
 return z>=0?phi:1-phi;
};
function historicalScore(rows,sigma){
 let brier=0,logLoss=0,covered=0;
 for(const r of rows){
  const estimate=r.methods?.recency21?.predicted_two_party_margin;
  const outcome=r.actual_two_party_margin;
  assert(Number.isFinite(estimate)&&Number.isFinite(outcome));
  const probability=Math.max(1e-9,Math.min(1-1e-9,normalCDF(estimate/sigma)));
  const yes=outcome>0?1:0;
  brier+=(probability-yes)**2;
  logLoss+=-(yes*Math.log(probability)+(1-yes)*Math.log(1-probability));
  covered+=Math.abs(estimate-outcome)<=1.64485362695*sigma?1:0;
 }
 return {races:rows.length,sigma_points:sigma,
  brier:+(brier/rows.length).toFixed(4),
  log_loss:+(logLoss/rows.length).toFixed(4),
  ninety_pct_margin_coverage:+(100*covered/rows.length).toFixed(1),
  covered_races:covered};
}
const years=[2020,2022,2024];
const history={
 overall:{old:historicalScore(historic.records,8.5),candidate:historicalScore(historic.records,6.5)},
 by_year:years.map(year=>{
  const rows=historic.records.filter(x=>x.cycle===year);
  return {year,old:historicalScore(rows,8.5),candidate:historicalScore(rows,6.5)};
 })};
const prepared=model.prepare(source,{senatePriorMode:'current_2026'});
const opts={samples:6000,seed:20261103};
const newSim=model.simulate(prepared,opts);
const a=prepared.assumptions,shared=Math.hypot(a.common_national_sigma,
 a.senate_chamber_sigma,a.state_senate_sigma);
const oddsByCode=new Map(source.odds.records.filter(x=>x.office==='senate')
 .map(x=>[x.race_code,x]));
const oldBasis={...prepared,senate:prepared.senate.map(r=>{
 if(!r.polled)return {...r};
 const src=oddsByCode.get(r.code);
 assert(src);
 const whole=Math.hypot(Math.max(8.5,src.sigma_points),r.disagreement_extra_sigma_points);
 return {...r,sigma:Math.sqrt(whole*whole-shared*shared)};
})};
const oldSim=model.simulate(oldBasis,opts);
assert.equal(oldSim.house_dem_control_pct,newSim.house_dem_control_pct);
assert.deepEqual(oldSim.race_probabilities.filter(x=>x.office==='house'),
 newSim.race_probabilities.filter(x=>x.office==='house'));
assert.deepEqual(oldSim.race_probabilities.filter(x=>x.office==='governor'),
 newSim.race_probabilities.filter(x=>x.office==='governor'));
const oldRaces=new Map(oldSim.race_probabilities.filter(x=>x.office==='senate')
 .map(r=>[r.race_code,r]));
const races=newSim.race_probabilities.filter(x=>x.office==='senate').map(r=>{
 const prior=oldRaces.get(r.race_code);
 const input=prepared.senate.find(x=>x.code===r.race_code);
 const observed=oddsByCode.get(r.race_code);
 return {race_code:r.race_code,margin_points:+input.mean.toFixed(3),
  polling_margin_points:observed?.dem_minus_rep??null,
  independent_pollsters:observed?.independent_firms??0,
  error_tier:input.polling_error_tier,
  full_error_sigma_old:+prior.sigma_points.toFixed(3),
  full_error_sigma_new:+r.sigma_points.toFixed(3),
  old_D_probability:prior.dem_beats_rep_pct,
  new_D_probability:r.dem_beats_rep_pct,
  change_pp:+(r.dem_beats_rep_pct-prior.dem_beats_rep_pct).toFixed(2)};
}).sort((a,b)=>a.race_code.localeCompare(b.race_code));
const output={status:'RETROSPECTIVE_INFORMED_2026_UNCERTAINTY_REVIEW_NOT_CALIBRATED',
 historic_source:historic.poll_source,
 historic_fieldwork_cutoff_days:historic.cutoff_days_before_election,
 historical_release_dates_verified:false,
 warning:'Retrospective poll-only scores are NOT a complete leave-date-out validation of the candidate/fundamentals joint 2026 forecast; candidate sigma rules are provisional.',
 historic_probability_scores:history,
 current_2026_polling_at:source.polls.generated_at,
 same_draw_seed:opts.seed,draws:opts.samples,
 unchanged_house_probabilities:true,unchanged_governor_probabilities:true,
 prior_D_both_pct:oldSim.actual_dem_both_control_pct,
 updated_D_both_pct:newSim.actual_dem_both_control_pct,
 old_senate_D_control_pct:oldSim.senate_dem_control_pct,
 updated_senate_D_control_pct:newSim.senate_dem_control_pct,
 older_error_floor_points:8.5,
 qualified_poll_floor_points:6.5,
 thin_stale_special_floor_points:8.5,
 races};
assert(races.length===35);
assert(history.by_year.every(x=>x.candidate.ninety_pct_margin_coverage>=90),
 'Historical comparison misses 90% nominal interval coverage');
assert(history.overall.candidate.brier<history.overall.old.brier&&
 history.overall.candidate.log_loss<history.overall.old.log_loss,
 'Wider baseline unexpectedly performs better in historical scorecard');
assert(races.some(x=>x.error_tier==='recent_multi_firm'&&x.change_pp>0));
assert(races.filter(x=>x.error_tier==='thin_stale_or_special').every(x=>
 Math.abs(x.full_error_sigma_new-x.full_error_sigma_old)<.002));
if(process.argv.includes('--json'))console.log(JSON.stringify(output,null,2));
else{
 console.log('Senate retrospective probability scorecard (research; NOT complete forecast backtest)');
 console.table(history.by_year.map(x=>({year:x.year,
   old_brier:x.old.brier,proposed_brier:x.candidate.brier,
   old_log:x.old.log_loss,proposed_log:x.candidate.log_loss,
   proposed_90pct_interval_coverage:x.candidate.ninety_pct_margin_coverage})));
 console.table(races.filter(x=>['NC-SEN','GA-SEN','MN-SEN','ME-SEN','TX-SEN','IA-SEN'].includes(x.race_code))
  .map(x=>({race:x.race_code,poll:x.polling_margin_points,model:x.margin_points,
   error_sigma:x.full_error_sigma_new,win_odds_D:x.new_D_probability,
   delta_pp:x.change_pp})));
 console.log('Baseline D Senate control:',output.old_senate_D_control_pct,
  'Candidate D Senate control:',output.updated_senate_D_control_pct);
}
