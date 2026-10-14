#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const model=require('./chamber_control_model.js');
const load=name=>JSON.parse(fs.readFileSync('data/'+name+'.json','utf8'));
const sources={
 seats:load('seat_universe'),history:load('house_history_2024_staging'),
 geography:load('house_geography_bridge'),
 senateHistory:load('senate_history_2020_2022_2024'),
 odds:load('race_probabilities'),polls:load('polling_estimates')
};
const basis=model.prepare(sources);
const presidentialState=load('presidential_2024_by_2026_district_staging');
const augmentedSources={...sources,presidential:presidentialState};
const varianceShadow=model.prepare(augmentedSources,{senateErrorMode:'historical_total_budget_shadow'});
const statePriorShadow=model.prepare(augmentedSources,{
 senateFundamentalsMode:'presidential_2024_state_shadow'});
const combinedSenateShadow=model.prepare(augmentedSources,{
 senateErrorMode:'historical_total_budget_shadow',
 senateFundamentalsMode:'presidential_2024_state_shadow'});
assert.equal(varianceShadow.senate_error_mode,'historical_total_budget_shadow');
assert.equal(statePriorShadow.senate_fundamentals_mode,'presidential_2024_state_shadow');
assert.equal(combinedSenateShadow.senate.length,35);
const mnCurrent=basis.senate.find(x=>x.code==='MN-SEN');
const mnBudget=varianceShadow.senate.find(x=>x.code==='MN-SEN');
const mnState=statePriorShadow.senate.find(x=>x.code==='MN-SEN');
assert(mnCurrent.sigma>=7);
assert(mnBudget.sigma<mnCurrent.sigma&&mnBudget.sigma>3);
assert.equal(mnBudget.mean,mnCurrent.mean,
 'Error budgeting cannot alter the assumed mean margin');
assert(mnState.mean>mnCurrent.mean,
 '2024 Minnesota presidential statewide prior must be distinct');
assert.deepEqual(varianceShadow.house,basis.house);
assert.deepEqual(statePriorShadow.house,basis.house);
assert.deepEqual(statePriorShadow.governors,basis.governors);
assert.throws(()=>model.prepare(sources,{
 senateFundamentalsMode:'presidential_2024_state_shadow'}),/Missing verified-source presidential/);
assert.throws(()=>model.prepare(augmentedSources,{
 senateErrorMode:'unknown'}),/Unsupported Senate/);
assert.throws(()=>model.prepare(augmentedSources,{
 senateFundamentalsMode:'unknown'}),/Unsupported Senate/);
const budgetSimulation=model.simulate(varianceShadow,{samples:1200,seed:20261103});
const budgetMN=budgetSimulation.race_probabilities.find(x=>x.race_code==='MN-SEN');
assert(budgetMN.sigma_points>=sources.odds.senate_baseline_rmse_points-.01);
assert(budgetMN.sigma_points<6.5);
assert(budgetSimulation.probabilities.independent_pivot>0);

assert.equal(basis.status,'EXPERIMENTAL_UNCALIBRATED');
assert.equal(basis.house.length,435);
assert.equal(basis.senate.length,35);
assert.equal(basis.governors.length,
 sources.odds.records.filter(x=>x.office==='governor').length);
assert(basis.governors.length>=6);
assert.equal(basis.battlegrounds.length,20);
assert.equal(basis.assumptions.senate_dem_holdovers,34);
assert(basis.generated_from_sources.generic_ballot_margin>0);
assert(basis.generated_from_sources.house_geography_changed>0);
assert.equal(basis.house.filter(r=>r.polled).length,60);
assert.equal(basis.senate.filter(r=>r.polled).length,24);
assert(basis.senate.filter(r=>r.polled).every(r=>r.sigma>=7),
 'Current Senate poll estimates must not use election-error widths below seven points');
// A Silver-inspired disagreement penalty is symmetric in party direction.
// Stronger polling/prior conflict widens errors, not the expected D or R margin.
assert.equal(model.disagreementExtraSigma(2,2,.65),0);
assert.equal(model.disagreementExtraSigma(10,3,.65),.227);
assert.equal(model.disagreementExtraSigma(-10,-3,.65),.227);
assert.equal(model.disagreementExtraSigma(50,-50,1),6);
assert.equal(model.disagreementExtraSigma(20,-20,0),0,
 'Exchangeable redraw priors cannot be treated as comparable district fundamentals');
