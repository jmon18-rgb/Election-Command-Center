// Full public Wisconsin House response; light responses do not contain county returns.
(function(root,factory){const api=factory(typeof module!=='undefined'&&module.exports?require('./election_night_poll_closings_2026.js'):root?.ElectionNightPollClosings2026);
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.WisconsinHouseCountySource=api;
})(typeof window!=='undefined'?window:null,function(closes){
'use strict';
const scopes={'WI-01':{id:87483,n:5,district:1,dem:'Mitchell Berman',rep:'Bryan Steil'},'WI-03':{id:87485,n:19,district:3,dem:'Rebecca Cooke',rep:'Derrick Van Orden'}};
function forRace(code){
 const cfg=Object.hasOwn(scopes,code)?scopes[code]:null;if(!cfg)throw Error('Unsupported Wisconsin House source scope');
 const URL='https://civicapi.org/api/v2/race/'+cfg.id;
const normalize=s=>String(s).toLowerCase().replace(/[^a-z]/g,'');
const party=s=>({Democratic:'D',Republican:'R',Libertarian:'L'})[s]||null;
function parse(detail,reference,{source_url=URL,now=Date.now()}={}){
 if(source_url!==URL||!Number.isFinite(now))throw Error('Unverified Wisconsin House source URL/clock');
 if(detail?.country!=='US'||detail.province!=='WI'||detail.district!==code||detail.municipality!==null||
  detail.election_scope!=='General'||detail.election_type!=='House of Representatives'||detail.election_name!=='Wisconsin US House '+cfg.district||
  !/^2026-11-03T\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(detail.election_date||''))
  throw Error('Wrong exact 2026 Wisconsin House identity');
 if(!Array.isArray(reference?.counties)||reference.counties.length!==cfg.n)throw Error('Missing independent Wisconsin House county reference');
 const byFips=new Map(reference.counties.map(c=>[c.fips,c.county])),seen=new Set();
 if(byFips.size!==cfg.n||[...byFips.keys()].some(f=>!/^55\d{3}$/.test(f)))throw Error('Invalid/duplicate Wisconsin House reference');
 const regions=detail.region_results;
 if(!regions||Array.isArray(regions)||typeof regions!=='object'||Object.keys(regions).length!==cfg.n)
  throw Error('Complete district-part county payload required; light detail is not a county feed');
 const rows=Object.values(regions).map(r=>{
  if(r?.type!=='County'||!byFips.has(r.fips)||seen.has(r.fips)||normalize(r.name)!==normalize(byFips.get(r.fips)))
   throw Error('Unmatched, duplicate or wrong-state Wisconsin House county');
  seen.add(r.fips);return {raw:r,county:byFips.get(r.fips),county_fips:r.fips};
 });
 if(detail.test_data===true)return {status:'TEST_DATA_NOT_LIVE',county_identities_matched:cfg.n,
  counties:[],source_url:URL,live_votes_accepted:false,may_move_national_needle:false};
 if(detail.test_data!==false||detail.is_test===true||detail.test===true||detail.mock===true||
  detail.is_mock===true||detail.active===false||detail.live===false)throw Error('Unverified/test Wisconsin House data');
 const stamp=Date.parse(detail.last_updated);
 if(!Number.isFinite(stamp)||!/(?:Z|[+-]\d\d:\d\d)$/.test(detail.last_updated||'')||
  stamp>now+15*60000||now-stamp>180*60000)throw Error('Missing/future/stale Wisconsin House publication time');
 const roster=new Map();
 if(!Array.isArray(detail.candidates)||detail.candidates.length>60)throw Error('Missing candidate roster');
 for(const c of detail.candidates){
  const id=normalize(c.name),p=party(c.party);
  if(!id||!p||roster.has(id)||!Number.isSafeInteger(c.votes)||c.votes<0)throw Error('Invalid Wisconsin House candidate');
  roster.set(id,{party:p,votes:c.votes,sum:0});
 }
 if([...roster.values()].filter(c=>c.party==='D').length!==1||[...roster.values()].filter(c=>c.party==='R').length!==1||
  roster.get(normalize(cfg.dem))?.party!=='D'||roster.get(normalize(cfg.rep))?.party!=='R')
  throw Error('Pinned Wisconsin House major-candidate identity changed');
 const counties=rows.map(({raw,county,county_fips})=>{
  const present=new Set();let d=0,r=0,o=0;
  if(!Array.isArray(raw.candidates))throw Error('Missing Wisconsin House county candidates');
  for(const c of raw.candidates){
   const id=normalize(c.name),entry=roster.get(id);
   if(!entry||present.has(id)||entry.party!==party(c.party)||!Number.isSafeInteger(c.votes)||c.votes<0)
    throw Error('Wisconsin House county candidate/count mismatch');
   present.add(id);entry.sum+=c.votes;
   if(entry.party==='D')d+=c.votes;else if(entry.party==='R')r+=c.votes;else o+=c.votes;
  }
  if(present.size!==roster.size||!Number.isSafeInteger(d+r+o))throw Error('Incomplete Wisconsin House county roster');
  return {county,county_fips,dem_votes:d,rep_votes:r,other_votes:o,
   vote_method:'combined_not_reported',completion_verified:false};
 });
 if([...roster.values()].some(c=>c.sum!==c.votes))throw Error('Wisconsin House county sums disagree with district totals');
 const total=[...roster.values()].reduce((n,c)=>n+c.votes,0);
 if(!Number.isSafeInteger(total)||!closes.allowed(code,total,detail.last_updated,now))
  throw Error('Pre-close/unverified Wisconsin House vote publication');
 return {status:total?'VALIDATED_COUNTY_COUNTS_METHOD_MIX_UNRESOLVED':'NO_REPORTED_VOTES',
  source_url:URL,race_code:code,snapshot_updated_at:detail.last_updated,
  timestamp_scope:'provider_race_snapshot_not_independent_county_update_times',
  county_identities_matched:cfg.n,counties,live_votes_accepted:total>0,
  method_split_reported:false,completion_verified:false,may_move_national_needle:false};
}
return Object.freeze({URL,parse});
}
return Object.freeze({...forRace('WI-01'),forRace});
});
