#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {parse,compare,render}=require('./nc_same_office_senate_comparison');
const csv=fs.readFileSync(path.join(__dirname,'../data/nc_2022_senate_county_verified.csv'),'utf8');
const rows=parse(csv);
assert.equal(rows.size,100);
assert.deepEqual(rows.get('37183'),{dem:281367,rep:160818});
let d=0,r=0;for(const x of rows.values()){d+=x.dem;r+=x.rep}
assert.deepEqual([d,r],[1784049,1905786]);
const valid={
 ready:true,race_key:'NC-SEN',
 source_url:'https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2026_11_03/results_pct_20261103.zip',
 sha256:'a'.repeat(64),checked_at:'2026-11-04T00:55:00Z',
 may_move_national_needle:false,ballots_reported:null,reporting_fraction:null,
 rows:[{fips:'37183',candidates:[
 {name:'A',party:'DEM',votes:120},{name:'B',party:'REP',votes:140},
 {name:'C',party:'LIB',votes:8}]}]
};
const prepared=compare(valid,csv);
assert.equal(prepared.ready,true);
assert.equal(prepared.county_count,1);
assert.equal(prepared.rows[0].partial_senate_2026_two_party_votes,260);
assert.equal(prepared.rows[0].partial_senate_2026_dem_margin_points,-7.69);
assert.equal(prepared.rows[0].full_senate_2022_dem_margin_points,
 +(100*(281367-160818)/(281367+160818)).toFixed(2));
assert.equal(prepared.estimated_ballots_remaining,null);
assert.equal(prepared.statewide_senate_swing_estimate,null);
assert.equal(prepared.may_move_national_needle,false);
for(const bad of [
 {...valid,ready:false},{...valid,race_key:'NC-GOV'},
 {...valid,ballots_reported:260},{...valid,reporting_fraction:0.1},
 {...valid,may_move_national_needle:true},
 {...valid,source_url:'https://unverified.example.com/zip'},
 {...valid,rows:[valid.rows[0],valid.rows[0]]},
 {...valid,rows:[{...valid.rows[0],fips:'36061'}]},
 {...valid,rows:[{...valid.rows[0],candidates:[
 {name:'A',party:'DEM',votes:200},{name:'B',party:'DEM',votes:2},
 {name:'C',party:'REP',votes:100}]}]},
])assert.equal(compare(bad,csv).ready,false);
for(const tampered of [
 csv.replace('37183,281367,160818','37183,281368,160818'),
 csv.replace('group 1378','group 0000'),
 csv.replace('2024bf67243ef173','0000000000000000'),
])assert.equal(compare(valid,tampered).ready,false);
const dom=tag=>({tag,children:[],textContent:'',appendChild(node){this.children.push(node)},replaceChildren(){this.children=[]}});
const host=dom('div');
assert.equal(render(host,prepared,{createElement:dom}),true);
const t=host.children.flatMap(x=>[x.textContent,...x.children.map(y=>y.textContent)]).join('\n');
assert.match(t,/same office/i);
assert.match(t,/DESCRIPTIVE ONLY/);
assert.match(t,/unadjusted difference/);
assert.match(t,/NOT statewide swings/);
console.log('Same-office 2022-versus-2026 NC Senate comparison: genuine baseline, candidate limits and disclosure tests passed');
