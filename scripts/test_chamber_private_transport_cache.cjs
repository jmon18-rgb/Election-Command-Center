'use strict';
// Same-source cache enabled/disabled comparisons, using test-only in-memory
// hooks. No old Git checkout, ignored fixture, private CSV or native request.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module'),root=path.resolve(__dirname,'..'),file=path.join(__dirname,'chamber_control_model.js'),source=fs.readFileSync(file,'utf8'),helper=require('./source_call_conditioning.js');
function make({uncached=false,overrideHelper=helper,budget=null}={}){
 const states=[],rng=[],matrices=[],budgets=[];let code=source;
 const once=(a,b)=>{assert.equal(code.split(a).length,2,'Unique private test hook');code=code.replace(a,b);};
 if(budget!==null)once('TRANSPORT_CACHE_MAX_BYTES=64*1024*1024','TRANSPORT_CACHE_MAX_BYTES='+budget);
 if(uncached)once('const reservation=reserveTransport(cacheBytes);','const reservation=null;');
 once('keepTransport(state,raw.call_proposal_draws.transport_margins,reservation);','keepTransport(state,raw.call_proposal_draws.transport_margins,reservation);observeState(state);');
 once('houseSeatDraws.push(dHouse);','houseSeatDraws.push(dHouse);observeRng(rands.state());');
 once('states:stateDeltas}},{requiredCalledMarginCodes:callRequiredMargins});','states:stateDeltas}},{requiredCalledMarginCodes:callRequiredMargins});observeMatrix(moved.margins);');
 for(const hook of ['transportCacheReservedBytes+=bytes;','reservation.active=false;','transportCacheBytes+=values.byteLength;'])once(hook,hook+'observeBudget({retained:transportCacheBytes,reserved:transportCacheReservedBytes,maximum:TRANSPORT_CACHE_MAX_BYTES});');
 const mod={exports:{}},req=createRequire(file);new Function('require','module','exports','observeState','observeRng','observeMatrix','observeBudget',code)(
  name=>name==='./source_call_conditioning.js'?overrideHelper:req(name),mod,mod.exports,state=>states.push(state),state=>rng.push(state),
  values=>matrices.push(new Uint32Array(new Float64Array(values).buffer)),row=>budgets.push(row));return {engine:mod.exports,states,rng,matrices,budgets};
}
const a=make({uncached:true}),b=make(),basis=require('./fictional_call_basis.cjs')({largeBags:true}),live={
 'IA-SEN':{mode:'source_called',winnerParty:'D'},'NE-SEN':{mode:'source_called',winnerParty:'R'},'MI-07':{mode:'source_called',winnerParty:'D'},'FICTION-FL-02':{mode:'source_called',winnerParty:'R'}},
 base={samples:300,seed:20261103,independentSenateCredit:'no_credit',contextKey:'FICTIONAL_CACHE',live,marginSummaryCodes:['IA-SEN','ME-SEN','MI-07','NE-SEN']};
