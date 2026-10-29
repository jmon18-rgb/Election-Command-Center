'use strict';
const assert=require('node:assert/strict'),moduleApi=require('./source_call_conditioning.js');
const {normalCDF:cdf,normalLogCDF:logcdf,normalInverseLogCDF:inverse,
 truncateToCalledSign:truncate,allocateWithoutReplacement:allocate}=moduleApi;
const close=(actual,expected,tolerance=2e-11)=>assert(Math.abs(actual-expected)<=tolerance,actual+' != '+expected);
const fails=(fn,code)=>assert.throws(fn,error=>error.name==='SourceCallConditioningError'&&error.code===code);

// Golden values independently obtained from Python erfc/NormalDist. These are
// numerical tests, not forecast-error widths or probability calibration.
for(const [x,want] of [[-30,-454.3212439563431],[-15,-116.1313848457117],
 [-8,-35.01343715991455],[-3,-6.60772622151035],[-1,-1.8410216450092634],[0,-.6931471805599453]])close(logcdf(x),want);
for(const [p,want] of [[1e-200,-30.20559417957964],[1e-20,-9.262340089798407],
 [.1,-1.2815515655446004],[.5,0],[.9,1.2815515655446004]])close(inverse(Math.log(p)),want);
for(const logp of [-1000,-700,-100,-10,-1,-.1,-1e-10])close(logcdf(inverse(logp)),logp,2e-10);
for(const x of [-15,-8,-3,-1,0,1,3,8,15])close(cdf(x)+cdf(-x),1,2e-14);
for(const mean of [-50,-10,0,10,50])for(const sigma of [2,6])for(const sign of [-1,1])for(const rawLocal of [-7,-3,0,3,7]){
 const draw=truncate(mean,sigma,sign,rawLocal);assert(sign*draw.margin>0);
 close(draw.logProbability,logcdf(sign*mean/sigma));
 // Survival probability of the resulting positive-side residual equals U*q.
 const y=sign*draw.margin;close(logcdf(-(y-sign*mean)/sigma),logcdf(rawLocal)+draw.logProbability,3e-10);
}
fails(()=>inverse(0),'INVALID_INVERSE_NORMAL_PROBABILITY');
fails(()=>logcdf(NaN),'NONFINITE_NORMAL_ARGUMENT');
fails(()=>truncate(0,0,1,0),'UNSUPPORTED_CALLED_LOCAL_NORMAL');

function permutations(items){if(items.length===0)return [[]];return items.flatMap((x,i)=>permutations(items.filter((_,j)=>i!==j)).map(tail=>[x,...tail]));}
const factorial=n=>n<2?1:n*factorial(n-1);
function midpointForSlot(remaining,slot,table){
 const weights=remaining.map(id=>table[id]),sum=weights.reduce((s,x)=>s+x,0),index=remaining.indexOf(slot);
 assert(index>=0);return (weights.slice(0,index).reduce((s,x)=>s+x,0)+weights[index]/2)/sum;
}
const values=[0,0,10,20],signs=[1,0,-1,0],table={0:[.1,.3,.6,.9],2:[.8,.2,.5,.7]};
let proposalTotal=0,targetTotal=0,weightedTotal=0,rightMoment=0,wrongMoment=0,rightMass=0,wrongMass=0;
for(const assignment of permutations([0,1,2,3])){
 const remain=[0,1,2,3],first=assignment[0],second=assignment[2];
 const u0=midpointForSlot(remain,first,table[0]);
 const p0=table[0][first]/remain.reduce((s,id)=>s+table[0][id],0);remain.splice(remain.indexOf(first),1);
 const u1=midpointForSlot(remain,second,table[2]);
 const p1=table[2][second]/remain.reduce((s,id)=>s+table[2][id],0);remain.splice(remain.indexOf(second),1);
 const u2=assignment[1]===remain[1]?.75:.25;
 const out=allocate(values,signs,[u0,u1,u2],(seat,value,id)=>Math.log(table[seat][id]));
 assert.deepEqual(Array.from(out.slots),assignment,'Canonical called allocation and remaining-uniform permutation');
 assert.equal(out.uniformsConsumed,3);
 const proposal=p0*p1/2,prior=1/24,calledLikelihood=table[0][first]*table[2][second];
 close(Math.exp(out.logPriorMinusProposal),prior/proposal,2e-14);
 proposalTotal+=proposal;targetTotal+=prior*calledLikelihood;
 const corrected=proposal*Math.exp(out.logPriorMinusProposal)*calledLikelihood;
 weightedTotal+=corrected;rightMass+=corrected;rightMoment+=corrected*values[assignment[1]];
 const duplicated=corrected*calledLikelihood;wrongMass+=duplicated;wrongMoment+=duplicated*values[assignment[1]];
}
close(proposalTotal,1,2e-14);close(targetTotal,weightedTotal,2e-14);
assert(Math.abs(rightMoment/rightMass-wrongMoment/wrongMass)>.01,
 'Exact target check must distinguish duplicating called likelihood after p/q correction');
