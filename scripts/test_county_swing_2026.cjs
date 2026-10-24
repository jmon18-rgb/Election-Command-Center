const assert=require('node:assert/strict');
const {calculate}=require('./county_swing_2026');
const row={verified_source:true,is_test:false,election_date:'2026-11-03',
 county_id:'51107',race_key:'VA-SEN',updated_at:'2026-11-04T01:00:00Z',
 ballots_reported:100,
 candidates:[{name:'Candidate Democrat',party:'D',votes:60},
 {name:'Candidate Republican',party:'R',votes:40}]};
const base={verified_source:true,election_date:'2024-11-05',
 boundary_version:'2026',county_id:'51107',race_key:'VA-SEN',votes:{D:50,R:50}};
const result=calculate(row,base);
assert.equal(result.swing,0.2);
assert.equal(result.mode,'VERIFIED_COUNTY_SWING_ONLY');
assert.equal(calculate({...row,is_test:true},base),null);
assert.equal(calculate(row,{...base,boundary_version:'2024'}),null);
assert.equal(calculate(row,{...base,county_id:'51059'}),null);
assert.equal(calculate({...row,candidates:[
 {...row.candidates[0],votes:0},{...row.candidates[1],votes:0}]},base),null);
assert.equal(calculate(row,{...base,verified_source:false}),null);
const multiparty={...row,ballots_reported:150,candidates:[
 ...row.candidates,
 {name:'Green contender',party:'G',votes:20},
 {name:'Independent contender',party:'O',votes:15},
 {name:'Write-in contender',party:'O',votes:5}
]};
const compared=calculate(multiparty,base);
assert(compared,'Verified county returns with other candidates should retain two-party comparison');
assert.equal(compared.swing,0.2);
assert.equal(compared.two_party_votes,100);
assert.equal(compared.other_party_votes,40);
assert.equal(compared.reported_ballots,150);
for(const invalid of [
 {...multiparty,ballots_reported:139},
 {...multiparty,candidates:[...multiparty.candidates,
  {name:'Another D',party:'D',votes:0}]},
 {...multiparty,candidates:[...multiparty.candidates,
  {...multiparty.candidates[0],party:'O'}]},
 {...multiparty,candidates:[...multiparty.candidates,
  {name:'Unclassified',party:'',votes:0}]},
 {...multiparty,candidates:[...multiparty.candidates,
  {name:'Bad candidate',party:'G',votes:-1}]}
])assert.equal(calculate(invalid,base),null,
 'Malformed or duplicate county vote identities must remain rejected');
console.log('County geographic swing guard passed');
