'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto'),music=require('./election_night_celebration_music.js'),{STORIES}=require('./election_night_celebration_player.js');
assert.deepEqual(Object.keys(music.THEMES).sort(),Object.keys(STORIES).sort());
const signatures=new Set();
for(const id of Object.keys(STORIES)){
 const score=music.score(id);assert(score.events.length>40&&score.events.length<200);assert.equal(score.duration,7.05);
 for(const e of score.events){assert(e.at>=0&&e.at+e.duration<=7.05);assert(e.duration>0&&e.level>0&&e.level<=.12);assert(Number.isFinite(e.note));}
 signatures.add(JSON.stringify(score.events));
}assert.equal(signatures.size,14,'Every event has its own composition, not a transposed generic cue');
// Frozen original scores include title/BPM/timing/notes/levels; adding Michigan
// cannot quietly rearrange any of the eleven existing event compositions.
const originalScores={talarico:'aba9229a69c158f2c7c15db72c5f9e3dbda2eab2634fc7a805f9b607d6de7bd7',blexas:'b0fa844f86ed912159470ee0b6f296faf66f68f62f55e23b5c2dd1a5ed77b729',abbott:'add0cdd25b057fb536b2ac93cc0ab526057fe67e2d766ad80963a95e624a5c6c',graham:'3867fd5794da7435b92d08f059b0669f978d0bd19fd179f9c1f2ef64fdc1887f',blansas:'9e170bd9b10095de5122d87522da096ad01cc8ed5a2287a62a01ebbc56321534',nebraska:'25f7780a32aaae7e99275a6710e15292974cf38e54a70afbf4778ad80f156126',mississippi:'68a3533d20bffb05354c60b6a2b8e657a10ebb7552ab2b82598b891b563e8019',blue_corn:'fd1ab33ea70df78e677e397ffc55d656443a919de175988d15a5e4596fc19a4f',maine:'cef943e9b5c92c4186883f305c15f0b9927852ae261e03337e014a2ea4c4fca6',ohio:'18fbf3092a56b977d1e82cb9dfcc950c8702accb43f60ccfbad4b306d9d54c69',tsunami:'e96c121775ef767f8d73b2d4c84e28c10207169ca103546c2824203d1336377d'};
for(const [id,expected]of Object.entries(originalScores))assert.equal(crypto.createHash('sha256').update(JSON.stringify(music.score(id))).digest('hex'),expected,id+' original score is unchanged');
const michigan=music.score('michigan');assert.equal(michigan.title,'FEAR CAMPAIGN: SIGNAL LOST');
assert.equal(crypto.createHash('sha256').update(JSON.stringify(michigan)).digest('hex'),'d51642772937b9e4d88c856e74588ee3c990b1db36673d7485ec4059e58c5534','The complete existing Michigan score stays unchanged when stretch scores are added');
const opening=michigan.events.filter(event=>event.at<2.4),finale=michigan.events.filter(event=>event.at>=4.8);
assert(opening.some(event=>event.instrument==='bright'&&event.note===83)&&opening.some(event=>event.instrument==='bright'&&event.note===84),'PANICCAST has its original semitone alarm');
assert(michigan.events.some(event=>event.at===2.4&&event.instrument==='pluck'),'The ballot beat has a short comic choke');
assert(michigan.events.every(event=>event.at>=4.8||event.at+event.duration<=3.4),'The ballot MUTE beat has a real composed rest');
for(const instrument of ['brass','bass','kick','snare','hat'])assert(finale.some(event=>event.instrument===instrument),'Confetti finale includes '+instrument);
assert.deepEqual(Object.keys(music).sort(),['DURATION','THEMES','play','score'],'The audio module gains no result, winner, source or celebration-trigger authority');
assert.equal(music.score('not-a-verified-event'),null);
let created=[],stopped=0,disconnected=0;
const param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
const node=()=>{const n={connect(){},disconnect(){disconnected++},start(){},stop(){stopped++},frequency:param(),gain:param(),threshold:param(),ratio:param()};created.push(n);return n;};
const ctx={currentTime:2,sampleRate:22050,destination:{},createGain:node,createDynamicsCompressor:node,createBiquadFilter:node,createOscillator:node,createBufferSource:node,createBuffer:(channels,len)=>({getChannelData:()=>new Float32Array(len)})};
for(const id of Object.keys(STORIES)){
 const handle=music.play(ctx,id),before=stopped;assert.equal(handle.id,id);handle.stop();assert(stopped>before,'Mute/skip/retraction stops scheduled sources');const after=stopped;handle.stop();assert.equal(stopped,after,'Stop is idempotent');
}assert(disconnected>100);
console.log('14 original event scores; all12 prior scores unchanged, Michigan alarm/rest/funk, bounded levels/duration and stop/disconnect PASS');