// All-uncalled F-Y consumes exactly n-1 original uniforms and yields each indexed
// permutation, including duplicate numeric values, with its original uniform law.
const seen=new Set();
for(let a=0;a<4;a++)for(let b=0;b<3;b++)for(let c=0;c<2;c++){
 const uniforms=[(a+.5)/4,(b+.5)/3,(c+.5)/2],out=allocate(values,[0,0,0,0],uniforms,()=>{throw Error('Uncalled probability must not be requested');});
 seen.add(Array.from(out.slots).join(','));close(out.logPriorMinusProposal,0);assert.equal(out.uniformsConsumed,3);
 const bag=[0,1,2,3];for(let i=3,cursor=0;i>0;i--){const pick=Math.floor(uniforms[cursor++]*(i+1));[bag[i],bag[pick]]=[bag[pick],bag[i]];}
 assert.deepEqual(Array.from(out.slots),[bag.pop(),bag.pop(),bag.pop(),bag.pop()]);
}assert.equal(seen.size,24);
for(const target of permutations([0,1,2])){
 const tables=[[.2,.4,.9],[.8,.3,.1],[.4,.6,.2]],remaining=[0,1,2],uniforms=[];let q=1;
 for(let seat=0;seat<3;seat++){
  const id=target[seat],denominator=remaining.reduce((s,j)=>s+tables[seat][j],0);q*=tables[seat][id]/denominator;
  if(remaining.length>1)uniforms.push(midpointForSlot(remaining,id,tables[seat]));remaining.splice(remaining.indexOf(id),1);
 }
 const out=allocate([1,2,3],[1,-1,1],uniforms,(seat,value,id)=>Math.log(tables[seat][id]));
 assert.deepEqual(Array.from(out.slots),target);assert.equal(out.uniformsConsumed,2);
 close(Math.exp(out.logPriorMinusProposal),(1/factorial(3))/q,1e-14);
}
fails(()=>allocate([1,2],[1,0],[1],()=>0),'INVALID_INDEXED_REDRAW_ALLOCATION');
fails(()=>allocate([1,2],[1,0],[.5],()=>1),'INVALID_ALLOCATION_SIGN_PROBABILITY');
fails(()=>allocate([1,2],[1,0],[.5],(seat,value,id)=>id===0?-1000:0),'ALLOCATION_PROPOSAL_LOST_NUMERICAL_SUPPORT');

const states=['IA','TX','CA','VA','OH','ME'];
const row=(code,state,i)=>({code,state,mean:(i%5)-2,sigma:5,method:'fictional',redrawn_mix_weight:0,redrawn_state_center:null});
const house=Array.from({length:435},(_,i)=>row('FH-'+i,states[i%states.length],i));
house[0]={...row('VA-FICTION-01','VA',0),redrawn_mix_weight:1,redrawn_state_center:2,method:'redrawn_state_distribution_proxy'};
house[1]={...row('VA-FICTION-02','VA',1),redrawn_mix_weight:.25,redrawn_state_center:2,method:'poll_blend_redrawn_state_distribution_proxy'};
house[2]={...row('VA-FICTION-03','VA',2),redrawn_mix_weight:1,redrawn_state_center:2,method:'redrawn_state_distribution_proxy'};
const senate=Array.from({length:35},(_,i)=>row('FS-'+i,states[i%states.length],i));
senate[0]=row('IA-SEN','IA',0);senate[0].mean=0;
senate[1]={...row('NE-SEN','NE',1),nonrep_independent_proxy:true};
senate[2]={...row('SD-SEN','SD',2),nonrep_independent_proxy:true};
const basis={house,senate,governors:Array.from({length:6},(_,i)=>row('FG-'+i,states[i],i)),
 redrawn_state_distributions:{VA:[-12,0,8]},assumptions:{common_national_sigma:2,
 house_chamber_sigma:3,senate_chamber_sigma:3.5,governor_chamber_sigma:4,
 state_house_sigma:4,state_senate_sigma:3,state_governor_sigma:2,redrawn_state_additional_sigma:5}};
