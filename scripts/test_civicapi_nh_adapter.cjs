#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const adapter=require('./civicapi_nh_adapter.js');
const item={office:'Senate',key:'NH'};
const pre=Date.parse('2026-10-13T19:00:00Z');
const live=Date.parse('2026-11-04T03:00:00Z');
const row={
  id:87283,country:'US',province:'NH',municipality:null,district:null,
  type:'US Senate',election_type:'General',
  election_name:'New Hampshire US Senate',
  election_date:'2026-11-03T05:00:00.000Z',
  candidates:[
    {name:'Candidate D',party:'Democratic',votes:0,percent:0,winner:false},
    {name:'Candidate R',party:'Republican',votes:0,percent:0,winner:false}
  ]
};
const zero={...row,election_type:'US Senate',percent_reporting:0,last_updated:null};
const counted={
  ...zero,percent_reporting:45,last_updated:'2026-11-04T01:30:00Z',
  candidates:[
    {name:'Candidate D',party:'Democratic',votes:510,percent:51,winner:false},
    {name:'Candidate R',party:'Republican',votes:490,percent:49,winner:false}
  ]
};
const edit=(object,field,value)=>({...object,[field]:value});
assert.equal(adapter.supports(item),true);
assert.equal(adapter.supports({office:'House',key:'NH-01'}),false);
assert.equal(adapter.supports({office:'Senate',key:'NV'}),false);
const url=new URL(adapter.query(item));
assert.equal(url.origin,'https://civicapi.org');
assert.equal(url.pathname,'/api/v2/race/search');
for(const [key,val] of Object.entries({
  country:'US',province:'NH',query:'US Senate',startDate:'2026-11-03',
  endDate:'2026-11-03',limit:'20'
}))assert.equal(url.searchParams.get(key),val,key+' query param');
assert.equal(adapter.query({office:'Senate',key:'NV'}),null);
assert.equal(adapter.match(item,row),true);
for(const invalid of [
  edit(row,'province','NV'),
  edit(row,'country','CA'),
  edit(row,'district','NH-01'),
  edit(row,'election_name','New Hampshire US Senate Primary'),
  edit(row,'election_name','New Hampshire US Senate Special'),
  edit(row,'election_type','Primary'),
  edit(row,'type','Governor'),
  edit(row,'municipality','Concord'),
  edit(row,'election_date','2026-11-03garbage'),
  edit(row,'election_date','2026-11-03T25:00:00Z'),
  edit(row,'election_date','2026-11-03T12:65:00Z'),
  edit(row,'election_date','2026-11-03T23:59:00+18:00'),
  edit(row,'election_date','2026-09-08T05:00:00Z'),
  edit(row,'id','87283'),
  edit(row,'candidates',null)
])assert.equal(adapter.match(item,invalid),false,JSON.stringify(invalid));
assert.equal(adapter.select(item,{races:[row]}).id,row.id);
assert.equal(adapter.select(item,{races:[row],count:1}).id,row.id,
 'Complete provider search cardinality remains usable');
for(const count of [0,2,-1,1.5,'1',true,NaN]){
 assert.equal(adapter.select(item,{races:[row],count}),null,
  'Truncated, inconsistent or malformed provider search count is not unique-race proof');
}
for(const marker of [{is_test:true},{test:true},{mock:true},{is_mock:true},
 {active:false},{live:false}]){
 assert.equal(adapter.match(item,{...row,...marker}),false,
  'Explicitly nonproduction source race must be rejected');
 assert.equal(adapter.select(item,{races:[row],...marker}),null,
  'Nonproduction search envelope is not source evidence');
 assert.equal(adapter.validate(item,row,{...counted,...marker},live),null,
  'Nonproduction detail cannot create 2026 votes');
}
assert.equal(adapter.select(item,{races:[row,row]}),null,'Duplicate exact races must fail closed');
assert.equal(adapter.select(item,{races:[edit(row,'district','NH-01')]}),null);
assert.equal(adapter.select(item,{races:[]}),null,'Unindexed is unknown, not zero');
assert.equal(adapter.select(item,{races:new Array(21).fill(row)}),null,'Bound API response size');
assert.equal(adapter.validate(item,row,zero,pre).total,0,'Pre-election blank counts remain unreported');
assert.equal(adapter.validate(item,row,counted,pre),null,'Never show 2026 votes early');
const accepted=adapter.validate(item,row,counted,live);
assert(accepted,'Exactly matched live NH Senate results must be accepted');
assert.deepEqual({provider:accepted.provider,office:accepted.office,key:accepted.key,
  race_id:accepted.race_id,total:accepted.total,called:accepted.called},
 {provider:'civicAPI',office:'Senate',key:'NH',race_id:87283,total:1000,called:null});
