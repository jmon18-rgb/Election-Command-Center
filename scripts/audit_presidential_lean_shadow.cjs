#!/usr/bin/env node
'use strict';
// Election-result geographic anchors, not proprietary prediction algorithms.
// Both draws share a seed; do NOT promote without held-out historical tests.
const fs=require('node:fs'),path=require('node:path');
const model=require('./chamber_control_model.js');
const read=n=>JSON.parse(fs.readFileSync(path.join(__dirname,'..','data',n+'.json'),'utf8'));
const sources={
 seats:read('seat_universe'),history:read('house_history_2024_staging'),
 geography:read('house_geography_bridge'),
 senateHistory:read('senate_history_2020_2022_2024'),
 odds:read('race_probabilities'),polls:read('polling_estimates'),
 presidential:read('presidential_2024_by_2026_district_staging')
};
const basis=model.prepare(sources);
const alternate=model.prepare(sources,{fundamentalsMode:'presidential_2024_shadow'});
const samples=6000,seed=20261103;
const b=model.simulate(basis,{samples,seed});
const p=model.simulate(alternate,{samples,seed});
const diff=(a,b)=>+(a-b).toFixed(2);
const prev=new Map(basis.house.map(x=>[x.code,x]));
const rows=alternate.house.map(x=>{
 const old=prev.get(x.code);
 return {race_code:x.code,redrawn:x.method.includes('redrawn_'),
  historic_presidential_D_minus_R_points:+x.presidential_2024_margin_points.toFixed(2),
  old_house_proxy_D_minus_R_points:+old.mean.toFixed(2),
  presidential_shadow_D_minus_R_points:+x.mean.toFixed(2),
  revised_minus_baseline_margin_points:diff(x.mean,old.mean),
  polled:x.polled};
});
const largest=rows.slice().sort((a,b)=>Math.abs(b.revised_minus_baseline_margin_points)-
 Math.abs(a.revised_minus_baseline_margin_points)).slice(0,15);
const redrawn=rows.filter(x=>x.redrawn);
const result={
 status:'EXPERIMENTAL_PRESIDENTIAL_PARTISAN_LEAN_SHADOW_NOT_PROMOTED',
 methodology:'2024_presidential_district_votes_under_2026_geometry',
 source_presidential:sources.presidential.external_source_url,
 source_presidential_blob_sha:sources.presidential.external_source_blob_sha,
 crosscheck_source:sources.presidential.external_crosscheck_reference,
 source_polling_at:sources.polls.generated_at,
 house_districts_mapped:alternate.presidential_fundamentals_shadow.mapped_2026_house_districts,
 presidential_national_two_party_margin_points:
  +alternate.presidential_fundamentals_shadow.national_presidential_2024_two_party_margin_points.toFixed(3),
 two_party_presidential_drift_to_generic_ballot_assumption_points:
  +alternate.presidential_fundamentals_shadow.house_generic_swing_points.toFixed(3),
 votes_not_predictions:true,
 redrawn_2026_districts_mapped:redrawn.length,
 samples,seed,
 original:{
  dem_both_chambers_pct:b.blue_both_including_tsunami,
  rep_both_chambers_pct:b.probabilities.red_dawn,
  house_dem_mean_seats:b.means.house_dem_seats,
  senate_dem_mean_seats:b.means.senate_dem_seats
 },
 presidential_shadow:{
  dem_both_chambers_pct:p.blue_both_including_tsunami,
  rep_both_chambers_pct:p.probabilities.red_dawn,
  house_dem_mean_seats:p.means.house_dem_seats,
  senate_dem_mean_seats:p.means.senate_dem_seats
 },
 differences:{
  dem_both_chambers_percentage_points:diff(p.blue_both_including_tsunami,b.blue_both_including_tsunami),
  rep_both_chambers_percentage_points:diff(p.probabilities.red_dawn,b.probabilities.red_dawn),
  house_dem_mean_seats:diff(p.means.house_dem_seats,b.means.house_dem_seats)
 },
 geography:{
  original_redrawn_distribution_seats:basis.house.filter(x=>x.redrawn_mix_weight>0).length,
  alternative_redrawn_exchangeable_seats:alternate.house.filter(x=>x.redrawn_mix_weight>0).length
 },
 biggest_house_margin_changes:largest,
 warnings:[
  'The presidential district data are staged from an external model input repository, not independent official 2026-map overlays verified precinct-by-precinct.',
  'The blended prior weights and national environment adjustment are ASSUMPTIONS, not fitted election-outcome parameters.',
  '2024 presidential-to-2026 generic ballot shift assumes a relationship between DIFFERENT ballot questions that has not been backtested.',
  'A lack of 2026 candidate experience, incumbent strength, fundraising and election-law ballot treatment can materially bias House/Senate probabilities.',
  'The alternative is a diagnostic shadow; it never overrides baseline odds.'
 ]
};
if(result.house_districts_mapped!==435||result.redrawn_2026_districts_mapped!==173||
 result.geography.alternative_redrawn_exchangeable_seats!==0||
 p.means.senate_dem_seats!==b.means.senate_dem_seats)
 throw Error('Wrong geography, stale Senate assumptions, or incomplete source');
if(process.argv.includes('--json'))console.log(JSON.stringify(result,null,2));
else{
 console.log('Geography-safe presidential House fundamentals SHADOW — NOT PROMOTED');
 console.table([
  {model:'current',...result.original},
  {model:'presidential district shadow',...result.presidential_shadow}
 ]);
 console.log('Difference from original:',result.differences);
 console.log('Replaced exchangeable redrawn districts:',result.redrawn_2026_districts_mapped);
 console.table(result.biggest_house_margin_changes.slice(0,8));
}
