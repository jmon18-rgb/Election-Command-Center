'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=require('./iowa_civic_county_source.cjs');
const reference=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/iowa_county_fips_reference.json'),'utf8'));
const historical=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/iowa_senate_county_modes_official.json'),'utf8'));
assert.deepEqual(reference.counties.map(x=>x.county).sort(),historical.years['2020'].counties.map(x=>x.county).sort());
const detail={country:'US',province:'IA',district:null,municipality:null,
 election_name:'Iowa US Senate',election_type:'US Senate',election_scope:'General',
 election_date:'2026-11-03T05:00:00.000Z',last_updated:'2026-11-04T03:00:00Z',test_data:false,
 candidates:[{name:'Ashley Hinson',party:'Republican',votes:594},
  {name:'Josh Turek',party:'Democratic',votes:396},{name:'Thomas Laehn',party:'Libertarian',votes:99}],
 region_results:Object.fromEntries(reference.counties.map(c=>[c.fips,{name:c.county,type:'County',fips:c.fips,
  percent_reporting:100,candidates:[{name:'Ashley Hinson',party:'Republican',votes:6},
   {name:'Josh Turek',party:'Democratic',votes:4},{name:'Thomas Laehn',party:'Libertarian',votes:1}]}]))};
const options={now:Date.parse('2026-11-04T03:05:00Z')};
const normalized=source.parse(detail,reference,options);
assert.equal(normalized.counties.length,99);assert.equal(normalized.live_votes_accepted,true);
assert.equal(normalized.method_split_reported,false);assert.equal(normalized.completion_verified,false,
 'Even 100% reported precincts cannot certify all ballots or a county-method completion');
assert(normalized.counties.every(c=>c.vote_method==='combined_not_reported'&&!c.completion_verified));
const test=source.parse({...detail,test_data:true},reference,options);
assert.equal(test.status,'TEST_DATA_NOT_LIVE');assert.equal(test.counties.length,0);
for(const mutate of [
 d=>{d.test_data=undefined},d=>{d.province='NH'},d=>{delete d.region_results},
 d=>{d.test_data='false'},d=>{d.test=true},
 d=>{d.region_results['19001'].fips='19003'},d=>{d.region_results['19001'].name='Wrong County'},
 d=>{d.region_results['19001'].candidates[0].votes++},
 d=>{d.region_results['19001'].candidates[0].name='Wrong Candidate'},
 d=>{d.last_updated='2026-11-03T18:00:00Z'},d=>{d.last_updated='2026-11-04T03:00:00'}
 ,d=>{d.last_updated='2026-11-04T01:59:30Z'}
]){const d=structuredClone(detail);mutate(d);assert.throws(()=>source.parse(d,reference,options));}
assert.throws(()=>source.parse(detail,reference,{...options,source_url:source.URL+'?light='}));
console.log('Iowa full-source adapter: 99 independent Census joins, test rejection, post-close/time gates, candidate reconciliation and no inferred method split PASS');
