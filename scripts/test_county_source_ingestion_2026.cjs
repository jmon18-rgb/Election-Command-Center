const assert=require('node:assert/strict');
const {ingest}=require('./county_source_ingestion_2026');
const expected={provider:'official',provider_race_id:'nc-sen-2026',race_key:'NC-SEN',
 state:'NC',state_fips:'37',office:'Senate',source_url:'https://example.gov/results/county'};
const county={fips:'37001',ballots_reported:100,reporting_status:'partial',
 updated_at:'2026-11-04T00:35:00Z',candidates:[{name:'A',party:'D',votes:60},
 {name:'B',party:'R',votes:40}]};
const envelope={schema:'county-results-v1',election_date:'2026-11-03',
 election_type:'General',production:true,is_test:false,provider:'official',
 provider_race_id:'nc-sen-2026',race_key:'NC-SEN',state:'NC',office:'Senate',
 source_verified:true,source_url:expected.source_url,counties:[county]};
const at=Date.parse('2026-11-04T01:00:00Z');
let first=ingest({},envelope,expected,{},at);
assert(first.accepted);assert.equal(first.updates.length,1);
assert.equal(first.rows['NC-SEN|37001'].ballots_reported,100);
assert.equal(first.may_move_national_needle,false);
assert(first.raceMatchedCountyPulse);
assert.equal(first.raceMatchedCountyPulse.status,'INSUFFICIENT_MATCHED_COUNTIES');
assert.equal(first.raceMatchedCountyPulse.may_move_national_needle,false);
assert.equal(first.raceMatchedCountyPulse.reporting_percent,null);
assert.equal(first.raceMatchedCountyPulse.matched_county_swing_points,null);
assert.equal(ingest(first.rows,envelope,expected,{},at).rejected[0].reason,'STALE_OR_DUPLICATE');
const bad=ingest(first.rows,{...envelope,production:false},expected,{},at);
assert(!bad.accepted);assert.equal(bad.rows,undefined);
const revised=ingest(first.rows,{...envelope,counties:[{...county,
 updated_at:'2026-11-04T00:36:00Z',ballots_reported:90,revision:true,
 candidates:[{name:'A',party:'D',votes:53},{name:'B',party:'R',votes:37}]}]},expected,{},at);
assert(revised.accepted);assert.equal(revised.updates.length,1);
assert.equal(revised.rows['NC-SEN|37001'].ballots_reported,90);
const premature=ingest({}, {...envelope,counties:[{...county,
 updated_at:'2026-11-04T00:25:00Z'}]},expected,{},at);
assert.equal(premature.accepted,false);
assert.equal(premature.reason,'SOURCE_TIME_BEFORE_LOCAL_CLOSE_OR_FUTURE');
const future=ingest({}, {...envelope,counties:[{...county,
 updated_at:'2026-11-04T01:16:00Z'}]},expected,{},at);
assert.equal(future.accepted,false);
assert.equal(future.reason,'SOURCE_TIME_BEFORE_LOCAL_CLOSE_OR_FUTURE');
const late=ingest({},envelope,expected,{},Date.parse('2026-11-04T03:35:01Z'));
assert.equal(late.accepted,false,
 'Stale source payload must never enter normalized county storage');
assert.equal(late.reason,'STALE_COUNTY_SOURCE_TIMESTAMP');
assert.equal(late.rows,undefined,'No stale county record should be published');

console.log('Source contract to county ingestion passed');
