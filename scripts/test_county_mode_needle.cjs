#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const api=require('./county_mode_needle.js');
const now=Date.parse('2026-11-04T03:30:00Z');
function fixture(fips,mode='election_day',d=6000,r=4000){
 return {source_kind:'official_state_elections',
  source_url:'https://www.ncsbe.gov/results-data/election-results',
  state:'NC',county_fips:fips,mode,
  same_geography_verified:true,same_vote_method_definition_verified:true,
  historical:{year:2024,county_fips:fips,mode,dem_votes:4800,rep_votes:5200},
  current:{year:2026,county_fips:fips,mode,dem_votes:d,rep_votes:r,
   reporting_basis:'official_ballots_counted',
   estimated_fraction_counted:.92,
   updated_at:'2026-11-04T03:20:00Z'}};
}
const a=api.audit(fixture('37063'),now);
// Prefix-only acceptance is not enough: state and county must agree and
// not identify a statewide pseudo-county, regardless of caller trust.
for(const [state,fips] of [
 ['NC','51107'],['VA','37063'],['NC','37000'],
 ['ZZ','37063'],['NC','00000']
]){
 const candidate=fixture(fips);candidate.state=state;
 assert.throws(()=>api.audit(candidate,now),
   /Invalid county or voting-method identity/,
   'Cross-state/fabricated county may not influence local method research');
}
assert(a.qualified);assert.equal(a.observed_2024_d_minus_r_points,-4);
assert.equal(a.observed_2026_d_minus_r_points,20);
assert.equal(a.unadjusted_two_year_change_points,24);
const complete=api.compare({records:[fixture('37063'),fixture('37065'),
 fixture('37067')],now});
assert.equal(complete.exact_counties,3);
assert.equal(complete.completed_mode_units,3);
assert.equal(complete.qualifying_two_party_votes,30000);
assert.equal(complete.sampled_units_unadjusted_change_points,24);
assert.equal(complete.geography_calibrated_national_swing,false);
assert.equal(complete.shared_model_update_allowed,false);
assert.equal(complete.source_calls,0);
assert.equal(complete.ballots_remaining_forecast,null);
const scant=api.compare({records:[fixture('37063')],now});
assert.match(scant.status,/INSUFFICIENT/);
assert.equal(scant.sampled_units_unadjusted_change_points,null);
const slow=fixture('37069');slow.current.estimated_fraction_counted=.12;
assert.equal(api.audit(slow,now).qualified,false);
const wrongGeo=fixture('37071');wrongGeo.historical.county_fips='37070';
assert.throws(()=>api.audit(wrongGeo,now),/Unverified/);
const changedMode=fixture('37073');changedMode.historical.mode='mail';
assert.throws(()=>api.audit(changedMode,now),/Unverified/);
const unverifiable=fixture('37075');unverifiable.same_geography_verified=false;
assert.throws(()=>api.audit(unverifiable,now),/Unverified/);
const noSource=fixture('37077');noSource.source_kind='news_story';
assert.throws(()=>api.audit(noSource,now),/official-source/);
const stale=fixture('37079');stale.current.updated_at='2026-11-03T22:00:00Z';
assert.throws(()=>api.audit(stale,now),/stale/);
// Even a 'verified' postdated or cached local-method count cannot pass
// until the state's actual earliest close (NC: Nov 4 at 00:30 UTC).
const beforeClose=fixture('37086');
beforeClose.current.updated_at='2026-11-04T00:29:59Z';
assert.throws(()=>api.audit(beforeClose,Date.parse('2026-11-04T00:45:00Z')),
 /Pre-close/,'Pre-close source stamp must stay invalid after polls close');
const prematureClock=fixture('37087');
prematureClock.current.updated_at='2026-11-04T00:30:15Z';
assert.throws(()=>api.audit(prematureClock,Date.parse('2026-11-04T00:29:59Z')),
 /Pre-close/,'Future stamped early vote cannot pass before current clock close');
const afterClose=fixture('37088');
afterClose.current.updated_at='2026-11-04T00:30:00Z';
assert.equal(api.audit(afterClose,Date.parse('2026-11-04T00:30:01Z')).qualified,
 true,'Documented post-close local mode returns remain eligible for advisory');

const noProgress=fixture('37081');noProgress.current.reporting_basis='precincts_reporting';
assert.throws(()=>api.audit(noProgress,now),/share of ballots counted/);
const same=fixture('37083');
assert.throws(()=>api.compare({records:[same,same],now}),/Duplicate/);
assert.equal(fixture('37085').historical.year,2024);
console.log('County voting-mode early-signal gates PASS; no raw residual enters national forecasting');
