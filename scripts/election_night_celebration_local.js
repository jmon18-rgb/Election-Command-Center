/* Private browser-local overrides and optional exact site-bundled recordings.
   Stored Blob bytes stay local; native audio alone loads an active built-in URL. */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.ElectionNightCelebrationLocal=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const IDS=Object.freeze(['graham','blexas','blue_corn','blansas','maine','nebraska','ohio','talarico','abbott','mississippi','michigan','tsunami','florida_senate','louisiana_senate']);
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
 function create({audio=null,onStatus=()=>{},store=createStore(),url=globalThis.URL,now=Date.now,builtIns=null}={}){
  let epoch=0,activeUrl=null,eventId=null,phase='idle',activeMetadata=null,activeSource=null,listeners=[];
  const emit=(status,id,extra={})=>{const state={status,id,...extra};try{onStatus(state);}catch{}return state;};
  function stop(){
   epoch++;for(const [type,handler]of listeners){try{audio?.removeEventListener(type,handler);}catch{}}listeners=[];
   try{audio?.pause();}catch{}
   try{audio?.removeAttribute('src');audio?.load();}catch{}
   if(audio)audio.hidden=true;
   if(activeUrl){try{url?.revokeObjectURL(activeUrl);}catch{}}activeUrl=null;eventId=null;activeMetadata=null;activeSource=null;phase='idle';
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
  // A resolver can supply only this event's content-addressed site MP3. Own its
  // small projection before the storage await; never retain caller properties.
  function builtIn(id){
   try{
    if(typeof builtIns!=='function')return null;
    const value=builtIns(id);if(!value||typeof value!=='object'||Array.isArray(value))return null;
    const keys=['schema','id','title','src','type','bytes','sha256'];
    if(Object.keys(value).length!==keys.length||!keys.every(key=>Object.prototype.hasOwnProperty.call(value,key)))return null;
    const row=Object.fromEntries(keys.map(key=>[key,value[key]]));
    if(row.schema!=='site-builtin-celebration-track-v1'||row.id!==id||!ID_SET.has(row.id)||row.type!=='audio/mpeg'||
       typeof row.title!=='string'||!row.title.trim()||row.title.length>160||/[\u0000-\u001f\u007f-\u009f]/.test(row.title)||
       !Number.isSafeInteger(row.bytes)||row.bytes<=0||row.bytes>MAX_FILE_BYTES||typeof row.sha256!=='string'||!/^[a-f0-9]{64}$/.test(row.sha256)||
       row.src!=='./assets/celebration-audio/'+id.replaceAll('_','-')+'-'+row.sha256.slice(0,16)+'.mp3')return null;
    return Object.freeze(row);
   }catch{return null;}
  }
  async function play(id,{valid=()=>true,onFallback=null}={}){
   stop();const current=epoch;eventId=id;phase='loading';
   const active=()=>{try{return epoch===current&&valid()===true;}catch{return false;}},cancelled=()=>({status:'CANCELLED',id,fallback:false});
   if(!ID_SET.has(id)){eventId=null;phase='idle';return {status:'INVALID_EVENT',id,fallback:false};}
   if(!active()){if(epoch===current)stop();return cancelled();}
   const selectedBuiltIn=builtIn(id);
   emit('LOADING',id);
   const value=await read(id);
   if(!active()){if(epoch===current)stop();return cancelled();}
   const bundled=!value.record&&selectedBuiltIn;
   if(!value.record&&!bundled){eventId=null;phase='idle';return emit(value.status,id,{fallback:true});}
   const details=bundled?{name:bundled.title,type:bundled.type,bytes:bundled.bytes}:metadata(value.record),extra=bundled?{source:'BUNDLED',override_status:value.status}:{};
   activeMetadata=details;activeSource=bundled?'BUNDLED':null;
   let builtinFailure=null,failureEpoch=null;
   function failBuiltIn(){
    if(builtinFailure)return builtinFailure;
    if(!active()){if(epoch===current)stop();return cancelled();}
    // Remove listeners, pause and clear the native source BEFORE a caller may
    // start the original cue. One failure owns one callback, even if the play
    // promise and a late native error both report it.
    stop();failureEpoch=epoch;phase='fallback';eventId=id;activeMetadata=details;activeSource='BUNDLED';
    builtinFailure={status:'BUILTIN_PLAYBACK_ERROR',id,fallback:false,fallback_handled:true,source:'BUNDLED',metadata:details};
    emit('BUILTIN_PLAYBACK_ERROR',id,{fallback:false,fallback_handled:true,source:'BUNDLED',metadata:details});
    let stillValid=false;try{stillValid=epoch===failureEpoch&&valid()===true;}catch{}
    if(stillValid&&typeof onFallback==='function'){try{onFallback({...builtinFailure,fallback:true});}catch{}}
    return builtinFailure;
   }
   try{
    if(!audio||typeof audio.play!=='function')throw Error('Unavailable');
    if(!bundled){
     if(typeof url?.createObjectURL!=='function')throw Error('Unavailable');
     activeUrl=url.createObjectURL(value.record.blob);
     if(typeof activeUrl!=='string'||!activeUrl.startsWith('blob:'))throw Error('Local URL unavailable');
    }
    audio.controls=true;audio.preload=bundled?'none':'auto';audio.src=bundled?bundled.src:activeUrl;audio.hidden=false;phase='ready';
    for(const [type,status,nextPhase]of [['playing','PLAYING','playing'],['pause','PAUSED','paused'],['ended','ENDED','ended'],['error','FILE_PLAYBACK_ERROR','error']]){
     const handler=()=>{
      if(epoch!==current)return;if(!active()){stop();return;}
      if(bundled&&(type==='error'||audio?.error)){failBuiltIn();return;}
      // Chrome may queue pause after a decode error and rejected play(). That
      // event must not turn a broken file back into resumable/finished audio.
      if(type!=='error'&&(audio?.error||((type==='pause'||type==='ended')&&phase==='error'))){
       if(phase!=='error'){phase='error';emit('FILE_PLAYBACK_ERROR',id,{fallback:false,metadata:details});}
       return;
      }
      phase=nextPhase;emit(status,id,{fallback:false,metadata:details,...extra});
     };
     if(audio.addEventListener){audio.addEventListener(type,handler);listeners.push([type,handler]);}
    }
   }catch{stop();return emit('PLAYBACK_UNAVAILABLE',id,{fallback:true,...extra});}
   try{
    await audio.play();
    if(builtinFailure)return epoch===failureEpoch?builtinFailure:cancelled();
    if(!active()){if(epoch===current)stop();return cancelled();}
    phase='playing';return emit('PLAYING',id,{fallback:false,metadata:details,...extra});
   }catch(error){
    if(builtinFailure)return epoch===failureEpoch?builtinFailure:cancelled();
    if(!active()){if(epoch===current)stop();return cancelled();}
    if(bundled&&(audio?.error||error?.name==='NotSupportedError'))return failBuiltIn();
    // A codec/media failure can emit `error` before rejecting play(). Do not
    // overwrite that failure with autoplay advice: pressing Play cannot repair
    // an unsupported file. Keep this file's controls and avoid another score.
    if(phase==='error')return {status:'FILE_PLAYBACK_ERROR',id,fallback:false,metadata:details};
    if(audio?.error||error?.name==='NotSupportedError'){
     phase='error';return emit('FILE_PLAYBACK_ERROR',id,{fallback:false,metadata:details});
    }
    // A rejected play promise is not permission to overlap an original score.
    // Keep native controls and this Blob URL available for an explicit Play.
    phase='ready';return emit('PRESS_PLAY',id,{fallback:false,metadata:details,...extra});
   }
  }
  return Object.freeze({save,info,remove,play,stop,state:()=>({eventId,phase,hasObjectURL:Boolean(activeUrl),metadata:activeMetadata?{...activeMetadata}:null,...activeSource?{source:activeSource}:{}}),close(){stop();try{store.close?.();}catch{}}});
 }
 return Object.freeze({IDS,MAX_FILE_BYTES,ACCEPT,validate,createStore,create});
});
