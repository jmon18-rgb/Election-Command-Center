#!/usr/bin/env node
'use strict';
/*
 * Time-compressed two-hour Election Night reconciliation SOAK.
 * This is 121 simulated 60-second checkpoints, NOT a two-hour real-network
 * endurance test or evidence of election-day source availability.
 * All votes and source IDs in this test are fictional test fixtures.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const reconcile=require('./election_night_reconciliation.js');
const triage=require('./election_night_506_live_gap_desk.js');
const ROOT=path.resolve(__dirname,'..');
const json=name=>JSON.parse(fs.readFileSync(path.join(ROOT,'data',name),'utf8'));
const universe=json('seat_universe.json');
const ledger=json('election_night_source_coverage.json');
const countStates=universe.house.by_state;
const senateSeats=universe.senate.contested_seats.map(x=>({
 key:x.state+(x.election_kind==='special'?'-special':'')
}));
const covered=[...new Set(ledger.races.filter(r=>
 r.provider_scope==='Open America 22-state scope').map(r=>r.state))];
assert.equal(covered.length,22);
const START=Date.parse('2026-11-04T06:00:00Z');
const minute=60000;
const PRIMARY_IDS=['House|VA-02','Senate|NC','Governor|TX'];
for(const id of [...PRIMARY_IDS,'Senate|NH'])
 assert(ledger.races.some(x=>x.id===id),'Missing simulated exact race '+id);
const source=(office,key,time,n)=>({
 year:2026,office,source:'state',stale:false,
 as_of:new Date(time-minute).toISOString(),
 races:{[key]:{
  total:n,called:false,winner:'',
  cands:[
   {n:'Fictional Democrat',p:'D',v:Math.floor(n*.6)},
   {n:'Fictional Republican',p:'R',v:n-Math.floor(n*.6)}
  ]
 }}
});
const secondary=(office,key,time,n,{opposite=false}={})=>({
 provider:'civicAPI',office,key,race_id:9990001,
 last_updated:new Date(time-minute).toISOString(),
 total:n,called:null,candidates:[
  {name:'Fictional Democrat',party:'D',
   votes:opposite?Math.floor(n*.4):Math.floor(n*.6)},
  {name:'Fictional Republican',party:'R',
   votes:opposite?n-Math.floor(n*.4):n-Math.floor(n*.6)}
 ]
});
let reportingReconciliations=0,isolatedOutages=0,recoveries=0;
let discrepantMinute=false,sawStaleLedgerWithoutVoteLoss=false;
let lastValidHouse=0,lastValidGovernor=0,lastValidNH=0;
for(let m=0;m<=120;m++){
 const now=START+m*minute;
 const houseOut=m>=25&&m<40;
 const governorStale=m>=70&&m<80;
 const nhEnabled=m>=90;
 const nhSourceOutage=m>=100&&m<110;
 const h=source('House','VA-02',now,1000+m*32);
 const s=source('Senate','NC',now,1000+m*23);
 const g=source('Governor','TX',now,1000+m*17);
 if(governorStale)g.stale=true;
 const snapshots={House:h,Senate:s,Governor:g};
 const errors={House:houseOut};
 const civic={};
 if(nhEnabled){
  civic['Senate|NH']=secondary('Senate','NH',now,1000+m*5);
  if(nhSourceOutage)errors['Senate|NH']=true;
 }
 if(m===60){
  // Deliberately conflicting overlap. Primary state results remain owned by
  // Open America; an untrusted secondary cannot double-count or override it.
  civic['Senate|NC']=secondary('Senate','NC',now,1000+m*23,
    {opposite:true});
 }
 const res=reconcile.reconcile({houseCounts:countStates,senateSeats,
  supportedStates:covered,snapshots,civic,errors,now});
 const ageStamp=m===115?now-7*3600000:now-10*minute;
 const observedLedger={...ledger,generated_at:new Date(ageStamp).toISOString()};
 const health={House:houseOut?'outage':'reporting',Senate:'reporting',
               Governor:governorStale?'stale':'reporting'};
 const supplementHealth=nhSourceOutage?{'Senate|NH':'failed'}:{};
 const pulse=triage.build(observedLedger,res,health,now,supplementHealth);
 const expectedHouse=houseOut?0:1;
 const expectedGovernor=governorStale?0:1;
 const expectedSenate=1+(nhEnabled&&!nhSourceOutage?1:0);
 assert.equal(res.house.reported,expectedHouse,'House minute '+m);
 assert.equal(res.senate.reported,expectedSenate,'Senate minute '+m);
 assert.equal(res.governor.reported,expectedGovernor,'Governor minute '+m);
 assert.deepEqual([pulse.totals.House.reported,pulse.totals.Senate.reported,
   pulse.totals.Governor.reported],
  [expectedHouse,expectedSenate,expectedGovernor],'506-race UI drift minute '+m);
 for(const office of ['House','Senate','Governor']){
  const t=pulse.totals[office];
  assert.equal(t.reported+t.zero+t.missing,t.total,'All seats accounted for');
 }
 assert.equal(res.authoritativeCalls,0,'No professional calls licensed');
 assert.equal(res.chambersCalled,false,'No result implies a control call');
 assert.equal(pulse.professional_calls_verified,0);
 assert.equal(pulse.may_update_model,false);
 assert.equal(res.records['Senate|NC'].provider,'Open America',
  'Secondary cannot overwrite covered-state Senate');
 if(houseOut){
  assert.equal(res.records['House|VA-02'].inValidatedFeed,false);
  assert(pulse.totals.House.byStatus.PRIMARY_DEGRADED>=1);
  isolatedOutages++;
 }else{
  assert.equal(res.records['House|VA-02'].hasReportedVotes,true);
  assert(h.races['VA-02'].total>=lastValidHouse,
   'Restored House count should be nondecreasing');
  lastValidHouse=h.races['VA-02'].total;
  if(m===40)recoveries++;
 }
 if(governorStale){
  assert.equal(res.records['Governor|TX'].provider,null);
  assert(pulse.totals.Governor.byStatus.PRIMARY_DEGRADED>=1);
 }else{
  assert(g.races.TX.total>=lastValidGovernor);
  lastValidGovernor=g.races.TX.total;
  if(m===80)recoveries++;
 }
 if(nhEnabled){
  assert.equal(res.records['Senate|NH'].provider,
   nhSourceOutage?null:'civicAPI');
  if(nhSourceOutage){
   assert.equal(pulse.totals.Senate.byStatus.SECONDARY_FAILED>=1);
  }else{
   assert(civic['Senate|NH'].total>=lastValidNH);
   lastValidNH=civic['Senate|NH'].total;
   if(m===110)recoveries++;
  }
 }else{
  assert.equal(res.records['Senate|NH'].provider,null);
 }
 if(m===60){
  assert(res.crossSourceDiscrepancies.some(d=>
   d.id==='Senate|NC'&&d.kind==='OPPOSITE_LEAD_COMPARABLE_REPORTS'));
  assert.equal(res.senate.reported,1,'Overlapping provider must not double count');
  discrepantMinute=true;
 }
 if(m===115){
  assert.equal(pulse.sourceIdentityAuditStale,true);
  assert.equal(pulse.totals.House.reported,1);
  assert.equal(pulse.totals.Senate.reported,2);
  assert.equal(pulse.totals.Governor.reported,1);
  sawStaleLedgerWithoutVoteLoss=true;
 }
 reportingReconciliations++;
}
assert.equal(reportingReconciliations,121);
assert.equal(isolatedOutages,15);
assert.equal(recoveries,3);
assert(discrepantMinute&&sawStaleLedgerWithoutVoteLoss);
console.log('Election Night 2-hour simulated 121-step source soak PASS:',
 reportingReconciliations,'reconciliations; 15 House outage steps, Governor',
 'stale/outage recovery, NH Senate independently restored, cross-provider',
 'discrepancy isolated, stale ledger warns without dropping verified votes.',
 'NO real 2026 votes, actual network throughput or control calls tested.');
