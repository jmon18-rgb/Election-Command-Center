'use strict';
const assert=require('node:assert/strict');
const {forecast}=require('./iowa_county_needle.js');
const data=require('../data/iowa_senate_county_modes_official.json');
const baseline=data.years['2022'],config={baseline,prior_margin_points:0};
const before=JSON.stringify(baseline),prior=forecast(config);
assert(Math.abs(prior.dem_win_probability-.5)<1e-6);
assert(Math.abs(prior.projected_margin_points)<.001);
assert.equal(prior.counted_dem_votes,0);assert.equal(prior.counted_rep_votes,0);
const initialTurnout=baseline.counties.reduce((s,c)=>s+c.records.total.dem_votes+c.records.total.rep_votes,0);
assert(prior.modeled_remaining_two_party_votes_band[0]/initialTurnout>.58&&
 prior.modeled_remaining_two_party_votes_band[0]/initialTurnout<.60);
assert(prior.modeled_remaining_two_party_votes_band[1]/initialTurnout>1.40&&
 prior.modeled_remaining_two_party_votes_band[1]/initialTurnout<1.42,
 'Shared turnout uncertainty cannot collapse merely because history contains 99 counties');
const make=(fraction,share)=>baseline.counties.map(c=>{
 const n=Math.floor((c.records.total.dem_votes+c.records.total.rep_votes)*fraction);
 return {county:c.county,dem_votes:Math.floor(n*share),rep_votes:n-Math.floor(n*share)};
});
const a=make(.1,.4),b=make(.5,.6);
const first=forecast({...config,observations:a}),second=forecast({...config,observations:b});
assert(second.dem_win_probability>first.dem_win_probability);
for(const [result,observations] of [[first,a],[second,b]]){
 assert.equal(result.counted_dem_votes,observations.reduce((s,r)=>s+r.dem_votes,0));
 assert.equal(result.counted_rep_votes,observations.reduce((s,r)=>s+r.rep_votes,0));
 assert(result.modeled_remaining_two_party_votes>0);
 assert(result.modeled_remaining_two_party_votes_band[0]>=0);
 assert(result.modeled_remaining_two_party_votes_band[0]<result.modeled_remaining_two_party_votes);
 assert(result.modeled_remaining_two_party_votes_band[1]>result.modeled_remaining_two_party_votes);
 assert(result.dem_win_probability>0&&result.dem_win_probability<1);
 assert(result.scenario_margin_band[0]<=result.projected_margin_points);
 assert(result.scenario_margin_band[1]>=result.projected_margin_points);
 assert(Math.abs(result.scenarios.reduce((s,r)=>s+r.weight,0)-1)<1e-10);
 assert.equal(result.observed_method_votes_inferred,false);
 assert.equal(result.interval_calibrated,false);assert.equal(result.may_move_national_needle,false);
}
assert.deepEqual(forecast({...config,observations:a.map(r=>({...r,complete:true,percent_reporting:100}))}),first,
 'External precinct/completion flags cannot remove modeled outstanding ballots');
const ranked=[...baseline.counties].sort((a,b)=>a.records.total.dem_votes/(a.records.total.dem_votes+a.records.total.rep_votes)-
 b.records.total.dem_votes/(b.records.total.dem_votes+b.records.total.rep_votes));
const sameVotes=name=>forecast({...config,observations:[{county:name,dem_votes:700,rep_votes:300}]});
assert.notEqual(sameVotes(ranked[0].county).dem_win_probability,sameVotes(ranked.at(-1).county).dem_win_probability,
 'Matched county geography must matter beyond raw statewide vote share');
assert.equal(JSON.stringify(baseline),before,'Model never overwrites historical/observed source facts');
for(const observations of [[a[0],a[0]],[{...a[0],county:'Unknown'}],[{...a[0],dem_votes:-1}]])
 assert.throws(()=>forecast({...config,observations}));
assert.throws(()=>forecast({...config,baseline:{counties:baseline.counties.slice(1)}}));
assert.throws(()=>forecast({...config,prior_sigma_points:null}));
const surprise=forecast({...config,observations:make(.8,.2)});
const neutralPrior=prior.assumptions.prior_components,updated=surprise.assumptions.prior_components;
assert(Math.abs(neutralPrior.reduce((s,r)=>s+r.posterior_weight,0)-1)<1e-10);
assert.deepEqual(neutralPrior.map(r=>r.posterior_weight),[.85,.1,.05],
 'No observed returns cannot manufacture evidence for a wider prior');
assert(updated[2].posterior_weight>neutralPrior[2].posterior_weight,
 'Coherent surprising returns must increase support for a large swing rather than permanently anchoring to polls');
assert(surprise.projected_margin_points<first.projected_margin_points);
assert(surprise.dem_win_probability<first.dem_win_probability);
assert.equal(surprise.counted_dem_votes,make(.8,.2).reduce((s,r)=>s+r.dem_votes,0));
assert.equal(surprise.interval_calibrated,false);
const countyOnly={counties:baseline.counties.map(c=>({county:c.county,records:{total:{...c.records.total}}}))};
const combinedHistory=forecast({...config,baseline:countyOnly,observations:a});
assert.equal(combinedHistory.historical_method_split_reported,false);
assert.equal(combinedHistory.observed_method_votes_inferred,false);
assert(combinedHistory.scenarios.every(s=>s.order==='combined_history_unknown_methods'),
 'Missing historical method data must not become invented absentee/Election Day patterns');
assert.equal(combinedHistory.counted_dem_votes,first.counted_dem_votes);
assert.equal(combinedHistory.counted_rep_votes,first.counted_rep_votes);
assert.equal(combinedHistory.interval_calibrated,false);
const overrun=forecast({...config,observations:make(2,.5)});
assert(overrun.modeled_remaining_two_party_votes_band[0]>0,
 'Exceeding historical turnout cannot certify that no ballots remain');
assert(overrun.modeled_remaining_two_party_votes_band[1]>overrun.modeled_remaining_two_party_votes_band[0]);
assert.equal(first.historical_method_split_reported,true);
const mixed=structuredClone(baseline);mixed.counties[0]=countyOnly.counties[0];
assert.throws(()=>forecast({...config,baseline:mixed}),/Inconsistent historical method/);
const partial=structuredClone(countyOnly);partial.counties[0].records.absentee=baseline.counties[0].records.absentee;
assert.throws(()=>forecast({...config,baseline:partial}),/Partial historical method/);
console.log('Iowa combined-county needle: actual counts fixed, remaining vote inferred, county/method uncertainty, weighted scenarios and national isolation PASS');
