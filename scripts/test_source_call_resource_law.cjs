'use strict';
// Independent bounded numerical oracles. Every race/matrix value is fictional;
// no native requests, private inputs, fitted coefficients or calibration claim.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..'),helper=require('./source_call_conditioning.js'),source=fs.readFileSync(path.join(__dirname,'source_call_conditioning.js'),'utf8');
function inspect(Float64=Float64Array,{fullReverse=false,onReverseBound=null}={}){
 const marker='const recordGuide=()=>{};';assert.equal(source.split(marker).length,2,'Unique test-only private guide hook');
 let compiled=source;
 if(fullReverse){const pruned='}else for(let j=pruneReverse?Math.max(0,A-n+i):0,jEnd=pruneReverse?Math.min(A,i):A;j<=jEnd;j++)for(let k=pruneReverse?Math.max(0,B-n+i,A+B-n+i-j):0,kEnd=pruneReverse?Math.min(B,i-j):B;k<=kEnd;k++){';
  assert.equal(compiled.split(pruned).length,2,'Unique optimized reverse-loop reference hook');compiled=compiled.replace(pruned,'}else for(let j=0;j<=A;j++)for(let k=0;k<=B;k++){');}
 if(onReverseBound){const point='let adjoint=work.adjA;';assert.equal(compiled.split(point).length,2);compiled=compiled.replace(point,'observeReverseBound(pruneReverse);'+point);}
 const mod={exports:{}};let privateApi;
 new Function('module','exports','capture','Float64Array','observeReverseBound',compiled.replace(marker,marker+'capture({partition:redrawPartition.partition,allocate:lookahead.allocateCalledLookahead});'))(mod,mod.exports,value=>privateApi=value,Float64,onReverseBound);
 assert.deepEqual(Object.keys(mod.exports),Object.keys(helper),'Instrumentation cannot add a production API');return privateApi;
}
const api=inspect(),close=(a,b,tol=1e-11)=>assert(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)));
function coefficient(weights,counts){let sum=0;function visit(i,left,value){if(i===weights.length){if(left.every(x=>x===0))sum+=value;return;}for(let c=0;c<3;c++)if(left[c]){left[c]--;visit(i+1,left,value*weights[i][c]);left[c]++;}}visit(0,counts.slice(),1);return sum;}
let coefficientCases=0;
for(let n=2;n<=7;n++)for(let d=0;d<n;d++)for(let r=0;r<n-d;r++){
 const counts=[d,r,n-1-d-r],weights=Array.from({length:n},(_,i)=>[(i+1)/(n+2),(n-i)/(n+1),1]),actual=api.partition(weights,counts,{leaveOneOut:true});
 for(let i=0;i<n;i++)close(Math.exp(actual.logGradients[i]+actual.logCommonScale),coefficient(weights.filter((_,j)=>i!==j),counts));coefficientCases++;
}
// The optimized reverse traversal may omit only exact-zero terms. Compare
// every returned bit and every numerical rejection with the original full
// reverse traversal compiled in RAM from this same helper, never old Git data.
const fullReverse=inspect(Float64Array,{fullReverse:true});let exactReverseCases=0,exactReverseRejections=0;
function compareReverse(weights,counts,options){let wanted,actual,oldError,newError;try{wanted=fullReverse.partition(weights,counts,options);}catch(error){oldError=error;}try{actual=api.partition(weights,counts,options);}catch(error){newError=error;}
 assert.equal(Boolean(newError),Boolean(oldError),'Pruning preserves numerical-support outcome');if(oldError){assert.equal(newError.code,oldError.code);assert.equal(newError.message,oldError.message);exactReverseRejections++;}else assert.deepEqual(actual,wanted,'All coefficient/gradient bits and scale/order remain exact');exactReverseCases++;}
