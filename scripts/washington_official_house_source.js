// Official public Washington app contract. Preparation only: no browser controller
// or national evidence scope is enabled by this module.
(function(root,factory){const api=factory(typeof module!=='undefined'&&module.exports?
 require('./election_night_poll_closings_2026.js'):root?.ElectionNightPollClosings2026);
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.WashingtonOfficialHouseSource=api;
})(typeof window!=='undefined'?window:null,function(closes){
 'use strict';
 const ID='54c40000-9064-bbec-4779-08df15c0a82a';
 const URL='https://results.votewa.gov/results/public/api/elections/washington/20261103/data/ballot-item/'+ID;
 const names=['Clark','Cowlitz','Lewis','Pacific','Skamania','Thurston','Wahkiakum'];
 const roster={
  '1601892':{name:'Marie Gluesenkamp Perez',party:'DEM',key:'dem_votes',id:'54c40000-9064-bbec-51e8-08df15c0a82a'},
  '1601893':{name:'John Braun',party:'REP',key:'rep_votes',id:'54c40000-9064-bbec-56e1-08df15c0a82a'},
  '9910':{name:'Write-in',party:null,key:'other_votes',id:'54c40000-9064-bbec-4cec-08df15c0a82a'}
 };
 const text=x=>Array.isArray(x)&&x.length===1&&x[0]?.languageId==='en'?x[0].text:null;
 const count=x=>Number.isSafeInteger(x)&&x>=0;
 function counts(options){
  if(!Array.isArray(options)||options.length!==3)throw Error('Incomplete official WA03 roster');
  const seen=new Set(),out={dem_votes:0,rep_votes:0,other_votes:0};
  for(const r of options){
   const cfg=Object.hasOwn(roster,r?.nativeId)?roster[r.nativeId]:null;
   if(!cfg||seen.has(r.nativeId)||r.id!==cfg.id||text(r.name)!==cfg.name||r.party?.abbreviation!==cfg.party||
     r.isWriteIn!==(cfg.key==='other_votes')||r.isQualifiedWriteIn!==false||!count(r.voteCount)||r.groupResults!==null)
    throw Error('Official WA03 candidate identity/count/method changed');
   seen.add(r.nativeId);out[cfg.key]=r.voteCount;
  }
  if(!count(out.dem_votes+out.rep_votes+out.other_votes))throw Error('Unsafe official vote aggregate');
  return out;
 }
 function parse(raw,reference,{source_url=URL,now=Date.now()}={}){
  if(source_url!==URL||!Number.isFinite(now))throw Error('Unverified official WA source/clock');
  const e=raw?.election,b=raw?.ballotItemWithBreakdown;
  if([raw,e,b].some(x=>x&&['test_data','mock','is_test','test','is_mock','isTest'].some(k=>x[k]===true)))
   throw Error('Official Washington test data excluded');
  if(raw?.jurisdiction?.shortName!=='washington'||e?.electionDate!=='2026-11-03'||text(e.name)!=='2026 General'||
    e.isPrimary!==false||e.isProduction!==true||typeof e.isOfficialResults!=='boolean'||
    e.id!=='01000000-a578-3971-654b-08defdf81b1d'||raw.test_data===true||raw.mock===true||raw.is_test===true||
    b?.id!==ID||text(b.name)!=='Congressional District 3 - U.S. Representative'||b.contestType!=='Candidate'||
    b.rankedChoiceSummaryResults!==null||b.breakdownResultCount!==7||!Array.isArray(b.breakdownResults)||b.breakdownResults.length!==7)
   throw Error('Wrong official Washington election/contest or test data');
  const referenceRows=reference?.counties;
  if(!Array.isArray(referenceRows)||referenceRows.length!==7)throw Error('Missing independent WA county reference');
  const byName=new Map(referenceRows.map(r=>[r.county,r.fips]));
  if(byName.size!==7||new Set(byName.values()).size!==7||names.some(n=>!byName.has(n))||
    [...byName.values()].some(f=>!/^53\d{3}$/.test(f)))throw Error('Invalid independent WA county identities');
  const stamp=e.asOf,published=e.publishDate;
  for(const s of [stamp,published]){
   const t=Date.parse(s);
   if(!/(?:Z|[+-]\d\d:\d\d)$/.test(s||'')||!Number.isFinite(t)||t>now+15*60000||now-t>180*60000)
    throw Error('Missing/future/stale official WA publication time');
  }
  if(Date.parse(published)<Date.parse(stamp))throw Error('Official publication precedes results snapshot');
  const summary=counts(b.summaryResults?.ballotOptions),seen=new Set();
  const overview=raw.ballotItems?.filter(r=>r.id===ID);
  if(!Array.isArray(overview)||overview.length!==1||overview[0].publishPublicElectionId!=='20261103'||
    text(overview[0].name)!==text(b.name)||overview[0].contestType!=='Candidate'||overview[0].voteTotal!==b.voteTotal||
    JSON.stringify(counts(overview[0].summaryResults?.ballotOptions))!==JSON.stringify(summary))
   throw Error('Official contest overview/detail disagrees');
  const counties=b.breakdownResults.map(r=>{
   const county=text(r.locality?.name)?.replace(/ County$/,'');
   if(!byName.has(county)||seen.has(county)||r.locality.shortName!==county.toLowerCase()+'-county-wa')
    throw Error('Unmatched/duplicate official WA county part');
   seen.add(county);const votes=counts(r.ballotOptions);
   if(!count(r.voteTotal)||r.voteTotal!==votes.dem_votes+votes.rep_votes+votes.other_votes)
    throw Error('Official county total disagrees with candidates');
   return {county,county_fips:byName.get(county),...votes,vote_method:'combined_not_reported',completion_verified:false};
  });
  for(const key of ['dem_votes','rep_votes','other_votes'])
   if(counties.reduce((s,r)=>s+r[key],0)!==summary[key])throw Error('Official county/district candidate sums disagree');
  const total=summary.dem_votes+summary.rep_votes+summary.other_votes;
  if(!count(b.voteTotal)||b.voteTotal!==total||!closes?.allowed('WA-03',total,stamp,now))
   throw Error('Wrong total or pre-close official WA counts');
  return {status:total?'VALIDATED_COUNTY_COUNTS_METHOD_MIX_UNRESOLVED':'NO_REPORTED_VOTES',
   source_url:URL,race_code:'WA-03',snapshot_updated_at:stamp,source_published_at:published,
   timestamp_scope:'official_state_snapshot_not_independent_county_batch_publication_times',
   county_identities_matched:7,counties,live_votes_accepted:total>0,
   method_split_reported:false,completion_verified:false,may_move_national_needle:false};
 }
 return Object.freeze({URL,parse});
});
