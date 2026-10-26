'use strict';
const assert=require('node:assert/strict');
const {forecastFromSource,baselineFor}=require('./kansas_county_needle.cjs');
const {forecast}=require('./iowa_county_needle.js');
const facts=require('../data/kansas_senate_county_facts_official.json');
const options={prior_margin_points:0,now:Date.parse('2026-11-04T03:05:00Z')};
// Synthetic post-close payloads with contrasting county returns; never live votes.
function payload(demShare){
 const candidates=[{name:'Adam Hamilton',party:'Democratic',votes:0},
  {name:'Roger Marshall',party:'Republican',votes:0},{name:'David C Graham',party:'Libertarian',votes:0}];
 const region_results=Object.fromEntries(facts.years['2020'].counties.map(c=>{
  const n=Math.floor((c.dem_votes+c.rep_votes)*.65),d=Math.floor(n*demShare);
  const rows=candidates.map((person,i)=>({...person,votes:[d,n-d,0][i],winner:false}));
  rows.forEach((r,i)=>candidates[i].votes+=r.votes);
  return [c.county_fips,{name:c.county,type:'County',fips:c.county_fips,percent_reporting:100,candidates:rows}];
 }));
 return {country:'US',province:'KS',district:null,municipality:null,election_scope:'General',
  election_type:'US Senate',election_name:'Kansas US Senate',election_date:'2026-11-03T05:00:00.000Z',
  test_data:false,last_updated:'2026-11-04T03:00:00Z',candidates,region_results};
}
const d=forecastFromSource(payload(.6),options),r=forecastFromSource(payload(.4),options);
assert(d.forecast.dem_win_probability>r.forecast.dem_win_probability+.3);
assert(d.forecast.projected_margin_points>r.forecast.projected_margin_points);
for(const result of [d,r]){
 assert.equal(result.counties.length,105);assert.equal(result.may_move_national_needle,false);
 assert.equal(result.interval_calibrated,false);assert.equal(result.completion_verified,false);
 assert.equal(result.forecast.historical_method_split_reported,false);
 assert(result.forecast.modeled_remaining_two_party_votes>0,'100% precinct flag cannot certify completion');
 const [lo,hi]=result.forecast.modeled_remaining_two_party_votes_band;
 assert(lo>=0&&hi>lo&&Number.isFinite(hi));
}
const test=payload(.6);test.test_data=true;
assert.equal(forecastFromSource(test,options).forecast,null);
const flags=payload(.6);flags.candidates.forEach(c=>c.winner=true);
assert.equal(forecastFromSource(flags,options).forecast.dem_win_probability,d.forecast.dem_win_probability);
const mismatch=payload(.6);mismatch.region_results['20001'].candidates[0].votes++;
assert.throws(()=>forecastFromSource(mismatch,options));
assert.throws(()=>forecastFromSource(payload(.6),{...options,source_url:'https://example.com'}));
assert.throws(()=>forecastFromSource(payload(.6),{...options,prior_margin_points:NaN}));
assert.throws(()=>forecast({baseline:baselineFor(2020),observations:[],prior_margin_points:0}),
 '105 counties require explicit supported scope; Iowa default stays99');
assert.throws(()=>baselineFor(2018));
assert(Number.isFinite(forecastFromSource(payload(.6),{...options,baseline_year:2022}).forecast.dem_win_probability));
console.log(JSON.stringify({status:'SYNTHETIC_KANSAS_SOURCE_TO_FORECAST_PASS_NOT_LIVE',
 dem_favoring_probability:d.forecast.dem_win_probability,rep_favoring_probability:r.forecast.dem_win_probability,
 remaining_range:d.forecast.modeled_remaining_two_party_votes_band}));
