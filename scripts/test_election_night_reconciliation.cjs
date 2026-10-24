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
const gov=api.governorIds();
assert.equal(gov.length,36);
assert.equal(new Set(gov).size,36);
assert(gov.includes('NH')&&gov.includes('VT')&&gov.includes('AK'));
assert(!gov.includes('NJ')&&!gov.includes('VA')&&!gov.includes('GU'));
const snapshot=(office,races)=>({year:2026,office,source:'state',stale:false,
 as_of:'2026-11-04T02:50:00Z',races});
const votes=n=>({total:n,called:false,winner:'',cands:[{n:'D',p:'D',v:n}]});
const civic={provider:'civicAPI',office:'Senate',key:'ME',race_id:7421,
 total:1000,called:'Jane Democrat',last_updated:'2026-11-04T02:52:00Z',
 candidates:[{name:'Jane Democrat',party:'D',votes:700},
  {name:'Other',party:'R',votes:300}]};
const input={houseCounts:counts,senateSeats:senate,
 snapshots:{House:snapshot('House',{'TX-01':votes(123),'AK-00':votes(0)}),
  Senate:snapshot('Senate',{'NC':votes(900)}),
  Governor:snapshot('Governor',{'TX':votes(1100),'AK':votes(200)})},
 civic:{'Senate|ME':civic},supportedStates:['TX','AK','NC'],now};
let x=api.reconcile(input);
assert.equal(x.house.total,435);assert.equal(x.senate.total,35);
assert.equal(x.house.reported,1);assert.equal(x.senate.reported,2);
assert.equal(x.house.noVotes,1);assert.equal(x.house.noValidCount,433);
assert.equal(x.senate.primary,1);assert.equal(x.senate.supplemental,1);
assert.equal(x.governor.total,36);
assert.equal(x.governor.sourceSlots,2,'NC has no 2026 governor election');
assert.equal(x.governor.primary,1,
 'Alaska source timestamp before its own 8 PM AKST poll close cannot count');
assert.equal(x.governor.reported,1);
assert.equal(x.governor.noValidCount,35);
// Office source health must be the same for UI labels and coverage arithmetic.
const health=(snapshot,office='Senate',opts={})=>
 api.officeHealth(snapshot,office,{now,...opts});
assert.equal(health(input.snapshots.Senate).state,'reporting');
assert.equal(health(input.snapshots.House,'House').state,'reporting');
assert.equal(health(input.snapshots.Governor,'Governor').state,'reporting');
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
// Explicit inactive sources may contain test-looking counts with fresh
// timestamps. They cannot get reporting credit or create source calls.
const inactive={...input.snapshots.Senate,live:false,final:false};
assert.equal(health(inactive).state,'invalid');
assert.equal(health(inactive).usable,false);
let inactiveRes=api.reconcile({...input,snapshots:{
 ...input.snapshots,Senate:inactive}});
assert.equal(inactiveRes.records['Senate|NC'].hasReportedVotes,false);
assert.equal(inactiveRes.senate.reported,1,
 'Only separately validated civicAPI Maine may report while primary is inactive');
const standby={...input.snapshots.House,live:false,final:false,
 races:{'AK-00':votes(0)}};
assert.equal(health(standby,'House').state,'standby');
assert.equal(api.reconcile({...input,snapshots:{
 ...input.snapshots,House:standby}}).house.noVotes,0,
 'A non-live provider zero must not be counted as reported zero ballots');
const completed={...input.snapshots.Senate,live:false,final:true};
assert.equal(health(completed).usable,true,
 'Fresh finished primary result totals survive the end of counting');
assert.equal(api.reconcile({...input,snapshots:{
 ...input.snapshots,Senate:completed}}).records['Senate|NC'].hasReportedVotes,true);
const unmatched=snapshot('Senate',{'NC':{total:950,called:false,
 winner:'',cands:[{n:'Democrat',p:'D',v:0},{n:'Republican',p:'R',v:0}]}});
