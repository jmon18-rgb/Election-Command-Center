'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const model=require('./chamber_control_model.js'),bridge=require('./national_county_likelihood.js');
const load=n=>JSON.parse(fs.readFileSync('data/'+n+'.json','utf8'));
const basis=model.prepare({seats:load('seat_universe'),history:load('house_history_2024_staging'),
 geography:load('house_geography_bridge'),senateHistory:load('senate_history_2020_2022_2024'),
 odds:load('race_probabilities'),polls:load('polling_estimates')});
const opts={samples:900,seed:20261103},now=Date.parse('2026-11-04T03:10:00Z');
// Regression: reporting composition alone is not performance. Use the actual
// user rehearsal generator, and verify its expectations against the likelihood.
const vm=require('node:vm'),demoWindow={};
vm.runInNewContext(fs.readFileSync('scripts/national_needle_rehearsal.js','utf8'),{window:demoWindow});
const rehearsalCheck=demoWindow.NationalNeedleRehearsal.load(async p=>JSON.parse(fs.readFileSync(p,'utf8'))).then(inputs=>{
 const expected=demoWindow.NationalNeedleRehearsal.stage(inputs,1,basis);
 const surprise=demoWindow.NationalNeedleRehearsal.stage(inputs,2,basis);
 const corrected=demoWindow.NationalNeedleRehearsal.stage(inputs,3,basis);
 for(const envelope of expected){
  const seat=basis.house.concat(basis.senate).find(r=>r.code===envelope.snapshot.race_code);
  const totals=c=>c.records.total||{dem_votes:c.records.absentee.dem_votes+c.records.election_day.dem_votes,rep_votes:c.records.absentee.rep_votes+c.records.election_day.rep_votes};
  const rows=envelope.baseline.counties.map(c=>({county:c.county,...totals(c)}));
  const baseD=rows.reduce((s,c)=>s+c.dem_votes,0),baseN=rows.reduce((s,c)=>s+c.dem_votes+c.rep_votes,0);
  const shift=(seat.mean-100*(2*baseD/baseN-1))/200;
  for(const e of [envelope,corrected.find(e=>e.snapshot.race_code===seat.code),surprise.find(e=>e.snapshot.race_code===seat.code)]){
   const extra=e===surprise.find(e=>e.snapshot.race_code===seat.code)?.015:0;
   for(const c of e.snapshot.counties){const n=c.dem_votes+c.rep_votes;if(!n)continue;
    const h=rows.find(h=>h.county===c.county),share=Math.max(.001,Math.min(.999,h.dem_votes/(h.dem_votes+h.rep_votes)+shift+extra));
    assert(Math.abs(c.dem_votes-n*share)<=.500001,'Fictional returns must match county expectation plus only the declared surprise');
   }
  }
  // Combined-mode KS/TX make a clean composition-only check without a method-mix assumption.
  if(!['KS-SEN','TX-SEN'].includes(seat.code))continue;
  const blueLikelihood=bridge.compile(envelope,{now:demoWindow.NationalNeedleRehearsal.now,rehearsal:true});
  const performance=blueLikelihood.describePerformance(seat.mean);
  assert(Math.abs(performance.difference_margin_scenarios[0])<.01,'Expected blue counties must show zero matched-area surprise');
  assert(Math.abs(performance.observed_margin_points-performance.expected_margin_scenarios[0])<.01);
  const outperformed=bridge.compile(surprise.find(e=>e.snapshot.race_code===seat.code),{now:demoWindow.NationalNeedleRehearsal.now,rehearsal:true}).describePerformance(seat.mean);
  assert(Math.abs(outperformed.difference_margin_scenarios[0]-3)<.01,'Declared three-point surprise is a margin difference, not a probability change');
  assert.equal(outperformed.calibrated,false);assert(outperformed.largest_reporting_units.length<=6);
  assert(blueLikelihood.logLikelihood(seat.mean)>blueLikelihood.logLikelihood(seat.mean+6),'Expected blue counties cannot imply six-point blue outperformance');
  assert(blueLikelihood.logLikelihood(seat.mean)>blueLikelihood.logLikelihood(seat.mean-6));
  const red=structuredClone(envelope),selected=new Set([...rows].sort((a,b)=>a.dem_votes/(a.dem_votes+a.rep_votes)-b.dem_votes/(b.dem_votes+b.rep_votes)).slice(0,Math.ceil(rows.length*.35)).map(c=>c.county));
  red.snapshot.counties=red.snapshot.counties.map(c=>{const h=rows.find(h=>h.county===c.county),n=selected.has(c.county)?Math.floor((h.dem_votes+h.rep_votes)*.3):0,d=Math.round(n*Math.max(.001,Math.min(.999,h.dem_votes/(h.dem_votes+h.rep_votes)+shift)));return {...c,dem_votes:d,rep_votes:n-d};});
  const redLikelihood=bridge.compile(red,{now:demoWindow.NationalNeedleRehearsal.now,rehearsal:true});
  assert(Math.abs(redLikelihood.describePerformance(seat.mean).difference_margin_scenarios[0])<=100*redLikelihood.reporting_counties/redLikelihood.counted_two_party_votes+1e-9,'Expected red counties differ only by integer-vote rounding, never by their raw partisan margin');
  assert(redLikelihood.logLikelihood(seat.mean)>redLikelihood.logLikelihood(seat.mean-6),'Expected red counties cannot imply six-point red outperformance');
  assert(redLikelihood.logLikelihood(seat.mean)>redLikelihood.logLikelihood(seat.mean+6));
 }
 assert.throws(()=>demoWindow.NationalNeedleRehearsal.stage(inputs,1,{}),/Missing current race expectation/);
 console.log('Expected blue/red county composition and declared rehearsal surprise PASS (synthetic, not calibration)');
}).catch(error=>{console.error(error);process.exitCode=1;});
const specs=[['IA-SEN','iowa',87151,2022],['KS-SEN','kansas',87162,2020],['TX-SEN','texas',87438,2024]];
function fixture(spec,margin=8){
 const [code,state,id,year]=spec,reference=load(state+'_county_fips_reference');
 let baseline=state==='iowa'?load('iowa_senate_county_modes_official').years['2022']:
  {counties:(state==='kansas'?load('kansas_senate_county_facts_official').years['2020'].counties:
   load('texas_senate_2024_county_baseline_official').counties).map(c=>({county:c.county,records:{total:{dem_votes:c.dem_votes,rep_votes:c.rep_votes}}}))};
 const totals=c=>c.records.total||{dem_votes:c.records.absentee.dem_votes+c.records.election_day.dem_votes,
  rep_votes:c.records.absentee.rep_votes+c.records.election_day.rep_votes};
 const d=baseline.counties.reduce((s,c)=>s+totals(c).dem_votes,0),n=baseline.counties.reduce((s,c)=>s+totals(c).dem_votes+totals(c).rep_votes,0);
 const shift=(margin-100*(2*d/n-1))/200,byName=new Map(reference.counties.map(c=>[c.county,c.fips]));
 // Synthetic post-close observations built from actual official geography.
 // These are NOT actual 2026 votes or chronological historical backtests.
 const counties=baseline.counties.map(c=>{const b=totals(c),n=Math.floor((b.dem_votes+b.rep_votes)*.65);
  const share=Math.max(.001,Math.min(.999,b.dem_votes/(b.dem_votes+b.rep_votes)+shift)),d=Math.floor(n*share);
  return {county:c.county,county_fips:byName.get(c.county),dem_votes:d,rep_votes:n-d,other_votes:0};});
 return {baseline,reference,baseline_year:year,snapshot:{race_code:code,source_url:'https://civicapi.org/api/v2/race/'+id,
  status:'VALIDATED_COUNTY_COUNTS_METHOD_MIX_UNRESOLVED',live_votes_accepted:true,
  county_identities_matched:reference.counties.length,snapshot_updated_at:'2026-11-04T03:05:00Z',counties}};
}
const ordinary=model.simulate(basis,opts),captured=model.simulate(basis,{...opts,captureCountyDraws:specs.map(s=>s[0])});
const {county_draws,...uncaptured}=captured;assert.deepEqual(uncaptured,ordinary,'Capturing data never changes prior random draws or output');
const {simulation_draw_method,...replayed}=model.simulate(basis,{...opts,replayCountySeeds:county_draws.seeds});
assert.deepEqual(replayed,ordinary,'Exact RNG-state replay preserves entire correlated elections and all summaries');
assert.throws(()=>model.simulate(basis,{...opts,captureCountyDraws:['CA-SEN']}),/scope/);
assert.throws(()=>model.simulate(basis,{...opts,replayCountySeeds:[1]}),/replay/);
const blue=specs.map(s=>fixture(s,8)),red=specs.map(s=>fixture(s,-8));
const sharedOne=bridge.condition(model,basis,[blue[0]],{...opts,now});
const sharedThree=bridge.condition(model,basis,blue,{...opts,now});
assert(sharedThree.result.blue_both_including_tsunami>sharedOne.result.blue_both_including_tsunami,
 'Consistent performance across states must still provide more evidence than one candidate-specific surprise');
