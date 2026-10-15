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
  const seen=new Set(),calls=[],anomalies=[],rows={};
  let validPrimaryOffices=0;
  for(const [office,ids] of [['House',house],['Senate',senate]]){
   const snap=snapshots[office];
   const acceptable=Boolean(snap&&snap.year===2026&&snap.office===office&&
    snap.source==='state'&&snap.stale!==true&&errors[office]!==true&&
    !restore.has(office)&&validTime(snap.as_of,now));
   if(acceptable)validPrimaryOffices++;
   const keys=new Set(ids);
   const validSourceKeys=acceptable?Object.keys(snap.races||{}):[];
   for(const key of validSourceKeys)if(!keys.has(key))
    anomalies.push(office+': out-of-universe primary '+key);
   let primary=0,supplemental=0,reported=0,noVotes=0;
   for(const key of ids){
    const id=office+'|'+key;
    const raw=acceptable?snap.races?.[key]:null;
    const validPrimary=Boolean(raw&&Number.isSafeInteger(raw.total)&&raw.total>=0&&
     raw.called===false&&!raw.winner);
    const primaryAvailable=validPrimary&&supported.has(key.slice(0,2));
    if(validPrimary&&!primaryAvailable)
     anomalies.push(office+': primary outside covered state '+key);
    // Secondary is a verified individual race, not a national source.
    // It MUST NEVER overwrite or double count a primary-covered state.
    const secondary=!supported.has(key.slice(0,2))?civic[id]:null;
    const civicOK=Boolean(secondary&&secondary.provider==='civicAPI'&&
     secondary.office===office&&secondary.key===key&&
     Number.isSafeInteger(secondary.total)&&secondary.total>=0&&
     validTime(secondary.last_updated,now)&&
     Number.isInteger(secondary.race_id)&&secondary.race_id>0&&
     !errors[id]&&!restore.has(id));
    if(supported.has(key.slice(0,2))&&civic[id])
     anomalies.push('Blocked overlapping secondary '+id);
    const record=primaryAvailable?raw:civicOK?secondary:null;
    const provider=primaryAvailable?'Open America':civicOK?'civicAPI':null;
    if(record){
     if(seen.has(id))throw Error('Double-counted source race '+id);
     seen.add(id);
     if(provider==='Open America')primary++;else supplemental++;
     if(record.total>0)reported++;else noVotes++;
    }
    // civicAPI says "called" only when the candidate is unambiguously
    // present in a fresh exact-race record with positive votes.
    const called=civicOK&&!primaryAvailable&&
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
   anomalies,records:rows
  });
 }
 return Object.freeze({START,THREE_HOURS,houseIds,senateIds,reconcile});
});
