#!/usr/bin/env node
'use strict';
/*
 * Modern-era incumbent robustness audit. Only outcomes in 2022/2024 and
 * 2020 presidential geographic baselines; no pre-2020 House elections.
 * All experimental coefficients remain OFF in production forecasts.
 */
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..','data');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name+'.json'),'utf8'));
const study=read('incumbent_persistence_2022_2024');
const names=read('house_2022_candidate_results_staging');
const history=read('house_history_2022_staging');
const presidential=read('presidential_2020_by_2026_district_staging');
const rounded=n=>Math.round(n*1000)/1000;
function inputCheck(){
 if(study.schema_version!=='incumbent-strength-persistence-2022-2024-v1'||
    study.status!=='HISTORICAL_PERSISTENCE_HOLDOUT_NOT_PROVEN_2026_FORECAST'||
    study.held_out_previous_winner_sample!==153||
    names.year!==2022||names.records.length!==435||
    history.records.length!==435||
    presidential.coverage?.districts!==435||
    study.records.some(r=>!Number.isFinite(r.prior_2022)||!Number.isFinite(r.realized_2024)))
  throw Error('Invalid modern-incumbent source universe');
 const codes=new Set(study.records.map(x=>x.race_code));
 if(codes.size!==153)throw Error('Duplicate current-era candidate record');
 const refs=[study.source_provenance.house_2022,study.source_provenance.house_2024,
  study.source_provenance.presidential_2020,study.source_provenance.presidential_2024];
 if(refs.some(x=>typeof x!=='string'||!x))throw Error('Source history missing');
}
const indexed=records=>new Map(records.map(r=>[r.race_code||r['2022_race_code'],r]));
function score(rows){
 if(!rows.length)return null;
 const stats=k=>({
  rmse:rounded(Math.sqrt(rows.reduce((a,r)=>a+r[k]*r[k],0)/rows.length)),
  mae:rounded(rows.reduce((a,r)=>a+Math.abs(r[k]),0)/rows.length)
 });
 const base=stats('error_zero'),cv=stats('error_cv'),full=stats('error_full_transfer');
 return {sample:rows.length,zero:base,modern_heldout_cv:cv,full_carryover:full,
  cv_rmse_gain_over_zero:rounded(base.rmse-cv.rmse),
  cv_mae_gain_over_zero:rounded(base.mae-cv.mae),
  cv_improves_zero:cv.rmse<base.rmse};
}
function prng(seed){let state=seed>>>0;return()=>{
 state^=state<<13;state^=state>>>17;state^=state<<5;
 return (state>>>0)/4294967296;
}}
function quantile(sorted,p){return rounded(sorted[Math.floor((sorted.length-1)*p)]);}
function clusteredBootstrap(rows,seed=20261103,samples=1200){
 const states=new Map();
 for(const r of rows){if(!states.has(r.state))states.set(r.state,[]);states.get(r.state).push(r);}
 const groups=[...states.values()],random=prng(seed),lambda=[],gains=[];
 for(let i=0;i<samples;i++){
  const selected=[];
  for(let j=0;j<groups.length;j++)selected.push(...groups[Math.floor(random()*groups.length)]);
  const x2=selected.reduce((sum,r)=>sum+r.prior_2022*r.prior_2022,0);
  const xy=selected.reduce((sum,r)=>sum+r.prior_2022*r.realized_2024,0);
  const fitted=Math.max(0,Math.min(.8,xy/(x2+20*selected.length)));
  lambda.push(fitted);
  const base=Math.sqrt(selected.reduce((sum,r)=>sum+r.error_zero**2,0)/selected.length);
  const cv=Math.sqrt(selected.reduce((sum,r)=>sum+r.error_cv**2,0)/selected.length);
  gains.push(base-cv);
 }
 lambda.sort((a,b)=>a-b);gains.sort((a,b)=>a-b);
 return {unit:'state_cluster',resamples:samples,seed,
  shrink_coefficient_p05:quantile(lambda,.05),shrink_coefficient_median:quantile(lambda,.50),
  shrink_coefficient_p95:quantile(lambda,.95),
  heldout_rmse_gain_p05:quantile(gains,.05),
  heldout_rmse_gain_median:quantile(gains,.50),
  heldout_rmse_gain_p95:quantile(gains,.95),
  state_cluster_fraction_with_positive_gain:rounded(gains.filter(v=>v>0).length/samples),
  interpretation:'Diagnostic cluster resampling, not validated 2026 prediction interval'};
}
function analyze(){
 inputCheck();
 const candidate=indexed(names.records),house=indexed(history.records),
  pres=indexed(presidential.records);
 const rows=study.records.map(r=>{
  const h=house.get(r.race_code),n=candidate.get(r.race_code),p=pres.get(r.race_code);
  if(!h||!n||!p||!n.source_votes_match_mit_staging||
    p.same_district_boundaries_2022_2024_2026!==true||
    n.dem_votes!==h.recorded_dem_votes||n.rep_votes!==h.recorded_rep_votes)
   throw Error('Qualified candidate vote/geometry mismatch '+r.race_code);
  const party=h.recorded_dem_votes>h.recorded_rep_votes?'DEM':'REP';
  const firstname=party==='DEM'?n.dem_name:n.rep_name;
  const notIncumbent=party==='DEM'?!n.dem_was_incumbent_on_2022_ballot:
    !n.rep_was_incumbent_on_2022_ballot;
  const presLean=100*(p.dem_votes-p.rep_votes)/(p.dem_votes+p.rep_votes);
  const previousHouseMargin=100*(h.recorded_dem_votes-h.recorded_rep_votes)/
   (h.recorded_dem_votes+h.recorded_rep_votes);
  return {...r,party,candidate_name:firstname,
   not_incumbent_on_2022_ballot:notIncumbent,
   presidential_2020_margin_d_minus_r:presLean,
   previous_house_margin_d_minus_r:previousHouseMargin};
 });
 const cohorts={
  all_modern_2022_2024:rows,
  presidential_lean_within_10_points:rows.filter(x=>Math.abs(x.presidential_2020_margin_d_minus_r)<=10),
  presidential_lean_within_20_points:rows.filter(x=>Math.abs(x.presidential_2020_margin_d_minus_r)<=20),
  presidential_lean_over_20_points:rows.filter(x=>Math.abs(x.presidential_2020_margin_d_minus_r)>20),
  previous_house_margin_within_10_points:rows.filter(x=>Math.abs(x.previous_house_margin_d_minus_r)<=10),
  not_incumbent_on_2022_ballot:rows.filter(x=>x.not_incumbent_on_2022_ballot),
  incumbent_on_2022_ballot:rows.filter(x=>!x.not_incumbent_on_2022_ballot),
  democratic_2022_winners:rows.filter(x=>x.party==='DEM'),
  republican_2022_winners:rows.filter(x=>x.party==='REP')
 };
 const cohortScores=Object.fromEntries(Object.entries(cohorts).map(([k,v])=>[k,{
  ...score(v),n_states:new Set(v.map(x=>x.state)).size,
  uncertainty:'Exploratory subgroup in one recent cycle; not separately calibrated'
 }]));
 const bootstrap=clusteredBootstrap(rows);
 const coefficientSpread={
  min:rounded(Math.min(...rows.map(x=>x.fitted_out_of_state_coefficient))),
  median:rounded([...rows.map(x=>x.fitted_out_of_state_coefficient)].sort((a,b)=>a-b)[Math.floor((rows.length-1)/2)]),
  max:rounded(Math.max(...rows.map(x=>x.fitted_out_of_state_coefficient)))
 };
 return {schema_version:'modern-incumbency-robustness-2022-2024-v1',
  status:'MODERN_ERA_DIAGNOSTIC_NO_HEADLINE_FORECAST_PROMOTION',
  allowed_model_fit_election_years:[2022,2024],
  prior_presidential_geography_context_year:2020,
  excluded_older_house_elections:'All House outcome elections before 2022 are deliberately excluded',
  cohort_scores:cohortScores,
  baseline_loso_coefficient:study.fitting.full_sample_coefficient,
  per_state_heldout_coefficient_spread:coefficientSpread,
  state_cluster_bootstrap:bootstrap,
  candidate_selection_warning:'Only 2022 winners seeking reelection in 2024. 149 wins and 4 losses; low failure-rate makes binary winner calibration impossible.',
  observed_cycle_warning:'A single 2022-midterm to 2024-presidential period cannot independently validate the reverse 2024-presidential to 2026-midterm setting.',
  next_step:'Add current 2026 polls, recent district partisanship and cross-race covariance; keep conservative generic uncertainty rather than fitting extra subgroup coefficients on small cells.',
  conclusion:'Use 2022-2024 as main retrospective evidence; stratified modern cohorts and cluster bootstrap stress-test but do not justify live candidate-strength promotion.'};
}
const result=analyze();
if(process.argv.includes('--check')){
 const expected=read('modern_incumbency_robustness_2022_2024');
 if(JSON.stringify(result)!==JSON.stringify(expected))
  throw Error('Modern incumbency audit artifact is out of date');
 if(result.cohort_scores.all_modern_2022_2024.sample!==153||
    result.allowed_model_fit_election_years.join(',')!=='2022,2024'||
    result.cohort_scores.not_incumbent_on_2022_ballot.sample===0)
  throw Error('Modern incumbent audit failed its core checks');
}
if(process.argv.includes('--json'))console.log(JSON.stringify(result,null,2));
else {
 console.log('Modern-era House candidate strength — 2022 and 2024 ONLY');
 console.table(Object.entries(result.cohort_scores).map(([k,v])=>({
  group:k,n:v.sample,states:v.n_states,rmse_zero:v.zero.rmse,
  rmse_crossval:v.modern_heldout_cv.rmse,
  improvement:v.cv_rmse_gain_over_zero
 })));
 console.log('State-cluster sensitivity:',result.state_cluster_bootstrap);
 console.log('No headline odds changed.');
}
