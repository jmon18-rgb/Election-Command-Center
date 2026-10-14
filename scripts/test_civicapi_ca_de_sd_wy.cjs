#!/usr/bin/env node
'use strict';
// Real civicAPI IDs; all sample vote totals are synthetic unit fixtures.
const assert=require('node:assert/strict');
const adapter=require('./civicapi_state_batch.js');
const specs=[
 ['CA','Governor','California Governor',86952],
 ['DE','Senate','Delaware US Senate',87036],
 ['SD','Senate','South Dakota US Senate',87446],
 ['SD','Governor','South Dakota Governor',87447],
 ['WY','Senate','Wyoming US Senate',87496],
 ['WY','Governor','Wyoming Governor',87497],
 ['MD','Governor','Maryland Governor',87198]
];
const pre=Date.parse('2026-10-13T20:00:00Z');
const night=Date.parse('2026-11-04T03:00:00Z');
function fixture([key,office,name,id]){
 const item={key,office};
 const row={
  country:'US',province:key,municipality:null,district:null,id,
  election_date:'2026-11-03T05:00:00.000Z',election_name:name,
  type:office==='Senate'?'US Senate':'Governor',
  election_type:office==='Senate'?'General':'Statewide',
  candidates:[
   {name:'First Democrat',party:'Democratic',votes:0,percent:0,winner:false},
   {name:'Second Republican',party:'Republican',votes:0,percent:0,winner:false}
  ]
 };
 const detail={...row,election_type:row.type,percent_reporting:40,
  last_updated:'2026-11-04T01:30:00Z',
  candidates:[
   {...row.candidates[0],votes:520,percent:52},
   {...row.candidates[1],votes:480,percent:48}
  ]
 };
 return {item,row,detail};
}
const fixtures=specs.map(fixture);
for(const {item,row,detail} of fixtures){
 assert.equal(adapter.supports(item),true,'Supported race: '+JSON.stringify(item));
 const url=new URL(adapter.query(item));
 assert.equal(url.origin,'https://civicapi.org');
 assert.equal(url.pathname,'/api/v2/race/search');
 for(const [k,v] of Object.entries({
  country:'US',province:item.key,startDate:'2026-11-03',
  endDate:'2026-11-03',query:item.office==='Senate'?'US Senate':'Governor',limit:'20'
 }))assert.equal(url.searchParams.get(k),v);
 assert(adapter.match(item,row));
 assert.equal(adapter.select(item,{races:[row],count:1}).id,row.id);
 assert.equal(adapter.select(item,{races:[row,row],count:2}),null);
 assert.equal(adapter.select(item,{races:[row],count:25}),null);
 assert.equal(adapter.select(item,{races:[],count:0}),null);
 const zero={...detail,percent_reporting:0,last_updated:null,candidates:
  detail.candidates.map(c=>({...c,votes:0,percent:0}))};
 assert.equal(adapter.validate(item,row,zero,pre).total,0);
 assert.equal(adapter.validate(item,row,detail,pre),null,'No pre-election votes');
 const valid=adapter.validate(item,row,detail,night);
 assert(valid,'Valid mock update should be accepted');
 assert.deepEqual({office:valid.office,key:valid.key,provider:valid.provider,
   race_id:valid.race_id,total:valid.total,called:valid.called},
  {office:item.office,key:item.key,provider:'civicAPI',race_id:row.id,total:1000,called:null});
 assert.equal(valid.source_url,'https://civicapi.org/api/v2/race/'+row.id);
 const call={...detail,candidates:[{...detail.candidates[0],winner:true},detail.candidates[1]]};
 assert.equal(adapter.validate(item,row,call,night).called,'First Democrat');
 for(const invalid of [
  {...row,id:row.id+1},{...row,id:String(row.id)},
  {...row,province:'NH'}, {...row,district:'CA-01'},
  {...row,election_name:row.election_name+' Special'},
  {...row,election_name:row.election_name+' Primary'},
  {...row,election_type:'Primary'},
  {...row,municipality:'City'},
  {...row,election_date:'2026-11-03invalid'},
  {...row,election_date:'2026-09-08T05:00:00.000Z'},
  {...row,type:row.type==='Governor'?'US Senate':'Governor'}
 ])assert.equal(adapter.match(item,invalid),false,
   'Contaminated identity was accepted: '+JSON.stringify(item));
 for(const invalid of [
  {...detail,id:row.id+1},{...detail,province:'OH'},
  {...detail,election_name:'Another race'},{...detail,election_type:'State House'},
  {...detail,election_date:'2024-11-05T05:00:00.000Z'},
  {...detail,district:'CA-01'},{...detail,percent_reporting:105},
  {...detail,last_updated:'2026-11-04T03:30:00Z'},
  {...detail,last_updated:'2026-10-13T20:00:00Z'},
  {...detail,candidates:[{...detail.candidates[0],votes:-1},detail.candidates[1]]},
  {...detail,candidates:[{...detail.candidates[0],percent:83},detail.candidates[1]]},
  {...detail,candidates:[detail.candidates[0],
    {...detail.candidates[0],name:'first democrat'}]},
  {...detail,candidates:detail.candidates.map(c=>({...c,winner:true}))},
  {...zero,candidates:[{...zero.candidates[0],winner:true},zero.candidates[1]]}
 ])assert.equal(adapter.validate(item,row,invalid,night),null,
   'Invalid provider update must never overwrite last good state');
 for(const other of fixtures)if(other.row.id!==row.id)
  assert.equal(adapter.match(other.item,row),false,
    'No cross-office or cross-state vote attribution');
}
for(const omitted of [
 {office:'Senate',key:'MS'},
 {office:'Senate',key:'CA'},
 {office:'Governor',key:'DE'},
 {office:'Senate',key:'OH'}, // Ohio special uses a separate key.
 {office:'House',key:'SD-01'}
]){
 assert.equal(adapter.supports(omitted),false);
 assert.equal(adapter.query(omitted),null);
}
console.log('CA / DE / SD / WY strict civicAPI: 6 real source IDs, synthetic counts and safety cases passed');
