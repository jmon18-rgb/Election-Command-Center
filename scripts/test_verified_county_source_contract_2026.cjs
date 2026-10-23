const assert=require('node:assert/strict');
const {normalize}=require('./verified_county_source_contract_2026');
const expected={provider:'official',provider_race_id:'nc-sen-2026',race_key:'NC-SEN',
 state:'NC',state_fips:'37',office:'Senate',source_url:'https://example.gov/results/county'};
const county={fips:'37001',ballots_reported:100,reporting_status:'partial',
 updated_at:'2026-11-04T00:05:00Z',candidates:[{name:'A',party:'D',votes:60},
 {name:'B',party:'R',votes:40}]};
const feed={schema:'county-results-v1',election_date:'2026-11-03',
 election_type:'General',production:true,is_test:false,provider:'official',
 provider_race_id:'nc-sen-2026',race_key:'NC-SEN',state:'NC',office:'Senate',
 source_verified:true,source_url:expected.source_url,counties:[county]};
let out=normalize(feed,expected);
assert(out.ok);assert.equal(out.rows[0].county_id,'37001');
assert.equal(out.may_move_national_needle,false);
for(const altered of [
 {...feed,is_test:true},{...feed,source_verified:false},
 {...feed,source_url:'https://unknown.com/counties'},
 {...feed,counties:[county,county]},
 {...feed,counties:[{...county,fips:'36001'}]},
 {...feed,counties:[{...county,ballots_reported:20}]}
])assert.equal(normalize(altered,expected).ok,false);
assert.equal(normalize({...feed,counties:[]},expected).ok,false);
console.log('Verified county source envelope gate passed');
