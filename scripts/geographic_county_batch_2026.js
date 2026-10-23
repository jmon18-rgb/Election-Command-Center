/* Deterministic county snapshot ingestion. No implied zero votes or forecast. */
(function(root,factory){
 const api=factory(typeof module!=='undefined'&&module.exports?
  require('./geographic_swing_bridge_2026'):root.GeographicSwingBridge2026);
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.GeographicCountyBatch2026=api;
})(typeof window!=='undefined'?window:null,function(bridge){
 'use strict';
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 function process(previous,observations,baselines={}){
  if(!bridge||!Array.isArray(observations)||!observations.length||
     observations.length>10000||!previous||typeof previous!=='object'||
     Array.isArray(previous)||!baselines||typeof baselines!=='object')
   return {accepted:false,reason:'INVALID_BATCH'};
  const next=Object.assign(Object.create(null),previous);
  const updates=[],rejected=[];
  for(const incoming of observations){
   // Never trust caller-controlled dictionary keys as geographic identity.
   const id=typeof incoming?.race_key==='string'&&
    typeof incoming?.county_id==='string'?
    incoming.race_key+'|'+incoming.county_id:null;
   if(!id||!/^([A-Z]{2}-(?:SEN|GOV|\d{2}))\|\d{5}$/.test(id)){
    rejected.push({id:null,reason:'INVALID_IDENTITY'});continue;
   }
   const old=own(next,id)?next[id]:null;
   const base=own(baselines,id)?baselines[id]:null;
   const outcome=bridge.apply(old,incoming,base);
   if(!outcome.accepted){
    rejected.push({id,reason:outcome.reason});continue;
   }
   next[id]=outcome.row;
   updates.push({id,mode:outcome.mode,swing:outcome.swing});
  }
  return {accepted:true,rows:next,updates,rejected,
   may_move_national_needle:false};
 }
 return Object.freeze({process});
});
