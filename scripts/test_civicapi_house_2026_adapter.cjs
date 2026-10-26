#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const api=require('./civicapi_house_2026_adapter.js');
const now=Date.parse('2026-11-04T03:00:00Z');
const item={office:'House',key:'NH-01'};
const search={country:'US',province:'NH',municipality:null,district:'NH-01',
 id:88001,election_date:'2026-11-03T05:00:00.000Z',
 election_name:'New Hampshire US House 1',type:'House of Representatives',
 election_type:'General',candidates:[]};
const detail={...search,election_type:search.type,
 percent_reporting:62,last_updated:'2026-11-04T02:40:00Z',
 candidates:[
  {name:'Example Democrat',party:'Democratic',votes:510,percent:51,winner:false},
  {name:'Example Republican',party:'Republican',votes:490,percent:49,winner:false}
 ]};
assert(api.supports(item));
for(const code of ['ME-02','NV-03','NY-17','NE-02','WI-03']){
 assert(api.supports({office:'House',key:code}),code);
}
for(const x of [{office:'House',key:'NH-1'},{office:'Senate',key:'NH'},
 {office:'House',key:'NH-99'},{office:'House',key:'NH-03'},
 {office:'House',key:'CA-53'},{office:'House',key:'NH-00'},
 {office:'House',key:'AK-01'},{office:'House',key:'NO-01'},null]){
 assert(!api.supports(x),JSON.stringify(x));
}
assert(api.match(item,search));
const q=new URL(api.query(item));
assert.equal(q.hostname,'civicapi.org');
assert.equal(q.pathname,'/api/v2/race/search');
assert.equal(q.searchParams.get('query'),'US House 1');
assert.equal(q.searchParams.get('startDate'),'2026-11-03');
assert.equal(q.searchParams.get('endDate'),'2026-11-03');
assert.equal(q.searchParams.get('province'),'NH');
assert.equal(api.select(item,{races:[search]}).id,88001);
assert.equal(api.select(item,{races:[]}),null);
assert.equal(api.select(item,{races:[search,search]}),null,
 'Duplicate exact district results are unsafe');
assert.equal(api.select(item,{count:30,races:[search]}),null);
assert.equal(api.select(item,{count:1,races:[search]}).id,88001);
assert.equal(api.select(item,{count:2,races:[search]}),null,
 'Incomplete provider result page cannot establish a unique 2026 House ID');
for(const wrongCount of [-1,0,1.5,'1',true,NaN,Infinity]){
 assert.equal(api.select(item,{count:wrongCount,races:[search]}),null,
  'Malformed source cardinality must not authorize an exact House ID');
}
assert.equal(api.select(item,{count:0,races:[]}),null);
const good=api.validate(item,search,detail,now);
assert(good);
assert.equal(good.key,'NH-01');
assert.equal(good.total,1000);
assert.equal(good.called,null);
assert.equal(good.race_id,88001);
assert.equal(good.provider,'civicAPI');
assert.equal(good.candidates[0].party,'D');
assert.equal(good.source_url,'https://civicapi.org/api/v2/race/88001');
const called={...detail,candidates:detail.candidates.map((c,i)=>({...c,winner:i===0}))};
assert.equal(api.validate(item,search,called,now).called,'Example Democrat');
// Genuine 2026 House returns must be stamped after their local earliest
// polling close, even if the nationwide 05:00Z Nov 3 floor has passed.
const pollCloses=require('./election_night_poll_closings_2026.js');
const close=pollCloses.floorFor(item.key);
const premature={...detail,last_updated:new Date(close-1000).toISOString()};
assert.equal(api.validate(item,search,premature,now),null,
 'Before-poll-close House totals must never be validated after close');
assert.equal(api.validate(item,search,detail,close-1000),null,
 'Viewer clock cannot accept House votes while district polls remain open');
for(const flag of [
 {test_data:true},{is_test:true},{test:true},{mock:true},{is_mock:true},
 {active:false},{live:false}
]){
 assert.equal(api.match(item,{...search,...flag}),false);
 assert.equal(api.select(item,{races:[search],...flag}),null);
 assert.equal(api.validate(item,search,{...detail,...flag},now),null);
 assert.equal(api.validatePinned(item,88001,{...detail,...flag},now),null);
}
assert(api.validate(item,search,{...detail,is_test:false,active:true},now));
assert.equal(api.validate(item,search,{...detail,candidates:[
 {...detail.candidates[0],name:'Same Candidate'},
 {...detail.candidates[1],name:' same candidate '}]},now),null,
 'Same candidate duplicated under another party is not two people');
