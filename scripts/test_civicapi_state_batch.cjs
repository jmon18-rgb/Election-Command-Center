#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const adapter=require('./civicapi_state_batch.js');
const election=Date.parse('2026-11-04T06:15:00Z');
const pre=Date.parse('2026-10-13T19:00:00Z');
const cases=[
  ['AK','Senate','Alaska US Senate',86916],
  ['AK','Governor','Alaska Governor',148898],
  ['ME','Senate','Maine US Senate',87188],
  ['ME','Governor','Maine Governor',87189],
  ['MA','Governor','Massachusetts Governor',87276],
  ['NV','Governor','Nevada Governor',87260],
  ['OH','Senate','Ohio US Senate Special',87527],
  ['OH','Governor','Ohio Governor',87365],
  ['WI','Governor','Wisconsin Governor',87491],
  ['NE','Senate','Nebraska US Senate',87254],
  ['NE','Governor','Nebraska Governor',87255],
  ['KS','Senate','Kansas US Senate',87162],
  ['KS','Governor','Kansas Governor',87163],
  // Oct 24 real exact search+detail and direct browser-CORS matches.
  ['MS','Senate','Mississippi US Senate',81004],
  ['HI','Governor','Hawaii Governor',87100],
  ['OK','Governor','Oklahoma Governor',87582]
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
  last_updated:counted?'2026-11-04T05:45:00Z':null,
  candidates:[
    {name:'Candidate A',party:'Democratic',votes:counted?510:0,
       percent:counted?51:0,winner:false},
    {name:'Candidate B',party:'Republican',votes:counted?490:0,
       percent:counted?49:0,winner:false}
  ]};
}
const fixtureRaces=cases.map(([state,office,name,id])=>({
  item:{office,key:state==='OH'&&office==='Senate'?'OH-special':state},
  search:row(state,office,name,id)}));
