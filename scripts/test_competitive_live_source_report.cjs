
'use strict';
const assert=require('node:assert/strict'),{races,inWindow,assess,summarize,nationalProof}=require('./competitive_live_source_report.cjs');
const now=Date.parse('2026-11-04T03:10:00Z');
// Synthetic classifier records, never actual source evidence or archived votes.
const row=code=>({code,source_url:races.find(r=>r.code===code).url,http:200,source_test_data:false,source_identity_validated:true,live_votes_accepted:true,parsed_counties:races.find(r=>r.code===code).counties,source_stamp:'2026-11-04T03:00:00Z',counted_dem_votes:10000,counted_rep_votes:11000,preview:false,national_unchanged:false,national_contract_validated:true,national_evidence_validated:true,
 projection:{dem_win_probability:.45,counted_dem_votes:10000,counted_rep_votes:11000,interval_calibrated:false,may_move_national_needle:races.find(r=>r.code===code).forecast_scope==='national_joint_draws',modeled_remaining_two_party_votes:30000,modeled_remaining_two_party_votes_band:[2000,60000]}});
assert(inWindow(now));assert(!inWindow(Date.parse('2026-11-04T17:01:00Z')));
const all=()=>races.map(r=>row(r.code));assert.equal(summarize(all(),now).status,'LIVE_INPUT_FORECAST_OBSERVED_NOT_CALIBRATED');
const test=code=>({...row(code),source_test_data:true,live_votes_accepted:false,parsed_counties:0,counted_dem_votes:0,counted_rep_votes:0,projection:null,national_evidence_validated:false});
assert.equal(assess(test('IA-SEN'),now).status,'TEST_DATA_EXCLUDED_NOT_LIVE','Other valid sources may move the national model while Iowa remains test data');
assert(!assess(test('IA-SEN'),now).live_input_validated);
assert.equal(summarize(races.map(r=>({...test(r.code),national_unchanged:true,national_contract_validated:false})),now).status,'SOURCE_AVAILABILITY_REVIEW_REQUIRED');
for(const code of races.map(r=>r.code)){
 for(const mutate of [r=>r.source_url+='?light=',r=>r.http=403,r=>r.source_test_data=undefined,r=>r.source_stamp='2026-11-03T22:00:00Z',r=>r.source_stamp='2026-11-04T05:00:00Z',r=>r.source_identity_validated=false,r=>r.parsed_counties--,r=>r.projection.counted_dem_votes++,r=>r.projection.dem_win_probability=NaN,r=>r.projection.interval_calibrated=true,r=>r.projection.modeled_remaining_two_party_votes_band=[60000,2000],r=>r.national_contract_validated=false,r=>r.preview=true]){
  const bad=row(code);mutate(bad);assert.equal(assess(bad,now).status,'SAFETY_OR_FORECAST_FAILURE',code);
 }
 const leaked=test(code);leaked.national_evidence_validated=true;assert.equal(assess(leaked,now).status,'SAFETY_OR_FORECAST_FAILURE');
}
const wi=row('WI-01');wi.national_evidence_validated=false;assert.equal(assess(wi,now).status,'SAFETY_OR_FORECAST_FAILURE');
wi.projection=null;assert.equal(assess(wi,now).status,'VALIDATED_COUNTS_AWAITING_NATIONAL_ELIGIBILITY','Too little/bias-limited House evidence can correctly withhold national updating');
const blocked=test('KS-SEN');blocked.http=403;assert(!assess(blocked,Date.parse('2026-11-04T03:20:00Z')).prolonged_delivery_gap);assert(assess(blocked,Date.parse('2026-11-04T03:31:00Z')).prolonged_delivery_gap);
assert.throws(()=>summarize(all().slice(0,3),now),'Missing House source cannot pass complete coverage');
assert.throws(()=>summarize([row('IA-SEN'),row('IA-SEN'),row('TX-SEN'),row('WI-01'),row('WI-03')],now));
console.log('Eight-source synthetic classifier: legitimate national conditioning accepted; test/unmatched changes rejected; House posterior must come from admitted joint draws; no live-delivery claim');

assert.equal(assess({...test('IA-SEN'),national_unchanged:false,national_contract_validated:false},now).status,'SAFETY_OR_FORECAST_FAILURE','Changed national model without any matched real source evidence is rejected');

const admitted=all().map(r=>({code:r.code,source_url:r.source_url,as_of:r.source_stamp,counted_two_party_votes:r.counted_dem_votes+r.counted_rep_votes}));
assert.deepEqual(nationalProof(all(),admitted),{contract_validated:true,validated_codes:races.map(r=>r.code)});
for(const mutate of [r=>r.source_url+='?light=',r=>r.as_of='2026-11-04T02:00:00Z',r=>r.counted_two_party_votes++,r=>r.code='UNSUPPORTED']){
 const bad=structuredClone(admitted);mutate(bad[0]);assert(!nationalProof(all(),bad).contract_validated);
}
assert(!nationalProof(all(),[admitted[0],admitted[0]]).contract_validated);
assert(!nationalProof(all().map(r=>({...r,source_test_data:true})),admitted).contract_validated);
assert(!nationalProof(all(),[]).contract_validated);
