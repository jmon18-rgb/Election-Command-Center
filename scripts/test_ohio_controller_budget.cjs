'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const history=require('../data/ohio_senate_2024_county_baseline_official.json');
const reference=require('../data/ohio_county_fips_reference.json');
(async()=>{
 let now=Date.parse('2026-11-04T03:00:00Z'),calls=0,release;
 class Clock extends Date {static now(){return now;}}
 const root={document:{hidden:false},OhioCivicCountySource:{URL:'https://civicapi.org/api/v2/race/87527',
  parse:()=>({status:'NO_REPORTED_VOTES',live_votes_accepted:false})},
  CompetitiveSourceRevision:{create:()=>({accept(){}})},
  ElectionNightPollClosings2026:{floorFor:()=>Date.parse('2026-11-04T00:30:00Z')}};
 vm.runInNewContext(fs.readFileSync(require.resolve('./ohio_senate_evidence.js'),'utf8'),
  {window:root,Date:Clock,setTimeout:()=>1,clearTimeout(){}});
 const c=root.OhioSenateEvidence.create({fetchJSON:async p=>p.includes('baseline')?history:reference,
  fetchSource:()=>{calls++;return new Promise(ok=>{release=ok;});}});
 const first=c.tick();await new Promise(setImmediate);assert.equal(calls,1);
 // Model a 90-second shared-pool queue followed by five seconds of transport.
 now+=95000;release({});await first;
 const early=c.tick(true);await new Promise(setImmediate);
 assert.equal(calls,1,'Completion cannot immediately restart a queued request');
 assert.equal(await early,false);
 now+=59000;assert.equal(await c.tick(true),false);assert.equal(calls,1);
 now+=1000;const second=c.tick(true);await new Promise(setImmediate);assert.equal(calls,2);
 release({});await second;c.destroy();
 console.log('Ohio queued/slow response preserves a full minute after completion; manual retry cannot bypass the transport floor PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
