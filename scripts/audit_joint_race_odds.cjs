#!/usr/bin/env node
'use strict';
/* The ONLY user-facing race odds are SAME-DRAW joint probabilities.
 * This audit deliberately compares old poll-only odds for diagnosis.
 * Never publishes them or lets them drive House/Senate joint outcomes.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const model=require('./chamber_control_model.js');
const read=n=>JSON.parse(fs.readFileSync(path.join(__dirname,'..','data',n+'.json'),'utf8'));
const src={seats:read('seat_universe'),history:read('house_history_2024_staging'),
 geography:read('house_geography_bridge'),
 senateHistory:read('senate_history_2020_2022_2024'),
 polls:read('polling_estimates'),odds:read('race_probabilities')};
const basis=model.prepare(src);
const scenarios={
 base:model.simulate(basis,{samples:6000,seed:20261103}),
 wider:model.simulate(basis,{samples:6000,seed:20261103,errorMultiplier:1.3}),
 tighter:model.simulate(basis,{samples:6000,seed:20261103,errorMultiplier:.8})
};
const source=new Map(src.odds.records.map(x=>[x.office+'|'+x.race_code,x]));
const by=(sim)=>new Map(sim.race_probabilities.map(x=>[x.office+'|'+x.race_code,x]));
const normal=by(scenarios.base),wide=by(scenarios.wider),tight=by(scenarios.tighter);
const pct=x=>Math.round(x*100)/100;
const comparisons=[...normal].filter(([k,x])=>source.has(k)&&x.polled)
 .map(([k,x])=>{
  const legacy=source.get(k),w=wide.get(k),t=tight.get(k);
  if(!w||!t)throw Error('Missing correlated sensitivity '+k);
  return {race_code:x.race_code,office:x.office,
   poll_average_dem_minus_rep_points:legacy.dem_minus_rep,
   full_joint_modeled_dem_minus_rep_points:pct(x.model_dem_margin_points),
   legacy_poll_only_research_probability_pct:legacy.dem_beats_rep_pct,
   linked_joint_dem_probability_pct:x.dem_beats_rep_pct,
   narrower_error_joint_probability_pct:t.dem_beats_rep_pct,
   wider_error_joint_probability_pct:w.dem_beats_rep_pct,
   joint_vs_legacy_percentage_points:pct(x.dem_beats_rep_pct-legacy.dem_beats_rep_pct),
   legacy_local_error_sigma_points:legacy.sigma_points,
   joint_total_error_sigma_points:x.sigma_points,
   user_facing_source:'joint_correlated_draws_only'};
 });
const mn=comparisons.find(x=>x.race_code==='MN-SEN'&&x.office==='senate');
if(!mn||mn.legacy_poll_only_research_probability_pct<70||
 mn.linked_joint_dem_probability_pct>=mn.legacy_poll_only_research_probability_pct||
 mn.joint_total_error_sigma_points<=mn.legacy_local_error_sigma_points)
 throw Error('Minnesota legacy-vs-joint probability gate changed');
for(const s of Object.values(scenarios)){
 assert.equal(s.race_probability_method,'SAME_CORRELATED_DRAWS_AS_CHAMBER_CONTROL');
 assert.equal(s.race_probabilities.length,basis.house.length+basis.senate.length+basis.governors.length);
 assert(s.race_probabilities.every(x=>x.simulated_dem_wins<=s.samples&&
  Math.abs(x.dem_beats_rep_pct+x.rep_beats_dem_pct-100)<=.02));
}
const max=comparisons.slice().sort((a,b)=>Math.abs(b.joint_vs_legacy_percentage_points)-
 Math.abs(a.joint_vs_legacy_percentage_points)).slice(0,12);
const report={
 status:'SOURCE_OF_RACE_ODDS_AUDIT_LEGACY_NOT_USER_FACING',
 polling_source_generated_at:src.polls.generated_at,
 source_of_displayed_race_odds:'ChamberControlModel.simulate correlated draws',
 total_joint_draws:scenarios.base.samples,
 modeled_race_count:scenarios.base.race_probabilities.length,
 compared_polled_races:comparisons.length,
 minnesota_senate:mn,
 largest_legacy_vs_joint_probability_gaps:max,
 uncertainty_scenarios:{tighter:.8,baseline:1,wider:1.3},
 limitations:[
  'Legacy source is a local-poll normal-CDF research calculation only, NEVER headline odds.',
  'Joint races and chambers derive from the same correlated Monte Carlo draws.',
  'Wider/narrower are assumptions-based sensitivity cases, not empirical probability confidence intervals.',
  'Alaska/Maine ranked choice, major independent candidates and runoff ballot processes remain incomplete.',
  'Recent real polling and joint national-state-chamber variances require separate outcome calibration.'
 ]
};
if(process.argv.includes('--json'))console.log(JSON.stringify(report,null,2));
else{
 console.log('Single-source race odds (legacy poll-only compared for audit ONLY)');
 console.table([report.minnesota_senate]);
 console.log('Largest gaps:');console.table(max.slice(0,8));
}
