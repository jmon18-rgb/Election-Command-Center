/* Exact-district civicAPI House 2026 general-election reader.
 * This is a scoped supplemental adapter, NOT a nationwide feed or a
 * professional race-call source. No race is fabricated when search misses.
 */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.CivicHouse2026Adapter=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const BASE='https://civicapi.org/api/v2';
 const START=Date.parse('2026-11-03T05:00:00Z');
 // Apportionment is an exact 435-seat ballot identity gate, including
 // the seven at-large states. An arbitrary NH-03 or CA-53 must never be fetched.
 const COUNTS=Object.freeze({AL:7,AK:1,AZ:9,AR:4,CA:52,CO:8,CT:5,DE:1,
 FL:28,GA:14,HI:2,ID:2,IL:17,IN:9,IA:4,KS:4,KY:6,LA:6,ME:2,
 MD:8,MA:9,MI:13,MN:8,MS:4,MO:8,MT:2,NE:3,NV:4,NH:2,NJ:12,
 NM:3,NY:26,NC:14,ND:1,OH:15,OK:5,OR:6,PA:17,RI:2,SC:7,
 SD:1,TN:9,TX:38,UT:4,VT:1,VA:11,WA:10,WV:2,WI:8,WY:1});
 if(Object.values(COUNTS).reduce((n,c)=>n+c,0)!==435)
  throw Error('Invalid 2026 House apportionment');
 function supports(item){
  if(!item||item.office!=='House'||typeof item.key!=='string'||
    !/^[A-Z]{2}-\d{2}$/.test(item.key))return false;
  const state=item.key.slice(0,2),count=COUNTS[state],n=Number(item.key.slice(3));
  return Number.isInteger(count)&&(count===1?n===0:n>=1&&n<=count);
 }
 function electionDate(x){
  return typeof x==='string'&&
   /^2026-11-03(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(x)&&
   Number.isFinite(Date.parse(x.length===10?x+'T00:00:00Z':x));
 }
 // This is the actual seven-seat 2026 source-ID gap list. No nationwide
 // extra requests: alternate queries are scoped to those missing identities.
 const ALIAS_GAPS=new Set(['AK-00','DE-00','ND-00','NH-01','NH-02','SD-00','WY-00']);
 function queries(item){
  if(!supports(item))return [];
  const state=item.key.slice(0,2),district=Number(item.key.slice(3));
  const phrases=['US House'+(district?' '+district:'')];
  if(ALIAS_GAPS.has(item.key))
   phrases.push('Representative in Congress','U.S. Representative');
  return phrases.map(phrase=>BASE+'/race/search?'+new URLSearchParams({
   country:'US',province:state,startDate:'2026-11-03',endDate:'2026-11-03',
   query:phrase,limit:'20'
  }).toString());
 }
 function query(item){return queries(item)[0]||null}
 function officeTitle(item,name){
  if(typeof name!=='string'||/primary|runoff/i.test(name))return false;
  const alternates=ALIAS_GAPS.has(item.key);
  const office=alternates?
   '(?:US House|Representative in Congress|U\\.?S\\.? Representative)':'US House';
  const n=Number(item.key.slice(3));
  // Never translate a differently numbered congressional race into this
  // district. Provider district/state/date must also match exactly.
  const suffix=n?
   '(?:\\s+District)?\\s+'+n+'\\b':
   '(?:\\s+At[ -]Large)?\\b(?!\\s+(?:District\\s+)?[0-9])';
  return new RegExp('\\b'+office+suffix,'i').test(name);
 }
 const disabled=x=>Boolean(x&&(x.test_data===true||x.is_test===true||x.test===true||
  x.mock===true||x.is_mock===true||x.active===false||x.live===false));
 function match(item,row){
  if(!supports(item)||!row||disabled(row)||row.country!=='US'||
    row.province!==item.key.slice(0,2)||row.municipality!=null||
    row.district!==item.key||row.type!=='House of Representatives'||
    row.election_type!=='General'||!electionDate(row.election_date)||
    !Number.isSafeInteger(row.id)||row.id<=0||
    !officeTitle(item,row.election_name)||
    !Array.isArray(row.candidates)||row.candidates.length>60)return false;
  return true;
 }
 function select(item,doc){
  if(!supports(item)||!doc||disabled(doc)||!Array.isArray(doc.races)||
    !doc.races.length||doc.races.length>20||
    // An API that reports 2 matches but delivers 1 is not evidence of a
    // unique exact district source. Reject incomplete/malformed cardinality
    // whenever the provider supplies it; missing count stays unverified by
    // cardinality and remains governed by exact row/detail identity checks.
    (doc.count!=null&&
     (!Number.isSafeInteger(doc.count)||doc.count!==doc.races.length)))return null;
  const matched=doc.races.filter(row=>match(item,row));
  return matched.length===1?matched[0]:null;
 }
 function party(x){
  const s=String(x).trim().toLowerCase();
  return ['d','dem','democrat','democratic'].includes(s)?'D':
   ['r','rep','gop','republican'].includes(s)?'R':'O';
 }
 // Resolve the shared poll-close module after startup; the browser may
 // load this House adapter before registering the poll-close contract.
 function pollGate(){
  return typeof module!=='undefined'&&module.exports?
   require('./election_night_poll_closings_2026.js'):
   typeof window!=='undefined'?window.ElectionNightPollClosings2026:null;
 }
 function localVotesAllowed(item,total,updated,now){
  return pollGate()?.allowed?.(item?.key,total,updated,now)===true;
 }
 function localWinnerAllowed(item,total,updated,now){
  return pollGate()?.winnerAllowed?.('House',item.key,total,updated,now)===true;
 }
 function validate(item,row,detail,now=Date.now()){
  if(!match(item,row)||!detail||disabled(detail)||!Number.isFinite(now)||
    (detail.id!=null&&detail.id!==row.id)||
    detail.country!==row.country||detail.province!==row.province||
    detail.district!==row.district||
    detail.election_date!==row.election_date||
    detail.election_name!==row.election_name||
    detail.election_type!==row.type||
    !Number.isFinite(detail.percent_reporting)||
    detail.percent_reporting<0||detail.percent_reporting>100||
    !Array.isArray(detail.candidates)||!detail.candidates.length||
    detail.candidates.length>60)return null;
  let total=0,winners=0,called=null;
  const seen=new Set(),candidates=[];
  for(const c of detail.candidates){
   if(!c||typeof c.name!=='string'||!c.name.trim()||
     typeof c.party!=='string'||!c.party.trim()||
     !Number.isSafeInteger(c.votes)||c.votes<0||
     !Number.isFinite(c.percent)||c.percent<0||c.percent>100||
     typeof c.winner!=='boolean')return null;
   const identity=c.name.trim().toLocaleLowerCase('en-US');
   if(seen.has(identity))return null;
   seen.add(identity);
   total+=c.votes;
   if(!Number.isSafeInteger(total))return null;
   if(c.winner){called=c.name.trim();winners++;}
   candidates.push({name:c.name.trim(),party:party(c.party),
    votes:c.votes,percent:c.percent});
  }
  if(winners>1||(!total&&winners)||(now<START&&(total||winners)))return null;
  if(total){
   if(Math.abs(candidates.reduce((n,c)=>n+c.percent,0)-100)>2||
     candidates.some(c=>Math.abs(100*c.votes/total-c.percent)>1.5))return null;
   if(called&&!candidates.some(c=>c.name===called&&c.votes>0))return null;
  }else if(candidates.some(c=>c.percent!==0))return null;
  const updated=detail.last_updated||null;
  if(updated){
   const at=Date.parse(updated);
   if(typeof updated!=='string'||!Number.isFinite(at)||
    at>now+15*60000||(total>0&&at<START))return null;
  }else if(total>0)return null;
  // No source-provided timestamp, candidate total or winner hint from
  // before the district's local poll close can be treated as actual 2026 votes.
  if(!localVotesAllowed(item,total,updated,now))return null;
  // An early provider winner:true is NOT a reason to hide otherwise valid
  // partial results. Show the actual reported votes while suppressing only
  // the unsupported winner until the last applicable poll has closed.
  const safeCall=called&&localWinnerAllowed(item,total,updated,now)?called:null;
  return {provider:'civicAPI',office:'House',key:item.key,race_id:row.id,
   last_updated:updated,percent_reporting:detail.percent_reporting,
   total,candidates,called:safeCall,source_url:BASE+'/race/'+row.id};
 }
 // Compact source-discovery manifest, generated by the scheduled 506-race audit.
 // Known IDs only optimize lookup; NEVER authorize a vote, call or source health.
 let pins=Object.freeze({});
 function setManifest(doc,now=Date.now()){
  if(!doc||doc.schema_version!=='1.0'||
     doc.status!=='VERIFIED_HOUSE_IDENTITIES_NOT_LIVE_RESULTS'||
     doc.election!=='2026-11-03'||
     !Array.isArray(doc.races)||doc.races.length>219||
     !Number.isFinite(now))return false;
  const issued=Date.parse(doc.generated_at||'');
  if(!Number.isFinite(issued)||issued>now+15*60000||
     now-issued>48*3600000)return false;
  const found=Object.create(null),seenIds=new Set();
  for(const r of doc.races){
   if(!r||!supports({office:'House',key:r.district})||
      !Number.isSafeInteger(r.race_id)||r.race_id<=0||
      typeof r.checked_window_utc!=='string'||!Number.isFinite(Date.parse(r.checked_window_utc))||
      Date.parse(r.checked_window_utc)>issued+15*60000||
      issued-Date.parse(r.checked_window_utc)>10*86400000||
      Object.prototype.hasOwnProperty.call(found,r.district)||
      seenIds.has(r.race_id))return false;
   seenIds.add(r.race_id);
   found[r.district]=r.race_id;
  }
  pins=Object.freeze(found);
  return true;
 }
 function pinnedId(item){
  return supports(item)?pins[item.key]||null:null;
 }
 // Direct detail rechecks bypass the provider's search endpoint only when an
 // independently matched ID exists. The detail itself MUST prove the whole
 // 2026 House district identity and satisfy normal arithmetic/time gates.
 function validatePinned(item,raceId,detail,now=Date.now()){
  if(!supports(item)||!Number.isSafeInteger(raceId)||raceId<=0||
     pinnedId(item)!==raceId||!detail||detail.id!==raceId||
     detail.election_type!=='House of Representatives'||
     detail.municipality!=null||detail.district!==item.key||
     detail.country!=='US'||detail.province!==item.key.slice(0,2)||
     typeof detail.election_name!=='string')return null;
  const row={country:detail.country,province:detail.province,
    municipality:detail.municipality,district:detail.district,id:raceId,
    election_date:detail.election_date,election_name:detail.election_name,
    type:'House of Representatives',election_type:'General',
    candidates:detail.candidates};
  return validate(item,row,detail,now);
 }
 return Object.freeze({START,supports,query,queries,match,select,validate,
  setManifest,pinnedId,validatePinned});
});
