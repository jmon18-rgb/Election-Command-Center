const assert=require('node:assert/strict');
const {ingest}=require('./county_source_ingestion_2026');
const expected={provider:'official',provider_race_id:'nc-sen-2026',race_key:'NC-SEN',
 state:'NC',state_fips:'37',office:'Senate',source_url:'https://example.gov/results/county'};
const county={fips:'37001',ballots_reported:100,reporting_status:'partial',
 updated_at:'2026-11-04T00:05:00Z',candidates:[{name:'A',party:'D',votes:60},
 {name:'B',party:'R',votes:40}]};
const envelope={schema:'county-results-v1',election_date:'2026-11-03',
 election_type:'General',production:true,is_test:false,provider:'official',
 provider_race_id:'nc-sen-2026',race_key:'NC-SEN',state:'NC',office:'Senate',
 source_verified:true,source_url:expected.source_url,counties:[county]};
let first=ingest({},envelope,expected);
assert(first.accepted);assert.equal(first.updates.length,1);
assert.equal(first.rows['NC-SEN|37001'].ballots_reported,100);
assert.equal(first.may_move_national_needle,false);
assert.equal(ingest(first.rows,envelope,expected).rejected[0].reason,'STALE_OR_DUPLICATE');
const bad=ingest(first.rows,{...envelope,production:false},expected);
assert(!bad.accepted);assert.equal(bad.rows,undefined);
const revised=ingest(first.rows,{...envelope,counties:[{...county,
 updated_at:'2026-11-04T00:06:00Z',ballots_reported:90,revision:true,
 candidates:[{name:'A',party:'D',votes:53},{name:'B',party:'R',votes:37}]}]},expected);
assert(revised.accepted);assert.equal(revised.updates.length,1);
assert.equal(revised.rows['NC-SEN|37001'].ballots_reported,90);
console.log('Source contract to county ingestion passed');
