const assert=require('node:assert/strict');
const {apply}=require('./geographic_swing_bridge_2026');
const row={election_date:'2026-11-03',election_type:'General',is_test:false,
 verified_source:true,provider:'civicAPI',provider_race_id:'verified-123',
 office:'Senate',election_kind:'regular',state:'VA',state_fips:'51',
 county_id:'51107',race_key:'VA-SEN',
 updated_at:'2026-11-04T00:05:00Z',reporting_status:'partial',ballots_reported:100,
 candidates:[{name:'Candidate D',party:'D',votes:60},{name:'Candidate R',party:'R',votes:40}]};
const base={verified_source:true,election_date:'2020-11-03',
 election_year:2020,office:'Senate',boundary_version:'2026',
 county_id:'51107',race_key:'VA-SEN',votes:{D:50,R:50}};
const NOW=Date.parse('2026-11-04T00:10:00Z');
const first=apply(null,row,base,NOW);
assert(first.accepted);assert.equal(first.mode,'VERIFIED_GEOGRAPHIC_COMPARISON');
assert.equal(first.swing.swing,0.2);
assert.equal(first.swing.previous_same_seat_election_year,2020);
const wrongPrior=apply(null,row,{...base,election_year:2024,
 election_date:'2024-11-05'},NOW);
assert.equal(wrongPrior.accepted,true);
assert.equal(wrongPrior.mode,'NO_COMPARABLE_BASELINE');
assert.equal(wrongPrior.swing,null);
assert.equal(apply(first.row,row,base,NOW).reason,'STALE_OR_DUPLICATE');
assert.equal(apply(null,{...row,is_test:true},base,NOW).reason,'INVALID_OR_UNVERIFIED');
const missing=apply(null,row,{...base,boundary_version:'2024'},NOW);
assert(missing.accepted);assert.equal(missing.mode,'NO_COMPARABLE_BASELINE');
assert.equal(missing.swing,null);
const fresh=apply(first.row,{...row,updated_at:'2026-11-04T00:06:00Z',
 ballots_reported:120,candidates:[{name:'Candidate D',party:'D',votes:65},
 {name:'Candidate R',party:'R',votes:50}]},base,NOW);
assert(fresh.accepted);assert(fresh.swing);
const multiparty={...row,ballots_reported:150,candidates:[
 ...row.candidates,{name:'Green candidate',party:'G',votes:20},
 {name:'Independent candidate',party:'O',votes:15},
 {name:'Write-in candidate',party:'O',votes:5}
]};
const multi=apply(null,multiparty,base,NOW);
assert(multi.accepted);
assert.equal(multi.mode,'VERIFIED_GEOGRAPHIC_COMPARISON');
assert.equal(multi.swing.swing,0.2);
assert.equal(multi.swing.other_party_votes,40);
assert.equal(multi.swing.two_party_votes,100);
assert.equal(apply(null,row,base,Date.parse('2026-11-03T23:59:59Z')).reason,
 'LOCAL_POLLS_OPEN_OR_SOURCE_PREMATURE',
 '2026 county votes cannot appear while VA polls still open on viewer clock');
assert.equal(apply(null,row,base,Date.parse('2026-11-04T00:05:01Z')).accepted,
 true,'Source-stamped county votes may be compared only after local close');
assert.equal(apply(null,row,base,Date.parse('2026-11-04T04:00:00Z')).reason,
 'PREMATURE_FUTURE_OR_STALE_VIEWER_CLOCK',
 'Research-only geographic bridge cannot reuse >3h old vote counts');
assert.equal(apply(null,{...row,updated_at:'2026-11-04T00:26:00Z'},
 base,NOW).reason,'PREMATURE_FUTURE_OR_STALE_VIEWER_CLOCK');
assert.equal(apply(null,row,base,Number.NaN).reason,'INVALID_VIEWER_CLOCK');
assert.equal(apply(null,row,base,Date.parse('2026-11-03T23:49:59Z')).reason,
 'PREMATURE_FUTURE_OR_STALE_VIEWER_CLOCK',
 'A future source stamp cannot qualify outside the timestamp tolerance');
const preclose={...row,updated_at:'2026-11-03T23:59:59Z'};
assert.equal(apply(null,preclose,base,NOW).reason,'INVALID_OR_UNVERIFIED',
 'Pre-close source publication remains blocked regardless of later viewer time');
console.log('Geographic bridge integration passed');
