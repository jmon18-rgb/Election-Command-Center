#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {summarize}=require('./geographic_matched_county_pulse_2026.js');
const NOW=Date.parse('2026-11-04T01:00:00Z');
const mk=(fips,D,R,other=0)=>({
 election_date:'2026-11-03',election_type:'General',is_test:false,
 verified_source:true,provider:'official',provider_race_id:'va-sen-2026',
 office:'Senate',state:'VA',state_fips:'51',
 county_id:fips,race_key:'VA-SEN',updated_at:'2026-11-04T00:05:00Z',
 reporting_status:'partial',ballots_reported:D+R+other,
 candidates:[{name:'D candidate',party:'D',votes:D},
             {name:'R candidate',party:'R',votes:R},
             {name:'Independent',party:'O',votes:other}]
});
const bas=(fips,D,R)=>({verified_source:true,election_date:'2024-11-05',
 boundary_version:'2026',race_key:'VA-SEN',county_id:fips,votes:{D,R}});
const a=mk('51107',60,40,10),b=mk('51059',140,60,20),c=mk('51013',5,5,0);
const key=x=>x.race_key+'|'+x.county_id;
const first={ [key(a)]:a,[key(b)]:b,[key(c)]:c };
const bases={[key(a)]:bas(a.county_id,40,60),
 [key(b)]:bas(b.county_id,90,110)};
const res=summarize(first,bases,'VA-SEN',NOW);
assert.equal(res.status,'MATCHED_COUNTIES_DESCRIPTIVE_ONLY');
assert.equal(res.observed_counties,3);
assert.equal(res.matched_counties,2);
assert.equal(res.missing_comparable_baseline,1);
assert.equal(res.rejected_observations,0);
assert.equal(res.matched_2026_two_party_votes,300);
assert.equal(res.matched_2024_two_party_votes,300);
assert.equal(res.matched_2026_other_party_votes,30);
assert(Math.abs(res.matched_2026_margin_points-100/3)<1e-8);
assert(Math.abs(res.matched_2024_margin_points+100/7.5)<1e-8);
assert(Math.abs(res.matched_county_swing_points-46.66666666666667)<1e-8,
 'This must compare SUMMED votes on precisely the same historical counties');
assert.equal(res.reporting_percent,null,'Sample counties are NOT percent statewide reporting');
assert.equal(res.estimated_votes_remaining,null);
assert.equal(res.may_move_national_needle,false);
assert.equal(res.may_infer_statewide_swing,false);
assert.equal(res.calibrated_probability,false);
assert.equal(res.may_call_races,false);
assert.equal(summarize(first,{},'VA-SEN',NOW).status,
 'INSUFFICIENT_MATCHED_COUNTIES');
assert.equal(summarize({[key(a)]:a},bases,'VA-SEN',NOW).status,
 'INSUFFICIENT_MATCHED_COUNTIES');
const otherProvider={...b,provider:'another'};
const mixed=summarize({...first,[key(b)]:otherProvider},bases,'VA-SEN',NOW);
assert.equal(mixed.status,'MIXED_PROVIDER_PROVENANCE');
assert.equal(mixed.matched_county_swing_points,null);
const preclose={...b,updated_at:'2026-11-03T23:59:59Z'};
const early=summarize({...first,[key(b)]:preclose},bases,'VA-SEN',NOW);
assert.notEqual(early.status,'MATCHED_COUNTIES_DESCRIPTIVE_ONLY');
assert.equal(early.rejected_observations,1);
assert.equal(early.matched_county_swing_points,null,
 'A rejected pre-close county must not leave an actionable-looking swing');
assert.equal(early.matched_2026_margin_points,null);
// A source timestamp after poll closure is not itself proof votes could
// have been observed by a dashboard clock still BEFORE poll closure.
const preViewerClock=summarize(first,bases,'VA-SEN',
 Date.parse('2026-11-03T23:59:59Z'));
assert.equal(preViewerClock.matched_county_swing_points,null,
 'No matched county vote may inform the pulse while local polls are open');
assert.equal(preViewerClock.rejected_observations,3);
assert.equal(summarize(first,bases,'VA-SEN',
 Date.parse('2026-11-04T00:05:01Z')).status,
 'MATCHED_COUNTIES_DESCRIPTIVE_ONLY',
 'Legitimate source-stamped postclose votes recover after viewer clock closes');
const future={...b,updated_at:'2026-11-04T01:16:00Z'};
const futurePulse=summarize({...first,[key(b)]:future},bases,'VA-SEN',NOW);
assert.equal(futurePulse.rejected_observations,1);
assert.equal(futurePulse.matched_county_swing_points,null,
 'Future-dated source data must invalidate the whole advisory pulse');
const stale={...b,updated_at:'2026-11-04T00:10:00Z'};
assert.equal(summarize({...first,[key(b)]:stale},bases,'VA-SEN',
 Date.parse('2026-11-04T04:00:00Z')).rejected_observations,3,
 'Stale validation must reject rows older than 180 minutes');
const invalid={...a,ballots_reported:25};
const contaminated=summarize({...first,[key(a)]:invalid},bases,'VA-SEN',NOW);
assert.equal(contaminated.status,'REJECTED_INVALID_COUNTY_OBSERVATIONS');
assert.equal(contaminated.matched_counties,1);
assert.equal(contaminated.matched_county_swing_points,null);
const invalidThird={...c,is_test:true};
const partial=summarize({...first,[key(c)]:invalidThird},bases,'VA-SEN',NOW);
assert.equal(partial.matched_counties,2,
 'Two otherwise valid counties cannot rescue a poisoned source batch');
assert.equal(partial.rejected_observations,1);
assert.equal(partial.status,'REJECTED_INVALID_COUNTY_OBSERVATIONS');
assert.equal(partial.matched_county_swing_points,null);
assert.equal(partial.matched_2024_margin_points,null);
assert.equal(partial.matched_2026_two_party_votes,null);
const changedKey=summarize({'VA-SEN|wrong':a,[key(b)]:b},bases,'VA-SEN',NOW);
assert.equal(changedKey.status,'REJECTED_INVALID_COUNTY_OBSERVATIONS');
assert.equal(changedKey.matched_county_swing_points,null);
const incompatibleHistory={...bases,[key(b)]:{
 ...bases[key(b)],election_date:'2020-11-03'}};
assert.equal(summarize(first,incompatibleHistory,'VA-SEN',NOW).status,
 'INSUFFICIENT_MATCHED_COUNTIES');
assert.equal(summarize(first,bases,'NC-SEN',NOW).matched_county_swing_points,null,
 'Never borrow counties or baselines from a different race');
assert.equal(summarize([],bases,'VA-SEN',NOW).status,'INVALID_INPUT');
console.log('Matched-county advisory pulse: time/provenance gates, strict same-geography D/R swing, missing baselines, third-party vote accounting and NO nationwide needle PASS');
