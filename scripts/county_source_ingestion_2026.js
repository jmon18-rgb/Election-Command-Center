/* Source-contract to county-state adapter. No feed is certified by this module. */
(function(root,factory){
 const api=factory(
  typeof module!=='undefined'&&module.exports?
   require('./verified_county_source_contract_2026'):root.VerifiedCountySourceContract2026,
  typeof module!=='undefined'&&module.exports?
   require('./geographic_county_batch_2026'):root.GeographicCountyBatch2026);
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.CountySourceIngestion2026=api;
})(typeof window!=='undefined'?window:null,function(contract,batch){
 'use strict';
 function ingest(previous,envelope,expected,baselines={},now=Date.now()){
  if(!contract||!batch)return {accepted:false,reason:'DEPENDENCIES_UNAVAILABLE'};
  const validated=contract.normalize(envelope,expected,now);
  if(!validated.ok)return {accepted:false,reason:validated.reason};
  const processed=batch.process(previous,validated.rows,baselines);
  return {...processed,source_url:validated.source_url,
    may_move_national_needle:false};
 }
 return Object.freeze({ingest});
});
