#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const map=require('./nc_senate_county_map.js');
const ROOT=path.resolve(__dirname,'..');
const geo=JSON.parse(fs.readFileSync(path.join(ROOT,'data/nc_county_shapes_fips.json'),'utf8'));
const csv=fs.readFileSync(path.join(ROOT,'data/nc_2022_senate_county_verified.csv'),'utf8');
const T=Date.parse('2026-11-04T03:00:00Z');
assert.equal(map.verifyShapes(geo).length,100);
assert.equal(geo.features.find(x=>x.id==='37183').name,'Wake');
assert.equal(map.pathFor(geo.features[0].geometry).startsWith('M'),true);
const baseline=map.build(geo,csv,null,T);
assert(baseline.ready,baseline.reason);
assert.equal(baseline.rows.length,100);
assert.equal(baseline.liveReady,false);
assert.equal(baseline.countiesWithVotes,0);
assert.equal(baseline.historicalStateVotes,3689835,
 'The map must agree with the separately SHA-pinned official Senate statewide totals');
assert.equal(baseline.historicalExposurePct,null);
assert.equal(baseline.reportingSetBiasPoints,null);
assert.equal(baseline.may_move_national_needle,false);
assert.equal(baseline.modeled_votes_outstanding,null);
assert.equal(baseline.reported_ballot_fraction,null);
assert.equal(baseline.rows.filter(x=>x.observed_votes!==null).length,0);
assert(baseline.rows.find(x=>x.fips==='37183').historical_margin>0,
 'Wake 2022 US Senate D/R margin must be verified from the official pinned CSV');
const malformed=structuredClone(geo);
malformed.features[0].id=malformed.features[1].id;
assert.equal(map.build(malformed,csv,null,T).ready,false,
 'Duplicated geometry county may not change the map');
const missing=structuredClone(geo);
missing.features.pop();
assert.equal(map.build(missing,csv,null,T).ready,false);
assert.equal(map.build(geo,csv.replace('group 1378','group 0000'),null,T).ready,false);
const fabricated=structuredClone(geo);
fabricated.features[0].geometry.coordinates[0][0][0]=-99;
assert.equal(map.build(fabricated,csv,null,T).ready,false);
const forced=structuredClone(geo);
forced.features[0].id='37000';
assert.equal(map.build(forced,csv,null,T).ready,false);
function node(tag){
 const el={tag,children:[],attributes:{},style:{},className:'',
  textContent:'',listeners:{},disabled:false,type:'',
  classList:{add(){}},
  appendChild(x){this.children.push(x);return x;},
  setAttribute(k,v){this.attributes[k]=String(v)},
  addEventListener(name,handler){this.listeners[name]=handler},
  replaceChildren(){this.children=[]}
 };
 return el;
}
const document={createElement:node,createElementNS:(_ns,tag)=>node(tag)};
const host=node('section');
assert.equal(map.render(host,baseline,document),true);
const findAll=(el,pred)=>[...(pred(el)?[el]:[]),
 ...el.children.flatMap(child=>findAll(child,pred))];
const svg=findAll(host,x=>x.tag==='svg');
assert.equal(svg.length,1);
assert.equal(svg[0].attributes.viewBox,'0 0 960 345');
const paths=findAll(host,x=>x.tag==='path');
assert.equal(paths.length,100);
assert.equal(new Set(paths.map(x=>x.attributes['data-fips'])).size,100);
assert(paths.every(x=>x.attributes.role==='button'&&x.attributes.tabindex==='0'));
const buttons=findAll(host,x=>x.tag==='button');
assert.equal(buttons.length,3);
assert.equal(buttons[0].disabled,false);
assert.equal(buttons[1].disabled,true);
assert.equal(buttons[2].disabled,true);
assert.match(findAll(host,x=>x.className==='nc-map-status')[0].textContent,
 /all 100 counties/);
const wake=paths.find(x=>x.attributes['data-fips']==='37183');
const alamance=paths.find(x=>x.attributes['data-fips']==='37001');
alamance.listeners.click();
assert.equal(alamance.attributes['aria-pressed'],'true');
assert.equal(wake.attributes['aria-pressed'],'false');
assert.match(findAll(host,x=>x.className==='nc-map-inspector')[0].children[0].textContent,
 /Alamance County/);
// Synthetic candidate records are used ONLY in this test. They are not
// published as live data or interpreted as count completion.
const approved={
 ready:true,race_key:'NC-SEN',
 source_url:'https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2026_11_03/results_pct_20261103.zip',
 may_move_national_needle:false,ballots_reported:null,reporting_fraction:null,
 sha256:'a'.repeat(64),checked_at:'2026-11-04T02:50:00Z',
 rows:[{fips:'37183',candidates:[
  {name:'Candidate D',party:'DEM',votes:15000},
  {name:'Candidate R',party:'REP',votes:10000}
 ]}]
};
const live=map.build(geo,csv,approved,T);
assert(live.ready&&live.liveReady);
assert.equal(live.countiesWithVotes,1);
const wakeHistory=baseline.rows.find(r=>r.fips==='37183');
const expectedExposure=100*(wakeHistory.historical_d+wakeHistory.historical_r)/3689835;
assert.equal(live.historicalExposurePct,+expectedExposure.toFixed(2));
assert.equal(live.reportingSetBiasPoints,
 +(wakeHistory.historical_margin-live.historicalStateMargin).toFixed(2));
assert.equal(live.reported_ballot_fraction,null,
 'Historical reporting-set exposure must never stand in for 2026 ballots counted');
assert.equal(live.rows.find(x=>x.fips==='37183').observed_votes,25000);
assert.equal(live.rows.find(x=>x.fips==='37001').observed_margin,null,
 'No reported county cannot be treated as 0% or 2022 winner');
assert.equal(live.may_move_national_needle,false);
const liveHost=node('div');
map.render(liveHost,live,document);
const toggles=findAll(liveHost,x=>x.tag==='button');
assert.equal(toggles[1].disabled,false);
toggles[1].listeners.click();
assert.match(findAll(liveHost,x=>x.className==='nc-map-bias')[0].textContent,
 /HISTORICAL composition, not 2026 share counted/);
assert.match(findAll(liveHost,x=>x.className==='nc-map-status')[0].textContent,
 /1\/100 counties have D\/R candidate counts/);
const countyShapes=findAll(liveHost,x=>x.tag==='path');
assert.equal(countyShapes.find(x=>x.attributes['data-fips']==='37001').attributes.fill,
 '#46566c','Unknown county must remain neutral gray in 2026 view');
toggles[2].listeners.click();
assert.match(findAll(liveHost,x=>x.className==='nc-map-status')[0].textContent,/difference/);
for(const bad of [
 {...approved,ready:false},{...approved,may_move_national_needle:true},
 {...approved,race_key:'NC-GOV'},{...approved,reporting_fraction:.2},
 {...approved,ballots_reported:25000},{...approved,checked_at:'2026-11-03T22:00:00Z'},
 {...approved,source_url:'https://untrusted.example/results.zip'},
 {...approved,rows:approved.rows.concat(approved.rows[0])}
]){
 const x=map.build(geo,csv,bad,T);
 assert.equal(x.liveReady,false);
 assert.equal(x.countiesWithVotes,0);
}
console.log('North Carolina map: all 100 exact FIPS polygons, official 2022 Senate votes, interactive toggles, source-safe 2026 missingness PASS');
