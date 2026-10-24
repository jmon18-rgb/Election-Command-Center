#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const api=require('./election_night_506_live_gap_desk.js');
const reconcile=require('./election_night_reconciliation.js');
const ROOT=path.resolve(__dirname,'..');
const ledger=JSON.parse(fs.readFileSync(path.join(ROOT,'data/election_night_source_coverage.json')));
const universe=JSON.parse(fs.readFileSync(path.join(ROOT,'data/seat_universe.json')));
const now=Date.parse('2026-11-04T03:00:00Z');
const h=universe.house.by_state;
const senate=universe.senate.contested_seats.map(x=>({key:x.state+(x.election_kind==='special'?'-special':'')}));
const states=[...new Set(ledger.races.filter(r=>r.provider_scope==='Open America 22-state scope').map(r=>r.state))];
const sample=(office,races)=>({year:2026,office,source:'state',
 stale:false,as_of:'2026-11-04T02:54:00Z',races});
const vote=n=>({total:n,called:false,winner:'',cands:[{n:'A',p:'D',v:n}]});
function results(extra={}){
 return reconcile.reconcile({
  houseCounts:h,senateSeats:senate,supportedStates:states,now,
  snapshots:{House:sample('House',{'TX-01':vote(110), 'TX-02':vote(0)}),
             Senate:sample('Senate',{'NC':vote(82)}),
             Governor:sample('Governor',{'TX':vote(0)})},
  ...extra
 });
}
const res=results();
const state={House:'reporting',Senate:'reporting',Governor:'current_no_votes'};
const pulse=api.build(ledger,res,state,now);
assert.deepEqual(Object.keys(pulse.totals),['House','Senate','Governor']);
assert.deepEqual([pulse.totals.House.total,pulse.totals.Senate.total,
 pulse.totals.Governor.total],[435,35,36]);
assert.deepEqual([pulse.totals.House.reported,pulse.totals.Senate.reported,
 pulse.totals.Governor.reported],[1,1,0]);
assert.deepEqual([pulse.totals.House.zero,pulse.totals.Senate.zero,
 pulse.totals.Governor.zero],[1,0,1]);
assert.equal(pulse.senate.length,35);
assert.equal(pulse.unverifiedMachineIds.length,11,'Source-unpinned identity list must match current review ledger');
assert.equal(pulse.unverifiedMachineIds.filter(x=>x.office==='House').length,7);
assert(!pulse.unverifiedMachineIds.some(x=>x.id==='House|CA-13'),
 'Independently verified exact 2026 House ID hints cannot be labeled unknown');
assert.equal(pulse.totals.House.byStatus.SECONDARY_NOT_QUERIED,212,
 'Exact House discovery IDs remain unreported votes, not 212 missing machine IDs');
const lastHintFailed=api.build(ledger,res,state,now,{'House|CA-13':'failed'});
assert.equal(lastHintFailed.totals.House.byStatus.SECONDARY_FAILED,1,
 'Independently observed source failure must override a saved House identity hint');
assert.equal(lastHintFailed.unverifiedMachineIds.length,11,
 'A failed lookup must not manufacture a new missing machine identity');
assert.equal(pulse.unverifiedMachineIds.filter(x=>x.office==='Governor').length,2);
assert.equal(pulse.unverifiedMachineIds.filter(x=>x.office==='Senate').length,2);
assert.equal(pulse.senateMissing,34);
assert.equal(pulse.senate.find(x=>x.id==='Senate|NC').status,'OBSERVED_SOURCE_VOTES');
assert.equal(pulse.senate.find(x=>x.id==='Senate|TX').status,'PRIMARY_RACE_ABSENT');
assert.equal(pulse.senate.find(x=>x.id==='Senate|ME').status,'SECONDARY_NOT_QUERIED');
assert.equal(pulse.senate.find(x=>x.id==='Senate|MA').status,'NO_MACHINE_SOURCE_ID');
assert.equal(pulse.senate.find(x=>x.id==='Senate|NH').status,'SECONDARY_SCOPED');
const secondary=api.build(ledger,res,state,now,{
 'Senate|ME':'failed',
 'Senate|OH-special':'stale',
 'Senate|NH':'pending',
 'Senate|NE':'attempted',
});
assert.equal(secondary.senate.find(x=>x.id==='Senate|ME').status,'SECONDARY_FAILED');
assert.equal(secondary.senate.find(x=>x.id==='Senate|OH-special').status,'SECONDARY_STALE');
assert.equal(secondary.senate.find(x=>x.id==='Senate|NH').status,'SECONDARY_CHECKING');
assert.equal(secondary.senate.find(x=>x.id==='Senate|NE').status,'SECONDARY_ATTEMPTED');
assert.equal(secondary.totals.Senate.reported,1,'Source outage must never create votes');
assert.equal(secondary.senateMissing,34);
assert.equal(secondary.may_update_model,false);
assert.equal(pulse.may_update_model,false);
assert.equal(pulse.professional_calls_verified,0);
const degraded=api.build(ledger,results({errors:{Senate:true}}),
 {...state,Senate:'outage'},now);
