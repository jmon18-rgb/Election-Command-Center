#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const fs=require('node:fs'),path=require('node:path');
const script=path.join(__dirname,'audit_modern_incumbency_robustness.cjs');
const data=JSON.parse(cp.execFileSync(process.execPath,[script,'--check','--json'],{
 encoding:'utf8',maxBuffer:2*1024*1024
}));
assert.equal(data.status,'MODERN_ERA_DIAGNOSTIC_NO_HEADLINE_FORECAST_PROMOTION');
assert.deepEqual(data.allowed_model_fit_election_years,[2022,2024]);
assert.equal(data.prior_presidential_geography_context_year,2020);
assert.match(data.excluded_older_house_elections,/before 2022 are deliberately excluded/);
assert.equal(data.cohort_scores.all_modern_2022_2024.sample,148);
assert.equal(data.cohort_scores.elected_first_time_in_2022.sample,33);
assert.equal(data.cohort_scores.already_incumbent_on_2022_ballot.sample,115);
assert.equal(data.cohort_scores.democratic_2022_winners.sample,83);
assert.equal(data.cohort_scores.republican_2022_winners.sample,65);
assert.equal(data.cohort_scores.presidential_lean_within_10_points.sample,32);
assert.equal(data.cohort_scores.presidential_lean_within_20_points.sample,63);
assert.equal(data.cohort_scores.presidential_lean_over_20_points.sample,85);
assert.equal(data.cohort_scores.previous_house_margin_within_10_points.sample,31);
for(const group of Object.values(data.cohort_scores)){
 assert(group.sample>0&&group.n_states>=4);
 for(const model of ['zero','modern_heldout_cv','full_carryover']){
  assert(group[model].rmse>0&&group[model].mae>0);
 }
 assert(Math.abs(group.cv_rmse_gain_over_zero-
  (group.zero.rmse-group.modern_heldout_cv.rmse))<.002);
}
const b=data.state_cluster_bootstrap;
assert.equal(b.unit,'state_cluster');
assert.equal(b.resamples,1200);
assert.equal(b.seed,20261103);
assert(b.shrink_coefficient_p05<=b.shrink_coefficient_median);
assert(b.shrink_coefficient_median<=b.shrink_coefficient_p95);
assert(b.shrink_coefficient_p05>=0);
assert(b.shrink_coefficient_p95<=.8);
assert(b.heldout_rmse_gain_p05<=b.heldout_rmse_gain_median);
assert(b.heldout_rmse_gain_median<=b.heldout_rmse_gain_p95);
assert(b.state_cluster_fraction_with_positive_gain>=0&&
 b.state_cluster_fraction_with_positive_gain<=1);
assert.equal(data.baseline_loso_coefficient,.345);
assert(data.cohort_scores.presidential_lean_within_10_points
 .cv_rmse_gain_over_zero>0);
assert(data.cohort_scores.elected_first_time_in_2022
 .cv_rmse_gain_over_zero>=0);
// Explicit historical data policy: do not load or stage 2012-2018
// congressional elections for 2026 model fitting.
assert(!fs.existsSync(path.join(__dirname,'..','data',
 'historical_house_multicycle_sources.json')),
 'Removed old 2012/2014/2016/2018 inputs must not be merged');
const files=['incumbent_persistence_2022_2024.json',
 'house_2022_candidate_results_staging.json',
 'house_history_2022_staging.json',
 'presidential_2020_by_2026_district_staging.json'];
for(const name of files)assert(fs.existsSync(path.join(__dirname,'..','data',name)));
console.log('2022-2024-only incumbent validation: modern cohort, close-seat, incumbent tenure and state-cluster checks PASS.');
