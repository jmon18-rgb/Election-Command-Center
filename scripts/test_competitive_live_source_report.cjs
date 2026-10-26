'use strict';
const assert=require('node:assert/strict'),{races,inWindow,assess,summarize}=require('./competitive_live_source_report.cjs');
const now=Date.parse('2026-11-04T03:10:00Z');
// Synthetic classifier inputs only. These tests do not write actual-source reports.
const row=code=>({code,source_url:races.find(r=>r.code===code).url,http:200,source_test_data:false,
 source_identity_validated:true,live_votes_accepted:true,parsed_counties:races.find(r=>r.code===code).counties,
 source_stamp:'2026-11-04T03:00:00Z',counted_dem_votes:100,counted_rep_votes:110,preview:false,national_unchanged:true,
 projection:{dem_win_probability:.45,counted_dem_votes:100,counted_rep_votes:110,
  interval_calibrated:false,may_move_national_needle:false,modeled_remaining_two_party_votes:300,
  modeled_remaining_two_party_votes_band:[20,600]}});
assert(inWindow(now));assert(!inWindow(Date.parse('2026-11-04T17:01:00Z')));
assert.equal(summarize(races.map(r=>row(r.code)),now).status,'LIVE_INPUT_FORECAST_OBSERVED_NOT_CALIBRATED');
const test=()=>({...row('IA-SEN'),source_test_data:true,live_votes_accepted:false,parsed_counties:0,
 counted_dem_votes:0,counted_rep_votes:0,projection:null});
assert.equal(assess(test(),now).status,'TEST_DATA_EXCLUDED_NOT_LIVE');
assert.equal(assess(test(),now).live_input_validated,false,'Test payloads cannot pass the raw-archive gate');
assert.equal(summarize([test(),row('KS-SEN'),row('TX-SEN')],now).status,'LIVE_DELIVERY_UNPROVEN');
assert.equal(assess({...test(),projection:row('IA-SEN').projection},now).status,'SAFETY_OR_FORECAST_FAILURE');
for(const mutate of [r=>r.source_url+='?light=',r=>r.http=403,r=>r.source_test_data=undefined,
 r=>r.source_stamp='2026-11-03T22:00:00Z',r=>r.source_stamp='2026-11-04T05:00:00Z',
 r=>r.source_stamp='2026-11-04T03:00:00',r=>r.source_identity_validated=false,r=>r.parsed_counties=98,
 r=>r.projection.counted_dem_votes++,r=>r.projection.dem_win_probability=NaN,
 r=>r.projection.interval_calibrated=true,r=>r.projection.may_move_national_needle=true,
 r=>r.projection.modeled_remaining_two_party_votes_band=[600,20],r=>r.national_unchanged=false,r=>r.preview=true]){
 const bad=row('IA-SEN');mutate(bad);assert.equal(assess(bad,now).status,'SAFETY_OR_FORECAST_FAILURE');
}
assert.equal(assess(row('IA-SEN'),Date.parse('2026-11-03T22:00:00Z')).status,'SAFETY_OR_FORECAST_FAILURE',
 'A purported positive pre-close forecast cannot become live evidence');
const absent={...row('KS-SEN'),http:403,projection:null,live_votes_accepted:false};
assert(!assess(absent,Date.parse('2026-11-04T03:20:00Z')).prolonged_delivery_gap,
 'Use final statewide closure for the declared90-minute operational alert');
assert(assess(absent,Date.parse('2026-11-04T03:31:00Z')).prolonged_delivery_gap);
assert.equal(summarize([test(),absent,row('TX-SEN')],Date.parse('2026-11-04T03:31:00Z')).status,'SOURCE_AVAILABILITY_REVIEW_REQUIRED');
assert.throws(()=>summarize([test(),test(),row('TX-SEN')],now));
assert.throws(()=>summarize([row('IA-SEN'),row('KS-SEN')],now),'Missing Texas cannot silently pass as full coverage');
const texas=row('TX-SEN');texas.source_test_data=true;texas.live_votes_accepted=false;texas.projection=null;texas.counted_dem_votes=0;texas.counted_rep_votes=0;
assert.equal(summarize([row('IA-SEN'),row('KS-SEN'),texas],now).status,'LIVE_DELIVERY_UNPROVEN');
assert.equal(assess(texas,now).live_input_validated,false);
console.log('Synthetic canary-classifier checks PASS: test data cannot prove live delivery; pre-close/stale/mismatched forecasts fail; timed source gaps remain explicit');
