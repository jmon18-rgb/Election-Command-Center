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
 return Object.freeze({TIMES,floorFor,allowed});
});