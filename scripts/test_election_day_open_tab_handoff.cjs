#!/usr/bin/env node
'use strict';
// Exercise the actual Election Day transition in index.html, not a rewritten
// policy. Synthetic times and fake view-change recorder; zero live requests.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const begin=html.indexOf('let enElectionNightManualArchive=false;');
const end=html.indexOf('function enReconnectAfterInterruption(',begin);
assert(begin>0&&end>begin,'Actual unattended-tab handoff must exist in index');
assert.equal(html.indexOf('let enElectionNightManualArchive=false;',begin+1),-1);
const realLogic=html.slice(begin,end);
const context=vm.createContext({
 Date,Number,document:{visibilityState:'visible',
  querySelector(selector){return {classList:{contains(name){
   return name==='active'&&selector===context.activeView
  }}}},
 },
 enModeYear:2024,enOffice:'Senate',activeView:'#brief',changes:[],
 enSwitch(year,office){context.changes.push([year,office]);context.enModeYear=year}
});
// Lexical-scoped script reads globalThis enIsVisible and enSwitch mocks.
vm.runInContext(realLogic,context);
const check=timestamp=>vm.runInContext(
 'enElectionNightAutoHandoff('+JSON.stringify(timestamp)+')',context);
assert.equal(check(Date.parse('2026-11-03T04:59:59Z')),false,
 'The previous day stays in deliberate pre-election archive mode');
assert.equal(context.changes.length,0);
const boundary=Date.parse('2026-11-03T05:00:00Z');
assert.equal(check(boundary),true,
 'The original open tab enters 2026 on Election Day');
assert.deepEqual(Array.from(context.changes[0]),[2026,'Senate'],
 'Preserve the operator-selected office');
assert.equal(check(boundary+60000),false,'Handoff must happen only once');
assert.equal(context.changes.length,1);
context.enModeYear=2024;
context.document.visibilityState='hidden';
assert.equal(check(boundary+60000),false,'Hidden tabs must not fetch in background');
assert.equal(context.changes.length,1);
context.document.visibilityState='visible';
context.activeView='#wire';
assert.equal(check(boundary+60000),false,'Inactive election desk and homepage stay idle');
context.activeView='#electionNight';
assert.equal(check(boundary+60000),true,
 'Returning to the election desk also triggers the pending handoff');
assert.deepEqual(Array.from(context.changes[1]),[2026,'Senate']);
context.enModeYear=2024;
assert.equal(check(Number.NaN),false);
vm.runInContext('enElectionNightManualArchive=true',context);
assert.equal(check(boundary+60000),false,
 'Manually chosen 2024 archive may not be overridden by an automatic timer');
assert.equal(context.changes.length,2);
assert.match(html,/function enReconnectAfterInterruption\(force=false\)\{[\s\S]*?if\(enElectionNightAutoHandoff\(now\)\)return true;/,
 'Normal 60-second laptop wake checks must invoke Election Day handoff');
// Execute the actual registered heartbeat instead of requiring one exact
// callback spelling. It may also invoke the optional display-only clock.
const heartbeatLines=html.split(/\r?\n/).filter(line=>line.includes('setInterval(')&&line.includes('enReconnectAfterInterruption('));
assert.equal(heartbeatLines.length,1,'Exactly one shared unattended-tab heartbeat is registered');
const heartbeatSource=heartbeatLines[0];
function checkHeartbeat(source,ready){
 const calls=[],registrations=[];
 vm.runInNewContext(source,{
  setInterval(callback,interval){registrations.push({callback,interval});},
  enReconnectAfterInterruption(){calls.push('reconnect');},
  enNightPresentationReady:ready,
  enUpdateNightPresentation(){calls.push('presentation');}
 });
 assert.equal(registrations.length,1,'One actual heartbeat registration');
 assert.equal(registrations[0].interval,60000,'Original60-second cadence is retained');
 assert.equal(typeof registrations[0].callback,'function');
 registrations[0].callback();
 assert.deepEqual(calls,ready?['reconnect','presentation']:['reconnect'],
  'The registered callback retains original reconnect once and only ticks presentation when ready');
 return calls;
}
checkHeartbeat(heartbeatSource,false);checkHeartbeat(heartbeatSource,true);
const withoutReconnect=heartbeatSource.replace('enReconnectAfterInterruption();','');
assert.notEqual(withoutReconnect,heartbeatSource);
assert.throws(()=>checkHeartbeat(withoutReconnect,true),{code:'ERR_ASSERTION'},'Removing original reconnect is rejected');
const wrongInterval=heartbeatSource.replace('60000','60001');
assert.notEqual(wrongInterval,heartbeatSource);
assert.throws(()=>checkHeartbeat(wrongInterval,false),{code:'ERR_ASSERTION'},'Changing cadence is rejected');
assert.match(html,/enMode2024'\)\.addEventListener\('click',[\s\S]*?enElectionNightManualArchive=true;/,
 'Manual archive button must stop automatic switches');
assert.match(html,/enArchiveSource'\)\.addEventListener\('change',[\s\S]*?enElectionNightManualArchive=true;/,
 'Manual historical source selection must stop automatic switches');
console.log('Election Day open-tab transition and manual archive protection PASS');
