/* Plan only the owner's explicitly selected song pack. No file contents,
 * network, storage, playback, directory scanning or recording-rights claim. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.ElectionNightCelebrationPack=api;})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const MAX_FILES=16;
 const NAMES=new Map([
  ['Ohio-State-University-Buckeye-Battle-Cry.mp3','ohio'],
  ['Ohio-State-University-Buckeye-Battle-Cry-2.mp3','ohio'],
  ['Ohio State University, Buckeye Battle Cry.mp3','ohio'],
  ['Ohio State University, Buckeye Battle Cry 2.mp3','ohio'],
  ['Donna-Summer-Last-Dance-Original-Video-1978-.mp3','graham'],
  ['Donna Summer - Last Dance [Original Video] (1978).mp3','graham'],
  ['John-Brown-s-Body-American-Abolitionist-Song.mp3','blansas'],
  ["John Brown's Body - American Abolitionist Song.mp3",'blansas'],
  ['It-s-Corn-Songify-This-ft.-Tariq-and-Recess-Therapy.mp3','blue_corn'],
  ["It's Corn - Songify This ft. Tariq and Recess Therapy.mp3",'blue_corn'],
  ['The-Eyes-of-Texas.mp3','talarico'],
  ['The Eyes of Texas.mp3','talarico'],
  ['Union-Dixie-Trap-Remix.mp3','mississippi'],
  ['Union Dixie Trap Remix.mp3','mississippi'],
  ['Ding-Dong-the-Witch-is-Dead.mp3','maine'],
  ['Ding Dong the Witch is Dead.mp3','maine'],
  ['Neck-in-LSU-s-Death-Valley.mp3','louisiana_senate'],
  ["Neck in LSU's Death Valley.mp3",'louisiana_senate'],
  ['Queen-We-Are-The-Champions-Official-Video-Remastered-.mp3','blexas'],
  ['Queen - We Are The Champions (Official Video Remastered).mp3','blexas'],
  ['RUN-DMC-Walk-This-Way-Official-HD-Video-ft.-Aerosmith.mp3','abbott'],
  ['RUN DMC - Walk This Way (Official HD Video) ft. Aerosmith.mp3','abbott']
 ]);
 function result(status,entries,skipped,duplicates,reason){
  return Object.freeze({status,entries:Object.freeze(entries.map(entry=>Object.freeze(entry))),skipped,duplicates,reason});
 }
 function invalid(reason){return result('INVALID_PACK',[],0,0,reason);}
 function plan(files){
  if(!files||typeof files!=='object')return invalid('INVALID_FILE_LIST');
  let length;try{length=files.length;}catch(_){return invalid('INVALID_FILE_LIST');}
  if(!Number.isSafeInteger(length)||length<0)return invalid('INVALID_FILE_LIST');
  if(length===0)return invalid('EMPTY_PACK');
  if(length>MAX_FILES)return invalid('TOO_MANY_FILES');
  // Validate every selected name before matching any entry. An invalid member
  // invalidates the whole plan; callers must validate matched audio before save.
  const selected=[];
  for(let index=0;index<length;index++){
   let file,name;try{file=files[index];name=file&&file.name;}catch(_){return invalid('INVALID_FILENAME');}
   if(!file||typeof file!=='object'||typeof name!=='string'||name.length===0||name.length>160||/[\\/:\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(name))return invalid('INVALID_FILENAME');
   selected.push({file,name});
  }
  const entries=[],seen=new Set();let skipped=0,duplicates=0;
  for(const {file,name}of selected){
   const id=NAMES.get(name.replace(/^[0-9]+-/,''));
   if(!id){skipped++;continue;}
   // A duplicate celebration keeps the first file. This does not compare or
   // make any claim about the two recordings' contents or byte identity.
   if(seen.has(id)){skipped++;duplicates++;continue;}
   seen.add(id);entries.push({id,file});
  }
  return entries.length?result('READY',entries,skipped,duplicates,'MATCHED_FILES'):result('INVALID_PACK',[],skipped,duplicates,'NO_MATCHED_FILES');
 }
 return Object.freeze({plan});
});
