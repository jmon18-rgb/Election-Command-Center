/* Six at-large House districts use 00 in live ballot/result feeds, while
 * this legacy model archive identifies their modeled seat as 01. Map only
 * these exact six states: never alias multi-district states or invent seats.
 */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.HouseAtLargeBridge=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const STATES=Object.freeze(['AK','DE','ND','SD','VT','WY']);
 const set=new Set(STATES);
 function sourceKey(key){
  if(typeof key!=='string')return key;
  const state=key.slice(0,2);
  return set.has(state)&&key===state+'-01'?state+'-00':key;
 }
 function modelCode(key){
  if(typeof key!=='string')return key;
  const state=key.slice(0,2);
  return set.has(state)&&key===state+'-00'?state+'-01':key;
 }
 function sourceItem(item){
  return item?.office==='House'?{...item,key:sourceKey(item.key)}:item;
 }
 return Object.freeze({STATES,sourceKey,modelCode,sourceItem});
});
