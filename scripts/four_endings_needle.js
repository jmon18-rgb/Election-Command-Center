/* Four Endings election-night dial.
 * It is an ORDINAL four-category modal pointer, not a continuous forecast of
 * partisan swing or a second independent probability model. The probabilities
 * shown on every dial come directly from a validated SINGLE joint simulation.
 */
(function(root,factory){
 const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.FourEndingsNeedle=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const CATEGORIES=Object.freeze([
  Object.freeze({key:'red_dawn',title:'RED DAWN',color:'#f37e77'}),
  Object.freeze({key:'shrug',title:'SHRUG',color:'#e2c48c'}),
  Object.freeze({key:'blue_wave',title:'BLUE WAVE',color:'#70aaff'}),
  Object.freeze({key:'blue_tsunami',title:'BLUE TSUNAMI',color:'#5ce1e0'})
 ]);
 function summarize(result){
  if(!result||!Number.isInteger(result.samples)||result.samples<1||
     !result.counts||!result.probabilities)throw Error('Missing same-draw Four Endings probabilities');
  let sum=0;
  const rows=CATEGORIES.map((c,i)=>{
   const count=result.counts[c.key],pct=result.probabilities[c.key];
   if(!Number.isInteger(count)||count<0||typeof pct!=='number'||
       !Number.isFinite(pct)||pct<0||pct>100||
       Math.abs(pct-100*count/result.samples)>.055)
    throw Error('Inconsistent joint probability: '+c.key);
   sum+=count;
   return {...c,index:i,percent:pct,count};
  });
  if(sum!==result.samples)throw Error('Four Endings draws do not sum to simulation size');
  const sorted=[...rows].sort((a,b)=>b.count-a.count||a.index-b.index);
  return {rows,winner:sorted[0],runnerUp:sorted[1],
   needleDegrees:45*(sorted[0].index-1.5),
   totalSamples:result.samples};
 }
 return Object.freeze({CATEGORIES,summarize});
});
