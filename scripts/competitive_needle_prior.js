(function(root,factory){const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.CompetitiveNeedlePrior=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 function read(result,code){
  if(!['IA-SEN','KS-SEN','TX-SEN'].includes(code)||result?.schema_version!=='joint-control-beta-v1'||
   result.race_probability_method!=='SAME_CORRELATED_DRAWS_AS_CHAMBER_CONTROL'||
   !Array.isArray(result.race_probabilities)||!Number.isFinite(result.error_multiplier)||result.error_multiplier<=0)return null;
  const rows=result.race_probabilities.filter(r=>r?.race_code===code);
  if(rows.length!==1)return null;
  const row=rows[0],margin=row.model_dem_margin_points,sigma=row.sigma_points/result.error_multiplier;
  if(row.office!=='senate'||row.polled!==true||typeof row.source_method!=='string'||!/^2026_/.test(row.source_method)||
   !Number.isFinite(row.sigma_points)||
   !Number.isFinite(margin)||Math.abs(margin)>=100||!Number.isFinite(sigma)||sigma<=0||sigma>100)return null;
  // Read latent, unconditioned race parameters, never source-call flags or
  // simulated win percentages. The returned mean excludes research national
  // shifts; remove the research error multiplier from the reported sigma.
  return Object.freeze({margin,sigma,source:'unconditioned_linked_race_marginal',source_method:row.source_method});
 }
 async function waitFor(readPrior,{isCurrent=()=>true,pause=ms=>new Promise(ok=>setTimeout(ok,ms))}={}){
  if(typeof readPrior!=='function')throw Error('Linked prior reader unavailable');
  for(let attempt=0;attempt<=20;attempt++){
   if(!isCurrent())return null;
   const prior=readPrior();if(prior)return prior;
   if(attempt<20)await pause(250);
  }
  return null;
 }
 return Object.freeze({read,waitFor});
});
