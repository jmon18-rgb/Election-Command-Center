/* Pre-election electorate composition what-if, linked to the real
 * JackStradamus correlated 506-seat model. This is NOT a census estimate,
 * observed demographic change or a replacement for published odds.
 */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.ElectorateWhatIf2026=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
 const n=x=>typeof x==='number'&&Number.isFinite(x);
 function validate(input,basis){
  if(!input||!basis||!Array.isArray(basis.house)||basis.house.length!==435||
    !Array.isArray(basis.senate)||basis.senate.length!==35||
    !Array.isArray(basis.governors)||basis.governors.length<6||
    typeof input.state!=='string'||!/^[A-Z]{2}$/.test(input.state))
   return {ok:false,reason:'Incomplete 2026 model or unknown state'};
  const state=input.state,groups=input.groups;
  if(!Array.isArray(groups)||groups.length!==2)return {ok:false,reason:'Exactly two cohort assumptions required'};
  if(!groups.every(g=>g&&n(g.share_pct)&&g.share_pct>=0&&g.share_pct<=100&&
    n(g.margin_change_points)&&Math.abs(g.margin_change_points)<=40))
   return {ok:false,reason:'Enter cohort voter shares (0–100%) and D-minus-R margin changes (−40 to +40)'};
  const share=groups.reduce((x,g)=>x+g.share_pct,0);
  if(share>100.0000001)return {ok:false,reason:'Two non-overlapping cohorts cannot exceed 100% of voters'};
  const shift=groups.reduce((x,g)=>x+g.share_pct*g.margin_change_points/100,0);
  if(!n(shift)||Math.abs(shift)>12)return {ok:false,reason:'Combined state swing exceeds the ±12-point sensitivity limit'};
  const entries=[...basis.house,...basis.senate,...basis.governors].filter(r=>r.state===state);
  if(!entries.length)return {ok:false,reason:'State absent from complete 2026 model'};
  if(entries.some(r=>!n(r.mean)||typeof r.code!=='string'))
   return {ok:false,reason:'Race-level model priors unavailable'};
  return {ok:true,state,shift,groups,affected:entries.length};
 }
 function evaluate(basis,input,simulator,{samples=2000,seed=20261103}={}){
  const gate=validate(input,basis);
  if(!gate.ok)return {ok:false,reason:gate.reason};
  if(typeof simulator!=='function'||!Number.isInteger(samples)||samples<300||samples>10000||
    !Number.isSafeInteger(seed))return {ok:false,reason:'Simulation method or sample size invalid'};
  // Unmodified baseline and hypothetical state scenario receive precisely
  // the same random seed, error assumptions, candidate context and priors.
  // Change only the mean D-R margin of ballot races in this state.
  const shifted={...basis};
  for(const office of ['house','senate','governors'])
   shifted[office]=basis[office].map(r=>
    r.state===gate.state?{...r,mean:r.mean+gate.shift}:r);
  const opts={samples,seed,nationalShift:0,errorMultiplier:1,live:{}};
  let before,after;
  try{
   before=simulator(basis,opts);
   after=simulator(shifted,opts);
  }catch(e){return {ok:false,reason:'Model simulation failed: '+String(e?.message||e).slice(0,120)}}
  if(!before||!after||!Array.isArray(before.race_probabilities)||
    !Array.isArray(after.race_probabilities))return {ok:false,reason:'Incomplete model race probabilities'};
  const base=Object.fromEntries(before.race_probabilities.map(r=>[r.race_code,r]));
  const now=Object.fromEntries(after.race_probabilities.map(r=>[r.race_code,r]));
  const affected=[...basis.senate,...basis.governors,...basis.house].filter(r=>r.state===gate.state)
   .map(r=>{
    const a=base[r.code],b=now[r.code];
    if(!a||!b||!n(a.dem_beats_rep_pct)||!n(b.dem_beats_rep_pct))return null;
    return {race_code:r.code,
      office:own(a,'office')?a.office:((basis.senate.includes(r))?'senate':'house'),
      before:a.dem_beats_rep_pct,after:b.dem_beats_rep_pct,
      change:b.dem_beats_rep_pct-a.dem_beats_rep_pct};
   }).filter(Boolean)
   .sort((x,y)=>Math.abs(y.change)-Math.abs(x.change)||x.race_code.localeCompare(y.race_code));
  if(affected.length!==gate.affected)return {ok:false,reason:'Incomplete affected-race results'};
  return {ok:true,status:'HYPOTHETICAL_PRE_ELECTION_SENSITIVITY_NOT_HEADLINE_FORECAST',
   state:gate.state,groups:gate.groups.map(g=>({...g})),
   state_margin_shift_points:gate.shift,affected_races:affected,
   baseline:{house_control:before.house_dem_control_pct,
    senate_control:before.senate_dem_control_pct,
    both_control:before.actual_dem_both_control_pct,
    house_seats:before.means?.house_dem_seats,
    senate_seats:before.means?.senate_dem_seats},
   scenario:{house_control:after.house_dem_control_pct,
    senate_control:after.senate_dem_control_pct,
    both_control:after.actual_dem_both_control_pct,
    house_seats:after.means?.house_dem_seats,
    senate_seats:after.means?.senate_dem_seats},
   published_model_modified:false,census_or_turnout_shares_verified:false,
   live_source_votes_used:false,samples};
 }
 return Object.freeze({validate,evaluate});
});
