#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const x=require('./house_at_large_bridge.js');
const universe=JSON.parse(fs.readFileSync('data/seat_universe.json','utf8'));
const atLarge=Object.entries(universe.house.by_state)
 .filter(([state,n])=>n===1).map(([state])=>state).sort();
assert.deepEqual([...x.STATES].sort(),atLarge);
assert.equal(atLarge.length,6);
for(const state of atLarge){
 assert.equal(x.sourceKey(state+'-01'),state+'-00');
 assert.equal(x.modelCode(state+'-00'),state+'-01');
 assert.deepEqual(x.sourceItem({office:'House',key:state+'-01'}),
  {office:'House',key:state+'-00'});
 assert.equal(x.sourceKey(state+'-00'),state+'-00');
 assert.equal(x.modelCode(state+'-01'),state+'-01');
}
for(const code of ['AZ-01','CA-01','MT-01','NC-01','TX-01','NH-01',
 'AK-02','AK-SEN','FL-SEN']){
 assert.equal(x.sourceKey(code),code,'Never remap ordinary seat '+code);
 assert.equal(x.modelCode(code),code);
}
assert.deepEqual(x.sourceItem({office:'Senate',key:'AK'}),{office:'Senate',key:'AK'});
const forecastCodes=universe.house.seats.map(r=>r.race_code);
const converted=forecastCodes.map(code=>x.sourceKey(code));
assert.equal(forecastCodes.length,435);
assert.equal(new Set(converted).size,435,
 'Normalizing six at-large races never creates duplicate House seats');
assert.equal(converted.filter(k=>k.endsWith('-00')).length,6);
assert.equal(converted.filter(k=>k.endsWith('-01')).length,44,
 'Single-district states are 00 while multi-district first seats remain 01');
console.log('House at-large live/forecast bridge PASS: six 00 sources map to 01 model IDs with 435 unique seats');
