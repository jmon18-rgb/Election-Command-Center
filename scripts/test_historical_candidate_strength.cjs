#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const load=n=>JSON.parse(fs.readFileSync('data/'+n+'.json','utf8'));
const hist=require('./historical_candidate_strength.js');
const feat=require('./incumbency_features.js'),model=require('./chamber_control_model.js');
const ctx=load('candidate_fundamentals_staging');
const input={
 candidateContext:ctx,house2024:load('house_history_2024_staging'),
 houseNames:load('house_2024_candidate_results_staging'),
 presidential2024:load('presidential_2024_by_2026_district_staging'),
 geography:load('house_geography_bridge'),
 senateHistory:load('senate_history_2020_2022_2024'),
 presidential2020:load('presidential_2020_state_staging')
};
const computed=hist.build(input);
assert.deepEqual(computed,load('historical_candidate_overperformance_2026'),
 'Committed incumbent margins must be reproducible, not hand-entered');
assert.deepEqual(hist.enrichCandidateContext(ctx,computed),ctx,
 'Candidate provenance is reproducible and stable across reruns');
assert.equal(computed.coverage.house_eligible,149);
assert.equal(computed.coverage.senate_eligible,12);
assert.equal(computed.methodology.house_reference_districts,213);
assert.equal(computed.methodology.senate_reference_states,31);
assert.equal(computed.records.length,506);
const byCode=new Map(computed.records.map(x=>[x.race_code,x]));
assert.equal(byCode.get('AZ-06').candidate_name,'Juan Ciscomani');
assert.equal(byCode.get('AZ-06').prior_election_year,2024);
assert.equal(byCode.get('AZ-06').overlap_fraction_verified,1);
assert.equal(byCode.get('AZ-06').prior_candidate_name,'Juan Ciscomani');
assert.equal(byCode.get('ME-SEN').candidate_name,'Susan Collins');
assert.equal(byCode.get('ME-SEN').prior_election_year,2020);
assert.equal(byCode.get('ME-SEN').candidate_signed_raw_excess_margin_points,17.757);
assert.equal(byCode.get('ME-SEN').candidate_signed_capped_excess_margin_points,12);
assert.equal(byCode.get('MN-SEN').candidate_signed_raw_excess_margin_points,null);
assert.equal(byCode.get('MN-02').candidate_signed_raw_excess_margin_points,null);
assert.equal(byCode.get('MN-GOV').candidate_signed_raw_excess_margin_points,null);
assert([...byCode.values()].filter(x=>x.office==='governor').every(x=>
 x.candidate_signed_raw_excess_margin_points===null));
// A 2024 party winner CANNOT be rebranded as today's DIFFERENT candidate.
// Verify geography guards and third-party/party vote inconsistencies.
assert([...byCode.values()].some(x=>x.status==='blocked_2024_2026_house_redistricting'));
assert([...byCode.values()].some(x=>x.status==='blocked_house_source_vote_disagreement'));
assert([...byCode.values()].some(x=>x.status==='blocked_house_uncontested_or_missing_votes'));
assert([...byCode.values()].some(x=>x.status==='blocked_house_candidate_name_or_winner_mismatch'));
assert(computed.records.filter(x=>x.candidate_signed_raw_excess_margin_points!==null).every(x=>
 x.status.startsWith('matched_historic_winner_')&&
 x.overlap_fraction_verified===1));
assert.equal(hist.namesMatch('Susan M. Collins','SUSAN MARGARET COLLINS'),true);
assert.equal(hist.namesMatch('Angie Craig','Matt Little'),false);
assert.equal(hist.namesMatch('SUSAN COLLINS','Cory Booker'),false);
const badHouse=structuredClone(input);
badHouse.houseNames.records.find(x=>x.race_code==='AZ-06').rep_name='Different Person';
const manipulated=hist.build(badHouse);
assert.equal(new Map(manipulated.records.map(x=>[x.race_code,x])).get('AZ-06').status,
 'blocked_house_candidate_name_or_winner_mismatch');
