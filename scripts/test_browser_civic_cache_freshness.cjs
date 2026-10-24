#!/usr/bin/env node
'use strict';
// Test the *actual* browser's eligibility function, not a duplicate model.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const first=html.indexOf('function enCivicUsable(item){');
const last=html.indexOf('\n}\n\nconst enJohnBrownPortraitUrl',first);
assert(first>0&&last>first,'Actual browser source eligibility function must be found');
const code=html.slice(first,last+2);
const closings=require('./election_night_poll_closings_2026.js');
let time=Date.parse('2026-11-04T04:00:00Z');
const data={'Senate|ME':{total:30000,last_updated:'2026-11-04T01:00:00Z',provider:'civicAPI'}};
const errors={};const generations={'Senate|ME':0};
let providerHealthy=true,sourceGeneration=0;
const globals={
 Date:{now:()=>time,parse:Date.parse},
 enWatchId:x=>x.office+'|'+x.key,
 enCivicBreaker:{status:()=>({generation:sourceGeneration,blocked:!providerHealthy})},
 enCivicValidatedGenerations:generations,
 enCivicByWatch:data,
 enCivicErrors:errors,
 enCivicProviderVerified:()=>providerHealthy,
 enElectionVotesAllowed:(key,total,stamp,now)=>closings.allowed(key,total,stamp,now)
};
vm.runInNewContext(code,globals);
const row={office:'Senate',key:'ME'};
const eligible=()=>globals.enCivicUsable(row);
assert.strictEqual(eligible(),data['Senate|ME'],
 'An exactly 180-minute-old legitimate result stays eligible');
time+=1000;
assert.strictEqual(eligible(),null,'Result just older than three hours is audit only');
time=Date.parse('2026-11-04T04:00:00Z');
data['Senate|ME'].last_updated='2026-11-04T04:15:00Z';
assert.strictEqual(eligible(),data['Senate|ME'],'Clock tolerance is 15 minutes');
data['Senate|ME'].last_updated='2026-11-04T04:15:01Z';
assert.strictEqual(eligible(),null,'Reject timestamps beyond the 15-minute skew');
for(const value of ['not-a-date','',null,'2024-11-04T02:00:00Z']){
 data['Senate|ME'].last_updated=value;
 assert.strictEqual(eligible(),null,'Reject malformed or archived source time');
}
data['Senate|ME'].last_updated='2026-11-04T03:59:59Z';
data['Senate|ME'].stale=true;
assert.strictEqual(eligible(),null,'Explicit stale provider record is ineligible');
data['Senate|ME'].stale=false;data['Senate|ME'].sourceStale=true;
assert.strictEqual(eligible(),null,'Explicit supplemental stale flag is ineligible');
data['Senate|ME'].sourceStale=false;
assert.strictEqual(eligible(),data['Senate|ME'],'Valid provider recovers');
providerHealthy=false;assert.strictEqual(eligible(),null,'Provider outage disqualifies cache');
providerHealthy=true;sourceGeneration++;
assert.strictEqual(eligible(),null,'Old generation remains ineligible after recovery');
generations['Senate|ME']=sourceGeneration;
assert.strictEqual(eligible(),data['Senate|ME'],'Exact race revalidation clears generation hold');
errors['Senate|ME']=true;
assert.strictEqual(eligible(),null,'Per-race error stays fail-closed');
errors['Senate|ME']=false;
time=Date.parse('2026-11-04T00:59:59Z');
data['Senate|ME'].last_updated='2026-11-04T00:59:59Z';
assert.strictEqual(eligible(),null,'Do not promote an Eastern preclose positive count');
time=Date.parse('2026-11-04T01:00:00Z');
data['Senate|ME'].last_updated='2026-11-04T01:00:00Z';
assert.strictEqual(eligible(),data['Senate|ME'],'Postclose positive count allowed');
delete data['Senate|ME'];
assert.strictEqual(eligible(),null,'Absent source stays unknown');
console.log('Browser civicAPI source cache: 3-hour expiry, skew, poll close and recovery PASS');
