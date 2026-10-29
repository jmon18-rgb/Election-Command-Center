'use strict';
// Existing public geography plus explicitly synthetic county counts/calls only.
// This checks mathematical orchestration and recovery, never actual delivery or
// independent historical calibration. No native requests/private CSV inputs.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const engine=require('./chamber_control_model.js'),kernel=require('./national_county_likelihood.js');
const scriptRoot=fs.existsSync(path.join(__dirname,'ohio_test_fixture.cjs'))?__dirname:path.resolve(__dirname,'../../../scripts');
const basis=require('./fictional_call_basis.cjs')();
// Neutral fictional Ohio is an uncertain-call scenario; the fixture's separate
// rare Ohio (-18) scenario is retained below as an explicit support test.
basis.senate.find(row=>row.code==='OH-SEN').mean=0;
const outputHash=output=>crypto.createHash('sha256').update(JSON.stringify(output)).digest('hex');
// Immutable COMPLETE outputs captured from the pre-call-conditioning engine and
// county coordinator, with this fixed fictional model and synthetic counts.
// These never depend on evolving polling data or private owner inputs.
const golden={
 noCall:'3e69ff4a37001a8229760b18f9ad1c2d55bb0e6fbd6c6964f655f12eeabbe824',
 counts:'96a3d71d1b183ede4105bf9cbed215a6939f06e4195d7f487974e420559a7325',
 stale:'a3647a84cb9267d4816de1b36e3670f9608518ae37e11baf0a31ac2e2aa27013',
 fallbackOH_D:'e745be6685fceff57564510abda04c3bf934feaa3e88f116ca8cf63328db2636'};
const now=Date.parse('2026-11-04T04:06:00Z'),opts={now,samples:1200,seed:20261103,independentSenateCredit:'no_credit',contextKey:'PUBLIC',marginSummaryCodes:['OH-SEN','MI-07','NE-SEN','ME-SEN']};
const oh=require(path.join(scriptRoot,'ohio_test_fixture.cjs')),mi=require(path.join(scriptRoot,'michigan_house_07_test_fixture.cjs')),ne=require(path.join(scriptRoot,'nebraska_test_fixture.cjs'));
const counts=[oh.envelope(0,now),mi.envelope(1,now),ne.envelope(1,now)];
const original=JSON.stringify({basis,counts}),race=(r,code)=>r.race_probabilities.find(row=>row.race_code===code);
const numeric=result=>{const {source_call_conditioning,county_results_update,...rest}=result;return rest;};
const live=(code,party)=>({[code]:{mode:'source_called',winnerParty:party}});
function spy(change={}){
 const observed={proposals:0,finalizations:0,fallbacks:0,captureCodes:null,countyTarget:null,packet:null,referenceCallCounts:[]};
 const api={...engine,
  simulate:(b,o)=>{observed.referenceCallCounts.push(Object.keys(o.live||{}).length);return engine.simulate(b,o);},
  proposeSourceCallElections:(b,o)=>{observed.proposals++;observed.captureCodes=o.captureCountyDraws||null;const packet=engine.proposeSourceCallElections(b,o);observed.packet=packet;return change.packet?change.packet(packet,b,o):packet;},
  finalizeSourceCallElections:(packet,o)=>{observed.finalizations++;observed.countyTarget=o.countyLogLikelihood;return engine.finalizeSourceCallElections(packet,change.finalize?change.finalize(o):o);},
  simulateWinnerAccountingFallback:(b,o,d)=>{observed.fallbacks++;return engine.simulateWinnerAccountingFallback(b,o,d);}
 };
 return {api,observed};
}
// The literal no-call legacy path and absent/rejected inputs remain unchanged.
for(const [name,input] of [['noCall',[]],['counts',counts],['stale',[{...counts[0],snapshot:{...counts[0].snapshot,snapshot_updated_at:'2026-10-01T00:00:00Z'}}]]]){
 assert.equal(outputHash(kernel.condition(engine,basis,input,opts)),golden[name],'No-call complete original output/random stream must remain exact');
}
const pollingBaseline=engine.simulate(basis,{...opts,now:undefined});
const calledOptions={...opts,live:live('IA-SEN','D')},callsOnly=kernel.condition(engine,basis,[],calledOptions);
assert.equal(callsOnly.result.source_call_conditioning.status,'CONDITIONED',JSON.stringify(callsOnly.result.source_call_conditioning));
assert.equal(callsOnly.result.source_call_conditioning.evidence_kind,'VALIDATED_CALLS_ONLY');
assert.equal(callsOnly.diagnostics.status,'EXPERIMENTAL_VALIDATED_CALLS_CONDITIONED_NATIONAL_OUTLOOK');
assert.deepEqual(callsOnly.baseline,pollingBaseline,'Returned baseline is truly no-call/no-count');
assert.deepEqual(numeric(callsOnly.result),numeric(engine.simulate(basis,calledOptions)),'Calls-only entry points use the same whole-election posterior');
assert.equal(race(callsOnly.result,'IA-SEN').provider_called_party,'D');assert.equal(race(callsOnly.result,'IA-SEN').dem_beats_rep_pct,100);
assert.deepEqual(callsOnly.diagnostics.used,[]);assert.notEqual(race(callsOnly.result,'ME-SEN').dem_beats_rep_pct,race(callsOnly.baseline,'ME-SEN').dem_beats_rep_pct,'A call changes another race through existing covariance');

