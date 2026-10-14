#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const audit=require('./chamber_poll_error_audit.js');
const data=JSON.parse(fs.readFileSync('data/historical_senate_poll_backtest.json','utf8'));
const result=audit.summarize(data);
assert.equal(result.status,'RETROSPECTIVE_AUDIT_ONLY');
assert.equal(result.total_races,42);
assert.equal(result.can_calibrate_joint_chamber_odds,false);
assert.deepEqual(result.cycles.map(x=>x.cycle),[2020,2022,2024]);
assert.deepEqual(result.cycles.map(x=>x.races),[13,14,15]);
assert(result.overall_mae_points>3&&result.overall_mae_points<6);
assert(result.overall_rmse_points>5&&result.overall_rmse_points<7);
assert(result.cycle_bias_range_points[0]<.5);
assert(result.cycle_bias_range_points[1]>4);
assert(result.cycles.every(x=>x.heldout_shrunk_bias_mae_points>0));
assert(result.leave_one_cycle_out_shrunk_correction_mae_points>0);
assert(result.caveat.includes('No first-publication timestamps'));
const clone=structuredClone(data);
clone.records[0].methods.recency21.error+=10;
assert.throws(()=>audit.summarize(clone),/Invalid historical/);
assert.throws(()=>audit.summarize({...data,can_calibrate_2026_win_probabilities:true}),/source/);
assert.throws(()=>audit.summarize({...data,poll_source_first_publication_dates_available:true}),/source/);
assert.throws(()=>audit.summarize({...data,records:data.records.slice(0,41)}),/source/);
console.log('Retrospective poll-error audit passed:',JSON.stringify({
 cycles:result.cycles,
 overall_mae:result.overall_mae_points,overall_rmse:result.overall_rmse_points,
 leave_one_cycle_out_mae:result.leave_one_cycle_out_uncorrected_mae_points,
 leave_one_cycle_out_shrunk_mae:result.leave_one_cycle_out_shrunk_correction_mae_points,
 calibrated:false
}));
