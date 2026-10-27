// Shared exact-scope public House responses; legacy Wisconsin entry point retained.
// light responses do not contain county returns.
(function(root,factory){const api=factory(typeof module!=='undefined'&&module.exports?require('./election_night_poll_closings_2026.js'):root?.ElectionNightPollClosings2026);
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.WisconsinHouseCountySource=api;
})(typeof window!=='undefined'?window:null,function(closes){
'use strict';
const scopes={'PA-07':{id:87382,n:4,district:7,state:'PA',stateName:'Pennsylvania',prefix:'42',dem:'Bob Brooks',rep:'Ryan Mackenzie',majorOnly:true,nativeIds:{bobbrooks:221027,ryanmackenzie:221028},roundOne:true},'WI-01':{id:87483,n:5,district:1,dem:'Mitchell Berman',rep:'Bryan Steil'},'WI-03':{id:87485,n:19,district:3,dem:'Rebecca Cooke',rep:'Derrick Van Orden'},'MI-04':{id:87204,n:6,district:4,state:'MI',stateName:'Michigan',prefix:'26',dem:'Sean McCann',rep:'Bill Huizenga',green:'Shafina Che Barnett'},'PA-10':{id:87385,n:3,district:10,state:'PA',stateName:'Pennsylvania',prefix:'42',dem:'Janelle Stelson',rep:'Scott Perry',majorOnly:true},'NY-17':{id:87319,n:4,district:17,state:'NY',stateName:'New York',prefix:'36',dem:'Cait Conley',rep:'Mike Lawler',majorOnly:true}};
function forRace(code){
 const cfg=Object.hasOwn(scopes,code)?scopes[code]:null;if(!cfg)throw Error('Unsupported House county source scope');
 const URL='https://civicapi.org/api/v2/race/'+cfg.id,state=cfg.state||'WI',stateName=cfg.stateName||'Wisconsin',prefix=cfg.prefix||'55';
const normalize=s=>String(s).toLowerCase().replace(/[^a-z]/g,'');
const party=s=>({Democratic:'D',Republican:'R',Libertarian:'L',...(cfg.green?{Green:'G'}:{})})[s]||null;
function parse(detail,reference,{source_url=URL,now=Date.now()}={}){
 if(source_url!==URL||!Number.isFinite(now))throw Error('Unverified House county source URL/clock');
 if(detail?.country!=='US'||detail.province!==state||detail.district!==code||detail.municipality!==null||
  detail.election_scope!=='General'||detail.election_type!=='House of Representatives'||detail.election_name!==stateName+' US House '+cfg.district||
  !/^2026-11-03T\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(detail.election_date||''))
  throw Error('Wrong exact 2026 House county identity');
 if(!Array.isArray(reference?.counties)||reference.counties.length!==cfg.n)throw Error('Missing independent House county reference');
 const byFips=new Map(reference.counties.map(c=>[c.fips,c.county])),seen=new Set();
 if(byFips.size!==cfg.n||[...byFips.keys()].some(f=>!new RegExp('^'+prefix+'\\d{3}$').test(f)))throw Error('Invalid/duplicate House county reference');
 const regions=detail.region_results;
 if(!regions||Array.isArray(regions)||typeof regions!=='object'||Object.keys(regions).length!==cfg.n)
  throw Error('Complete district-part county payload required; light detail is not a county feed');
 const rows=Object.values(regions).map(r=>{
  if(r?.type!=='County'||!byFips.has(r.fips)||seen.has(r.fips)||normalize(r.name)!==normalize(byFips.get(r.fips)))
   throw Error('Unmatched, duplicate or wrong-state House county');
  seen.add(r.fips);return {raw:r,county:byFips.get(r.fips),county_fips:r.fips};
 });
 if(detail.test_data===true)return {status:'TEST_DATA_NOT_LIVE',county_identities_matched:cfg.n,
  counties:[],source_url:URL,live_votes_accepted:false,may_move_national_needle:false};
 if(detail.test_data!==false||detail.is_test===true||detail.test===true||detail.mock===true||
  detail.is_mock===true||detail.active===false||detail.live===false)throw Error('Unverified/test House county data');
 const stamp=Date.parse(detail.last_updated);
 if(!Number.isFinite(stamp)||!/(?:Z|[+-]\d\d:\d\d)$/.test(detail.last_updated||'')||
  stamp>now+15*60000||now-stamp>180*60000)throw Error('Missing/future/stale House county publication time');
 if(cfg.roundOne&&detail.round!==1)throw Error('Unreviewed PA-07 count round');
 const roster=new Map();
 if(!Array.isArray(detail.candidates)||detail.candidates.length>60)throw Error('Missing candidate roster');
 for(const c of detail.candidates){
  const id=normalize(c.name),p=party(c.party);
  if(cfg.nativeIds&&cfg.nativeIds[id]!==c.candidate_id)throw Error('Pinned PA-07 native candidate identity changed');
  if(!id||!p||roster.has(id)||!Number.isSafeInteger(c.votes)||c.votes<0)throw Error('Invalid House county candidate');
  roster.set(id,{party:p,votes:c.votes,sum:0});
 }
 if([...roster.values()].filter(c=>c.party==='D').length!==1||[...roster.values()].filter(c=>c.party==='R').length!==1||
  roster.get(normalize(cfg.dem))?.party!=='D'||roster.get(normalize(cfg.rep))?.party!=='R')
  throw Error('Pinned House county major-candidate identity changed');
 if(cfg.green&&(roster.size!==3||roster.get(normalize(cfg.green))?.party!=='G'))throw Error('Pinned Michigan third-candidate identity changed');
 if(cfg.majorOnly&&roster.size!==2)throw Error('Pinned Pennsylvania candidate roster changed');
 const counties=rows.map(({raw,county,county_fips})=>{
  const present=new Set();let d=0,r=0,o=0;
  if(!Array.isArray(raw.candidates))throw Error('Missing House county candidates');
  for(const c of raw.candidates){
   const id=normalize(c.name),entry=roster.get(id);
   if(!entry||present.has(id)||entry.party!==party(c.party)||!Number.isSafeInteger(c.votes)||c.votes<0)
    throw Error('House county candidate/count mismatch');
   present.add(id);entry.sum+=c.votes;
   if(entry.party==='D')d+=c.votes;else if(entry.party==='R')r+=c.votes;else o+=c.votes;
  }
  if(present.size!==roster.size||!Number.isSafeInteger(d+r+o))throw Error('Incomplete House county roster');
  return {county,county_fips,dem_votes:d,rep_votes:r,other_votes:o,
   vote_method:'combined_not_reported',completion_verified:false};
 });
 if([...roster.values()].some(c=>c.sum!==c.votes))throw Error('House county sums disagree with district totals');
 const total=[...roster.values()].reduce((n,c)=>n+c.votes,0);
 if(!Number.isSafeInteger(total)||!closes.allowed(code,total,detail.last_updated,now))
  throw Error('Pre-close/unverified House county vote publication');
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
