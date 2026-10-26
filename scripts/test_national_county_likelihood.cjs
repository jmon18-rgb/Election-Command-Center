'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const model=require('./chamber_control_model.js'),bridge=require('./national_county_likelihood.js');
const load=n=>JSON.parse(fs.readFileSync('data/'+n+'.json','utf8'));
const basis=model.prepare({seats:load('seat_universe'),history:load('house_history_2024_staging'),
 geography:load('house_geography_bridge'),senateHistory:load('senate_history_2020_2022_2024'),
 odds:load('race_probabilities'),polls:load('polling_estimates')});
const opts={samples:900,seed:20261103},now=Date.parse('2026-11-04T03:10:00Z');
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
