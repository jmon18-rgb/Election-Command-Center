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
 const STATES=Object.freeze('AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' '));
 function validate(input,basis){
  if(!input||!basis||!Array.isArray(basis.house)||basis.house.length!==435||
    !Array.isArray(basis.senate)||basis.senate.length!==35||
    !Array.isArray(basis.governors)||basis.governors.length<6)
   return {ok:false,reason:'Incomplete 2026 model or unknown state'};
  const national=input.scope==='national',known=new Set(STATES);
  const states=national?STATES.slice():Array.isArray(input.states)?input.states:[input.state];
  if(national){const available=[...new Set(basis.house.map(r=>r.state))].sort();
   if(available.length!==50||available.some((st,i)=>st!==STATES.slice().sort()[i]))
    return {ok:false,reason:'National scope requires all 50 actual House state identities'};
  }
  if(states.length<1||states.length>(national?50:8)||
     states.some(state=>typeof state!=='string'||!known.has(state))||
     new Set(states).size!==states.length)
   return {ok:false,reason:'Choose 1–8 distinct valid 2026 states or the complete national scope'};
  const mode=input.mode||'margin',scale=input.scenario_scale??1;
  if(!['margin','composition'].includes(mode)||![.5,1,1.5].includes(scale))
   return {ok:false,reason:'Choose margin or participation assumptions and a declared scenario scale'};
  const scope=new Set(states),state=states[0],groups=input.groups;
  if(!Array.isArray(groups)||groups.length!==(mode==='composition'?3:2))
   return {ok:false,reason:mode==='composition'?'Supply the two disjoint cohorts and the remainder':'Exactly two cohort assumptions required'};
  if(!groups.every(g=>g&&n(g.share_pct)&&g.share_pct>=0&&g.share_pct<=100&&
    n(g.margin_change_points)&&Math.abs(g.margin_change_points)<=40))
   return {ok:false,reason:'Enter cohort voter shares (0–100%) and D-minus-R margin changes (−40 to +40)'};
  const share=groups.reduce((x,g)=>x+g.share_pct,0);
  if(share>100.0000001)return {ok:false,reason:'Two non-overlapping cohorts cannot exceed 100% of voters'};
  if(mode==='composition'&&Math.abs(share-100)>1e-7)
   return {ok:false,reason:'Disjoint cohort shares must total exactly 100% including the remainder'};
  let shift,composition=null;
  if(mode==='composition'){
   if(!groups.every(g=>n(g.baseline_margin_points)&&Math.abs(g.baseline_margin_points)<=100&&
     n(g.participation_multiplier)&&g.participation_multiplier>=0))
    return {ok:false,reason:'Explicit baseline cohort preferences and nonnegative participation multipliers are required'};
   const effective=groups.map(g=>({share:g.share_pct/100,margin:g.baseline_margin_points,
    multiplier:1+scale*(g.participation_multiplier-1),
    after:g.baseline_margin_points+scale*g.margin_change_points}));
   if(effective.some(g=>!n(g.multiplier)||g.multiplier<0||!n(g.after)||Math.abs(g.after)>100))
    return {ok:false,reason:'Scaled participation or preference assumptions exceed valid bounds'};
   const largest=Math.max(...effective.map(g=>g.multiplier));
   if(!(largest>0))return {ok:false,reason:'The assumed electorate cannot have zero participation'};
   const scaledTotal=effective.reduce((s,g)=>s+g.share*(g.multiplier/largest),0);
   if(!(scaledTotal>0)||!n(scaledTotal))return {ok:false,reason:'The assumed electorate cannot have zero participation'};
   const baseline=effective.reduce((s,g)=>s+g.share*g.margin,0);
   const shares=effective.map(g=>g.share*(g.multiplier/largest)/scaledTotal);
   const after=effective.reduce((s,g,i)=>s+shares[i]*g.after,0);
   const relative=largest*scaledTotal;
   if(!n(baseline)||!n(after)||!n(relative)||relative<=0)
    return {ok:false,reason:'Participation assumptions produce a nonfinite electorate'};
   shift=after-baseline;
   composition={baseline_margin_points:baseline,scenario_margin_points:after,
    baseline_shares_pct:groups.map(g=>g.share_pct),scenario_shares_pct:shares.map(s=>100*s),
    relative_participation:relative,scenario_scale:scale,
    unit:'RELATIVE_ASSUMED_BASELINE_VOTERS_NOT_ELIGIBLE_POPULATION_TURNOUT'};
  }else shift=groups.reduce((x,g)=>x+g.share_pct*scale*g.margin_change_points/100,0);
  if(!n(shift)||Math.abs(shift)>12)
   return {ok:false,reason:'Combined sensitivity exceeds the ±12-point margin-shift limit'};
  const entries=[...basis.house,...basis.senate,...basis.governors].filter(r=>scope.has(r.state));
  if(new Set(entries.map(r=>r.state)).size!==states.length)
   return {ok:false,reason:'A selected state is missing from the 2026 model'};
  if(entries.some(r=>!n(r.mean)||typeof r.code!=='string'))
   return {ok:false,reason:'Race-level model priors unavailable'};
  const eligible=entries.filter(r=>r.nonrep_independent_proxy!==true),
   excluded=entries.filter(r=>r.nonrep_independent_proxy===true).map(r=>({race_code:r.code,
    reason:'INDEPENDENT_OR_NONREPUBLICAN_AXIS_NOT_A_DEMOCRATIC_VOTE_SHIFT'}));
  return {ok:true,state,states,shift,groups,affected:eligible.length,mode,
   scenario_scale:scale,assumed_composition:composition,excluded_axes:excluded};
 }
 function evaluate(basis,input,simulator,{samples=2000,seed=20261103}={}){
  const gate=validate(input,basis);
  if(!gate.ok)return {ok:false,reason:gate.reason};
  if(typeof simulator!=='function'||!Number.isInteger(samples)||samples<300||samples>10000||
    !Number.isSafeInteger(seed))return {ok:false,reason:'Simulation method or sample size invalid'};
  // Unmodified baseline and hypothetical state scenario receive precisely
  // the same random seed, error assumptions, candidate context and priors.
  // Change only the mean D-R margins of the selected state ballots.
  const shifted={...basis},scope=new Set(gate.states);
  for(const office of ['house','senate','governors'])
   shifted[office]=basis[office].map(r=>
    scope.has(r.state)&&r.nonrep_independent_proxy!==true?{...r,mean:r.mean+gate.shift}:r);
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
  const affected=[...basis.senate,...basis.governors,...basis.house].filter(r=>scope.has(r.state)&&r.nonrep_independent_proxy!==true)
   .map(r=>{
    const a=base[r.code],b=now[r.code];
    if(!a||!b||!n(a.dem_beats_rep_pct)||!n(b.dem_beats_rep_pct))return null;
    return {race_code:r.code,
      office:own(a,'office')?a.office:((basis.senate.includes(r))?'senate':'house'),
      before:a.dem_beats_rep_pct,after:b.dem_beats_rep_pct,
      change:b.dem_beats_rep_pct-a.dem_beats_rep_pct,
      before_margin_points:r.mean,after_margin_points:r.mean+gate.shift};
   }).filter(Boolean)
   .sort((x,y)=>Math.abs(y.change)-Math.abs(x.change)||x.race_code.localeCompare(y.race_code));
  if(affected.length!==gate.affected)return {ok:false,reason:'Incomplete affected-race results'};
  return {ok:true,status:'HYPOTHETICAL_PRE_ELECTION_SENSITIVITY_NOT_HEADLINE_FORECAST',
   state:gate.state,states:[...gate.states],groups:gate.groups.map(g=>({...g})),
   mode:gate.mode,scenario_scale:gate.scenario_scale,assumed_composition:gate.assumed_composition,
   excluded_axes:gate.excluded_axes.map(x=>({...x})),
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