const reporting=sharedThree.diagnostics.reporting_error;
assert.equal(reporting.scope,'SHARED_ACROSS_ADMITTED_RACES');
assert.equal(reporting.calibrated,false);
assert(Math.abs(reporting.shared_margin_sigma**2+reporting.race_specific_margin_sigma**2-8**2)<1e-10,
 'Sharing reporting error must allocate the existing variance, not add a second error budget');
assert.equal(reporting.quadrature_nodes,61);
const commonNodes=bridge.normalQuadrature().map(r=>[r.z,r.weight]);
assert(Math.abs(commonNodes.reduce((s,[z,w])=>s+w*z*z,0)-1)<1e-6);
for(const k of [1,3,5,8,12,16]){
 let exact=0,choose=1;for(let j=0;j<=k;j++){
  exact+=choose*.05**(k-j)*.95**j/Math.sqrt(1+j);choose=choose*(k-j)/(j+1);
 }
 const integrate=nodes=>nodes.reduce((s,{z,weight})=>s+weight*(.05+.95*Math.exp(-z*z/2))**k,0);
 assert(Math.abs(integrate(bridge.normalQuadrature())/exact-1)<1e-6,'Joint robust likelihood integral must match its closed-form reference');
 assert(Math.abs(integrate(bridge.normalQuadrature())-integrate(bridge.normalQuadrature(.1)))<1e-7,'Joint integral converges on a finer normal grid');
}
// Two synthetic same-direction batch errors are not independent confirmation.
// Use real compiled county likelihoods to distinguish integrating one shared
// nuisance AFTER the product from multiplying two separately integrated sources.
const a=bridge.compile(blue[1],{now}),b=bridge.compile(blue[2],{now});
const curve=bridge.conditionalCurve(a,[-10,10]);
for(let m=-40;m<40;m+=.371){
 assert(Math.abs(curve(m)-a.logLikelihood(m,{sharedReportingOffset:0}))<.001,'Conditional curve interpolation must track the direct county likelihood');
}
const likelihoodAt=(c,m,z)=>Math.exp(c.logLikelihood(m,{sharedReportingOffset:z*reporting.shared_margin_sigma})-c.logLikelihood(8,{sharedReportingOffset:0}));
const sharedProduct=commonNodes.reduce((s,[z,w])=>s+w*likelihoodAt(a,0,z)*likelihoodAt(b,0,z),0);
const independentProduct=commonNodes.reduce((s,[z,w])=>s+w*likelihoodAt(a,0,z),0)*commonNodes.reduce((s,[z,w])=>s+w*likelihoodAt(b,0,z),0);
assert(sharedProduct>independentProduct,
 'A common batch bias must remain a plausible explanation for correlated surprises, not independent evidence twice');
