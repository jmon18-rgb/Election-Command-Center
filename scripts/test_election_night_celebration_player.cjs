'use strict';
const assert=require('node:assert/strict');
const {create,STORIES}=require('./election_night_celebration_player.js');
assert.deepEqual(Object.keys(STORIES).slice(0,11),['graham','blexas','blue_corn','blansas','maine','nebraska','ohio','talarico','abbott','mississippi','tsunami'],'All eleven original key offsets preserve the existing missing-music-helper fallback');
assert.equal(Object.keys(STORIES)[11],'michigan','New Michigan story appends after all existing fallback offsets');
assert.deepEqual(Object.keys(STORIES).slice(12),['florida_senate','louisiana_senate'],'Stretch stories append after every prior fallback offset');
assert.doesNotMatch(JSON.stringify(STORIES.graham),/lindsey/i,'Graham story must not name the previous seat holder');
let tasks=new Map(),clock=0,id=0,done,allowed=new Set(['graham','blansas']),events=[],sounds=[];
const player=create({setTimer:(fn,ms)=>{tasks.set(++id,{fn,at:clock+ms});return id},
 clearTimer:id=>tasks.delete(id),valid:item=>allowed.has(item.id),
 announce:cb=>{done=cb},render:(item,demo,phase)=>events.push([item.id,demo,phase]),
 music:id=>sounds.push(id)});
function tick(){const [key,t]=[...tasks].sort((a,b)=>a[1].at-b[1].at)[0]||[];if(!t)return;tasks.delete(key);clock=t.at;t.fn();}
assert.equal(player.enqueue({id:'tsunami'}),false,'Unknown national outcome never earns through playback');
assert.equal(player.enqueue({id:'graham'}),true);
assert.equal(events.at(-1)[2],'announcement');assert.equal(sounds.at(-1),null);
assert.equal(player.enqueue({id:'graham'}),false,'Duplicate active call cannot interrupt');
assert.equal(player.enqueue({id:'blansas'}),true);
done();assert.equal(events.at(-1)[2],'scene');assert.equal(sounds.at(-1),'graham');
done();assert.equal(tasks.size,1,'Duplicate media completion cannot double schedule');
allowed.delete('graham');player.revoke('graham');
assert.equal(player.state().active,'blansas','Withdrawn call advances the queue');
const late=done;
assert.equal(player.enqueue({id:'tsunami'},true),true,'Explicit preview may show unearned story');
assert.equal(player.state().pending,0,'Preview clears pending live presentation');
late();assert.equal(events.at(-1)[2],'announcement','Old recording cannot start replacement story');
tick();assert.equal(events.at(-1)[2],'scene','Stalled audio has bounded fallback');
tick();tick();tick();assert.equal(player.state().active,null);
assert.equal(events.at(-1)[2],'complete');
for(const name of Object.keys(STORIES)){
 assert.equal(player.enqueue({id:name},true),true,'Every known story remains previewable');done();player.stop();
 assert.equal(tasks.size,0,'Stop must cancel every queued phase');
}
console.log('Celebration ordering, media failure, queue, preview isolation and call revocation PASS');
