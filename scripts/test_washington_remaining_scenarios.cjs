'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const api=require('./washington_remaining_scenarios.js'),geo=require('../data/washington_house_03_remaining_geography.json');
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(geo.local_original)).digest('hex'),geo.source_sha256);
assert.deepEqual(api.whole,geo.whole_county_fips);assert(!api.whole.includes(geo.split_county_fips));
assert.equal(api.variants([])[0].weight,1);
// Synthetic estimates: these are never actual 2026 ballots or calibration.
const rows=api.whole.map(county_fips=>({county_fips,estimated_ballots_left:10000}));
const v=api.variants(rows);assert.equal(v.length,6);assert(Math.abs(v.reduce((s,x)=>s+x.weight,0)-1)<1e-12);assert.equal(v[0].weight,.5);
assert.equal(v[0].remaining('53011',100000),null);
assert(v.slice(1).some(x=>x.remaining('53011',100000)>10000),'Estimate cannot act as a hard cap');
assert(v.every(x=>x.remaining('53067',100000)===null),'No Thurston allocation');
assert(v.slice(1).every(x=>x.remaining('53011',100000)===x.remaining('53015',100000)),'Provider error is shared, not independent county evidence');
assert(api.variants([{county_fips:'53011',estimated_ballots_left:0}]).some(x=>(x.remaining('53011',100000)||0)>0),'Timestamped zero cannot erase remaining uncertainty');
for(const bad of [[...rows,rows[0]],[{county_fips:'53067',estimated_ballots_left:1}],[{county_fips:'53011',estimated_ballots_left:-1}],[{county_fips:'53011',estimated_ballots_left:.5}]])assert.throws(()=>api.variants(bad));
assert.equal(api.assumptions.calibrated,false);console.log('PASS: pinned six whole counties, historical mixture retained, shared uncertain estimates, no hard cap/Thurston allocation; SYNTHETIC only');
