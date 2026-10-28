/* JackStradamus joint-chamber beta. Historical geography is checked, missing
 * races use explicit wide assumptions, and nationally/state-correlated errors
 * are shared across chambers. Independent of publisher joint forecasts.
 * All margins are D-minus-R two-party proxies, not certified winner calls.
 */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.ChamberControlModel=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const VERSION='joint-control-beta-v1';
 const FUNDAMENTALS_MODES=Object.freeze(['2024_only','two_cycle_shadow','presidential_2024_shadow','presidential_2024_gap_fill']);
 const SHADOW_WEIGHT=.25,SHADOW_RESIDUAL_CAP=12;
 const BATTLEGROUNDS=Object.freeze([
  'NC-SEN','MI-SEN','ME-SEN','OH-SEN','TX-SEN','AK-SEN','NE-SEN','IA-SEN',
  'AZ-GOV','GA-GOV','MI-GOV','WI-GOV','NV-GOV','OH-GOV',
  'AZ-01','ME-02','NC-01','NE-02','NY-17','PA-10'
 ]);
 // Wave means actual Democratic control of BOTH chambers, matching the
 // balance-of-power settlement criterion rather than Polymarket's separate
 // 218/49 Blue Wave prop. Tsunami is our stricter >=235 House/>=52 Senate.
 const ENDING_THRESHOLDS=Object.freeze({
  wave_house:218,wave_senate:51,tsunami_house:235,tsunami_senate:52
 });
 const BATTLEGROUND_SET=new Set(BATTLEGROUNDS);
 function classifyFourEndings(houseSeats,senateSeats){
  if(!Number.isInteger(houseSeats)||houseSeats<0||houseSeats>435||
     !Number.isInteger(senateSeats)||senateSeats<0||senateSeats>100)
   throw Error('Invalid simulated congressional seat totals');
  if(houseSeats>=ENDING_THRESHOLDS.tsunami_house&&
     senateSeats>=ENDING_THRESHOLDS.tsunami_senate)return 'blue_tsunami';
  const waveHouse=houseSeats>=ENDING_THRESHOLDS.wave_house;
  const waveSenate=senateSeats>=ENDING_THRESHOLDS.wave_senate;
  if(waveHouse&&waveSenate)return 'blue_wave';
  if(waveHouse||waveSenate)return 'shrug';
  return 'red_dawn';
 }
 const HOUSE_SEATS=435,SENATE_CONTESTS=35;
 const SHARED_SIGMA=Object.freeze({national:3.5,senateChamber:3,senateState:3.5});
 // Source polling-error inputs estimate WHOLE-RACE margin error, not a
 // purely local residual to stack with shared shocks a second time.
 const HOUSE_POLL_WHOLE_SIGMA_MIN=7.5;
 const GOVERNOR_POLL_WHOLE_SIGMA_MIN=7;
 const HOUSE_POLL_REDRAW_SIGMA_MIN=16;
 const HOUSE_POLL_REDRAW_PRES_SIGMA_MIN=15;
 const HOUSE_SHARED_SIGMA=Math.hypot(SHARED_SIGMA.national,2.5,3);
 const HOUSE_REDRAW_SHARED_SIGMA=Math.hypot(SHARED_SIGMA.national,2.5,3+6);
 const GOVERNOR_SHARED_SIGMA=Math.hypot(SHARED_SIGMA.national,3.5,3);
 function pollLocalFromWhole(wholeSigma,sharedSigma){
  if(!Number.isFinite(wholeSigma)||!Number.isFinite(sharedSigma)||wholeSigma<=sharedSigma)
   throw Error('Polling full-race error budget smaller than correlated shocks');
  return Math.sqrt(wholeSigma**2-sharedSigma**2);
 }
 // Independently classified Solid, October 1, 2026:
 // https://insideelections.com/ratings/senate/
 // ONLY the 11 unpolled Solid contests use this prior. A qualifying
 // poll automatically supersedes the no-poll guard. Symmetric D/R list.
 const SOLID_UNPOLLED_SENATE=Object.freeze({
  'CO-SEN':'D','DE-SEN':'D','NJ-SEN':'D','OR-SEN':'D','VA-SEN':'D',
  'KY-SEN':'R','MS-SEN':'R','OK-SEN':'R','TN-SEN':'R','WV-SEN':'R','WY-SEN':'R'
 });
 const SOLID_NO_POLL_TOTAL_SIGMA=7;
 const CURRENT_SENATE_MODEL_REVISION='late_2026_depth_aware_special_v5';
