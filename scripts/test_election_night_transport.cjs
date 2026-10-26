#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const transport=require('./election_night_transport.js');
const backoff=require('./election_night_source_backoff.js');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

assert.throws(()=>transport.createPool(5),/bounded/);
assert.throws(()=>transport.createPool(0),/bounded/);
assert.throws(()=>transport.createPool(4,65),/bounded/);
assert.throws(()=>transport.createPool(4,64,{priorityReserve:9}),/bounded/);

(async()=>{
 const pool=transport.createPool(4,64);
 let running=0,peak=0;
 const completions=await Promise.all(Array.from({length:80},(_,i)=>
  pool.run(async()=>{
   running++;peak=Math.max(peak,running);
   await new Promise(setImmediate);
   running--;
   return i;
  }).then(value=>({ok:true,value}),error=>({ok:false,error:String(error)}))));
 assert.equal(peak,4,'Multiple election-night sweeps must share a global four-request cap');
 assert.equal(completions.filter(x=>x.ok).length,68,
  'At most four in flight plus 64 queued provider requests');
 assert.equal(completions.filter(x=>!x.ok).length,12,
  'A saturated local queue must reject rather than grow forever');
 assert.equal(pool.status().peak,4);
 assert.equal(pool.status().completed,68);
 assert.equal(pool.status().failed,0);
 assert.equal(pool.status().queued,0);
 assert.equal(pool.status().active,0);

 const ordered=transport.createPool(1,4,{priorityReserve:2}),starts=[];
 let open;
 const gate=ordered.run(()=>new Promise(resolve=>{open=resolve;}));
 await Promise.resolve();
 const jobs=[ordered.run(()=>starts.push('bulk1')),ordered.run(()=>starts.push('bulk2')),
  ordered.run(()=>starts.push('Iowa'),{priority:true}),ordered.run(()=>starts.push('Kansas'),{priority:true})];
 open();await Promise.all([gate,...jobs]);
 assert.deepEqual(starts,['Iowa','Kansas','bulk1','bulk2'],
  'Competitive needle requests must run before queued bulk work without interrupting active requests');

 // Exercise the actual page's factory options and request routing under a
 // full bulk queue, rather than merely testing an isolated priority flag.
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const declaration=html.match(/^const enCivicRequestPool=.*;$/m)?.[0];
 const fetcher=html.match(/async function enCivicFetchJson\(url,timeoutMs=12000\)\{[\s\S]*?\n\}/)?.[0];
 assert(declaration&&fetcher,'Actual dashboard transport wiring is available');
 const launched=[];
 const subject=vm.runInNewContext(declaration+'\n'+fetcher+'\n({pool:enCivicRequestPool,fetch:enCivicFetchJson})',{
  window:{ElectionNightTransport:transport},enCivicFetchUnpooled:async url=>{launched.push(url);return url;}
 });
 const releases=[],gates=Array.from({length:4},()=>subject.pool.run(()=>new Promise(resolve=>releases.push(resolve))));
 await Promise.resolve();assert.equal(releases.length,4);
 const bulk=Array.from({length:56},(_,i)=>subject.pool.run(()=>launched.push('bulk'+i)));
 await assert.rejects(subject.pool.run(()=>null),/saturated/,
  'Bulk work cannot occupy the eight reserved needle positions');
 await assert.rejects(subject.fetch('https://civicapi.org/api/v2/race/87151?light='),/saturated/,
  'Only the exact full county route receives needle priority');
 const needleUrls=['https://civicapi.org/api/v2/race/87151','https://civicapi.org/api/v2/race/87162','https://civicapi.org/api/v2/race/87438','https://civicapi.org/api/v2/race/87483','https://civicapi.org/api/v2/race/87485','https://civicapi.org/api/v2/race/87204','https://civicapi.org/api/v2/race/87385','https://civicapi.org/api/v2/race/87319'];
 const needles=needleUrls.map(url=>subject.fetch(url));
 assert.equal(subject.pool.status().queued,64);assert.equal(subject.pool.status().priority_queued,8);
 await assert.rejects(subject.pool.run(()=>null,{priority:true}),/saturated/,
  'Priority cannot expand the total queue');
 releases[0]();await Promise.all(needles);
 assert.deepEqual(launched.slice(0,8),needleUrls,'All eight actual needle URLs start ahead of56 queued background requests');
 releases.slice(1).forEach(release=>release());await Promise.all([...gates,...bulk]);
 assert.equal(subject.pool.status().peak,4);assert.equal(subject.pool.status().completed,68);
 assert.equal(subject.pool.status().active,0);assert.equal(subject.pool.status().queued,0);

 let now=Date.parse('2026-11-03T23:30:00Z');
 const b=backoff.create(()=>now);
 const epoch=transport.generation(b);
 let release;
 const delayed=new Promise(resolve=>release=resolve);
 const pending=pool.run(async()=>{
  await delayed;
  if(!transport.sameGeneration(b,epoch))
   throw Error('Discarded reply from prior outage epoch');
  return 'old-result';
 });
 b.fail(503);
 assert.equal(transport.sameGeneration(b,epoch),false);
 release();
 await assert.rejects(pending,/prior outage epoch/);
 now+=60000;
 assert.equal(b.status().blocked,false);
 assert.equal(transport.sameGeneration(b,epoch),false,
  'Cooldown expiry cannot resurrect an in-flight pre-error response');
 const newEpoch=transport.generation(b);
 const healthy=await pool.run(async()=>{
  if(!transport.sameGeneration(b,newEpoch))throw Error('Current request invalid');
  b.success();
  return 'new verified detailed response';
 });
 assert.equal(healthy,'new verified detailed response');
 assert.equal(b.status().consecutive,0);
 assert.equal(transport.sameGeneration(b,newEpoch),true);
 assert.equal(transport.sameGeneration(b,epoch),false);
 for(const http of [429,502,504]){
  b.fail(http);
  assert.equal(transport.sameGeneration(b,transport.generation(b)),false,
   'A blocked breaker is not a current usable source even with matching epoch');
  now+=10*60000;
  b.success();
 }
 assert.equal(pool.status().active,0);
 console.log('Shared four-request/64-queued cap, eight reserved competitive needle positions, exact URL priority, outage epochs and cooldown recovery PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
