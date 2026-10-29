'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const engine=require('./chamber_control_model.js'),helper=require('./source_call_conditioning.js');
const fixture=require('./fictional_call_basis.cjs'),basis=fixture(),large=fixture({largeBags:true});
const base={samples:3000,seed:19760408,independentSenateCredit:'no_credit',
 marginSummaryCodes:['IA-SEN','TX-SEN','OH-SEN','ME-SEN','NE-SEN','MI-07']};
const get=(out,code)=>out.race_probabilities.find(row=>row.race_code===code);
const stripCall=({source_call_conditioning,...result})=>result;
// Captured from the pre-call-conditioning engine with this FIXED FICTIONAL
// fixture. No dynamic/private source input enters these whole-output hashes.
const noCallHashes=[
 'f46527b0f943facbc9dc4e9ecfd739b279e0024940814d2e92bfd4732338404e',
 'c2037701fbaa8a1fef137b99242359dac6d869f96a99ab34c8b708a412788b9c',
 'c5731a0f4b03279bd0efa72b65c3aed2bfa5f422bc02eb092ebedd499804b28d',
 '394481f8a1d7a21f7b0f82214ae92cbab643b776f11e8e0552dd44d3d1e7e176',
 'ea4fcee4652987742be115da5bcc16b2791c6409f08511f23bbf769c47a9ea84'];
const outputHash=result=>crypto.createHash('sha256').update(JSON.stringify(result)).digest('hex');
for(const [index,options] of [{},{explainControl:true},{errorMultiplier:.6,nationalShift:-2},
 {errorMultiplier:1.7,nationalShift:4},{senateCorrelationResearch:{nationalScale:.5,chamberScale:.7}}].entries()){
 assert.equal(outputHash(engine.simulate(basis,{...base,...options})),noCallHashes[index],
  'No-call complete output/random stream must remain exactly original');
}
const live={'IA-SEN':{mode:'source_called',winnerParty:'D'}};
const packet=engine.proposeSourceCallElections(basis,{...base,live,captureCountyDraws:['IA-SEN','ME-SEN','MI-07']});
assert.equal(packet.status,'RAW_PROPOSAL_NOT_A_FORECAST');
for(const key of ['probabilities','counts','race_probabilities','means','seat_intervals_90_pct'])assert.equal(packet[key],undefined);
assert.equal(packet.proposal_only,true);assert.equal(packet.has_usable_headline_probabilities,false);
assert(packet.county_draws.margins['IA-SEN'].every(x=>x>0));
const support=helper.assessLogWeights(packet.call_log_weights);assert.equal(support.status,'SUPPORTED');
const resampled=helper.resampleWholeElectionStates(packet.seeds,support);
const finalized=engine.finalizeSourceCallElections(packet),posterior=finalized.result;
assert.equal(finalized.status,'CONDITIONED');assert.equal(finalized.support.weights,undefined);
assert.equal(engine.replaySourceCallElections,undefined,'Unweighted or arbitrary selected states cannot be published as CONDITIONED');
assert.equal(posterior.source_call_conditioning.status,'CONDITIONED');
assert.equal(posterior.source_call_conditioning.evidence_kind,'VALIDATED_CALLS_ONLY');
assert.equal(posterior.source_call_conditioning.baseline_kind,'NO_CALL_NO_COUNT_POLLING_BASELINE');
assert.equal(get(posterior,'IA-SEN').dem_beats_rep_pct,100);
assert.equal(get(posterior,'IA-SEN').margin_distribution,null);
assert.equal(get(posterior,'ME-SEN').margin_distribution.conditioning,'VALIDATED_CALL_IMPORTANCE_RESAMPLED');
const plain=engine.simulate(basis,base),direct=engine.simulate(basis,{...base,live});
assert.equal(direct.source_call_conditioning.status,'CONDITIONED');
assert(get(direct,'ME-SEN').dem_beats_rep_pct>get(plain,'ME-SEN').dem_beats_rep_pct,
 'A validated uncertain winner must inform other races through existing shared covariance');