assert.throws(()=>model.disagreementExtraSigma(2,1,1.1),/Invalid disagreement/);
assert.equal(basis.assumptions.disagreement_model,
 'experimental_poll_vs_informative_prior_sigma_only');
assert(basis.house.some(x=>x.polled&&x.disagreement_extra_sigma_points>0),
 'At least one well-identified House race should have poll/prior disagreement');
assert(basis.senate.some(x=>x.polled&&x.disagreement_extra_sigma_points>0),
 'At least one comparable Senate race should have poll/prior disagreement');
assert(basis.house.filter(x=>x.polled&&x.method.includes('redrawn_'))
 .every(x=>x.poll_fundamentals_gap_points===null &&
  x.disagreement_extra_sigma_points===0),
 'Redrawn-state aggregates are not mapped seat-specific priors');
assert(basis.senate.filter(x=>x.special)
 .every(x=>x.poll_fundamentals_gap_points===null &&
  x.disagreement_extra_sigma_points===0),
 'Senate special elections cannot be judged against a different seat');
assert([...basis.house,...basis.senate].every(x=>
 x.disagreement_extra_sigma_points>=0 &&
 x.disagreement_extra_sigma_points<=6));

// Geography-gated two-cycle House fundamentals are an explicit SHADOW,
// never silently used by the deployed 2024-only baseline.
const pairedContext=load('house_two_cycle_context');
const pairedSources={...sources,twoCycle:pairedContext};
const shadow=model.prepare(pairedSources,{fundamentalsMode:'two_cycle_shadow'});
assert.equal(basis.fundamentals_mode,'2024_only');
assert.equal(shadow.fundamentals_mode,'two_cycle_shadow');
assert.equal(shadow.fundamentals_shadow.paired_districts,191);
assert.equal(shadow.fundamentals_shadow.status,
 'NOT_BACKTESTED_DO_NOT_PROMOTE_AUTOMATICALLY');
assert(Math.abs(shadow.fundamentals_shadow.median_paired_2022_to_2024_swing_points)<5);
const baseHouse=new Map(basis.house.map(r=>[r.code,r]));
const shadowHouse=new Map(shadow.house.map(r=>[r.code,r]));
const comparable=new Set(pairedContext.rows.filter(r=>
 r.can_compare_historic_two_party_votes).map(r=>r.race_code_2026));
assert.equal(comparable.size,191);
let modified=0;
for(const [code,item] of shadowHouse){
 const original=baseHouse.get(code);
 assert(original);
 const adjustment=item.two_cycle_adjustment_points;
 if(adjustment!==0)modified++;
 assert(Math.abs(adjustment)<=3.001,'Bound shadow historical residual');
 if(!comparable.has(code)){
  assert.equal(adjustment,0,'Never cross 2022/2024 map or ballot gaps');
  assert.equal(item.mean,original.mean,'Uncomparable seat prior unchanged');
 }else{
  const retained=item.poll_weight===null?1:1-item.poll_weight;
  if(Math.abs(original.mean)<55)
   assert(Math.abs((item.mean-original.mean)-retained*adjustment)<.0011,
    'A paired 2022 residual must be shrunk by the existing 2026 poll blend');
 }
}
assert(modified>150);
assert.deepEqual(shadow.senate,basis.senate,'House alternate must not alter Senate');
assert.deepEqual(shadow.governors,basis.governors,'House alternate must not alter Governors');
assert.deepEqual(shadow.redrawn_state_distributions,basis.redrawn_state_distributions,
 'No 2022 votes may be assigned by 2026 redrawn district number');
assert.deepEqual(model.prepare(pairedSources),basis,
 'Providing experimental source alone must never change live baseline');
assert.throws(()=>model.prepare(sources,{fundamentalsMode:'two_cycle_shadow'}),
 /Missing validated/);
assert.throws(()=>model.prepare(pairedSources,{fundamentalsMode:'unsanctioned'}),
 /Unsupported House fundamentals/);
const alteredPairs={...pairedContext,rows:pairedContext.rows.map(r=>
 r.race_code_2026==='AK-01'?{...r,recorded_dem_share_2024_two_party:.8}:r)};
