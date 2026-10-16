/* A source-friendly 30-second fast lane for races with actual votes.
 * This module never invents votes, winner calls or reporting percentages.
 * Regular national scanning remains minute-cadenced and round-robin.
 */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.ElectionNightFastLane=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const START=Date.parse('2026-11-03T23:00:00Z'); // 6 PM Eastern
 const END=Date.parse('2026-11-05T06:00:00Z');
 const INTERVAL_MS=30000,MIN_RACE_SPACING_MS=26000,MAX_RACES=4;
 function shouldRun({year,visible,tabVisible,blocked,now}={}){
  return year===2026&&visible===true&&tabVisible===true&&blocked!==true&&
   Number.isFinite(now)&&now>=START&&now<END;
 }
 function pick({personal=[],automatic=[],reported={},lastAttempt={},
                 primaryStates=[],now,max=MAX_RACES}={}){
  if(!Number.isFinite(now)||!Number.isInteger(max)||max<1||max>MAX_RACES)
   throw Error('Invalid Election Night fast-lane budget');
  const primary=new Set(primaryStates),seen=new Set(),picks=[];
  for(const item of [...personal,...automatic]){
   if(!item||!['House','Senate','Governor'].includes(item.office)||
      typeof item.key!=='string'||!/^[A-Z]{2}(?:-\d{2}|-special)?$/.test(item.key))
    continue;
   const id=item.office+'|'+item.key;
   if(seen.has(id))continue;
   seen.add(id);
   if(primary.has(item.key.slice(0,2)))continue;
   // Only recheck races already showing strictly validated positive returns.
   // Never spend 30-second requests repeatedly probing absent ballot records.
   if(!reported[id]||!Number.isSafeInteger(reported[id].total)||
      reported[id].total<=0)continue;
   const previous=lastAttempt[id];
   if(Number.isFinite(previous)&&now-previous<MIN_RACE_SPACING_MS)continue;
   picks.push({office:item.office,key:item.key});
   if(picks.length===max)break;
  }
  return picks;
 }
 return Object.freeze({START,END,INTERVAL_MS,MIN_RACE_SPACING_MS,MAX_RACES,
                       shouldRun,pick});
});