assert.equal(direct.source_call_conditioning.weights,undefined,'Public result cannot leak raw proposal weights');
const reversed=engine.simulate(basis,{...base,live:{'IA-SEN':{mode:'source_called',winnerParty:'R'}}});
assert(get(reversed,'ME-SEN').dem_beats_rep_pct<get(plain,'ME-SEN').dem_beats_rep_pct);
assert.deepEqual(engine.simulate(basis,{...base,live:{}}),plain,'Call withdrawal resets the original target exactly');

// Actual original RNG-state replay after the authenticated internal weighting
// gate, including repeated selected states. An independent public resampling
// calculation only predicts its indices; it cannot authorize a model replay.
const indices=Array.from(resampled.source_indices),replay=posterior;
const replayAgain=engine.finalizeSourceCallElections(packet).result;
assert.deepEqual(replayAgain,replay);
for(const code of packet.county_draws.codes){
 const values=indices.map(i=>packet.county_draws.margins[code][i]).sort((a,b)=>a-b),row=get(replay,code);
 if(row.provider_called_party)assert.equal(row.margin_distribution,null);
 else{
  assert.equal(row.margin_distribution.p05,Math.round(values[Math.floor(2999*.05)]*1000)/1000);
  assert.equal(row.margin_distribution.p50,Math.round(values[Math.floor(2999*.5)]*1000)/1000);
  assert.equal(row.margin_distribution.p95,Math.round(values[Math.floor(2999*.95)]*1000)/1000);
 }
}
assert.equal(replay.source_call_conditioning.unique_election_particles,new Set(indices).size);
assert.throws(()=>engine.finalizeSourceCallElections({...packet}),error=>error.code==='INVALID_OR_MUTATED_RAW_CALL_PACKET');
assert.throws(()=>engine.finalizeSourceCallElections(packet,{contextKey:'ANOTHER_CONTEXT'}),error=>error.code==='INVALID_CALL_FINALIZATION_CONTEXT');
const mutable=fixture(),mutablePacket=engine.proposeSourceCallElections(mutable,{...base,live});
mutable.senate[0].mean+=1;
assert.throws(()=>engine.finalizeSourceCallElections(mutablePacket),error=>error.code==='INVALID_OR_MUTATED_RAW_CALL_PACKET');
const frozenLive={'IA-SEN':{mode:'source_called',winnerParty:'D'}},snapshotPacket=engine.proposeSourceCallElections(basis,{...base,live:frozenLive});
frozenLive['IA-SEN'].winnerParty='R';
assert.equal(get(engine.finalizeSourceCallElections(snapshotPacket).result,'IA-SEN').dem_beats_rep_pct,100,
 'Caller mutation must not silently change the typed proposal target before replay');
for(const field of ['seeds','call_log_weights','margins']){
 const damaged=engine.proposeSourceCallElections(basis,{...base,live,captureCountyDraws:['ME-SEN']});
 const target=field==='margins'?damaged.county_draws.margins['ME-SEN']:damaged[field];target[0]+=1;
 assert.throws(()=>engine.finalizeSourceCallElections(damaged),error=>error.code==='INVALID_OR_MUTATED_RAW_CALL_PACKET',field+' cannot alter the private weighting target');
}
const countyTarget=Float64Array.from({length:base.samples},(_,i)=>-.01*(packet.county_draws.margins['ME-SEN'][i]-3)**2);
const jointOptions={countyLogLikelihood:countyTarget,countyLikelihoodPower:.7,conditioning:'CALL_AND_COUNTY_IMPORTANCE_RESAMPLED'};
const joint=engine.finalizeSourceCallElections(packet,jointOptions);assert.equal(joint.status,'CONDITIONED');
assert.equal(joint.result.source_call_conditioning.evidence_kind,'VALIDATED_CALLS_AND_COUNTY_RETURNS');
const jointSupport=helper.assessLogWeights(Float64Array.from(packet.call_log_weights,(v,i)=>v+.7*countyTarget[i]));
assert.equal(joint.support.effective_sample_size,jointSupport.effective_sample_size,'Private call weights and one county likelihood are combined exactly once');
assert.throws(()=>engine.finalizeSourceCallElections(packet,{countyLogLikelihood:countyTarget}),error=>error.code==='CALLS_ONLY_CANNOT_APPLY_COUNTY_LIKELIHOOD');
assert.throws(()=>engine.finalizeSourceCallElections(packet,{...jointOptions,countyLikelihoodPower:1.1}),error=>error.code==='INVALID_COUNTY_FINALIZATION_TARGET');
assert.throws(()=>engine.finalizeSourceCallElections(packet,{...jointOptions,countyLogLikelihood:new Float64Array(base.samples).fill(1)}),error=>error.code==='UNBOUNDED_COUNTY_FINALIZATION_TARGET');
const impossibleSupport=new Float64Array(base.samples).fill(-50);impossibleSupport[0]=0;
const gated=engine.finalizeSourceCallElections(packet,{...jointOptions,countyLogLikelihood:impossibleSupport,countyLikelihoodPower:1});
assert.equal(gated.status,'WITHHELD');assert.equal(gated.reason,'WITHHELD_LOW_EFFECTIVE_SAMPLE_SUPPORT');assert.equal(gated.result,undefined);