const before=JSON.stringify(ordinary),up=bridge.condition(model,basis,blue,{...opts,now}),down=bridge.condition(model,basis,red,{...opts,now});
assert.equal(JSON.stringify(ordinary),before,'Conditioning cannot mutate the original baseline');
assert(up.result.blue_both_including_tsunami>down.result.blue_both_including_tsunami+1,
 'Coherent partial county returns must change NATIONAL both-chamber chances before calls');
assert(up.result.probabilities.blue_tsunami>down.result.probabilities.blue_tsunami,
 'National Tsunami chances must respond to incoming county evidence, not just race panels');
for(const result of [up,down]){
 assert.equal(result.diagnostics.used.length,3);assert.equal(result.diagnostics.house_vote_sources,0);
 assert.equal(result.diagnostics.interval_calibrated,false);
 assert(result.diagnostics.effective_sample_size>=opts.samples*.5-1e-6);
 assert(result.diagnostics.likelihood_power>0&&result.diagnostics.likelihood_power<=1);
 assert.equal(Object.values(result.result.counts).reduce((a,b)=>a+b,0),opts.samples);
 assert.equal(result.result.blue_both_including_tsunami,result.result.actual_dem_both_control_pct);
 assert(Math.abs(result.result.total_pct-100)<=.03);
 assert(result.result.race_probabilities.every(r=>r.provider_called_party===null),'A likelihood never fabricates a race call');
}
const withdrawn=bridge.condition(model,basis,[],{...opts,now});assert.deepEqual(withdrawn.result,ordinary,'Withdrawn inputs restore the exact baseline');
assert.deepEqual(bridge.condition(model,basis,blue,{...opts,now}).result,up.result,'Repeated snapshots cannot accumulate evidence');
assert.throws(()=>bridge.condition(model,basis,[blue[0],blue[0]],{...opts,now}),/twice/);
for(const mutate of [x=>x.forecast={dem_win_probability:.99},x=>x.snapshot.status='TEST_DATA_NOT_LIVE',
 x=>x.snapshot.source_url+='?light=',x=>x.snapshot.snapshot_updated_at='2026-11-03T23:00:00Z',
 x=>x.snapshot.counties[0].county_fips=x.snapshot.counties[1].county_fips,
 x=>x.snapshot.counties.forEach(c=>{c.dem_votes=1;c.rep_votes=0;})]){
 const bad=structuredClone(blue[0]);mutate(bad);assert.throws(()=>bridge.compile(bad,{now}));
 const rejected=bridge.condition(model,basis,[bad],{...opts,now});assert.deepEqual(rejected.result,ordinary);assert.equal(rejected.diagnostics.excluded.length,1);
}
const called=bridge.condition(model,basis,blue,{...opts,now,live:{'TX-SEN':{mode:'source_called',winnerParty:'R'}}});
assert.equal(called.result.race_probabilities.find(r=>r.race_code==='TX-SEN').dem_beats_rep_pct,0,'Verified calls remain locked during partial-return conditioning');
assert.deepEqual(bridge.condition(model,basis,blue,{...opts,now}).result,up.result,'Call retraction restores uncertain shared draws without a cached lock');
console.log(JSON.stringify({status:'NATIONAL_COUNTY_BRIDGE_SYNTHETIC_TESTS_PASS_NOT_CALIBRATION',
 baseline:ordinary.probabilities,blue:up.result.probabilities,red:down.result.probabilities,
 effective_samples:up.diagnostics.effective_sample_size,likelihood_power:up.diagnostics.likelihood_power}));

