#!/usr/bin/env node
'use strict';
// Six-hour SYNTHETIC election-clock test; no made-up votes touch the website.
// Replays source availability and identity transitions, not historical
// precinct reporting order. Safe to run before November 3, 2026.
const assert=require('node:assert/strict');
const api=require('./election_night_reconciliation.js');
const closing=require('./election_night_poll_closings_2026.js');

const counts={AL:7,AK:1,AZ:9,AR:4,CA:52,CO:8,CT:5,DE:1,FL:28,
 GA:14,HI:2,ID:2,IL:17,IN:9,IA:4,KS:4,KY:6,LA:6,ME:2,MD:8,
 MA:9,MI:13,MN:8,MS:4,MO:8,MT:2,NE:3,NV:4,NH:2,NJ:12,NM:3,
 NY:26,NC:14,ND:1,OH:15,OK:5,OR:6,PA:17,RI:2,SC:7,SD:1,TN:9,
 TX:38,UT:4,VT:1,VA:11,WA:10,WV:2,WI:8,WY:1};
const senateStates='AL AK AR CO DE FL GA ID IA IL KS KY LA MA ME MI MN MS MT NC NE NH NJ NM OH OK OR RI SC SD TN TX VA WV WY'.split(' ');
const senateSeats=senateStates.map(st=>({key:st+(st==='FL'||st==='OH'?'-special':'')}));
const houseIds=api.houseIds(counts),senateIds=api.senateIds(senateSeats),
 governorIds=api.governorIds();
const supported=['AZ','FL','GA','NC','TX'];
const qualifying=id=>supported.includes(id.slice(0,2));
const slots={House:houseIds.filter(qualifying),Senate:senateIds.filter(qualifying),
 Governor:governorIds.filter(qualifying)};
assert.equal(governorIds.length,36);
assert.equal(slots.Governor.length,4);
assert(slots.House.length>100&&slots.Senate.length>=3);
const clock=Date.parse('2026-11-03T21:00:00Z'); // 4pm ET; 6h through 10pm ET.
// An old pre-close MOCK response cannot turn into genuine votes when the
// wall clock later passes poll close. Source-reported timestamps matter.
const NC_OH_CLOSE=closing.floorFor('NC');
const sourceEligible=(key,sourceTime)=>sourceTime>=closing.floorFor(key);
const vote=(key,minute,idx)=>{
 const dem=1000+idx*9+minute*11;
 const rep=1100+idx*8+minute*9;
 // A legitimate downward revision on one exact source race.
 const revision=(minute>=280&&key===slots.House[0])?200:0;
 return {total:dem+rep-revision,called:false,winner:'',
  cands:[{n:'Dem candidate',p:'D',v:dem-revision},
   {n:'Republican candidate',p:'R',v:rep}],pct_in:Math.min(99,minute/4)};
};
const snapshotsAt=(minute,now)=>{
 const snapshots={};
 for(const office of ['House','Senate','Governor']){
  const target=slots[office],n=Math.floor(target.length*minute/360);
  const staleTimestamp=minute===250?now-4*3600000:now-20000;
  const races={};
  // Simulated *source* never publishes positive 2026 totals before the
  // corresponding state's official poll-close threshold.
  target.slice(0,n).filter(key=>sourceEligible(key,staleTimestamp))
   .forEach((key,idx)=>races[key]=vote(key,minute,idx));
  snapshots[office]={office,year:2026,source:'state',
   stale:minute>=180&&minute<=184,
   as_of:new Date(staleTimestamp).toISOString(),races};
 }
 return snapshots;
};
function civicFor(minute,now){
 if(now-25000<closing.floorFor('ME'))return {};
 const called=minute>=200?'Test Democrat':'';
 const race={provider:'civicAPI',office:'Senate',key:'ME',race_id:7421,
  total:2000+minute*20,called,last_updated:new Date(now-25000).toISOString(),
  candidates:[{name:'Test Democrat',party:'D',votes:1200+minute*12},
   {name:'Test Republican',party:'R',votes:800+minute*8}]};
 const entries={'Senate|ME':race};
 if(minute===241)entries['Senate|NC']={...race,key:'NC',race_id:7718};
 return entries;
}

const assertions={minutes:0,outageMinutes:0,restoredMinutes:0,
 staleMinutes:0,overlapMinutes:0,providerCallMinutes:0};
