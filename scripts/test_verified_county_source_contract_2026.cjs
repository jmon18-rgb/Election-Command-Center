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
assert.equal(out.rows[0].election_kind,'regular',
 'The official normalized 2026 NC Class II Senate contest is regular');
assert.equal(out.may_move_national_needle,false);
for(const altered of [
 {...feed,is_test:true},{...feed,source_verified:false},
 {...feed,source_url:'https://unknown.com/counties'},
 {...feed,counties:[county,county]},
 {...feed,counties:[{...county,fips:'36001'}]},
 {...feed,counties:[{...county,ballots_reported:20}]}
])assert.equal(normalize(altered,expected,at).ok,false);
assert.equal(normalize({...feed,counties:[]},expected,at).ok,false);
for(const [falsified,claimed] of [
 [{...feed,state:'VA',counties:[{...county,fips:'51107'}]},
  {...expected,state:'VA',race_key:'NC-SEN',state_fips:'37'}],
 [{...feed,state:'NC',counties:[{...county,fips:'51059'}]},
  {...expected,state_fips:'51'}]
])assert.equal(normalize(falsified,claimed,at).ok,false,
 'Agreement between caller and source cannot substitute for canonical state FIPS');
assert.equal(normalize({...feed,counties:[{...county,fips:'37000'}]},expected,at).ok,false,
 'Fake statewide 000 county must not be accepted');
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
const agedNow=Date.parse('2026-11-04T03:35:00Z');
assert.equal(normalize(feed,expected,agedNow).ok,true,
 'Exactly 180-minute-old county result remains eligible');
const oldCounty=normalize(feed,expected,agedNow+1000);
assert.equal(oldCounty.ok,false,
 'Old county result must not be accepted after 180 minutes');
assert.equal(oldCounty.reason,'STALE_COUNTY_SOURCE_TIMESTAMP');
const noFreshClock=normalize({...feed,counties:[{...county,ballots_reported:0,
 candidates:[{name:'A',party:'D',votes:0},{name:'B',party:'R',votes:0}]}]},
 expected,agedNow+1000);
assert.equal(noFreshClock.reason,'STALE_COUNTY_SOURCE_TIMESTAMP',
 'Old zero-vote placeholder must not make county data look current');
assert.equal(normalize({...feed,counties:[{...county,
 updated_at:'2026-11-04T03:35:01Z'}]},expected,agedNow+1000).ok,true,
 'Newly timestamped official county result restores eligibility');

// Source-contract must enforce its own race/office combination, even
// when a caller provides a mutually agreeing but nonsensical expectation.
for(const wrong of [
 [{...feed,office:'Governor'}, {...expected,office:'Governor'}],
 [{...feed,race_key:'NC-GOV'}, {...expected,race_key:'NC-GOV'}],
 [{...feed,race_key:'VA-SEN'}, {...expected,race_key:'VA-SEN'}]
])assert.equal(normalize(wrong[0],wrong[1],at).reason,
 'SOURCE_CONTRACT_UNVERIFIED');
const blankPositive={...feed,counties:[{...county,candidates:[
 {name:'A',party:'D',votes:0},{name:'B',party:'R',votes:0}]}]};
assert.equal(normalize(blankPositive,expected,at).reason,
 'NO_ATTRIBUTABLE_CANDIDATE_VOTES',
 'A positive aggregate with no candidate votes must fail at ingestion');
for(const names of [
 [{name:' Candidate A ',party:'D',votes:60},
  {name:'candidate a',party:'R',votes:40}],
 [{name:'Candidate A',party:'D',votes:60},
  {name:'CANDIDATE A ',party:'R',votes:40}]
]){
 assert.equal(normalize({...feed,counties:[{...county,candidates:names}]},
 expected,at).reason,'INVALID_CANDIDATE_TOTALS',
 'Candidate identities must be trimmed before duplicate comparison');
}
for(const updated_at of [
 '2026-11-04T00:35:00','2026-11-04 00:35:00Z',
 '2026-11-04T00:35:00Z-untrusted'
]){
 assert.equal(normalize({...feed,counties:[{...county,updated_at}]},
 expected,at).ok,false,'Reject ambiguous provider timestamp encoding');
}
// In the real index, this adapter is evaluated BEFORE poll-closing.js.
// First fail closed; then use the newly loaded contract without a reload.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const mockWindow={};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,
 'verified_county_source_contract_2026.js'),'utf8'),{window:mockWindow});
assert.equal(mockWindow.VerifiedCountySourceContract2026.normalize(
 feed,expected,at).ok,false,'Missing browser poll-close dependency must fail closed');
mockWindow.ElectionNightPollClosings2026=require('./election_night_poll_closings_2026.js');
assert.equal(mockWindow.VerifiedCountySourceContract2026.normalize(
 feed,expected,at).ok,false,
 'Missing canonical state-FIPS module must fail closed');
mockWindow.ElectionNightStateCountyFIPS2026=require('./election_night_state_county_fips_2026.js');
assert.equal(mockWindow.VerifiedCountySourceContract2026.normalize(
 feed,expected,at).ok,true,
 'County updates must recover once the poll-close and canonical FIPS modules load');
console.log('Verified county source envelope gate passed');
