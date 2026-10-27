'use strict';
// Positive source objects are synthetic tests; no network or repository writes.
const fs=require('node:fs'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const {collect}=require('./collect_washington_official_results.cjs'),cache=require('./washington_official_cache.js');
const {publish,inWindow,healthWindow,REPO}=require('./publish_washington_official_cache.cjs');
const ref=JSON.parse(fs.readFileSync('data/washington_house_03_county_fips_reference.json','utf8'));
const raw=JSON.parse(zlib.gunzipSync(fs.readFileSync('data/washington_historical_sources/2026-official-wa03-preclose-sample.json.gz')));
const now=Date.parse('2026-11-04T04:02:00Z');raw.election.asOf='2026-11-04T04:01:00Z';raw.election.publishDate='2026-11-04T04:01:01Z';
for(const c of raw.ballotItemWithBreakdown.breakdownResults){for(const x of c.ballotOptions)x.voteCount=x.isWriteIn?1:2000;c.voteTotal=4001;}
const b=raw.ballotItemWithBreakdown;for(const x of b.summaryResults.ballotOptions)x.voteCount=x.isWriteIn?7:14000;b.voteTotal=28007;
const overview=raw.ballotItems.find(r=>r.id===b.id);overview.voteTotal=b.voteTotal;overview.summaryResults=structuredClone(b.summaryResults);
(async()=>{
 const record=await collect({now,reference:ref,fetchImpl:async()=>new Response(JSON.stringify(raw),{headers:{'content-type':'application/json'}})});
 const parsed=await cache.parse(record,ref,{now});assert.equal(parsed.live_votes_accepted,true);assert.equal(parsed.counties.length,7);
 assert.equal(parsed.collection_selected_payload_sha256,record.selected_payload_sha256);
 assert.equal(parsed.collection_payload_integrity_verified,true);
 assert.equal(parsed.collection_original_response_sha256,record.original_response_sha256);
 assert.equal(parsed.collection_original_response_hash_recomputed,false);
 const corrupt=structuredClone(record);corrupt.payload.ballotItemWithBreakdown.summaryResults.ballotOptions[0].voteCount++;
 await assert.rejects(cache.parse(corrupt,ref,{now}),/integrity/);
 await assert.rejects(cache.parse(record,ref,{now:now+16*60000}),/stale/);
 await assert.rejects(cache.parse(record,ref,{now,source_url:'https://arbitrary-proxy.invalid'}),/identity/);
 const health={schema:record.schema,source_url:record.source_url,fetched_at:record.fetched_at,status:'SOURCE_UNAVAILABLE',payload:null,may_move_national_needle:false,error:'503'};
 assert.equal((await cache.parse(health,ref,{now})).live_votes_accepted,false);
 await assert.rejects(cache.parse({...health,payload:record.payload},ref,{now}),/cannot carry/);
 const writes=[];let previous=null;
 const request=async(method,suffix,data)=>{
  if(method==='GET'&&suffix==='')return {full_name:REPO,default_branch:'main'};
  if(method==='GET'&&suffix.startsWith('/git/ref/'))return {object:{sha:'reviewed-main'}};
  if(method==='GET'&&suffix.startsWith('/contents/')){if(previous)return previous;const e=Error('not found');e.status=404;throw e;}
  if(method==='PUT'){assert.equal(data.branch,cache.BRANCH);assert.equal(suffix,'/contents/'+cache.PATH);writes.push(data);return {commit:{sha:'data-only-commit'}};}
  throw Error('Unexpected repository operation');
 };
 assert.equal((await publish({request,record,reference:ref,now})).changed,true);assert.equal(writes.length,1);
 const mark=JSON.parse(Buffer.from(writes[0].content,'base64').toString()).revision_watermark;assert.equal(mark.as_of,record.snapshot_updated_at);
 previous={sha:'previous-blob',content:Buffer.from(JSON.stringify(record)).toString('base64')};
 assert.equal((await publish({request,record,reference:ref,now})).changed,false);
 previous.content=Buffer.from(JSON.stringify({...record,fetched_at:new Date(now+60000).toISOString()})).toString('base64');
 await assert.rejects(publish({request,record,reference:ref,now}),/newer receipt/);
 previous.content=Buffer.from(JSON.stringify({...record,revision_watermark:{as_of:'2026-11-04T04:10:00Z',published_at:'2026-11-04T04:10:01Z'}})).toString('base64');
 const laterHealth={...health,fetched_at:'2026-11-04T04:12:00Z'};
 await publish({request,record:laterHealth,reference:ref,now:Date.parse(laterHealth.fetched_at)});
 const persistedHealth=JSON.parse(Buffer.from(writes.at(-1).content,'base64').toString());
 assert.equal(persistedHealth.payload,null);assert.equal(persistedHealth.revision_watermark.as_of,'2026-11-04T04:10:00Z','Outage retains the latest accepted/zero source marker');
 previous.content=Buffer.from(JSON.stringify(persistedHealth)).toString('base64');
 await assert.rejects(publish({request,record:{...record,fetched_at:'2026-11-04T04:13:00Z'},reference:ref,now:Date.parse('2026-11-04T04:13:00Z')}),/Out-of-order/);
 await assert.rejects(publish({request:async()=>({full_name:REPO,default_branch:cache.BRANCH}),record,reference:ref,now}),/Default-branch/);
 await assert.rejects(publish({request,record,reference:ref,now:Date.parse('2026-10-26T19:00:00Z'),healthOnly:true}),/future|window/);
 await assert.rejects(publish({request,record:health,reference:ref,now,healthOnly:true}),/cannot interrupt/);
 const preclose=Date.parse('2026-10-26T20:00:00Z'),prehealth={...health,fetched_at:new Date(preclose).toISOString()};let created=false,healthWrites=0;
 const bootstrap=async(method,suffix,data)=>{
  if(method==='GET'&&suffix==='')return {full_name:REPO,default_branch:'main'};
  if(method==='GET'&&suffix==='/git/ref/heads/main')return {object:{sha:'reviewed-main'}};
  if(method==='POST'){assert.equal(suffix,'/git/refs');assert.equal(data.ref,'refs/heads/'+cache.BRANCH);assert.equal(data.sha,'reviewed-main');created=true;return {};}
  if(method==='PUT'){assert(created);assert.equal(data.branch,cache.BRANCH);assert.equal(JSON.parse(Buffer.from(data.content,'base64').toString()).payload,null);healthWrites++;return {commit:{sha:'health-only'}};}
  const e=Error('missing');e.status=404;throw e;
 };
 await assert.rejects(publish({request:bootstrap,record:prehealth,reference:ref,now:preclose}),/Outside/);
 assert.equal(healthWrites,0);assert.equal(created,false);
 await publish({request:bootstrap,record:prehealth,reference:ref,now:preclose,healthOnly:true});assert.equal(healthWrites,1);
 assert.equal(inWindow(Date.parse('2027-11-04T04:02:00Z')),false);assert.equal(inWindow(Date.parse('2026-11-04T17:00:00Z')),true);assert.equal(inWindow(Date.parse('2026-11-25T08:00:00Z')),false);
 assert.equal(healthWindow(preclose),true);assert.equal(healthWindow(now),false);assert.equal(healthWindow(Date.parse('2027-10-26T20:00:00Z')),false);
 console.log('Official owned cache: integrity/reparse, receipt freshness, no live health payload, fixed data-only branch, unchanged/late writes and exact-year window PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
