#!/usr/bin/env node
'use strict';
/*
 * House historical-vote reference / 2026 geography / uniform shift audit.
 * No proprietary table data, no automatic coefficient promotion.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const model=require('./chamber_control_model.js');
const read=n=>JSON.parse(fs.readFileSync(path.join(__dirname,'..','data',n+'.json'),'utf8'));
const src={
 seats:read('seat_universe'),history:read('house_history_2024_staging'),
 geography:read('house_geography_bridge'),
 senateHistory:read('senate_history_2020_2022_2024'),
 polls:read('polling_estimates'),odds:read('race_probabilities'),
 presidential:read('presidential_2024_by_2026_district_staging')};
const r3=x=>Math.round(x*1000)/1000;
const r2=x=>Math.round(x*100)/100;
const clip=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const margin=(d,r)=>100*(d-r)/(d+r);
const sum=(rows,d,r)=>rows.reduce((a,x)=>({
 d:a.d+(x[d]||0),r:a.r+(x[r]||0)}),{d:0,r:0});
const all=src.history.records;
const both=all.filter(x=>x.recorded_dem_votes>0&&x.recorded_rep_votes>0);
const totals=sum(all,'recorded_dem_votes','recorded_rep_votes');
const contested=sum(both,'recorded_dem_votes','recorded_rep_votes');
const pres=src.presidential;
assert.equal(pres.district_map_year_claimed,2026);
assert.equal(pres.status,'historical_presidential_votes_from_external_model_source_not_forecast');
assert.equal(pres.records.length,435);
assert(pres.external_source_blob_sha);
const seen=new Set(),statePres=new Map();
for(const row of pres.records){
 assert(!seen.has(row.race_code),'duplicate 2026-map district '+row.race_code);
 seen.add(row.race_code);
 const item=statePres.get(row.state)||{d:0,r:0,count:0};
 item.d+=row.dem_pres_2024_votes;item.r+=row.rep_pres_2024_votes;item.count++;
 statePres.set(row.state,item);
}
const currentIds=new Set(src.seats.house.seats.map(x=>x.race_code));
assert.equal(currentIds.size,435);
assert([...seen].every(x=>currentIds.has(x)),'Presidential votes mismapped to obsolete House districts');
const nationalPres=sum(pres.records,'dem_pres_2024_votes','rep_pres_2024_votes');
assert(Math.abs(margin(nationalPres.d,nationalPres.r)-
 pres.national_reference_two_party_margin_points)<.002);
const base=model.prepare(src);
const geographical=model.prepare(src,{fundamentalsMode:'presidential_2024_shadow'});
assert.deepEqual(geographical.senate,base.senate,'House geography cannot modify Senate assumptions');
assert.deepEqual(geographical.governors,base.governors,'House geography cannot modify governor assumptions');
assert.equal(base.house.length,435);
assert.equal(base.house.filter(x=>x.polled).length,60);
assert.equal(src.history.records.length-both.length,
 src.history.districts_missing_major_party_votes,
 'Historical major-party coverage metadata must reconcile with the staged voting records');
const redrawn=src.geography.districts.filter(x=>x.geography_comparable_2024===false);
assert.equal(redrawn.length,173);
assert.equal(base.house.filter(x=>x.redrawn_mix_weight>0).length,173);
assert.equal(geographical.house.filter(x=>x.redrawn_mix_weight>0).length,0);
const rawReference=margin(totals.d,totals.r);
const contestedReference=margin(contested.d,contested.r);
const presidentialReference=margin(nationalPres.d,nationalPres.r);
const generic=src.polls.generic_ballot.dem_minus_rep;
const swingFactor=.68;
const rawSwing=swingFactor*(generic-rawReference);
const contestedSwing=swingFactor*(generic-contestedReference);
const presidentialSwing=swingFactor*(generic-presidentialReference);
const corrected=(reference,code)=>{
 // Isolate NATIONAL calibration reference, retaining 2024 district results
 // and each poll's original independent-firm weight. No geography changes.
 const change=swingFactor*(rawReference-reference);
 return {...base,house:base.house.map(x=>{
  const priorFraction=1-(x.poll_weight??0);
  return {...x,mean:clip(x.mean+priorFraction*change,-60,60),
   method:'research_reference_'+code+'_'+x.method};
 })};
};
const scenarios=[
 {name:'headline',basis:base},
 {name:'contested_only_2024_house_national_reference',basis:corrected(contestedReference,'contested')},
 {name:'2024_presidential_national_reference_only',basis:corrected(presidentialReference,'presidential')},
 {name:'2024_presidential_2026_geography_shadow',basis:geographical}
];
const samples=4500,seed=20261103;
const effects=scenarios.map((c,i)=>{
 const sim=model.simulate(c.basis,{samples,seed,explainControl:i===0});
 const bws=i===0?sim.control_explanation.top_house_control_bellwethers:null;
 if(i===0){
  assert.equal(bws.length,25);
  assert(bws.every((x,j)=>j===0||bws[j-1].control_covariance_pp>=x.control_covariance_pp));
 }
 return {
  case:c.name,
  d_house_seat_mean:sim.means.house_dem_seats,
  d_house_control_in_model_pct:sim.house_dem_control_pct,
  house_seat_p05:sim.seat_intervals_90_pct.house_dem_seats.p05,
  house_seat_median:sim.seat_intervals_90_pct.house_dem_seats.p50,
  house_seat_p95:sim.seat_intervals_90_pct.house_dem_seats.p95,
  d_senate_control_in_model_pct:sim.senate_dem_control_pct,
  modeled_house_geo_redraw_exchangeable_seats:c.basis.house.filter(x=>x.redrawn_mix_weight>0).length,
  house_top_same_draw_control_bellwethers:bws
 };
});
assert(effects.slice(0,3).every(x=>x.d_senate_control_in_model_pct===effects[0].d_senate_control_in_model_pct),
 'National House baseline alternatives use identical Senate draws');
// The 2026-map geography scenario does not reshuffle redrawn 2024 margins.
// That deliberately changes the PRNG stream, so compare Senate distributions
// with Monte Carlo tolerance rather than requiring same-draw identity.
assert(Math.abs(effects[3].d_senate_control_in_model_pct-
 effects[0].d_senate_control_in_model_pct)<3,
 'House-only geography should preserve Senate marginals statistically');
const curveshift=[-6,-4,-2,0,2,4,6];
const curveSamples=3000;
const curve=curveshift.map(shift=>{
 const b={...base,house:base.house.map(x=>({...x,mean:clip(x.mean+shift,-60,60)}))};
 const sim=model.simulate(b,{samples:curveSamples,seed});
 return {
  common_house_margin_shift_from_current_points:shift,
  simulated_house_dem_seats:sim.means.house_dem_seats,
  simulated_house_90_pct_interval:sim.seat_intervals_90_pct.house_dem_seats,
  simulated_dem_house_control_pct:sim.house_dem_control_pct
 };
});
for(let i=1;i<curve.length;i++){
 assert(curve[i].simulated_house_dem_seats>=curve[i-1].simulated_house_dem_seats);
 assert(curve[i].simulated_dem_house_control_pct>=curve[i-1].simulated_dem_house_control_pct);
}
assert(effects[0].d_house_seat_mean>=0);
const redrawnByState=Object.entries(redrawn.reduce((a,x)=>{
 (a[x.state]??=[]).push(x);return a;
},{}))
 .map(([state,items])=>({state,redrawn_2026_seats:items.length,
  presidential_2024_state_margin:r3(margin(statePres.get(state).d,statePres.get(state).r))}))
 .sort((a,b)=>a.state.localeCompare(b.state));
assert.equal(redrawnByState.reduce((n,x)=>n+x.redrawn_2026_seats,0),173);
const report={
 status:'HOUSE_NATIONAL_REFERENCE_AND_SEAT_RESPONSE_RESEARCH_ONLY',
 source_polling_at:src.polls.generated_at,
 '2024_reference_eligible_count':both.length,
 '2024_missing_two_party_vote_count':all.length-both.length,
 '2024_recorded_house_margin_D_minus_R':r3(rawReference),
 '2024_both_major_house_margin_D_minus_R':r3(contestedReference),
 '2024_presidential_on_2026_district_margin_D_minus_R':r3(presidentialReference),
 '2026_current_generic_ballot_margin_D_minus_R':r3(generic),
 '2024_recorded_house_to_generic_implied_swing':r3(rawSwing),
 '2024_contested_house_to_generic_implied_swing':r3(contestedSwing),
 '2024_presidential_to_generic_implied_swing':r3(presidentialSwing),
 house_prior_swing_factor:swingFactor,
 '2026_house_polled_races':base.house.filter(x=>x.polled).length,
 '2026_house_unpolled_races':base.house.filter(x=>!x.polled).length,
 '2026_redrawn_districts':redrawn.length,
 presidential_geo_source_sha:pres.external_source_blob_sha,
 presidential_mapped_districts:seen.size,
 redrawn_by_state:redrawnByState,
 samples_per_scenario:samples,seed,
 model_scenarios:effects,
 house_margin_shift_response:{
  samples:curveSamples,seed,
  meaning:'Uniform increase in candidate two-party margins at all House races, holding Senate and governors unchanged. NOT an actual popular vote forecast or conditioning on realised nationwide popular vote.',
  curve},
 limitations:[
  'The entire recorded House two-party margin is distorted by 44 uncontested or single-major-party races. Dropping those 44 races changes the geographic population and is NOT an unbiased national House vote estimator.',
  'Presidential 2024 voting differs from 2024 House voting and was evaluated on mapped 2026 districts; reference substitution requires out-of-sample backtesting.',
  'The current headline treats 173 remapped districts as exchangeable state-level prior seat margins, not district-specific candidate histories.',
  'Shared error terms mean a national House popular-vote percentile is not equivalent to simply adding a uniform candidate margin shift; do not label this an exact popular-vote-to-seats map.',
  'All seat percentages are uncalibrated model sensitivities; Silver subscriber-only forecasts are not imported or stored.',
  'No incumbent coefficients, candidate votes, live odds or production assumptions have changed.'
 ]
};
if(process.argv.includes('--json'))console.log(JSON.stringify(report,null,2));
else{
 console.log('HOUSE 2024 VOTE REFERENCE + 2026 SEAT RESPONSE AUDIT (NONPROMOTED)');
 console.table({
  recorded_2024_house_reference_r3:r3(rawReference),
  'contested_391_house_reference_r3':r3(contestedReference),
  mapped_2024_presidential_reference_r3:r3(presidentialReference),
  generic_ballot_r3:r3(generic),
  missing_competitive_two_party_races:all.length-both.length
 });
 console.table(effects.map(x=>({case:x.case,mean_seats:x.d_house_seat_mean,
  house_control_model_pct:x.d_house_control_in_model_pct,redrawn_exchangeable:x.modeled_house_geo_redraw_exchangeable_seats})));
 console.table(curve);
 console.log('Top House model-control bellwethers (descriptive covariance, not voter power):');
 console.table(effects[0].house_top_same_draw_control_bellwethers.slice(0,12));
}
