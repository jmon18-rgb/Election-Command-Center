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
const previews=anchored.filter(x=>x.textContent.includes('DDHQ preview (results unverified)'));
const candidateGuides=anchored.filter(x=>x.textContent.includes('WBUR candidate guide (results unverified)'));
assert.equal(ddhq.length,editorial.race_pages.filter(x=>
 policy.gapAttention.races.some(r=>r.id===x.id)&&!x.link_role).length,
 'Each base/result reference retains the original exact newsroom-page behavior');
assert.equal(ddhq.length+previews.length+candidateGuides.length,editorial.race_pages.filter(x=>
 policy.gapAttention.races.some(r=>r.id===x.id)).length,
 'Each unresolved race needs a manual reference; previews remain visibly distinct from Results routes');
const targets=new Map(editorial.race_pages.map(x=>[x.id,x.url]));
assert.equal(targets.size,editorial.race_pages.length);
assert.deepEqual(new Set([...ddhq,...previews,...candidateGuides].map(a=>a.href)),new Set(
 editorial.race_pages.filter(x=>policy.gapAttention.races.some(r=>r.id===x.id))
  .map(x=>x.url)));
if(actualGapIds.includes('House|AL-07'))assert(ddhq.some(a=>a.href.endsWith('/alabama-us-house-7-general-election/results')),
 'AL-07 detail-invalid gap needs an exact read-only source fallback');
