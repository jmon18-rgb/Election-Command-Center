/* Out-of-period candidate residual PERSISTENCE test, 2022 -> 2024.
 * Only 2022 incumbent WINNERS as defined in 2022, whether they won or lost
 * when running again in 2024. 2024 outcomes are the test target only.
 * State leave-one-out fits hold each geography out of training. */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.JackIncumbentPersistence=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const helper=typeof require==='function'?require('./historical_candidate_strength.js'):
   root?.JackCandidateHistory;
 const match=helper?.namesMatch;
 const margin=(d,r)=>100*(d-r)/(d+r);
 const cap=(x,a,b)=>Math.max(a,Math.min(b,x));
 const round=x=>Math.round(x*1000)/1000;
 const map=(records,key)=>{
  const result=new Map();
  for(const row of records){
   if(!row[key]||result.has(row[key]))throw Error('Duplicate historical reference '+row[key]);
   result.set(row[key],row);
  }
  return result;
 };
 function build(s){
  if(!match||s.twoCycle?.coverage?.districts_with_two_historical_major_party_shares!==191||
    s.house22?.records?.length!==435||s.house24?.records?.length!==435||
    s.candidates22?.records?.length!==435||s.candidates24?.records?.length!==435||
    s.pres20?.records?.length!==435||s.pres24?.records?.length!==435)
   throw Error('Missing held-out historical candidate data');
  const validGeo=s.twoCycle.rows.filter(r=>r.geography_comparable_across_all_three_elections);
  const h22=map(s.house22.records,'2022_race_code'),
   h24=map(s.house24.records,'2024_race_code'),
   c22=map(s.candidates22.records,'race_code'),
   c24=map(s.candidates24.records,'race_code'),
   p20=map(s.pres20.records,'race_code'),p24=map(s.pres24.records,'race_code');
  const pre=[],post=[],panels=[],status={reference_eligible:0,source_mismatch:0,
   not_contested_both:0,previous_winner_did_not_run:0,
   panel_complete:0,previous_winners_re_elected:0,previous_winners_lost:0};
  for(const g of validGeo){
   const code=g.race_code_2026,old=h22.get(code),now=h24.get(code),
    oldNames=c22.get(code),newNames=c24.get(code),presPrev=p20.get(code),
    presNow=p24.get(code);
   if(!old||!now||!oldNames||!newNames||!presPrev||!presNow||
      presPrev.same_district_boundaries_2022_2024_2026!==true)
    throw Error('Noncomparable 2022-to-2024 district '+code);
   if(!(old.recorded_dem_votes>0&&old.recorded_rep_votes>0&&
        now.recorded_dem_votes>0&&now.recorded_rep_votes>0)){
    status.not_contested_both++;continue;
   }
   const mm22=margin(old.recorded_dem_votes,old.recorded_rep_votes),
    mm24=margin(now.recorded_dem_votes,now.recorded_rep_votes),
    pp20=margin(presPrev.dem_votes,presPrev.rep_votes),
    pp24=margin(presNow.dem_pres_2024_votes,presNow.rep_pres_2024_votes);
   if(![mm22,mm24,pp20,pp24].every(Number.isFinite))
    throw Error('Invalid historical margin '+code);
   pre.push({code,diff:mm22-pp20,two_party_votes:old.recorded_two_party_vote_total});
   post.push({code,diff:mm24-pp24,two_party_votes:now.recorded_two_party_vote_total});
   status.reference_eligible++;
   if(!oldNames.source_votes_match_mit_staging||
      !newNames.source_votes_match_mit_staging||
      oldNames.dem_votes!==old.recorded_dem_votes||
      oldNames.rep_votes!==old.recorded_rep_votes||
      newNames.dem_votes!==now.recorded_dem_votes||
      newNames.rep_votes!==now.recorded_rep_votes){
    status.source_mismatch++;continue;
   }
   const demWon=old.recorded_dem_votes>old.recorded_rep_votes;
   const party=demWon?'DEM':'REP',side=demWon?'dem':'rep';
   const name22=oldNames[side+'_name'],name24=newNames[side+'_name'];
   if(!match(name22,name24)){
    status.previous_winner_did_not_run++;continue;
   }
   const winner2024=(now.recorded_dem_votes>now.recorded_rep_votes?'DEM':'REP')===party;
   status.panel_complete++;
   if(winner2024)status.previous_winners_re_elected++;
   else status.previous_winners_lost++;
   panels.push({race_code:code,state:g.state,party,prior_name:name22,
    next_name:name24,reelected_in_2024:winner2024,
    margin22:mm22,presidential20_margin:pp20,
    margin24:mm24,presidential24_margin:pp24});
  }
  // The target and input are each normalized by their respective
  // office-year observed environment. For 2024 this uses House and
  // presidential outcomes exclusively for EVALUATION (not to make
  // an as-of-2022 prediction of the national 2024 outcome).
  function trimmedClimate(entries){
   let sum=0,weights=0;
   for(const r of entries){
    const w=cap(r.two_party_votes,100000,500000);
    sum+=w*cap(r.diff,-25,25);weights+=w;
   }
   return sum/weights;
  }
  const env22=trimmedClimate(pre),env24=trimmedClimate(post);
  const examples=panels.map(r=>{
   const sign=r.party==='DEM'?1:-1;
   const x=sign*(r.margin22-r.presidential20_margin-env22),
    y=sign*(r.margin24-r.presidential24_margin-env24);
   return {...r,observed_2022_candidate_excess:round(x),
    observed_2024_candidate_excess:round(y),x,y};
  });
  if(examples.length<35||new Set(examples.map(x=>x.state)).size<12)
   throw Error('Insufficient candidate persistence sample');
  // For prospective reliability: fit a regularized (nonnegative) single
  // carryover coefficient leaving each state OUT, then score 2024 outcomes.
  const fit=rows=>{
   const sumX2=rows.reduce((a,r)=>a+r.x*r.x,0);
   const cross=rows.reduce((a,r)=>a+r.x*r.y,0);
   return cap(cross/(sumX2+20*rows.length),0,.8);
  };
  const states=[...new Set(examples.map(x=>x.state))];
  const results=examples.map(r=>{
   // Every 2024 outcome from the HELD-OUT state is absent from both the
   // coefficient fit and that fold's national 2024 climate benchmark.
   // This is stricter than fitting a coefficient out-of-state while
   // normalizing targets with an all-state aggregate containing heldouts.
   const foldClimate24=trimmedClimate(post.filter(x=>
    x.code.slice(0,2)!==r.state));
   const train=examples.filter(x=>x.state!==r.state).map(x=>({
    ...x,y:(x.party==='DEM'?1:-1)*
      (x.margin24-x.presidential24_margin-foldClimate24)
   }));
   const lambda=fit(train);
   const holdoutTarget=(r.party==='DEM'?1:-1)*
    (r.margin24-r.presidential24_margin-foldClimate24);
   return {race_code:r.race_code,state:r.state,
    prior_2022:round(r.x),realized_2024:round(holdoutTarget),
    heldout_state_excluded_2024_climate:round(foldClimate24),
    fitted_out_of_state_coefficient:round(lambda),
    predicted_excess_from_2022:round(lambda*r.x),
    error_zero:round(-holdoutTarget),
    error_cv:round(lambda*r.x-holdoutTarget),
    error_full_transfer:round(r.x-holdoutTarget)};
  });
  const score=key=>({
   mae:round(results.reduce((a,r)=>a+Math.abs(r[key]),0)/results.length),
   rmse:round(Math.sqrt(results.reduce((a,r)=>a+r[key]*r[key],0)/results.length))
  });
  const cv=score('error_cv'),zero=score('error_zero'),full=score('error_full_transfer');
  const allFit=fit(examples);
  return {
   schema_version:'incumbent-strength-persistence-2022-2024-v1',
   status:'HISTORICAL_PERSISTENCE_HOLDOUT_NOT_PROVEN_2026_FORECAST',
   source_provenance:{
    house_2022:s.house22.source_original,house_2024:s.house24.source_original,
    candidate_names_2022:s.candidates22.source_url,
    candidate_names_2024:s.candidates24.source_url,
    presidential_2020:s.pres20.source_url,
    presidential_2024:s.pres24.external_source_url,
    source_candidate_blob_sha:s.candidates22.source_sha,
    geography:s.twoCycle.sources.census_2026
   },
   eligibility:status,
   held_out_previous_winner_sample:examples.length,
   held_out_states:states.length,
   office_year_context:{
    house2022_vs_presidential2020_gap:round(env22),
    house2024_vs_presidential2024_gap:round(env24),
    source:'contested_comparable_house_returns_normalized_against_prior_presidential_vote_for_2022_and_same_cycle_presidential_vote_for_2024'
   },
   fitting:{
    method:'leave_one_state_out_ridge_through_zero_with_fold_specific_climate',
    penalty_variance_multiplier:20,
    coefficient_floor:0,coefficient_cap:.8,
    full_sample_coefficient:round(allFit),
    interpretation:'historical candidate residual persistence only; candidate rerun sample is selective'
   },
   scores_2024_evaluation:{
    no_candidate_carryover:zero,
    state_holdout_trained_candidate_carryover:cv,
    full_one_to_one_carryover:full,
    cv_beats_zero_rmse:cv.rmse<zero.rmse,
    cv_beats_zero_mae:cv.mae<zero.mae
   },
   limitations:[
    'The 2024 presidential election was concurrent with the 2024 House race, and is used ONLY to normalize the 2024 validation target, never to form a 2022 predictor.',
    'The sample includes only 2022 winners who ran again in 2024, including those who lost; candidates who retired/declined reelection are excluded, so generalization is limited.',
    'The baseline presidential vote for 2022 is the 2020 vote reallocated to 2022 district boundaries; only districts whose boundaries remained unchanged through 2026 qualify.',
    'The climate offsets are observed samples, not pre-election generic ballot averages; this evaluates relative candidate-strength persistence, not full forecast performance.',
    '2022 to 2024 spans midterm to presidential election; 2024 to 2026 is the opposite direction and could have different elasticity.',
    'One historical fold is insufficient to assert a calibrated 2026 candidate-quality model.'
   ],
   records:results
  };
 }
 return Object.freeze({build});
});
