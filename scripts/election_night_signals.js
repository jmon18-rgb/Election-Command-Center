/* Election-night movement and milestone rules.
 * Only source-normalized 2026 civicAPI provider calls award milestones.
 * The four-outcome model and polling-only comparator remain in the
 * same JackStradamus simulation, never replaced with a separate odds feed.
 */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.ElectionNightSignals=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const START=Date.parse('2026-11-03T05:00:00Z');
 const OUTCOMES=['red_dawn','shrug','blue_wave','blue_tsunami'];
 const EARLY=['KY-06','IN-05','VA-01','VA-02','VA-05','VA-07',
  'GA-SEN','NC-01','NC-11','NC-SEN','OH-SEN','PA-07'];
 const MILESTONES=Object.freeze([
  {id:'graham',title:'LOL, GRAHAM',tag:'South Carolina sends Darline packing',
   icon:'🫖',type:'all',needs:[{office:'Senate',key:'SC',party:'D',opponent:/\bdarline\s+graham\b/i}],
   description:'Annie Andrews must receive a source-reported call against Darline Graham.'},
  {id:'blexas',title:'BLEXAS',tag:'One state. Two statewide flips.',
   icon:'⭐',type:'all',needs:[{office:'Senate',key:'TX',party:'D'},
    {office:'Governor',key:'TX',party:'D'}],
   description:'Both Texas Senate AND Texas governor must have Democratic provider calls.'},
  {id:'blue_corn',title:'BLUE CORN',tag:'Iowa just got a little cornier',
   icon:'🌽',type:'any',needs:[{office:'Senate',key:'IA',party:'D'},
    {office:'Governor',key:'IA',party:'D'}],
   description:'A Democratic provider call in either Iowa Senate or governor; both wins are a bonus.'},
  {id:'blansas',title:'BLANSAS',tag:'Bleeding Kansas? This time the ink is blue.',
   icon:'📜',type:'all',needs:[{office:'Senate',key:'KS',party:'D'}],
   description:'A Democratic provider call in the Kansas Senate race.'},
  {id:'maine',title:'DING-DONG IN MAINE',tag:'The wicked witch of the East is… out of office.',
   icon:'🧹',type:'all',needs:[{office:'Senate',key:'ME',party:'D',opponent:/\bsusan\s+collins\b/i}],
   description:'A Democrat must be called the Maine Senate winner against Susan Collins.'},
  {id:'nebraska',title:'CORN-FED REBELLION',tag:'Nebraska just Osborned the establishment.',
   icon:'🌽',type:'all',needs:[{office:'Senate',key:'NE',party:'O',winner:/\b(?:dan(?:iel)?\s+)?osborn\b/i}],
   description:'An independent Dan Osborn provider call; never counted as a Democratic Senate win.'},
  {id:'ohio',title:'BUCKEYE BLUE-SHOCK',tag:'OH! That actually happened.',
   icon:'🌰',type:'all',needs:[{office:'Senate',key:'OH-special',party:'D'}],
   description:'A Democratic provider call in the Ohio special Senate election.'}
 ]);
 const TRACKED=Object.freeze([
  {office:'Senate',key:'SC'},{office:'Senate',key:'TX'},{office:'Governor',key:'TX'},
  {office:'Senate',key:'IA'},{office:'Governor',key:'IA'},
  {office:'Senate',key:'KS'},{office:'Senate',key:'ME'},{office:'Senate',key:'NE'},
  {office:'Senate',key:'OH-special'}
 ]);
 const fixed=id=>String(id||'').normalize('NFKC').trim().replace(/\s+/g,' ');
 const idOf=x=>x.office+'|'+x.key;
 const number=x=>typeof x==='number'&&Number.isFinite(x);
 const position=r=>{
  const p=r?.probabilities;
  if(!p||OUTCOMES.some(k=>!number(p[k])))return null;
  const sum=OUTCOMES.reduce((n,k)=>n+p[k],0);
  if(sum<99.8||sum>100.2)return null;
  return 100*(p.shrug+2*p.blue_wave+3*p.blue_tsunami)/(3*sum);
 };
 function explainNeedle(live,baseline,evidence=[],earlyCodes=EARLY){
  const current=position(live),before=position(baseline);
  if(current===null||before===null)return null;
  const obs=Array.isArray(evidence)?evidence:[];
  const currentRows=new Map((live.race_probabilities||[]).map(x=>[x.race_code,x]));
  const oldRows=new Map((baseline.race_probabilities||[]).map(x=>[x.race_code,x]));
  const earlySet=new Set(earlyCodes);
  const drivers=obs.filter(e=>e&&typeof e.race_code==='string'&&
     number(e.reporting)&&number(Date.parse(e.asOf))&&
     currentRows.has(e.race_code)&&oldRows.has(e.race_code))
   .map(e=>{
    const next=currentRows.get(e.race_code)?.dem_beats_rep_pct,
     prior=oldRows.get(e.race_code)?.dem_beats_rep_pct;
    return {...e,delta:number(next)&&number(prior)?next-prior:0,
     from:prior,to:next,early:earlySet.has(e.race_code)};
   }).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)||
    a.race_code.localeCompare(b.race_code));
  const result=live.probabilities,old=baseline.probabilities;
  return {position:current,baseline:before,shift:current-before,
   liveCount:drivers.length,
   latestAt:drivers.length?new Date(Math.max(...drivers.map(d=>Date.parse(d.asOf)))).toISOString():null,
   dBothChange:(result.blue_wave+result.blue_tsunami)-(old.blue_wave+old.blue_tsunami),
   redDawnChange:result.red_dawn-old.red_dawn,
   tsunamiChange:result.blue_tsunami-old.blue_tsunami,
   earlyCount:drivers.filter(d=>d.early).length,
   drivers:drivers.slice(0,5)};
 }
 function validatedCall(row,now=Date.now()){
  if(!row||row.provider!=='civicAPI'||row.total<=0||
    !Array.isArray(row.candidates)||!row.called||!number(now)||now<START)return null;
  const ts=Date.parse(row.last_updated||'');
  if(!number(ts)||ts<START||ts>now+900000)return null;
  const matched=row.candidates.filter(c=>fixed(c.name)===fixed(row.called)&&
    c.votes>0&&['D','R','O'].includes(c.party));
  return matched.length===1?{name:matched[0].name,party:matched[0].party,
   opponents:row.candidates.filter(c=>c!==matched[0]),source:'civicAPI',
   at:row.last_updated}:null;
 }
 function evaluateMilestones(rows,{year=2026,now=Date.now()}={}){
  const calls=year===2026&&now>=START?rows||{}:{};
  const result=[];
  for(const spec of MILESTONES){
   const evidence=spec.needs.map(req=>{
    const row=calls[idOf(req)];
    // Reject a cross-race/cross-office record even if a caller supplied the
    // right dictionary key. Production adapters also verify source identity.
    const call=row?.office===req.office&&row?.key===req.key?
     validatedCall(row,now):null;
    const opponentOk=!req.opponent||
     call?.opponents?.some(c=>c.party==='R'&&req.opponent.test(fixed(c.name)));
    const winnerOk=!req.winner||req.winner.test(fixed(call?.name));
    const matched=Boolean(call&&call.party===req.party&&opponentOk&&winnerOk);
    return {key:idOf(req),matched,call:matched?call:null};
   });
   const done=evidence.filter(x=>x.matched).length;
   const earned=year===2026&&now>=START&&
     (spec.type==='any'?done>=1:done===evidence.length);
   result.push({...spec,needs:undefined,
    completed:done,required:spec.type==='any'?1:evidence.length,
    state:earned?'earned':done?'warming':'waiting',
    evidence});
  }
  return result;
 }
 function changingMilestones(previous=[],current=[]){
  const prior=new Set(previous);
  const earned=current.filter(x=>x.state==='earned').map(x=>x.id);
  const next=new Set(earned);
  return {gained:earned.filter(x=>!prior.has(x)),
    withdrawn:[...prior].filter(x=>!next.has(x)),active:earned};
 }
 return Object.freeze({START,EARLY,MILESTONES,TRACKED,position,explainNeedle,
  validatedCall,evaluateMilestones,changingMilestones});
});
