'use strict';
const assert=require('node:assert/strict'),{read}=require('./competitive_needle_prior.js');
const fixture={schema_version:'joint-control-beta-v1',race_probability_method:'SAME_CORRELATED_DRAWS_AS_CHAMBER_CONTROL',
 error_multiplier:1,national_shift_points:0,race_probabilities:[{race_code:'KS-SEN',office:'senate',polled:true,
  model_dem_margin_points:-.009170325,sigma_points:6.531,source_method:'2026_poll_blend_test',
  dem_beats_rep_pct:50.4,provider_called_party:null}]};
const before=JSON.stringify(fixture),prior=read(fixture,'KS-SEN');
assert.equal(prior.margin,-.009170325);assert.equal(prior.sigma,6.531);
assert.equal(JSON.stringify(fixture),before,'Reading a race prior never updates national simulation state');
assert(Object.isFrozen(prior));
const whatIf=structuredClone(fixture);whatIf.national_shift_points=20;whatIf.error_multiplier=2;
whatIf.race_probabilities[0].sigma_points*=2;
assert.deepEqual(read(whatIf,'KS-SEN'),prior,'Research swing/error controls do not become live forecast priors');
for(const winner of ['D','R']){
 const flagged=structuredClone(fixture);flagged.race_probabilities[0].provider_called_party=winner;
 flagged.race_probabilities[0].dem_beats_rep_pct=winner==='D'?100:0;
 assert.deepEqual(read(flagged,'KS-SEN'),prior,'Winner flags/conditional win percentages cannot substitute for latent prior parameters');
}
for(const change of [x=>x.schema_version='wrong',x=>x.race_probability_method='raw_returns',
 x=>x.error_multiplier=0,x=>x.error_multiplier=NaN,x=>x.race_probabilities=null,
 x=>x.race_probabilities.push({...x.race_probabilities[0]}),
 x=>x.race_probabilities[0].polled=false,x=>x.race_probabilities[0].office='house',
 x=>x.race_probabilities[0].source_method='2024_history',
 x=>x.race_probabilities[0].model_dem_margin_points=NaN,
 x=>x.race_probabilities[0].sigma_points='6.531',x=>x.race_probabilities[0].sigma_points=0]){
 const bad=structuredClone(fixture);change(bad);assert.equal(read(bad,'KS-SEN'),null);
}
assert.equal(read(null,'KS-SEN'),null);assert.equal(read(fixture,'TX-SEN'),null);
assert.equal(read(fixture,'IA-SEN'),null);
// Verify the contract against the actual linked-model exporter, including its
// rounded sigma under real supported research settings. These small draws test
// parameter plumbing only; their win percentages are never scored/published.
const fs=require('node:fs'),path=require('node:path'),model=require('./chamber_control_model.js');
const load=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'../data/'+name+'.json'),'utf8'));
const basis=model.prepare({seats:load('seat_universe'),history:load('house_history_2024_staging'),
 geography:load('house_geography_bridge'),senateHistory:load('senate_history_2020_2022_2024'),
 odds:load('race_probabilities'),polls:load('polling_estimates')});
const baseline=model.simulate(basis,{samples:300,seed:20261103});
const sensitivity=model.simulate(basis,{samples:300,seed:20261103,nationalShift:4,errorMultiplier:1.5});
for(const code of ['IA-SEN','KS-SEN','TX-SEN']){
 const a=read(baseline,code),b=read(sensitivity,code);assert(a&&b);
 assert.equal(a.margin,b.margin,'Actual exporter keeps the latent mean separate from research national shifts');
 assert(Math.abs(a.sigma-b.sigma)<=.001,'Base uncertainty survives exporter rounding and research error scaling');
}
console.log('Competitive needle starting margins use strict unconditioned linked-model inputs; research controls, winner flags and national mutation excluded PASS');

(async()=>{
 const {waitFor}=require('./competitive_needle_prior.js');let reads=0,pauses=0;
 assert.equal(await waitFor(()=>++reads===3?prior:null,{pause:async()=>{pauses++;}}),prior);
 assert.equal(reads,3);assert.equal(pauses,2);
 reads=0;pauses=0;
 assert.equal(await waitFor(()=>{reads++;return null;},{pause:async()=>{pauses++;}}),null);
 assert.equal(reads,21);assert.equal(pauses,20,'Missing model cannot cause an unbounded wait');
 let active=true;
 assert.equal(await waitFor(()=>null,{isCurrent:()=>active,pause:async()=>{active=false;}}),null);
 await assert.rejects(()=>waitFor(null),/unavailable/);
 console.log('Bounded linked-model startup wait, cancellation and unavailable-prior exhaustion PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