const all=basis.house.concat(basis.senate,basis.governors);
function rawFor(basis,options={}){
 const shift=options.nationalShift??0,m=options.errorMultiplier??1,corr=options.senateCorrelationResearch;
 const a=basis.assumptions,items=basis.house.concat(basis.senate,basis.governors),shared={N:.2,H:-.3,S:.4,G:-.1,states:new Map([...states,'NE','SD'].map((s,i)=>[s,(i-3)*.13]))};
 const locals=Float64Array.from(items,(_,i)=>Math.sin(i*.31)),redraws=new Float64Array(items.length),uniforms=new Map([['VA',[.25,.8]]]);
 const original=allocate(basis.redrawn_state_distributions.VA,[0,0,0],uniforms.get('VA'),()=>0).values;
 [0,1,2].forEach((index,i)=>redraws[index]=(original[i]-items[index].redrawn_state_center)*items[index].redrawn_mix_weight);
 const margins=Float64Array.from(items,(r,i)=>{
  const h=i<435,s=i>=435&&i<470;
  const national=a.common_national_sigma*(s?(corr?.nationalScale??1):1)*shared.N*m;
  const office=(h?a.house_chamber_sigma*shared.H:s?a.senate_chamber_sigma*(corr?.chamberScale??1)*shared.S:a.governor_chamber_sigma*shared.G)*m;
  const state=(h?a.state_house_sigma+(r.method.includes('redrawn_')?a.redrawn_state_additional_sigma:0):s?a.state_senate_sigma:a.state_governor_sigma)*(shared.states.get(r.state)||0)*m;
  const extra=s&&corr?a.common_national_sigma**2*(1-corr.nationalScale**2)+a.senate_chamber_sigma**2*(1-corr.chamberScale**2):0;
  return r.mean+shift+redraws[i]+national+office+state+Math.sqrt(r.sigma**2+extra)*m*locals[i];
 });
 return {margins,localNormals:locals,redrawMargins:redraws,sharedNormals:shared,redrawUniforms:uniforms};
}
const calls={'IA-SEN':{mode:'source_called',winnerParty:'D'},'VA-FICTION-01':{mode:'source_called',winnerParty:'D'},'VA-FICTION-02':{mode:'source_called',winnerParty:'R'}};
assert.equal(moduleApi.prepare(basis,{live:{}}),null);
const plan=moduleApi.prepare(basis,{live:calls,contextKey:'PUBLIC'}),raw=rawFor(basis);
const before=Array.from(raw.margins),first=plan.transport(raw),saved=Array.from(first.margins),savedWeight=first.logWeight;
assert(saved[0]>0&&saved[1]<0&&saved[435]>0);assert.deepEqual(Array.from(raw.margins),before);
fails(()=>plan.transport({...raw,margins:first.margins}),'TRANSPORT_REQUIRES_ORIGINAL_ELECTION');
const reversed=moduleApi.prepare(basis,{live:Object.fromEntries(Object.entries(calls).reverse()),contextKey:'PUBLIC'}).transport(raw);
assert.deepEqual(Array.from(reversed.margins),saved);assert.equal(reversed.logWeight,savedWeight,'Call input-map order cannot change proposal');
for(const options of [{errorMultiplier:.6,nationalShift:-2},{errorMultiplier:1.7,nationalShift:4},
 {senateCorrelationResearch:{nationalScale:.5,chamberScale:.7}}]){
 const p=moduleApi.prepare(basis,{...options,live:calls}),x=p.transport(rawFor(basis,options));
 assert(x.margins[0]>0&&x.margins[1]<0&&x.margins[435]>0);assert(Number.isFinite(x.logWeight));
}
// Exact zero-shared-factor comparison: only the declared permutation and local
// truncations can change; q and p/q have an independently calculable product.
const independent=structuredClone(basis);for(const key of Object.keys(independent.assumptions))independent.assumptions[key]=0;
const independentCalls={'VA-FICTION-01':calls['VA-FICTION-01'],'VA-FICTION-02':calls['VA-FICTION-02']};
const r=rawFor(independent),p=moduleApi.prepare(independent,{live:independentCalls}),x=p.transport(r);
const bag=independent.redrawn_state_distributions.VA;
// Independent finite-law oracle: with one D call, one R call and one uncalled
// seat, the future partition is simply the sum of the other R probabilities.
// The grouped look-ahead is exact for these two singleton called groups.
const score=(seat,value,sign)=>Math.exp(logcdf(sign*(independent.house[seat].mean+(value-2)*independent.house[seat].redrawn_mix_weight)/5)),
 remaining=[0,1,2],picked=[],sums=[],probabilities=[];
