#!/usr/bin/env node
'use strict';
// Fictional means, races and geography mixtures only. These tests verify
// same-draw accounting and conditional summaries, never forecast accuracy.
const assert=require('node:assert/strict');
const model=require('./chamber_control_model.js');
const row=(code,state,i)=>({code,state,mean:(i%13-6)*2,sigma:4+i%4,
 method:'fictional_unchanged',polled:false,poll_weight:null,
 redrawn_mix_weight:0,redrawn_state_center:null});
const house=Array.from({length:435},(_,i)=>row('FICTION-H'+i,'FH'+i%10,i));
house[0]={...row('VA-02','VA',0),mean:2,sigma:4,
 method:'redrawn_state_distribution_proxy',redrawn_mix_weight:1,
 redrawn_state_center:0};
const senate=Array.from({length:35},(_,i)=>row('FICTION-S'+i,'FS'+i%6,i));
senate[0]={...row('IA-SEN','IA',0),mean:2};
senate[1]={...row('NE-SEN','NE',1),mean:-1,nonrep_independent_proxy:true};
senate[2]={...row('SD-SEN','SD',2),nonrep_independent_proxy:true};
const governors=Array.from({length:6},(_,i)=>row('FICTION-G'+i,'FG'+i,i));
const basis={schema_version:model.VERSION,house,senate,governors,
 redrawn_state_distributions:{VA:[-20,20]},assumptions:{
 senate_dem_holdovers:34,house_control_dem_seats:218,senate_control_dem_seats:51,
 common_national_sigma:2,house_chamber_sigma:3,senate_chamber_sigma:3.5,
 governor_chamber_sigma:4,state_house_sigma:4,state_senate_sigma:3,
 state_governor_sigma:3,redrawn_state_additional_sigma:5}};
const codes=['VA-02','IA-SEN','NE-SEN','SD-SEN','FICTION-G0'];
const capturedCodes=['VA-02','IA-SEN','NE-SEN'];
const args={samples:600,seed:19760408,independentSenateCredit:'no_credit',
 explainControl:true,captureCountyDraws:capturedCodes};
const strip=result=>({...result,race_probabilities:result.race_probabilities.map(
 ({margin_distribution,margin_distribution_status,...row})=>row)});
const get=(result,code)=>result.race_probabilities.find(row=>row.race_code===code);
const rounded=value=>Math.round(value*1000)/1000;
function assertExactSummary(result,code,values,conditioning){
 const actual=get(result,code).margin_distribution,sorted=Array.from(values).sort((a,b)=>a-b);
 const mean=Array.from(values).reduce((sum,x)=>sum+x,0)/values.length;
 const sd=Math.sqrt(Array.from(values).reduce((sum,x)=>sum+(x-mean)**2,0)/values.length);
 assert.equal(actual.schema_version,'same-joint-margin-summary-v1');
 for(const [name,p] of [['p05',.05],['p25',.25],['p50',.5],['p75',.75],['p95',.95]])
  assert.equal(actual[name],rounded(sorted[Math.floor((values.length-1)*p)]));
 assert.equal(actual.mean,rounded(mean));assert.equal(actual.sd,rounded(sd));
 assert.equal(actual.sample_count,values.length);assert.equal(actual.conditioning,conditioning);
 assert.equal(actual.interval_calibrated,false);
 assert.equal(actual.distribution_scope,'UNBOUNDED_LATENT_MARGIN_PROXY_NOT_FINAL_VOTE_INTERVAL');
 assert.equal(actual.quantile_method,'SORTED_DRAW_LOWER_INDEX_FLOOR_N_MINUS_ONE_P');
}
const original=JSON.stringify(basis);
for(const options of [{},{errorMultiplier:1.4},{live:{
 'IA-SEN':{mode:'live_informed',posteriorMargin:7,posteriorSigma:2}}}]){
 const baseline=model.simulate(basis,{...args,...options});
 const summarized=model.simulate(basis,{...args,...options,marginSummaryCodes:codes});
 assert.deepEqual(strip(summarized),baseline,
  'Summaries cannot change any existing output, random stream, captured margin or chamber result');
 for(const code of capturedCodes){
  assertExactSummary(summarized,code,summarized.county_draws.margins[code],
   options.live?.[code]?'LIVE_INFORMED_SCENARIO':'POLLING_BASELINE');
  assert.equal(get(summarized,code).margin_distribution.unique_election_particles,args.samples);
 }
 assert.equal(get(summarized,'NE-SEN').margin_distribution.axis,'osborn_minus_ricketts');
 assert.equal(get(summarized,'SD-SEN').margin_distribution.axis,'nonrepublican_proxy_minus_rep');
 assert.equal(get(summarized,'IA-SEN').margin_distribution.axis,'dem_minus_rep');
 assert.equal(summarized.race_probabilities.filter(r=>Object.hasOwn(r,'margin_distribution')).length,codes.length);
 assert.equal(get(summarized,'FICTION-H2').margin_distribution,undefined);
}
assert.equal(JSON.stringify(basis),original,'Summary sorting must not mutate model inputs');

// A deliberately nonuniform repeated-particle replay represents a different
// conditional distribution. Its intervals must use those exact resampled draws,
// not the unconditioned analytic sigma or the original uniform population.
const prior=model.simulate(basis,args),positive=[];
for(let i=0;i<args.samples&&positive.length<30;i++)
 if(prior.county_draws.margins['IA-SEN'][i]>4)positive.push(i);
assert.equal(positive.length,30);
const replaySeeds=new Uint32Array(Array.from({length:args.samples},(_,i)=>
 prior.county_draws.seeds[positive[i%positive.length]]));
