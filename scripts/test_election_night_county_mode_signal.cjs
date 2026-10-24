#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {evaluate}=require('./election_night_county_mode_signal.js');
const now=Date.parse('2026-11-04T03:00:00Z');
const counties=['Wake','Durham','Mecklenburg'];
const units=counties.map((name,i)=>({
 geography_id:'NC:'+name+'@2026',vote_mode:'early',
 baseline:{year:2024,geography_id:'NC:'+name+'@2026',vote_mode:'early',
  exact_geography_match:true,dem:400,rep:600},
 observed:{dem:12500,rep:12500},expected_final_two_party_ballots:28000,
 reporting_fraction:25000/28000
}));
const valid={election:'2026-11-03',race_code:'NC-SEN',office:'senate',
 is_test:false,as_of:'2026-11-04T02:45:00Z',
 source:{validated:true,is_test:false,
  url:'https://www.ncsbe.gov/results-data/election-results'},
 baseline_source:{validated:true,url:'https://www.ncsbe.gov/results-data/election-results/historical-election-results-data'},
 expected_statewide_two_party_ballots:100000,units};
const ok=evaluate(valid,now);
assert.equal(ok.eligible,true);
assert.equal(ok.observed_d_minus_r_residual_points,20);
assert.equal(ok.county_count,3);
assert.equal(ok.matched_geography_fraction,.84);
assert.equal(ok.state_ballot_fraction,.75);
assert.equal(ok.may_move_national_needle,false);
const bad=(modify,reason)=>{const clone=structuredClone(valid);modify(clone);
 const r=evaluate(clone,now);assert.equal(r.eligible,false);
 assert.equal(r.reason,reason);assert.equal(r.may_move_national_needle,false);};
bad(x=>{x.as_of='2024-11-05T20:00:00Z'},'source_timestamp_not_current');
bad(x=>{x.as_of='2026-11-04T00:29:59Z'},'state_poll_closure_not_satisfied');
bad(x=>{x.is_test=true},'live_source_not_confirmed_nonmock');
bad(x=>{delete x.source.is_test},'live_source_not_confirmed_nonmock');
bad(x=>{x.source.is_test=true},'live_source_not_confirmed_nonmock');
assert.equal(evaluate({...valid,as_of:'2026-11-04T00:30:00Z'},
 Date.parse('2026-11-04T00:29:59Z')).reason,
 'state_poll_closure_not_satisfied',
 'Future-stamped county returns must not pass before NC local closure');
assert.equal(evaluate({...valid,as_of:'2026-11-04T00:30:00Z'},
 Date.parse('2026-11-04T00:30:01Z')).eligible,true,
 'Exact post-close county research data may pass only after the local poll close');
bad(x=>{x.source.validated=false},'source_provenance_missing');
bad(x=>{x.units[1].vote_mode='mail'},'historical_geography_or_vote_mode_mismatch');
bad(x=>{x.units[1].baseline.geography_id='NC:OlderSeat@2024'},'historical_geography_or_vote_mode_mismatch');
bad(x=>{x.units[2]=structuredClone(x.units[0])},'duplicate_county_mode');
bad(x=>{x.units[0].reporting_fraction=.20},'precinct_count_confused_with_ballots');
bad(x=>{x.expected_statewide_two_party_ballots=250000},'reporting_geography_insufficient');
bad(x=>{x.units[0].observed.dem=50000},'inconsistent_reported_or_expected_votes');
bad(x=>{x.units[0].geography_id='VA:Wake@2026'},'invalid_unit_geometry_or_mode');
bad(x=>{x.source.url='http://insecure.example.org'},'source_provenance_missing');
bad(x=>{x.units[2].expected_final_two_party_ballots=35000},'precinct_count_confused_with_ballots');
assert.equal(evaluate({},now).eligible,false);
console.log('County + vote method source gate PASS: balanced D/R residual, unchanged geography, ballots not precincts, and national needle disabled');
