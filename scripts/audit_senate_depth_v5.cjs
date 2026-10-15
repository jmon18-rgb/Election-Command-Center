#!/usr/bin/env node
'use strict';
/* Same-draw test of depth-aware 2026 Senate polling, not a Silver-odds fit.
 * Reconstruct the prior v4 means and the 8.5-point special-election floor
 * from validated source inputs, then compare against live v5. This audit
 * never imports subscriber predictions or changes source probabilities.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const engine=require('./chamber_control_model.js');
const load=n=>JSON.parse(fs.readFileSync(path.join(__dirname,'..','data',n+'.json'),'utf8'));
const source={seats:load('seat_universe'),history:load('house_history_2024_staging'),
 geography:load('house_geography_bridge'),
 senateHistory:load('senate_history_2020_2022_2024'),
 polls:load('polling_estimates'),odds:load('race_probabilities'),
 presidential:load('presidential_2024_by_2026_district_staging')};
const after=engine.prepare(source,{senatePriorMode:'current_2026'});
assert.equal(after.senate_current_context.model_revision,'late_2026_depth_aware_special_v5');
const pollByRace=new Map(source.odds.records.filter(x=>x.office==='senate')
 .map(x=>[x.race_code,x]));
const shared=Math.hypot(after.assumptions.common_national_sigma,
 after.assumptions.senate_chamber_sigma,after.assumptions.state_senate_sigma);
const oldSeats=after.senate.map(row=>{
 const p=pollByRace.get(row.code);
 if(!p)return {...row};
 const oldW=p.independent_firms>=3?.90:p.independent_firms>=2?.83:.60;
 const oldMean=oldW*p.dem_minus_rep+
   (1-oldW)*row.candidate_neutral_2026_environment_margin_points;
 const full= row.special? Math.max(8.5,p.sigma_points):Math.max(6.5,p.sigma_points);
 const extra=row.disagreement_extra_sigma_points||0;
 const oldLocal=Math.hypot(Math.sqrt(full**2-shared**2),extra);
 return {...row,mean:oldMean,sigma:oldLocal,poll_weight:oldW};
});
const before={...after,senate:oldSeats};
const opts={samples:12000,seed:20261103};
const oldSim=engine.simulate(before,opts),newSim=engine.simulate(after,opts);
assert.deepEqual(oldSim.race_probabilities.filter(x=>x.office==='house'),
 newSim.race_probabilities.filter(x=>x.office==='house'));
assert.deepEqual(oldSim.race_probabilities.filter(x=>x.office==='governor'),
 newSim.race_probabilities.filter(x=>x.office==='governor'));
assert.equal(oldSim.house_dem_control_pct,newSim.house_dem_control_pct);
const output={status:'SENATE_DEPTH_CHANGE_SAME_DRAW_DIAGNOSTIC_NOT_EXTERNAL_ODDS_FIT',
 poll_source_at:source.polls.generated_at,
 independent_survey_thresholds:{firms_3:0.90,firms_5:0.94,firms_8:0.97},
 special_depth_min_independent:4,special_depth_min_contributing:6,
 uncertainty_floor_regular_recent:6.5,
 uncertainty_floor_deep_recent_special:7.5,
 uncertainty_floor_thin_stale_special:8.5,
 private_silver_odds_fitted:false,
 samples:opts.samples,seed:opts.seed,
 house_and_governor_unchanged:true,
 chamber:{old_dem_senate_pct:oldSim.senate_dem_control_pct,
 new_dem_senate_pct:newSim.senate_dem_control_pct,
 old_both_dem_pct:oldSim.blue_both_including_tsunami,
 new_both_dem_pct:newSim.blue_both_including_tsunami},
 races:['TX-SEN','OH-SEN','MN-SEN','NC-SEN','GA-SEN'].map(code=>{
  const old=oldSeats.find(x=>x.code===code),now=after.senate.find(x=>x.code===code);
  const p=pollByRace.get(code);
  const oldPct=oldSim.race_probabilities.find(x=>x.race_code===code);
  const newPct=newSim.race_probabilities.find(x=>x.race_code===code);
  return {code,independent_firms:p.independent_firms,latest_poll_end:p.latest_poll_end,
   polling_D_margin:p.dem_minus_rep,candidate_neutral_D_prior:now.candidate_neutral_2026_environment_margin_points,
   old_poll_weight:old.poll_weight,new_poll_weight:now.poll_weight,
   old_modeled_D_margin:old.mean,new_modeled_D_margin:now.mean,
   old_full_sigma:Math.hypot(old.sigma,shared),new_full_sigma:Math.hypot(now.sigma,shared),
   old_dem_win_pct:oldPct.dem_beats_rep_pct,new_dem_win_pct:newPct.dem_beats_rep_pct,
   change_win_probability_pp:newPct.dem_beats_rep_pct-oldPct.dem_beats_rep_pct};
 })
};
for(const code of ['TX-SEN','OH-SEN']){
 const r=output.races.find(x=>x.code===code);
 assert(r.new_modeled_D_margin>r.old_modeled_D_margin+.2,
  code+' deep polling must reduce the stale geographic markdown');
 assert(r.new_dem_win_pct>r.old_dem_win_pct+1,
  code+' qualified current polling must increase its probability in a fixed-seed simulation');
}
if(process.argv.includes('--json'))console.log(JSON.stringify(output,null,2));
else{
 console.log('Deep Senate polling: previous v4 vs 2026 v5 (same 12,000 correlated draws)');
 console.table(output.races.map(x=>({race:x.code,firms:x.independent_firms,
  polls_D:x.polling_D_margin,old_model_D:x.old_modeled_D_margin.toFixed(2),
  new_model_D:x.new_modeled_D_margin.toFixed(2),
  old_D_pct:x.old_dem_win_pct,new_D_pct:x.new_dem_win_pct,
  delta_pct:x.change_win_probability_pp.toFixed(2)})));
 console.log('Senate control',output.chamber,
  '; House and governors identical; no Silver forecasts used as calibration targets.');
}
