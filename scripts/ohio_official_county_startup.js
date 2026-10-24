/* Deployed approved Ohio official candidate-count desk.
 * No results fetched if the source approval remains disabled or the
 * 2026 Ohio polls have not closed. Independent of other 2026 providers.
 */
(function(root){
 'use strict';
 let serial=0;
 const LIVE=Date.parse('2026-11-04T00:30:00Z');
 async function refresh(){
  const mySerial=++serial;
  const host=root.document?.getElementById('enOhioOfficialCountyResults');
  if(!host)return;
  const service=root.OhioOfficialCandidateVotes;
  if(!service){host.textContent='Ohio result-source display module unavailable';return}
  try{
   const configResponse=await root.fetch('./data/ohio_nist_source_approval_2026.json',
     {cache:'no-store'});
   if(!configResponse.ok)throw Error('Ohio source approval configuration unavailable');
   const config=await configResponse.json();
   if(mySerial!==serial)return;
   if(Date.now()<LIVE||config?.enabled!==true||
      config.real_results_publication_reviewed!==true){
    service.render(host,{ready:false,
      reason:'Ohio official 2026 source not yet approved: pre-election/mock counts are blocked'},root.document);
    return;
   }
   const sourceResponse=await root.fetch('./data/ohio_nist_candidate_votes_2026.json',
      {cache:'no-store'});
   if(!sourceResponse.ok)throw Error('Approved Ohio candidate snapshot not published');
   const snapshot=await sourceResponse.json();
   if(mySerial!==serial)return;
   service.render(host,service.prepare(snapshot,config,Date.now()),root.document);
  }catch(e){
   if(mySerial!==serial)return;
   service.render(host,{ready:false,reason:'Ohio official county source unavailable: '+
     String(e?.message||e)},root.document);
  }
 }
 if(root.document?.readyState==='loading')
  root.document.addEventListener('DOMContentLoaded',refresh,{once:true});
 else refresh();
 root.OhioOfficialDeskRefresh=refresh;
 if(root.setInterval){
  root.setInterval(()=>{
   if(Date.now()>=LIVE&&Date.now()<Date.parse('2026-11-06T06:00:00Z')&&
      root.document?.visibilityState!=='hidden')refresh();
  },120000);
 }
 if(root.addEventListener){
  root.addEventListener('focus',()=>{
   if(Date.now()>=LIVE)refresh();
  });
 }
})(typeof window!=='undefined'?window:{});
