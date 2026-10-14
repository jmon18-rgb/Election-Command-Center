#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const x=require('./incumbency_features.js');
const data=JSON.parse(fs.readFileSync('data/candidate_fundamentals_staging.json','utf8'));
const {map,counts}=x.validate(data);
const conflicts=data.coverage.incumbent_identity_conflict_codes;
const mismatches=data.coverage.candidate_id_name_mismatch;
const candidates=data.records.flatMap(r=>[r.dem,r.rep]);
const status={
 schema_version:x.VERSION,
 status:'OBSERVED_CANDIDATE_FEATURES_NOT_A_FORECAST',
 coverage:{...counts,total_races:map.size},
 roster_source_sha:data.source_files['races.csv'].blob_sha,
 source_claims_with_conflicting_incumbency:conflicts,
 identity_mapping_conflicts:mismatches,
 supplier_same_office_incumbent_flags:candidates.filter(r=>r.incumbent_same_seat_candidate).length,
 verified_elected_same_office_with_required_geography:candidates.filter(r=>
  r.incumbent_same_seat_candidate&&r.elected_vs_appointed==='elected').length,
 candidate_first_term_indicators_verified:candidates.filter(r=>typeof r.first_term==='boolean').length,
 previous_competitive_margin_adjustments_available:candidates.filter(r=>
  typeof r.incumbent_last_race_overperformance_points==='number').length,
 individual_home_state_fundraising_available:candidates.filter(r=>
  typeof r.individual_home_state_receipts_usd==='number').length,
 minnesota:{
  senate:x.explain(map.get('MN-SEN')),
  governor:x.explain(map.get('MN-GOV')),
  approval_transfer_hypothesis:{
   coefficient_per_net_approval_point:0.15,
   senate_prior_margin_adjustment_only:x.sensitivity(map.get('MN-SEN'),{
    administration_approval_transfer_per_net_point:.15
   }).raw_prior_margin_adjustment_points,
   governor_prior_margin_adjustment_only:x.sensitivity(map.get('MN-GOV'),{
    administration_approval_transfer_per_net_point:.15
   }).raw_prior_margin_adjustment_points,
   status:'COUNTERFACTUAL_UNCALIBRATED_NOT_APPLIED_TO_POLLS_OR_ODDS'
  }
 },
 principles:[
  'Only same-office incumbents can receive an incumbency feature; a Senator running for Governor is not the incumbent Governor.',
  'A candidate serving in an outgoing administration is distinct from the retiring governor and from any other same-party candidate.',
  'June 2026 Minnesota likely-voter poll measured Tim Walz, NOT Flanagan or Klobuchar.',
  'Do not score elected incumbency until appointed/elected status and district-overlap requirements are independently verified.',
  'Model incumbency weights, prior-race residuals and approval transfer as separately backtestable components, not fixed automatic advantages.',
  'If an approval effect is ever used alongside polls, adjust fundamentals BEFORE the poll blend to avoid treating the poll and its context as independent.',
  'Fundraising figures here are overall receipts and small-dollar categories, not validated itemized in-state individual contributions.'
 ]
};
if(process.argv.includes('--json'))console.log(JSON.stringify(status,null,2));
else{
 console.log('2026 candidate fundamentals: 435 House + 35 Senate + 36 Governor races staged');
 console.log('Verified source offices / identity mismatches:',status.source_claims_with_conflicting_incumbency,status.identity_mapping_conflicts.length);
 console.log('Observed MN:',{senate:status.minnesota.senate.candidates.map(c=>c.name),
  governor:status.minnesota.governor.candidates.map(c=>c.name),
  outgoing_governor_approval:status.minnesota.senate.executive_approval});
 console.log('Counterfactual approval transfer ONLY:',status.minnesota.approval_transfer_hypothesis);
 console.log('NOT A FORECAST; no automatic change in published probabilities.');
}
