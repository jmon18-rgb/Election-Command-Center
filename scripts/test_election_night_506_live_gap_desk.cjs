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
// Election-night exact source-ID audits should be refreshed within six hours.
// A stale registry must never invalidate independent 2026 vote evidence.
const freshLedger={...ledger,generated_at:new Date(now-60*60000).toISOString()};
const atSixHours={...ledger,generated_at:new Date(now-6*60*60000).toISOString()};
const tooOld={...ledger,generated_at:new Date(now-(6*60+1)*60000).toISOString()};
assert.equal(api.build(freshLedger,res,state,now).sourceIdentityAuditStale,false);
assert.equal(api.build(atSixHours,res,state,now).sourceIdentityAuditStale,false);
const stalePulse=api.build(tooOld,res,state,now);
assert.equal(stalePulse.sourceIdentityAuditStale,true);
assert.equal(stalePulse.sourceIdentityAuditMaxAgeHours,6);
assert.equal(stalePulse.totals.House.reported,1);
assert.equal(stalePulse.totals.Senate.reported,1);
assert.equal(stalePulse.professional_calls_verified,0);
const offNight=Date.parse('2026-11-02T12:00:00Z');
const offRecent={...ledger,generated_at:new Date(offNight-7*60*60000).toISOString()};
assert.equal(api.build(offRecent,res,state,offNight).sourceIdentityAuditStale,false);
assert.equal(api.build({...ledger,generated_at:
 new Date(offNight-25*60*60000).toISOString()},res,state,offNight)
 .sourceIdentityAuditStale,true);
assert.deepEqual(Object.keys(pulse.totals),['House','Senate','Governor']);
assert.deepEqual([pulse.totals.House.total,pulse.totals.Senate.total,
 pulse.totals.Governor.total],[435,35,36]);
assert.deepEqual([pulse.totals.House.reported,pulse.totals.Senate.reported,
 pulse.totals.Governor.reported],[1,1,0]);
assert.deepEqual([pulse.totals.House.zero,pulse.totals.Senate.zero,
 pulse.totals.Governor.zero],[1,0,1]);
assert.equal(pulse.senate.length,35);
const pendingIds=ledger.races.filter(row=>
 row.source_identity_status==='NO_CURATED_PROVIDER_ID'&&
 !(row.verified_identity_hint_usable===true&&
   row.gap_status==='RECENT_EXACT_PROBE_NOT_LIVE_VERIFIED'));
const otherPending=pendingIds.filter(row=>row.office!=='Senate');
assert.deepEqual(pulse.unverifiedMachineIds.map(x=>x.id).sort(),
 pendingIds.map(x=>x.id).sort(),
 'On-screen unpinned IDs must track the latest generated source ledger');
assert(!pulse.unverifiedMachineIds.some(x=>x.id==='House|CA-13'),
 'Independently verified exact 2026 House ID hints cannot be labeled unknown');
const identityHints=ledger.races.filter(row=>row.office==='House'&&
 row.source_identity_status==='NO_CURATED_PROVIDER_ID'&&
 row.verified_identity_hint_usable===true&&
 row.gap_status==='RECENT_EXACT_PROBE_NOT_LIVE_VERIFIED');
assert.equal(pulse.totals.House.byStatus.SECONDARY_NOT_QUERIED,identityHints.length,
 'Exact House discovery IDs remain unreported votes, not missing machine IDs');
if(identityHints.length){
 const key=identityHints[0].id;
 const lastHintFailed=api.build(ledger,res,state,now,{[key]:'failed'});
 assert.equal(lastHintFailed.totals.House.byStatus.SECONDARY_FAILED,1,
  'Independently observed source failure must override a saved House identity hint');
 assert.equal(lastHintFailed.unverifiedMachineIds.length,pendingIds.length,
  'A failed lookup must not manufacture a new missing machine identity');
}
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
const staleHost=node('div');
assert.equal(api.render(staleHost,stalePulse,{createElement:node},official.links),true);
assert.match(flatten(staleHost),/SOURCE-ID AUDIT OVERDUE/);
assert.match(flatten(staleHost),/Election Night External Source Preflight/);
assert.equal(t.includes('SOURCE-ID AUDIT OVERDUE'),
 pulse.sourceIdentityAuditStale,
 'The visible warning must reflect only the audit-age flag');

assert.match(t,/House 1\/435 · Senate 1\/35 · Governors 0\/36/);
assert.match(t,/Senate source gaps · 34/);
if(otherPending.length){
 assert(t.includes('Unpinned House / governor source IDs · '+otherPending.length));
 for(const row of otherPending)
  assert(t.includes(row.id.replace('|',' ')+' — No verified automated source ID'),
   'Missing exact on-screen source identity '+row.id);
 const linkCount=otherPending.filter(row=>
  official.links.some(link=>Array.isArray(link.race_ids)&&
   link.race_ids.includes(row.id)&&link.url.startsWith('https://'))).length;
 assert.equal((t.match(/Check official election office/g)||[]).length,linkCount,
  'Only audited https official links can appear for unresolved House/governor rows');
}
assert.match(t,/MA — No verified automated source ID/);
assert.match(t,/certified results only; NOT live/);
assert.match(t,/MS — Supplemental source ID · no current results/);
assert(!t.includes('MS — No verified automated source ID'),
 'New independently pinned Mississippi Senate source is not an unindexed gap');
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
