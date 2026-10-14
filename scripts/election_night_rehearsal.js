/* Isolated, deterministic synthetic 2026 election-night model rehearsal.
 * NEVER used as a network response or placed in live results/browser storage.
 * Source labels in the UI say SIMULATED; race identities are examples only.
 */
(function(root,factory){
 const x=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=x;
 if(root)root.ElectionNightRehearsal=x;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const CLOCK=Date.parse('2026-11-04T04:00:00Z');
 const AS_OF='2026-11-04T03:30:00Z';
 const PHASES=Object.freeze([
  Object.freeze({label:'Before results',precinctPct:0,
    note:'Poll-only probabilities; no counted votes exist in the simulation yet.'}),
  Object.freeze({label:'Early returns',precinctPct:12,
    note:'12% of fictional precincts reporting. These are not a random sample.'}),
  Object.freeze({label:'Mixed reporting',precinctPct:42,
    note:'42% of fictional precincts reporting. The returns have changed.'}),
  Object.freeze({label:'Late reporting',precinctPct:72,
    note:'72% of fictional precincts reporting. These are still unofficial partial results.'}),
  Object.freeze({label:'Near-complete count',precinctPct:94,
    note:'94% of fictional precincts reporting. No winner calls are inferred.'})
 ]);
 const RACES=Object.freeze([
  Object.freeze({state:'NC',code:'NC-SEN',label:'North Carolina Senate',
    margins:Object.freeze([null,-11,2,4,5])}),
  Object.freeze({state:'MI',code:'MI-SEN',label:'Michigan Senate',
    margins:Object.freeze([null,-8,-5,1,2])}),
  Object.freeze({state:'GA',code:'GA-SEN',label:'Georgia Senate',
    margins:Object.freeze([null,10,7,3,1])}),
  Object.freeze({state:'TX',code:'TX-SEN',label:'Texas Senate',
    margins:Object.freeze([null,-6,-6,-3,-2])})
 ]);
 function snapshot(state,phase){
  if(!Number.isInteger(phase)||phase<0||phase>=PHASES.length)
   throw Error('Unsupported simulated stage');
  const spec=RACES.find(r=>r.state===state);
  if(!spec)throw Error('Unknown simulated race');
  if(phase===0)return null;
  const percent=PHASES[phase].precinctPct,margin=spec.margins[phase];
  const total=percent*10000;
  const d=Math.round(total*(100+margin)/200),r=total-d;
  // Deliberately resembles a provider-normalized record. This object is
  // never inserted into enOfficeSnapshots, alerts or browser storage.
  return {office:'Senate',year:2026,source:'state',stale:false,
   as_of:AS_OF,races:{[state]:{total,pct_in:percent,called:false,
    winner:'',cands:[{p:'D',v:d},{p:'R',v:r}]}}};
 }
 function run(priors,engine,index){
  if(!engine||typeof engine.estimate!=='function')throw Error('Model missing');
  if(!Number.isInteger(index)||index<0||index>=PHASES.length)
   throw Error('Unsupported simulated stage');
  return {phase:PHASES[index],step:index,totalSteps:PHASES.length,
   rows:RACES.map(r=>{
    const votes=snapshot(r.state,index);
    return {code:r.code,label:r.label,precinctPct:PHASES[index].precinctPct,
     simulatedVotes:votes?.races?.[r.state]?.total||0,
     result:engine.estimate(priors,{office:'Senate',key:r.state},votes,null,CLOCK)};
   })};
 }
 return Object.freeze({PHASES,RACES,snapshot,run});
});