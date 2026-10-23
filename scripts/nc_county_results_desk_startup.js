/* Explicitly disabled until a source-owner approved exact-race 2026 snapshot
 * and expected provenance configuration are committed. Never trust the
 * snapshot to supply its own expected identity.
 */
(function(root){
 'use strict';
 async function refresh(){
  const host=root.document?.getElementById('enVerifiedCountyResults');
  if(!host)return;
  const desk=root.ElectionNightCountyResultsDesk;
  if(!desk){host.textContent='County display verification unavailable';return;}
  try{
   const response=await root.fetch('./data/nc_county_results_desk_config.json',{cache:'no-store'});
   if(!response.ok)throw Error('Missing verified county source configuration');
   const config=await response.json();
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
   selected.render(host,selected.prepare(snapshot,config.expected),root.document);
  }catch(e){
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
