/* Experimental counts-only likelihood for the existing correlated national
 * simulation. Race posterior probabilities are deliberately not inputs. */
(function(root,factory){const api=factory(typeof module!=='undefined'&&module.exports?
 require('./election_night_poll_closings_2026.js'):root?.ElectionNightPollClosings2026);
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.NationalCountyLikelihood=api;
})(typeof window!=='undefined'?window:null,function(closes){
 'use strict';
 const scopes={'IA-SEN':{n:99,id:87151,year:2022,prefix:'19'},'KS-SEN':{n:105,id:87162,year:2020,prefix:'20'},'TX-SEN':{n:254,id:87438,year:2024,prefix:'48'}};
 const policy=Object.freeze({minimum_votes:10000,minimum_reference_fraction:.005,minimum_counties:3,
  county_margin_sigma:6,batch_margin_sigma:8,turnout_sigma_fraction:.25,selection_share_sigma:.12,
  contamination_floor:.05,minimum_effective_sample_fraction:.5});
 const norm=s=>String(s).toLowerCase().replace(/[^a-z]/g,'');
 const clamp=x=>Math.max(.001,Math.min(.999,x));
 const cdf=x=>{const s=Math.sign(x),a=Math.abs(x)/Math.SQRT2,t=1/(1+.3275911*a);
  return (1+s*(1-(((((1.061405429*t-1.453152027)*t+1.421413741)*t-.284496736)*t+.254829592)*t)*Math.exp(-a*a)))/2;};
 function compile(envelope,{now=Date.now(),rehearsal=false}={}){
  if(Boolean(envelope?.rehearsal)!==rehearsal)throw Error("Rehearsal evidence cannot enter the live national model");
  if(!envelope||['forecast','posteriorMargin','posteriorSigma','dem_win_probability','prior_margin_points'].some(k=>k in envelope))
   throw Error('National evidence must contain counts, never a poll-informed race posterior');
  const x=envelope.snapshot,code=x?.race_code,scope=Object.hasOwn(scopes,code)?scopes[code]:null;
  if(!scope||x.status!=='VALIDATED_COUNTY_COUNTS_METHOD_MIX_UNRESOLVED'||x.live_votes_accepted!==true||
    x.source_url!=='https://civicapi.org/api/v2/race/'+scope.id||x.county_identities_matched!==scope.n||
    envelope.baseline_year!==scope.year||!Array.isArray(x.counties)||x.counties.length!==scope.n||
    !Array.isArray(envelope.reference?.counties)||envelope.reference.counties.length!==scope.n||
    !Array.isArray(envelope.baseline?.counties)||envelope.baseline.counties.length!==scope.n)
   throw Error('Unverified competitive county evidence scope');
  const time=Date.parse(x.snapshot_updated_at||'');
  if(!Number.isFinite(now)||!Number.isFinite(time)||!/(?:Z|[+-]\d\d:\d\d)$/.test(x.snapshot_updated_at||'')||
    time>now+15*60000||now-time>180*60000)throw Error('Stale/future county evidence');
  const reference=new Map(envelope.reference.counties.map(c=>[c.fips,norm(c.county)]));
  if(reference.size!==scope.n||new Set(reference.values()).size!==scope.n||[...reference].some(([f,n])=>!new RegExp('^'+scope.prefix+'\\d{3}$').test(f)||!n))throw Error('Duplicate independent county identities');
  const history=new Map();let baseD=0,baseN=0;
  for(const c of envelope.baseline.counties){
   const key=norm(c.county),a=c.records?.absentee,e=c.records?.election_day,t=c.records?.total;
   if(history.has(key)||Boolean(a)!==Boolean(e))throw Error('Duplicate/partial historical county modes');
   const parts=a?[a,e]:[t];
   if(parts.some(r=>!r||![r.dem_votes,r.rep_votes].every(n=>Number.isSafeInteger(n)&&n>=0)||r.dem_votes+r.rep_votes<=0))
    throw Error('Invalid historical county counts');
   const aN=parts[0].dem_votes+parts[0].rep_votes,eN=a?e.dem_votes+e.rep_votes:0;
   history.set(key,{aN,eN,aShare:parts[0].dem_votes/aN,eShare:a?e.dem_votes/eN:parts[0].dem_votes/aN,modes:Boolean(a)});
   baseD+=parts.reduce((sum,r)=>sum+r.dem_votes,0);baseN+=aN+eN;
  }
  if(new Set([...history.values()].map(c=>c.modes)).size!==1||!Number.isSafeInteger(baseN))throw Error('Inconsistent county history');
  const seen=new Set(),observed=[];let counted=0,allVotes=0;
  for(const c of x.counties){
   const key=norm(c.county),h=history.get(key);
   if(!h||seen.has(c.county_fips)||reference.get(c.county_fips)!==key||
      ![c.dem_votes,c.rep_votes,c.other_votes].every(n=>Number.isSafeInteger(n)&&n>=0))throw Error('Unmatched/invalid observed county');
   seen.add(c.county_fips);const n=c.dem_votes+c.rep_votes;counted+=n;allVotes+=n+c.other_votes;
   if(n>0)observed.push({...h,n,d:c.dem_votes});
  }
  if(!Number.isSafeInteger(allVotes)||!closes?.allowed(code,allVotes,x.snapshot_updated_at,now))throw Error('Pre-close county evidence');
  if(counted<policy.minimum_votes||counted/baseN<policy.minimum_reference_fraction||observed.filter(c=>c.n>=100).length<policy.minimum_counties)
   throw Error('Insufficient counted volume or county breadth for national updating');
  const modes=observed[0].modes,orders=modes?['absentee_first','election_day_first','proportional_mix']:['combined'];
  const scenarios=orders.map(order=>observed.map(c=>{
   const mu=c.aN+c.eN,sd=mu*policy.turnout_sigma_fraction,z=(c.n-mu)/sd;
   const tail=1-cdf(z),density=Math.exp(-z*z/2)/Math.sqrt(2*Math.PI);
   const mills=tail>1e-10?density/tail:Math.max(0,z)+1/Math.max(1,z);
   const finalN=Math.max(c.n,mu+sd*mills),aN=finalN*c.aN/mu,eN=finalN-aN;
   const aDone=order==='absentee_first'?Math.min(c.n,aN):order==='election_day_first'?Math.max(0,c.n-eN):c.n*aN/finalN;
   const variance=(policy.county_margin_sigma/200)**2+(policy.selection_share_sigma*(1-c.n/finalN))**2+.25/c.n;
   return {...c,aDone,eDone:c.n-aDone,variance};
  }));
  const baseMargin=100*(2*baseD/baseN-1),bias=(policy.batch_margin_sigma/200)**2;
  function logLikelihood(margin){
   if(!Number.isFinite(margin))throw Error('Missing correlated-draw race margin');
   const shift=(margin-baseMargin)/200;
   const logs=scenarios.map(units=>{
    let precision=0,weighted=0,squared=0,logVariance=0;
    for(const c of units){
     const expected=(c.aDone*clamp(c.aShare+shift)+c.eDone*clamp(c.eShare+shift))/c.n;
     const residual=c.d/c.n-expected;
     precision+=1/c.variance;weighted+=residual/c.variance;squared+=residual*residual/c.variance;logVariance+=Math.log(c.variance);
    }
    // Integrate one shared batch-selection error, NOT a second polling prior.
    const denominator=1+bias*precision;
    return -.5*(logVariance+Math.log(denominator)+squared-bias*weighted*weighted/denominator);
   });
   const max=Math.max(...logs);return max+Math.log(logs.reduce((s,v)=>s+Math.exp(v-max),0)/logs.length);
  }
  return Object.freeze({schema:'national-county-likelihood-v1',code,source_url:x.source_url,as_of:x.snapshot_updated_at,
   counted_two_party_votes:counted,reporting_counties:observed.length,reference_turnout_fraction:counted/baseN,
   independence:'COUNTS_ONLY_NO_POLL_PRIOR_OR_RACE_POSTERIOR',logLikelihood});
 }
 function condition(model,basis,envelopes,options={}){
  if(!Array.isArray(envelopes)||envelopes.length>3)throw Error('Bounded national county evidence required');
  if(options.captureCountyDraws||options.replayCountySeeds)throw Error('Nested/replayed national evidence is not a prior');
  const {now=Date.now(),rehearsal=false,...args}=options,compiled=[],excluded=[],codes=new Set();
  for(const envelope of envelopes){
   const code=envelope?.snapshot?.race_code;
   if(codes.has(code))throw Error('Duplicate race evidence would count the same returns twice');
   codes.add(code);
   try{compiled.push(compile(envelope,{now,rehearsal}));}catch(error){excluded.push({code:code||null,reason:error.message});}
  }
  if(!compiled.length){const baseline=model.simulate(basis,args);return {baseline,result:baseline,
   diagnostics:{status:'NO_ELIGIBLE_COUNTY_RETURNS',used:[],excluded,interval_calibrated:false}};}
  if(rehearsal&&Object.keys(args.live||{}).length)throw Error("Rehearsal cannot use live calls");
  const prior=model.simulate(basis,{...args,captureCountyDraws:compiled.map(c=>c.code)});
  const {county_draws:draws,...baseline}=prior,n=prior.samples;
  const logs=compiled.map(c=>Array.from(draws.margins[c.code],m=>c.logLikelihood(m)));
  const totals=new Float64Array(n);
  for(const row of logs){
   const max=Math.max(...row);
   for(let i=0;i<n;i++)totals[i]+=Math.log(policy.contamination_floor+(1-policy.contamination_floor)*Math.exp(row[i]-max));
  }
  function weights(power){const raw=Array.from(totals,v=>Math.exp(power*v)),sum=raw.reduce((s,v)=>s+v,0);
   const values=raw.map(v=>v/sum);return {values,ess:1/values.reduce((s,v)=>s+v*v,0)};}
  let power=1,weighted=weights(power);
  const target=n*policy.minimum_effective_sample_fraction;
  if(weighted.ess<target){let lo=0,hi=1;
   for(let i=0;i<40;i++){const mid=(lo+hi)/2;if(weights(mid).ess>=target)lo=mid;else hi=mid;}
   power=lo;weighted=weights(power);
  }
  // Systematic resampling reuses complete original correlated elections. A
  // second exact replay lets the SAME summarizer compute all marginal races,
  // chamber control, seat intervals and exclusive endings coherently.
  const seeds=new Uint32Array(n);let index=0,cumulative=weighted.values[0];
  for(let i=0;i<n;i++){const position=(i+.5)/n;
   while(position>cumulative&&index<n-1)cumulative+=weighted.values[++index];
   seeds[i]=draws.seeds[index];
  }
  const result=model.simulate(basis,{...args,replayCountySeeds:seeds});
  const diagnostics={status:rehearsal?'SIMULATED_NATIONAL_REHEARSAL':'EXPERIMENTAL_RESULTS_INFORMED_NATIONAL_OUTLOOK',
   used:compiled.map(({logLikelihood,...row})=>row),excluded,effective_sample_size:weighted.ess,
   particle_count:n,likelihood_power:power,policy,house_vote_sources:0,
   house_transfer:'Existing declared shared national-error covariance only; no observed House votes in this county path',
   interval_calibrated:false,independent_historical_calibration:false,
   delta_percentage_points:Object.fromEntries(Object.keys(result.probabilities).map(k=>[k,+(result.probabilities[k]-baseline.probabilities[k]).toFixed(2)]))};
  result.county_results_update=diagnostics;
  return {baseline,result,diagnostics};
 }
 return Object.freeze({compile,condition,policy});
});
