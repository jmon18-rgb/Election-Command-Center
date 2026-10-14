#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const model=require('./chamber_control_model.js');
const load=name=>JSON.parse(fs.readFileSync('data/'+name+'.json','utf8'));
const sources={
 seats:load('seat_universe'),history:load('house_history_2024_staging'),
 geography:load('house_geography_bridge'),
 senateHistory:load('senate_history_2020_2022_2024'),
 odds:load('race_probabilities'),polls:load('polling_estimates')
};
const basis=model.prepare(sources);
assert.equal(basis.status,'EXPERIMENTAL_UNCALIBRATED');
assert.equal(basis.house.length,435);
assert.equal(basis.senate.length,35);
assert.equal(basis.governors.length,6);
assert.equal(basis.battlegrounds.length,20);
assert.equal(basis.assumptions.senate_dem_holdovers,34);
assert(basis.generated_from_sources.generic_ballot_margin>0);
assert(basis.generated_from_sources.house_geography_changed>0);
assert.equal(basis.house.filter(r=>r.polled).length,60);
assert.equal(basis.senate.filter(r=>r.polled).length,24);
assert(basis.senate.filter(r=>r.polled).every(r=>r.sigma>=7),
 'Current Senate poll estimates must not use election-error widths below seven points');
// A Silver-inspired disagreement penalty is symmetric in party direction.
// Stronger polling/prior conflict widens errors, not the expected D or R margin.
assert.equal(model.disagreementExtraSigma(2,2,.65),0);
assert.equal(model.disagreementExtraSigma(10,3,.65),.228);
assert.equal(model.disagreementExtraSigma(-10,-3,.65),.228);
assert.equal(model.disagreementExtraSigma(50,-50,1),6);
assert.equal(model.disagreementExtraSigma(20,-20,0),0,
 'Exchangeable redraw priors cannot be treated as comparable district fundamentals');
assert.throws(()=>model.disagreementExtraSigma(2,1,1.1),/Invalid disagreement/);
assert.equal(basis.assumptions.disagreement_model,
 'experimental_poll_vs_informative_prior_sigma_only');
assert(basis.house.some(x=>x.polled&&x.disagreement_extra_sigma_points>0),
 'At least one well-identified House race should have poll/prior disagreement');
assert(basis.senate.some(x=>x.polled&&x.disagreement_extra_sigma_points>0),
 'At least one comparable Senate race should have poll/prior disagreement');
assert(basis.house.filter(x=>x.polled&&x.method.includes('redrawn_'))
 .every(x=>x.poll_fundamentals_gap_points===null &&
  x.disagreement_extra_sigma_points===0),
 'Redrawn-state aggregates are not mapped seat-specific priors');
assert(basis.senate.filter(x=>x.special)
 .every(x=>x.poll_fundamentals_gap_points===null &&
  x.disagreement_extra_sigma_points===0),
 'Senate special elections cannot be judged against a different seat');
assert([...basis.house,...basis.senate].every(x=>
 x.disagreement_extra_sigma_points>=0 &&
 x.disagreement_extra_sigma_points<=6));

const specialSeats=basis.senate.filter(x=>x.special);
assert.equal(specialSeats.length,2);
assert(specialSeats.every(x=>!x.method.includes('historical_2020_senate')),
 'A 2026 special cannot borrow a different seat\'s 2020 regular Senate baseline');

assert(basis.house.some(r=>r.method==='redrawn_state_distribution_proxy'));
assert(basis.house.some(r=>r.method==='uncontested_or_missing_party_proxy'));
const rebuilt=new Map(basis.house.map(r=>[r.code,r]));
const los=rebuilt.get('CA-01');
assert(los&&los.method.includes('redrawn_'),
 'Changed-boundary districts must never use a 2024 district-specific mapping');

const rebuiltCA=basis.house.filter(x=>x.state==='CA');
const unpolledRedraw=rebuiltCA.filter(x=>x.redrawn_mix_weight===1);
assert(unpolledRedraw.length>35,
 'Most new California districts lack named-matchup polls');
assert.equal(new Set(unpolledRedraw.map(x=>x.mean)).size,1,
 'Unpolled redrawn district numbers cannot determine their assigned 2024 party margin');
