const assert=require('node:assert/strict');
const {calculate,previousSeatYear}=require('./county_swing_2026');
const row={verified_source:true,is_test:false,election_date:'2026-11-03',
 county_id:'51107',office:'Senate',election_kind:'regular',
 race_key:'VA-SEN',updated_at:'2026-11-04T01:00:00Z',
 ballots_reported:100,
 candidates:[{name:'Candidate Democrat',party:'D',votes:60},
 {name:'Candidate Republican',party:'R',votes:40}]};
const base={verified_source:true,election_date:'2020-11-03',
 election_year:2020,office:'Senate',
 boundary_version:'2026',county_id:'51107',race_key:'VA-SEN',votes:{D:50,R:50}};
const result=calculate(row,base);
assert.equal(result.swing,0.2);
assert.equal(result.mode,'VERIFIED_COUNTY_SWING_ONLY');
assert.equal(result.previous_same_seat_election_year,2020);
assert.equal(previousSeatYear(row),2020);
assert.equal(calculate(row,{...base,election_date:'2024-11-05',election_year:2024}),null,
 '2024 VA Senate is a different Class I seat; wrong-cycle baseline rejected');
assert.equal(calculate(row,{...base,election_year:2022,election_date:'2022-11-08'}),null);
assert.equal(calculate(row,{...base,office:'President'}),null);
assert.equal(calculate({...row,election_kind:'special'},base),null);
assert.equal(calculate({...row,race_key:'AZ-SEN'},base),null);
const florida={...row,office:'Senate',race_key:'FL-SEN',election_kind:'special'};
const floridaBase={...base,race_key:'FL-SEN',election_year:2022,election_date:'2022-11-08'};
assert.equal(previousSeatYear(florida),2022);
assert.equal(calculate(florida,floridaBase)?.previous_same_seat_election_year,2022);
assert.equal(calculate(florida,{...floridaBase,election_year:2020,election_date:'2020-11-03'}),null);
const governor={...row,office:'Governor',race_key:'VA-GOV',election_kind:'regular'};
assert.equal(previousSeatYear(governor),null,
 'Virginia has no 2026 gubernatorial general election');
const nhGov={...governor,race_key:'NH-GOV'};
const nhGovBase={...base,office:'Governor',race_key:'NH-GOV',election_year:2024,
 election_date:'2024-11-05'};
assert.equal(calculate(nhGov,nhGovBase)?.previous_same_seat_election_year,2024);
const caGov={...governor,race_key:'CA-GOV'};
const caGovBase={...base,office:'Governor',race_key:'CA-GOV',election_year:2022,
 election_date:'2022-11-08'};
assert.equal(calculate(caGov,caGovBase)?.previous_same_seat_election_year,2022);
const house={...row,office:'House',race_key:'VA-01',election_kind:'regular'};
const houseBase={...base,office:'House',race_key:'VA-01',election_year:2024,
 election_date:'2024-11-05'};
assert.equal(calculate(house,houseBase)?.previous_same_seat_election_year,2024);
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
