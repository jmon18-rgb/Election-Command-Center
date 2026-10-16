#!/usr/bin/env node
'use strict';
// TWELVE HOUR VIRTUAL-CLOCK fault/load soak of actual deployed source modules.
// Synthetic votes never enter live state, browser storage, or GitHub Pages.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const reconcile=require('./election_night_reconciliation.js');
const houseAdapter=require('./civicapi_house_2026_adapter.js');
const transport=require('./election_night_transport.js');
const backoff=require('./election_night_source_backoff.js');

const root=path.resolve(__dirname,'..');
const seatUniverse=JSON.parse(fs.readFileSync(path.join(root,'data/seat_universe.json')));
const pins=JSON.parse(fs.readFileSync(path.join(root,'data/election_night_house_pins.json')));
const coverage=JSON.parse(fs.readFileSync(path.join(root,'data/election_night_source_coverage.json')));
const start=Date.parse('2026-11-03T21:00:00Z'); // 4pm Eastern, twelve virtual hours
const supportedStates=[...new Set(coverage.races.filter(r=>
 r.office==='House'&&r.provider_scope==='Open America 22-state scope')
 .map(r=>r.state))].sort();
assert.equal(supportedStates.length,22);
const isSupported=x=>supportedStates.includes(x.slice(0,2));
const hids=reconcile.houseIds(seatUniverse.house.by_state);
const sids=reconcile.senateIds(seatUniverse.senate.contested_seats.map(s=>({
 key:s.state+(s.election_kind==='special'?'-special':'')
})));
const gids=reconcile.governorIds();
assert.deepEqual([hids.length,sids.length,gids.length],[435,35,36]);
const all={House:hids,Senate:sids,Governor:gids};
const primary={House:hids.filter(isSupported),Senate:sids.filter(isSupported),
 Governor:gids.filter(isSupported)};
assert.deepEqual([primary.House.length,primary.Senate.length,primary.Governor.length],
 [216,15,15]);
assert.equal(pins.status,'VERIFIED_HOUSE_IDENTITIES_NOT_LIVE_RESULTS');
const eligible=pins.races.filter(r=>!isSupported(r.district));
assert(eligible.length>=15&&eligible.length<=219);
assert.equal(new Set(eligible.map(r=>r.race_id)).size,eligible.length);
const virtualManifest={schema_version:'1.0',
 status:'VERIFIED_HOUSE_IDENTITIES_NOT_LIVE_RESULTS',
 election:'2026-11-03',generated_at:new Date(start).toISOString(),
 races:eligible.map(r=>({
  district:r.district,race_id:r.race_id,
  checked_window_utc:new Date(start-3600000).toISOString()
 }))};
assert.equal(houseAdapter.setManifest(virtualManifest,start),true);
const breaker=backoff.create(()=>clock);
const pool=transport.createPool(4,64);
const latest=new Map(),validEpoch=new Map(),perRaceErrors=new Set();
let clock=start,sourceFailures=0,invalidDetails=0,correctedReports=0;
const metrics={ticks:0,officeOutageTicks:0,staleOfficeTicks:0,
 civicBlockedTicks:0,rechecks:0,sourceCalls:0,overlapChecks:0,
 partialHouseCoverageTicks:0,staleEpochRejects:0};

