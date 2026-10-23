/* Verified county feed -> historical swing bridge. This is NOT a live forecast. */
(function(root,factory){
 const api=factory(
  typeof module!=='undefined'&&module.exports?
   require('./geographic_returns_2026'):root.GeographicReturns2026,
  typeof module!=='undefined'&&module.exports?
   require('./county_swing_2026'):root.CountySwing2026);
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.GeographicSwingBridge2026=api;
})(typeof window!=='undefined'?window:null,function(returns,swing){
 'use strict';
 function apply(previous,incoming,baseline){
  if(!returns||!swing)return {accepted:false,reason:'DEPENDENCIES_UNAVAILABLE'};
  const result=returns.reconcile(previous,incoming);
  if(!result.accepted)return result;
  const calculation=swing.calculate(result.row,baseline);
  return {accepted:true,row:result.row,swing:calculation,
   mode:calculation?'VERIFIED_GEOGRAPHIC_COMPARISON':'NO_COMPARABLE_BASELINE'};
 }
 return Object.freeze({apply});
});
