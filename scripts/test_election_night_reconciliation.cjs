#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const api=require('./election_night_reconciliation.js');
const now=Date.parse('2026-11-04T03:15:00Z');
const counts={AL:7,AK:1,AZ:9,AR:4,CA:52,CO:8,CT:5,DE:1,FL:28,
GA:14,HI:2,ID:2,IL:17,IN:9,IA:4,KS:4,KY:6,LA:6,ME:2,MD:8,
MA:9,MI:13,MN:8,MS:4,MO:8,MT:2,NE:3,NV:4,NH:2,NJ:12,NM:3,
NY:26,NC:14,ND:1,OH:15,OK:5,OR:6,PA:17,RI:2,SC:7,SD:1,TN:9,
TX:38,UT:4,VT:1,VA:11,WA:10,WV:2,WI:8,WY:1};
const house=api.houseIds(counts);
assert.equal(house.length,435);
assert(house.includes('AK-00')&&!house.includes('AK-01'));
const senateStates='AL AK AR CO DE FL GA ID IA IL KS KY LA MA ME MI MN MS MT NC NE NH NJ NM OH OK OR RI SC SD TN TX VA WV WY'.split(' ');
assert.equal(senateStates.length,35);
const senate=senateStates.map(st=>({key:st+(st==='FL'||st==='OH'?'-special':'')}));
assert.equal(api.senateIds(senate).length,35);
const snapshot=(office,races)=>({year:2026,office,source:'state',stale:false,
 as_of:'2026-11-04T02:50:00Z',races});
const votes=n=>({total:n,called:false,winner:'',cands:[{n:'D',p:'D',v:n}]});
const civic={provider:'civicAPI',office:'Senate',key:'ME',race_id:7421,
 total:1000,called:'Jane Democrat',last_updated:'2026-11-04T02:52:00Z',
 candidates:[{name:'Jane Democrat',party:'D',votes:700},
  {name:'Other',party:'R',votes:300}]};
const input={houseCounts:counts,senateSeats:senate,
 snapshots:{House:snapshot('House',{'TX-01':votes(123),'AK-00':votes(0)}),
  Senate:snapshot('Senate',{'NC':votes(900)})},
 civic:{'Senate|ME':civic},supportedStates:['TX','AK','NC'],now};
let x=api.reconcile(input);
assert.equal(x.house.total,435);assert.equal(x.senate.total,35);
assert.equal(x.house.reported,1);assert.equal(x.senate.reported,2);
assert.equal(x.house.noVotes,1);assert.equal(x.house.noValidCount,433);
assert.equal(x.senate.primary,1);assert.equal(x.senate.supplemental,1);
assert.equal(x.providerCalls,1);assert.equal(x.authoritativeCalls,0);
assert.equal(x.chambersCalled,false);assert.equal(x.senateHoldoversInUniverse,65);
const overlapping={...input,civic:{...input.civic,
 'Senate|NC':{...civic,key:'NC'}}};
x=api.reconcile(overlapping);
assert.equal(x.senate.reported,2,'Do not double-count source-covered races');
assert(x.anomalies.some(s=>s.includes('Blocked overlapping secondary')));
x=api.reconcile({...input,restored:['Senate']});
assert.equal(x.senate.primary,0,'Restored unrefreshed snapshots are not current reporting');
x=api.reconcile({...input,errors:{Senate:true}});
assert.equal(x.senate.primary,0,'Unavailable source keeps historical records but not valid live coverage');
x=api.reconcile({...input,now:Date.parse('2026-11-04T07:30:00Z')});
assert.equal(x.house.reported,0,'Stale sources cannot claim live counts');
assert.equal(x.providerCalls,0);
x=api.reconcile({...input,civic:{'Senate|ME':{...civic,key:'NH'}}});
assert.equal(x.senate.supplemental,0,'Wrong race identity must fail closed');
assert.throws(()=>api.houseIds({MA:9}),/435/);
assert.throws(()=>api.senateIds(senate.slice(1)),/35/);
console.log('Election-night 435/35 coverage, data freshness, duplicate, stale and provider-call reconciliation PASS');