assert.equal(api.validate(item,search,detail,Date.parse('2026-10-15T20:00:00Z')),null,
 'Pre-election vote totals must be rejected');
const pre={...detail,candidates:detail.candidates.map(c=>({...c,votes:0,percent:0})),
 last_updated:null,percent_reporting:0};
assert.equal(api.validate(item,search,pre,Date.parse('2026-10-15T20:00:00Z')).total,0,
 'Empty pre-election discovery is allowed and is not a vote');
for(const wrong of [
 {...search,district:'NH-02'}, {...search,province:'ME'},
 {...search,municipality:'Nashua'}, {...search,election_type:'Primary'},
 {...search,type:'US Senate'}, {...search,election_date:'2026-11-03junk'},
 {...search,election_date:'2024-11-05T05:00:00.000Z'},
 {...search,election_name:'New Hampshire US House 1 Primary'},
 {...search,election_name:'New Hampshire US House 2'},
 {...search,id:0}, {...search,id:'88001'}
]){
 assert.equal(api.match(item,wrong),false,'Wrong House identity: '+JSON.stringify(wrong));
}
for(const bad of [
 {...detail,id:88002}, {...detail,province:'ME'},
 {...detail,district:'NH-02'}, {...detail,election_date:'2024-11-05T05:00:00Z'},
 {...detail,election_type:'US Senate'}, {...detail,percent_reporting:110},
 {...detail,last_updated:null}, {...detail,last_updated:'2026-11-04T04:00:00Z'},
 {...detail,last_updated:'2026-10-15T00:00:00Z'},
 {...detail,candidates:detail.candidates.map(c=>({...c,votes:-1}))},
 {...detail,candidates:[detail.candidates[0],{...detail.candidates[0]}]},
 {...detail,candidates:detail.candidates.map(c=>({...c,winner:true}))},
 {...detail,candidates:detail.candidates.map((c,i)=>({...c,percent:i?99:1}))},
 {...detail,candidates:detail.candidates.map((c,i)=>({...c,percent:i?0:100}))}
]){
 assert.equal(api.validate(item,search,bad,now),null,
  'Malformed source record must not produce a vote: '+JSON.stringify(bad));
}
assert.equal(api.validate(item,search,{...detail,candidates:[
 {...detail.candidates[0],winner:true,votes:0,percent:0},
 {...detail.candidates[1],votes:1000,percent:100}]},now),null,
 'A winner must have counted votes');
assert.equal(api.validate(item,search,{...detail,candidates:[
 {...detail.candidates[0],winner:true},
 {...detail.candidates[1],winner:true}]},now),null);
const itemAtLarge={office:'House',key:'AK-00'};
assert(api.supports(itemAtLarge));
const alaska={...search,province:'AK',district:'AK-00',
 election_name:'Alaska US House At-Large'};
assert(api.match(itemAtLarge,alaska));
const akDetail={...detail,...alaska,election_type:'House of Representatives',
 last_updated:'2026-11-04T06:05:00Z',candidates:detail.candidates};
assert.equal(api.validate(itemAtLarge,alaska,akDetail,now),null,
 'AK at-large votes stamped after polls close cannot be seen before 8 PM local');
assert.equal(api.validate(itemAtLarge,alaska,akDetail,
 Date.parse('2026-11-04T06:15:00Z')).key,'AK-00');
assert.equal(new URL(api.query(itemAtLarge)).searchParams.get('query'),'US House');
// Texas has staggered closings. Count partial votes after the earliest
// close but reject statewide/district winner flags before the final close.
const txItem={office:'House',key:'TX-16'};
const txRow={...search,province:'TX',district:'TX-16',
 election_name:'Texas US House 16'};
const txSource={...detail,...txRow,election_type:'House of Representatives',
 last_updated:'2026-11-04T01:10:00Z',candidates:detail.candidates};
assert(api.validate(txItem,txRow,txSource,now),
 'Partially counted House votes may report after earliest local close');
const txPrematureCall=api.validate(txItem,txRow,{...txSource,candidates:
 txSource.candidates.map((c,i)=>({...c,winner:i===0}))},now);
assert.equal(txPrematureCall?.total,1000,
 'An early winner flag must not discard legitimate counted House votes');
assert.equal(txPrematureCall?.called,null,
 'Do not publish House winner hints before the final applicable close');
const prematurelyTimestampedFinal={...txSource,last_updated:'2026-11-04T02:10:00Z',
 candidates:txSource.candidates.map((c,i)=>({...c,winner:i===0}))};
