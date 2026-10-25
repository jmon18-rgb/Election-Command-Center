#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
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
// Allocate source-research effort from the EXISTING linked joint model,
// never by assuming party winners or turning a forecast into a vote.
const modelForAttention=[
 {office:'house',race_code:'AK-01',dem_beats_rep_pct:48,rep_beats_dem_pct:52},
 {office:'house',race_code:'NH-01',dem_beats_rep_pct:61,rep_beats_dem_pct:39},
 {office:'house',race_code:'NH-02',dem_beats_rep_pct:88,rep_beats_dem_pct:12},
 {office:'house',race_code:'DE-01',dem_beats_rep_pct:98,rep_beats_dem_pct:2},
 {office:'house',race_code:'ND-01',dem_beats_rep_pct:1,rep_beats_dem_pct:99},
 {office:'house',race_code:'SD-01',dem_beats_rep_pct:7,rep_beats_dem_pct:93},
 {office:'house',race_code:'WY-01',dem_beats_rep_pct:0.1,rep_beats_dem_pct:99.9},
 {office:'senate',race_code:'MA-SEN',dem_beats_rep_pct:96,rep_beats_dem_pct:4},
];
const policy=api.build(ledger,res,state,now,{},modelForAttention);
// Discovery is a LIVE generated 506-race ledger: a newly invalidated race
// (for example AL-07's Oct 25 INVALID_DETAIL) must become a ninth gap,
// rather than failing tests or silently retaining stale provider assurance.
const actualGapIds=ledger.races.filter(r=>
 r.gap_status==='UNRESOLVED_SOURCE_GAP').map(r=>r.id);
const modelFixtureIds=new Set(['House|AK-00','House|NH-01','House|NH-02',
 'House|DE-00','House|ND-00','House|SD-00','House|WY-00','Senate|MA']);
const newlyInvalid=actualGapIds.filter(id=>!modelFixtureIds.has(id));
assert.equal(policy.gapAttention.races.length,actualGapIds.length);
assert.equal(policy.gapAttention.active,3,
 'Missing NH House districts and AK ballot remain active at sub-90 odds in fixture');
assert.equal(policy.gapAttention.lightChecks,5);
assert.equal(policy.gapAttention.needsOdds,newlyInvalid.length,
 'New source gaps without linked odds must stay under odds review');
assert.deepEqual(policy.gapAttention.races.slice(0,3).map(x=>x.id),
 ['House|AK-00','House|NH-01','House|NH-02']);
assert.equal(policy.gapAttention.races.find(x=>x.id==='House|DE-00').mode,
 'LIGHT_MANUAL_CHECK','Only a LINKED model can permit the manual-check category');
assert.equal(policy.gapAttention.races.find(x=>x.id==='Senate|MA').mode,
 'LIGHT_MANUAL_CHECK');
assert.equal(policy.totals.House.reported,1);
assert.equal(policy.professional_calls_verified,0);
assert.equal(policy.may_update_model,false);
const noModel=api.build(ledger,res,state,now,{},[]);
assert.equal(noModel.gapAttention.needsOdds,actualGapIds.length,
 'No linked probabilities means unknown, not falsely safe seats');
assert.equal(noModel.gapAttention.lightChecks,0);
const onlyDem=api.priorityGaps([{office:'House',id:'House|DE-00'}],[
 {office:'house',race_code:'DE-01',dem_beats_rep_pct:99}]);
assert.equal(onlyDem.needsOdds,1,
 'Missing other-party probability cannot identify a safe source gap');
const badDraw=api.priorityGaps([{office:'Senate',id:'Senate|MA'}],[
 {office:'senate',race_code:'MA-SEN',dem_beats_rep_pct:99,
  rep_beats_dem_pct:16}]);
assert.equal(badDraw.needsOdds,1,
 'Inconsistent model draw cannot turn uncertain evidence into safe outcome');
const independent=api.priorityGaps([{office:'Senate',id:'Senate|NE'}],[
 {office:'senate',race_code:'NE-SEN',dem_beats_rep_pct:92,
  rep_beats_dem_pct:3}]);
assert.equal(independent.needsOdds,1,
 'Independent/third party outcomes cannot be mislabeled two-party safe');
