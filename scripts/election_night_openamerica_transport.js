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
 function create(fetchJson){
  if(typeof fetchJson!=='function')throw Error('fetch implementation required');
  const inFlight=new Map();
  function load(url){
   if(typeof url!=='string'||!MATCH.test(url))
    return Promise.reject(Error('Unapproved election-year/office source URL'));
   if(inFlight.has(url))return inFlight.get(url);
   const promise=Promise.resolve().then(()=>fetchJson(url,{
    mode:'cors',credentials:'omit',cache:'no-cache',
    headers:{Accept:'application/json'}
   })).then(async response=>{
    if(!response||response.ok!==true)throw Error(
     'Open America results HTTP '+(response?.status??'unavailable'));
    const doc=await response.json();
    if(!doc||typeof doc!=='object'||Array.isArray(doc))
     throw Error('Open America results not a JSON object');
    return doc;
   });
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
