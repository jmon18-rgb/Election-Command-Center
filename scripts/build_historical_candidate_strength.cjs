#!/usr/bin/env node
'use strict';
/* Historical incumbent quality audit. Recompute and verify committed staging.
 * No current probabilities are calculated by this command. */
const fs=require('node:fs'),path=require('node:path');
const {build,enrichCandidateContext}=require('./historical_candidate_strength.js');
const ROOT=path.join(__dirname,'..');
const read=n=>JSON.parse(fs.readFileSync(path.join(ROOT,'data',n+'.json'),'utf8'));
const context=read('candidate_fundamentals_staging');
const input={
 candidateContext:context,
 house2024:read('house_history_2024_staging'),
 houseNames:read('house_2024_candidate_results_staging'),
 presidential2024:read('presidential_2024_by_2026_district_staging'),
 geography:read('house_geography_bridge'),
 senateHistory:read('senate_history_2020_2022_2024'),
 presidential2020:read('presidential_2020_state_staging')
};
const doc=build(input);
const enriched=enrichCandidateContext(context,doc);
if(process.argv.includes('--check')){
 const committed=read('historical_candidate_overperformance_2026');
 if(JSON.stringify(doc)!==JSON.stringify(committed))
  throw Error('Historical candidate residual staging is stale or changed');
 if(JSON.stringify(enriched)!==JSON.stringify(context))
  throw Error('Candidate context differs from calculated historical winner evidence');
 if(doc.coverage.house_eligible!==149||doc.coverage.senate_eligible!==12||
    doc.methodology.house_reference_districts!==213||
    doc.methodology.senate_reference_states!==31)
  throw Error('Unexpected 2024 House or 2020 Senate validation coverage');
}
const summary={
 status:'REPRODUCIBLE_HISTORIC_RELATIVE_CANDIDATE_MARGINS_NOT_FORECAST',
 eligible_house_incumbents:doc.coverage.house_eligible,
 eligible_senate_incumbents:doc.coverage.senate_eligible,
 governor_historical_eligibility:0,
 climate_house:doc.methodology.house_2024_vs_presidential_2024_climate_gap,
 climate_senate:doc.methodology.senate_2020_vs_presidential_2020_climate_gap,
 rejected:doc.coverage,
 facts_only:true,
 independent_election_year_validation:false,
 examples:doc.records.filter(r=>['ME-SEN','AZ-06','MN-02','GA-14'].includes(r.race_code))
  .map(r=>({code:r.race_code,status:r.status,signed_margin:r.candidate_signed_raw_excess_margin_points}))
};
if(process.argv.includes('--json'))console.log(JSON.stringify(summary,null,2));
else{
 console.log('Historical incumbent excess-margin audit (not a forecast):');
 console.log(summary);
 console.log('Sources matched, national divergence removed, geography checked, unresolved cases withheld.');
}
