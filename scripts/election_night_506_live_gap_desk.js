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
 function build(ledger,reconciled,health={},now=Date.now(),supplementalHealth={}){
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
  const seen=new Set(),summary={};
  for(const name of Object.keys(EXPECTED))
   summary[name]={total:EXPECTED[name],reported:0,zero:0,missing:0,byStatus:{}};
  const records=[],unverifiedMachineIds=[];
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
   if(reconciledRecord.hasReportedVotes)status='OBSERVED_SOURCE_VOTES';
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
           race.gap_status==='RECENT_EXACT_PROBE_NOT_LIVE_VERIFIED')
    status='SECONDARY_NOT_QUERIED';
   else if(race.source_identity_status==='NO_CURATED_PROVIDER_ID')
    status='NO_MACHINE_SOURCE_ID';
   else status='PROVIDER_OTHER';
   const obj=summary[race.office];
   obj.byStatus[status]=(obj.byStatus[status]||0)+1;
   if(status==='OBSERVED_SOURCE_VOTES')obj.reported++;
   else if(status==='ZERO_IN_FEED')obj.zero++;
   else obj.missing++;
   if(status==='NO_MACHINE_SOURCE_ID')unverifiedMachineIds.push({id:race.id,office:race.office});
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
  return Object.freeze({
   schema:'on-screen-election-night-506-source-triage-v1',
   checked_at:new Date(now).toISOString(),
   source_identity_audited_at:ledger.generated_at,
   current_votes_provider_attributed_not_independently_certified:true,
   professional_calls_verified:0,may_update_model:false,
   totals:summary,senate:records,
   unverifiedMachineIds,
   senateMissing:summary.Senate.missing,
   message:'Reported votes are unofficial. Known provider IDs and missing or stale results are NOT votes, zeros or race calls.'
  });
 }
 function render(host,pulse,doc,officialBackstops=[]){
  if(!host||!doc)return false;
  host.replaceChildren();
  const elt=(tag,text,parent,cls)=>{
   const el=doc.createElement(tag);
   if(cls)el.className=cls;
   if(text!==undefined)el.textContent=text;
   if(parent)parent.appendChild(el);
   return el;
  };
  if(!pulse){
   elt('p','Coverage triage awaiting a validated 506-race inventory.',host,'en-coverage-line');return false;
  }
  elt('strong','REAL-RESULT COVERAGE · 506 RACES · NOT SOURCE-ID COVERAGE',host);
  const t=pulse.totals;
  elt('p','House '+t.House.reported+'/435 · Senate '+t.Senate.reported+
      '/35 · Governors '+t.Governor.reported+'/36 with source-reported votes.',host,'en-coverage-line');
  elt('p','No source evidence for '+t.House.missing+' House, '+t.Senate.missing+
      ' Senate and '+t.Governor.missing+
      ' governor contests. Provider-reported zero is tracked separately. Missing does not mean zero.',host,'en-coverage-line');
  const details=elt('details',undefined,host);
  elt('summary','Senate source gaps · '+pulse.senateMissing+
      ' awaiting verified reported votes · all 35 races',details);
  const list=elt('div',undefined,details,'en-coverage-senate-gaps');
  for(const row of pulse.senate){
   const line=elt('p',row.id.replace('Senate|','')+' — '+LABELS[row.status]+
       (row.provider?' ('+row.provider+')':''),list,'en-coverage-line');
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
   const warnings={
    certified_only_not_election_night:' · certified results only; NOT live',
    pre_election_mock_results_only:' · MOCK/TEST source; DO NOT use as votes',
    november_2026_results_not_yet_published:' · 2026 returns NOT YET published',
    post_election_results_landing:' · may publish only after reporting',
    results_landing_timing_unconfirmed:' · Election Night timing unconfirmed'
   };
   elt('span',warnings[link.mode]||
    ' · manual reference only, NOT a validated live feed',line);
  }
  // House and governor gaps must be actionable on the same laptop screen.
  // These are verified identity GAPS only, not all races awaiting returned
  // votes. Senate gaps remain in the independently sorted 35-seat desk above.
  const otherGaps=(pulse.unverifiedMachineIds||[]).filter(x=>
   x.office==='House'||x.office==='Governor');
  if(otherGaps.length){
   const others=elt('details',undefined,host);
   elt('summary','Unpinned House / governor source IDs · '+otherGaps.length+
    ' · official manual references only',others);
   const rows=elt('div',undefined,others,'en-coverage-other-gaps');
   for(const race of otherGaps){
    const line=elt('p',race.id.replace('|',' ')+' — No verified automated source ID',
     rows,'en-coverage-line');
    const link=Array.isArray(officialBackstops)?officialBackstops.find(x=>
     x&&Array.isArray(x.race_ids)&&x.race_ids.includes(race.id)&&
     typeof x.url==='string'&&/^https:\/\//.test(x.url)):null;
    if(!link){
     elt('span',' · No curated official manual link; counts unknown',line);
     continue;
    }
    const a=elt('a',' · Check official election office ↗',line);
    a.href=link.url;a.target='_blank';a.rel='noopener noreferrer';
    elt('span',' · Reference ONLY; not live machine results or a verified call',line);
   }
  }
  elt('small','This source audit does not calculate chamber control, race calls, ballots remaining, or live win probabilities.',host);
  return true;
 }
 return Object.freeze({build,render,LABELS});
});
