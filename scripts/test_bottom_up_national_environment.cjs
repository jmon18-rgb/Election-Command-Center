#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const model=require('./bottom_up_national_environment.js');
const read=n=>JSON.parse(fs.readFileSync(path.join(__dirname,'..','data',n+'.json'),'utf8'));
const polls=read('polling_estimates'),pres=read('presidential_2024_by_2026_district_staging');
const base=model.evaluate(polls,pres),committed=read('bottom_up_2026_environment_shadow');
assert.deepEqual(base,committed);
assert(base.total_qualifying_races>=12);
assert(base.states_with_qualified_races>=8);
assert.equal(base.status,'SELECTION_BIASED_OBSERVATIONAL_DIAGNOSTIC_NOT_HEADLINE');
assert(Math.abs(base.generic_ballot_2026_d_minus_r_points-polls.generic_ballot.dem_minus_rep)<.001);
assert(Number.isFinite(base.bottom_up_implied_national_margin_points));
assert(Math.abs(base.bottom_up_minus_generic_environment_points-(base.bottom_up_implied_national_margin_points-base.generic_ballot_2026_d_minus_r_points))<.002);
assert(base.state_swing_samples.every(x=>x.number_qualifying_races>=1));
assert(base.qualifying_house_races+base.qualifying_senate_races===base.total_qualifying_races);
const shuffled=structuredClone(polls);
shuffled.house.reverse();shuffled.senate_all.reverse();
assert.deepEqual(model.evaluate(shuffled,pres),base,
 'Source poll ordering must not affect the estimated national environment');
const withStale=structuredClone(polls);
withStale.senate_all.find(x=>x.race_code==='MN-SEN')
 .poll_diagnostics.latest_poll_age_days=90;
const stale=model.evaluate(withStale,pres);
assert(!stale.examples.some(x=>x.race_code==='MN-SEN'),
 'Stale 2026 race polls cannot remain in bottom-up diagnostic');
assert(stale.excluded.stale>base.excluded.stale);
const duplicate=structuredClone(pres);
duplicate.records[1].race_code=duplicate.records[0].race_code;
assert.throws(()=>model.evaluate(polls,duplicate),/duplicate presidential/);
const unsupported=structuredClone(pres);
unsupported.district_map_year_claimed=2024;
assert.throws(()=>model.evaluate(polls,unsupported),/geography-correct/);
assert.equal(base.candidate_quality_calibration_available,false);
assert.equal(base.candidate_specific_effects_removed,false);
console.log('Bottom-up 2026 poll environment: '+base.total_qualifying_races+' qualifying races, '+base.states_with_qualified_races+' states; current-generation provenance, robustness and fails-closed tests PASS.');
