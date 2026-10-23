const assert=require('node:assert/strict');
const {prepare,render}=require('./election_night_county_results_desk');
const expected={provider:'official',provider_race_id:'nc-sen-2026',
 race_key:'NC-SEN',state:'NC',state_fips:'37',office:'Senate',
 source_url:'https://example.gov/county/official'};
const row={fips:'37183',ballots_reported:100,reporting_status:'partial',
 updated_at:'2026-11-04T00:30:00Z',
 candidates:[{name:'A',party:'D',votes:60},{name:'B',party:'R',votes:40}]};
const snapshot={schema:'county-results-v1',election_date:'2026-11-03',
 election_type:'General',production:true,is_test:false,
 provider:'official',provider_race_id:expected.provider_race_id,
 race_key:'NC-SEN',state:'NC',office:'Senate',source_verified:true,
 source_url:expected.source_url,counties:[row]};
const now=Date.parse('2026-11-04T00:35:00Z');
const valid=prepare(snapshot,expected,now);
assert(valid.ready);assert.equal(valid.rows[0].fips,'37183');
assert.equal(valid.may_move_national_needle,false);
assert.equal(prepare(snapshot,expected,now+3*3600000).ready,false);
assert.equal(prepare({...snapshot,source_verified:false},expected,now).ready,false);
assert.equal(prepare({...snapshot,production:false},expected,now).ready,false);
assert.equal(prepare({...snapshot,counties:[{...row,fips:'36061'}]},expected,now).ready,false);
assert.equal(prepare({...snapshot,counties:[{...row,ballots_reported:1}]},expected,now).ready,false);
assert.equal(prepare(null,expected,now).ready,false);
function elem(tag){return {tag,textContent:'',children:[],appendChild(n){this.children.push(n)},
 replaceChildren(){this.children=[]}};}
const doc={createElement:elem};const host=elem('div');
assert(render(host,valid,doc));assert(host.children.some(x=>x.tag==='a'&&x.href===expected.source_url));
assert(host.children.some(x=>x.tag==='section'));
const stale=prepare(snapshot,expected,now+3*3600000);
assert.equal(render(host,stale,doc),false);assert.equal(host.children.length,1);
console.log('Source-attributed county results desk gate passed');
