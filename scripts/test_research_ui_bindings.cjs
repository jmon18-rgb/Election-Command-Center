#!/usr/bin/env node
'use strict';
// Extracted exact candidate page producer only; no DOM/browser/model execution.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const D=path.resolve(__dirname,'..'),candidate=fs.existsSync(path.join(D,'index.research-candidate.html')),html=fs.readFileSync(path.join(D,candidate?'index.research-candidate.html':'index.html'),'utf8'),api=require('./active_race_input_diagnostics.js');
const start=html.indexOf('function jointBuildRaceOddsSnapshot(result,basis){'),end=html.indexOf('function renderModelRaceOdds(estimate){',start);assert(start>=0&&end>start);
const source=html.slice(start,end),poll={race_code:'MI-SEN',status:'single_poll',dem_minus_rep:4,contributing_pollsters:1,independent_pollsters:1},house={...poll,race_code:'MI-01'};
const active={generated_from_sources:{model_polling_at:'fixture-clock'},senate:[{code:'MI-SEN',mean:2.5,polled:true,poll_weight:.75,private_context_anchor_points:-2}],house:[{code:'MI-01',mean:1,polled:true,poll_weight:.75,private_context_anchor_points:-8}],private_imported_context:{source:'public_repository_fundamentals_csv'}};
const baseline={generated_from_sources:{model_polling_at:'fixture-clock'},senate:[{code:'MI-SEN',mean:1}],house:[{code:'MI-01',mean:0}]},explanations=new WeakMap();
const context=vm.createContext({window:{ActiveRaceInputDiagnostics:api},modelRaceInputDiagnostics:explanations,jointBasisPublic:baseline,jointAsOfSnapshot:null,latestSenateEstimates:{generated_at:'fixture-clock',senate_all:[poll],house:[house],governor:[]}});
vm.runInContext(source,context);const result={samples:3000,race_probability_method:'SAME_CORRELATED_DRAWS_AS_CHAMBER_CONTROL',race_probabilities:[{office:'senate',race_code:'MI-SEN'},{office:'house',race_code:'MI-01'}]};
const snapshot=context.jointBuildRaceOddsSnapshot(result,active);assert(snapshot);const recordsBefore=JSON.stringify(snapshot.records),s=explanations.get(snapshot).get('senate|MI-SEN'),h=explanations.get(snapshot).get('house|MI-01');
assert.equal(s.source_context,'REPOSITORY');assert.equal(s.anchor_margin_points,-2);assert.equal(s.poll_weight,.75);assert.equal(h.anchor_margin_points,-8);assert.equal(h.formula_status,'RECONCILED_AT_INPUT_METADATA_PRECISION');
active.senate[0].private_context_anchor_points=999;active.house[0].poll_weight=.1;assert.equal(s.anchor_margin_points,-2);assert.equal(h.poll_weight,.75);assert.equal(JSON.stringify(snapshot.records),recordsBefore);
assert(!JSON.stringify(snapshot).includes('private_context_anchor'));assert(!JSON.stringify(snapshot).includes('anchor_margin_points'));assert.equal(Object.isFrozen(s),true);assert.equal(Object.isFrozen(h),true);
assert.equal(context.jointBuildRaceOddsSnapshot(result,{...active,generated_from_sources:{model_polling_at:'other'}}),null);
context.window.ActiveRaceInputDiagnostics=null;const missing=context.jointBuildRaceOddsSnapshot(result,active);assert(missing);assert.equal(explanations.get(missing).size,0);assert.equal(missing.records.length,2);
const allIds=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);for(const id of ['labMode','labScale','labCompositionFields','labNoncollegeBaselineMargin','labHispanicBaselineMargin','labRemainderMargin'])assert.equal(allIds.filter(x=>x===id).length,1);
assert(html.includes('poll weight '));assert(html.includes('projected margin '));assert(html.includes('NOT active on this device'));
if(candidate){const patch=JSON.parse(fs.readFileSync(path.join(D,'index.research.patch.json')));let inverse=html;for(const op of patch.operations.slice().reverse()){assert.equal(inverse.split(op.after).length,2);inverse=inverse.replace(op.after,op.before);}assert.equal(inverse,fs.readFileSync(path.join(D,'index.before-research.html'),'utf8'));}
// Mixed private context must never deny imports active for other races.
const renderStart=html.indexOf('  const diagnostic=modelRaceInputDiagnostics.get(modelRaceOddsData)?.get('),renderEndMarker="  }else compare.append(elt('div','source-explain','Active input explanation is unavailable for this captured forecast. The forecast itself is unchanged.'));";
const renderEnd=html.indexOf(renderEndMarker,renderStart);assert(renderStart>=0&&renderEnd>renderStart);
const renderingPatch=html.slice(renderStart,renderEnd+renderEndMarker.length);
function publicRaceMessage(privateElsewhere){
 const node={},texts=[],diagnostics=new WeakMap();
 const diagnostic=api.explain({office:'senate',active:{code:'MI-SEN',mean:1,polled:false,poll_weight:0,candidate_neutral_2026_environment_margin_points:1},context_matches:true});
 diagnostics.set(node,new Map([['senate|MI-SEN',diagnostic]]));
 const box=vm.createContext({modelRaceInputDiagnostics:diagnostics,modelRaceOddsData:node,item:{office:'senate',race_code:'MI-SEN',independent_firms:0,model_dem_margin_points:1,sigma_points:8},pollOnly:{sigma_points:8},marginText:x=>String(x),elt:(tag,cls,text)=>({text}),compare:{append:n=>texts.push(n.text)},jointUsesPrivateContext:()=>privateElsewhere});
 vm.runInContext(renderingPatch,box);return texts.join(' ');
}
assert(publicRaceMessage(true).includes('No imported candidate anchor is active for this race; its public basis is used.'));
assert(!publicRaceMessage(true).includes('NOT active on this device'));
assert(publicRaceMessage(false).includes('Imported candidate fundamentals are NOT active on this device.'));
const proof={status:'PASS_CAPTURED_INPUT_EXPLANATION_AND_EXACT_MARKER_CONTROLS',at:new Date().toISOString(),senate_and_house:true,owned_values_not_later_basis:true,no_diagnostic_fields_in_snapshot:true,source_clock_mismatch_rejected:true,missing_helper_preserves_forecast:true,all_marker_inverse_exact:candidate?true:null,actual_repository_index_checked:!candidate,original_race_explanation_assertion_texts_preserved:true,model_draws:0,browser_runs:0,network_requests:0,empirical_metrics:null};
const outputDir=candidate?D:path.resolve(process.cwd(),'artifacts/readiness');fs.mkdirSync(outputDir,{recursive:true});const out=path.join(outputDir,'research-ui-binding-proof-'+Date.now()+'-'+process.pid+'.json');fs.writeFileSync(out,JSON.stringify(proof,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:proof.status,path:out,sha256:crypto.createHash('sha256').update(fs.readFileSync(out)).digest('hex')}));