for(let seat=0;seat<2;seat++){
 const weights=remaining.map(id=>score(seat,bag[id],seat===0?1:-1)*(seat===0?remaining.filter(other=>other!==id).reduce((sum,other)=>sum+score(1,bag[other],-1),0):1)),
  total=weights.reduce((sum,value)=>sum+value,0),u=[.25,.8][seat];let c=0,index=weights.length-1;
 for(let j=0;j<weights.length;j++){c+=weights[j]/total;if(u<c){index=j;break;}}
 probabilities.push(weights[index]/total);sums.push(remaining.length);picked.push(remaining.splice(index,1)[0]);
}
picked.push(remaining[0]);
const assignment={values:Float64Array.from(picked,id=>bag[id]),logPriorMinusProposal:-Math.log(sums[0])-Math.log(sums[1])-Math.log(probabilities[0])-Math.log(probabilities[1])};
const independentlyEnumeratedEvidence=permutations([0,1,2]).reduce((sum,slots)=>sum+score(0,bag[slots[0]],1)*score(1,bag[slots[1]],-1),0)/6;
close(assignment.logPriorMinusProposal+Math.log(score(0,assignment.values[0],1))+Math.log(score(1,assignment.values[1],-1)),Math.log(independentlyEnumeratedEvidence));
let expectedLog=assignment.logPriorMinusProposal;
for(let i=0;i<3;i++){
 const row=independent.house[i],mean=row.mean+(assignment.values[i]-row.redrawn_state_center)*row.redrawn_mix_weight;
 if(i<2){const q=truncate(mean,5,i===0?1:-1,r.localNormals[i]);close(x.margins[i],q.margin);expectedLog+=q.logProbability;}
 else close(x.margins[i],mean+5*r.localNormals[i]);
}
close(x.logWeight,expectedLog);for(let i=3;i<all.length;i++)close(x.margins[i],r.margins[i]);

