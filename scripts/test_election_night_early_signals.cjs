#!/usr/bin/env node
'use strict';
// Exact-race early reporting can be watched without pretending that the
// earliest precincts represent an entire county/state or the nation.
const assert=require('node:assert/strict');
const api=require('./election_night_early_signals.js');
assert.equal(api.records.length,15);
const ids=new Set(api.records.map(x=>x.code));
for(const name of ['KY-06','IN-05','VA-02','NC-01','NC-SEN','OH-SEN',
 'VA-SEN','SC-SEN','MI-SEN'])assert(ids.has(name));
const north=api.records.find(x=>x.code==='NC-SEN');
assert.deepEqual(north.counties,['Wake','Mecklenburg','Nash']);
assert.deepEqual(api.records.find(x=>x.code==='OH-SEN').counties,['Hamilton','Stark']);
assert.equal(api.records.find(x=>x.code==='MI-SEN').counties[0],'Oakland');
const ky=api.records.find(x=>x.code==='KY-06');
const now=Date.parse('2026-11-04T03:00:00Z');
const fresh={verified:true,provider:'civicAPI',asOf:'2026-11-04T02:45:00Z',
 total:100000,d:52000,r:46000,precincts:41,stale:false};
function test(x,expected,context={now,priorMargin:2}){
 const got=api.assess(ky,x,context);
 assert.equal(got.status,expected);
 assert.equal(got.canMoveNationalNeedle,false,
  'Editorial bellwethers never manufacture nationally calibrated swing');
 return got;
}
test(fresh,'COUNTING_PARTIAL');
assert.equal(test(fresh,'COUNTING_PARTIAL').comparative,false);
test({...fresh,precincts:null},'COUNTING_UNKNOWN_PROGRESS');
const sufficient=test({...fresh,precincts:80},'LATE_LOCAL_COMPARISON');
assert.equal(sufficient.rawMargin,+(100*6000/98000).toFixed(2));
assert.equal(sufficient.marginVsPrior,+(sufficient.rawMargin-2).toFixed(2));
assert.equal(test({...fresh,precincts:80},'COUNTING_PARTIAL',{now,priorMargin:null}).comparative,false);
test({...fresh,asOf:'2026-11-03T19:00:00Z'},'STALE');
test({...fresh,asOf:'2024-11-04T02:45:00Z'},'STALE');
test({...fresh,stale:true},'STALE');
test({...fresh,asOf:'2026-11-04T04:00:00Z'},'STALE');
test({...fresh,verified:false},'INVALID_SOURCE');
test({...fresh,provider:'unsupported'},'INVALID_SOURCE');
test({...fresh,precincts:101},'INVALID_SOURCE');
test({...fresh,precincts:-1},'INVALID_SOURCE');
test({...fresh,total:400},'INVALID_SOURCE');
test({...fresh,d:0},'INVALID_SOURCE');
test(null,'SOURCE_ERROR',{now,error:'429'});
test(null,'AWAITING_SOURCE');
const beforeClose=Date.parse('2026-11-03T22:59:59Z');
test(fresh,'WAITING_FOR_POLLS',{now:beforeClose});
test(fresh,'PREVIEW',{now:Date.parse('2026-10-23T12:00:00Z')});
assert.equal(api.closedAt(ky),Date.parse('2026-11-03T23:00:00Z'));
// IN-05 is an automatic 6 PM watch item, not a race call or inferred wave.
// Exact source results must be fresh, plausible, and post-closing.
const indiana=api.records.find(x=>x.code==='IN-05');
assert(indiana&&indiana.office==='House');
assert.equal(api.closedAt(indiana),Date.parse('2026-11-03T23:00:00Z'));
const inNow=Date.parse('2026-11-03T23:40:00Z');
const inVotes={verified:true,provider:'Open America',
 asOf:'2026-11-03T23:30:00Z',total:20000,d:11000,r:8500,precincts:12,stale:false};
assert.equal(api.assess(indiana,inVotes,{now:inNow}).status,'COUNTING_PARTIAL');
assert.equal(api.assess(indiana,inVotes,{now:inNow}).canMoveNationalNeedle,false);
assert.equal(api.assess(indiana,inVotes,{now:Date.parse('2026-11-03T22:59:00Z')}).status,
 'WAITING_FOR_POLLS');
