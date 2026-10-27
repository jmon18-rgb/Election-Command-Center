const assert=require('node:assert/strict'),source=require('./virginia_official_house_source.js'),{original,fixture}=require('./virginia_house_02_test_fixture.cjs');
const ref=require('../data/virginia_house_02_county_fips_reference.json'),now=Date.parse('2026-11-04T03:06:00Z');
const fs=require('node:fs'),zlib=require('node:zlib'),crypto=require('node:crypto');
assert.equal(crypto.createHash('sha256').update(zlib.gunzipSync(fs.readFileSync(require.resolve('../data/virginia_house_02_sources/2026-official-zero-response.json.gz')))).digest('hex'),require('../data/virginia_house_02_source_contract.json').original_response_sha256);
assert.equal(source.parse(original(),ref,{now:Date.parse('2026-10-26T23:00:00Z')}).status,'NO_REPORTED_VOTES');
assert.throws(()=>source.parse(original(),ref,{now}),/stale/,'Real stale-zero template is not live delivery');
const raw=fixture(),valid=source.parse(raw,ref,{now});
assert.equal(valid.counties.length,8);assert.equal(valid.live_votes_accepted,true);assert.equal(valid.method_split_reported,true);
assert.equal(valid.authoritative_race_call,false);assert.equal(valid.completion_verified,false);
assert(valid.counties.every(c=>Object.keys(c.methods).length===5&&c.vote_method==='combined_from_reported_methods'));
const independent=structuredClone(raw),part=independent.ballotItemWithBreakdown.breakdownResults[0];
const person=part.ballotOptions.find(x=>x.nativeId==='cs270');person.voteCount=17;person.groupResults[0].voteCount=17;part.voteTotal+=17;
const summary=independent.ballotItemWithBreakdown.summaryResults.ballotOptions.find(x=>x.nativeId==='cs270');summary.voteCount=17;summary.groupResults.find(x=>x.groupId===person.groupResults[0].groupId).voteCount=17;
independent.ballotItemWithBreakdown.voteTotal+=17;
const ov=independent.ballotItems.find(x=>x.id===independent.ballotItemWithBreakdown.id);ov.voteTotal+=17;ov.summaryResults=structuredClone(independent.ballotItemWithBreakdown.summaryResults);
const withOther=source.parse(independent,ref,{now});assert.equal(withOther.counties.reduce((n,c)=>n+c.other_votes,0),17);assert.deepEqual(withOther.counties.map(c=>c.dem_votes),valid.counties.map(c=>c.dem_votes),'Independent candidate votes never become Democratic evidence');
const called=structuredClone(raw);called.ballotItemWithBreakdown.summaryResults.ballotOptions[0].isWinner=true;assert.equal(source.parse(called,ref,{now}).authoritative_race_call,false,'Official winner flags are not a forecasting or verified-call shortcut');
for(const mutate of [r=>r.election.isProduction=false,r=>r.mock=true,r=>r.election.electionDate='2024-11-05',
 r=>r.ballotItemWithBreakdown.id='wrong',r=>r.ballotItemWithBreakdown.rankedChoiceSummaryResults={},
 r=>r.ballotItemWithBreakdown.summaryResults.ballotOptions[0].nativeId='cs269',
 r=>r.ballotItemWithBreakdown.summaryResults.ballotOptions[2].party.abbreviation='D',
 r=>r.ballotItemWithBreakdown.breakdownResults.pop(),
 r=>r.ballotItemWithBreakdown.breakdownResults[0].locality.mapFeatureId='810',
 r=>r.ballotItemWithBreakdown.breakdownResults[0].locality.id='wrong',
 r=>r.ballotItemWithBreakdown.breakdownResults[0].ballotOptions[0].voteCount++,
 r=>r.ballotItemWithBreakdown.breakdownResults[0].ballotOptions[0].groupResults[0].voteCount++,
 r=>r.ballotItemWithBreakdown.breakdownResults[0].ballotOptions[0].groupResults[0].groupName=[{languageId:'en',text:'Unknown method'}],
 r=>r.ballotItemWithBreakdown.voteTotal++,r=>r.ballotItems.find(x=>x.id===r.ballotItemWithBreakdown.id).voteTotal++,
 r=>r.election.lastUpdated='2026-11-03T23:00:00Z',r=>r.ballotItemWithBreakdown.reportingStatus.asOf='2026-11-03T23:00:00Z',r=>r.election.publishDate='2026-11-04T03:05:00']){
 const x=structuredClone(raw);mutate(x);assert.throws(()=>source.parse(x,ref,{now}));
}
assert.throws(()=>source.parse(raw,ref,{now,source_url:source.URL+'?light='}));
console.log('Official VA02 exact election/native roster/county-equivalents/five-method reconciliation/clock/test guards PASS (synthetic; no delivery/calibration claim)');
