'use strict';
const assert=require('node:assert/strict');
const source=require('./wisconsin_house_county_source.js').forRace('NY-17');
const reference=require('../data/new_york_house_17_county_fips_reference.json');
const facts=require('../data/new_york_house_17_2024_county_baseline_official.json');
const evidence=require('../data/new_york_house_17_source_assessment.json');
assert.deepEqual(evidence.regions.map(c=>c.fips).sort(),reference.counties.map(c=>c.fips).sort());
assert.equal(facts.district_totals.rep_votes,197845,'Full Lawler Republican+Conservative candidate total, not the180924 Republican line alone');
assert.equal(facts.district_totals.dem_votes,173899,'Frascone Working Families votes do not belong to Jones');
const candidates=[{name:'Cait Conley',party:'Democratic',votes:0},{name:'Mike Lawler',party:'Republican',votes:0}];
const region_results=Object.fromEntries(facts.counties.map(c=>{
 const rows=candidates.map((p,i)=>({...p,votes:Math.floor(c[i?'rep_votes':'dem_votes']*.1)}));
 rows.forEach((p,i)=>candidates[i].votes+=p.votes);
 return [c.county_fips,{name:c.county,type:'County',fips:c.county_fips,candidates:rows}];
}));
const fixture={country:'US',province:'NY',district:'NY-17',municipality:null,election_scope:'General',
 election_type:'House of Representatives',election_name:'New York US House 17',
 election_date:'2026-11-03T05:00:00.000Z',test_data:false,last_updated:'2026-11-04T03:00:00Z',candidates,region_results};
const options={now:Date.parse('2026-11-04T03:05:00Z')};
const parsed=source.parse(fixture,reference,options);
assert.equal(parsed.counties.length,4);assert.equal(parsed.live_votes_accepted,true);
assert.equal(parsed.completion_verified,false);assert.equal(parsed.method_split_reported,false);
assert.equal(parsed.may_move_national_needle,false,'Only the separate national likelihood can admit validated county evidence');
assert.equal(source.parse({...fixture,test_data:true},reference,options).counties.length,0);
for(const mutate of [d=>{d.province='PA'},d=>{d.district='NY-AD-017'},d=>{d.election_scope='Primary'},
 d=>{d.candidates[0].name='Other Democrat'},d=>{d.candidates.push({name:'Mike Lawler',party:'Conservative',votes:0})},
 d=>{d.candidates.push({name:'Other candidate',party:'Working Families',votes:0})},d=>delete d.test_data,
 d=>{d.test_data='false'},d=>{d.last_updated='2026-10-22T22:23:38.766Z'},
 d=>{d.last_updated='2026-11-04T01:59:00Z'},d=>{d.region_results['36027'].fips='36087'},
 d=>{d.region_results['36027'].candidates[0].votes++},d=>{delete d.region_results['36079']}]){
 const bad=structuredClone(fixture);mutate(bad);assert.throws(()=>source.parse(bad,reference,options));
}
console.log('NY17 exact candidate/4 district-part identities, full historical fusion totals, stale/test/pre-close/reconciliation rejection PASS; not live delivery or calibration');