// Explicit withholding preserves existing verified winner accounting. There is
// no invented call-error floor or probability tempering for impossible states.
const deterministic=fixture();deterministic.senate[0].sigma=0;deterministic.senate[0].mean=-100;
const withheld=engine.simulate(deterministic,{...base,live});
assert.equal(withheld.source_call_conditioning.status,'WITHHELD');
assert.equal(withheld.source_call_conditioning.reason,'DEGENERATE_CALLED_LOCAL_ERROR_UNSUPPORTED');
assert.equal(get(withheld,'IA-SEN').dem_beats_rep_pct,100);
assert.equal(outputHash(stripCall(withheld)),'cd0519b1348a37d32d89cd8d7cd5ad77ee39f99fa170e421dbb4f787ad895d0a',
 'Unsupported covariance must preserve every original winner-accounting output');
const positiveIndependent=engine.simulate(basis,{...base,live:{'NE-SEN':{mode:'source_called',winnerParty:'D'}}});
assert.equal(positiveIndependent.source_call_conditioning.status,'WITHHELD');
assert.equal(positiveIndependent.source_call_conditioning.excluded_call_count,1);
assert.equal(get(positiveIndependent,'NE-SEN').provider_called_party,null);
assert.throws(()=>engine.proposeSourceCallElections(basis,{...base,live:{'NE-SEN':{mode:'source_called',winnerParty:'D'}}}),
 error=>error.code==='INDEPENDENT_WIN_CANNOT_BE_RELABELLED_DEMOCRATIC');
const otherParty=engine.simulate(basis,{...base,live:{'IA-SEN':{mode:'source_called',winnerParty:'O'}}});
assert.equal(get(otherParty,'IA-SEN').provider_called_party,null);
assert.equal(otherParty.source_call_conditioning.excluded_call_count,1);
const mixedInvalid=engine.simulate(basis,{...base,live:{...live,'NE-SEN':{mode:'source_called',winnerParty:'D'}}});
assert.equal(get(mixedInvalid,'IA-SEN').provider_called_party,'D');
assert.equal(get(mixedInvalid,'NE-SEN').provider_called_party,null);
assert.equal(mixedInvalid.source_call_conditioning.conditioned_covariance_applied,false);
const untyped=engine.simulate(basis,{...base,live,captureCountyDraws:['IA-SEN']});
assert.equal(untyped.source_call_conditioning.status,'WITHHELD');
assert.equal(untyped.source_call_conditioning.reason,'UNTYPED_CALL_CAPTURE_OR_REPLAY_WITHHELD');

// Optional vote-seat/attribution consumers must use the exact transported
// elections, while adding no random draws or separate weighting.
const voteWeights=large.house.map(row=>({race_code:row.code,reference_two_party_votes:25000}));
const largeLive={'FICTION-FL-01':{mode:'source_called',winnerParty:'D'},
 'FICTION-FL-02':{mode:'source_called',winnerParty:'R'},'FICTION-TX-01':{mode:'source_called',winnerParty:'R'}};