assert.throws(()=>model.prepare({...pairedSources,twoCycle:alteredPairs},
 {fundamentalsMode:'two_cycle_shadow'}),/2024 source disagreement/);
const swappedPairs={...pairedContext,rows:[...pairedContext.rows]};
swappedPairs.rows[1]=swappedPairs.rows[0];
assert.throws(()=>model.prepare({...pairedSources,twoCycle:swappedPairs},
 {fundamentalsMode:'two_cycle_shadow'}),/Duplicate two-cycle district/);
const shadowResult=model.simulate(shadow,{samples:1200,seed:20261103});
assert(Number.isFinite(shadowResult.blue_both_including_tsunami));
// Silver-style presidential district partisan lean is a SHADOW, never the
// default production input. Cross-check the entire 2026 geographic universe.
const presidential=load('presidential_2024_by_2026_district_staging');
const presSources={...sources,presidential};
const presShadow=model.prepare(presSources,{fundamentalsMode:'presidential_2024_shadow'});
assert.equal(presShadow.fundamentals_mode,'presidential_2024_shadow');
assert.equal(presShadow.presidential_fundamentals_shadow.mapped_2026_house_districts,435);
assert(presShadow.presidential_fundamentals_shadow.house_generic_swing_points>0);
assert.equal(model.prepare(presSources).fundamentals_mode,'2024_only');
assert.deepEqual(model.prepare(presSources).senate,basis.senate,
 'Optional presidential House input must not change Senate means');
assert.deepEqual(presShadow.senate,basis.senate,
 '2026 district presidential priors must not leak into Senate forecasts');
assert.deepEqual(presShadow.governors,basis.governors);
assert.equal(presShadow.house.filter(x=>Number.isFinite(x.presidential_2024_margin_points)).length,435);
assert(presShadow.house.filter(x=>x.method.includes('redrawn_')).every(x=>
 x.redrawn_mix_weight===0 && x.redrawn_state_center===null),
 'Redrawn districts must use 2026-map-specific presidential leans rather than old House numbers');
assert(presShadow.house.some(x=>x.code==='CA-01'&&x.presidential_2024_margin_points>10),
 'California new district presidential prior should be mapped, not inferred from old district votes');
assert(presShadow.house.some(x=>x.code==='VA-01'&&x.presidential_2024_margin_points<-4),
 'Unchanged Virginia district needs presidential lean');
assert(presShadow.house.some(x=>x.code==='MO-05'&&x.presidential_2024_margin_points>20),
 'Missouri unchanged court-stayed map must use the 2024 configuration');
assert(presShadow.house.some(x=>x.code==='TX-28'&&x.presidential_2024_margin_points<-10),
 '2026 Texas district presidential lean must be correctly aligned');
assert.notDeepEqual(presShadow.house.map(x=>x.mean),basis.house.map(x=>x.mean));
const presSim=model.simulate(presShadow,{samples:1200,seed:20261103});
assert(Number.isFinite(presSim.blue_both_including_tsunami));
assert.throws(()=>model.prepare(sources,{fundamentalsMode:'presidential_2024_shadow'}),
 /Missing verified-source presidential/);
const badPres={...presidential,records:presidential.records.slice(1)};
assert.throws(()=>model.prepare({...presSources,presidential:badPres},
 {fundamentalsMode:'presidential_2024_shadow'}),/Missing verified-source presidential/);
const mismatchPres={...presidential,records:presidential.records.map(x=>
 x.race_code==='VA-01'?{...x,dem_pres_2024_votes:x.dem_pres_2024_votes+10000}:x)};
assert.throws(()=>model.prepare({...presSources,presidential:mismatchPres},
 {fundamentalsMode:'presidential_2024_shadow'}),/margin\/vote disagreement/);
const duplicatePres={...presidential,records:[...presidential.records]};
duplicatePres.records[0]=duplicatePres.records[1];
assert.throws(()=>model.prepare({...presSources,presidential:duplicatePres},
 {fundamentalsMode:'presidential_2024_shadow'}),/duplicate presidential/);
const wrongMapPres={...presidential,district_map_year_claimed:2024};
assert.throws(()=>model.prepare({...presSources,presidential:wrongMapPres},
 {fundamentalsMode:'presidential_2024_shadow'}),/Missing verified-source presidential/);

