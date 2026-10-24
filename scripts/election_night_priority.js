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
 // The editorial seed discovers House races; it does NOT limit the Senate
 // ballot. The validated nationwide inventory must supply all 35 Senate
 // contests, even where neither a qualifying poll nor forecast exists.
 function watch(model,senateSeats=[],housePolls=[]){
  const keys=new Map();
  const add=item=>{
   if(item&&['Senate','House','Governor'].includes(item.office)&&
      typeof item.key==='string'&&typeof item.code==='string')
    keys.set(item.office+'|'+item.key,item);
  };
  // Full-screen roster expansion is intentionally separate from the
  // smaller automatic provider-polling queue, to avoid pushing hundreds
  // of additional races through one-minute civicAPI refreshes.
  const fullRoster=Boolean(senateSeats?.length||housePolls?.length);
  for(const item of SEED.concat(extras(model,fullRoster?24:12,fullRoster?35:6)))add(item);
  if(fullRoster)for(const r of model?.race_probabilities||[]){
   if(r?.office!=='senate'||!/^[A-Z]{2}-SEN$/.test(r.race_code||''))continue;
   const code=r.race_code;
   if(!keys.has('Senate|'+keyOf('Senate',code)))
    add({office:'Senate',code,key:keyOf('Senate',code),
     tip:null,added:'modeled-senate-inventory'});
  }
  const validatedUniverse=Array.isArray(senateSeats)&&
   senateSeats.length===35&&new Set(senateSeats.map(x=>x?.code)).size===35&&
   senateSeats.filter(x=>x?.kind==='special').map(x=>x.state).sort().join(',')==='FL,OH'&&
   senateSeats.every(x=>x?.office==='Senate'&&
    x.code===x.state+'-SEN'&&
    x.key===x.state+(x.kind==='special'?'-special':'')&&states.has(x.state));
  if(validatedUniverse){
   for(const seat of senateSeats){
    const id='Senate|'+seat.key;
    const seeded=keys.get(id);
    add({...seat,tip:seeded?.tip??null,added:'verified-2026-senate-inventory'});
   }
  }
  // House inclusion is transparent: curated monitoring slate, qualifying
  // district polling, or model uncertainty. A district need not be close.
  for(const r of housePolls||[]){
   if(!r||!/^[A-Z]{2}-\d{2}$/.test(r.race_code||'')||
      !['single_poll','multi_poll'].includes(r.status)||
      !Number.isFinite(r.dem_minus_rep))continue;
   const code=r.race_code;
   if(!keys.has('House|'+code))add({office:'House',code,key:code,
    tip:null,added:'qualifying-house-poll'});
  }
  return [...keys.values()];
 }
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 // Extra source-time defense: a cached or malformed pre-close count must
 // never make a race appear to be reporting or called in the priority desk.
 // Resolve at use time, since the browser may load this script first.
 function locallyClosed(row,asOf,now){
  const closes=typeof window!=='undefined'?
   window.ElectionNightPollClosings2026:
   typeof require==='function'?require('./election_night_poll_closings_2026.js'):null;
  return Boolean(closes&&typeof closes.allowed==='function'&&
   closes.allowed(row?.key,1,asOf,now));
 }
 function priority(row,{modelWinPct=null,live=null,flipped=false,now=Date.now()}={}){
  const validModel=Number.isFinite(modelWinPct)&&modelWinPct>=0&&modelWinPct<=100;
  const uncertain=validModel?1-Math.abs(modelWinPct-50)/50:0;
  const reference=Number.isFinite(row.tip)?row.tip:0;
  let score=reference*2.2+(validModel?10*uncertain:0);
  const since=Date.parse(live?.asOf||'');
  const eligible=now>=ELECTION_START&&Number.isFinite(since)&&
   since>=ELECTION_START&&since<=now+15*60000&&now-since<=180*60000&&
   live?.sourceStale!==true&&locallyClosed(row,live?.asOf,now);
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
 // Fair and bounded supplementary provider scan. Featured Senate and Silver-
 // seeded House races get frequent checks while circular cursors ensure less
 // prominent races are never permanently skipped by repeated featured items.
 // This function schedules exact identity checks, never assumes valid votes.
 function sourceBatch({personal=[],candidates=[],primaryStates=[],cursor={},
                        limit=12}={}){
  if(!Number.isInteger(limit)||limit<1||limit>12)throw Error('Unsafe provider request budget');
  const covered=new Set(primaryStates), seen=new Set(), eligible=[];
  for(const row of [...personal,...candidates]){
   if(!row||!['Senate','House','Governor'].includes(row.office)||
      typeof row.key!=='string'||row.key.length>16||
      !states.has(row.key.slice(0,2))||covered.has(row.key.slice(0,2)))
    continue;
   const id=row.office+'|'+row.key;
   if(seen.has(id))continue;
   seen.add(id);eligible.push({...row});
  }
  const allowed=new Set(eligible.map(x=>x.office+'|'+x.key));
  const saved=personal.filter(x=>x&&allowed.has(x.office+'|'+x.key));
  const senators=eligible.filter(x=>x.office==='Senate');
  const houses=eligible.filter(x=>x.office==='House');
  const remaining=eligible.filter(x=>x.office==='Governor');
  const strength=x=>Number.isFinite(x.tip)?x.tip:0;
  const top=(pool,n)=>[...pool].sort((a,b)=>strength(b)-strength(a)||
   a.key.localeCompare(b.key)).slice(0,n);
  const selected=[],picked=new Set();
  const push=x=>{
   if(!x||selected.length>=limit)return false;
   const id=x.office+'|'+x.key;
   if(picked.has(id))return false;
   picked.add(id);selected.push(x);return true;
  };
  for(const x of saved.slice(0,2))push(x);
  // Persistent quick checks of genuinely consequential Senate contests.
  const fastSen=top(senators.filter(x=>strength(x)>=7),3);
  for(const x of fastSen)push(x);
  // Silver screenshots are reference *seeds*, not current race probabilities.
  const fastHouse=top(houses.filter(x=>strength(x)>=1),1);
  for(const x of fastHouse)push(x);
  const next={senate:cursor.senate||0,house:cursor.house||0,other:cursor.other||0};
  function rotate(pool,number,field){
   if(!pool.length)return;
   let scanned=0,added=0,at=next[field]%pool.length;
   while(scanned<pool.length&&added<number&&selected.length<limit){
    const x=pool[at];at=(at+1)%pool.length;scanned++;
    if(push(x))added++;
   }
   next[field]=at;
  }
  // These quotas reserve time for both chambers. When the House list is
  // sparse, the spare capacity flows back to Senate before governors.
  rotate(senators.filter(x=>!fastSen.some(y=>y.key===x.key)),4,'senate');
  rotate(houses.filter(x=>!fastHouse.some(y=>y.key===x.key)),3,'house');
  rotate(remaining,1,'other');
  if(selected.length<limit){
   rotate(senators,limit-selected.length,'senate');
   rotate(houses,limit-selected.length,'house');
   rotate(remaining,limit-selected.length,'other');
  }
  return {items:selected,next,candidates:eligible.length};
 }
 return Object.freeze({ELECTION_START,SEED,watch,extras,priority,sort,keyOf,pad,sourceBatch,
  provenance:'Selected October 2026 user-supplied Silver tipping-point screenshots, watchlist seed only. Not live Silver data, calibrated forecasts, or results.'});
});