const threshold=api.priorityGaps([
 {office:'House',id:'House|DE-00'},{office:'House',id:'House|AK-00'}],[
 {office:'house',race_code:'DE-01',dem_beats_rep_pct:90,rep_beats_dem_pct:10},
 {office:'house',race_code:'AK-01',dem_beats_rep_pct:89.9,rep_beats_dem_pct:10.1}]);
assert.equal(threshold.lightChecks,1);
assert.equal(threshold.active,1);
assert.equal(policy.unverifiedMachineIds.length,noModel.unverifiedMachineIds.length,
 'Editorial deprioritization is NEVER deleting a live-results gap');
// Test the REAL browser's gap discovery helper, including linked model
// generation validity. Close House races outside screenshot top-N must be
// placed in the civicAPI source-check queue, never merely displayed as text.
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const helperStart=html.indexOf('function enActiveGapItems(){');
const helperEnd=html.indexOf('function smartModelMap(){',helperStart);
assert(helperStart>0&&helperEnd>helperStart);
assert.match(html,/\.\.\.enActiveGapItems\(\),\.\.\.enNationalWatchItems\(\)/,
 'Real source polling queue must include close missing identity gaps');
assert.match(html,/enAutoTracked\(item\)\|\|enActiveGapItems\(\)/,
 'The exact supplemental source validation must consider those gaps tracked');
const context={enModeYear:2026,enPublishedCoverageLedger:ledger,
 jointLastResult:{race_probabilities:modelForAttention},
 jointBasis:{generated_from_sources:{model_polling_at:'2026-10-25T18:00:00Z'}},
 latestSenateEstimates:{generated_at:'2026-10-25T18:00:00Z'},
 window:{ElectionNightCoverageTriage:api}};
const liveGapItems=vm.runInNewContext(
 html.slice(helperStart,helperEnd)+'\nenActiveGapItems',context);
assert.equal(JSON.stringify(liveGapItems()),JSON.stringify([
 {office:'House',key:'AK-00'},{office:'House',key:'NH-01'},
 {office:'House',key:'NH-02'}]));
context.jointBasis.generated_from_sources.model_polling_at='2026-10-24T00:00:00Z';
assert.equal(liveGapItems().length,0,
 'Outdated joint model cannot allocate live-source capacity');
context.jointBasis.generated_from_sources.model_polling_at='2026-10-25T18:00:00Z';
context.jointLastResult={race_probabilities:[]};
assert.equal(liveGapItems().length,0,'No trusted odds means no false active ranking');
context.enPublishedCoverageLedger=null;
assert.equal(liveGapItems().length,0,'Missing source ledger cannot invent race work');


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
assert.equal(stalePulse.lastValidVoteSourceAt,'2026-11-04T02:54:00.000Z');
assert.equal(stalePulse.lastValidVoteAgeMinutes,6);
assert.equal(stalePulse.lastValidVoteRace,'House|TX-01');
assert.equal(stalePulse.lastValidVoteByOffice.Senate.source_at,'2026-11-04T02:54:00.000Z');
assert.equal(stalePulse.lastValidVoteByOffice.House.age_minutes,6);
assert.equal(stalePulse.lastValidVoteByOffice.Governor.source_at,null);
assert.equal(stalePulse.lastValidVoteByOffice.Governor.has_current_sourced_votes,false);
const slowerSenate={...res,records:{...res.records,
 'Senate|NC':{...res.records['Senate|NC'],
 sourceAsOf:'2026-11-04T02:35:00Z'}}};
const separate=api.build(ledger,slowerSenate,state,now);
assert.equal(separate.lastValidVoteByOffice.Senate.age_minutes,25);
assert.equal(separate.lastValidVoteByOffice.House.age_minutes,6);
assert.equal(separate.lastValidVoteAgeMinutes,6);

