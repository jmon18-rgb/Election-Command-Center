#!/usr/bin/env node
'use strict';
// Regression contract for the actual NEW Senate model used by the web UI.
// No Silver subscription inputs, external forecast fitting, or prior candidate bonuses.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const engine=require('./chamber_control_model.js');
const read=n=>JSON.parse(fs.readFileSync(path.join(__dirname,'..','data',n+'.json'),'utf8'));
const source={seats:read('seat_universe'),history:read('house_history_2024_staging'),
 geography:read('house_geography_bridge'),senateHistory:read('senate_history_2020_2022_2024'),
 odds:read('race_probabilities'),polls:read('polling_estimates'),
 presidential:read('presidential_2024_by_2026_district_staging')};
const legacy=engine.prepare(source),current=engine.prepare(source,{senatePriorMode:'current_2026'});
assert.deepEqual(current.house,legacy.house,'Senate model MUST NOT touch House priors');
assert.deepEqual(current.governors,legacy.governors);
assert.equal(current.senate_prior_mode,'current_2026');
assert.equal(current.senate_current_context.historical_2020_senate_candidate_margin_used,false);
assert.equal(current.senate_current_context.statewide_2024_house_party_aggregate_used,false);
assert.equal(current.senate.length,35);
assert.equal(current.senate.filter(x=>x.polled).length,
 source.odds.records.filter(x=>x.office==='senate').length);
assert(current.senate.every(x=>x.senate_prior_mode==='current_2026'));
assert(current.senate.every(x=>x.method.includes('2026_presidential_partisan_environment_no_old_candidate')));
assert(current.senate.filter(x=>x.polled).every(x=>
 Number.isFinite(x.candidate_neutral_2026_environment_margin_points)&&
 Number.isFinite(x.candidate_specific_2026_poll_residual_points)));
assert(current.senate.filter(x=>!x.polled).every(x=>
 x.candidate_specific_2026_poll_residual_points===null));
assert.throws(()=>engine.prepare(source,{senatePriorMode:'invented'}),/Unsupported Senate/);
assert.throws(()=>engine.prepare({...source,presidential:null},{senatePriorMode:'current_2026'}),
 /Missing verified-source/);
const badGeo=JSON.parse(JSON.stringify(source.presidential));
badGeo.records[0].dem_pres_2024_votes=0;
assert.throws(()=>engine.prepare({...source,presidential:badGeo},{senatePriorMode:'current_2026'}),
 /Invalid or duplicate/);
// Changing any unrelated 2020 *candidate result* must NOT move any Senate
// margin under the current mode; the legacy mode should move and expose this.
const pastChanged=JSON.parse(JSON.stringify(source.senateHistory));
const oldMN=pastChanged.contest_records.find(r=>r.election_year===2020&&
 r.election_type==='regular'&&r.state==='MN');
assert(oldMN);
oldMN.dem_share_of_two_party=.2;
const changedSource={...source,senateHistory:pastChanged};
const currentWithDifferentOldCandidate=engine.prepare(changedSource,{senatePriorMode:'current_2026'});
assert.deepEqual(currentWithDifferentOldCandidate.senate,current.senate);
const legacyWithDifferentOldCandidate=engine.prepare(changedSource);
assert.notEqual(legacyWithDifferentOldCandidate.senate.find(x=>x.code==='MN-SEN').mean,
 legacy.senate.find(x=>x.code==='MN-SEN').mean);
const mn=current.senate.find(x=>x.code==='MN-SEN'),old=legacy.senate.find(x=>x.code==='MN-SEN');
const input=source.odds.records.find(x=>x.race_code==='MN-SEN'&&x.office==='senate');
assert(input);
assert.equal(mn.poll_weight,.90);
assert.equal(current.senate_current_context.model_revision,'late_2026_depth_aware_special_v5');
assert.equal(current.senate_current_context.poll_weight_firms_3_plus,.90);
assert.equal(current.senate_current_context.poll_weight_firms_5_plus,.94);
assert.equal(current.senate_current_context.poll_weight_firms_8_plus,.97);
assert.equal(current.senate_current_context.poll_weight_firms_2,.83);
assert.equal(current.senate_current_context.poll_weight_firms_1,.60);
const solidNoPoll=current.senate.filter(x=>x.public_solid_unpolled_party);
const ratedNoPoll=new Map(Object.entries({
 'CO-SEN':'D','DE-SEN':'D','NJ-SEN':'D','OR-SEN':'D','VA-SEN':'D',
 'KY-SEN':'R','MS-SEN':'R','OK-SEN':'R','TN-SEN':'R','WV-SEN':'R','WY-SEN':'R'
}));
const currentlyPolled=new Set(source.odds.records.filter(x=>x.office==='senate')
 .map(x=>x.race_code));
