const assert=require('node:assert/strict');
const {ingest}=require('./county_source_ingestion_2026');
const expected={provider:'official',provider_race_id:'nc-sen-2026',race_key:'NC-SEN',
 state:'NC',state_fips:'37',office:'Senate',source_url:'https://example.gov/results/county'};
const county={fips:'37001',ballots_reported:100,reporting_status:'partial',
 updated_at:'2026-11-04T00:35:00Z',candidates:[{name:'A',party:'D',votes:60},
 {name:'B',party:'R',votes:40}]};
const envelope={schema:'county-results-v1',election_date:'2026-11-03',
 election_type:'General',production:true,is_test:false,provider:'official',
 provider_race_id:'nc-sen-2026',race_key:'NC-SEN',state:'NC',office:'Senate',
 source_verified:true,source_url:expected.source_url,counties:[county]};
const at=Date.parse('2026-11-04T01:00:00Z');
let first=ingest({},envelope,expected,{},at);
assert(first.accepted);assert.equal(first.updates.length,1);
assert.equal(first.rows['NC-SEN|37001'].ballots_reported,100);
assert.equal(first.may_move_national_needle,false);
assert(first.raceMatchedCountyPulse);
assert.equal(first.raceMatchedCountyPulse.status,'INSUFFICIENT_MATCHED_COUNTIES');
assert.equal(first.raceMatchedCountyPulse.may_move_national_needle,false);
assert.equal(first.raceMatchedCountyPulse.reporting_percent,null);
assert.equal(first.raceMatchedCountyPulse.matched_county_swing_points,null);
assert.equal(ingest(first.rows,envelope,expected,{},at).rejected[0].reason,'STALE_OR_DUPLICATE');
const bad=ingest(first.rows,{...envelope,production:false},expected,{},at);
assert(!bad.accepted);assert.equal(bad.rows,undefined);
const revised=ingest(first.rows,{...envelope,counties:[{...county,
 updated_at:'2026-11-04T00:36:00Z',ballots_reported:90,revision:true,
 candidates:[{name:'A',party:'D',votes:53},{name:'B',party:'R',votes:37}]}]},expected,{},at);
assert(revised.accepted);assert.equal(revised.updates.length,1);
assert.equal(revised.rows['NC-SEN|37001'].ballots_reported,90);
const premature=ingest({}, {...envelope,counties:[{...county,
 updated_at:'2026-11-04T00:25:00Z'}]},expected,{},at);
assert.equal(premature.accepted,false);
assert.equal(premature.reason,'SOURCE_TIME_BEFORE_LOCAL_CLOSE_OR_FUTURE');
const future=ingest({}, {...envelope,counties:[{...county,
 updated_at:'2026-11-04T01:16:00Z'}]},expected,{},at);
assert.equal(future.accepted,false);
assert.equal(future.reason,'SOURCE_TIME_BEFORE_LOCAL_CLOSE_OR_FUTURE');
const late=ingest({},envelope,expected,{},Date.parse('2026-11-04T03:35:01Z'));
assert.equal(late.accepted,false,
 'Stale source payload must never enter normalized county storage');
assert.equal(late.reason,'STALE_COUNTY_SOURCE_TIMESTAMP');
assert.equal(late.rows,undefined,'No stale county record should be published');

const beforeClose=ingest({},envelope,expected,{},
 Date.parse('2026-11-04T00:29:59Z'));
assert.equal(beforeClose.accepted,false);
assert.equal(beforeClose.reason,'SOURCE_TIME_BEFORE_LOCAL_CLOSE_OR_FUTURE',
 'County ingestion must reject positive source votes on an open-polls viewer clock');
// Two valid previously reconciled counties can yield a descriptive
// comparison, but a newly rejected source revision must suppress it.
const second={...county,fips:'37003',ballots_reported:200,
 candidates:[{name:'A',party:'D',votes:120},
             {name:'B',party:'R',votes:80}]};
const old=(fips,d,r)=>({verified_source:true,election_date:'2020-11-03',
 election_year:2020,office:'Senate',
 boundary_version:'2026',county_id:fips,race_key:'NC-SEN',votes:{D:d,R:r}});
const baselines={'NC-SEN|37001':old('37001',50,50),
 'NC-SEN|37003':old('37003',100,100)};
const validTwo=ingest({}, {...envelope,counties:[county,second]},
 expected,baselines,at);
assert.equal(validTwo.updates.length,2);
assert.equal(validTwo.raceMatchedCountyPulse.status,'MATCHED_COUNTIES_DESCRIPTIVE_ONLY');
assert.equal(validTwo.rows['NC-SEN|37001'].election_kind,'regular');
assert.equal(validTwo.raceMatchedCountyPulse.previous_same_seat_election_year,2020);
assert.equal(validTwo.raceMatchedCountyPulse.matched_2024_margin_points,null);
assert.notEqual(validTwo.raceMatchedCountyPulse.matched_county_swing_points,null);
const impossibleCorrection=ingest(validTwo.rows,{...envelope,counties:[{
 ...county,updated_at:'2026-11-04T00:37:00Z',ballots_reported:90,
 candidates:[{name:'A',party:'D',votes:53},
             {name:'B',party:'R',votes:37}]}]},
 expected,baselines,at);
assert.equal(impossibleCorrection.accepted,true,
 'Individual valid previous county snapshots may still be retained');
assert.equal(impossibleCorrection.rejected[0].reason,'UNMARKED_DECREASE');
assert.equal(impossibleCorrection.raceMatchedCountyPulse.status,
 'REJECTED_UNSAFE_COUNTY_BATCH_NO_DESCRIPTIVE_SWING');
assert.equal(impossibleCorrection.raceMatchedCountyPulse.matched_county_swing_points,null);
assert.equal(impossibleCorrection.raceMatchedCountyPulse.may_move_national_needle,false);
const harmlessRepeat=ingest(validTwo.rows,{...envelope,counties:[county,second]},
 expected,baselines,at);
assert.equal(harmlessRepeat.rejected.length,2);
assert(harmlessRepeat.rejected.every(x=>x.reason==='STALE_OR_DUPLICATE'));
assert.equal(harmlessRepeat.raceMatchedCountyPulse.status,
 'MATCHED_COUNTIES_DESCRIPTIVE_ONLY',
 'A repeated unchanged pull is not evidence the earlier verified sample was tainted');
const conflictingSameStamp=ingest(validTwo.rows,{...envelope,counties:[{
 ...county,candidates:[{name:'A',party:'D',votes:80},
                       {name:'B',party:'R',votes:20}]
}]},expected,baselines,at);
assert.equal(conflictingSameStamp.rejected[0].reason,'STALE_OR_DUPLICATE');
assert.equal(conflictingSameStamp.raceMatchedCountyPulse.status,
 'REJECTED_UNSAFE_COUNTY_BATCH_NO_DESCRIPTIVE_SWING',
 'Same timestamp with changed votes is an unverified correction, not a repeat');
assert.equal(conflictingSameStamp.raceMatchedCountyPulse.matched_county_swing_points,null);
console.log('Source contract to county ingestion passed');
