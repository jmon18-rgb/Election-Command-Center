#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {evaluate,baselineYear}=require('./election_night_county_mode_signal.js');
const fs=require('node:fs'),path=require('node:path');
const now=Date.parse('2026-11-04T03:00:00Z');
const counties=['37183','37063','37119'];
const units=counties.map((name,i)=>({
 geography_id:'NC:'+name+'@2026',vote_mode:'early',
 baseline:{year:2020,office:'senate',race_code:'NC-SEN',
  geography_id:'NC:'+name+'@2026',vote_mode:'early',
  exact_geography_match:true,dem:400,rep:600},
 observed:{dem:12500,rep:12500},expected_final_two_party_ballots:28000,
 reporting_fraction:25000/28000
}));
const valid={election:'2026-11-03',race_code:'NC-SEN',office:'senate',
 election_kind:'regular',
 is_test:false,as_of:'2026-11-04T02:45:00Z',
 source:{validated:true,is_test:false,
  url:'https://www.ncsbe.gov/results-data/election-results'},
 baseline_source:{validated:true,office:'senate',election_year:2020,
  url:'https://www.ncsbe.gov/results-data/election-results/historical-election-results-data'},
 expected_statewide_two_party_ballots:100000,units};
// Validate every 2026 contested House/Senate/governor race against the
// independent 506-contest ledger: never use 2024 for a Class II Senate seat
// just because it is the newest general-election data set.
const ledger=JSON.parse(fs.readFileSync(path.join(__dirname,
 '../data/election_night_source_coverage.json'),'utf8'));
assert.equal(ledger.races.length,506);
for(const race of ledger.races){
 const office=race.office.toLowerCase();
 const special=race.key.endsWith('-special');
 const kind=special?'special':'regular';
 const code=office==='senate'?race.state+'-SEN':
  office==='governor'?race.state+'-GOV':race.key;
 const year=baselineYear({office,race_code:code,election_kind:kind});
 const expected=office==='house'?2024:office==='governor'?
  ['NH','VT'].includes(race.state)?2024:2022:
  special?2022:2020;
 assert.equal(year,expected,'Wrong previous same-seat election: '+race.id);
}
for(const [office,code,kind] of [
 ['senate','NC-SEN','special'],['senate','FL-SEN','regular'],
 ['senate','AZ-SEN','regular'],['governor','NC-GOV','regular'],
 ['governor','NH-GOV','special'],['house','NH-99','regular'],
 ['house','AK-01','regular'],['house','TX-00','regular']
]){
 assert.equal(baselineYear({office,race_code:code,election_kind:kind}),null,
  'Noncontested or invalid election cannot obtain baseline: '+code);
}
assert.equal(baselineYear({office:'senate',race_code:'NC-SEN',
 election_kind:'regular'}),2020);
assert.equal(baselineYear({office:'governor',race_code:'NH-GOV',
 election_kind:'regular'}),2024);
assert.equal(baselineYear({office:'senate',race_code:'OH-SEN',
 election_kind:'special'}),2022);
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
bad(x=>{x.baseline_source.election_year=2024},
 'historical_election_or_office_mismatch');
bad(x=>{x.baseline_source.office='president'},
 'historical_election_or_office_mismatch');
bad(x=>{x.units[0].baseline.year=2024},
 'historical_geography_or_vote_mode_mismatch');
bad(x=>{x.units[0].baseline.office='president'},
 'historical_geography_or_vote_mode_mismatch');
bad(x=>{x.units[0].baseline.race_code='NC-PRES'},
 'historical_geography_or_vote_mode_mismatch');
bad(x=>{x.election_kind='special'},'race_identity_unverified');
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
bad(x=>{x.units[0].geography_id='VA:51107@2026'},'invalid_unit_geometry_or_mode');
bad(x=>{x.units[0].geography_id='NC:51107@2026'},'invalid_unit_geometry_or_mode');
bad(x=>{x.units[0].geography_id='NC:37000@2026'},'invalid_unit_geometry_or_mode');
bad(x=>{x.units[0].geography_id='NC:Wake@2026'},'invalid_unit_geometry_or_mode');
bad(x=>{x.office='house'},'race_identity_unverified');
bad(x=>{x.office='governor'},'race_identity_unverified');
bad(x=>{x.units=Array.from({length:5001},()=>structuredClone(x.units[0]))},
 'unverified_total_ballot_denominator');
bad(x=>{x.source.url='http://insecure.example.org'},'source_provenance_missing');
bad(x=>{x.units[2].expected_final_two_party_ballots=35000},'precinct_count_confused_with_ballots');
assert.equal(evaluate({},now).eligible,false);
console.log('County + vote method source gate PASS: balanced D/R residual, unchanged geography, ballots not precincts, and national needle disabled');
