#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const features=require('./incumbency_features.js');
const stage=JSON.parse(fs.readFileSync('data/candidate_fundamentals_staging.json','utf8'));
const {map,counts}=features.validate(stage);
assert.deepEqual(counts,{house:435,senate:35,governor:36});
assert.equal(map.size,506);
assert.equal(features.explain(map.get('TN-SEN')).open_seat,null,
 'Conflicting incumbent records must not be misclassified open');
assert.equal(features.explain(map.get('CA-06')).open_seat,null,
 'Candidate ID/party conflict must not be classified open');
assert.equal(features.explain(map.get('RI-02')).open_seat,null);

const mnSen=features.explain(map.get('MN-SEN'));
const mnGov=features.explain(map.get('MN-GOV'));
assert.equal(mnSen.open_seat,true);
assert.equal(mnGov.open_seat,true);
assert.equal(mnSen.executive_approval.net_approval_points,-14);
assert.equal(mnSen.executive_approval.population,'Minnesota likely voters');
assert.equal(mnSen.candidates[0].name,'Peggy Flanagan');
assert.equal(mnSen.candidates[0].same_office_incumbent,false);
assert.equal(mnSen.candidates[0].public_office_experience,
 'current_minnesota_lieutenant_governor');
assert.equal(mnGov.candidates[0].name,'Amy Klobuchar');
assert.equal(mnGov.candidates[0].same_office_incumbent,false);
assert.equal(mnGov.candidates[0].public_office_experience,
 'current_us_senator_different_office');
assert.equal(mnSen.administration_links.filter(x=>x.personal_administration_member).length,1);
assert.equal(mnGov.administration_links.filter(x=>x.personal_administration_member).length,0);
assert.equal(features.sensitivity(map.get('MN-SEN')).raw_prior_margin_adjustment_points,0);
assert.equal(features.sensitivity(map.get('MN-GOV')).raw_prior_margin_adjustment_points,0);
// Hypothetical net-approval transfer: not an empirical causal inference,
// not a direct 2026 outcome prediction, and not added to the polls.
const assumed={administration_approval_transfer_per_net_point:.15};
const scenarioSen=features.sensitivity(map.get('MN-SEN'),assumed);
const scenarioGov=features.sensitivity(map.get('MN-GOV'),assumed);
assert.equal(scenarioSen.raw_prior_margin_adjustment_points,-2.1);
assert.equal(scenarioGov.raw_prior_margin_adjustment_points,0);
assert.equal(scenarioSen.status,'COUNTERFACTUAL_FEATURE_SENSITIVITY_NOT_ELECTION_FORECAST');
assert.throws(()=>features.sensitivity(map.get('MN-SEN'),{
 administration_approval_transfer_per_net_point:-.15}),/Invalid experimental/);
assert.throws(()=>features.sensitivity(map.get('MN-SEN'),{
 partisan_boost:3}),/Unsupported sensitivity/);
const alteredApproval=structuredClone(stage);
alteredApproval.records.find(r=>r.race_code==='MN-SEN').executive_approval_context.approve_pct=112;
assert.throws(()=>features.validate(alteredApproval),/Invalid executive approval/);
const alteredIdentity=structuredClone(stage);
alteredIdentity.records.find(r=>r.race_code==='MN-SEN').dem.incumbent_same_seat_candidate=true;
assert.throws(()=>features.validate(alteredIdentity),/Unsupported incumbency/);
const missingHouse=structuredClone(stage);
missingHouse.records=missingHouse.records.slice(1);
assert.throws(()=>features.validate(missingHouse),/Incomplete candidate context/);
const duplicate=structuredClone(stage);
duplicate.records[1].race_code=duplicate.records[0].race_code;
assert.throws(()=>features.validate(duplicate),/Invalid or duplicate/);
const falseAdmin=structuredClone(stage);
falseAdmin.records.find(r=>r.race_code==='MN-GOV').administration_links[0].personal_administration_member=true;
assert.throws(()=>features.validate(falseAdmin),/Invalid MN governor\/Senate/);
// A Senate elected incumbent with independent evidence can receive a
// user-specified scenario benefit, but an appointed incumbent or conflicting
// candidate ID does NOT acquire it.
const example=structuredClone(map.get('AK-SEN'));
const incumbent=example.rep;
assert.equal(incumbent.incumbent_same_seat_candidate,true);
assert.equal(incumbent.elected_vs_appointed,'elected',
 '2020 named winner is independently verified');
