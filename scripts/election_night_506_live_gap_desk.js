/* Election Night 506-race on-screen coverage TRIAGE, not polling,
 * forecasts, race calls, or estimated ballots. Never equate an indexed
 * race ID with actual observed results. Only independently reconciled
 * provider records may count as returned results.
 */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.ElectionNightCoverageTriage=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const EXPECTED=Object.freeze({House:435,Senate:35,Governor:36});
 const PRIMARY='Open America 22-state scope';
 const CHECKED=new Set(['reporting','current_no_votes']);
 const DEGRADED=new Set(['outage','invalid','stale','rechecking']);
 // The 2026 at-large ballot is 00 but the model's legacy seat code is 01.
 // Never apply this mapping to multi-district states such as New Hampshire.
 const AT_LARGE=new Set(['AK','DE','ND','SD','VT','WY']);
 const MIN_CONFIDENCE_FOR_LIGHT_CHECK=90;
 function supplementalState(race,{error=false,providerBlocked=false,
   cached=false,usable=false,pending=false,attempted=false}={}){
  const known=race?.source_identity_status==='PINNED_PREVIOUSLY_VERIFIED_ID'||
   race?.source_identity_status==='SCOPED_ADAPTER_NO_PINNED_ID'||
   race?.source_identity_status==='NO_CURATED_PROVIDER_ID'&&
    race.verified_identity_hint_usable===true&&
    race.gap_status==='RECENT_EXACT_PROBE_NOT_LIVE_VERIFIED';
  if(error||providerBlocked&&known)return 'failed';
  if(cached&&!usable)return 'stale';
  if(pending)return 'pending';
  if(attempted)return 'attempted';
  return null;
 }
 function priorityGaps(unverifiedMachineIds,probabilities=[]){
  const odds=new Map();
  if(Array.isArray(probabilities)){
   for(const p of probabilities){
    if(!p||!['house','senate','governor'].includes(p.office)||
       typeof p.race_code!=='string'||odds.has(p.office+'|'+p.race_code))continue;
    odds.set(p.office+'|'+p.race_code,p);
   }
  }
  const values=unverifiedMachineIds.map(race=>{
   const state=race.id.split('|')[1]?.slice(0,2);
   const code=race.office==='House'&&race.id.endsWith('-00')&&AT_LARGE.has(state)?
    state+'-01':race.office==='Senate'?
    state+'-SEN':race.office==='Governor'?
    state+'-GOV':race.id.split('|')[1];
   const p=odds.get(race.office.toLowerCase()+'|'+code);
   const d=p?.dem_beats_rep_pct,rep=p?.rep_beats_dem_pct;
   // A third-party/independent seat, missing probability or inconsistent
   // model draw is UNKNOWN, not a phantom safe R/D race.
   const valid=Number.isFinite(d)&&Number.isFinite(rep)&&d>=0&&d<=100&&
    rep>=0&&rep<=100&&Math.abs(d+rep-100)<0.25;
   const maximum=valid?Math.max(d,rep):null;
   const mode=!valid?'ODDS_UNVERIFIED':
    maximum>=MIN_CONFIDENCE_FOR_LIGHT_CHECK?'LIGHT_MANUAL_CHECK':
    'ACTIVE_LIVE_SOURCE';
   return {id:race.id,office:race.office,mode,maximum};
  });
  const order={ACTIVE_LIVE_SOURCE:0,ODDS_UNVERIFIED:1,LIGHT_MANUAL_CHECK:2};
  values.sort((a,b)=>order[a.mode]-order[b.mode]||
   (a.mode==='ACTIVE_LIVE_SOURCE'?
     (a.maximum??100)-(b.maximum??100):0)||
   (a.office==='Senate'?-1:0)-(b.office==='Senate'?-1:0)||
   a.id.localeCompare(b.id));
  return Object.freeze({
   cutoff_pct:MIN_CONFIDENCE_FOR_LIGHT_CHECK,
   active:values.filter(x=>x.mode==='ACTIVE_LIVE_SOURCE').length,
   needsOdds:values.filter(x=>x.mode==='ODDS_UNVERIFIED').length,
   lightChecks:values.filter(x=>x.mode==='LIGHT_MANUAL_CHECK').length,
   races:Object.freeze(values.map(x=>Object.freeze(x)))
  });
 }
 const LABELS=Object.freeze({
  OBSERVED_SOURCE_VOTES:'Reported votes · unofficial',
  ZERO_IN_FEED:'Source currently reports zero (not zero ballots cast)',
  PRIMARY_RACE_ABSENT:'Source connected; race absent (unknown)',
  PRIMARY_AWAITING:'Primary provider not yet reporting',
  PRIMARY_DEGRADED:'Primary provider unavailable / stale',
  SECONDARY_NOT_QUERIED:'Supplemental source ID · no current results',
  SECONDARY_FAILED:'Supplemental source request FAILED · counts unverified',
  SECONDARY_STALE:'Supplemental source stale / revalidation required',
  SECONDARY_CHECKING:'Supplemental source request in progress',
  SECONDARY_ATTEMPTED:'Supplemental race checked; no usable current count',
  SECONDARY_SCOPED:'Supplemental adapter · no verified source ID',
  NO_MACHINE_SOURCE_ID:'No verified automated source ID',
  PROVIDER_OTHER:'No verified vote source'
 });
 function build(ledger,reconciled,health={},now=Date.now(),supplementalHealth={},
                linkedModelProbabilities=[]){
  if(!Number.isFinite(now)||!ledger||
     ledger.election!=='2026-11-03'||
     ledger.status!=='SOURCE_IDENTITY_AUDIT_NOT_LIVE_RESULTS_COVERAGE'||
     !Array.isArray(ledger.races)||ledger.races.length!==506||
     !reconciled||reconciled.status!=='PARTIAL_SOURCED_VOTE_COVERAGE_NO_AUTHORITATIVE_CONTROL_CALLS'||
     !reconciled.records||reconciled.authoritativeCalls!==0)
   throw Error('Unverified national race inventory or source reconciliation');
  const ledgerTime=Date.parse(ledger.generated_at||'');
  if(!Number.isFinite(ledgerTime)||ledgerTime>now+15*60000)
   throw Error('Invalid future source identity audit');
  // A historical identity lookup can remain syntactically correct for days
  // while the upstream provider adds or changes exact race IDs. Warn rather
  // than blocking separately verified live votes or treating gaps as zero.
  const electionWindow=now>=Date.parse('2026-11-03T23:00:00Z')&&
      now<=Date.parse('2026-11-04T12:00:00Z');
  const maxIdentityAgeMs=(electionWindow?6:24)*60*60*1000;
  const sourceIdentityAuditAgeMs=Math.max(0,now-ledgerTime);
  const sourceIdentityAuditStale=sourceIdentityAuditAgeMs>maxIdentityAgeMs;
  const seen=new Set(),summary={};
  for(const name of Object.keys(EXPECTED))
   summary[name]={total:EXPECTED[name],reported:0,zero:0,missing:0,byStatus:{}};
  const records=[],unverifiedMachineIds=[],sourceFailures=[];
  let latestValidVoteTime=-Infinity,latestValidVoteRace=null;
  const lastByOffice={House:{time:-Infinity,race:null},
   Senate:{time:-Infinity,race:null},
   Governor:{time:-Infinity,race:null}};
  for(const race of ledger.races){
   if(!race||!EXPECTED[race.office]||typeof race.key!=='string'||
      race.id!==race.office+'|'+race.key||seen.has(race.id))
    throw Error('Invalid or duplicated national race identity');
   seen.add(race.id);
   const reconciledRecord=reconciled.records[race.id];
   if(!reconciledRecord||
      typeof reconciledRecord.inValidatedFeed!=='boolean'||
      typeof reconciledRecord.hasReportedVotes!=='boolean'||
      reconciledRecord.hasReportedVotes&&!reconciledRecord.inValidatedFeed)
    throw Error('Missing independently reconciled exact-race source state');
   let status;
   if(reconciledRecord.hasReportedVotes){
    status='OBSERVED_SOURCE_VOTES';
    const when=Date.parse(reconciledRecord.sourceAsOf||'');
    // A redraw and source ID audit cannot impersonate provider publication.
    if(!Number.isFinite(when)||when>now+15*60000||now-when>180*60000)
     throw Error('Missing/stale/future provider timestamp for sourced votes '+race.id);
    if(when>latestValidVoteTime){
     latestValidVoteTime=when;latestValidVoteRace=race.id;
    }
    if(when>lastByOffice[race.office].time){
     lastByOffice[race.office]={time:when,race:race.id};
    }
   }
   else if(reconciledRecord.inValidatedFeed)status='ZERO_IN_FEED';
   else if(race.provider_scope===PRIMARY){
    const sourceState=health[race.office];
    status=DEGRADED.has(sourceState)?'PRIMARY_DEGRADED':
      CHECKED.has(sourceState)?'PRIMARY_RACE_ABSENT':'PRIMARY_AWAITING';
   }else if(race.source_identity_status==='PINNED_PREVIOUSLY_VERIFIED_ID'||
             race.source_identity_status==='SCOPED_ADAPTER_NO_PINNED_ID'){
    const extra=supplementalHealth[race.id];
    status=extra==='failed'?'SECONDARY_FAILED':
      extra==='stale'?'SECONDARY_STALE':
      extra==='pending'?'SECONDARY_CHECKING':
      extra==='attempted'?'SECONDARY_ATTEMPTED':
      race.source_identity_status==='PINNED_PREVIOUSLY_VERIFIED_ID'?
       'SECONDARY_NOT_QUERIED':'SECONDARY_SCOPED';
   }
   // House discovery can verify an exact 2026 identity without adding a
   // permanent curated registry ID. Such a 10-day valid hint is NOT votes,
   // but it also is not an unidentified race. Do not mislabel the 212
   // independently identity-checked House districts as machine-source gaps.
   else if(race.source_identity_status==='NO_CURATED_PROVIDER_ID'&&
           race.verified_identity_hint_usable===true&&
           race.gap_status==='RECENT_EXACT_PROBE_NOT_LIVE_VERIFIED'){
    const extra=supplementalHealth[race.id];
    status=extra==='failed'?'SECONDARY_FAILED':
      extra==='stale'?'SECONDARY_STALE':
      extra==='pending'?'SECONDARY_CHECKING':
      extra==='attempted'?'SECONDARY_ATTEMPTED':'SECONDARY_NOT_QUERIED';
   }
   else if(race.source_identity_status==='NO_CURATED_PROVIDER_ID')
    status='NO_MACHINE_SOURCE_ID';
   else status='PROVIDER_OTHER';
   const obj=summary[race.office];
   obj.byStatus[status]=(obj.byStatus[status]||0)+1;
   if(status==='OBSERVED_SOURCE_VOTES')obj.reported++;
   else if(status==='ZERO_IN_FEED')obj.zero++;
   else obj.missing++;
   if(status==='NO_MACHINE_SOURCE_ID')unverifiedMachineIds.push({id:race.id,office:race.office});
   if(['PRIMARY_DEGRADED','SECONDARY_FAILED','SECONDARY_STALE'].includes(status))
    sourceFailures.push({id:race.id,office:race.office,status});
   if(race.office==='Senate')records.push({
    id:race.id,status,provider:reconciledRecord.provider||null,
    sourceIdentityStatus:race.source_identity_status
   });
  }
  for(const [office,wanted] of Object.entries(EXPECTED)){
   if(summary[office].reported+summary[office].zero+summary[office].missing!==wanted)
    throw Error('Incomplete '+office+' source coverage inventory');
   if(reconciled[office.toLowerCase()]?.total!==wanted||
      reconciled[office.toLowerCase()]?.reported!==summary[office].reported)
    throw Error('On-screen coverage count disagrees with validated reconciliation');
  }
  if(records.length!==35||seen.size!==506)
   throw Error('Nationwide 506 race reconciliation incomplete');
  const order={PRIMARY_DEGRADED:0,SECONDARY_FAILED:0,
   SECONDARY_STALE:0,SECONDARY_ATTEMPTED:1,
   SECONDARY_CHECKING:2,NO_MACHINE_SOURCE_ID:1,
   PRIMARY_RACE_ABSENT:2,PRIMARY_AWAITING:3,
   SECONDARY_SCOPED:4,SECONDARY_NOT_QUERIED:5,
   ZERO_IN_FEED:6,OBSERVED_SOURCE_VOTES:7};
  records.sort((a,b)=>(order[a.status]??9)-(order[b.status]??9)||
    a.id.localeCompare(b.id));
  unverifiedMachineIds.sort((a,b)=>a.id.localeCompare(b.id));
  const perOffice={};
  for(const office of Object.keys(EXPECTED)){
   const x=lastByOffice[office],has=Number.isFinite(x.time);
   perOffice[office]=Object.freeze({
    source_at:has?new Date(x.time).toISOString():null,
    age_minutes:has?Math.max(0,Math.floor((now-x.time)/60000)):null,
    race:has?x.race:null,
    has_current_sourced_votes:has
   });
  }
  const failurePriorities=priorityGaps(sourceFailures,linkedModelProbabilities);
  const failureStatuses=new Map(sourceFailures.map(r=>[r.id,r.status]));
  const operationalAttention=Object.freeze({...failurePriorities,
   races:Object.freeze(failurePriorities.races.map(r=>Object.freeze({
    ...r,sourceStatus:failureStatuses.get(r.id)
   })))});
  return Object.freeze({
   schema:'on-screen-election-night-506-source-triage-v1',
   checked_at:new Date(now).toISOString(),
   source_identity_audited_at:ledger.generated_at,
   sourceIdentityAuditAgeMs,
   sourceIdentityAuditStale,
   sourceIdentityAuditMaxAgeHours:maxIdentityAgeMs/(60*60*1000),
   lastValidVoteSourceAt:Number.isFinite(latestValidVoteTime)?
    new Date(latestValidVoteTime).toISOString():null,
   lastValidVoteRace:latestValidVoteRace,
   lastValidVoteByOffice:Object.freeze(perOffice),
   lastValidVoteAgeMinutes:Number.isFinite(latestValidVoteTime)?
    Math.max(0,Math.floor((now-latestValidVoteTime)/60000)):null,
   current_votes_provider_attributed_not_independently_certified:true,
   professional_calls_verified:0,may_update_model:false,
   totals:summary,senate:records,
   unverifiedMachineIds,
   gapAttention:priorityGaps(unverifiedMachineIds,linkedModelProbabilities),
   operationalAttention,
   senateMissing:summary.Senate.missing,
   message:'Reported votes are unofficial. Known provider IDs and missing or stale results are NOT votes, zeros or race calls.'
  });
 }
 function render(host,pulse,doc,officialBackstops=[],editorialChecks=null){
  if(!host||!doc)return false;
  const drawers=Array.from(host.querySelectorAll?.('details[data-source-drawer]')||[]);
  const opened=new Set(drawers.filter(el=>el.open).map(el=>el.getAttribute('data-source-drawer')));
  const active=doc.activeElement;
  const owned=Boolean(active&&host.contains?.(active));
  const focusedSummary=owned&&active.tagName==='SUMMARY'?
   active.parentElement?.getAttribute('data-source-drawer'):null;
  const focusedLink=owned&&active.tagName==='A'?{
   href:active.getAttribute('href'),
   race:active.closest('[data-source-race]')?.getAttribute('data-source-race')||null,
   drawer:active.closest('details[data-source-drawer]')?.getAttribute('data-source-drawer')||null
  }:null;
  host.replaceChildren();
  const elt=(tag,text,parent,cls)=>{
   const el=doc.createElement(tag);
   if(cls)el.className=cls;
   if(text!==undefined)el.textContent=text;
   if(parent)parent.appendChild(el);
   return el;
  };
  const drawer=(key,parent)=>{
   const el=elt('details',undefined,parent);
   el.setAttribute?.('data-source-drawer',key);el.open=opened.has(key);
   return el;
  };
  if(!pulse){
   elt('p','Coverage triage awaiting a validated 506-race inventory.',host,'en-coverage-line');return false;
  }
  elt('strong','REAL-RESULT COVERAGE · 506 RACES · NOT SOURCE-ID COVERAGE',host);
  if(pulse.sourceIdentityAuditStale){
   elt('p','SOURCE-ID AUDIT OVERDUE · Registry last checked '+
    pulse.source_identity_audited_at+' (target every '+
    pulse.sourceIdentityAuditMaxAgeHours+
    'h). Rerun Election Night External Source Preflight. Verified live-vote evidence remains separate.',
    host,'en-coverage-line');
  }
  const t=pulse.totals;
  elt('p','House '+t.House.reported+'/435 · Senate '+t.Senate.reported+
      '/35 · Governors '+t.Governor.reported+'/36 with source-reported votes.',host,'en-coverage-line');
  if(pulse.lastValidVoteSourceAt)
   elt('p','LATEST VALID SOURCE-PUBLISHED VOTES · '+
     pulse.lastValidVoteSourceAt+' · '+pulse.lastValidVoteAgeMinutes+
     'm old · '+pulse.lastValidVoteRace+
     ' · source reported, NOT independently certified',host,'en-coverage-line');
  else
   elt('p','NO CURRENT VALIDATED 2026 VOTE TIMESTAMP · a refreshed page, '+
    'available source ID or zero-valued feed is NOT observed ballots',host,'en-coverage-line');
  // Don't let a fresh House result hide a stuck Senate feed. Each office
  // clock comes from that office's OWN last validated provider timestamp.
  if(pulse.lastValidVoteByOffice){
   const summary=['Senate','House','Governor'].map(office=>{
    const entry=pulse.lastValidVoteByOffice[office];
    return office+' '+(entry?.source_at?
     entry.age_minutes+'m old ('+entry.source_at+')':
     'NO CURRENT VALIDATED VOTE');
   });
   elt('p','SOURCE PUBLICATION BY OFFICE · '+summary.join(' · '),
       host,'en-coverage-line');
  }
  elt('p','No source evidence for '+t.House.missing+' House, '+t.Senate.missing+
      ' Senate and '+t.Governor.missing+
      ' governor contests. Provider-reported zero is tracked separately. Missing does not mean zero.',host,'en-coverage-line');
  // Treat missing-source work as an editorial/resource queue, NOT as
  // a forecast call or a replacement for provider-reported votes.
  // Keep the same scope warning beside each use of a government reference.
  const warnings={
   certified_only_not_election_night:' · certified results only; NOT live',
   pre_election_mock_results_only:' · MOCK/TEST source; DO NOT use as votes',
   november_2026_results_not_yet_published:' · 2026 returns NOT YET published',
   county_results_directory_only:' · county links ONLY; NO statewide Election Night results',
   post_election_results_landing:' · may publish only after reporting',
   results_landing_timing_unconfirmed:' · Election Night timing unconfirmed'
  };
  const attention=pulse.gapAttention;
  // Public DDHQ Votes Free race pages are human verification options, not a
  // substitute for the verified civicAPI/Open America source contracts.
  // Never run automated scraping or treat a FORECAST as a newsroom CALL.
  const callLink=id=>{
   const pages=editorialChecks?.status===
     'PUBLIC_MANUAL_NEWSROOM_CHECKS_NOT_VOTE_FEEDS_OR_AUTOMATED_CALLS'?
     editorialChecks.race_pages:null;
   if(!Array.isArray(pages))return null;
   const matches=pages.filter(x=>x?.id===id&&
    typeof x.url==='string'&&
    /^https:\/\/votes\.decisiondeskhq\.com\/races\/2026-11-03\/[a-z0-9-]+-general-election(?:\/results)?$/.test(x.url));
   return matches.length===1?matches[0].url:null;
  };
  const recovery=pulse.operationalAttention;
  if(recovery?.races?.length){
   const panel=elt('div',undefined,host,'en-coverage-recovery');
   elt('strong','SOURCE RECOVERY · '+recovery.races.length+' affected feeds',panel);
   elt('p',recovery.active+' competitive races · '+recovery.needsOdds+
    ' affected races need model review · '+
    recovery.lightChecks+' high-confidence races still require outcome verification. '+
    'Known source IDs do not prove working feeds.',panel,'en-coverage-line');
   const display=(race,parent)=>{
    const priority=race.mode==='ACTIVE_LIVE_SOURCE'?'COMPETITIVE':
     race.mode==='ODDS_UNVERIFIED'?'ODDS UNVERIFIED':'HIGH-CONFIDENCE · OUTCOME UNVERIFIED';
    const line=elt('p',race.id.replace('|',' ')+' — '+priority+' · '+
     LABELS[race.sourceStatus],parent,'en-coverage-line');
    line.setAttribute?.('data-source-race',race.id);
    const link=Array.isArray(officialBackstops)?officialBackstops.find(x=>
     x&&Array.isArray(x.race_ids)&&x.race_ids.includes(race.id)&&
     typeof x.url==='string'&&/^https:\/\//.test(x.url)):null;
    if(link){
     const a=elt('a',' · Manual official reference ↗',line);
     a.href=link.url;a.target='_blank';a.rel='noopener noreferrer';
     elt('span',(warnings[link.mode]||'')+
      ' · reference only; not verified live votes or a race call',line);
    }else elt('span',' · no curated official fallback for this race',line);
    const newsroom=callLink(race.id);
    if(newsroom){
     const a=elt('a',' · Manual DDHQ race page ↗',line);
     a.href=newsroom;a.target='_blank';a.rel='noopener noreferrer';
     elt('span',' · editorial reference only; verify an explicit race call, not a forecast',line);
    }
   };
   recovery.races.slice(0,4).forEach(r=>display(r,panel));
   if(recovery.races.length>4){
    const more=drawer('operational-more',panel);
    elt('summary','All affected source feeds · '+recovery.races.length,more);
    recovery.races.slice(4).forEach(r=>display(r,more));
   }
  }
  if(attention?.races?.length){
   const triage=elt('div',undefined,host,'en-coverage-priority');
   elt('strong','SOURCE-GAP PRIORITIES · close races before safe seats',triage);
   elt('p','Active live-source search: '+attention.active+
    ' · Model odds need review: '+attention.needsOdds+
    ' · Lightweight manual check: '+attention.lightChecks+
    ' · '+attention.cutoff_pct+'% linked-model threshold (either side).',
    triage,'en-coverage-line');
   const manual=new Set(['LIGHT_MANUAL_CHECK']);
   const renderGap=(race,parent)=>{
    const description=race.mode==='ACTIVE_LIVE_SOURCE'?
     'LIVE SOURCE PRIORITY · model below 90% for both sides':
     race.mode==='LIGHT_MANUAL_CHECK'?
     'LIGHT CHECK · model ≥90% for one side':
     'REVIEW ODDS · no verified current D/R probability';
    const line=elt('p',race.id.replace('|',' ')+' — '+description,
     parent,'en-coverage-line');
    line.setAttribute?.('data-source-race',race.id);
    const link=Array.isArray(officialBackstops)?officialBackstops.find(x=>
     x&&Array.isArray(x.race_ids)&&x.race_ids.includes(race.id)&&
     typeof x.url==='string'&&/^https:\/\//.test(x.url)):null;
    if(link){
     const a=elt('a',' · Manual official page ↗',line);
     a.href=link.url;a.target='_blank';a.rel='noopener noreferrer';
     if(warnings[link.mode])elt('span',warnings[link.mode],line);
    }
    const newsroom=callLink(race.id);
    if(newsroom){
     const a=elt('a',' · DDHQ free race results / call ↗',line);
     a.href=newsroom;a.target='_blank';a.rel='noopener noreferrer';
    }
    if(manual.has(race.mode))
     elt('span',' · forecast only; no verified votes or race call',line);
   };
   attention.races.slice(0,4).forEach(race=>renderGap(race,triage));
   if(attention.races.length>4){
    const more=drawer('priority-more',triage);
    elt('summary','Remaining source-gap priorities · '+(attention.races.length-4)+
     ' · '+attention.races.length+' total',more);
    attention.races.slice(4).forEach(race=>renderGap(race,more));
   }
   const social=editorialChecks?.newsroom_social;
   if(editorialChecks?.status===
       'PUBLIC_MANUAL_NEWSROOM_CHECKS_NOT_VOTE_FEEDS_OR_AUTOMATED_CALLS'&&
      social==='https://x.com/DecisionDeskHQ'){
    const link=elt('a','DDHQ public X race-call feed ↗',triage);
    link.href=social;link.target='_blank';link.rel='noopener noreferrer';
   }
   elt('small','DDHQ pages show pre-election forecasts until an explicit 2026 race call is published. '+
    'Check the correct race, date and named winner; media calls are unofficial, '+
    'not machine-validated vote totals. Missing source IDs stay missing.',
    triage);
  }
  // Consistent source-eligibility warnings for EVERY linked federal race:
  // the seven House gaps cannot quietly display mock totals as results.
  const details=drawer('senate',host);
  elt('summary','Senate source gaps · '+pulse.senateMissing+
      ' awaiting verified reported votes · all 35 races',details);
  const list=elt('div',undefined,details,'en-coverage-senate-gaps');
  for(const row of pulse.senate){
   const line=elt('p',row.id.replace('Senate|','')+' — '+LABELS[row.status]+
       (row.provider?' ('+row.provider+')':''),list,'en-coverage-line');
   line.setAttribute?.('data-source-race',row.id);
   // Provide an explicit operator-only fallback for every gap with an
   // independently curated official election-office link. An official
   // landing page is not a verified live vote feed or a winner call.
   if(row.status==='OBSERVED_SOURCE_VOTES')continue;
   const link=Array.isArray(officialBackstops)?officialBackstops.find(x=>
    x&&Array.isArray(x.race_ids)&&x.race_ids.includes(row.id)&&
    typeof x.url==='string'&&/^https:\/\//.test(x.url)):null;
   if(!link)continue;
   const a=elt('a',' · Official manual check ↗',line);
   a.href=link.url;a.target='_blank';a.rel='noopener noreferrer';

   elt('span',warnings[link.mode]||
    ' · manual reference only, NOT a validated live feed',line);
   // Massachusetts does not publish statewide unofficial Election Night
   // counts. Boston's municipal results page is a human-only PARTIAL
   // reference and currently features the September 2026 primary;
   // never turn this link into 2026 Senate reporting/coverage.
   const local=row.id==='Senate|MA'?link.municipal_unofficial_check:null;
   if(local?.scope==='BOSTON_CITY_ONLY_NOT_MASSACHUSETTS_STATEWIDE'&&
      local.general_2026_live_returns_verified===false&&
      local.auto_vote_ingestion_authorized===false&&
      local.url==='https://content.boston.gov/departments/elections/unofficial-election-results'){
    const localLink=elt('a',' · Boston unofficial municipal results ↗',line);
    localLink.href=local.url;localLink.target='_blank';
    localLink.rel='noopener noreferrer';
    elt('span',' · BOSTON ONLY, not statewide · currently September primary; check for November general returns',line);
   }
  }
  // House and governor gaps must be actionable on the same laptop screen.
  // These are verified identity GAPS only, not all races awaiting returned
  // votes. Senate gaps remain in the independently sorted 35-seat desk above.
  const otherGaps=(pulse.unverifiedMachineIds||[]).filter(x=>
   x.office==='House'||x.office==='Governor');
  if(otherGaps.length){
   const others=drawer('identity-gaps',host);
   elt('summary','Unpinned House / governor source IDs · '+otherGaps.length+
    ' · official manual references only',others);
   const rows=elt('div',undefined,others,'en-coverage-other-gaps');
   for(const race of otherGaps){
    const line=elt('p',race.id.replace('|',' ')+' — No verified automated source ID',
     rows,'en-coverage-line');
    line.setAttribute?.('data-source-race',race.id);
    const link=Array.isArray(officialBackstops)?officialBackstops.find(x=>
     x&&Array.isArray(x.race_ids)&&x.race_ids.includes(race.id)&&
     typeof x.url==='string'&&/^https:\/\//.test(x.url)):null;
    if(!link){
     elt('span',' · No curated official manual link; counts unknown',line);
     continue;
    }
    const a=elt('a',' · Check official election office ↗',line);
    a.href=link.url;a.target='_blank';a.rel='noopener noreferrer';
    elt('span',(warnings[link.mode]||
     ' · Reference ONLY; not live machine results or a verified call')+
     ' · Unverified automated results; manual verification required',line);
    // Separate volunteer-run NH Election Night viewer, currently zero
    // polling places reporting. Never present as the official source,
    // machine-readable votes or a professional race call.
    const local=link.state==='NH'&&
     ['House|NH-01','House|NH-02'].includes(race.id)?
      link.community_unofficial_check:null;
    if(local?.scope==='NH_LOCAL_VOLUNTEER_UNOFFICIAL_NOT_STATE_CERTIFIED'&&
       local.election_date==='2026-11-03'&&
       local.automated_vote_ingestion_authorized===false&&
       local.official_race_call===false&&
       local.url==='https://nhelectionresults.org/results'){
     const alt=elt('a',' · NH local unofficial returns ↗',line);
     alt.href=local.url;alt.target='_blank';alt.rel='noopener noreferrer';
     elt('span',' · volunteer town reports, not official returns or automated vote coverage',line);
    }
   }
  }
  elt('small','This source audit does not calculate chamber control, race calls, ballots remaining, or live win probabilities.',host);
  // Live source updates replace rows. Keep the operator's drawer and keyboard
  // position instead of collapsing their investigation on every feed response.
  // Never take focus from controls outside this source desk.
  if(focusedSummary){
   const target=Array.from(host.querySelectorAll?.('details[data-source-drawer]')||[])
    .find(el=>el.getAttribute('data-source-drawer')===focusedSummary);
   target?.querySelector('summary')?.focus({preventScroll:true});
  }else if(focusedLink?.href){
   const matches=Array.from(host.querySelectorAll?.('a[href]')||[]).filter(el=>
    el.getAttribute('href')===focusedLink.href&&
    (el.closest('[data-source-race]')?.getAttribute('data-source-race')||null)===focusedLink.race);
   const target=matches.find(el=>(el.closest('details[data-source-drawer]')
    ?.getAttribute('data-source-drawer')||null)===focusedLink.drawer)||matches[0];
   if(target){
    for(let parent=target.parentElement;parent&&parent!==host;parent=parent.parentElement)
     if(parent.tagName==='DETAILS')parent.open=true;
    target.focus({preventScroll:true});
   }
  }
  return true;
 }
 return Object.freeze({build,render,priorityGaps,supplementalState,LABELS});
});
