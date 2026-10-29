'use strict';
module.exports=function fictionalCallBasis({largeBags=false}={}){
 const states=['IA','TX','MI','VA','ME','OH','NE','PA','WI','CA','NY','FL'];
 const row=(code,state,i)=>({code,state,mean:(i%17)-6,sigma:5+(i%3)*.5,
  method:'FICTIONAL_MODEL_NO_SOURCE_ADMISSION',polled:false,poll_weight:null,
  redrawn_mix_weight:0,redrawn_state_center:null});
 const house=Array.from({length:435},(_,i)=>row('FICTION-H'+i,states[i%states.length],i));
 house[0]={...row('MI-04','MI',0),mean:0,method:'redrawn_state_distribution_proxy',redrawn_mix_weight:1,redrawn_state_center:0};
 house[1]={...row('MI-07','MI',1),mean:1,method:'redrawn_state_distribution_proxy',redrawn_mix_weight:1,redrawn_state_center:0};
 house[2]={...row('VA-02','VA',2),mean:0,method:'redrawn_state_distribution_proxy',redrawn_mix_weight:1,redrawn_state_center:0};
 house[3]={...row('FICTION-VA-PEER','VA',3),mean:0,method:'redrawn_state_distribution_proxy',redrawn_mix_weight:1,redrawn_state_center:0};
 const senate=Array.from({length:35},(_,i)=>row('FICTION-S'+i,states[i%states.length],i));
 senate[0]={...row('IA-SEN','IA',0),mean:0,sigma:5.5};
 senate[1]={...row('TX-SEN','TX',1),mean:-2,sigma:5};
 senate[2]={...row('OH-SEN','OH',2),mean:-18,sigma:4};
 senate[3]={...row('ME-SEN','ME',3),mean:1,sigma:5};
 senate[4]={...row('NE-SEN','NE',4),mean:1,sigma:5.5,nonrep_independent_proxy:true};
 senate[5]={...row('SD-SEN','SD',5),mean:-10,sigma:5.5,nonrep_independent_proxy:true};
 const basis={schema_version:'joint-control-beta-v1',house,senate,
  governors:Array.from({length:6},(_,i)=>row('FICTION-G'+i,states[i],i)),
  redrawn_state_distributions:{MI:[-10,10],VA:[-14,14]},
  assumptions:{house_seats:435,senate_contested:35,senate_dem_holdovers:34,senate_rep_holdovers:31,
   house_control_dem_seats:218,senate_control_dem_seats:51,common_national_sigma:3.5,
   house_chamber_sigma:2.5,senate_chamber_sigma:3,governor_chamber_sigma:3.5,
   state_house_sigma:3,state_senate_sigma:3.5,state_governor_sigma:3,
   redrawn_state_additional_sigma:6}};
 if(largeBags)for(const [state,size,start] of [['FL',28,4],['TX',38,32],['CA',52,70]]){
  const values=Array.from({length:size},(_,i)=>state==='FL'?(i-13.5)*2:
   state==='TX'?Math.round((i%19-9)*3.5):(i%13-6)*5),center=values.reduce((s,x)=>s+x,0)/size;
  basis.redrawn_state_distributions[state]=values;
  for(let i=0;i<size;i++)house[start+i]={code:'FICTION-'+state+'-'+String(i+1).padStart(2,'0'),state,
   mean:i%5-2,sigma:5+i%3*.5,method:'redrawn_state_distribution_proxy',polled:false,poll_weight:null,
   redrawn_mix_weight:1,redrawn_state_center:center};
 }
 return basis;
};
