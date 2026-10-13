#!/usr/bin/env node
'use strict';
// Data identities come from the provider; election-night votes below are test
// fixtures only, not published election results.
const assert=require('node:assert/strict');
const adapter=require('./civicapi_state_batch.js');
const specs=[
 ['AL','Senate','Alabama US Senate',86907],
 ['AL','Governor','Alabama Governor',86908],
 ['MT','Senate','Montana US Senate',87247],
 ['NM','Senate','New Mexico US Senate',87288],
 ['NM','Governor','New Mexico Governor',87289],
 ['OK','Senate','Oklahoma US Senate',87526],
 ['TN','Senate','Tennessee US Senate',87475],
 ['TN','Governor','Tennessee Governor',87476]
];
const pre=Date.parse('2026-10-13T20:00:00Z');
const live=Date.parse('2026-11-04T03:00:00Z');
function fixture([key,office,election_name,id]){
 const item={office,key};
 const row={country:'US',province:key,municipality:null,district:null,
   election_name,id,election_date:'2026-11-03T05:00:00.000Z',
   type:office==='Senate'?'US Senate':'Governor',
   election_type:office==='Senate'?'General':'Statewide',
   candidates:[
    {name:'Example Democrat',party:'Democratic',votes:0,percent:0,winner:false},
    {name:'Example Republican',party:'Republican',votes:0,percent:0,winner:false},
    {name:'Independent',party:'Independent',votes:0,percent:0,winner:false}
   ]
 };
 const detail={...row,election_type:row.type,percent_reporting:45,
   last_updated:'2026-11-04T01:30:00Z',
   candidates:[
    {...row.candidates[0],votes:510,percent:51},
    {...row.candidates[1],votes:470,percent:47},
    {...row.candidates[2],votes:20,percent:2}
   ]
 };
 return {item,row,detail};
}
const cases=specs.map(fixture);
for(const {item,row,detail} of cases){
 assert(adapter.supports(item),item.key+' '+item.office);
 const query=new URL(adapter.query(item));
 assert.equal(query.origin,'https://civicapi.org');
 assert.equal(query.pathname,'/api/v2/race/search');
 for(const [field,value] of Object.entries({
  country:'US',province:item.key,startDate:'2026-11-03',
  endDate:'2026-11-03',query:item.office==='Senate'?'US Senate':'Governor',limit:'20'
 }))assert.equal(query.searchParams.get(field),value);
 assert(adapter.match(item,row));
 assert.equal(adapter.select(item,{races:[row],count:1}).id,row.id);
 assert.equal(adapter.select(item,{races:[row,row],count:2}),null,'Ambiguous duplicate source race');
 assert.equal(adapter.select(item,{races:[],count:0}),null,'Not indexed != zero votes');
 assert.equal(adapter.select(item,{races:[row],count:21}),null,'Truncated search index');
 const empty={...detail,percent_reporting:0,last_updated:null,
   candidates:detail.candidates.map(c=>({...c,votes:0,percent:0}))};
 assert.equal(adapter.validate(item,row,empty,pre).total,0);
 assert.equal(adapter.validate(item,row,detail,pre),null,
  'Pre-election counted votes are impossible');
 const good=adapter.validate(item,row,detail,live);
 assert(good,item.key+' expected valid post-election simulated detail');
 assert.deepEqual({provider:good.provider,office:good.office,key:good.key,
   race_id:good.race_id,total:good.total,called:good.called},
  {provider:'civicAPI',office:item.office,key:item.key,
   race_id:row.id,total:1000,called:null});
 assert.equal(good.source_url,'https://civicapi.org/api/v2/race/'+row.id);
 const called={...detail,candidates:[{...detail.candidates[0],winner:true},
  ...detail.candidates.slice(1)]};
 assert.equal(adapter.validate(item,row,called,live).called,'Example Democrat');
 for(const bad of [
  {...row,id:row.id+1}, {...row,id:String(row.id)},
  {...row,election_name:row.election_name+' Special'},
  {...row,election_name:row.election_name+' Primary'},
  {...row,election_type:'Primary'}, {...row,province:'NH'},
  {...row,district:item.key+'-01'}, {...row,municipality:'County'},
  {...row,election_date:'2026-11-03oops'},
  {...row,election_date:'2026-09-08T05:00:00.000Z'},
  {...row,type:item.office==='Senate'?'Governor':'US Senate'}
 ])assert.equal(adapter.match(item,bad),false,'Invalid identity: '+item.key);
 for(const bad of [
  {...detail,id:row.id+1}, {...detail,province:'NH'},
  {...detail,election_name:'Wrong race'}, {...detail,election_type:'State House'},
  {...detail,election_date:'2024-11-05T05:00:00Z'},
  {...detail,percent_reporting:101}, {...detail,district:'NM-01'},
  {...detail,last_updated:'2026-11-04T03:30:00Z'},
  {...detail,last_updated:'2026-10-13T20:00:00Z'},
  {...detail,candidates:[{...detail.candidates[0],votes:-2},...detail.candidates.slice(1)]},
  {...detail,candidates:[{...detail.candidates[0],percent:88},...detail.candidates.slice(1)]},
  {...detail,candidates:[detail.candidates[0],
   {...detail.candidates[0],name:'example democrat'},detail.candidates[2]]},
  {...detail,candidates:detail.candidates.map(c=>({...c,winner:true}))},
  {...empty,candidates:[{...empty.candidates[0],winner:true},...empty.candidates.slice(1)]}
 ])assert.equal(adapter.validate(item,row,bad,live),null,
   'Invalid provider detail must fail closed: '+item.key);
 for(const other of cases)if(other!==cases.find(x=>x.row.id===row.id))
  assert.equal(adapter.match(other.item,row),false,'No cross-state/office results');
}
for(const omitted of [
 {office:'Governor',key:'OK'}, // Not an exact Statewide contract in source discovery
 {office:'Governor',key:'MT'}, // No 2026 Montana governor contest
 {office:'Senate',key:'NV'}, {office:'House',key:'AL-01'},
 {office:'Senate',key:'OH'} // Keep special election isolated
]){
 assert.equal(adapter.supports(omitted),false);
 assert.equal(adapter.query(omitted),null);
}
console.log('Five-state source-verified pilot: eight AL/MT/NM/OK/TN statewide races and fail-closed tests passed');
