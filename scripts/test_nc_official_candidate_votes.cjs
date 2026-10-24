const assert=require('node:assert/strict');
const api=require('./nc_official_candidate_votes');
const FILE='https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2026_11_03/results_pct_20261103.zip';
const sha='a'.repeat(64);
const exp={mode:'nc-candidate-only',reviewed:true,verified_source_url:FILE,
 verified_archive_sha256:sha,office:'Senate',race_key:'NC-SEN',
 contest_name:'US SENATE',contest_group_id:'37'};
const county={county_id:'37183',candidates:[
 {name:'Candidate A',party:'DEM',votes:40},{name:'Candidate B',party:'REP',votes:60}]};
const data={schema:'nc-official-candidate-votes-v1',election_date:'2026-11-03',
 state:'NC',race_key:'NC-SEN',office:'Senate',
 source:{url:FILE,sha256:sha,archive_member:'results_pct_20261103.txt',
 contest_name:'US SENATE',contest_group_id:'37'},
 archive_checked_at:'2026-11-04T00:45:00Z',ballots_reported:null,
 reporting_fraction:null,may_move_national_needle:false,counties:[county]};
const now=Date.parse('2026-11-04T00:50:00Z');
let good=api.prepare(data,exp,now);
assert.equal(good.ready,true);
assert.equal(api.prepare({...data,archive_checked_at:'2026-11-04T00:30:00Z'},exp,now).ready,true);
assert.equal(good.rows[0].total,100);
assert.equal(good.ballots_reported,null);
assert.equal(good.may_move_national_needle,false);
const bad=[
 [data,{...exp,reviewed:false}],
 [{...data,election_date:'2024-11-05'},exp],
 [{...data,ballots_reported:100},exp],
 [{...data,reporting_fraction:0.9},exp],
 [{...data,source:{...data.source,sha256:'b'.repeat(64)}},exp],
 [{...data,archive_checked_at:'2026-11-03T12:00:00Z'},exp],
 [{...data,archive_checked_at:'2026-11-04T00:29:59Z'},exp],
 [{...data,archive_checked_at:'2026-11-04T05:00:00Z'},exp],
 [{...data,source:{...data.source,url:'https://unverified.example.com/zip'}},exp],
 [{...data,counties:[county,county]},exp],
 [{...data,counties:[{...county,candidates:[
   {name:'Duplicate',party:'DEM',votes:40},
   {name:'duplicate',party:'REP',votes:60}]}]},exp],
 [{...data,counties:[{...county,county_id:'36001'}]},exp],
 [{...data,counties:[{...county,candidates:[{...county.candidates[0],votes:-1},county.candidates[1]]}]},exp],
 [{...data,counties:[{...county,candidates:[{...county.candidates[0],votes:0},{...county.candidates[1],votes:0}]}]},exp]
];
for(const [sample,approval] of bad)assert.equal(api.prepare(sample,approval,now).ready,false);
assert.equal(api.prepare(data,exp,now+3*3600000).ready,false);
function elt(tag){return {tag,children:[],textContent:'',
 appendChild(node){this.children.push(node)},replaceChildren(){this.children=[]}}}
const host=elt('div'),doc={createElement:elt};
assert(api.render(host,good,doc));
assert(host.children.some(x=>/ZIP retrieved/.test(x.textContent)));
assert(host.children.some(x=>/Ballots remaining/.test(x.textContent)));
assert(!host.children.some(x=>/percent reporting: \d/.test(x.textContent)));
assert.equal(api.render(host,api.prepare(data,{...exp,reviewed:false},now),doc),false);
console.log('NC official candidate-only display gating passed');