const demo=blue.map(e=>({...e,rehearsal:true}));
assert.equal(bridge.condition(model,basis,demo,{...opts,now}).diagnostics.used.length,0);
assert.equal(bridge.condition(model,basis,demo,{...opts,now,rehearsal:true}).diagnostics.status,"SIMULATED_NATIONAL_REHEARSAL");
assert.equal(bridge.condition(model,basis,blue,{...opts,now,rehearsal:true}).diagnostics.used.length,0);

assert.throws(()=>bridge.condition(model,basis,blue,{...opts,now,live:{'TX-SEN':{mode:'live_informed',posteriorMargin:10,posteriorSigma:1}}}),/never a race posterior/);
assert.throws(()=>bridge.condition(model,basis,[],{...opts,now,rehearsal:true,live:{'TX-SEN':{mode:'source_called',winnerParty:'D'}}}),/cannot use live calls/);

const wiFacts=load('wisconsin_house_01_2024_county_baseline_official'),wiRef=load('wisconsin_house_01_county_fips_reference');
function wiEnvelope(margin){
 const n=wiFacts.district_totals.dem_votes+wiFacts.district_totals.rep_votes,shift=(margin-100*(2*wiFacts.district_totals.dem_votes/n-1))/200;
 const counties=wiFacts.counties.map(c=>{const n=Math.floor((c.dem_votes+c.rep_votes)*.65),d=Math.floor(n*Math.max(.001,Math.min(.999,c.dem_votes/(c.dem_votes+c.rep_votes)+shift)));return {county:c.county,county_fips:c.county_fips,dem_votes:d,rep_votes:n-d,other_votes:0};});
 return {baseline_year:2024,reference:wiRef,baseline:{race_code:'WI-01',geography_scope:'district_parts',counties:wiFacts.counties.map(c=>({county:c.county,records:{total:c}}))},snapshot:{race_code:'WI-01',source_url:'https://civicapi.org/api/v2/race/87483',status:'VALIDATED_COUNTY_COUNTS_METHOD_MIX_UNRESOLVED',live_votes_accepted:true,county_identities_matched:5,snapshot_updated_at:'2026-11-04T03:05:00Z',counties}};
}
const wi=wiEnvelope(8),wiUp=bridge.condition(model,basis,[wi],{...opts,now}),wiDown=bridge.condition(model,basis,[wiEnvelope(-8)],{...opts,now});
assert.equal(wiUp.diagnostics.house_vote_sources,1);assert(wiUp.result.house_dem_control_pct>wiDown.result.house_dem_control_pct);
assert(bridge.compile(wi,{now}).modeled_remaining_two_party_votes>0);
assert.throws(()=>bridge.compile({...wi,baseline:{...wi.baseline,geography_scope:'whole_county'}},{now}),/district-part/);
const four=bridge.condition(model,basis,[...blue,wi],{...opts,now});assert.equal(four.diagnostics.used.length,4);
assert.equal(Object.values(four.result.counts).reduce((a,b)=>a+b,0),opts.samples);
console.log('WI-01 district-part counts -> coherent NATIONAL House/control changes before calls; not calibration');

