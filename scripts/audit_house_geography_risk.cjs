#!/usr/bin/env node
'use strict';
/* 2026 House geographic input audit. No invented precinct reaggregation
 * and no promotion of third-party claimed overlays to certified baselines. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const load=n=>JSON.parse(fs.readFileSync(path.join(root,'data',n+'.json'),'utf8'));
const engine=require('./chamber_control_model.js');
const source={seats:load('seat_universe'),history:load('house_history_2024_staging'),
 geography:load('house_geography_bridge'),senateHistory:load('senate_history_2020_2022_2024'),
 odds:load('race_probabilities'),polls:load('polling_estimates'),
 presidential:load('presidential_2024_by_2026_district_staging')};
const geo=source.geography;
assert.equal(geo.summary.voting_house_districts,435);
assert.equal(geo.summary.states_redrawn,9);
assert.equal(geo.summary.redrawn_districts,173);
assert.equal(geo.summary.same_boundary_districts,262);
assert.equal(geo.summary.comparable_2024_recorded_two_party_districts,245);
const byCode=new Map(geo.districts.map(x=>[x.race_code_2026,x]));
assert.equal(byCode.size,435,'No duplicate district geometry identities');
const changed=new Set(geo.changed_states);
assert.equal(changed.size,9);
const failed=[];
for(const [code,g] of byCode){
 const mapChanged=changed.has(g.state);
 if(mapChanged!==!g.geography_comparable_2024)
  failed.push('wrong comparability flag '+code);
 if(mapChanged&&[g.recorded_dem_votes_2024,g.recorded_rep_votes_2024,
   g.historical_2024_dem_share_two_party].some(x=>x!==null))
  failed.push('obsolete district-specific vote data leaked '+code);
 if(mapChanged&&g.historical_comparison_available!==false)
  failed.push('obsolete 2024 district falsely validated '+code);
 if(g.predicted_2026_margin!==null||g.win_probability!==null||
   g.year_2026_forecast_prior!==null)
  failed.push('research map bridge secretly contains forecasts '+code);
}
assert.deepEqual(failed,[]);
const basis=engine.prepare(source,{senatePriorMode:'current_2026'});
const modeled=new Map(basis.house.map(x=>[x.code,x]));
assert.equal(modeled.size,435);
let oldHouseDistrictLeak=0,redrawnPolling=0,exchangeable=0,
 unchangedWithIncompleteHistoric=0;
for(const [code,g] of byCode){
 const row=modeled.get(code);assert(row,'Missing modeled 2026 seat '+code);
 if(!g.geography_comparable_2024){
  if(row.historical_2024_house_vote_used===true||/unchanged_2024_recorded/.test(row.method))
   oldHouseDistrictLeak++;
  assert.equal(row.historical_geography_prior_source,'redrawn_state_distribution_proxy',
   'Changed district must use state exchangeable risk, not a specific old seat '+code);
  assert(row.redrawn_mix_weight>0,'Changed geometry must carry uncertainty '+code);
  if(row.polled)redrawnPolling++;else exchangeable++;
 }else if(!g.has_complete_recorded_major_party_votes_2024){
  unchangedWithIncompleteHistoric++;
  assert(row.historical_2024_house_vote_used===false,
   'Uncontested old result must not be called two-party district evidence');
 }
}
assert.equal(oldHouseDistrictLeak,0);
assert.equal(redrawnPolling+exchangeable,173);
assert.equal(unchangedWithIncompleteHistoric,17);
const claimed=source.presidential;
assert.equal(claimed.records.length,435);
assert.equal(claimed.status,'historical_presidential_votes_from_external_model_source_not_forecast');
assert.notEqual(claimed.external_source_url,null);
const report={status:'GEOGRAPHY_GUARD_VERIFIED_PRECINCT_REAGGREGATION_STILL_MISSING',
  house_seats:435,redrawn_states:changed.size,redrawn_seats:173,
  redrawn_polled_seats:redrawnPolling,redrawn_exchangeable_without_poll:exchangeable,
  unchanged_seats:262,unchanged_with_complete_two_party_evidence:245,
  unchanged_with_incomplete_major_party_history:17,redrawn_old_district_leaks:0,
  third_party_presidential_overlay_verified_as_official_precinct_reaggregation:false,
  can_claim_precise_2026_redrawn_district_fundamentals:false};
if(process.argv.includes('--json'))process.stdout.write(JSON.stringify(report,null,2)+'\n');
else console.log('2026 map audit PASS: 173 redrawn seats remain non-specific historical proxies');
