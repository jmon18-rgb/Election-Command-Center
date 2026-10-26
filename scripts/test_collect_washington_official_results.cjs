'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),zlib=require('node:zlib');
const {collect}=require('./collect_washington_official_results.cjs');
const api=require('./washington_official_house_source.js');
const reference=JSON.parse(fs.readFileSync('data/washington_house_03_county_fips_reference.json','utf8'));
const zero=JSON.parse(zlib.gunzipSync(fs.readFileSync('data/washington_historical_sources/2026-official-wa03-preclose-sample.json.gz')));
const response=d=>new Response(JSON.stringify(d),{headers:{'content-type':'application/json','cache-control':'public,max-age=60'}});
(async()=>{
 let requests=0;const fetchImpl=async url=>{requests++;assert.equal(url,api.URL);return response(zero);};
 const actualSample=await collect({fetchImpl,reference,now:Date.parse('2026-10-26T19:00:00Z')});
 assert.equal(actualSample.status,'SOURCE_UNAVAILABLE');assert.equal(actualSample.payload,null);assert.match(actualSample.error,/stale/);assert.equal(requests,1);
 const healthyZero=await collect({fetchImpl:async()=>response(zero),reference,now:Date.parse(zero.election.publishDate)});
 assert.equal(healthyZero.status,'NO_REPORTED_VOTES');assert.equal(healthyZero.payload,null);
 const fixture=structuredClone(zero),b=fixture.ballotItemWithBreakdown;
 fixture.election.asOf='2026-11-04T04:01:00Z';fixture.election.publishDate='2026-11-04T04:01:01Z';
 for(const c of b.breakdownResults){for(const x of c.ballotOptions)x.voteCount=x.isWriteIn?1:2000;c.voteTotal=4001;}
 for(const x of b.summaryResults.ballotOptions)x.voteCount=x.isWriteIn?7:14000;b.voteTotal=28007;
 const overview=fixture.ballotItems.find(x=>x.id===b.id);overview.voteTotal=b.voteTotal;overview.summaryResults=structuredClone(b.summaryResults);
 const out=await collect({fetchImpl:async()=>response(fixture),reference,now:Date.parse('2026-11-04T04:02:00Z')});
 assert.equal(out.status,'VALIDATED_COUNTY_COUNTS_METHOD_MIX_UNRESOLVED');assert.equal(out.may_move_national_needle,false);
 assert.equal(out.payload.ballotItems.length,1);assert.deepEqual(out.payload.ballotItemWithBreakdown,b);assert(out.selected_payload_sha256);
 const failure=await collect({fetchImpl:async()=>new Response('upstream unavailable',{status:503}),reference});
 assert.equal(failure.status,'SOURCE_UNAVAILABLE');assert.equal(failure.payload,null);
 const huge=await collect({fetchImpl:async()=>new Response('x'.repeat(2*1024*1024+1),{headers:{'content-type':'application/json'}}),reference});
 assert.equal(huge.payload,null);assert.match(huge.error,/bounded/);
 console.log('Bounded official collector: one bounded request, zero/stale exclusion, unchanged source selection/reparse, failures and body bounds PASS. Synthetic positive fixture only; no publisher enabled.');
})().catch(e=>{console.error(e);process.exitCode=1;});
