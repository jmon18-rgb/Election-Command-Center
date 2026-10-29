'use strict';
// Explicitly fictional model summaries; no actual election outcomes or calibration.
const assert=require('node:assert/strict'),focus=require('./personal_election_focus.js'),closes=require('./election_night_poll_closings_2026.js');
const summary=(axis='dem_minus_rep',conditioning='POLLING_BASELINE')=>({
 schema_version:'same-joint-margin-summary-v1',p05:-8,p25:-2,p50:2,p75:6,p95:12,mean:2,sd:6,
 sample_count:900,unique_election_particles:900,axis,conditioning,interval_calibrated:false,
 distribution_scope:'UNBOUNDED_LATENT_MARGIN_PROXY_NOT_FINAL_VOTE_INTERVAL',
 quantile_method:'SORTED_DRAW_LOWER_INDEX_FLOOR_N_MINUS_ONE_P'
});
const baseline={race_probabilities:[...focus.SENATE.map(s=>s+'-SEN'),...focus.HOUSE].map(race_code=>({race_code,dem_beats_rep_pct:45}))};
const result=structuredClone(baseline),options={closes,now:Date.parse('2026-11-04T02:15:00Z')};
const raw=result.race_probabilities.find(x=>x.race_code==='IA-SEN');raw.dem_beats_rep_pct=58;raw.margin_distribution=summary();
const ne=result.race_probabilities.find(x=>x.race_code==='NE-SEN');ne.margin_distribution=summary('osborn_minus_ricketts');
const ak=result.race_probabilities.find(x=>x.race_code==='AK-SEN');ak.margin_distribution=summary();
const original=JSON.stringify({result,baseline});
let rows=focus.rows(result,baseline,options),ia=rows.find(x=>x.code==='IA-SEN');
assert.deepEqual([ia.marginDistribution.p05,ia.marginDistribution.p25,ia.marginDistribution.p50,ia.marginDistribution.p75,ia.marginDistribution.p95],[-8,-2,2,6,12]);
assert.equal(ia.pct,58);assert.equal(ia.delta,13);assert.equal(ia.ownCounts,false);assert.equal(ia.performance,null,'A model range must not invent observed performance');
assert.equal(rows.find(x=>x.code==='AK-SEN').marginDistribution,null,'Unresolved AK identity/final RCV contract suppresses the range');
assert.equal(rows.find(x=>x.code==='NE-SEN').marginDistribution.axis,'osborn_minus_ricketts');
assert.equal(rows.find(x=>x.code==='NE-SEN').left,'Osborn');
assert.equal(JSON.stringify({result,baseline}),original,'Adding a range cannot mutate or condition evidence');
ia.marginDistribution.p50=99;assert.equal(raw.margin_distribution.p50,2,'Display rows must not expose mutable model summary state');

const called=structuredClone(result),calledIA=called.race_probabilities.find(x=>x.race_code==='IA-SEN');calledIA.provider_called_party='D';
const calledRow=focus.rows(called,baseline,options).find(x=>x.code==='IA-SEN');
assert.equal(calledRow.rating.label,'D victory');assert.equal(calledRow.marginDistribution,null,'A winner call contains no verified margin');
delete calledIA.provider_called_party;assert.equal(focus.rows(called,baseline,options).find(x=>x.code==='IA-SEN').marginDistribution.p50,2,'Call withdrawal restores current model summary, not a fabricated final margin');
calledIA.dem_beats_rep_pct=100;assert.equal(focus.rows(called,baseline,options).find(x=>x.code==='IA-SEN').marginDistribution.p50,2,'100% forecast is still not a source call');
calledIA.dem_beats_rep_pct=null;assert.equal(focus.rows(called,baseline,options).find(x=>x.code==='IA-SEN').marginDistribution,null,'Missing odds do not acquire a range');
const independentCall=structuredClone(result);independentCall.race_probabilities.find(x=>x.race_code==='NE-SEN').provider_called_party='D';
const independentRow=focus.rows(independentCall,baseline,options).find(x=>x.code==='NE-SEN');
assert.equal(independentRow.called,false);assert.notEqual(independentRow.rating.state,'called');assert.equal(independentRow.marginDistribution.axis,'osborn_minus_ricketts','Unusable D call cannot convert the paired independent axis');

