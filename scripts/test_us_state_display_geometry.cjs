'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),vm=require('node:vm');
const source=JSON.parse(fs.readFileSync('data/us_state_display_geometry_source.json','utf8'));
const zip=fs.readFileSync('data/display_geometry_sources/2024-census-state-20m-kml.zip');
assert.equal(crypto.createHash('sha256').update(zip).digest('hex'),source.sha256);assert.equal(zip.length,source.bytes);
const scope={};vm.runInNewContext(fs.readFileSync('scripts/us_state_display_geometry.js','utf8'),scope);
const data=scope.USStateDisplayGeometry,expected=require('./national_needle_cartogram.js').COORDS.map(x=>x[0]).sort();
assert.deepEqual(Object.keys(data.states).sort(),expected);assert.equal(data.source_sha256,source.sha256);
assert.equal(data.viewBox,'0 0 1000 640');assert.match(data.scope,/not district or vote-allocation/);
assert.equal(new Set(Object.values(data.states).map(x=>x.fips)).size,50);
for(const [code,s]of Object.entries(data.states)){
 assert.match(s.fips,/^\d{2}$/);assert(s.name.length>3);assert.match(s.path,/^M/);assert(!/NaN|Infinity/.test(s.path));
 const values=s.path.match(/-?\d+(?:\.\d+)?/g).map(Number);assert(values.length>=8);assert.equal(values.length%2,0);
 for(let i=0;i<values.length;i+=2){assert(values[i]>=0&&values[i]<=1000,code+' x');assert(values[i+1]>=0&&values[i+1]<=640,code+' y');}
 assert(s.label[0]>=0&&s.label[0]<=1000&&s.label[1]>=0&&s.label[1]<=640);
}
assert.equal(Object.values(data.states).filter(x=>x.leader).length,8);
console.log('Pinned Census display geometry: 50 unique states/FIPS, finite bounded outlines, explicit insets/callouts; no vote allocation PASS');