const replayArgs={...args,captureCountyDraws:undefined,replayCountySeeds:replaySeeds};
const replay=model.simulate(basis,replayArgs),replaySummary=model.simulate(basis,
 {...replayArgs,marginSummaryCodes:codes});
assert.deepEqual(strip(replaySummary),replay,'Repeated-particle diagnostics must preserve all conditioned probabilities');
const expected=Array.from(replaySeeds,seed=>prior.county_draws.margins['IA-SEN'][
 prior.county_draws.seeds.indexOf(seed)]);
assertExactSummary(replaySummary,'IA-SEN',expected,'COUNTY_IMPORTANCE_RESAMPLED');
assert.equal(get(replaySummary,'IA-SEN').margin_distribution.unique_election_particles,30,
 'Repeated posterior particles are not hundreds of independent new elections');
assert(get(replaySummary,'IA-SEN').margin_distribution.p05>4);
assert(get(replaySummary,'IA-SEN').margin_distribution.mean>
 get(model.simulate(basis,{...args,marginSummaryCodes:codes}),'IA-SEN').margin_distribution.mean);

// A validated call determines a binary winner, not the final vote margin.
const calledArgs={...args,live:{'VA-02':{mode:'source_called',winnerParty:'D'},
 'NE-SEN':{mode:'source_called',winnerParty:'R'}}};
const called=model.simulate(basis,{...calledArgs,marginSummaryCodes:codes});
assert.deepEqual(strip(called),model.simulate(basis,calledArgs));
for(const code of ['VA-02','NE-SEN']){
 assert.equal(get(called,code).margin_distribution,null);
 assert.equal(get(called,code).margin_distribution_status,'SOURCE_CALL_HAS_NO_MARGIN_ESTIMATE');
}
assert.equal(get(called,'VA-02').dem_beats_rep_pct,100);
assert.equal(get(called,'NE-SEN').dem_beats_rep_pct,0);
const withdrawn=model.simulate(basis,{...args,marginSummaryCodes:codes});
assert(get(withdrawn,'VA-02').margin_distribution,'Call withdrawal restores the uncertain distribution');

// Exact finite mixture with no Gaussian error: no Gaussian approximation or
// artificial smoothing may replace its actual two separated draw populations.
const deterministic=structuredClone(basis);
for(const item of [...deterministic.house,...deterministic.senate,...deterministic.governors])item.sigma=0;
for(const key of ['common_national_sigma','house_chamber_sigma','senate_chamber_sigma',
 'governor_chamber_sigma','state_house_sigma','state_senate_sigma','state_governor_sigma',
 'redrawn_state_additional_sigma'])deterministic.assumptions[key]=0;
const mixture=model.simulate(deterministic,{...args,marginSummaryCodes:['VA-02','IA-SEN']});
assertExactSummary(mixture,'VA-02',mixture.county_draws.margins['VA-02'],'POLLING_BASELINE');
assert.equal(get(mixture,'VA-02').margin_distribution.p05,-18);
assert.equal(get(mixture,'VA-02').margin_distribution.p95,22);
assert.equal(get(mixture,'IA-SEN').margin_distribution.sd,0);
assert.equal(get(mixture,'IA-SEN').margin_distribution.p05,2);
assert.equal(get(mixture,'IA-SEN').margin_distribution.p95,2);

for(const malformed of [[],['IA-SEN','IA-SEN'],['not-an-exact-race-code'],
 Array.from({length:65},(_,i)=>'FICTION-H'+i),'IA-SEN',[null]])
 assert.throws(()=>model.simulate(basis,{samples:300,marginSummaryCodes:malformed}),/margin-summary scope/);

// Existing source-parser fixture: explicitly synthetic Ohio votes, with public
// official historical geography. Exercise the actual national conditioning
// entry point so optional summary scope cannot be lost between prior/replay.
const fs=require('node:fs'),bridge=require('./national_county_likelihood.js');
const load=name=>JSON.parse(fs.readFileSync('data/'+name+'.json','utf8'));
const publicBasis=model.prepare({seats:load('seat_universe'),
 history:load('house_history_2024_staging'),geography:load('house_geography_bridge'),
 senateHistory:load('senate_history_2020_2022_2024'),
 odds:load('race_probabilities'),polls:load('polling_estimates')});
const now=Date.parse('2026-11-04T03:06:00Z');
const envelopes=[require('./ohio_test_fixture.cjs').envelope(12,now)];
const conditionArgs={now,samples:600,seed:19760408,independentSenateCredit:'no_credit'};
const legacyConditioned=bridge.condition(model,publicBasis,envelopes,conditionArgs);
const summarizedConditioned=bridge.condition(model,publicBasis,envelopes,
 {...conditionArgs,marginSummaryCodes:['OH-SEN','ME-SEN','NE-SEN']});
assert.deepEqual(strip(summarizedConditioned.baseline),legacyConditioned.baseline);
assert.deepEqual(strip(summarizedConditioned.result),legacyConditioned.result);
assert.deepEqual(summarizedConditioned.diagnostics,legacyConditioned.diagnostics);
for(const code of ['OH-SEN','ME-SEN','NE-SEN']){
 assert.equal(get(summarizedConditioned.baseline,code).margin_distribution.conditioning,'POLLING_BASELINE');
 const current=get(summarizedConditioned.result,code).margin_distribution;
 assert.equal(current.conditioning,'COUNTY_IMPORTANCE_RESAMPLED');
 assert(current.unique_election_particles<=conditionArgs.samples);
 assert.equal(current.interval_calibrated,false);
}
console.log('Same-joint race margin summaries PASS: unchanged full outputs, exact mixture/quantiles, conditioned repeated particles, source-call suppression/retraction, Independent axes and bounded inputs. Fictional engineering evidence, not calibration.');
