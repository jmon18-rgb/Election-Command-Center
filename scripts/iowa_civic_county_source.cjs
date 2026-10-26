'use strict';
// Full civicAPI responses contain county rows; ?light= deliberately omits them.
const closes=require('./election_night_poll_closings_2026.js');
const URL='https://civicapi.org/api/v2/race/87151';
const normalize=s=>String(s).toLowerCase().replace(/[^a-z]/g,'');
const party=s=>({Democratic:'D',Republican:'R',Libertarian:'L'})[s]||null;
function countyIdentity(detail,reference){
 if(detail?.country!=='US'||detail.province!=='IA'||detail.district!==null||
  detail.municipality!==null||detail.election_scope!=='General'||detail.election_type!=='US Senate'||
  detail.election_name!=='Iowa US Senate'||
  !/^2026-11-03T\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(detail.election_date||''))
  throw Error('Wrong exact 2026 Iowa Senate source identity');
 if(!Array.isArray(reference?.counties)||reference.counties.length!==99)
  throw Error('Missing independently sourced 99-county reference');
 const byFips=new Map(reference.counties.map(c=>[c.fips,c.county]));
 if(byFips.size!==99)throw Error('Duplicate county reference');
 const regions=detail.region_results;
 if(!regions||Array.isArray(regions)||typeof regions!=='object'||Object.keys(regions).length!==99)
  throw Error('Full 99-county response required; light payload is not a county feed');
 const seen=new Set();
 const rows=Object.values(regions).map(r=>{
  if(r?.type!=='County'||!/^19\d{3}$/.test(r.fips||'')||seen.has(r.fips)||
   !byFips.has(r.fips)||normalize(r.name)!==normalize(byFips.get(r.fips)))
   throw Error('Unmatched, duplicate or wrong-state county identity');
  seen.add(r.fips);return {raw:r,county:byFips.get(r.fips),fips:r.fips};
 });
 return rows;
}
function parse(detail,reference,{source_url=URL,now=Date.now()}={}){
 if(source_url!==URL)throw Error('Unexpected full-race source URL');
 const identities=countyIdentity(detail,reference);
 if(detail.test_data===true)return {status:'TEST_DATA_NOT_LIVE',county_identities_matched:99,
  counties:[],live_votes_accepted:false,source_url:URL};
 if(detail.test_data!==false||detail.is_test===true||detail.test===true||detail.mock===true||
  detail.is_mock===true||detail.active===false)
  throw Error('Unverified/test county source');
 const stamp=Date.parse(detail.last_updated);
 if(!Number.isFinite(stamp)||!/(?:Z|[+-]\d\d:\d\d)$/.test(detail.last_updated||'')||
  stamp>now+15*60000||now-stamp>180*60000)
  throw Error('Missing/future/stale provider snapshot time');
 const roster=new Map();
 for(const c of detail.candidates||[]){
  const id=normalize(c.name),p=party(c.party);
  if(!id||!p||roster.has(id)||!Number.isSafeInteger(c.votes)||c.votes<0)
   throw Error('Invalid provider candidate roster');
  roster.set(id,{name:c.name,party:p,votes:c.votes,sum:0});
 }
 if([...roster.values()].filter(c=>c.party==='D').length!==1||
  [...roster.values()].filter(c=>c.party==='R').length!==1)
  throw Error('Missing/ambiguous major candidates');
 if(roster.get(normalize('Ashley Hinson'))?.party!=='R'||
  roster.get(normalize('Josh Turek'))?.party!=='D')throw Error('Pinned 2026 major-candidate identity changed');
 const counties=identities.map(({raw,county,fips})=>{
  const seen=new Set();let d=0,r=0,o=0;
  if(!Array.isArray(raw.candidates))throw Error('Missing county candidates');
  for(const c of raw.candidates){
   const id=normalize(c.name),entry=roster.get(id);
   if(!entry||seen.has(id)||entry.party!==party(c.party)||!Number.isSafeInteger(c.votes)||c.votes<0)
    throw Error('County candidate identity/count mismatch');
   seen.add(id);entry.sum+=c.votes;
   if(entry.party==='D')d+=c.votes;else if(entry.party==='R')r+=c.votes;else o+=c.votes;
  }
  if(seen.size!==roster.size||!Number.isSafeInteger(d+r+o))throw Error('Incomplete county candidate roster');
  return {county,county_fips:fips,dem_votes:d,rep_votes:r,other_votes:o,
   vote_method:'combined_not_reported',completion_verified:false};
 });
 if([...roster.values()].some(c=>c.sum!==c.votes))throw Error('County sums disagree with statewide candidate totals');
 const total=[...roster.values()].reduce((s,c)=>s+c.votes,0);
 if(!Number.isSafeInteger(total)||!closes.allowed('IA-SEN',total,detail.last_updated,now))
  throw Error('Pre-close/unverified Iowa vote publication');
 return {status:total?'VALIDATED_COUNTY_COUNTS_METHOD_MIX_UNRESOLVED':'NO_REPORTED_VOTES',
  source_url:URL,race_code:'IA-SEN',snapshot_updated_at:detail.last_updated,
  timestamp_scope:'provider_race_snapshot_not_independent_county_update_times',
  county_identities_matched:99,counties,live_votes_accepted:total>0,
  method_split_reported:false,completion_verified:false,may_move_national_needle:false};
}
module.exports={URL,countyIdentity,parse};
