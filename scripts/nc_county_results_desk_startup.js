/* Explicitly disabled until a source-owner approved exact-race 2026 snapshot
 * and expected provenance configuration are committed. Never trust the
 * snapshot to supply its own expected identity.
 */
(function(root){
 'use strict';
 let requestSerial=0;
 async function refresh(){
  const serial=++requestSerial;
  const host=root.document?.getElementById('enVerifiedCountyResults');
  const historicalHost=root.document?.getElementById('enNcHistoricalComparison');
  if(historicalHost)historicalHost.replaceChildren();
  if(!host)return;
  const desk=root.ElectionNightCountyResultsDesk;
  if(!desk){host.textContent='County display verification unavailable';return;}
  try{
   const response=await root.fetch('./data/nc_county_results_desk_config.json',{cache:'no-store'});
   if(!response.ok)throw Error('Missing verified county source configuration');
   const config=await response.json();
   if(serial!==requestSerial)return;
   if(config?.schema!=='county-desk-config-v1'||config.enabled!==true){
    desk.render(host,{ready:false,reason:config?.reason||
     'No approved live county source'},root.document);return;
   }
   // Only deploy-time reviewed relative, same-origin JSON paths are allowed.
   if(typeof config.snapshot_path!=='string'||
      !/^\.\/data\/[a-zA-Z0-9_-]+\.json$/.test(config.snapshot_path)||
      !config.expected||typeof config.expected!=='object')
    throw Error('Unsafe county source configuration');
   const snapshotResponse=await root.fetch(config.snapshot_path,{cache:'no-store'});
   if(!snapshotResponse.ok)throw Error('Approved county snapshot unavailable');
   const snapshot=await snapshotResponse.json();
   // Source-native ZIP candidate counts have no ballots denominator. They
   // use a separate contract and renderer from verified ballots-processed feeds.
   const zipOnly=config.expected.mode==='nc-candidate-only';
   const selected=zipOnly?root.NcOfficialCandidateVotes:desk;
   if(!selected)throw Error('Candidate-only source renderer not installed');
   const prepared=selected.prepare(snapshot,config.expected);
   if(serial!==requestSerial)return;
   selected.render(host,prepared,root.document);
   // The 2024 presidential baseline is a separate verified HISTORICAL source.
   // Never load it as 2026 counts and never feed it into the live model.
   if(zipOnly&&prepared.ready&&historicalHost){
    const compare=root.NcHistoricalCountyComparison;
    if(!compare){historicalHost.textContent='Historical comparison module unavailable';return;}
    try{
     const baselineResponse=await root.fetch('./data/nc_2024_presidential_county_verified.csv',
      {cache:'no-cache'});
     if(serial!==requestSerial)return;
     if(!baselineResponse.ok)throw Error('Verified 2024 county baseline not available');
     const csv=await baselineResponse.text();
     if(serial!==requestSerial)return;
     const diagnostic=compare.compare(prepared,csv);
     compare.render(historicalHost,diagnostic,root.document);
    }catch(err){
     if(serial===requestSerial)
      historicalHost.textContent='Historical comparison unavailable: '+err.message;
    }
   }
  }catch(e){
   if(serial!==requestSerial)return;
   if(historicalHost)historicalHost.replaceChildren();
   desk.render(host,{ready:false,reason:'County source not available: '+e.message},root.document);
  }
 }
 if(root.document?.readyState==='loading')
  root.document.addEventListener('DOMContentLoaded',refresh,{once:true});
 else refresh();
 root.NcCountyDeskRefresh=refresh;
 // A static Pages tab must recheck freshly published snapshots; a GitHub
 // Actions ZIP watcher is NOT a realtime push feed.
 if(root.setInterval){
  root.setInterval(()=>{
   if(Date.now()>=Date.parse('2026-11-03T05:00:00Z')&&
      Date.now()<Date.parse('2026-11-06T06:00:00Z')&&
      root.document?.visibilityState!=='hidden')refresh();
  },120000);
 }
 if(root.addEventListener)root.addEventListener('focus',()=>{
  if(Date.now()>=Date.parse('2026-11-03T05:00:00Z'))refresh();
 });
})(typeof window!=='undefined'?window:{});