const offNight=Date.parse('2026-11-02T12:00:00Z');
const offRecent={...ledger,generated_at:new Date(offNight-7*60*60000).toISOString()};
// There cannot be any real 2026 vote evidence on November 2. Exercise
// the identity-registry age rule with a zero-observation reconciliation.
const offNightNoVotes=results({snapshots:{}});
assert.equal(api.build(offRecent,offNightNoVotes,state,offNight).sourceIdentityAuditStale,false);
assert.equal(api.build({...ledger,generated_at:
 new Date(offNight-25*60*60000).toISOString()},offNightNoVotes,state,offNight)
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
assert.equal(noData.lastValidVoteSourceAt,null);
assert.equal(noData.lastValidVoteAgeMinutes,null);
assert.equal(noData.lastValidVoteRace,null);
assert.equal(noData.lastValidVoteByOffice.Senate.source_at,null);
assert.equal(noData.lastValidVoteByOffice.House.source_at,null);
assert.equal(noData.lastValidVoteByOffice.Governor.source_at,null);
assert.equal(noData.senate.find(x=>x.id==='Senate|NC').status,'PRIMARY_AWAITING');
for(const corrupt of [
 {...ledger,races:ledger.races.slice(1)},
 {...ledger,races:[ledger.races[0],...ledger.races.slice(1,505),ledger.races[0]]},
 {...ledger,generated_at:'2026-11-05T00:00:00Z'},
 {...ledger,status:'VERIFIED_ALL_LIVE_RESULTS'}
])assert.throws(()=>api.build(corrupt,res,state,now));
const staleVoteStamp={...res,records:{...res.records,
 'House|TX-01':{...res.records['House|TX-01'],
 sourceAsOf:'2026-11-03T23:00:00Z'}}};
assert.throws(()=>api.build(ledger,staleVoteStamp,state,now),
 /Missing\/stale\/future provider timestamp/);
const absentVoteStamp={...res,records:{...res.records,
 'Senate|NC':{...res.records['Senate|NC'],sourceAsOf:null}}};
assert.throws(()=>api.build(ledger,absentVoteStamp,state,now),
 /Missing\/stale\/future provider timestamp/);
const futureVoteStamp={...res,records:{...res.records,
 'Senate|NC':{...res.records['Senate|NC'],
 sourceAsOf:'2026-11-04T03:15:01Z'}}};
assert.throws(()=>api.build(ledger,futureVoteStamp,state,now),
 /Missing\/stale\/future provider timestamp/);
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
const expectedHost=node('div');
assert.equal(api.render(expectedHost,policy,{createElement:node},official.links),true);
const flatten=x=>[x.textContent,...x.children.flatMap(flatten)].join(' ');
const riskText=flatten(expectedHost);
const editorial=official.public_editorial_calls;
const editorialHost=node('div');
assert.equal(api.render(editorialHost,policy,{createElement:node},
 official.links,editorial),true);
const allEls=x=>[x,...x.children.flatMap(allEls)];
const anchored=allEls(editorialHost).filter(x=>x.tag==='a');
const ddhq=anchored.filter(x=>x.textContent.includes('DDHQ free race results / call'));
assert.equal(ddhq.length,editorial.race_pages.filter(x=>
 policy.gapAttention.races.some(r=>r.id===x.id)).length,
 'Each unresolved race needs its exact verified newsroom page');
const targets=new Map(editorial.race_pages.map(x=>[x.id,x.url]));
assert.equal(targets.size,editorial.race_pages.length);
assert.deepEqual(new Set(ddhq.map(a=>a.href)),new Set(
 editorial.race_pages.filter(x=>policy.gapAttention.races.some(r=>r.id===x.id))
  .map(x=>x.url)));
assert(ddhq.some(a=>a.href.endsWith('/alabama-us-house-7-general-election/results')),
 'AL-07 detail-invalid gap needs an exact read-only source fallback');
assert(ddhq.every(a=>a.href.startsWith('https://votes.decisiondeskhq.com/races/2026-11-03/')));
assert(ddhq.every(a=>a.target==='_blank'&&a.rel==='noopener noreferrer'));
assert.match(flatten(editorialHost),/DDHQ public X race-call feed/);
assert.match(flatten(editorialHost),/media calls are unofficial/);
assert.equal(policy.professional_calls_verified,0,
 'Manual-check links cannot invent verified provider race calls');
assert.equal(policy.unverifiedMachineIds.length,pendingIds.length,
 'DDHQ web pages cannot erase dynamically unresolved machine race IDs');
const forged={...editorial,race_pages:[...editorial.race_pages.slice(1),
 {id:'House|AK-00',url:'javascript:alert(1)'}],
 newsroom_social:'javascript:alert(2)'};
const denied=node('div');
api.render(denied,policy,{createElement:node},official.links,forged);
assert.equal(allEls(denied).filter(x=>x.tag==='a'&&
 x.textContent.includes('DDHQ free race results / call')).length,ddhq.length-1,
 'Unsafe newsroom link is never opened or substituted');
assert(!flatten(denied).includes('DDHQ public X race-call feed'));
const duplicates={...editorial,race_pages:editorial.race_pages.concat(editorial.race_pages[0])};
const ambiguous=node('div');
api.render(ambiguous,policy,{createElement:node},official.links,duplicates);
assert.equal(allEls(ambiguous).filter(x=>x.tag==='a'&&
 x.textContent.includes('DDHQ free race results / call')).length,ddhq.length-1,
 'Duplicate curated links for the same ballot cannot be treated as verified');

assert.match(riskText,/Active live-source search: 3/);
assert.match(riskText,/Lightweight manual check: 5/);
assert.match(riskText,/House AK-00 — LIVE SOURCE PRIORITY/);
assert.match(riskText,/Senate MA — LIGHT CHECK/);
assert.match(riskText,/forecast only; no verified votes or race call/);
assert.match(riskText,/Manual official page/);

const t=flatten(host);
const staleHost=node('div');
assert.equal(api.render(staleHost,stalePulse,{createElement:node},official.links),true);
assert.match(flatten(staleHost),/SOURCE-ID AUDIT OVERDUE/);
assert.match(flatten(staleHost),/Election Night External Source Preflight/);
assert.equal(t.includes('SOURCE-ID AUDIT OVERDUE'),
 pulse.sourceIdentityAuditStale,
 'The visible warning must reflect only the audit-age flag');

assert.match(t,/House 1\/435 · Senate 1\/35 · Governors 0\/36/);
assert.match(t,/LATEST VALID SOURCE-PUBLISHED VOTES · 2026-11-04T02:54:00.000Z/);
assert.match(t,/SOURCE PUBLICATION BY OFFICE · Senate 6m old/);
assert.match(t,/House 6m old/);
assert.match(t,/Governor NO CURRENT VALIDATED VOTE/);
const separateHost=node('div');
api.render(separateHost,separate,{createElement:node});
assert.match(flatten(separateHost),/Senate 25m old/);
assert.match(flatten(separateHost),/House 6m old/);
assert.match(t,/6m old · House\|TX-01/);
const noVotesHost=node('div');
api.render(noVotesHost,noData,{createElement:node});
assert.match(flatten(noVotesHost),/NO CURRENT VALIDATED 2026 VOTE TIMESTAMP/);
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
assert.match(t,/House SD-00 — No verified automated source ID/);
assert.match(t,/MOCK\/TEST source; DO NOT use as votes/,
 'Official South Dakota pre-election numbers must be labeled mock in House gap desk');
assert.match(t,/House NH-01 — No verified automated source ID/);
assert.match(t,/may publish only after reporting/,
 'NH official House report link is not a real-time source promise');
assert.equal((t.match(/NH local unofficial returns/g)||[]).length,2,
 'Provide an additional NH town-return viewer for both congressional districts');
assert.match(t,/volunteer town reports, not official returns or automated vote coverage/);
const nhNoCommunity=official.links.map(x=>x.state==='NH'?{...x,
 community_unofficial_check:{...x.community_unofficial_check,
 url:'javascript:forged()'}}:x);
const unsafeNH=node('div');
api.render(unsafeNH,pulse,{createElement:node},nhNoCommunity);
assert(!flatten(unsafeNH).includes('NH local unofficial returns'),
 'A volunteer link must use its audited exact HTTPS URL');
assert.match(t,/MA — No verified automated source ID/);
assert.match(t,/Boston unofficial municipal results/);
assert.match(t,/BOSTON ONLY, not statewide/);
assert.match(t,/currently September primary/);
const maUnsafe=official.links.map(x=>x.state==='MA'?{...x,
 municipal_unofficial_check:{...x.municipal_unofficial_check,
 url:'javascript:alert(1)'}}:x);
const maUnsafeHost=node('div');
api.render(maUnsafeHost,pulse,{createElement:node},maUnsafe);
assert(!flatten(maUnsafeHost).includes('Boston unofficial municipal results'),
 'The municipal fallback must require the exact independently checked HTTPS page');
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