const wi3Facts=load('wisconsin_house_03_2024_county_baseline_official'),wi3Ref=load('wisconsin_house_03_county_fips_reference');
function wi3Envelope(margin){
 const n=wi3Facts.district_totals.dem_votes+wi3Facts.district_totals.rep_votes,shift=(margin-100*(2*wi3Facts.district_totals.dem_votes/n-1))/200;
 const counties=wi3Facts.counties.map(c=>{const n=Math.floor((c.dem_votes+c.rep_votes)*.65),d=Math.floor(n*Math.max(.001,Math.min(.999,c.dem_votes/(c.dem_votes+c.rep_votes)+shift)));return {county:c.county,county_fips:c.county_fips,dem_votes:d,rep_votes:n-d,other_votes:0};});
 return {baseline_year:2024,reference:wi3Ref,baseline:{race_code:'WI-03',geography_scope:'district_parts',counties:wi3Facts.counties.map(c=>({county:c.county,records:{total:c}}))},snapshot:{race_code:'WI-03',source_url:'https://civicapi.org/api/v2/race/87485',status:'VALIDATED_COUNTY_COUNTS_METHOD_MIX_UNRESOLVED',live_votes_accepted:true,county_identities_matched:19,snapshot_updated_at:'2026-11-04T03:05:00Z',counties}};
}
const wi3=wi3Envelope(8),five=bridge.condition(model,basis,[...blue,wi,wi3],{...opts,now});
assert.equal(five.diagnostics.used.length,5);assert.equal(five.diagnostics.house_vote_sources,2);
assert.deepEqual(five.diagnostics.state_likelihood_sources,{IA:1,KS:1,TX:1,WI:2});
assert(five.diagnostics.state_likelihood_max_ratio.WI<=20+1e-8,'Adding districts must not multiply one state observation-error budget to400:1');
assert(five.diagnostics.effective_sample_size>=opts.samples*.5-1e-6);
assert.equal(Object.values(five.result.counts).reduce((a,b)=>a+b,0),opts.samples);
assert.deepEqual(bridge.condition(model,basis,[...blue,wi,wi3],{...opts,now}).result,five.result,'Repeated multi-district snapshots cannot accumulate confidence');
const withdrawnDistrict=bridge.condition(model,basis,[...blue,wi],{...opts,now});assert.deepEqual(withdrawnDistrict.result,four.result,'Withdrawing one House source recomputes the state budget from current evidence');
console.log('Two district inputs share one bounded STATE likelihood budget; five-source national probabilities remain coherent, not calibration');

