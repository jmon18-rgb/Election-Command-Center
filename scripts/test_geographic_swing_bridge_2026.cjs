const assert=require('node:assert/strict');
const {apply}=require('./geographic_swing_bridge_2026');
const row={election_date:'2026-11-03',election_type:'General',is_test:false,
 verified_source:true,provider:'civicAPI',provider_race_id:'verified-123',
 office:'Senate',state:'VA',state_fips:'51',county_id:'51107',race_key:'VA-SEN',
 updated_at:'2026-11-04T00:05:00Z',reporting_status:'partial',ballots_reported:100,
 candidates:[{name:'Candidate D',party:'D',votes:60},{name:'Candidate R',party:'R',votes:40}]};
const base={verified_source:true,election_date:'2024-11-05',boundary_version:'2026',
 county_id:'51107',race_key:'VA-SEN',votes:{D:50,R:50}};
const first=apply(null,row,base);
assert(first.accepted);assert.equal(first.mode,'VERIFIED_GEOGRAPHIC_COMPARISON');
assert.equal(first.swing.swing,0.2);
assert.equal(apply(first.row,row,base).reason,'STALE_OR_DUPLICATE');
assert.equal(apply(null,{...row,is_test:true},base).reason,'INVALID_OR_UNVERIFIED');
const missing=apply(null,row,{...base,boundary_version:'2024'});
assert(missing.accepted);assert.equal(missing.mode,'NO_COMPARABLE_BASELINE');
assert.equal(missing.swing,null);
const fresh=apply(first.row,{...row,updated_at:'2026-11-04T00:06:00Z',
 ballots_reported:120,candidates:[{name:'Candidate D',party:'D',votes:65},
 {name:'Candidate R',party:'R',votes:50}]},base);
assert(fresh.accepted);assert(fresh.swing);
const multiparty={...row,ballots_reported:150,candidates:[
 ...row.candidates,{name:'Green candidate',party:'G',votes:20},
 {name:'Independent candidate',party:'O',votes:15},
 {name:'Write-in candidate',party:'O',votes:5}
]};
const multi=apply(null,multiparty,base);
assert(multi.accepted);
assert.equal(multi.mode,'VERIFIED_GEOGRAPHIC_COMPARISON');
assert.equal(multi.swing.swing,0.2);
assert.equal(multi.swing.other_party_votes,40);
assert.equal(multi.swing.two_party_votes,100);
console.log('Geographic bridge integration passed');