const expectedUnpolled=[...ratedNoPoll].filter(([code])=>!currentlyPolled.has(code));
assert.deepEqual(solidNoPoll.map(x=>x.code).sort(),
 expectedUnpolled.map(([code])=>code).sort());
assert(solidNoPoll.every(x=>x.public_solid_unpolled_party===ratedNoPoll.get(x.code)));
assert(solidNoPoll.every(x=>!x.polled&&x.method.includes('public_solid_no_poll_')));
assert(current.senate.filter(x=>x.polled).every(x=>x.public_solid_unpolled_party===null));
const a=current.assumptions,sigmaShared=Math.hypot(
 a.common_national_sigma,a.senate_chamber_sigma,a.state_senate_sigma);
assert(solidNoPoll.every(x=>Math.abs(Math.hypot(x.sigma,sigmaShared)-7)<1e-9));
assert(current.senate.filter(x=>x.polled&&
 source.odds.records.find(y=>y.race_code===x.code)?.independent_firms>=3)
 .every(x=>x.poll_weight===(source.odds.records.find(y=>y.office==='senate'&&y.race_code===x.code).independent_firms>=8?.97:
   source.odds.records.find(y=>y.office==='senate'&&y.race_code===x.code).independent_firms>=5?.94:.90)));
assert(mn.candidate_specific_2026_poll_residual_points<0,
 'Recent candidate matchup is LESS Democratic than geography+national mood');
assert(Math.abs(mn.candidate_specific_2026_poll_residual_points-
 (input.dem_minus_rep-mn.candidate_neutral_2026_environment_margin_points))<1e-9);
assert(mn.mean>input.dem_minus_rep&&mn.mean<mn.candidate_neutral_2026_environment_margin_points);
assert(old.mean<mn.mean);
const shared=current.assumptions,sharedSigma=Math.hypot(shared.common_national_sigma,
 shared.senate_chamber_sigma,shared.state_senate_sigma);
assert.equal(current.senate_current_context.polled_race_total_sigma_floor,6.5);
assert.equal(current.senate_current_context.thin_stale_or_special_poll_total_sigma_floor,8.5);
assert.equal(current.senate_current_context.deep_special_poll_total_sigma_floor,7.5);
for(const [code,weight] of [['TX-SEN',.97],['OH-SEN',.94]]){
 const r=current.senate.find(x=>x.code===code);
 assert.equal(r.poll_weight,weight,'Deep independent polls should supersede the generic geographic prior: '+code);
}
const ohio=current.senate.find(x=>x.code==='OH-SEN');
assert.equal(ohio.special,true);
assert.equal(ohio.polling_error_tier,'recent_deep_special');
assert.equal(ohio.polling_error_floor_points,7.5);
assert(current.senate.filter(x=>x.polled&&x.polling_error_tier==='recent_multi_firm').length>=5);
assert(current.senate.filter(x=>x.polled).every(x=>
 ['recent_multi_firm','recent_deep_special','thin_stale_or_special'].includes(x.polling_error_tier)));
for(const code of ['NC-SEN','GA-SEN','MN-SEN','ME-SEN']){
 assert.equal(current.senate.find(x=>x.code===code).polling_error_floor_points,6.5,
  'Representative well-polled races must follow shared depth/recency criterion: '+code);
}
for(const item of current.senate.filter(x=>x.polled)){
 const wholeSigma=Math.hypot(item.sigma,sharedSigma);
 const inputSigma=source.odds.records.find(x=>x.office==='senate'&&x.race_code===item.code).sigma_points;
 const expected=Math.hypot(Math.max(item.polling_error_floor_points,inputSigma),item.disagreement_extra_sigma_points);
 assert(Math.abs(wholeSigma-expected)<.001,
  'Senate shared+conditional variance must reconcile to full race error for '+item.code);
}
const options={samples:12000,seed:20261103,explainControl:true};
const baseline=engine.simulate(legacy,options),updated=engine.simulate(current,options);
assert.deepEqual(updated.race_probabilities.filter(x=>x.office==='house'),
 baseline.race_probabilities.filter(x=>x.office==='house'));
