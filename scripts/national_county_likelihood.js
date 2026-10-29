/* Experimental counts-only likelihood for the existing correlated national
 * simulation. Race posterior probabilities are deliberately not inputs. */
(function(root,factory){const node=typeof module!=='undefined'&&module.exports;const api=factory(node?
 require('./election_night_poll_closings_2026.js'):root?.ElectionNightPollClosings2026,node?require('./washington_remaining_source.js'):root?.WashingtonRemainingSource,node?require('./washington_remaining_scenarios.js'):root?.WashingtonRemainingScenarios,node?require('./source_call_conditioning.js'):root?.SourceCallConditioning);
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.NationalCountyLikelihood=api;
})(typeof window!=='undefined'?window:null,function(closes,remainingSource,remainingScenarios,sourceCalls){
 'use strict';
 const scopes={'SC-SEN':{n:46,id:87409,year:2020,prefix:'45'},'MI-07':{n:7,id:87207,year:2024,prefix:'26',house:true},'PA-08':{n:5,id:87383,year:2024,prefix:'42',house:true},'VA-02':{n:8,year:2024,prefix:'51',house:true,url:'https://enr.elections.virginia.gov/results/public/api/elections/virginia/2026-November-General/data/ballot-item/01000000-f030-c43d-fd71-08df1fee52e7'},'AZ-06':{n:5,id:86922,year:2024,prefix:'04',house:true},'PA-07':{n:4,id:87382,year:2024,prefix:'42',house:true},'OH-SEN':{n:88,id:87527,year:2024,prefix:'39'},'ME-SEN':{n:16,id:87188,year:2020,prefix:'23',firstChoice:true},'IA-SEN':{n:99,id:87151,year:2022,prefix:'19'},'KS-SEN':{n:105,id:87162,year:2020,prefix:'20'},'TX-SEN':{n:254,id:87438,year:2024,prefix:'48'},'WI-01':{n:5,id:87483,year:2024,prefix:'55',house:true},'WI-03':{n:19,id:87485,year:2024,prefix:'55',house:true},'MI-04':{n:6,id:87204,year:2024,prefix:'26',house:true},'PA-10':{n:3,id:87385,year:2024,prefix:'42',house:true},'NY-17':{n:4,id:87319,year:2024,prefix:'36',house:true},'WA-03':{n:7,url:'https://results.votewa.gov/results/public/api/elections/washington/20261103/data/ballot-item/54c40000-9064-bbec-4779-08df15c0a82a',year:2024,prefix:'53',house:true}};
 scopes['NE-SEN']={n:93,id:87254,year:2024,prefix:'31',independent:true};
 const policy=Object.freeze({minimum_votes:10000,minimum_reference_fraction:.005,minimum_counties:3,
  county_margin_sigma:6,batch_margin_sigma:8,turnout_sigma_fraction:.25,selection_share_sigma:.12,
  contamination_floor:.05,minimum_effective_sample_fraction:.5,state_likelihood_pooling:'FIXED_PREDECLARED_STATE_LOG_LIKELIHOOD_BUDGET',
  shared_reporting_error_variance_fraction:.5,shared_reporting_error_status:'ASSUMED_NOT_FITTED_OR_CALIBRATED',
  reporting_grid_step:.2,reporting_curve_step_margin_points:.125});
 // Normal-density quadrature over +/-6 sigma. Half the EXISTING batch-error variance
 // is shared across races; half remains race-specific. This is observation error,
 // not an extra national voting swing or a second polling prior.
 function normalQuadrature(step=policy.reporting_grid_step){
  if(!Number.isFinite(step)||step<.05||step>1||Math.abs(12/step-Math.round(12/step))>1e-8)throw Error('Invalid reporting integration step');
  const count=Math.round(12/step),rows=Array.from({length:count+1},(_,i)=>{
   const z=-6+i*step;return {z,weight:Math.exp(-z*z/2)*(i===0||i===count?.5:1)};
  }),sum=rows.reduce((s,r)=>s+r.weight,0);
  return Object.freeze(rows.map(r=>Object.freeze({z:r.z,weight:r.weight/sum})));
 }
 const reportingNodes=normalQuadrature();
 const logMixture=values=>{const max=Math.max(...values);return max+Math.log(values.reduce((sum,v,i)=>sum+reportingNodes[i].weight*Math.exp(v-max),0));};
 function conditionalCurve(compiled,margins){
  const step=policy.reporting_curve_step_margin_points,support=6*policy.batch_margin_sigma*Math.sqrt(policy.shared_reporting_error_variance_fraction);
  const low=Math.floor((Math.min(...margins)-support)/step)*step,high=Math.max(...margins)+support;
  const size=Math.ceil((high-low)/step)+2;
  if(!Number.isFinite(low)||!Number.isSafeInteger(size)||size<2||size>10000)throw Error('Unbounded reporting likelihood curve');
  const values=Float64Array.from({length:size},(_,i)=>compiled.logLikelihood(low+i*step,{sharedReportingOffset:0}));
  return margin=>{
   const x=(margin-low)/step,i=Math.floor(x);
   if(!Number.isFinite(x)||i<0||i>=size-1)throw Error('Reporting likelihood outside captured draw support');
   return values[i]+(values[i+1]-values[i])*(x-i);
  };
 }
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
    x.source_url!==(scope.url||'https://civicapi.org/api/v2/race/'+scope.id)||x.county_identities_matched!==scope.n||
    envelope.baseline_year!==scope.year||!Array.isArray(x.counties)||x.counties.length!==scope.n||
    !Array.isArray(envelope.reference?.counties)||envelope.reference.counties.length!==scope.n||
    !Array.isArray(envelope.baseline?.counties)||envelope.baseline.counties.length!==scope.n)
   throw Error('Unverified competitive county evidence scope');
  if(scope.house&&(envelope.baseline.race_code!==code||envelope.baseline.geography_scope!=='district_parts'))
   throw Error('House requires matched district-part historical counts, never whole-county votes');
  const independent=scope.independent===true,positive=independent?'osborn_votes':'dem_votes',negative=independent?'ricketts_votes':'rep_votes';
  if(independent&&(x.candidate_contrast!=='NE_OSBORN_RICKETTS_V1'||x.contrast_supported!==true||x.caucus_credit_assumed!==false||envelope.baseline_scenario!=='EXPERIMENTAL_OSBORN_2024_TO_2026_DIFFERENT_SEAT'||envelope.baseline.schema!=='nebraska-2024-six-year-senate-historical-preparation-v1'||envelope.baseline.source_decoded_sha256!=='4887fb1caab820ab737adaaff9b73ee601e37a707fb0002d8901fd674e8efbe9'||envelope.baseline.same_Senate_seat_as_2026!==false))throw Error('Unreviewed Independent candidate-transfer contrast');
  const time=Date.parse(x.snapshot_updated_at||'');
  if(!Number.isFinite(now)||!Number.isFinite(time)||!/(?:Z|[+-]\d\d:\d\d)$/.test(x.snapshot_updated_at||'')||
    time>now+15*60000||now-time>180*60000)throw Error('Stale/future county evidence');
  const reference=new Map(envelope.reference.counties.map(c=>[c.fips,norm(c.county)]));
  if(reference.size!==scope.n||new Set(reference.values()).size!==scope.n||[...reference].some(([f,n])=>!new RegExp('^'+scope.prefix+'\\d{3}$').test(f)||!n))throw Error('Duplicate independent county identities');
  // Legacy algebraic names baseD/referenceD/d denote the positive contrast.
  // NE reads Osborn fields directly; these are never Democratic party totals.
  const history=new Map();let baseD=0,baseN=0;
  for(const c of envelope.baseline.counties){
   const key=norm(c.county),a=independent?null:c.records?.absentee,e=independent?null:c.records?.election_day,t=independent?c:c.records?.total;
   const historicalPositive=independent?'dan_osborn':'dem_votes',historicalNegative=independent?'deb_fischer':'rep_votes';
   if(independent&&reference.get(c.fips)!==key)throw Error('Independent historical county identity mismatch');
   if(history.has(key)||Boolean(a)!==Boolean(e))throw Error('Duplicate/partial historical county modes');
   const parts=a?[a,e]:[t];
   if(parts.some(r=>!r||![r[historicalPositive],r[historicalNegative]].every(n=>Number.isSafeInteger(n)&&n>=0)||r[historicalPositive]+r[historicalNegative]<=0))
    throw Error('Invalid historical county counts');
   const aN=parts[0][historicalPositive]+parts[0][historicalNegative],eN=a?e[historicalPositive]+e[historicalNegative]:0;
   history.set(key,{aN,eN,aShare:parts[0][historicalPositive]/aN,eShare:a?e[historicalPositive]/eN:parts[0][historicalPositive]/aN,modes:Boolean(a)});
   baseD+=parts.reduce((sum,r)=>sum+r[historicalPositive],0);baseN+=aN+eN;
  }
  if(new Set([...history.values()].map(c=>c.modes)).size!==1||!Number.isSafeInteger(baseN))throw Error('Inconsistent county history');
  const seen=new Set(),observed=[];let counted=0,allVotes=0;
  for(const c of x.counties){
   if(independent&&(Object.hasOwn(c,'dem_votes')||Object.hasOwn(c,'rep_votes')||!Array.isArray(c.other_candidates)||c.other_candidates.length!==3||new Set(c.other_candidates.map(p=>p.provider_id)).size!==3||c.other_candidates.some(p=>![220703,220704,220705].includes(p.provider_id)||!Number.isSafeInteger(p.votes)||p.votes<0)||c.other_candidates.reduce((n,p)=>n+p.votes,0)!==c.other_votes))throw Error('Independent counts require named all-other accounting, not Democratic aliases');
   const key=norm(c.county),h=history.get(key);
   if(!h||seen.has(c.county_fips)||reference.get(c.county_fips)!==key||
      ![c[positive],c[negative],c.other_votes].every(n=>Number.isSafeInteger(n)&&n>=0))throw Error('Unmatched/invalid observed county');
   seen.add(c.county_fips);const n=c[positive]+c[negative];counted+=n;allVotes+=n+c.other_votes;
   if(n>0)observed.push({...h,county:c.county,county_fips:c.county_fips,n,d:c[positive]});
  }
  if(!Number.isSafeInteger(allVotes)||!closes?.allowed(code,allVotes,x.snapshot_updated_at,now))throw Error('Pre-close county evidence');
  if(counted<policy.minimum_votes||counted/baseN<policy.minimum_reference_fraction||observed.filter(c=>c.n>=100).length<policy.minimum_counties)
   throw Error('Insufficient counted volume or county breadth for national updating');
  const modes=observed[0].modes,orders=modes?['absentee_first','election_day_first','proportional_mix']:['combined'];
  let scenarios=orders.map(order=>observed.map(c=>{
   const mu=c.aN+c.eN,sd=mu*policy.turnout_sigma_fraction,z=(c.n-mu)/sd;
   const tail=1-cdf(z),density=Math.exp(-z*z/2)/Math.sqrt(2*Math.PI);
   const mills=tail>1e-10?density/tail:Math.max(0,z)+1/Math.max(1,z);
   const finalN=Math.max(c.n,mu+sd*mills),aN=finalN*c.aN/mu,eN=finalN-aN;
   const aDone=order==='absentee_first'?Math.min(c.n,aN):order==='election_day_first'?Math.max(0,c.n-eN):c.n*aN/finalN;
   const variance=(policy.county_margin_sigma/200)**2+(policy.selection_share_sigma*(1-c.n/finalN))**2+.25/c.n;
   return {...c,aDone,eDone:c.n-aDone,variance};
  }));
  let remainingRows=[],remainingVariants=null,remainingMetadata=null,remainingExclusion=null;
  if(code==='WA-03'&&x.official_remaining){try{
   if(!remainingSource||!remainingScenarios)throw Error('Optional remaining helpers unavailable');
   const geometry=envelope.remaining_geography;
   if(geometry?.source_sha256!=='66e3271909cd93daa17143b207642bab6a0460d0552f4765f12fbdf9e741ecbf'||geometry.geography_comparable_2024!==true||geometry.congressional_geography_reference!=='120th_Congress_2026'||geometry.map_relation_2024_to_2026!=='boundaries_unchanged_per_2026_census'||JSON.stringify(geometry.whole_county_fips)!==JSON.stringify(remainingSource.whole)||geometry.split_county_fips!=='53067')throw Error('Whole-county geometry/2026 bridge unverified');
   const reviewed=remainingSource.parse(x.official_remaining,{now,counts_stamp:x.snapshot_updated_at});
   remainingRows=reviewed.counties.filter(row=>observed.some(c=>c.county_fips===row.county_fips));
   if(remainingRows.length){
    remainingVariants=remainingScenarios.variants(remainingRows);const historical=scenarios[0];
    scenarios=remainingVariants.map(v=>historical.map(c=>{
     const left=v.remaining(c.county_fips,c.aN+c.eN);if(left===null)return c;
     const finalN=c.n+left,variance=(policy.county_margin_sigma/200)**2+(policy.selection_share_sigma*(1-c.n/finalN))**2+.25/c.n;
     return {...c,variance};
    }));
    remainingMetadata={whole_counties:remainingRows.length,county_fips:remainingRows.map(c=>c.county_fips),as_of:new Date(Math.max(...remainingRows.map(c=>Date.parse(c.reported_at)))).toISOString(),source_url:remainingSource.URL,assumptions:remainingScenarios.assumptions,scope:'Whole-county official estimate sensitivity; Thurston retains historical scenario; not exact outstanding ballots or calibrated intervals'};
   }
  }catch(error){remainingExclusion=error.message;}}
  let referenceD=baseD,referenceN=baseN,roundVariance=0;
  if(scope.firstChoice){
   const u=envelope.baseline.state_unallocated_uocava,t=envelope.baseline.statewide;
   if(x.round!==1||x.ranked_choice_scope!=='FIRST_CHOICE_ONLY_NOT_FINAL_RCV_OUTCOME'||
    t?.dem_votes!==347223||t?.rep_votes!==417645||u?.dem_votes!==4068||u?.rep_votes!==1089||
    baseD+u.dem_votes!==t.dem_votes||baseN+u.dem_votes+u.rep_votes!==t.dem_votes+t.rep_votes)throw Error('Unverified Maine first-choice/unallocated baseline');
   referenceD=t.dem_votes;referenceN=t.dem_votes+t.rep_votes;
   // Explicit uncalibrated 5-point round/transfer nuisance, not invented votes.
   roundVariance=(5/200)**2+((u.dem_votes+u.rep_votes)/referenceN/2)**2;
  }
  const baseMargin=100*(2*referenceD/referenceN-1);
  // Display-only diagnostic at the declared PRE-RESULTS race expectation.
  // Weight the exact reporting areas by their counted votes, not whole-state
  // history. Method-order endpoints are scenarios, never confidence limits.
  function describePerformance(expectedMargin){
   if(!Number.isFinite(expectedMargin))throw Error('Missing pre-results expectation');
   const shift=(expectedMargin-baseMargin)/200;
   const units=observed.map(c=>{
    const margins=scenarios.map(rows=>{const row=rows.find(r=>r.county_fips===c.county_fips);
     return 100*(2*(row.aDone*clamp(row.aShare+shift)+row.eDone*clamp(row.eShare+shift))/row.n-1);});
    const observedMargin=100*(2*c.d/c.n-1),low=Math.min(...margins),high=Math.max(...margins);
    return {county:c.county,county_fips:c.county_fips,counted_two_party_votes:c.n,observed_margin_points:observedMargin,
     expected_margin_scenarios:[low,high],difference_margin_scenarios:[observedMargin-high,observedMargin-low]};
   });
   const expected=scenarios.map(rows=>rows.reduce((sum,c)=>sum+c.aDone*clamp(c.aShare+shift)+c.eDone*clamp(c.eShare+shift),0));
   const margins=expected.map(d=>100*(2*d/counted-1)),observedMargin=100*(2*observed.reduce((s,c)=>s+c.d,0)/counted-1);
   return {expectation_scope:'PRE_RESULTS_RACE_MEAN_PLUS_DECLARED_SHIFT',expectation_margin_points:expectedMargin,
    observed_margin_points:observedMargin,expected_margin_scenarios:[Math.min(...margins),Math.max(...margins)],
    difference_margin_scenarios:[observedMargin-Math.max(...margins),observedMargin-Math.min(...margins)],
    baseline_year:envelope.baseline_year,reporting_units:units.length,...(independent?{candidate_contrast:'NE_OSBORN_RICKETTS_V1',positive_candidate:'Osborn',negative_candidate:'Ricketts',historical_transfer:'2024 Osborn/Fischer county support transferred to a different 2026 opponent and Senate seat; assumed, not fitted',directional_transfer_assumption:'Osborn performance informs broader direction through existing shared covariance under an experimental assumption; these are not Democratic votes or caucus credit.'}:{}),
    largest_reporting_units:units.sort((a,b)=>b.counted_two_party_votes-a.counted_two_party_votes||a.county_fips.localeCompare(b.county_fips)).slice(0,6),
    scope:'Matched reporting areas only; historical local shares shifted to the pre-results race expectation, not county polls. Method-mix scenarios are not confidence intervals; partial-batch selection, turnout and source error remain unresolved.',calibrated:false};
  }
  function logLikelihood(margin,{sharedReportingOffset=null}={}){
   if(!Number.isFinite(margin))throw Error('Missing correlated-draw race margin');
   const conditional=sharedReportingOffset!==null;
   if(conditional&&!Number.isFinite(sharedReportingOffset))throw Error('Invalid shared reporting offset');
   const bias=(policy.batch_margin_sigma/200)**2*(conditional?1-policy.shared_reporting_error_variance_fraction:1)+roundVariance;
   const shift=(margin-baseMargin+(sharedReportingOffset||0))/200;
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
   const max=Math.max(...logs);return max+Math.log(remainingVariants?logs.reduce((s,v,i)=>s+remainingVariants[i].weight*Math.exp(v-max),0):logs.reduce((s,v)=>s+Math.exp(v-max),0)/logs.length);
  }
  let remaining=0,remainingLow=0,remainingHigh=0;
  const countedByName=new Map(x.counties.map(c=>[norm(c.county),c[positive]+c[negative]]));
  for(const [name,c] of history){
   const mu=c.aN+c.eN,sd=mu*policy.turnout_sigma_fraction,n=countedByName.get(name)||0,z=(n-mu)/sd;
   const tail=1-cdf(z),density=Math.exp(-z*z/2)/Math.sqrt(2*Math.PI);
   const mills=tail>1e-10?density/tail:Math.max(0,z)+1/Math.max(1,z);
   const mean=Math.max(n,mu+sd*mills),spread=z>6?sd/z:sd*Math.sqrt(Math.max(0,1+z*mills-mills*mills));
   let left=mean-n,low=Math.max(0,mean-1.64*spread-n),high=Math.max(0,mean+1.64*spread-n);
   if(remainingVariants){const fips=[...reference].find(([,key])=>key===name)?.[0];
    const estimates=remainingVariants.map(v=>({left:v.remaining(fips,mu),weight:v.weight})).filter(v=>v.left!==null);
    if(estimates.length){left=.5*left+estimates.reduce((sum,v)=>sum+v.weight*v.left,0);low=Math.min(low,...estimates.map(v=>v.left));high=Math.max(high,...estimates.map(v=>v.left));}
   }
   remaining+=left;remainingLow+=low;remainingHigh+=high;
  }
  return Object.freeze({schema:'national-county-likelihood-v1' ,code,source_url:x.source_url,as_of:x.snapshot_updated_at,
   counted_two_party_votes:counted,reporting_counties:observed.length,...(independent?{candidate_contrast:'NE_OSBORN_RICKETTS_V1',counted_named_candidate_votes:counted}:{}),
   modeled_remaining_two_party_votes:Math.round(remaining),modeled_remaining_two_party_votes_band:[Math.floor(remainingLow),Math.ceil(remainingHigh)],
   ...(remainingMetadata?{official_remaining_sensitivity:remainingMetadata}:{}),...(remainingExclusion?{official_remaining_excluded:remainingExclusion}:{}),
   remaining_scope:remainingMetadata?'Historical/official whole-county estimate sensitivity; Thurston historical only; not exact outstanding ballots or calibrated intervals':scope.firstChoice?'County named-candidate turnout scenario only; excludes statewide unallocated UOCAVA and unreported write-ins; not official ballots outstanding':"Conditional historical-turnout scenario, including unreported district/county parts; not official ballots outstanding",reference_turnout_fraction:counted/baseN,
   independence:'COUNTS_ONLY_NO_POLL_PRIOR_OR_RACE_POSTERIOR',logLikelihood,describePerformance});
 }
 function conditionLegacy(model,basis,envelopes,options={}){
  if(!Array.isArray(envelopes)||envelopes.length>18)throw Error('Bounded national county evidence required');
  if(options.captureCountyDraws||options.replayCountySeeds)throw Error('Nested/replayed national evidence is not a prior');
  const {now=Date.now(),rehearsal=false,...args}=options,compiled=[],excluded=[],codes=new Set();
  if(Object.values(args.live||{}).some(row=>row?.mode!=='source_called'||!['D','R'].includes(row.winnerParty)))
   throw Error('National county conditioning accepts verified-call overrides only, never a race posterior');
  if(rehearsal&&Object.keys(args.live||{}).length)throw Error("Rehearsal cannot use live calls");
  for(const envelope of envelopes){
   const code=envelope?.snapshot?.race_code;
   if(codes.has(code))throw Error('Duplicate race evidence would count the same returns twice');
   codes.add(code);
   try{if(code==='NE-SEN'&&(args.independentSenateCredit!=='no_credit'||basis.senate.find(r=>r.code===code)?.nonrep_independent_proxy!==true))throw Error('Independent evidence requires exact Osborn matchup and no assumed caucus credit');compiled.push(compile(envelope,{now,rehearsal}));}catch(error){excluded.push({code:code||null,reason:error.message});}
  }
  if(!compiled.length){const baseline=model.simulate(basis,args);return {baseline,result:baseline,
   diagnostics:{status:'NO_ELIGIBLE_COUNTY_RETURNS',used:[],excluded,interval_calibrated:false}};}
  const prior=model.simulate(basis,{...args,captureCountyDraws:compiled.map(c=>c.code)});
  const {county_draws:draws,...baseline}=prior,n=prior.samples;
  const sharedSigma=policy.batch_margin_sigma*Math.sqrt(policy.shared_reporting_error_variance_fraction);
  // The conditional likelihood depends only on margin+offset. Tabulate that
  // scalar curve once per race instead of repeating county loops at every node.
  const logs=compiled.map(c=>{const curve=conditionalCurve(c,draws.margins[c.code]);
   return reportingNodes.map(node=>Array.from(draws.margins[c.code],m=>curve(m+node.z*sharedSigma)));
  });
  const totals=new Float64Array(n);
  const stateCounts={};for(const c of compiled)stateCounts[c.code.slice(0,2)]=(stateCounts[c.code.slice(0,2)]||0)+1;
  const stateBudgets=Object.fromEntries(Object.keys(stateCounts).map(state=>[state,Object.keys(scopes).filter(code=>code.startsWith(state+'-')).length]));
  const nodeTotals=reportingNodes.map(()=>new Float64Array(n));
  const stateWeights=Object.fromEntries(Object.keys(stateCounts).map(s=>[s,reportingNodes.map(()=>new Float64Array(n))]));
  for(let j=0;j<logs.length;j++){
   const rows=logs[j],max=Math.max(...rows.map(row=>Math.max(...row))),members=stateBudgets[compiled[j].code.slice(0,2)];
   // One state's observation-error budget is not multiplied by adding districts.
   // Allocate fixed shares of counts-only log likelihoods, never race probabilities.
   // Absent/retracted feeds cannot increase the surviving source shares.
   for(let k=0;k<reportingNodes.length;k++)for(let i=0;i<n;i++){
    const term=Math.log(policy.contamination_floor+(1-policy.contamination_floor)*Math.exp(rows[k][i]-max))/members;
    nodeTotals[k][i]+=term;stateWeights[compiled[j].code.slice(0,2)][k][i]+=term;
   }
  }
  // Integrate the SAME reporting error after combining evidence. Multiplying
  // separately marginalized race likelihoods would falsely make it independent.
  for(let i=0;i<n;i++)totals[i]=logMixture(nodeTotals.map(row=>row[i]));
  const stateRatios=Object.fromEntries(Object.entries(stateWeights).map(([state,rows])=>{
   const mixed=Array.from({length:n},(_,i)=>logMixture(rows.map(row=>row[i])));
   return [state,Math.exp(Math.max(...mixed)-Math.min(...mixed))];
  }));
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
   used:compiled.map(({logLikelihood,describePerformance,...row})=>{
    const seat=basis.house.concat(basis.senate).find(r=>r.code===row.code);
    return {...row,matched_performance:describePerformance(seat.mean+(args.nationalShift||0))};
   }),excluded,effective_sample_size:weighted.ess,
   particle_count:n,likelihood_power:power,policy,state_likelihood_sources:stateCounts,state_likelihood_budget_members:stateBudgets,state_likelihood_max_ratio:stateRatios,house_vote_sources:compiled.filter(c=>scopes[c.code].house).length,
   reporting_error:{scope:'SHARED_ACROSS_ADMITTED_RACES',total_batch_margin_sigma:policy.batch_margin_sigma,
    shared_margin_sigma:sharedSigma,race_specific_margin_sigma:policy.batch_margin_sigma*Math.sqrt(1-policy.shared_reporting_error_variance_fraction),
    quadrature_nodes:reportingNodes.length,curve_step_margin_points:policy.reporting_curve_step_margin_points,calibrated:false},
   house_vote_states:[...new Set(compiled.filter(c=>scopes[c.code].house).map(c=>c.code.slice(0,2)))].sort(),
   house_transfer:compiled.some(c=>scopes[c.code].house)?'Observed limited House district parts; other House movement uses existing shared-error covariance, not national House coverage':'Existing declared shared national-error covariance only; no observed House votes in this county path',
   interval_calibrated:false,independent_historical_calibration:false,
   delta_percentage_points:Object.fromEntries(Object.keys(result.probabilities).map(k=>[k,+(result.probabilities[k]-baseline.probabilities[k]).toFixed(2)]))};
  result.county_results_update=diagnostics;
  return {baseline,result,diagnostics};
 }
 // The no-call coordinator above remains the exact legacy algorithm. Calls use
 // a typed RAW proposal, never its unweighted headline, and freeze the county
 // target against that original no-call population before changing proposal.
 const callFailure=error=>typeof error?.code==='string'&&/^[A-Z0-9_]{1,100}$/.test(error.code)?error.code:'CALL_COUNT_CONDITIONING_FAILED';
 const failCall=code=>{const error=Error(code);error.code=code;throw error;};
 const supportMetadata=support=>Object.fromEntries(Object.entries(support||{}).filter(([key])=>key!=='weights'));
 function countCallTarget(compiled,referenceDraws,proposal,budgets){
  const n=proposal.samples,sharedSigma=policy.batch_margin_sigma*Math.sqrt(policy.shared_reporting_error_variance_fraction);
  const normalizers=[],curves=[];
  for(const c of compiled){
   const reference=referenceDraws.margins[c.code],current=proposal.county_draws.margins[c.code];
   if(reference?.length!==n||current?.length!==n)failCall('CALL_COUNT_MARGIN_POPULATION_MISMATCH');
   const referenceCurve=conditionalCurve(c,reference);let maximum=-Infinity,low=Infinity,high=-Infinity;
   for(const margin of reference){
    if(!Number.isFinite(margin))failCall('NONFINITE_ORIGINAL_COUNT_REFERENCE');
    low=Math.min(low,margin);high=Math.max(high,margin);
    for(const node of reportingNodes)maximum=Math.max(maximum,referenceCurve(margin+node.z*sharedSigma));
   }
   for(const margin of current){if(!Number.isFinite(margin))failCall('NONFINITE_CALL_PROPOSAL_MARGIN');low=Math.min(low,margin);high=Math.max(high,margin);}
   if(!Number.isFinite(maximum))failCall('NONFINITE_FROZEN_COUNT_NORMALIZER');
   normalizers.push(maximum);curves.push(conditionalCurve(c,[low,high]));
  }
  const totals=new Float64Array(n),nodes=new Float64Array(reportingNodes.length),states=Object.keys(budgets);
  const perState=Object.fromEntries(states.map(state=>[state,new Float64Array(reportingNodes.length)]));
  const extrema=Object.fromEntries(states.map(state=>[state,{minimum:Infinity,maximum:-Infinity}]));
  for(let i=0;i<n;i++){
   nodes.fill(0);for(const values of Object.values(perState))values.fill(0);
   for(let k=0;k<reportingNodes.length;k++)for(let j=0;j<compiled.length;j++){
    const c=compiled[j],state=c.code.slice(0,2),members=budgets[state];
    if(!Number.isInteger(members)||members<1)failCall('INVALID_FIXED_COUNT_STATE_BUDGET');
    const raw=curves[j](proposal.county_draws.margins[c.code][i]+reportingNodes[k].z*sharedSigma);
    if(!Number.isFinite(raw))failCall('NONFINITE_CALL_COUNT_LIKELIHOOD');
    // The cap defines the same fixed bounded continuation for EVERY proposal.
    // On the original reference support it is inactive. Never refit its maximum.
    const factor=policy.contamination_floor+(1-policy.contamination_floor)*Math.exp(Math.min(0,raw-normalizers[j]));
    if(factor<policy.contamination_floor||factor>1)failCall('CALL_COUNT_ROBUST_BOUND_FAILED');
    const term=Math.log(factor)/members;nodes[k]+=term;perState[state][k]+=term;
   }
   totals[i]=logMixture(nodes);
   for(const state of states){const value=logMixture(perState[state]);extrema[state].minimum=Math.min(extrema[state].minimum,value);extrema[state].maximum=Math.max(extrema[state].maximum,value);}
  }
  const stateCounts=Object.fromEntries(states.map(state=>[state,compiled.filter(c=>c.code.startsWith(state+'-')).length]));
  const ratios=Object.fromEntries(states.map(state=>[state,Math.exp(extrema[state].maximum-extrema[state].minimum)]));
  const bounds=Object.fromEntries(states.map(state=>[state,Math.pow(1/policy.contamination_floor,stateCounts[state]/budgets[state])]));
  if(states.some(state=>ratios[state]>bounds[state]*(1+1e-10)||bounds[state]>1/policy.contamination_floor*(1+1e-10)))failCall('CALL_COUNT_STATE_BUDGET_BOUND_FAILED');
  return {totals,ratios,bounds};
 }
 function conditionCalls(model,basis,envelopes,options={}){
  if(!Array.isArray(envelopes)||envelopes.length>18)throw Error('Bounded national county evidence required');
  if(options.captureCountyDraws||options.replayCountySeeds)throw Error('Nested/replayed national evidence is not a prior');
  const {now=Date.now(),rehearsal=false,...supplied}=options,args={...supplied,independentSenateCredit:supplied.independentSenateCredit??'no_credit'};
  if(Object.values(args.live||{}).some(row=>row?.mode!=='source_called'||!['D','R'].includes(row.winnerParty)))throw Error('National county conditioning accepts verified-call overrides only, never a race posterior');
  if(rehearsal&&Object.keys(args.live||{}).length)throw Error('Rehearsal cannot use live calls');
  // Identity/policy errors are not numeric-support failures. They must not turn
  // an unsupported axis (especially an Independent) into winner accounting.
  const polls=basis?.house?.concat(basis.senate||[],basis.governors||[])||[],byCode=new Map(polls.map(row=>[row.code,row]));
  for(const [code,call] of Object.entries(args.live||{}))if(!byCode.has(code)||(byCode.get(code).nonrep_independent_proxy===true&&call.winnerParty==='D'))throw Error('Unsupported existing source-call identity or Independent axis');
  if(args.independentSenateCredit!=='no_credit')throw Error('Source-call covariance requires the existing no_credit policy');
  sourceCalls?.validateExistingCallContract?.(basis,args);
  // In-memory only: private numeric inputs must never enter a receipt/cache
  // key returned to the caller. Do not mix a captured reference with changed
  // basis, calls, options or source envelopes if an integration mutates them.
  const inputFingerprint=JSON.stringify([basis,args,envelopes]);
  const unchangedInputs=()=>JSON.stringify([basis,args,envelopes])===inputFingerprint;
  const compiled=[],codes=new Set();
  for(const envelope of envelopes){
   const code=envelope?.snapshot?.race_code;if(codes.has(code))throw Error('Duplicate race evidence would count the same returns twice');codes.add(code);
   try{if(code==='NE-SEN'&&(args.independentSenateCredit!=='no_credit'||basis.senate.find(r=>r.code===code)?.nonrep_independent_proxy!==true))throw Error('Independent evidence requires exact Osborn matchup and no assumed caucus credit');compiled.push(compile(envelope,{now,rehearsal}));}catch{}
  }
  let originalDraws=null,originalResampledStates=null;
  const originalModel={simulate(priorBasis,priorOptions){
   const output=model.simulate(priorBasis,priorOptions);
   if(priorOptions.captureCountyDraws)originalDraws=output.county_draws;
   if(priorOptions.replayCountySeeds)originalResampledStates=Uint32Array.from(priorOptions.replayCountySeeds);
   return output;
  }};
  // This exact old coordinator defines source exclusions, normalizers' original
  // population, fixed state shares and count-only alpha. No calls contaminate
  // the baseline; the source input is compiled identically in both paths.
  const reference=conditionLegacy(originalModel,basis,envelopes,{...args,now,rehearsal,live:{}}),baseline=reference.baseline;
  const referenceCodes=(reference.diagnostics.used||[]).map(row=>row.code);
  if(JSON.stringify(referenceCodes)!==JSON.stringify(compiled.map(c=>c.code)))failCall('COUNT_CALL_SOURCE_COMPILATION_MISMATCH');
  const n=baseline.samples,alpha=compiled.length?reference.diagnostics.likelihood_power:1;
  const referencePolicy={definition:'FROZEN_NO_CALL_REFERENCE_CAPPED_ROBUST_CONTINUATION',reference_particle_count:n,reference_normalizers_frozen:true,
   county_likelihood_power:alpha,call_likelihood_power:1,contamination_floor:policy.contamination_floor,
   state_likelihood_budget_unchanged:true,maximum_state_likelihood_ratio:1/policy.contamination_floor,
   shared_reporting_nodes:reportingNodes.length,curve_step_margin_points:policy.reporting_curve_step_margin_points,curve_node_cap:10000,
   county_likelihood_applied_once:true,call_weights_tempered:false,interval_calibrated:false};
  const diagnosticsFor=(result,{status,support=null,target=null,reason=null}={})=>({
   ...reference.diagnostics,status,baseline_kind:'NO_CALL_NO_COUNT_POLLING_BASELINE',
   county_status:reference.diagnostics.status,source_call_conditioning:result.source_call_conditioning,
   conditioned_call_covariance_applied:result.source_call_conditioning?.status==='CONDITIONED',
   call_conditioning_reason:reason,call_support:supportMetadata(support),
   ...(support?.status==='SUPPORTED'?{effective_sample_size:support.effective_sample_size,particle_count:n}:{}),
   ...(compiled.length?{county_effective_sample_size:reference.diagnostics.effective_sample_size,count_target:referencePolicy,
    ...(target?{state_likelihood_max_ratio:target.ratios,state_likelihood_ratio_bound:target.bounds}:{})}:{}),
   interval_calibrated:false,independent_historical_calibration:false,
   delta_percentage_points:Object.fromEntries(Object.keys(result.probabilities).map(key=>[key,+(result.probabilities[key]-baseline.probabilities[key]).toFixed(2)]))
  });
  const fallback=(reason,support=null)=>{
   if(!unchangedInputs())failCall('CALL_MODEL_INPUT_CHANGED_DURING_CONDITIONING');
   const fallbackOptions={...args,...(originalResampledStates?{replayCountySeeds:originalResampledStates}:{})};
   const result=typeof model.simulateWinnerAccountingFallback==='function'?model.simulateWinnerAccountingFallback(basis,fallbackOptions,{reason}):model.simulate(basis,fallbackOptions);
   result.source_call_conditioning={...(result.source_call_conditioning||{}),schema:'source-call-conditioning-v1',status:'WITHHELD',reason,
    evidence_kind:'VALIDATED_WINNER_ACCOUNTING_WITHOUT_CALL_COVARIANCE',baseline_kind:'NO_CALL_NO_COUNT_POLLING_BASELINE',
    conditioned_covariance_applied:false,validated_winner_accounting_preserved:true,call_weights_tempered:false,interval_calibrated:false};
   const diagnostics=diagnosticsFor(result,{status:compiled.length?'EXPERIMENTAL_COUNTY_OUTLOOK_CALL_COVARIANCE_WITHHELD':'VALIDATED_WINNER_ACCOUNTING_CALL_COVARIANCE_WITHHELD',reason,support});
   result.county_results_update=diagnostics;return {baseline,result,diagnostics};
  };
  let stage='CALL_PROPOSAL',support=null;
  try{
   if(typeof model.proposeSourceCallElections!=='function'||typeof model.finalizeSourceCallElections!=='function')return fallback('CALL_PROPOSAL_API_UNAVAILABLE');
   const packet=model.proposeSourceCallElections(basis,{...args,...(compiled.length?{captureCountyDraws:referenceCodes}:{})});
   if(!unchangedInputs())failCall('CALL_MODEL_INPUT_CHANGED_DURING_CONDITIONING');
   if(packet?.schema!=='raw-source-call-proposal-v1'||packet.status!=='RAW_PROPOSAL_NOT_A_FORECAST'||packet.proposal_only!==true||packet.has_usable_headline_probabilities!==false||
      packet.samples!==n||packet.seed!==baseline.seed||packet.seeds?.length!==n||packet.call_log_weights?.length!==n||packet.context_key!==(args.contextKey??'UNSPECIFIED')||
      ['probabilities','counts','race_probabilities'].some(key=>Object.hasOwn(packet,key)))failCall('INVALID_OR_CROSS_CONTEXT_RAW_CALL_PACKET');
   if(compiled.length&&(!originalDraws||JSON.stringify(packet.county_draws?.codes)!==JSON.stringify(referenceCodes)))failCall('CALL_COUNT_CAPTURE_SCOPE_MISMATCH');
   stage='CALL_COUNT_TARGET';
   const target=compiled.length?countCallTarget(compiled,originalDraws,packet,reference.diagnostics.state_likelihood_budget_members):null;
   // Only the engine-owned finalizer can apply private original call weights,
   // enforce the hard combined ESS floor, resample and replay. Caller-selected
   // unweighted seeds can never be promoted into a conditioned headline.
   stage='CALL_WHOLE_ELECTION_FINALIZATION';
   if(!unchangedInputs())failCall('CALL_MODEL_INPUT_CHANGED_DURING_CONDITIONING');
   const finalized=model.finalizeSourceCallElections(packet,{
    countyLogLikelihood:target?target.totals:null,countyLikelihoodPower:target?alpha:null,
    conditioning:compiled.length?'CALL_AND_COUNTY_IMPORTANCE_RESAMPLED':'VALIDATED_CALL_IMPORTANCE_RESAMPLED',
    contextKey:args.contextKey??'UNSPECIFIED'});
   support=finalized?.support||null;
   if(finalized?.status==='WITHHELD')return fallback(finalized.reason||support?.status||'CALL_SUPPORT_WITHHELD',support);
   if(finalized?.status!=='CONDITIONED'||support?.status!=='SUPPORTED')failCall('INVALID_FINALIZED_CALL_RESULT');
   const result=finalized.result;
   if(result?.source_call_conditioning?.status!=='CONDITIONED')failCall('MISSING_CONDITIONED_CALL_FINALIZATION_METADATA');
   result.source_call_conditioning={...result.source_call_conditioning,...supportMetadata(support),status:'CONDITIONED',
    count_target:compiled.length?referencePolicy:null};
   const diagnostics=diagnosticsFor(result,{status:compiled.length?'EXPERIMENTAL_CALL_AND_COUNTY_RESULTS_INFORMED_NATIONAL_OUTLOOK':'EXPERIMENTAL_VALIDATED_CALLS_CONDITIONED_NATIONAL_OUTLOOK',support,target});
   result.county_results_update=diagnostics;return {baseline,result,diagnostics};
  }catch(error){return fallback(typeof error?.code==='string'?callFailure(error):stage+'_FAILED',support);}
 }
 function condition(model,basis,envelopes,options={}){
  return Object.values(options.live||{}).some(row=>row?.mode==='source_called')?conditionCalls(model,basis,envelopes,options):conditionLegacy(model,basis,envelopes,options);
 }

 return Object.freeze({compile,condition,policy,normalQuadrature,conditionalCurve});
});