assert.equal(api.assess(indiana,{...inVotes,asOf:'2026-11-03T22:30:00Z'},
 {now:inNow}).status,'STALE');
assert.equal(api.assess(indiana,{...inVotes,verified:false},{now:inNow}).status,
 'INVALID_SOURCE');
assert.equal(api.assess(indiana,null,{now:inNow,error:'503'}).status,'SOURCE_ERROR');
assert.equal(api.assess(indiana,null,{now:inNow}).status,'AWAITING_SOURCE');
// Virginia's four early House bellwethers and Senate signal must remain
// distinct races, subject to the 7 PM Eastern closing and source health.
const virginiaCodes=['VA-01','VA-02','VA-05','VA-07','VA-SEN'];
const vaNow=Date.parse('2026-11-04T00:15:00Z');
const vaObservation={verified:true,provider:'Open America',
 asOf:'2026-11-04T00:05:00Z',total:30000,d:15600,r:14000,
 precincts:20,stale:false};
for(const code of virginiaCodes){
 const signal=api.records.find(x=>x.code===code);
 assert(signal,'Missing Virginia early indicator '+code);
 assert.equal(api.closedAt(signal),Date.parse('2026-11-04T00:00:00Z'),code);
 const result=api.assess(signal,vaObservation,{now:vaNow});
 assert.equal(result.status,'COUNTING_PARTIAL',code);
 assert.equal(result.canMoveNationalNeedle,false,code);
 assert.equal(api.assess(signal,vaObservation,{
  now:Date.parse('2026-11-03T23:59:59Z')}).status,'WAITING_FOR_POLLS',code);
 assert.equal(api.assess(signal,{...vaObservation,asOf:'2026-11-03T23:59:00Z'},
  {now:vaNow}).status,'STALE',code);
 assert.equal(api.assess(signal,null,{now:vaNow,error:'503'}).status,'SOURCE_ERROR',code);
 assert.equal(api.assess(signal,null,{now:vaNow}).status,'AWAITING_SOURCE',code);
}
// NC and OH early indicators: source health and local county references
// remain observational, never a modeled county or national swing.
const nextSignals=[
 {code:'NC-01',close:'2026-11-04T00:30:00Z'},
 {code:'NC-11',close:'2026-11-04T00:30:00Z'},
 {code:'NC-SEN',close:'2026-11-04T00:30:00Z'},
 {code:'OH-SEN',close:'2026-11-04T00:30:00Z'}
];
const nextNow=Date.parse('2026-11-04T01:10:00Z');
const nextVotes={verified:true,provider:'Open America',
 asOf:'2026-11-04T01:00:00Z',total:12000,d:6100,r:5700,
 precincts:17,stale:false};
for(const {code,close} of nextSignals){
 const signal=api.records.find(x=>x.code===code);
 assert(signal,'Missing NC/OH indicator '+code);
 assert.equal(api.closedAt(signal),Date.parse(close),code);
 assert.equal(api.assess(signal,nextVotes,{now:nextNow}).status,'COUNTING_PARTIAL',code);
 assert.equal(api.assess(signal,nextVotes,{now:nextNow}).canMoveNationalNeedle,false,code);
 assert.equal(api.assess(signal,nextVotes,{now:Date.parse(close)-1}).status,
  'WAITING_FOR_POLLS',code);
 assert.equal(api.assess(signal,{...nextVotes,asOf:'2026-11-04T00:20:00Z'},
  {now:nextNow}).status,'STALE',code);
 assert.equal(api.assess(signal,null,{now:nextNow,error:'503'}).status,'SOURCE_ERROR',code);
 assert.equal(api.assess(signal,null,{now:nextNow}).status,'AWAITING_SOURCE',code);
}
assert.deepEqual(api.records.find(x=>x.code==='NC-SEN').counties,
 ['Wake','Mecklenburg','Nash']);
assert.deepEqual(api.records.find(x=>x.code==='OH-SEN').counties,
 ['Hamilton','Stark']);
console.log('Source-validated early indicator timestamps, comparisons and county watch status PASS');
