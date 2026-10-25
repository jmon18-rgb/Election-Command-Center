/* Shared Open America result requests. Browser-native "no-cache" gives
 * conditional ETag revalidation without a custom cross-origin
 * If-None-Match header / CORS preflight. Simultaneous requests for the
 * same election+office share ONE upstream response, not independent races.
 *
 * Never reuse fulfilled data after an upstream outage. The caller's own
 * source identity/time guards still decide whether votes may be displayed.
 */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.ElectionNightOpenAmericaTransport=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const MATCH=/^https:\/\/openamerica\.io\/elections\/results\.json\?year=(?:2024|2026)&office=(?:House|Senate|Governor)$/;
 function create(fetchJson,{timeoutMs=12000}={}){
  if(typeof fetchJson!=='function')throw Error('fetch implementation required');
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)
   throw Error('Bounded 1-30000ms primary source timeout required');
  const inFlight=new Map();
  function load(url){
   if(typeof url!=='string'||!MATCH.test(url))
    return Promise.reject(Error('Unapproved election-year/office source URL'));
   if(inFlight.has(url))return inFlight.get(url);
   // A browser fetch or body read can hang forever after laptop/network
   // interruption, otherwise leaving this office's shared in-flight slot
   // occupied and starving watched Senate results after a House outage.
   // Promise.race enforces a deadline EVEN if a mock/custom fetch ignores
   // AbortSignal. A late response can never publish through a settled race.
   const controller=new AbortController();
   let timeout=null;
   const work=Promise.resolve().then(()=>fetchJson(url,{
    mode:'cors',credentials:'omit',cache:'no-cache',redirect:'error',
    headers:{Accept:'application/json'},signal:controller.signal
   })).then(async response=>{
    // Browser fetch may follow 30x responses to an attacker/alternate feed.
    // 200 + CORS + plausible votes is NOT evidence that the approved
    // Open America endpoint actually authored the returned document.
    // Native browser Response always exposes its final URL. Some offline
    // unit/browser-harness stubs are plain objects without that property;
    // accept those only as untrusted test shims, never a native response.
    const finalURL=response?.url;
    const hasURL=typeof finalURL==='string'&&finalURL.length>0;
    const isNative=typeof Response==='function'&&response instanceof Response;
    if(!response||response.redirected===true||
       (hasURL&&finalURL!==url)||(isNative&&!hasURL))
     throw Error('Open America response did not originate at approved source URL');
    if(response.ok!==true)throw Error(
     'Open America results HTTP '+(response?.status??'unavailable'));
    const doc=await response.json();
    if(!doc||typeof doc!=='object'||Array.isArray(doc))
     throw Error('Open America results not a JSON object');
    return doc;
   });
   const deadline=new Promise((_,reject)=>{
    timeout=setTimeout(()=>{
     controller.abort();
     reject(Error('Open America '+url+' timed out; previous votes unverified'));
    },timeoutMs);
   });
   const promise=Promise.race([work,deadline]).finally(()=>clearTimeout(timeout));
   inFlight.set(url,promise);
   // Delete on both success and failure. Attach catch so cleanup doesn't
   // cause an unhandled rejection when the shared source is unavailable.
   void promise.then(()=>{if(inFlight.get(url)===promise)inFlight.delete(url)},
                     ()=>{if(inFlight.get(url)===promise)inFlight.delete(url)});
   return promise;
  }
  return Object.freeze({load,pending:()=>inFlight.size});
 }
 return Object.freeze({create});
});