let cases=0,comparedWords=0,comparedNaNs=0;
for(const extra of [{},{captureCountyDraws:['IA-SEN','NE-SEN','MI-07']},{captureCountyDraws:['IA-SEN','NE-SEN','MI-07'],explainControl:true,
 voteSeatWeights:basis.house.map(row=>({race_code:row.code,reference_two_party_votes:25000}))}]){
 a.rng.length=0;b.rng.length=0;a.matrices.length=0;b.matrices.length=0;
 const args={...base,...extra},pa=a.engine.proposeSourceCallElections(basis,args),pb=b.engine.proposeSourceCallElections(basis,args);assert.deepEqual(pb,pa);assert.deepEqual(b.rng,a.rng);
 assert(b.states.at(-1).transportCache,'This comparison must exercise a real private cache');
 const county=extra.captureCountyDraws?Float64Array.from(pb.call_log_weights,(_,i)=>-.01*(pb.county_draws.margins['NE-SEN'][i]-1)**2):null,
  target={contextKey:base.contextKey,...(county?{conditioning:'CALL_AND_COUNTY_IMPORTANCE_RESAMPLED',countyLogLikelihood:county,countyLikelihoodPower:.7}:{})};
 a.rng.length=0;b.rng.length=0;a.matrices.length=0;b.matrices.length=0;
 const ra=a.engine.finalizeSourceCallElections(pa,target),rb=b.engine.finalizeSourceCallElections(pb,target);assert.equal(rb.status,'CONDITIONED');assert.deepEqual(rb,ra);assert.deepEqual(b.rng,a.rng,'Every original replay RNG draw/order remains exact');
 assert.equal(b.states.at(-1).transportCache,null,'Owning finalizer releases its matrix');assert.equal(a.matrices.length,300);assert.equal(b.matrices.length,300);
 let differences=0;for(let i=0;i<300;i++)for(let j=0;j<a.matrices[i].length;j++){comparedWords++;if(a.matrices[i][j]!==b.matrices[i][j])differences++;}assert.equal(differences,0,'Every called/uncalled Float64 word and NaN mask remains exact');
 for(const row of a.matrices)for(const value of new Float64Array(row.buffer))if(Number.isNaN(value))comparedNaNs++;
 assert(!JSON.stringify(pb).includes('transport_margins'));assert(!JSON.stringify(rb).includes('transportCache'));cases++;
}
assert(comparedNaNs>0);assert.deepEqual(Object.keys(b.engine),Object.keys(a.engine));assert.equal(b.engine.replaySourceCallElections,undefined);
// Intentionally unfinalized RAW callers remain capped; eviction recomputes the
// same law. The pending reservation is counted BEFORE allocating the next row.
const packets=[];for(let i=0;i<6;i++)packets.push(b.engine.proposeSourceCallElections(basis,{...base,samples:3000,contextKey:'FICTIONAL_LRU_'+i}));
assert.equal(b.states.at(-6).transportCache,null);for(const row of b.budgets){assert(row.retained>=0&&row.reserved>=0);assert(row.retained+row.reserved<=row.maximum);}
assert(b.states.reduce((sum,state)=>sum+(state.transportCache?.byteLength||0),0)<=64*1024*1024);
const evicted=b.engine.finalizeSourceCallElections(packets[0],{contextKey:'FICTIONAL_LRU_0'}),reference=a.engine.simulate(basis,{...base,samples:3000,contextKey:'FICTIONAL_LRU_0'});assert.deepEqual(evicted.result,reference);
for(const field of ['call_log_weights','seeds']){const packet=b.engine.proposeSourceCallElections(basis,base);packet[field][0]+=1;assert.throws(()=>b.engine.finalizeSourceCallElections(packet,{contextKey:base.contextKey}),error=>error.code==='INVALID_OR_MUTATED_RAW_CALL_PACKET');assert.equal(b.states.at(-1).transportCache,null);}
const ctx=b.engine.proposeSourceCallElections(basis,base);assert.throws(()=>b.engine.finalizeSourceCallElections(ctx,{contextKey:'OTHER'}),error=>error.code==='INVALID_CALL_FINALIZATION_CONTEXT');assert.equal(b.states.at(-1).transportCache,null);
const forged=b.engine.proposeSourceCallElections(basis,base);assert.throws(()=>b.engine.finalizeSourceCallElections({...forged},{contextKey:base.contextKey}),error=>error.code==='INVALID_OR_MUTATED_RAW_CALL_PACKET');
const corrupt=b.engine.proposeSourceCallElections(basis,base);b.states.at(-1).transportCache[0]=12345;assert.throws(()=>b.engine.finalizeSourceCallElections(corrupt,{contextKey:base.contextKey}),error=>error.code==='PRIVATE_TRANSPORT_CACHE_INTEGRITY_FAILED');assert.equal(b.states.at(-1).transportCache,null);
const duplicate=b.engine.proposeSourceCallElections(basis,base);b.states.at(-1).seeds[1]=b.states.at(-1).seeds[0];assert.throws(()=>b.engine.finalizeSourceCallElections(duplicate,{contextKey:base.contextKey}),error=>error.code==='INVALID_OR_DUPLICATED_PRIOR_STATES');assert.equal(b.states.at(-1).transportCache,null);
const badSelector=Object.freeze({...helper,resampleWholeElectionStates(seeds,support){const selected=helper.resampleWholeElectionStates(seeds,support);selected.source_indices[0]=(selected.source_indices[0]+1)%seeds.length;return selected;}}),c=make({overrideHelper:badSelector}),wrong=c.engine.proposeSourceCallElections(basis,base);
assert.throws(()=>c.engine.finalizeSourceCallElections(wrong,{contextKey:base.contextKey}),error=>error.code==='PRIVATE_TRANSPORT_CACHE_INTEGRITY_FAILED');assert.equal(c.states.at(-1).transportCache,null);
const lifetime=make(),packet=lifetime.engine.proposeSourceCallElections(basis,{...base,captureCountyDraws:['IA-SEN']}),first=lifetime.engine.finalizeSourceCallElections(packet,{contextKey:base.contextKey});assert.equal(first.status,'CONDITIONED');assert.equal(lifetime.states.at(-1).transportCache,null);
assert.deepEqual(lifetime.engine.finalizeSourceCallElections(packet,{contextKey:base.contextKey}),first,'Retained RAW packet later recomputes exactly');
const low=lifetime.engine.proposeSourceCallElections(basis,{...base,captureCountyDraws:['IA-SEN']}),L=new Float64Array(300).fill(-50);L[0]=0;
assert.equal(lifetime.engine.finalizeSourceCallElections(low,{contextKey:base.contextKey,conditioning:'CALL_AND_COUNTY_IMPORTANCE_RESAMPLED',countyLogLikelihood:L,countyLikelihoodPower:1}).status,'WITHHELD');assert.equal(lifetime.states.at(-1).transportCache,null);
const defaults=lifetime.engine.proposeSourceCallElections(basis,{...base,samples:undefined});assert.equal(defaults.samples,4000);assert.equal(lifetime.states.at(-1).transportCache.byteLength,4000*476*8);lifetime.engine.finalizeSourceCallElections(defaults,{contextKey:base.contextKey});assert.equal(lifetime.states.at(-1).transportCache,null);
const small=make({budget:8*1024*1024}),uncached=small.engine.proposeSourceCallElections(basis,{...base,samples:3000});assert.equal(small.states.at(-1).transportCache,null);assert.equal(small.engine.finalizeSourceCallElections(uncached,{contextKey:base.contextKey}).status,'CONDITIONED');
const throwing=Object.freeze({...helper,createCache(params){const inner=helper.createCache(params);return {...inner,prepare(b,o){const plan=inner.prepare(b,o);return plan?{...plan,transport(){const error=Error('TEST_ONLY_FAILURE');error.code='TEST_ONLY_FAILURE';throw error;}}:null;}};}}),failure=make({overrideHelper:throwing});
assert.throws(()=>failure.engine.proposeSourceCallElections(basis,base),error=>error.code==='TEST_ONLY_FAILURE');assert.equal(failure.budgets.at(-1).reserved,0);
assert.deepEqual(b.engine.simulate(basis,{samples:300,seed:20261103,independentSenateCredit:'no_credit'}),a.engine.simulate(basis,{samples:300,seed:20261103,independentSenateCredit:'no_credit'}));
const out=path.join(root,'artifacts/readiness');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'private-transport-cache-proof.json'),JSON.stringify({schema:'private-transport-cache-portable-proof-v1',status:'PASS',cases,
 raw_replay_words_compared:comparedWords,nan_entries_compared:comparedNaNs,all_rng_and_raw_replay_and_complete_consumers_exact:true,
 reachable_matrix_buffer_limit:64*1024*1024,total_heap_or_rss_bound:false,reservation_before_allocation_and_error_release:true,
 success_withholding_and_error_release:true,default4000_exact:true,eviction_and_later_raw_recompute_exact:true,public_api_unchanged:true,
 context_seed_index_duplicate_and_corruption_rejected:true,scope:'Fictional same-source enabled/disabled cache tests. Hooks exist only in this test compilation.'},null,2)+'\n');
console.log('Private cache PASS: exact RNG/raw masks/consumers, pre-allocation budget and lifetime, safe eviction/recompute, integrity/context/index guards and no new API.');
