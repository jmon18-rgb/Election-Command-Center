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
console.log('Source-validated early indicator timestamps, comparisons and county watch status PASS');
