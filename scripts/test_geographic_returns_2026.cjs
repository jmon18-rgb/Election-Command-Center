const assert=require('node:assert/strict');
const {validate,reconcile}=require('./geographic_returns_2026');
const base={election_date:'2026-11-03',election_type:'General',is_test:false,
 verified_source:true,provider:'civicAPI',provider_race_id:'valid-123',
 office:'Senate',state:'VA',state_fips:'51',county_id:'51107',
 race_key:'VA-SEN',updated_at:'2026-11-04T00:05:00Z',reporting_status:'partial',
 ballots_reported:100,candidates:[{name:'Candidate D',party:'D',votes:55},
 {name:'Candidate R',party:'R',votes:40}]};
const row=overrides=>({...base,...overrides});
assert(validate(base));
for(const invalid of [
 {office:'Governor',race_key:'VA-GOV'},
 {office:'House',race_key:'VA-99'},
 {office:'House',race_key:'VA-00'},
 {office:'Senate',race_key:'VA-SEN',election_kind:'special'},
]){
 assert.equal(validate(row(invalid)),null,
  'Real FIPS and source identity do not create an unballoted 2026 contest');
}
assert(validate(row({office:'House',race_key:'VA-01',
 election_kind:'regular'})),
 'A real 2026 House seat remains eligible for exact county returns');
assert.equal(validate(row({office:'House',race_key:'VA-01',
 election_kind:'special'})),null,
 'Fictional special House race cannot enter county observation storage');

for(const changes of [{is_test:true},{verified_source:false},{election_date:'2024-11-05'},
 {county_id:'36107'},{race_key:'NC-SEN'},{ballots_reported:90},
 {state:'VA',state_fips:'37',county_id:'37183'},
 {state:'NC',state_fips:'51',county_id:'51107',race_key:'NC-SEN'},
 {county_id:'51000'},
 {updated_at:'2026-10-23T00:05:00Z'},
 {updated_at:'2026-11-03T23:59:59Z'},
 {candidates:[]},
 {updated_at:'2026-11-04T00:05:00'},
 {updated_at:'2026-11-04T00:05:00+25:00'},
 {candidates:[{name:'Candidate D',party:'D',votes:0},{name:'Candidate R',party:'R',votes:0}]},
 {candidates:[{name:'Candidate D',party:'D',votes:55},{name:' Candidate D ',party:'R',votes:40}]}]){
 assert.equal(validate(row(changes)),null,JSON.stringify(changes));
}
// VA's local polls close at 2026-11-04T00:00Z; valid source
// provenance alone cannot promote an older positive-vote timestamp.
assert.equal(validate(row({updated_at:'2026-11-03T23:59:59Z'})),null);
assert(validate(row({updated_at:'2026-11-04T00:00:00Z'})));
assert.equal(reconcile(base,base).reason,'STALE_OR_DUPLICATE');
assert.equal(reconcile(base,row({updated_at:'2026-11-04T00:06:00Z',ballots_reported:90,candidates:[{name:'Candidate D',party:'D',votes:45},{name:'Candidate R',party:'R',votes:40}]})).reason,
 'UNMARKED_DECREASE');
assert(reconcile(base,row({updated_at:'2026-11-04T00:06:00Z',ballots_reported:90,revision:true,candidates:[{name:'Candidate D',party:'D',votes:45},{name:'Candidate R',party:'R',votes:40}]})).accepted);
assert.equal(reconcile(base,row({updated_at:'2026-11-04T00:06:00Z',county_id:'51059'})).reason,
 'IDENTITY_MISMATCH');

const next=(candidates,extra={})=>row({updated_at:'2026-11-04T00:06:00Z',
 ballots_reported:120,candidates,...extra});
assert.equal(reconcile(base,next([
 {name:'Candidate D',party:'D',votes:54},
 {name:'Candidate R',party:'R',votes:61}
])).reason,'UNMARKED_CANDIDATE_DECREASE',
 'Increasing county totals cannot hide a reduced individual candidate count');
assert(reconcile(base,next([
 {name:'Candidate D',party:'D',votes:54},
 {name:'Candidate R',party:'R',votes:61}
],{revision:true})).accepted);
assert.equal(reconcile(base,next([
 {name:'Candidate D',party:'D',votes:100},
 {name:'New candidate',party:'O',votes:15}
])).reason,'UNMARKED_CANDIDATE_REMOVAL');
assert.equal(reconcile(base,next([
 {name:'Candidate D',party:'R',votes:60},
 {name:'Candidate R',party:'R',votes:55}
])).reason,'UNMARKED_CANDIDATE_PARTY_CHANGE');
assert(reconcile(base,next([
 {name:'Candidate D',party:'D',votes:60},
 {name:'Candidate R',party:'R',votes:55}
])).accepted);
console.log('Geographic source validation passed');
