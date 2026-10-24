#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const api=require('./historical_election_clock_replay.js');
const baseline={
 election_date:'2024-11-05',office:'governor',race_code:'NC-GOV',
 archive_source:{
  kind:'archived_contemporaneous_results',
  verified_capture_provenance:true,
  rights_cleared_for_internal_research:true,
  name:'synthetic-replay-fixture',
  url:'https://example.org/permitted-2024-clock',
  capture_method_url:'https://example.org/methodology'
 },
 certified_final:{year:2024,certified:true,
  official_source_url:'https://www.ncsbe.gov/results-data/election-results',
  dem_votes:6000,rep_votes:4000},
 snapshots:[
  {as_of:'2024-11-06T00:00:00Z',dem_votes:150,rep_votes:200},
  {as_of:'2024-11-06T00:30:00Z',dem_votes:600,rep_votes:500},
  {as_of:'2024-11-06T01:00:00Z',dem_votes:1000,rep_votes:900},
  {as_of:'2024-11-06T01:30:00Z',dem_votes:900,rep_votes:800},
  {as_of:'2024-11-06T02:00:00Z',dem_votes:4000,rep_votes:3500},
  {as_of:'2024-11-06T04:00:00Z',dem_votes:5900,rep_votes:3900}
 ].map((x,i)=>({...x,election_date:'2024-11-05',
               race_code:'NC-GOV',office:'governor',
               capture:{id:'nc-gov-clock-'+String(i).padStart(3,'0'),
                archived_url:'https://example.org/permitted-2024-clock/capture/'+i,
                captured_at:new Date(Date.parse(x.as_of)+60*1000).toISOString()}}))
};
const run=api.evaluate(baseline);
assert.equal(run.eligible,true);
assert.equal(run.snapshots,6);
assert.equal(run.distinct_count_snapshots_for_stage_error,6);
assert.equal(run.original_per_snapshot_capture_metadata_present,true);
assert.equal(run.independently_verified_capture_payloads,false);
assert.equal(run.downward_vote_corrections,1);
assert.equal(run.observed_leader_changes,1);
assert.equal(run.history_snapshot_errors.reduce((n,b)=>n+b.n,0),6);
assert(run.history_snapshot_errors.some(b=>b.stage==='under_10'&&b.n===1));
assert(run.history_snapshot_errors.some(b=>b.stage==='95_plus'&&b.n===1));
assert.equal(run.can_revise_2026_forecast,false);
assert.equal(run.geography_reporting_order_calibrated,false);
assert.equal(run.raw_replay_snapshots[0].observed_leader,'R');
assert.equal(run.raw_replay_snapshots[5].observed_leader,'D');
assert(run.raw_replay_snapshots.every(s=>s.ballot_progress_basis.includes('NOT_precincts')));
function denied(change,reason){
 const example=structuredClone(baseline);
 change(example);
 const answer=api.evaluate(example);
 assert.equal(answer.eligible,false,reason);
 assert.equal(answer.reason,reason);
 assert.equal(answer.can_revise_2026_forecast,false);
 assert.equal(answer.geography_reporting_order_calibrated,false);
}
denied(x=>{x.election_date='2026-11-03'},'2024_election_or_race_identity_invalid');
denied(x=>{x.archive_source.rights_cleared_for_internal_research=false},
 'original_capture_or_certification_not_verified');
denied(x=>{x.archive_source.verified_capture_provenance=false},
 'original_capture_or_certification_not_verified');
denied(x=>{x.archive_source.url='http://unsecure.invalid'},
 'original_capture_or_certification_not_verified');
denied(x=>{x.certified_final.certified=false},
 'original_capture_or_certification_not_verified');
denied(x=>{x.certified_final.dem_votes=-1},'certified_major_party_total_invalid');
denied(x=>{x.snapshots=x.snapshots.slice(0,3)},
 'insufficient_or_unbounded_true_clock_snapshots');
denied(x=>{x.snapshots[0].office='senate'},'archive_snapshot_race_or_vote_mismatch');
denied(x=>{x.snapshots[0].race_code='VA-GOV'},'archive_snapshot_race_or_vote_mismatch');
denied(x=>{x.snapshots[0].dem_votes=-5},'archive_snapshot_race_or_vote_mismatch');
denied(x=>{delete x.snapshots[0].capture},
 'missing_original_per_snapshot_capture_provenance');
denied(x=>{x.snapshots[1].capture.id=x.snapshots[0].capture.id},
 'missing_original_per_snapshot_capture_provenance');
denied(x=>{x.snapshots[0].capture.archived_url='http://archive.invalid'},
 'missing_original_per_snapshot_capture_provenance');
denied(x=>{x.snapshots[0].as_of='2024-11-06T00:00:00'},
 'missing_original_per_snapshot_capture_provenance');
denied(x=>{x.snapshots[0].capture.captured_at='2024-11-05T23:59:59'},
 'missing_original_per_snapshot_capture_provenance');
denied(x=>{x.snapshots[0].capture.captured_at='2024-11-06T05:00:00Z'},
 'capture_not_contemporaneous_with_source_timestamp');
denied(x=>{x.snapshots[0].capture.captured_at='2024-11-05T23:40:00Z'},
 'capture_not_contemporaneous_with_source_timestamp');
denied(x=>{x.snapshots[0].as_of='2024-11-05T22:59:59Z'},
 'nonchronological_or_wrong_cycle_snapshot');
denied(x=>{x.snapshots[3].as_of=x.snapshots[2].as_of},
 'nonchronological_or_wrong_cycle_snapshot');
denied(x=>{x.snapshots[4].as_of='2026-11-04T01:00:00Z'},
 'nonchronological_or_wrong_cycle_snapshot');
denied(x=>{x.snapshots[3].dem_votes=7000},
 'snapshot_exceeds_verified_final_major_party_counts');
denied(x=>{x.snapshots=x.snapshots.map((row,i)=>({
 ...row,dem_votes:5900,rep_votes:3900,
 as_of:new Date(Date.parse('2024-11-06T00:00:00Z')+i*60000).toISOString()
 }))},'not_a_useful_election_clock_reporting_sequence');
denied(x=>{x.snapshots=x.snapshots.map((row,i)=>({
 ...row,dem_votes:100+i*10,rep_votes:200+i*10
 }))},'not_a_useful_election_clock_reporting_sequence');
const unchanged=structuredClone(baseline);
const repeated=structuredClone(unchanged.snapshots[1]);
repeated.capture.id='nc-gov-clock-unique-repeat';
repeated.as_of='2024-11-06T00:31:00Z';
repeated.capture.captured_at='2024-11-06T00:32:00Z';
unchanged.snapshots.splice(2,0,repeated);
const repeatRun=api.evaluate(unchanged);
assert.equal(repeatRun.eligible,true);
assert.equal(repeatRun.snapshots,7);
assert.equal(repeatRun.unchanged_count_snapshots_excluded_from_stage_error,1);
assert.equal(repeatRun.distinct_count_snapshots_for_stage_error,6);
assert.equal(repeatRun.history_snapshot_errors.reduce((n,b)=>n+b.n,0),6,
 'Repeated unchanged response must not carry extra backtest weight');
assert.equal(repeatRun.raw_replay_snapshots.length,7,
 'Still preserve full actual clock observation history');
assert.equal(api.evaluate({}).eligible,false);
console.log('Historical 2024 clock replay only: true-vintage metadata, source rights, timestamp sequence, progress, corrections and no national 2026 forecast coupling PASS');
