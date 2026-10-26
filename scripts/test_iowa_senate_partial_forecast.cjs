'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {forecast,cellsFromOfficialYear}=require('./iowa_senate_partial_forecast.cjs');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/iowa_senate_county_modes_official.json'),'utf8'));
for(const [year,d,r,ballots] of [['2020',754859,864997,1700130],['2022',533330,681501,1230416]]){
 const source=data.years[year];assert.equal(source.counties.length,99);
 assert.equal(new Set(source.counties.map(c=>c.county)).size,99);
 const totals={dem_votes:0,rep_votes:0,other_votes:0,undervotes:0,overvotes:0,ballots:0};
 for(const c of source.counties){
  for(const k of Object.keys(totals)){
   const values=['election_day','absentee','total'].map(m=>c.records[m][k]);
   assert(values.every(n=>Number.isSafeInteger(n)&&n>=0));
   assert.equal(values[0]+values[1],values[2],year+' '+c.county+' '+k);
   totals[k]+=values[2];
  }
  for(const record of Object.values(c.records))assert.equal(record.dem_votes+record.rep_votes+
   record.other_votes+record.undervotes+record.overvotes,record.ballots,
   'Ballots include undervotes/overvotes, not just counted candidate votes');
 }
 assert.deepEqual(totals,source.statewide);
 assert.equal(totals.dem_votes,d);assert.equal(totals.rep_votes,r);assert.equal(totals.ballots,ballots);
}
assert.deepEqual(data.years['2020'].counties.map(c=>c.county).sort(),
 data.years['2022'].counties.map(c=>c.county).sort());
const baseline=cellsFromOfficialYear(data.years['2020']);
const config={baseline,prior_margin_points:0,prior_sigma_points:6};
const prior=forecast(config);
assert(Math.abs(prior.projected_d_minus_r_margin_points)<1e-8,'Before returns, center on the supplied race prior');
assert(Math.abs(prior.dem_win_probability-.5)<1e-8);
assert.equal(prior.counted_dem_votes,0);
assert.equal(prior.counted_rep_votes,0,'Historical votes never become observed current votes');
const outcomes=cellsFromOfficialYear(data.years['2022']);
const complete=outcomes.map(r=>({...r,complete:true}));
const final=forecast({...config,observations:complete});
assert.equal(final.modeled_remaining_two_party_votes,0);
assert.equal(final.counted_dem_votes,533330);assert.equal(final.counted_rep_votes,681501);
assert.equal(final.dem_win_probability,0);
assert.equal(final.may_move_national_needle,false);
const partial=forecast({...config,observations:[{...baseline[0],dem_votes:20,rep_votes:0,complete:false}]});
assert.equal(partial.posterior_swing_margin_points,0,'Do not infer statewide swing from a selected partial batch');
assert.equal(partial.counted_dem_votes,20);
const exceeded=forecast({...config,observations:[{...baseline[0],dem_votes:1000000,rep_votes:0,complete:false}]});
assert.equal(exceeded.dem_win_probability,null,'A broken turnout estimate must not create false certainty');
assert.equal(exceeded.status,'TURNOUT_SCENARIO_EXCEEDED_REVISE_ESTIMATE');
for(const observations of [[complete[0],complete[0]],
 [{...complete[0],county:'Not an Iowa county'}],[{...complete[0],dem_votes:-1}],
 [{...complete[0],complete:undefined}],[{...complete[0],mode:'precinct_percentage'}]])
 assert.throws(()=>forecast({...config,observations}));
assert.throws(()=>forecast({...config,baseline:baseline.slice(1)}));
const report=require('./evaluate_iowa_senate_partial_forecast.cjs');
assert.equal(report.actual_historical_reporting_order,false);
assert.equal(report.interval_calibrated,false);assert.equal(report.live_source_connected,false);
assert.equal(report.scenarios.length,4);
for(const s of report.scenarios){const last=s.snapshots.at(-1);assert.equal(last.remaining,0);
 assert(Math.abs(last.projected_margin-report.truth_margin)<1e-10);}
console.log(JSON.stringify({status:'IOWA_HISTORICAL_REMAINING_VOTE_PROTOTYPE_PASS',
 official_counties_per_year:99,county_method_cells_per_year:198,
 assumed_order_model_MAE:report.model_partial_mae,naive_counted_share_MAE:report.naive_partial_mae,
 true_clock_calibration:false,live_county_source_connected:false}));
