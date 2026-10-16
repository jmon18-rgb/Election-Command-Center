/* Static, independently sourced 2026 Senate holdover baseline audit.
 * No 2026 winners, professional calls or live probability adjustments.
 * A disputed seat/party count must fail CI instead of silently shifting control.
 */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.SenateHoldoverAudit=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const SCHEMA='official-senate-holdover-snapshot-2026-10-16-v1';
 function audit(ledger,universe,assumptions=null){
  if(!ledger||ledger.schema_version!==SCHEMA||
    !/^2026-10-\d{2}$/.test(ledger.as_of||'')||
    ledger.sources?.class_I!=='https://www.senate.gov/senators/Class_I.htm'||
    ledger.sources?.class_III!=='https://www.senate.gov/senators/Class_III.htm'||
    !Array.isArray(ledger.holdovers)||ledger.holdovers.length!==65||
    !Array.isArray(ledger.seats_excluded_because_special_2026)||
    ledger.seats_excluded_because_special_2026.length!==2)
   throw Error('Unverified official 2026 Senate holdover evidence');
  if(universe?.senate?.total_seats!==100||
    universe.senate.contested_regular!==33||
    universe.senate.contested_special!==2||
    universe.senate.contested_total!==35||
    universe.senate.holdover_total!==65||
    !Array.isArray(universe.senate.contested_seats)||
    universe.senate.contested_seats.length!==35)
   throw Error('Senate ballot inventory does not reconcile to 100 seats');
  const states=universe.house?.by_state;
  if(!states||Object.keys(states).length!==50)
   throw Error('Official House state list unavailable for Senate state validation');
  const specials=universe.senate.contested_seats
   .filter(s=>s.election_kind==='special'&&s.seat_class==='III')
   .map(s=>s.state).sort().join(',');
  if(specials!=='FL,OH'||universe.senate.contested_seats
    .filter(s=>s.election_kind==='regular'&&s.seat_class==='II').length!==33)
   throw Error('2026 Class III special election seats not excluded properly');
  const excluded=ledger.seats_excluded_because_special_2026
   .map(s=>s.class==='III'&&s.party==='R'?s.state:'invalid')
   .sort().join(',');
  if(excluded!=='FL,OH')
   throw Error('Official special-election exclusions mismatch');
  const seen=new Set(),counts={D:0,R:0,I:0},classes={I:0,III:0},
   caucus={D:0,R:0},independents=[];
  for(const s of ledger.holdovers){
   if(!s||!states[s.state]||!['I','III'].includes(s.class)||
      !['D','R','I'].includes(s.party)||
      s.seat!==s.class+'|'+s.state||
      typeof s.senator!=='string'||!s.senator.trim()||
      s.senator.length>100||s.caucus!==(s.party==='I'?'D':s.party)||
      s.class==='III'&&['FL','OH'].includes(s.state)||
      seen.has(s.seat))
    throw Error('Duplicated, out-of-class or malformed official Senate holdover');
   seen.add(s.seat);counts[s.party]++;classes[s.class]++;caucus[s.caucus]++;
   if(s.party==='I')independents.push(s.state+':'+s.senator);
  }
  if(counts.D!==32||counts.I!==2||counts.R!==31||
    classes.I!==33||classes.III!==32||
    caucus.D!==34||caucus.R!==31||
    independents.sort().join('|')!=='ME:Angus King|VT:Bernie Sanders')
   throw Error('Official 2026 caucus baseline does not reconcile');
  if(assumptions&&(assumptions.senate_contested!==35||
    assumptions.senate_dem_holdovers!==caucus.D||
    assumptions.senate_rep_holdovers!==caucus.R))
   throw Error('Forecast Senate holdover parameters diverge from official roster');
  return Object.freeze({
   verified_official_static_baseline:true,as_of:ledger.as_of,
   holdovers:65,contested:35,party:counts,caucus,classes,
   independent_caucus_credit:2,
   callable_2026_race_winners:0,
   independently_verified_2026_election_calls:0,
   can_override_forecast_parameters:false,
   note:'Class I and non-special Class III seat roster only; does not predict 2026 outcomes'
  });
 }
 return Object.freeze({SCHEMA,audit});
});
