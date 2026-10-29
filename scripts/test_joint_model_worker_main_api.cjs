'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(__dirname,'joint_model_worker.js'),'utf8');
const sentinel=()=>{},surface={document:{},onmessage:sentinel,
 SourceCallConditioning:require(path.join(root,'scripts/source_call_conditioning.js')),
 ChamberControlModel:require(path.join(root,'scripts/chamber_control_model.js')),
 NationalCountyLikelihood:require(path.join(root,'scripts/national_county_likelihood.js')),
 postMessage(){throw Error('MAIN_POST_MESSAGE_FORBIDDEN');},importScripts(){throw Error('MAIN_IMPORT_FORBIDDEN');}};
surface.window=surface;surface.self=surface;
vm.runInNewContext(source,{self:surface,window:surface,document:surface.document,Set,Map,ArrayBuffer,URL});
assert.equal(surface.onmessage,sentinel);assert(surface.JointModelWorkerRunner);assert.equal(Object.hasOwn(surface,'onerror'),false);
const basis=require(path.join(root,'scripts/fictional_call_basis.cjs'))(),args={samples:3000,seed:20261103,now:Date.parse('2026-11-04T04:06:00Z'),
 independentSenateCredit:'no_credit',contextKey:'PUBLIC',live:{}};
const payload={basis,args,envelopes:[],publicBasis:null,variants:[]},actual=surface.JointModelWorkerRunner.run(payload);
const expected=surface.NationalCountyLikelihood.condition(surface.ChamberControlModel,basis,[],args);
assert.equal(JSON.stringify(actual),JSON.stringify({result:expected.result,baseline:expected.baseline,diagnostics:expected.diagnostics,publicComparison:null,variants:{}}));
assert.throws(()=>surface.JointModelWorkerRunner.run({...payload,publicBasis:{secret:'DO_NOT_ECHO_PRIVATE_VALUE'}}),error=>error.message==='MODEL_COMPUTATION_FAILED');
assert.throws(()=>surface.JointModelWorkerRunner.run({...payload,args:{...args,live:{'IA-SEN':{mode:'source_called',winnerParty:'D'}}}},
 {frameKind:'POLLING_ARCHIVE_BASELINE'}),error=>error.message==='INVALID_REQUEST');
const countBasis=structuredClone(basis);countBasis.senate.find(row=>row.code==='OH-SEN').mean=0;
const countEnvelope=require(path.join(root,'scripts/ohio_test_fixture.cjs')).envelope(0,args.now);
const countPayload={...payload,basis:countBasis,envelopes:[countEnvelope],variants:[{id:'correlation_moderate'},{id:'correlation_lower'}]};
const counted=surface.JointModelWorkerRunner.run(countPayload),directCount=surface.NationalCountyLikelihood.condition(surface.ChamberControlModel,countBasis,[countEnvelope],args);
assert.equal(counted.diagnostics.used.length,1);assert.equal(Object.keys(args.live).length,0);
assert.equal(JSON.stringify(counted.result),JSON.stringify(directCount.result),'Disabling an incomparable optional display cannot change the headline math');
for(const id of ['correlation_moderate','correlation_lower']){assert.equal(counted.variants[id].result,null);assert.equal(counted.variants[id].errorCode,'VARIANT_DISABLED_BY_COUNTY_RETURNS');}
const calledStress=surface.JointModelWorkerRunner.run({...payload,args:{...args,live:{'IA-SEN':{mode:'source_called',winnerParty:'D'}}},variants:[{id:'correlation_moderate'}]});
assert.equal(calledStress.variants.correlation_moderate.errorCode,'VARIANT_DISABLED_BY_LIVE_CALLS','Existing live-call reason remains distinct');
// Load the ACTUAL unchanged browser model sources in a fresh realm with the
// optional helper genuinely absent from the engine factory, not merely hidden
// after a Node module captured it. Polling remains usable; calls are preserved
// with explicitly withheld covariance under the existing engine/kernel rules.
const missing={document:{},onmessage:sentinel,
 ElectionNightPollClosings2026:require(path.join(root,'scripts/election_night_poll_closings_2026.js')),
 WashingtonRemainingSource:require(path.join(root,'scripts/washington_remaining_source.js')),
 WashingtonRemainingScenarios:require(path.join(root,'scripts/washington_remaining_scenarios.js')),
 postMessage(){throw Error('MAIN_POST_MESSAGE_FORBIDDEN');},importScripts(){throw Error('MAIN_IMPORT_FORBIDDEN');}};
missing.self=missing;missing.window=missing;
const realm={self:missing,window:missing,document:missing.document,Set,Map,ArrayBuffer,URL};
for(const filename of ['chamber_control_model.js','national_county_likelihood.js'])vm.runInNewContext(fs.readFileSync(path.join(root,'scripts',filename),'utf8'),realm);
vm.runInNewContext(source,realm);
assert.equal(missing.SourceCallConditioning,undefined);assert.equal(missing.onmessage,sentinel);
const noHelperBaseline=missing.JointModelWorkerRunner.run(payload);
assert.equal(JSON.stringify(noHelperBaseline.result),JSON.stringify(missing.ChamberControlModel.simulate(basis,args)));
const noHelperCalls=missing.JointModelWorkerRunner.run({...payload,args:{...args,live:{'IA-SEN':{mode:'source_called',winnerParty:'D'}}}});
assert.equal(noHelperCalls.result.source_call_conditioning.status,'WITHHELD');
assert.equal(noHelperCalls.result.source_call_conditioning.conditioned_covariance_applied,false);
assert.equal(noHelperCalls.result.race_probabilities.find(row=>row.race_code==='IA-SEN').provider_called_party,'D');
assert.equal(noHelperCalls.result.race_probabilities.find(row=>row.race_code==='IA-SEN').dem_beats_rep_pct,100);
const proof={schema:'model-worker-main-api-proof-v1',status:'PASS',worker_entry_sha256:crypto.createHash('sha256').update(source).digest('hex'),
 checks:{main_script_no_imports_no_messages_no_handlers:true,same_pure_math_bundle_exact:true,main_failure_messages_whitelisted:true,archive_live_inputs_rejected:true,
  county_only_stress_variants_disabled_headline_unchanged:true,existing_live_call_stress_reason_preserved:true,
  genuinely_missing_optional_helper_polling_usable:true,genuinely_missing_optional_helper_calls_preserved_covariance_withheld:true},
 scope:'MAIN fallback error sanitization plus fixed fictional same-runner baseline; actual Worker/browser proof is stored separately.'};
const out=path.join(root,'artifacts/readiness');fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'model-worker-main-api-proof.json'),JSON.stringify(proof,null,2)+'\n');
console.log('Main-safe worker entry PASS: no imports/messages/handlers, exact pure bundle and whitelisted fallback errors.');
