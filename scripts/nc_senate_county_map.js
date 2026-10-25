/* North Carolina county map: sourced 2022 Senate baseline + strictly
 * approved 2026 candidate-only observations. Observed counties need not
 * have finished counting; neither margin nor difference moves the needle.
 */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.NcSenateCountyMap=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const ORIGINAL='https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2026_11_03/results_pct_20261103.zip';
 const LATEST=Date.parse('2026-11-04T00:30:00Z');
 const GEO_SCHEMA='nc-county-boundaries-fips-v1';
 const SRC='https://github.com/plotly/datasets/blob/master/geojson-counties-fips.json';
 const COORD_BOUNDS={minX:-84.6,maxX:-75.35,minY:33.65,maxY:36.8};
 const num=x=>typeof x==='number'&&Number.isFinite(x);
 const safe=x=>Number.isSafeInteger(x)&&x>=0;
 function shapePoint(p){
  return Array.isArray(p)&&p.length>=2&&p.length<=3&&
   num(p[0])&&num(p[1])&&p[0]>=COORD_BOUNDS.minX&&
   p[0]<=COORD_BOUNDS.maxX&&p[1]>=COORD_BOUNDS.minY&&
   p[1]<=COORD_BOUNDS.maxY;
 }
 function geometry(g){
  if(!g||!['Polygon','MultiPolygon'].includes(g.type)||!Array.isArray(g.coordinates))return false;
  const polygons=g.type==='Polygon'?[g.coordinates]:g.coordinates;
  if(!polygons.length||polygons.length>100)return false;
  let all=0;
  for(const polygon of polygons){
   if(!Array.isArray(polygon)||!polygon.length||polygon.length>20)return false;
   for(const ring of polygon){
    if(!Array.isArray(ring)||ring.length<4||ring.length>15000||
       !ring.every(shapePoint))return false;
    all+=ring.length;
    if(all>50000)return false;
    if(ring[0][0]!==ring[ring.length-1][0]||
       ring[0][1]!==ring[ring.length-1][1])return false;
   }
  }
  return true;
 }
 function verifyShapes(data){
  if(data?.schema!==GEO_SCHEMA||data.state!=='NC'||data.county_count!==100||
     data.geometry_source!==SRC||!Array.isArray(data.features)||
     data.features.length!==100)return null;
  const seen=new Set();
  for(const f of data.features){
   if(!f||typeof f.id!=='string'||!/^37\d{3}$/.test(f.id)||
      seen.has(f.id)||typeof f.name!=='string'||!/^[- A-Za-z.']{2,60}$/.test(f.name)||
      !geometry(f.geometry))return null;
   seen.add(f.id);
  }
  return data.features;
 }
 function project(p){
  return [
   16+(p[0]-COORD_BOUNDS.minX)/(COORD_BOUNDS.maxX-COORD_BOUNDS.minX)*928,
   12+(COORD_BOUNDS.maxY-p[1])/(COORD_BOUNDS.maxY-COORD_BOUNDS.minY)*321
  ];
 }
 function pathFor(geo){
  if(!geometry(geo))return null;
  const groups=geo.type==='Polygon'?[geo.coordinates]:geo.coordinates;
  let segments=[];
  for(const rings of groups)for(const ring of rings){
   const pts=ring.map(project).map(([x,y])=>x.toFixed(1)+','+y.toFixed(1));
   segments.push('M'+pts.join('L')+'Z');
  }
  return segments.join(' ');
 }
 function extractLive(prepared,now=Date.now()){
  if(!prepared?.ready||prepared.race_key!=='NC-SEN'||prepared.source_url!==ORIGINAL||
     prepared.may_move_national_needle!==false||prepared.ballots_reported!==null||
     prepared.reporting_fraction!==null||typeof prepared.sha256!=='string'||
     !/^[0-9a-f]{64}$/.test(prepared.sha256)||!Array.isArray(prepared.rows)||
     prepared.rows.length<1||prepared.rows.length>100)return null;
  const t=Date.parse(prepared.checked_at||'');
  if(!num(t)||t<LATEST||t>now+15*60000||now-t>120*60000)return null;
  const map=new Map();
  for(const c of prepared.rows){
   if(!/^37\d{3}$/.test(c?.fips||'')||map.has(c.fips)||!Array.isArray(c.candidates)||
      c.candidates.length<2||c.candidates.length>30)return null;
   const votes={DEM:null,REP:null},names=new Set();let sum=0;
   for(const person of c.candidates){
    if(!person||!safe(person.votes)||typeof person.name!=='string'||
       !person.name.trim()||typeof person.party!=='string'||!person.party.trim()||
       names.has(person.name.trim().toLowerCase()))return null;
    names.add(person.name.trim().toLowerCase());
    if(person.party==='DEM'||person.party==='REP'){
     if(votes[person.party]!==null)return null;
     votes[person.party]=person.votes;
    }
    sum+=person.votes;
    if(!safe(sum))return null;
   }
   if(votes.DEM!==null&&votes.REP!==null&&votes.DEM+votes.REP>0){
    const d=votes.DEM,r=votes.REP;
    map.set(c.fips,{d,r,total:d+r,margin:100*(d-r)/(d+r)});
   }
  }
  return {rows:map,checked_at:prepared.checked_at,
   source_url:prepared.source_url};
 }
 const pct=(d,r)=>100*(d-r)/(d+r);
 function build(shapes,historicalCsv,livePrepared=null,now=Date.now()){
  const boundaries=verifyShapes(shapes);
  const prior=typeof module!=='undefined'&&module.exports?
   require('./nc_same_office_senate_comparison.js'):
   typeof window!=='undefined'?window.NcSameOfficeSenateComparison:null;
  if(!boundaries||!prior?.parse)return {ready:false,reason:'County shapes or verified historical Senate baseline unavailable'};
  let history;
  try{history=prior.parse(historicalCsv)}catch(e){
   return {ready:false,reason:'Original 2022 Senate baseline failed verification'};
  }
  if(history.size!==100||boundaries.some(x=>!history.has(x.id)))
   return {ready:false,reason:'County geometry and Senate baseline FIPS mismatch'};
  const current=extractLive(livePrepared,now);
  const rows=boundaries.map(f=>{
   const old=history.get(f.id),margin=pct(old.dem,old.rep);
   const live=current?.rows.get(f.id)||null;
   return {fips:f.id,name:f.name,path:pathFor(f.geometry),
    historical_margin:margin,historical_d:old.dem,historical_r:old.rep,
    observed_margin:live?.margin??null,
    observed_d:live?.d??null,observed_r:live?.r??null,
    observed_votes:live?.total??null,
    difference:live?live.margin-margin:null};
  });
  return {ready:true,rows,liveReady:Boolean(current),
   countiesWithVotes:rows.filter(x=>x.observed_votes!==null).length,
   lastChecked:current?.checked_at||null,may_move_national_needle:false,
   source_geometry:shapes.geometry_source,source_history:'2022 NC Senate NCSBE original ZIP',
   candidate_only:true,reported_ballot_fraction:null,
   modeled_votes_outstanding:null};
 }
 function tone(value){
  if(!num(value))return '#46566c';
  if(value>=25)return '#2f64a9';
  if(value>=10)return '#528bd1';
  if(value>2)return '#91bce5';
  if(value>=-2)return '#c8cdd3';
  if(value>-10)return '#e5a9a9';
  if(value>-25)return '#c96d72';
  return '#a53c4d';
 }
 function render(host,model,doc,{initialMode='historical'}={}){
  if(!host||!doc)return false;
  host.replaceChildren();
  const add=(tag,parent,text,cls)=>{
   const el=doc.createElement(tag);
   if(cls)el.className=cls;
   if(text!==undefined)el.textContent=text;
   parent.appendChild(el);
   return el;
  };
  if(!model?.ready){
   add('p',host,model?.reason||'County map unavailable');
   return false;
  }
  let mode=['historical','live','difference'].includes(initialMode)&&
   (initialMode==='historical'||model.liveReady)?initialMode:'historical';
  let selected='37183'; // Wake; informative large baseline electorate county
  const controls=add('div',host,undefined,'nc-map-controls');
  const choices=[
   ['historical','2022 Senate baseline'],
   ['live','2026 observed returns'],
   ['difference','2026 minus 2022']];
  const buttons=new Map();
  const status=add('p',host,undefined,'nc-map-status');
  const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 960 345');
  svg.setAttribute('role','img');svg.setAttribute('aria-label','North Carolina 100-county Senate map');
  svg.classList?.add('nc-senate-svg');
  const countyNodes=new Map();
  for(const row of model.rows){
   const shape=doc.createElementNS('http://www.w3.org/2000/svg','path');
   shape.setAttribute('d',row.path);
   shape.setAttribute('data-fips',row.fips);
   shape.setAttribute('tabindex','0');
   shape.setAttribute('role','button');
   shape.setAttribute('fill-rule','evenodd');
   shape.setAttribute('aria-label',row.name+' County; select details');
   const select=()=>{selected=row.fips;paint()};
   shape.addEventListener('click',select);
   shape.addEventListener('keydown',ev=>{
    if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();select();}
   });
   const tip=doc.createElementNS('http://www.w3.org/2000/svg','title');
   tip.textContent=row.name+' County';shape.appendChild(tip);
   svg.appendChild(shape);countyNodes.set(row.fips,shape);
  }
  host.appendChild(svg);
  const legend=add('div',host,undefined,'nc-map-legend');
  add('span',legend,'R+25+');
  const scale=add('div',legend,undefined,'nc-map-scale');
  for(const k of [-30,-18,-6,0,6,18,30]){
   const chip=add('span',scale);
   chip.style.background=tone(k);
  }
  add('span',legend,'D+25+');
  const inspector=add('div',host,undefined,'nc-map-inspector');
  const note=add('p',host,'DESCRIPTIVE ONLY · Gray counties have no approved 2026 D/R candidate returns. County reports may be incomplete; 2022 baseline is a different election. No ballots-remaining estimate, race calls, or probability changes originate here.','nc-map-disclosure');
  note.setAttribute('role','note');
  for(const [key,label] of choices){
   const b=add('button',controls,label,'nc-map-toggle');
   b.type='button';b.disabled=key!=='historical'&&!model.liveReady;
   b.addEventListener('click',()=>{mode=key;paint()});
   buttons.set(key,b);
  }
  const byId=new Map(model.rows.map(x=>[x.fips,x]));
  function paint(){
   for(const [id,shape] of countyNodes){
    const row=byId.get(id);
    const value=mode==='historical'?row.historical_margin:
     mode==='live'?row.observed_margin:row.difference;
    shape.setAttribute('fill',tone(value));
    shape.setAttribute('stroke',selected===id?'#ffffff':'#162437');
    shape.setAttribute('stroke-width',selected===id?'2.1':'0.7');
    shape.setAttribute('aria-pressed',String(selected===id));
   }
   for(const [key,button] of buttons)
    button.setAttribute('aria-pressed',String(key===mode));
   status.textContent=mode==='historical'?
    'Historical 2022 NC Senate · all 100 counties · VERIFIED final vote totals':
    (mode==='live'?'2026 Senate candidate-only counts':
     'Observed partial 2026 vs final 2022 Senate D−R margin difference')+
    ' · '+model.countiesWithVotes+'/100 counties have D/R candidate counts · NOT percent of ballots reporting';
   inspector.replaceChildren();
   const r=byId.get(selected);
   if(!r)return;
   add('strong',inspector,r.name+' County · FIPS '+r.fips);
   add('p',inspector,'2022 final Senate D−R margin: '+(r.historical_margin>=0?'+':'')+
    r.historical_margin.toFixed(1)+' pts · D '+r.historical_d.toLocaleString('en-US')+
    ' · R '+r.historical_r.toLocaleString('en-US'));
   add('p',inspector,r.observed_votes===null?
    '2026: no approved D/R county candidate counts yet.':
    '2026 observed partial Senate D−R: '+(r.observed_margin>=0?'+':'')+
    r.observed_margin.toFixed(1)+' pts · D '+r.observed_d.toLocaleString('en-US')+
    ' · R '+r.observed_r.toLocaleString('en-US')+
    ' · raw change vs 2022: '+(r.difference>=0?'+':'')+
    r.difference.toFixed(1)+' pts (NOT a model swing)');
  }
  paint();
  return true;
 }
 return Object.freeze({verifyShapes,build,extractLive,pathFor,tone,render});
});
