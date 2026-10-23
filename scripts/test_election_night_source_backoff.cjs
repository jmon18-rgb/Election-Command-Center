#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const api=require('./election_night_source_backoff.js');
let now=Date.parse('2026-11-04T03:00:00Z');
const c=api.create(()=>now);
assert.equal(c.status().blocked,false);
assert.equal(c.fail(404).blocked,false,'Missing race is not provider failure');
assert.equal(c.fail(503).blocked,true);
assert.equal(c.status().seconds_remaining,60);
assert.equal(c.status().last_http_status,503);
assert.equal(c.status().generation,1);
assert.equal(c.status().consecutive,1);
now+=30000;
c.success();
assert.equal(c.status().blocked,true,
 'Another in-flight request succeeding must not erase active cooldown');
now+=30000;
assert.equal(c.status().blocked,false);
assert.equal(c.fail(503).seconds_remaining,120);
assert.equal(c.status().consecutive,2);
assert.equal(c.status().generation,2);
now+=120000;
assert.equal(c.fail(429).seconds_remaining,300);
now+=300000;
assert.equal(c.fail(502).seconds_remaining,600);
now+=600000;
assert.equal(c.fail(504).seconds_remaining,600);
now+=600000;
assert.equal(c.fail(503).seconds_remaining,600,
 'Exponentially increasing delays must never exceed ten minutes');
now+=600000;
assert.equal(c.success().blocked,false);
assert.equal(c.status().consecutive,0);
assert.equal(c.status().last_http_status,null);
assert.equal(c.status().generation,6,
 'Successful source recovery does not erase the race-validation epoch');
assert.equal(c.fail(429).seconds_remaining,60,
 'A recovered provider starts again with a short cooldown');
assert.equal(api.TRANSIENT.has(500),false,
 'Unexpected provider content/identity errors are not global HTTP outages');
// Two independently validated Senate races must not share a recovery token.
// Provider health may recover when one detail succeeds, but each cached race
// still needs a detail validated in the current outage generation.
let t=Date.parse('2026-11-04T04:00:00Z');
const shared=api.create(()=>t);
const validated={ME:shared.status().generation,OH:shared.status().generation};
const usable=state=>shared.status().consecutive===0&&
 validated[state]===shared.status().generation;
assert(usable('ME')&&usable('OH'));
shared.fail(503);
assert.equal(usable('ME'),false);
assert.equal(usable('OH'),false);
t+=60000;
shared.success(); // A healthy service alone is not per-race revalidation.
assert.equal(usable('ME'),false);
assert.equal(usable('OH'),false);
validated.ME=shared.status().generation;
assert.equal(usable('ME'),true);
assert.equal(usable('OH'),false,
 'Refreshing Maine must not revive an older Ohio Senate source snapshot');
validated.OH=shared.status().generation;
assert.equal(usable('OH'),true);
shared.fail(429);
assert.equal(usable('ME'),false);
assert.equal(usable('OH'),false);
console.log('Source circuit breaker PASS: 503/429 backoff, bounded retries, recovery, local 404 exclusion, no source values changed');
