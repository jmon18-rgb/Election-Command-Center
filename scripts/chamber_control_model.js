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
 const FUNDAMENTALS_MODES=Object.freeze(['2024_only','two_cycle_shadow','presidential_2024_shadow']);
 const SHADOW_WEIGHT=.25,SHADOW_RESIDUAL_CAP=12;
 const BATTLEGROUNDS=Object.freeze([
  'NC-SEN','MI-SEN','ME-SEN','OH-SEN','TX-SEN','AK-SEN','NE-SEN','IA-SEN',
  'AZ-GOV','GA-GOV','MI-GOV','WI-GOV','NV-GOV','OH-GOV',
  'AZ-01','ME-02','NC-01','NE-02','NY-17','PA-10'
 ]);
 const REQUIRED_BATTLEGROUND_WINS=18;
 const BATTLEGROUND_SET=new Set(BATTLEGROUNDS);
 const HOUSE_SEATS=435,SENATE_CONTESTS=35;
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
  return ()=>{
   state^=state<<13;state^=state>>>17;state^=state<<5;
   return (state>>>0)/4294967296;
  };
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
  if(!FUNDAMENTALS_MODES.includes(fundamentalsMode))
   throw Error('Unsupported House fundamentals mode');
  // Require validated two-cycle sources for the explicit alternate model.
  // Default model must not depend on an experimental comparison file.
  let paired=null,pairedNationalChange=null;
  if(fundamentalsMode==='two_cycle_shadow'){
   const doc=s.twoCycle;
   if(!doc||doc.status!=='two_cycle_historical_comparison_only'||
      doc.is_forecast!==false||doc.coverage?.districts_with_two_historical_major_party_shares!==191||
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
   if(codes.size!==435||paired.size!==191)
    throw Error('Incomplete paired House historic source');
   changes.sort((a,b)=>a-b);
   pairedNationalChange=changes[(changes.length-1)/2];
   if(!finite(pairedNationalChange)||Math.abs(pairedNationalChange)>15)
    throw Error('Implausible paired nationwide district swing');
  }
  // District presidential vote totals must be mapped to the CURRENT 2026
  // jurisdiction before blending; a stale 2024 CD number is prohibited.
  let presidential=null,presidentialNationalMargin=null;
  if(fundamentalsMode==='presidential_2024_shadow'){
   const d=s.presidential;
   if(!d||d.schema_version!=='presidential-district-lean-staging-v1'||
      d.status!=='historical_presidential_votes_from_external_model_source_not_forecast'||
      d.election_year!==2024||d.district_map_year_claimed!==2026||
      !Array.isArray(d.records)||d.records.length!==HOUSE_SEATS||
      !d.external_source_blob_sha||!d.district_geo_source)
    throw Error('Missing verified-source presidential 2024 House district data');
   const expected=new Set(s.seats.house.seats.map(x=>normalizeCode(x.race_code)));
   presidential=new Map();
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
   }
   if(presidential.size!==HOUSE_SEATS)throw Error('Missing presidential district records');
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
  const houseProjectedSwing=presidential?
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
   const presidentialMargin=presidential?presidential.get(code):null;
   if(presidential){
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
   let mean=baseline+houseProjectedSwing,method=kind;
   let pollFundamentalsGap=null,disagreementSigma=0,pollWeight=null;
   const poll=odds.get('house|'+code);
   if(poll){
    const priorMean=mean;
    const w=unchanged?(poll.independent_firms>=2?.78:.60):
      (poll.independent_firms>=2?.88:.76);
    pollWeight=w;
    mean=w*poll.dem_minus_rep+(1-w)*priorMean;
    sigma=unchanged?Math.max(7,poll.sigma_points):
      Math.max(presidential?15:16,poll.sigma_points);
    // A presidential margin genuinely calculated under the 2026 map can
    // be compared with polls even for redrawn seats. Exchangeable statewide
    // 2024 House priors (default mode) still cannot.
    if(unchanged||presidential){
     pollFundamentalsGap=Math.round(1000*(poll.dem_minus_rep-priorMean))/1000;
     disagreementSigma=disagreementExtraSigma(poll.dem_minus_rep,priorMean,
      presidential?(unchanged&&both?.70:.45):(both?.65:.15));
     sigma=Math.round(1000*Math.hypot(sigma,disagreementSigma))/1000;
    }
    method='poll_blend_'+kind;
    if(!unchanged&&!presidential)redrawnMixWeight=1-w;
   }
   house.push({code,state,mean:limit(mean,-60,60),sigma,
     method,polled:Boolean(poll),redrawn_mix_weight:redrawnMixWeight,
     redrawn_state_center:redrawnStateCenter,
     poll_weight:pollWeight,poll_fundamentals_gap_points:pollFundamentalsGap,
     disagreement_extra_sigma_points:disagreementSigma,
     two_cycle_adjustment_points:Math.round(1000*twoCycleAdjustment)/1000,
     historical_2022_margin:twoCycle2022Margin,
     projected_2024_from_2022_margin:twoCycleProxy2024,
     presidential_2024_margin_points:presidentialMargin});
  }
  const senRecords=s.senateHistory.contest_records.filter(r=>
   r.election_year===2020&&r.election_type==='regular');
  const senate2020=new Map(senRecords.map(r=>[r.state,r]));
  for(const seat of s.seats.senate.contested_seats){
   const code=normalizeCode(seat.race_code),state=seat.state;
   const prior=senate2020.get(state);
   // A 2026 special election is a different seat from the state's
   // 2020 regular Senate election. Never reuse that candidate race as
   // if it were the same incumbency/fundamentals baseline.
   const special=seat.election_kind==='special';
   const reliable=!special&&prior&&!prior.missing_major_party_vote&&
      prior.recorded_dem_votes>0&&prior.recorded_rep_votes>0;
   let mean=(reliable?(0.65*margin(prior.dem_share_of_two_party)+
     .35*stateMargin(state)):stateMargin(state))+projectedSwing*.68;
   let sigma=reliable?17:special?25:23,method=reliable?
     'historical_2020_senate_plus_state_house':special?
     'special_election_state_house_proxy':'state_house_proxy_no_2020_two_party';
   let pollFundamentalsGap=null,disagreementSigma=0,pollWeight=null;
   const poll=odds.get('senate|'+code);
   if(poll){
    const priorMean=mean;
    const weight=poll.independent_firms>=2?.90:.78;
    pollWeight=weight;
    mean=weight*poll.dem_minus_rep+(1-weight)*priorMean;
    // The historical Senate polling-error RMSE is a floor rather than
    // a full forecast calibration. Add disagreement uncertainty only
    // when the historical prior actually describes the same seat.
    sigma=Math.max(7,poll.sigma_points);
    if(!special){
     pollFundamentalsGap=Math.round(1000*(poll.dem_minus_rep-priorMean))/1000;
     disagreementSigma=disagreementExtraSigma(poll.dem_minus_rep,priorMean,
      reliable?.55:.20);
     sigma=Math.round(1000*Math.hypot(sigma,disagreementSigma))/1000;
    }
    method='2026_poll_blend_'+method;
   }
   senate.push({code,state,mean:limit(mean,-55,55),sigma,
    method,polled:Boolean(poll),special:seat.election_kind==='special',
    poll_weight:pollWeight,poll_fundamentals_gap_points:pollFundamentalsGap,
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
    sigma:Math.max(7,poll.sigma_points),polled:true,
    poll_weight:1,method:'2026_governor_poll_only'});
  }
  gov.sort((a,b)=>a.code.localeCompare(b.code));
  if(house.length!==HOUSE_SEATS||senate.length!==SENATE_CONTESTS)
   throw Error('Incomplete ballot slot model');
  const names=new Set([...house,...senate,...gov].map(x=>x.code));
  if(BATTLEGROUNDS.some(code=>!names.has(code)))
   throw Error('Incomplete fixed battleground slate');
  const basis={schema_version:VERSION,status:'EXPERIMENTAL_UNCALIBRATED',
    fundamentals_mode:fundamentalsMode,
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
     common_national_sigma:3.5,house_chamber_sigma:2.5,
     senate_chamber_sigma:3,governor_chamber_sigma:3.5,
     state_house_sigma:3,state_senate_sigma:3.5,
     state_governor_sigma:3,
     redrawn_state_additional_sigma:6,
     fixed_battleground_required_dem_wins:REQUIRED_BATTLEGROUND_WINS,
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
  const holdovers=options.senateDemHoldovers??basis.assumptions.senate_dem_holdovers;
  if(!Number.isInteger(holdovers)||holdovers<30||holdovers>38)
   throw Error('Unsupported Senate holdovers sensitivity');
  const nationalShift=options.nationalShift??0,errorMultiplier=options.errorMultiplier??1;
  if(!finite(nationalShift)||Math.abs(nationalShift)>7||
     !finite(errorMultiplier)||errorMultiplier<.6||errorMultiplier>1.7)
    throw Error('Unsupported forecast sensitivity');
  const polls=basis.house.concat(basis.senate,basis.governors);
  // Optional attribution consumes the EXACT SAME joint draws and never
  // changes headline probabilities unless explicitly requested.
  const explainControl=options.explainControl===true;
  const pivotalHouse=new Uint32Array(435),pivotalSenate=new Uint32Array(35);
  const houseWinners=explainControl?new Uint8Array(435):null;
  const senateWinners=explainControl?new Uint8Array(35):null;
  let houseOnly=0,senateOnly=0;
  const outcomes={blue_tsunami:0,blue_wave:0,shrug:0,red_dawn:0};
  const rands=seeded(seed),live=options.live||Object.create(null);
  const a=basis.assumptions;
  const redraws=basis.redrawn_state_distributions||{};
  let houseSeats=0,senateSeats=0,fullBattleground=0,houseControl=0,senateControl=0;
  const houseSeatDraws=[],senateSeatDraws=[];
  const raceDemWins=new Uint32Array(polls.length);
  for(let k=0;k<samples;k++){
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
    const officeShock=isHouse?houseShock:isSenate?senateShock:govShock;
    const finalMargin=mean+national+officeShock+stateShock+
      normal(rands)*sigma*errorMultiplier;
    const dem=finalMargin>0;
    if(dem)raceDemWins[j]++;
    if(isHouse){
     if(dem)dHouse++;
     if(explainControl)houseWinners[j]=dem?1:0;
    }else if(isSenate){
     if(dem)dSenate++;
     if(explainControl)senateWinners[j-435]=dem?1:0;
    }
    if(dem&&BATTLEGROUND_SET.has(item.code))winBattleground++;
   }
   const houseDem=dHouse>=a.house_control_dem_seats;
   const senateDem=dSenate>=a.senate_control_dem_seats;
   if(houseDem)houseControl++;
   if(senateDem)senateControl++;
   if(houseDem&&!senateDem)houseOnly++;
   if(senateDem&&!houseDem)senateOnly++;
   if(explainControl){
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
   const both=houseDem&&senateDem;
   if(both){
    outcomes[winBattleground>=REQUIRED_BATTLEGROUND_WINS?
     'blue_tsunami':'blue_wave']++;
   }else if(dHouse<a.house_control_dem_seats&&
            dSenate<a.senate_control_dem_seats){
    outcomes.red_dawn++;
   }else outcomes.shrug++;
   houseSeats+=dHouse;senateSeats+=dSenate;
   fullBattleground+=winBattleground;
  }
  // Marginal chamber odds MUST be counted from these SAME correlated
  // draws. Multiplying isolated odds would erase cross-chamber covariance.
  const bothCount=outcomes.blue_wave+outcomes.blue_tsunami;
  if(houseControl+senateControl-2*bothCount!==outcomes.shrug||
     samples-houseControl-senateControl+bothCount!==outcomes.red_dawn)
   throw Error('Joint probabilities are inconsistent with chamber marginals');
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
   const totalSigma=Math.hypot(item.sigma,a.common_national_sigma,
    officeShared,localShared)*errorMultiplier;
   const wins=raceDemWins[index],demPct=pct(wins);
   return {race_code:item.code,office,model_dem_margin_points:item.mean,
    polled:item.polled,poll_weight:item.poll_weight??null,
    source_method:item.method,sigma_points:Math.round(totalSigma*1000)/1000,
    dem_beats_rep_pct:demPct,rep_beats_dem_pct:pct(samples-wins),
    simulated_dem_wins:wins,
    simulation_samples:samples};
  });
  const means={house_dem_seats:Math.round(100*houseSeats/samples)/100,
   senate_dem_seats:Math.round(100*senateSeats/samples)/100,
   battleground_dem_wins:Math.round(100*fullBattleground/samples)/100};
  const h=houseControl/samples,t=senateControl/samples,both=bothCount/samples;
  const binaryVariance=Math.sqrt(h*(1-h)*t*(1-t));
  const pivotRows=(items,tallies)=>items.map((item,i)=>({
   race_code:item.code,pivotal_draws:tallies[i],pivotal_pct:pct(tallies[i])
  })).sort((a,b)=>b.pivotal_draws-a.pivotal_draws||
   a.race_code.localeCompare(b.race_code));
  const controlExplanation=explainControl?{
   house_only_pct:pct(houseOnly),senate_only_pct:pct(senateOnly),
   both_dem_pct:pct(bothCount),neither_dem_pct:pct(outcomes.red_dawn),
   independent_chambers_reference_pct:Math.round(10000*h*t)/100,
   house_senate_control_phi:binaryVariance>0?
    Math.round(10000*(both-h*t)/binaryVariance)/10000:null,
   conditional_senate_given_house_pct:houseControl>0?
    Math.round(10000*bothCount/houseControl)/100:null,
   conditional_house_given_senate_pct:senateControl>0?
    Math.round(10000*bothCount/senateControl)/100:null,
   senate_pivotal_races:pivotRows(basis.senate,pivotalSenate),
   top_house_pivotal_races:pivotRows(basis.house,pivotalHouse).slice(0,20),
   note:'Pivotal means switching only that race outcome changes chamber control; same-draw sensitivity, not causal candidate influence.'
  }:null;
  return {schema_version:VERSION,status:'EXPERIMENTAL_UNCALIBRATED',
   samples,seed,senate_dem_holdovers:holdovers,national_shift_points:nationalShift,error_multiplier:errorMultiplier,
   probabilities:probs,counts:outcomes,means,
   race_probabilities,
   ...(explainControl?{control_explanation:controlExplanation}:{}),
   race_probability_method:'SAME_CORRELATED_DRAWS_AS_CHAMBER_CONTROL',
   blue_both_including_tsunami:pct(outcomes.blue_wave+outcomes.blue_tsunami),
   house_dem_control_pct:pct(houseControl),senate_dem_control_pct:pct(senateControl),
   seat_intervals_90_pct:{
    house_dem_seats:{p05:quantile(houseSeatDraws,.05),p50:quantile(houseSeatDraws,.5),p95:quantile(houseSeatDraws,.95)},
    senate_dem_seats:{p05:quantile(senateSeatDraws,.05),p50:quantile(senateSeatDraws,.5),p95:quantile(senateSeatDraws,.95)}
   },
   total_pct:Object.values(probs).reduce((x,y)=>x+y,0),
   description:'A conditional Monte Carlo sensitivity experiment, not a calibrated election forecast.'};
 }
 return Object.freeze({VERSION,BATTLEGROUNDS,FUNDAMENTALS_MODES,prepare,simulate,seeded,
  disagreementExtraSigma});
});