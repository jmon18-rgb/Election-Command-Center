'use strict';
const assert=require('node:assert/strict'),{fixture}=require('./arizona_house_06_test_fixture.cjs');
const source=require('./wisconsin_house_county_source.js').forRace('AZ-06');
const reference=require('../data/arizona_house_06_county_fips_reference.json');
const actual=require('../data/arizona_house_06_sources/2026-civic-zero-snapshot.json');
const now=Date.parse('2026-11-04T03:06:00Z');
assert.throws(()=>source.parse(actual,reference,{now}),/stale/,'Actual zero template is not live input');
const data=fixture(),valid=source.parse(data,reference,{now});
assert.equal(valid.counties.length,5);assert.equal(valid.live_votes_accepted,true);
assert.equal(valid.completion_verified,false);assert.equal(valid.method_split_reported,false);
assert.equal(valid.may_move_national_needle,false);
const withWriteIn=structuredClone(data);withWriteIn.candidates[4].votes=17;
Object.values(withWriteIn.region_results)[0].candidates[4].votes=17;
const other=source.parse(withWriteIn,reference,{now});
assert.equal(other.counties.reduce((n,c)=>n+c.other_votes,0),17);
assert.deepEqual(other.counties.map(c=>c.dem_votes),valid.counties.map(c=>c.dem_votes),'Certified independent write-in never becomes Democratic evidence');
assert.equal(source.parse({...data,test_data:true},reference,{now}).live_votes_accepted,false);
for(const mutate of [d=>d.round=2,d=>d.mock=true,d=>d.district='AZ-01',d=>d.province='PA',
 d=>d.candidates[3].name='Jereme Lance Peters',d=>d.candidates[4].party='Democratic',
 d=>d.candidates[0].candidate_id++,d=>d.candidates.pop(),
 d=>d.region_results['04019'].fips='04003',d=>d.region_results['04019'].type='Precinct',
 d=>d.region_results['04019'].candidates[0].votes++,d=>delete d.region_results['04019'],
 d=>d.last_updated='2026-11-04T03:05:00',d=>d.last_updated='2026-11-03T00:05:00Z']){
 const x=structuredClone(data);mutate(x);assert.throws(()=>source.parse(x,reference,{now}));
}
assert.throws(()=>source.parse(data,reference,{now,source_url:source.URL+'?light='}));
assert.throws(()=>source.parse(data,reference,{now:Date.parse('2026-11-03T22:00:00Z')}));
console.log('AZ06 exact native roster/independent write-in, five district parts, reconciliation, clock and zero guards PASS (synthetic only)');