const specialSeats=basis.senate.filter(x=>x.special);
assert.equal(specialSeats.length,2);
assert(specialSeats.every(x=>!x.method.includes('historical_2020_senate')),
 'A 2026 special cannot borrow a different seat\'s 2020 regular Senate baseline');

assert(basis.house.some(r=>r.method==='redrawn_state_distribution_proxy'));
assert(basis.house.some(r=>r.method==='uncontested_or_missing_party_proxy'));
const rebuilt=new Map(basis.house.map(r=>[r.code,r]));
const los=rebuilt.get('CA-01');
assert(los&&los.method.includes('redrawn_'),
 'Changed-boundary districts must never use a 2024 district-specific mapping');

const rebuiltCA=basis.house.filter(x=>x.state==='CA');
const unpolledRedraw=rebuiltCA.filter(x=>x.redrawn_mix_weight===1);
assert(unpolledRedraw.length>35,
 'Most new California districts lack named-matchup polls');
assert.equal(new Set(unpolledRedraw.map(x=>x.mean)).size,1,
 'Unpolled redrawn district numbers cannot determine their assigned 2024 party margin');
assert.equal(new Set(unpolledRedraw.map(x=>x.redrawn_state_center)).size,1);
assert.equal(basis.redrawn_state_distributions.CA.length,52);
assert.equal(basis.redrawn_state_distributions.TX.length,38);
assert.equal(basis.redrawn_state_distributions.NC.length,14);
for(const [state,marginList] of Object.entries(basis.redrawn_state_distributions)){
 const count=basis.house.filter(x=>x.state===state&&x.method.includes('redrawn_')).length;
 assert.equal(marginList.length,count,'One prior district margin per new House seat: '+state);
 assert(marginList.every(Number.isFinite),'Redrawn baseline must have finite margins');
}
assert(basis.house.some(x=>x.polled&&x.method.includes('redrawn_')&&
 x.redrawn_mix_weight>0&&x.redrawn_mix_weight<1),
 'Polled redrawn districts mix poll and *exchangeable* old state distribution');

const unchanged=rebuilt.get('AK-01');
assert(unchanged&&unchanged.method.includes('unchanged_2024_recorded'));
const known=new Set([...basis.house,...basis.senate,...basis.governors].map(x=>x.code));
assert.equal(known.size,basis.house.length+basis.senate.length+basis.governors.length);
for(const seat of [...basis.house,...basis.senate,...basis.governors]){
 assert(seat.state.length===2);
 assert(seat.mean>=-60&&seat.mean<=60&&seat.sigma>=5);
}
const before=JSON.stringify(basis);
const opts={samples:1200,seed:20261103};
const first=model.simulate(basis,opts),second=model.simulate(basis,opts);
const redrawnOnly=model.simulate(basis,{samples:1200,seed:20261104});
assert.notDeepEqual(redrawnOnly.counts,first.counts,
 'Re-drawn seat assignment and independent error must vary across seeded draws');
assert.throws(()=>model.simulate({...basis,redrawn_state_distributions:{
 ...basis.redrawn_state_distributions,CA:[]}},opts),/No verified redrawn state prior/);

assert.deepEqual(first,second,'Seeds must make simulated election outcomes reproducible');
const explained=model.simulate(basis,{...opts,explainControl:true});
assert.deepEqual(explained.probabilities,first.probabilities,
 'Requesting diagnostics must NOT change default four-outcome probabilities');
assert.deepEqual(explained.race_probabilities,first.race_probabilities,
 'Pivotal tracing must NOT change any race-winning probability');
assert.equal(first.control_explanation,undefined,
 'Only explicitly requested diagnostics appear in default public output');
const explanation=explained.control_explanation;
assert.equal(explanation.senate_pivotal_races.length,35);
assert.equal(explanation.senate_control_bellwethers.length,35);
assert(explanation.senate_control_bellwethers.every((x,i,arr)=>
 i===0||arr[i-1].control_covariance_pp>=x.control_covariance_pp));
assert(explanation.senate_control_bellwethers.every(x=>
 x.dem_win_pct>=0&&x.dem_win_pct<=100&&
 Number.isFinite(x.control_covariance_pp)));
