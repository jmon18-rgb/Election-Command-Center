/* Experimental, source-separated election-night probability diagnostic.
 * Priors are the existing documented polling probability model. An explicitly
 * modeled nonrandom-reporting error scale tempers the raw reported two-party
 * margin. This is NOT an official call, a certified result, a geography-aware
 * returns model or a nationally complete chamber forecast.
 */
(function(root,factory){
 const result=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=result;
 if(root)root.RaceLiveNowcast=result;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const ELECTION_START=Date.parse('2026-11-03T05:00:00Z');
 const OFFICES={Senate:'senate',House:'house',Governor:'governor'};
 const atLargeBridge=typeof window!=='undefined'?
  window.HouseAtLargeBridge:
  typeof require==='function'?require('./house_at_large_bridge.js'):null;
 const normalCdf=z=>{
  const x=Math.abs(z)/Math.sqrt(2),t=1/(1+0.3275911*x);
  const erf=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-
   0.284496736)*t+0.254829592)*t*Math.exp(-x*x);
  return Math.max(0,Math.min(1,0.5*(1+(z<0?-erf:erf))));
 };
 const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
 function raceCode(item){
  if(!item||!OFFICES[item.office]||typeof item.key!=='string')return null;
  if(item.office==='House'){
   const key=atLargeBridge?.modelCode(item.key)||item.key;
   return /^[A-Z]{2}-\d{2}$/.test(key)?key:null;
  }
  if(item.office==='Senate')return /^[A-Z]{2}(?:-special)?$/.test(item.key)?
    item.key.slice(0,2)+'-SEN':null;
  return /^[A-Z]{2}$/.test(item.key)?item.key+'-GOV':null;
 }
 function priorFor(doc,item){
  const office=OFFICES[item?.office],code=raceCode(item);
  if(!office||!code||!doc||!Array.isArray(doc.records))return null;
 const newJoint=doc.schema_version==='joint-race-probabilities-v1'&&
  doc.status==='JOINT_CORRELATED_RACE_PROBABILITIES_EXPERIMENTAL'&&
  doc.race_probability_method==='SAME_CORRELATED_DRAWS_AS_CHAMBER_CONTROL';
 const legacy=doc.schema_version==='experimental-race-odds-v1'&&
  doc.can_infer_chamber_control===false;
 if(!newJoint&&!legacy)return null;
  const prior=doc.records.find(x=>x.office===office&&x.race_code===code);
  return prior&&Number.isFinite(prior.dem_minus_rep)&&
   Number.isFinite(prior.sigma_points)&&prior.sigma_points>=3&&
   Number.isFinite(prior.dem_beats_rep_pct)&&
   prior.dem_beats_rep_pct>=0&&prior.dem_beats_rep_pct<=100?prior:null;
 }
 // Only consume the UI's existing validated source records. No scrape,
 // arbitrary party inference or synthetic "votes outstanding" calculation.
 // Defense in depth: check source candidates independently, including ALL
 // party totals, so an ill-formed supplemental record cannot move a needle.
 const candidatesValid=(rows,total,kind)=>{
  if(!Number.isSafeInteger(total)||total<=0||!Array.isArray(rows)||
     rows.length<2||rows.length>60)return false;
  let sum=0;const unique=new Set();
  for(const c of rows){
   const party=kind==='civic'?c?.party:c?.p;
   const votes=kind==='civic'?c?.votes:c?.v;
   if(typeof party!=='string'||!party.trim()||
     !Number.isSafeInteger(votes)||votes<0)return false;
   if(kind==='civic'){
    if(!['D','R','O'].includes(party)||
     typeof c.name!=='string'||!c.name.trim())return false;
    const id=c.name.trim().toLowerCase()+'|'+party;
    if(unique.has(id))return false;
    unique.add(id);
   }
   sum+=votes;
   if(!Number.isSafeInteger(sum)||sum>total)return false;
  }
  return true;
 };
 function observed(item,primary,secondary){
  const source=primary&&primary.office===item.office&&primary.year===2026?
   primary.races?.[item.key]:null;
  let d,r,total,reporting,asOf,provider,sourceStale=false;
  if(source&&candidatesValid(source.cands,source.total,'primary')){
   d=(source.cands||[]).filter(c=>c.p==='D').reduce((n,c)=>n+c.v,0);
   r=(source.cands||[]).filter(c=>c.p==='R').reduce((n,c)=>n+c.v,0);
   total=source.total;reporting=source.pct_in;asOf=primary.as_of;
   provider='Open America';sourceStale=Boolean(primary.stale);
  }else if(secondary&&secondary.provider==='civicAPI'&&
    Number.isSafeInteger(secondary.race_id)&&secondary.race_id>0&&
    secondary.stale!==true&&secondary.sourceStale!==true&&
    secondary.key===item.key&&secondary.office===item.office&&
    candidatesValid(secondary.candidates,secondary.total,'civic')){
   d=secondary.candidates.filter(c=>c.party==='D').reduce((n,c)=>n+c.votes,0);
   r=secondary.candidates.filter(c=>c.party==='R').reduce((n,c)=>n+c.votes,0);
   total=secondary.total;reporting=secondary.percent_reporting;
   asOf=secondary.last_updated;provider='civicAPI';
  }else return null;
  if(!Number.isSafeInteger(d)||!Number.isSafeInteger(r)||d<0||r<0||
     d===0||r===0||d+r>total||!Number.isFinite(reporting)||reporting<0||
     reporting>100||typeof asOf!=='string')return null;
  const time=Date.parse(asOf);
  if(!Number.isFinite(time))return null;
  return {d,r,total,reporting,asOf,time,provider,sourceStale,
    margin:100*(d-r)/(d+r)};
 }
 function estimate(doc,item,primary,secondary,now=Date.now()){
  const prior=priorFor(doc,item);
  if(!prior)return null;
  const baseline=clamp(prior.dem_beats_rep_pct,0,100),sd=prior.sigma_points;
  const baseMargin=Number.isFinite(prior.model_dem_margin_points)?
   prior.model_dem_margin_points:prior.dem_minus_rep;
  const defaultResult={
   office:item.office,raceCode:raceCode(item),party:'two_party',
   priorDemPct:baseline,priorRepPct:100-baseline,
   demPct:baseline,repPct:100-baseline,mode:'polls_only',
   priorMargin:baseMargin,posteriorMargin:baseMargin,
   priorSigma:sd,posteriorSigma:sd,reportedMargin:null,reporting:null,
   source:null,sourceUpdated:null,sourceStale:false,
   sensitivityLow:baseline,sensitivityHigh:baseline,
   explanation:'No eligible verified partial returns; using the pre-election race prior from our linked joint model.'
  };
  // The joint simulation has already accepted a distinct, normalized
  // source-reported D/R winner call. No partial early count may overwrite
  // that outcome in the secondary race probability monitor.
  if(now>=ELECTION_START&&['D','R'].includes(prior.provider_called_party)){
   const dem=prior.provider_called_party==='D';
   return {...defaultResult,mode:'source_called',demPct:dem?100:0,
    repPct:dem?0:100,source:'civicAPI',reporting:null,
    sensitivityLow:dem?100:0,sensitivityHigh:dem?100:0,
    explanation:'Source-reported winner call (civicAPI), not official certification. The same correlated congressional simulations lock this D/R race while the call remains valid; a corrected or withdrawn call restores uncertainty.'};
  }
  const actual=observed(item,primary,secondary);
  if(!actual||!Number.isFinite(now)||now<ELECTION_START||actual.time<ELECTION_START||
    actual.time>now+15*60000||now-actual.time>180*60000||
    actual.sourceStale||actual.reporting<10)return defaultResult;
  // "Precincts reporting" is NOT equal to vote share counted. Treat the
  // observed statewide margin as a noisy signal, not a random sample.
  // The noise floor models unobserved geographic and ballot-method mix;
  // neither coefficient is historically calibrated to 2026 precinct returns.
  const progress=actual.reporting/100;
  const geographicNoise=7+20*Math.pow(1-progress,1.3);
  const priorVar=sd*sd,signalVar=geographicNoise*geographicNoise;
  const combine=(noise)=>{
   const signalVariance=noise*noise;
   const variance=1/(1/priorVar+1/signalVariance);
   const mean=variance*(baseMargin/priorVar+actual.margin/signalVariance);
   return {mean,sd:Math.sqrt(variance),demPct:100*normalCdf(mean/Math.sqrt(variance))};
  };
  const middle=combine(geographicNoise),conservative=combine(geographicNoise*1.6),
        aggressive=combine(Math.max(5,geographicNoise*0.75));
  const vals=[middle.demPct,conservative.demPct,aggressive.demPct];
  return {...defaultResult,
   mode:'live_informed',demPct:clamp(middle.demPct,0,100),
   repPct:clamp(100-middle.demPct,0,100),
   reportedMargin:actual.margin,reporting:actual.reporting,
   posteriorMargin:middle.mean,posteriorSigma:middle.sd,
   source:actual.provider,sourceUpdated:actual.asOf,sourceStale:false,
   sensitivityLow:Math.min(...vals),sensitivityHigh:Math.max(...vals),
   explanation:'Illustrative raw-return update with uncalibrated geographic noise. Precinct percentage is not vote share counted. Not a race call.'};
 }
 return Object.freeze({raceCode,priorFor,observed,estimate,normalCdf});
});