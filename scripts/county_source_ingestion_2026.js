/* Source-contract to county-state adapter. No feed is certified by this module. */
(function(root,factory){
 const api=factory(
  typeof module!=='undefined'&&module.exports?
   require('./verified_county_source_contract_2026'):root.VerifiedCountySourceContract2026,
  typeof module!=='undefined'&&module.exports?
   require('./geographic_county_batch_2026'):root.GeographicCountyBatch2026,
  typeof module!=='undefined'&&module.exports?
   require('./geographic_matched_county_pulse_2026.js'):root.GeographicMatchedCountyPulse2026);
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.CountySourceIngestion2026=api;
})(typeof window!=='undefined'?window:null,function(contract,batch,pulse){
 'use strict';
 function ingest(previous,envelope,expected,baselines={},now=Date.now()){
  if(!contract||!batch)return {accepted:false,reason:'DEPENDENCIES_UNAVAILABLE'};
  const validated=contract.normalize(envelope,expected,now);
  if(!validated.ok)return {accepted:false,reason:validated.reason};
  // Pass the same validated viewer clock across source-contract,
  // county-batch and geographic-bridge checks. Otherwise downstream
  // Date.now() can disagree with a replay/loaded laptop snapshot.
  const processed=batch.process(previous,validated.rows,baselines,now);
  // A partial geographic comparison is descriptive ONLY: same verified
  // source/race, same counties, valid 2024 two-party baseline. Never let
  // a sample of reported counties change national odds or imply statewide
  // turnout coverage. In a browser without the optional advisory module,
  // expose no synthetic geographic estimate.
  // The county state store may retain independently valid rows when a
  // *new* incoming row fails identity, revision or arithmetic validation.
  // Do NOT publish a sample swing from those survivors while telling the
  // operator this same input batch contained rejected unsafe geography.
  // Harmless stale/duplicate polling retries can still reuse the latest
  // independently valid sample; they introduce no new unreviewed votes.
  const sameSnapshot=id=>{
   const old=Object.prototype.hasOwnProperty.call(previous,id)?previous[id]:null;
   const candidate=validated.rows.find(x=>x.race_key+'|'+x.county_id===id);
   if(!old||!candidate)return false;
   // 'STALE_OR_DUPLICATE' also covers a same-timestamp but CHANGED
   // candidate count. That is an unreviewed conflicting revision, not
   // a harmless duplicate HTTP retry; it cannot preserve a numeric swing.
   const fields=['provider','provider_race_id','race_key','county_id',
    'updated_at','ballots_reported','reporting_status'];
   return fields.every(k=>old[k]===candidate[k])&&
    Array.isArray(old.candidates)&&Array.isArray(candidate.candidates)&&
    JSON.stringify(old.candidates)===JSON.stringify(candidate.candidates);
  };
  const integrityRejected=processed.accepted&&processed.rejected.some(x=>
   x.reason!=='STALE_OR_DUPLICATE'||!sameSnapshot(x.id));
  const raceMatchedCountyPulse=integrityRejected?
   {status:'REJECTED_UNSAFE_COUNTY_BATCH_NO_DESCRIPTIVE_SWING',
    matched_county_swing_points:null,
    matched_2026_margin_points:null,
    matched_2024_margin_points:null,
    reporting_percent:null,estimated_votes_remaining:null,
    may_move_national_needle:false,
    may_infer_statewide_swing:false,
    may_call_races:false,calibrated_probability:false}:
   processed.accepted&&pulse?.summarize?
    pulse.summarize(processed.rows,baselines,expected.race_key,now):null;
  return {...processed,source_url:validated.source_url,
    raceMatchedCountyPulse,may_move_national_needle:false};
 }
 return Object.freeze({ingest});
});
