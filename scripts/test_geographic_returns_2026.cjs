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
for(const changes of [{is_test:true},{verified_source:false},{election_date:'2024-11-05'},
 {county_id:'36107'},{race_key:'NC-SEN'},{ballots_reported:90},
 {state:'VA',state_fips:'37',county_id:'37183'},
 {state:'NC',state_fips:'51',county_id:'51107',race_key:'NC-SEN'},
 {county_id:'51000'},
 {updated_at:'2026-10-23T00:05:00Z'},
 {updated_at:'2026-11-03T23:59:59Z'},
 {candidates:[]}]){
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
console.log('Geographic source validation passed');
