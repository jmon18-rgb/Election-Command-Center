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
// Office source health must be the same for UI labels and coverage arithmetic.
const health=(snapshot,office='Senate',opts={})=>
 api.officeHealth(snapshot,office,{now,...opts});
assert.equal(health(input.snapshots.Senate).state,'reporting');
assert.equal(health(input.snapshots.House,'House').state,'reporting');
assert.equal(health(input.snapshots.Senate,'Governor').state,'invalid');
assert.equal(health(input.snapshots.Senate,'Senate',{error:true}).state,'outage');
assert.equal(health(input.snapshots.Senate,'Senate',{restored:true}).state,'rechecking');
assert.equal(health(null).state,'missing');
assert.equal(health({...input.snapshots.Senate,live:false,
 as_of:'2026-11-03T23:00:00Z'}).state,'stale',
 'A non-live old snapshot is STILL stale; not a validated office feed');
assert.equal(health({...input.snapshots.Senate,stale:true}).usable,false);
assert.equal(health({...input.snapshots.Senate,as_of:'2026-11-04T05:00:00Z'}).state,'invalid');
assert.equal(health({...input.snapshots.Senate,as_of:null}).state,'invalid',
 'Never count reported votes without a date');
assert.equal(health({...input.snapshots.Senate,as_of:null,races:{},live:false,
 counting:false}).state,'standby','Zero-vote startup is standby, not an outage');
assert.equal(health({...input.snapshots.Senate,
 as_of:'2026-10-15T18:00:00Z',races:{},live:false,counting:false}).state,'standby');
assert.equal(health({...input.snapshots.Senate,as_of:null,races:{NC:votes(1)}}).usable,false);
assert.equal(health({...input.snapshots.Senate,races:{}}).state,'current_no_votes');
assert.equal(health(input.snapshots.Senate).usable,true);
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
// Cross-provider comparisons are advisory, constrained to near-synchronous
// similar-completeness exact races. They never duplicate vote coverage/calls.
const nearPrimary=snapshot('Senate',{'NC':{total:2400,called:false,winner:'',
 cands:[{n:'D',p:'D',v:1000},{n:'R',p:'R',v:1400}]}});
const nearCivic={...civic,key:'NC',total:2400,called:'Jane Democrat',
 candidates:[{name:'Jane Democrat',party:'D',votes:1450},
  {name:'Other',party:'R',votes:950}]};
x=api.reconcile({...input,snapshots:{...input.snapshots,Senate:nearPrimary},
 civic:{'Senate|NC':nearCivic}});
assert.equal(x.senate.primary,1);
assert.equal(x.senate.supplemental,0);
assert.equal(x.providerCalls,0,'Overlapping civic winner never becomes a chamber call');
assert.equal(x.crossSourceDiscrepancies.length,1);
assert.equal(x.crossSourceDiscrepancies[0].id,'Senate|NC');
assert.equal(x.crossSourceDiscrepancies[0].primaryLead,'R');
assert.equal(x.crossSourceDiscrepancies[0].supplementalLead,'D');
assert(x.anomalies.some(s=>s.includes('opposite major-party leads Senate|NC')));
const later={...nearCivic,last_updated:'2026-11-04T01:00:00Z'};
x=api.reconcile({...input,snapshots:{...input.snapshots,Senate:nearPrimary},
 civic:{'Senate|NC':later}});
assert.equal(x.crossSourceDiscrepancies.length,0,
 'Reporting timestamps too far apart are not directly comparable');
const malformed={...civic,total:100,candidates:[{name:'Jane Democrat',party:'D',votes:700}]};
x=api.reconcile({...input,civic:{'Senate|ME':malformed}});
assert.equal(x.senate.supplemental,0);
assert.equal(x.providerCalls,0);
assert(x.anomalies.some(s=>s.includes('Rejected invalid supplemental Senate|ME')));
const wrongPrimary=snapshot('Senate',{'NC':{total:100,called:false,winner:'',
 cands:[{n:'D',p:'D',v:130}]}});
x=api.reconcile({...input,snapshots:{...input.snapshots,Senate:wrongPrimary}});
assert.equal(x.senate.primary,0);
assert(x.anomalies.some(s=>s.includes('Rejected malformed primary Senate|NC')));
x=api.reconcile({...input,civic:{'Senate|ME':{...civic,key:'NH'}}});
assert.equal(x.senate.supplemental,0,'Wrong race identity must fail closed');
assert.throws(()=>api.houseIds({MA:9}),/435/);
assert.throws(()=>api.senateIds(senate.slice(1)),/Senate universe/);
console.log('Election-night 435/35 coverage, stale/outage, cross-source discrepancies, malformed votes and call isolation PASS');