const invalid=[
 ['missing summary',entry=>delete entry.margin_distribution],
 ['unknown schema',entry=>entry.margin_distribution.schema_version='other'],
 ['claimed calibration',entry=>entry.margin_distribution.interval_calibrated=true],
 ['unknown scope',entry=>entry.margin_distribution.distribution_scope='FINAL_VOTE_INTERVAL'],
 ['unknown quantiles',entry=>entry.margin_distribution.quantile_method='normal approximation'],
 ['wrong axis',entry=>entry.margin_distribution.axis='osborn_minus_ricketts'],
 ['unknown conditioning',entry=>entry.margin_distribution.conditioning='RAW_LEAD'],
 ['nonfinite quantile',entry=>entry.margin_distribution.p50=NaN],
 ['unordered quantiles',entry=>entry.margin_distribution.p25=7],
 ['impossible displayed upper range',entry=>entry.margin_distribution.p95=100.01],
 ['impossible displayed lower range',entry=>entry.margin_distribution.p05=-100.01],
 ['invalid mean',entry=>entry.margin_distribution.mean=Infinity],
 ['negative spread',entry=>entry.margin_distribution.sd=-1],
 ['noninteger samples',entry=>entry.margin_distribution.sample_count=900.5],
 ['small unsupported sample count',entry=>entry.margin_distribution.sample_count=299],
 ['large unsupported sample count',entry=>entry.margin_distribution.sample_count=30001],
 ['missing unique particles',entry=>delete entry.margin_distribution.unique_election_particles],
 ['zero unique particles',entry=>entry.margin_distribution.unique_election_particles=0],
 ['excess unique particles',entry=>entry.margin_distribution.unique_election_particles=901]
];
for(const [name,mutate]of invalid){const entry={margin_distribution:summary()};mutate(entry);assert.equal(focus.marginSummary(entry,{raceCode:'IA-SEN'}),null,name);}
assert.equal(focus.marginSummary({margin_distribution:summary()},{raceCode:'NE-SEN'}),null,'A D/R range must not silently acquire an Osborn label');
assert(focus.marginSummary({margin_distribution:summary('dem_minus_rep','COUNTY_IMPORTANCE_RESAMPLED')},{raceCode:'IA-SEN'}));
assert(focus.marginSummary({margin_distribution:summary('dem_minus_rep','LIVE_INFORMED_SCENARIO')},{raceCode:'IA-SEN'}));
for(const conditioning of ['VALIDATED_CALL_IMPORTANCE_RESAMPLED','CALL_AND_COUNTY_IMPORTANCE_RESAMPLED']){
 assert(focus.marginSummary({margin_distribution:summary('dem_minus_rep',conditioning)},{raceCode:'IA-SEN'}));
}
const broader=structuredClone(result);broader.source_call_conditioning={status:'CONDITIONED',conditioned_covariance_applied:true};
broader.race_probabilities.find(x=>x.race_code==='IA-SEN').margin_distribution.conditioning='VALIDATED_CALL_IMPORTANCE_RESAMPLED';
const broaderRows=focus.rows(broader,baseline,options);
for(const race of ['IA-SEN','ME-SEN','NE-SEN']){
 const row=broaderRows.find(x=>x.code===race);assert.equal(row.ownCounts,false);
 assert.match(row.note,/Broader validated-call context; own county returns are not admitted/);
 assert.notEqual(row.rating.state,'called','Shared-factor learning never invents another winner');
}
assert.match(broaderRows.find(x=>x.code==='NE-SEN').note,/Independent; no assumed Democratic caucus/);
assert.match(broaderRows.find(x=>x.code==='ME-SEN').note,/First-choice evidence; final RCV transfers separate/);
broader.source_call_conditioning={status:'WITHHELD',conditioned_covariance_applied:false};
assert.doesNotMatch(focus.rows(broader,baseline,options).find(x=>x.code==='IA-SEN').note,/Broader validated-call context/);
const degenerate=summary();Object.assign(degenerate,{p05:0,p25:0,p50:0,p75:0,p95:0,mean:0,sd:0,unique_election_particles:1});
assert.equal(focus.marginSummary({margin_distribution:degenerate},{raceCode:'IA-SEN'}).p50,0,'A degenerate empirical summary remains explicit, never an inferred winner call');
assert(focus.rows(result,baseline,{...options,simulated:true}).every(x=>x.simulated),'Fictional rehearsal labels remain separate');
assert.equal(focus.rows(result,baseline,{...options,year:2024}).length,0,'2024 archive never acquires current model ranges');
console.log('Personal margin ranges: exact shared-summary copies,19 invalid-contract mutations, latent bounds, call/withdrawal/100%/AK/NE/context isolation PASS');
