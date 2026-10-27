// Maine county aggregates only; nested township returns are excluded.
// Preparation only: explicitly first-choice evidence, never final RCV outcome.
(function(root,factory){const api=factory(typeof module!=='undefined'&&module.exports?require('./election_night_poll_closings_2026.js'):root?.ElectionNightPollClosings2026);
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.MaineCivicCountySource=api;
})(typeof window!=='undefined'?window:null,function(closes){
'use strict';
const URL='https://civicapi.org/api/v2/race/87188';
const normalize=s=>String(s).toLowerCase().replace(/[^a-z]/g,'');
const party=s=>({Democratic:'D',Republican:'R',Libertarian:'L'})[s]||null;
function parse(detail,reference,{source_url=URL,now=Date.now()}={}){
 if(source_url!==URL||!Number.isFinite(now))throw Error('Unverified Maine source URL/clock');
 if(detail?.country!=='US'||detail.province!=='ME'||detail.district!==null||detail.municipality!==null||
  detail.election_scope!=='General'||detail.election_type!=='US Senate'||detail.election_name!=='Maine US Senate'||
  !/^2026-11-03T\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(detail.election_date||''))
  throw Error('Wrong exact 2026 Maine Senate identity');
 if(!Array.isArray(reference?.counties)||reference.counties.length!==16)throw Error('Missing independent Maine county reference');
 const byFips=new Map(reference.counties.map(c=>[c.fips,c.county])),seen=new Set();
 if(byFips.size!==16||[...byFips.keys()].some(f=>!/^23\d{3}$/.test(f)))throw Error('Invalid/duplicate Maine reference');
 if(detail.round!==1)throw Error('Only explicitly identified first-choice round one supported; not final RCV');
 const allRegions=detail.region_results;
 if(!allRegions||Array.isArray(allRegions)||typeof allRegions!=='object'||Object.keys(allRegions).length>2000||Object.values(allRegions).some(r=>!['County','Township'].includes(r?.type)))throw Error('Unexpected Maine geography');
 // County aggregates and nested municipalities must NEVER be added together.
 const regions=Object.fromEntries(Object.entries(allRegions).filter(([,r])=>r.type==='County'));
 if(!regions||Array.isArray(regions)||typeof regions!=='object'||Object.keys(regions).length!==16)
  throw Error('Full16-county payload required; light detail is not a county feed');
 const rows=Object.values(regions).map(r=>{
  if(r?.type!=='County'||!byFips.has(r.fips)||seen.has(r.fips)||normalize(r.name)!==normalize(byFips.get(r.fips)))
   throw Error('Unmatched, duplicate or wrong-state Maine county');
  seen.add(r.fips);return {raw:r,county:byFips.get(r.fips),county_fips:r.fips};
 });
 if(detail.test_data===true)return {status:'TEST_DATA_NOT_LIVE',county_identities_matched:16,
  counties:[],source_url:URL,live_votes_accepted:false,may_move_national_needle:false};
 if(detail.test_data!==false||detail.is_test===true||detail.test===true||detail.mock===true||
  detail.is_mock===true||detail.active===false||detail.live===false)throw Error('Unverified/test Maine data');
 const stamp=Date.parse(detail.last_updated);
 if(!Number.isFinite(stamp)||!/(?:Z|[+-]\d\d:\d\d)$/.test(detail.last_updated||'')||
  stamp>now+15*60000||now-stamp>180*60000)throw Error('Missing/future/stale Maine publication time');
 const roster=new Map();
 if(!Array.isArray(detail.candidates)||detail.candidates.length>60)throw Error('Missing candidate roster');
 for(const c of detail.candidates){
  const id=normalize(c.name),p=party(c.party);
  const pinned={troyjackson:220471,susancollins:220470};
  if(c.candidate_id!==pinned[id]||!Object.hasOwn(pinned,id))throw Error('Pinned Maine candidate ID changed');
  if(!id||!p||roster.has(id)||!Number.isSafeInteger(c.votes)||c.votes<0)throw Error('Invalid Maine candidate');
  roster.set(id,{party:p,votes:c.votes,sum:0});
 }
 if(roster.size!==2)throw Error('Additional named/write-in candidate requires reviewed round contract');
 if([...roster.values()].filter(c=>c.party==='D').length!==1||[...roster.values()].filter(c=>c.party==='R').length!==1||
  roster.get(normalize('Troy Jackson'))?.party!=='D'||roster.get(normalize('Susan Collins'))?.party!=='R')
  throw Error('Pinned Maine major-candidate identity changed');
 const counties=rows.map(({raw,county,county_fips})=>{
  const present=new Set();let d=0,r=0,o=0;
  if(!Array.isArray(raw.candidates))throw Error('Missing Maine county candidates');
  for(const c of raw.candidates){
   const id=normalize(c.name),entry=roster.get(id);
   if(!entry||present.has(id)||entry.party!==party(c.party)||!Number.isSafeInteger(c.votes)||c.votes<0)
    throw Error('Maine county candidate/count mismatch');
   present.add(id);entry.sum+=c.votes;
   if(entry.party==='D')d+=c.votes;else if(entry.party==='R')r+=c.votes;else o+=c.votes;
  }
  if(present.size!==roster.size||!Number.isSafeInteger(d+r+o))throw Error('Incomplete Maine county roster');
  return {county,county_fips,dem_votes:d,rep_votes:r,other_votes:o,
   vote_method:'combined_not_reported',completion_verified:false};
 });
 if([...roster.values()].some(c=>c.sum!==c.votes))throw Error('Maine county sums disagree with statewide totals');
 const total=[...roster.values()].reduce((n,c)=>n+c.votes,0);
 if(!Number.isSafeInteger(total)||!closes.allowed('ME-SEN',total,detail.last_updated,now))
  throw Error('Pre-close/unverified Maine vote publication');
 return {status:total?'VALIDATED_COUNTY_COUNTS_METHOD_MIX_UNRESOLVED':'NO_REPORTED_VOTES',
  source_url:URL,race_code:'ME-SEN',snapshot_updated_at:detail.last_updated,
  timestamp_scope:'provider_race_snapshot_not_independent_county_update_times',
  round:1,ranked_choice_scope:'FIRST_CHOICE_ONLY_NOT_FINAL_RCV_OUTCOME',
  county_identities_matched:16,counties,live_votes_accepted:total>0,
  method_split_reported:false,completion_verified:false,may_move_national_needle:false};
}
return Object.freeze({URL,parse});
});
