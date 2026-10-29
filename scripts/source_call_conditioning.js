/* Exact-corrected resource guide; all modules are statically scoped here.
 * No extra source, network import, fitted coefficient or public guide API. */
(()=>{
const redrawPartition=(()=>{const module={exports:{}};
'use strict';
// Positive three-category coefficient DP. Track the two smallest requested
// counts; the largest category is the untracked base. Reverse derivatives in
// each base column give all leave-one-index coefficients with a common scale.
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const workspaceCache=new Map(),MAX_WORKSPACE_BYTES=16*1024*1024;let usedBytes=0;
function workspace(n,size){
 const key=n+':'+size;
 if(workspaceCache.has(key)){const entry=workspaceCache.get(key);workspaceCache.delete(key);workspaceCache.set(key,entry);return entry;}
 const bytes=((n+3)*size+n)*8;
 if(!Number.isSafeInteger(bytes)||bytes<0||bytes>MAX_WORKSPACE_BYTES){const error=Error('REDRAW_WORKSPACE_MEMORY_BOUND');error.name='SourceCallConditioningError';error.code='REDRAW_WORKSPACE_MEMORY_BOUND';throw error;}
 while(workspaceCache.size&&usedBytes+bytes>MAX_WORKSPACE_BYTES){const first=workspaceCache.keys().next().value;usedBytes-=workspaceCache.get(first).bytes;workspaceCache.delete(first);}
 const entry={forward:Array.from({length:n+1},()=>new Float64Array(size)),scales:new Float64Array(n),adjA:new Float64Array(size),adjB:new Float64Array(size),bytes};
 workspaceCache.set(key,entry);usedBytes+=bytes;return entry;
}
function partition(weights,counts,{leaveOneOut=false,relativeOnly=false}={}){
 const n=weights.length,total=counts.reduce((a,b)=>a+b,0);
 if(counts.length!==3||counts.some(x=>!Number.isInteger(x)||x<0)||total!==n-Number(leaveOneOut)||
   weights.some(row=>row.length!==3||row.some(x=>!finite(x)||x<=0||x>1+1e-12)))throw Error('INVALID_THREE_CATEGORY_PARTITION');
 const order=[0,1,2].sort((a,b)=>counts[b]-counts[a]||a-b),base=order[0],a=order[1],b=order[2],A=counts[a],B=counts[b],width=B+1,size=(A+1)*width;
 const work=workspace(n,size),forward=work.forward,scales=work.scales;forward[0].fill(0);forward[0][0]=1;
 for(let i=0;i<n;i++){
  const prior=forward[i],next=forward[i+1],w=weights[i];next.fill(0);let scale=0;
  const wb=w[base],wa=w[a],wc=w[b];
  if(B===0){
   for(let j=0;j<=Math.min(A,i+1);j++){const value=wb*prior[j]+(j?wa*prior[j-1]:0);next[j]=value;scale=Math.max(scale,value);}
  }else if(B===1){
   for(let j=0;j<=Math.min(A,i+1);j++){
    const index=j*2,v0=wb*prior[index]+(j?wa*prior[index-2]:0);next[index]=v0;scale=Math.max(scale,v0);
    if(j<=i){const v1=wb*prior[index+1]+(j?wa*prior[index-1]:0)+wc*prior[index];next[index+1]=v1;scale=Math.max(scale,v1);}
   }
  }else for(let j=0;j<=Math.min(A,i+1);j++)for(let k=0;k<=Math.min(B,i+1-j);k++){
   const index=j*width+k,value=wb*prior[index]+(j?wa*prior[index-width]:0)+(k?wc*prior[index-1]:0);
   next[index]=value;scale=Math.max(scale,value);
  }
  if(!(scale>0)||!finite(scale))throw Error('THREE_CATEGORY_COEFFICIENT_SUPPORT');
  for(let j=0;j<size;j++)next[j]/=scale;scales[i]=scale;
 }
 const common=leaveOneOut&&relativeOnly?null:scales.reduce((sum,x)=>sum+Math.log(x),0),coefficient=forward[n][A*width+B];
 if(!(coefficient>0)||!finite(coefficient))throw Error('THREE_CATEGORY_COEFFICIENT_SUPPORT');
 if(!leaveOneOut)return {logCoefficient:Math.log(coefficient)+common,base,tracked:[a,b]};
 // Keep the original unsupported-numerics outcome too: an omitted zero term
// must not conceal an old nonfinite adjoint. This componentwise monotone
// bound uses the original positive-weight arithmetic. If it cannot prove
// every adjoint finite, retain the exact original full reverse loops.
let reverseBound=1,pruneReverse=true;
if(B>1)for(let i=n-1;i>=0;i--){const w=weights[i];reverseBound=(reverseBound*w[base]+reverseBound*w[a]+reverseBound*w[b])/scales[i];if(!finite(reverseBound)){pruneReverse=false;break;}}
let adjoint=work.adjA;adjoint.fill(0);adjoint[A*width+B]=1;const logGradients=new Float64Array(n);
 for(let i=n-1;i>=0;i--){
  const prior=forward[i],next=adjoint===work.adjA?work.adjB:work.adjA,w=weights[i],scale=scales[i];next.fill(0);let derivative=0;
  const wb=w[base],wa=w[a],wc=w[b];
  if(B===0){
   for(let j=0;j<=A;j++){derivative+=adjoint[j]*prior[j]/scale;next[j]=(adjoint[j]*wb+(j<A?adjoint[j+1]*wa:0))/scale;}
  }else if(B===1){
   for(let j=0;j<=A;j++){
    const index=j*2;derivative+=adjoint[index]*prior[index]/scale;
    next[index]=(adjoint[index]*wb+(j<A?adjoint[index+2]*wa:0)+adjoint[index+1]*wc)/scale;
    derivative+=adjoint[index+1]*prior[index+1]/scale;
    next[index+1]=(adjoint[index+1]*wb+(j<A?adjoint[index+3]*wa:0))/scale;
   }
  }else for(let j=pruneReverse?Math.max(0,A-n+i):0,jEnd=pruneReverse?Math.min(A,i):A;j<=jEnd;j++)for(let k=pruneReverse?Math.max(0,B-n+i,A+B-n+i-j):0,kEnd=pruneReverse?Math.min(B,i-j):B;k<=kEnd;k++){
   const index=j*width+k;derivative+=adjoint[index]*prior[index]/scale;
   next[index]=(adjoint[index]*wb+(j<A?adjoint[index+width]*wa:0)+(k<B?adjoint[index+1]*wc:0))/scale;
  }
  if(!(derivative>0)||!finite(derivative))throw Error('THREE_CATEGORY_DERIVATIVE_SUPPORT');
  logGradients[i]=Math.log(derivative);adjoint=next;
 }
 return {logGradients,...(relativeOnly?{relativeOnly:true}:{logCommonScale:common}),base,tracked:[a,b]};
}
module.exports={partition};

return module.exports;})();
const lookahead=(()=>{const module={exports:{}};const require=name=>{if(name==='./partition3_fast.cjs')return redrawPartition;throw Error('UNEXPECTED_STATIC_REDRAW_DEPENDENCY');};
'use strict';
// Separate cost experiment: one fixed D/R group Normal is a moment-matched
// proposal guide to the known equal-weight conditional Gaussian mixture. This
// never replaces any original race likelihood or event normalizer.
const {partition}=require('./partition3_fast.cjs'),finite=x=>typeof x==='number'&&Number.isFinite(x);
function groupScores(values,signs,rows,means,logCDF){
 const groups=[[],[]];signs.forEach((sign,i)=>{if(sign)groups[sign>0?0:1].push(i);});
 const scratch=groups.map(group=>new Float64Array(group.length));
 const cache=new Map(),logs=values.map(value=>{
  if(cache.has(value))return cache.get(value);
  const score=groups.map((members,category)=>{
   if(!members.length)return 0;
   const mu=scratch[category];let center=0;
   for(let j=0;j<members.length;j++){const i=members[j];mu[j]=means[i]+(value-rows[i].center)*rows[i].mix;center+=mu[j];}center/=members.length;
   let variance=0;for(let j=0;j<members.length;j++){const i=members[j];variance=variance+rows[i].localSD**2+(mu[j]-center)**2;}variance/=members.length;
   if(!(variance>0)||!finite(variance))throw Error('MOMENT_GUIDE_VARIANCE_UNSUPPORTED');
   const log=logCDF((category===0?1:-1)*center/Math.sqrt(variance));
   if(!finite(log)||log>0||!(Math.exp(log)>0))throw Error('MOMENT_GUIDE_SCORE_SUPPORT');return log;
  });cache.set(value,score);return score;
 });
 return {logs,weights:logs.map(row=>[Math.exp(row[0]),Math.exp(row[1]),1])};
}
function stage(scores,counts,sign,remaining,currentLogs=null){
 const size=remaining.length,weights=new Array(size);for(let i=0;i<size;i++)weights[i]=scores.weights[remaining[i]];
 const part=partition(weights,counts,{leaveOneOut:true,relativeOnly:true}),logs=new Float64Array(size);let max=-Infinity;
 for(let i=0;i<size;i++){logs[i]=(currentLogs?currentLogs[i]:scores.logs[remaining[i]][sign>0?0:1])+part.logGradients[i];max=Math.max(max,logs[i]);}
 const q=new Float64Array(size);let sum=0;
 for(let i=0;i<size;i++){q[i]=Math.exp(logs[i]-max);if(!(q[i]>0))throw Error('MOMENT_LOOKAHEAD_Q_SUPPORT');sum+=q[i];}
 if(!finite(sum)||sum<=0)throw Error('MOMENT_LOOKAHEAD_Q_SUPPORT');return {logs,max,q,sum};
}
function allocateCalledLookahead(values,signs,uniforms,logProbability,original,rows,means,logCDF){
 if(!signs.some(Boolean))return original(values,signs,uniforms,logProbability);
 if(uniforms.length!==values.length-1||Array.from(uniforms).some(x=>!finite(x)||x<0||x>=1))throw Error('INVALID_MOMENT_LOOKAHEAD_UNIFORMS');
 const scores=groupScores(values,signs,rows,means,logCDF),remaining=values.map((_,i)=>i),counts=[signs.filter(s=>s>0).length,signs.filter(s=>s<0).length,signs.filter(s=>!s).length],
  slots=new Uint16Array(values.length),assigned=new Float64Array(values.length);let cursor=0,logPriorMinusProposal=0;
 for(let seat=0;seat<values.length;seat++)if(signs[seat]){
  counts[signs[seat]>0?0:1]--;const current=new Float64Array(remaining.length);for(let i=0;i<remaining.length;i++){const id=remaining[i];current[i]=logProbability(seat,values[id],id,signs[seat]);}const p=stage(scores,counts,signs[seat],remaining,current);let choice=remaining.length-1;
  if(remaining.length>1){const u=uniforms[cursor++];let cumulative=0;for(let i=0;i<remaining.length;i++){cumulative+=p.q[i]/p.sum;if(u<cumulative){choice=i;break;}}}
  logPriorMinusProposal+=-Math.log(remaining.length)-(p.logs[choice]-p.max-Math.log(p.sum));
  const id=remaining.splice(choice,1)[0];slots[seat]=id;assigned[seat]=values[id];
 }
 for(let z=remaining.length-1;z>0;z--){const pick=Math.floor(uniforms[cursor++]*(z+1));[remaining[z],remaining[pick]]=[remaining[pick],remaining[z]];}
 for(let seat=0;seat<values.length;seat++)if(!signs[seat]){const id=remaining.pop();slots[seat]=id;assigned[seat]=values[id];}
 if(cursor!==uniforms.length)throw Error('MOMENT_LOOKAHEAD_RNG_CONSUMPTION_CHANGED');return {values:assigned,slots,logPriorMinusProposal,uniformsConsumed:cursor};
}
module.exports={allocateCalledLookahead};

return module.exports;})();
const resource=(()=>{const module={exports:{}};const require=name=>{if(name==='./partition3_fast.cjs')return redrawPartition;throw Error('UNEXPECTED_STATIC_REDRAW_DEPENDENCY');};
'use strict';
const {partition}=require('./partition3_fast.cjs');
// Proposal-only shared-factor guide. Replaces fully-called bag marginal-probit
// surrogates by the grouped indexed resource partition used by look-ahead.
// All original Gaussian density / exact call and allocation corrections remain
// in the actual election weight; no evidence or fitted model term is added.
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0),logDensity=x=>-.5*x*x-.5*Math.log(2*Math.PI);
function resourceGaussian(input,originalTerms,numerics,observe=()=>{}){
 const {keys,calls,bags,signs}=input,{normalLogCDF,cholesky,solvePrecision,gaussianProposal}=numerics;
 const eligible=[];
 for(const [state,bag]of bags){
  // Uncalled rows form the exact unit-likelihood third category.
  const coefficients=keys.map(key=>bag.rows[0].coefficients[key]||0);
  if(bag.rows.some(row=>keys.some((key,j)=>(row.coefficients[key]||0)!==coefficients[j])))continue;
  const Drows=bag.rows.filter(row=>signs.get(row.code)>0),Rrows=bag.rows.filter(row=>signs.get(row.code)<0),count=Drows.length;
  const counts=[Drows.length,Rrows.length,bag.rows.length-Drows.length-Rrows.length],factorialLog=n=>Array.from({length:n},(_,i)=>Math.log(i+1)).reduce((sum,x)=>sum+x,0),
   logChoose=factorialLog(bag.rows.length)-counts.reduce((sum,n)=>sum+factorialLog(n),0),cache=new Map();
  const evaluate=t=>{
   if(cache.has(t))return cache.get(t);
   const probabilities=rows=>bag.values.map(value=>{
    if(!rows.length)return 1;
    const mu=rows.map(row=>row.mean+(value-row.center)*row.mix),center=mu.reduce((a,b)=>a+b,0)/rows.length,
     variance=rows.reduce((sum,row,i)=>sum+row.localSD**2+(mu[i]-center)**2,0)/rows.length;
    return Math.exp(normalLogCDF(signs.get(rows[0].code)*(center+t)/Math.sqrt(variance)));
   });
   const D=probabilities(Drows),R=probabilities(Rrows),weights=bag.values.map((_,i)=>[D[i],R[i],1]);
   const answer=partition(weights,counts).logCoefficient-logChoose;
   if(!finite(answer))throw Error('NONFINITE_RESOURCE_GUIDE');cache.set(t,answer);if(cache.size>512)cache.delete(cache.keys().next().value);return answer;
  };
  const scale=bag.rows.reduce((sum,row)=>sum+row.localSD,0)/bag.rows.length;
  eligible.push({state,rows:new Set(bag.rows.map(row=>row.code)),coefficients,evaluate,scale});
 }
 if(!eligible.length)return gaussianProposal(originalTerms,keys.length);
 const included=new Set(eligible.flatMap(item=>Array.from(item.rows))),terms=originalTerms.filter((_,i)=>!included.has(calls[i].row.code));
 const density=z=>-.5*dot(z,z)+terms.reduce((sum,term)=>sum+normalLogCDF(term.offset+dot(term.loadings,z)),0)+
  eligible.reduce((sum,bag)=>sum+bag.evaluate(dot(bag.coefficients,z)),0);
 let mode=new Float64Array(keys.length),L,iterations=0,gradientNorm=Infinity;
 try{
  for(;iterations<80;iterations++){
   const gradient=Float64Array.from(mode,x=>-x),H=Array.from({length:keys.length},(_,i)=>Float64Array.from({length:keys.length},(_,j)=>Number(i===j)));
   for(const term of terms){
    const k=term.offset+dot(term.loadings,mode),ratio=Math.exp(logDensity(k)-normalLogCDF(k)),precision=ratio*(k+ratio);
    for(let i=0;i<keys.length;i++){gradient[i]+=term.loadings[i]*ratio;for(let j=0;j<keys.length;j++)H[i][j]+=term.loadings[i]*term.loadings[j]*precision;}
   }
   for(const bag of eligible){
    const t=dot(bag.coefficients,mode),h=Math.pow(Number.EPSILON,.25)*(1+Math.abs(t)+bag.scale),f0=bag.evaluate(t),
     fm=bag.evaluate(t-h),fp=bag.evaluate(t+h),fm2=bag.evaluate(t-2*h),fp2=bag.evaluate(t+2*h),
     first=(fm2-8*fm+8*fp-fp2)/(12*h),second=(-fp2+16*fp-30*f0+16*fm-fm2)/(12*h*h);
    if(!finite(first)||!finite(second))throw Error('RESOURCE_GUIDE_DERIVATIVE_UNSUPPORTED');
    for(let i=0;i<keys.length;i++){gradient[i]+=bag.coefficients[i]*first;for(let j=0;j<keys.length;j++)H[i][j]-=bag.coefficients[i]*bag.coefficients[j]*second;}
   }
   L=cholesky(H);const step=solvePrecision(L,gradient),decrement=dot(step,gradient),before=density(mode);
   gradientNorm=Math.hypot(...gradient);
   if(step.every(x=>Math.abs(x)<1e-11)||(decrement>=0&&decrement<=64*Number.EPSILON*(1+Math.abs(before))))break;
   let fraction=1,accepted=false;
   for(let line=0;line<60;line++){const trial=Float64Array.from(mode,(value,i)=>value+fraction*step[i]);if(density(trial)>=before){mode=trial;accepted=true;break;}fraction/=2;}
   if(!accepted)throw Error('RESOURCE_GUIDE_LINE_SEARCH_FAILED');
  }
  if(iterations===80)throw Error('RESOURCE_GUIDE_NOT_CONVERGED');
  const out={mode,L,iterations,logDeterminant:2*L.reduce((sum,row,i)=>sum+Math.log(row[i]),0)};
  observe({status:'RESOURCE_GUIDE_PREPARED',states:eligible.map(row=>row.state),iterations,gradientNorm});return out;
 }catch(error){
  observe({status:'RESOURCE_GUIDE_UNSUPPORTED_FALLBACK_ORIGINAL',reason:error.code||error.message,states:eligible.map(row=>row.state)});
  return gaussianProposal(originalTerms,keys.length);
 }
}
module.exports={resourceGaussian};

return module.exports;})();
const recordGuide=()=>{};
/* Candidate only: exact-corrected proposal for existing validated winner calls.
 * It supplies a sampler/weight correction, never a new evidence source or a
 * fitted forecast. Numeric basis values stay inside this prepared RAM object.
 * Normal series/continued fraction: NIST DLMF7.6.2 and7.9.1; inverse uses
 * safeguarded Newton iteration on that log-CDF (no copied library algorithm).
 */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.SourceCallConditioning=api;
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:null,function(){
 'use strict';
 const VERSION='source-call-conditional-proposal-v1';
 const MINIMUM_EFFECTIVE_SAMPLE_FRACTION=.5;
 const MAX_FACTORS=64,MAX_REDRAW_BAG=64,MAX_CACHE_ENTRIES=16;
 const LOG_TWO_PI=Math.log(2*Math.PI),LOG_HALF=Math.log(.5);
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 function fail(code){const error=new Error(code);error.name='SourceCallConditioningError';error.code=code;throw error;}
 const logPhiDensity=x=>-.5*x*x-.5*LOG_TWO_PI;
 function normalLogCDF(x){
  if(!finite(x))fail('NONFINITE_NORMAL_ARGUMENT');
  if(x>0)return Math.log1p(-Math.exp(normalLogCDF(-x)));
  const z=-x;
  if(z>=3){
   let tail=0;for(let k=96;k>=1;k--)tail=k/(z+tail);
   const out=logPhiDensity(z)-Math.log(z+tail);
   if(!finite(out))fail('NORMAL_LOG_CDF_DOMAIN_UNSUPPORTED');
   return out;
  }
  let term=z,sum=z;
  for(let k=1;k<120;k++){
   term*=z*z/(2*k+1);sum+=term;
   if(term<Math.max(1,sum)*1e-16)break;
  }
  const out=Math.log(.5-Math.exp(logPhiDensity(z))*sum);
  if(!finite(out))fail('NORMAL_LOG_CDF_PRECISION_FAILURE');
  return out;
 }
 function normalCDF(x){return x<=0?Math.exp(normalLogCDF(x)):-Math.expm1(normalLogCDF(-x));}
 function normalInverseLogCDF(logp){
  if(!finite(logp)||logp>=0)fail('INVALID_INVERSE_NORMAL_PROBABILITY');
  if(logp>LOG_HALF)return -normalInverseLogCDF(Math.log(-Math.expm1(logp)));
  let low=-Math.max(1,Math.sqrt(-2*logp)*2),high=0,x=-Math.sqrt(-2*logp);
  for(let iteration=0;iteration<35;iteration++){
   const value=normalLogCDF(x),error=value-logp;
   if(Math.abs(error)<2e-13)return x;
   if(error>0)high=x;else low=x;
   const derivative=Math.exp(logPhiDensity(x)-value),next=x-error/derivative;
   x=finite(next)&&next>low&&next<high?next:(low+high)/2;
  }
  if(Math.abs(normalLogCDF(x)-logp)>2e-10)fail('INVERSE_NORMAL_PRECISION_FAILURE');
  return x;
 }
 function truncateToCalledSign(mean,sigma,sign,rawLocalNormal){
  if(!finite(mean)||!finite(sigma)||sigma<=0||!finite(rawLocalNormal)||![-1,1].includes(sign))
   fail('UNSUPPORTED_CALLED_LOCAL_NORMAL');
  const logProbability=normalLogCDF(sign*mean/sigma);
  const inverse=normalInverseLogCDF(normalLogCDF(rawLocalNormal)+logProbability);
  const margin=sign*(sign*mean-sigma*inverse);
  if(!finite(margin)||!(sign*margin>0))fail('CALLED_SIGN_NUMERICAL_SUPPORT_FAILURE');
  return {margin,logProbability};
 }
 const dot=(x,y)=>x.reduce((sum,value,i)=>sum+value*y[i],0);
 function cholesky(matrix){
  const n=matrix.length,L=Array.from({length:n},()=>new Float64Array(n));
  for(let i=0;i<n;i++)for(let j=0;j<=i;j++){
   let value=matrix[i][j];for(let k=0;k<j;k++)value-=L[i][k]*L[j][k];
   if(i===j){if(!finite(value)||value<=0)fail('PROPOSAL_PRECISION_NOT_POSITIVE_DEFINITE');L[i][j]=Math.sqrt(value);}
   else L[i][j]=value/L[j][j];
  }
  return L;
 }
 function solveTranspose(L,value){
  const out=new Float64Array(L.length);
  for(let i=L.length-1;i>=0;i--){let sum=value[i];for(let j=i+1;j<L.length;j++)sum-=L[j][i]*out[j];out[i]=sum/L[i][i];}
  return out;
 }
 function solvePrecision(L,value){
  const out=new Float64Array(L.length);
  for(let i=0;i<L.length;i++){let sum=value[i];for(let j=0;j<i;j++)sum-=L[i][j]*out[j];out[i]=sum/L[i][i];}
  return solveTranspose(L,out);
 }
 function gaussianProposal(terms,dimension){
  const density=z=>-.5*dot(z,z)+terms.reduce((sum,t)=>sum+normalLogCDF(t.offset+dot(t.loadings,z)),0);
  let mode=new Float64Array(dimension),L,iterations=0;
  for(;iterations<80;iterations++){
   const gradient=Float64Array.from(mode,x=>-x);
   const H=Array.from({length:dimension},(_,i)=>Float64Array.from({length:dimension},(_,j)=>Number(i===j)));
   for(const term of terms){
    const k=term.offset+dot(term.loadings,mode),ratio=Math.exp(logPhiDensity(k)-normalLogCDF(k));
    const precisionWeight=ratio*(k+ratio);
    if(!finite(precisionWeight)||precisionWeight<0)fail('INVALID_PROBIT_PROPOSAL_HESSIAN');
    for(let i=0;i<dimension;i++){
     gradient[i]+=term.loadings[i]*ratio;
     for(let j=0;j<dimension;j++)H[i][j]+=term.loadings[i]*term.loadings[j]*precisionWeight;
    }
   }
   L=cholesky(H);const step=solvePrecision(L,gradient);
   // The Gaussian is a proposal with an exact p/q correction. Stop a Newton
   // objective change below floating-point resolution instead of iterating
   // forever on an unresolvable final step; this does not change the target.
   const decrement=dot(step,gradient),resolution=64*Number.EPSILON*(1+Math.abs(density(mode)));
   if(step.every(x=>Math.abs(x)<1e-11)||(decrement>=0&&decrement<=resolution))break;
   const before=density(mode);let fraction=1,accepted=false;
   for(let backtrack=0;backtrack<60;backtrack++){
    const trial=Float64Array.from(mode,(x,i)=>x+fraction*step[i]);
    if(density(trial)>=before){mode=trial;accepted=true;break;}fraction/=2;
   }
   if(!accepted)fail('PROPOSAL_LINE_SEARCH_FAILED');
  }
  if(iterations===80)fail('PROPOSAL_DID_NOT_CONVERGE');
  const logDeterminant=2*L.reduce((sum,row,i)=>sum+Math.log(row[i]),0);
  return {mode,L,logDeterminant,iterations};
 }

 // Generic indexed allocation helper, independently enumerable on small bags.
 // The caller supplies exact per-seat local called-sign log probabilities.
 function allocateWithoutReplacement(values,calledSigns,uniforms,logProbability){
  if(!Array.isArray(values)||values.length<1||values.length>MAX_REDRAW_BAG||
     !values.every(finite)||!Array.isArray(calledSigns)||calledSigns.length!==values.length||
     calledSigns.some(x=>![0,-1,1].includes(x))||
     !(Array.isArray(uniforms)||ArrayBuffer.isView(uniforms))||uniforms.length!==values.length-1||
     !Array.from(uniforms).every(u=>finite(u)&&u>=0&&u<1)||typeof logProbability!=='function')
   fail('INVALID_INDEXED_REDRAW_ALLOCATION');
  const bag=values.map((value,id)=>({value,id})),assigned=new Float64Array(values.length),slots=new Uint16Array(values.length);
  let cursor=0,logPriorMinusProposal=0;
  for(let seat=0;seat<values.length;seat++){
   if(!calledSigns[seat])continue;
   const logs=bag.map(item=>logProbability(seat,item.value,item.id,calledSigns[seat]));
   if(logs.some(x=>!finite(x)||x>0))fail('INVALID_ALLOCATION_SIGN_PROBABILITY');
   const maximum=Math.max(...logs),weights=logs.map(x=>Math.exp(x-maximum)),sum=weights.reduce((s,x)=>s+x,0);
   if(weights.some(x=>!(x>0))||!finite(sum)||sum<=0)fail('ALLOCATION_PROPOSAL_LOST_NUMERICAL_SUPPORT');
   let chosen=bag.length-1;
   if(bag.length>1){
    const u=uniforms[cursor++];let cumulative=0;
    for(let j=0;j<bag.length;j++){cumulative+=weights[j]/sum;if(u<cumulative){chosen=j;break;}}
   }
   logPriorMinusProposal+=-Math.log(bag.length)-(logs[chosen]-maximum-Math.log(sum));
   const item=bag.splice(chosen,1)[0];assigned[seat]=item.value;slots[seat]=item.id;
  }
  for(let i=bag.length-1;i>0;i--){const index=Math.floor(uniforms[cursor++]*(i+1));[bag[i],bag[index]]=[bag[index],bag[i]];}
  for(let seat=0;seat<values.length;seat++)if(!calledSigns[seat]){const item=bag.pop();assigned[seat]=item.value;slots[seat]=item.id;}
  if(cursor!==uniforms.length||bag.length)fail('REDRAW_UNIFORM_CONSUMPTION_MISMATCH');
  return {values:assigned,slots,logPriorMinusProposal,uniformsConsumed:cursor};
 }

 const ASSUMPTIONS=['common_national_sigma','house_chamber_sigma','senate_chamber_sigma','governor_chamber_sigma',
  'state_house_sigma','state_senate_sigma','state_governor_sigma','redrawn_state_additional_sigma'];
 function validateExistingCallContract(basis,options={}){
  const live=options.live??Object.create(null);
  if(!live||typeof live!=='object'||Array.isArray(live))fail('INVALID_CALL_MAP');
  const entries=Object.entries(live);if(!entries.length)return [];
  if(!basis||basis.house?.length!==435||basis.senate?.length!==35||!Array.isArray(basis.governors)||
     basis.governors.length<6||basis.governors.length>36)fail('UNSUPPORTED_MODEL_UNIVERSE');
  if((options.independentSenateCredit??'no_credit')!=='no_credit')fail('INDEPENDENT_CREDIT_POLICY_UNSUPPORTED');
  const polls=basis.house.concat(basis.senate,basis.governors),byCode=new Map();
  for(const row of polls){if(!row||typeof row.code!=='string'||!row.code||byCode.has(row.code))fail('INVALID_PREPARED_RACE');byCode.set(row.code,row);}
  for(const [code,call] of entries){
   const row=byCode.get(code);
   if(!row||call?.mode!=='source_called'||!['D','R'].includes(call.winnerParty))fail('UNSUPPORTED_EXISTING_CALL_CONTRACT');
   if(row.nonrep_independent_proxy===true&&call.winnerParty==='D')fail('INDEPENDENT_WIN_CANNOT_BE_RELABELLED_DEMOCRATIC');
  }
  return polls.filter(row=>Object.hasOwn(live,row.code)).map(row=>({race_code:row.code,winner_party:live[row.code].winnerParty}));
 }
 function optionsAndCalls(basis,options){
  const live=options.live??Object.create(null);
  if(!live||typeof live!=='object'||Array.isArray(live))fail('INVALID_CALL_MAP');
  const entries=Object.entries(live);if(!entries.length)return null;
  validateExistingCallContract(basis,options);
  if(!basis||basis.house?.length!==435||basis.senate?.length!==35||
     !Array.isArray(basis.governors)||basis.governors.length<6||basis.governors.length>36)
   fail('UNSUPPORTED_MODEL_UNIVERSE');
  if((options.independentSenateCredit??'no_credit')!=='no_credit')fail('INDEPENDENT_CREDIT_POLICY_UNSUPPORTED');
  const shift=options.nationalShift??0,multiplier=options.errorMultiplier??1,corr=options.senateCorrelationResearch??null;
  if(!finite(shift)||Math.abs(shift)>7||!finite(multiplier)||multiplier<.6||multiplier>1.7)
   fail('UNSUPPORTED_MODEL_SENSITIVITY');
  if(corr!==null&&(typeof corr!=='object'||Array.isArray(corr)||!finite(corr.nationalScale)||corr.nationalScale<.5||corr.nationalScale>1||
     !finite(corr.chamberScale)||corr.chamberScale<.5||corr.chamberScale>1))fail('UNSUPPORTED_RESEARCH_CORRELATION');
  const a={};for(const key of ASSUMPTIONS){if(!finite(basis.assumptions?.[key])||basis.assumptions[key]<0)fail('INVALID_SHARED_FACTOR_BUDGET');a[key]=basis.assumptions[key];}
  const polls=basis.house.concat(basis.senate,basis.governors),codes=new Set();
  const rows=polls.map((r,index)=>{
   if(!r||typeof r.code!=='string'||!r.code||codes.has(r.code)||typeof r.state!=='string'||!/^[A-Z]{2}$/.test(r.state)||
      !finite(r.mean)||!finite(r.sigma)||r.sigma<0||typeof r.method!=='string')fail('INVALID_PREPARED_RACE');
   codes.add(r.code);const house=index<435,senate=index>=435&&index<470;
   const mix=house?(r.redrawn_mix_weight??0):0;
   if(!finite(mix)||mix<0||mix>1)fail('INVALID_REDRAW_MIXTURE_WEIGHT');
   if(mix>0&&!finite(r.redrawn_state_center))fail('MISSING_REDRAW_CENTER');
   const localVariance=senate&&corr?a.common_national_sigma**2*(1-corr.nationalScale**2)+
    a.senate_chamber_sigma**2*(1-corr.chamberScale**2):0;
   const localSD=Math.sqrt(r.sigma**2+localVariance)*multiplier;
   const office=house?'H':senate?'S':'G';
   const coefficients={N:a.common_national_sigma*multiplier*(senate?(corr?.nationalScale??1):1),
    [office]:(house?a.house_chamber_sigma:senate?a.senate_chamber_sigma*(corr?.chamberScale??1):a.governor_chamber_sigma)*multiplier,
    ['T:'+r.state]:(house?a.state_house_sigma+(r.method.includes('redrawn_')?a.redrawn_state_additional_sigma:0):
     senate?a.state_senate_sigma:a.state_governor_sigma)*multiplier};
   return {code:r.code,state:r.state,index,mean:r.mean+shift,localSD,mix,center:mix?r.redrawn_state_center:0,
    coefficients,independent:r.nonrep_independent_proxy===true,method:r.method};
  });
  const byCode=new Map(rows.map(row=>[row.code,row])),signs=new Map();
  for(const [code,call] of entries){
   const row=byCode.get(code);
   if(!row||call?.mode!=='source_called'||!['D','R'].includes(call.winnerParty))fail('UNSUPPORTED_EXISTING_CALL_CONTRACT');
   if(row.independent&&call.winnerParty==='D')fail('INDEPENDENT_WIN_CANNOT_BE_RELABELLED_DEMOCRATIC');
   if(!(row.localSD>0))fail('DEGENERATE_CALLED_LOCAL_ERROR_UNSUPPORTED');
   signs.set(code,call.winnerParty==='D'?1:-1);
  }
  const calls=rows.filter(row=>signs.has(row.code)).map(row=>({row,sign:signs.get(row.code)}));
  const bags=new Map();
  for(const {row} of calls)if(row.mix>0&&!bags.has(row.state)){
   const values=basis.redrawn_state_distributions?.[row.state];
   const stateRows=rows.filter(r=>r.state===row.state&&r.mix>0);
   if(!Array.isArray(values)||values.length<1||values.length>MAX_REDRAW_BAG||values.length!==stateRows.length||
      !values.every(value=>finite(value)&&Math.abs(value)<=100))fail('UNSUPPORTED_REDRAW_ASSIGNMENT_SCOPE');
   const copy=values.slice(),mean=copy.reduce((s,x)=>s+x,0)/copy.length,
    variance=copy.reduce((s,x)=>s+(x-mean)**2,0)/copy.length;
   bags.set(row.state,{values:copy,rows:stateRows,mean,variance});
  }
  const keys=[...new Set(calls.flatMap(({row})=>Object.keys(row.coefficients).filter(key=>row.coefficients[key]!==0)))].sort();
  if(keys.length>MAX_FACTORS)fail('UNSUPPORTED_SHARED_FACTOR_SCOPE');
  const context=options.contextKey??'UNSPECIFIED';
  if(typeof context!=='string'||context.length>128)fail('INVALID_MODEL_CONTEXT_KEY');
  // Private numeric values are used only for an in-memory mutation check/cache
  // identity. This string is never returned, logged, exported or persisted.
  const fingerprint=JSON.stringify([a,rows,Array.from(bags,([state,bag])=>[state,bag.values]),shift,multiplier,corr]);
  return {rows,calls,signs,bags,keys,context,fingerprint,
   optionKey:JSON.stringify([shift,multiplier,corr,context]),
   callKey:calls.map(({row,sign})=>row.code+':'+(sign>0?'D':'R')).join('|')};
 }
 function buildPlan(input){
  const {rows,calls,signs,bags,keys}=input;
  const terms=calls.map(({row,sign})=>{
   const bag=bags.get(row.state),redrawMean=row.mix&&bag?row.mix*(bag.mean-row.center):0,
    extraVariance=row.mix&&bag?row.mix**2*bag.variance:0,scale=Math.hypot(row.localSD,Math.sqrt(extraVariance));
   return {offset:sign*(row.mean+redrawMean)/scale,loadings:keys.map(key=>sign*(row.coefficients[key]||0)/scale)};
  });
  const gaussian=resource.resourceGaussian(input,terms,{normalLogCDF,cholesky,solvePrecision,gaussianProposal},recordGuide),loadings=rows.map(row=>keys.map(key=>row.coefficients[key]||0));
  const output=new Float64Array(rows.length),factorDelta=new Float64Array(keys.length);
  const readState=(states,state)=>typeof states?.get==='function'?states.get(state):states?.[state];
  const diagnostics=Object.freeze({schema:VERSION,status:'PREPARED_NOT_YET_WEIGHTED',
   method:'GROUPED_RESOURCE_GUIDE_EXACT_CORRECTION',
   called_races:Object.freeze(calls.map(({row})=>row.code)),factor_count:keys.length,
   redrawn_bag_sizes:Object.freeze(Object.fromEntries(Array.from(bags,([state,bag])=>[state,bag.values.length]))),
   proposal_iterations:gaussian.iterations,interval_calibrated:false,
   original_call_eligibility_unchanged:true,independent_credit:'no_credit'});
  return Object.freeze({schema:VERSION,callSignature:input.callKey,contextKey:input.context,diagnostics,
   // Consume/copy returned margins synchronously; the prepared plan reuses its
   // working buffer. The engine must recompute every downstream consumer.
   transport(raw,{requiredCalledMarginCodes=null}={}){
    if(requiredCalledMarginCodes!==null&&!(requiredCalledMarginCodes instanceof Set))fail('INVALID_CALLED_MARGIN_MATERIALIZATION_SCOPE');
    const n=rows.length;
    if(!raw||raw.margins?.length!==n||raw.localNormals?.length!==n||raw.redrawMargins?.length!==n||!raw.sharedNormals)
     fail('INVALID_RAW_ELECTION_TRANSPORT');
    if(raw.margins===output)fail('TRANSPORT_REQUIRES_ORIGINAL_ELECTION');
    const old=Float64Array.from(keys,key=>key.startsWith('T:')?
     readState(raw.sharedNormals.states,key.slice(2)):raw.sharedNormals[key]);
    if(!old.every(finite))fail('MISSING_OR_NONFINITE_SHARED_NORMAL');
    const residual=solveTranspose(gaussian.L,old),updated=Float64Array.from(gaussian.mode,(x,i)=>x+residual[i]);
    for(let i=0;i<keys.length;i++)factorDelta[i]=updated[i]-old[i];
    let logWeight=.5*(dot(old,old)-dot(updated,updated))-gaussian.logDeterminant/2;
    const allocated=new Map();
    for(const [state,bag] of bags){
     const uniforms=typeof raw.redrawUniforms?.get==='function'?raw.redrawUniforms.get(state):raw.redrawUniforms?.[state];
     const stateSigns=bag.rows.map(row=>signs.get(row.code)||0);
     const means=bag.rows.map(row=>{
      const value=raw.margins[row.index]-raw.localNormals[row.index]*row.localSD-raw.redrawMargins[row.index]+dot(loadings[row.index],factorDelta);
      if(!finite(value))fail('NONFINITE_CONDITIONAL_MARGIN');return value;
     });
     // Distinct indexed bag items can share the same numerical margin. For a
     // fixed seat their sign probability is identical; memoize only that exact
     // value calculation, preserving indexed slots, p/q and every RNG draw.
     let cachedSeat=-1;const valueScores=new Map();
     const assignment=lookahead.allocateCalledLookahead(bag.values,stateSigns,uniforms,(seat,value,id,sign)=>{
      if(seat!==cachedSeat){cachedSeat=seat;valueScores.clear();}
      if(valueScores.has(value))return valueScores.get(value);
      const score=normalLogCDF(sign*(means[seat]+(value-bag.rows[seat].center)*bag.rows[seat].mix)/bag.rows[seat].localSD);
      valueScores.set(value,score);return score;
     },allocateWithoutReplacement,bag.rows,means,normalLogCDF);
     logWeight+=assignment.logPriorMinusProposal;
     bag.rows.forEach((row,i)=>allocated.set(row.code,(assignment.values[i]-row.center)*row.mix));
    }
    for(const row of rows){
     const i=row.index,redraw=allocated.has(row.code)?allocated.get(row.code):raw.redrawMargins[i];
     const shifted=raw.margins[i]+dot(loadings[i],factorDelta)+redraw-raw.redrawMargins[i];
     if(!finite(shifted))fail('NONFINITE_TRANSPORTED_MARGIN');
     const sign=signs.get(row.code);
     if(sign){
      const conditionalMean=shifted-raw.localNormals[i]*row.localSD;
      if(requiredCalledMarginCodes===null||requiredCalledMarginCodes.has(row.code)){
       const draw=truncateToCalledSign(conditionalMean,row.localSD,sign,raw.localNormals[i]);
       output[i]=draw.margin;logWeight+=draw.logProbability;
      }else{
       // The winner sign is known. Integrate this unused local margin out
       // analytically, preserving the identical call-event normalizer. The
       // original standard local normal was still consumed by the engine.
       // NaN explicitly marks an unmaterialized PRIVATE buffer entry; the
       // engine must never expose it or replace it with a fabricated margin.
       output[i]=NaN;logWeight+=normalLogCDF(sign*conditionalMean/row.localSD);
      }
     }else output[i]=shifted;
    }
    if(!finite(logWeight))fail('NONFINITE_CALL_IMPORTANCE_WEIGHT');
    const nationalIndex=keys.indexOf('N');
    return {margins:output,logWeight,
     nationalNormal:nationalIndex>=0?updated[nationalIndex]:raw.sharedNormals.N,
     conditioning:'VALIDATED_CALL_CONSTRAINT_PROPOSAL_NEEDS_FINAL_WEIGHTING'};
   }});
 }
 function prepare(basis,options={}){const input=optionsAndCalls(basis,options);return input?buildPlan(input):null;}
 function createCache({maximumEntries=4}={}){
  if(!Number.isInteger(maximumEntries)||maximumEntries<1||maximumEntries>MAX_CACHE_ENTRIES)fail('INVALID_CALL_PROPOSAL_CACHE_BOUND');
  let entries=[],hits=0,misses=0;
  return Object.freeze({prepare(basis,options={}){
   const input=optionsAndCalls(basis,options);if(!input)return null;
   const index=entries.findIndex(e=>e.basis===basis&&e.callKey===input.callKey&&e.optionKey===input.optionKey&&e.fingerprint===input.fingerprint);
   if(index>=0){const [entry]=entries.splice(index,1);entries.push(entry);hits++;return entry.plan;}
   const plan=buildPlan(input);entries.push({basis,callKey:input.callKey,optionKey:input.optionKey,fingerprint:input.fingerprint,plan});misses++;
   if(entries.length>maximumEntries)entries.shift();return plan;
  },clear(){entries=[];},stats(){return {entries:entries.length,maximumEntries,hits,misses};}});
 }
 function assessLogWeights(values,{minimumFraction=MINIMUM_EFFECTIVE_SAMPLE_FRACTION}={}){
  if(minimumFraction!==MINIMUM_EFFECTIVE_SAMPLE_FRACTION)fail('CALL_ESS_FLOOR_CANNOT_BE_CHANGED');
  if(!(Array.isArray(values)||ArrayBuffer.isView(values))||!Number.isInteger(values.length)||values.length<300||values.length>30000||
     Array.from(values).some(x=>typeof x!=='number'||Number.isNaN(x)||x===Infinity))fail('INVALID_CALL_IMPORTANCE_WEIGHTS');
  const n=values.length,maximum=Math.max(...values);
  if(maximum===-Infinity)return {status:'WITHHELD_ZERO_PARTICLE_SUPPORT',particle_count:n,minimum_effective_sample_size:n*.5};
  const raw=Float64Array.from(values,x=>Math.exp(x-maximum));
  let sum=0,sum2=0,underflows=0;for(let i=0;i<n;i++){sum+=raw[i];sum2+=raw[i]**2;if(raw[i]===0&&values[i]!==-Infinity)underflows++;}
  const ess=sum*sum/sum2,meta={particle_count:n,effective_sample_size:ess,
   minimum_effective_sample_size:n*.5,max_normalized_weight:1/sum,numerical_underflow_particles:underflows,
   call_weights_tempered:false,interval_calibrated:false};
  if(underflows)return {status:'WITHHELD_NUMERICAL_WEIGHT_UNDERFLOW',...meta};
  if(!finite(ess)||ess<n*.5)return {status:'WITHHELD_LOW_EFFECTIVE_SAMPLE_SUPPORT',...meta};
  return {status:'SUPPORTED',...meta,weights:Float64Array.from(raw,x=>x/sum)};
 }
 function resampleWholeElectionStates(seeds,support){
  // Uniqueness detects duplicate states, not provenance. The coordinator must
  // pair these weights with THIS unweighted proposal/context; an all-unique
  // list alone does not prove that no earlier weighting occurred.
  if(support?.status!=='SUPPORTED'||!support.weights||
     !(Array.isArray(seeds)||Object.prototype.toString.call(seeds)==='[object Uint32Array]')||
     seeds.length!==support.weights.length||seeds.length<300||seeds.length>30000||
     !Array.from(seeds).every(x=>Number.isInteger(x)&&x>0&&x<=4294967295)||new Set(seeds).size!==seeds.length)
   fail('INVALID_OR_DUPLICATED_PRIOR_STATES');
  const weights=support.weights,n=weights.length;
  if(!(Array.isArray(weights)||ArrayBuffer.isView(weights))||typeof weights.reduce!=='function')
   fail('INVALID_NORMALIZED_CALL_WEIGHTS');
  if(Array.from(weights).some(x=>!finite(x)||x<0))fail('INVALID_NORMALIZED_CALL_WEIGHTS');
  const sum=weights.reduce((s,x)=>s+x,0),ess=1/weights.reduce((s,x)=>s+x*x,0);
  if(Math.abs(sum-1)>1e-10||ess<n*.5)fail('RESAMPLING_CANNOT_BYPASS_ESS_FLOOR');
  const selected=new Uint32Array(n),indices=new Uint32Array(n);let index=0,cumulative=weights[0];
  for(let i=0;i<n;i++){
   const position=(i+.5)/n;while(position>cumulative&&index<n-1)cumulative+=weights[++index];
   selected[i]=seeds[index];indices[i]=index;
  }
  return {seeds:selected,source_indices:indices,unique_election_particles:new Set(selected).size,
   method:'SYSTEMATIC_RESAMPLING_WHOLE_ORIGINAL_PROPOSAL_ELECTIONS'};
 }
 function failureDiagnostic(error){return Object.freeze({status:'CALL_CONTEXT_WITHHELD',
  reason:error?.name==='SourceCallConditioningError'?error.code:'UNEXPECTED_CALL_CONDITIONING_FAILURE',
  validated_winner_accounting_must_be_preserved:true,call_weights_tempered:false,
  conditioned_covariance_applied:false,interval_calibrated:false});}
 return Object.freeze({VERSION,MINIMUM_EFFECTIVE_SAMPLE_FRACTION,prepare,createCache,validateExistingCallContract,
  normalCDF,normalLogCDF,normalInverseLogCDF,truncateToCalledSign,
  allocateWithoutReplacement,assessLogWeights,resampleWholeElectionStates,failureDiagnostic});
});

})();
