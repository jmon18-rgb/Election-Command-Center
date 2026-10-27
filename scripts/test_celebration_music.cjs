'use strict';
const assert=require('node:assert/strict'),music=require('./election_night_celebration_music.js'),{STORIES}=require('./election_night_celebration_player.js');
assert.deepEqual(Object.keys(music.THEMES).sort(),Object.keys(STORIES).sort());
const signatures=new Set();
for(const id of Object.keys(STORIES)){
 const score=music.score(id);assert(score.events.length>40&&score.events.length<200);assert.equal(score.duration,7.05);
 for(const e of score.events){assert(e.at>=0&&e.at+e.duration<=7.05);assert(e.duration>0&&e.level>0&&e.level<=.12);assert(Number.isFinite(e.note));}
 signatures.add(JSON.stringify(score.events));
}assert.equal(signatures.size,11,'Every event has its own composition, not a transposed generic cue');
assert.equal(music.score('not-a-verified-event'),null);
let created=[],stopped=0,disconnected=0;
const param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
const node=()=>{const n={connect(){},disconnect(){disconnected++},start(){},stop(){stopped++},frequency:param(),gain:param(),threshold:param(),ratio:param()};created.push(n);return n;};
const ctx={currentTime:2,sampleRate:22050,destination:{},createGain:node,createDynamicsCompressor:node,createBiquadFilter:node,createOscillator:node,createBufferSource:node,createBuffer:(channels,len)=>({getChannelData:()=>new Float32Array(len)})};
for(const id of Object.keys(STORIES)){
 const handle=music.play(ctx,id),before=stopped;assert.equal(handle.id,id);handle.stop();assert(stopped>before,'Mute/skip/retraction stops scheduled sources');const after=stopped;handle.stop();assert.equal(stopped,after,'Stop is idempotent');
}assert(disconnected>100);
console.log('11 original event scores, bounded levels/duration, distinct arrangements and stop/disconnect PASS');
