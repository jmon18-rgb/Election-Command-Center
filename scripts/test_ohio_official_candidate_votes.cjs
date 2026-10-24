#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const api=require('./ohio_official_candidate_votes.js');
const NOW=Date.parse('2026-11-04T01:00:00Z');
const SOURCE='https://liveresults.ohiosos.gov/Api/v1/download?filename=VSSC1622XmlFileBlob';
const REVIEW={
 schema:'ohio-nist-2026-live-approval-v1',enabled:true,
 real_results_publication_reviewed:true,
 source_url:SOURCE,source_reviewed_at:'2026-11-04T00:48:00Z',
 county_gpunit_to_fips:Object.fromEntries(Array.from({length:88},(_,i)=>
  ['g'+i,'39'+String(i*2+1).padStart(3,'0')])),
 approved_contests:[{race_key:'OH-SEN-special'}]
};
const SNAP={
 schema:'ohio-nist-candidate-county-2026-v1',
 status:'INDEPENDENTLY_REVIEWED_UNOFFICIAL_CANDIDATE_COUNTS_NO_RACE_CALLS',
 election_date:'2026-11-03',state:'OH',
 source:{url:SOURCE,xml_sha256:'a'.repeat(64),
  generated_at:'2026-11-04T00:51:00Z',
  approval_reviewed_at:REVIEW.source_reviewed_at},
 ballots_remaining:null,reporting_fraction:null,
 independently_certified_winner_calls:false,may_move_national_needle:false,
 races:[{
  race_key:'OH-SEN-special',dashboard_race_id:'Senate|OH-special',
  office:'Senate',reported_county_count:2,
  counties:[
   {county_fips:'39001',candidates:[
    {name:'Blue Fixture',party:'DEM',votes:100},
    {name:'Red Fixture',party:'REP',votes:130}]},
   {county_fips:'39003',candidates:[
    {name:'Blue Fixture',party:'DEM',votes:80},
    {name:'Red Fixture',party:'REP',votes:90}]}
  ]
 }]
};
const valid=api.prepare(SNAP,REVIEW,NOW);
assert.equal(valid.ready,true);
assert.equal(valid.races.length,1);
assert.equal(valid.races[0].race_id,'Senate|OH-special');
assert.equal(valid.races[0].county_rows,2);
assert.equal(valid.races[0].votes_for_listed_candidates,400);
assert.deepEqual(valid.races[0].candidates.map(x=>x.votes),[220,180]);
assert.equal(valid.may_move_national_needle,false);
assert.equal(valid.ballots_remaining,null);
assert.equal(valid.reporting_fraction,null);
for(const config of [
 {...REVIEW,enabled:false},
 {...REVIEW,real_results_publication_reviewed:false},
 {...REVIEW,source_url:'https://example.com/mock'},
 {...REVIEW,source_reviewed_at:'2026-11-03T12:00:00Z'},
 {...REVIEW,county_gpunit_to_fips:{}},
 {...REVIEW,approved_contests:[{race_key:'OH-GOV'}]}
])assert.equal(api.prepare(SNAP,config,NOW).ready,false);
for(const changed of [
 {...SNAP,status:'UNREVIEWED_MOCK_XML'},
 {...SNAP,source:{...SNAP.source,generated_at:'2026-11-03T22:00:00Z'}},
 {...SNAP,source:{...SNAP.source,generated_at:'2026-11-05T02:00:00Z'}},
 {...SNAP,reporting_fraction:0.5},
 {...SNAP,ballots_remaining:500},
 {...SNAP,independently_certified_winner_calls:true},
 {...SNAP,may_move_national_needle:true},
 {...SNAP,races:[{...SNAP.races[0],dashboard_race_id:'Senate|OH'}]},
 {...SNAP,races:[{...SNAP.races[0],reported_county_count:88}]},
 {...SNAP,races:[{...SNAP.races[0],counties:[SNAP.races[0].counties[0],
   SNAP.races[0].counties[0]]}]},
 {...SNAP,races:[{...SNAP.races[0],counties:[{county_fips:'36061',
   candidates:SNAP.races[0].counties[0].candidates}]}]},
])assert.equal(api.prepare(changed,REVIEW,NOW).ready,false);
const node=tag=>({tag,children:[],textContent:'',appendChild(x){this.children.push(x)},
 replaceChildren(){this.children=[]}});
const root=node('div');
assert.equal(api.render(root,valid,{createElement:node}),true);
const asText=(el)=>[el.textContent,...el.children.flatMap(asText)].join(' ');
const text=asText(root);
assert.match(text,/Senate\|OH-special/);
assert.match(text,/220/);
assert.match(text,/NOT verified ballots remaining/);
assert.match(text,/Ohio Secretary of State XML source/);
root.replaceChildren();
assert.equal(api.render(root,{ready:false,reason:'UNREVIEWED MOCK'},{createElement:node}),false);
assert.match(asText(root),/UNREVIEWED MOCK/);
console.log('Ohio NIST 88-county approval gate, refreshed candidate source, stale/mock/duplication cases and conservative render PASS');
