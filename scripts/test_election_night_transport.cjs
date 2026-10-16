#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const transport=require('./election_night_transport.js');
const backoff=require('./election_night_source_backoff.js');

assert.throws(()=>transport.createPool(5),/bounded/);
assert.throws(()=>transport.createPool(0),/bounded/);
assert.throws(()=>transport.createPool(4,65),/bounded/);

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
 console.log('Shared four-request transport, 64-deep bounded queue, discarded 503-era replies and verified cooldown recovery PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
