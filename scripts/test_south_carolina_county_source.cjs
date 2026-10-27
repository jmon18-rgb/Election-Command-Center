'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),zlib=require('node:zlib'),crypto=require('node:crypto');
const source=require('./south_carolina_civic_county_source.js'),{load,fixture}=require('./south_carolina_test_fixture.cjs');
const reference=load('south_carolina_county_fips_reference'),contract=load('south_carolina_senate_source_contract'),options={now:Date.parse('2026-11-04T03:06:00Z')};
const bytes=zlib.gunzipSync(fs.readFileSync('data/south_carolina_senate_sources/2026-civic-test-response.json.gz'));
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),contract.body_sha256);
const actual=JSON.parse(bytes);assert.equal(actual.test_data,true);assert(actual.candidates.some(c=>c.votes>0&&c.winner));
assert.equal(source.parse(actual,reference,options).status,'TEST_DATA_NOT_LIVE');
assert.deepEqual(source.parse(actual,reference,options).counties,[],'Saved positive demonstration values remain excluded, never actual votes');
const raw=fixture(),before=JSON.stringify(raw),parsed=source.parse(raw,reference,options);
assert.equal(parsed.live_votes_accepted,true);assert.equal(parsed.counties.length,46);
assert.equal(parsed.counties.find(c=>c.county_fips==='45065').county,'McCormick');
assert.equal(parsed.counties.reduce((s,c)=>s+c.other_votes,0),raw.candidates.filter(c=>!['Democratic','Republican'].includes(c.party)).reduce((s,c)=>s+c.votes,0));
assert(parsed.counties.every(c=>c.completion_verified===false));assert.equal(parsed.completion_verified,false);assert.equal(parsed.may_move_national_needle,false);
assert.equal(source.parse(fixture({zero:true}),reference,options).status,'NO_REPORTED_VOTES');
for(const mutate of [
 d=>d.country='CA',d=>d.province='NC',d=>d.district='01',d=>d.municipality='',d=>d.election_type='Governor',d=>d.election_scope='Primary',d=>d.election_name='SC US Senate',d=>d.election_date='2024-11-05T05:00:00.000Z',d=>d.round=2,
 d=>delete d.test_data,d=>d.mock=true,d=>d.mock='true',d=>d.is_test='false',d=>d.is_test=true,d=>d.test=true,d=>d.is_mock=true,d=>d.is_disputed=true,d=>d.is_disputed=null,d=>d.active=false,d=>d.active='true',d=>d.live=false,
 d=>d.last_updated=null,d=>d.last_updated='2026-11-04T03:05:00',d=>d.last_updated='2026-11-04T03:22:00Z',d=>d.last_updated='2026-11-03T23:59:00Z',d=>d.last_updated='2026-10-27T13:56:28.271Z',
 d=>d.candidates[0].candidate_id++,d=>d.candidates[0].party='Democratic',d=>d.candidates[0].name='Lindsey Graham',d=>d.candidates.pop(),d=>d.candidates.push({name:'Write In',votes:1}),d=>d.candidates[0].votes++,
 d=>delete d.region_results.abbeville,d=>d.region_results.extra=d.region_results.abbeville,d=>{d.region_results.wrong=d.region_results.abbeville;delete d.region_results.abbeville;},
 d=>d.region_results.abbeville.fips='45003',d=>delete d.region_results.abbeville.fips,d=>d.region_results.abbeville.name='McCormick',d=>d.region_results.abbeville.type='State',d=>d.region_results.mccormick.fips=null,d=>d.region_results.mccormick.fips='45001',
 d=>d.region_results.abbeville.candidates.pop(),d=>d.region_results.abbeville.candidates[0].votes++,d=>d.region_results.abbeville.candidates[0].votes=-1,d=>d.region_results.abbeville.candidates[0].votes=.5,d=>d.region_results.abbeville.candidates[0].votes=Number.MAX_SAFE_INTEGER+1,d=>d.region_results.abbeville.candidates[0].party='Democratic',d=>d.region_results.abbeville.candidates[0].candidate_id=9,
 d=>d.region_results.abbeville.candidates[1]=d.region_results.abbeville.candidates[0]
]){const changed=structuredClone(raw);mutate(changed);assert.throws(()=>source.parse(changed,reference,options));}
const honestFips=structuredClone(raw);honestFips.region_results.mccormick.fips='45065';assert.equal(source.parse(honestFips,reference,options).counties.length,46);
const flags=structuredClone(raw);flags.percent_reporting=100;flags.called_at=raw.last_updated;flags.candidates.forEach(c=>c.winner=true);assert.deepEqual(source.parse(flags,reference,options),parsed,'Winner and reporting percentages cannot change count admission or create a call');
assert.equal(JSON.stringify(raw),before);assert.throws(()=>source.parse(raw,reference,{...options,source_url:source.URL+'?light='}));
console.log('SC46 exact4candidate roster, observed McCormick bridge, all-other totals, clock/test/geography/identity rejection PASS; saved actual TESTDATA excluded, synthetic positives only');
