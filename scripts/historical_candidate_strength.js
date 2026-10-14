/* Historical relative candidate performance — NOT a probability forecast.
 * The residual is candidate margin vs same-year partisan vote margin, less
 * the within-office same-year divergence (robust weighted trimmed mean).
 * It must never be interpreted as causal incumbency advantage. */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.JackCandidateHistory=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 const delta=(d,r)=>100*(d-r)/(d+r);
 const bounded=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
 const clean=name=>String(name||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
  .replace(/["“”][^"“”]*["“”]/g,' ').toUpperCase()
  .replace(/\b(JR|SR|III|II|IV)\b/g,' ').replace(/[^A-Z ]/g,' ')
  .replace(/\s+/g,' ').trim();
 function namesMatch(a,b){
  const aa=clean(a).split(' ').filter(Boolean),bb=clean(b).split(' ').filter(Boolean);
  return aa.length>=2&&bb.length>=2&&aa[0]===bb[0]&&aa.at(-1)===bb.at(-1);
 }
 function offset(rows){
  // Winsorize extreme candidate effects at 25 points, then weight by
  // a capped turnout proxy to prevent large districts dominating the
  // nationwide shared-office offset. This is DESCRIPTIVE, not trained.
  if(rows.length<15)throw Error('Insufficient reference races');
  let n=0,sum=0;
  for(const r of rows){
   const w=bounded(r.two_party_votes,100000,500000);
   n+=w;sum+=w*bounded(r.diff,-25,25);
  }
  return sum/n;
 }
 function build(d){
  const ctx=d.candidateContext,h=d.house2024,houseNames=d.houseNames,
   pres=d.presidential2024,geo=d.geography,sen=d.senateHistory,states=d.presidential2020;
  if(ctx?.schema_version!=='candidate-fundamentals-staging-v1'||
     ctx.records?.length!==506||
     h?.status!=='2024_history_staged_not_2026_priors'||h.records?.length!==435||
     houseNames?.schema_version!=='historical-house-candidate-2024-v1'||
     houseNames.records?.length!==435||
     pres?.schema_version!=='presidential-district-lean-staging-v1'||
     pres.records?.length!==435||
     geo?.districts?.length!==435||sen?.contest_records?.length<90||
     states?.schema_version!=='presidential-state-2020-staging-v1'||
     states?.records?.length!==51)
   throw Error('Incomplete historical candidate source universe');
  const by=(records,key)=>{const map=new Map();for(const r of records){
   const k=r[key];if(!k||map.has(k))throw Error('Duplicate historical key '+k);
   map.set(k,r);
  }return map};
  const house=by(h.records,'2024_race_code');
  const names=by(houseNames.records,'race_code'),pres24=by(pres.records,'race_code');
  const bridge=by(geo.districts,'race_code_2026'),pres20=by(states.records,'state');
  const contests=new Map();
  for(const r of sen.contest_records)if(r.election_year===2020&&r.election_type==='regular'){
   if(contests.has(r.state))throw Error('Duplicate 2020 regular senate race '+r.state);
   contests.set(r.state,r);
  }
  // Compute office-level vote-vs-presidential divergence using only
  // side-by-side, complete, checked returns (never a redrawn number match).
  const houseReference=[],senReference=[];
  for(const [code,row] of house){
   const n=names.get(code),p=pres24.get(code),g=bridge.get(code);
   if(!n||!p||!g)throw Error('Missing 2024 House historical join '+code);
   const both=row.recorded_dem_votes>0&&row.recorded_rep_votes>0;
   if(both&&g.geography_comparable_2024===true&&n.source_votes_match_mit_staging&&
      n.dem_votes===row.recorded_dem_votes&&n.rep_votes===row.recorded_rep_votes){
    const diff=delta(row.recorded_dem_votes,row.recorded_rep_votes)-
     delta(p.dem_pres_2024_votes,p.rep_pres_2024_votes);
    houseReference.push({code,diff,two_party_votes:row.recorded_two_party_vote_total});
   }
  }
  for(const [state,r] of contests){
   const p=pres20.get(state);
   if(!p)throw Error('Missing 2020 state presidential '+state);
   if(r.recorded_dem_votes>0&&r.recorded_rep_votes>0){
    senReference.push({code:state,diff:delta(r.recorded_dem_votes,r.recorded_rep_votes)-
     delta(p.dem_votes,p.rep_votes),two_party_votes:r.recorded_two_party_vote_total});
   }
  }
  const houseClimate=offset(houseReference),senClimate=offset(senReference);
  const records=[];const counters={house_eligible:0,senate_eligible:0,
   house_not_matched:0,senate_not_matched:0,
   house_excluded_geography:0,house_excluded_vote_disagreement:0,
   house_excluded_uncontested:0,open_or_nonincumbent:0,governor_unknown:0};
  for(const row of ctx.records){
   const currentParty=row.incumbent_candidate_party;
   let status='no_same_office_incumbent',match=null,last=null;
   let partyMargin=null,baseMargin=null,climate=null,rawResidual=null,
    lastYear=null,sourceName=null,firstTerm='unknown',
    sourceCode=null;
   if(row.office==='governor'){
    status='missing_governor_historical_candidate_return';counters.governor_unknown++;
   }else if(!currentParty||row.incumbency_evidence_unresolved){
    status=row.incumbency_evidence_unresolved?'source_incumbency_conflict':
     'no_same_office_incumbent';
    counters.open_or_nonincumbent++;
   }else if(row.office==='house'){
    const code=row.race_code,hist=house.get(code),n=names.get(code),
     p=pres24.get(code),g=bridge.get(code);
    const side=currentParty==='DEM'?'dem':'rep';
    const candidate=row[side],historicName=n?.[side+'_name'];
    const oldWinner=hist?.recorded_dem_votes>hist?.recorded_rep_votes?'DEM':'REP';
    if(!g||g.geography_comparable_2024!==true){
     status='blocked_2024_2026_house_redistricting';counters.house_excluded_geography++;
    }else if(!hist||!n||!p||hist.recorded_dem_votes<=0||hist.recorded_rep_votes<=0){
     status='blocked_house_uncontested_or_missing_votes';counters.house_excluded_uncontested++;
    }else if(!n.source_votes_match_mit_staging||
       n.dem_votes!==hist.recorded_dem_votes||n.rep_votes!==hist.recorded_rep_votes){
     status='blocked_house_source_vote_disagreement';counters.house_excluded_vote_disagreement++;
    }else if(oldWinner!==currentParty||!namesMatch(candidate.name,historicName)||
       !candidate.source_candidate_identity_verified){
     status='blocked_house_candidate_name_or_winner_mismatch';counters.house_not_matched++;
    }else{
     status='matched_historic_winner_2024';
     lastYear=2024;sourceName=historicName;sourceCode=code;
     partyMargin=delta(hist.recorded_dem_votes,hist.recorded_rep_votes);
     baseMargin=delta(p.dem_pres_2024_votes,p.rep_pres_2024_votes);
     climate=houseClimate;
     // Recorded residual is D-R; candidate residual must always be
     // signed in the incumbent's own-party direction.
     rawResidual=(currentParty==='DEM'?1:-1)*(partyMargin-baseMargin-climate);
     firstTerm=n[side+'_was_incumbent_on_2024_ballot']?false:true;
     counters.house_eligible++;
    }
   }else if(row.office==='senate'){
    const seat=contests.get(row.state),p=pres20.get(row.state);
    const party=currentParty==='DEM'?'D':'R';
    const candidates=seat?.candidates.filter(c=>c.party_group===party&&c.votes>0)||[];
    const winner=seat?.recorded_dem_votes>seat?.recorded_rep_votes?'DEM':'REP';
    const total=party==='D'?seat?.recorded_dem_votes:seat?.recorded_rep_votes;
    const exact=candidates.filter(c=>namesMatch(c.name,row[currentParty==='DEM'?'dem':'rep'].name)&&
      c.votes===total);
    if(!seat||seat.missing_major_party_vote||!p||!total||candidates.length!==1||
       !row[currentParty==='DEM'?'dem':'rep'].source_candidate_identity_verified||
       winner!==currentParty||exact.length!==1){
     status='blocked_senate_2020_regular_candidate_or_ballot_mismatch';
     counters.senate_not_matched++;
    }else{
     status='matched_historic_winner_2020';
     lastYear=2020;sourceName=exact[0].name;sourceCode=seat.historical_race_id;
     partyMargin=delta(seat.recorded_dem_votes,seat.recorded_rep_votes);
     baseMargin=delta(p.dem_votes,p.rep_votes);
     climate=senClimate;
     rawResidual=(currentParty==='DEM'?1:-1)*(partyMargin-baseMargin-climate);
     counters.senate_eligible++;
    }
   }
   if(rawResidual!==null&&!finite(rawResidual))throw Error('Nonfinite residual '+row.race_code);
   const rounded=v=>v===null?null:Math.round(v*1000)/1000;
   records.push({
    race_code:row.race_code,office:row.office,state:row.state,
    incumbent_party:currentParty,candidate_name:currentParty?
     row[currentParty==='DEM'?'dem':'rep'].name:null,
    status,prior_election_year:lastYear,prior_candidate_name:sourceName,
    prior_source_race:sourceCode,
    district_geography_identical_2024_2026:row.office==='house'?
     bridge.get(row.race_code)?.geography_comparable_2024===true:null,
    candidate_signed_raw_excess_margin_points:rounded(rawResidual),
    candidate_signed_capped_excess_margin_points:rawResidual===null?null:
     rounded(bounded(rawResidual,-12,12)),
    prior_election_D_minus_R_points:rounded(partyMargin),
    prior_presidential_D_minus_R_points:rounded(baseMargin),
    office_year_climate_gap_points:rounded(climate),
    first_elected_term_2026:firstTerm,
    overlap_fraction_verified:status==='matched_historic_winner_2024'?1:
     row.office==='senate'&&status==='matched_historic_winner_2020'?1:null,
    note:'Candidate result minus same-year presidential result minus office-specific same-cycle national divergence; descriptive, not a causal advantage.'
   });
  }
  if(records.length!==506||houseReference.length<170||senReference.length<24||
    !records.every(x=>x.candidate_signed_raw_excess_margin_points===null||
       finite(x.candidate_signed_raw_excess_margin_points)))
   throw Error('Insufficient candidate historical coverage');
  return {
   schema_version:'candidate-relative-performance-2026-v1',
   status:'DESCRIPTIVE_HISTORICAL_CANDIDATE_RESIDUALS_NOT_VALIDATED_PREDICTIONS',
   source_provenance:{
    historical_house_candidates:houseNames.source_url,
    historical_house_candidates_sha:houseNames.source_sha,
    official_house_returns:h.source_original,
    official_senate_returns:sen.source_url,
    historical_presidential_2024:pres.external_source_url,
    historical_presidential_2020:states.source_url,
    map_source:geo.source_urls
   },
   methodology:{
    house_year:2024,senate_regular_year:2020,
    climate_estimator:'office_year_same_geography_checked_contested_seats_turnout_capped_winsorized_mean',
    winsorized_climate_gap_points:25,
    max_candidate_residual_scenario_points:12,
    house_2024_vs_presidential_2024_climate_gap:Math.round(houseClimate*1000)/1000,
    senate_2020_vs_presidential_2020_climate_gap:Math.round(senClimate*1000)/1000,
    house_reference_districts:houseReference.length,
    senate_reference_states:senReference.length,
    exclusions:'changed_boundaries_or_uncontested_or_inconsistent_source_votes_or_candidate_identity_not_verified',
    no_prior_year_leakage:true
   },
   coverage:counters,
   warnings:[
    'A residual from one election conflates candidate strength, incumbency, local campaign, turnout and noise; it is not causal.',
    'Open-seat, appointed or changed-geometry matches are not imputed. A governor needs their prior state governor election, not a Senate or House race.',
    '2024 House residuals already contribute to the currently published 2024 House vote prior; adding them again at full strength double-counts.',
    'Candidate names are independently joined with historical elections and current roster; a party match alone never proves candidate continuity.',
    '2020 Senate residuals are calculated from 2020 Senate and presidential results for the same state and year; no 2024 presidential future data are used.',
    'Same-election climate offset uses a stable qualified sample of contested seats, not an empirically estimated national environment.'
   ],
   records
  };
 }
 function enrichCandidateContext(ctx,doc){
  if(ctx?.records?.length!==506||doc?.records?.length!==506||
     doc?.status!=='DESCRIPTIVE_HISTORICAL_CANDIDATE_RESIDUALS_NOT_VALIDATED_PREDICTIONS')
   throw Error('Invalid candidate enrichment source');
  const byRace=new Map(doc.records.map(x=>[x.race_code,x]));
  const updated=ctx.records.map(original=>{
   const record=byRace.get(original.race_code);
   if(!record||record.office!==original.office)
    throw Error('Candidate strength record missing '+original.race_code);
   const row={...original,dem:{...original.dem},rep:{...original.rep}};
   if(record.status.startsWith('matched_historic_winner_')){
    const party=record.incumbent_party==='DEM'?'dem':'rep';
    const c=row[party];
    if(!c.incumbent_same_seat_candidate||
       !c.source_candidate_identity_verified||
       !namesMatch(c.name,record.prior_candidate_name)||
       c.elected_vs_appointed!=='unverified'||
       c.incumbent_last_race_overperformance_points!==null)
     throw Error('Unverified candidate identity enrichment '+original.race_code);
    c.elected_vs_appointed='elected';
    c.incumbent_last_race_overperformance_points=
     record.candidate_signed_raw_excess_margin_points;
    c.first_term=record.first_elected_term_2026;
    if(row.office==='house'){
     if(record.district_geography_identical_2024_2026!==true||
        record.overlap_fraction_verified!==1)
      throw Error('House district overlap cannot be asserted '+row.race_code);
     c.verified_old_new_district_overlap_fraction=1;
    }
    c.historical_overperformance_provenance={
     status:'previous_election_winner_identity_verified_against_staged_history',
     prior_election_year:record.prior_election_year,
     source_race:record.prior_source_race,
     raw_candidate_excess_margin_points:record.candidate_signed_raw_excess_margin_points,
     first_term_source:row.office==='house'?
      '2024_historic_candidate_was_incumbent_field':'not_verified',
     historical_climate_offset_points:record.office_year_climate_gap_points,
     interpretation:'retrospective_relative_margin_not_causal_or_trained'
    };
   }
   return row;
  });
  return {...ctx,records:updated,
   historical_candidate_strength:{
    schema_version:doc.schema_version,
    house_matched:doc.coverage.house_eligible,
    senate_matched:doc.coverage.senate_eligible,
    governor_matched:0,
    source:'data/historical_candidate_overperformance_2026.json',
    status:'MATCHED_RETROSPECTIVE_NONCAUSAL_NOT_AUTOMATIC_PROBABILITIES'
   }};
 }
 return Object.freeze({build,namesMatch,clean,offset,enrichCandidateContext});
});
