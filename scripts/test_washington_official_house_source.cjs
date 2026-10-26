'use strict';
// Positive counts below are deliberately synthetic unit fixtures, never archives.
const fs=require('node:fs'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const api=require('./washington_official_house_source.js');
const raw=JSON.parse(zlib.gunzipSync(fs.readFileSync('data/washington_historical_sources/2026-official-wa03-preclose-sample.json.gz')));
const assessment=JSON.parse(fs.readFileSync('data/washington_house_03_source_assessment.json','utf8'));
assert.equal(require('node:crypto').createHash('sha256').update(zlib.gunzipSync(fs.readFileSync(assessment.original_preclose_sample_path))).digest('hex'),assessment.original_preclose_sample_sha256);
assert.equal(assessment.national_input_enabled,false);
const ref=JSON.parse(fs.readFileSync('data/washington_house_03_county_fips_reference.json','utf8'));
assert.throws(()=>api.parse(raw,ref,{now:Date.parse('2026-10-26T19:00:00Z')}),/stale/);
const zero=api.parse(raw,ref,{now:Date.parse(raw.election.publishDate)});
assert.equal(zero.live_votes_accepted,false);assert.equal(zero.status,'NO_REPORTED_VOTES');assert.equal(zero.counties.length,7);
const fixture=structuredClone(raw),b=fixture.ballotItemWithBreakdown;
fixture.election.asOf='2026-11-04T04:01:00Z';fixture.election.publishDate='2026-11-04T04:01:01Z';
for(const [i,c] of b.breakdownResults.entries()){
 for(const x of c.ballotOptions)x.voteCount=x.nativeId==='1601892'?2000+i*30:x.nativeId==='1601893'?1900+i*20:3;
 c.voteTotal=c.ballotOptions.reduce((n,x)=>n+x.voteCount,0);
}
for(const x of b.summaryResults.ballotOptions)x.voteCount=b.breakdownResults.reduce((n,c)=>n+c.ballotOptions.find(r=>r.nativeId===x.nativeId).voteCount,0);
b.voteTotal=b.summaryResults.ballotOptions.reduce((n,x)=>n+x.voteCount,0);
const overview=fixture.ballotItems.find(r=>r.id===b.id);
overview.voteTotal=b.voteTotal;overview.summaryResults=structuredClone(b.summaryResults);
const options={now:Date.parse('2026-11-04T04:02:00Z')};
const parsed=api.parse(fixture,ref,options);
assert.equal(parsed.live_votes_accepted,true);assert.equal(parsed.may_move_national_needle,false);
assert.equal(parsed.method_split_reported,false);assert(parsed.counties.every(c=>!c.completion_verified));
function rejects(change,pattern){const d=structuredClone(fixture);change(d);assert.throws(()=>api.parse(d,ref,options),pattern);}
rejects(d=>d.election.isProduction=false,/identity|election/);
rejects(d=>d.election.isPrimary=true,/election/);
rejects(d=>d.election.isTest=true,/test data/);
rejects(d=>d.election.electionDate='2024-11-05',/election/);
rejects(d=>d.election.asOf='2026-11-04T01:00:00Z',/stale|pre-close/);
rejects(d=>d.election.asOf='2026-11-05T04:00:00Z',/future/);
rejects(d=>d.election.publishDate='2026-11-04T04:00:00Z',/precedes/);
rejects(d=>d.ballotItemWithBreakdown.id='wrong-office',/contest/);
rejects(d=>d.ballotItemWithBreakdown.breakdownResults.pop(),/contest/);
rejects(d=>d.ballotItemWithBreakdown.breakdownResults[1].locality=d.ballotItemWithBreakdown.breakdownResults[0].locality,/duplicate/);
rejects(d=>d.ballotItemWithBreakdown.breakdownResults[0].ballotOptions[0].voteCount=-1,/count/);
rejects(d=>d.ballotItemWithBreakdown.breakdownResults[0].ballotOptions[0].voteCount=.5,/count/);
rejects(d=>d.ballotItemWithBreakdown.breakdownResults[0].ballotOptions[0].nativeId='different-nominee',/identity/);
rejects(d=>d.ballotItemWithBreakdown.breakdownResults[0].ballotOptions[0].party.abbreviation='DEM',/identity/);
rejects(d=>d.ballotItemWithBreakdown.breakdownResults[0].voteTotal++,/total/);
rejects(d=>d.ballotItemWithBreakdown.summaryResults.ballotOptions[0].voteCount++,/disagrees/);
assert.throws(()=>api.parse(fixture,ref,{...options,source_url:'https://unverified.invalid'}),/source/);
const correction=structuredClone(fixture);for(const x of correction.ballotItemWithBreakdown.breakdownResults[0].ballotOptions)
 if(x.nativeId==='1601892')x.voteCount-=100;
correction.ballotItemWithBreakdown.breakdownResults[0].voteTotal-=100;
correction.ballotItemWithBreakdown.summaryResults.ballotOptions.find(x=>x.nativeId==='1601892').voteCount-=100;
correction.ballotItemWithBreakdown.voteTotal-=100;
const correctedOverview=correction.ballotItems.find(r=>r.id===b.id);
correctedOverview.voteTotal-=100;correctedOverview.summaryResults=structuredClone(correction.ballotItemWithBreakdown.summaryResults);
assert.equal(api.parse(correction,ref,options).counties[0].dem_votes,1900,'A correctly reconciled downward correction is retained');
assert.deepEqual(raw.ballotItemWithBreakdown.summaryResults.ballotOptions.map(x=>x.voteCount),[0,0,0]);
console.log('Official WA03 source contract: original pre-close zero sample, synthetic counts, full seven-part reconciliation, identity/time/correction guards PASS; no national input enabled');
