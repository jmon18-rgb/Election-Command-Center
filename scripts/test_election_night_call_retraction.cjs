'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const segment=(name,next)=>{const start=html.indexOf('function '+name+'(');
 const end=html.indexOf('function '+next+'(',start);assert(start>0&&end>start);return html.slice(start,end)};
const item={office:'Senate',key:'NH'};
const previous={race_id:12,called:'First candidate',total:100,last_updated:'2026-11-04T03:00:00Z',
 candidates:[{name:'First candidate',party:'D',votes:60},{name:'Second candidate',party:'R',votes:40}]};
const next={...previous,called:null,last_updated:'2026-11-04T03:01:00Z'};
const records=[];
const context=vm.createContext({enAlertSubscribed:()=>true,enAlertRecord:(...args)=>records.push(args),
 enNum:String,enFishRevokeCall:()=>{}});
// First prove the actual alert processor reports a withdrawn call at all.
vm.runInContext(segment('enCivicTopCandidate','enRenderAlertInbox'),context);
context.enProcessCivicAlert(item,previous,next);
assert.equal(records.at(-1)?.[2],'retraction','A fresh withdrawal needs an explicit source correction alert');
const call=(race='NH',source='civicAPI')=>({event:{office:'Senate',race,source,kind:'call'},demo:false});
let stopped=0,cleared=0,returned=0;
const toast={hidden:false};
const reader={isConnected:true,checkVisibility:()=>true,focus:()=>returned++,
 getBoundingClientRect:()=>({top:100,bottom:130})};
Object.assign(context,{enFishPending:[call(),call('ME'),call('NH','Open America'),
 {event:{office:'Senate',race:'NH',source:'civicAPI',kind:'first'},demo:false}],
 enFishCurrent:call(),enFishTimeout:123,enFishAudioStop:()=>stopped++,
 clearTimeout:()=>cleared++,enFishReturnFocus:reader,enFishReturnAnchor:null,innerHeight:900,
 $:selector=>selector==='#electionNight .en-toolbar'?{getBoundingClientRect:()=>({bottom:62})}:toast});
// The extracted revocation path now uses the actual shared reader-return helper.
vm.runInContext('const jointNationalReaders=new WeakMap();'+segment('jointNationalReadingTarget','jointRenderNeedles'),context);
vm.runInContext(segment('enReadingReturnAnchor','enFishRenderVoice'),context);
vm.runInContext(segment('enFishRevokeCall','enFishQueueState'),context);
records.length=0;
context.enProcessCivicAlert(item,previous,next);
assert.equal(context.enFishPending.length,3,'Only this source/race call is removed from the queue');
assert.equal(context.enFishCurrent,null);
assert.equal(toast.hidden,true);
assert.equal(stopped,1);assert.equal(cleared,1);assert.equal(returned,1);
assert.match(records[0][3],/withdrew its call for First candidate/);
assert.match(records[0][3],/uncalled/);
assert.equal(records[0][2],'retraction');
records.length=0;
context.enProcessCivicAlert(item,next,next);
assert.equal(records.length,0,'An already-uncalled race does not repeatedly announce a withdrawal');
context.enProcessCivicAlert(item,previous,{...next,called:'Second candidate'});
assert.equal(records[0][2],'call','A corrected named winner remains a new provider call');
assert.match(records[0][3],/Second candidate/);
records.length=0;context.enAlertSubscribed=()=>false;
context.enFishPending=[call()];context.enFishCurrent=call('ME');
context.enProcessCivicAlert(item,previous,next);
assert.equal(context.enFishPending.length,0,'Unpinning cannot preserve a superseded queued call');
assert.equal(context.enFishCurrent.event.race,'ME','Another active race must not be interrupted');
assert.equal(records.length,0,'Unsubscribed races do not emit new bulletins');
console.log('Actual provider-call withdrawal: explicit correction, queued/active call removal, unrelated alerts and corrected winners PASS');