assert.equal(accepted.source_url,'https://civicapi.org/api/v2/race/87283');
const called={...counted,candidates:[
  {...counted.candidates[0],winner:true},counted.candidates[1]
]};
assert.equal(adapter.validate(item,row,called,live).called,'Candidate D',
 'Provider call is attributed to civicAPI only');
// NH polls close at 01:00Z November 4: the midnight hour is NOT live votes.
const beforeClose=Date.parse('2026-11-04T00:59:59Z');
assert.equal(adapter.validate(item,row,counted,beforeClose),null,
 'No NH votes may be reported before 8 PM local poll close');
const tooEarly={...counted,last_updated:'2026-11-04T00:59:59Z'};
assert.equal(adapter.validate(item,row,tooEarly,live),null,
 'A pre-close source timestamp must not become live after polls close');
const justClosed={...counted,last_updated:'2026-11-04T01:00:00Z'};
assert.equal(adapter.validate(item,row,justClosed,Date.parse('2026-11-04T01:00:00Z'))?.total,1000,
 'Exactly at NH poll closing, genuine matching source counts become eligible');
const noClock={...counted,last_updated:null};
assert.equal(adapter.validate(item,row,noClock,live),null,
 'Positive votes without a provider source publication timestamp are unverified');
const prematureCall={...called,last_updated:'2026-11-04T00:59:59Z'};
assert.equal(adapter.validate(item,row,prematureCall,live),null,
 'Pre-close publication cannot authorize a winner flag');

const unacceptable=[
  edit(counted,'id',99999),
  edit(counted,'province','NV'),
  edit(counted,'election_name','New Hampshire US Senate Primary'),
  edit(counted,'election_date','2024-11-05T05:00:00Z'),
  edit(counted,'district','NH-01'),
  edit(counted,'election_type','Governor'),
  edit(counted,'percent_reporting',101),
  edit(counted,'percent_reporting',-1),
  edit(counted,'percent_reporting',null),
  edit(counted,'last_updated','2026-11-04T04:00:00Z'),
  edit(counted,'last_updated','2026-10-13T12:00:00Z'),
  edit(counted,'candidates',[{...counted.candidates[0],votes:-1},counted.candidates[1]]),
  edit(counted,'candidates',[{...counted.candidates[0],percent:75},counted.candidates[1]]),
  edit(counted,'candidates',[counted.candidates[0],{...counted.candidates[0],name:'candidate d'}]),
  edit(counted,'candidates',[{...counted.candidates[0],winner:true},
    {...counted.candidates[1],winner:true}]),
  edit(zero,'candidates',[{...zero.candidates[0],winner:true},zero.candidates[1]]),
  edit(counted,'candidates',[])
];
for(const detail of unacceptable){
 assert.equal(adapter.validate(item,row,detail,live),null,
   'Invalid provider detail must fail closed: '+JSON.stringify(detail).slice(0,145));
}
assert.equal(adapter.validate({office:'Senate',key:'NV'},row,counted,live),null,
  'Adapter must not silently roll out to other states');
console.log('NH 2026 Senate civicAPI adapter: 30+ isolated source-shape and safety assertions passed');