let recoveredHouse=0,recoveredSenate=0;
for(let minute=0;minute<=360;minute++){
 const now=clock+minute*60000;
 const snapshots=snapshotsAt(minute,now),civic=civicFor(minute,now);
 const outage=minute>=230&&minute<=251;
 const restoring=minute===252||minute===253;
 const delayed=minute>=180&&minute<=184||minute===250;
 const civicFailure=minute>=310&&minute<=318;
 const errors={House:outage,Senate:outage,Governor:outage,
  'Senate|ME':civicFailure};
 const result=api.reconcile({houseCounts:counts,senateSeats,snapshots,civic,
  errors,restored:restoring?['House','Senate','Governor']:[],
  supportedStates:supported,now});
 assertions.minutes++;
 assert.equal(result.house.total,435);
 assert.equal(result.senate.total,35);
 assert.equal(result.governor.total,36);
 assert.equal(result.governor.sourceSlots,slots.Governor.length);
 assert.equal(result.governor.primary+result.governor.supplemental+
  result.governor.noValidCount,36);
 assert.equal(result.senateHoldoversInUniverse,65);
 assert.equal(result.house.sourceSlots,slots.House.length);
 assert.equal(result.senate.sourceSlots,slots.Senate.length);
 assert.equal(result.house.primary+result.house.supplemental+
  result.house.noValidCount,435);
 assert.equal(result.senate.primary+result.senate.supplemental+
  result.senate.noValidCount,35);
 assert(result.house.reported<=result.house.primary+result.house.supplemental);
 assert(result.senate.reported<=result.senate.primary+result.senate.supplemental);
 assert.equal(result.chambersCalled,false);
 assert.equal(result.authoritativeCalls,0);
 if(now<NC_OH_CLOSE){
  assert.equal(result.records['House|NC-01'].hasReportedVotes,false,
   'North Carolina House MOCK data must never appear before the 7:30 PM EST close');
  assert.equal(result.records['Senate|NC'].hasReportedVotes,false,
   'North Carolina Senate MOCK data must never appear before polls close');
 }

 assert.equal(result.missingAuthoritativeCallSource,true);
 if(outage||restoring||delayed){
  if(outage)assertions.outageMinutes++;
  if(restoring)assertions.restoredMinutes++;
  if(delayed)assertions.staleMinutes++;
  assert.equal(result.house.primary,0,'Outage/restored/stale House results cannot be live');
  assert.equal(result.senate.primary,0,'Outage/restored/stale Senate results cannot be live');
  assert.equal(result.governor.primary,0,'Impaired governor source cannot count');
 }else{
  const fixtureCount=office=>{
   const first=Math.floor(slots[office].length*minute/360);
   const sourceTime=minute===250?now-4*3600000:now-20000;
   return slots[office].slice(0,first)
    .filter(key=>sourceEligible(key,sourceTime)).length;
  };
  assert.equal(result.house.primary,fixtureCount('House'));
  assert.equal(result.senate.primary,fixtureCount('Senate'));
  assert.equal(result.governor.primary,fixtureCount('Governor'));
  recoveredHouse=result.house.primary;recoveredSenate=result.senate.primary;
 }
 const expectedCivic=now-25000>=closing.floorFor('ME')&&!civicFailure?1:0;
 assert.equal(result.senate.supplemental,expectedCivic,
  'Validated uncovered supplemental race must remain available independently');
 assert.equal(result.providerCalls,minute>=241&&!civicFailure?1:0,
  'A source call must remain source-attributed and never become an official chamber call');
 if(result.providerCalls)assertions.providerCallMinutes++;
 if(minute===241){
  assertions.overlapMinutes++;
  assert(result.anomalies.some(x=>x.includes('Blocked overlapping secondary Senate|NC')));
  assert.equal(result.senate.supplemental,1,'Overlapping race cannot be double-counted');
 }
 if(minute===254){
  assert(result.house.primary>0,'Primary data must recover after outage/recheck');
  assert(result.senate.primary>0,'Senate source must recover after outage/recheck');
  assert(result.governor.primary>0,'Governor source must recover after outage/recheck');
 }
 if(minute===255)assert(result.house.primary>0,'Old timestamps must not permanently poison recovery');
 if(minute===319)assert.equal(result.senate.supplemental,1,
  'Supplemental source must recover after its own outage');
}
assert.equal(assertions.minutes,361);
assert.equal(assertions.outageMinutes,22);
assert.equal(assertions.restoredMinutes,2);
assert.equal(assertions.staleMinutes,6);
assert.equal(assertions.overlapMinutes,1);
assert(recoveredHouse===slots.House.length&&recoveredSenate===slots.Senate.length);
console.log('6h/361 synthetic minute-steps PASS',JSON.stringify(assertions));
console.log('Outages and stale/restored responses are not calls or counted live votes; recovery restores validated coverage.');
