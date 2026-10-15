#!/usr/bin/env node
'use strict';
/* 2026 Senate qualified-error v4 audit.
 * Archived SOURCE publication dates are unavailable, so this is a score of
 * retrospective FIELDWORK-eligible poll aggregates, not the complete model.
 * Do not use proprietary external win odds or private subscriber CSVs.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const model=require('./chamber_control_model.js');
const load=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'..','data',name+'.json'),'utf8'));
const history=load('historical_senate_horizon_backtest');
assert.equal(history.schema_version,'senate-horizon-fieldwork-research-v1');
assert.equal(history.first_publication_dates_available,false);
assert.equal(history.may_automatically_change_live_2026_sigma,false);
assert.equal(history.election_cycles.join(','),'2020,2022,2024');
const NORMAL_90_Z=1.6448536269514722;
function cdf(z){
 const a=Math.abs(z),t=1/(1+.2316419*a);
 const value=1-.3989422804014327*Math.exp(-.5*a*a)*t*
  (.319381530+t*(-.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));
 return z>=0?value:1-value;
}
function score(rows,sigma){
 assert(rows.length>0&&sigma>0);
 let brier=0,logloss=0,covered=0;
 for(const r of rows){
  assert(Number.isFinite(r.poll_margin)&&Number.isFinite(r.actual_margin));
  const p=Math.max(.0001,Math.min(.9999,cdf(r.poll_margin/sigma)));
  const y=r.actual_margin>0?1:0;
  brier+=(p-y)**2;
  logloss+=-y*Math.log(p)-(1-y)*Math.log(1-p);
  covered+=Number(Math.abs(r.poll_margin-r.actual_margin)<=NORMAL_90_Z*sigma);
 }
 return {races:rows.length,brier:+(brier/rows.length).toFixed(5),
  logloss:+(logloss/rows.length).toFixed(5),
  margin_interval_90pct_coverage_pct:+(100*covered/rows.length).toFixed(2)};
}
const horizons=[30,20,14,7,3];
const cohort=horizons.map(days=>{
 const rows=history.records[String(days)];
 assert(Array.isArray(rows)&&rows.length>=39);
 return {days,original:score(rows,7.5),proposed:score(rows,6.5),
  by_year:[2020,2022,2024].map(year=>{
   const group=rows.filter(r=>r.cycle===year);
   return {year,original:score(group,7.5),proposed:score(group,6.5)};
  })};
});
const day20=cohort.find(r=>r.days===20),day7=cohort.find(r=>r.days===7);
assert(day20.proposed.brier<day20.original.brier);
assert(day20.proposed.logloss<day20.original.logloss);
assert(day7.proposed.brier<day7.original.brier);
assert(day7.proposed.logloss<day7.original.logloss);
assert(day20.proposed.margin_interval_90pct_coverage_pct>=90);
assert(day7.proposed.margin_interval_90pct_coverage_pct>=90);
assert(day20.by_year.find(r=>r.year===2020).proposed.margin_interval_90pct_coverage_pct<90,
 'Research warning: 2020 exception disappeared; revisit error floor');
const source={seats:load('seat_universe'),history:load('house_history_2024_staging'),
 geography:load('house_geography_bridge'),senateHistory:load('senate_history_2020_2022_2024'),
 odds:load('race_probabilities'),polls:load('polling_estimates'),
 presidential:load('presidential_2024_by_2026_district_staging')};
const basis=model.prepare(source,{senatePriorMode:'current_2026'});
assert.equal(basis.senate_current_context.model_revision,
 'late_2026_depth_aware_special_v5');
const shared=Math.hypot(basis.assumptions.common_national_sigma,
 basis.assumptions.senate_chamber_sigma,basis.assumptions.state_senate_sigma);
const odds=new Map(source.odds.records.filter(x=>x.office==='senate')
 .map(r=>[r.race_code,r]));
let changed=0,unchanged=0;
const prior={...basis,senate:basis.senate.map(r=>{
 if(r.polling_error_tier!=='recent_multi_firm'){unchanged++;return {...r};}
 const src=odds.get(r.code);assert(src);
 const whole=Math.max(7.5,src.sigma_points);
 const localVariance=whole*whole-shared*shared;
 assert(localVariance>0);
 const extra=r.disagreement_extra_sigma_points||0;
 changed++;
 return {...r,sigma:Math.hypot(Math.sqrt(localVariance),extra),
  polling_error_floor_points:7.5,polling_error_whole_race_sigma_points:whole};
})};
assert(changed>=8,'Unexpected lack of independent qualifying 2026 Senate polls');
assert.equal(changed+unchanged,35);
const args={seed:20261103,samples:5000};
const original=model.simulate(prior,args),proposed=model.simulate(basis,args);
assert.equal(original.house_dem_control_pct,proposed.house_dem_control_pct);
assert.deepEqual(original.race_probabilities.filter(x=>x.office==='house'),
 proposed.race_probabilities.filter(x=>x.office==='house'),
 'Updating 2026 Senate qualifying floor must NEVER change House win odds');
assert.deepEqual(original.race_probabilities.filter(x=>x.office==='governor'),
 proposed.race_probabilities.filter(x=>x.office==='governor'));
const prev=new Map(original.race_probabilities.filter(x=>x.office==='senate')
 .map(x=>[x.race_code,x]));
const races=proposed.race_probabilities.filter(x=>x.office==='senate').map(x=>{
 const priorRace=prev.get(x.race_code);
 const meta=basis.senate.find(r=>r.code===x.race_code);
 assert(priorRace&&meta&&Math.abs(priorRace.model_dem_margin_points-x.model_dem_margin_points)<1e-10,
  'Model margin changed during probability-calibration-only update');
 if(meta.polling_error_tier!=='recent_multi_firm')
  assert(Math.abs(priorRace.sigma_points-x.sigma_points)<.002,
   'Thin/stale/special and unpolled seats must not narrow');
 else{
  assert(x.sigma_points<priorRace.sigma_points);
  assert(x.sigma_points>=6.5-.002);
 }
 return {code:x.race_code,model_margin:+x.model_dem_margin_points.toFixed(3),
  error_tier:x.polling_error_tier,
  original_sigma:priorRace.sigma_points,proposed_sigma:x.sigma_points,
  original_d_win_pct:priorRace.dem_beats_rep_pct,
  proposed_d_win_pct:x.dem_beats_rep_pct,
  change_pp:+(x.dem_beats_rep_pct-priorRace.dem_beats_rep_pct).toFixed(2)};
});
assert(Math.abs(proposed.blue_both_including_tsunami-
 (proposed.probabilities.blue_wave+proposed.probabilities.blue_tsunami))<.02);
assert(Math.abs(100-(proposed.probabilities.blue_wave+
 proposed.probabilities.blue_tsunami+proposed.probabilities.shrug+
 proposed.probabilities.red_dawn))<.03,
 'The Four Endings must still exhaust the correlated outcome space');
// Same-draw Senate chamber count remains an identical source of races.
const output={
 status:'PROVISIONAL_2026_SENATE_QUALIFIED_ERROR_REVISION_NOT_FULLY_BACKTESTED',
 basis_model_revision:basis.senate_current_context.model_revision,
 input_snapshot_at:source.polls.generated_at,
 source_published_first_dates_verified:false,
 historical_candidate_model_backtested:false,
 silver_forecast_probabilities_used:false,
 qualified_races_narrowed:changed,other_races_unchanged:unchanged,
 provisional_qualified_error_floor:6.5,
 retained_thin_stale_special_floor:8.5,
 known_2020_20_day_coverage_exception:true,
 fields_are_poll_fieldwork_not_publication_dates:true,
 shared_variance_unchanged:true,house_probabilities_unchanged:true,
 historical_scorecard:cohort,
 before:{senate_control_d_pct:original.senate_dem_control_pct,
  both_control_d_pct:original.blue_both_including_tsunami,
  expected_d_senate_seats:original.means.senate_dem_seats},
 after:{senate_control_d_pct:proposed.senate_dem_control_pct,
  both_control_d_pct:proposed.blue_both_including_tsunami,
  expected_d_senate_seats:proposed.means.senate_dem_seats},
 races};
if(process.argv.includes('--json'))console.log(JSON.stringify(output,null,2));
else{
 console.log('Horizon-aware Senate qualified error floor v4 — NOT as-of calibrated');
 console.table(cohort.map(x=>({horizon_days:x.days,cohort:x.original.races,
  brier_7_5:x.original.brier,brier_6_5:x.proposed.brier,
  logloss_7_5:x.original.logloss,logloss_6_5:x.proposed.logloss,
  coverage_7_5:x.original.margin_interval_90pct_coverage_pct,
  coverage_6_5:x.proposed.margin_interval_90pct_coverage_pct})));
 console.log('CAUTION: 2020 20-day coverage under 6.5pt:',
  day20.by_year.find(r=>r.year===2020).proposed.margin_interval_90pct_coverage_pct+'%');
 console.table(races.filter(r=>['NC-SEN','GA-SEN','MN-SEN','ME-SEN','TX-SEN','MI-SEN','NE-SEN'].includes(r.code)));
 console.log('D Senate control',original.senate_dem_control_pct,'→',proposed.senate_dem_control_pct);
}