const oldCountReference=kernel.condition(engine,basis,counts,opts),callInputs=[['OH-SEN','D'],['MI-07','R'],['NE-SEN','R']];
for(const [code,party]of callInputs){
 const {api,observed}=spy(),options={...opts,live:live(code,party)},result=kernel.condition(api,basis,counts,options);
 assert.equal(result.result.source_call_conditioning.status,'CONDITIONED',code+' supported joint proposal '+JSON.stringify(result.result.source_call_conditioning));
 assert.equal(result.result.source_call_conditioning.evidence_kind,'VALIDATED_CALLS_AND_COUNTY_RETURNS');
 assert.equal(observed.proposals,1);assert.equal(observed.finalizations,1,'Calls and county counts finalize once jointly');assert.equal(observed.fallbacks,0);
 assert.deepEqual(observed.captureCodes,['OH-SEN','MI-07','NE-SEN']);assert(observed.referenceCallCounts.every(n=>n===0),'Original count target comes from a no-call reference');
 assert.equal(observed.packet.status,'RAW_PROPOSAL_NOT_A_FORECAST');assert.equal(observed.packet.probabilities,undefined);
 assert.deepEqual(result.baseline,pollingBaseline);assert.equal(result.diagnostics.likelihood_power,oldCountReference.diagnostics.likelihood_power,'Freeze actual original count-only power');
 assert.deepEqual(result.diagnostics.used,oldCountReference.diagnostics.used,'The same exact synthetic source identities/performance are used once');
 assert.deepEqual(result.diagnostics.state_likelihood_budget_members,oldCountReference.diagnostics.state_likelihood_budget_members);
 assert.equal(result.diagnostics.reporting_error.quadrature_nodes,61);assert.equal(result.diagnostics.reporting_error.curve_step_margin_points,.125);
 assert.equal(result.diagnostics.count_target.reference_normalizers_frozen,true);assert.equal(result.diagnostics.count_target.county_likelihood_applied_once,true);
 assert.equal(result.diagnostics.count_target.call_likelihood_power,1);assert.equal(result.diagnostics.count_target.call_weights_tempered,false);
 assert(result.diagnostics.effective_sample_size>=opts.samples*.5);
 for(const [state,ratio]of Object.entries(result.diagnostics.state_likelihood_max_ratio)){assert(ratio<=result.diagnostics.state_likelihood_ratio_bound[state]*(1+1e-10));assert(result.diagnostics.state_likelihood_ratio_bound[state]<=20*(1+1e-10));}
 assert.equal(race(result.result,code).provider_called_party,party);assert.equal(race(result.result,code).dem_beats_rep_pct,party==='D'?100:0);
 assert.equal(result.result.senate_independent_credit_mode,'no_credit');assert.equal(result.result.senate_dem_holdovers,34);
 const serialized=JSON.stringify(result);for(const field of ['call_log_weights','county_draws','context_key','fingerprint'])assert(!serialized.includes('"'+field+'"'),'No raw proposal or private cache key escapes in a headline result');
}
assert.equal(JSON.stringify({basis,counts}),original,'Coordinator cannot mutate model/source inputs');
// Preserve the original missing-guide hard-support outcome too: rare fictional
// OH D (-18 baseline) plus conflicting counts must not gain support by changing
// alpha or weakening the ESS floor. This local model adapter omits only optional
// proposal guidance; the actual kernel, original Q and finalizer still run.
let omittedCountGuides=0;
const withoutCountGuide={...engine,proposeSourceCallElections(b,o){
 const {countProposalGuide,...originalOptions}=o;
 assert.equal(typeof countProposalGuide?.evaluate,'function');assert.equal(Object.isFrozen(countProposalGuide),true);omittedCountGuides++;
 return engine.proposeSourceCallElections(b,originalOptions);
}};
const rareBasis=require('./fictional_call_basis.cjs')(),conflictingCounts=[oh.envelope(8,now),mi.envelope(-3,now),ne.envelope(-2,now)];
const rare=kernel.condition(withoutCountGuide,rareBasis,conflictingCounts,{...opts,live:live('OH-SEN','D')});
assert.equal(omittedCountGuides,1,'The missing-guide control actually omits the new guidance');
assert.equal(rare.result.source_call_conditioning.status,'WITHHELD');assert.equal(rare.result.source_call_conditioning.reason,'WITHHELD_LOW_EFFECTIVE_SAMPLE_SUPPORT');
assert.equal(rare.diagnostics.conditioned_call_covariance_applied,false);assert(rare.diagnostics.call_support.effective_sample_size<opts.samples*.5);
assert.equal(race(rare.result,'OH-SEN').provider_called_party,'D');assert.equal(race(rare.result,'OH-SEN').dem_beats_rep_pct,100);
assert.equal(rare.diagnostics.used.length,3);assert.equal(rare.result.source_call_conditioning.call_weights_tempered,false);
const corrected=kernel.condition(engine,basis,counts,{...opts,live:live('OH-SEN','R')});
assert.equal(race(corrected.result,'OH-SEN').provider_called_party,'R');assert.equal(race(corrected.result,'OH-SEN').dem_beats_rep_pct,0,'Corrected winner is never an accumulated earlier call');
assert.deepEqual(kernel.condition(engine,basis,counts,opts),oldCountReference,'Call withdrawal restores the entire old counts-only output exactly');

