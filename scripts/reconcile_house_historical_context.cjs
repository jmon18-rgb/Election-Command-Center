'use strict';
// Candidate names/votes remain independently sourced. Recompute only agreement
// flags, then rebuild descriptive residuals and their explicitly derived fields.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const hist=require('./historical_candidate_strength.js');
const root=path.resolve(__dirname,'..'),read=n=>JSON.parse(fs.readFileSync(path.join(root,'data',n+'.json'),'utf8'));
const write=(n,d)=>fs.writeFileSync(path.join(root,'data',n+'.json'),JSON.stringify(d,null,2)+'\n');
function reconcile(names,history,geography){
 const by=new Map(history.records.map(r=>[r['2024_race_code'],r]));
 const geo=new Map(geography.districts.map(r=>[r.race_code_2026,r]));
 if(names.records.length!==435||by.size!==435||geo.size!==435)throw Error('Incomplete historical candidate joins');
 const records=names.records.map(row=>{
  const h=by.get(row.race_code),g=geo.get(row.race_code);if(!h||!g)throw Error('Missing candidate source join');
  return {...row,source_votes_match_mit_staging:row.dem_votes===h.recorded_dem_votes&&row.rep_votes===h.recorded_rep_votes,
   geography_comparable_2024_to_2026:g.geography_comparable_2024===true};
 });
 const matches=records.filter(r=>r.source_votes_match_mit_staging).length;
 return {...names,coverage:{...names.coverage,vote_exact_matches:matches,vote_disagreements:435-matches,
  unchanged_geometry:records.filter(r=>r.geography_comparable_2024_to_2026).length},records};
}
function run(check){
 const names22=read('house_2022_candidate_results_staging'),h22=read('house_history_2022_staging');
 const by22=new Map(h22.records.map(r=>[r['2022_race_code'],r]));
 const records22=names22.records.map(r=>{const h=by22.get(r.race_code);if(!h)throw Error('Missing 2022 candidate source join');
  return {...r,source_votes_match_mit_staging:r.dem_votes===h.recorded_dem_votes&&r.rep_votes===h.recorded_rep_votes};});
 const matches22=records22.filter(r=>r.source_votes_match_mit_staging).length;
 const corrected22={...names22,coverage:{...names22.coverage,vote_exact_matches:matches22,vote_disagreements:435-matches22},records:records22};
 const names=read('house_2024_candidate_results_staging'),history=read('house_history_2024_staging'),geography=read('house_geography_bridge');
 const corrected=reconcile(names,history,geography),ctx=read('candidate_fundamentals_staging'),previous=read('historical_candidate_overperformance_2026');
 const doc=hist.build({candidateContext:ctx,house2024:history,houseNames:corrected,geography,
  presidential2024:read('presidential_2024_by_2026_district_staging'),senateHistory:read('senate_history_2020_2022_2024'),
  presidential2020:read('presidential_2020_state_staging')});
 if(check){assert.deepEqual(corrected22,names22,'2022 candidate-source agreement flags stale');assert.deepEqual(corrected,names,'Candidate-source agreement flags stale');assert.deepEqual(doc,previous,'Historical residual source lineage stale');
  assert.deepEqual(hist.enrichCandidateContext(ctx,doc),ctx,'Derived candidate context stale');}
 else{const updated=hist.refreshHouseCandidateContext(ctx,previous,doc);
  write('house_2022_candidate_results_staging',corrected22);
  write('house_2024_candidate_results_staging',corrected);write('historical_candidate_overperformance_2026',doc);write('candidate_fundamentals_staging',updated);}
 console.log(JSON.stringify({candidate_vote_matches:corrected.coverage.vote_exact_matches,candidate_vote_disagreements:corrected.coverage.vote_disagreements,
  house_eligible:doc.coverage.house_eligible,house_reference:doc.methodology.house_reference_districts,senate_eligible:doc.coverage.senate_eligible}));
}
if(require.main===module)run(process.argv.includes('--check'));
module.exports={reconcile};
