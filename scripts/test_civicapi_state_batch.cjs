#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const adapter=require('./civicapi_state_batch.js');
const election=Date.parse('2026-11-04T03:15:00Z');
const pre=Date.parse('2026-10-13T19:00:00Z');
const cases=[
  ['AK','Senate','Alaska US Senate'],
  ['AK','Governor','Alaska Governor'],
  ['ME','Senate','Maine US Senate'],
  ['ME','Governor','Maine Governor'],
  ['MA','Governor','Massachusetts Governor'],
  ['NV','Governor','Nevada Governor']
];
function row(state,office,name,id){
 return {country:'US',province:state,municipality:null,district:null,
  id,election_date:'2026-11-03T05:00:00.000Z',
  election_name:name,type:office==='Senate'?'US Senate':'Governor',
  election_type:office==='Senate'?'General':'Statewide',
  candidates:[{name:'Candidate A',party:'Democratic',votes:0,percent:0,winner:false},
    {name:'Candidate B',party:'Republican',votes:0,percent:0,winner:false}]};
}
function detail(search,counted=false){
 return {...search,election_type:search.type,percent_reporting:counted?40:0,
  last_updated:counted?'2026-11-04T01:45:00Z':null,
  candidates:[
    {name:'Candidate A',party:'Democratic',votes:counted?510:0,
       percent:counted?51:0,winner:false},
    {name:'Candidate B',party:'Republican',votes:counted?490:0,
       percent:counted?49:0,winner:false}
  ]};
}
const fixtureRaces=cases.map(([state,office,name],i)=>({
  item:{office,key:state},search:row(state,office,name,87400+i)}));
for(const {item,search} of fixtureRaces){
 assert(adapter.supports(item),JSON.stringify(item));
 assert(adapter.match(item,search),'Expected exact race: '+JSON.stringify(item));
 const request=new URL(adapter.query(item));
 assert.equal(request.hostname,'civicapi.org');
 assert.equal(request.pathname,'/api/v2/race/search');
 assert.equal(request.searchParams.get('province'),item.key);
 assert.equal(request.searchParams.get('query'),item.office==='Senate'?'US Senate':'Governor');
 assert.equal(request.searchParams.get('startDate'),'2026-11-03');
 assert.equal(request.searchParams.get('endDate'),'2026-11-03');
 assert.equal(adapter.select(item,{races:[search]}).id,search.id);
 assert.equal(adapter.select(item,{races:[search,search]}),null,'Two exact matches are unsafe');
 assert.equal(adapter.select(item,{races:[]}),null,'Unknown is not zero');
 assert.equal(adapter.select(item,{races:[search],count:22}),null,
   'Refuse truncated discovery pages');
 assert.equal(adapter.validate(item,search,detail(search),pre).total,0,
   'Zero pre-election source counts are unreported, not made-up results');
 assert.equal(adapter.validate(item,search,detail(search,true),pre),null,
   'Never accept pre-election counted votes');
 const counted=detail(search,true);
 const good=adapter.validate(item,search,counted,election);
 assert(good,'Legitimate candidate votes for '+item.key+' '+item.office);
 assert.equal(good.total,1000);
 assert.equal(good.race_id,search.id);
 assert.equal(good.key,item.key);
 assert.equal(good.provider,'civicAPI');
 assert.equal(good.called,null);
 assert.equal(good.source_url,'https://civicapi.org/api/v2/race/'+search.id);
 const called={...counted,candidates:[{...counted.candidates[0],winner:true},counted.candidates[1]]};
 assert.equal(adapter.validate(item,search,called,election).called,'Candidate A');
 const negative={...counted,candidates:[{...counted.candidates[0],votes:-1},counted.candidates[1]]};
 assert.equal(adapter.validate(item,search,negative,election),null);
 const inconsistent={...counted,candidates:[{...counted.candidates[0],percent:90},counted.candidates[1]]};
 assert.equal(adapter.validate(item,search,inconsistent,election),null);
 const duplicates={...counted,candidates:[counted.candidates[0],
  {...counted.candidates[0],name:'candidate a'}]};
 assert.equal(adapter.validate(item,search,duplicates,election),null);
 const doubleCall={...counted,candidates:counted.candidates.map(c=>({...c,winner:true}))};
 assert.equal(adapter.validate(item,search,doubleCall,election),null);
 const emptyCall={...detail(search),candidates:[
  {...detail(search).candidates[0],winner:true},detail(search).candidates[1]]};
 assert.equal(adapter.validate(item,search,emptyCall,election),null);
 for(const invalid of [
  {...search,id:String(search.id)},
  {...search,municipality:'Concord'},
  {...search,district:item.key+'-01'},
  {...search,province:'NH'},
  {...search,election_date:'2026-11-03junk'},
  {...search,election_date:'2026-09-08T05:00:00Z'},
  {...search,election_name:search.election_name+' Primary'},
  {...search,election_name:search.election_name+' Special'},
  {...search,type:item.office==='Senate'?'Governor':'US Senate'},
  {...search,election_type:'Primary'}
 ])assert.equal(adapter.match(item,invalid),false,
  'Wrong office/seat/date cannot match '+JSON.stringify(item));
 for(const invalid of [
  {...counted,id:search.id+100},
  {...counted,province:'NH'},
  {...counted,election_date:'2024-11-05T05:00:00Z'},
  {...counted,election_name:'Other race'},
  {...counted,district:'NH-01'},
  {...counted,election_type:'State House'},
  {...counted,percent_reporting:101},
  {...counted,last_updated:'2026-11-04T04:00:00Z'},
  {...counted,last_updated:'2026-10-15T12:00:00Z'}
 ])assert.equal(adapter.validate(item,search,invalid,election),null,
  'Bad detail must retain last valid source');
 for(const {item:other} of fixtureRaces){
  if(other.office===item.office&&other.key===item.key)continue;
  assert.equal(adapter.match(other,search),false,'Cross-state/office race contamination');
 }
}
for(const missing of [{office:'Senate',key:'NV'},
 {office:'Senate',key:'MA'},
 {office:'Senate',key:'NH'},{office:'House',key:'ME-01'},
 {office:'Governor',key:'WI'},{office:'Governor',key:'NH'}]){
 assert.equal(adapter.supports(missing),false);
 assert.equal(adapter.query(missing),null);
}
console.log('Four-state civicAPI batch: 6 source-verified race fixtures, cross-state isolation and safety checks passed');
