'use strict';
const assert=require('node:assert/strict');
const source=require('./ohio_civic_county_source.js');
const reference=require('../data/ohio_senate_2024_county_baseline_official.json');
const {readFileSync}=require('node:fs'),{createHash}=require('node:crypto');
assert.equal(createHash('sha256').update(readFileSync(require('node:path').join(__dirname,
 '../data/ohio_source_documents/2026-general-certified-candidates.pdf'))).digest('hex'),
 '18910e2d7e4e939ead11e0459dcc0a721c2ad10c473986e4102d087396185b4d');
const roster=[['Sherrod Brown','Democratic',221403],['Stephen Faris','Write-In',221404],
 ['Anthony Holliman','Write-In',221405],['Jon Husted','Republican',221406],
 ['Greg Levy','Other Party',221407],['William B. Redpath','Libertarian',221408],
 ['Timothy Telymonde','Write-In',221409]];
// SYNTHETIC post-close scenario, not actual 2026 returns or release chronology.
const candidates=roster.map(([name,party,candidate_id])=>({name,party,candidate_id,votes:0}));
const region_results=Object.fromEntries(reference.counties.map(c=>{
 const counts=[Math.floor(c.dem_votes/100),1,2,Math.floor(c.rep_votes/100),3,4,5];
 const rows=candidates.map((person,i)=>({...person,votes:counts[i]}));
 counts.forEach((n,i)=>candidates[i].votes+=n);
 return [c.fips,{name:c.county,fips:c.fips,type:'County',candidates:rows,percent_reporting:100}];
}));
const fixture={country:'US',province:'OH',district:null,municipality:null,election_scope:'General',
 election_type:'US Senate',election_name:'Ohio US Senate Special General',round:1,
 election_date:'2026-11-03T05:00:00.000Z',test_data:false,last_updated:'2026-11-04T01:00:00Z',
 candidates,region_results};
const options={now:Date.parse('2026-11-04T01:02:00Z')};
const valid=source.parse(fixture,reference,options);
assert.equal(valid.counties.length,88);
assert.equal(valid.live_votes_accepted,true);
assert.equal(valid.may_move_national_needle,false,'Preparation parser does not activate forecasting');
assert.equal(valid.completion_verified,false);
assert(valid.counties.every(c=>c.other_votes===15&&c.completion_verified===false));
assert.equal(valid.counties.reduce((n,c)=>n+c.dem_votes,0),candidates[0].votes);
assert.equal(source.parse({...fixture,test_data:true},reference,options).counties.length,0);
const zero=structuredClone(fixture);
zero.candidates.forEach(c=>c.votes=0);
Object.values(zero.region_results).forEach(r=>r.candidates.forEach(c=>c.votes=0));
assert.equal(source.parse(zero,reference,options).status,'NO_REPORTED_VOTES');
for(const mutate of [d=>{d.election_name='Ohio US Senate'},d=>{d.round=2},
 d=>{d.election_date='2024-11-05T05:00:00Z'},d=>{d.province='MI'},
 d=>{d.candidates[0].candidate_id++},d=>{d.candidates[0].name='Different Brown'},
 d=>{d.candidates[4].party='Democratic'},d=>{d.candidates.pop()},
 d=>{d.candidates.push({...d.candidates[0],candidate_id:1})},
 d=>{delete d.region_results['39001']},d=>{d.region_results['39001'].fips='39003'},
 d=>{d.region_results['39001'].name='Wrong county'},
 d=>{d.region_results['39001'].candidates.pop()},
 d=>{d.region_results['39001'].candidates[0].votes++},
 d=>{d.region_results['39001'].candidates[0].votes=-1},
 d=>{d.last_updated='2026-11-04T00:29:00Z'},
 d=>{d.last_updated='2026-11-03T01:00:00Z'},
 d=>{d.last_updated='2026-11-04T01:00:00'},
 d=>{d.mock=true},d=>{delete d.test_data}]){
 const changed=structuredClone(fixture);mutate(changed);
 assert.throws(()=>source.parse(changed,reference,options));
}
assert.throws(()=>source.parse(fixture,reference,{...options,source_url:source.URL+'?light='}));
console.log('Ohio88 exact special-Senate roster/native IDs, all write-ins, county/state sums, zero/mock/clock guards PASS; SYNTHETIC, no national activation');
