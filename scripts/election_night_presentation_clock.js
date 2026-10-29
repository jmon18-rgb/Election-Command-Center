/* Presentation timing for the 2026 election only. These flags never admit
 * results, start requests, change mode/page, or establish a race call.
 * November 3 is Eastern Standard Time: all boundaries below are exact UTC
 * instants, independent of the viewing device's timezone and locale. */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.ElectionNightPresentationClock=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const DAY=Date.parse('2026-11-03T05:00:00Z');
 const FIRST=Date.parse('2026-11-03T23:00:00Z');
 const EARLY=Date.parse('2026-11-04T00:30:00Z');
 const MAIN=Date.parse('2026-11-04T02:00:00Z');
 const OVERNIGHT=Date.parse('2026-11-04T07:00:00Z');
 const FOLLOW_UP=Date.parse('2026-11-04T11:00:00Z');
 const labels=Object.freeze({
  UNKNOWN:'Clock unavailable',
  PRE_ELECTION:'Before Election Day',
  ELECTION_DAY:'Election Day · before first closing windows',
  FIRST_RETURNS:'First returns · 6–7:30 PM ET',
  EARLY_INDICATORS:'Early indicators · 7:30–9 PM ET',
  MAIN_COUNT:'Main count · 9 PM–2 AM ET',
  OVERNIGHT:'Overnight · 2–6 AM ET',
  FOLLOW_UP:'Results follow-up · after 6 AM ET'
 });
 function evaluate(input={}){
  const {now,modeYear=2026,visible=true,page='electionNight',
   rehearsalOpen=false,layoutChoice='AUTO'}=
   input&&typeof input==='object'&&!Array.isArray(input)?input:{};
  const valid=typeof now==='number'&&Number.isFinite(now)&&
   Number.isFinite(new Date(now).getTime());
  const phase=!valid?'UNKNOWN':now<DAY?'PRE_ELECTION':
   now<FIRST?'ELECTION_DAY':now<EARLY?'FIRST_RETURNS':
   now<MAIN?'EARLY_INDICATORS':now<OVERNIGHT?'MAIN_COUNT':
   now<FOLLOW_UP?'OVERNIGHT':'FOLLOW_UP';
  const eligible=valid&&modeYear===2026&&visible===true&&
   page==='electionNight'&&rehearsalOpen===false;
  const automaticEarly=eligible&&phase==='EARLY_INDICATORS';
  const expanded=eligible&&(layoutChoice==='EXPANDED'||
   layoutChoice==='AUTO'&&automaticEarly);
  const modeLabel=modeYear===2024?'2024 archive':modeYear!==2026?
   'Mode unavailable':phase==='UNKNOWN'?'Time unavailable':
   phase==='PRE_ELECTION'?'2026 preview':phase==='ELECTION_DAY'?
   'Election Day · 2026':phase==='FOLLOW_UP'?'2026 results follow-up':
   'Election Night · 2026';
  // autoLandingWindow is a hint, not navigation permission. The page must
  // separately require a fresh root URL/no hash and no explicit page choice.
  return Object.freeze({phase,modeLabel,phaseLabel:labels[phase],
   earlySpotlight:automaticEarly&&expanded,
   desiredLayout:expanded?'EXPANDED':'COMPACT',
   autoLandingWindow:eligible&&now>=FIRST&&now<FOLLOW_UP});
 }
 return Object.freeze({VERSION:'election-night-presentation-clock-v1',
  timeZone:'America/New_York',evaluate});
});