// At 20 days, the recent 2020/22/24 archival FIELDWORK-only cohort (41
// Senate contests) has a 5.254-point margin RMSE. At seven days the 42-race
// cohort has 5.633 RMSE. Proper winner scores improve modestly at a 6.5-pt
// width compared to 7.5, with nominal 90% coverage >=95% at 20 and 7 days.
// The 2020 cycle is a strong counterexample: its 20-day error RMSE was 7.154,
// and 6.5-pt 90% interval coverage fell below target. Keep 8.5 for stale,
// special and thinner polling, and KEEP shared national/Senate/state variance.
// Archive lacks verified first-publication dates and 2026 fundamentals: the
// 6.5-ppt choice is a PROVISIONAL conditional error budget, not a backtested
// probability calibration or a result tuned to an external forecast.
const SENATE_POLL_ERROR_FLOORS=Object.freeze({qualified:6.5,deepSpecial:7.5,thin:8.5});
// Deeply polled special elections have direct 2026 matchup evidence; keep
// a 1-point uncertainty premium over equally well-polled regular contests.
function senateCandidatePollWeight(independentFirms){
 if(!Number.isInteger(independentFirms)||independentFirms<0)
  throw Error('Invalid Senate independent pollster count');
 return independentFirms>=8?.97:independentFirms>=5?.94:
  independentFirms>=3?.90:independentFirms>=2?.83:.60;
}
function senatePollingErrorBudget(info){
 const {independentFirms,contributingFirms,daysSinceLatest,special,sourceSigma}=info||{};
 if(!Number.isInteger(independentFirms)||independentFirms<0||
    !Number.isInteger(contributingFirms)||contributingFirms<independentFirms||
    !finite(daysSinceLatest)||daysSinceLatest<0||
    !finite(sourceSigma)||sourceSigma<=0||typeof special!=='boolean')
  throw Error('Invalid Senate polling uncertainty provenance');
 const recent=independentFirms>=2&&contributingFirms>=3&&daysSinceLatest<=14;
 const deepSpecial=special&&independentFirms>=4&&
  contributingFirms>=6&&daysSinceLatest<=14;
 const qualified=recent&&!special;
 const floor=deepSpecial?SENATE_POLL_ERROR_FLOORS.deepSpecial:
  qualified?SENATE_POLL_ERROR_FLOORS.qualified:SENATE_POLL_ERROR_FLOORS.thin;
 return {floor,totalSigma:Math.max(floor,sourceSigma),
  tier:deepSpecial?'recent_deep_special':
   qualified?'recent_multi_firm':'thin_stale_or_special'};
}
 // Two-party proxy names in source polling are NOT ballot party affiliations.
 const INDEPENDENT_SENATE_PROXY_CANDIDATES=Object.freeze({
  'NE-SEN':'Dan Osborn','SD-SEN':'Brian Bengs'});
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 const limit=(x,l,h)=>Math.max(l,Math.min(h,x));
 const margin=share=>200*share-100;
 function normalizeCode(x){return typeof x==='string'?x.trim().toUpperCase():''}
 // Silver-inspired, provisional: conflicting polling and independently
 // informative fundamentals imply additional uncertainty, not an arbitrary
 // correction toward either party. These coefficients are NOT backtested.
 // A statewide exchangeable redraw prior has quality zero for district use.
 function disagreementExtraSigma(pollMargin,priorMargin,priorQuality){
  if(!finite(pollMargin)||!finite(priorMargin)||!finite(priorQuality)||
     priorQuality<0||priorQuality>1)throw Error('Invalid disagreement inputs');
  const excess=Math.max(0,Math.abs(pollMargin-priorMargin)-6);
  return Math.round(1000*Math.min(6,excess*.35*priorQuality))/1000;
 }
 function normal(rand){
  const u=Math.max(1e-12,rand()),v=rand();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
 }
 function seeded(seed){
  let state=(seed>>>0)||0x12345678;
  const next=()=>{
   state^=state<<13;state^=state>>>17;state^=state<<5;
   return (state>>>0)/4294967296;
  };
  next.state=()=>state>>>0;
  next.restore=value=>{
   if(!Number.isInteger(value)||value<=0||value>4294967295)throw Error('Invalid replay random state');
   state=value|0;
  };
  return next;
 }
 function validateInputs(s){
  if(!s||!s.seats||!s.history||!s.geography||!s.senateHistory||
     !s.polls||!s.odds)throw Error('Required seat and polling inputs missing');
  if(s.seats.senate?.contested_total!==35||
     s.seats.house?.total_voting_seats!==435||
     s.seats.is_election_forecast!==false||
     s.seats.can_model_chamber_control!==false)
    throw Error('Unverified 2026 seat universe');
  if(!Array.isArray(s.seats.house.seats)||s.seats.house.seats.length!==435||
     !Array.isArray(s.seats.senate.contested_seats)||
     s.seats.senate.contested_seats.length!==35||
     !Array.isArray(s.history.records)||s.history.records.length!==435||
     !Array.isArray(s.geography.districts)||s.geography.districts.length!==435||
     !Array.isArray(s.senateHistory.contest_records)||
     !Array.isArray(s.odds.records)||
     s.odds.schema_version!=='experimental-race-odds-v1'||
     s.odds.can_infer_chamber_control!==false||
     s.odds.polling_source_generated_at!==s.polls.generated_at)
    throw Error('Missing, stale or mismatched data universe');
  if(!finite(s.polls.generic_ballot?.dem_minus_rep)||
     Math.abs(s.polls.generic_ballot.dem_minus_rep)>35)
    throw Error('Generic ballot not verified');
 }
 function prepare(s,options={}){
  validateInputs(s);
  const fundamentalsMode=options.fundamentalsMode??'2024_only';
  const senatePriorMode=options.senatePriorMode??'legacy_2020';
  if(!['legacy_2020','current_2026'].includes(senatePriorMode))
   throw Error('Unsupported Senate fundamentals mode');
  if(!FUNDAMENTALS_MODES.includes(fundamentalsMode))
   throw Error('Unsupported House fundamentals mode');
  // Require validated two-cycle sources for the explicit alternate model.
  // Default model must not depend on an experimental comparison file.
  let paired=null,pairedNationalChange=null;
  if(fundamentalsMode==='two_cycle_shadow'){
   const doc=s.twoCycle;
   if(!doc||doc.status!=='two_cycle_historical_comparison_only'||
      doc.is_forecast!==false||doc.coverage?.districts_with_two_historical_major_party_shares!==197||
      !Array.isArray(doc.rows)||doc.rows.length!==435)
    throw Error('Missing validated 2022/2024 House geography context');
   paired=new Map();
   const changes=[],codes=new Set();
   for(const row of doc.rows){
    const code=normalizeCode(row.race_code_2026);
    if(!code||codes.has(code))throw Error('Duplicate two-cycle district '+code);
    codes.add(code);
    if(row.can_compare_historic_two_party_votes){
     if(row.geography_comparable_across_all_three_elections!==true||
        row.has_recorded_both_major_parties_2022!==true||
        row.has_recorded_both_major_parties_2024!==true||
        !finite(row.recorded_dem_share_2022_two_party)||
        !finite(row.recorded_dem_share_2024_two_party)||
        row.recorded_dem_share_2022_two_party<=0||
        row.recorded_dem_share_2022_two_party>=1||
        row.recorded_dem_share_2024_two_party<=0||
        row.recorded_dem_share_2024_two_party>=1)
      throw Error('Unreliable paired district vote source '+code);
     paired.set(code,row);
     changes.push(margin(row.recorded_dem_share_2024_two_party)-
      margin(row.recorded_dem_share_2022_two_party));
    }
   }
   if(codes.size!==435||paired.size!==197)
    throw Error('Incomplete paired House historic source');
   changes.sort((a,b)=>a-b);
   pairedNationalChange=changes[(changes.length-1)/2];
   if(!finite(pairedNationalChange)||Math.abs(pairedNationalChange)>15)
    throw Error('Implausible paired nationwide district swing');
  }
  // District presidential vote totals must be mapped to the CURRENT 2026
  // jurisdiction before blending; a stale 2024 CD number is prohibited.
  const houseUsesPresidential=fundamentalsMode==='presidential_2024_shadow'||
    fundamentalsMode==='presidential_2024_gap_fill';
  let presidential=null,presidentialNationalMargin=null,presidentialStateTotals=null;
  if(fundamentalsMode==='presidential_2024_shadow'||
     fundamentalsMode==='presidential_2024_gap_fill'||senatePriorMode==='current_2026'){
   const d=s.presidential;
   if(!d||d.schema_version!=='presidential-district-lean-staging-v1'||
      d.status!=='historical_presidential_votes_from_external_model_source_not_forecast'||
      d.election_year!==2024||d.district_map_year_claimed!==2026||
      !Array.isArray(d.records)||d.records.length!==HOUSE_SEATS||
      !d.external_source_blob_sha||!d.district_geo_source)
    throw Error('Missing verified-source presidential 2024 House district data');
   const expected=new Set(s.seats.house.seats.map(x=>normalizeCode(x.race_code)));
   presidential=new Map();presidentialStateTotals=new Map();
   let totalDem=0,totalRep=0;
   for(const row of d.records){
    const code=normalizeCode(row.race_code);
    if(!expected.has(code)||presidential.has(code)||row.state!==code.slice(0,2)||
       !Number.isSafeInteger(row.dem_pres_2024_votes)||row.dem_pres_2024_votes<=0||
       !Number.isSafeInteger(row.rep_pres_2024_votes)||row.rep_pres_2024_votes<=0||
       !finite(row.dem_minus_rep_two_party_points))
      throw Error('Invalid or duplicate presidential 2026-map district '+code);
    const calculated=100*(row.dem_pres_2024_votes-row.rep_pres_2024_votes)/
      (row.dem_pres_2024_votes+row.rep_pres_2024_votes);
    if(Math.abs(calculated-row.dem_minus_rep_two_party_points)>.002)
     throw Error('Presidential district margin/vote disagreement '+code);
    presidential.set(code,calculated);
    totalDem+=row.dem_pres_2024_votes;
    totalRep+=row.rep_pres_2024_votes;
    const st=presidentialStateTotals.get(row.state)||{d:0,r:0};
    st.d+=row.dem_pres_2024_votes;st.r+=row.rep_pres_2024_votes;
    presidentialStateTotals.set(row.state,st);
   }
   if(presidential.size!==HOUSE_SEATS||presidentialStateTotals.size!==50)
    throw Error('Incomplete US presidential state aggregates');
   presidentialNationalMargin=100*(totalDem-totalRep)/(totalDem+totalRep);
   if(Math.abs(presidentialNationalMargin-d.national_reference_two_party_margin_points)>.003)
    throw Error('Presidential national reference mismatched district totals');
   // Independent human spot checks: The Downballot 2026-map 2024 margins
   // (rounded to 1 point) include VA-01 R+5, AZ-01 R+3, CA-01 D+12.
   for(const [code,estimate] of [['VA-01',-5],['AZ-01',-3],['CA-01',12],['TX-28',-11]]){
    if(Math.abs(presidential.get(code)-estimate)>2)
     throw Error('Presidential geography cross-check failed '+code);
   }
  }
  const raw=new Map(s.history.records.map(x=>[normalizeCode(x['2024_race_code']),x]));
  const geo=new Map(s.geography.districts.map(x=>[normalizeCode(x.race_code_2026),x]));
  const odds=new Map(s.odds.records.map(x=>[x.office+'|'+normalizeCode(x.race_code),x]));
  const senateMatchups=new Map(s.polls.senate_all.map(x=>[normalizeCode(x.race_code),x]));
  const stateTotals=new Map(),all={d:0,r:0};
  for(const record of s.history.records){
   const state=record['2024_race_code'].slice(0,2);
   const current=stateTotals.get(state)||{d:0,r:0};
   current.d+=record.recorded_dem_votes||0;
   current.r+=record.recorded_rep_votes||0;
   stateTotals.set(state,current);
   all.d+=record.recorded_dem_votes||0;all.r+=record.recorded_rep_votes||0;
  }
  if(all.d<1e7||all.r<1e7)throw Error('Missing House historical vote totals');
  const house2024=100*(all.d-all.r)/(all.d+all.r);
  // Pollster generic question vs historical recorded House votes are
  // non-identical measurements. Dampen the headline implied swing.
  const generic=s.polls.generic_ballot.dem_minus_rep;
  const projectedSwing=.68*(generic-house2024);
  // Never adjust Senate means with a House-only alternate; that is a
  // separate forecasting problem with separate candidate fundamentals.
  const houseProjectedSwing=houseUsesPresidential?
   .68*(generic-presidentialNationalMargin):projectedSwing;
  const house=[],senate=[],gov=[];
  const stateMargin=state=>{
   const v=stateTotals.get(state);
   return v&&v.d+v.r>0?100*(v.d-v.r)/(v.d+v.r):house2024;
  };
  const houseDistribution=new Map();
  for(const record of s.history.records){
   const state=record['2024_race_code'].slice(0,2);
   const vals=houseDistribution.get(state)||[];
   const both=record.recorded_dem_votes>0&&record.recorded_rep_votes>0;
   let m=both?100*(record.recorded_dem_votes-record.recorded_rep_votes)/
     (record.recorded_dem_votes+record.recorded_rep_votes):
     record.recorded_dem_votes>0?38:record.recorded_rep_votes>0?-38:
     stateMargin(state);
   vals.push(limit(m,-55,55));
   houseDistribution.set(state,vals);
  }
  for(const vals of houseDistribution.values())vals.sort((a,b)=>a-b);
  // All nine currently redrawn 2026 states have wholly changed congressional
  // maps. Their 2024 House marginal distribution is usable as *statewide*
  // context, NOT a district-number-to-district-number mapping.
  const redrawnStateDistributions=Object.create(null);
  for(const [state,values] of houseDistribution){
   if(s.geography.districts.some(g=>g.state===state&&
     g.geography_comparable_2024===false)){
    const redrawn=s.geography.districts.filter(g=>g.state===state&&
     g.geography_comparable_2024===false);
    if(redrawn.length!==values.length)throw Error(
      'Partial state redrawing requires explicit residual margin allocation: '+state);
    redrawnStateDistributions[state]=values.slice();
   }
  }
  for(const seat of s.seats.house.seats){
   const code=normalizeCode(seat.race_code),state=seat.state;
   const g=geo.get(code),h=raw.get(code);
   if(!g||!h)throw Error('House code cannot be paired with geography '+code);
   const unchanged=g.geography_comparable_2024===true;
   const both=h.recorded_dem_votes>0&&h.recorded_rep_votes>0;
   let baseline,kind,sigma,redrawnMixWeight=0,redrawnStateCenter=null;
   if(unchanged&&both){
    baseline=margin(h.recorded_dem_share_two_party);
    kind='unchanged_2024_recorded';sigma=11;
   }else if(unchanged){
    baseline=h.recorded_dem_votes>0?38:h.recorded_rep_votes>0?-38:stateMargin(state);
    kind='uncontested_or_missing_party_proxy';sigma=22;
   }else{
    // NEW GEOMETRY: NEVER assign old district X's 2024 votes as the
    // same 2026 district X. Preserve only the state's aggregate 2024
    // *distribution* as a provisional seat-count proxy, then allow
    // very wide independent and state-correlated errors.
    const values=redrawnStateDistributions[state];
    if(!values||!values.length)throw Error('Missing state redraw prior '+state);
    // All unpolled new districts receive the same *exchangeable* prior.
    // Never silently assert old district 01 corresponds to new district 01.
    baseline=values.reduce((a,b)=>a+b,0)/values.length;
    redrawnStateCenter=baseline;
    redrawnMixWeight=1;
    kind='redrawn_state_distribution_proxy';sigma=25;
   }
   // The 2024 presidential baseline is defined on 2026 geometry. Even in
   // redrawn states, no obsolete 2024 House district votes are assigned by
   // district number. District-specific presidential estimates are research
   // inputs, with explicitly broad uncertainty for newly drawn seats.
   const presidentialMargin=houseUsesPresidential?presidential.get(code):null;
   const usePresidential=Boolean(houseUsesPresidential&&
    (fundamentalsMode==='presidential_2024_shadow'||!unchanged||!both));
   if(usePresidential){
    if(!finite(presidentialMargin))throw Error('Missing 2026 presidential geographic prior '+code);
    if(unchanged&&both){
     baseline=.65*presidentialMargin+.35*baseline;
     kind='presidential_house_blend_2024';sigma=12;
    }else if(unchanged){
     baseline=presidentialMargin;
     kind='presidential_only_uncontested_house';sigma=19;
    }else{
     baseline=presidentialMargin;
     kind='presidential_2026_redrawn_map';sigma=19;
     redrawnMixWeight=0;redrawnStateCenter=null;
    }
   }
   let twoCycleAdjustment=0,twoCycle2022Margin=null,twoCycleProxy2024=null;
   if(paired&&unchanged&&both){
    const pair=paired.get(code);
    if(pair){
     if(Math.abs(pair.recorded_dem_share_2024_two_party-h.recorded_dem_share_two_party)>.00011)
      throw Error('2024 source disagreement for paired House district '+code);
     twoCycle2022Margin=margin(pair.recorded_dem_share_2022_two_party);
     twoCycleProxy2024=twoCycle2022Margin+pairedNationalChange;
     // The 2022 signal is shrunk and winsorized: large candidate-specific
     // swings should not displace a recent 2024 election by tens of points.
     twoCycleAdjustment=SHADOW_WEIGHT*limit(twoCycleProxy2024-baseline,
       -SHADOW_RESIDUAL_CAP,SHADOW_RESIDUAL_CAP);
     baseline+=twoCycleAdjustment;
     kind='two_cycle_shadow_2024_recorded';
    }
   }
   // Comparable 2024 House elections retain a House-to-generic swing;
   // unmappable and incomplete House races use the national 2024
   // presidential-to-generic reference paired with presidential geometry.
   const districtSwing=fundamentalsMode==='presidential_2024_gap_fill'&&
    !usePresidential?projectedSwing:houseProjectedSwing;
   let mean=baseline+districtSwing,method=kind;
   let pollFundamentalsGap=null,disagreementSigma=0,pollWeight=null;
   const poll=odds.get('house|'+code);
   if(poll){
    const priorMean=mean;
    const w=unchanged?(poll.independent_firms>=2?.78:.60):
      (poll.independent_firms>=2?.88:.76);
    pollWeight=w;
    mean=w*poll.dem_minus_rep+(1-w)*priorMean;
    const wholeSigma=unchanged?
      Math.max(HOUSE_POLL_WHOLE_SIGMA_MIN,poll.sigma_points):
      Math.max(usePresidential?HOUSE_POLL_REDRAW_PRES_SIGMA_MIN:
       HOUSE_POLL_REDRAW_SIGMA_MIN,poll.sigma_points);
    sigma=pollLocalFromWhole(wholeSigma,
      unchanged?HOUSE_SHARED_SIGMA:HOUSE_REDRAW_SHARED_SIGMA);
    // A presidential margin genuinely calculated under the 2026 map can
    // be compared with polls even for redrawn seats. Exchangeable statewide
    // 2024 House priors (default mode) still cannot.
    if(unchanged||usePresidential){
     pollFundamentalsGap=Math.round(1000*(poll.dem_minus_rep-priorMean))/1000;
     disagreementSigma=disagreementExtraSigma(poll.dem_minus_rep,priorMean,
      usePresidential?(unchanged&&both?.70:.45):(both?.65:.15));
     sigma=Math.round(1000*Math.hypot(sigma,disagreementSigma))/1000;
    }
    method='poll_blend_'+kind;
    if(!unchanged&&!usePresidential)redrawnMixWeight=1-w;
   }
   house.push({code,state,mean:limit(mean,-60,60),sigma,
     method,polled:Boolean(poll),redrawn_mix_weight:redrawnMixWeight,
     redrawn_state_center:redrawnStateCenter,
     poll_weight:pollWeight,poll_fundamentals_gap_points:pollFundamentalsGap,
     disagreement_extra_sigma_points:disagreementSigma,
     two_cycle_adjustment_points:Math.round(1000*twoCycleAdjustment)/1000,
     historical_2022_margin:twoCycle2022Margin,
     projected_2024_from_2022_margin:twoCycleProxy2024,
     presidential_2024_margin_points:presidentialMargin,
     historical_geography_prior_source:usePresidential?'mapped_presidential_2024_two_party':kind,
     historical_2024_house_vote_used:unchanged&&both&&
      (fundamentalsMode==='presidential_2024_gap_fill'||!houseUsesPresidential)});
  }
  const senRecords=s.senateHistory.contest_records.filter(r=>
   r.election_year===2020&&r.election_type==='regular');
  const senate2020=new Map(senRecords.map(r=>[r.state,r]));
  // The newer prior explicitly separates current, candidate-neutral geography
  // from the named current candidate matchup. A 2020 different winner cannot
  // convey individual 2026 candidate strength, especially for open seats.
  const currentSenateNationalSwing=senatePriorMode==='current_2026'?
   .55*(generic-presidentialNationalMargin):null;
  const senateSharedError=Math.hypot(SHARED_SIGMA.national,
   SHARED_SIGMA.senateChamber,SHARED_SIGMA.senateState);
  for(const seat of s.seats.senate.contested_seats){
   const code=normalizeCode(seat.race_code),state=seat.state;
   const prior=senate2020.get(state);
   const special=seat.election_kind==='special';
   const reliable=!special&&prior&&!prior.missing_major_party_vote&&
     prior.recorded_dem_votes>0&&prior.recorded_rep_votes>0;
   let mean=(reliable?(0.65*margin(prior.dem_share_of_two_party)+
     .35*stateMargin(state)):stateMargin(state))+projectedSwing*.68;
   let sigma=reliable?17:special?25:23,method=reliable?
    'historical_2020_senate_plus_state_house':special?
    'special_election_state_house_proxy':'state_house_proxy_no_2020_two_party';
   const neutralPres=senatePriorMode==='current_2026'?
    presidentialStateTotals?.get(state):null;
   const neutralPresMargin=neutralPres?
    100*(neutralPres.d-neutralPres.r)/(neutralPres.d+neutralPres.r):null;
   let currentNeutralPrior=null,candidatePollResidual=null;
   if(senatePriorMode==='current_2026'){
    if(!finite(neutralPresMargin))
     throw Error('Missing verified 2026 Senate state geographic baseline '+code);
    currentNeutralPrior=neutralPresMargin+currentSenateNationalSwing;
    mean=currentNeutralPrior;
    sigma=special?17:15;
    method='2026_presidential_partisan_environment_no_old_candidate';
   }
   // The prior blanket 15pt LOCAL no-poll uncertainty gave rated Solid
   // Democratic races like NJ and VA about 25% Republican win chances.
   // This asymmetric data-quality issue affects both parties; reduce the
   // race-conditional residual only where INDEPENDENT 2026 analysis calls
   // a race Solid and no qualifying poll has been observed.
   const publicSolidParty=senatePriorMode==='current_2026'?
    SOLID_UNPOLLED_SENATE[code]||null:null;
   let pollFundamentalsGap=null,disagreementSigma=0,pollWeight=null,pollErrorBudget=null;
   const poll=odds.get('senate|'+code);
   if(poll){
    const priorMean=mean;
    // 2026 candidate strength is inferred from contemporary named matchup
    // polls, relative to the state-and-national candidate-neutral baseline.
    // Keep more weight on surveys than on conjectured candidate quality.
    const weight=senatePriorMode==='current_2026'?
     senateCandidatePollWeight(poll.independent_firms):
     (poll.independent_firms>=2?.90:.78);
    pollWeight=weight;
    candidatePollResidual=senatePriorMode==='current_2026'?
     poll.dem_minus_rep-currentNeutralPrior:null;
    mean=weight*poll.dem_minus_rep+(1-weight)*priorMean;
    // The historical whole-race error INCLUDES national/chamber/state shocks;
    // do not count it twice as an independent local residual.
    const latestPollAt=Date.parse(poll.latest_poll_end+'T12:00:00Z');
    const observedAt=Date.parse(s.polls.generated_at);
    if(!Number.isFinite(latestPollAt)||!Number.isFinite(observedAt))
     throw Error('Missing dates for Senate polling error budget '+code);
    const latestAge=Math.max(0,(observedAt-latestPollAt)/86400000);
    pollErrorBudget=senatePriorMode==='current_2026'?
     senatePollingErrorBudget({independentFirms:poll.independent_firms,
      contributingFirms:poll.contributing_firms,daysSinceLatest:latestAge,
      special,sourceSigma:poll.sigma_points}):null;
    sigma=senatePriorMode==='current_2026'?
     Math.sqrt(pollErrorBudget.totalSigma**2-senateSharedError**2):
     Math.max(7,poll.sigma_points);
    if(!special){
     pollFundamentalsGap=Math.round(1000*(poll.dem_minus_rep-priorMean))/1000;
     disagreementSigma=disagreementExtraSigma(poll.dem_minus_rep,priorMean,
      senatePriorMode==='current_2026'?.30:reliable?.55:.20);
     sigma=Math.round(1000*Math.hypot(sigma,disagreementSigma))/1000;
    }
    method='2026_poll_blend_'+method;
   }
   if(senatePriorMode==='current_2026'&&!poll&&publicSolidParty){
    const residualVariance=SOLID_NO_POLL_TOTAL_SIGMA**2-senateSharedError**2;
    if(residualVariance<=0)throw Error('Solid Senate error budget below shared variance');
    sigma=Math.sqrt(residualVariance);
    method='public_solid_no_poll_competitiveness_guard_'+method;
   }
   const upstream=senateMatchups.get(code);
   const expectedIndependent=INDEPENDENT_SENATE_PROXY_CANDIDATES[code];
   const nonrepIndependentProxy=Boolean(expectedIndependent&&upstream&&
    upstream.dem_candidate?.trim().toLowerCase()===expectedIndependent.toLowerCase());
   senate.push({code,state,mean:limit(mean,-55,55),sigma,
    method,polled:Boolean(poll),special,
    senate_prior_mode:senatePriorMode,
    neutral_presidential_margin_points:neutralPresMargin,
    candidate_neutral_2026_environment_margin_points:currentNeutralPrior,
    candidate_specific_2026_poll_residual_points:candidatePollResidual,
    public_solid_unpolled_party:senatePriorMode==='current_2026'&&!poll?
     publicSolidParty:null,
    public_solid_unpolled_total_sigma:senatePriorMode==='current_2026'&&
     !poll&&publicSolidParty?SOLID_NO_POLL_TOTAL_SIGMA:null,
    nonrep_independent_proxy:nonrepIndependentProxy,
    poll_weight:pollWeight,poll_fundamentals_gap_points:pollFundamentalsGap,
    polling_error_floor_points:pollErrorBudget?.floor??null,
    polling_error_tier:pollErrorBudget?.tier??null,
    polling_error_whole_race_sigma_points:pollErrorBudget?.totalSigma??null,
    disagreement_extra_sigma_points:disagreementSigma});
  }
  // Include EVERY polled governor matchup, not just the six governor
  // battlegrounds used by the four-endings near-sweep definition.
  // This is a polling-only governor prior, not a calibrated gubernatorial
  // candidate-fundamentals forecast.
  for(const poll of s.odds.records.filter(x=>x.office==='governor')){
   const code=normalizeCode(poll.race_code);
   if(!/^[A-Z]{2}-GOV$/.test(code))throw Error('Invalid governor race ID '+code);
   gov.push({code,state:code.slice(0,2),mean:poll.dem_minus_rep,
    sigma:pollLocalFromWhole(Math.max(GOVERNOR_POLL_WHOLE_SIGMA_MIN,poll.sigma_points),GOVERNOR_SHARED_SIGMA),
    polled:true,poll_weight:1,method:'2026_governor_poll_only_variance_conserving'});
  }
  gov.sort((a,b)=>a.code.localeCompare(b.code));
  if(house.length!==HOUSE_SEATS||senate.length!==SENATE_CONTESTS)
   throw Error('Incomplete ballot slot model');
  const names=new Set([...house,...senate,...gov].map(x=>x.code));
  if(BATTLEGROUNDS.some(code=>!names.has(code)))
   throw Error('Incomplete fixed battleground slate');
  const basis={schema_version:VERSION,status:'EXPERIMENTAL_UNCALIBRATED',
    fundamentals_mode:fundamentalsMode,senate_prior_mode:senatePriorMode,
    senate_current_context:senatePriorMode==='current_2026'?{
     geographic_baseline:'2024_presidential_two_party_on_2026_district_geography',
     national_presidential_margin_points:presidentialNationalMargin,
     national_generic_margin_points:generic,
     national_swing_coefficient:.55,
     national_swing_points:currentSenateNationalSwing,
     candidate_signal:'2026_named_matchup_poll_residual_vs_neutral_geography',
     model_revision:CURRENT_SENATE_MODEL_REVISION,
     poll_weight_firms_3_plus:.90,poll_weight_firms_5_plus:.94,
     poll_weight_firms_8_plus:.97,poll_weight_firms_2:.83,
     poll_weight_firms_1:.60,
     no_poll_solid_rating_source:'Inside Elections Senate ratings (2026-10-01)',
     no_poll_solid_rating_url:'https://insideelections.com/ratings/senate/',
     no_poll_solid_eligible_race_count:11,
     no_poll_solid_total_sigma:SOLID_NO_POLL_TOTAL_SIGMA,
     deep_special_poll_total_sigma_floor:SENATE_POLL_ERROR_FLOORS.deepSpecial,
     historical_2020_senate_candidate_margin_used:false,
     statewide_2024_house_party_aggregate_used:false,
     polled_race_total_sigma_floor:6.5,
     thin_stale_or_special_poll_total_sigma_floor:8.5,
     qualified_poll_min_independent_firms:2,
     qualified_poll_max_age_days:14,
     retrospective_poll_only_rmse_points:5.633,
     retrospective_20_day_poll_only_rmse_points:5.254,
     retrospective_20_day_qualified_floor_brier_6_5:0.1095,
     retrospective_20_day_previous_floor_brier_7_5:0.1108,
     retrospective_2020_20_day_exception_undercoverage:true,
     historical_research_first_publication_dates_verified:false,
     historical_poll_results_are_complete_model_backtest:false,
     polled_race_sigma_accounts_for_shared_errors:true,
     status:'PROVISIONAL_TRANSPARENT_FORECAST_NOT_HELDOUT_CALIBRATED'
    }:null,
    presidential_fundamentals_shadow:{
     mapped_2026_house_districts:presidential?presidential.size:0,
     national_presidential_2024_two_party_margin_points:presidentialNationalMargin,
     house_generic_swing_points:houseProjectedSwing,
     original_house_generic_swing_points:projectedSwing,
     source:'ElectIndex 2026-map presidential input with The Downballot crosschecks',
     status:'EXTERNAL_GEOGRAPHIC_PRIOR_NOT_INDEPENDENTLY_BACKTESTED'
    },
    fundamentals_shadow:{
     paired_districts:paired?paired.size:0,
     median_paired_2022_to_2024_swing_points:pairedNationalChange,
     prior_weight:fundamentalsMode==='two_cycle_shadow'?SHADOW_WEIGHT:0,
     absolute_residual_cap_points:SHADOW_RESIDUAL_CAP,
     changed_means:house.filter(x=>x.two_cycle_adjustment_points!==0).length,
     status:'NOT_BACKTESTED_DO_NOT_PROMOTE_AUTOMATICALLY'
    },
    generated_from_sources:{
     model_polling_at:s.polls.generated_at,
     generic_ballot_margin:generic,historical_house_2024_margin:house2024,
     implied_house_swing_points:projectedSwing,
     house_geography_changed:s.geography.summary?.redrawn_districts||0,
     senate_poll_count:senate.filter(x=>x.polled).length,
     house_poll_count:house.filter(x=>x.polled).length
    },
    assumptions:{house_seats:435,senate_contested:35,
     senate_dem_holdovers:34,senate_rep_holdovers:31,
     house_control_dem_seats:218,senate_control_dem_seats:51,
     common_national_sigma:SHARED_SIGMA.national,house_chamber_sigma:2.5,
     senate_chamber_sigma:SHARED_SIGMA.senateChamber,governor_chamber_sigma:3.5,
     state_house_sigma:3,state_senate_sigma:SHARED_SIGMA.senateState,
     state_governor_sigma:3,
     redrawn_state_additional_sigma:6,
     four_endings_thresholds:ENDING_THRESHOLDS,
     disagreement_model:'experimental_poll_vs_informative_prior_sigma_only',
     disagreement_deadzone_points:6,
     disagreement_slope:0.35,
     disagreement_extra_sigma_cap_points:6},
    battlegrounds:[...BATTLEGROUNDS],
    redrawn_state_distributions:redrawnStateDistributions,
    house,senate,governors:gov};
  return basis;
 }
 function simulate(basis,options={}){
  if(!basis||basis.schema_version!==VERSION||basis.house?.length!==435||
     basis.senate?.length!==35||basis.governors?.length<6)
    throw Error('Incomplete joint-control model basis');
  const samples=options.samples??4000,seed=options.seed??20261103;
  if(!Number.isInteger(samples)||samples<300||samples>30000)
   throw Error('Unacceptable simulation size');
  const capture=options.captureCountyDraws??null,replay=options.replayCountySeeds??null;
  if(capture!==null&&(!Array.isArray(capture)||capture.length<1||capture.length>18||
     new Set(capture).size!==capture.length||capture.some(c=>!['NE-SEN','SC-SEN','MI-07','PA-08','VA-02','AZ-06','PA-07','OH-SEN','ME-SEN','IA-SEN','KS-SEN','TX-SEN','WI-01','WI-03','MI-04','PA-10','NY-17','WA-03'].includes(c))))
   throw Error('Unsupported county-evidence capture scope');
  if(replay!==null&&(!(Array.isArray(replay)||Object.prototype.toString.call(replay)==='[object Uint32Array]')||
     replay.length!==samples||!replay.every(n=>Number.isInteger(n)&&n>0&&n<=4294967295)))
   throw Error('Invalid county-evidence replay states');
  if(capture&&replay)throw Error('Cannot capture and replay county draws in the same pass');
  const captured=capture?{codes:capture.slice(),seeds:new Uint32Array(samples),
   margins:Object.fromEntries(capture.map(c=>[c,new Float64Array(samples)])),
   house:new Uint16Array(samples),senate:new Uint8Array(samples)}:null;
  const captureSet=new Set(capture||[]);
  const holdovers=options.senateDemHoldovers??basis.assumptions.senate_dem_holdovers;
  const independentCredit=options.independentSenateCredit??'dem_proxy';
  if(!['dem_proxy','no_credit'].includes(independentCredit))
   throw Error('Unsupported independent Senate control sensitivity');
  if(independentCredit==='no_credit'&&
   basis.senate.filter(x=>x.nonrep_independent_proxy).length!==2)
   throw Error('Unverified independent Senate matchup identities');
  if(!Number.isInteger(holdovers)||holdovers<30||holdovers>38)
   throw Error('Unsupported Senate holdovers sensitivity');
  const nationalShift=options.nationalShift??0,errorMultiplier=options.errorMultiplier??1;
  if(!finite(nationalShift)||Math.abs(nationalShift)>7||
     !finite(errorMultiplier)||errorMultiplier<.6||errorMultiplier>1.7)
    throw Error('Unsupported forecast sensitivity');
  // Research-only covariance reallocation. It preserves each Senate
  // race's total error variance and its mean while changing how much of that
  // error is shared by OTHER Senate races. It must NEVER change the default
  // run, national-swing sensitivity, or House/governor race marginals.
  // Too few historical cycles exist to certify these parameters for live use.
  const corr=options.senateCorrelationResearch||null;
  if(corr!==null&&(typeof corr!=='object'||Array.isArray(corr)||
      !finite(corr.nationalScale)||!finite(corr.chamberScale)||
      corr.nationalScale<.5||corr.nationalScale>1||
      corr.chamberScale<.5||corr.chamberScale>1))
   throw Error('Unsupported research-only Senate correlation reallocation');
  const nationalScale=corr?.nationalScale??1,chamberScale=corr?.chamberScale??1;
  const senateNationalLocalVar=basis.assumptions.common_national_sigma**2*
    (1-nationalScale**2);
  const senateChamberLocalVar=basis.assumptions.senate_chamber_sigma**2*
    (1-chamberScale**2);
  const polls=basis.house.concat(basis.senate,basis.governors);
  // Optional attribution consumes the EXACT SAME joint draws and never
  // changes headline probabilities unless explicitly requested.
  const explainControl=options.explainControl===true;
  // Optional research-only reference-weighted national vote versus seats.
  // Weights must be provided explicitly, never guessed as 2026 turnout.
  const voteSeatWeights=options.voteSeatWeights;
  const voteSeatEnabled=voteSeatWeights!==undefined;
  let voteSeatArray=null,weightTotal=0;
  if(voteSeatEnabled){
   if(!Array.isArray(voteSeatWeights)||voteSeatWeights.length!==435)
    throw Error('Vote-seat diagnostic requires 435 audited turnout-weight records');
   const weights=new Map();
   for(const item of voteSeatWeights){
    const code=normalizeCode(item?.race_code),weight=item?.reference_two_party_votes;
    if(!code||weights.has(code)||!finite(weight)||weight<=0||weight>1e8)
     throw Error('Invalid or duplicated turnout weight '+code);
    weights.set(code,weight);
   }
   voteSeatArray=basis.house.map(r=>{
    const weight=weights.get(r.code);
    if(!finite(weight))throw Error('Missing 2026-district turnout reference '+r.code);
    weightTotal+=weight;
    return weight;
   });
   if(weights.size!==435||weightTotal<1e7)
    throw Error('Incomplete nationwide House turnout reference');
  }
  const voteSeatBins=voteSeatEnabled?new Map():null;
  let voteSeatWeightedMarginSum=0;
  const pivotalHouse=new Uint32Array(435),pivotalSenate=new Uint32Array(35);
  const senateWinsWithControl=new Uint32Array(35);
  const houseWinsWithControl=explainControl?new Uint32Array(435):null;
  const houseWinners=explainControl?new Uint8Array(435):null;
  const senateWinners=explainControl?new Uint8Array(35):null;
  let houseOnly=0,senateOnly=0;
  const outcomes={blue_tsunami:0,blue_wave:0,shrug:0,red_dawn:0};
  const rands=seeded(seed),live=options.live||Object.create(null);
  const a=basis.assumptions;
  const redraws=basis.redrawn_state_distributions||{};
  let houseSeats=0,senateSeats=0,fullBattleground=0,houseControl=0,senateControl=0,senateWaveGate=0,actualBothControl=0;
  const houseSeatDraws=[],senateSeatDraws=[];
  const raceDemWins=new Uint32Array(polls.length);
  for(let k=0;k<samples;k++){
   if(replay)rands.restore(replay[k]);
   if(captured)captured.seeds[k]=rands.state();
   const national=nationalShift+normal(rands)*a.common_national_sigma*errorMultiplier,
    houseShock=normal(rands)*a.house_chamber_sigma*errorMultiplier,
    senateShock=normal(rands)*a.senate_chamber_sigma*errorMultiplier,
    govShock=normal(rands)*a.governor_chamber_sigma*errorMultiplier;
   const stateDeltas=new Map(),redrawnBags=new Map();
   const nextRedrawnMargin=state=>{
    if(!redrawnBags.has(state)){
     const bag=(redraws[state]||[]).slice();
     if(!bag.length)throw Error('No verified redrawn state prior '+state);
     // Fisher-Yates: a fresh 2024 seat-margin permutation each election
     // draw, without assigning any old district to a new district ID.
     for(let z=bag.length-1;z>0;z--){
      const pick=Math.floor(rands()*(z+1));
      [bag[z],bag[pick]]=[bag[pick],bag[z]];
     }
     redrawnBags.set(state,bag);
    }
    const bag=redrawnBags.get(state);
    if(!bag.length)throw Error('Exhausted state redraw margins '+state);
    return bag.pop();
   };
   const stateError=state=>{
    if(!stateDeltas.has(state))
     stateDeltas.set(state,normal(rands));
    return stateDeltas.get(state);
   };
   let dHouse=0,dSenate=holdovers,winBattleground=0;
   let voteSeatWeightedMarginNumerator=0;
   for(let j=0;j<polls.length;j++){
    const item=polls[j],isHouse=j<435,isSenate=j>=435&&j<470;
    const scenario=live[item.code],meaningful=scenario&&
     scenario.mode==='live_informed'&&
     Number.isFinite(scenario.posteriorMargin)&&
     Number.isFinite(scenario.posteriorSigma)&&scenario.posteriorSigma>=0;
    const redrawMargin=isHouse&&item.redrawn_mix_weight>0?
      (nextRedrawnMargin(item.state)-item.redrawn_state_center)*
      item.redrawn_mix_weight:0;
    const mean=meaningful?scenario.posteriorMargin:item.mean+redrawMargin,
      sigma=meaningful?scenario.posteriorSigma:item.sigma;
    // The shared shocks remain even for live-informed margins, since the
    // early-return heuristic does not establish random-sample evidence.
    const stateShock=stateError(item.state)*errorMultiplier*
      (isHouse?a.state_house_sigma+
       (item.method.includes('redrawn_')?a.redrawn_state_additional_sigma:0):
       isSenate?a.state_senate_sigma:a.state_governor_sigma);
    const officeShock=isHouse?houseShock:isSenate?
      senateShock*chamberScale:govShock;
    const effectiveNational=isSenate?
      nationalShift+(national-nationalShift)*nationalScale:national;
    const effectiveSigma=isSenate&&corr?
      Math.sqrt(sigma*sigma+senateNationalLocalVar+senateChamberLocalVar):sigma;
    const finalMargin=mean+effectiveNational+officeShock+stateShock+
      normal(rands)*effectiveSigma*errorMultiplier;
    if(captured&&captureSet.has(item.code))captured.margins[item.code][k]=finalMargin;
    // Only the independently validated source winner flag can lock a 2026
    // race. A count lead is never a call; corrections restore uncertain draws.
    const sourceCalled=scenario?.mode==='source_called'&&
      (scenario.winnerParty==='D'||scenario.winnerParty==='R');
    const dem=sourceCalled?scenario.winnerParty==='D':finalMargin>0;
    if(dem)raceDemWins[j]++;
    if(isHouse){
     if(voteSeatEnabled)
      voteSeatWeightedMarginNumerator+=limit(finalMargin,-100,100)*voteSeatArray[j];
     if(dem)dHouse++;
     if(explainControl)houseWinners[j]=dem?1:0;
    }else if(isSenate){
     if(dem&&(independentCredit==='dem_proxy'||
       !item.nonrep_independent_proxy))dSenate++;
     if(explainControl)senateWinners[j-435]=dem?1:0;
    }
    if(dem&&BATTLEGROUND_SET.has(item.code)&&
     !(isSenate&&independentCredit==='no_credit'&&
       item.nonrep_independent_proxy))winBattleground++;
   }
   if(captured){captured.house[k]=dHouse;captured.senate[k]=dSenate;}
   const houseDem=dHouse>=a.house_control_dem_seats;
   if(voteSeatEnabled){
    const weightedMargin=voteSeatWeightedMarginNumerator/weightTotal;
    const bucket=limit(Math.floor(weightedMargin),-100,99);
    const row=voteSeatBins.get(bucket)||{draws:0,demSeats:0,houseControl:0,
     senateControl:0,bothControl:0,weightedMarginSum:0};
    row.draws++;row.demSeats+=dHouse;
    row.houseControl+=Number(dHouse>=a.house_control_dem_seats);
    row.senateControl+=Number(dSenate>=a.senate_control_dem_seats);
    row.bothControl+=Number(dHouse>=a.house_control_dem_seats&&
     dSenate>=a.senate_control_dem_seats);
    row.weightedMarginSum+=weightedMargin;
    voteSeatBins.set(bucket,row);
    voteSeatWeightedMarginSum+=weightedMargin;
   }
   const senateDem=dSenate>=a.senate_control_dem_seats;
   if(houseDem)houseControl++;
   if(senateDem)senateControl++;
   if(dSenate>=ENDING_THRESHOLDS.wave_senate)senateWaveGate++;
   if(houseDem&&senateDem)actualBothControl++;
   if(houseDem&&!senateDem)houseOnly++;
   if(senateDem&&!houseDem)senateOnly++;
   if(explainControl){
    if(houseDem)for(let q=0;q<435;q++)
     if(houseWinners[q])houseWinsWithControl[q]++;
    if(senateDem)for(let z=0;z<35;z++)
     if(senateWinners[z])senateWinsWithControl[z]++;
    // A one-seat flip can alter chamber control only at the boundary.
    if(dHouse===217||dHouse===218){
     const pivotalWin=dHouse===218?1:0;
     for(let h=0;h<435;h++)if(houseWinners[h]===pivotalWin)pivotalHouse[h]++;
    }
    if(dSenate===50||dSenate===51){
     const pivotalWin=dSenate===51?1:0;
     for(let z=0;z<35;z++)if(senateWinners[z]===pivotalWin)pivotalSenate[z]++;
    }
   }
   houseSeatDraws.push(dHouse);senateSeatDraws.push(dSenate);
   // Exactly one four-way scenario per common-seed election draw.
   // Wave requires actual 218-House / 51-Senate control; Tsunami is a
   // stronger mutually exclusive two-chamber result.
   outcomes[classifyFourEndings(dHouse,dSenate)]++;
   houseSeats+=dHouse;senateSeats+=dSenate;
   fullBattleground+=winBattleground;
  }
  // Marginal chamber odds MUST be counted from these SAME correlated
  // draws. Multiplying isolated odds would erase cross-chamber covariance.
  const bothCount=outcomes.blue_wave+outcomes.blue_tsunami;
  if(houseControl+senateWaveGate-2*bothCount!==outcomes.shrug||
     samples-houseControl-senateWaveGate+bothCount!==outcomes.red_dawn)
   throw Error('Four Endings thresholds inconsistent with simulated seats');
  if(actualBothControl!==bothCount||senateControl!==senateWaveGate||
     outcomes.shrug!==houseOnly+senateOnly)
   throw Error('Four Endings must EXACTLY match actual chamber control');
  houseSeatDraws.sort((a,b)=>a-b);senateSeatDraws.sort((a,b)=>a-b);
  const quantile=(vals,f)=>vals[Math.floor((vals.length-1)*f)];
  const pct=x=>Math.round(10000*x/samples)/100;
  const probs=Object.fromEntries(Object.entries(outcomes).map(([k,v])=>[k,pct(v)]));
  const race_probabilities=polls.map((item,index)=>{
   const isHouse=index<435,isSenate=index>=435&&index<470;
   const office=isHouse?'house':isSenate?'senate':'governor';
   const localShared=isHouse?a.state_house_sigma+
    (item.method.includes('redrawn_')?a.redrawn_state_additional_sigma:0):
    isSenate?a.state_senate_sigma:a.state_governor_sigma;
   const officeShared=isHouse?a.house_chamber_sigma:
    isSenate?a.senate_chamber_sigma:a.governor_chamber_sigma;
   // The research distribution reallocates shared Senate variance to
   // independent Senate local error, so one-race uncertainty is unchanged.
   const reportedLocalSigma=isSenate&&corr?
    Math.sqrt(item.sigma**2+senateNationalLocalVar+senateChamberLocalVar):
    item.sigma;
   const reportedNationalSigma=isSenate?
    a.common_national_sigma*nationalScale:a.common_national_sigma;
   const reportedOfficeSigma=isSenate?
    officeShared*chamberScale:officeShared;
   const totalSigma=Math.hypot(reportedLocalSigma,reportedNationalSigma,
    reportedOfficeSigma,localShared)*errorMultiplier;
   const wins=raceDemWins[index],demPct=pct(wins);
   return {race_code:item.code,office,model_dem_margin_points:item.mean,
    polled:item.polled,poll_weight:item.poll_weight??null,
    polling_error_tier:item.polling_error_tier??null,
    polling_error_floor_points:item.polling_error_floor_points??null,
    source_method:item.method,sigma_points:Math.round(totalSigma*1000)/1000,
    provider_called_party:live[item.code]?.mode==='source_called'&&
      ['D','R'].includes(live[item.code].winnerParty)?
      live[item.code].winnerParty:null,
    dem_beats_rep_pct:demPct,rep_beats_dem_pct:pct(samples-wins),
    simulated_dem_wins:wins,
    simulation_samples:samples};
  });
  const means={house_dem_seats:Math.round(100*houseSeats/samples)/100,
   senate_dem_seats:Math.round(100*senateSeats/samples)/100,
   battleground_dem_wins:Math.round(100*fullBattleground/samples)/100};
  const h=houseControl/samples,t=senateControl/samples,both=actualBothControl/samples;
  const binaryVariance=Math.sqrt(h*(1-h)*t*(1-t));
  const pivotRows=(items,tallies)=>items.map((item,i)=>({
   race_code:item.code,pivotal_draws:tallies[i],pivotal_pct:pct(tallies[i])
  })).sort((a,b)=>b.pivotal_draws-a.pivotal_draws||
   a.race_code.localeCompare(b.race_code));
  // Control covariance is a *descriptive* measure of which observed Senate
  // race results carry the most information about chamber control. Ranking
  // mechanical flip-at-50/51 counts instead misleadingly favors safe seats.
  const bellwethers=explainControl?basis.senate.map((seat,i)=>{
   const wins=raceDemWins[435+i],wonAndControl=senateWinsWithControl[i];
   const raceP=wins/samples,senateP=senateControl/samples;
   const cov=wonAndControl/samples-raceP*senateP;
   return {race_code:seat.code,dem_win_pct:pct(wins),
    control_covariance_pp:Math.round(cov*10000)/100,
    senate_control_if_dem_win_pct:wins?pct(wonAndControl* samples/wins):null,
    senate_control_if_rep_win_pct:wins<samples?
     pct((senateControl-wonAndControl)*samples/(samples-wins)):null,
    mechanical_pivotal_draws:pivotalSenate[i]};
  }).sort((a,b)=>b.control_covariance_pp-a.control_covariance_pp||
   a.race_code.localeCompare(b.race_code)):null;
  // Unlike mechanical pivots at 217/218, same-draw covariance ranks
  // uncertain district outcomes informative about House control. This is
  // NOT a forecast of an individual voter's causal power or elasticity.
  const houseBellwethers=explainControl?basis.house.map((seat,i)=>{
   const wins=raceDemWins[i],wonAndControl=houseWinsWithControl[i];
   const raceP=wins/samples,houseP=houseControl/samples;
   const cov=wonAndControl/samples-raceP*houseP;
   return {race_code:seat.code,dem_win_pct:pct(wins),
    control_covariance_pp:Math.round(cov*10000)/100,
    house_control_if_dem_win_pct:wins?pct(wonAndControl*samples/wins):null,
    house_control_if_rep_win_pct:wins<samples?
     pct((houseControl-wonAndControl)*samples/(samples-wins)):null,
    mechanical_pivotal_draws:pivotalHouse[i]};
  }).sort((a,b)=>b.control_covariance_pp-a.control_covariance_pp||
   a.race_code.localeCompare(b.race_code)):null;
  const voteSeatExplanation=voteSeatEnabled?{
   status:'EXPERIMENTAL_VOTE_SEAT_REFERENCE_WEIGHTED_NOT_ACTUAL_2026_VOTE',
   weight_source_label:options.voteSeatWeightLabel||'supplied_reference_two_party_turnout',
   weights_are_2026_turnout_forecasts:false,
   weight_total:weightTotal,verified_districts:voteSeatArray.length,
   simulated_mean_weighted_dem_margin_points:
    Math.round(1000*voteSeatWeightedMarginSum/samples)/1000,
   bins:[...voteSeatBins.entries()].sort((x,y)=>x[0]-y[0]).map(([bin,row])=>({
    dem_margin_bin_from:bin,dem_margin_bin_to:bin+1,
    sample_count:row.draws,sample_share_pct:pct(row.draws),
    simulated_mean_dem_margin_points:Math.round(100*row.weightedMarginSum/row.draws)/100,
    expected_dem_house_seats:Math.round(100*row.demSeats/row.draws)/100,
    dem_house_control_pct:Math.round(10000*row.houseControl/row.draws)/100,
    dem_senate_control_pct:Math.round(10000*row.senateControl/row.draws)/100,
    dem_both_control_pct:Math.round(10000*row.bothControl/row.draws)/100,
    low_support:row.draws<30
   })),
   method:'Same-draw simulated D-R district vote margin weighted by supplied fixed district reference turnout. Not observed or projected total ballots; third-party and 2026 turnout effects are not modeled.'
  }:null;
  const controlExplanation=explainControl?{
   house_only_pct:pct(houseOnly),senate_only_pct:pct(senateOnly),
   both_dem_pct:pct(actualBothControl),
   neither_dem_pct:pct(samples-houseControl-senateControl+actualBothControl),
   independent_chambers_reference_pct:Math.round(10000*h*t)/100,
   house_senate_control_phi:binaryVariance>0?
    Math.round(10000*(both-h*t)/binaryVariance)/10000:null,
   conditional_senate_given_house_pct:houseControl>0?
    Math.round(10000*actualBothControl/houseControl)/100:null,
   conditional_house_given_senate_pct:senateControl>0?
    Math.round(10000*actualBothControl/senateControl)/100:null,
   senate_pivotal_races:pivotRows(basis.senate,pivotalSenate),
   senate_control_bellwethers:bellwethers,
   top_house_control_bellwethers:houseBellwethers.slice(0,25),
   top_house_pivotal_races:pivotRows(basis.house,pivotalHouse).slice(0,20),
   note:'Mechanical pivotal counts are one-seat reversals. House and Senate bellwether covariance ranks observed race outcomes informative about chamber control. Neither measures causal voter influence, elasticity, or campaign impact.'
  }:null;
  return {schema_version:VERSION,status:'EXPERIMENTAL_UNCALIBRATED',
   ...(captured?{county_draws:captured}:{}),
   ...(replay?{simulation_draw_method:'IMPORTANCE_RESAMPLED_CORRELATED_PARTICLES_NOT_INDEPENDENT_NEW_ELECTIONS'}:{}),
   samples,seed,senate_dem_holdovers:holdovers,national_shift_points:nationalShift,error_multiplier:errorMultiplier,
   ...(corr?{senate_correlation_research:{
    model:'VARIANCE_CONSERVING_SCENARIO_NOT_BACKTESTED_PARAMETER',
    national_scale:nationalScale,senate_chamber_scale:chamberScale,
    senate_common_shared_sigma_points:+Math.hypot(
     a.common_national_sigma*nationalScale,
     a.senate_chamber_sigma*chamberScale).toFixed(3),
    unmodified_total_sigma_each_senate_race:true,
    house_governor_shared_shocks_unchanged:true}}:{}),
   ...(independentCredit!=='dem_proxy'?{senate_independent_credit_mode:independentCredit}:{}),
   probabilities:probs,counts:outcomes,means,
   four_endings_thresholds:ENDING_THRESHOLDS,
   senate_wave_gate_pct:pct(senateWaveGate),
   actual_dem_both_control_pct:pct(actualBothControl),
   race_probabilities,
   ...(explainControl?{control_explanation:controlExplanation}:{}),
   ...(voteSeatEnabled?{vote_seat_explanation:voteSeatExplanation}:{}),
   race_probability_method:'SAME_CORRELATED_DRAWS_AS_CHAMBER_CONTROL',
   // Legacy key: Wave OR Tsunami now equals actual Democratic control
   // of both chambers (>=218 House and >=51 Senate).
   blue_both_including_tsunami:pct(outcomes.blue_wave+outcomes.blue_tsunami),
   house_dem_control_pct:pct(houseControl),senate_dem_control_pct:pct(senateControl),
   seat_intervals_90_pct:{
    house_dem_seats:{p05:quantile(houseSeatDraws,.05),p50:quantile(houseSeatDraws,.5),p95:quantile(houseSeatDraws,.95)},
    senate_dem_seats:{p05:quantile(senateSeatDraws,.05),p50:quantile(senateSeatDraws,.5),p95:quantile(senateSeatDraws,.95)}
   },
   total_pct:Object.values(probs).reduce((x,y)=>x+y,0),
   description:'A conditional Monte Carlo sensitivity experiment, not a calibrated election forecast.'};
 }
 return Object.freeze({VERSION,BATTLEGROUNDS,FUNDAMENTALS_MODES,
  ENDING_THRESHOLDS,classifyFourEndings,prepare,simulate,seeded,
  disagreementExtraSigma,senatePollingErrorBudget});
});
