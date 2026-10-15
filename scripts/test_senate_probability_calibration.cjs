#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const model=require('./chamber_control_model.js');
const audit=model.senatePollingErrorBudget;
const regular={independentFirms:4,contributingFirms:7,daysSinceLatest:3,
 special:false,sourceSigma:5.633};
assert.deepEqual(audit(regular),
 {floor:6.5,totalSigma:6.5,tier:'recent_multi_firm'});
assert.equal(audit({...regular,independentFirms:2,contributingFirms:3}).floor,6.5);
assert.equal(audit({...regular,independentFirms:1}).floor,8.5);
assert.equal(audit({...regular,daysSinceLatest:14}).floor,6.5);
assert.equal(audit({...regular,daysSinceLatest:15}).floor,8.5);
assert.deepEqual(audit({...regular,special:true}),
 {floor:7.5,totalSigma:7.5,tier:'recent_deep_special'});
assert.equal(audit({...regular,special:true,independentFirms:3}).floor,8.5);
assert.equal(audit({...regular,special:true,contributingFirms:5}).floor,8.5);
assert.equal(audit({...regular,special:true,daysSinceLatest:15}).floor,8.5);
assert.equal(audit({...regular,special:true,sourceSigma:9}).totalSigma,9);
assert.equal(audit({...regular,special:false}).floor,6.5);
assert.equal(audit({...regular,sourceSigma:9.5}).totalSigma,9.5,
 'Historical error source can widen but never be overridden by a smaller floor');
for(const key of ['independentFirms','contributingFirms','daysSinceLatest','sourceSigma']){
 assert.throws(()=>audit({...regular,[key]:NaN}),/Invalid Senate/);
}
assert.throws(()=>audit({...regular,contributingFirms:1}),/Invalid Senate/);
assert.throws(()=>audit({...regular,special:'false'}),/Invalid Senate/);
console.log('Senate source-quality uncertainty floors, boundary/stale handling and provenance guards PASS.');
