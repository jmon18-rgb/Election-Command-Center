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
  const raceMatchedCountyPulse=processed.accepted&&pulse?.summarize?
   pulse.summarize(processed.rows,baselines,expected.race_key,now):null;
  return {...processed,source_url:validated.source_url,
    raceMatchedCountyPulse,may_move_national_needle:false};
 }
 return Object.freeze({ingest});
});
