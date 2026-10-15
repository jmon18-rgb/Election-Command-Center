/* Automatic 2026 election-night editorial watchlist and display priority.
 * User-provided Silver tipping-point screenshots (Oct 2026) are used only
 * to seed a broad discovery list, NOT as current poll, win odds, independent
 * model inputs or geographically comparable returns.
 * All live updates must come from existing validated 2026 source adapters.
 */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.AutomaticRaceDesk=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const ELECTION_START=Date.parse('2026-11-03T05:00:00Z');
 const rawSenate=[
  ['ME',12],['TX',12],['OH',11],['IA',10],['MI',10],['AK',8],
  ['KS',8],['MN',7],['NH',5],['NE',4],['NC',4],['SC',3],
  ['GA',3],['FL',1],['MS',0]
 ];
 // Selected screenshot rows, across five images; absence from this list
 // means 'not pictured', never 'zero importance'. Padded 2026 race IDs.
 const rawHouse=[
  ['PA-10',3],['NC-01',3],['AZ-06',3],['NY-17',2],['VA-02',2],
  ['PA-07',2],['AZ-01',2],['PA-08',2],['WI-03',2],['MI-07',2],
  ['FL-22',2],['NJ-07',2],['WA-03',2],['CO-08',2],['IA-01',2],
  ['TX-34',2],['FL-14',2],['VA-01',2],['MI-04',2],['OH-07',2],
  ['FL-25',2],['MI-10',2],['TX-28',2],['OH-09',2],['IA-02',2],
  ['PA-01',2],['NC-11',2],['CA-48',2],['IA-03',2],['TX-15',2],
  ['NM-02',2],['OH-01',2],['NH-01',1],['CA-22',1],['KY-06',1],
  ['TX-23',1],['ME-02',1],['NV-01',1],['FL-09',1],['FL-07',1],
  ['TX-35',1],['WI-01',1],['MT-01',1],['CA-45',1],['NE-02',1],
  ['MN-01',1],['NY-03',1],['VA-05',1],['NV-04',1],['MO-02',1],
  ['NV-03',1],['OH-15',1],['MN-02',1],['FL-13',1],['CA-13',1],
  ['IN-01',0],['NY-21',0],['FL-27',0]
 ];
 const states=new Set('AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' '));
 const pad=code=>String(code).replace(/^([A-Z]{2})-(\d{1,2})$/,(_,state,d)=>state+'-'+d.padStart(2,'0'));
 function keyOf(office,code){
  if(office==='Senate')return code.slice(0,2)+(code.slice(0,2)==='OH'||code.slice(0,2)==='FL'?'-special':'');
  if(office==='Governor')return code.slice(0,2);
  return pad(code);
 }
 const rows=[
  ...rawSenate.map(([state,tip])=>({office:'Senate',code:state+'-SEN',tip,key:keyOf('Senate',state)})),
  ...rawHouse.map(([code,tip])=>({office:'House',code:pad(code),tip,key:keyOf('House',code)})),
  ...[['TX',null],['IA',null],['OH',null],['KS',null],['NE',null],['NH',null],['WI',null]]
   .map(([state,tip])=>({office:'Governor',code:state+'-GOV',tip,key:keyOf('Governor',state)}))
 ];
 const seen=new Set();
 for(const r of rows){
  if(!['Senate','House','Governor'].includes(r.office)||!states.has(r.code.slice(0,2))||
   !(r.office==='House'?/^[A-Z]{2}-\d{2}$/:/^[A-Z]{2}-(SEN|GOV)$/.test(r.code))||
   seen.has(r.code)||r.tip!==null&&(!Number.isInteger(r.tip)||r.tip<0||r.tip>15))
   throw Error('Invalid or duplicate editorial watch seed: '+r.code);
  seen.add(r.code);Object.freeze(r);
 }
 const SEED=Object.freeze(rows);
 function extras(model,maxHouse=12,maxSenate=6){
  if(!Array.isArray(model?.race_probabilities))return [];
  const selected=new Set(SEED.map(r=>r.code));
  const add=(office,max)=>model.race_probabilities.filter(r=>r?.office===office&&
   typeof r.race_code==='string'&&!selected.has(r.race_code)&&
   Number.isFinite(r.dem_beats_rep_pct)&&r.dem_beats_rep_pct>=0&&
   r.dem_beats_rep_pct<=100&&(office==='house'?/^[A-Z]{2}-\d{2}$/:/^[A-Z]{2}-SEN$/).test(r.race_code))
   .sort((a,b)=>Math.abs(a.dem_beats_rep_pct-50)-Math.abs(b.dem_beats_rep_pct-50)||
    a.race_code.localeCompare(b.race_code)).slice(0,max).map(r=>({
    office:office==='house'?'House':'Senate',code:r.race_code,tip:null,
    key:keyOf(office==='house'?'House':'Senate',r.race_code),
    added:'model-uncertainty'
   }));
  return add('senate',maxSenate).concat(add('house',maxHouse));
 }
 function watch(model){
  const keys=new Map();
  for(const item of SEED.concat(extras(model)))
   keys.set(item.office+'|'+item.key,item);
  return [...keys.values()];
 }
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 function priority(row,{modelWinPct=null,live=null,flipped=false,now=Date.now()}={}){
  const validModel=Number.isFinite(modelWinPct)&&modelWinPct>=0&&modelWinPct<=100;
  const uncertain=validModel?1-Math.abs(modelWinPct-50)/50:0;
  const reference=Number.isFinite(row.tip)?row.tip:0;
  let score=reference*2.2+(validModel?10*uncertain:0);
  const since=Date.parse(live?.asOf||'');
  const eligible=now>=ELECTION_START&&Number.isFinite(since)&&
   since>=ELECTION_START&&since<=now+15*60000&&now-since<=180*60000&&
   live?.sourceStale!==true;
  const reported=eligible&&Number.isSafeInteger(live?.votes)&&live.votes>0;
  const called=reported&&['D','R','O'].includes(live?.calledParty);
  const reporting=reported&&Number.isFinite(live?.precincts)&&
   live.precincts>=0&&live.precincts<=100?live.precincts:null;
  const observed=reported&&Number.isFinite(live?.rawMargin)&&
   Math.abs(live.rawMargin)<=100?live.rawMargin:null;
  if(reported){
   score+=22;
   if(observed!==null)score+=clamp(12-Math.abs(observed)*.7,0,12);
   if(flipped)score+=14;
   if(called){
    score+=now-since<=45*60000?19:-14; // call just happened vs settled
   }else if(reporting!==null){
    score+=clamp(reporting/12,0,8);
   }
  }
  return {score:Math.round(score*100)/100,reporting:reported,
   called:called?live.calledParty:null,rawMargin:observed,precincts:reporting,
   source:reported?live.source:null,ageMinutes:reported?Math.round((now-since)/60000):null,
   why:called?'Provider-reported call':reported&&flipped?'Reported vote leader changed':
    reported&&observed!==null&&Math.abs(observed)<=3?'Close reported vote count':
    reported?'New results reporting':validModel&&uncertain>.8?'Close in linked model':
    row.tip!==null&&row.tip!==undefined?'Reference tipping-point watch':
    'Additional modeled uncertainty'}
 }
 function sort(enriched,mode='Senate'){
  return enriched.filter(x=>x.office===mode).sort((a,b)=>b.priority.score-a.priority.score||
   (b.tip??-1)-(a.tip??-1)||a.code.localeCompare(b.code));
 }
 return Object.freeze({ELECTION_START,SEED,watch,extras,priority,sort,keyOf,pad,
  provenance:'Selected October 2026 user-supplied Silver tipping-point screenshots, watchlist seed only. Not live Silver data, calibrated forecasts, or results.'});
});