const topBell=explanation.senate_control_bellwethers.slice(0,6);
assert(topBell.some(x=>['TX-SEN','OH-SEN','ME-SEN','IA-SEN','AK-SEN','NE-SEN'].includes(x.race_code)),
 'A useful bellwether ranking should include at least one close contest');
assert.equal(explanation.top_house_pivotal_races.length,20);
assert(Math.abs(explanation.house_only_pct+explanation.senate_only_pct-
 explained.probabilities.shrug-
 explanation.independent_pivot_house_dem_pct)<.03);
assert(Math.abs(explanation.independent_chambers_reference_pct-
 explained.house_dem_control_pct*explained.senate_dem_control_pct/100)<.02);
assert(explanation.house_senate_control_phi===null||
 Math.abs(explanation.house_senate_control_phi)<=1.0001);
// A deliberately deterministic 16+1 Democratic and 18 Republican contest
// Senate verifies the exact majority threshold and pivotal outcome counting.
const rigidDemCodes=new Set(basis.senate.filter(x=>x.first_candidate_dem_caucus)
 .slice(0,17).map(x=>x.code));
assert.equal(rigidDemCodes.size,17);
const rigid={...basis,assumptions:{...basis.assumptions,
 common_national_sigma:0,house_chamber_sigma:0,senate_chamber_sigma:0,
 governor_chamber_sigma:0,state_house_sigma:0,state_senate_sigma:0,
 state_governor_sigma:0,redrawn_state_additional_sigma:0},
 senate:basis.senate.map(x=>({...x,mean:rigidDemCodes.has(x.code)?50:-50,sigma:0}))};
const rigidSim=model.simulate(rigid,{samples:300,seed:17,explainControl:true});
assert.equal(rigidSim.senate_dem_control_pct,100);
const rigidPivots=new Map(rigidSim.control_explanation.senate_pivotal_races
 .map(x=>[x.race_code,x.pivotal_pct]));
rigid.senate.forEach(x=>assert.equal(rigidPivots.get(x.code),
 rigidDemCodes.has(x.code)?100:0));

assert.equal(JSON.stringify(basis),before,'Forecast must not modify source priors');
assert.equal(first.counts.blue_tsunami+first.counts.blue_wave+
 first.counts.shrug+first.counts.red_dawn+
 first.counts.independent_pivot,first.samples);
assert(Math.abs(first.total_pct-100)<0.025);
assert(Math.abs(first.blue_both_including_tsunami-
 first.probabilities.blue_wave-first.probabilities.blue_tsunami)<.025);
assert(first.probabilities.independent_pivot>0);
assert.equal(first.senate_independent_context.non_majority_caucus_balance_pct,
 first.probabilities.independent_pivot);
assert.deepEqual(Object.keys(model.INDEPENDENT_SENATE_FIRST).sort(),[
 'ID-SEN','NE-SEN','SD-SEN']);
assert(['ID-SEN','NE-SEN','SD-SEN'].every(code=>
 basis.senate.find(r=>r.code===code).first_candidate_party==='I'));
assert(basis.senate.find(r=>r.code==='MT-SEN').incomplete_ballot_caveat);
assert(basis.senate.find(r=>r.code==='AK-SEN').incomplete_ballot_caveat);
for(const x of Object.values(first.probabilities))
 assert(Number.isFinite(x)&&x>=0&&x<=100);
assert(first.means.house_dem_seats>0&&first.means.house_dem_seats<435);
assert(first.means.senate_dem_seats>=30&&first.means.senate_dem_seats<=73);
assert(first.house_dem_control_pct>=0&&first.house_dem_control_pct<=100,
 'House control probability is derived from joint same-draw votes');
assert(first.senate_dem_control_pct>=0&&first.senate_dem_control_pct<=100,
 'Senate control probability is derived from joint same-draw votes');
assert.equal(first.race_probability_method,'SAME_CORRELATED_DRAWS_AS_CHAMBER_CONTROL');
assert.equal(first.race_probabilities.length,
 basis.house.length+basis.senate.length+basis.governors.length);