assert.equal(new Set(unpolledRedraw.map(x=>x.redrawn_state_center)).size,1);
assert.equal(basis.redrawn_state_distributions.CA.length,52);
assert.equal(basis.redrawn_state_distributions.TX.length,38);
assert.equal(basis.redrawn_state_distributions.NC.length,14);
for(const [state,marginList] of Object.entries(basis.redrawn_state_distributions)){
 const count=basis.house.filter(x=>x.state===state&&x.method.includes('redrawn_')).length;
 assert.equal(marginList.length,count,'One prior district margin per new House seat: '+state);
 assert(marginList.every(Number.isFinite),'Redrawn baseline must have finite margins');
}
assert(basis.house.some(x=>x.polled&&x.method.includes('redrawn_')&&
 x.redrawn_mix_weight>0&&x.redrawn_mix_weight<1),
 'Polled redrawn districts mix poll and *exchangeable* old state distribution');

const unchanged=rebuilt.get('AK-01');
assert(unchanged&&unchanged.method.includes('unchanged_2024_recorded'));
const known=new Set([...basis.house,...basis.senate,...basis.governors].map(x=>x.code));
assert.equal(known.size,476);
for(const seat of [...basis.house,...basis.senate,...basis.governors]){
 assert(seat.state.length===2);
 assert(seat.mean>=-60&&seat.mean<=60&&seat.sigma>=5);
}
const before=JSON.stringify(basis);
const opts={samples:1200,seed:20261103};
const first=model.simulate(basis,opts),second=model.simulate(basis,opts);
const redrawnOnly=model.simulate(basis,{samples:1200,seed:20261104});
assert.notDeepEqual(redrawnOnly.counts,first.counts,
 'Re-drawn seat assignment and independent error must vary across seeded draws');
assert.throws(()=>model.simulate({...basis,redrawn_state_distributions:{
 ...basis.redrawn_state_distributions,CA:[]}},opts),/No verified redrawn state prior/);

assert.deepEqual(first,second,'Seeds must make simulated election outcomes reproducible');
assert.equal(JSON.stringify(basis),before,'Forecast must not modify source priors');
assert.equal(first.counts.blue_tsunami+first.counts.blue_wave+
 first.counts.shrug+first.counts.red_dawn,first.samples);
assert(Math.abs(first.total_pct-100)<0.025);
assert(Math.abs(first.blue_both_including_tsunami-
 first.probabilities.blue_wave-first.probabilities.blue_tsunami)<.025);
for(const x of Object.values(first.probabilities))
 assert(Number.isFinite(x)&&x>=0&&x<=100);
assert(first.means.house_dem_seats>0&&first.means.house_dem_seats<435);
assert(first.means.senate_dem_seats>=30&&first.means.senate_dem_seats<=73);
assert.equal(first.house_dem_control_pct,null,'No uncalibrated named subforecast unless modeled');
assert.throws(()=>model.prepare({...sources,odds:{...sources.odds,
 polling_source_generated_at:'1970-01-01T00:00:00Z'}}),/stale or mismatched/);
assert.throws(()=>model.prepare({...sources,history:{records:[]}}),/stale or mismatched/);
assert.throws(()=>model.simulate({...basis,house:basis.house.slice(1)}),/Incomplete/);
assert.throws(()=>model.simulate(basis,{samples:0}),/Unacceptable/);
assert.throws(()=>model.simulate(basis,{samples:999999}),/Unacceptable/);
assert.throws(()=>model.simulate(basis,{samples:1000,senateDemHoldovers:45}),/holdovers/);
// No fabricated official certification: a raw modeled race prior, no result,
// cannot be directly interpreted as an observed live vote or an official call.
const shock=model.simulate(basis,{samples:1200,seed:20261103,
 live:{'NC-SEN':{mode:'live_informed',posteriorMargin:-40,posteriorSigma:1}}});
assert.notDeepEqual(shock,first,'Observed-result map should affect simulations');
console.log('Joint congressional beta: all 470 contested seats, 6 gov battlegrounds, 4 exhaustive outcomes, geographically cautious assumptions, reproducible seeded draws');
console.log('Model probabilities (diagnostic only):',JSON.stringify(first.probabilities));
