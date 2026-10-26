#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const persist=require('./incumbent_persistence_backtest.js');
const load=n=>JSON.parse(fs.readFileSync('data/'+n+'.json','utf8'));
const source={house22:load('house_history_2022_staging'),
 house24:load('house_history_2024_staging'),
 candidates22:load('house_2022_candidate_results_staging'),
 candidates24:load('house_2024_candidate_results_staging'),
 pres20:load('presidential_2020_by_2026_district_staging'),
 pres24:load('presidential_2024_by_2026_district_staging'),
 twoCycle:load('house_two_cycle_context')};
const result=persist.build(source);
assert.deepEqual(result,load('incumbent_persistence_2022_2024'),
 'Historical holdout artifact must be exactly reproducible from staged sources');
assert.equal(result.held_out_previous_winner_sample,149);
assert.equal(result.held_out_states,35);
assert.equal(result.eligibility.previous_winners_lost,4,
 'Do not remove re-running 2022 winners just because they lost in 2024');
assert.equal(result.eligibility.previous_winners_re_elected,145);
assert.equal(result.office_year_context.house2022_vs_presidential2020_gap,-3.217);
assert.equal(result.fitting.full_sample_coefficient,.344);
assert(result.scores_2024_evaluation.state_holdout_trained_candidate_carryover.rmse<
 result.scores_2024_evaluation.no_candidate_carryover.rmse,
 'Held-out candidate persistence should improve a zero-relative-strength benchmark');
assert(result.scores_2024_evaluation.state_holdout_trained_candidate_carryover.rmse<
 result.scores_2024_evaluation.full_one_to_one_carryover.rmse,
 'Carrying the full prior result over one-to-one should be penalized');
const az=result.records.find(x=>x.state==='AZ');
assert(az);
const changed2024=structuredClone(source);
const row=changed2024.house24.records.find(x=>x['2024_race_code']===az.race_code);
row.recorded_dem_votes+=10000;
row.recorded_two_party_vote_total+=10000;
changed2024.candidates24.records.find(x=>x.race_code===az.race_code).dem_votes+=10000;
// A held-out state's result cannot enter the TRAINING coefficient or
// national 2024 benchmark for that state. This mutation changes only its
// validation target, not the fitted model for that state.
const rerun=persist.build(changed2024);
const altered=rerun.records.find(x=>x.race_code===az.race_code);
assert.equal(altered.prior_2022,az.prior_2022);
assert.equal(altered.heldout_state_excluded_2024_climate,
 az.heldout_state_excluded_2024_climate);
assert.equal(altered.fitted_out_of_state_coefficient,
 az.fitted_out_of_state_coefficient);
assert.notEqual(altered.realized_2024,az.realized_2024);
const changed2022=structuredClone(source);
changed2022.pres20.records.find(x=>x.race_code===az.race_code).same_district_boundaries_2022_2024_2026=false;
assert.throws(()=>persist.build(changed2022),/Noncomparable/);
const duplicate=structuredClone(source);
duplicate.candidates22.records[0].race_code=duplicate.candidates22.records[1].race_code;
assert.throws(()=>persist.build(duplicate),/Duplicate historical reference/);
console.log('2022-to-2024 true out-of-state candidate-strength persistence study: 149 prior winners, 35 states, 4 subsequent losses retained. Train/benchmark state leakage check PASS.');