assert.equal(api.reconcile({...input,snapshots:{
 ...input.snapshots,Senate:unmatched}}).records['Senate|NC'].hasReportedVotes,false,
 'No candidate votes reported despite positive race-wide count is not observed results');
// Distinct same-party candidates are a legal top-two election. Count their
// source votes without pretending a D/R race margin has been observed.
const topTwo=snapshot('House',{'CA-01':{total:1200,called:false,
 winner:'',cands:[{n:'Candidate One',p:'D',v:700},
                   {n:'Candidate Two',p:'D',v:500}]}});
assert.equal(api.reconcile({...input,snapshots:{
 ...input.snapshots,House:topTwo},supportedStates:['CA',...input.supportedStates]})
 .records['House|CA-01'].hasReportedVotes,true,
 'The source-status desk must not discard valid same-party top-two results');

/* 2026 pre-close MOCK payloads must not become live votes after the
 * computer clock passes close. NC/OH independently close at 7:30 PM ET.
 */
const preclosePrimary=snapshot('Senate',{'NC':votes(900)});
preclosePrimary.as_of='2026-11-04T00:20:00Z';
assert.equal(health(preclosePrimary).state,'reporting',
 'Other states could legitimately report by 00:20Z; race-specific filter applies');
x=api.reconcile({...input,snapshots:{...input.snapshots,Senate:preclosePrimary}});
assert.equal(x.senate.reported,1,'NC pre-close primary votes must not be counted');
assert.equal(x.records['Senate|NC'].hasReportedVotes,false);
assert(x.anomalies.some(s=>s.includes('Rejected malformed primary Senate|NC')));
const precloseSupplemental={...civic,key:'OH-special',last_updated:'2026-11-04T00:20:00Z'};
x=api.reconcile({...input,civic:{'Senate|OH-special':precloseSupplemental}});
assert.equal(x.records['Senate|OH-special'].hasReportedVotes,false,
 'Pre-close Ohio civicAPI numbers cannot count after 7:30 PM EST');
assert.equal(x.providerCalls,0,'No Ohio premature candidate winner call');
const postcloseSupplemental={...precloseSupplemental,last_updated:'2026-11-04T00:35:00Z'};
x=api.reconcile({...input,civic:{'Senate|OH-special':postcloseSupplemental}});
assert.equal(x.records['Senate|OH-special'].hasReportedVotes,true,
 'Ohio source timestamp after actual close may count when otherwise valid');
const precloseNational=snapshot('House',{'TX-01':votes(123)});
precloseNational.as_of='2026-11-03T22:59:59Z';
x=api.reconcile({...input,snapshots:{...input.snapshots,House:precloseNational}});
assert.equal(x.house.reported,0,
 'Before first US poll close a stale mock snapshot is never live');
assert.equal(api.officeHealth(precloseNational,'House',{now}).state,'invalid');

assert.equal(x.providerCalls,1);assert.equal(x.authoritativeCalls,0);
assert.equal(x.chambersCalled,false);assert.equal(x.senateHoldoversInUniverse,65);
const govCivic={...civic,office:'Governor',key:'ME',race_id:8491};
x=api.reconcile({...input,civic:{...input.civic,'Governor|ME':govCivic}});
assert.equal(x.governor.supplemental,1,
 'Verified uncovered governor source is counted, without fabricated primary coverage');
assert.equal(x.governor.reported,2);
x=api.reconcile({...input,civic:{...input.civic,
 'Governor|TX':{...govCivic,key:'TX'}}});
assert.equal(x.governor.supplemental,0,'Primary-covered governor cannot double-count');
assert(x.anomalies.some(s=>s.includes('Blocked overlapping secondary Governor|TX')));
const overlapping={...input,civic:{...input.civic,
 'Senate|NC':{...civic,key:'NC'}}};
