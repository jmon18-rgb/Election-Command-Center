#!/usr/bin/env node
'use strict';
// Pure assumption/diagnostic mechanics. No actual model, browser, source or corpus.
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const lab=require('./electorate_what_if_2026.js'),diagnostics=require('./active_race_input_diagnostics.js');
const states='AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');
const basis={house:Array.from({length:435},(_,i)=>({code:states[i%50]+'-'+String(Math.floor(i/50)+1).padStart(2,'0'),state:states[i%50],mean:0})),
 senate:states.slice(0,35).map((state,i)=>({code:state+'-SEN',state,mean:0,...i===1?{nonrep_independent_proxy:true}:{}})),
 governors:states.slice(0,36).map(state=>({code:state+'-GOV',state,mean:0}))};
const clone=x=>structuredClone(x),hash=x=>crypto.createHash('sha256').update(x).digest('hex'),groups=[];
const candidate=fs.existsSync(path.resolve(__dirname,'../index.research-candidate.html'));
const outputDir=candidate?path.resolve(__dirname,'..'):path.resolve(process.cwd(),'artifacts/readiness');fs.mkdirSync(outputDir,{recursive:true});
function test(name,fn){fn();groups.push(name);}
const margin={state:'MI',groups:[{share_pct:42,margin_change_points:6},{share_pct:9,margin_change_points:4}]};
const composition={mode:'composition',state:'MI',groups:[
 {share_pct:30,baseline_margin_points:-20,participation_multiplier:1.2,margin_change_points:0},
 {share_pct:20,baseline_margin_points:40,participation_multiplier:1,margin_change_points:0},
 {share_pct:50,baseline_margin_points:0,participation_multiplier:1,margin_change_points:0}]};