assert(ddhq.every(a=>a.href.startsWith('https://votes.decisiondeskhq.com/races/2026-11-03/')));
assert(ddhq.every(a=>a.target==='_blank'&&a.rel==='noopener noreferrer'));
assert(previews.every(a=>a.target==='_blank'&&a.rel==='noopener noreferrer'));
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
const senateScopeList=allEls(host).find(el=>el.className==='en-coverage-senate-gaps');
assert.equal((flatten(senateScopeList).match(/certified results only; NOT live/g)||[]).length,2,
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

// A discovered exact House ID can fail just like a permanently pinned Senate
// ID. Neither an earlier attempt nor an in-flight request may hide a breaker.
const knownHouse=ledger.races.find(r=>r.id==='House|CA-13');
assert(knownHouse?.verified_identity_hint_usable);
for(const fields of [{attempted:true},{pending:true},{cached:true,usable:false},{}]){
 assert.equal(api.supplementalState(knownHouse,{...fields,providerBlocked:true}),'failed');
}
assert.equal(api.supplementalState(knownHouse,{cached:true,usable:false}),'stale');
assert.equal(api.supplementalState(knownHouse,{pending:true}),'pending');
assert.equal(api.supplementalState(knownHouse,{attempted:true}),'attempted');
const unknownHouse=ledger.races.find(r=>r.id==='House|NH-01');
assert.equal(api.supplementalState(unknownHouse,{providerBlocked:true}),null,
 'A provider outage cannot manufacture a verified identity for an unknown race');
const operationalModel=[
 {office:'house',race_code:'CA-13',dem_beats_rep_pct:50,rep_beats_dem_pct:50},
 {office:'senate',race_code:'ME-SEN',dem_beats_rep_pct:53,rep_beats_dem_pct:47}
];
const operational=api.build(ledger,res,state,now,{
 'House|CA-13':'failed','Senate|ME':'stale'
},operationalModel);
assert.equal(operational.operationalAttention.active,2);
assert.deepEqual(operational.operationalAttention.races.map(r=>r.id),['House|CA-13','Senate|ME']);
assert(!operational.unverifiedMachineIds.some(r=>r.id==='House|CA-13'),
 'Source recovery and source identity are independent worklists');
assert.equal(operational.totals.House.reported,pulse.totals.House.reported);
assert.equal(operational.professional_calls_verified,0);
const operationalHost=node('div');
api.render(operationalHost,operational,{createElement:node},official.links);
assert.match(flatten(operationalHost),/SOURCE RECOVERY · 2 affected feeds/);
assert.match(flatten(operationalHost),/2 competitive races · 0 affected races need model review/);
assert.match(flatten(operationalHost),/House CA-13 — COMPETITIVE/);
assert.match(flatten(operationalHost),/Senate ME — COMPETITIVE/);
assert.match(flatten(operationalHost),/reference only; not verified live votes or a race call/);
const manualRecoveryHost=node('div');
api.render(manualRecoveryHost,operational,{createElement:node},official.links,editorial);
const manualRecoveryLinks=allEls(manualRecoveryHost).filter(el=>el.tag==='a'&&el.textContent.includes('Manual DDHQ race page'));
assert.equal(manualRecoveryLinks.length,1,
 'Verified CA-13 editorial fallback must work for a failed known-ID feed');
assert.equal(manualRecoveryLinks[0].href,
 'https://votes.decisiondeskhq.com/races/2026-11-03/california-us-house-13-general-election/results');
assert.equal(manualRecoveryLinks[0].rel,'noopener noreferrer');
assert.match(flatten(manualRecoveryHost),/verify an explicit race call, not a forecast/);
assert.equal(operational.professional_calls_verified,0);
assert.equal(operational.totals.House.reported,pulse.totals.House.reported,
 'Adding a human fallback does not promote a provider outage into live coverage');
assert.equal(api.build(ledger,res,state,now,{},operationalModel).operationalAttention.races.length,0,
 'Resolved source errors leave the recovery queue without creating votes');
assert.equal(api.build(ledger,res,state,now,{'House|CA-13':'pending'},operationalModel)
 .operationalAttention.races.length,0,'Routine pending checks are not declared failures');
const noOddsFailure=api.build(ledger,res,state,now,{'House|CA-13':'failed'});
assert.equal(noOddsFailure.operationalAttention.needsOdds,1,
 'A failed feed with missing model odds is unknown, never a safe seat');
const unknownHost=node('div');
api.render(unknownHost,noOddsFailure,{createElement:node});
assert.match(flatten(unknownHost),/SOURCE RECOVERY · 1 affected feeds/,
 'Unknown model odds must not make a failed feed look like zero issues');
assert.match(html,/ElectionNightCoverageTriage\.supplementalState\(item,/,
 'The actual browser must use the same tested recovery classifier');
console.log('Competitive source recovery: exact-ID hints, prior attempts, failure priority and recovery PASS');

for(const [mode,warning] of [
 ['county_results_directory_only','county links ONLY; NO statewide Election Night results'],
 ['pre_election_mock_results_only','MOCK/TEST source; DO NOT use as votes'],
 ['certified_only_not_election_night','certified results only; NOT live'],
 ['november_2026_results_not_yet_published','2026 returns NOT YET published']
]){
 const scopePulse={...operational,
  gapAttention:{...operational.gapAttention,races:[{id:'House|NJ-07',mode:'ACTIVE_LIVE_SOURCE'}]},
  operationalAttention:{...operational.operationalAttention,
   races:[{id:'House|NJ-07',mode:'ACTIVE_LIVE_SOURCE',sourceStatus:'SECONDARY_FAILED'}]}};
 const host=node('div');
 api.render(host,scopePulse,{createElement:node},[
  {race_ids:['House|NJ-07'],url:'https://www.nj.gov/state/elections/election-night-results.shtml',mode}]);
 for(const cls of ['en-coverage-recovery','en-coverage-priority']){
  const section=allEls(host).find(el=>el.className===cls);
  assert.match(flatten(section),new RegExp(warning),
   cls+' must keep the official reference limitation beside its link');
 }
 assert.equal(scopePulse.professional_calls_verified,0);
}
console.log('Official reference scope warnings remain visible in recovery and priority rows PASS');

const qualifiedPreviews=editorial.race_pages.filter(row=>row.link_role==='forecast_preview_not_results');
assert.deepEqual(qualifiedPreviews.map(row=>row.id).sort(),
 ['House|KY-01','House|KY-04','House|KY-05','House|ME-02','House|NE-02','House|NV-03']);
for(const row of qualifiedPreviews){
 const scopePulse={...policy,
  gapAttention:{...policy.gapAttention,races:[{id:row.id,mode:'ACTIVE_LIVE_SOURCE'}]},
  operationalAttention:{...operational.operationalAttention,
   races:[{id:row.id,mode:'ACTIVE_LIVE_SOURCE',sourceStatus:'SECONDARY_FAILED'}]}};
 const renderOne=entry=>{const host=node('div');api.render(host,scopePulse,{createElement:node},official.links,
  {...editorial,race_pages:[entry]});return allEls(host).filter(el=>el.tag==='a'&&
   el.textContent.includes('DDHQ preview (results unverified)'));};
 const anchors=renderOne(row);
 assert.equal(anchors.length,2,'Both recovery and priority paths expose the qualified preview: '+row.id);
 for(const anchor of anchors){assert.equal(anchor.href,row.url);assert.equal(anchor.title,row.scope_note);
  assert.equal(anchor.target,'_blank');assert.equal(anchor.rel,'noopener noreferrer');}
 for(const changes of [{id:'House|AK-00'},{url:row.url+'?results=1'},
  {url:row.url.replace(/\/forecast$/,'')},{link_role:undefined},{link_role:'results'},
  {verification_scope:'native_results'},{source_reference:'https://votes.decisiondeskhq.com/'},
  {results_link_verified:true},{current_access_verified:true},
  {current_access_status:'AVAILABLE'},{scope_note:'Forecast'}]){
  assert.equal(renderOne({...row,...changes}).length,0,'Reject unqualified preview mutation '+row.id+JSON.stringify(changes));
 }
 assert.equal(scopePulse.professional_calls_verified,0);
 assert.equal(scopePulse.totals.House.reported,policy.totals.House.reported);
}
// Exercise the actual official-anchor loop without a fetch, app/model start,
// or a replacement production function. Only the exact qualified KY/NV rows
// may use the administrative-reference label and source-limit tooltip.
const officialLoopStart=html.indexOf('   for(const link of listing.links){');
const officialLoopEnd=html.indexOf('   const unresolved=',officialLoopStart);
assert(officialLoopStart>0&&officialLoopEnd>officialLoopStart);
const officialLoop=html.slice(officialLoopStart,officialLoopEnd);
const renderOfficial=links=>{
 const backstops=node('div'),requested=new Set(links.flatMap(row=>row.race_ids||[]));
 backstops.append=(...children)=>backstops.children.push(...children);
 const make=(tag,cls,text)=>{const value=node(tag);value.textContent=text||'';
  value.append=(...children)=>value.children.push(...children);return value;};
 vm.runInNewContext(officialLoop,{listing:{links},backstops,requested,matched:new Set(),elt:make});
 return allEls(backstops).filter(el=>el.tag==='a');
};
for(const state of ['KY','NV']){
 const row=official.links.find(link=>link.state===state);
 const anchors=renderOfficial([row]);assert.equal(anchors.length,1);
 assert(anchors[0].textContent.includes('official reference (results unverified)'));
 assert.equal(anchors[0].href,row.url);assert.equal(anchors[0].title,row.scope_note);
 for(const changes of [{reference_role:'official_results'},{reference_role:false},
  {general_2026_results_verified:true},{primary_results_used_as_general_votes:true},
  {source_reference:'https://example.invalid/'},{url:row.url+'?results=1'},{scope_note:'Official results'}])
  assert.equal(renderOfficial([{...row,...changes}]).length,0,'Reject unsupported official-reference qualification');
}
const originalOfficial=official.links.find(row=>row.state==='AL');
assert(renderOfficial([originalOfficial])[0].textContent.includes('official results'));
console.log('Finite six search-only preview captions, qualification refusals and exact administrative-reference labels PASS');

// A scheduled hint withdrawal changes input coverage, never vote/call authority.
const ma04Official=official.links.find(row=>row.race_ids?.join('|')==='House|MA-01|House|MA-02|House|MA-03|House|MA-04|House|MA-05|House|MA-06|House|MA-07|House|MA-08|House|MA-09');
const ma04Guide=editorial.race_pages.find(row=>row.id==='House|MA-04');
assert(ma04Official&&ma04Guide);
const ma04AfterLedger=structuredClone(ledger),ma04After=ma04AfterLedger.races.find(row=>row.id==='House|MA-04');
assert(ma04After);ma04After.source_identity_status='NO_CURATED_PROVIDER_ID';
ma04After.gap_status='UNRESOLVED_SOURCE_GAP';ma04After.verified_identity_hint_usable=false;
const ma04BeforeLedger=structuredClone(ma04AfterLedger),ma04Before=ma04BeforeLedger.races.find(row=>row.id==='House|MA-04');
ma04Before.gap_status='RECENT_EXACT_PROBE_NOT_LIVE_VERIFIED';ma04Before.verified_identity_hint_usable=true;
const ma04BeforePulse=api.build(ma04BeforeLedger,res,state,now,{},modelForAttention);
const ma04AfterPulse=api.build(ma04AfterLedger,res,state,now,{},modelForAttention);
assert(!ma04BeforePulse.unverifiedMachineIds.some(row=>row.id==='House|MA-04'));
assert(ma04AfterPulse.unverifiedMachineIds.some(row=>row.id==='House|MA-04'));
assert.equal(ma04AfterPulse.unverifiedMachineIds.length,ma04BeforePulse.unverifiedMachineIds.length+1);
assert.equal(ma04AfterPulse.totals.House.reported,ma04BeforePulse.totals.House.reported);
assert.equal(ma04AfterPulse.professional_calls_verified,0);
const ma04Scope={...ma04AfterPulse,
 gapAttention:{...ma04AfterPulse.gapAttention,races:[ma04AfterPulse.gapAttention.races.find(row=>row.id==='House|MA-04')]},
 operationalAttention:{...ma04AfterPulse.operationalAttention,races:[{id:'House|MA-04',mode:'ODDS_UNVERIFIED',sourceStatus:'SECONDARY_FAILED'}]}};
const ma04Render=(entry,links=official.links)=>{const host=node('div');api.render(host,ma04Scope,{createElement:node},links,{...editorial,race_pages:entry?[entry]:[]});return host;};
const ma04Old=ma04Render(null,official.links.filter(row=>row!==ma04Official));
assert.equal(allEls(ma04Old).filter(row=>row.tag==='a'&&[ma04Official.url,ma04Guide.url].includes(row.href)).length,0,'Old catalog has no exact MA04 pair after hint loss');
const ma04New=ma04Render(ma04Guide),ma04Guides=allEls(ma04New).filter(row=>row.tag==='a'&&row.textContent.includes('WBUR candidate guide (results unverified)'));
assert.equal(ma04Guides.length,2,'Priority and recovery both show the qualified identity guide');
const ma04AllOfficial=allEls(ma04New).filter(row=>row.tag==='a'&&row.href===ma04Official.url);
assert.equal(ma04AllOfficial.length,2+ma04Scope.unverifiedMachineIds.filter(race=>race.office==='House'&&ma04Official.race_ids.includes(race.id)).length,'Exact priority/recovery links plus one directory link per current missing family ID');
assert.deepEqual(ma04AllOfficial.filter(row=>/Manual official (?:page|reference)/.test(row.textContent)).map(row=>row.textContent).sort(),
 [' · Manual official page ↗',' · Manual official reference ↗'].sort(),'Recovery and priority keep their exact official identity links');
for(const anchor of ma04Guides){assert.equal(anchor.href,ma04Guide.url);assert.equal(anchor.title,ma04Guide.scope_note);assert.equal(anchor.target,'_blank');assert.equal(anchor.rel,'noopener noreferrer');}
assert.match(flatten(ma04New),/candidate identities ONLY; NOT results or calls/);
for(const changes of [{id:'House|MA-03'},{url:ma04Guide.url+'?results=1'},
 {url:ma04Guide.url+'/'},{link_role:'results'},{source_reference:'https://www.wbur.org/'},
 {results_link_verified:true},{current_access_verified:true},{current_access_status:'AVAILABLE'},
 {verification_scope:'native_results'},{scope_note:'Results'}]){
 assert.equal(allEls(ma04Render({...ma04Guide,...changes})).filter(row=>row.tag==='a'&&row.textContent.includes('WBUR candidate guide')).length,0,'Reject unsupported MA04 guide '+JSON.stringify(changes));
}
const ma04OfficialAnchors=renderOfficial([ma04Official]);assert.equal(ma04OfficialAnchors.length,1);
assert(ma04OfficialAnchors[0].textContent.includes('official reference (results unverified)'));
assert.equal(ma04OfficialAnchors[0].href,ma04Official.url);
for(const changes of [{race_ids:['House|MA-03']},{race_ids:['House|MA-04','Senate|MA']},
 {url:ma04Official.url+'?results=1'},{reference_role:'official_results'},
 {source_reference:'https://www.sec.state.ma.us/'},{general_2026_results_verified:true},{scope_note:'Official results'}]){
 assert.equal(renderOfficial([{...ma04Official,...changes}]).length,0,'Reject unsupported MA04 official reference '+JSON.stringify(changes));
}
console.log('MA04 changing hint loss, exact candidate-guide pair, visible limits and negative identity guards PASS');

// Distinct MA05 hint loss is tested while retaining the entire original MA04 regression.
// A scheduled hint withdrawal changes input coverage, never vote/call authority.
const ma05Official=official.links.find(row=>row.race_ids?.join('|')==='House|MA-01|House|MA-02|House|MA-03|House|MA-04|House|MA-05|House|MA-06|House|MA-07|House|MA-08|House|MA-09');
const ma05Guide=editorial.race_pages.find(row=>row.id==='House|MA-05');
assert(ma05Official&&ma05Guide);
const ma05AfterLedger=structuredClone(ledger),ma05After=ma05AfterLedger.races.find(row=>row.id==='House|MA-05');
assert(ma05After);ma05After.source_identity_status='NO_CURATED_PROVIDER_ID';
ma05After.gap_status='UNRESOLVED_SOURCE_GAP';ma05After.verified_identity_hint_usable=false;
const ma05BeforeLedger=structuredClone(ma05AfterLedger),ma05Before=ma05BeforeLedger.races.find(row=>row.id==='House|MA-05');
ma05Before.gap_status='RECENT_EXACT_PROBE_NOT_LIVE_VERIFIED';ma05Before.verified_identity_hint_usable=true;
const ma05BeforePulse=api.build(ma05BeforeLedger,res,state,now,{},modelForAttention);
const ma05AfterPulse=api.build(ma05AfterLedger,res,state,now,{},modelForAttention);
assert(!ma05BeforePulse.unverifiedMachineIds.some(row=>row.id==='House|MA-05'));
assert(ma05AfterPulse.unverifiedMachineIds.some(row=>row.id==='House|MA-05'));
assert.equal(ma05AfterPulse.unverifiedMachineIds.length,ma05BeforePulse.unverifiedMachineIds.length+1);
assert.equal(ma05AfterPulse.totals.House.reported,ma05BeforePulse.totals.House.reported);
assert.equal(ma05AfterPulse.professional_calls_verified,0);
const ma05Scope={...ma05AfterPulse,
 gapAttention:{...ma05AfterPulse.gapAttention,races:[ma05AfterPulse.gapAttention.races.find(row=>row.id==='House|MA-05')]},
 operationalAttention:{...ma05AfterPulse.operationalAttention,races:[{id:'House|MA-05',mode:'ODDS_UNVERIFIED',sourceStatus:'SECONDARY_FAILED'}]}};
const ma05Render=(entry,links=official.links)=>{const host=node('div');api.render(host,ma05Scope,{createElement:node},links,{...editorial,race_pages:entry?[entry]:[]});return host;};
const ma05Old=ma05Render(null,official.links.filter(row=>row!==ma05Official));
assert.equal(allEls(ma05Old).filter(row=>row.tag==='a'&&[ma05Official.url,ma05Guide.url].includes(row.href)).length,0,'Old catalog has no exact MA05 pair after hint loss');
const ma05New=ma05Render(ma05Guide),ma05Guides=allEls(ma05New).filter(row=>row.tag==='a'&&row.textContent.includes('WBUR candidate guide (results unverified)'));
assert.equal(ma05Guides.length,2,'Priority and recovery both show the qualified identity guide');
const ma05AllOfficial=allEls(ma05New).filter(row=>row.tag==='a'&&row.href===ma05Official.url);
assert.equal(ma05AllOfficial.length,2+ma05Scope.unverifiedMachineIds.filter(race=>race.office==='House'&&ma05Official.race_ids.includes(race.id)).length,'Exact priority/recovery links plus one directory link per current missing family ID');
assert.deepEqual(ma05AllOfficial.filter(row=>/Manual official (?:page|reference)/.test(row.textContent)).map(row=>row.textContent).sort(),
 [' · Manual official page ↗',' · Manual official reference ↗'].sort(),'Recovery and priority keep their exact official identity links');
for(const anchor of ma05Guides){assert.equal(anchor.href,ma05Guide.url);assert.equal(anchor.title,ma05Guide.scope_note);assert.equal(anchor.target,'_blank');assert.equal(anchor.rel,'noopener noreferrer');}
assert.match(flatten(ma05New),/candidate identities ONLY; NOT results or calls/);
for(const changes of [{id:'House|MA-03'},{url:ma05Guide.url+'?results=1'},
 {url:ma05Guide.url+'/'},{link_role:'results'},{source_reference:'https://www.wbur.org/'},
 {results_link_verified:true},{current_access_verified:true},{current_access_status:'AVAILABLE'},
 {verification_scope:'native_results'},{scope_note:'Results'}]){
 assert.equal(allEls(ma05Render({...ma05Guide,...changes})).filter(row=>row.tag==='a'&&row.textContent.includes('WBUR candidate guide')).length,0,'Reject unsupported MA05 guide '+JSON.stringify(changes));
}
const ma05OfficialAnchors=renderOfficial([ma05Official]);assert.equal(ma05OfficialAnchors.length,1);
assert(ma05OfficialAnchors[0].textContent.includes('official reference (results unverified)'));
assert.equal(ma05OfficialAnchors[0].href,ma05Official.url);
for(const changes of [{race_ids:['House|MA-03']},{race_ids:['House|MA-05','Senate|MA']},
 {url:ma05Official.url+'?results=1'},{reference_role:'official_results'},
 {source_reference:'https://www.sec.state.ma.us/'},{general_2026_results_verified:true},{scope_note:'Official results'}]){
 assert.equal(renderOfficial([{...ma05Official,...changes}]).length,0,'Reject unsupported MA05 official reference '+JSON.stringify(changes));
}
console.log('MA05 changing hint loss, exact candidate-guide pair, visible limits and negative identity guards PASS');

// Every supported family member needs its own exact identity row; another family member is not a match.
const maFamilyIds=['House|MA-01','House|MA-02','House|MA-03','House|MA-04','House|MA-05','House|MA-06','House|MA-07','House|MA-08','House|MA-09'];
for(const [i,id] of maFamilyIds.entries()){
 const guide=editorial.race_pages.find(row=>row.id===id);assert(guide,'Grounded candidate guide '+id);
 const scope={...ma05Scope,
  gapAttention:{...ma05Scope.gapAttention,races:[{...ma05Scope.gapAttention.races[0],id}]},
  operationalAttention:{...ma05Scope.operationalAttention,races:[{...ma05Scope.operationalAttention.races[0],id}]}};
 const renderEntry=entry=>{const host=node('div');api.render(host,scope,{createElement:node},official.links,{...editorial,race_pages:[entry]});return host;};
 const good=allEls(renderEntry(guide)).filter(a=>a.tag==='a'&&a.textContent.includes('WBUR candidate guide (results unverified)'));
 assert.equal(good.length,2,'Priority/recovery exact family guide '+id);
 assert(good.every(a=>a.href===guide.url&&a.title===guide.scope_note&&a.target==='_blank'&&a.rel==='noopener noreferrer'));
 const wrongId=maFamilyIds[(i+1)%maFamilyIds.length];
 for(const invalid of [{...guide,id:wrongId},{...guide,url:guide.url+'?results=1'},
  {...guide,link_role:'results'},{...guide,current_access_verified:true}]){
  assert.equal(allEls(renderEntry(invalid)).filter(a=>a.tag==='a'&&a.textContent.includes('WBUR candidate guide')).length,0,'Reject wrong context/qualification '+id);
 }
}
const unsupportedFamily={...ma05Guide,id:'House|MA-10'};
assert.equal(allEls(ma05Render(unsupportedFamily)).filter(a=>a.tag==='a'&&a.textContent.includes('WBUR candidate guide')).length,0);
for(const invalidIds of [[...maFamilyIds].reverse(),[...maFamilyIds,'Senate|MA'],maFamilyIds.slice(0,-1),Array(9).fill('House|MA-01')]){
 assert.equal(renderOfficial([{...ma05Official,race_ids:invalidIds}]).length,0,'Reject malformed finite official family');
}
console.log('Finite nine MA House candidate identities, per-race context and negative family guards PASS');