assert.equal(four.diagnostics.state_likelihood_budget_members.WI,2);
assert(four.diagnostics.state_likelihood_max_ratio.WI<=Math.sqrt(20)+1e-8,'Missing/retracted second district cannot hand its fixed likelihood budget to the surviving district');

const miFacts=load('michigan_house_04_2024_county_baseline_processed'),miRef=load('michigan_house_04_county_fips_reference');
function miEnvelope(margin){
 const n=miFacts.district_totals.dem_votes+miFacts.district_totals.rep_votes,shift=(margin-100*(2*miFacts.district_totals.dem_votes/n-1))/200;
 const counties=miFacts.counties.map(c=>{const n=Math.floor((c.dem_votes+c.rep_votes)*.65),d=Math.floor(n*Math.max(.001,Math.min(.999,c.dem_votes/(c.dem_votes+c.rep_votes)+shift)));return {county:c.county,county_fips:c.county_fips,dem_votes:d,rep_votes:n-d,other_votes:0};});
 return {baseline_year:2024,reference:miRef,baseline:{race_code:'MI-04',geography_scope:'district_parts',counties:miFacts.counties.map(c=>({county:c.county,records:{total:c}}))},snapshot:{race_code:'MI-04',source_url:'https://civicapi.org/api/v2/race/87204',status:'VALIDATED_COUNTY_COUNTS_METHOD_MIX_UNRESOLVED',live_votes_accepted:true,county_identities_matched:6,snapshot_updated_at:'2026-11-04T03:05:00Z',counties}};
}
const mi=miEnvelope(8),miUp=bridge.condition(model,basis,[mi],{...opts,now}),miDown=bridge.condition(model,basis,[miEnvelope(-8)],{...opts,now});
assert.deepEqual(miUp.diagnostics.house_vote_states,['MI']);assert.equal(miUp.diagnostics.house_vote_sources,1);
assert(miUp.result.house_dem_control_pct>miDown.result.house_dem_control_pct,'A second House STATE contributes counts through the existing national covariance');
assert.throws(()=>bridge.compile({...mi,baseline:{...mi.baseline,geography_scope:'whole_county'}},{now}),/district-part/);
assert.throws(()=>bridge.compile({...mi,baseline:{...mi.baseline,race_code:'MI-03'}},{now}),/district-part/);
const six=bridge.condition(model,basis,[...blue,wi,wi3,mi],{...opts,now});
assert.equal(six.diagnostics.used.length,6);assert.equal(six.diagnostics.house_vote_sources,3);
assert.deepEqual(six.diagnostics.house_vote_states,['MI','WI']);
assert.deepEqual(six.diagnostics.state_likelihood_budget_members,{IA:1,KS:1,TX:1,WI:2,MI:2});
assert(six.diagnostics.state_likelihood_max_ratio.WI<=20+1e-8);assert(six.diagnostics.state_likelihood_max_ratio.MI<=Math.sqrt(20)+1e-8);
assert(six.diagnostics.effective_sample_size>=opts.samples*.5-1e-6);
assert.deepEqual(bridge.condition(model,basis,[...blue,wi,wi3],{...opts,now}).result,five.result,'Withdrawing MI restores exactly the previous five-source model; Wisconsin shares never change');
assert.equal(Object.values(six.result.counts).reduce((a,b)=>a+b,0),opts.samples);
console.log('MI-04 plus Wisconsin: three House districts across TWO states reach coherent national outcomes; not national coverage or calibration');

