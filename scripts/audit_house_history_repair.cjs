'use strict';
const fs=require('node:fs'),zlib=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const model=require('./chamber_control_model.js');
const read=n=>JSON.parse(fs.readFileSync('data/'+n+'.json','utf8'));
const manifest=read('house_historical_sources/source');
function old(name){
 const raw=zlib.gunzipSync(fs.readFileSync('data/house_historical_sources/pre_repair_'+name+'.json.gz'));
 assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),manifest.before_repair_reference.sha256[name]);
 return JSON.parse(raw);
}
const history=read('house_history_2024_staging'),previous=old('house_history_2024_staging');
const before=new Map(previous.records.map(r=>[r['2024_race_code'],r]));
const changed=history.records.filter(r=>['recorded_dem_votes','recorded_rep_votes','recorded_other_votes'].some(k=>r[k]!==before.get(r['2024_race_code'])[k]));
const totals=records=>records.reduce((a,r)=>{a.dem+=r.recorded_dem_votes;a.rep+=r.recorded_rep_votes;a.other+=r.recorded_other_votes;return a;},{dem:0,rep:0,other:0});
const sourceFacts={status:'SOURCE_CLASSIFICATION_CORRECTION_NOT_NEW_VOTES_OR_CALIBRATION',source_sha256:manifest.sha256,
 historical_year:2024,districts:435,changed_districts:changed.map(r=>r['2024_race_code']),
 before:totals(previous.records),after:totals(history.records),
 before_missing_major_party:previous.districts_missing_major_party_votes,after_missing_major_party:history.districts_missing_major_party_votes,
 fusion_rows:history.fusion_vote_rows_attributed,fusion_votes:history.fusion_votes_attributed};
assert.equal(Object.values(sourceFacts.before).reduce((a,b)=>a+b),Object.values(sourceFacts.after).reduce((a,b)=>a+b),'No source votes added/dropped');
for(const row of history.records){const prior=before.get(row['2024_race_code']);assert.equal(row.recorded_dem_votes+row.recorded_rep_votes+row.recorded_other_votes,prior.recorded_dem_votes+prior.recorded_rep_votes+prior.recorded_other_votes);}
if(process.argv.includes('--write'))fs.writeFileSync('data/house_history_repair_source_audit.json',JSON.stringify(sourceFacts,null,2)+'\n');
if(process.argv.includes('--check'))assert.deepEqual(read('house_history_repair_source_audit'),sourceFacts);
const common={seats:read('seat_universe'),odds:read('race_probabilities'),polls:read('polling_estimates'),senateHistory:read('senate_history_2020_2022_2024'),presidential:read('presidential_2024_by_2026_district_staging')};
const options={senatePriorMode:'current_2026'},a=model.prepare({...common,history:previous,geography:old('house_geography_bridge')},options),
 b=model.prepare({...common,history,geography:read('house_geography_bridge')},options);
assert.deepEqual(a.senate,b.senate,'House-only correction cannot change Senate assumptions');
assert.deepEqual(a.governors,b.governors,'House-only correction cannot change governor assumptions');
const simulation={samples:3000,seed:20261103},beforeModel=model.simulate(a,simulation),afterModel=model.simulate(b,simulation);
assert.equal(beforeModel.senate_dem_control_pct,afterModel.senate_dem_control_pct,'Same-poll same-seed Senate control invariant');
const oldHouse=new Map(a.house.map(r=>[r.code,r]));
const report={status:'HOUSE_HISTORY_SAME_POLL_SAME_SEED_DIAGNOSTIC_NOT_CALIBRATION',source_facts:sourceFacts,
 polling_source:common.polls.generated_at,senate_assumptions_unchanged:true,governor_assumptions_unchanged:true,
 before:{house_control_pct:beforeModel.house_dem_control_pct,senate_control_pct:beforeModel.senate_dem_control_pct,four_endings:beforeModel.probabilities},
 after:{house_control_pct:afterModel.house_dem_control_pct,senate_control_pct:afterModel.senate_dem_control_pct,four_endings:afterModel.probabilities},
 examples:b.house.filter(r=>['MN-03','MN-04','MN-06','ND-01','NY-17','VT-01'].includes(r.code)).map(r=>({code:r.code,before_margin:oldHouse.get(r.code).mean,after_margin:r.mean})),
 limits:'Public current-2026 baseline only; same source polls and seed isolate classification effects. No coefficients fitted, no historical holdout/calibration or live delivery claim.'};
console.log(JSON.stringify(report,null,2));
