#!/usr/bin/env node
'use strict';
// Same-draw Senate sensitivity: partisan baseline vs uncertainty are
// distinct mechanisms. No paid-provider odds are copied into the repo.
const fs=require('node:fs'),path=require('node:path');
const model=require('./chamber_control_model.js');
const read=n=>JSON.parse(fs.readFileSync(path.join(__dirname,'..','data',n+'.json'),'utf8'));
const hist=read('historical_senate_poll_backtest');
const sources={seats:read('seat_universe'),history:read('house_history_2024_staging'),
 geography:read('house_geography_bridge'),
 senateHistory:read('senate_history_2020_2022_2024'),
 odds:read('race_probabilities'),polls:read('polling_estimates'),
 presidential:read('presidential_2024_by_2026_district_staging')};
if(hist.races_evaluated!==42||hist.status!=='retrospective_poll_research_not_calibrated_forecast'||
 !hist.records?.length||hist.can_calibrate_2026_win_probabilities!==false)
 throw Error('Historical Senate source not sufficient for diagnostic');
const group=new Map();
for(const r of hist.records){
 if(![2020,2022,2024].includes(r.cycle))throw Error('Unexpected historical race cycle');
 const error=r.methods?.recency21?.error;
 if(!Number.isFinite(error))throw Error('Invalid historical poll error');
 if(!group.has(r.cycle))group.set(r.cycle,[]);
 group.get(r.cycle).push(error);
}
const round=x=>Math.round(x*1000)/1000;
const historical=Object.fromEntries([...group].map(([year,errors])=>{
 const mean=errors.reduce((a,b)=>a+b,0)/errors.length;
 const rmse=Math.sqrt(errors.reduce((a,b)=>a+b*b,0)/errors.length);
 const within=Math.sqrt(errors.reduce((a,b)=>a+(b-mean)**2,0)/errors.length);
 return [year,{races:errors.length,average_signed_error:round(mean),
  total_rmse_points:round(rmse),within_year_scatter_points:round(within)}];
}));
if(hist.overall_recency21.rmse<4||hist.overall_recency21.rmse>8||
 historical[2020].races!==13||historical[2022].races!==14||
 historical[2024].races!==15)
 throw Error('Unexpected retrospective Senate sample coverage');
const modes=[
 ['current',{ }],
 ['total_error_budget_only',{senateErrorMode:'historical_total_budget_shadow'}],
 ['presidential_state_2024_prior_only',{
  senateFundamentalsMode:'presidential_2024_state_shadow'}],
 ['both_shadow_changes',{senateErrorMode:'historical_total_budget_shadow',
  senateFundamentalsMode:'presidential_2024_state_shadow'}]
];
const samples=4000,seed=20261103;
const named=['MN-SEN','ME-SEN','TX-SEN','OH-SEN','IA-SEN','MI-SEN','AK-SEN',
 'NH-SEN','NC-SEN','GA-SEN','NE-SEN','ID-SEN','SD-SEN','MT-SEN',
 'NJ-SEN','CO-SEN','VA-SEN'];
