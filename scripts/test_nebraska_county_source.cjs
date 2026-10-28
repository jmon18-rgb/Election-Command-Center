'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),zlib=require('node:zlib'),crypto=require('node:crypto');
const source=require('./nebraska_civic_county_source.js'),{load,fixture}=require('./nebraska_test_fixture.cjs'),ref=load('nebraska_county_fips_reference'),now=Date.parse('2026-11-04T04:06:00Z');
const raw=fixture(),parsed=source.parse(raw,ref,{now}),before=JSON.stringify(raw),key=Object.keys(raw.region_results)[0];
const bytes=zlib.gunzipSync(fs.readFileSync('data/nebraska_senate_sources/2026-browser-serialized-snapshot.json.gz'));
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),load('nebraska_senate_source_contract').saved_serialized_sha256);
assert.throws(()=>source.parse(JSON.parse(bytes).body,ref,{now}),/stale/,'Actual saved stale zero snapshot is excluded');
assert.equal(parsed.counties.length,93);assert.equal(parsed.candidate_contrast,'NE_OSBORN_RICKETTS_V1');assert.equal(parsed.contrast_supported,true);assert.equal(parsed.caucus_credit_assumed,false);
assert(!JSON.stringify(parsed).includes('dem_votes'));assert(parsed.counties.every(c=>c.other_candidates.length===3&&c.other_candidates.reduce((s,p)=>s+p.votes,0)===c.other_votes));
assert.equal(parsed.counties.reduce((s,c)=>s+c.osborn_votes,0),raw.candidates.find(c=>c.candidate_id===220706).votes);
assert.equal(parsed.completion_verified,false);assert.equal(parsed.may_move_national_needle,false);
assert.equal(source.parse(fixture({zero:true}),ref,{now}).status,'NO_REPORTED_VOTES');
const test=structuredClone(raw);test.test_data=true;assert.equal(source.parse(test,ref,{now}).status,'TEST_DATA_NOT_LIVE');
for(const change of [
 d=>d.province='SD',d=>d.country='CA',d=>d.district='01',d=>d.municipality='',d=>d.election_scope='Primary',d=>d.election_type='Governor',d=>d.election_name='NE US Senate',d=>d.election_date='2024-11-05T05:00:00.000Z',d=>d.round=2,
 d=>delete d.test_data,d=>d.test_data='false',d=>d.mock=true,d=>d.mock='false',d=>d.is_disputed=true,d=>d.active=false,
 d=>d.last_updated=null,d=>d.last_updated='2026-11-04T04:05:00',d=>d.last_updated='2026-11-04T04:22:00Z',d=>d.last_updated='2026-11-04T00:59:00Z',
 d=>d.candidates[0].candidate_id++,d=>d.candidates[0].name='Deb Fischer',d=>d.candidates[4].party='Democratic',d=>d.candidates.pop(),d=>d.candidates[0].votes++,d=>d.candidates[0].votes='1',d=>d.candidates[0].test_data=true,
 d=>delete d.region_results[key],d=>d.region_results.extra=d.region_results[key],d=>delete d.region_results[key].fips,d=>d.region_results[key].fips='31003',d=>d.region_results[key].name='Unknown',d=>d.region_results[key].type='State',d=>d.region_results[key].mock=true,
 d=>d.region_results[key].candidates.pop(),d=>d.region_results[key].candidates[0].votes++,d=>d.region_results[key].candidates[0].votes=-1,d=>d.region_results[key].candidates[0].votes=.5,d=>d.region_results[key].candidates[0].votes=Number.MAX_SAFE_INTEGER+1,d=>d.region_results[key].candidates[0].candidate_id=1,d=>d.region_results[key].candidates[0].party='Democratic',d=>d.region_results[key].candidates[0]=d.region_results[key].candidates[1]
]){const changed=structuredClone(raw);change(changed);assert.notEqual(JSON.stringify(changed),before);assert.throws(()=>source.parse(changed,ref,{now}));}
assert.throws(()=>source.parse(fixture({stamp:'2026-11-04T01:45:00Z'}),ref,{now:Date.parse('2026-11-04T01:50:00Z')}),/Pre-close/);
assert.throws(()=>source.parse(raw,ref,{now,source_url:source.URL+'?light='}));
const flags=structuredClone(raw);flags.percent_reporting=100;flags.candidates.forEach(c=>{c.winner=true;c.incumbent=true;});assert.deepEqual(source.parse(flags,ref,{now}),parsed,'Winner/incumbent/reporting metadata never changes counts or awards a call');
const other=structuredClone(raw);for(const r of Object.values(other.region_results))r.candidates.find(c=>c.candidate_id===220703).votes=100000;other.candidates.find(c=>c.candidate_id===220703).votes=9300000;assert.equal(source.parse(other,ref,{now}).contrast_supported,false,'An unsupported other-candidate lead cannot silently enter paired race prediction');
assert.equal(JSON.stringify(raw),before);
(async()=>{
 assert.deepEqual(await source.readResponse(new Response(JSON.stringify(raw))),raw);
 await assert.rejects(source.readResponse(new Response('{}',{headers:{'content-length':String(source.MAX_BYTES+1)}})),/byte limit/);
 let cancelled=false;const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(source.MAX_BYTES+1));},cancel(){cancelled=true;}});await assert.rejects(source.readResponse(new Response(stream)),/byte limit/);assert(cancelled);
 await assert.rejects(source.readResponse(new Response(new Uint8Array([255]))));
 console.log('NE93 exact5 names/IDs/parties, typed Osborn/Ricketts/all-other counts, clocks/test/geography/adversarial/stream bounds PASS; original stale-zero excluded, SYNTHETIC positives only');
})().catch(e=>{console.error(e);process.exitCode=1;});