incumbent.elected_vs_appointed='unverified'; // Explicit synthetic unknown-status test
assert.equal(features.sensitivity(example,{same_office_incumbent_points:2})
 .raw_prior_margin_adjustment_points,0);
incumbent.elected_vs_appointed='elected';
assert.equal(features.sensitivity(example,{same_office_incumbent_points:2})
 .raw_prior_margin_adjustment_points,-2);
incumbent.first_term=true;incumbent.incumbent_last_race_overperformance_points=16;
assert.equal(features.sensitivity(example,{same_office_incumbent_points:2,
 first_term_increment_points:.5,prior_race_residual_weight:.2})
 .raw_prior_margin_adjustment_points,-4.9);
incumbent.elected_vs_appointed='appointed';
assert.equal(features.sensitivity(example,{same_office_incumbent_points:2})
 .raw_prior_margin_adjustment_points,0);
const house=structuredClone([...map.values()].find(x=>x.office==='house'&&
 x.incumbent_candidate_party!==null&&
 (x.incumbent_candidate_party==='DEM'?x.dem:x.rep)
  .verified_old_new_district_overlap_fraction===null));
assert(house,'House incumbent example required');
const candidate=house.incumbent_candidate_party==='DEM'?house.dem:house.rep;
candidate.elected_vs_appointed='elected';
assert.equal(features.sensitivity(house,{same_office_incumbent_points:2})
 .raw_prior_margin_adjustment_points,0,'No assumed House incumbency with unknown redistricted overlap');
candidate.verified_old_new_district_overlap_fraction=.5;
assert.equal(Math.abs(features.sensitivity(house,{same_office_incumbent_points:2})
 .raw_prior_margin_adjustment_points),1);
const model=require('./chamber_control_model.js');
const load=n=>JSON.parse(fs.readFileSync('data/'+n+'.json','utf8'));
const sources={seats:load('seat_universe'),history:load('house_history_2024_staging'),
 geography:load('house_geography_bridge'),
 senateHistory:load('senate_history_2020_2022_2024'),
 odds:load('race_probabilities'),polls:load('polling_estimates')};
const normal=model.prepare(sources);
const scenario=features.scenarioBasis(model,normal,stage,sources.polls,{
 administration_approval_transfer_per_net_point:.15
});
assert.equal(normal.status,'EXPERIMENTAL_UNCALIBRATED');
assert.equal(scenario.status,'EXPERIMENTAL_UNCALIBRATED_CANDIDATE_SCENARIO');
assert.deepEqual(scenario.house,normal.house,'Context must not move the House by party');
assert.deepEqual(scenario.governors,normal.governors,'Same party != outgoing governor liability');
const mnNormal=normal.senate.find(x=>x.code==='MN-SEN');
const mnSensitivity=scenario.senate.find(x=>x.code==='MN-SEN');
assert(mnNormal.polled&&mnNormal.poll_weight>=.78);
assert(Math.abs((mnSensitivity.mean-mnNormal.mean)-
 -2.1*(1-mnNormal.poll_weight))<1e-6,
 'Only the non-poll fundamentals weight may respond to Walz affiliation hypothesis');
assert.equal(scenario.candidate_scenario.changes.length,1,
 'Only the explicitly linked Minnesota Senate office should move');
assert.equal(scenario.candidate_scenario.changes[0].race_code,'MN-SEN');
assert.deepEqual(normal,model.prepare(sources),'Scenario cannot mutate production baseline');
const noScenario=features.scenarioBasis(model,normal,stage,sources.polls,{});
assert.deepEqual(noScenario.house,normal.house);
assert.deepEqual(noScenario.senate,normal.senate);
assert.deepEqual(noScenario.governors,normal.governors);
const alteredPolls=structuredClone(sources.polls);
alteredPolls.senate_all.find(x=>x.race_code==='MN-SEN').dem_candidate='Wrong Person';
const wrongName=features.scenarioBasis(model,normal,stage,alteredPolls,{
 administration_approval_transfer_per_net_point:.15
});
assert.equal(wrongName.candidate_scenario.changes.length,0);
assert(wrongName.candidate_scenario.skipped.some(x=>x.race_code==='MN-SEN'&&
 x.reason==='unverified_poll_matchup'));
assert.deepEqual(model.prepare({...sources,candidateContext:stage}),model.prepare(sources),
 'Staging candidate metadata must never silently alter headline odds');
console.log('Candidate fundamentals: 506 races; Minnesota office switch/administration guard, source integrity, explicit uncalibrated coefficients, historical overlap and appointment checks PASS');
