'use strict';
// Experimental per-race forecast. No national transfer or browser activation.
const source=require('./kansas_civic_county_source.cjs');
const engine=require('./iowa_county_needle.js');
const reference=require('../data/kansas_county_fips_reference.json');
const facts=require('../data/kansas_senate_county_facts_official.json');
function baselineFor(year){
 if(![2020,2022].includes(year))throw Error('Unsupported Kansas historical baseline');
 const record=facts.years[year],expected=new Map(reference.counties.map(c=>[c.fips,c.county]));
 if(record.counties.length!==105||new Set(record.counties.map(c=>c.county_fips)).size!==105||
  record.counties.some(c=>expected.get(c.county_fips)!==c.county))throw Error('Unmatched Kansas historical geography');
 return {counties:record.counties.map(c=>({county:c.county,records:{total:{dem_votes:c.dem_votes,rep_votes:c.rep_votes}}}))};
}
function forecastFromSource(detail,{prior_margin_points,prior_sigma_points=6,baseline_year=2020,now=Date.now(),source_url=source.URL}={}){
 const input=source.parse(detail,reference,{now,source_url});
 if(!input.live_votes_accepted)return {...input,forecast:null};
 const projection=engine.forecast({baseline:baselineFor(baseline_year),observations:input.counties,
  expected_county_count:105,prior_margin_points,prior_sigma_points});
 return {...input,status:'EXPERIMENTAL_KANSAS_PARTIAL_RETURN_FORECAST',forecast:projection,
  baseline_year,interval_calibrated:false,completion_verified:false,may_move_national_needle:false,
  limitations:['Combined county history; historical and current voting-method splits unavailable',
   'Remaining votes are conditional turnout estimates, not official ballots outstanding',
   'Kansas probability calibration and actual post-close delivery unproven']};
}
module.exports=Object.freeze({baselineFor,forecastFromSource});
