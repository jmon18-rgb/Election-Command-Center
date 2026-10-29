'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=process.env.DASHBOARD_TEST_ROOT||path.resolve(__dirname,'..'),index=fs.readFileSync(path.join(root,'index.html'),'utf8'),start=index.indexOf('const enAnnouncementMotionSlots='),end=index.indexOf('let enCelebrationMusicEpoch=',start);
assert(start>=0&&end>start);const source=index.slice(start,end);
function realm(){
 const nodes={'#enFishTalking':{hidden:false,isConnected:true,dataset:{animate:'false',staticOriginal:'true'}},'#enCelebrationFishTalking':{hidden:false,isConnected:true,dataset:{animate:'false',staticOriginal:'true'}},'#enFishToast':{hidden:false},'#enMilestoneSpotlight':{open:true},'#enCelebrationStage':{dataset:{phase:'announcement'}},'#enFishAudio':{paused:false},'#enCelebrationAnnouncement':{paused:false}},pending=[],motions=[];
 let contextReads=0,contextResumes=0;const context={state:'suspended',resume(){contextResumes++;return new Promise(resolve=>pending.push(resolve));}};
 const surface={console,Promise,document:{hidden:false,querySelector:id=>nodes[id]||null},enFishSoundEnabled:true,enFishCurrent:{fictional:true},window:{ElectionNightAnnouncementMotion:{create(options){const result={options,accepted:0,stopped:0,start(){this.accepted++;return true;},stop(){this.stopped++;}};motions.push(result);return result;}}}};
 Object.defineProperty(surface,'enCelebrationAudioContext',{get(){contextReads++;return context;}});
 vm.createContext(surface);vm.runInContext(source,surface);return{surface,context,nodes,pending,motions,reads:()=>contextReads,resumes:()=>contextResumes};
}
const r=realm();
for(const kind of['bulletin','celebration'])for(const resume of[true,false])assert.equal(r.surface.enAnnouncementMotionStart(kind,{resume}),false);
assert.equal(r.pending.length,0,'Static original never starts an asynchronous context resume');assert.equal(r.motions.length,0,'Static original never constructs substitute-motion instances');assert.equal(r.reads(),0,'Start returns before touching even the music-owned context');assert.equal(r.resumes(),0);
for(const mutate of[()=>r.nodes['#enFishToast'].hidden=true,()=>r.nodes['#enCelebrationStage'].dataset.phase='scene',()=>r.nodes['#enCelebrationFishTalking'].dataset.animate='true',()=>r.surface.document.hidden=true,()=>r.surface.enFishSoundEnabled=false]){mutate();assert.equal(r.surface.enAnnouncementMotionStart('bulletin',{resume:true}),false);assert.equal(r.surface.enAnnouncementMotionStart('celebration',{resume:true}),false);}
assert.equal(r.motions.length,0);assert.equal(r.resumes(),0);assert.equal(r.reads(),0);
// Existing cleanup remains safe for a retained legacy analysis object, even
// though no production start may create or revive one under the new contract.
let stopped=0;r.surface.__retainedMotion={stop(){stopped++;}};vm.runInContext('enAnnouncementMotionSlots.bulletin.motion=__retainedMotion',r.surface);r.surface.enAnnouncementMotionStop('bulletin');assert.equal(stopped,1);assert.equal(vm.runInContext('enAnnouncementMotionSlots.bulletin.epoch',r.surface),1);assert.equal(r.surface.enAnnouncementMotionStart('bulletin',{resume:true}),false);assert.equal(stopped,1);
const missing=realm();missing.surface.window.ElectionNightAnnouncementMotion=undefined;assert.equal(missing.surface.enAnnouncementMotionStart('bulletin',{resume:true}),false);assert.doesNotThrow(()=>missing.surface.enAnnouncementMotionStop('bulletin'));assert.doesNotThrow(()=>missing.surface.enAnnouncementMotionStop('unknown'));assert.equal(missing.motions.length,0);
// Preserve the extracted/missing/TDZ fallback checks. No initialisation order
// can turn static photo playback into an analysis dependency.
const tdz=realm();vm.runInContext('{'+source+"\nthis.__duringTDZ=enAnnouncementMotionStart('bulletin',{resume:true});this.__contextDuringTDZ=enAnnouncementMotionContext(true);let enCelebrationAudioContext=null;}",tdz.surface);assert.equal(tdz.surface.__duringTDZ,false);assert.equal(tdz.surface.__contextDuringTDZ,null);
const stopOnly=source.slice(source.indexOf('function enAnnouncementMotionStop('),source.indexOf('function enAnnouncementMotionStart(')),isolated={};vm.createContext(isolated);vm.runInContext(stopOnly,isolated);assert.doesNotThrow(()=>isolated.enAnnouncementMotionStop('bulletin'));
console.log('Static original Fish binding PASS: starts always false before slot/context/resume; lifecycle and retained cleanup, optional/missing/extracted/TDZ safety preserved. Owner retracted substitute-animation requirement.');
