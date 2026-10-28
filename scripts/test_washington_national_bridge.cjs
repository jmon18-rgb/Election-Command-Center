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
 // SC is a reviewed seventeenth scope, with exactly one fixed state likelihood member.
 const sc=require('./south_carolina_test_fixture.cjs').envelope(12,now);
 const scFacts=load('south_carolina_senate_2020_county_baseline_official');
 const scD=scFacts.counties.reduce((n,c)=>n+c.dem_votes,0),scR=scFacts.counties.reduce((n,c)=>n+c.rep_votes,0);
 const expectation=basis.senate.find(r=>r.code==='SC-SEN').mean;
 const shift=expectation-100*(scD-scR)/(scD+scR);
 const expectedSC=require('./south_carolina_test_fixture.cjs').envelope(shift,now);
 const surpriseSC=require('./south_carolina_test_fixture.cjs').envelope(shift+3,now);
 const expectedPerformance=kernel.compile(expectedSC,opts).describePerformance(expectation);
 const surprisePerformance=kernel.compile(surpriseSC,opts).describePerformance(expectation);
 assert(expectedPerformance.difference_margin_scenarios.every(n=>Math.abs(n)<.01),'Expected local composition is not a wave');
 assert(surprisePerformance.difference_margin_scenarios.every(n=>Math.abs(n-3)<.01),'Three-point matched local surprise is separate from raw blue margin');
 const seventeen=kernel.condition(model,basis,[...sources,sc],opts);
 assert.equal(seventeen.diagnostics.used.length,17);assert.equal(seventeen.diagnostics.house_vote_sources,11);
 assert.equal(seventeen.diagnostics.state_likelihood_budget_members.SC,1);
 for(const state of ['MI','PA','WI'])assert.equal(seventeen.diagnostics.state_likelihood_budget_members[state],sixteen.diagnostics.state_likelihood_budget_members[state]);
 assert.deepEqual(seventeen.baseline,sixteen.baseline);assert(seventeen.diagnostics.effective_sample_size>=450-1e-6);
 assert.equal(Object.values(seventeen.result.counts).reduce((a,b)=>a+b,0),900);
 const scRed=kernel.condition(model,basis,[...sources,require('./south_carolina_test_fixture.cjs').envelope(-12,now)],opts);
 assert.notDeepEqual(seventeen.result.probabilities,scRed.result.probabilities,'SC correction affects the same national draws');
 const scRejected=structuredClone(sc);scRejected.snapshot.snapshot_updated_at='2026-10-27T13:56:28.271Z';
 const rejectedSC=kernel.condition(model,basis,[...sources,scRejected],opts);
 const numerical=r=>{const {county_results_update,...values}=r;return values;};
 assert.deepEqual(numerical(rejectedSC.result),numerical(sixteen.result),'Rejected SC preserves every prior sixteen-source numerical output');
 assert.deepEqual(rejectedSC.diagnostics.used,sixteen.diagnostics.used);
 assert.equal(rejectedSC.diagnostics.excluded[0].code,'SC-SEN','Rejected source remains explicitly disclosed');
 assert.deepEqual(kernel.condition(model,basis,[...sources],opts).result,sixteen.result,'Withdrawal restores exact sixteen-source outputs');
 assert.deepEqual(kernel.condition(model,basis,[...sources,sc],opts).result,seventeen.result,'Same SC recovery deterministic');
 assert.throws(()=>kernel.condition(model,basis,[...sources,sc,sc],opts),/same returns twice/);
 assert.throws(()=>kernel.condition(model,basis,[...sources,sc,sc,sc],opts),/Bounded/);
 const vm=require('node:vm'),oldModule={exports:{}};
 // Pin the actual released kernel so a shallow CI checkout needs no historical Git fetch.
 const oldBytes=require('node:zlib').gunzipSync(require('node:fs').readFileSync('data/south_carolina_senate_sources/pre-sc-national-likelihood.js.gz'));
 assert.equal(require('node:crypto').createHash('sha256').update(oldBytes).digest('hex'),'7106cf117f8ec6b323998840b30ab811e07155ac627cd265df994c4eb74559da');
 vm.runInNewContext(oldBytes.toString('utf8'),{module:oldModule,require:require('node:module').createRequire(require.resolve('./national_county_likelihood.js'))});
 assert.deepEqual(numerical(oldModule.exports.condition(model,basis,sources,opts).result),numerical(sixteen.result),'Published pre-SC kernel and candidate have identical original sixteen-source numerical outputs');
 const focus=require('./personal_election_focus.js'),log=focus.createHistory({now:()=>now});
 assert(log.observe({active:true,result:seventeen.result,envelopes:[...sources,sc],revision:'SC17',pollingAt:'2026-11-03T12:00:00Z'}));
 assert.equal(log.events()[0].source_count,17,'Released history supports all17 admitted sources');
 assert.equal(focus.rows(seventeen.result,seventeen.baseline,{now,evidence:seventeen.diagnostics.used}).find(r=>r.code==='SC-SEN').ownCounts,true);
 console.log('SC17 all-source coexistence, fixed budgets, original16 invariance, correction/withdrawal/recovery, ESS/coherent counts and observation history PASS; SYNTHETIC only');
 {
  const strict={...opts,independentSenateCredit:'no_credit'},old17=[...sources,sc],ne=require('./nebraska_test_fixture.cjs').envelope(12,now),all18=[...old17,ne];
  const prior17=kernel.condition(model,basis,old17,strict),eighteen=kernel.condition(model,basis,all18,strict);
  assert.equal(eighteen.diagnostics.used.length,18);assert.equal(eighteen.diagnostics.state_likelihood_budget_members.NE,1);
  for(const [state,members]of [['MI',2],['PA',3],['WI',2]])assert.equal(eighteen.diagnostics.state_likelihood_budget_members[state],members);
  assert(eighteen.diagnostics.effective_sample_size>=450-1e-6);assert.equal(eighteen.result.senate_independent_credit_mode,'no_credit');assert.deepEqual(eighteen.baseline,prior17.baseline);
  const oldNEBytes=require('node:zlib').gunzipSync(require('node:fs').readFileSync('data/nebraska_senate_sources/pre-ne-national-likelihood.js.gz'));
  assert.equal(require('node:crypto').createHash('sha256').update(oldNEBytes).digest('hex'),load('nebraska_senate_source_contract').pre_ne_kernel_sha256);
  const previous={exports:{}};vm.runInNewContext(oldNEBytes.toString('utf8'),{module:previous,require:require('node:module').createRequire(require.resolve('./national_county_likelihood.js'))});
  assert.deepEqual(numerical(previous.exports.condition(model,basis,old17,strict).result),numerical(prior17.result),'All original17 numerical outputs remain exact against pinned released kernel');
  const bad=structuredClone(ne);bad.snapshot.snapshot_updated_at='2026-10-15T00:00:00Z';
  assert.deepEqual(numerical(kernel.condition(model,basis,[...old17,bad],strict).result),numerical(prior17.result),'Rejected eighteenth source cannot perturb original17');
  const correctedNE=require('./nebraska_test_fixture.cjs').envelope(-12,now);assert.notDeepEqual(kernel.condition(model,basis,[...old17,correctedNE],strict).result.probabilities,eighteen.result.probabilities);
  assert.deepEqual(kernel.condition(model,basis,old17,strict).result,prior17.result,'Withdrawal returns exact old17');assert.deepEqual(kernel.condition(model,basis,all18,strict).result,eighteen.result,'Recovery is deterministic');
  const observation=focus.createHistory({now:()=>now});assert(observation.observe({active:true,result:eighteen.result,envelopes:all18,revision:'NE18',pollingAt:'2026-11-03T12:00:00Z'}));assert.equal(observation.events()[0].source_count,18);
  // Numerical convergence of the SAME bounded18-factor shared reporting-error
  // integral. This is not a fitted reporting model or predictive calibration.
  const factors=all18.map(e=>kernel.compile(e,strict)),sigma=8*Math.sqrt(.5),fine=kernel.normalQuadrature(.05);
  const means=factors.map(f=>basis.house.concat(basis.senate).find(r=>r.code===f.code).mean);
  const maxima=factors.map((f,i)=>Math.max(...fine.map(n=>f.logLikelihood(means[i],{sharedReportingOffset:n.z*sigma}))));
  const integral=step=>kernel.normalQuadrature(step).reduce((sum,n)=>sum+n.weight*Math.exp(factors.reduce((s,f,i)=>s+Math.log(.05+.95*Math.exp(f.logLikelihood(means[i],{sharedReportingOffset:n.z*sigma})-maxima[i]))/eighteen.diagnostics.state_likelihood_budget_members[f.code.slice(0,2)],0)),0);
  const coarse=integral(.2),middle=integral(.1),finest=integral(.05);assert(Math.abs(coarse/finest-1)<1e-5);assert(Math.abs(middle/finest-1)<1e-6);
  console.log('NE18 old17 exact numerical invariance, typed Independent/state budgets/ESS/history/lifecycle/coherence and18-factor quadrature convergence PASS; SYNTHETIC/NUMERICAL, not calibration',Math.abs(coarse/finest-1));
 }
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
