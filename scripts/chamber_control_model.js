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
 function prepare(s){
  validateInputs(s);
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
   let mean=baseline+projectedSwing,method=kind;
   const poll=odds.get('house|'+code);
   if(poll){
    const w=unchanged?(poll.independent_firms>=2?.78:.60):
      (poll.independent_firms>=2?.88:.76);
    mean=w*poll.dem_minus_rep+(1-w)*mean;
    sigma=unchanged?Math.max(7,poll.sigma_points):
      Math.max(16,poll.sigma_points);
    method='poll_blend_'+kind;
    if(!unchanged)redrawnMixWeight=1-w;
   }
   house.push({code,state,mean:limit(mean,-60,60),sigma,
     method,polled:Boolean(poll),redrawn_mix_weight:redrawnMixWeight,
     redrawn_state_center:redrawnStateCenter});
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
   const poll=odds.get('senate|'+code);
   if(poll){
    const weight=poll.independent_firms>=2?.90:.78;
    mean=weight*poll.dem_minus_rep+(1-weight)*mean;
    // The 2020 historical Senate polling-error RMSE was near seven
    // margin points. This is a conservative FLOOR, not a calibration.
    sigma=Math.max(7,poll.sigma_points);
    method='2026_poll_blend_'+method;
   }
   senate.push({code,state,mean:limit(mean,-55,55),sigma,
    method,polled:Boolean(poll),special:seat.election_kind==='special'});
  }
  for(const code of BATTLEGROUNDS.filter(x=>x.endsWith('-GOV'))){
   const poll=odds.get('governor|'+code);
   if(!poll)throw Error('Missing predefined governor battleground poll '+code);
   gov.push({code,state:code.slice(0,2),
     mean:poll.dem_minus_rep,sigma:Math.max(7,poll.sigma_points),
     polled:true,method:'2026_governor_poll'});
  }
  if(house.length!==HOUSE_SEATS||senate.length!==SENATE_CONTESTS)
   throw Error('Incomplete ballot slot model');
  const names=new Set([...house,...senate,...gov].map(x=>x.code));
  if(BATTLEGROUNDS.some(code=>!names.has(code)))
   throw Error('Incomplete fixed battleground slate');
  const basis={schema_version:VERSION,status:'EXPERIMENTAL_UNCALIBRATED',
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
     fixed_battleground_required_dem_wins:REQUIRED_BATTLEGROUND_WINS},
    battlegrounds:[...BATTLEGROUNDS],
    redrawn_state_distributions:redrawnStateDistributions,
    house,senate,governors:gov};
  return basis;
 }
 function simulate(basis,options={}){
  if(!basis||basis.schema_version!==VERSION||basis.house?.length!==435||
     basis.senate?.length!==35||basis.governors?.length!==6)
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
  const outcomes={blue_tsunami:0,blue_wave:0,shrug:0,red_dawn:0};
  const rands=seeded(seed),live=options.live||Object.create(null);
  const a=basis.assumptions;
  const redraws=basis.redrawn_state_distributions||{};
  let houseSeats=0,senateSeats=0,fullBattleground=0;
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
    if(isHouse){if(dem)dHouse++}
    else if(isSenate){if(dem)dSenate++}
    if(dem&&BATTLEGROUND_SET.has(item.code))winBattleground++;
   }
   const both=dHouse>=a.house_control_dem_seats&&
     dSenate>=a.senate_control_dem_seats;
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
  const pct=x=>Math.round(10000*x/samples)/100;
  const probs=Object.fromEntries(Object.entries(outcomes).map(([k,v])=>[k,pct(v)]));
  const means={house_dem_seats:Math.round(100*houseSeats/samples)/100,
   senate_dem_seats:Math.round(100*senateSeats/samples)/100,
   battleground_dem_wins:Math.round(100*fullBattleground/samples)/100};
  return {schema_version:VERSION,status:'EXPERIMENTAL_UNCALIBRATED',
   samples,seed,senate_dem_holdovers:holdovers,national_shift_points:nationalShift,error_multiplier:errorMultiplier,
   probabilities:probs,counts:outcomes,means,
   blue_both_including_tsunami:pct(outcomes.blue_wave+outcomes.blue_tsunami),
   house_dem_control_pct:null,senate_dem_control_pct:null,
   total_pct:Object.values(probs).reduce((x,y)=>x+y,0),
   description:'A conditional Monte Carlo sensitivity experiment, not a calibrated election forecast.'};
 }
 return Object.freeze({VERSION,BATTLEGROUNDS,prepare,simulate,seeded});
});