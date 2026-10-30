'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const pack=require('./election_night_celebration_pack.js');
const names=[
 ['1-Ohio-State-University-Buckeye-Battle-Cry.mp3','ohio'],
 ['2-Donna-Summer-Last-Dance-Original-Video-1978-.mp3','graham'],
 ['4-John-Brown-s-Body-American-Abolitionist-Song.mp3','blansas'],
 ['5-It-s-Corn-Songify-This-ft.-Tariq-and-Recess-Therapy.mp3','blue_corn'],
 ['6-The-Eyes-of-Texas.mp3','talarico'],
 ['3-Union-Dixie-Trap-Remix.mp3','mississippi'],
 ['8-Ding-Dong-the-Witch-is-Dead.mp3','maine'],
 ['1-Neck-in-LSU-s-Death-Valley.mp3','louisiana_senate'],
 ['1-Queen-We-Are-The-Champions-Official-Video-Remastered-.mp3','blexas'],
 ['2-RUN-DMC-Walk-This-Way-Official-HD-Video-ft.-Aerosmith.mp3','abbott']
];
let groups=0;function test(label,run){run();groups++;}
function file(name){return {name};}
function invalid(input,reason){const r=pack.plan(input);assert.equal(r.status,'INVALID_PACK');assert.equal(r.reason,reason);assert.deepEqual(r.entries,[]);return r;}
test('Ten exact owner filenames map in selected order and preserve file references',()=>{
 const files=names.map(([name])=>file(name)),r=pack.plan(files);
 assert.equal(r.status,'READY');assert.deepEqual(r.entries.map(e=>e.id),names.map(([,id])=>id));
 assert.equal(r.skipped,0);assert.equal(r.duplicates,0);
 r.entries.forEach((entry,i)=>assert.equal(entry.file,files[i]));
});
test('Optional one numeric attachment prefix only; bare exact basenames supported',()=>{
 for(const [name,id]of names){const bare=name.replace(/^[0-9]+-/,'');assert.equal(pack.plan([file(bare)]).entries[0].id,id);assert.equal(pack.plan([file('002-'+bare)]).entries[0].id,id);}
 invalid([file('2-1-Ohio-State-University-Buckeye-Battle-Cry.mp3')],'NO_MATCHED_FILES');
});
test('Buckeye suffix2 maps to Ohio and duplicate IDs keep first without comparing bytes',()=>{
 const first=file(names[0][0]),second=file('7-Ohio-State-University-Buckeye-Battle-Cry-2.mp3');
 const r=pack.plan([first,second]);assert.equal(r.status,'READY');assert.equal(r.entries.length,1);assert.equal(r.entries[0].id,'ohio');assert.equal(r.entries[0].file,first);assert.equal(r.skipped,1);assert.equal(r.duplicates,1);
 assert.equal(pack.plan([second,first]).entries[0].file,second);assert.equal(pack.plan([file('Ohio-State-University-Buckeye-Battle-Cry-2.mp3')]).entries[0].id,'ohio');
});
test('Repeated same object is counted truthfully as a duplicate selection',()=>{const f=file(names[0][0]),r=pack.plan([f,f,f]);assert.equal(r.entries.length,1);assert.equal(r.skipped,2);assert.equal(r.duplicates,2);});
test('Arraylike FileList shape is supported without requiring iteration',()=>{const a=file(names[0][0]),b=file(names[1][0]),list={0:a,1:b,length:2,item(i){return this[i];}};assert.deepEqual(pack.plan(list).entries.map(e=>e.file),[a,b]);});
test('Empty or absent inputs are invalid',()=>{invalid([],'EMPTY_PACK');for(const value of [null,undefined,'',names[0][0],()=>{}])invalid(value,'INVALID_FILE_LIST');});
test('Length is bounded before indexing',()=>{for(const length of [-1,1.1,NaN,Infinity,'7',undefined])invalid({length},'INVALID_FILE_LIST');invalid(new Array(17),'TOO_MANY_FILES');let read=0;const list={length:17,get 0(){read++;throw Error('unreachable');}};invalid(list,'TOO_MANY_FILES');assert.equal(read,0);});
test('Exactly16 selected files are permitted with duplicate accounting',()=>{const first=file(names[0][0]),r=pack.plan(Array(16).fill(first));assert.equal(r.status,'READY');assert.equal(r.entries.length,1);assert.equal(r.duplicates,15);assert.equal(r.skipped,15);});
test('Unknown filenames skip while any known match remains ready',()=>{const r=pack.plan([file('unknown.mp3'),file(names[3][0]),file('anything.wav')]);assert.equal(r.status,'READY');assert.equal(r.entries[0].id,'blue_corn');assert.equal(r.skipped,2);assert.equal(r.duplicates,0);});
test('No exact matches invalidates pack; titles, cases, extensions and keywords never guessed',()=>{for(const name of ['John Browns Body.mp3','Ohio-State-University-Buckeye-Battle-Cry.MP3','ohio-state-university-buckeye-battle-cry.mp3','Union-Dixie-Trap-Remix.wav','Buckeye.mp3','constructor','__proto__','toString']){const r=invalid([file(name)],'NO_MATCHED_FILES');assert.equal(r.skipped,1);assert.equal(r.duplicates,0);}});
test('Missing or nonstring names fail closed, including sparse FileLists',()=>{for(const value of [{},null,{},file(42),file(''),{name:null},'file'])invalid([file(names[0][0]),value],'INVALID_FILENAME');invalid({length:1},'INVALID_FILENAME');});
test('Paths and control or bidi filenames invalidate the entire plan before matching',()=>{for(const name of ['folder/'+names[0][0],'folder\\'+names[0][0],'C:'+names[0][0],names[0][0]+'\n',names[0][0]+'\u0000',names[0][0]+'\u007f',names[0][0]+'\u0085',names[0][0]+'\u202e',names[0][0]+'\u2066']){const r=invalid([file(names[1][0]),file(name)],'INVALID_FILENAME');assert.equal(r.skipped,0);assert.equal(r.duplicates,0);}});
test('Long names fail closed before matching; safe160-character unknown only skips',()=>{invalid([file('x'.repeat(161))],'INVALID_FILENAME');const r=invalid([file('x'.repeat(160))],'NO_MATCHED_FILES');assert.equal(r.skipped,1);});
test('Throwing list/name getters return invalid rather than a partial plan',()=>{invalid({get length(){throw Error('no');}},'INVALID_FILE_LIST');invalid({length:1,get 0(){throw Error('no');}},'INVALID_FILENAME');invalid([file(names[0][0]),{get name(){throw Error('no');}}],'INVALID_FILENAME');});
test('Result containers are frozen but selected File/Blob and input list are untouched',()=>{
 const f=file(names[0][0]),files=[f],before=Object.getOwnPropertyDescriptors(f),r=pack.plan(files);
 assert(Object.isFrozen(r));assert(Object.isFrozen(r.entries));assert(Object.isFrozen(r.entries[0]));assert(!Object.isFrozen(f));assert(!Object.isFrozen(files));assert.deepEqual(Object.getOwnPropertyDescriptors(f),before);assert.equal(r.entries[0].file,f);assert.throws(()=>{r.entries.push({});},TypeError);assert.throws(()=>{r.entries[0].id='abbott';},TypeError);
 const blob=new Blob(['fictional audio']);Object.defineProperty(blob,'name',{value:names[1][0],configurable:true});assert.equal(pack.plan([blob]).entries[0].file,blob);assert(!Object.isFrozen(blob));
});
test('Planner reads only filename once, never bytes/size/type/storage/URL or playback',()=>{let nameReads=0;const f={get name(){nameReads++;return names[0][0];}};for(const key of ['size','type','arrayBuffer','stream','text','slice','play'])Object.defineProperty(f,key,{get(){throw Error('not allowed '+key);}});assert.equal(pack.plan([f]).entries[0].file,f);assert.equal(nameReads,1);});
test('CJS and browser UMD expose only the frozen planner',()=>{assert.deepEqual(Object.keys(pack),['plan']);assert(Object.isFrozen(pack));const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'election_night_celebration_pack.js'),'utf8'),sandbox);assert.deepEqual(Object.keys(sandbox.window.ElectionNightCelebrationPack),['plan']);assert(Object.isFrozen(sandbox.window.ElectionNightCelebrationPack));assert.equal(sandbox.window.ElectionNightCelebrationPack.plan([file(names[0][0])]).entries[0].id,'ohio');});
test('Exact original owner labels map without slug or keyword guessing',()=>{
 const originals=[['Ohio State University, Buckeye Battle Cry.mp3','ohio'],['Ohio State University, Buckeye Battle Cry 2.mp3','ohio'],['Donna Summer - Last Dance [Original Video] (1978).mp3','graham'],['Union Dixie Trap Remix.mp3','mississippi'],["John Brown's Body - American Abolitionist Song.mp3",'blansas'],["It's Corn - Songify This ft. Tariq and Recess Therapy.mp3",'blue_corn'],['The Eyes of Texas.mp3','talarico'],['Ding Dong the Witch is Dead.mp3','maine'],["Neck in LSU's Death Valley.mp3",'louisiana_senate'],['Queen - We Are The Champions (Official Video Remastered).mp3','blexas'],['RUN DMC - Walk This Way (Official HD Video) ft. Aerosmith.mp3','abbott']];
 for(const [name,id]of originals){assert.equal(pack.plan([file(name)]).entries[0].id,id);assert.equal(pack.plan([file('4-'+name)]).entries[0].id,id);}
 invalid([file('Donna Summer Last Dance.mp3')],'NO_MATCHED_FILES');
});
test('Mixed original and attachment aliases keep first event file truthfully',()=>{const first=file('Ohio State University, Buckeye Battle Cry 2.mp3'),r=pack.plan([first,...names.map(([name])=>file(name)),file('The Eyes of Texas.mp3')]);assert.equal(r.status,'READY');assert.equal(r.entries.length,10);assert.equal(r.entries[0].file,first);assert.equal(r.entries[0].id,'ohio');assert.equal(r.skipped,2);assert.equal(r.duplicates,2);});
test('Unassigned Crawdad alternate never overwrites the chosen Louisiana track or guesses Florida',()=>{const alternate=file('2-The-Crawdad-Song-Foggy-Mountain-Boys.mp3'),r=pack.plan([alternate,...names.map(([name])=>file(name))]);assert.equal(r.status,'READY');assert.equal(r.entries.length,10);assert.equal(r.skipped,1);assert.equal(r.duplicates,0);assert.equal(r.entries.find(e=>e.id==='louisiana_senate').file.name,names[7][0]);assert(!r.entries.some(e=>e.id==='florida_senate'));invalid([alternate],'NO_MATCHED_FILES');});
console.log(`Private song-pack planner PASS ${groups} groups: ten exact mappings, bounded explicit FileList, duplicate-first/unknown-skip, unassigned alternate exclusion, malformed-name rejection, unchanged Blob references and no contents/network/storage/playback.`);
