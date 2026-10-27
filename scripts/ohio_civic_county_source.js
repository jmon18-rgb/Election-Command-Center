// Full public Ohio special-Senate response; no live controller or national activation.
// Exact seven-name 2026 roster independently verified against official county list.
(function(root,factory){const api=factory(typeof module!=='undefined'&&module.exports?require('./election_night_poll_closings_2026.js'):root?.ElectionNightPollClosings2026);
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.OhioCivicCountySource=api;
})(typeof window!=='undefined'?window:null,function(closes){
'use strict';
const URL='https://civicapi.org/api/v2/race/87527';
const normalize=s=>String(s).toLowerCase().replace(/[^a-z]/g,'');
const party=s=>({Democratic:'D',Republican:'R',Libertarian:'L','Other Party':'O','Write-In':'W'})[s]||null;
const PINNED=Object.freeze([['Sherrod Brown','D',221403],['Stephen Faris','W',221404],
 ['Anthony Holliman','W',221405],['Jon Husted','R',221406],['Greg Levy','O',221407],
 ['William B. Redpath','L',221408],['Timothy Telymonde','W',221409]]);
function parse(detail,reference,{source_url=URL,now=Date.now()}={}){
 if(source_url!==URL||!Number.isFinite(now))throw Error('Unverified Ohio source URL/clock');
 if(detail?.country!=='US'||detail.province!=='OH'||detail.district!==null||detail.municipality!==null||
  detail.election_scope!=='General'||detail.election_type!=='US Senate'||detail.election_name!=='Ohio US Senate Special General'||
  !/^2026-11-03T\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(detail.election_date||''))
  throw Error('Wrong exact 2026 Ohio Senate identity');
 if(!Array.isArray(reference?.counties)||reference.counties.length!==88)throw Error('Missing independent Ohio county reference');
 const byFips=new Map(reference.counties.map(c=>[c.fips,c.county])),seen=new Set();
 if(byFips.size!==88||[...byFips.keys()].some(f=>!/^39\d{3}$/.test(f)))throw Error('Invalid/duplicate Ohio reference');
 const regions=detail.region_results;
 if(!regions||Array.isArray(regions)||typeof regions!=='object'||Object.keys(regions).length!==88)
  throw Error('Full88-county payload required; light detail is not a county feed');
 const rows=Object.values(regions).map(r=>{
  if(r?.type!=='County'||!byFips.has(r.fips)||seen.has(r.fips)||normalize(r.name)!==normalize(byFips.get(r.fips)))
   throw Error('Unmatched, duplicate or wrong-state Ohio county');
  seen.add(r.fips);return {raw:r,county:byFips.get(r.fips),county_fips:r.fips};
 });
 if(detail.test_data===true)return {status:'TEST_DATA_NOT_LIVE',county_identities_matched:88,
  counties:[],source_url:URL,live_votes_accepted:false,may_move_national_needle:false};
 if(detail.test_data!==false||detail.is_test===true||detail.test===true||detail.mock===true||
  detail.is_mock===true||detail.active===false||detail.live===false)throw Error('Unverified/test Ohio data');
 const stamp=Date.parse(detail.last_updated);
 if(!Number.isFinite(stamp)||!/(?:Z|[+-]\d\d:\d\d)$/.test(detail.last_updated||'')||
  stamp>now+15*60000||now-stamp>180*60000)throw Error('Missing/future/stale Ohio publication time');
 if(detail.round!==1)throw Error('Unreviewed Ohio count round');
 const roster=new Map();
 if(!Array.isArray(detail.candidates)||detail.candidates.length!==PINNED.length)throw Error('Missing candidate roster');
 for(const c of detail.candidates){
  const id=normalize(c.name),p=party(c.party);
  const expected=PINNED.find(x=>normalize(x[0])===id);
  if(!expected||expected[1]!==p||expected[2]!==c.candidate_id)throw Error('Pinned Ohio native candidate identity changed');
  if(!id||!p||roster.has(id)||!Number.isSafeInteger(c.votes)||c.votes<0)throw Error('Invalid Ohio candidate');
  roster.set(id,{party:p,votes:c.votes,sum:0});
 }
 const counties=rows.map(({raw,county,county_fips})=>{
  const present=new Set();let d=0,r=0,o=0;
  if(!Array.isArray(raw.candidates))throw Error('Missing Ohio county candidates');
  for(const c of raw.candidates){
   const id=normalize(c.name),entry=roster.get(id);
   if(!entry||present.has(id)||entry.party!==party(c.party)||!Number.isSafeInteger(c.votes)||c.votes<0)
    throw Error('Ohio county candidate/count mismatch');
   present.add(id);entry.sum+=c.votes;
   if(entry.party==='D')d+=c.votes;else if(entry.party==='R')r+=c.votes;else o+=c.votes;
  }
  if(present.size!==roster.size||!Number.isSafeInteger(d+r+o))throw Error('Incomplete Ohio county roster');
  return {county,county_fips,dem_votes:d,rep_votes:r,other_votes:o,
   vote_method:'combined_not_reported',completion_verified:false};
 });
 if([...roster.values()].some(c=>c.sum!==c.votes))throw Error('Ohio county sums disagree with statewide totals');
 const total=[...roster.values()].reduce((n,c)=>n+c.votes,0);
 if(!Number.isSafeInteger(total)||!closes.allowed('OH-SEN',total,detail.last_updated,now))
  throw Error('Pre-close/unverified Ohio vote publication');
 return {status:total?'VALIDATED_COUNTY_COUNTS_METHOD_MIX_UNRESOLVED':'NO_REPORTED_VOTES',
  source_url:URL,race_code:'OH-SEN',snapshot_updated_at:detail.last_updated,
  timestamp_scope:'provider_race_snapshot_not_independent_county_update_times',
  county_identities_matched:88,counties,live_votes_accepted:total>0,
  method_split_reported:false,completion_verified:false,may_move_national_needle:false};
}
return Object.freeze({URL,parse});
});