const cache=moduleApi.createCache({maximumEntries:2});
const cached=cache.prepare(basis,{live:calls,contextKey:'PUBLIC'});
assert.strictEqual(cache.prepare(basis,{live:Object.fromEntries(Object.entries(calls).reverse()),contextKey:'PUBLIC'}),cached);
assert.notStrictEqual(cache.prepare(basis,{live:calls,contextKey:'LOCAL_RESEARCH_VARIANT'}),cached);
basis.senate[0].mean=31.23456789;
const changed=cache.prepare(basis,{live:calls,contextKey:'PUBLIC'});assert.notStrictEqual(changed,cached);
assert(!JSON.stringify(changed).includes('31.23456789'),'Prepared public diagnostics cannot serialize private numeric basis');
assert(cache.stats().entries<=2);cache.clear();assert.equal(cache.stats().entries,0);
fails(()=>moduleApi.createCache({maximumEntries:17}),'INVALID_CALL_PROPOSAL_CACHE_BOUND');
fails(()=>moduleApi.prepare(basis,{live:{UNKNOWN:{mode:'source_called',winnerParty:'D'}}}),'UNSUPPORTED_EXISTING_CALL_CONTRACT');
fails(()=>moduleApi.prepare(basis,{live:{'NE-SEN':{mode:'source_called',winnerParty:'D'}}}),'INDEPENDENT_WIN_CANNOT_BE_RELABELLED_DEMOCRATIC');
fails(()=>moduleApi.prepare(basis,{live:calls,independentSenateCredit:'dem_proxy'}),'INDEPENDENT_CREDIT_POLICY_UNSUPPORTED');
fails(()=>moduleApi.prepare(basis,{live:calls,errorMultiplier:.5}),'UNSUPPORTED_MODEL_SENSITIVITY');
const arrayCorrelation=[];arrayCorrelation.nationalScale=.5;arrayCorrelation.chamberScale=.7;
fails(()=>moduleApi.prepare(basis,{live:calls,senateCorrelationResearch:arrayCorrelation}),'UNSUPPORTED_RESEARCH_CORRELATION');
const invalid=structuredClone(basis);invalid.senate[0].sigma=0;
fails(()=>moduleApi.prepare(invalid,{live:{'IA-SEN':calls['IA-SEN']}}),'DEGENERATE_CALLED_LOCAL_ERROR_UNSUPPORTED');
const diagnostic=moduleApi.failureDiagnostic(new Error('private secret31.23456789'));
assert.equal(diagnostic.reason,'UNEXPECTED_CALL_CONDITIONING_FAILURE');assert(!JSON.stringify(diagnostic).includes('31.23456789'));
assert.equal(diagnostic.validated_winner_accounting_must_be_preserved,true);

const uniform=moduleApi.assessLogWeights(Array(300).fill(1000));
assert.equal(uniform.status,'SUPPORTED');close(uniform.effective_sample_size,300,1e-9);
const low=moduleApi.assessLogWeights([0,...Array(299).fill(-10)]);
assert.equal(low.status,'WITHHELD_LOW_EFFECTIVE_SAMPLE_SUPPORT');assert.equal(low.weights,undefined);
assert.equal(moduleApi.assessLogWeights(Array(300).fill(-Infinity)).status,'WITHHELD_ZERO_PARTICLE_SUPPORT');
assert.equal(moduleApi.assessLogWeights([-1000,...Array(299).fill(0)]).status,'WITHHELD_NUMERICAL_WEIGHT_UNDERFLOW');
fails(()=>moduleApi.assessLogWeights(Array(300).fill(0),{minimumFraction:.1}),'CALL_ESS_FLOOR_CANNOT_BE_CHANGED');
fails(()=>moduleApi.assessLogWeights(new DataView(new ArrayBuffer(300))),'INVALID_CALL_IMPORTANCE_WEIGHTS');
const supported=moduleApi.assessLogWeights(Array.from({length:300},(_,i)=>i<150?Math.log(2):0));
const seeds=Uint32Array.from({length:300},(_,i)=>i+1),selected=moduleApi.resampleWholeElectionStates(seeds,supported);
for(let i=0;i<300;i++)assert.equal(selected.seeds[i],seeds[selected.source_indices[i]]);
assert(selected.unique_election_particles<300&&selected.unique_election_particles>150);
fails(()=>moduleApi.resampleWholeElectionStates(Uint32Array.from({length:300},()=>1),uniform),'INVALID_OR_DUPLICATED_PRIOR_STATES');
fails(()=>moduleApi.resampleWholeElectionStates(seeds,{status:'SUPPORTED',weights:Float64Array.from({length:300},(_,i)=>Number(i===0))}),'RESAMPLING_CANNOT_BYPASS_ESS_FLOOR');
console.log('Conditional-call candidate units PASS: independent normal probes, exact indexed allocation law/duplicates/remaining uniform permutations, p/q once, canonical calls, shared sensitivities, cache mutation/context bounds, Independent exclusion and hard finalESS/resampling guards. No predictive-calibration claim.');
