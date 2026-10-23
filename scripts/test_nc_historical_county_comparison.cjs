const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const api=require('./nc_historical_county_comparison.js');
const csv=fs.readFileSync(path.join(__dirname,'../data/nc_2024_presidential_county_verified.csv'),'utf8');
const baseline=api.parse(csv);
assert.equal(baseline.size,100);
assert.deepEqual(baseline.get('37183'),{dem:402984,rep:236735});
assert.deepEqual(baseline.get('37063'),{dem:144450,rep:32853});
let td=0,tr=0;for(const row of baseline.values()){td+=row.dem;tr+=row.rep}
assert.deepEqual([td,tr],[2715375,2898423]);
const prepared={
 ready:true,race_key:'NC-SEN',
 source_url:'https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2026_11_03/results_pct_20261103.zip',
 sha256:'a'.repeat(64),checked_at:'2026-11-04T00:30:00Z',
 ballots_reported:null,reporting_fraction:null,
 may_move_national_needle:false,
 rows:[
  {fips:'37183',candidates:[
   {name:'Candidate Alpha',party:'DEM',votes:500},
   {name:'Candidate Beta',party:'REP',votes:400},
   {name:'Candidate Other',party:'LIB',votes:20}]},
  {fips:'37063',candidates:[
   {name:'Candidate Alpha',party:'DEM',votes:250},
   {name:'Candidate Beta',party:'REP',votes:250}]}
 ]
};
const result=api.compare(prepared,csv);
assert.equal(result.ready,true);
assert.equal(result.county_count,2);
assert.equal(result.may_move_national_needle,false);
assert.equal(result.national_swing_estimate,null);
assert.equal(result.estimated_ballots_remaining,null);
assert.equal(result.percent_reporting,null);
assert.equal(result.rows[0].reported_two_party_votes,900);
assert.equal(result.rows[0].reported_2026_senate_margin_points,11.11);
assert.equal(result.rows[0].full_2024_presidential_margin_points,26);
assert.equal(result.rows[0].descriptive_difference_points,-14.88);
assert.equal(result.rows[1].reported_2026_senate_margin_points,0);
for(const wrong of [
 {...prepared,ready:false},
 {...prepared,race_key:'NC-GOV'},
 {...prepared,ballots_reported:2000},
 {...prepared,may_move_national_needle:true},
 {...prepared,source_url:'https://example.com/fake'},
 {...prepared,rows:[prepared.rows[0],prepared.rows[0]]},
 {...prepared,rows:[{...prepared.rows[0],fips:'36061'}]},
 {...prepared,rows:[{...prepared.rows[0],candidates:[
  {name:'A',party:'DEM',votes:80},{name:'B',party:'DEM',votes:20},
  {name:'C',party:'REP',votes:30}]}]}
])assert.equal(api.compare(wrong,csv).ready,false);
assert.equal(api.compare(prepared,csv.replace('402984','402985')).ready,false);
assert.throws(()=>api.parse(csv.replace('100 county','99 county').replace('37001,','36001,')));
assert.equal(api.compare({...prepared,rows:[{fips:'37183',candidates:[
 {name:'One',party:'D',votes:40},{name:'Two',party:'R',votes:35}]}]},csv).ready,false);
function node(tag){return {tag,children:[],textContent:'',appendChild(x){this.children.push(x)},replaceChildren(){this.children=[]}}}
const host=node('div');
assert(api.render(host,result,{createElement:node}));
const texts=host.children.flatMap(x=>[x.textContent,...x.children.map(y=>y.textContent)]).join('\n');
assert.match(texts,/DESCRIPTIVE ONLY/);
assert.match(texts,/2024 full presidential/);
assert.match(texts,/No geographic needle or national forecast adjustment/);
console.log('NC historical county descriptive comparison: certified 100 counties, mixed-office caution, provenance and negative cases passed');
