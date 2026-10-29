/* Provisional editorial bulletin lifecycle; never a race call or model input. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.ElectionNightEarlyWeather=api;})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const stages=new Set(['STORM_BREWING','STRONGER_PATTERN']);
 function create({render=()=>{},stopSound=()=>{},chime=()=>{},setTimer=setTimeout,clearTimer=clearTimeout}={}){
  const seen=new Set();let timer=null,visible=null,epoch=0;
  function clear(){epoch++;if(timer!==null)clearTimer(timer);timer=null;visible=null;stopSound();render(null);}
  function update({summary,active=false,current=false,blocked=false,context='PUBLIC'}={}){
   // Explicit previews stay fictional while live evidence is pending. Hidden
   // pages and higher-priority call announcements still close them immediately.
   if(visible?.simulated){if(active!==true||blocked)clear();return false;}
   const stateList=x=>Array.isArray(x)&&x.every(s=>typeof s==='string'&&/^[A-Z]{2}$/.test(s))&&new Set(x).size===x.length;
   const raceList=x=>Array.isArray(x)&&x.every(s=>typeof s==='string'&&/^[A-Z]{2}-(?:SEN|\d{2})$/.test(s))&&new Set(x).size===x.length;
   const valid=active===true&&current===true&&!blocked&&['PUBLIC','LOCAL_RESEARCH_VARIANT'].includes(context)&&summary?.schema==='early-indicator-status-v1'&&stages.has(summary.stage)&&summary.canMoveNationalNeedle===false&&summary.canTriggerEarnedCelebration===false&&stateList(summary.negative_states)&&summary.negative_states.length===0&&stateList(summary.positive_states)&&summary.positive_states.length>=2&&raceList(summary.positive_races)&&summary.positive_races.length>=summary.positive_states.length&&summary.positive_states.every(s=>summary.positive_races.some(r=>r.startsWith(s+'-')))&&summary.positive_races.every(r=>summary.positive_states.includes(r.slice(0,2)))&&(summary.stage!=='STRONGER_PATTERN'||stateList(summary.strong_positive_states)&&summary.strong_positive_states.length>=3&&summary.strong_positive_states.every(s=>summary.positive_states.includes(s)));
   if(!valid){if(visible)clear();return false;}
   const key=context+'|'+summary.stage;
   const next={stage:summary.stage,positive_races:summary.positive_races.slice(),positive_states:summary.positive_states.slice(),simulated:false,context};
   if(visible&&visible.key===key){visible={...next,key};render(next);return false;}
   if(visible)clear();
   if(seen.has(key))return false;
   seen.add(key);visible={...next,key};render(next);chime();const ticket=++epoch;
   timer=setTimer(()=>{if(ticket===epoch)clear();},12000);return true;
  }
  return Object.freeze({update,dismiss:clear,preview(stage='STORM_BREWING'){
   if(!stages.has(stage))return false;clear();visible={stage,simulated:true,key:'PREVIEW'};
   render({stage,simulated:true,positive_races:[],positive_states:[],context:'SIMULATED'});chime();const ticket=++epoch;timer=setTimer(()=>{if(ticket===epoch)clear();},12000);return true;
  },state:()=>Object.freeze({visible:Boolean(visible),stage:visible?.stage??null,simulated:visible?.simulated===true,seen:seen.size})});
 }
 return Object.freeze({create});
});
