'use strict';
const assert=require('node:assert/strict'),source=require('./wisconsin_house_county_source.js').forRace('MI-04');
const reference=require('../data/michigan_house_04_county_fips_reference.json');
const facts=require('../data/michigan_house_04_2024_county_baseline_processed.json');
const evidence=require('../data/michigan_house_04_civic_source_evidence.json');
assert.equal(evidence.region_count,6);assert.equal(evidence.source_test_data,false);
assert.equal(evidence.accepted_live_vote_rows,0);
const normalizedName=s=>s.toLowerCase().replace(/[^a-z]/g,'');
assert.deepEqual(evidence.regions.map(c=>[c.fips,normalizedName(c.name)]).sort(),
 reference.counties.map(c=>[c.fips,normalizedName(c.county)]).sort(),
 'Actual provider county identities independently match the Census reference');
const historic=facts.counties;
assert.deepEqual(historic.map(c=>c.county_fips).sort(),reference.counties.map(c=>c.fips).sort());
const candidates=[{name:'Sean McCann',party:'Democratic',votes:0},
 {name:'Bill Huizenga',party:'Republican',votes:0},
 {name:'Shafina Che Barnett',party:'Green',votes:0}];
// Temporary synthetic post-close fixture. None of these are actual 2026 votes.
const region_results=Object.fromEntries(historic.map(c=>{
 const values=[Math.floor(c.dem_votes/100),Math.floor(c.rep_votes/100),Math.floor(c.named_other_votes/100)];
 const rows=candidates.map((person,i)=>({...person,votes:values[i]}));
 values.forEach((n,i)=>candidates[i].votes+=n);
 return [c.county_fips,{name:c.county,type:'County',fips:c.county_fips,percent_reporting:100,candidates:rows}];
}));
const fixture={country:'US',province:'MI',district:'MI-04',municipality:null,election_scope:'General',
 election_type:'House of Representatives',election_name:'Michigan US House 4',election_date:'2026-11-03T05:00:00.000Z',
 test_data:false,last_updated:'2026-11-04T03:00:00Z',candidates,region_results};
const options={now:Date.parse('2026-11-04T03:05:00Z')};
assert.equal(evidence.source_url,source.URL);
assert.equal(evidence.adapter_status,'REJECTED_STALE_ZERO_NOT_LIVE');
assert.deepEqual(evidence.candidate_roster.map(c=>[c.name,c.party]).sort(),candidates.map(c=>[c.name,c.party]).sort());
const valid=source.parse(fixture,reference,options);
assert.equal(valid.counties.length,6);assert.equal(valid.live_votes_accepted,true);
assert.equal(valid.completion_verified,false);assert.equal(valid.method_split_reported,false);
assert.equal(valid.may_move_national_needle,false);
assert(valid.counties.every(c=>!c.completion_verified&&c.vote_method==='combined_not_reported'));
const test=source.parse({...fixture,test_data:true},reference,options);
assert.equal(test.status,'TEST_DATA_NOT_LIVE');assert.equal(test.counties.length,0);
for(const mutate of [d=>delete d.test_data,d=>{d.test_data='false'},d=>{d.mock=true},
 d=>{d.province='IA'},d=>{d.election_name='Wisconsin Governor'},d=>{d.district='MI-03'},d=>delete d.region_results,
 d=>{d.candidates[0].name='Wrong Democratic nominee'},d=>{d.candidates[2].name='Wrong Green nominee'},
 d=>{d.region_results['26005'].candidates[0].votes++},
 d=>{d.region_results['26005'].fips='26021'},d=>{d.region_results['26005'].name='Other County'},
 d=>{d.last_updated='2026-11-04T00:59:00Z'},d=>{d.last_updated='2026-11-03T23:59:00Z'},
 d=>{d.last_updated='2026-11-04T03:00:00'}]){
 const value=structuredClone(fixture);mutate(value);assert.throws(()=>source.parse(value,reference,options));
}
assert.throws(()=>source.parse(fixture,reference,{...options,source_url:source.URL+'?light='}));
console.log('Michigan House6 county contract: independent FIPS joins, strict test exclusion, exact candidates, state reconciliation and post-close clock PASS; no live-delivery claim');

assert.throws(()=>require('./wisconsin_house_county_source.js').parse(fixture,reference,options),/identity/,'MI-04 cannot enter the WI-01 parser');
assert.throws(()=>require('./wisconsin_house_county_source.js').forRace('WI-02'),/Unsupported/);