function primaryRecord(key,minute,i){
 const d=1000+i*7+minute*6,r=1050+i*5+minute*5;
 const correct=(key===primary.House[0]&&minute>=530)?150:0;
 return {total:d+r-correct,called:false,winner:'',
  cands:[{n:'Democrat',p:'D',v:d-correct},
   {n:'Republican',p:'R',v:r}],pct_in:Math.min(99,minute/8)};
}
function snapshotsAt(minute,now){
 const snapshots={};
 for(const office of ['House','Senate','Governor']){
  const ids=primary[office],count=Math.floor(ids.length*(minute+8)/728),races={};
  ids.slice(0,count).forEach((key,i)=>{races[key]=primaryRecord(key,minute,i)});
  const stale=minute>=280&&minute<=289;
  const ts=stale?now-4*3600000:now-20000;
  snapshots[office]={source:'state',office,year:2026,stale:false,
   as_of:new Date(ts).toISOString(),races};
 }
 return snapshots;
}
function detailFor(info,minute,now){
 const key=info.district,idx=eligible.findIndex(r=>r.district===key);
 const d=2100+idx*17+minute*4;
 let r=2300+idx*11+minute*3;
 // A legitimate small downward revision, not loss of all recorded votes.
 if(key===eligible[0].district&&minute>=530)r-=200;
 const total=d+r;
 return {id:info.race_id,country:'US',province:key.slice(0,2),
  municipality:null,district:key,
  election_date:'2026-11-03T05:00:00.000Z',
  election_name:key.endsWith('-00')?
   key.slice(0,2)+' US House At-Large':
   key.slice(0,2)+' US House '+Number(key.slice(3)),
  election_type:'House of Representatives',
  percent_reporting:Math.min(99,minute/8),
  last_updated:new Date(now-12000).toISOString(),
  candidates:[
   {name:'Synthetic Democrat',party:'Democratic',votes:d,
    percent:100*d/total,winner:minute>=420},
   {name:'Synthetic Republican',party:'Republican',votes:r,
    percent:100*r/total,winner:false}
  ]
 };
}
async function tick(minute){
 clock=start+minute*60000;
 const now=clock;
 if([105,320,450,590].includes(minute)){
  breaker.fail({105:503,320:429,450:502,590:504}[minute]);
  sourceFailures++;
 }
 const selected=Array.from({length:Math.min(8,eligible.length)},(_,i)=>
  eligible[(minute*7+i)%eligible.length]);
 const work=selected.map(info=>pool.run(async()=>{
  // Emulates fetch resolving asynchronously through a single shared pool.
  await Promise.resolve();
  const epoch=transport.generation(breaker);
  if(breaker.status().blocked)return;
  const data=detailFor(info,minute,now);
  const id='House|'+info.district;
  if(minute===160&&info.district===selected[0].district){
   data.district='NH-99'; // correct race ID, malicious/wrong district detail
  }
  if(minute>=530&&info.district===eligible[0].district){
   correctedReports++;
  }
  const validated=houseAdapter.validatePinned(
   {office:'House',key:info.district},info.race_id,data,now);
  if(!validated){
   invalidDetails++;
   perRaceErrors.add(id);
   return;
  }
  if(!transport.sameGeneration(breaker,epoch)){
   metrics.staleEpochRejects++;
   perRaceErrors.add(id);
   return;
  }
  latest.set(id,validated);
  validEpoch.set(id,epoch);
  perRaceErrors.delete(id);
  breaker.success();
  metrics.rechecks++;
 }));
 await Promise.all(work);
 const out={};
 const errors={};
 const status=breaker.status();
 const providerHealthy=!status.blocked&&status.consecutive===0;
 if(!providerHealthy)metrics.civicBlockedTicks++;
 for(const [id,record] of latest){
  out[id]=record;
  if(!providerHealthy||perRaceErrors.has(id)||
     validEpoch.get(id)!==status.generation)errors[id]=true;
 }
 const primaryOutage=minute>=190&&minute<=214;
 const restoring=minute>=215&&minute<=218;
 const stale=minute>=280&&minute<=289;
 if(primaryOutage){
  metrics.officeOutageTicks++;
  for(const office of ['House','Senate','Governor'])errors[office]=true;
 }
 const snapshots=snapshotsAt(minute,now);
 const restored=restoring?['House','Senate','Governor']:[];
 if(stale)metrics.staleOfficeTicks++;
 if(minute===370){
  // Overlap is strictly excluded even if independently well formed.
  const overlapKey=primary.House[0];
  out['House|'+overlapKey]={...latest.values().next().value,office:'House',
   key:overlapKey,race_id:999991,last_updated:new Date(now-20000).toISOString()};
  delete errors['House|'+overlapKey];
 }
 const result=reconcile.reconcile({
  houseCounts:seatUniverse.house.by_state,
  senateSeats:seatUniverse.senate.contested_seats.map(s=>({
   key:s.state+(s.election_kind==='special'?'-special':'')
  })),
  snapshots,civic:out,errors,restored,
  supportedStates,now
 });
 assert.deepEqual([result.house.total,result.senate.total,result.governor.total],
  [435,35,36]);
 for(const office of ['House','Senate','Governor']){
  const row=result[office.toLowerCase()];
  assert.equal(row.total,row.primary+row.supplemental+row.noValidCount);
  assert.equal(row.sourceSlots,primary[office].length);
  assert(row.reported<=row.primary+row.supplemental);
  if(primaryOutage||restoring||stale)assert.equal(row.primary,0,
   'Primary outage, restore and stale periods cannot count live results');
 }
 assert.equal(result.house.supplemental,
  Object.keys(out).filter(id=>id.startsWith('House|')&&
   !isSupported(id.slice(6))&&!errors[id]).length,
  'Only fresh 2026 exact House detail may count outside primary states');
 assert.equal(result.senate.supplemental,0);
 assert.equal(result.governor.supplemental,0);
 assert.equal(result.authoritativeCalls,0);
 assert.equal(result.chambersCalled,false);
 assert.equal(result.senateHoldoversVerifiedByCalls,false);
 assert.equal(result.missingAuthoritativeCallSource,true);
 if(result.providerCalls)metrics.sourceCalls+=result.providerCalls;
 if(minute===370){
  metrics.overlapChecks++;
  assert(result.anomalies.some(x=>x.includes('Blocked overlapping secondary House|'+primary.House[0])));
  assert.equal(result.records['House|'+primary.House[0]].provider,'Open America');
 }
 if(minute===219){
  assert(result.house.primary>0,'Fresh primary resumes after source recheck');
 }
 if(minute===290){
  assert(result.house.primary>0,'Stale primary must recheck to restore');
 }
 if(minute===106){
  assert.equal(result.house.supplemental,0,
   'Provider 503 cannot leave legacy source records counting while blocked');
 }
 if(result.house.supplemental>0)metrics.partialHouseCoverageTicks++;
 metrics.ticks++;
}
(async()=>{
 for(let minute=0;minute<=720;minute++)await tick(minute);
 assert.equal(metrics.ticks,721);
 assert.equal(metrics.officeOutageTicks,25);
 assert.equal(metrics.staleOfficeTicks,10);
 assert.equal(metrics.overlapChecks,1);
 assert(metrics.rechecks>500,'Repeated active source verification expected');
 assert(metrics.civicBlockedTicks>=4);
 assert(metrics.sourceCalls>0,'Unofficial source flag must stay distinguished from calls');
 assert.equal(sourceFailures,4);
 assert(invalidDetails>=1);
 assert(correctedReports>=1);
 assert.equal(pool.status().peak,4,'Concurrent source calls must never exceed four');
 assert.equal(pool.status().queued,0);
 assert.equal(pool.status().active,0);
 assert(metrics.partialHouseCoverageTicks>100);
 assert.deepEqual([all.House.length,all.Senate.length,all.Governor.length],
  [435,35,36]);
 console.log('12h / 721-minute virtual-clock 506-contest transport + reconciliation fault-soak PASS');
 console.log(JSON.stringify({
  ...metrics,sourceFailures,invalidDetails,correctedReports,
  verifiedHouseSourceIDsInFixture:eligible.length,
  maxConcurrentRequests:pool.status().peak,
  requestsCompleted:pool.status().completed,
  authoritativeCalls:0,source:'SYNTHETIC_NOT_PRODUCTION_VOTES'
 }));
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