const simCalls=[];
function simulate(b,options){
 simCalls.push({options:clone(options),means:[...b.house,...b.senate,...b.governors].map(r=>[r.code,r.mean])});
 const pool=[...b.house.map(r=>({...r,office:'house'})),...b.senate.map(r=>({...r,office:'senate'})),...b.governors.map(r=>({...r,office:'governor'}))];
 const h=b.house.reduce((s,r)=>s+r.mean,0),s=b.senate.reduce((n,r)=>n+r.mean,0);
 return {race_probabilities:pool.map(r=>({race_code:r.code,office:r.office,dem_beats_rep_pct:50+r.mean})),house_dem_control_pct:50+h/435,senate_dem_control_pct:50+s/35,actual_dem_both_control_pct:25+(h/435+s/35)/2,means:{house_dem_seats:217.5+h/200,senate_dem_seats:50+s/200}};
}
try{
 test('Legacy share/preference arithmetic and rejection contract',()=>{
  assert.equal(lab.validate(margin,basis).shift,2.88);
  const bad=clone(margin);bad.groups[0].share_pct=99;assert.match(lab.validate(bad,basis).reason,/cannot exceed 100%/);
  assert.equal(lab.validate({...margin,states:Array(9).fill('MI')},basis).ok,false);
 });
 test('National exact50 state scope, same options, no input mutation and independent exclusion',()=>{
  const original=JSON.stringify(basis),r=lab.evaluate(basis,{...margin,scope:'national'},simulate,{samples:2000,seed:20261103});
  assert.equal(r.ok,true,r.reason);assert.equal(r.states.length,50);assert.equal(r.affected_races.length,505);assert.equal(r.excluded_axes.length,1);assert.equal(r.excluded_axes[0].race_code,'AK-SEN');
  assert.equal(simCalls.length,2);assert.deepEqual(simCalls[0].options,simCalls[1].options);assert.deepEqual(simCalls[0].options,{samples:2000,seed:20261103,nationalShift:0,errorMultiplier:1,live:{}});
  assert.equal(simCalls[1].means.find(r=>r[0]==='AK-SEN')[1],0);assert(r.affected_races.every(r=>r.margin_change_points===undefined&&Math.abs(r.after_margin_points-r.before_margin_points-2.88)<1e-12));
  assert.equal(JSON.stringify(basis),original);assert.equal(r.published_model_modified,false);assert.equal(r.census_or_turnout_shares_verified,false);assert.equal(r.live_source_votes_used,false);
  const missing=clone(basis);missing.house=missing.house.map(r=>r.state==='WY'?{...r,state:'AL'}:r);
  assert.equal(lab.validate({...margin,scope:'national'},missing).ok,false);
 });
 test('Participation normalization preserves mass and independent oracle shift',()=>{
  const gate=lab.validate(composition,basis);assert.equal(gate.ok,true,gate.reason);
  const before=.3*(-20)+.2*40+.5*0,after=(.3*1.2*(-20)+.2*40)/( .3*1.2+.2+.5);
  assert(Math.abs(gate.shift-(after-before))<1e-12);assert(Math.abs(gate.assumed_composition.scenario_shares_pct.reduce((s,x)=>s+x,0)-100)<1e-10);
  assert(Math.abs(gate.assumed_composition.relative_participation-1.06)<1e-12);
 });
 test('Identity participation and preferences give exact unchanged means',()=>{
  const identity=clone(composition);for(const g of identity.groups){g.participation_multiplier=1;g.margin_change_points=0;}
  const r=lab.evaluate(basis,identity,simulate,{samples:2000,seed:20261103});assert.equal(r.ok,true);assert.equal(r.state_margin_shift_points,0);assert.deepEqual(r.baseline,r.scenario);
 });
 test('Participation rejects missing preferences, nonexhaustive groups, zero mass and invalid bounds before simulator',()=>{
  const cases=[];let b=clone(composition);delete b.groups[0].baseline_margin_points;cases.push(b);
  b=clone(composition);b.groups[2].share_pct=40;cases.push(b);
  b=clone(composition);b.groups.forEach(g=>g.participation_multiplier=0);cases.push(b);
  b=clone(composition);b.groups[0].participation_multiplier=-1;cases.push(b);
  b=clone(composition);b.groups[0].baseline_margin_points=99;b.groups[0].margin_change_points=5;cases.push(b);
  b=clone(composition);b.groups[0].participation_multiplier=Infinity;cases.push(b);
  let calls=0;for(const input of cases)assert.equal(lab.evaluate(basis,input,()=>{calls++;}).ok,false);assert.equal(calls,0);
 });
 test('Declared scale changes hypotheses and cannot manufacture valid preferences',()=>{
  assert.equal(lab.validate({...margin,scenario_scale:.5},basis).shift,1.44);
  assert(Math.abs(lab.validate({...margin,scenario_scale:1.5},basis).shift-4.32)<1e-12);
  assert.equal(lab.validate({...margin,scenario_scale:2},basis).ok,false);
  const bad=clone(composition);bad.scenario_scale=1.5;bad.groups[0].participation_multiplier=0;assert.equal(lab.validate(bad,basis).ok,false);
 });
 test('Active imported Senate weights and anchor replace geographical wording',()=>{
  const r=diagnostics.explain({office:'senate',active:{code:'MI-SEN',mean:2.5,polled:true,poll_weight:.75,private_context_anchor_points:-2,private_context_source:'blended_fundamentals_only',candidate_neutral_2026_environment_margin_points:-9},baseline:{code:'MI-SEN',mean:1},poll_margin_points:4,context_matches:true});
  assert.equal(r.source_kind,'IMPORTED_CANDIDATE_CONTEXT');assert.equal(r.source_label,'Imported Blended fundamentals');assert.equal(r.poll_weight,.75);assert.equal(r.anchor_margin_points,-2);assert.equal(r.public_baseline_prior_margin_points,1);assert.equal(r.formula_status,'RECONCILED_AT_INPUT_METADATA_PRECISION');
 });
 test('House imported and public missing-anchor paths are truthful',()=>{
  const row={code:'MI-01',mean:1,polled:true,poll_weight:.75,private_context_anchor_points:-8};
  const r=diagnostics.explain({office:'house',active:row,poll_margin_points:4,context_matches:true});
  assert.equal(r.source_kind,'IMPORTED_CANDIDATE_CONTEXT');assert.equal(r.formula_status,'RECONCILED_AT_INPUT_METADATA_PRECISION');
  const pub=diagnostics.explain({office:'house',active:{code:'MI-01',mean:1,polled:true,poll_weight:.75},poll_margin_points:4,context_matches:true});
  assert.equal(pub.anchor_margin_points,null);assert.equal(pub.formula_status,'COMPONENTS_UNAVAILABLE_FOR_EXACT_RECONSTRUCTION');
 });
 test('Diagnostics binds accepted context and handles unpolled/clipped/unreconciled metadata',()=>{
  assert.equal(diagnostics.explain({}).status,'UNAVAILABLE');
  const row={code:'MI-SEN',mean:10,polled:false,poll_weight:0,private_context_anchor_points:10};
  const r=diagnostics.explain({office:'senate',active:row,context_matches:true});assert.equal(r.poll_weight,0);assert.equal(r.poll_margin_points,null);assert.equal(r.formula_status,'RECONCILED_AT_INPUT_METADATA_PRECISION');
  const clipped=diagnostics.explain({office:'senate',active:{...row,mean:55,private_context_anchor_points:65},context_matches:true});assert.equal(clipped.reconstruction.bounded_margin_points,55);
  const mismatch=diagnostics.explain({office:'senate',active:{...row,mean:9},context_matches:true});assert.equal(mismatch.formula_status,'DISPLAYED_COMPONENTS_DO_NOT_RECONSTRUCT_ACTIVE_PRIOR');
  assert.equal(diagnostics.explain({office:'senate',active:{...row,poll_weight:.5},context_matches:true}).status,'UNAVAILABLE');
 });
 const proof={status:'PASS_PURE_RESEARCH_ASSUMPTION_AND_DIAGNOSTIC_CONTROLS_ONLY',at:new Date().toISOString(),groups,existing_real_model_tests_preserved_not_reexecuted:true,model_draws:0,browser_runs:0,network_requests:0,empirical_metrics:null,may_claim_calibration:false};
 const output=path.join(outputDir,'research-pure-proof-'+Date.now()+'-'+process.pid+'.json');
 fs.writeFileSync(output,JSON.stringify(proof,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:proof.status,groups:groups.length,path:output,sha256:hash(fs.readFileSync(output))}));
}catch(error){const output=path.join(outputDir,'research-first-failure-'+Date.now()+'-'+process.pid+'.json');fs.writeFileSync(output,JSON.stringify({status:'FAIL_PURE_MECHANICS',groups,error:error.message,stack:error.stack},null,2)+'\n',{flag:'wx'});throw error;}
