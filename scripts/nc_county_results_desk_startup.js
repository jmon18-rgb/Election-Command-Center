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
  const senateHistoryHost=root.document?.getElementById('enNcSenateSameOfficeComparison');
  if(historicalHost)historicalHost.replaceChildren();
  if(senateHistoryHost)senateHistoryHost.replaceChildren();
  if(!host)return;
  const desk=root.ElectionNightCountyResultsDesk;
  if(!desk){host.textContent='County display verification unavailable';return;}
  try{
   const response=await root.fetch('./data/nc_county_results_desk_config.json',{cache:'no-store'});
   if(!response.ok)throw Error('Missing verified county source configuration');
   const config=await response.json();
   if(serial!==requestSerial)return;
   if(config?.schema!=='county-desk-config-v1'||config.enabled!==true){
    root.NcSenateCountyMapView?.setLive(null);
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
   // 2026 geographic shading is *only* admitted through the approved
   // exact-candidate source contract, never a forecast or a mock return.
   root.NcSenateCountyMapView?.setLive(zipOnly&&prepared.ready?prepared:null);
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
   // The SHA-pinned 2022 Senate reference is a separate, same-office
   // historical comparison. Never convert these figures to 2026 ballots.
   if(zipOnly&&prepared.ready&&senateHistoryHost){
    const compare=root.NcSameOfficeSenateComparison;
    if(!compare){senateHistoryHost.textContent='2022 Senate historical module unavailable';return;}
    try{
     const response2022=await root.fetch('./data/nc_2022_senate_county_verified.csv',
      {cache:'no-cache'});
     if(serial!==requestSerial)return;
     if(!response2022.ok)throw Error('Pinned official 2022 Senate county baseline missing');
     const csv2022=await response2022.text();
     if(serial!==requestSerial)return;
     compare.render(senateHistoryHost,compare.compare(prepared,csv2022),root.document);
    }catch(err){
     if(serial===requestSerial)
      senateHistoryHost.textContent='2022 Senate comparison unavailable: '+err.message;
    }
   }
  }catch(e){
   if(serial!==requestSerial)return;
   if(historicalHost)historicalHost.replaceChildren();
   if(senateHistoryHost)senateHistoryHost.replaceChildren();
   root.NcSenateCountyMapView?.setLive(null);
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
