const assert=require('node:assert/strict'),{load,envelope}=require('./ohio_test_fixture.cjs');
const kernel=require('./national_county_likelihood.js'),model=require('./chamber_control_model.js');
const basis=model.prepare({seats:load('seat_universe'),history:load('house_history_2024_staging'),
 geography:load('house_geography_bridge'),senateHistory:load('senate_history_2020_2022_2024'),
 odds:load('race_probabilities'),polls:load('polling_estimates')});
const opts={samples:900,seed:20261103,now:Date.parse('2026-11-04T03:06:00Z')};
const blue=kernel.condition(model,basis,[envelope(12)],opts),red=kernel.condition(model,basis,[envelope(-12)],opts);
assert.notDeepEqual(blue.result.probabilities,blue.baseline.probabilities);
assert.notDeepEqual(blue.result.probabilities,red.result.probabilities);
assert.deepEqual(blue.baseline.probabilities,red.baseline.probabilities);
assert.deepEqual(model.simulate(basis,{samples:900,seed:20261103}).probabilities,blue.baseline.probabilities);
assert.equal(blue.diagnostics.used[0].code,'OH-SEN');
assert.equal(blue.diagnostics.house_vote_sources,0);
assert.equal(blue.diagnostics.independent_historical_calibration,false);
assert(blue.diagnostics.effective_sample_size>=450-1e-6);
assert.throws(()=>kernel.condition(model,basis,[envelope(),envelope()],opts),/same returns twice/);
const narrow=envelope();for(const c of narrow.snapshot.counties.slice(1))c.dem_votes=c.rep_votes=c.other_votes=0;
assert.throws(()=>kernel.compile(narrow,opts),/breadth/);
const stale=envelope();stale.snapshot.snapshot_updated_at='2026-11-03T01:00:00Z';
assert.throws(()=>kernel.compile(stale,opts),/Stale/);
console.log('Ohio special-Senate counts -> national movement, same baseline draws, ESS bound and duplicate/breadth/stale exclusion PASS (SYNTHETIC, uncalibrated)');