const paFacts=load('pennsylvania_house_10_2024_county_baseline_official'),paRef=load('pennsylvania_house_10_county_fips_reference');
function paEnvelope(margin){
 const n=paFacts.district_totals.dem_votes+paFacts.district_totals.rep_votes,shift=(margin-100*(2*paFacts.district_totals.dem_votes/n-1))/200;
 const counties=paFacts.counties.map(c=>{const n=Math.floor((c.dem_votes+c.rep_votes)*.65),d=Math.floor(n*Math.max(.001,Math.min(.999,c.dem_votes/(c.dem_votes+c.rep_votes)+shift)));return {county:c.county,county_fips:c.county_fips,dem_votes:d,rep_votes:n-d,other_votes:0};});
 return {baseline_year:2024,reference:paRef,baseline:{race_code:'PA-10',geography_scope:'district_parts',counties:paFacts.counties.map(c=>({county:c.county,records:{total:c}}))},snapshot:{race_code:'PA-10',source_url:'https://civicapi.org/api/v2/race/87385',status:'VALIDATED_COUNTY_COUNTS_METHOD_MIX_UNRESOLVED',live_votes_accepted:true,county_identities_matched:3,snapshot_updated_at:'2026-11-04T03:05:00Z',counties}};
}
const pa=paEnvelope(8),paUp=bridge.condition(model,basis,[pa],{...opts,now}),paDown=bridge.condition(model,basis,[paEnvelope(-8)],{...opts,now});
assert.deepEqual(paUp.diagnostics.house_vote_states,['PA']);assert.equal(paUp.diagnostics.house_vote_sources,1);
assert(paUp.result.house_dem_control_pct>paDown.result.house_dem_control_pct,'PA10 counts independently influence the NATIONAL outlook before calls');
assert(bridge.compile(pa,{now}).modeled_remaining_two_party_votes>0);
assert.throws(()=>bridge.compile({...pa,baseline:{...pa.baseline,geography_scope:'whole_county'}},{now}),/district-part/);
const thin=structuredClone(pa);thin.snapshot.counties[0].dem_votes=0;thin.snapshot.counties[0].rep_votes=0;
assert.throws(()=>bridge.compile(thin,{now}),'Existing minimum-three-reporting-counties policy remains; PA needs3/3 parts, not one attractive early batch');
assert.deepEqual(bridge.condition(model,basis,[thin],{...opts,now}).result,ordinary);
const seven=bridge.condition(model,basis,[...blue,wi,wi3,mi,pa],{...opts,now});
assert.equal(seven.diagnostics.used.length,7);assert.equal(seven.diagnostics.house_vote_sources,4);
assert.deepEqual(seven.diagnostics.house_vote_states,['MI','PA','WI']);
assert.equal(seven.diagnostics.state_likelihood_budget_members.PA,3);assert.equal(seven.diagnostics.state_likelihood_budget_members.WI,2);
assert(seven.diagnostics.state_likelihood_max_ratio.PA<=Math.cbrt(20)+1e-8,'PA10 alone receives one third of the fixed Pennsylvania log-likelihood budget with PA07/PA08 predeclared');
assert(seven.diagnostics.state_likelihood_max_ratio.PA<=20+1e-8);assert(seven.diagnostics.effective_sample_size>=opts.samples*.5-1e-6);
assert.deepEqual(bridge.condition(model,basis,[...blue,wi,wi3,mi],{...opts,now}).result,six.result,'Withdrawing PA restores the exact previous six-source model');
assert.equal(Object.values(seven.result.counts).reduce((a,b)=>a+b,0),opts.samples);
console.log('PA-10 top-ranked competitive House input reaches the same NATIONAL model; seven sources/four House districts/three states; NOT calibration');