// Numeric/provenance failure never publishes an unweighted proposal. It retains
// the reviewed legacy count-conditioned elections and validated seat flags.
for(const [name,change,reason]of [
 ['mutatedWeights',packet=>{packet.call_log_weights.fill(-100);packet.call_log_weights[0]=0;return packet;},'INVALID_OR_MUTATED_RAW_CALL_PACKET'],
 ['mutatedSeeds',packet=>{packet.seeds[0]^=1;return packet;},'INVALID_OR_MUTATED_RAW_CALL_PACKET'],
 ['crossContext',packet=>({...packet,context_key:'LOCAL_RESEARCH_VARIANT'}),'INVALID_OR_CROSS_CONTEXT_RAW_CALL_PACKET'],
 ['unweightedHeadline',packet=>({...packet,probabilities:{red_dawn:100}}),'INVALID_OR_CROSS_CONTEXT_RAW_CALL_PACKET'],
 ['unownedPacket',packet=>({...packet}),'INVALID_OR_MUTATED_RAW_CALL_PACKET']
]){
 const {api,observed}=spy({packet:change}),options={...opts,live:live('OH-SEN','D')},out=kernel.condition(api,basis,counts,options);
 assert.equal(out.result.source_call_conditioning.status,'WITHHELD',name);assert.equal(out.result.source_call_conditioning.reason,reason,name);
 assert.equal(out.diagnostics.conditioned_call_covariance_applied,false);assert.equal(observed.fallbacks,1);
 assert.equal(outputHash(numeric(out.result)),golden.fallbackOH_D,'Fallback preserves complete legacy count likelihood/winner accounting');
 assert.deepEqual(out.baseline,pollingBaseline);assert.deepEqual(out.diagnostics.used,oldCountReference.diagnostics.used);
 assert.equal(race(out.result,'OH-SEN').dem_beats_rep_pct,100);if(['crossContext','unweightedHeadline'].includes(name))assert.equal(observed.finalizations,0);
}
// A deliberately concentrated but bounded county target must fail the FINAL
// joint ESS gate, without altering the engine-owned call weights or raw seeds.
const unsupported=spy({finalize:o=>({...o,countyLogLikelihood:Float64Array.from({length:opts.samples},(_,i)=>i?18*Math.log(.05):0),countyLikelihoodPower:1})});
const lowESS=kernel.condition(unsupported.api,basis,counts,{...opts,live:live('OH-SEN','D')});
assert.equal(lowESS.result.source_call_conditioning.status,'WITHHELD');assert.equal(lowESS.result.source_call_conditioning.reason,'WITHHELD_LOW_EFFECTIVE_SAMPLE_SUPPORT');
assert.equal(unsupported.observed.finalizations,1);assert.equal(unsupported.observed.fallbacks,1);
assert.equal(outputHash(numeric(lowESS.result)),golden.fallbackOH_D);
const withoutAPI={...engine,proposeSourceCallElections:undefined};
assert.equal(kernel.condition(withoutAPI,basis,counts,calledOptions).result.source_call_conditioning.reason,'CALL_PROPOSAL_API_UNAVAILABLE');
const staleOH=structuredClone(counts[0]);staleOH.snapshot.snapshot_updated_at='2026-10-01T00:00:00Z';
const excludes=kernel.condition(engine,basis,[staleOH],calledOptions);assert.deepEqual(excludes.diagnostics.used,[]);assert.match(excludes.diagnostics.excluded[0].reason,/Stale/);assert.equal(excludes.result.source_call_conditioning.evidence_kind,'VALIDATED_CALLS_ONLY');

