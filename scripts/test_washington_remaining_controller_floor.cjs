'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let now=Date.parse('2026-11-04T04:05:00Z'),starts=0,release,active=true;
class Clock extends Date{static now(){return now;}}
const window={document:{hidden:false},WashingtonOfficialCache:{fetchURL:()=> 'owned-cache',parse:async()=>({status:'SOURCE_UNAVAILABLE',reason:'synthetic offline queue test'})},CompetitiveSourceRevision:{create:()=>({accept(){}})},ElectionNightPollClosings2026:{floorFor:()=>Date.parse('2026-11-04T04:00:00Z')}};
vm.runInNewContext(fs.readFileSync('scripts/washington_house_evidence.js','utf8'),{window,Date:Clock,setTimeout:()=>1,clearTimeout(){}});
const controller=window.WashingtonHouseEvidence.create({isActive:()=>active,fetchJSON:async p=>JSON.parse(fs.readFileSync(p,'utf8')),fetchSource:()=>{starts++;return starts===1?new Promise(resolve=>release=resolve):Promise.resolve({});}});
(async()=>{
 const first=controller.tick();await new Promise(setImmediate);assert.equal(starts,1);
 now+=90000;release({});await first;
 const immediate=controller.tick(true);assert.equal(starts,1,'Completion, not queue-entry time, sets the manual floor');await immediate;
 now+=59999;const early=controller.tick(true);assert.equal(starts,1);await early;
 now++;const permitted=controller.tick(true);assert.equal(starts,2,'Assert request start before awaiting response');await permitted;
 window.document.hidden=true;now+=120000;await controller.tick(true);assert.equal(starts,2);
 window.document.hidden=false;active=false;await controller.tick(true);assert.equal(starts,2);controller.destroy();
 console.log('PASS: 90s queued owned-cache response cannot bypass completion-relative minute floor; hidden/archive guards preserved; SYNTHETIC');
})().catch(e=>{console.error(e);process.exitCode=1;});
