/* Derived RAM-only input explanations. No model, network, persistence or CSV parsing. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.ActiveRaceInputDiagnostics=api;})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const finite=x=>typeof x==='number'&&Number.isFinite(x),freeze=x=>Object.freeze(x);
 function explain({office,active,baseline=null,poll_margin_points=null,context_matches=false}={}){
  const unavailable=reason=>freeze({status:'UNAVAILABLE',reason});
  if(context_matches!==true)return unavailable('CURRENT_ACCEPTED_INPUT_CONTEXT_NOT_BOUND');
  if(!['senate','house'].includes(office)||!active||typeof active.code!=='string'||!finite(active.mean)||typeof active.polled!=='boolean')
   return unavailable('ACTIVE_INPUT_METADATA_MISSING');
  if(!finite(active.poll_weight)||active.poll_weight<0||active.poll_weight>1||!active.polled&&active.poll_weight!==0)
   return unavailable('ACTIVE_WEIGHT_METADATA_INVALID');
  const imported=finite(active.private_context_anchor_points),w=active.poll_weight;
  if(active.private_context_anchor_points!==undefined&&!imported)return unavailable('ACTIVE_IMPORTED_ANCHOR_INVALID');
  const source=imported?'IMPORTED_CANDIDATE_CONTEXT':office==='senate'&&finite(active.candidate_neutral_2026_environment_margin_points)?
   'PUBLIC_2026_GEOGRAPHIC_ENVIRONMENT':'PUBLIC_PRIOR_COMPONENT_NOT_EXPOSED';
  const label=imported?active.private_context_source==='blended_fundamentals_plus_unadjusted_expert'?
   'Imported fundamentals plus unadjusted expert context':active.private_context_source==='blended_fundamentals_only'?
   'Imported Blended fundamentals':active.private_context_source==='expert_only'?
   'Imported unadjusted expert context':'Imported candidate-context anchor':
   source==='PUBLIC_2026_GEOGRAPHIC_ENVIRONMENT'?'2024 geography plus current national environment':'Public House prior (exact anchor not exposed)';
  const anchor=imported?active.private_context_anchor_points:
   source==='PUBLIC_2026_GEOGRAPHIC_ENVIRONMENT'?active.candidate_neutral_2026_environment_margin_points:null;
  const poll=active.polled&&finite(poll_margin_points)?poll_margin_points:null;
  const cap=imported||office==='senate'?55:60;
  let reconstruction=null,formula_status='COMPONENTS_UNAVAILABLE_FOR_EXACT_RECONSTRUCTION';
  if((w===0||poll!==null)&&(w===1||anchor!==null)){
   const raw=w*(poll??0)+(1-w)*(anchor??0),bounded=Math.max(-cap,Math.min(cap,raw));
   reconstruction={unbounded_margin_points:raw,bounded_margin_points:bounded,cap_points:cap};
   // Imported anchor metadata is rounded to .001 points. This tolerance covers
   // that declared precision; it is not a fitted numerical/model threshold.
   formula_status=Math.abs(bounded-active.mean)<=.003?'RECONCILED_AT_INPUT_METADATA_PRECISION':'DISPLAYED_COMPONENTS_DO_NOT_RECONSTRUCT_ACTIVE_PRIOR';
  }
  const publicMean=baseline&&baseline.code===active.code&&finite(baseline.mean)?baseline.mean:null;
  return freeze({status:'AVAILABLE',office,race_code:active.code,source_kind:source,
   source_label:label,imported_context_active:imported,polled:active.polled,
   poll_weight:w,anchor_weight:1-w,poll_margin_points:poll,anchor_margin_points:anchor,
   active_prior_margin_points:active.mean,public_baseline_prior_margin_points:publicMean,
   special:active.special===true,formula_status,reconstruction:reconstruction?freeze(reconstruction):null,
   scope:'DERIVED_INPUT_EXPLANATION_NOT_A_FORECAST_OR_SOURCE_ADMISSION'});
 }
 return freeze({explain});
});
