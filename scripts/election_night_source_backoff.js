/* Election-night supplementary-provider HTTP circuit breaker.
 * A detected 429/502/503/504 is not a zero-vote election result.
 * Backoff prevents one temporary outage from causing race-by-race request
 * storms. The state is local to the page and never changes model odds.
 */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.ElectionNightSourceBackoff=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const TRANSIENT=new Set([429,502,503,504]);
 const DELAYS=Object.freeze([60000,120000,300000,600000]);
 function create(clock=()=>Date.now()){
  let consecutive=0,blockedUntil=0,lastHttpStatus=null,generation=0;
  function status(){
   const now=clock();
   return Object.freeze({blocked:now<blockedUntil,
    seconds_remaining:Math.max(0,Math.ceil((blockedUntil-now)/1000)),
    consecutive,last_http_status:lastHttpStatus,until:blockedUntil,generation});
  }
  function fail(http){
   if(!TRANSIENT.has(http))return status();
   consecutive=Math.min(consecutive+1,DELAYS.length);
   generation++; // invalidate all source snapshots older than this failure
   lastHttpStatus=http;
   blockedUntil=Math.max(blockedUntil,clock()+DELAYS[consecutive-1]);
   return status();
  }
  function success(){
   // Another request already in flight may succeed while the vendor is
   // still shedding load. Don't erase the outage immediately.
   if(clock()>=blockedUntil){
    consecutive=0;blockedUntil=0;lastHttpStatus=null;
   }
   return status();
  }
  return Object.freeze({status,fail,success});
 }
 return Object.freeze({TRANSIENT,DELAYS,create});
});
