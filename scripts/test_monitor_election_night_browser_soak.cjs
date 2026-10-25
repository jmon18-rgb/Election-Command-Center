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
console.log('Real-clock deployed Chromium soak CLI: no fictional votes, validated configuration PASS');
