/* Election Night: national-source COVERAGE reconciliation, not an
 * election call or an estimate of party control. Never impute missing votes.
 * Immutable, provider-attributed 2026 source records only. */
(function(root,factory){
 const closes=typeof module!=='undefined'&&module.exports?
  require('./election_night_poll_closings_2026.js'):
  root?.ElectionNightPollClosings2026;
 const api=factory(closes);
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.ElectionNightReconciliation=api;
})(typeof window!=='undefined'?window:null,function(closes){
 'use strict';
 if(!closes||typeof closes.allowed!=='function')
  throw Error('Missing verified 2026 state poll-close source contract');
 const START=Date.parse('2026-11-03T05:00:00Z');
 const THREE_HOURS=180*60000;
 // Provider source timestamps must be *post* the first nationwide close.
 // NC/OH have independently verified 7:30 PM ET Nov 3 poll close times.
 // An older MOCK payload fetched after close does not become live evidence.
 const EARLIEST=Date.parse('2026-11-03T23:00:00Z');
 const voteReleased=(key,stamp,now)=>closes.allowed(key,1,stamp,now);
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
  // Explicit TEST/MOCK or disabled reporting flags override a superficially
  // live and fresh office response, including valid-looking candidate totals.
  if(snapshot.is_test===true||snapshot.test===true||
     snapshot.mock===true||snapshot.is_mock===true||
     snapshot.active===false)
   return {state:'invalid',usable:false};
  const ts=Date.parse(snapshot.as_of||'');
  // Raw provider totals guard against pre-election mock snapshots, but
  // they do NOT establish a source that is "reporting". Some upstream
  // office payloads contain premature, malformed or wrong-office positive
  // rows. The national reconciler already rejects those exact races.
  const hasVotes=Object.values(snapshot.races).some(r=>r&&
   Number.isSafeInteger(r.total)&&r.total>0);
  const validOfficeKey=key=>typeof key==='string'&&(
   office==='House'?/^[A-Z]{2}-\d{2}$/.test(key):
   office==='Senate'?/^[A-Z]{2}(?:-special)?$/.test(key):
   /^[A-Z]{2}$/.test(key));
  const hasValidatedVotes=Object.entries(snapshot.races).some(([key,row])=>
   validOfficeKey(key)&&row?.total>0&&row.called===false&&!row.winner&&
   votesByParty(row,'primary')!==null&&
   voteReleased(key,snapshot.as_of,now));
  if(!Number.isFinite(ts)){
   return !hasVotes&&!snapshot.live&&!snapshot.counting?
    {state:'standby',usable:false}:{state:'invalid',usable:false};
  }
  if(!Number.isFinite(now)||ts>now+15*60000)
   return {state:'invalid',usable:false};
  if(ts<START)return !hasVotes&&!snapshot.live?
   {state:'standby',usable:false}:{state:'invalid',usable:false};
  if(hasVotes&&ts<EARLIEST)return {state:'invalid',usable:false};
  if(now-ts>THREE_HOURS)return {state:'stale',usable:false};
  // Reachable data is not necessarily an active count: the primary source
  // can carry test/placeholder numbers while it explicitly says live=false.
  // Keep genuine finished snapshots (final=true) when freshly timestamped.
  if(snapshot.live===false&&snapshot.final!==true)
   return {state:hasVotes?'invalid':'standby',usable:false};
  // Transport can be usable even when the only positive count is unsafe.
  // Do not show "reporting" until at least one office-shaped local-post-close
  // candidate-count record passes the SAME primary arithmetic as reconciliation.
  // Invalid individual races stay isolated; valid races are still usable.
  return {state:hasValidatedVotes?'reporting':'current_no_votes',
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
  const names=new Set();
  for(const c of cands){
   const party=kind==='primary'?c?.p:c?.party;
   const count=kind==='primary'?c?.v:c?.votes;
   const name=kind==='primary'?c?.n:c?.name;
   if(typeof party!=='string'||!party.trim()||party.length>30||
      !Number.isSafeInteger(count)||count<0)return null;
   // Candidate NAME uniqueness protects against duplicate individuals.
   // Party uniqueness is NOT valid here: CA/WA top-two general contests
   // can legitimately have two separately named D or R candidates.
   if(name!==undefined&&name!==null){
    if(typeof name!=='string'||!name.trim()||name.length>200)return null;
    const identity=name.trim().toLocaleLowerCase('en-US');
    if(names.has(identity))return null;
    names.add(identity);
   }
   sum+=count;
   if(!Number.isSafeInteger(sum)||sum>record.total)return null;
   out[party==='D'||party==='R'?party:'O']+=count;
  }
  // A race-level total can include ballots not attributed to a listed
  // candidate. Do not call that "observed candidate votes" if every listed
  // candidate count is still zero. Never infer missing major parties.
  if(record.total>0&&sum===0)return null;
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
 // 36 states hold 2026 gubernatorial elections; Guam, Puerto Rico and the
 // U.S. Virgin Islands hold separate territorial elections (NGA).
 const GOVERNOR_STATES=Object.freeze(["AK","AL","AR","AZ","CA","CO","CT","FL","GA","HI","IA","ID","IL","KS","MA","MD","ME","MI","MN","NE","NH","NM","NV","NY","OH","OK","OR","PA","RI","SC","SD","TN","TX","VT","WI","WY"]);
 const governorIds=()=>[...GOVERNOR_STATES];
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
  const house=houseIds(houseCounts),senate=senateIds(senateSeats),
   governors=governorIds();
  const supported=new Set(supportedStates),restore=new Set(restored);
  const seen=new Set(),calls=[],anomalies=[],discrepancies=[],rows={};
  let validPrimaryOffices=0;
  for(const [office,ids] of [['House',house],['Senate',senate],
   ['Governor',governors]]){
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
    const validPrimary=Boolean(primaryParties&&raw.called===false&&!raw.winner&&
      (raw.total===0||voteReleased(key,snap.as_of,now)));
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
     (secondary.total===0||voteReleased(key,secondary.last_updated,now))&&
     Number.isInteger(secondary.race_id)&&secondary.race_id>0&&
     // A response can carry a recent timestamp but be explicitly marked
     // stale by the verified adapter or the post-outage browser cache.
     // Such records must NEVER count as live votes or winner hints.
     secondary.stale!==true&&secondary.sourceStale!==true&&
     // Even a direct civicAPI result with a valid 2026 race ID and fresh
     // timestamp cannot supply votes or winner hints if its envelope
     // explicitly says TEST, MOCK, inactive or not live.
     secondary.is_test!==true&&secondary.test!==true&&
     secondary.mock!==true&&secondary.is_mock!==true&&
     secondary.live!==false&&secondary.active!==false&&
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
     }else if(comparable&&gap<=3*60000&&
       Math.min(primaryTwo,civicTwo)>=5000&&
       Math.min(primaryTwo,civicTwo)/Math.max(primaryTwo,civicTwo)>=0.9&&
       pLead&&pLead===cLead){
      // Two overlapping, nearly simultaneous sources can agree about
      // the leader yet still materially disagree about the partisan split.
      // Advisory only: provider reporting geographies/timing can differ.
      const firstShare=100*primaryParties.D/primaryTwo;
      const secondShare=100*secondaryParties.D/civicTwo;
      const gapPoints=Math.abs(firstShare-secondShare);
      if(gapPoints>=10){
       discrepancies.push({id,kind:'PARTISAN_SHARE_GAP_COMPARABLE_REPORTS',
        primary:'Open America',supplemental:'civicAPI',
        primaryAsOf:snap.as_of,supplementalAsOf:secondary.last_updated,
        primaryLead:pLead,supplementalLead:cLead,
        primaryDemSharePct:Math.round(firstShare*10)/10,
        supplementalDemSharePct:Math.round(secondShare*10)/10,
        shareGapPoints:Math.round(gapPoints*10)/10,
        primaryTwoPartyVotes:primaryTwo,supplementalTwoPartyVotes:civicTwo});
       anomalies.push('Cross-provider near-synchronous D/R vote-share disagreement '+id);
      }
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
     // Valid partial counts start at the earliest local close. A provider
     // WINNER hint must also pass the final applicable polling close.
     // Neither passing clock alone means a professional/official call.
     typeof closes.winnerAllowed==='function'&&
     closes.winnerAllowed(office,key,secondary.total,
                         secondary.last_updated,now)&&
     (secondary.candidates||[]).filter(c=>
      c.name===secondary.called&&['D','R','O'].includes(c.party)&&
      Number.isSafeInteger(c.votes)&&c.votes>0).length===1;
    if(called)calls.push({id,provider:'civicAPI',candidate:secondary.called});
    rows[id]={provider,hasReportedVotes:Boolean(record&&record.total>0),
     inValidatedFeed:Boolean(record),providerCall:Boolean(called),
     sourceAsOf:record?(primaryAvailable?snap.as_of:secondary.last_updated):null};
   }
   const sourceSlots=ids.filter(k=>supported.has(k.slice(0,2))).length;
   rows[office]={total:ids.length,sourceSlots,primary,
    supplemental,reported,noVotes,
    noValidCount:ids.length-primary-supplemental};
  }
  return Object.freeze({
   status:'PARTIAL_SOURCED_VOTE_COVERAGE_NO_AUTHORITATIVE_CONTROL_CALLS',
   asOf:new Date(now).toISOString(),primaryOfficesValidated:validPrimaryOffices,
   house:rows.House,senate:rows.Senate,governor:rows.Governor,
   providerCalls:calls.length,providerCallRaces:calls,
   authoritativeCalls:0,
   chambersCalled:false,missingAuthoritativeCallSource:true,
   senateHoldoversInUniverse:65,senateHoldoversVerifiedByCalls:false,
   anomalies,crossSourceDiscrepancies:discrepancies,records:rows
  });
 }
 return Object.freeze({START,THREE_HOURS,houseIds,senateIds,governorIds,
  officeHealth,reconcile});
});
