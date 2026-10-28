/* Private browser-local soundtrack files. No fetch, upload or remote URL.
   Stored Blob bytes are preserved; browser storage is not a backup/sync promise. */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.ElectionNightCelebrationLocal=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const IDS=Object.freeze(['graham','blexas','blue_corn','blansas','maine','nebraska','ohio','talarico','abbott','mississippi','tsunami']);
 const ID_SET=new Set(IDS),MAX_FILE_BYTES=16*1024*1024,DB_NAME='bluewaves_celebration_audio_v1',STORE='tracks',SCHEMA='browser-local-celebration-audio-v1';
 const TYPES=Object.freeze({mp3:['audio/mpeg','audio/mp3'],wav:['audio/wav','audio/x-wav','audio/wave','audio/vnd.wave'],m4a:['audio/mp4','audio/x-m4a'],mp4:['audio/mp4'],aac:['audio/aac','audio/x-aac'],ogg:['audio/ogg','application/ogg'],oga:['audio/ogg','application/ogg'],opus:['audio/ogg','audio/opus'],flac:['audio/flac','audio/x-flac'],webm:['audio/webm']});
 const ACCEPT='audio/*,'+Object.keys(TYPES).map(ext=>'.'+ext).join(',');
 const isBlob=value=>{try{globalThis.Blob.prototype.slice.call(value,0,0);return true;}catch{return false;}};
 function inspect(name,blob){
  if(typeof name!=='string'||name.length<1||name.length>160||!name.trim()||name==='.'||name==='..'||/[\\/\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(name))return {status:'INVALID_FILENAME'};
  if(!isBlob(blob)||!Number.isInteger(blob.size)||blob.size<=0)return {status:'FILE_MISSING'};
  if(blob.size>MAX_FILE_BYTES)return {status:'FILE_TOO_LARGE'};
  const extension=/^.+\.([a-z0-9]+)$/i.exec(name)?.[1].toLowerCase(),allowed=TYPES[extension],type=typeof blob.type==='string'?blob.type.toLowerCase():'';
  if(!allowed||(type&&!allowed.includes(type)))return {status:'UNSUPPORTED_FILE'};
  return {status:'VALID',name,type:type||allowed[0],bytes:blob.size};
 }
 function validate(file){try{return inspect(file?.name,file);}catch{return {status:'FILE_MISSING'};}}
 // Wait for transaction COMMIT, not just a request's success. Late/quota aborts
 // must never be reported as saved. A blocked store is a bounded fallback.
 function createStore({indexedDB,setTimer=setTimeout,clearTimer=clearTimeout,timeoutMs=5000}={}){
  if(indexedDB===undefined){try{indexedDB=globalThis.indexedDB;}catch{indexedDB=null;}}
  let connection=null,pending=null,generation=0;
  function open(){
   if(connection)return Promise.resolve(connection);
   if(pending)return pending;
   const openingGeneration=generation;
   pending=new Promise((resolve,reject)=>{
    let request,settled=false;
    const done=(error,value)=>{if(settled)return;settled=true;clearTimer(timer);error?reject(Error('LOCAL_STORAGE_UNAVAILABLE')):resolve(value);};
    const timer=setTimer(()=>done(true),timeoutMs);
    try{
     if(!indexedDB?.open)throw Error('Unavailable');
     request=indexedDB.open(DB_NAME,1);
     request.onerror=()=>done(true);request.onblocked=()=>done(true);
     request.onupgradeneeded=()=>{
      if(settled||openingGeneration!==generation){try{request.transaction.abort();}catch{}return;}
      try{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE,{keyPath:'id'});}catch{try{request.transaction.abort();}catch{}done(true);}
     };
     request.onsuccess=()=>{
      const database=request.result;
      if(settled||openingGeneration!==generation){try{database.close();}catch{}done(true);return;}
      connection=database;database.onversionchange=()=>{try{database.close();}catch{}if(connection===database){connection=null;pending=null;}};
      done(false,database);
     };
    }catch{done(true);}
   });
   const current=pending;pending.catch(()=>{if(pending===current)pending=null;});
   return pending;
  }
  async function transact(mode,operation){
   const database=await open();
   return new Promise((resolve,reject)=>{
    let transaction,request,value,settled=false;
    const done=(error)=>{if(settled)return;settled=true;clearTimer(timer);error?reject(Error('LOCAL_STORAGE_UNAVAILABLE')):resolve(value);};
    const timer=setTimer(()=>{try{transaction?.abort();}catch{}done(true);},timeoutMs);
    try{
     transaction=database.transaction(STORE,mode);
     transaction.oncomplete=()=>done(false);transaction.onabort=()=>done(true);transaction.onerror=()=>done(true);
     request=operation(transaction.objectStore(STORE));
     request.onsuccess=()=>{value=request.result;};request.onerror=()=>done(true);
    }catch{try{transaction?.abort();}catch{}done(true);}
   });
  }
  return Object.freeze({get:id=>transact('readonly',store=>store.get(id)),put:record=>transact('readwrite',store=>store.put(record)),delete:id=>transact('readwrite',store=>store.delete(id)),close(){generation++;try{connection?.close();}catch{}connection=null;pending=null;}});
 }
 const metadata=record=>({name:record.name,type:record.type,bytes:record.bytes,saved_at:record.saved_at});
 function validRecord(record,id){
  if(record?.schema!==SCHEMA||record.id!==id||typeof record.saved_at!=='string'||!Number.isFinite(Date.parse(record.saved_at))||!record.saved_at.endsWith('Z'))return false;
  const checked=inspect(record.name,record.blob);
  return checked.status==='VALID'&&checked.type===record.type&&checked.bytes===record.bytes;
 }
 function create({audio=null,onStatus=()=>{},store=createStore(),url=globalThis.URL,now=Date.now}={}){
  let epoch=0,activeUrl=null,eventId=null,phase='idle',activeMetadata=null,listeners=[];
  const emit=(status,id,extra={})=>{const state={status,id,...extra};try{onStatus(state);}catch{}return state;};
  function stop(){
   epoch++;for(const [type,handler]of listeners){try{audio?.removeEventListener(type,handler);}catch{}}listeners=[];
   try{audio?.pause();}catch{}
   try{audio?.removeAttribute('src');audio?.load();}catch{}
   if(audio)audio.hidden=true;
   if(activeUrl){try{url?.revokeObjectURL(activeUrl);}catch{}}activeUrl=null;eventId=null;activeMetadata=null;phase='idle';
  }
  async function read(id){
   if(!ID_SET.has(id))return {status:'INVALID_EVENT',id};
   try{const record=await store.get(id);if(!record)return {status:'MISSING',id};if(!validRecord(record,id))return {status:'INVALID_STORED_FILE',id};return {status:'FOUND',id,record};}
   catch{return {status:'STORAGE_UNAVAILABLE',id};}
  }
  async function info(id){const value=await read(id);return value.record?{status:'FOUND',id,metadata:metadata(value.record)}:value;}
  async function save(id,file){
   if(!ID_SET.has(id))return {status:'INVALID_EVENT',id};
   const checked=validate(file);if(checked.status!=='VALID')return {status:checked.status,id};
   try{
    const record={schema:SCHEMA,id,name:checked.name,type:checked.type,bytes:checked.bytes,saved_at:new Date(now()).toISOString(),blob:file.slice(0,file.size,checked.type)};
    await store.put(record);return {status:'SAVED',id,metadata:metadata(record)};
   }catch{return {status:'STORAGE_UNAVAILABLE',id};}
  }
  async function remove(id){
   if(!ID_SET.has(id))return {status:'INVALID_EVENT',id};
   if(eventId===id)stop();
   try{await store.delete(id);return {status:'REMOVED',id};}catch{return {status:'STORAGE_UNAVAILABLE',id};}
  }
  async function play(id,{valid=()=>true}={}){
   stop();const current=epoch;eventId=id;phase='loading';
   const active=()=>{try{return epoch===current&&valid()===true;}catch{return false;}},cancelled=()=>({status:'CANCELLED',id,fallback:false});
   if(!ID_SET.has(id)){eventId=null;phase='idle';return {status:'INVALID_EVENT',id,fallback:false};}
   if(!active()){if(epoch===current)stop();return cancelled();}
   emit('LOADING',id);
   const value=await read(id);
   if(!active()){if(epoch===current)stop();return cancelled();}
   if(!value.record){eventId=null;phase='idle';return emit(value.status,id,{fallback:true});}
   const details=metadata(value.record);activeMetadata=details;
   try{
    if(!audio||typeof audio.play!=='function'||typeof url?.createObjectURL!=='function')throw Error('Unavailable');
    activeUrl=url.createObjectURL(value.record.blob);
    if(typeof activeUrl!=='string'||!activeUrl.startsWith('blob:'))throw Error('Local URL unavailable');
    audio.controls=true;audio.preload='auto';audio.src=activeUrl;audio.hidden=false;phase='ready';
    for(const [type,status,nextPhase]of [['playing','PLAYING','playing'],['pause','PAUSED','paused'],['ended','ENDED','ended'],['error','FILE_PLAYBACK_ERROR','error']]){
     const handler=()=>{if(epoch!==current)return;if(!active()){stop();return;}phase=nextPhase;emit(status,id,{fallback:false,metadata:details});};
     if(audio.addEventListener){audio.addEventListener(type,handler);listeners.push([type,handler]);}
    }
   }catch{stop();return emit('PLAYBACK_UNAVAILABLE',id,{fallback:true});}
   try{
    await audio.play();
    if(!active()){if(epoch===current)stop();return cancelled();}
    phase='playing';return emit('PLAYING',id,{fallback:false,metadata:details});
   }catch{
    if(!active()){if(epoch===current)stop();return cancelled();}
    // A rejected play promise is not permission to overlap an original score.
    // Keep native controls and this Blob URL available for an explicit Play.
    phase='ready';return emit('PRESS_PLAY',id,{fallback:false,metadata:details});
   }
  }
  return Object.freeze({save,info,remove,play,stop,state:()=>({eventId,phase,hasObjectURL:Boolean(activeUrl),metadata:activeMetadata?{...activeMetadata}:null}),close(){stop();try{store.close?.();}catch{}}});
 }
 return Object.freeze({IDS,MAX_FILE_BYTES,ACCEPT,validate,createStore,create});
});
