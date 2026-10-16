/* Election Night: national-source COVERAGE reconciliation, not an
 * election call or an estimate of party control. Never impute missing votes.
 * Immutable, provider-attributed 2026 source records only. */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.ElectionNightReconciliation=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const START=Date.parse('2026-11-03T05:00:00Z');
 const THREE_HOURS=180*60000;
 const validTime=(s,now)=>{const n=Date.parse(s||'');
  return Number.isFinite(n)&&n>=START&&n<=now+15*60000&&now-n<=THREE_HOURS;};
 // One shared source-health definition powers coverage counts, the source
 // health panel and the office buttons. An old feed is not "connected" merely
 // because its live flag is false or because a cached snapshot exists.
 function officeHealth(snapshot,office,{now=Date.now(),error=false,restored=false}={}){
  if(error)return {state:'outage',usable:false};
  if(restored)return {state:'rechecking',usable:false};
  if(!snapshot)return {state:'missing',usable:false};
  if(!['House','Senate','Governor'].includes(office)||
     snapshot.year!==2026||snapshot.office!==office||
     snapshot.source!=='state'||typeof snapshot.races!=='object'||
     !snapshot.races||Array.isArray(snapshot.races))
   return {state:'invalid',usable:false};
  if(snapshot.stale===true)return {state:'stale',usable:false};
  const ts=Date.parse(snapshot.as_of||'');
  const hasVotes=Object.values(snapshot.races).some(r=>r&&
   Number.isSafeInteger(r.total)&&r.total>0);
  if(!Number.isFinite(ts)){
   return !hasVotes&&!snapshot.live&&!snapshot.counting?
    {state:'standby',usable:false}:{state:'invalid',usable:false};
  }
  if(!Number.isFinite(now)||ts>now+15*60000)
   return {state:'invalid',usable:false};
  if(ts<START)return !hasVotes&&!snapshot.live?
   {state:'standby',usable:false}:{state:'invalid',usable:false};
  if(now-ts>THREE_HOURS)return {state:'stale',usable:false};
  return {state:hasVotes?'reporting':'current_no_votes',
   usable:true,asOf:snapshot.as_of};
 }
 // Independent, exact-race count validation. The totals may legitimately
 // exceed listed D/R candidates because write-ins and other parties exist.
 // They may never be smaller than the sum of listed candidate votes.
 const votesByParty=(record,kind)=>{
  const cands=kind==='primary'?record?.cands:record?.candidates;
  if(!record||!Number.isSafeInteger(record.total)||record.total<0||
    !Array.isArray(cands)||(record.total>0&&!cands.length))return null;
  const out={D:0,R:0,O:0};let sum=0;
  for(const c of cands){
   const party=kind==='primary'?c?.p:c?.party;
   const count=kind==='primary'?c?.v:c?.votes;
   if(typeof party!=='string'||!party.trim()||party.length>30||
      !Number.isSafeInteger(count)||count<0)return null;
   sum+=count;
   if(!Number.isSafeInteger(sum)||sum>record.total)return null;
   out[party==='D'||party==='R'?party:'O']+=count;
  }
  return out;
 };
 const majorLead=t=>t&&t.D!==t.R?(t.D>t.R?'D':'R'):null;
 const houseIds=counts=>{
  const out=[];
  for(const [st,n] of Object.entries(counts||{})){
   if(!/^[A-Z]{2}$/.test(st)||!Number.isInteger(n)||n<1||n>60)
    throw Error('Invalid 2026 House state apportionment');
   for(let i=1;i<=n;i++)out.push(st+'-'+(n===1?'00':String(i).padStart(2,'0')));
  }
  if(out.length!==435||new Set(out).size!==435)
   throw Error('2026 House seat universe must contain 435 unique seats');
  return out;
 };
 const senateIds=seats=>{
  if(!Array.isArray(seats)||seats.length!==35)throw Error('Validated Senate universe missing');
  const out=seats.map(s=>s?.key);
  if(out.some(k=>!/^[A-Z]{2}(?:-special)?$/.test(k))||new Set(out).size!==35||
   !out.includes('FL-special')||!out.includes('OH-special'))
   throw Error('2026 Senate race universe mismatch');
  return out;
 };
 function reconcile({houseCounts,senateSeats,snapshots={},civic={},errors={},
    restored=[],supportedStates=[],now=Date.now()}={}){
  const house=houseIds(houseCounts),senate=senateIds(senateSeats);
  const supported=new Set(supportedStates),restore=new Set(restored);
  const seen=new Set(),calls=[],anomalies=[],discrepancies=[],rows={};
  let validPrimaryOffices=0;
  for(const [office,ids] of [['House',house],['Senate',senate]]){
   const snap=snapshots[office];
   const acceptable=officeHealth(snap,office,{now,
    error:errors[office]===true,restored:restore.has(office)}).usable;
   if(acceptable)validPrimaryOffices++;
   const keys=new Set(ids);
   const validSourceKeys=acceptable?Object.keys(snap.races||{}):[];
   for(const key of validSourceKeys)if(!keys.has(key))
    anomalies.push(office+': out-of-universe primary '+key);
   let primary=0,supplemental=0,reported=0,noVotes=0;
   for(const key of ids){
    const id=office+'|'+key;
    const raw=acceptable?snap.races?.[key]:null;
    const primaryParties=votesByParty(raw,'primary');
    const validPrimary=Boolean(primaryParties&&raw.called===false&&!raw.winner);
    const primaryAvailable=validPrimary&&supported.has(key.slice(0,2));
    if(raw&&!validPrimary)anomalies.push('Rejected malformed primary '+id);
    if(validPrimary&&!primaryAvailable)
     anomalies.push(office+': primary outside covered state '+key);
    // Evaluate a supplemental record independently so we can compare
    // overlapping sources, while NEVER adding overlapping votes or calls.
    const secondary=civic[id]||null;
    const secondaryParties=votesByParty(secondary,'civic');
    const civicOK=Boolean(secondary&&secondaryParties&&
     secondary.provider==='civicAPI'&&
     secondary.office===office&&secondary.key===key&&
     validTime(secondary.last_updated,now)&&
     Number.isInteger(secondary.race_id)&&secondary.race_id>0&&
     !errors[id]&&!restore.has(id));
    if(secondary&&!civicOK&&!errors[id]&&!restore.has(id))
     anomalies.push('Rejected invalid supplemental '+id);
    const overlapping=supported.has(key.slice(0,2))&&Boolean(secondary);
    if(overlapping)anomalies.push('Blocked overlapping secondary '+id);
    if(primaryAvailable&&civicOK){
     const gap=Math.abs(Date.parse(snap.as_of)-Date.parse(secondary.last_updated));
     const primaryTwo=primaryParties.D+primaryParties.R;
     const civicTwo=secondaryParties.D+secondaryParties.R;
     const comparable=gap<=10*60000&&Math.min(primaryTwo,civicTwo)>=1000&&
      Math.min(primaryTwo,civicTwo)/Math.max(primaryTwo,civicTwo)>=0.8;
     const pLead=majorLead(primaryParties),cLead=majorLead(secondaryParties);
     if(comparable&&pLead&&cLead&&pLead!==cLead){
      discrepancies.push({id,kind:'OPPOSITE_LEAD_COMPARABLE_REPORTS',
       primary:'Open America',supplemental:'civicAPI',
       primaryAsOf:snap.as_of,supplementalAsOf:secondary.last_updated,
       primaryLead:pLead,supplementalLead:cLead,
       primaryTwoPartyVotes:primaryTwo,supplementalTwoPartyVotes:civicTwo});
      anomalies.push('Cross-provider opposite major-party leads '+id);
     }
    }
    // A covered state is exclusively primary-owned in this conservative
    // version. An outage never silently promotes an untested fallback.
    const supplementalAvailable=civicOK&&!supported.has(key.slice(0,2));
    const record=primaryAvailable?raw:supplementalAvailable?secondary:null;
    const provider=primaryAvailable?'Open America':supplementalAvailable?'civicAPI':null;
    if(record){
     if(seen.has(id))throw Error('Double-counted source race '+id);
     seen.add(id);
     if(provider==='Open America')primary++;else supplemental++;
     if(record.total>0)reported++;else noVotes++;
    }
    // civicAPI says "called" only when the candidate is unambiguously
    // present in a fresh exact-race record with positive votes.
    const called=supplementalAvailable&&!primaryAvailable&&
     typeof secondary.called==='string'&&secondary.called.trim()&&
     secondary.total>0&&(secondary.candidates||[]).filter(c=>
      c.name===secondary.called&&['D','R','O'].includes(c.party)&&
      Number.isSafeInteger(c.votes)&&c.votes>0).length===1;
    if(called)calls.push({id,provider:'civicAPI',candidate:secondary.called});
    rows[id]={provider,hasReportedVotes:Boolean(record&&record.total>0),
     inValidatedFeed:Boolean(record),providerCall:Boolean(called)};
   }
   const sourceSlots=ids.filter(k=>supported.has(k.slice(0,2))).length;
   rows[office]={total:ids.length,sourceSlots,primary,
    supplemental,reported,noVotes,
    noValidCount:ids.length-primary-supplemental};
  }
  return Object.freeze({
   status:'PARTIAL_SOURCED_VOTE_COVERAGE_NO_AUTHORITATIVE_CONTROL_CALLS',
   asOf:new Date(now).toISOString(),primaryOfficesValidated:validPrimaryOffices,
   house:rows.House,senate:rows.Senate,
   providerCalls:calls.length,providerCallRaces:calls,
   authoritativeCalls:0,
   chambersCalled:false,missingAuthoritativeCallSource:true,
   senateHoldoversInUniverse:65,senateHoldoversVerifiedByCalls:false,
   anomalies,crossSourceDiscrepancies:discrepancies,records:rows
  });
 }
 return Object.freeze({START,THREE_HOURS,houseIds,senateIds,officeHealth,reconcile});
});
