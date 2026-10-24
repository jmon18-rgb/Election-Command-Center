#!/usr/bin/env node
'use strict';
// Verify the second FOUR-STATE civicAPI release without fetching or inventing
// real November 2026 vote totals. Every vote count below is test-only.
const assert=require('node:assert/strict');
const adapter=require('./civicapi_state_batch.js');
const now=Date.parse('2026-11-04T06:15:00Z');
const pre=Date.parse('2026-10-13T20:00:00Z');
const cases=[
 ['OH','Senate','OH-special','Ohio US Senate Special',87527],
 ['OH','Governor','OH','Ohio Governor',87365],
 ['WI','Governor','WI','Wisconsin Governor',87491],
 ['NE','Senate','NE','Nebraska US Senate',87254],
 ['NE','Governor','NE','Nebraska Governor',87255],
 ['KS','Senate','KS','Kansas US Senate',87162],
 ['KS','Governor','KS','Kansas Governor',87163]
];
function make(spec){
 const [state,office,key,name,id]=spec;
 const item={office,key},search={
   id,country:'US',province:state,municipality:null,district:null,
   type:office==='Senate'?'US Senate':'Governor',
   election_type:office==='Senate'?'General':'Statewide',
   election_name:name,election_date:'2026-11-03T05:00:00.000Z',
   candidates:[
    {name:state+' Democrat',party:'Democratic',votes:0,percent:0,winner:false},
    {name:state+' Republican',party:'Republican',votes:0,percent:0,winner:false}]
 };
 const detail={
   ...search,election_type:search.type,
   last_updated:'2026-11-04T05:45:00Z',percent_reporting:43,
   candidates:[
    {name:state+' Democrat',party:'Democratic',votes:610,percent:61,winner:false},
    {name:state+' Republican',party:'Republican',votes:390,percent:39,winner:false}]
 };
 return {item,search,detail};
}
const fixtures=cases.map(make);
for(const {item,search,detail} of fixtures){
 assert.equal(adapter.supports(item),true,'Explicitly indexed: '+JSON.stringify(item));
 const url=new URL(adapter.query(item));
 for(const [name,value] of Object.entries({
  country:'US',province:search.province,startDate:'2026-11-03',
  endDate:'2026-11-03',query:item.office==='Senate'?'US Senate':'Governor',
  limit:'20'
 }))assert.equal(url.searchParams.get(name),value,'query '+name);
 assert.equal(adapter.match(item,search),true);
 assert.equal(adapter.select(item,{races:[search],count:1}).id,search.id);
 assert.equal(adapter.select(item,{races:[search,search],count:2}),null);
 assert.equal(adapter.select(item,{races:[],count:0}),null);
 assert.equal(adapter.select(item,{races:[search],count:30}),null);
 assert.equal(adapter.validate(item,search,detail,pre),null,
  'Pre-election fake votes cannot be accepted');
 const empty={...detail,last_updated:null,percent_reporting:0,
  candidates:detail.candidates.map(x=>({...x,votes:0,percent:0}))};
 assert.equal(adapter.validate(item,search,empty,pre).total,0,
   'Indexed does not imply any vote has been reported');
 const result=adapter.validate(item,search,detail,now);
 assert(result,'Expected simulated counting to pass for '+item.key);
 assert.deepEqual({
  provider:result.provider,key:result.key,office:result.office,
  race_id:result.race_id,total:result.total,called:result.called
 },{provider:'civicAPI',key:item.key,office:item.office,
    race_id:search.id,total:1000,called:null});
 assert.equal(result.source_url,'https://civicapi.org/api/v2/race/'+search.id);
 assert.equal(adapter.validate(item,search,{...detail,candidates:[
  {...detail.candidates[0],winner:true},detail.candidates[1]
 ]},now).called,detail.candidates[0].name);
 for(const invalid of [
  {...search,id:search.id+1},
  {...search,id:String(search.id)},
  {...search,election_name:search.election_name+' Primary'},
  {...search,election_name:search.election_name+' Runoff'},
  {...search,election_type:'Primary'},
  {...search,district:search.province+'-01'},
  {...search,municipality:'Downtown'},
  {...search,province:'NH'},
  {...search,election_date:'2026-11-03TRASH'},
  {...search,election_date:'2026-09-08T05:00:00.000Z'}
 ])assert.equal(adapter.match(item,invalid),false,'Invalid search must fail '+item.key);
 for(const invalid of [
  {...detail,id:search.id+99},
  {...detail,district:'OH-01'},
  {...detail,election_name:'Wrong race'},
  {...detail,election_type:'State House'},
  {...detail,province:'NH'},
  {...detail,last_updated:'2026-10-13T12:00:00Z'},
  {...detail,last_updated:'2026-11-04T06:31:00Z'},
  {...detail,percent_reporting:101},
  {...detail,candidates:[{...detail.candidates[0],percent:99},detail.candidates[1]]},
  {...detail,candidates:[{...detail.candidates[0],votes:-1},detail.candidates[1]]},
  {...detail,candidates:[detail.candidates[0],{...detail.candidates[0],name:detail.candidates[0].name.toLowerCase()}]},
  {...detail,candidates:detail.candidates.map(c=>({...c,winner:true}))},
  {...empty,candidates:[{...empty.candidates[0],winner:true},empty.candidates[1]]}
 ])assert.equal(adapter.validate(item,search,invalid,now),null,
  'Invalid provider update must not replace last-good results for '+item.key);
 for(const other of fixtures){
  if(other===fixtures.find(x=>x.search.id===search.id))continue;
  assert.equal(adapter.match(other.item,search),false,
   'Must not cross-feed '+item.key+' into '+other.item.key);
 }
}
for(const missing of [
 {office:'Senate',key:'OH'},
 {office:'Senate',key:'WI'},
 {office:'Senate',key:'NV'},
 {office:'Senate',key:'NY'},
 {office:'House',key:'KS-01'}
]){
 assert.equal(adapter.supports(missing),false,'No unsupported race promoted');
 assert.equal(adapter.query(missing),null);
}
const special=fixtures[0];
assert.equal(adapter.validate({office:'Senate',key:'OH'},special.search,special.detail,now),null);
assert.equal(adapter.validate(special.item,
  {...special.search,election_name:'Ohio US Senate'},
  special.detail,now),null,'OH special must not be matched to regular Senate');
console.log('Second four-state civicAPI batch passed: seven uniquely identified OH/WI/NE/KS races, special Senate isolation and fail-closed totals');