const winCodes=new Set(first.race_probabilities.map(x=>x.race_code));
assert.equal(winCodes.size,first.race_probabilities.length);
assert(first.race_probabilities.some(x=>x.race_code==='MN-SEN'));
for(const race of first.race_probabilities){
 assert.equal(race.simulation_samples,first.samples);
 assert.equal(race.office,race.race_code.endsWith('-GOV')?'governor':
  race.race_code.endsWith('-SEN')?'senate':'house');
 assert(race.simulated_dem_wins>=0&&race.simulated_dem_wins<=first.samples);
 assert(Math.abs(race.dem_beats_rep_pct-
  100*race.simulated_dem_wins/first.samples)<.011);
 assert.equal(Math.round((race.dem_beats_rep_pct+race.rep_beats_dem_pct)*100)/100,100);
 assert(race.sigma_points>=3);
}
const expectedSeatWins=first.race_probabilities.filter(x=>x.office==='house')
 .reduce((n,x)=>n+x.simulated_dem_wins,0)/first.samples;
const expectedSenateWins=first.race_probabilities.filter(x=>x.office==='senate')
 .reduce((n,x)=>n+x.simulated_dem_wins,0)/first.samples+
 first.senate_dem_holdovers;
assert(Math.abs(expectedSeatWins-first.means.house_dem_seats)<.02,
 'House race win frequencies must reconcile with same simulated chamber seat totals');
assert(Math.abs(expectedSenateWins-first.means.senate_dem_seats)<.02,
 'Senate race win frequencies must reconcile with same simulated chamber seat totals');
const bothPct=first.blue_both_including_tsunami;
const splitPct=first.probabilities.shrug,redPct=first.probabilities.red_dawn;
const pivot=first.senate_independent_context;
assert(Math.abs(first.house_dem_control_pct+first.senate_dem_control_pct-
 2*bothPct-splitPct-pivot.pivot_with_house_dem_pct)<.06,
 'Chamber marginals must reconcile with split control and an independent pivot');
assert(Math.abs(100-first.house_dem_control_pct-first.senate_dem_control_pct+
 bothPct-redPct-pivot.pivot_with_house_rep_pct)<.06,
 'Republican control must exclude independent Senate balance-of-power outcomes');
assert(Math.abs(pivot.pivot_with_house_dem_pct+pivot.pivot_with_house_rep_pct-
 first.probabilities.independent_pivot)<.03);
assert(first.house_dem_control_pct+0.01>=bothPct);
assert(first.senate_dem_control_pct+0.01>=bothPct);
for(const [key,total] of [['house_dem_seats',435],['senate_dem_seats',100]]){
 const x=first.seat_intervals_90_pct[key];
 assert(Number.isInteger(x.p05)&&Number.isInteger(x.p50)&&Number.isInteger(x.p95));
 assert(x.p05<=x.p50&&x.p50<=x.p95);
 assert(x.p05>=0&&x.p95<=total);
}
assert(first.seat_intervals_90_pct.house_dem_seats.p05<=
 first.means.house_dem_seats);
assert(first.seat_intervals_90_pct.house_dem_seats.p95>=
 first.means.house_dem_seats);
assert.throws(()=>model.prepare({...sources,odds:{...sources.odds,
 polling_source_generated_at:'1970-01-01T00:00:00Z'}}),/stale or mismatched/);
assert.throws(()=>model.prepare({...sources,history:{records:[]}}),/stale or mismatched/);
assert.throws(()=>model.simulate({...basis,house:basis.house.slice(1)}),/Incomplete/);
assert.throws(()=>model.simulate(basis,{samples:0}),/Unacceptable/);
assert.throws(()=>model.simulate(basis,{samples:999999}),/Unacceptable/);
assert.throws(()=>model.simulate(basis,{samples:1000,senateDemHoldovers:45}),/holdovers/);
// No fabricated official certification: a raw modeled race prior, no result,
// cannot be directly interpreted as an observed live vote or an official call.
const shock=model.simulate(basis,{samples:1200,seed:20261103,
 live:{'NC-SEN':{mode:'live_informed',posteriorMargin:-40,posteriorSigma:1}}});
assert.notDeepEqual(shock,first,'Observed-result map should affect simulations');
console.log('Joint congressional beta: all 470 contested seats, 6 gov battlegrounds, 4 exhaustive outcomes, geographically cautious assumptions, reproducible seeded draws');
console.log('Model probabilities (diagnostic only):',JSON.stringify(first.probabilities));