const runs={};
for(const [key,options] of modes){
 const b=model.prepare(sources,options),sim=model.simulate(b,{samples,seed});
 const index=new Map(sim.race_probabilities.map(x=>[x.race_code,x]));
 const poll=new Map(sources.polls.senate_all.map(x=>[x.race_code,x]));
 const input=new Map(b.senate.map(x=>[x.code,x]));
 runs[key]={
  dem_both_chambers_pct:sim.blue_both_including_tsunami,
  senate_dem_caucus_control_pct:sim.senate_dem_control_pct,
  independent_caucus_pivot_pct:sim.probabilities.independent_pivot,
  red_both_chambers_pct:sim.probabilities.red_dawn,
  race_estimates:named.map(code=>{
   const v=index.get(code),r=input.get(code),p=poll.get(code);
   if(!v||!r)throw Error('Missing Senate comparison race '+code);
   return {race_code:code,
    first_candidate_party:r.first_candidate_party,
    polling_margin_points:p?.dem_minus_rep??null,
    modeled_margin_points:round(r.mean),
    total_modeled_error_sd_points:v.sigma_points,
    first_candidate_win_pct:v.dem_beats_rep_pct,
    ballot_incomplete:Boolean(r.incomplete_ballot_caveat),
    independent_not_dem_caucus:r.first_candidate_party==='I'};
  })
 };
 const mn=runs[key].race_estimates.find(x=>x.race_code==='MN-SEN');
 if(!mn||mn.first_candidate_party!=='D'||mn.first_candidate_win_pct<45||
    sim.probabilities.independent_pivot<.01)
  throw Error('Missing Minnesota or independent Senate sensitivity');
}
const full=runs.current.race_estimates.find(x=>x.race_code==='MN-SEN');
const fixed=runs.total_error_budget_only.race_estimates.find(x=>x.race_code==='MN-SEN');
if(!(full.total_modeled_error_sd_points>8&&
 fixed.total_modeled_error_sd_points<6.5&&
 fixed.total_modeled_error_sd_points>=hist.overall_recency21.rmse-.01))
 throw Error('2020/2022/2024 total polling error must not be counted twice');
const report={
 schema_version:'senate-error-budget-and-state-prior-shadow-v1',
 status:'MODEL_DIAGNOSTIC_NOT_FORECAST_COEFFICIENT_CALIBRATION',
 independent_semantics_source:'2026 ballot/caucus announcements, primary source links in SENATE_BALLOT_AND_VARIANCE.md',
 source_polling_at:sources.polls.generated_at,
 historical_total_polling_error_rmse_points:hist.overall_recency21.rmse,
 historical_senate_poll_error_by_cycle:historical,
 historical_source_includes_joint_systematic_errors:true,
 assumptions:{
  polled_race_local_error_is_legacy_total_sigma:false,
  shadow_common_national_sd_points:3.5,
  shadow_senate_chamber_sd_points:2,
  shadow_same_state_sd_points:2,
  shadow_uncorrelated_residual_derived_from_total_budget:true,
  training_periods_used_to_set_sample:['2020','2022','2024'],
  fully_calibrated_out_of_sample:false
 },
 outcomes:runs,
 warnings:[
  'The historical 5.633-point RMSE includes national and other correlated errors; the old model added that full RMSE again as local noise.',
  'A variance budget prevents that specific double count but its split between national, Senate and state components is provisional, not empirically identified by 42 races.',
  'The 2024 state presidential-to-2026 generic-ballot extrapolation is a separately provisional mean assumption, not an incumbent-specific model.',
  'Montana independent Bodnar is not handled in a proper three-way ballot model. Alaska ranked-choice final round is not modeled.',
  'NE, ID and SD independent contenders are not treated as future Democratic caucus members under their current public pledges.',
  'Subscriber-provided Silver comparisons are NOT ingested or used to fit these coefficients.',
  'Do not interpret a 2020/2022/2024 research snapshot as a prospective election-day calibration.'
 ]
};
if(process.argv.includes('--json'))console.log(JSON.stringify(report,null,2));
else{
 console.log('Senate model: first-candidate probability audit (NO LIVE COEFFICIENT PROMOTION)');
 console.table(Object.entries(runs).map(([k,v])=>({
  model:k,
  mn_dem_pct:v.race_estimates.find(x=>x.race_code==='MN-SEN').first_candidate_win_pct,
  mn_modeled_margin:v.race_estimates.find(x=>x.race_code==='MN-SEN').modeled_margin_points,
  mn_total_sigma:v.race_estimates.find(x=>x.race_code==='MN-SEN').total_modeled_error_sd_points,
  senate_dem_control:v.senate_dem_caucus_control_pct,
  independent_pivot:v.independent_caucus_pivot_pct
 })));
 console.log('Historical error by election cycle:',historical);
}
