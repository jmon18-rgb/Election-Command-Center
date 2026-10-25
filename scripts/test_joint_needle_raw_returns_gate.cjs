#!/usr/bin/env node
'use strict';
// Exercise the actual browser functions. Fixture votes are SYNTHETIC and
// never leave test memory or touch real/published results.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const begin=html.indexOf('function jointLiveObservations(){');
const end=html.indexOf('function jointRenderNeedles(',begin);
const first=html.indexOf('function jointSourceItem(');
assert(first>0&&begin>first&&end>begin);
const closes=require('./election_night_poll_closings_2026.js');
const bridge=require('./house_at_large_bridge.js');
const clock=Date.parse('2026-11-04T03:00:00Z');
class AtNight extends Date {static now(){return clock;}}
const ballots={
 'NC-SEN':{code:'NC-SEN',mean:2,sigma:6},
 'NH-01':{code:'NH-01',mean:1,sigma:7}
};
const raw={d:76000,r:24000,total:100000,margin:52,reporting:80,
 asOf:'2026-11-04T02:55:00Z',time:Date.parse('2026-11-04T02:55:00Z'),
 provider:'Open America',sourceStale:false};
const context={
 Date:AtNight,
 window:{
  ElectionNightPollClosings2026:closes,
  ElectionNightSignals:{validatedCall:()=>null},
  ElectionNightEarlySignals:{records:[]},
  RaceLiveNowcast:{},
 },
 enModeYear:2026,
 jointBasis:{house:[ballots['NH-01']],senate:[ballots['NC-SEN']],governors:[]},
 jointPulseRows:[],jointDescriptiveReturns:[],
 enLiveRaceItem:r=>r.office==='senate'?
  {office:'Senate',key:r.race_code.slice(0,2)}:
  {office:'House',key:r.race_code},
 enCivicUsable:()=>null,
 jointSourceItem:()=>raw
};
const evaluate=vm.runInNewContext(html.slice(begin,end)+'\njointLiveObservations',context);
const firstPass=evaluate();
assert.deepEqual(JSON.parse(JSON.stringify(firstPass)),{},
 'Unrepresentative 80% precinct raw margins must not mutate correlated chamber odds');
assert.equal(context.jointDescriptiveReturns.length,2,
 'Valid partial counts remain inspectable rather than disappearing');
assert.equal(context.jointPulseRows.length,0,
 'Observed but uncalibrated returns are not admitted evidence for national swings');
assert(context.jointDescriptiveReturns.every(x=>x.reporting===80&&x.margin===52));
assert(context.jointDescriptiveReturns.every(x=>x.total_two_party_votes===100000));
// A genuinely validated post-close provider winner flag is still permitted.
// Exact source, candidate and timestamp validation lives in the real
// ElectionNightSignals module and is tested independently in CI.
context.enCivicUsable=item=>item.office==='Senate'?{office:'Senate',key:'NC',percent_reporting:91}:null;
context.window.ElectionNightSignals.validatedCall=src=>src?{
 party:'D',at:'2026-11-04T02:55:00Z'}:null;
const called=evaluate();
assert.equal(called['NC-SEN'].mode,'source_called');
assert.equal(called['NC-SEN'].winnerParty,'D');
assert.equal(Object.keys(called).length,1,
 'A call in one race must not promote uncalibrated counts in other contests');
assert.equal(context.jointPulseRows.length,1);
assert.equal(context.jointDescriptiveReturns.length,1);
context.window.ElectionNightSignals.validatedCall=()=>null;
assert.equal(Object.keys(evaluate()).length,0,
 'Corrected/withdrawn winner evidence must immediately stop influencing odds');
context.jointSourceItem=()=>({...raw,asOf:'2026-11-04T00:00:00Z',
 time:Date.parse('2026-11-04T00:00:00Z')});
evaluate();
assert.equal(context.jointDescriptiveReturns.length,0,
 'Out-of-clock/old source cannot enter the descriptive needle');
// Evaluate the actual ballot 00 versus legacy model 01 bridge in the source reader.
const getItem=vm.runInNewContext(html.slice(first,begin)+'\njointSourceItem',{
 Date:AtNight,
 enModeYear:2026,enOffice:'House',enOfficeSnapshots:{},
 enOfficeErrors:{},enCivicErrors:{},enFetchError:null,
 enSupportedStates:new Set(['NC']),enWatchId:item=>item.office+'|'+item.key,
 enCivicUsable:()=>({verified:true}),
 window:{
  HouseAtLargeBridge:bridge,
  RaceLiveNowcast:{observed:(item,primary,secondary)=>({item,primary,secondary})},
  ElectionNightReconciliation:{officeHealth:()=>({usable:false})}
 }
});
assert.equal(getItem({code:'AK-01'}).item.key,'AK-00',
 'At-large model 01 must NEVER query an imaginary 2026 House 01 ballot');
assert.equal(getItem({code:'NH-01'}).item.key,'NH-01',
 'Ordinary two-seat New Hampshire cannot be rewritten to at-large 00');
console.log('Real browser correlated needle: partial counts descriptive, exact winner calls only, reversibility, poll-close and at-large mapping PASS');
