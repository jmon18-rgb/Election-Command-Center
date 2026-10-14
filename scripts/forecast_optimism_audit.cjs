#!/usr/bin/env node
'use strict';
// Deterministic forecast optimism audit. Sensitivities are NOT calibrated odds.
const fs=require('node:fs'),path=require('node:path');
const model=require('./chamber_control_model.js');
const ROOT=path.resolve(__dirname,'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(ROOT,'data',name+'.json'),'utf8'));
const sources={seats:read('seat_universe'),history:read('house_history_2024_staging'),
 geography:read('house_geography_bridge'),senateHistory:read('senate_history_2020_2022_2024'),
 odds:read('race_probabilities'),polls:read('polling_estimates')};
const basis=model.prepare(sources);
const seed=20261103,samples=6000;
const cases=[
 {id:'baseline',shift:0,error:1},
 {id:'republican_national_miss_2pt',shift:-2,error:1},
 {id:'republican_national_miss_4pt',shift:-4,error:1},
 {id:'democratic_national_miss_2pt',shift:2,error:1},
 {id:'more_uncertain_25pct',shift:0,error:1.25},
 {id:'republican_miss_2pt_more_uncertain',shift:-2,error:1.25},
 {id:'less_uncertain_20pct',shift:0,error:.8}
];
const outputs=cases.map(c=>{
 const x=model.simulate(basis,{samples,seed,nationalShift:c.shift,errorMultiplier:c.error});
 const both=x.blue_both_including_tsunami;
 const houseOnlyOrSenateOnly=x.probabilities.shrug;
 const p=x.probabilities;
 if(Math.abs(p.blue_wave+p.blue_tsunami+p.shrug+p.red_dawn-100)>.05)
  throw Error('Forecast buckets not exhaustive: '+c.id);
 return {case:c.id,national_margin_shift_points:c.shift,
  error_scale_multiplier:c.error,dem_both_chambers_pct:both,
  dem_exactly_one_chamber_pct:houseOnlyOrSenateOnly,
  republican_both_chambers_pct:p.red_dawn,
  dem_near_sweep_and_both_pct:p.blue_tsunami,
  dem_average_house_seats:x.means.house_dem_seats,
  dem_average_senate_seats:x.means.senate_dem_seats};
});
const baseline=outputs[0];
const report={schema_version:'forecast-optimism-audit-v1',
 status:'UNCALIBRATED_SENSITIVITY_NOT_ELECTION_PREDICTIONS',
 source_polling_generated_at:sources.polls.generated_at,
 model_version:model.VERSION,
 samples_per_case:samples,seed,
 current_generic_ballot_margin:basis.generated_from_sources.generic_ballot_margin,
 projected_house_swing_points:basis.generated_from_sources.implied_house_swing_points,
 poll_coverage:{house:basis.generated_from_sources.house_poll_count,
 senate:basis.generated_from_sources.senate_poll_count},
 total_modeled_house_seats:435,total_contested_senate_seats:35,
 scenarios:outputs,
 changes_from_baseline:outputs.slice(1).map(x=>({case:x.case,
  change_dem_both_percentage_points:+(x.dem_both_chambers_pct-baseline.dem_both_chambers_pct).toFixed(2),
  change_republican_both_percentage_points:+(x.republican_both_chambers_pct-baseline.republican_both_chambers_pct).toFixed(2)})),
 red_flags:[
  'House baseline extrapolates recorded 2024 House votes using the generic ballot; generic ballot and historical observed votes are not directly equivalent.',
  'Unpolled or redrawn districts depend heavily on inferred fundamentals and exchangeable statewide priors.',
  'Senate poll blending and national error variances are assumption-driven rather than fitted by 2026 holdout election outcomes.',
  'The near-sweep slate is an arbitrary 20-race threshold, not a historically calibrated Blue Tsunami event.',
  'A 2-4 point shared election-day miss must be shown alongside any headline control odds; a single central estimate hides fragility.',
  'Silver FLIPR forecasts cannot be replicated by copying a topline probability; compare margins, fundamentals and correlations independently.'
 ],
 recommendation:'Keep beta odds explicitly experimental. Do not publish as calibrated probabilities until held-out historical election-result backtests cover national, region, state and race errors.',
 external_reference:{name:'Silver Bulletin FLIPR methodology',url:'https://www.natesilver.net/p/flipr-midterms-model-methodology',benchmark_numbers_injected:false}
};
if(process.argv.includes('--json'))process.stdout.write(JSON.stringify(report,null,2)+'\n');
else{
 console.log('UNCALIBRATED JOINT MODEL — scenario sensitivity (not predictions)');
 console.table(outputs.map(({case:scenario,dem_both_chambers_pct,dem_exactly_one_chamber_pct,republican_both_chambers_pct})=>
  ({scenario,dem_both_chambers_pct,dem_exactly_one_chamber_pct,republican_both_chambers_pct})));
 console.log('Coverage: '+report.poll_coverage.house+'/435 House; '+report.poll_coverage.senate+'/35 Senate.');
 console.log('WARNING: these scenario odds are not calibrated to election outcomes.');
}
