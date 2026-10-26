/* Experimental Iowa forecast from combined county counts. Unknown method mix
 * is an ensemble of explicit assumptions, NEVER invented observed mode votes. */
(function(root,factory){const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.IowaCountyNeedle=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const clamp=x=>Math.max(.001,Math.min(.999,x));
 const erf=x=>{const s=Math.sign(x),a=Math.abs(x),t=1/(1+.3275911*a);
  return s*(1-(((((1.061405429*t-1.453152027)*t+1.421413741)*t-.284496736)*t+.254829592)*t)*Math.exp(-a*a));};
 const cdf=x=>(1+erf(x/Math.SQRT2))/2;
 function logSurvival(z){
  const x=Math.abs(z)/Math.SQRT2,t=1/(1+.3275911*x);
  const polynomial=(((((1.061405429*t-1.453152027)*t+1.421413741)*t-.284496736)*t+.254829592)*t);
  const positive=Math.log(polynomial/2)-z*z/2;
  return z>=0?positive:Math.log1p(-Math.exp(positive));
 }
 function remainingQuantile(mu,sd,counted,q){
  const z=(counted-mu)/sd;
  // In the far normal tail, use its stable exponential-excess limit rather
  // than subtracting two enormous, almost equal final-turnout numbers.
  if(z>1e6)return -Math.log1p(-q)*sd/z;
  const target=logSurvival(z)+Math.log1p(-q);
  let lo=z,hi=Math.max(z,0)+12;
  for(let i=0;i<64;i++){
   const middle=(lo+hi)/2;
   if(logSurvival(middle)>target)lo=middle;else hi=middle;
  }
  return Math.max(0,((lo+hi)/2-z)*sd);
 }
 function componentForecast({baseline,observations=[],prior_margin_points,prior_sigma_points=6,expected_county_count=99,
  turnout_scale=1,turnout_sigma_fraction=.25,county_sigma_points=6,structural_sigma_points=5,batch_bias_sigma_points=8}){
  if(!baseline?.counties||![99,105].includes(expected_county_count)||baseline.counties.length!==expected_county_count||!Array.isArray(observations)||
   ![prior_margin_points,prior_sigma_points,turnout_scale,turnout_sigma_fraction,county_sigma_points,structural_sigma_points,batch_bias_sigma_points].every(Number.isFinite)||
   Math.abs(prior_margin_points)>=100||prior_sigma_points<=0||turnout_scale<=0||turnout_sigma_fraction<=0||
   county_sigma_points<=0||structural_sigma_points<=0||batch_bias_sigma_points<=0)throw Error('Invalid county forecast inputs');
  const old=new Map(),seen=new Map();let baseD=0,baseN=0;
  const historyMethods=baseline.counties.map(c=>Boolean(c.records?.absentee&&c.records?.election_day));
  if(historyMethods.some(Boolean)&&!historyMethods.every(Boolean))throw Error('Inconsistent historical method coverage');
  const knownMethods=historyMethods.every(Boolean);
  for(const c of baseline.counties){
   if(!c.county||old.has(c.county))throw Error('Duplicate/missing historical county');
   let a=c.records?.absentee,e=c.records?.election_day;
   if(Boolean(a)!==Boolean(e))throw Error('Partial historical method split');
   // With county-only history, the first internal group holds the combined
   // total. It is not labeled or represented as observed absentee votes.
   if(!knownMethods){a=c.records?.total;e={dem_votes:0,rep_votes:0};}
   for(const r of (knownMethods?[a,e]:[a]))if(!r||![r.dem_votes,r.rep_votes].every(n=>Number.isSafeInteger(n)&&n>=0)||
    !Number.isSafeInteger(r.dem_votes+r.rep_votes)||r.dem_votes+r.rep_votes<=0)throw Error('Invalid historical method count');
   old.set(c.county,{county:c.county,aN:a.dem_votes+a.rep_votes,eN:e.dem_votes+e.rep_votes,
    aShare:a.dem_votes/(a.dem_votes+a.rep_votes),eShare:knownMethods?e.dem_votes/(e.dem_votes+e.rep_votes):a.dem_votes/(a.dem_votes+a.rep_votes)});
   baseD+=a.dem_votes+e.dem_votes;baseN+=a.dem_votes+a.rep_votes+e.dem_votes+e.rep_votes;
  }
  for(const r of observations){
   if(!old.has(r.county)||seen.has(r.county)||![r.dem_votes,r.rep_votes].every(n=>Number.isSafeInteger(n)&&n>=0)||
    !Number.isSafeInteger(r.dem_votes+r.rep_votes))throw Error('Invalid/duplicate combined county observation');
   seen.set(r.county,r);
  }
  const centered=(prior_margin_points/100-(2*baseD/baseN-1))/2;
  const priorVar=(prior_sigma_points/200)**2,countyVar=(county_sigma_points/200)**2;
  const scenarios=[];
  for(const order of (knownMethods?['absentee_first','election_day_first','proportional_mix']:['combined_history_unknown_methods'])){
   const units=[];let precision=0,weighted=0,squared=0,logVariance=0,remainingLow=0,remainingHigh=0;
   for(const [name,b] of old){
    const r=seen.get(name)||{dem_votes:0,rep_votes:0},n=r.dem_votes+r.rep_votes;
    const mu=(b.aN+b.eN)*turnout_scale,sd=mu*turnout_sigma_fraction;
    // Coherent statewide low/high turnout ranks retain correlated uncertainty;
    // do not manufacture a narrow total by treating counties as independent.
    remainingLow+=remainingQuantile(mu,sd,n,.05);
    remainingHigh+=remainingQuantile(mu,sd,n,.95);
    // Current counted ballots are a lower bound on final turnout. Condition
    // the turnout distribution on that bound rather than declaring a county
    // complete merely because it exceeded its historical expectation.
    const z=(n-mu)/sd,tail=1-cdf(z),density=Math.exp(-z*z/2)/Math.sqrt(2*Math.PI);
    const mills=tail>1e-10?density/tail:Math.max(0,z)+1/Math.max(1,z);
    const finalN=Math.max(n,mu+sd*mills),aN=finalN*b.aN/(b.aN+b.eN),eN=finalN-aN;
    const aDone=order==='absentee_first'?Math.min(n,aN):order==='election_day_first'?
     Math.max(0,n-eN):n*aN/finalN;
    const eDone=n-aDone,aShare=clamp(b.aShare+centered),eShare=clamp(b.eShare+centered);
    const remainingA=Math.max(0,aN-aDone),remainingE=Math.max(0,eN-eDone),remaining=remainingA+remainingE;
    if(n>0){
     const expected=(aDone*aShare+eDone*eShare)/n;
     const fraction=Math.min(1,n/finalN);
     // Within-method selected precincts remain uncertain even after a mode
     // ordering scenario is chosen. Do not treat early ballots as random.
     const selectionVariance=(.12*(1-fraction))**2;
     const variance=countyVar+selectionVariance+.25/n;
     const residual=r.dem_votes/n-expected;
     precision+=1/variance;weighted+=residual/variance;
     squared+=residual*residual/variance;logVariance+=Math.log(variance);
    }
    units.push({name,d:r.dem_votes,r:r.rep_votes,aN,eN,remainingA,remainingE,remaining,aShare,eShare,sd});
   }
   // Shared batch bias is distinct from genuine statewide swing, so dozens
   // of similarly selected county batches cannot manufacture precision.
   const biasVariance=(batch_bias_sigma_points/200)**2,sharedVariance=priorVar+biasVariance;
   const denominator=1+sharedVariance*precision;
   const shift=priorVar*weighted/denominator;
   const shiftVariance=priorVar-priorVar*priorVar*precision/denominator;
   const logLikelihood=-.5*(logVariance+Math.log(denominator)+squared-
    sharedVariance*weighted*weighted/denominator);
   let d=0,r=0,remaining=0,futureD=0,independent=0,turnoutWeight=0;
   for(const u of units){
    const aShare=clamp(u.aShare+shift),eShare=clamp(u.eShare+shift);
    // Known counted votes consume the county's modeled candidate totals.
    // The mode ordering is a latent assumption, not an allocation of real
    // observed D/R votes to unreported methods.
    const future=Math.max(0,Math.min(u.remaining,u.aN*aShare+u.eN*eShare-u.d));
    d+=u.d;r+=u.r;remaining+=u.remaining;futureD+=future;
    independent+=u.remaining*u.remaining*countyVar+future*(1-future/Math.max(1,u.remaining));
    turnoutWeight+=u.sd*(u.remaining?2*future/u.remaining-1:0);
   }
   const total=d+r+remaining,marginVotes=d-r+2*futureD-remaining;
   const variance=4*(remaining*remaining*shiftVariance+independent)+
    (remaining*structural_sigma_points/100)**2+turnoutWeight**2;
   const sigmaVotes=Math.sqrt(variance),margin=100*marginVotes/total,sigma=100*sigmaVotes/total;
   if(!Number.isFinite(sigma)||sigma<=0)throw Error('Forecast uncertainty degenerated; input exceeds numerical model scope');
   const probability=Math.max(.000001,Math.min(.999999,cdf(marginVotes/sigmaVotes)));
   scenarios.push({order,log_likelihood:logLikelihood,projected_margin_points:margin,projected_sigma_points:sigma,dem_win_probability:probability,
    modeled_remaining_two_party_votes:remaining,band:[Math.max(-100,margin-1.644853627*sigma),Math.min(100,margin+1.644853627*sigma)],
    modeled_remaining_two_party_votes_band:[remainingLow,remainingHigh],
    posterior_swing_margin_points:200*shift});
  }
  const maxLog=Math.max(...scenarios.map(s=>s.log_likelihood));
  const evidence=scenarios.map(s=>Math.exp(s.log_likelihood-maxLog)),normalizer=evidence.reduce((a,b)=>a+b,0);
  scenarios.forEach((s,i)=>s.weight=evidence[i]/normalizer);
  const mean=key=>scenarios.reduce((s,r)=>s+r[key]*r.weight,0);
  return {log_evidence:maxLog+Math.log(normalizer)-Math.log(scenarios.length),status:'EXPERIMENTAL_COMBINED_COUNTY_FORECAST_NOT_CALIBRATED',
   counted_dem_votes:observations.reduce((s,r)=>s+r.dem_votes,0),counted_rep_votes:observations.reduce((s,r)=>s+r.rep_votes,0),
   reporting_counties:observations.filter(r=>r.dem_votes+r.rep_votes>0).length,
   projected_margin_points:mean('projected_margin_points'),dem_win_probability:mean('dem_win_probability'),
   modeled_remaining_two_party_votes:mean('modeled_remaining_two_party_votes'),
   modeled_remaining_two_party_votes_band:[Math.min(...scenarios.map(s=>s.modeled_remaining_two_party_votes_band[0])),
    Math.max(...scenarios.map(s=>s.modeled_remaining_two_party_votes_band[1]))],
   method_mix_probability_range:[Math.min(...scenarios.map(s=>s.dem_win_probability)),Math.max(...scenarios.map(s=>s.dem_win_probability))],
   scenario_margin_band:[Math.min(...scenarios.map(s=>s.band[0])),Math.max(...scenarios.map(s=>s.band[1]))],
   observed_method_votes_inferred:false,historical_method_split_reported:knownMethods,interval_calibrated:false,may_move_national_needle:false,
   assumptions:{prior_margin_points,prior_sigma_points,turnout_scale,turnout_sigma_fraction,county_sigma_points,structural_sigma_points,batch_bias_sigma_points,
    remaining_vote_band:'Conditional historical-turnout 5th/95th scenarios with shared statewide rank; not calibrated or verified ballots outstanding',
    method_scenario_weighting:'Gaussian marginal evidence under declared model assumptions'},scenarios};
 }
 function forecast(config){
  // A small prior tail lets coherent, surprising returns overcome the polling
  // center. A single Gaussian permanently confounds a large swing with batch
  // selection bias. These mixture weights are declared assumptions, not fitted
  // frequencies or evidence of calibrated election probabilities.
  const sigma=config?.prior_sigma_points===undefined?6:config.prior_sigma_points;
  const components=[{scale:1,prior:.85},{scale:2,prior:.10},{scale:4,prior:.05}]
   .map(c=>({...c,result:componentForecast({...config,prior_sigma_points:sigma*c.scale})}));
  const maxLog=Math.max(...components.map(c=>c.result.log_evidence));
  let normalizer=0;
  for(const c of components){c.weight=c.prior*Math.exp(c.result.log_evidence-maxLog);normalizer+=c.weight;}
  for(const c of components)c.weight/=normalizer;
  const scenarios=components.flatMap(c=>c.result.scenarios.map(s=>({...s,
   prior_sigma_points:sigma*c.scale,weight:c.weight*s.weight})));
  const mean=key=>scenarios.reduce((total,s)=>total+s.weight*s[key],0);
  function quantile(rows,q){
   const weight=rows.reduce((total,s)=>total+s.weight,0);let lo=-100,hi=100;
   for(let i=0;i<64;i++){
    const middle=(lo+hi)/2;
    const probability=rows.reduce((total,s)=>total+s.weight*cdf((middle-s.projected_margin_points)/s.projected_sigma_points),0)/weight;
    if(probability<q)lo=middle;else hi=middle;
   }
   return (lo+hi)/2;
  }
  const orders=[...new Set(scenarios.map(s=>s.order))].map(order=>{
   const rows=scenarios.filter(s=>s.order===order),weight=rows.reduce((total,s)=>total+s.weight,0);
   // Numerically negligible orders remain in the raw diagnostic inventory, but
   // cannot define a conditional band when their evidence underflows to zero.
   if(weight===0)return null;
   return {order,weight,probability:rows.reduce((total,s)=>total+s.weight*s.dem_win_probability,0)/weight,
    band:[quantile(rows,.05),quantile(rows,.95)]};
  }).filter(Boolean);
  const {log_evidence,...base}=components[0].result;
  return {...base,projected_margin_points:mean('projected_margin_points'),
   dem_win_probability:mean('dem_win_probability'),modeled_remaining_two_party_votes:mean('modeled_remaining_two_party_votes'),
   method_mix_probability_range:[Math.min(...orders.map(s=>s.probability)),Math.max(...orders.map(s=>s.probability))],
   scenario_margin_band:[Math.min(...orders.map(s=>s.band[0])),Math.max(...orders.map(s=>s.band[1]))],
   assumptions:{...base.assumptions,robust_swing_prior:'Declared Gaussian scale mixture, not empirical calibration',
    prior_components:components.map(c=>({sigma_points:sigma*c.scale,prior_weight:c.prior,posterior_weight:c.weight}))},scenarios};
 }
 return Object.freeze({forecast});
});