const preFinalObserver=api.validate(txItem,txRow,prematurelyTimestampedFinal,
 Date.parse('2026-11-04T01:59:59Z'));
assert.equal(preFinalObserver?.called,null,
 'Future-skew tolerance may preserve partial votes but never permit a call before final closure');
assert.equal(preFinalObserver?.total,1000);
const txAfterFinal={...txSource,last_updated:'2026-11-04T02:10:00Z',
 candidates:txSource.candidates.map((c,i)=>({...c,winner:i===0}))};
assert.equal(api.validate(txItem,txRow,txAfterFinal,now).called,'Example Democrat');
// The compact identity manifest is a lookup shortcut, not a valid result.
const manifestNow=Date.parse('2026-11-03T20:00:00Z');
const makeManifest=()=>({
 schema_version:'1.0',status:'VERIFIED_HOUSE_IDENTITIES_NOT_LIVE_RESULTS',
 election:'2026-11-03',generated_at:'2026-11-03T18:00:00Z',
 races:[{district:'NH-01',race_id:88001,checked_window_utc:'2026-11-02T16:00:00Z'}]
});
assert.equal(api.pinnedId(item),null);
assert.equal(api.setManifest({...makeManifest(),status:'LIVE_RESULTS'},manifestNow),false);
assert.equal(api.setManifest({...makeManifest(),generated_at:'2024-11-03T20:00:00Z'},manifestNow),false);
assert.equal(api.setManifest({...makeManifest(),races:[
 {...makeManifest().races[0]},{...makeManifest().races[0]}]},manifestNow),false);
assert.equal(api.setManifest({...makeManifest(),races:[
 {district:'NH-99',race_id:88001,checked_window_utc:'2026-11-02T16:00:00Z'}]},manifestNow),false);
assert.equal(api.setManifest({...makeManifest(),races:[
 {district:'NH-01',race_id:88001,checked_window_utc:'2026-10-16T16:00:00Z'}]},manifestNow),false);
assert.equal(api.setManifest(makeManifest(),manifestNow),true);
assert.equal(api.pinnedId(item),88001);
assert.equal(api.pinnedId({office:'House',key:'NH-02'}),null);
assert.equal(api.validatePinned(item,88001,detail,now).total,1000);
assert.equal(api.validatePinned(item,88002,detail,now),null);
assert.equal(api.validatePinned(item,88001,{...detail,id:88002},now),null);
assert.equal(api.validatePinned(item,88001,{...detail,election_type:'US Senate'},now),null);
assert.equal(api.validatePinned(item,88001,{...detail,election_date:'2024-11-05T05:00:00Z'},now),null);
assert.equal(api.validatePinned(item,88001,{...detail,district:'NH-02'},now),null);
assert.equal(api.validatePinned(item,88001,{...detail,province:'ME'},now),null);
assert.equal(api.validatePinned(item,88001,{...detail,candidates:[
 {...detail.candidates[0],votes:900,percent:90},
 {...detail.candidates[1],votes:500,percent:50}]},now),null);
assert.equal(api.validatePinned(item,88001,detail,Date.parse('2026-10-16T19:00:00Z')),null);
assert.equal(api.validatePinned(item,88001,{
 ...pre,id:88001,election_type:'House of Representatives'},Date.parse('2026-10-16T19:00:00Z')).total,0,
 'Before polls close, a source-matched ID only carries zero-vote standby data');
assert.equal(api.setManifest({...makeManifest(),races:[]},manifestNow),true);
assert.equal(api.pinnedId(item),null,'A newer empty manifest revokes old shortcuts');
// KY-06 early-indicator regression: the pinned 87173 shortcut is only usable
// with an independently validated Kentucky 6th District general-election detail.
const kyItem={office:'House',key:'KY-06'};
const kyRow={...search,id:87173,province:'KY',district:'KY-06',
 election_name:'Kentucky US House 6'};
const kyDetail={...detail,...kyRow,election_type:'House of Representatives',
 candidates:detail.candidates};
const kyManifest={...makeManifest(),races:[
 {district:'KY-06',race_id:87173,checked_window_utc:'2026-11-02T16:00:00Z'}]};