assert.deepEqual(updated.race_probabilities.filter(x=>x.office==='governor'),
 baseline.race_probabilities.filter(x=>x.office==='governor'));
assert.equal(updated.house_dem_control_pct,baseline.house_dem_control_pct);
const senRates=updated.race_probabilities.filter(x=>x.office==='senate');
assert.equal(senRates.length,35);
assert(senRates.every(x=>x.simulation_samples===12000&&
 Math.abs(x.dem_beats_rep_pct+x.rep_beats_dem_pct-100)<=.011));
const mnOld=baseline.race_probabilities.find(x=>x.race_code==='MN-SEN');
const mnNow=updated.race_probabilities.find(x=>x.race_code==='MN-SEN');
assert(mnNow.dem_beats_rep_pct>mnOld.dem_beats_rep_pct+5,
 'Model changes should be material and respond to the repaired current candidate prior');
assert(mnNow.dem_beats_rep_pct>60&&mnNow.dem_beats_rep_pct<85,
 'Avoid spurious near-certainty when candidate polling is only D+3');
const report={
 status:'CURRENT_SENATE_PROBABILITIES_PUBLISHED_MODEL_VALIDATION',
 polling_source_generated_at:source.polls.generated_at,
 source_presidential_reference_year:2024,
 candidate_signal_2026_polling:true,
 reused_historical_2020_candidate_effect:false,
 source_house_probs_unchanged:true,
 samples:updated.samples,seed:updated.seed,
 minnesota:{
  candidate_matchup:[source.polls.senate_all.find(x=>x.race_code==='MN-SEN').dem_candidate,
   source.polls.senate_all.find(x=>x.race_code==='MN-SEN').rep_candidate],
  polling_margin_D_points:input.dem_minus_rep,
  neutral_context_margin_D_points:mn.candidate_neutral_2026_environment_margin_points,
  contemporary_candidate_poll_residual_D_points:mn.candidate_specific_2026_poll_residual_points,
  model_margin_D_old:old.mean,model_margin_D_new:mn.mean,
  model_win_prob_D_old:mnOld.dem_beats_rep_pct,
  model_win_prob_D_new:mnNow.dem_beats_rep_pct,
  model_full_margin_sigma_old:mnOld.sigma_points,
  model_full_margin_sigma_new:mnNow.sigma_points
 },
 chamber:{
  old_house_dem_control_pct:baseline.house_dem_control_pct,
  updated_house_dem_control_pct:updated.house_dem_control_pct,
  old_senate_dem_control_pct:baseline.senate_dem_control_pct,
  updated_senate_dem_control_pct:updated.senate_dem_control_pct,
  old_both_dem_pct:baseline.actual_dem_both_control_pct,
  updated_both_dem_pct:updated.actual_dem_both_control_pct,
  old_expected_senate_dem_seats:baseline.means.senate_dem_seats,
  new_expected_senate_dem_seats:updated.means.senate_dem_seats
 },
 races:senRates.map(x=>({
  race_code:x.race_code,old_margin:legacy.senate.find(z=>z.code===x.race_code).mean,
  new_margin:current.senate.find(z=>z.code===x.race_code).mean,
  old_dem_win_pct:baseline.race_probabilities.find(z=>z.race_code===x.race_code).dem_beats_rep_pct,
  new_dem_win_pct:x.dem_beats_rep_pct
 }))
};
if(process.argv.includes('--json'))console.log(JSON.stringify(report,null,2));
else{
 console.log('CURRENT 2026 SENATE MATCHUP FORECAST — 2024 STATE GEOGRAPHY + LATEST POLLS');
 console.log('Minnesota',report.minnesota);
 console.log('Chamber impact',report.chamber);
 console.table(report.races.filter(x=>Math.abs(x.new_dem_win_pct-x.old_dem_win_pct)>=3)
  .map(x=>({race:x.race_code,old_margin:x.old_margin.toFixed(2),
  new_margin:x.new_margin.toFixed(2),old_pct:x.old_dem_win_pct,new_pct:x.new_dem_win_pct})));
}
