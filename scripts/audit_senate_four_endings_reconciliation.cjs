#!/usr/bin/env node
'use strict';
/**
 * Audit the live Senate forecast's transition from the initial 2026
 * candidate-neutral prior to late-cycle polling and symmetric, publicly
 * rated Solid unpolled races. Never uses subscriber forecast percentages.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const engine=require('./chamber_control_model.js');
const read=n=>JSON.parse(fs.readFileSync(path.join(__dirname,'..','data',n+'.json'),'utf8'));
const sources={seats:read('seat_universe'),history:read('house_history_2024_staging'),
 geography:read('house_geography_bridge'),senateHistory:read('senate_history_2020_2022_2024'),
 polls:read('polling_estimates'),odds:read('race_probabilities'),
 presidential:read('presidential_2024_by_2026_district_staging')};
const current=engine.prepare(sources,{senatePriorMode:'current_2026'});
const pollMap=new Map(sources.odds.records.filter(x=>x.office==='senate')
 .map(x=>[x.race_code,x]));
const previousSenateItem=item=>{
 const poll=pollMap.get(item.code);
 const originalPollWeight=poll?
  (poll.independent_firms>=3?.75:poll.independent_firms>=2?.72:.60):null;
 return {...item,
  sigma:item.public_solid_unpolled_party?15:item.sigma,
  mean:poll?originalPollWeight*poll.dem_minus_rep+
    (1-originalPollWeight)*item.candidate_neutral_2026_environment_margin_points:item.mean,
  poll_weight:poll?originalPollWeight:null
 };
};
const previous={...current,senate:current.senate.map(previousSenateItem)};
const pollOnly={...current,senate:current.senate.map((item,i)=>
 ({...item,sigma:previous.senate[i].sigma}))};
const solidOnly={...current,senate:current.senate.map((item,i)=>
 ({...item,mean:previous.senate[i].mean,
  poll_weight:previous.senate[i].poll_weight}))};
const cases=[
 ['initial_2026_live',previous,{}],
 ['late_cycle_poll_weight_only',pollOnly,{}],
 ['solid_unpolled_error_guard_only',solidOnly,{}],
 ['both_repairs_live',current,{}],
 ['both_repairs_without_independent_dem_caucus_credit',current,
  {independentSenateCredit:'no_credit'}]
];
const samples=10000,seed=20261103;
const outcomes=cases.map(([scenario,basis,flags])=>{
 const result=engine.simulate(basis,{samples,seed,...flags});
 return {scenario,
  house_dem_control_pct:result.house_dem_control_pct,
  senate_dem_control_pct:result.senate_dem_control_pct,
  dem_both_pct:result.blue_both_including_tsunami,
  blue_wave_pct:result.probabilities.blue_wave,
  blue_tsunami_pct:result.probabilities.blue_tsunami,
  shrug_pct:result.probabilities.shrug,
  red_dawn_pct:result.probabilities.red_dawn,
  expected_dem_aligned_senate_seats:result.means.senate_dem_seats};
});
assert(outcomes.every(x=>x.house_dem_control_pct===outcomes[0].house_dem_control_pct),
 'All Senate-only sensitivities must leave House control unchanged');
for(const x of outcomes){
 assert(Math.abs(x.blue_wave_pct+x.blue_tsunami_pct+
  x.shrug_pct+x.red_dawn_pct-100)<.03);
 assert(Math.abs(x.blue_wave_pct+x.blue_tsunami_pct-x.dem_both_pct)<.02);
}
const solid=current.senate.filter(x=>x.public_solid_unpolled_party);
assert.equal(solid.length,11);
const fullShared=Math.hypot(current.assumptions.common_national_sigma,
 current.assumptions.senate_chamber_sigma,current.assumptions.state_senate_sigma);
assert(solid.every(x=>Math.abs(Math.hypot(x.sigma,fullShared)-7)<1e-9));
const oldSim=engine.simulate(previous,{samples,seed});
const newSim=engine.simulate(current,{samples,seed});
assert.deepEqual(oldSim.race_probabilities.filter(x=>x.office==='house'),
 newSim.race_probabilities.filter(x=>x.office==='house'));
assert.deepEqual(oldSim.race_probabilities.filter(x=>x.office==='governor'),
 newSim.race_probabilities.filter(x=>x.office==='governor'));
const before=new Map(oldSim.race_probabilities.filter(x=>x.office==='senate')
 .map(x=>[x.race_code,x]));
const races=newSim.race_probabilities.filter(x=>x.office==='senate').map(x=>{
 const old=before.get(x.race_code);
 return {race_code:x.race_code,
  old_dem_win_pct:old.dem_beats_rep_pct,updated_dem_win_pct:x.dem_beats_rep_pct,
  change_pp:Math.round(100*(x.dem_beats_rep_pct-old.dem_beats_rep_pct))/100,
  current_poll_weight:current.senate.find(z=>z.code===x.race_code).poll_weight,
  solid_unpolled_party:current.senate.find(z=>z.code===x.race_code)
   .public_solid_unpolled_party};
}).sort((a,b)=>Math.abs(b.change_pp)-Math.abs(a.change_pp));
const output={
 status:'SENATE_CHAMBER_SHIFT_CURRENT_2026_COMPETITIVENESS_AUDIT',
 polling_source_generated_at:sources.polls.generated_at,
 source:'Inside Elections 2026-10-01 public Senate Solid classifications; current JackStradamus independent poll averages',
 source_url:'https://insideelections.com/ratings/senate/',
 historical_candidate_overperformance_used:false,
 user_paid_forecast_data_used:false,
 solid_rated_unpolled_races:solid.map(x=>({race_code:x.code,party:x.public_solid_unpolled_party})),
 samples,seed,outcomes,
 largest_race_probability_changes:races.slice(0,20),
 constraints:[
  'All scenarios use identical current qualified 2026 candidate poll averages and identical House and governor inputs.',
  'No-poll Solid prior is based on a public current-cycle qualitative rating; it is not an external publisher probability and the 7-point TOTAL margin error budget remains provisional.',
  'Poll weights 90/83/60 for 3+/2/1 independent firms reflect the less informative out-of-cycle candidate-neutral prior in October; do not claim retrospective calibration.',
  'The national/presidential-to-generic environment coefficient remains an assumed 0.55 and the polled Senate 8.5-point total sigma is unchanged.',
  'Nebraska and South Dakota independents are D-side race proxies; their caucus behavior and Senate control credit remain uncertain.',
  'Do not equate agreement with Silver or Inside Elections with measured electoral accuracy.'
 ]
};
if(process.argv.includes('--json'))console.log(JSON.stringify(output,null,2));
else{
 console.log('OCTOBER 2026 SENATE CHAMBER CONTROL RECONCILIATION (PUBLIC DATA ONLY)');
 console.table(outcomes);
 console.table(races.slice(0,15));
 console.log('Publicly rated Solid races with no polls:',solid.map(x=>x.code).join(', '));
}
