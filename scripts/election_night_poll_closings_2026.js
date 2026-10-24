/* 2026 Election Night EARLIEST LOCAL POLL-CLOSE source timestamp gate.
 * A published count can be partial while a second time-zone county is
 * still voting. "Earliest" is NOT an authoritative race call or evidence
 * of live vote publication. Independently validated provider/contest
 * identities, source timestamps and mock exclusion remain mandatory.
 * Reference: The Green Papers, 2026 general election polling hours;
 * individual NC/OH closures independently verified.
 */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.ElectionNightPollClosings2026=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 // UTC hours after 2026-11-03 23:00Z. IN/KY first Eastern
 // counties close Nov 3; every other state here closes on UTC Nov 4.
 const TIMES=Object.freeze({
  AL:'01:00',AK:'05:00',AZ:'02:00',AR:'01:30',CA:'04:00',
  CO:'02:00',CT:'01:00',DE:'01:00',FL:'00:00',GA:'00:00',
  HI:'05:00',ID:'03:00',IL:'01:00',IN:'23:00',IA:'02:00',
  KS:'01:00',KY:'23:00',LA:'02:00',ME:'01:00',MD:'01:00',
  MA:'01:00',MI:'01:00',MN:'02:00',MS:'01:00',MO:'01:00',
  MT:'03:00',NE:'02:00',NV:'03:00',NH:'01:00',NJ:'01:00',
  NM:'02:00',NY:'02:00',NC:'00:30',ND:'03:00',OH:'00:30',
  OK:'01:00',OR:'03:00',PA:'01:00',RI:'01:00',SC:'00:00',
  SD:'01:00',TN:'01:00',TX:'01:00',UT:'03:00',VT:'00:00',
  VA:'00:00',WA:'04:00',WV:'00:30',WI:'02:00',WY:'02:00'
 });
 function floorFor(key){
  const state=String(key||'').slice(0,2);
  if(!Object.prototype.hasOwnProperty.call(TIMES,state))return NaN;
  const day=(state==='IN'||state==='KY')?'03':'04';
  return Date.parse('2026-11-'+day+'T'+TIMES[state]+':00Z');
 }
 function allowed(key,total,sourceStamp,now=Date.now()){
  if(!Number.isSafeInteger(total)||total<0)return false;
  if(total===0)return true; // Zero in feed != zero ballots.
  const floor=floorFor(key),at=Date.parse(sourceStamp||'');
  return Number.isFinite(now)&&Number.isFinite(floor)&&
   now>=floor&&Number.isFinite(at)&&at>=floor&&at<=now+15*60000;
 }
 // The existing allowed() gate is deliberately EARLIEST local close:
 // valid partial votes can appear in a multi-time-zone state before all
 // voting ends. An actual winner flag is stricter. Source: 270toWin's
 // November 3, 2026 LAST state poll closings (standard time).
 // https://www.270towin.com/poll-closing-times/
 const FINAL_STATE=Object.freeze({
  AK:'06:00',FL:'01:00',ID:'04:00',IN:'00:00',
  KS:'02:00',KY:'00:00',MI:'02:00',OR:'04:00',
  SD:'02:00',TX:'02:00'
 });
 const EARLY_HOUSE=Object.freeze({
  IN:new Set(['01','08']),KY:new Set(['01','02']),
  FL:new Set(['01','02']),KS:new Set(['01']),
  MI:new Set(['01']),TX:new Set(['16','23']),ID:new Set(['01'])
 });
 function winnerFloorFor(office,key){
  const earliest=floorFor(key);
  if(!Number.isFinite(earliest)||!['Senate','House','Governor'].includes(office)||
     !(office==='House'?/^[A-Z]{2}-\d{2}$/.test(key):
       office==='Senate'?/^[A-Z]{2}(?:-special)?$/.test(key):
       /^[A-Z]{2}$/.test(key)))
   return NaN;
  const state=String(key).slice(0,2);
  const latest=FINAL_STATE[state];
  if(!latest)return earliest;
  // On the six explicitly documented split-House states, keep only those
  // districts whose polls span the late time zone on the later clock.
  // All remaining districts continue accepting legitimate early calls.
  if(office==='House'&&EARLY_HOUSE[state]){
   const district=/^[A-Z]{2}-(\d{2})$/.exec(key)?.[1];
   if(!district)return NaN;
   if(!EARLY_HOUSE[state].has(district))return earliest;
  }
  const finalTime=Date.parse('2026-11-04T'+latest+':00Z');
  return Math.max(earliest,finalTime);
 }
 function winnerAllowed(office,key,total,sourceStamp,now=Date.now()){
  if(!Number.isSafeInteger(total)||total<=0||
     !allowed(key,total,sourceStamp,now))return false;
  const floor=winnerFloorFor(office,key),ts=Date.parse(sourceStamp||'');
  return Number.isFinite(floor)&&Number.isFinite(ts)&&
   ts>=floor&&now>=floor;
 }
 return Object.freeze({TIMES,floorFor,allowed,FINAL_STATE,
                       winnerFloorFor,winnerAllowed});
});