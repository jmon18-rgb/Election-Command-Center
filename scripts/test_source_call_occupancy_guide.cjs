'use strict';
// Independent finite laws and numerical/replay evidence for the private
// one-root allocation proposal. All values are fictional. This is not source
// delivery, empirical forecast calibration or a device-speed guarantee.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{createRequire}=require('node:module'),root=path.resolve(__dirname,'..'),scriptRoot=__dirname,file=path.join(__dirname,'source_call_conditioning.js'),source=fs.readFileSync(file,'utf8'),publicHelper=require('./source_call_conditioning.js'),mod={exports:{}};
let api,stageObserver=null;
const once=(text,before,after)=>{assert.equal(text.split(before).length,2,'Unique test-only private source hook');return text.replace(before,after);};
let compiled=once(source,'module.exports={allocateCalledLookahead};','module.exports={allocateCalledLookahead,stage};');
compiled=once(compiled,'const recordGuide=()=>{};','const recordGuide=()=>{};capture({allocate:lookahead.allocateCalledLookahead,allocateCalledLookahead:lookahead.allocateCalledLookahead,stage:lookahead.stage,guide:occupancyGuide});');
compiled=once(compiled,'const reduceGuide=counts[0]>1&&counts[1]>1&&counts[2]>1;let guideCounts=counts;','const reduceGuide=counts[0]>1&&counts[1]>1&&counts[2]>1;observeStage(sign,counts,reduceGuide);let guideCounts=counts;');
new Function('module','exports','capture','observeStage',compiled)(mod,mod.exports,value=>api=value,(...args)=>stageObserver?.(...args));
const helper=mod.exports;assert.deepEqual(Object.keys(helper),Object.keys(publicHelper),'Test hooks never add a production API');
let solves=0,transports=0;const originalSolve=api.guide.solve,originalCountOdds=api.guide.countOdds;
api.guide.solve=(...args)=>{solves++;return originalSolve(...args);};api.guide.countOdds=(...args)=>{transports++;return originalCountOdds(...args);};
const close=(a,b,t=3e-11)=>assert(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)));
function independentActivity(d,r,oppositeCount,target){
 const coefficients=new Float64Array(d.length-oppositeCount+1);function visit(i,left,k,mass){if(left<0||left>d.length-i)return;if(i===d.length){if(left===0)coefficients[k]+=mass;return;}visit(i+1,left,k,mass);visit(i+1,left,k+1,mass*d[i]);if(left)visit(i+1,left-1,k,mass*r[i]);}visit(0,oppositeCount,0,1);
 let low=Math.log(target/(d.length-oppositeCount-target))-Math.max(...d.map(Math.log)),high=Math.log(target/(d.length-oppositeCount-target))-Math.min(...d.map(Math.log));
 for(let iteration=0;iteration<100;iteration++){const t=low+(high-low)/2,logs=Array.from(coefficients,(c,k)=>Math.log(c)+k*t),max=Math.max(...logs),weights=logs.map(x=>Math.exp(x-max)),mean=weights.reduce((sum,w,k)=>sum+k*w,0)/weights.reduce((a,b)=>a+b,0);if(Math.abs(mean-target)<=32*Number.EPSILON*d.length||low===high)return Math.exp(t);if(mean>target)high=t;else low=t;}throw Error('Independent activity bisection did not converge');
}
function grandCoefficient(ids,r,base,opposite){if(r<0||r>ids.length)return 0;if(!ids.length)return Number(r===0);return base[ids[0]]*grandCoefficient(ids.slice(1),r,base,opposite)+(r?opposite[ids[0]]*grandCoefficient(ids.slice(1),r-1,base,opposite):0);}


