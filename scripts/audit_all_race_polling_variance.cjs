#!/usr/bin/env node
'use strict';
/* All-race polling error audit. A whole-race error estimate is not also
 * an independent residual that should be stacked with national/chamber/state.
 * Reconstruct the prior main model exactly and run fixed-seed simulations.
 * No Silver subscriber output, candidate odds targets, or party overrides.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const engine=require('./chamber_control_model.js');
const load=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'..','data',name+'.json'),'utf8'));
const sources={seats:load('seat_universe'),history:load('house_history_2024_staging'),
 geography:load('house_geography_bridge'),senateHistory:load('senate_history_2020_2022_2024'),
 polls:load('polling_estimates'),odds:load('race_probabilities'),
 presidential:load('presidential_2024_by_2026_district_staging')};
const modern=engine.prepare(sources,{senatePriorMode:'current_2026'});
const valid=new Map(sources.odds.records.map(x=>[x.office+'|'+x.race_code,x]));
const geo=new Map(sources.geography.districts.map(x=>[x.race_code_2026,x]));
const a=modern.assumptions;
const shared=office=>office==='house'?
 Math.hypot(a.common_national_sigma,a.house_chamber_sigma,a.state_house_sigma):
 Math.hypot(a.common_national_sigma,a.governor_chamber_sigma,a.state_governor_sigma);
const houseOld=modern.house.map(row=>{
 const p=valid.get('house|'+row.code);
 if(!p)return row;
 const g=geo.get(row.code);
 assert(g,'Missing House district '+row.code);
 const unchanged=g.geography_comparable_2024===true;
 const localFloor=unchanged?7:16; // active public House '2024_only' mode
 return {...row,sigma:Math.hypot(Math.max(localFloor,p.sigma_points),
  row.disagreement_extra_sigma_points||0)};
});
const govOld=modern.governors.map(row=>{
 const p=valid.get('governor|'+row.code);
 assert(p);return {...row,sigma:Math.max(7,p.sigma_points),
  method:'2026_governor_poll_only'};
});
const before={...modern,house:houseOld,governors:govOld};
const opts={samples:12000,seed:20261103};
const old=engine.simulate(before,opts),current=engine.simulate(modern,opts);
const oldMap=new Map(old.race_probabilities.map(x=>[x.office+'|'+x.race_code,x]));
const newMap=new Map(current.race_probabilities.map(x=>[x.office+'|'+x.race_code,x]));
const expected=new Map([...modern.house,...modern.senate,...modern.governors].map(x=>[x.code,x]));
assert.equal(newMap.size,modern.house.length+modern.senate.length+modern.governors.length);
assert.equal(modern.governors.length,valid.size-
 sources.odds.records.filter(x=>x.office!=='governor').length);
assert.deepEqual(current.race_probabilities.filter(r=>r.office==='senate'),
 old.race_probabilities.filter(r=>r.office==='senate'),
 'All 35 Senate projections must remain exactly unchanged by all-office variance accounting');
assert.equal(current.senate_dem_control_pct,old.senate_dem_control_pct);
const rows=[];
for(const race of current.race_probabilities){
 const key=race.office+'|'+race.race_code;
 const was=oldMap.get(key),p=valid.get(key),input=expected.get(race.race_code);
 assert(was&&input);
 assert.equal(race.model_dem_margin_points,was.model_dem_margin_points,
  'Margin must NEVER change as a consequence of an uncertainty fix '+key);
 if(race.office==='senate')continue;
 if(!p){
  assert.equal(race.sigma_points,was.sigma_points,
   'Unpolled House structural uncertainty must remain identical '+key);
  assert.equal(race.dem_beats_rep_pct,was.dem_beats_rep_pct,
   'Unpolled House odds should not be touched '+key);
  continue;
 }
 assert(race.sigma_points<=was.sigma_points+.002,
  'Whole-race error cannot become wider when double counting is corrected '+key);
 let expectedSigma;
 if(race.office==='governor'){
  expectedSigma=Math.max(7,p.sigma_points);
  assert.equal(input.poll_weight,1);
 }else{
  const g=geo.get(race.race_code);
  const unchanged=g.geography_comparable_2024===true;
  const floor=unchanged?7.5:16;
  expectedSigma=Math.hypot(Math.max(floor,p.sigma_points),
   input.disagreement_extra_sigma_points||0);
  assert.equal(input.method.includes('redrawn_'),!unchanged,
   'All public redrawn House contests must keep a separate geo risk '+key);
 }
 assert(Math.abs(race.sigma_points-expectedSigma)<.003,
  'Whole-race error does not match original assumed polling error '+key);
 rows.push({race_code:race.race_code,office:race.office,
  polling_D_margin:p.dem_minus_rep,modeled_D_margin:race.model_dem_margin_points,
  old_full_sigma:was.sigma_points,new_full_sigma:race.sigma_points,
  old_D_win_pct:was.dem_beats_rep_pct,new_D_win_pct:race.dem_beats_rep_pct,
  delta_D_pp:+(race.dem_beats_rep_pct-was.dem_beats_rep_pct).toFixed(2),
  independent_firms:p.independent_firms});
}
assert.equal(rows.filter(x=>x.office==='governor').length,modern.governors.length);
assert.equal(rows.filter(x=>x.office==='house').length,modern.house.filter(x=>x.polled).length);
assert(Math.abs(current.house_dem_control_pct-old.house_dem_control_pct)<=15,
 'Large House control change requires separate geographic investigation');
const sample=rows.filter(x=>['OH-GOV','TX-GOV','IA-GOV','FL-GOV','MI-GOV','AK-01','TX-15'].includes(x.race_code));
const out={status:'ALL_OFFICES_WHOLE_RACE_POLLING_VARIANCE_RECONCILED',
 source_polling_at:sources.polls.generated_at,seed:opts.seed,samples:opts.samples,
 senate_races_unchanged:35,
 house_unpolled_unchanged:modern.house.filter(x=>!x.polled).length,
 house_polled_checked:rows.filter(x=>x.office==='house').length,
 governor_polled_checked:rows.filter(x=>x.office==='governor').length,
 original_source_sigma_is_whole_race:true,
 no_silver_odds_or_party_targets:true,
 original_senate_control_pct:old.senate_dem_control_pct,
 current_senate_control_pct:current.senate_dem_control_pct,
 original_house_control_pct:old.house_dem_control_pct,
 current_house_control_pct:current.house_dem_control_pct,
 original_both_pct:old.blue_both_including_tsunami,
 current_both_pct:current.blue_both_including_tsunami,
 selected:sample,
 max_house_change_pp:Math.max(...rows.filter(x=>x.office==='house').map(x=>Math.abs(x.delta_D_pp))),
 max_governor_change_pp:Math.max(...rows.filter(x=>x.office==='governor').map(x=>Math.abs(x.delta_D_pp))),
 caveat:'A complete 2026 candidate-outcome backtest is still missing. House redraw-bag permutations are additional structural risk beyond reported conditional sigma; the 7.5/7-point source budgets are provisional assumptions.'};
if(process.argv.includes('--json'))console.log(JSON.stringify(out,null,2));
else{
 console.log('ALL-OFFICE POLL UNCERTAINTY: old duplicated variance versus conserved whole-race budget');
 console.table(sample);
 console.log('Office coverage: House polled',out.house_polled_checked,
  'governor polled',out.governor_polled_checked,'Senate unchanged',out.senate_races_unchanged);
 console.log('House control',out.original_house_control_pct,'→',out.current_house_control_pct,
  'Senate',out.original_senate_control_pct,'→',out.current_senate_control_pct);
 console.log(out.caveat);
}
