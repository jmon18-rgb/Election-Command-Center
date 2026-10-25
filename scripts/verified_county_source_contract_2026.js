/* External county results source adapter: provenance and identity gate.
 * This does not assert any existing provider exposes county returns.
 * Never convert statewide totals into county vote observations.
 */
(function(root,factory){
 // Browser scripts may load before the shared poll-close module. Resolve
 // at read-time rather than capturing an undefined global during startup.
 const api=factory(()=>typeof module!=='undefined'&&module.exports?
  require('./election_night_poll_closings_2026.js'):
  root?.ElectionNightPollClosings2026,
  ()=>typeof module!=='undefined'&&module.exports?
  require('./election_night_state_county_fips_2026.js'):
  root?.ElectionNightStateCountyFIPS2026);
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.VerifiedCountySourceContract2026=api;
})(typeof window!=='undefined'?window:null,function(getCloses,getFips){
 'use strict';
 const validInt=n=>Number.isSafeInteger(n)&&n>=0;
 const acceptedUrl=u=>typeof u==='string'&&/^https:\/\/[^\s/]+\//.test(u);
 function normalize(envelope,expected,now=Date.now()){
  const closes=getCloses(),fips=getFips();
  if(!closes||typeof closes.allowed!=='function'||
     !fips||typeof fips.matches!=='function'||!Number.isFinite(now)||
     !envelope||envelope.schema!=='county-results-v1'||!expected||
    envelope.election_date!=='2026-11-03'||envelope.election_type!=='General'||
    envelope.production!==true||envelope.is_test!==false||
    envelope.provider!==expected.provider||
    envelope.provider_race_id!==expected.provider_race_id||
    envelope.race_key!==expected.race_key||
    envelope.state!==expected.state||
    // A malicious/misconfigured "NC" envelope with 51/VA county IDs
    // must not pass simply because its caller agrees with itself.
    fips.PREFIX[expected.state]!==expected.state_fips||
    envelope.office!==expected.office||
    // Caller and source cannot mutually claim a nonsensical state/race/office.
    typeof expected.race_key!=='string'||
    expected.race_key.slice(0,2)!==expected.state||
    !((expected.office==='Senate'&&expected.race_key===expected.state+'-SEN')||
      (expected.office==='Governor'&&expected.race_key===expected.state+'-GOV')||
      (expected.office==='House'&&
       /^[A-Z]{2}-\d{2}$/.test(expected.race_key)))||
    envelope.source_verified!==true||!acceptedUrl(envelope.source_url)||
    envelope.source_url!==expected.source_url||
    !Array.isArray(envelope.counties)||!envelope.counties.length||
    envelope.counties.length>2000)return {ok:false,reason:'SOURCE_CONTRACT_UNVERIFIED'};
  const rows=[],seen=new Set();
  for(const county of envelope.counties){
   if(!county||typeof county.fips!=='string'||!/^\d{5}$/.test(county.fips)||
      !fips.matches(expected.state,expected.state_fips,county.fips)||
      seen.has(county.fips)||
      !validInt(county.ballots_reported)||
      !Array.isArray(county.candidates)||county.candidates.length<2||
      county.candidates.length>20||
      !['partial','final'].includes(county.reporting_status)||
      typeof county.updated_at!=='string'||
      !/^2026-11-(?:0[3-9]|[12][0-9]|30)T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(county.updated_at)||
      !Number.isFinite(Date.parse(county.updated_at)))
      return {ok:false,reason:'INVALID_COUNTY_OBSERVATION'};
   // Never accept future county snapshots or count a pre-close test archive
   // as 2026 returns. The same 50-state poll-close contract is used by the
   // state/office feed and race nowcast. Receipt time alone is insufficient:
   // a pre-close source timestamp remains invalid AFTER the polls close.
   const observedAt=Date.parse(county.updated_at);
   if(observedAt>now+15*60000||
      (county.ballots_reported>0&&
       !closes.allowed(envelope.race_key,county.ballots_reported,
                       county.updated_at,now)))
      return {ok:false,reason:'SOURCE_TIME_BEFORE_LOCAL_CLOSE_OR_FUTURE'};
   // An old county record must not enter storage merely because the
   // statewide provider is healthy. Retain last-good snapshots in the
   // caller's audit history but require a new official source timestamp
   // to make them eligible for any current geographic comparison.
   if(now-observedAt>180*60000)
      return {ok:false,reason:'STALE_COUNTY_SOURCE_TIMESTAMP'};
   let total=0;const names=new Set(),candidates=[];
   for(const c of county.candidates){
    if(!c||typeof c.name!=='string'||!c.name.trim()||
       typeof c.party!=='string'||!c.party.trim()||
       !validInt(c.votes)||
       names.has(c.name.trim().toLocaleLowerCase('en-US')))
      return {ok:false,reason:'INVALID_CANDIDATE_TOTALS'};
    names.add(c.name.trim().toLocaleLowerCase('en-US'));total+=c.votes;
    candidates.push({name:c.name,party:c.party,votes:c.votes});
   }
   if(!Number.isSafeInteger(total)||total>county.ballots_reported)
    return {ok:false,reason:'VOTES_EXCEED_BALLOTS'};
   // No county returns are observed when every listed candidate has zero.
   if(county.ballots_reported>0&&total===0)
    return {ok:false,reason:'NO_ATTRIBUTABLE_CANDIDATE_VOTES'};
   seen.add(county.fips);
   rows.push({election_date:'2026-11-03',election_type:'General',
    verified_source:true,is_test:false,provider:envelope.provider,
    provider_race_id:envelope.provider_race_id,office:envelope.office,
    state:envelope.state,state_fips:expected.state_fips,
    race_key:envelope.race_key,county_id:county.fips,
    updated_at:county.updated_at,reporting_status:county.reporting_status,
    ballots_reported:county.ballots_reported,candidates,
    revision:county.revision===true});
  }
  return {ok:true,rows,provider:envelope.provider,source_url:envelope.source_url,
   may_move_national_needle:false};
 }
 return Object.freeze({normalize});
});
