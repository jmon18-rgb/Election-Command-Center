#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const b=require('./bottom_up_national_environment.js');
const data=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'..','data',name+'.json'),'utf8'));
const result=b.evaluate(data('polling_estimates'),data('presidential_2024_by_2026_district_staging'));
if(result.status!=='SELECTION_BIASED_OBSERVATIONAL_DIAGNOSTIC_NOT_HEADLINE'||
 result.states_with_qualified_races<8||result.total_qualifying_races<12)
 throw Error('Insufficient comparable 2026 poll universe');
if(process.argv.includes('--check')){
 const saved=data('bottom_up_2026_environment_shadow');
 if(JSON.stringify(saved)!==JSON.stringify(result))
  throw Error('Staged bottom-up environment diagnostic is outdated');
}
if(process.argv.includes('--json'))console.log(JSON.stringify(result,null,2));
else{
 console.log('2026 bottom-up national environment (RESEARCH ONLY)');
 console.table([{
  generic_ballot_D_points:result.generic_ballot_2026_d_minus_r_points,
  race_polls_implied_D_points:result.bottom_up_implied_national_margin_points,
  gap_points:result.bottom_up_minus_generic_environment_points,
  qualifying_races:result.total_qualifying_races,
  represented_states:result.states_with_qualified_races
 }]);
 console.log('NOT a representative sample or calibrated national correction.');
}
