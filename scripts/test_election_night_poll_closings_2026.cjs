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
console.log('All 50 state 2026 earliest poll close gates: 14 key boundary cases and mock exclusions PASS');
