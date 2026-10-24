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
assert.equal(pulse.senateMissing,34);
assert.equal(pulse.senate.find(x=>x.id==='Senate|NC').status,'OBSERVED_SOURCE_VOTES');
assert.equal(pulse.senate.find(x=>x.id==='Senate|TX').status,'PRIMARY_RACE_ABSENT');
assert.equal(pulse.senate.find(x=>x.id==='Senate|ME').status,'SECONDARY_NOT_QUERIED');
assert.equal(pulse.senate.find(x=>x.id==='Senate|MA').status,'NO_MACHINE_SOURCE_ID');
assert.equal(pulse.senate.find(x=>x.id==='Senate|NH').status,'SECONDARY_SCOPED');
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
assert.equal(api.render(host,pulse,{createElement:node}),true);
const flatten=x=>[x.textContent,...x.children.flatMap(flatten)].join(' ');
const t=flatten(host);
assert.match(t,/House 1\/435 · Senate 1\/35 · Governors 0\/36/);
assert.match(t,/Senate source gaps · 34/);
assert.match(t,/MA — No verified automated source ID/);
assert.match(t,/ME — Supplemental source ID/);
assert.match(t,/NC — Reported votes · unofficial/);
assert.match(t,/not.*race calls/i);
console.log('506-race on-screen triage: real provider source, unavailable, zero-not-ballots, all 35 Senate and failures PASS');
