const assert=require('node:assert/strict'),fs=require('node:fs');
const source=require('./maine_civic_county_source.js');
const reference=require('../data/maine_county_fips_reference.json');
const now=Date.parse('2026-11-04T03:00:00Z');
function fixture(){
 const candidates=[{name:'Susan Collins',party:'Republican',candidate_id:220470,votes:16000},
  {name:'Troy Jackson',party:'Democratic',candidate_id:220471,votes:17600}];
 return {country:'US',province:'ME',district:null,municipality:null,election_scope:'General',
  election_type:'US Senate',election_name:'Maine US Senate',election_date:'2026-11-03T05:00:00Z',
  test_data:false,round:1,last_updated:'2026-11-04T02:59:00Z',candidates,
  region_results:Object.fromEntries([...reference.counties.map(c=>[c.fips,{type:'County',name:c.county,fips:c.fips,
   candidates:candidates.map(x=>({...x,votes:x.party==='Republican'?1000:1100}))}]),
   ['nestedTown',{type:'Township',name:'Town within a county',candidates:[{votes:999999999}]}]])};
}
const parse=x=>source.parse(x,reference,{now});
const result=parse(fixture());
assert.equal(result.counties.length,16);
assert.equal(result.counties.reduce((n,c)=>n+c.dem_votes+c.rep_votes,0),33600);
assert.equal(result.round,1);assert.equal(result.may_move_national_needle,false);
assert.match(result.ranked_choice_scope,/NOT_FINAL/);
for(const change of [x=>x.round=2,x=>x.candidates[0].candidate_id=1,
 x=>x.region_results.duplicate={...x.region_results[reference.counties[0].fips]},
 x=>delete x.region_results[reference.counties[0].fips],
 x=>x.candidates[0].votes++,x=>x.last_updated='2026-10-01T00:00:00Z',
 x=>x.region_results.unknown={type:'State'},
 x=>x.candidates.push({name:'Write-in',party:'Independent',votes:0})]){
 const x=fixture();change(x);assert.throws(()=>parse(x));
}
console.log('Maine first-choice county contract: nested-town exclusion, exact IDs, correction scope, missing/duplicate/round/stale rejection PASS (synthetic)');
