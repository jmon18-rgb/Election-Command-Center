'use strict';
// Controlled synthetic national evaluation, NOT historical calibration/live votes.
const assert=require('node:assert/strict'),{fixture,load}=require('./washington_test_fixture.cjs');
const cache=require('./washington_official_cache.js'),kernel=require('./national_county_likelihood.js'),model=require('./chamber_control_model.js');
(async()=>{
 const now=Date.parse('2026-11-04T04:06:00Z'),history=load('washington_house_03_2024_county_baseline_official'),reference=load('washington_house_03_county_fips_reference');
 const snapshot=await cache.parse(await fixture(),reference,{now});
 const wa={baseline_year:2024,reference,baseline:{race_code:'WA-03',geography_scope:'district_parts',counties:history.counties.map(c=>({county:c.county,records:{total:c}}))},snapshot};
 const basis=model.prepare({seats:load('seat_universe'),history:load('house_history_2024_staging'),geography:load('house_geography_bridge'),senateHistory:load('senate_history_2020_2022_2024'),odds:load('race_probabilities'),polls:load('polling_estimates')});
 const opts={samples:900,seed:20261103,now};
 const blue=kernel.condition(model,basis,[wa],opts);
 assert.equal(blue.diagnostics.used[0].code,'WA-03');assert.notDeepEqual(blue.result.probabilities,blue.baseline.probabilities);
 assert.equal(blue.diagnostics.house_vote_sources,1);assert.deepEqual(blue.diagnostics.house_vote_states,['WA']);
 assert.equal(blue.diagnostics.independent_historical_calibration,false);assert(blue.diagnostics.effective_sample_size>=450-1e-6);
 assert.throws(()=>kernel.condition(model,basis,[wa,wa],opts),/same returns twice/);
 const nine=[wa];
 const specs=[['IA-SEN','iowa',2022],['KS-SEN','kansas',2020],['TX-SEN','texas',2024],['WI-01','wisconsin_house_01',2024],['WI-03','wisconsin_house_03',2024],['MI-04','michigan_house_04',2024],['PA-10','pennsylvania_house_10',2024],['NY-17','new_york_house_17',2024]];
 const registry=require('./competitive_live_source_report.cjs').races;
 for(const [code,name,year] of specs){
  const ref=load(name+'_county_fips_reference'),house=code.match(/-\d\d$/),fips=new Map(ref.counties.map(c=>[c.county,c.fips]));
  const raw=name==='iowa'?load('iowa_senate_county_modes_official').years[2022]:name==='kansas'?load('kansas_senate_county_facts_official').years[2020]:load(name==='texas'?'texas_senate_2024_county_baseline_official':name+(name==='michigan_house_04'?'_2024_county_baseline_processed':'_2024_county_baseline_official'));
  const totals=c=>c.records?.total||(!c.records?c:{dem_votes:c.records.absentee.dem_votes+c.records.election_day.dem_votes,rep_votes:c.records.absentee.rep_votes+c.records.election_day.rep_votes});
  const counties=raw.counties.map(c=>({county:c.county,records:{total:totals(c)}}));
  nine.push({reference:ref,baseline_year:year,baseline:{...(house?{race_code:code,geography_scope:'district_parts'}:{}),counties},snapshot:{...snapshot,race_code:code,source_url:registry.find(r=>r.code===code).url,county_identities_matched:ref.counties.length,counties:counties.map(c=>({county:c.county,county_fips:fips.get(c.county),dem_votes:Math.floor(c.records.total.dem_votes*.65),rep_votes:Math.floor(c.records.total.rep_votes*.65),other_votes:0}))}});
 }
 const all=kernel.condition(model,basis,nine,opts);assert.equal(all.diagnostics.used.length,9);assert.equal(all.diagnostics.house_vote_sources,6);assert.equal(all.diagnostics.house_vote_states.length,5);
 const ordinary=model.simulate(basis,{samples:900,seed:20261103});const {county_draws,...captured}=model.simulate(basis,{samples:900,seed:20261103,captureCountyDraws:nine.map(e=>e.snapshot.race_code)});
 assert.deepEqual(captured,ordinary,'Ninth diagnostic capture never changes baseline draws');
 const narrow=structuredClone(wa);for(const c of narrow.snapshot.counties.slice(1))c.dem_votes=c.rep_votes=c.other_votes=0;
 assert.throws(()=>kernel.compile(narrow,{now}),/breadth/,'One county cannot stand in for the full race');
 assert.equal(all.result.county_results_update.interval_calibrated,false);
 const mh=load('maine_senate_2020_county_baseline_official'),mr=load('maine_county_fips_reference');
 const me={reference:mr,baseline_year:2020,baseline:{counties:mh.counties,statewide:mh.statewide,state_unallocated_uocava:mh.state_unallocated_uocava},snapshot:require('./maine_civic_county_source.js').parse(require('./maine_test_fixture.cjs').fixture(),mr,{now})};
 const ten=kernel.condition(model,basis,[...nine,me],opts);assert.equal(ten.diagnostics.used.length,10);assert.equal(ten.diagnostics.house_vote_sources,6);assert(ten.diagnostics.effective_sample_size>=450-1e-6);
 const eleven=kernel.condition(model,basis,[...nine,me,require('./ohio_test_fixture.cjs').envelope(12,now)],opts);assert.equal(eleven.diagnostics.used.length,11);assert.equal(eleven.diagnostics.house_vote_sources,6);assert(eleven.diagnostics.effective_sample_size>=450-1e-6);assert.deepEqual(eleven.baseline.probabilities,ten.baseline.probabilities);
 const {county_draws:allCaptured,...elevenBaseline}=model.simulate(basis,{samples:900,seed:20261103,captureCountyDraws:[...nine,me,require('./ohio_test_fixture.cjs').envelope(12,now)].map(e=>e.snapshot.race_code)});assert.equal(allCaptured.codes.length,11);assert.deepEqual(elevenBaseline,ordinary);
 const twelve=kernel.condition(model,basis,[...nine,me,require('./ohio_test_fixture.cjs').envelope(12,now),require('./pennsylvania_house_07_test_fixture.cjs').envelope(12,now)],opts);assert.equal(twelve.diagnostics.used.length,12);assert.equal(twelve.diagnostics.house_vote_sources,7);assert.equal(twelve.diagnostics.state_likelihood_budget_members.PA,3);assert(twelve.diagnostics.state_likelihood_max_ratio.PA<=20+1e-8);assert(twelve.diagnostics.effective_sample_size>=450-1e-6);assert.deepEqual(twelve.baseline.probabilities,eleven.baseline.probabilities);
 const thirteen=kernel.condition(model,basis,[...nine,me,require('./ohio_test_fixture.cjs').envelope(12,now),require('./pennsylvania_house_07_test_fixture.cjs').envelope(12,now),require('./arizona_house_06_test_fixture.cjs').envelope(12,now)],opts);assert.equal(thirteen.diagnostics.used.length,13);assert.equal(thirteen.diagnostics.house_vote_sources,8);assert.equal(thirteen.diagnostics.state_likelihood_budget_members.AZ,1);assert(thirteen.diagnostics.state_likelihood_max_ratio.AZ<=20+1e-8);assert(thirteen.diagnostics.effective_sample_size>=450-1e-6);assert.deepEqual(thirteen.baseline.probabilities,twelve.baseline.probabilities);
 const fourteen=kernel.condition(model,basis,[...nine,me,require('./ohio_test_fixture.cjs').envelope(12,now),require('./pennsylvania_house_07_test_fixture.cjs').envelope(12,now),require('./arizona_house_06_test_fixture.cjs').envelope(12,now),require('./virginia_house_02_test_fixture.cjs').envelope(12,now)],opts);assert.equal(fourteen.diagnostics.used.length,14);assert.equal(fourteen.diagnostics.house_vote_sources,9);assert.equal(fourteen.diagnostics.state_likelihood_budget_members.VA,1);assert(fourteen.diagnostics.state_likelihood_max_ratio.VA<=20+1e-8);assert(fourteen.diagnostics.effective_sample_size>=450-1e-6);assert.deepEqual(fourteen.baseline.probabilities,thirteen.baseline.probabilities);
 const fifteen=kernel.condition(model,basis,[...nine,me,require('./ohio_test_fixture.cjs').envelope(12,now),require('./pennsylvania_house_07_test_fixture.cjs').envelope(12,now),require('./arizona_house_06_test_fixture.cjs').envelope(12,now),require('./virginia_house_02_test_fixture.cjs').envelope(12,now),require('./pennsylvania_house_08_test_fixture.cjs').envelope(12,now)],opts);assert.equal(fifteen.diagnostics.used.length,15);assert.equal(fifteen.diagnostics.house_vote_sources,10);assert.equal(fifteen.diagnostics.state_likelihood_budget_members.VA,1);assert(fifteen.diagnostics.state_likelihood_max_ratio.VA<=20+1e-8);assert(fifteen.diagnostics.effective_sample_size>=450-1e-6);assert.deepEqual(fifteen.baseline.probabilities,fourteen.baseline.probabilities);assert.equal(fifteen.diagnostics.state_likelihood_budget_members.PA,3);assert(fifteen.diagnostics.state_likelihood_max_ratio.PA<=20+1e-8);
 const sources=[...nine,me,require('./ohio_test_fixture.cjs').envelope(12,now),require('./pennsylvania_house_07_test_fixture.cjs').envelope(12,now),require('./arizona_house_06_test_fixture.cjs').envelope(12,now),require('./virginia_house_02_test_fixture.cjs').envelope(12,now),require('./pennsylvania_house_08_test_fixture.cjs').envelope(12,now),require('./michigan_house_07_test_fixture.cjs').envelope(12,now)];
 const sixteen=kernel.condition(model,basis,sources,opts);assert.equal(sixteen.diagnostics.used.length,16);assert.equal(sixteen.diagnostics.house_vote_sources,11);assert.equal(sixteen.diagnostics.state_likelihood_budget_members.VA,1);assert(sixteen.diagnostics.state_likelihood_max_ratio.VA<=20+1e-8);assert(sixteen.diagnostics.effective_sample_size>=450-1e-6);assert.deepEqual(sixteen.baseline.probabilities,fifteen.baseline.probabilities);assert.equal(sixteen.diagnostics.state_likelihood_budget_members.PA,3);assert(sixteen.diagnostics.state_likelihood_max_ratio.PA<=20+1e-8);assert.equal(sixteen.diagnostics.state_likelihood_budget_members.MI,2);assert(sixteen.diagnostics.state_likelihood_max_ratio.MI<=20+1e-8);
 // A lifecycle across all programmed inputs, not independent chronology/calibration.
 const originalSources=structuredClone(sources);
 const officialOnly=sources.filter(e=>!new URL(e.snapshot.source_url).hostname.endsWith('civicapi.org'));
 assert.deepEqual(officialOnly.map(e=>e.snapshot.race_code).sort(),['VA-02','WA-03']);
 const outage=kernel.condition(model,basis,officialOnly,opts);
 assert.equal(outage.diagnostics.used.length,2,'Civic outage keeps both independent official inputs');
 assert.deepEqual(outage.baseline,sixteen.baseline);
 const corrected=sources.map(e=>e.snapshot.race_code==='PA-08'?require('./pennsylvania_house_08_test_fixture.cjs').envelope(-12,now):e);
 const afterCorrection=kernel.condition(model,basis,corrected,opts);
 assert.notDeepEqual(afterCorrection.result.probabilities,sixteen.result.probabilities,'One corrected district changes the national outlook without changing baseline draws');
 assert.deepEqual(afterCorrection.baseline,sixteen.baseline);
 const retracted=corrected.filter(e=>!['PA-07','MI-07'].includes(e.snapshot.race_code));
 const partial=kernel.condition(model,basis,retracted,opts);
 assert.equal(partial.diagnostics.used.length,14);
 assert.equal(partial.diagnostics.state_likelihood_budget_members.PA,3);
 assert.equal(partial.diagnostics.state_likelihood_budget_members.MI,2);
 assert(partial.diagnostics.state_likelihood_max_ratio.PA<=Math.pow(20,2/3)+1e-8,'Two surviving PA members cannot borrow the withdrawn allocation');
 assert(partial.diagnostics.state_likelihood_max_ratio.MI<=Math.sqrt(20)+1e-8,'MI04 cannot borrow withdrawn MI07 allocation');
 for(const r of [outage,afterCorrection,partial]){
  assert(r.diagnostics.effective_sample_size>=opts.samples*.5-1e-6);
  assert.equal(Object.values(r.result.counts).reduce((a,b)=>a+b,0),opts.samples);
 }
 const allWithdrawn=kernel.condition(model,basis,[],opts);
 assert.deepEqual(allWithdrawn.result,ordinary,'Full outage restores the exact unconditioned national model');
 assert.deepEqual(kernel.condition(model,basis,sources,opts).result,sixteen.result,'Recovery after corrections/retractions/outages restores the exact same-draw result');
 assert.deepEqual(sources,originalSources,'Lifecycle cannot mutate source evidence or preserve a corrected cached lock');
 // Remaining-estimate failure must not withdraw valid counts amid other inputs.
 const geography={...load('washington_house_03_remaining_geography'),...load('house_geography_bridge').districts.find(r=>r.race_code_2026==='WA-03')};
 const remainingFixture=require('./washington_remaining_test_fixture.cjs');
 const countsRecord=await fixture();
 async function estimatedSources(estimate,{badHash=false,nullClocks=false}={}){
  const supplement=remainingFixture.fixture({estimate});
  if(nullClocks){for(const c of supplement.payload.data[0].groups[0].children)c.lastUpdated=null;remainingFixture.seal(supplement);}
  if(badHash)supplement.selected_payload_sha256='invalid';
  const snapshot=await cache.parse({...countsRecord,official_remaining:supplement},reference,{now});
  assert(snapshot.live_votes_accepted,'Optional supplement cannot remove valid official counts');
  assert.equal(snapshot.snapshot_updated_at,wa.snapshot.snapshot_updated_at);
  assert.deepEqual(snapshot.counties,wa.snapshot.counties,'Estimate changes never alter counted votes');
  return sources.map(e=>e.snapshot.race_code==='WA-03'?{...wa,snapshot,remaining_geography:geography}:e);
 }
 const fewRemaining=await estimatedSources(100),manyRemaining=await estimatedSources(500000);
 const fewResult=kernel.condition(model,basis,fewRemaining,opts),manyResult=kernel.condition(model,basis,manyRemaining,opts);
 assert.notDeepEqual(fewResult.result.probabilities,manyResult.result.probabilities,'Estimate-only changes can affect the national outlook alongside all other fifteen inputs');
 for(const r of [fewResult,manyResult]){
  assert.equal(r.diagnostics.used.length,16,'Supplement is not a seventeenth independent input');
  assert.deepEqual(r.baseline,sixteen.baseline);
  assert(r.diagnostics.effective_sample_size>=opts.samples*.5-1e-6);
  assert(r.diagnostics.state_likelihood_max_ratio.WA<=20+1e-8);
 }
 for(const invalid of [{badHash:true},{nullClocks:true}]){
  const fallback=kernel.condition(model,basis,await estimatedSources(100,invalid),opts);
  assert.deepEqual(fallback.result,sixteen.result,'Only the unusable supplement withdraws; all sixteen counts inputs remain exactly represented');
 }
 const independent=fewRemaining.filter(e=>!new URL(e.snapshot.source_url).hostname.endsWith('civicapi.org'));
 assert.equal(kernel.condition(model,basis,independent,opts).diagnostics.used.length,2);
 assert.deepEqual(kernel.condition(model,basis,fewRemaining,opts).result,fewResult.result,'Supplement recovers without a stale cached numerical lock');
 console.log('Remaining-estimate national sensitivity amid all sixteen sources: unchanged votes/clocks, invalid-supplement-only fallback, two official inputs during civic outage and recovery PASS; SYNTHETIC only');
 console.log('Sixteen-input mixed civic/official lifecycle: outage, opposing correction, partial/full withdrawal, fixed member budgets and exact recovery PASS; SYNTHETIC only');
 console.log('Official WA03 -> national joint draws, nine/ten/eleven/twelve/thirteen/fourteen/fifteen/sixteen-source coexistence, fixed state budgets, duplicate exclusion, baseline isolation and one-county rejection PASS; SYNTHETIC, not calibration');
})().catch(e=>{console.error(e);process.exitCode=1;});
