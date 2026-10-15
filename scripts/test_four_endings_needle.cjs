#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const needle=require('./four_endings_needle.js');
const a={samples:3000,counts:{red_dawn:300,shrug:600,blue_wave:1300,blue_tsunami:800},
 probabilities:{red_dawn:10,shrug:20,blue_wave:1300/30,blue_tsunami:800/30}};
const summary=needle.summarize(a);
assert.equal(summary.totalSamples,3000);
assert.equal(summary.winner.key,'blue_wave');
assert.equal(summary.runnerUp.key,'blue_tsunami');
assert.equal(summary.needleDegrees,22.5);
assert.deepEqual(summary.rows.map(x=>x.count),[300,600,1300,800]);
const tsunami={samples:100,counts:{red_dawn:1,shrug:2,blue_wave:3,blue_tsunami:94},
 probabilities:{red_dawn:1,shrug:2,blue_wave:3,blue_tsunami:94}};
assert.equal(needle.summarize(tsunami).winner.key,'blue_tsunami');
assert.equal(needle.summarize(tsunami).needleDegrees,67.5);
const red={samples:100,counts:{red_dawn:91,shrug:5,blue_wave:4,blue_tsunami:0},
 probabilities:{red_dawn:91,shrug:5,blue_wave:4,blue_tsunami:0}};
assert.equal(needle.summarize(red).needleDegrees,-67.5);
assert.throws(()=>needle.summarize({...a,counts:{...a.counts,blue_wave:1301}}),
 /sum to simulation size|Inconsistent joint probability/);
assert.throws(()=>needle.summarize({...a,probabilities:{...a.probabilities,red_dawn:65}}),
 /Inconsistent joint probability/);
assert.throws(()=>needle.summarize(null),/Missing same-draw/);
console.log('Four Endings needle: same-draw invariants + categorical pointer passed');
