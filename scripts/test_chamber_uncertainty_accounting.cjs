#!/usr/bin/env node
'use strict';
// Entirely fictional margins, state distributions and races. This verifies
// spread accounting and preserves prior same-seed simulator behavior; it is
// not a source-input, geography or predictive-calibration test.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const model=require('./chamber_control_model.js');
const row=(code,state,i,method='fictional_unchanged')=>({code,state,
 mean:(i%13-6)*2,sigma:4+i%4,method,polled:false,poll_weight:null,
 redrawn_mix_weight:0,redrawn_state_center:null});
const house=Array.from({length:435},(_,i)=>row('FICTION-H'+i,'FH'+i%10,i));
house[0]={...row('FICTION-REDRAW-UNPOLLED','FR',0,
 'redrawn_state_distribution_proxy'),mean:-2,sigma:5,
 redrawn_mix_weight:1,redrawn_state_center:0};
house[1]={...row('FICTION-REDRAW-POLLED','FR',1,
 'poll_blend_redrawn_state_distribution_proxy'),mean:3,sigma:4,
 polled:true,poll_weight:.75,redrawn_mix_weight:.25,redrawn_state_center:0};
const senate=Array.from({length:35},(_,i)=>({...row('FICTION-S'+i,'FS'+i%6,i),
 nonrep_independent_proxy:i<2}));
const governors=Array.from({length:6},(_,i)=>row('FICTION-G'+i,'FG'+i,i));
const basis={schema_version:model.VERSION,senate_prior_mode:'current_2026',
 house,senate,governors,redrawn_state_distributions:{FR:[-20,20]},
 assumptions:{house_seats:435,senate_contested:35,
  senate_dem_holdovers:34,senate_rep_holdovers:31,
  house_control_dem_seats:218,senate_control_dem_seats:51,
  common_national_sigma:2,house_chamber_sigma:3,senate_chamber_sigma:3.5,
  governor_chamber_sigma:4,state_house_sigma:4,state_senate_sigma:3,
  state_governor_sigma:3,redrawn_state_additional_sigma:5}};
const cases=[
 {name:'baseline',options:{}},
 {name:'wider_errors',options:{errorMultiplier:1.4}},
 {name:'narrower_errors',options:{errorMultiplier:.6}},
 {name:'live_and_calls',options:{live:{
  'FICTION-REDRAW-UNPOLLED':{mode:'live_informed',posteriorMargin:6,posteriorSigma:4},
  'FICTION-REDRAW-POLLED':{mode:'source_called',winnerParty:'R'}}}}
];
const additions=['gaussian_sigma_points','redrawn_permutation_sigma_points',
 'total_latent_sigma_points','uncertainty_method'];
const withoutAdditions=({source_call_conditioning,...result})=>({...result,race_probabilities:
 result.race_probabilities.map(item=>Object.fromEntries(Object.entries(item)
  .filter(([key])=>!additions.includes(key))))});
// Hashes are captured from the untouched simulator with this fixed fictional
// basis. They include all legacy per-race/chamber odds, counters, intervals,
// assumptions, call behavior and attribution, not only selected headline odds.
const legacyHashes={
 baseline:'2f91dac828f8d35d8ad3db896b92968bdec07bf3ac141a4936aa2c894116d700',
 wider_errors:'9a3554b2adf1dc54b618515c04d5deb9c0fa760a292987dc2a77005ca6bb635f',
 narrower_errors:'f46f80d3248b3e05d65fa296b3a8db85fe8061eeb2acff774f69906212684875',
 live_and_calls:'ced3ce3086215d7334140e716d44c55cdb69df078ffe3909c76a5055229967ce'
};
const rounded=n=>Math.round(n*1000)/1000;
for(const item of cases){
 const result=model.simulate(basis,{samples:600,seed:19760408,
  independentSenateCredit:'no_credit',explainControl:true,...item.options});
 const legacyHash=crypto.createHash('sha256')
  .update(JSON.stringify(withoutAdditions(result))).digest('hex');
 assert.equal(legacyHash,legacyHashes[item.name],
  item.name+': additive metadata must not alter any legacy simulator output');
 const multiplier=item.options.errorMultiplier??1;
 for(const [index,permutationSigma,localSigma,stateSigma] of
  [[0,20,5,9],[1,5,4,9],[2,0,6,4]]){
  const actual=result.race_probabilities[index];
  const gaussianSigma=Math.hypot(localSigma,2,3,stateSigma)*multiplier;
  assert.equal(actual.sigma_points,rounded(gaussianSigma));
  assert.equal(actual.gaussian_sigma_points,actual.sigma_points);
  assert.equal(actual.redrawn_permutation_sigma_points,permutationSigma,
   'The finite-population permutation is outside the Gaussian error multiplier');
  assert.equal(actual.total_latent_sigma_points,
   rounded(Math.hypot(gaussianSigma,permutationSigma)),
   'Use population variance (N denominator), not sample variance (N-1)');
  assert.equal(actual.uncertainty_method,
   'EXPERIMENTAL_BASELINE_LATENT_SPREAD_NOT_CALIBRATED_INTERVAL');
 }
 const unchanged=result.race_probabilities.filter((_,i)=>i!==0&&i!==1);
 assert(unchanged.every(r=>r.redrawn_permutation_sigma_points===0&&
  r.total_latent_sigma_points===r.sigma_points),
  'Unchanged House, Senate and governor baselines have no redraw component');
 if(item.name==='live_and_calls'){
  assert.equal(result.race_probabilities[1].provider_called_party,'R');
  assert.equal(result.race_probabilities[1].dem_beats_rep_pct,0);
 }
}
console.log('Chamber uncertainty accounting passed: fictional redrawn/polled/'+
 'unchanged rows, finite-population spread, error multipliers and legacy same-draw outputs.');
