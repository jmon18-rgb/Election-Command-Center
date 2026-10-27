// One allowlisted official route; independent of the civicAPI circuit breaker.
(function(root,factory){const api=factory(typeof module!=='undefined'&&module.exports?require('./virginia_official_cache.js'):root?.VirginiaOfficialCache);if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.VirginiaOfficialTransport=api;})(typeof window!=='undefined'?window:null,function(source){'use strict';
 const MAX_BYTES=512000;
 function create({pool,fetchImpl=fetch,isActive=()=>true,sourceGeneration=()=>0}){
  if(!pool?.run||!source)throw Error('Official VA bounded transport unavailable');
  return async function fetchSource(url){
   if(!url.startsWith(source.URL+'?minute=')||!/^\d{8,12}$/.test(url.slice((source.URL+'?minute=').length)))throw Error('Unapproved official VA route');
   const generation=sourceGeneration();
   return pool.run(async()=>{
    if(!isActive()||generation!==sourceGeneration())throw Error('Official VA queued request no longer active');
    const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),12000);
    try{
     const r=await fetchImpl(url,{mode:'cors',credentials:'omit',redirect:'error',cache:'no-store',headers:{Accept:'application/json'},signal:abort.signal});
     if(!r.ok||r.redirected||r.url!==url||!['application/json','text/plain'].some(t=>r.headers.get('content-type')?.toLowerCase().includes(t)))throw Error('Official VA response identity/status/content rejected');
     if(Number(r.headers.get('content-length'))>MAX_BYTES)throw Error('Official VA body too large');
     const reader=r.body?.getReader();if(!reader)throw Error('Official VA bounded stream unavailable');
     const chunks=[];let size=0;
     try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES){abort.abort();throw Error('Official VA body too large');}chunks.push(value);}}
     finally{reader.releaseLock();}
     if(!isActive()||generation!==sourceGeneration())throw Error('Official VA response no longer active');
     const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
     return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    }finally{clearTimeout(timer);}
   },{priority:true});
  };
 }
 return Object.freeze({create,MAX_BYTES});
});
