#!/usr/bin/env node
'use strict';
/*
 * Joint-control gap attribution. Research counterfactuals, NOT odds tuning:
 * isolate 2026-map House fundamentals, Senate poll/prior blending, and
 * cross-chamber covariance while holding individual marginal error scales
 * fixed in the correlation-only comparisons.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const model=require('./chamber_control_model.js');
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'..','data',name+'.json'),'utf8'));
const src={seats:read('seat_universe'),history:read('house_history_2024_staging'),
 geography:read('house_geography_bridge'),
 senateHistory:read('senate_history_2020_2022_2024'),
 polls:read('polling_estimates'),odds:read('race_probabilities'),
 presidential:read('presidential_2024_by_2026_district_staging')};
const base=model.prepare(src);
const presidential=model.prepare(src,{fundamentalsMode:'presidential_2024_shadow'});
assert.deepEqual(presidential.senate,base.senate,'House geography should not move Senate priors');
// An intentionally aggressive Senate-poll counterfactual to isolate the
// historical-prior pull. Do not silently promote it as a calibrated weight.
const senatePolls=new Map(src.odds.records.filter(x=>x.office==='senate')
 .map(x=>[x.race_code,x.dem_minus_rep]));
const pollDominant={...base,senate:base.senate.map(x=>
 x.polled&&senatePolls.has(x.code)?
 {...x,mean:senatePolls.get(x.code),method:'counterfactual_poll_dominant_'+x.method}:x)};
assert.equal(pollDominant.senate.length,35);
assert.equal(pollDominant.senate.filter(x=>x.method.startsWith('counterfactual_')).length,
 base.senate.filter(x=>x.polled).length);
// Reassign ONLY the all-chambers national variance to/from independent race
// residuals. Each race retains exactly the same total error variance in
// isolation, so differences in joint control diagnose CORRELATION, not
// falsely smaller/wider win uncertainties.
function sharedNationalCounterfactual(basis,newNationalSigma){
 const old=basis.assumptions.common_national_sigma;
 if(!Number.isFinite(newNationalSigma)||newNationalSigma<0||newNationalSigma>6)
  throw Error('Invalid counterfactual common national sigma');
 const local=r=>{
  const variance=r.sigma*r.sigma+old*old-newNationalSigma*newNationalSigma;
  if(variance<=0)throw Error('Correlation replacement exhausted local variance');
  return {...r,sigma:Math.sqrt(variance)};
 };
 const next={...basis,assumptions:{...basis.assumptions,
  common_national_sigma:newNationalSigma},
  house:basis.house.map(local),senate:basis.senate.map(local),
  governors:basis.governors.map(local)};
 for(const office of ['house','senate','governors']){
  for(let i=0;i<basis[office].length;i++){
   const a=basis[office][i],b=next[office][i];
   assert(Math.abs(a.sigma*a.sigma+old*old-
    b.sigma*b.sigma-newNationalSigma*newNationalSigma)<1e-7);
  }
 }
 return next;
}
const samples=6000,seed=20261103;
const cases=[
 ['current_headline',base],
 ['house_2026_map_presidential_shadow',presidential],
 ['senate_2026_polls_unshrunk_shadow',pollDominant],
 ['both_fundamentals_shadows',{...presidential,senate:pollDominant.senate}],
 ['no_national_common_error_same_marginal_variance',sharedNationalCounterfactual(base,0)],
 ['stronger_national_common_error_same_marginal_variance',sharedNationalCounterfactual(base,5)]
];
const result=cases.map(([name,basis])=>{
 const sim=model.simulate(basis,{samples,seed,explainControl:true});
 const c=sim.control_explanation;
 const joint=sim.blue_both_including_tsunami;
 assert(Math.abs(c.both_dem_pct-joint)<.01);
 assert(Math.abs(c.house_only_pct+c.senate_only_pct-sim.probabilities.shrug)<.02);
 assert(Math.abs(c.both_dem_pct+c.house_only_pct-
  sim.house_dem_control_pct)<.02);
 assert(Math.abs(c.both_dem_pct+c.senate_only_pct-
  sim.senate_dem_control_pct)<.02);
 assert.equal(c.senate_pivotal_races.length,35);
 assert.equal(c.top_house_pivotal_races.length,20);
 assert(c.senate_pivotal_races.every(r=>r.pivotal_draws>=0&&
  r.pivotal_draws<=samples));
 return {case:name,house_dem_control_pct:sim.house_dem_control_pct,
  senate_dem_control_pct:sim.senate_dem_control_pct,
  both_dem_control_pct:joint,house_only_pct:c.house_only_pct,
  senate_only_pct:c.senate_only_pct,neither_pct:c.neither_dem_pct,
  independent_product_reference_pct:c.independent_chambers_reference_pct,
  extra_joint_vs_independence_pp:
   +(joint-c.independent_chambers_reference_pct).toFixed(2),
  house_senate_control_phi:c.house_senate_control_phi,
  dem_house_seat_mean:sim.means.house_dem_seats,
  dem_senate_seat_mean:sim.means.senate_dem_seats,
  top_senate_control_pivots:c.senate_pivotal_races.slice(0,12),
  top_house_control_pivots:c.top_house_pivotal_races.slice(0,8),
  senate_race_probabilities:sim.race_probabilities.filter(x=>
   x.office==='senate').map(x=>({race_code:x.race_code,
    dem_win_pct:x.dem_beats_rep_pct,expected_dem_margin:x.model_dem_margin_points}))};
});
const reference=result[0],d=x=>+(x-reference.both_dem_control_pct).toFixed(2);
const report={
 status:'UNCALIBRATED_SAME_DRAW_JOINT_CONTROL_GAP_AUDIT',
 polling_snapshot:src.polls.generated_at,samples_per_case:samples,seed,
 modeled_2026_house_seats:435,modeled_senate_races:35,
 house_poll_coverage:base.generated_from_sources.house_poll_count,
 senate_poll_coverage:base.generated_from_sources.senate_poll_count,
 baseline_control_bottleneck:reference.house_dem_control_pct<
  reference.senate_dem_control_pct?'house':'senate',
 scenarios:result,
 both_control_deltas_from_current_pp:Object.fromEntries(result.slice(1)
  .map(x=>[x.case,d(x.both_dem_control_pct)])),
 interpretation:[
  'The product of chamber marginals is a purely diagnostic independence reference, NEVER the official joint probability.',
  'Presidential House results reflect actual 2026-map partisan geography, but the swing coefficients remain uncalibrated.',
  'Unshrunk Senate polling is an intentional extreme to isolate poll/prior discrepancies, not a better model by fiat.',
  'The last two scenarios keep standalone race error variance fixed; changes in joint control come from error covariance.',
  'Pivotal frequencies mean an isolated one-race result reversal changes chamber control in that simulated election. They do not show the causal impact of a campaign.',
  'Do not fit assumptions to match any proprietary third-party forecast. Require modern held-out forecast snapshots and historical outcomes for promotion.'
 ]
};
if(process.argv.includes('--json'))console.log(JSON.stringify(report,null,2));
else{
 console.log('JOINT-CONTROL FORECAST GAP ATTRIBUTION — sensitivity only');
 console.table(result.map(x=>({case:x.case,house:x.house_dem_control_pct,
  senate:x.senate_dem_control_pct,both:x.both_dem_control_pct,
  independent_product:x.independent_product_reference_pct,
  dependence_pp:x.extra_joint_vs_independence_pp})));
 console.log('Senate control pivots (same-draw modeled 2026 slate):');
 console.table(reference.top_senate_control_pivots);
 console.log('All percentage points are uncalibrated conditional model scenarios.');
}