assert.throws(()=>kernel.condition(engine,basis,counts,{...opts,live:live('NE-SEN','D')}),/Independent/);
assert.throws(()=>kernel.condition(engine,basis,counts,{...opts,live:live('NONEXISTENT','D')}),/identity/);
assert.throws(()=>kernel.condition(engine,basis,counts,{...opts,live:{'OH-SEN':{mode:'live_informed',posteriorMargin:5,posteriorSigma:2}}}),/verified-call/);
assert.throws(()=>kernel.condition(engine,basis,counts,{...calledOptions,rehearsal:true}),/Rehearsal/);
assert.throws(()=>kernel.condition(engine,basis,[counts[0],counts[0]],calledOptions),/Duplicate/);
assert.throws(()=>kernel.condition(engine,basis,Array(19).fill(counts[0]),calledOptions),/Bounded/);

// Real cache/context calls use separate basis objects and explicit context labels;
// private-like fictional changes never contaminate a subsequent public result.
const publicAgain=kernel.condition(engine,basis,counts,calledOptions),variant=structuredClone(basis);variant.senate.find(row=>row.code==='ME-SEN').mean+=3;
const alternative=kernel.condition(engine,variant,counts,{...calledOptions,contextKey:'LOCAL_RESEARCH_VARIANT'});
assert.notDeepEqual(alternative.baseline,publicAgain.baseline);assert.deepEqual(kernel.condition(engine,basis,counts,calledOptions),publicAgain);
const mutable=structuredClone(basis),mutating=spy({packet:(packet,b)=>{b.senate[0].mean+=.25;return packet;}});
assert.throws(()=>kernel.condition(mutating.api,mutable,counts,calledOptions),error=>error.code==='CALL_MODEL_INPUT_CHANGED_DURING_CONDITIONING','Never hide a changed-basis/reference mix behind fallback');
console.log('Conditional-call kernel candidate PASS: exact no-call invariants, true polling baseline, OH/MI/NE count overlap once, frozen original power/max target,61-node shared error/fixed budgets, one replay, hard ESS/provenance fallback, correction/retraction/source exclusions and context/mutation guards. Synthetic engineering evidence only.');
