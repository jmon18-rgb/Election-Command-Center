#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const audit=require('./senate_calibration_audit.js');
const source=JSON.parse(fs.readFileSync('data/historical_senate_poll_backtest.json','utf8'));
const report=audit.evaluate(source);
assert.equal(report.schema,'senate_poll_audit_v1');
assert.equal(report.status,'RETROSPECTIVE_VALIDATION_ONLY');
assert.equal(report.overall.n,42);
const bins=report.confidence_reliability_bins;
assert.equal(bins.length,5);
assert.deepEqual(bins.map(x=>x.lower_pct),[50,60,70,80,90]);
assert.equal(bins.reduce((n,x)=>n+x.n,0),42,
 'Every historical race must be scored in exactly one non-overlapping bin');
assert.equal(bins.reduce((n,x)=>n+x.observed_favorite_wins,0),
 bins.filter(x=>x.n>0).reduce((n,x)=>n+x.observed_favorite_wins,0));
assert(bins.every(x=>x.statistically_validated===false),
 'Three retrospective cycles cannot certify calibrated 2026 race odds');
assert(bins.every(x=>x.n===0||x.wilson_95_pct.lower_pct<=x.observed_favorite_win_pct&&
 x.wilson_95_pct.upper_pct>=x.observed_favorite_win_pct));
assert(bins.every(x=>x.n===0||x.average_assigned_confidence_pct>=x.lower_pct&&
 x.average_assigned_confidence_pct<=x.upper_pct));
assert.equal(report.reliability_scope.includes('fieldwork'),true);
const synthetic=[
 {cycle:2020,methods:{recency21:{predicted_two_party_margin:0}},
  actual_two_party_margin:2},
 {cycle:2022,methods:{recency21:{predicted_two_party_margin:40}},
  actual_two_party_margin:-2}
];
const syntheticBins=audit.reliabilityBins(synthetic,6);
assert.equal(syntheticBins.reduce((n,x)=>n+x.n,0),2);
assert.equal(syntheticBins[0].observed_favorite_wins,1);
assert.equal(syntheticBins[4].observed_favorite_wins,0);
assert.equal(syntheticBins[1].n,0);
assert.equal(syntheticBins[1].wilson_95_pct,null);
assert.throws(()=>audit.reliabilityBins([]),/Invalid retrospective/);
assert.deepEqual(report.by_year.map(x=>x.year),[2020,2022,2024]);
assert.deepEqual(report.by_year.map(x=>x.n),[13,14,15]);
assert.deepEqual(report.cross_year_heldout.map(x=>x.training_races),[29,28,27]);
assert(report.by_year[0].signed_bias>5&&report.by_year[1].signed_bias<.5);
assert(report.by_year[2].signed_bias>4);
assert(report.overall.rmse>5&&report.overall.rmse<7);
assert(report.overall.brier>0&&report.overall.brier<.3);
assert(report.overall.log_loss>0);
assert(report.pooled_heldout.brier>=0&&report.pooled_heldout.brier<=1);
assert(report.pooled_heldout.log_loss>0);
assert(report.cross_year_heldout.every(x=>x.held_out_races===x.n));
assert(report.automatic_democratic_bias_correction===false);
assert(report.may_calibrate_2026_joint_probabilities===false);
assert(report.warnings.some(x=>x.includes('cycle-correlated')));
const sums=report.by_year.reduce((o,r)=>(o.n+=r.n,o.w+=r.n*r.brier,o),{n:0,w:0});
assert.equal(sums.n,42);
assert(Math.abs(sums.w/42-report.overall.brier)<.0002);
assert.deepEqual(audit.evaluate(source),audit.evaluate(source));
const clone=structuredClone(source);
clone.records[0].cycle=2026;
assert.throws(()=>audit.evaluate(clone),/Malformed/);
clone.records[0].cycle=2020;
clone.records[0].methods.recency21.predicted_two_party_margin='0';
assert.throws(()=>audit.evaluate(clone),/Malformed/);
const duplicate=structuredClone(source);
duplicate.records[1].historical_race_id=duplicate.records[0].historical_race_id;
assert.throws(()=>audit.evaluate(duplicate),/Duplicate/);
assert.throws(()=>audit.evaluate({...source,records:source.records.slice(1)}),/leaky/);
assert.throws(()=>audit.evaluate({...source,poll_source_first_publication_dates_available:true}),/leaky/);
assert.throws(()=>audit.evaluate({...source,can_calibrate_2026_win_probabilities:true}),/leaky/);
console.log('Historical Senate probability scoring audit:',JSON.stringify({
 sample:report.overall.n,by_year:report.by_year.map(y=>({
  year:y.year,bias:y.signed_bias,rmse:y.rmse,coverage90:y.interval_90_pct
 })),overall_brier:report.overall.brier,
 heldout_brier:report.pooled_heldout.brier,calibrated:false
}));