assert.equal(api.supports(kyItem),true);
assert.equal(api.match(kyItem,kyRow),true);
assert.equal(api.select(kyItem,{races:[kyRow]}).id,87173);
assert.equal(api.setManifest(kyManifest,manifestNow),true);
assert.equal(api.pinnedId(kyItem),87173);
assert.equal(api.validatePinned(kyItem,87173,kyDetail,now).total,1000);
for(const wrong of [
 {...kyDetail,id:87174},
 {...kyDetail,district:'KY-05'},
 {...kyDetail,province:'IN'},
 {...kyDetail,election_name:'Kentucky US House 5'},
 {...kyDetail,election_date:'2024-11-05T05:00:00Z'}
]){
 assert.equal(api.validatePinned(kyItem,87173,wrong,now),null,
  'KY-06 must reject mismatched detail: '+JSON.stringify(wrong));
}
assert.equal(api.validatePinned(kyItem,87173,kyDetail,
 Date.parse('2026-10-23T15:00:00Z')),null,
 'KY-06 cannot report any 2026 votes before Election Night');
assert.equal(api.validatePinned(kyItem,87173,{
 ...kyDetail,candidates:pre.candidates,percent_reporting:0,last_updated:null
},Date.parse('2026-10-23T15:00:00Z')).total,0);
// The seven remaining missing 2026 House source identities might be indexed
// under alternative congressional office names. The browser may search only
// those seven with a bounded request list, while validation remains exact.
const aliases=[
 ['AK-00','Alaska Representative in Congress At-Large'],
 ['DE-00','Delaware U.S. Representative At-Large'],
 ['ND-00','North Dakota Representative in Congress'],
 ['NH-01','New Hampshire Representative in Congress District 1'],
 ['NH-02','New Hampshire U.S. Representative 2'],
 ['SD-00','South Dakota Representative in Congress'],
 ['WY-00','Wyoming U.S. Representative At Large']
];
for(const [key,name] of aliases){
 const candidate={office:'House',key};
 const urls=api.queries(candidate);
 assert.equal(urls.length,3,key+' gets exactly two extra source searches');
 assert.equal(new URL(urls[0]).searchParams.get('query'),
  'US House'+(key.endsWith('-00')?'':' '+Number(key.slice(3))));
 assert.equal(new URL(urls[1]).searchParams.get('query'),'Representative in Congress');
 assert.equal(new URL(urls[2]).searchParams.get('query'),'U.S. Representative');
 assert(urls.every(url=>{
  const u=new URL(url);
  return u.origin==='https://civicapi.org'&&
   u.searchParams.get('province')===key.slice(0,2)&&
   u.searchParams.get('startDate')==='2026-11-03'&&
   u.searchParams.get('endDate')==='2026-11-03'&&u.searchParams.get('limit')==='20';
 }));
 const row={...search,province:key.slice(0,2),district:key,
  election_name:name,id:88500+aliases.findIndex(x=>x[0]===key)};
 assert(api.match(candidate,row),key+' must accept exact alternative office name');
 assert.equal(api.select(candidate,{count:1,races:[row]})?.id,row.id);
 const zeroDetail={...detail,...row,election_type:'House of Representatives',
  candidates:pre.candidates,percent_reporting:0,last_updated:null};
 const parsed=api.validate(candidate,row,zeroDetail,Date.parse('2026-10-25T13:00:00Z'));
 assert.equal(parsed?.total,0,key+' source identity must not create votes before election');
 assert.equal(api.match(candidate,{...row,district:'NH-99'}),false);
 assert.equal(api.match(candidate,{...row,province:'CA'}),false);
 assert.equal(api.match(candidate,{...row,election_date:'2024-11-05'}),false);
 assert.equal(api.match(candidate,{...row,election_type:'Primary'}),false);
 assert.equal(api.match(candidate,{...row,election_name:name+' Primary'}),false);
 assert.equal(api.match(candidate,{...row,election_name:'Representative for Congress'}),false);
 assert.equal(api.select(candidate,{count:2,races:[row]}),null,
  'An incomplete alias search cannot establish a unique identity');
 assert.equal(api.select(candidate,{count:2,races:[row,row]}),null,
  'Duplicate exact alias identities remain ambiguous');
 if(!key.endsWith('-00'))
  assert.equal(api.match(candidate,{...row,election_name:name.replace(/[12]$/, '99')}),false);
}
assert.equal(api.queries({office:'House',key:'KY-06'}).length,1,
 'Previously identified House districts must not add provider traffic');
assert.deepEqual(api.queries({office:'House',key:'NH-03'}),[]);
assert.equal(api.queries(null).length,0);
assert.equal(api.match({office:'House',key:'KY-06'},
 {...kyRow,election_name:'Kentucky Representative in Congress District 6'}),false,
 'Alternate title expansion is restricted to seven source gaps');

console.log('2026 supplemental House district source identity, arithmetic, CORS-safe query and failure cases PASS');
