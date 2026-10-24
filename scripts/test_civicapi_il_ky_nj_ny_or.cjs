#!/usr/bin/env node
'use strict';
// Source records are real identities; votes below are ONLY synthetic fixtures.
// No provider winner flag is official certification.
const assert=require('node:assert/strict');
const adapter=require('./civicapi_state_batch.js');
const pre=Date.parse('2026-10-13T20:00:00Z');
const live=Date.parse('2026-11-04T06:15:00Z');
const specs=[
 ['IL','Senate',87129,'Illinois US Senate'],
 ['IL','Governor',87130,'Illinois Governor'],
 ['KY','Senate',87174,'Kentucky US Senate'],
 ['NJ','Senate',87302,'New Jersey US Senate'],
 ['NY','Governor',87329,'New York Governor'],
 ['OR','Senate',87374,'Oregon US Senate'],
 ['OR','Governor',87375,'Oregon Governor']
];
function build([state,office,id,name]){
 const item={office,key:state};
 const row={
  id,country:'US',province:state,district:null,municipality:null,
  type:office==='Senate'?'US Senate':'Governor',
  election_type:office==='Senate'?'General':'Statewide',
  election_name:name,election_date:'2026-11-03T05:00:00.000Z',
  candidates:[
   {name:'Candidate D',party:'Democratic',votes:0,percent:0,winner:false},
   {name:'Candidate R',party:'Republican',votes:0,percent:0,winner:false},
   {name:'Candidate I',party:'Independent',votes:0,percent:0,winner:false}
  ]
 };
 const detail={
  ...row,election_type:row.type,
  last_updated:'2026-11-04T05:45:00Z',percent_reporting:48,
  candidates:[
   {...row.candidates[0],votes:500,percent:50},
   {...row.candidates[1],votes:400,percent:40},
   {...row.candidates[2],votes:100,percent:10}
  ]
 };
 return {item,row,detail};
}
const records=specs.map(build);
for(const {item,row,detail} of records){
 assert(adapter.supports(item),'Unexpected missing race '+item.office+' '+item.key);
 const url=new URL(adapter.query(item));
 assert.equal(url.origin,'https://civicapi.org');
 assert.equal(url.pathname,'/api/v2/race/search');
 for(const [k,v] of Object.entries({
  country:'US',province:item.key,
  startDate:'2026-11-03',endDate:'2026-11-03',
  query:item.office==='Senate'?'US Senate':'Governor',limit:'20'
 }))assert.equal(url.searchParams.get(k),v,'Search input '+k);
 assert(adapter.match(item,row));
 assert.equal(adapter.select(item,{races:[row],count:1}).id,row.id);
 assert.equal(adapter.select(item,{races:[row,row],count:2}),null,
  'Multiple plausible matches must remain ambiguous');
 assert.equal(adapter.select(item,{races:[],count:0}),null,'Unindexed is not zero');
 assert.equal(adapter.select(item,{races:[row],count:22}),null,'Truncated index fails closed');
 const empty={...detail,last_updated:null,percent_reporting:0,
  candidates:detail.candidates.map(c=>({...c,votes:0,percent:0}))};
 assert.equal(adapter.validate(item,row,empty,pre).total,0);
 assert.equal(adapter.validate(item,row,detail,pre),null,'No future votes or calls');
 const result=adapter.validate(item,row,detail,live);
 assert(result,'Valid Nov. 3 count rejected: '+item.key+' '+item.office);
 assert.deepEqual({
  office:result.office,key:result.key,provider:result.provider,
  race_id:result.race_id,total:result.total,called:result.called
 },{office:item.office,key:item.key,provider:'civicAPI',race_id:row.id,
    total:1000,called:null});
 assert.equal(result.source_url,'https://civicapi.org/api/v2/race/'+row.id);
 const sourceCall={...detail,candidates:[
  {...detail.candidates[0],winner:true},...detail.candidates.slice(1)]};
 assert.equal(adapter.validate(item,row,sourceCall,live).called,'Candidate D');
 for(const wrongSearch of [
  {...row,id:row.id+1},{...row,id:String(row.id)},
  {...row,province:'NH'},{...row,district:item.key+'-01'},
  {...row,municipality:'County'},{...row,election_name:row.election_name+' Primary'},
  {...row,election_name:row.election_name+' Special'},
  {...row,election_type:'Primary'},
  {...row,election_date:'2026-11-03garbage'},
  {...row,election_date:'2026-09-08T05:00:00.000Z'},
  {...row,type:item.office==='Senate'?'Governor':'US Senate'}
 ])assert.equal(adapter.match(item,wrongSearch),false,
  'Should reject contaminated discovery record in '+item.key);
 for(const wrongDetail of [
  {...detail,id:row.id+1},{...detail,province:'MA'},
  {...detail,election_name:'Another office'},
  {...detail,election_type:'State House'},
  {...detail,election_date:'2024-11-05T05:00:00.000Z'},
  {...detail,district:'IL-01'}, {...detail,percent_reporting:101},
  {...detail,last_updated:'2026-11-04T06:31:00Z'},
  {...detail,last_updated:'2026-10-13T20:00:00Z'},
  {...detail,candidates:[{...detail.candidates[0],votes:-1},...detail.candidates.slice(1)]},
  {...detail,candidates:[{...detail.candidates[0],percent:80},...detail.candidates.slice(1)]},
  {...detail,candidates:[detail.candidates[0],{
    ...detail.candidates[0],name:'candidate d'},detail.candidates[2]]},
  {...detail,candidates:detail.candidates.map(c=>({...c,winner:true}))},
  {...empty,candidates:[{...empty.candidates[0],winner:true},...empty.candidates.slice(1)]}
 ])assert.equal(adapter.validate(item,row,wrongDetail,live),null,
  'Bad provider update must retain last-good source result '+item.key);
 for(const other of records)if(other!==records.find(x=>x.row.id===row.id))
  assert.equal(adapter.match(other.item,row),false,
   'Cannot assign '+item.key+' votes to '+other.item.key);
}
for(const absent of [
 {office:'Senate',key:'NY'}, {office:'Governor',key:'NJ'},
 {office:'Senate',key:'MA'}, {office:'House',key:'OR-01'}
]){
 assert.equal(adapter.supports(absent),false);
 assert.equal(adapter.query(absent),null);
}
console.log('Five-state civicAPI batch passed: 7 independent live-source identities, robust vote and cross-race validation');
