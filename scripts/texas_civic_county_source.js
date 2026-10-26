// Full public Texas response; light responses do not contain county returns.
(function(root,factory){const api=factory(typeof module!=='undefined'&&module.exports?require('./election_night_poll_closings_2026.js'):root?.ElectionNightPollClosings2026);
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.TexasCivicCountySource=api;
})(typeof window!=='undefined'?window:null,function(closes){
'use strict';
const URL='https://civicapi.org/api/v2/race/87438';
const normalize=s=>String(s).toLowerCase().replace(/[^a-z]/g,'');
const party=s=>({Democratic:'D',Republican:'R',Libertarian:'L'})[s]||null;
function parse(detail,reference,{source_url=URL,now=Date.now()}={}){
 if(source_url!==URL||!Number.isFinite(now))throw Error('Unverified Texas source URL/clock');
 if(detail?.country!=='US'||detail.province!=='TX'||detail.district!==null||detail.municipality!==null||
  detail.election_scope!=='General'||detail.election_type!=='US Senate'||detail.election_name!=='Texas US Senate'||
  !/^2026-11-03T\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(detail.election_date||''))
  throw Error('Wrong exact 2026 Texas Senate identity');
 if(!Array.isArray(reference?.counties)||reference.counties.length!==254)throw Error('Missing independent Texas county reference');
 const byFips=new Map(reference.counties.map(c=>[c.fips,c.county])),seen=new Set();
 if(byFips.size!==254||[...byFips.keys()].some(f=>!/^48\d{3}$/.test(f)))throw Error('Invalid/duplicate Texas reference');
 const regions=detail.region_results;
 if(!regions||Array.isArray(regions)||typeof regions!=='object'||Object.keys(regions).length!==254)
  throw Error('Full254-county payload required; light detail is not a county feed');
 const rows=Object.values(regions).map(r=>{
  if(r?.type!=='County'||!byFips.has(r.fips)||seen.has(r.fips)||normalize(r.name)!==normalize(byFips.get(r.fips)))
   throw Error('Unmatched, duplicate or wrong-state Texas county');
  seen.add(r.fips);return {raw:r,county:byFips.get(r.fips),county_fips:r.fips};
 });
 if(detail.test_data===true)return {status:'TEST_DATA_NOT_LIVE',county_identities_matched:254,
  counties:[],source_url:URL,live_votes_accepted:false,may_move_national_needle:false};
 if(detail.test_data!==false||detail.is_test===true||detail.test===true||detail.mock===true||
  detail.is_mock===true||detail.active===false||detail.live===false)throw Error('Unverified/test Texas data');
 const stamp=Date.parse(detail.last_updated);
 if(!Number.isFinite(stamp)||!/(?:Z|[+-]\d\d:\d\d)$/.test(detail.last_updated||'')||
  stamp>now+15*60000||now-stamp>180*60000)throw Error('Missing/future/stale Texas publication time');
 const roster=new Map();
 if(!Array.isArray(detail.candidates)||detail.candidates.length>60)throw Error('Missing candidate roster');
 for(const c of detail.candidates){
  const id=normalize(c.name),p=party(c.party);
  if(!id||!p||roster.has(id)||!Number.isSafeInteger(c.votes)||c.votes<0)throw Error('Invalid Texas candidate');
  roster.set(id,{party:p,votes:c.votes,sum:0});
 }
 if([...roster.values()].filter(c=>c.party==='D').length!==1||[...roster.values()].filter(c=>c.party==='R').length!==1||
  roster.get(normalize('James Talarico'))?.party!=='D'||roster.get(normalize('Ken Paxton'))?.party!=='R')
  throw Error('Pinned Texas major-candidate identity changed');
 const counties=rows.map(({raw,county,county_fips})=>{
  const present=new Set();let d=0,r=0,o=0;
  if(!Array.isArray(raw.candidates))throw Error('Missing Texas county candidates');
  for(const c of raw.candidates){
   const id=normalize(c.name),entry=roster.get(id);
   if(!entry||present.has(id)||entry.party!==party(c.party)||!Number.isSafeInteger(c.votes)||c.votes<0)
    throw Error('Texas county candidate/count mismatch');
   present.add(id);entry.sum+=c.votes;
   if(entry.party==='D')d+=c.votes;else if(entry.party==='R')r+=c.votes;else o+=c.votes;
  }
  if(present.size!==roster.size||!Number.isSafeInteger(d+r+o))throw Error('Incomplete Texas county roster');
  return {county,county_fips,dem_votes:d,rep_votes:r,other_votes:o,
   vote_method:'combined_not_reported',completion_verified:false};
 });
 if([...roster.values()].some(c=>c.sum!==c.votes))throw Error('Texas county sums disagree with statewide totals');
 const total=[...roster.values()].reduce((n,c)=>n+c.votes,0);
 if(!Number.isSafeInteger(total)||!closes.allowed('TX-SEN',total,detail.last_updated,now))
  throw Error('Pre-close/unverified Texas vote publication');
 return {status:total?'VALIDATED_COUNTY_COUNTS_METHOD_MIX_UNRESOLVED':'NO_REPORTED_VOTES',
  source_url:URL,race_code:'TX-SEN',snapshot_updated_at:detail.last_updated,
  timestamp_scope:'provider_race_snapshot_not_independent_county_update_times',
  county_identities_matched:254,counties,live_votes_accepted:total>0,
  method_split_reported:false,completion_verified:false,may_move_national_needle:false};
}
return Object.freeze({URL,parse});
});
