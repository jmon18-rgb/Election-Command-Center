#!/usr/bin/env node
'use strict';
/* 2022/2024 House vote fundamentals SHADOW: no automatic promotion to odds. */
const path=require('node:path'),fs=require('node:fs');
const model=require('./chamber_control_model.js');
const read=x=>JSON.parse(fs.readFileSync(path.join(__dirname,'..','data',x+'.json'),'utf8'));
const sources={
 seats:read('seat_universe'),history:read('house_history_2024_staging'),
 geography:read('house_geography_bridge'),
 senateHistory:read('senate_history_2020_2022_2024'),
 odds:read('race_probabilities'),polls:read('polling_estimates'),
 twoCycle:read('house_two_cycle_context')
};
const baseline=model.prepare(sources),shadow=model.prepare(sources,{fundamentalsMode:'two_cycle_shadow'});
const opts={samples:6000,seed:20261103};
const base=model.simulate(baseline,opts),alternate=model.simulate(shadow,opts);
const byBase=new Map(baseline.house.map(x=>[x.code,x]));
const changes=shadow.house.filter(x=>Math.abs(x.two_cycle_adjustment_points)>0)
 .map(x=>{
  const old=byBase.get(x.code);
  return {
   race_code:x.code,polled:x.polled,
   original_2026_margin_points:+old.mean.toFixed(3),
   shadow_2026_margin_points:+x.mean.toFixed(3),
   margin_change_points:+(x.mean-old.mean).toFixed(3),
   original_2022_margin_points:+x.historical_2022_margin.toFixed(3),
   original_2024_margin_points:
    +(x.projected_2024_from_2022_margin-
      shadow.fundamentals_shadow.median_paired_2022_to_2024_swing_points).toFixed(3)
  };
 }).sort((a,b)=>Math.abs(b.margin_change_points)-Math.abs(a.margin_change_points));
const diff=(a,b)=>+(a-b).toFixed(2);
const report={
 status:'EXPERIMENTAL_SHADOW_NOT_PROMOTED',
 source_polling_generated_at:sources.polls.generated_at,
 methodology:'geography_safe_2022_2024_paired_drift_adjusted_winsorized_25pct',
 model_version:model.VERSION,
 paired_eligible_districts:shadow.fundamentals_shadow.paired_districts,
 excluded_districts:435-shadow.fundamentals_shadow.paired_districts,
 adjusted_districts:shadow.fundamentals_shadow.changed_means,
 paired_median_2022_to_2024_swing_points:+shadow.fundamentals_shadow
  .median_paired_2022_to_2024_swing_points.toFixed(3),
 historic_prior_weight:shadow.fundamentals_shadow.prior_weight,
 max_raw_historical_residual_points:shadow.fundamentals_shadow.absolute_residual_cap_points,
 baseline_simulation:{
  samples:opts.samples,dem_both_chambers_pct:base.blue_both_including_tsunami,
  republican_both_chambers_pct:base.probabilities.red_dawn,
  average_dem_house_seats:base.means.house_dem_seats
 },
 two_cycle_shadow_simulation:{
  samples:opts.samples,dem_both_chambers_pct:alternate.blue_both_including_tsunami,
  republican_both_chambers_pct:alternate.probabilities.red_dawn,
  average_dem_house_seats:alternate.means.house_dem_seats
 },
 shadow_minus_baseline:{
  dem_both_chambers_percentage_points:diff(alternate.blue_both_including_tsunami,base.blue_both_including_tsunami),
  republican_both_chambers_percentage_points:diff(alternate.probabilities.red_dawn,base.probabilities.red_dawn),
  average_dem_house_seats:diff(alternate.means.house_dem_seats,base.means.house_dem_seats)
 },
 biggest_house_margin_changes:changes.slice(0,15),
 warnings:[
  'No 2026 electoral outcomes exist. This is NOT a validation or improvement in proven forecast accuracy.',
  '2022 and 2024 district election outcomes have different candidates, turnout and national environments.',
  'Only 197 geography-matched, two-party-complete districts are eligible; all redrawn and missing-party seats remain at baseline.',
  'The median paired national shift, 25% weight and 12-point winsorization are provisional; evaluate on past elections before promotion.',
  'This shadow never changes main dashboard headline odds unless intentionally promoted following backtesting.'
 ]};
if(report.paired_eligible_districts!==197||changes.length<100)
 throw Error('Unexpected two-cycle district eligibility');
if(process.argv.includes('--json'))console.log(JSON.stringify(report,null,2));
else{
 console.log('House 2022/24 fundamentals SHADOW — NOT promoted to production');
 console.log('Paired eligible districts:',report.paired_eligible_districts,
  'excluded:',report.excluded_districts,'median paired national shift:',
  report.paired_median_2022_to_2024_swing_points);
 console.table([{
  model:'baseline',...report.baseline_simulation
 },{
  model:'two-cycle shadow',...report.two_cycle_shadow_simulation
 }]);
 console.log('Delta shadow-minus-baseline:',report.shadow_minus_baseline);
 console.table(report.biggest_house_margin_changes.slice(0,8));
 console.log('Not an out-of-sample calibration. Leave headline odds unchanged.');
}
