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
 function apply(previous,incoming,baseline,now=Date.now()){
  if(!returns||!swing)return {accepted:false,reason:'DEPENDENCIES_UNAVAILABLE'};
  if(!Number.isFinite(now))return {accepted:false,reason:'INVALID_VIEWER_CLOCK'};
  const result=returns.reconcile(previous,incoming);
  if(!result.accepted)return result;
  const row=result.row;
  const when=Date.parse(row.updated_at||'');
  if(!Number.isFinite(when)||when>now+15*60000||now-when>180*60000)
   return {accepted:false,reason:'PREMATURE_FUTURE_OR_STALE_VIEWER_CLOCK'};
  // Validation of a provider source stamp alone does not authorize display
  // on a laptop whose actual clock is still before LOCAL polls closed.
  const closes=typeof window!=='undefined'?
   window.ElectionNightPollClosings2026:
   typeof require==='function'?require('./election_night_poll_closings_2026.js'):null;
  if(row.ballots_reported>0&&(!closes||typeof closes.allowed!=='function'||
     !closes.allowed(row.race_key,row.ballots_reported,row.updated_at,now)))
   return {accepted:false,reason:'LOCAL_POLLS_OPEN_OR_SOURCE_PREMATURE'};
  const calculation=swing.calculate(row,baseline);
  return {accepted:true,row:result.row,swing:calculation,
   mode:calculation?'VERIFIED_GEOGRAPHIC_COMPARISON':'NO_COMPARABLE_BASELINE'};
 }
 return Object.freeze({apply});
});
