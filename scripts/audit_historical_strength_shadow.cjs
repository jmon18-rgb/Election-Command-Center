#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const model=require('./chamber_control_model.js');
const features=require('./incumbency_features.js');
const read=n=>JSON.parse(fs.readFileSync('data/'+n+'.json','utf8'));
const stage=read('candidate_fundamentals_staging'),study=read('incumbent_persistence_2022_2024');
if(study.status!=='HISTORICAL_PERSISTENCE_HOLDOUT_NOT_PROVEN_2026_FORECAST'||
 study.held_out_previous_winner_sample!==149)
 throw Error('Invalid historic coefficient study');
const sources={
 seats:read('seat_universe'),history:read('house_history_2024_staging'),
 geography:read('house_geography_bridge'),
 senateHistory:read('senate_history_2020_2022_2024'),
 odds:read('race_probabilities'),polls:read('polling_estimates'),
 presidential:read('presidential_2024_by_2026_district_staging')
};
const main=model.prepare(sources),shadow=model.prepare(sources,{
 fundamentalsMode:'presidential_2024_shadow'
});
const coeff=study.fitting.full_sample_coefficient;
const options={onlyOffices:['house']};
const config={prior_race_residual_weight:coeff};
const baselineScenario=features.scenarioBasis(model,main,stage,sources.polls,config,options);
const shadowScenario=features.scenarioBasis(model,shadow,stage,sources.polls,config,options);
if(baselineScenario.candidate_scenario.changes.length!==0)
 throw Error('2024 House baseline double-counted incumbent 2024 margin');
if(shadowScenario.candidate_scenario.changes.filter(x=>x.office==='house').length<55)
 throw Error('Expected sizeable matched incumbent strength sensitivity');
if(JSON.stringify(shadowScenario.senate)!==JSON.stringify(shadow.senate)||
 JSON.stringify(shadowScenario.governors)!==JSON.stringify(shadow.governors))
 throw Error('House backtest weight incorrectly applied outside House');
if(!shadowScenario.candidate_scenario.changes.every(x=>
 x.office==='house'&&x.historical_vote_embedded_fraction===.35))
 throw Error('House 2024 baseline overcounted in presidential shadow');
const changes=shadowScenario.candidate_scenario.changes;
const report={
 status:'OFFICE_SCOPED_HISTORICAL_CANDIDATE_STRENGTH_SHADOW_ONLY',
 coefficient_source:'2022_to_2024_state_heldout_House_candidate_residual_persistence',
 training_sample:study.held_out_previous_winner_sample,
 heldout_states:study.held_out_states,
 heldout_model_relative_rmse:study.scores_2024_evaluation.state_holdout_trained_candidate_carryover.rmse,
 heldout_no_carryover_rmse:study.scores_2024_evaluation.no_candidate_carryover.rmse,
 fit_ridge_coefficient:coeff,
 house2024_baseline_prior_changes:baselineScenario.candidate_scenario.changes.length,
 presidential_house_shadow_prior_changes:changes.length,
 senate_prior_changes:0,governor_prior_changes:0,
 max_applied_margin_abs_points:+Math.max(...changes.map(x=>Math.abs(x.applied_margin_delta_points))).toFixed(3),
 examples:changes.filter(x=>['AZ-06','ME-02','PA-10','NY-17'].includes(x.race_code)).slice(0,4)
  .map(x=>({race_code:x.race_code,
   historic_raw_effect:x.raw_prior_delta_points,
   applied_extra_after_existing_house_vote_and_polls:+x.applied_margin_delta_points.toFixed(3)})),
 interpretation:'Only a retrospective House-to-House historical candidate-strength transfer sensitivity. NOT validated 2026 election probabilities.',
 warnings:[
  'The House trained coefficient must not be used as a governor or Senate coefficient.',
  'The 2024 House result is fully embedded in the current original baseline, and therefore receives no additional carryover.',
  'The 2024 presidential district-lean alternate embeds 35 percent of the House result, leaving 65 percent potentially eligible.',
  'The previous winner persistence sample is conditional on running again and covers the midterm-to-presidential direction, not the 2024-to-2026 cycle.',
  'Actual election-outcome forecast validation is still required before changing headline odds.'
 ]
};
if(process.argv.includes('--json'))console.log(JSON.stringify(report,null,2));
else console.log(report);
