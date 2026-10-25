#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {execFileSync,spawnSync}=require('node:child_process');
const path=require('node:path');
const script=path.join(__dirname,'monitor_election_night_browser_soak.mjs');
const run=(options=[])=>JSON.parse(execFileSync(process.execPath,[script,
 '--check-config',...options],{encoding:'utf8'}));
const def=run();
assert.equal(def.schema,'real-election-browser-tab-v1');
assert.equal(def.minutes,120);
assert.equal(def.interval,60);
assert.equal(def.source_fixture,false);
assert.equal(def.clock_fixture,false);
const custom=run(['--duration-minutes=15','--interval-seconds=30']);
assert.equal(custom.minutes,15);
assert.equal(custom.interval,30);
for(const args of [
 ['--duration-minutes=0'],['--duration-minutes=181'],
 ['--duration-minutes=foo'],['--interval-seconds=1'],
 ['--interval-seconds=301'],['--site=https://evil.example/'],
 ['--unknown=something'],['--check-config','--check-config']
]){
 const result=spawnSync(process.execPath,[script,'--check-config',...args],
  {encoding:'utf8'});
 assert.notEqual(result.status,0,
  'Runner must reject malformed or unsafe args '+JSON.stringify(args));
}
const {assess}=require('./election_night_browser_soak_acceptance.cjs');
const sample={
 actual_elapsed_seconds:301,checkpoints:6,healthy_checkpoints:6,
 background_visibility_confirmed:true,background_resume_observed:true,
 resumed_tab_visible:true,post_resume_primary_requests:2,
 post_resume_primary_healthy_responses:2,
 post_resume_refresh_trigger:'MANUAL_OWNER_CONTROL_PRE_ELECTION',
 source_requests:{primary:6,supplemental:0},primary_healthy_responses:6,
 source_request_failures:0,source_http_errors:0,
 page_script_errors:0,audit_errors:0,errors:[]
};
const ok=assess(sample,5,60);
assert.equal(ok.passed,true);
assert.equal(Object.keys(ok.checks).length,12);
assert.equal(assess({...sample,post_resume_refresh_trigger:'AUTONOMOUS_ELECTION_DAY_FOCUS'},5,60).passed,true,
 'Election Day autonomous recovery is a distinct recorded pathway');
for(const bad of [
 {actual_elapsed_seconds:250},
 {healthy_checkpoints:5},
 {background_visibility_confirmed:false},
 {background_resume_observed:false},
 {resumed_tab_visible:false},
 {post_resume_refresh_trigger:null},
 {post_resume_refresh_trigger:'FICTIONAL_ALWAYS_ON'},
 {post_resume_primary_requests:0},
 {post_resume_primary_healthy_responses:0},
 {source_requests:{primary:0}},
 {primary_healthy_responses:0},
 {source_request_failures:1},
 {source_http_errors:429},
 {page_script_errors:1},
 {audit_errors:1},
 {errors:['recovery failed']},
]){
 const report={...sample,...bad};
 const proof=assess(report,5,60);
 assert.equal(proof.passed,false,
  'Missing post-resume refresh or degraded transport cannot pass '+JSON.stringify(bad));
 assert(Object.values(proof.checks).includes(false));
}
const reset={...sample,post_resume_primary_requests:1,
 post_resume_primary_healthy_responses:1};
assert.equal(assess(reset,5,60).passed,true,
 'One independently completed refresh after focus restoration is sufficient');
assert.equal(assess({...sample,actual_elapsed_seconds:7199},120,60).passed,false,
 'The full two-hour tab-duration requirement cannot be shortened');
assert.throws(()=>assess(sample,0,60));
assert.throws(()=>assess(sample,5,0));

console.log('Real-clock deployed Chromium soak CLI: no fictional votes, validated configuration and real post-resume source refresh gate PASS');
