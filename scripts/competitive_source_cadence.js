// Dashboard polling policy, NOT evidence of upstream result/publication latency.
(function(root,factory){const api=factory(typeof module!=='undefined'&&module.exports?require('./election_night_poll_closings_2026.js'):root?.ElectionNightPollClosings2026);
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.CompetitiveSourceCadence=api;
})(typeof window!=='undefined'?window:null,function(closes){
 'use strict';
 const CODES=Object.freeze(['IA-SEN','KS-SEN','TX-SEN','WI-01','WI-03']);
 const PRE_CLOSE_MS=600000,FAST_MS=15000,NORMAL_MS=60000,FAST_END=Date.parse('2026-11-04T17:00:00Z');
 function floor(code,now){if(!CODES.includes(code)||!Number.isFinite(now))throw Error('Unsupported competitive cadence scope/clock');return closes.floorFor(code);}
 function intervalMs(code,now=Date.now()){
  const close=floor(code,now);return now<close?PRE_CLOSE_MS:now<FAST_END?FAST_MS:NORMAL_MS;
 }
 function delayMs(code,lastAttempt,now=Date.now()){
  const close=floor(code,now),interval=intervalMs(code,now);
  const boundary=now<close?close:now<FAST_END?FAST_END:Infinity;
  const elapsed=Number.isFinite(lastAttempt)?Math.max(0,now-lastAttempt):Infinity;
  return Math.max(50,Math.min(interval,interval-elapsed,boundary-now));
 }
 function createTicker({code,tick,lastAttempt,isActive=()=>true,now=()=>Date.now(),setTimer=setTimeout,clearTimer=clearTimeout}){
  floor(code,now());if(typeof tick!=='function'||typeof lastAttempt!=='function')throw Error('Cadence callbacks required');
  let timer=null,destroyed=false;
  function reschedule(){
   if(timer!==null)clearTimer(timer);timer=null;if(destroyed)return;
   timer=setTimer(async()=>{timer=null;try{if(isActive())await tick();}finally{reschedule();}},isActive()?delayMs(code,lastAttempt(),now()):NORMAL_MS);
  }
  reschedule();return Object.freeze({reschedule,destroy(){destroyed=true;if(timer!==null)clearTimer(timer);timer=null;}});
 }
 return Object.freeze({CODES,PRE_CLOSE_MS,FAST_MS,NORMAL_MS,FAST_END,intervalMs,delayMs,createTicker,
  automatic_full_route_requests_per_minute:CODES.length*60000/FAST_MS,
  comparative_publication_lag:'UNPROVEN_REQUIRES_INDEPENDENT_MATCHED_REAL_BATCHES'});
});