const nyFacts=load('new_york_house_17_2024_county_baseline_official'),nyRef=load('new_york_house_17_county_fips_reference');
function nyEnvelope(margin){
 const n=nyFacts.district_totals.dem_votes+nyFacts.district_totals.rep_votes,shift=(margin-100*(2*nyFacts.district_totals.dem_votes/n-1))/200;
 const counties=nyFacts.counties.map(c=>{const n=Math.floor((c.dem_votes+c.rep_votes)*.65),d=Math.floor(n*Math.max(.001,Math.min(.999,c.dem_votes/(c.dem_votes+c.rep_votes)+shift)));return {county:c.county,county_fips:c.county_fips,dem_votes:d,rep_votes:n-d,other_votes:0};});
 return {baseline_year:2024,reference:nyRef,baseline:{race_code:'NY-17',geography_scope:'district_parts',counties:nyFacts.counties.map(c=>({county:c.county,records:{total:c}}))},snapshot:{race_code:'NY-17',source_url:'https://civicapi.org/api/v2/race/87319',status:'VALIDATED_COUNTY_COUNTS_METHOD_MIX_UNRESOLVED',live_votes_accepted:true,county_identities_matched:4,snapshot_updated_at:'2026-11-04T03:05:00Z',counties}};
}
const ny=nyEnvelope(8),nyUp=bridge.condition(model,basis,[ny],{...opts,now}),nyDown=bridge.condition(model,basis,[nyEnvelope(-8)],{...opts,now});
assert(nyUp.result.house_dem_control_pct>nyDown.result.house_dem_control_pct,'NY17 real-shaped counts independently move NATIONAL House odds before calls');
assert.deepEqual(nyUp.diagnostics.house_vote_states,['NY']);
assert(bridge.compile(ny,{now}).modeled_remaining_two_party_votes>0);
const nyThin=structuredClone(ny);nyThin.snapshot.counties.slice(0,2).forEach(c=>{c.dem_votes=0;c.rep_votes=0;});
assert.throws(()=>bridge.compile(nyThin,{now}),'No relaxation of reporting-unit breadth to add NY17');
const eight=bridge.condition(model,basis,[...blue,wi,wi3,mi,pa,ny],{...opts,now});
assert.equal(eight.diagnostics.used.length,8);assert.equal(eight.diagnostics.house_vote_sources,5);
assert.deepEqual(eight.diagnostics.house_vote_states,['MI','NY','PA','WI']);
assert.equal(eight.diagnostics.state_likelihood_budget_members.WI,2);assert.equal(eight.diagnostics.state_likelihood_budget_members.NY,1);
assert(eight.diagnostics.state_likelihood_max_ratio.NY<=20+1e-8);
assert(eight.diagnostics.effective_sample_size>=opts.samples*.5-1e-6);
assert.deepEqual(bridge.condition(model,basis,[...blue,wi,wi3,mi,pa],{...opts,now}).result,seven.result,'Withdrawing NY restores exactly the prior seven-source national model');
console.log('NY17 full candidate fusion baseline reaches NATIONAL model; eight sources/five House districts/four states, not national coverage/calibration');