for(const {item,search} of fixtureRaces){
 assert(adapter.supports(item),JSON.stringify(item));
 assert(adapter.match(item,search),'Expected exact race: '+JSON.stringify(item));
 const request=new URL(adapter.query(item));
 assert.equal(request.hostname,'civicapi.org');
 assert.equal(request.pathname,'/api/v2/race/search');
 assert.equal(request.searchParams.get('province'),search.province,
   'Ohio special uses OH source province but a distinct OH-special watch key');
 assert.equal(request.searchParams.get('query'),item.office==='Senate'?'US Senate':'Governor');
 assert.equal(request.searchParams.get('startDate'),'2026-11-03');
 assert.equal(request.searchParams.get('endDate'),'2026-11-03');
 assert.equal(adapter.select(item,{races:[search]}).id,search.id);
 assert.equal(adapter.select(item,{races:[search,search]}),null,'Two exact matches are unsafe');
 if(item.key==='OH-special'){
  assert.equal(adapter.supports({office:'Senate',key:'OH'}),false,
    'Never infer regular Ohio Senate contest from special source ID');
  assert.equal(adapter.select(item,{races:[{...search,id:search.id+1}]}),null,
    'Ohio special cannot ingest a regular Senate or different race ID');
  assert.equal(adapter.select({office:'Senate',key:'OH'},{races:[search]}),null);
 }
 assert.equal(adapter.select(item,{races:[]}),null,'Unknown is not zero');
 assert.equal(adapter.select(item,{races:[search],count:22}),null,
   'Refuse truncated discovery pages');
 assert.equal(adapter.validate(item,search,detail(search),pre).total,0,
   'Zero pre-election source counts are unreported, not made-up results');
 assert.equal(adapter.validate(item,search,detail(search,true),pre),null,
   'Never accept pre-election counted votes');
 const closing=require('./election_night_poll_closings_2026.js').floorFor(item.key);
 const premature=detail(search,true);
 premature.last_updated=new Date(closing-1000).toISOString();
 assert.equal(adapter.validate(item,search,premature,election),null,
   'Pre-local-close candidate count must remain forbidden AFTER closing');
 assert.equal(adapter.validate(item,search,premature,closing-500),null,
   'Pre-local-close candidate count must remain forbidden while voting');
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
 // A pinned 2026 exact race and plausible candidate votes are still not
 // live evidence when its search response, detail or search envelope says TEST.
 for(const flag of [
  {is_test:true},{test:true},{mock:true},{is_mock:true},
  {active:false},{live:false}
 ]){
  assert.equal(adapter.match(item,{...search,...flag}),false,
   'An explicitly nonproduction race must never pass the search match');
  assert.equal(adapter.select(item,{races:[search],...flag}),null,
   'An explicitly nonproduction response cannot approve a search race');
  assert.equal(adapter.validate(item,search,{...counted,...flag},election),null,
   'An explicitly inactive detail cannot create votes or winner hints');
 }
 assert(adapter.validate(item,search,{...counted,is_test:false,
  active:true,live:true},election),'Explicitly healthy source flags stay valid');
 const duplicateNameAcrossParties={...counted,candidates:[
  {...counted.candidates[0],name:'Same Person'},
  {...counted.candidates[1],name:' same person '}]};
 assert.equal(adapter.validate(item,search,duplicateNameAcrossParties,election),
  null,'Duplicate normalized candidate names cannot be double-counted');
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
  {...search,id:search.id+9},
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
  {...counted,last_updated:'2026-11-04T06:31:00Z'},
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
 {office:'Senate',key:'OH'}, {office:'Senate',key:'WI'},
 {office:'Governor',key:'NH'}]){
 assert.equal(adapter.supports(missing),false);
 assert.equal(adapter.query(missing),null);
}
// Massachusetts Senate remains unindexed; do not borrow its governor ID.
for(const state of ['MA']){
 const missing={office:'Senate',key:state};
 assert.equal(adapter.supports(missing),false,state+' Senate source identity is unresolved');
 assert.equal(adapter.query(missing),null);
 assert.equal(adapter.select(missing,{races:[
  row(state,'Senate',state==='MA'?'Massachusetts US Senate':'Mississippi US Senate',87275)
 ]}),null,'Uncurated MA/MS Senate IDs must never be accepted from fixtures');
 assert.equal(adapter.validate(missing,
  row(state,'Senate','Unverified US Senate',87275),
  detail(row(state,'Senate','Unverified US Senate',87275),true),election),
  null,'Unverified Senate source cannot inject a vote');
}
assert(adapter.supports({office:'Governor',key:'MA'}),
 'Known MA Governor source must remain supported independently');
// The browser has a deliberate strict-adapter allowlist: if a newly pinned
// source isn't added there, it silently falls into the looser generic matcher.
// The two inventories MUST be exactly equal, never merely overlap.
const fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const js=fs.readFileSync(path.join(__dirname,'civicapi_state_batch.js'),'utf8');
const match=html.match(/const enBatchPilotSlots=new Set\((\[[\s\S]*?\])\);/);
assert(match,'The public Election Night page must retain the strict source allowlist');
const browserPins=[...match[1].matchAll(/'((?:Senate|Governor)\|[A-Z]{2}(?:-special)?)'/g)]
 .map(x=>x[1]).sort();
const adapterPins=[...js.matchAll(/'((?:Senate|Governor)\|[A-Z]{2}(?:-special)?)':\{state:/g)]
 .map(x=>x[1]).sort();
assert.equal(new Set(browserPins).size,browserPins.length,
 'The real browser source allowlist cannot duplicate an office');
assert.equal(new Set(adapterPins).size,adapterPins.length,
 'Each independently pinned race needs exactly one adapter configuration');
assert.deepEqual(browserPins,adapterPins,
 'Every source pin must use the strict adapter in the ACTUAL laptop page');
for(const race of browserPins){
 const [office,key]=race.split('|');
 assert(adapter.supports({office,key}),race+' must resolve through strict source adapter');
}
console.log('civicAPI statewide pilot: 16 pinned Senate/governor fixtures, exact identity, state-local close, and vote-shape safety passed');
