#!/usr/bin/env node
'use strict';
/*
 * Inspect the pre-poll Senate prior: old candidate effects can accidentally be
 * carried forward when the prior is a 2020 Senate contest with a different
 * 2026 field. Independent research diagnostic, no changes to live odds.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const chamber=require('./chamber_control_model.js');
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'..','data',name+'.json'),'utf8'));
const finite=Number.isFinite,round=x=>Math.round(x*1000)/1000;
const margin=(d,r)=>100*(d-r)/(d+r);
const normalize=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
 .toUpperCase().replace(/[^A-Z ]/g,' ').replace(/\s+/g,' ').trim();
const firstLast=s=>{const w=normalize(s).split(' ');return w.length<2?'':w[0]+' '+w[w.length-1]};

function evaluate(s){
 const pres=s.presidential,study=s.candidateOverperformance;
 if(pres?.schema_version!=='presidential-district-lean-staging-v1'||
  pres.status!=='historical_presidential_votes_from_external_model_source_not_forecast'||
  pres.election_year!==2024||pres.district_map_year_claimed!==2026||
  !pres.external_source_blob_sha||!Array.isArray(pres.records)||
  pres.records.length!==435)
  throw Error('Unverified 2024 presidential 2026-map source');
 if(study?.status!=='DESCRIPTIVE_HISTORICAL_CANDIDATE_RESIDUALS_NOT_VALIDATED_PREDICTIONS'||
  !Array.isArray(study.records)||study.records.length!==506)
  throw Error('Unverified historical incumbent identity source');
 const inc=new Map(study.records.filter(x=>x.office==='senate').map(x=>[x.race_code,x]));
 if(inc.size!==35)throw Error('Incomplete historical Senate identity study');
 const observed=chamber.prepare(s);
 const senate=observed.senate;
 const expected=new Set(s.seats.house.seats.map(x=>x.race_code));
 const statePres=new Map(),visited=new Set();
 let natD=0,natR=0;
 for(const row of pres.records){
  if(!expected.has(row.race_code)||visited.has(row.race_code)||
   row.state!==row.race_code.slice(0,2)||
   !Number.isSafeInteger(row.dem_pres_2024_votes)||row.dem_pres_2024_votes<=0||
   !Number.isSafeInteger(row.rep_pres_2024_votes)||row.rep_pres_2024_votes<=0)
   throw Error('Bad or duplicated presidential geography '+row.race_code);
  if(Math.abs(margin(row.dem_pres_2024_votes,row.rep_pres_2024_votes)-
    row.dem_minus_rep_two_party_points)>.002)
   throw Error('Presidential district margin mismatch '+row.race_code);
  visited.add(row.race_code);
  const st=statePres.get(row.state)||{d:0,r:0,n:0};
  st.d+=row.dem_pres_2024_votes;st.r+=row.rep_pres_2024_votes;st.n++;
  statePres.set(row.state,st);
  natD+=row.dem_pres_2024_votes;natR+=row.rep_pres_2024_votes;
 }
 if(visited.size!==435||statePres.size!==50||
  Math.abs(margin(natD,natR)-pres.national_reference_two_party_margin_points)>.003)
  throw Error('Incomplete or incompatible statewide presidential returns');
 const houseStats=new Map(),allHouse={d:0,r:0};
 for(const h of s.history.records){
  const state=h['2024_race_code']?.slice(0,2);
  if(!state||!finite(h.recorded_dem_votes)||!finite(h.recorded_rep_votes))
   throw Error('Invalid 2024 House statewide prior source');
  const st=houseStats.get(state)||{d:0,r:0};
  st.d+=h.recorded_dem_votes;st.r+=h.recorded_rep_votes;
  allHouse.d+=h.recorded_dem_votes;allHouse.r+=h.recorded_rep_votes;
  houseStats.set(state,st);
 }
 const generic=s.polls.generic_ballot.dem_minus_rep;
 const currentSwing=.68*.68*(generic-margin(allHouse.d,allHouse.r));
 const presSwing=.68*(generic-margin(natD,natR));
 const prev2020=new Map(s.senateHistory.contest_records.filter(x=>
  x.election_year===2020&&x.election_type==='regular').map(x=>[x.state,x]));
 const names=new Map(s.polls.senate_all.map(x=>[x.race_code,x]));
 const polls=new Map(s.odds.records.filter(x=>x.office==='senate')
  .map(x=>[x.race_code,x]));
 let pollCount=0,reconstructionCount=0;
 const rows=senate.map(row=>{
  const old=prev2020.get(row.state),p=polls.get(row.code);
  const relevant=old&&!old.missing_major_party_vote&&
   old.recorded_dem_votes>0&&old.recorded_rep_votes>0&&!row.special;
  const house=houseStats.get(row.state),state=statePres.get(row.state);
  if(!house||!state||!inc.has(row.code))throw Error('Missing state evidence '+row.code);
  const currentHistoricallyEmbedded=relevant?
   .65*(200*old.dem_share_of_two_party-100)+
   .35*margin(house.d,house.r):margin(house.d,house.r);
  const currentPrior=currentHistoricallyEmbedded+currentSwing;
  const presStateMargin=margin(state.d,state.r);
  const candidateNeutralPrior=presStateMargin+presSwing;
  const pollInput=names.get(row.code),historicalIdentity=inc.get(row.code);
  let historicalWinner=null;
  if(relevant){
   const winnerGroup=old.recorded_dem_votes>old.recorded_rep_votes?'D':'R';
   const winners=old.candidates.filter(c=>c.party_group===winnerGroup)
    .sort((a,b)=>b.votes-a.votes);
   historicalWinner=winners[0]?.name||null;
  }
  const currentNames=pollInput?
   [pollInput.dem_candidate,pollInput.rep_candidate].map(firstLast):[];
  const historyMatch=historicalWinner?
   currentNames.includes(firstLast(historicalWinner)):false;
  const continuity=row.special?'different_seat_special':
   !relevant?'historical_regular_unusable':
   !pollInput?'no_named_2026_matchup':
   historyMatch?'2020_winner_on_2026_poll_ballot':'2020_winner_not_on_2026_poll_ballot';
  const priorGaps=p?{current_model:round(p.dem_minus_rep-currentPrior),
   neutral_geography:round(p.dem_minus_rep-candidateNeutralPrior)}:null;
  const modelMean=p?Math.max(-55,Math.min(55,p.independent_firms>=2?
    .90*p.dem_minus_rep+.10*currentPrior:
    .78*p.dem_minus_rep+.22*currentPrior)):
   Math.max(-55,Math.min(55,currentPrior));
  if(Math.abs(row.mean-modelMean)>1e-7)
   throw Error('Actual deployed Senate prior cannot be reconstructed '+row.code);
  reconstructionCount++;
  if(p)pollCount++;
  if(historicalIdentity.status==='matched_historic_winner_2020'&&
   !historyMatch&&pollInput)
   throw Error('Matched Senate incumbent research contradicts 2026 matchup '+row.code);
  return {
   race_code:row.code,state:row.state,poll_status:row.polled?'qualified':'no_qualified_poll',
   independent_proxy_not_dem_party:row.nonrep_independent_proxy,
   source_2026_dem_side_candidate:pollInput?.dem_candidate??null,
   source_2026_rep_candidate:pollInput?.rep_candidate??null,
   prior_2020_regular_senate_margin:relevant?
    round(margin(old.recorded_dem_votes,old.recorded_rep_votes)):null,
   previous_winner:historicalWinner,
   candidate_continuity:continuity,
   matched_incumbent_relative_history:historicalIdentity.status==='matched_historic_winner_2020'?
    historicalIdentity.candidate_signed_capped_excess_margin_points:null,
   historic_identity_study_status:historicalIdentity.status,
   recorded_2024_state_house_margin:round(margin(house.d,house.r)),
   recorded_2024_state_presidential_margin:round(presStateMargin),
   current_2026_poll_margin:p?round(p.dem_minus_rep):null,
   original_pre_poll_baseline_margin:round(currentPrior),
   candidate_neutral_2024_presidential_shadow_prior:round(candidateNeutralPrior),
   poll_minus_prior_points:priorGaps,
   model_poll_weight:p?row.poll_weight:null,
   source_reconciled:true
  };
 }).sort((a,b)=>a.race_code.localeCompare(b.race_code));
 if(rows.length!==35||reconstructionCount!==35||pollCount!==24)
  throw Error('Incomplete Senate poll-versus-prior diagnosis');
 const counts=Object.fromEntries([...new Set(rows.map(x=>x.candidate_continuity))]
  .sort().map(c=>[c,rows.filter(x=>x.candidate_continuity===c).length]));
 const sorted=rows.filter(x=>x.poll_minus_prior_points).slice()
  .sort((a,b)=>Math.abs(b.poll_minus_prior_points.current_model)-
   Math.abs(a.poll_minus_prior_points.current_model));
 return {
  status:'SENATE_PRIOR_CONTINUITY_DIAGNOSTIC_NOT_FORECAST',
  snapshot:s.polls.generated_at,
  presidential_2024_external_source_sha:pres.external_source_blob_sha,
  election_year_reference:2024,
  qualified_senate_matchups:pollCount,senate_seats:rows.length,
  source_model_exact_reconstruction:true,
  verified_historic_candidate_identity_count:rows.filter(x=>
   x.matched_incumbent_relative_history!==null).length,
  continuity_counts:counts,
  current_model_national_swing_assumption:round(currentSwing),
  presidential_2024_shadow_national_swing_assumption:round(presSwing),
  largest_poll_vs_original_prior_disagreements:sorted.slice(0,12)
   .map(x=>({race_code:x.race_code,poll_minus_prior_points:x.poll_minus_prior_points,
    candidate_continuity:x.candidate_continuity,
    historic_identity_study_status:x.historic_identity_study_status})),
  records:rows,
  caveats:[
   'The existing prior mixes 2020 regular Senate outcomes, 2024 recorded House votes and generic ballot; candidate changes can make 2020 results an unsuitable personal-strength prior.',
   'The 2024 presidential state prior is a research-only geographic benchmark, not a final Senate forecast or an externally calibrated fundamentals model.',
   '2024 recorded House two-party totals are biased by uncontested districts and cannot be assumed identical to statewide presidential vote definitions.',
   'No Silver paid-subscription table or proprietary forecast numbers are stored or imported.',
   'Incumbent residuals are provenance-linked historical measurements, not automatic bonuses and not causal effects.',
   'No public odds, political outcome prediction or central model coefficients were changed.'
  ]
 };
}
if(require.main===module){
 const sources={seats:read('seat_universe'),history:read('house_history_2024_staging'),
  geography:read('house_geography_bridge'),
  senateHistory:read('senate_history_2020_2022_2024'),
  odds:read('race_probabilities'),polls:read('polling_estimates'),
  presidential:read('presidential_2024_by_2026_district_staging'),
  candidateOverperformance:read('historical_candidate_overperformance_2026')};
 const out=evaluate(sources);
 if(process.argv.includes('--json'))console.log(JSON.stringify(out,null,2));
 else{
  console.log('SENATE 2026 PRIOR CONTINUITY RESEARCH (not a forecast)');
  console.log('Verified current deployed-model reconstruction:',out.source_model_exact_reconstruction);
  console.log('2020 winner continuity:',out.continuity_counts);
  console.table(out.largest_poll_vs_original_prior_disagreements);
  console.log('No current public forecast numbers were changed.');
 }
}
module.exports={evaluate};