const badGeo=structuredClone(input);
badGeo.geography.districts.find(x=>x.race_code_2026==='AZ-06').geography_comparable_2024=false;
assert.equal(new Map(hist.build(badGeo).records.map(x=>[x.race_code,x])).get('AZ-06').status,
 'blocked_2024_2026_house_redistricting');
const stage=feat.validate(ctx).map;
assert.equal(stage.get('ME-SEN').rep.elected_vs_appointed,'elected');
assert.equal(stage.get('AZ-06').rep.elected_vs_appointed,'elected');
assert.equal(stage.get('AZ-06').rep.verified_old_new_district_overlap_fraction,1);
assert.equal(feat.explain(stage.get('AZ-06')).candidates[1].personal_incumbency_eligible,true);
const sources={
 seats:load('seat_universe'),history:input.house2024,geography:input.geography,
 senateHistory:input.senateHistory,odds:load('race_probabilities'),
 polls:load('polling_estimates'),presidential:input.presidential2024
};
const basis=model.prepare(sources);
const coeff={prior_race_residual_weight:.25};
const s0=feat.scenarioBasis(model,basis,ctx,sources.polls,coeff);
const baseHouse=new Map(basis.house.map(x=>[x.code,x]));
// The published House basis uses 2024 House returns DIRECTLY.
// Never add incumbent's 2024 residual a second time.
assert(s0.house.every((r,i)=>r.mean===basis.house[i].mean),
 'Historic incumbent performance is already embedded in 2024 House vote baseline');
assert(s0.candidate_scenario.skipped.some(x=>x.reason==='historic_strength_already_in_prior'));
const hShadow=model.prepare(sources,{fundamentalsMode:'presidential_2024_shadow'});
const hScenario=feat.scenarioBasis(model,hShadow,ctx,sources.polls,coeff);
const houseChanged=hScenario.candidate_scenario.changes.filter(x=>x.office==='house');
assert(houseChanged.length>30);
assert(houseChanged.every(x=>Math.abs(x.historical_vote_embedded_fraction-.35)<1e-10));
const matchingUnpolled=houseChanged.find(x=>!new Map(hShadow.house.map(z=>[z.code,z])).get(x.race_code).polled);
assert(matchingUnpolled);
const cand=stage.get(matchingUnpolled.race_code);
const last=cand.incumbent_candidate_party==='DEM'?cand.dem:cand.rep;
const sign=cand.incumbent_candidate_party==='DEM'?1:-1;
const expected=sign*Math.max(-12,Math.min(12,last.incumbent_last_race_overperformance_points))*
 .25*.65;
assert(Math.abs(matchingUnpolled.applied_margin_delta_points-expected)<.01);
const senateChanges=s0.candidate_scenario.changes.filter(x=>x.office==='senate');
assert(senateChanges.length>=1);
assert(senateChanges.every(x=>Math.abs(x.historical_vote_embedded_fraction-.65)<1e-10));
// The same voter attitudes cannot be counted as both an already-observed
// 2020 Senate margin and another full-strength prior-race incumbent boost.
const me=senateChanges.find(x=>x.race_code==='ME-SEN');
assert(me);
const meBasis=basis.senate.find(x=>x.code==='ME-SEN');
assert(Math.abs(me.applied_margin_delta_points-
 -12*.25*.35*(1-meBasis.poll_weight))<.001);
assert.deepEqual(model.prepare(sources),basis,'Scenario must not mutate headline assumptions');
assert.deepEqual(feat.scenarioBasis(model,basis,ctx,sources.polls,{}).house,basis.house);
const sim=model.simulate(s0,{samples:350,seed:20261103});
assert.equal(sim.status,'EXPERIMENTAL_UNCALIBRATED');
console.log('Reproduced 149 House and 12 Senate prior-election candidate residuals; same-year national offset, old-name and map guards, no-double-count and scenario tests PASS.');
