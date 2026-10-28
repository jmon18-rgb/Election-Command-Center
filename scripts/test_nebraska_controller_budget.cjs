'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),source=require('./nebraska_civic_county_source.js'),revisions=require('./competitive_source_revision.js'),{load,fixture}=require('./nebraska_test_fixture.cjs');
(async()=>{
 let now=Date.parse('2026-11-04T04:06:00Z'),calls=0,release,active=true,generation=0;
 class Clock extends Date{static now(){return now;}}
 const root={document:{hidden:false},NebraskaCivicCountySource:{URL:source.URL,parse:(d,r)=>source.parse(d,r,{now})},CompetitiveSourceRevision:{create:code=>revisions.create(code,{storage:null,now:()=>now})},ElectionNightPollClosings2026:require('./election_night_poll_closings_2026.js')};
 vm.runInNewContext(fs.readFileSync(require.resolve('./nebraska_senate_evidence.js'),'utf8'),{window:root,Date:Clock,setTimeout:()=>1,clearTimeout(){}});
 const controller=root.NebraskaSenateEvidence.create({isActive:()=>active,sourceGeneration:()=>generation,fetchJSON:async p=>p.includes('candidate_reference')?load('nebraska_senate_2024_candidate_reference'):load('nebraska_county_fips_reference'),fetchSource:()=>{calls++;return new Promise(ok=>release=ok);}});
 const first=controller.tick();await new Promise(setImmediate);assert.equal(calls,1);now+=95000;release(fixture({stamp:new Date(now-1000).toISOString()}));await first;assert(controller.status().evidence);
 assert.equal(await controller.tick(true),false);now+=59000;assert.equal(await controller.tick(true),false);assert.equal(calls,1);
 async function next(raw){now+=60000;const work=controller.tick(true);await new Promise(setImmediate);release(raw(now));await work;}
 await next(at=>fixture({swing:-12,stamp:new Date(at-1000).toISOString()}));assert(controller.status().evidence);
 const latest=controller.status().evidence.snapshot.snapshot_updated_at;
 await next(()=>fixture({stamp:'2026-11-04T04:05:00Z'}));assert.equal(controller.status().evidence,null,'Older reply cannot restore corrected evidence');
 await next(at=>fixture({zero:true,stamp:new Date(at-1000).toISOString()}));assert.equal(controller.status().evidence,null,'Genuine zero withdrawal clears evidence');
 await next(at=>fixture({stamp:new Date(at-1000).toISOString()}));assert(controller.status().evidence,'New valid publication recovers');
 await next(at=>{const d=fixture({stamp:new Date(at-1000).toISOString()});for(const r of Object.values(d.region_results))r.candidates.find(c=>c.candidate_id===220703).votes=100000;d.candidates.find(c=>c.candidate_id===220703).votes=9300000;return d;});assert.equal(controller.status().evidence,null,'Other-candidate lead remains descriptive, not a paired forecast');
 await next(()=>fixture({stamp:latest}));assert.equal(controller.status().evidence,null,'Unsupported newer publication still protects ordering watermark');
 await next(at=>fixture({stamp:new Date(at-1000).toISOString()}));assert(controller.status().evidence);
 const before=calls;root.document.hidden=true;now+=120000;assert.equal(await controller.tick(true),false);assert.equal(calls,before);root.document.hidden=false;
 now+=60000;const delayed=controller.tick(true);await new Promise(setImmediate);generation++;release(fixture({stamp:new Date(now).toISOString()}));await delayed;assert.equal(controller.status().evidence,null,'Old-mode in-flight reply cannot revive evidence');
 active=false;now+=600000;assert.equal(await controller.tick(),false);assert.equal(controller.status().evidence,null);controller.destroy();
 console.log('NE completion floor/queued manual/typed revisions/correction/zero withdrawal/other lead/rollback/recovery/hidden/archive-generation PASS; SYNTHETIC only');
})().catch(e=>{console.error(e);process.exitCode=1;});
