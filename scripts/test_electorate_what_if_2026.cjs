#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const lab=require('./electorate_what_if_2026.js');
const model=require('./chamber_control_model.js');
const load=name=>JSON.parse(fs.readFileSync('data/'+name+'.json','utf8'));
const basis=model.prepare({
 seats:load('seat_universe'),history:load('house_history_2024_staging'),
 geography:load('house_geography_bridge'),
 senateHistory:load('senate_history_2020_2022_2024'),
 odds:load('race_probabilities'),polls:load('polling_estimates')
});
const input=(a,b,c,d,state='MI')=>({state,groups:[
 {share_pct:a,margin_change_points:b},
 {share_pct:c,margin_change_points:d}
]});
const q=lab.validate(input(42,6,9,4),basis);
assert.equal(q.ok,true);
assert(Math.abs(q.shift-2.88)<1e-9);
for(const test of [
 input(70,3,40,2),input(-1,3,10,3),input(101,3,0,0),
 input(30,Infinity,10,0),input(30,41,10,0),
 input(90,40,10,40),input(30,2,12,1,'ZZ')
])assert.equal(lab.validate(test,basis).ok,false);
assert.equal(lab.validate({state:'MI',groups:[]},basis).ok,false);
const mi=basis.senate.filter(x=>x.state==='MI');
assert.equal(mi.length,1);
const baselineMeans=[...basis.house,...basis.senate,...basis.governors].map(r=>r.mean);
// Run the REAL shared-error model, not a probability mapping proxy.
const scenario=lab.evaluate(basis,input(45,6,8,4),model.simulate,{samples:500,seed:20261103});
assert.equal(scenario.ok,true,scenario.reason);
assert.equal(scenario.state_margin_shift_points,3.02);
assert.equal(scenario.published_model_modified,false);
assert.equal(scenario.census_or_turnout_shares_verified,false);
assert.equal(scenario.live_source_votes_used,false);
assert(scenario.affected_races.some(x=>x.race_code==='MI-SEN'));
assert(scenario.affected_races.every(x=>x.race_code.startsWith('MI-')));
assert(scenario.affected_races.every(x=>x.after>=x.before));
assert(scenario.scenario.both_control>=scenario.baseline.both_control);
assert.deepEqual([...basis.house,...basis.senate,...basis.governors].map(r=>r.mean),baselineMeans,
 'Research scenario must never mutate published race priors');
const bundleInput={...input(30,6,8,4),states:['MI','PA','WI']};
const bundle=lab.evaluate(basis,bundleInput,model.simulate,
 {samples:400,seed:20261103});
assert.equal(bundle.ok,true,bundle.reason);
assert.deepEqual(bundle.states,['MI','PA','WI']);
assert(bundle.affected_races.some(x=>x.race_code==='MI-SEN'));
assert(bundle.affected_races.some(x=>x.race_code.startsWith('PA-')));
assert(bundle.affected_races.some(x=>x.race_code.startsWith('WI-')));
assert(bundle.affected_races.every(x=>['MI','PA','WI'].includes(x.race_code.slice(0,2))));
assert(bundle.affected_races.every(x=>x.change>=0));
assert(bundle.scenario.both_control>=bundle.baseline.both_control);
assert.equal(lab.evaluate(basis,{...bundleInput,states:['MI','MI']},model.simulate).ok,false);
assert.equal(lab.evaluate(basis,{...bundleInput,states:['MI','ZZ']},model.simulate).ok,false);
assert.deepEqual([...basis.house,...basis.senate,...basis.governors].map(r=>r.mean),
 baselineMeans,'Bundled sensitivity cannot change real model inputs');
const noChange=lab.evaluate(basis,input(0,0,0,0),model.simulate,{samples:300});
assert.equal(noChange.ok,true);
assert.deepEqual(noChange.baseline,noChange.scenario);
assert(noChange.affected_races.every(x=>x.change===0));
const anti=lab.evaluate(basis,input(35,-8,10,-2),model.simulate,{samples:400});
assert.equal(anti.ok,true);
assert(anti.affected_races.every(x=>x.after<=x.before));
assert.equal(lab.evaluate(basis,input(70,5,40,5),model.simulate).ok,false);
console.log('State electorate sensitivity: real 506-race shared model, voter-share assumptions, no mutation or live contamination PASS');
