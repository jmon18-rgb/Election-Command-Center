#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const adapter=require('./civicapi_nh_governor_adapter.js');
const item={office:'Governor',key:'NH'};
const pre=Date.parse('2026-10-13T20:00:00Z');
const electionNight=Date.parse('2026-11-04T03:00:00Z');
const search={
  id:87284,country:'US',province:'NH',district:null,municipality:null,
  type:'Governor',election_type:'Statewide',election_name:'New Hampshire Governor',
  election_date:'2026-11-03T05:00:00.000Z',
  candidates:[
    {name:'Candidate D',party:'Democratic',votes:0,percent:0,winner:false},
    {name:'Candidate R',party:'Republican',votes:0,percent:0,winner:false},
    {name:'Candidate I',party:'Independent',votes:0,percent:0,winner:false}
  ]
};
const blank={...search,election_type:'Governor',percent_reporting:0,last_updated:null};
const counting={...blank,last_updated:'2026-11-04T01:45:00Z',percent_reporting:42,
  candidates:[
    {name:'Candidate D',party:'Democratic',votes:510,percent:51,winner:false},
    {name:'Candidate R',party:'Republican',votes:490,percent:49,winner:false},
    {name:'Candidate I',party:'Independent',votes:0,percent:0,winner:false}
  ]};
const mutate=(obj,key,value)=>({...obj,[key]:value});
assert.equal(adapter.supports(item),true);
for(const notSupported of [
  {office:'Governor',key:'NV'},
  {office:'House',key:'NH-01'},
  {office:'Senate',key:'NH'},
  {office:'Governor',key:'NH-01'}
])assert.equal(adapter.supports(notSupported),false);
const request=new URL(adapter.query(item));
assert.equal(request.origin,'https://civicapi.org');
assert.equal(request.pathname,'/api/v2/race/search');
for(const [key,value] of Object.entries({
  country:'US',province:'NH',startDate:'2026-11-03',endDate:'2026-11-03',
  query:'Governor',limit:'20'
}))assert.equal(request.searchParams.get(key),value);
assert.equal(adapter.query({office:'Governor',key:'NV'}),null);
assert.equal(adapter.match(item,search),true);
const invalidSearch=[
  mutate(search,'province','NV'),mutate(search,'country','CA'),
  mutate(search,'district','NH-01'),mutate(search,'municipality','Concord'),
  mutate(search,'type','US Senate'),mutate(search,'election_type','General'),
  mutate(search,'election_name','New Hampshire Governor Primary'),
  mutate(search,'election_name','New Hampshire Lieutenant Governor'),
  mutate(search,'election_date','2026-09-08T05:00:00.000Z'),
  mutate(search,'election_date','2026-11-03BAD'),
  mutate(search,'id','87284'),mutate(search,'id',-1),
  mutate(search,'candidates',null)
];
for(const bad of invalidSearch)assert.equal(adapter.match(item,bad),false,
 'Wrong race must never match: '+JSON.stringify(bad).slice(0,120));
assert.equal(adapter.select(item,{races:[search]}).id,87284);
assert.equal(adapter.select(item,{races:[search,search]}),null,
 'Multiple exact matches must fail closed');
assert.equal(adapter.select(item,{races:[mutate(search,'province','NV')]}),null);
assert.equal(adapter.select(item,{races:[]}),null,'Unindexed does not mean zero votes');
assert.equal(adapter.select(item,{races:new Array(21).fill(search)}),null);
assert.equal(adapter.validate(item,search,blank,pre).total,0,
 'An early indexed race with blank vote counts is allowed but not reported');
assert.equal(adapter.validate(item,search,counting,pre),null,
 'Pre-election votes are invalid');
const valid=adapter.validate(item,search,counting,electionNight);
assert(valid);
assert.deepEqual({provider:valid.provider,key:valid.key,office:valid.office,
  race_id:valid.race_id,total:valid.total,called:valid.called},
 {provider:'civicAPI',key:'NH',office:'Governor',
  race_id:87284,total:1000,called:null});
assert.equal(valid.source_url,'https://civicapi.org/api/v2/race/87284');
assert.equal(valid.candidates[2].party,'O');
const called={...counting,candidates:[
  {...counting.candidates[0],winner:true},...counting.candidates.slice(1)]};
assert.equal(adapter.validate(item,search,called,electionNight).called,'Candidate D',
 'Provider calls must remain distinguishable from certifications');
const invalidDetails=[
  mutate(counting,'id',87283),mutate(counting,'province','NV'),
  mutate(counting,'election_name','New Hampshire Governor Primary'),
  mutate(counting,'election_type','US Senate'),mutate(counting,'district','NH-01'),
  mutate(counting,'election_date','2024-11-05T05:00:00.000Z'),
  mutate(counting,'percent_reporting',101),
  mutate(counting,'percent_reporting',-2),
  mutate(counting,'percent_reporting',null),
  mutate(counting,'last_updated','2026-11-04T03:16:00Z'),
  mutate(counting,'last_updated','2026-10-22T03:00:00Z'),
  mutate(counting,'candidates',[
    {...counting.candidates[0],votes:-1},...counting.candidates.slice(1)]),
  mutate(counting,'candidates',[
    {...counting.candidates[0],percent:71},...counting.candidates.slice(1)]),
  mutate(counting,'candidates',[
    counting.candidates[0],{...counting.candidates[0],name:'candidate d'},
    counting.candidates[2]]),
  mutate(counting,'candidates',[
    {...counting.candidates[0],winner:true},
    {...counting.candidates[1],winner:true},counting.candidates[2]]),
  mutate(blank,'candidates',[
    {...blank.candidates[0],winner:true},...blank.candidates.slice(1)]),
  mutate(blank,'candidates',[
    {...blank.candidates[0],percent:1},...blank.candidates.slice(1)]),
  mutate(counting,'candidates',[]),
  mutate(counting,'candidates',[counting.candidates[0]])
];
for(const bad of invalidDetails)
 assert.equal(adapter.validate(item,search,bad,electionNight),null,
  'Reject inconsistent civicAPI detail: '+JSON.stringify(bad).slice(0,150));
assert.equal(adapter.validate({office:'Governor',key:'NV'},search,counting,electionNight),null);
console.log('New Hampshire governor civicAPI adapter safety and identity tests passed');