x=api.reconcile(overlapping);
assert.equal(x.senate.reported,2,'Do not double-count source-covered races');
assert(x.anomalies.some(s=>s.includes('Blocked overlapping secondary')));
x=api.reconcile({...input,restored:['Senate']});
assert.equal(x.senate.primary,0,'Restored unrefreshed snapshots are not current reporting');
x=api.reconcile({...input,errors:{Senate:true}});
assert.equal(x.senate.primary,0,'Unavailable source keeps historical records but not valid live coverage');
x=api.reconcile({...input,errors:{Governor:true}});
assert.equal(x.governor.primary,0,'Governor office outage must fail closed');
x=api.reconcile({...input,restored:['Governor']});
assert.equal(x.governor.primary,0,'Governor recovery requires fresh verification');
x=api.reconcile({...input,now:Date.parse('2026-11-04T07:30:00Z')});
assert.equal(x.house.reported,0,'Stale sources cannot claim live counts');
assert.equal(x.providerCalls,0);
assert.equal(x.governor.reported,0,'Stale governor snapshots are not current');
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
// A source-share discrepancy can exist without disagreement about which
// party leads. Require >5,000 two-party votes, +/-3-minute timestamps,
// similar completeness, and >=10 percentage points before raising advisory.
const pSame=snapshot('Senate',{'NC':{total:24000,called:false,winner:'',
 cands:[{n:'D',p:'D',v:12500},{n:'R',p:'R',v:11500}]}});
const cSame={...nearCivic,total:24000,called:null,
 candidates:[{name:'Jane Democrat',party:'D',votes:16500},
  {name:'Other',party:'R',votes:7500}]};
x=api.reconcile({...input,snapshots:{...input.snapshots,Senate:pSame},
 civic:{'Senate|NC':cSame}});
assert.equal(x.senate.primary,1);
assert.equal(x.senate.supplemental,0);
assert.equal(x.providerCalls,0);
assert.equal(x.crossSourceDiscrepancies.length,1);
assert.equal(x.crossSourceDiscrepancies[0].kind,
 'PARTISAN_SHARE_GAP_COMPARABLE_REPORTS');
assert.equal(x.crossSourceDiscrepancies[0].primaryLead,'D');
assert.equal(x.crossSourceDiscrepancies[0].supplementalLead,'D');
assert(x.crossSourceDiscrepancies[0].shareGapPoints>=15);
assert(x.anomalies.some(s=>s.includes('D/R vote-share disagreement Senate|NC')));
const matchingShare={...cSame,candidates:[
 {name:'Jane Democrat',party:'D',votes:12600},
 {name:'Other',party:'R',votes:11400}]};
x=api.reconcile({...input,snapshots:{...input.snapshots,Senate:pSame},
 civic:{'Senate|NC':matchingShare}});
assert.equal(x.crossSourceDiscrepancies.length,0,
 'A two-point share difference with the same leader is not a discrepancy');
const laterShare={...cSame,last_updated:'2026-11-04T02:57:00Z'};
x=api.reconcile({...input,snapshots:{...input.snapshots,Senate:pSame},
 civic:{'Senate|NC':laterShare}});
assert.equal(x.crossSourceDiscrepancies.length,0,
 'Different vote-share snapshots >3 minutes apart must not trigger this warning');
const sparse=snapshot('Senate',{'NC':{total:2400,called:false,winner:'',
 cands:[{n:'D',p:'D',v:1250},{n:'R',p:'R',v:1150}]}});
x=api.reconcile({...input,snapshots:{...input.snapshots,Senate:sparse},
 civic:{'Senate|NC':{...cSame,total:2400,candidates:[
 {name:'Jane Democrat',party:'D',votes:1650},
 {name:'Other',party:'R',votes:750}]}}});
assert.equal(x.crossSourceDiscrepancies.length,0,
 'Under 5,000 counted votes each, ignore transient share gaps');
