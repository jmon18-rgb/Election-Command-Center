/* Local-static NC historical county map + *only* approved 2026 ZIP counts.
 * No browser external GIS/network dependency or synthetic ballot totals.
 */
(function(root){
 'use strict';
 const paths=['./data/nc_county_shapes_fips.json',
              './data/nc_2022_senate_county_verified.csv'];
 let geometry=null,baseline=null,live=null,loadError=null,sequence=0;
 function render(){
  const host=root.document?.getElementById('enNcSenateCountyMap');
  if(!host)return;
  const api=root.NcSenateCountyMap;
  if(!api){host.textContent='NC county map unavailable: renderer missing';return;}
  if(loadError){host.textContent='NC county map source unavailable: '+loadError;return;}
  if(!geometry||baseline===null){
   host.textContent='Loading the 100-county historical Senate map…';return;
  }
  const built=api.build(geometry,baseline,live,Date.now());
  api.render(host,built,root.document);
 }
 function setLive(prepared){
  // The validated source adapter and exact approved ZIP config are the
  // only means of supplying observations; never promote an archive/forecast.
  live=prepared?.ready===true?prepared:null;
  render();
 }
 async function load(){
  const token=++sequence;
  try{
   const [g,csv]=await Promise.all(paths.map(p=>root.fetch(p,{cache:'no-store'})));
   if(!g.ok||!csv.ok)throw Error('Pinned FIPS geometry or 2022 Senate archive not published');
   const [geo,reference]=await Promise.all([g.json(),csv.text()]);
   if(token!==sequence)return;
   geometry=geo;baseline=reference;loadError=null;
  }catch(e){
   if(token!==sequence)return;
   loadError=String(e.message||e);geometry=null;baseline=null;
  }
  render();
 }
 root.NcSenateCountyMapView={refresh:load,setLive};
 if(root.document?.readyState==='loading')
  root.document.addEventListener('DOMContentLoaded',load,{once:true});
 else void load();
 // A static Pages tab should display newly approved source snapshots and
 // show stale candidate observations as unavailable; source refresh remains
 // the job of the *approved* NC official ZIP monitor.
 if(root.addEventListener)root.addEventListener('focus',render);
})(typeof window!=='undefined'?window:{});
