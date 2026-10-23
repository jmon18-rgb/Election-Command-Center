/* External county results source adapter: provenance and identity gate.
 * This does not assert any existing provider exposes county returns.
 * Never convert statewide totals into county vote observations.
 */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.VerifiedCountySourceContract2026=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const validInt=n=>Number.isSafeInteger(n)&&n>=0;
 const acceptedUrl=u=>typeof u==='string'&&/^https:\/\/[^\s/]+\//.test(u);
 function normalize(envelope,expected){
  if(!envelope||envelope.schema!=='county-results-v1'||!expected||
    envelope.election_date!=='2026-11-03'||envelope.election_type!=='General'||
    envelope.production!==true||envelope.is_test!==false||
    envelope.provider!==expected.provider||
    envelope.provider_race_id!==expected.provider_race_id||
    envelope.race_key!==expected.race_key||
    envelope.state!==expected.state||
    envelope.office!==expected.office||
    envelope.source_verified!==true||!acceptedUrl(envelope.source_url)||
    envelope.source_url!==expected.source_url||
    !Array.isArray(envelope.counties)||!envelope.counties.length||
    envelope.counties.length>2000)return {ok:false,reason:'SOURCE_CONTRACT_UNVERIFIED'};
  const rows=[],seen=new Set();
  for(const county of envelope.counties){
   if(!county||typeof county.fips!=='string'||!/^\d{5}$/.test(county.fips)||
      county.fips.slice(0,2)!==expected.state_fips||seen.has(county.fips)||
      !validInt(county.ballots_reported)||
      !Array.isArray(county.candidates)||county.candidates.length<2||
      county.candidates.length>20||
      !['partial','final'].includes(county.reporting_status)||
      !Number.isFinite(Date.parse(county.updated_at||''))||
      !/^2026-11-(?:0[3-9]|[12][0-9]|30)T/.test(county.updated_at||''))
      return {ok:false,reason:'INVALID_COUNTY_OBSERVATION'};
   let total=0;const names=new Set(),candidates=[];
   for(const c of county.candidates){
    if(!c||typeof c.name!=='string'||!c.name.trim()||
       typeof c.party!=='string'||!c.party.trim()||
       !validInt(c.votes)||names.has(c.name.toLowerCase()))
      return {ok:false,reason:'INVALID_CANDIDATE_TOTALS'};
    names.add(c.name.toLowerCase());total+=c.votes;
    candidates.push({name:c.name,party:c.party,votes:c.votes});
   }
   if(!Number.isSafeInteger(total)||total>county.ballots_reported)
    return {ok:false,reason:'VOTES_EXCEED_BALLOTS'};
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
