/* Experimental remaining-vote sensitivity, not a source-error calibration.
 * The historical turnout component is retained, never a hard official cap. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.WashingtonRemainingScenarios=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const whole=Object.freeze(['53011','53015','53041','53049','53059','53069']);
 const assumptions=Object.freeze({historical_weight:.5,two_party_fraction:.95,
  relative_estimate_sigma:.5,reference_sigma_floor:.05,absolute_sigma_floor:1000,
  undervote_fraction_sigma:.1,calibrated:false,source:'ASSUMED_SENSITIVITY_NOT_FITTED'});
 // Common signed errors across counties avoid treating one provider's estimates
 // as six independent measurements. No point allocation for Thurston.
 const quadrature=Object.freeze([[-2,.05],[-1,.25],[0,.4],[1,.25],[2,.05]].map(Object.freeze));
 function variants(rows){
  if(!Array.isArray(rows)||rows.length>6)throw Error('Bounded whole-county estimates required');
  const byFips=new Map();
  for(const r of rows){
   if(!whole.includes(r.county_fips)||byFips.has(r.county_fips)||!Number.isSafeInteger(r.estimated_ballots_left)||r.estimated_ballots_left<0)
    throw Error('Unverified whole-county estimate; split counties cannot be allocated');
   byFips.set(r.county_fips,r.estimated_ballots_left);
  }
  if(!byFips.size)return [{weight:1,kind:'historical',remaining:()=>null}];
  return [{weight:.5,kind:'historical',remaining:()=>null},...quadrature.map(([z,w])=>({weight:w*.5,kind:'official_estimate_sensitivity',remaining(fips,reference){
   if(!byFips.has(fips))return null;
   if(!Number.isFinite(reference)||reference<=0)throw Error('Historical reference required for error floor');
   const e=byFips.get(fips),sd=Math.hypot(Math.max(.5*e,.05*reference,1000),.1*e);
   return Math.max(0,.95*e+z*sd);
  }}))];
 }
 return Object.freeze({whole,assumptions,variants});
});
