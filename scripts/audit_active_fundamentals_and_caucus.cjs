#!/usr/bin/env node
'use strict';
/* Source-limited confidential-data audit: never print subscriber-row
 * margins, names, forecasts or values. Historical fit is NOT established. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,'data',name+'.json'),'utf8'));
const model=require('./chamber_control_model.js');
const privateCsv=require('./private_senate_fundamentals.js');
const source={
 seats:read('seat_universe'),history:read('house_history_2024_staging'),
 geography:read('house_geography_bridge'),senateHistory:read('senate_history_2020_2022_2024'),
 odds:read('race_probabilities'),polls:read('polling_estimates'),
 presidential:read('presidential_2024_by_2026_district_staging')
};
const basis=model.prepare(source,{senatePriorMode:'current_2026'});
const loadCsv=(file,expected)=>{
 const raw=fs.readFileSync(path.join(root,file),'utf8'),parsed=privateCsv.parse(raw);
 assert.equal(parsed.kind,expected,'Subscriber CSV must be matched by actual header family');
 return parsed;
};
const senate=loadCsv('ZqBdM (1).csv','senateFundamentals');
const house=loadCsv('f3ome (1).csv','houseFundamentals');
assert.equal(Object.keys(senate.states).length,28,'Expected 28 Senate fundamentals rows');
assert.equal(Object.keys(house.states).length,98,'Expected 98 House fundamentals rows');
let privateData=privateCsv.accept(null,senate);
privateData=privateCsv.accept(privateData,house);
const housePollMargins=Object.fromEntries(source.odds.records
 .filter(x=>x.office==='house'&&Number.isFinite(x.dem_minus_rep))
 .map(x=>[x.race_code,x.dem_minus_rep]));
const augmented=privateCsv.apply(basis,privateData,{
 includeHouse:true,housePollMargins,repositoryPublished:true
});
assert(augmented.private_imported_context.matched_senate_races>=20,
 'Loaded Senate context must map to real 2026 Senate race codes');
assert(augmented.private_imported_context.matched_house_races>=75,
 'Loaded House context must map to real 2026 district codes');
assert.deepEqual(augmented.assumptions,basis.assumptions,
 'Silver fundamentals must not secretly change covariance or holdovers');
const byCode=(rows)=>new Map(rows.map(x=>[x.code,x]));
for(const [office,arr,keys] of [
 ['senate',augmented.senate,privateData.senateFundamentals],
 ['house',augmented.house,privateData.houseFundamentals]]){
 const old=byCode(basis[office]);
 for(const row of arr){
  const previous=old.get(row.code);
  assert(previous,'No subscriber row may create a phantom seat');
  assert.equal(row.sigma,previous.sigma,'Subscriber input must not narrow error');
  const imported=Object.hasOwn(keys,office==='senate'?row.state:row.code);
  if(!imported)assert.equal(row.mean,previous.mean,'Unmatched race mean changed');
  if(imported&&row.private_context_anchor_points!==undefined)
   assert(Number.isFinite(row.private_context_anchor_points));
 }
}
assert.equal(augmented.senate.length,35);
assert.equal(augmented.house.length,435);
const samples=3000,seed=20261103;
const run=(base,extra={})=>model.simulate(base,{seed,samples,...extra});
const standard=run(basis),sourced=run(augmented);
const noCredit=run(basis,{independentSenateCredit:'no_credit'});
for(const x of [standard,sourced,noCredit]){
 assert.equal(Object.values(x.counts).reduce((n,v)=>n+v,0),samples);
 assert(Math.abs(x.total_pct-100)<.06);
 assert.equal(x.actual_dem_both_control_pct,x.blue_both_including_tsunami);
 assert(Math.abs(x.probabilities.blue_wave+x.probabilities.blue_tsunami-
  x.actual_dem_both_control_pct)<.03);
}
assert.equal(standard.house_dem_control_pct,noCredit.house_dem_control_pct,
 'Senate caucus assumptions cannot affect the House');
assert(noCredit.senate_dem_control_pct<=standard.senate_dem_control_pct,
 'Independent no-credit case cannot increase modeled D Senate control');
assert(noCredit.actual_dem_both_control_pct<=standard.actual_dem_both_control_pct,
 'No-credit independent case cannot increase D control of both chambers');
assert.equal(basis.senate.filter(x=>x.nonrep_independent_proxy).length,2,
 'Two independent proxy Senate contests require explicit caucus audit');
const result={
 status:'COVERAGE_AND_SENSITIVITY_VERIFIED_NOT_PROSPECTIVE_CALIBRATION',
 source_snapshot:source.polls.generated_at,
 senate_rows_present:Object.keys(senate.states).length,
 house_rows_present:Object.keys(house.states).length,
 senate_rows_matched:augmented.private_imported_context.matched_senate_races,
 house_rows_matched:augmented.private_imported_context.matched_house_races,
 errors_unchanged:true,full_senate_contests:35,full_house_districts:435,
 independent_senate_proxy_contests:2,
 tested_dem_proxy_and_no_credit:true,
 no_credit_not_more_dem_favorable:true,
 silver_finished_forecast_odds_used:false,
 calibration_proven:false,
 proprietary_rows_exported:false,
 note:'CI reads existing repository assets, outputs only non-proprietary counts and validations. Public paid CSV assets require publisher-rights review. No mean, margin, expert row or simulated subscriber-augmented outcome is emitted.'
};
if(process.argv.includes('--json'))process.stdout.write(JSON.stringify(result,null,2)+'\n');
else console.log('Source-coverage and independent Senate caucus audit PASS; subscriber rows and forecasts NOT printed.');
