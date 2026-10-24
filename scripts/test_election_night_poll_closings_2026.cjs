#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const c=require('./election_night_poll_closings_2026.js');
const states='AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');
assert.equal(states.length,50);
assert.equal(Object.keys(c.TIMES).length,50);
assert.deepEqual(Object.keys(c.TIMES).sort(),states.sort());
const sample={
 IN:'2026-11-03T23:00:00Z',KY:'2026-11-03T23:00:00Z',
 GA:'2026-11-04T00:00:00Z',FL:'2026-11-04T00:00:00Z',
 NC:'2026-11-04T00:30:00Z',OH:'2026-11-04T00:30:00Z',
 ME:'2026-11-04T01:00:00Z',PA:'2026-11-04T01:00:00Z',
 TX:'2026-11-04T01:00:00Z',
 AZ:'2026-11-04T02:00:00Z',WI:'2026-11-04T02:00:00Z',
 NV:'2026-11-04T03:00:00Z',
 CA:'2026-11-04T04:00:00Z',AK:'2026-11-04T05:00:00Z'
};
for(const [state,iso] of Object.entries(sample)){
 const n=Date.parse(iso);
 assert.equal(c.floorFor(state),n,state);
 assert.equal(c.floorFor(state+'-01'),n,state+' House');
 assert.equal(c.floorFor(state+'-special'),n,state+' special');
 assert.equal(c.allowed(state,100,new Date(n-1000).toISOString(),n+3600000),false,
  'Pre-close reported votes must not be reauthorized later: '+state);
 assert.equal(c.allowed(state,100,iso,n-1000),false,
  'Source timestamp cannot predate actual local close: '+state);
 assert.equal(c.allowed(state,100,iso,n),true,'Exact close must pass: '+state);
 assert.equal(c.allowed(state,0,'',n-1000),true,'Zero remains unknown: '+state);
}
assert(Number.isNaN(c.floorFor('ZZ')));
assert.equal(c.allowed('ZZ',100,'2026-11-04T10:00:00Z',Date.parse('2026-11-04T10:01:00Z')),false);
assert.equal(c.allowed('AZ',100,'',Date.parse('2026-11-04T03:00:00Z')),false);
assert.equal(c.allowed('AZ',-1,'',Date.parse('2026-11-04T03:00:00Z')),false);
assert.equal(c.allowed('AZ',0.5,'',Date.parse('2026-11-04T03:00:00Z')),false);
// Split-time-zone races may report partial votes before a legitimate winner
// can be called. Never back-date a pre-final-close source winner flag.
for(const [office,key,partial,final] of [
 ['Senate','TX','2026-11-04T01:00:00Z','2026-11-04T02:00:00Z'],
 ['Governor','FL','2026-11-04T00:00:00Z','2026-11-04T01:00:00Z'],
 ['Governor','AK','2026-11-04T05:00:00Z','2026-11-04T06:00:00Z'],
 ['House','AK-00','2026-11-04T05:00:00Z','2026-11-04T06:00:00Z'],
 ['House','SD-00','2026-11-04T01:00:00Z','2026-11-04T02:00:00Z'],
 ['House','TX-23','2026-11-04T01:00:00Z','2026-11-04T02:00:00Z'],
 ['House','MI-01','2026-11-04T01:00:00Z','2026-11-04T02:00:00Z'],
 ['House','FL-02','2026-11-04T00:00:00Z','2026-11-04T01:00:00Z'],
 ['House','IN-01','2026-11-03T23:00:00Z','2026-11-04T00:00:00Z'],
 ['House','ID-01','2026-11-04T03:00:00Z','2026-11-04T04:00:00Z']
]){
 const first=Date.parse(partial),last=Date.parse(final);
 assert.equal(c.allowed(key,1,partial,first),true,key+' partial counts may begin');
 assert.equal(c.winnerAllowed(office,key,1,partial,last+3600000),false,
  key+' source-stamped pre-final winner cannot revive later');
 assert.equal(c.winnerAllowed(office,key,1,final,last-1),false);
 assert.equal(c.winnerAllowed(office,key,1,final,last),true);
 assert.equal(c.winnerFloorFor(office,key),last);
}
for(const [key,at] of [
 ['IN-05','2026-11-03T23:00:00Z'],
 ['KY-06','2026-11-03T23:00:00Z'],
 ['FL-22','2026-11-04T00:00:00Z'],
 ['TX-34','2026-11-04T01:00:00Z'],
 ['MI-07','2026-11-04T01:00:00Z']
])assert.equal(c.winnerAllowed('House',key,1,at,Date.parse(at)),true,
 'House district entirely in the early time zone should not be delayed: '+key);
for(const bad of [
 ['Senate','ZZ'],['President','TX'],['House','AK-bad']
])assert.equal(c.winnerAllowed(bad[0],bad[1],1,
 '2026-11-04T07:00:00Z',Date.parse('2026-11-04T07:00:00Z')),false);
assert.equal(c.winnerAllowed('Senate','TX',0,'2026-11-04T02:00:00Z',
 Date.parse('2026-11-04T02:00:00Z')),false,'No winner on a zero-vote source');

console.log('All 50 state 2026 earliest poll close gates: 14 key boundary cases and mock exclusions PASS');