assert.equal(degraded.totals.Senate.reported,0);
assert.equal(degraded.senate.find(x=>x.id==='Senate|NC').status,'PRIMARY_DEGRADED');
const noData=api.build(ledger,results({snapshots:{}}),
 {House:'missing',Senate:'missing',Governor:'missing'},now);
assert.equal(noData.totals.House.reported,0);
assert.equal(noData.senate.find(x=>x.id==='Senate|NC').status,'PRIMARY_AWAITING');
for(const corrupt of [
 {...ledger,races:ledger.races.slice(1)},
 {...ledger,races:[ledger.races[0],...ledger.races.slice(1,505),ledger.races[0]]},
 {...ledger,generated_at:'2026-11-05T00:00:00Z'},
 {...ledger,status:'VERIFIED_ALL_LIVE_RESULTS'}
])assert.throws(()=>api.build(corrupt,res,state,now));
const badResults={...res,authoritativeCalls:1};
assert.throws(()=>api.build(ledger,badResults,state,now));
function node(tag){
 return {tag,children:[],className:'',textContent:'',appendChild(x){this.children.push(x)},
 replaceChildren(){this.children=[]}};
}
const host=node('div');
const official=JSON.parse(fs.readFileSync(path.join(ROOT,
 'data/election_night_official_backstops.json')));
assert.equal(api.render(host,pulse,{createElement:node},official.links),true);
const flatten=x=>[x.textContent,...x.children.flatMap(flatten)].join(' ');
const t=flatten(host);
assert.match(t,/House 1\/435 · Senate 1\/35 · Governors 0\/36/);
assert.match(t,/Senate source gaps · 34/);
assert.match(t,/Unpinned House \/ governor source IDs · 9/);
assert.match(t,/House NH-01 — No verified automated source ID/);
assert.match(t,/House NH-02 — No verified automated source ID/);
assert.match(t,/House AK-00 — No verified automated source ID/);
assert.match(t,/Governor HI — No verified automated source ID/);
assert.match(t,/Governor OK — No verified automated source ID/);
assert.equal((t.match(/Check official election office/g)||[]).length,9,
 'Seven House and two governor missing source IDs require operator fallback links');
assert.match(t,/MA — No verified automated source ID/);
assert.match(t,/certified results only; NOT live/);
assert.match(t,/MS — No verified automated source ID/);
assert.equal((t.match(/certified results only; NOT live/g)||[]).length,2,
 'Both MA and MS official links must be labeled certified-only, not live');
const ma=host.children.flatMap(x=>x.children||[]);
assert(!t.includes('source verified from manual check'));
assert.match(t,/ME — Supplemental source ID/);
assert.match(t,/NC — Reported votes · unofficial/);
const failureHost=node('div');
assert(api.render(failureHost,secondary,{createElement:node}));
const failures=flatten(failureHost);
assert.match(failures,/ME — Supplemental source request FAILED/);
assert.match(failures,/OH-special — Supplemental source stale/);
assert.match(failures,/NH — Supplemental source request in progress/);
assert.match(t,/not.*race calls/i);
const unsafe=node('div');
assert(api.render(unsafe,pulse,{createElement:node},[{
 race_ids:['Senate|MA'],url:'javascript:alert(1)',mode:'certified_only_not_election_night'
}]));
assert(!flatten(unsafe).includes('Official manual check'));
const blocked=node('div');
const noOtherLinks=official.links.filter(x=>x.state!=='NH').map(x=>x.state==='AK'?{
 ...x,url:'javascript:invalid()'}:x);
api.render(blocked,pulse,{createElement:node},noOtherLinks);
assert(!flatten(blocked).includes('House AK-00 — No verified automated source ID  · Check official election office'),
 'An unsafe manual link must never be rendered as a clickable fallback');
console.log('506-race on-screen triage: real provider source, unavailable, zero-not-ballots, all 35 Senate and failures PASS');
