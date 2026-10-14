#!/usr/bin/env node
'use strict';
/*
 * Senate uncertainty accounting: historical RMSE is a WHOLE-race forecast
 * error, not an independent local residual to be stacked onto shared shocks.
 * These scenarios remain nonpromoted because the retrospective poll study
 * lacks verifiable as-of publication timestamps and candidate-fundamentals.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const model=require('./chamber_control_model.js');
const read=x=>JSON.parse(fs.readFileSync(path.join(__dirname,'..','data',x+'.json'),'utf8'));
const source={seats:read('seat_universe'),history:read('house_history_2024_staging'),
 geography:read('house_geography_bridge'),senateHistory:read('senate_history_2020_2022_2024'),
 odds:read('race_probabilities'),polls:read('polling_estimates')};
const b=model.prepare(source),a=b.assumptions;
const oldRootMeanSquaredError=source.odds.senate_baseline_rmse_points;
assert(Math.abs(oldRootMeanSquaredError-5.633)<.001,'Historical Senate provenance changed');
const sharedSigma=Math.hypot(a.common_national_sigma,a.senate_chamber_sigma,
 a.state_senate_sigma);
const historicalSmallerThanShared=oldRootMeanSquaredError<sharedSigma;
const sourceSigma=new Map(source.odds.records.filter(x=>x.office==='senate')
 .map(x=>[x.race_code,x.sigma_points]));
const oldTotal=new Map(b.senate.map(x=>
 [x.code,Math.hypot(x.sigma,sharedSigma)]));
const pollCount=b.senate.filter(x=>x.polled).length;
assert.equal(pollCount,24);
function conservativeFullErrorBudget(fullErrorFloor){
 if(!Number.isFinite(fullErrorFloor)||fullErrorFloor<=sharedSigma+1)
  throw Error('Impossible or unsafe Senate forecast total-error floor');
 const senate=b.senate.map(x=>{
  if(!x.polled)return {...x};
  const input=sourceSigma.get(x.code);
  if(!Number.isFinite(input)||input<=0)
   throw Error('Missing source error provenance '+x.code);
  // The total margin error includes common national + chamber + statewide
  // uncertainties, PLUS disagreement with independently identified prior.
  const target=Math.hypot(Math.max(fullErrorFloor,input),
   x.disagreement_extra_sigma_points);
  const adjustedLocal=Math.sqrt(target*target-sharedSigma*sharedSigma);
  assert(Number.isFinite(adjustedLocal)&&adjustedLocal>0);
  return {...x,sigma:adjustedLocal,
   method:'shadow_full_error_budget_'+x.method};
 });
 return {...b,senate};
}
const seed=20261103,samples=6000;
const cases=[
 {name:'headline_unchanged',basis:b},
 {name:'full_error_floor_7_5_shadow',basis:conservativeFullErrorBudget(7.5)},
 {name:'full_error_floor_8_5_shadow',basis:conservativeFullErrorBudget(8.5)},
 {name:'independent_NEB_SD_without_dem_caucus_credit',basis:b,
  independentSenateCredit:'no_credit'},
 {name:'full_error_7_5_and_independent_no_credit',basis:conservativeFullErrorBudget(7.5),
  independentSenateCredit:'no_credit'}
];
const baseline=model.simulate(b,{samples,seed});
const wanted=['AK-SEN','ME-SEN','MN-SEN','TX-SEN','IA-SEN','NE-SEN','SD-SEN','GA-SEN'];
const results=cases.map(c=>{
 const sim=model.simulate(c.basis,{samples,seed,
  independentSenateCredit:c.independentSenateCredit});
 const races=new Map(sim.race_probabilities.filter(x=>x.office==='senate')
  .map(x=>[x.race_code,x]));
 const representative=Object.fromEntries(wanted.map(code=>{
  const row=races.get(code);
  if(!row)throw Error('Missing Senate race '+code);
  return [code,{dem_side_wins_pct:row.dem_beats_rep_pct,
   conditional_total_margin_sigma_points:row.sigma_points}];
 }));
 const d=sim.blue_both_including_tsunami-baseline.blue_both_including_tsunami;
 assert(Math.abs(sim.house_dem_control_pct-baseline.house_dem_control_pct)<.001,
  'Senate-only error and credit scenarios must not change House win odds');
 assert(sim.race_probabilities.filter(x=>x.office==='house').every((row,i)=>
  row.dem_beats_rep_pct===baseline.race_probabilities[i].dem_beats_rep_pct),
  'Senate uncertainty may not affect House race marginal probabilities');
 if(c.independentSenateCredit){
  // Compare identical error assumptions: the combined shadow deliberately
  // uses narrower Senate uncertainty than the *headline* and should not
  // be compared race-for-race with that different statistical model.
  const sameErrorBasis=model.simulate(c.basis,{samples,seed});
  assert.deepEqual(sim.race_probabilities,sameErrorBasis.race_probabilities,
   'Independent caucus credit only affects control outcomes, not votes');
  assert(sim.senate_dem_control_pct<=sameErrorBasis.senate_dem_control_pct);
 }
 return {case:c.name,d_house_control_pct:sim.house_dem_control_pct,
  d_senate_control_pct:sim.senate_dem_control_pct,
  d_both_control_pct:sim.blue_both_including_tsunami,
  delta_both_from_headline_pp:+d.toFixed(2),
  expected_dem_or_credit_seats:sim.means.senate_dem_seats,
  polled_senate_total_sigma_points: [...c.basis.senate.filter(x=>x.polled)]
   .map(x=>Math.hypot(x.sigma,sharedSigma)).sort((x,y)=>x-y).map(x=>+x.toFixed(2)),
  selected_races:representative};
});
const summary={
 schema:'senate_uncertainty_caucus_diagnostics_v1',
 status:'RESEARCH_SENSITIVITY_NOT_CALIBRATED_ODDS',
 latest_polling_at:source.polls.generated_at,samples_per_case:samples,seed,
 retrospective_years:[2020,2022,2024],
 retrospective_races:source.odds.historical_senate_races,
 retrospective_whole_race_error_rmse_points:oldRootMeanSquaredError,
 modeled_national_chamber_state_shared_sigma_points:+sharedSigma.toFixed(3),
 source_whole_race_error_less_than_modeled_shared_component:historicalSmallerThanShared,
 baseline_well_polled_local_sigma_floor:7,
 baseline_min_total_sigma_points:+Math.hypot(7,sharedSigma).toFixed(3),
 polled_senate_count:pollCount,
 independent_party_proxy_codes:b.senate.filter(x=>x.nonrep_independent_proxy)
  .map(x=>x.code).sort(),
 scenarios:results,
 warnings:[
  'Retrospective 5.633-point Senate error is a total polling-to-election error, not a local residual; stacking it with shared shocks may double-count common error.',
  'That historical error is NOT a calibrated variance for the current full forecast: first-publication dates, late campaign data, candidate strength and 2026 politics remain incompletely modeled.',
  'Total margin-error floors of 7.5 and 8.5 points are sensitivity assumptions, not fitted or automatically promoted coefficients.',
  'An independent victory in Nebraska or South Dakota is not a guaranteed Democratic caucus seat. Counting 0 vs 1 organizational vote is a bracket, not a prediction of how an independent would vote on Senate leadership.',
  'The upstream Democratic-side two-party matchups for Osborn and Bengs must not be mislabeled verified Democratic party affiliation.',
  'All simulations share a seed but different error variances alter every races stochastic outcomes and correlations; only probabilistic distribution-level inference is valid.'
 ]
};
assert(summary.independent_party_proxy_codes.join(',')==='NE-SEN,SD-SEN');
assert(summary.source_whole_race_error_less_than_modeled_shared_component);
if(process.argv.includes('--json'))console.log(JSON.stringify(summary,null,2));
else{
 console.log('SENATE TOTAL ERROR BUDGET + INDEPENDENT CAUCUS SENSITIVITY (UNPROMOTED)');
 console.table(results.map(x=>({case:x.case,d_senate:x.d_senate_control_pct,
  d_both:x.d_both_control_pct,change_both_pp:x.delta_both_from_headline_pp})));
 console.log('Retrospective full error:',oldRootMeanSquaredError,
 'Shared national+chamber+state sigma:',sharedSigma.toFixed(3),
 'Current minimum polled Senate total sigma:',Math.hypot(7,sharedSigma).toFixed(3));
 console.log('Independent side party IDs: ',summary.independent_party_proxy_codes);
 console.log('The headline forecast and its web presentation remain unchanged.');
}