// Explicit source staleness flags override otherwise fresh publication times.
// The national count/quality desk must not accept an adapter-rejected snapshot,
// or revive a previously called result solely because its clock still looks new.
for(const flag of ['stale','sourceStale']){
 const rejected={...civic,[flag]:true};
 const bad=api.reconcile({...input,civic:{'Senate|ME':rejected}});
 assert.equal(bad.records['Senate|ME'].hasReportedVotes,false,
  flag+' civic snapshot must not count as verified reported votes');
 assert.equal(bad.records['Senate|ME'].inValidatedFeed,false);
 assert.equal(bad.records['Senate|ME'].providerCall,false);
 assert.equal(bad.senate.reported,1,
  'Primary NC reports, but flagged Maine civic record does not');
 assert.equal(bad.senate.supplemental,0);
 assert.equal(bad.providerCalls,0);
 assert(bad.anomalies.some(s=>s.includes('Rejected invalid supplemental Senate|ME')));
 const restored=api.reconcile({...input,civic:{'Senate|ME':{...rejected,[flag]:false}}});
 assert.equal(restored.records['Senate|ME'].hasReportedVotes,true,
  'Fresh revalidated adapter evidence restores a previously excluded race');
 assert.equal(restored.records['Senate|ME'].providerCall,true);
}
// Even overlapping stale records must not create partisan share alerts.
const staleOverlap=api.reconcile({...input,civic:{'Senate|NC':{
 ...civic,key:'NC',sourceStale:true
}}});
assert.equal(staleOverlap.crossSourceDiscrepancies.length,0,
 'An explicitly stale overlapping source cannot generate quality conclusions');

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
// Split-time-zone provider calls must WAIT for final applicable closure.
// The same legitimate partial candidate counts remain visible after EARLIEST
// state closure; a stale premature winner flag is never revived by the clock.
function sourceCall(office,key,sourceTime,nowTime){
 return api.reconcile({...input,snapshots:{},supportedStates:[],
  now:Date.parse(nowTime),civic:{[office+'|'+key]:{
   ...civic,office,key,called:'Jane Democrat',last_updated:sourceTime
  }}});
}
for(const [office,key,early,final] of [
 ['Senate','KS','2026-11-04T01:20:00Z','2026-11-04T02:00:00Z'],
 ['Governor','AK','2026-11-04T05:30:00Z','2026-11-04T06:00:00Z'],
 ['House','SD-00','2026-11-04T01:30:00Z','2026-11-04T02:00:00Z'],
 ['House','KY-01','2026-11-03T23:30:00Z','2026-11-04T00:00:00Z']
]){
 const earlyResult=sourceCall(office,key,early,early);
 assert.equal(earlyResult.records[office+'|'+key].hasReportedVotes,true,
  office+' '+key+' may legitimately report partial votes');
 assert.equal(earlyResult.records[office+'|'+key].providerCall,false,
  office+' '+key+' must not show a provider call while later polls remain open');
 assert.equal(earlyResult.providerCalls,0);
 const staleHint=sourceCall(office,key,early,final);
 assert.equal(staleHint.providerCalls,0,
  office+' '+key+' early winner hint may not revive after the last closure');
 const accepted=sourceCall(office,key,final,final);
 assert.equal(accepted.records[office+'|'+key].providerCall,true,
  office+' '+key+' newly post-final-close provider hint can be displayed');
 assert.equal(accepted.providerCalls,1);
 assert.equal(accepted.authoritativeCalls,0,
  'A valid provider hint is not an independently professional call');
}
const kansasEarlyHouse=sourceCall('House','KS-02',
 '2026-11-04T01:20:00Z','2026-11-04T01:20:00Z');
assert.equal(kansasEarlyHouse.providerCalls,1,
 'A House district wholly closed early should not be delayed statewide');

console.log('Election-night 435/35 coverage, stale/outage, cross-source discrepancies, malformed votes and call isolation PASS');
