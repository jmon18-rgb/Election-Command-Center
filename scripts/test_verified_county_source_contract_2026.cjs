const assert=require('node:assert/strict');
const {normalize}=require('./verified_county_source_contract_2026');
const expected={provider:'official',provider_race_id:'nc-sen-2026',race_key:'NC-SEN',
 state:'NC',state_fips:'37',office:'Senate',source_url:'https://example.gov/results/county'};
const county={fips:'37001',ballots_reported:100,reporting_status:'partial',
 updated_at:'2026-11-04T00:35:00Z',candidates:[{name:'A',party:'D',votes:60},
 {name:'B',party:'R',votes:40}]};
const feed={schema:'county-results-v1',election_date:'2026-11-03',
 election_type:'General',production:true,is_test:false,provider:'official',
 provider_race_id:'nc-sen-2026',race_key:'NC-SEN',state:'NC',office:'Senate',
 source_verified:true,source_url:expected.source_url,counties:[county]};
const at=Date.parse('2026-11-04T01:00:00Z');
let out=normalize(feed,expected,at);
assert(out.ok);assert.equal(out.rows[0].county_id,'37001');
assert.equal(out.may_move_national_needle,false);
for(const altered of [
 {...feed,is_test:true},{...feed,source_verified:false},
 {...feed,source_url:'https://unknown.com/counties'},
 {...feed,counties:[county,county]},
 {...feed,counties:[{...county,fips:'36001'}]},
 {...feed,counties:[{...county,ballots_reported:20}]}
])assert.equal(normalize(altered,expected,at).ok,false);
assert.equal(normalize({...feed,counties:[]},expected,at).ok,false);
for(const [why,stamp,seenAt] of [
 ['pre-close','2026-11-04T00:29:59Z',at],
 ['future','2026-11-04T01:16:00Z',at],
 ['polls still open','2026-11-04T00:31:00Z',Date.parse('2026-11-04T00:29:00Z')]
 ]){
 const incoming={...feed,counties:[{...county,updated_at:stamp}]};
 const result=normalize(incoming,expected,seenAt);
 assert.equal(result.ok,false,why);
 assert.equal(result.reason,'SOURCE_TIME_BEFORE_LOCAL_CLOSE_OR_FUTURE',why);
}
assert(normalize({...feed,counties:[{...county,
 updated_at:'2026-11-04T00:30:00Z'}]},expected,at).ok,
 'Exactly North Carolina close must be accepted');
console.log('Verified county source envelope gate passed');
