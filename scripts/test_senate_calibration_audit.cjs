#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const audit=require('./senate_calibration_audit.js');
const source=JSON.parse(fs.readFileSync('data/historical_senate_poll_backtest.json','utf8'));
const report=audit.evaluate(source);
assert.equal(report.schema,'senate_poll_audit_v1');
assert.equal(report.status,'RETROSPECTIVE_VALIDATION_ONLY');
assert.equal(report.overall.n,42);
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