for(let n=2;n<=10;n++)for(let d=0;d<n;d++)for(let r=0;r<n-d;r++)for(const relativeOnly of [false,true])compareReverse(Array.from({length:n},(_,i)=>[(i+1)/(n+2),(n-i)/(n+1),1]),[d,r,n-1-d-r],{leaveOneOut:true,relativeOnly});
for(const n of [28,38,52,64])for(const counts of [[Math.floor(n/3)-1,Math.floor(n/3),n-2*Math.floor(n/3)],[0,0,n-1],[n-3,1,1],[2,n-5,2]]){
 const weights=Array.from({length:n},(_,i)=>[.001+(i%13)/15,.002+((i*7)%19)/22,1]);for(const relativeOnly of [false,true])compareReverse(weights,counts,{leaveOneOut:true,relativeOnly});compareReverse(weights,[counts[0]+1,counts[1],counts[2]],{});}
for(const small of [Number.MIN_VALUE,1e-320,1e-300,1e-200,1e-100])for(const n of [8,20,52])for(const mode of ['same','uneven','mixed'])for(const relativeOnly of [false,true])compareReverse(Array.from({length:n},(_,i)=>mode==='same'?[small,small,small]:mode==='uneven'?[i%2?small:1,small,small]:[small,.25+(i%3)*.25,1]),[Math.floor(n/3)-1,Math.floor(n/3),n-2*Math.floor(n/3)],{leaveOneOut:true,relativeOnly});
const reverseDecisions=[],observedReverse=inspect(Float64Array,{onReverseBound:value=>reverseDecisions.push(value)});
for(const small of [1e-40,1e-45,1e-50,1e-51,1e-52,1e-53]){const weights=Array.from({length:8},()=>[small,small,1]),counts=[3,2,2],options={leaveOneOut:true};assert.deepEqual(observedReverse.partition(weights,counts,options),fullReverse.partition(weights,counts,options),'Conservative numerical fallback retains accepted tiny-weight outputs exactly');}
assert(reverseDecisions.includes(false),'Accepted tiny-weight cases exercise the original full-loop fallback');assert(reverseDecisions.includes(true));
// Exercise the memory guard directly through test-only instrumentation. This
// request is rejected before any DP Float64 array, including its first row.
const allocations=[],observed=new Proxy(Float64Array,{construct(target,args){allocations.push(args[0]);return Reflect.construct(target,args);}}),bounded=inspect(observed);
assert.throws(()=>bounded.partition(Array.from({length:435},()=>[.4,.6,1]),[145,145,145]),error=>error.code==='REDRAW_WORKSPACE_MEMORY_BOUND');
assert.equal(allocations.length,0,'Oversized single workspace cannot be allocated');
const permutations=values=>values.length?values.flatMap((x,i)=>permutations(values.filter((_,j)=>i!==j)).map(rest=>[x,...rest])):[[]];
function lawFor(values,signs,rows,means,slots){
 const members=[signs.map((s,i)=>s>0?i:null).filter(i=>i!==null),signs.map((s,i)=>s<0?i:null).filter(i=>i!==null)];
 const actual=(seat,id)=>Math.exp(helper.normalLogCDF(signs[seat]*(means[seat]+values[id])/rows[seat].localSD));
 // Independently moment-match the known equal-weight Normal mixture. Future
 // named assignments are then enumerated, rather than using the production DP.
 const futureGuide=(category,id)=>{const group=members[category];if(!group.length)return 1;const mu=group.reduce((sum,i)=>sum+means[i]+values[id],0)/group.length,
  variance=group.reduce((sum,i)=>sum+rows[i].localSD**2+(means[i]+values[id]-mu)**2,0)/group.length;
  return Math.exp(helper.normalLogCDF((category===0?1:-1)*mu/Math.sqrt(variance)));};
 const remaining=values.map((_,i)=>i),uniforms=[];let q=1;
 for(let seat=0;seat<values.length;seat++)if(signs[seat]){
  const future=signs.map((s,i)=>s&&i>seat?i:null).filter(i=>i!==null),weights=remaining.map(id=>{
   const rest=remaining.filter(other=>other!==id),paths=permutations(rest);let mass=0;
   for(const assignment of paths){let product=1;for(let i=0;i<future.length;i++)product*=futureGuide(signs[future[i]]>0?0:1,assignment[i]);mass+=product;}
   return actual(seat,id)*mass;
  }),sum=weights.reduce((a,b)=>a+b,0),chosen=remaining.indexOf(slots[seat]);assert(chosen>=0);q*=weights[chosen]/sum;
  if(remaining.length>1){let lower=0;for(let i=0;i<chosen;i++)lower+=weights[i]/sum;uniforms.push(lower+weights[chosen]/sum/2);}remaining.splice(chosen,1);
 }
 const uncalled=signs.map((s,i)=>s?null:i).filter(i=>i!==null),desired=uncalled.map(i=>slots[i]).reverse();
 for(let z=remaining.length-1;z>0;z--){const chosen=remaining.indexOf(desired[z]);assert(chosen>=0&&chosen<=z);uniforms.push((chosen+.5)/(z+1));q/=z+1;[remaining[z],remaining[chosen]]=[remaining[chosen],remaining[z]];}
 return {q,uniforms,likelihood:slots.reduce((p,id,seat)=>p*(signs[seat]?actual(seat,id):1),1)};
}
const lawCases=[];
for(const signs of [[1,-1,1,-1],[1,0,-1,1,0,-1]])for(const identical of [false,true]){
 const n=signs.length,values=n===4?[-2,-2,1,3]:[-3,-3,0,1,2,4],means=signs.map((s,i)=>identical?s*.3:i*.4-.5),rows=signs.map((_,i)=>({mix:1,center:0,localSD:identical?2:1.7+i*.12})),paths=permutations(values.map((_,i)=>i)),prior=1/paths.length;
 let qSum=0,wanted=0,weighted=0,low=Infinity,high=-Infinity;
 for(const slots of paths){const expected=lawFor(values,signs,rows,means,slots),draw=api.allocate(values,signs,expected.uniforms,(seat,value)=>helper.normalLogCDF(signs[seat]*(means[seat]+value)/rows[seat].localSD),helper.allocateWithoutReplacement,rows,means,helper.normalLogCDF),correction=Math.exp(draw.logPriorMinusProposal);
  assert.deepEqual(Array.from(draw.slots),slots);assert.equal(draw.uniformsConsumed,n-1);close(correction,prior/expected.q);
  qSum+=expected.q;wanted+=prior*expected.likelihood;weighted+=expected.q*correction*expected.likelihood;low=Math.min(low,correction*expected.likelihood);high=Math.max(high,correction*expected.likelihood);
 }
 close(qSum,1);close(weighted,wanted);if(identical)assert(high-low<1e-12,'Identical group guide is the exact indexed conditional law');
 lawCases.push({seats:n,paths:paths.length,partial:signs.includes(0),heterogeneous:!identical,indexed_target_exact:true,remaining_uncalled_uniform:true});
}
const values=[-2,-2,1,3],uniforms=[.13,.77,.42],unused=()=>{throw Error('Uncalled score must not be requested');};
assert.deepEqual(api.allocate(values,[0,0,0,0],uniforms,unused,helper.allocateWithoutReplacement,[],[],helper.normalLogCDF),helper.allocateWithoutReplacement(values,[0,0,0,0],uniforms,unused));
const out=path.join(root,'artifacts/readiness');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'source-call-resource-law.json'),JSON.stringify({schema:'source-call-resource-law-proof-v1',status:'PASS',coefficientCases,lawCases,
 oversized_workspace_rejected_before_float64_allocation:true,old_uncalled_uniform_rng_exact:true,no_fitted_coefficients_or_call_tempering:true,
 exact_pruned_full_reverse_cases:exactReverseCases,exact_pruned_full_reverse_rejections:exactReverseRejections,accepted_tiny_weight_original_loop_fallback:true,
 private_test_hooks_only_no_production_api_added:true,scope:'Independent fictional coefficient/indexed law evidence, not predictive calibration.'},null,2)+'\n');
console.log('Resource law PASS: independent positive coefficient/gradient oracle, full/partial indexed law with duplicates, unchanged target/RNG and pre-allocation memory guard.');
