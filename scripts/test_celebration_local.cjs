#!/usr/bin/env node
'use strict';
// Fictional bytes and fake browser seams only; not a subjective listening test.
const assert=require('node:assert/strict'),{File}=require('node:buffer');
const local=require('./election_night_celebration_local.js');
const bytes=Uint8Array.from([73,68,51,4,0,0,0,0,0,1]),file=(name='fictional.mp3',type='audio/mpeg',data=bytes)=>new File([data],name,{type});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};};
function fakeIDB(options={}){
 const records=new Map(),pendingCommits=[];let created=false,opens=0,closes=0,mutations=0,aborts=0;
 const database={objectStoreNames:{contains:()=>created},createObjectStore:(name,config)=>{assert.equal(name,'tracks');assert.equal(config.keyPath,'id');created=true;},close:()=>{closes++;},transaction(name,mode){
  assert.equal(name,'tracks');assert(['readwrite','readonly'].includes(mode));let aborted=false;
  const tx={abort(){aborted=true;aborts++;tx.onabort?.();},objectStore(){return Object.fromEntries(['get','put','delete'].map(method=>[method,value=>{
   const request={};
   queueMicrotask(()=>{
    if(aborted)return;
    request.result=method==='get'?records.get(value):method==='put'?value.id:undefined;
    request.onsuccess?.();
    const commit=()=>{if(aborted)return;if(options.lateAbort){tx.abort();return;}if(method==='put'){records.set(value.id,structuredClone(value));mutations++;}if(method==='delete'){records.delete(value);mutations++;}tx.oncomplete?.();};
    if(options.deferCommit)pendingCommits.push(commit);else queueMicrotask(commit);
   });return request;
  }]));}};return tx;
 }};
 const indexedDB={open(name,version){assert.equal(name,'bluewaves_celebration_audio_v1');assert.equal(version,1);opens++;if(options.throwOpen)throw Error('private failure detail');const request={result:database,transaction:{abort:()=>{aborts++;}}};
  if(!options.neverOpen)queueMicrotask(()=>{if(options.blocked){request.onblocked?.();queueMicrotask(()=>request.onsuccess?.());return;}if(!created)request.onupgradeneeded?.();request.onsuccess?.();});return request;
 }};
 return {indexedDB,records,pendingCommits,counts:()=>({opens,closes,mutations,aborts})};
}
class FakeAudio extends EventTarget{
 constructor(play=()=>Promise.resolve()){super();this.hidden=true;this.controls=false;this.src='';this.playCalls=0;this.pauseCalls=0;this.loadCalls=0;this.playResult=play;}
 play(){this.playCalls++;return this.playResult();}
 pause(){this.pauseCalls++;}
 load(){this.loadCalls++;}
 removeAttribute(name){assert.equal(name,'src');this.src='';}
}
function fakeURL(){const created=[],revoked=[];return {created,revoked,createObjectURL(blob){assert(blob instanceof Blob);const value='blob:fictional-'+(created.length+1);created.push({value,blob});return value;},revokeObjectURL(value){revoked.push(value);}};}
function record(id='talarico'){
 const f=file();return {schema:'browser-local-celebration-audio-v1',id,name:f.name,type:f.type,bytes:f.size,saved_at:'2026-10-28T23:00:00.000Z',blob:f.slice()};
}
(async()=>{
 assert.deepEqual(new Set(local.IDS),new Set(Object.keys(require('./election_night_celebration_player.js').STORIES)),'Only the exact eleven existing event identities can store files');
 assert.equal(local.MAX_FILE_BYTES,16*1024*1024);assert.match(local.ACCEPT,/\.mp3/);
 assert.equal(local.validate(file()).status,'VALID');assert.equal(local.validate(file('LOCAL.WAV','audio/x-wav')).status,'VALID');
 assert.equal(local.validate(file('silent-type.m4a','')).type,'audio/mp4','Recognized extension can supply a missing browser MIME label');
 for(const [value,status]of [[null,'INVALID_FILENAME'],[file('../escape.mp3'),'INVALID_FILENAME'],[file('bad\u202E.mp3'),'INVALID_FILENAME'],[file('not-a-song.html','text/html'),'UNSUPPORTED_FILE'],[file('wrong.mp3','text/html'),'UNSUPPORTED_FILE'],[file('zero.mp3','audio/mpeg',new Uint8Array()),'FILE_MISSING'],[file('huge.mp3','audio/mpeg',new Uint8Array(local.MAX_FILE_BYTES+1)),'FILE_TOO_LARGE']])assert.equal(local.validate(value).status,status);
 const database=fakeIDB(),store=local.createStore({indexedDB:database.indexedDB}),audio=new FakeAudio(),url=fakeURL(),statuses=[];
 const player=local.create({audio,store,url,onStatus:value=>statuses.push(value),now:()=>Date.parse('2026-10-28T23:00:00Z')});
 assert.equal((await player.save('not-an-event',file())).status,'INVALID_EVENT');assert.equal(database.counts().opens,0,'Invalid events never open or mutate storage');
 assert.deepEqual(await player.play('not-an-event'),{status:'INVALID_EVENT',id:'not-an-event',fallback:false},'An unknown event cannot request a generic fallback soundtrack');assert.equal(database.counts().opens,0);
 assert.equal((await player.save('talarico',file())).status,'SAVED');
 assert.equal(audio.playCalls,0,'Import never starts playback');assert.equal(url.created.length,0,'Import never creates a media URL');
 assert.deepEqual(Buffer.from(await database.records.get('talarico').blob.arrayBuffer()),Buffer.from(bytes),'Stored Blob bytes are unchanged');
 const selected=await player.info('talarico');assert.equal(selected.status,'FOUND');assert.equal(selected.metadata.name,'fictional.mp3');assert(!('record'in selected)&&!('blob'in selected.metadata),'UI info never exposes the stored Blob');
 const reopened=local.create({audio:new FakeAudio(),store:local.createStore({indexedDB:database.indexedDB}),url:fakeURL()});assert.equal((await reopened.info('talarico')).status,'FOUND','A new component/profile load can read the committed per-browser file');reopened.close();
 const started=await player.play('talarico');assert.equal(started.status,'PLAYING');assert.equal(started.fallback,false);assert.equal(audio.hidden,false);assert.equal(audio.controls,true);assert.match(audio.src,/^blob:/);
 audio.dispatchEvent(new Event('pause'));assert.equal(player.state().phase,'paused');audio.dispatchEvent(new Event('playing'));assert.equal(player.state().phase,'playing');audio.dispatchEvent(new Event('ended'));assert.equal(player.state().phase,'ended');
 assert.equal(url.revoked.length,0,'Native controls keep the local file available for replay after its end');
 player.stop();assert.equal(audio.hidden,true);assert.equal(audio.src,'');assert.deepEqual(url.revoked,['blob:fictional-1']);assert.equal(player.state().hasObjectURL,false);
 const statusCount=statuses.length;audio.dispatchEvent(new Event('playing'));assert.equal(statuses.length,statusCount,'Stopped native events cannot revive or relabel playback');
 assert.equal((await player.play('abbott')).status,'MISSING');assert.equal((await player.play('abbott')).fallback,true);assert.equal(url.created.length,1,'Missing selection creates no player');
 database.records.set('abbott',{...record('abbott'),bytes:999});assert.equal((await player.play('abbott')).status,'INVALID_STORED_FILE');assert.equal(url.created.length,1,'Corrupted metadata cannot mount a stored file');
 assert.equal((await player.remove('abbott')).status,'REMOVED');
 await player.play('talarico');assert.equal((await player.remove('talarico')).status,'REMOVED');assert.equal(audio.hidden,true);assert.equal((await player.info('talarico')).status,'MISSING');
 assert.equal((await player.info('tsunami')).status,'MISSING','One event never borrows another event soundtrack');
 // Storage success is acknowledged only after commit, and a late quota abort
 // cannot falsely label a selected file as saved.
 const delayed=fakeIDB({deferCommit:true}),committing=local.createStore({indexedDB:delayed.indexedDB});let complete=false;
 const write=committing.put(record()).then(()=>{complete=true;});await tick();assert.equal(complete,false);assert.equal(delayed.records.size,0);delayed.pendingCommits.shift()();await write;assert.equal(complete,true);assert.equal(delayed.records.size,1);committing.close();
 const quota=fakeIDB({lateAbort:true}),quotaPlayer=local.create({store:local.createStore({indexedDB:quota.indexedDB})});assert.equal((await quotaPlayer.save('talarico',file())).status,'STORAGE_UNAVAILABLE');assert.equal(quota.records.size,0);quotaPlayer.close();
 const blocked=fakeIDB({blocked:true}),blockedStore=local.createStore({indexedDB:blocked.indexedDB});await assert.rejects(blockedStore.get('talarico'));await tick();assert(blocked.counts().closes>=1,'An opened connection arriving after blocked failure is closed');blockedStore.close();
 const timers=[],never=fakeIDB({neverOpen:true}),timeoutStore=local.createStore({indexedDB:never.indexedDB,setTimer:fn=>{const token={fn};timers.push(token);return token;},clearTimer:token=>{token.cleared=true;}}),timeoutRead=timeoutStore.get('talarico');
 timers[0].fn();await assert.rejects(timeoutRead,/LOCAL_STORAGE_UNAVAILABLE/);timeoutStore.close();
 const unavailable=local.create({audio:new FakeAudio(),store:{get:()=>Promise.reject(Error('private failure detail'))},url:fakeURL()});assert.deepEqual(await unavailable.play('talarico'),{status:'STORAGE_UNAVAILABLE',id:'talarico',fallback:true});unavailable.close();
 const priorIndexedDB=Object.getOwnPropertyDescriptor(globalThis,'indexedDB');
 try{Object.defineProperty(globalThis,'indexedDB',{configurable:true,get(){throw Error('access denied');}});const denied=local.createStore();await assert.rejects(denied.get('talarico'),/LOCAL_STORAGE_UNAVAILABLE/);denied.close();}
 finally{if(priorIndexedDB)Object.defineProperty(globalThis,'indexedDB',priorIndexedDB);else delete globalThis.indexedDB;}
 // Close, mute, retraction and replacement all invalidate the same outstanding
 // async-read generation before it can assign a source or request playback.
 for(const reason of ['close','mute','retraction']){
  const waiting=deferred(),a=new FakeAudio(),u=fakeURL(),p=local.create({audio:a,url:u,store:{get:()=>waiting.promise}}),result=p.play('talarico');
  p.stop();waiting.resolve(record());assert.equal((await result).status,'CANCELLED',reason);assert.equal(a.playCalls,0);assert.equal(u.created.length,0);assert.equal(a.hidden,true);
 }
 const first=deferred(),second=deferred(),replaceAudio=new FakeAudio(),replaceURL=fakeURL(),replacement=local.create({audio:replaceAudio,url:replaceURL,store:{get:id=>id==='talarico'?first.promise:second.promise}});
 const oldRead=replacement.play('talarico'),newRead=replacement.play('abbott');first.resolve(record());assert.equal((await oldRead).status,'CANCELLED');second.resolve(record('abbott'));assert.equal((await newRead).status,'PLAYING');assert.equal(replacement.state().eventId,'abbott');assert.equal(replaceAudio.playCalls,1);replacement.stop();
 const obsoletePlay=deferred(),raceAudio=new FakeAudio(()=>raceAudio.playCalls===1?obsoletePlay.promise:Promise.resolve()),raceURL=fakeURL(),racing=local.create({audio:raceAudio,url:raceURL,store:{get:id=>Promise.resolve(record(id))}});
 const late=racing.play('talarico');await tick();assert.equal(raceAudio.playCalls,1);racing.stop();const current=await racing.play('abbott');assert.equal(current.status,'PLAYING');obsoletePlay.reject(Error('old abort'));assert.equal((await late).status,'CANCELLED');assert.equal(racing.state().eventId,'abbott');assert.equal(raceAudio.src,'blob:fictional-2');assert.deepEqual(raceURL.revoked,['blob:fictional-1'],'An obsolete play result cannot revoke the new event URL');racing.stop();
 // A play rejection leaves an explicit native Play available, never instructs
 // the caller to overlap a procedural original cue, and still obeys teardown.
 const blockedAudio=new FakeAudio(()=>Promise.reject(Error('autoplay blocked'))),blockedURL=fakeURL(),manual=local.create({audio:blockedAudio,url:blockedURL,store:{get:id=>Promise.resolve(record(id))}});
 const rejected=await manual.play('talarico');assert.equal(rejected.status,'PRESS_PLAY');assert.equal(rejected.fallback,false);assert.equal(blockedAudio.hidden,false);assert.equal(blockedAudio.controls,true);assert.equal(blockedURL.revoked.length,0);blockedAudio.dispatchEvent(new Event('playing'));assert.equal(manual.state().phase,'playing');manual.stop();assert.equal(blockedURL.revoked.length,1);
 // Actual native media failures must not be overwritten by autoplay advice,
 // whether the error event arrives before or after the play promise rejects.
 for(const kind of ['error-event-first','native-error-only','unsupported-promise']){
  const events=[],u=fakeURL(),a=new FakeAudio(()=>{
   if(kind!=='unsupported-promise')a.error={code:4};
   if(kind==='error-event-first')a.dispatchEvent(new Event('error'));
   const error=Error('unsupported recording');error.name='NotSupportedError';return Promise.reject(error);
  }),p=local.create({audio:a,url:u,store:{get:id=>Promise.resolve(record(id))},onStatus:s=>events.push(s.status)});
  const result=await p.play('talarico');assert.equal(result.status,'FILE_PLAYBACK_ERROR',kind);assert.equal(result.fallback,false);assert.equal(p.state().phase,'error');assert.equal(a.hidden,false);assert.equal(a.controls,true);assert.equal(u.revoked.length,0);
  a.dispatchEvent(new Event('pause'));a.dispatchEvent(new Event('ended'));
  if(a.error)a.dispatchEvent(new Event('playing'));
  assert.equal(p.state().phase,'error','Later native events cannot erase the file error');
  assert.deepEqual(events,['LOADING','FILE_PLAYBACK_ERROR'],'One accurate failure message; no Press Play or overlapping fallback');p.stop();assert.equal(u.revoked.length,1);
 }
 const permissionAudio=new FakeAudio(()=>{const error=Error('user gesture required');error.name='NotAllowedError';return Promise.reject(error);}),permissionPlayer=local.create({audio:permissionAudio,url:fakeURL(),store:{get:id=>Promise.resolve(record(id))}});
 assert.equal((await permissionPlayer.play('talarico')).status,'PRESS_PLAY','A real autoplay permission rejection still offers native Play');permissionPlayer.close();
 let valid=true;const held=deferred(),validAudio=new FakeAudio(),guarded=local.create({audio:validAudio,url:fakeURL(),store:{get:()=>held.promise}}),guardedRead=guarded.play('talarico',{valid:()=>valid});valid=false;held.resolve(record());assert.equal((await guardedRead).status,'CANCELLED');assert.equal(validAudio.playCalls,0);
 player.close();
 console.log('Private local celebration audio PASS: unchanged Blob bytes/committed persistence, exact event/type/size bounds, storage failure, stale-read/play cancellation, native Play recovery and complete URL teardown. Fictional bytes; no network, recording or human listening claim.');
})().catch(error=>{console.error(error);process.exitCode=1;});