const largeBase={...base,marginSummaryCodes:['IA-SEN','ME-SEN','MI-07'],live:largeLive};
const p0=engine.proposeSourceCallElections(large,largeBase);
const p1=engine.proposeSourceCallElections(large,{...largeBase,explainControl:true,voteSeatWeights:voteWeights});
assert.deepEqual(p0.seeds,p1.seeds);assert.deepEqual(p0.call_log_weights,p1.call_log_weights);
const s=helper.assessLogWeights(p0.call_log_weights);assert.equal(s.status,'SUPPORTED');
const simple=engine.finalizeSourceCallElections(p0).result,explained=engine.finalizeSourceCallElections(p1).result;
const {control_explanation,vote_seat_explanation,...withoutOptional}=explained;
assert.deepEqual(withoutOptional,simple,'Optional consumers must not change any conditional election output');
assert.equal(vote_seat_explanation.status,'EXPERIMENTAL_VOTE_SEAT_REFERENCE_WEIGHTED_NOT_ACTUAL_2026_VOTE');
assert.equal(control_explanation.both_dem_pct,explained.actual_dem_both_control_pct);

// Error-scaling/national-shift and existing research correlation options change
// proposal coefficients correctly. Compare a two-Senate-race conditional mean
// with the closed-form joint-normal result, not the proposal's own formula.
for(const options of [{},{errorMultiplier:.6,nationalShift:-2},{errorMultiplier:1.7,nationalShift:4},
 {senateCorrelationResearch:{nationalScale:.5,chamberScale:.7}}]){
 const x={...base,...options,samples:6000,live,captureCountyDraws:['ME-SEN']};
 const p=engine.proposeSourceCallElections(basis,x),w=helper.assessLogWeights(p.call_log_weights);assert.equal(w.status,'SUPPORTED');
 const values=p.county_draws.margins['ME-SEN'],mean=values.reduce((sum,value,i)=>sum+w.weights[i]*value,0);
 const mcse=Math.sqrt(values.reduce((sum,value,i)=>sum+w.weights[i]**2*(value-mean)**2,0));
 const m=options.errorMultiplier??1,shift=options.nationalShift??0,corr=options.senateCorrelationResearch;
 const sigmaA=Math.sqrt(5.5**2+3.5**2+3**2+3.5**2)*m;
 const covariance=((3.5*(corr?.nationalScale??1))**2+(3*(corr?.chamberScale??1))**2)*m*m;
 const k=shift/sigmaA,phi=Math.exp(-k*k/2)/Math.sqrt(2*Math.PI);
 const expected=1+shift+covariance/sigmaA*phi/helper.normalCDF(k);
 assert(Math.abs(mean-expected)<8*mcse+1e-8,'Conditional cross-Senate mean must match Gaussian identity');
}

// Missing optional helper in a browser-like realm leaves the no-call model
// usable and explicitly withholds call covariance, not an unweighted headline.
const browser={window:{},console,Map,Set,Float64Array,Uint32Array,Uint16Array,Uint8Array};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'chamber_control_model.js'),'utf8'),browser);
assert.equal(JSON.stringify(browser.window.ChamberControlModel.simulate(basis,base)),JSON.stringify(plain));
const helperMissing=browser.window.ChamberControlModel.simulate(basis,{...base,live});
assert.equal(helperMissing.source_call_conditioning.status,'WITHHELD');
assert.equal(helperMissing.source_call_conditioning.reason,'CALL_PROPOSAL_HELPER_UNAVAILABLE');
assert.equal(get(helperMissing,'IA-SEN').dem_beats_rep_pct,100);
console.log('Engine conditional-call candidate PASS: public calls-only posterior, true baseline/retraction, typed nonforecast packet, exact proposal replay, all optional consumers, independent Gaussian identities/scales/researchcorr, unsupported/zero-localSD/Independent/missing-helper withholding. Fictional numerical evidence, not calibration.');
