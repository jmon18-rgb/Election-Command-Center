// Exact reviewed SC General Senate county contract. Current saved original is TEST DATA.
(function(root,factory){const api=factory(typeof module!=='undefined'&&module.exports?require('./election_night_poll_closings_2026.js'):root?.ElectionNightPollClosings2026);
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.SouthCarolinaCivicCountySource=api;
})(typeof window!=='undefined'?window:null,function(closes){
 'use strict';
 const URL='https://civicapi.org/api/v2/race/87409';
 const PINNED=Object.freeze([['Annie Andrews','Democratic',221090,'D'],['Darline Graham','Republican',221091,'R'],['Mark Hackett','Constitution',221092,'O'],['Kasie Whitener','Libertarian',221093,'O']].map(Object.freeze));
 const validCount=n=>Number.isSafeInteger(n)&&n>=0;
 function parse(detail,reference,{source_url=URL,now=Date.now()}={}){
  if(source_url!==URL||!Number.isFinite(now))throw Error('Unverified SC source URL/clock');
  if(detail?.country!=='US'||detail.province!=='SC'||detail.district!==null||detail.municipality!==null||detail.election_scope!=='General'||detail.election_type!=='US Senate'||detail.election_name!=='South Carolina US Senate'||detail.election_date!=='2026-11-03T05:00:00.000Z')throw Error('Wrong exact 2026 SC Senate identity');
  if(reference?.schema!=='independent-sc-county-native-crosswalk-v1'||reference.state!=='SC'||reference.source_sha256!=='3c337402b5c6e8d5aa26b4278ccf4edc8989f2683765b3ffbf22296cdb2df3a0'||reference.counties?.length!==46)throw Error('Missing independent SC county reference');
  const byKey=new Map(reference.counties.map(c=>[c.native_key,c]));
  if(byKey.size!==46||new Set(reference.counties.map(c=>c.fips)).size!==46||new Set(reference.counties.map(c=>c.county)).size!==46||reference.counties.some(c=>!/^45\d{3}$/.test(c.fips)||!c.native_key||!c.native_name||!c.county||Boolean(c.native_fips_optional)!==(c.native_key==='mccormick')))throw Error('Invalid/duplicate SC county reference');
  const mc=byKey.get('mccormick');
  if(mc?.county!=='McCormick'||mc.native_name!=='Mccormick'||mc.fips!=='45065')throw Error('Unreviewed McCormick bridge');
  const regions=detail.region_results;
  if(!regions||Array.isArray(regions)||typeof regions!=='object'||Object.keys(regions).length!==46)throw Error('Full 46-county SC payload required');
  const rows=Object.entries(regions).map(([key,raw])=>{
   const ref=byKey.get(key);
   // Only the observed absent McCormick field can use the independently matched name/key bridge.
   // A present conflicting/null FIPS is never filled or corrected.
   if(!ref||raw?.type!=='County'||raw.name!==ref.native_name||
    (Object.hasOwn(raw,'fips')?raw.fips!==ref.fips:!ref.native_fips_optional))throw Error('Unmatched SC native county key/name/type/FIPS');
   return {raw,ref};
  });
  if(detail.test_data===true)return {status:'TEST_DATA_NOT_LIVE',county_identities_matched:46,counties:[],source_url:URL,live_votes_accepted:false,may_move_national_needle:false};
  if(detail.test_data!==false||['test','is_test','mock','is_mock','is_disputed'].some(k=>Object.hasOwn(detail,k)&&detail[k]!==false)||['active','live'].some(k=>Object.hasOwn(detail,k)&&detail[k]!==true))throw Error('Unverified/test/disputed SC data');
  const stamp=Date.parse(detail.last_updated);
  if(!Number.isFinite(stamp)||!/(?:Z|[+-]\d\d:\d\d)$/.test(detail.last_updated||'')||stamp>now+15*60000||now-stamp>180*60000)throw Error('Missing/future/stale SC publication time');
  if(detail.round!==1)throw Error('Unreviewed SC count round');
  const roster=new Map();
  if(!Array.isArray(detail.candidates)||detail.candidates.length!==4)throw Error('Missing/extra SC candidate roster');
  for(const c of detail.candidates){
   const expected=PINNED.find(p=>p[0]===c.name);
   if(!expected||expected[1]!==c.party||expected[2]!==c.candidate_id||roster.has(c.name)||!validCount(c.votes))throw Error('Pinned SC candidate ID/name/party/count changed');
   roster.set(c.name,{party:c.party,id:c.candidate_id,axis:expected[3],votes:c.votes,sum:0});
  }
  const counties=rows.map(({raw,ref})=>{
   if(!Array.isArray(raw.candidates)||raw.candidates.length!==4)throw Error('Missing/extra SC county candidates');
   const seen=new Set();let d=0,r=0,o=0;
   for(const c of raw.candidates){
    const entry=roster.get(c.name);
    if(!entry||seen.has(c.name)||entry.party!==c.party||(Object.hasOwn(c,'candidate_id')&&c.candidate_id!==entry.id)||!validCount(c.votes))throw Error('SC county candidate/count mismatch');
    seen.add(c.name);entry.sum+=c.votes;
    if(!validCount(entry.sum))throw Error('SC vote sum overflow');
    if(entry.axis==='D')d+=c.votes;else if(entry.axis==='R')r+=c.votes;else o+=c.votes;
   }
   if(!validCount(d+r+o))throw Error('SC county total overflow');
   return {county:ref.county,county_fips:ref.fips,dem_votes:d,rep_votes:r,other_votes:o,vote_method:'combined_not_reported',completion_verified:false};
  });
  if([...roster.values()].some(c=>c.sum!==c.votes))throw Error('SC county sums disagree with statewide totals');
  const total=[...roster.values()].reduce((n,c)=>n+c.votes,0);
  if(!validCount(total)||!closes.allowed('SC-SEN',total,detail.last_updated,now))throw Error('Pre-close/unverified SC vote publication');
  return {status:total?'VALIDATED_COUNTY_COUNTS_METHOD_MIX_UNRESOLVED':'NO_REPORTED_VOTES',source_url:URL,race_code:'SC-SEN',snapshot_updated_at:detail.last_updated,timestamp_scope:'provider_race_snapshot_not_independent_county_update_times',county_identities_matched:46,counties,live_votes_accepted:total>0,method_split_reported:false,completion_verified:false,may_move_national_needle:false};
 }
 return Object.freeze({URL,parse});
});
