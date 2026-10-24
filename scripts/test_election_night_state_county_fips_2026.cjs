#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fips=require('./election_night_state_county_fips_2026.js');
assert.equal(Object.keys(fips.PREFIX).length,51);
assert.equal(new Set(Object.values(fips.PREFIX)).size,51);
for(const [state,prefix] of Object.entries(fips.PREFIX)){
 assert(fips.matches(state,prefix,prefix+'001'),state);
 assert(!fips.matches(state,prefix,'99999'));
 assert(!fips.matches(state,prefix,prefix+'000'),
  'Statewide pseudo-county cannot be counted as a real county');
}
for(const spec of [
 ['NC','37','37183'],['VA','51','51107'],['MA','25','25009'],
 ['NH','33','33011'],['AK','02','02020'],['HI','15','15003']
])assert(fips.matches(...spec),spec.join(' '));
for(const bad of [
 ['NC','51','51107'],['VA','37','37001'],['MA','36','36001'],
 ['NC',37,'37183'],['ZZ','99','99001'],['NC','37','37000'],
 ['NC','37','3718'],['NC','37','37abc'],['NC','37',37001]
])assert.equal(fips.matches(...bad),false,String(bad));
console.log('All 50 states plus D.C.: canonical county-prefix identity guard PASS');