const reference={activity:independentActivity,coefficient:grandCoefficient};
function runMoments(){const guide=api.guide;
function enumerate(weights,r,t){let F=0,H=0,J=0;const lambda=Math.exp(t);function visit(i,left,count,mass){if(i===weights.length){if(left===0){F+=mass;H+=mass*count;J+=mass*count*count;}return;}visit(i+1,left,count,mass);visit(i+1,left,count+1,mass*lambda*weights[i][0]);if(left)visit(i+1,left-1,count,mass*weights[i][1]);}visit(0,r,0,1);const mean=H/F;return {logCoefficient:Math.log(F),mean,variance:J/F-mean*mean};}
const workspace=guide.createWorkspace(64);let momentCases=0,rootCases=0,maxEvaluations=0;
for(let n=2;n<=8;n++){const weights=Array.from({length:n},(_,i)=>[(i+1)/(n+2),(n-i)/(n+1),1]),remaining=weights.map((_,i)=>i);
 for(let r=0;r<n;r++)for(const t of [-8,-2,0,2,8]){const actual=guide.evaluate(weights,remaining,0,r,t,workspace),wanted=enumerate(weights,r,t);for(const key of ['logCoefficient','mean','variance'])close(actual[key],wanted[key]);momentCases++;}
 for(let r=0;r<n-1;r++)for(let target=1;target<n-r;target++){const result=guide.solve(weights,remaining,0,r,target,workspace),wanted=enumerate(weights,r,result.t);close(wanted.mean,target);maxEvaluations=Math.max(maxEvaluations,result.evaluations);rootCases++;}
}
// Constant current score gives the independently known binomial-logit root.
const same=Array.from({length:8},()=>[.2,.7,1]),known=guide.solve(same,same.map((_,i)=>i),0,3,3,workspace);close(known.t,Math.log(3/2)-Math.log(.2));

return {momentCases,rootCases,maxEvaluations,independent_category_enumeration:true,known_binomial_root:true};}
function runN8(){const trace=[];stageObserver=(sign,counts,reduced)=>{if(trace.length<6)trace.push({sign,counts:counts.slice(),reduced});};
const permutations=items=>items.length?items.flatMap((id,i)=>permutations(items.filter((_,j)=>i!==j)).map(rest=>[id,...rest])):[[]],close=(a,b,t=3e-11)=>assert(Math.abs(a-b)<=t*Math.max(1,Math.abs(b))),n=8,values=[-4,-4,-1,0,1,2,4,6],signs=[1,-1,1,-1,1,-1,0,0],order=[0,2,4,1,3,5],modes=['occupancy_R','full','full','full','full','full'],paths=permutations(values.map((_,i)=>i)),receipts=[];
for(const identical of [false,true]){
 const means=signs.map((s,i)=>identical?s*.3:i*.35-.8),rows=signs.map((_,i)=>({mix:identical?1:.3+i*.09,center:identical?0:.2,localSD:identical?2:1.7+i*.1})),groups=[order.filter(i=>signs[i]>0),order.filter(i=>signs[i]<0)],logCDFCache=new Map(),logCDF=x=>{if(!logCDFCache.has(x))logCDFCache.set(x,helper.normalLogCDF(x));return logCDFCache.get(x);},
  current=signs.map((sign,seat)=>values.map(value=>sign?logCDF(sign*(means[seat]+(value-rows[seat].center)*rows[seat].mix)/rows[seat].localSD):0)),
  guide=groups.map((group,c)=>values.map(value=>{const mu=group.map(i=>means[i]+(value-rows[i].center)*rows[i].mix),mean=mu.reduce((a,b)=>a+b,0)/mu.length,variance=group.reduce((sum,i,j)=>sum+rows[i].localSD**2+(mu[j]-mean)**2,0)/mu.length;return Math.exp(logCDF((c===0?1:-1)*mean/Math.sqrt(variance)));})),massCache=new Map();
 // Independent finite category enumeration. No production partition, rolling
 // table, gradients or merged-count representation is used by this oracle.
 const lambda=independentActivity(guide[0],guide[1],3,3),grandBase=guide[0].map(value=>1+lambda*value);
 function mass(mask,d,r,u,mode){if(mode==='occupancy_R'){const key='grand:'+mask+':'+r;if(massCache.has(key))return massCache.get(key);const ids=values.map((_,i)=>i).filter(id=>mask&(1<<id)),answer=grandCoefficient(ids,r,grandBase,guide[1]);massCache.set(key,answer);return answer;}const key=mask+':'+d+':'+r+':'+u+':'+mode;if(massCache.has(key))return massCache.get(key);if(!mask){const value=Number(d===0&&r===0&&u===0);massCache.set(key,value);return value;}let id=0;while(!(mask&(1<<id)))id++;const rest=mask^(1<<id);
  const answer=(d?(mode==='occupancy_R'?1:guide[0][id])*mass(rest,d-1,r,u,mode):0)+(r?guide[1][id]*mass(rest,d,r-1,u,mode):0)+(u?mass(rest,d,r,u-1,mode):0);massCache.set(key,answer);return answer;
 }
 let qTotal=0,wanted=0,weighted=0,wrongDouble=0,min=Infinity,max=-Infinity;trace.length=0;
 for(const slots of paths){const remaining=values.map((_,i)=>i),uniforms=[];let q=1;
  for(const [step,seat]of order.entries()){
   const future=order.slice(step+1),d=future.filter(i=>signs[i]>0).length,r=future.filter(i=>signs[i]<0).length,u=2,mask=remaining.reduce((m,id)=>m|(1<<id),0),weights=remaining.map(id=>Math.exp(current[seat][id])*mass(mask^(1<<id),d,r,u,modes[step])),sum=weights.reduce((a,b)=>a+b,0),chosen=remaining.indexOf(slots[seat]);
   assert(chosen>=0);q*=weights[chosen]/sum;if(remaining.length>1){let lo=0;for(let i=0;i<chosen;i++)lo+=weights[i]/sum;uniforms.push(lo+weights[chosen]/sum/2);}remaining.splice(chosen,1);
  }
  const desired=[slots[7],slots[6]];for(let z=remaining.length-1;z>0;z--){const pick=remaining.indexOf(desired[z]);assert(pick>=0&&pick<=z);uniforms.push((pick+.5)/(z+1));q/=z+1;[remaining[z],remaining[pick]]=[remaining[pick],remaining[z]];}
  const draw=api.allocateCalledLookahead(values,signs,uniforms,(seat,value,id)=>current[seat][id],helper.allocateWithoutReplacement,rows,means,logCDF),prior=1/paths.length,likelihood=order.reduce((p,seat)=>p*Math.exp(current[seat][slots[seat]]),1),correction=Math.exp(draw.logPriorMinusProposal),weight=correction*likelihood;
  assert.deepEqual(Array.from(draw.slots),slots);assert.equal(draw.uniformsConsumed,n-1);close(correction,prior/q);assert(q>0);qTotal+=q;wanted+=prior*likelihood;weighted+=q*weight;wrongDouble+=q*weight*likelihood;min=Math.min(min,weight);max=Math.max(max,weight);
 }
 close(qTotal,1);close(weighted,wanted);assert(wrongDouble<wanted*.99,'Target keeps each actual call normalizer once');assert(max>min,'Reduced guide is explicitly approximate Q, not an exact target claim');assert.deepEqual(trace.map(row=>row.reduced),[true,false,false,false,false,false]);assert.deepEqual(trace[0].counts,[2,3,2]);assert.deepEqual(trace[1].counts,[1,3,2]);
 receipts.push({identical,paths:paths.length,q_normalized:true,p_over_q_restores_original_indexed_target_once:true,full_support:true,original_uniforms:n-1,first_stage_occupancy_moment_then_original_fast_paths:true,trace:trace.slice()});
}
// Symmetric orientation: an R-current stage retains only finite D availability.
// The category sum is enumerated directly over remaining indexed subsets.
const scores={weights:Array.from({length:8},(_,i)=>[.1+(i+1)*.08,.87-(i+1)*.07,1])};scores.logs=scores.weights.map(row=>row.slice(0,2).map(Math.log));
function subsetSum(ids,k){if(k===0)return 1;if(ids.length<k)return 0;if(!ids.length)return 0;return scores.weights[ids[0]][0]*subsetSum(ids.slice(1),k-1)+subsetSum(ids.slice(1),k);}
const remaining=Array.from({length:8},(_,i)=>i),counts=[3,2,2],originalCounts=counts.slice(),originalScores=JSON.stringify(scores),currentLogs=Float64Array.from(values,value=>helper.normalLogCDF(-(value-.2)/2.3)),work={weights:[],current:new Float64Array(8),logs:new Float64Array(8),q:new Float64Array(8),gradients:new Float64Array(8),oppositeWeights:null,guideCounts:null},stage=api.stage(scores,counts,-1,remaining,currentLogs,work),lambda=independentActivity(scores.weights.map(row=>row[1]),scores.weights.map(row=>row[0]),3,3),base=scores.weights.map(row=>1+lambda*row[1]),opposite=scores.weights.map(row=>row[0]),expected=remaining.map(id=>Math.exp(currentLogs[id])*grandCoefficient(remaining.filter(other=>other!==id),3,base,opposite)),sum=expected.reduce((a,b)=>a+b,0);
for(let i=0;i<8;i++)close(stage.q[i]/stage.sum,expected[i]/sum);assert.deepEqual(counts,originalCounts);assert.equal(JSON.stringify(scores),originalScores);assert.deepEqual(work.guideCounts,[3,0,4]);

stageObserver=null;return {cases:receipts,paths:receipts.reduce((sum,row)=>sum+row.paths,0),symmetric_R_current_grand_coefficient:true,counts_and_score_rows_immutable:true};}
function runN11(){
const n=11,values=[-6,-6,-3,-1,0,1,2,3,5,7,8],signs=[1,-1,1,-1,1,-1,1,-1,0,0,0],order=[0,2,4,6,1,3,5,7],means=signs.map((s,i)=>i*.2-.5),rows=signs.map((_,i)=>({mix:.35+i*.05,center:.2,localSD:1.8+i*.1})),groups=[order.filter(i=>signs[i]>0),order.filter(i=>signs[i]<0)],cdfCache=new Map(),logCDF=x=>{if(!cdfCache.has(x))cdfCache.set(x,helper.normalLogCDF(x));return cdfCache.get(x);},current=signs.map((sign,seat)=>values.map(value=>sign?logCDF(sign*(means[seat]+(value-rows[seat].center)*rows[seat].mix)/rows[seat].localSD):0)),guide=groups.map((group,c)=>values.map(value=>{const mu=group.map(i=>means[i]+(value-rows[i].center)*rows[i].mix),center=mu.reduce((a,b)=>a+b,0)/mu.length,variance=group.reduce((sum,i,j)=>sum+rows[i].localSD**2+(mu[j]-center)**2,0)/mu.length;return Math.exp(logCDF((c===0?1:-1)*center/Math.sqrt(variance)));})),all=values.map((_,i)=>i),lambda0=reference.activity(guide[0],guide[1],4,4),t0=Math.log(lambda0),massCache=new Map(),grandCache=new Map();
function mass(mask,d,r,u){const key=mask+':'+d+':'+r+':'+u;if(massCache.has(key))return massCache.get(key);if(!mask)return Number(d===0&&r===0&&u===0);let id=0;while(!(mask&(1<<id)))id++;const rest=mask^(1<<id),answer=(d?guide[0][id]*mass(rest,d-1,r,u):0)+(r?guide[1][id]*mass(rest,d,r-1,u):0)+(u?mass(rest,d,r,u-1):0);massCache.set(key,answer);return answer;}
function transportedT(remaining){const logOdds=Math.log(3/3),logs=remaining.map(id=>Math.log(guide[0][id]));return Math.max(logOdds-Math.max(...logs),Math.min(logOdds-Math.min(...logs),t0+Math.log(3/4)));}
function probabilities(step,remaining){const seat=order[step],mask=remaining.reduce((m,id)=>m|(1<<id),0),future=order.slice(step+1),d=future.filter(i=>signs[i]>0).length,r=future.filter(i=>signs[i]<0).length,t=step===0?t0:step===1?transportedT(remaining):null,lambda=t===null?null:Math.exp(t),base=lambda===null?null:guide[0].map(score=>1+lambda*score),weights=remaining.map(id=>{
 if(t!==null){const key=t+':'+(mask^(1<<id))+':'+r;let coefficient=grandCache.get(key);if(coefficient===undefined){coefficient=reference.coefficient(remaining.filter(other=>other!==id),r,base,guide[1]);grandCache.set(key,coefficient);}return Math.exp(current[seat][id])*coefficient;}
 return Math.exp(current[seat][id])*mass(mask^(1<<id),d,r,3);
 }),sum=weights.reduce((a,b)=>a+b,0);return weights.map(w=>w/sum);}
const midpoint=(ids,probabilities,id)=>{const at=ids.indexOf(id);let value=probabilities[at]/2;for(let i=0;i<at;i++)value+=probabilities[i];return value;},p0=probabilities(0,all),restUniforms=[.13,.27,.41,.55,.69,.83,.97,.11];let prefixMass=0,cases=0,nonExactLaterMean=false;
for(const first of all){const remaining=all.filter(id=>id!==first),p1=probabilities(1,remaining),laterLambda=Math.exp(transportedT(remaining)),laterBase=guide[0].map(score=>1+laterLambda*score);
 // Independent occupancy polynomial proves that the later activity is allowed
 // to approximate the heterogeneous mean, rather than claiming another solve.
 const exactLater=reference.activity(remaining.map(id=>guide[0][id]),remaining.map(id=>guide[1][id]),4,3);if(Math.abs(Math.log(exactLater)-Math.log(laterLambda))>1e-8)nonExactLaterMean=true;
 for(const second of remaining){solves=0;transports=0;const uniforms=[midpoint(all,p0,first),midpoint(remaining,p1,second),...restUniforms],visited=[],draw=api.allocate(values,signs,uniforms,(seat,value,id)=>{visited.push(seat);return current[seat][id];},helper.allocateWithoutReplacement,rows,means,logCDF);
  assert.equal(draw.slots[0],first);assert.equal(draw.slots[2],second);assert.equal(new Set(draw.slots).size,n);assert.equal(draw.uniformsConsumed,n-1);assert.deepEqual([...new Set(visited)],order);assert.equal(solves,1);assert.equal(transports,1,'Exactly the second true-2D stage transports initial activity');
  const ids=all.slice();let q=1;for(let step=0;step<order.length;step++){const p=probabilities(step,ids),slot=draw.slots[order[step]],at=ids.indexOf(slot);assert(at>=0);q*=p[at];ids.splice(at,1);}q/=6;
  let logPrior=0;for(let i=2;i<=n;i++)logPrior-=Math.log(i);close(draw.logPriorMinusProposal,logPrior-Math.log(q));const logLikelihood=order.reduce((sum,seat)=>sum+current[seat][draw.slots[seat]],0);close(Math.log(q)+draw.logPriorMinusProposal+logLikelihood,logPrior+logLikelihood);
  prefixMass+=p0[first]*p1[remaining.indexOf(second)];cases++;
 }
}
close(prefixMass,1);assert(nonExactLaterMean,'Later approximate activity must not be represented as an exact current-pool solve');

return {seats:n,counts:{D:4,R:4,uncalled:3},ordered_first_two_prefixes:cases,prefix_mass_one:true,two_tilt_stages_and_full_assignment_p_over_q:true,initial_polynomial_root_and_later_count_odds_reference:true,duplicate_indices_and_n_minus_one_uniforms:true,exactly_one_initial_solve_and_one_later_transport:true,later_heterogeneous_mean_not_claimed_exact:true};}
function runPhase(){solves=0;transports=0;
const make=()=>({weights:[],current:new Float64Array(11),logs:new Float64Array(11),q:new Float64Array(11),gradients:new Float64Array(11),oppositeWeights:null,guideCounts:null,occupancy:null,logActivity:null,activityCount:null,activityInitialT:null,activityInitialCount:null,activityParty:null,activityUncalled:null,activityOpposite:null}),scores={weights:Array.from({length:11},(_,i)=>[helper.normalCDF((i-5)/3),helper.normalCDF((5-i)/3),1])};scores.logs=scores.weights.map(row=>row.slice(0,2).map(Math.log));
function stage(work,remaining,counts,sign){const originalCounts=counts.slice(),copy=JSON.stringify(scores);api.stage(scores,counts,sign,remaining,Float64Array.from(remaining,id=>helper.normalLogCDF(sign*(id-4)/3)),work);assert.deepEqual(counts,originalCounts);assert.equal(JSON.stringify(scores),copy);}
const all=Array.from({length:11},(_,i)=>i),work=make();stage(work,all,[3,4,3],1);assert.equal(solves,1);assert.equal(transports,0);const initial=work.activityInitialT;assert.equal(work.activityInitialCount,4);work.occupancy.root.t=123456;
stage(work,all.filter(id=>id!==0),[2,4,3],1);assert.equal(solves,1);assert.equal(transports,1);assert.equal(work.activityInitialT,initial,'Initial anchor is a copied scalar, not aliased root metadata');assert.equal(work.occupancy.activity.mean,null);assert.equal(work.occupancy.activity.residual,null);assert.equal(work.occupancy.activity.exact_later_occupancy_claim,false);
stage(work,all,[4,3,3],-1);assert.equal(solves,2,'New party phase starts a fresh exact initial root');
stage(work,all,[4,2,4],-1);assert.equal(solves,3,'Changed U starts a fresh initial root');
stage(work,all.filter(id=>id!==0),[3,2,4],-1);assert.equal(solves,4,'Changed opposite count starts a fresh initial root');
const fresh=make();stage(fresh,all,[3,4,3],1);assert.equal(solves,5);assert.notStrictEqual(fresh.occupancy.rows[0],work.occupancy.rows[0]);

return {party_U_opposite_resets:true,scalar_initial_anchor_not_aliased:true,later_mean_and_residual_null:true,new_transport_buffers_distinct:true};}
function runReplay(){
const engineFile=path.join(scriptRoot,'chamber_control_model.js'),engineModule={exports:{}},engineRequire=createRequire(engineFile);new Function('require','module','exports',fs.readFileSync(engineFile,'utf8'))(name=>name==='./source_call_conditioning.js'?helper:engineRequire(name),engineModule,engineModule.exports);const engine=engineModule.exports,basis=require(path.join(scriptRoot,'fictional_call_basis.cjs'))({largeBags:true}),live={},large=new Set();
for(const state of ['FL','TX','CA']){const rows=basis.house.filter(row=>row.code.startsWith('FICTION-'+state+'-')),k=Math.floor(rows.length/3);for(const [i,row]of rows.entries()){large.add(row.code);if(i<2*k)live[row.code]={mode:'source_called',winnerParty:i<k?'D':'R'};}}
for(const row of [...basis.senate,...basis.governors,...basis.house].filter(row=>(!row.nonrep_independent_proxy||row.mean<0)&&!large.has(row.code))){if(Object.keys(live).length>=200)break;live[row.code]={mode:'source_called',winnerParty:row.mean>=0?'D':'R'};}
const args={samples:300,seed:20261103,independentSenateCredit:'no_credit',contextKey:'FICTIONAL_ONCE_REPLAY',live,captureCountyDraws:['OH-SEN','NE-SEN','MI-07'],marginSummaryCodes:['ME-SEN','MI-07','FICTION-FL-28'],explainControl:true,voteSeatWeights:basis.house.map(row=>({race_code:row.code,reference_two_party_votes:25000}))},pa=engine.proposeSourceCallElections(basis,args),pb=engine.proposeSourceCallElections(basis,args);assert.deepEqual(pb,pa,'Plan/DP reuse cannot carry a prior particle or transport activity');const fa=engine.finalizeSourceCallElections(pa,{contextKey:args.contextKey}),fb=engine.finalizeSourceCallElections(pb,{contextKey:args.contextKey});assert.deepEqual(fb,fa);

assert.equal(fb.status,'CONDITIONED');assert(fb.support.effective_sample_size>=150);
return {samples:300,status:fb.status,effective_sample_size:fb.support.effective_sample_size,minimum_effective_sample_size:150,raw_packet_and_optional_replay_deterministic:true,full3000_support_not_inferred:true};}
const report={status:'PASS',source_sha256:crypto.createHash('sha256').update(source).digest('hex'),moments:runMoments(),n8_law:runN8(),n11_law:runN11(),phase:runPhase(),replay:runReplay(),source_or_fitted_evidence_added:false,empirical_calibration:'NOT_ESTABLISHED',private_test_hooks_only_no_public_API_added:true};
const out=path.join(root,'artifacts','readiness');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'source-call-occupancy-guide.json'),JSON.stringify(report,null,2)+'\n');
console.log('Occupancy proposal PASS:175 independent moments/84 roots,80640 n8 indexed paths,110 n11 two-tilt prefixes,phase isolation and deterministic optional replay. No calibration claim.');
