'use strict';
const assert=require('node:assert/strict'),model=require('./chamber_control_model.js'),kernel=require('./national_county_likelihood.js'),{load,envelope}=require('./nebraska_test_fixture.cjs');
const basis=model.prepare({seats:load('seat_universe'),history:load('house_history_2024_staging'),geography:load('house_geography_bridge'),senateHistory:load('senate_history_2020_2022_2024'),odds:load('race_probabilities'),polls:load('polling_estimates')});
const now=Date.parse('2026-11-04T04:06:00Z'),opts={samples:900,seed:20261103,now,independentSenateCredit:'no_credit'},seat=basis.senate.find(r=>r.code==='NE-SEN');
assert.equal(seat.nonrep_independent_proxy,true);
const expected=envelope(0,now,{expectedMargin:seat.mean,blueFirst:true}),surprise=envelope(3,now,{expectedMargin:seat.mean,blueFirst:true});
const perf=kernel.compile(expected,opts).describePerformance(seat.mean),up=kernel.compile(surprise,opts).describePerformance(seat.mean);
assert(Math.abs(perf.difference_margin_scenarios[0])<.02,'Expected Osborn-friendly counties are not a national surprise');
assert(Math.abs(up.difference_margin_scenarios[0]-3)<.02,'Three-point surprise is matched margin outperformance, not a probability');
assert.equal(perf.positive_candidate,'Osborn');assert.equal(perf.negative_candidate,'Ricketts');assert.match(perf.historical_transfer,/different.*seat/);assert.equal(perf.calibrated,false);
const baseline=kernel.condition(model,basis,[],opts),blue=kernel.condition(model,basis,[envelope(18,now)],opts),red=kernel.condition(model,basis,[envelope(-18,now)],opts);
assert.equal(blue.diagnostics.used[0].code,'NE-SEN');assert.equal(blue.diagnostics.state_likelihood_budget_members.NE,1);assert(blue.diagnostics.state_likelihood_max_ratio.NE<=20+1e-8);assert(blue.diagnostics.effective_sample_size>=450-1e-6);
assert.deepEqual(blue.baseline,baseline.result);assert.notDeepEqual(blue.result.probabilities,red.result.probabilities);assert.equal(blue.result.senate_independent_credit_mode,'no_credit');
assert.equal(blue.result.race_probabilities.find(r=>r.race_code==='NE-SEN').provider_called_party,null);assert(blue.result.race_probabilities.find(r=>r.race_code==='NE-SEN').dem_beats_rep_pct>red.result.race_probabilities.find(r=>r.race_code==='NE-SEN').dem_beats_rep_pct);
for(const mutate of [e=>e.baseline_scenario='same-seat',e=>e.baseline.same_Senate_seat_as_2026=true,e=>e.snapshot.candidate_contrast='D_V_R',e=>e.snapshot.caucus_credit_assumed=true,e=>e.snapshot.counties[0].dem_votes=1,e=>e.snapshot.counties[0].other_candidates.pop(),e=>e.snapshot.snapshot_updated_at='2026-10-15T00:00:00Z']){
 const invalid=structuredClone(expected);mutate(invalid);const excluded=kernel.condition(model,basis,[invalid],opts);assert.equal(excluded.diagnostics.used.length,0);const {county_results_update,...numeric}=excluded.result;assert.deepEqual(numeric,baseline.result);
}
const wrongMatch={...basis,senate:basis.senate.map(r=>r.code==='NE-SEN'?{...r,nonrep_independent_proxy:false}:r)};
assert.throws(()=>kernel.condition(model,wrongMatch,[expected],opts),/matchup identities/,'A mismatched Independent model basis must fail closed, not silently restore caucus assumptions');
assert.equal(kernel.condition(model,basis,[expected],{...opts,independentSenateCredit:'dem_proxy'}).diagnostics.used.length,0,'No Independent counts may enter a D-caucus proxy scenario');
for(const result of [blue.result,red.result]){assert.equal(Object.values(result.counts).reduce((s,v)=>s+v,0),900);assert(Math.abs(Object.values(result.probabilities).reduce((s,v)=>s+v,0)-100)<.05);assert.equal(result.actual_dem_both_control_pct,result.blue_both_including_tsunami);}
const focus=require('./personal_election_focus.js'),history=focus.createHistory({now:()=>now});
assert(history.observe({active:true,result:blue.result,envelopes:[envelope(18,now)],revision:'NE_TYPED',pollingAt:'2026-11-03T12:00:00Z'}));assert.equal(history.events()[0].source_count,1);
console.log('NE typed Independent-v-R performance/expectation/ESS/control/call separation/history and invalid-source baseline invariance PASS; SYNTHETIC only, not calibration');
const vm=require('node:vm'),fs=require('node:fs'),demo={};vm.runInNewContext(fs.readFileSync(require.resolve('./national_needle_rehearsal.js'),'utf8'),{window:demo});
(async()=>{const inputs=await demo.NationalNeedleRehearsal.load(async p=>JSON.parse(fs.readFileSync(p,'utf8'))),scenes=[1,2,3].map(step=>demo.NationalNeedleRehearsal.stage(inputs,step,basis)),fakeNow=demo.NationalNeedleRehearsal.now;
 assert.equal(inputs.length,9);const neScenes=scenes.map(rows=>rows.find(e=>e.snapshot.race_code==='NE-SEN'));
 for(const e of neScenes){assert(!JSON.stringify(e).includes('dem_votes'));assert.equal(e.rehearsal,true);}
 const description=neScenes.map(e=>kernel.compile(e,{now:fakeNow,rehearsal:true}).describePerformance(seat.mean));
 assert(Math.abs(description[0].difference_margin_scenarios[0])<.02);assert(Math.abs(description[1].difference_margin_scenarios[0]-3)<.02);assert(Math.abs(description[2].difference_margin_scenarios[0])<.02);
 const scenario=kernel.condition(model,basis,scenes[1],{...opts,now:fakeNow,rehearsal:true});assert.equal(scenario.diagnostics.used.length,9);assert(scenario.diagnostics.used.some(e=>e.code==='NE-SEN'));
 assert.equal(kernel.condition(model,basis,neScenes.slice(0,1),{...opts,now:fakeNow}).diagnostics.used.length,0,'Fictional NE scene cannot enter live mode');
 console.log('Shared9-input rehearsal includes typed Osborn expected/surprise/correction without D relabeling or live-state leakage PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
