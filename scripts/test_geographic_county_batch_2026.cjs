const assert=require('node:assert/strict');
const {process}=require('./geographic_county_batch_2026');
const row={election_date:'2026-11-03',election_type:'General',is_test:false,
 verified_source:true,provider:'civicAPI',provider_race_id:'race-nc',
 office:'Senate',state:'NC',state_fips:'37',county_id:'37001',race_key:'NC-SEN',
 updated_at:'2026-11-04T00:05:00Z',reporting_status:'partial',ballots_reported:100,
 candidates:[{name:'D person',party:'D',votes:55},{name:'R person',party:'R',votes:45}]};
const id='NC-SEN|37001';
const initial=process({},[row]);
assert.equal(initial.updates.length,1);
assert.equal(initial.updates[0].mode,'NO_COMPARABLE_BASELINE');
assert.equal(initial.rows[id].ballots_reported,100);
assert.equal(initial.may_move_national_needle,false);
const update={...row,updated_at:'2026-11-04T00:10:00Z',ballots_reported:150,
 candidates:[{name:'D person',party:'D',votes:80},{name:'R person',party:'R',votes:70}]};
const second=process(initial.rows,[row,{...row,is_test:true},update]);
assert.equal(second.rejected.length,2);
assert.equal(second.updates.length,1);
assert.equal(second.rows[id].ballots_reported,150);
assert.equal(initial.rows[id].ballots_reported,100);
const other={...row,county_id:'37003',provider_race_id:'race-nc'};
const mixed=process(second.rows,[other,{...update,ballots_reported:90,
 candidates:[{name:'D person',party:'D',votes:45},{name:'R person',party:'R',votes:45}],
 updated_at:'2026-11-04T00:12:00Z'}]);
assert.equal(mixed.updates.length,1);
assert.equal(mixed.rejected[0].reason,'UNMARKED_DECREASE');
assert.equal(mixed.rows['NC-SEN|37003'].ballots_reported,100);
assert.equal(mixed.rows[id].ballots_reported,150);
assert.equal(process({},[]).accepted,false);
console.log('County batch snapshot integration passed');
