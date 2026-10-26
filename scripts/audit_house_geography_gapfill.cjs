#!/usr/bin/env node
'use strict';
/*
 * Modern geography signal replaces ONLY unusable House 2024 vote priors.
 * Preserves district-level recorded 2024 House results whenever boundaries
 * are unchanged and both major parties have recorded votes.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const model=require('./chamber_control_model.js');
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'..','data',name+'.json'),'utf8'));
const src={seats:read('seat_universe'),history:read('house_history_2024_staging'),
 geography:read('house_geography_bridge'),senateHistory:read('senate_history_2020_2022_2024'),
 odds:read('race_probabilities'),polls:read('polling_estimates'),
 presidential:read('presidential_2024_by_2026_district_staging')};
const base=model.prepare(src),full=model.prepare(src,{fundamentalsMode:'presidential_2024_shadow'}),
 gap=model.prepare(src,{fundamentalsMode:'presidential_2024_gap_fill'});
assert.equal(base.house.length,435);
assert.deepEqual(gap.senate,base.senate);
assert.deepEqual(gap.governors,base.governors);
assert.deepEqual(gap.senate,full.senate);
assert.deepEqual(gap.governors,full.governors);
const byRaw=new Map(src.history.records.map(x=>[x['2024_race_code'],x]));
const byGeo=new Map(src.geography.districts.map(x=>[x.race_code_2026,x]));
const counts={unchanged_complete:0,unchanged_unusable:0,redrawn:0};
const sample=[];
for(let i=0;i<435;i++){
 const b=base.house[i],f=full.house[i],g=gap.house[i],
  geo=byGeo.get(g.code),h=byRaw.get(g.code);
 assert(geo&&h&&b.code===g.code&&b.code===f.code,'Misaligned 2026 district identity');
 const reliable=geo.geography_comparable_2024===true&&
  h.recorded_dem_votes>0&&h.recorded_rep_votes>0;
 const category=geo.geography_comparable_2024===false?'redrawn':
  reliable?'unchanged_complete':'unchanged_unusable';
 counts[category]++;
 const expected=reliable?b:f;
 for(const key of ['mean','sigma','method','polled','poll_weight',
  'redrawn_mix_weight','redrawn_state_center','poll_fundamentals_gap_points',
  'disagreement_extra_sigma_points']){
  assert.deepEqual(g[key],expected[key],category+' signal mismatch for '+g.code+' '+key);
 }
 if(!reliable){
  assert(Number.isFinite(g.presidential_2024_margin_points));
  assert.equal(g.redrawn_mix_weight,0);
  assert.equal(g.historical_2024_house_vote_used,false);
 }else assert.equal(g.historical_2024_house_vote_used,true);
 if(['MN-03','LA-02','CA-20','OH-11','TX-37','ME-02','NY-17'].includes(g.code))
  sample.push({race_code:g.code,status:category,
   former_margin_points:b.mean,geo_gap_fill_margin_points:g.mean,
   full_presidential_shadow_margin_points:f.mean});
}
assert.deepEqual(counts,{unchanged_complete:245,unchanged_unusable:17,redrawn:173});
assert.equal(gap.fundamentals_mode,'presidential_2024_gap_fill');
const samples=6000,seed=20261103;
const options={samples,seed,explainControl:true};
const old=model.simulate(base,options),alt=model.simulate(gap,options),
 fullRes=model.simulate(full,options);
assert.equal(alt.race_probabilities.filter(x=>x.office==='house').length,435);
assert.equal(alt.race_probabilities.filter(x=>x.office==='senate').length,35);
const result={
 status:'RESEARCH_GEOGRAPHY_GAP_FILL_PENDING_HELD_OUT_VALIDATION',
 source_date:src.polls.generated_at,
 source_presidential_sha:src.presidential.external_source_blob_sha,
 house_by_provenance:counts,
 candidate_blind_presidential_prior_used_in:counts.unchanged_unusable+counts.redrawn,
 candidate_2024_vote_exact_reused_in:counts.unchanged_complete,
 seed,samples,
 models:[
  {name:'existing_headline',dem_house_seats:old.means.house_dem_seats,
   dem_house_control_pct:old.house_dem_control_pct,
   dem_senate_control_pct:old.senate_dem_control_pct,
   dem_both_pct:old.blue_both_including_tsunami},
  {name:'geography_gap_fill_shadow',dem_house_seats:alt.means.house_dem_seats,
   dem_house_control_pct:alt.house_dem_control_pct,
   dem_senate_control_pct:alt.senate_dem_control_pct,
   dem_both_pct:alt.blue_both_including_tsunami},
  {name:'full_presidential_shadow',dem_house_seats:fullRes.means.house_dem_seats,
   dem_house_control_pct:fullRes.house_dem_control_pct,
   dem_senate_control_pct:fullRes.senate_dem_control_pct,
   dem_both_pct:fullRes.blue_both_including_tsunami}
 ],
 selected_races:sample,
 errors_to_fix_before_promotion:[
  '2024 MIT House party importer misclassified Democratic-Farmer-Labor and some fusion vote lines. Correct underlying source then rebuild bridge, two-cycle and candidate features atomically.',
  '2024 presidential candidate-neutral geography is verified for 2026 maps, not a complete 2026 House candidate-strength prior.',
  'Presidential-to-generic and House-to-generic national swing coefficients remain uncalibrated.',
  'The independent Silver forecast comparison is diagnostic only and subscriber data are not stored here.',
  'Do not infer more accurate election probabilities from greater agreement with any other publisher.'
 ]
};
assert(Math.abs(result.models[1].dem_senate_control_pct-result.models[0].dem_senate_control_pct)<3);
if(process.argv.includes('--json'))console.log(JSON.stringify(result,null,2));
else{
 console.log('HOUSE 2026-MAP GEOGRAPHY GAP-FILL — RESEARCH ONLY');
 console.log('2024 exact district House votes retained:',counts.unchanged_complete,
 'mapped presidential proxy districts:',counts.unchanged_unusable+counts.redrawn);
 console.table(result.models);
 console.table(sample.map(x=>({race:x.race_code,kind:x.status,
  current:x.former_margin_points,gap:x.geo_gap_fill_margin_points})));
 console.log('No public forecast coefficients changed.');
}
