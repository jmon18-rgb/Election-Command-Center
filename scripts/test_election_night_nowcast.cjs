#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const model=require('./election_night_nowcast.js');
const now=Date.parse('2026-11-04T04:00:00Z');
const priors={
 schema_version:'experimental-race-odds-v1',
 can_infer_chamber_control:false,
 records:[
  {office:'senate',race_code:'AZ-SEN',dem_minus_rep:2,sigma_points:6,
   dem_beats_rep_pct:63.06},
  {office:'governor',race_code:'CA-GOV',dem_minus_rep:-2,sigma_points:7,
   dem_beats_rep_pct:38.75},
  {office:'senate',race_code:'OH-SEN',dem_minus_rep:0,sigma_points:6,
   dem_beats_rep_pct:50}
 ]
};
const az={office:'Senate',key:'AZ'};
const validSource={api:1,year:2026,office:'Senate',source:'state',
 as_of:'2026-11-04T03:30:00Z',stale:false,
 races:{AZ:{total:100000,pct_in:65,cands:[
  {p:'D',v:55000},{p:'R',v:45000}]}}};
function sample(input={}){return model.estimate(priors,az,{...validSource,...input},null,now)}
assert.equal(model.raceCode({office:'Senate',key:'OH-special'}),'OH-SEN');
assert.equal(model.raceCode({office:'House',key:'AZ-03'}),'AZ-03');
assert.equal(model.raceCode({office:'House',key:'AK-00'}),'AK-01');
assert.equal(model.raceCode({office:'House',key:'WY-00'}),'WY-01');
assert.equal(model.raceCode({office:'House',key:'AZ-00'}),'AZ-00',
 'Multi-district states cannot alias to at-large seats');
assert.equal(model.raceCode({office:'Governor',key:'CA'}),'CA-GOV');
assert.equal(model.raceCode({office:'House',key:'AZ-XX'}),null);
assert.equal(model.priorFor(priors,{office:'Senate',key:'TX'}),null,
 'No polling prior must never become 50/50 guesswork');
assert.equal(model.estimate(priors,{office:'Senate',key:'TX'},validSource),null);
assert.equal(model.estimate({...priors,can_infer_chamber_control:true},az,validSource),null,
 'Mismatched model schema must not invent win odds');
assert(Math.abs(model.normalCdf(0)-.5)<.000001);
assert(model.normalCdf(1)>model.normalCdf(0));
assert.equal(sample().mode,'live_informed');
assert(sample().demPct>63.06&&sample().demPct<99,
 'Conservative partial returns should move the prior but not treat them as certainty');
assert.equal(sample().provider,undefined);
assert.equal(sample().source,'Open America');
assert.equal(sample().reporting,65);
assert(sample().sensitivityLow<=sample().demPct&&sample().sensitivityHigh>=sample().demPct);
assert(Math.abs(sample().demPct+sample().repPct-100)<.00001);
assert(sample({stale:true}).mode==='polls_only','Stale results cannot change odds');
assert(sample({as_of:'2026-11-04T00:30:00Z'}).mode==='polls_only',
 'Older than 3 hours is not live');
assert(sample({as_of:'2026-11-04T05:00:00Z'}).mode==='polls_only',
 'Future result timestamps cannot change odds');
assert(sample({as_of:'2026-10-13T21:00:00Z'}).mode==='polls_only',
 'Pre-election votes cannot change odds');
assert(model.estimate(priors,az,validSource,null,Date.parse('2026-10-14T12:00:00Z'))
 .mode==='polls_only');
assert(sample({office:'Governor'}).mode==='polls_only');
const pctNine=structuredClone(validSource);pctNine.races.AZ.pct_in=9;
assert.equal(model.estimate(priors,az,pctNine,null,now).mode,'polls_only',
 'Tiny, nonrepresentative early precinct samples cannot shift odds');
const pctUnknown=structuredClone(validSource);pctUnknown.races.AZ.pct_in=null;
assert.equal(model.estimate(priors,az,pctUnknown,null,now).mode,'polls_only');
const wrongParty=structuredClone(validSource);
wrongParty.races.AZ.cands=[{p:'O',v:55000},{p:'R',v:45000}];
assert.equal(model.estimate(priors,az,wrongParty,null,now).mode,'polls_only',
 'Cannot infer Dem odds from missing Democratic candidate');
const reversal=structuredClone(validSource);reversal.races.AZ.cands[0].v=45000;
reversal.races.AZ.cands[1].v=55000;
assert(model.estimate(priors,az,reversal,null,now).demPct<sample().demPct);
const other=structuredClone(validSource);other.races.AZ={total:100000,pct_in:65,
 cands:[{p:'D',v:40000},{p:'R',v:45000},{p:'O',v:15000}]};
assert.equal(model.estimate(priors,az,other,null,now).mode,'live_informed',
 'Two-party margin is computed from D and R only, while keeping source total');
// No source with duplicated major-party candidate rows may move the
// election-night diagnostic, even if the arithmetic fits its reported total.
for(const duplicated of ['D','R']){
 const malformed=structuredClone(validSource);
 malformed.races.AZ.total=160000;
 malformed.races.AZ.cands.push({p:duplicated,v:5000});
 assert.equal(model.estimate(priors,az,malformed,null,now).mode,'polls_only',
  'Duplicate '+duplicated+' primary vote rows must not shift odds');
}
// An independent third-party column remains valid under the documented
// provider contract and must not be mistaken for duplicate major votes.
const thirdParty=structuredClone(validSource);
thirdParty.races.AZ.total=120000;
thirdParty.races.AZ.cands.push({p:'L',v:10000});
assert.equal(model.estimate(priors,az,thirdParty,null,now).mode,
 'live_informed','Legitimate other-party source votes remain supported');

const ca={office:'Governor',key:'CA'};
const caNow=Date.parse('2026-11-04T04:30:00Z');
const cv={provider:'civicAPI',race_id:6402,office:'Governor',key:'CA',
 total:200000,percent_reporting:80,last_updated:'2026-11-04T04:10:00Z',
 candidates:[
  {name:'Candidate One',party:'D',votes:120000},
  {name:'Candidate Two',party:'R',votes:80000}
 ]};
const akPrior={...priors,records:[...priors.records,
 {office:'house',race_code:'AK-01',dem_minus_rep:2,sigma_points:7.5,
 dem_beats_rep_pct:60}]};
const akSource={...validSource,office:'House',races:{'AK-00':{
 total:100000,pct_in:65,cands:[{p:'D',v:57000},{p:'R',v:43000}]
}}};
const akRace={office:'House',key:'AK-00'};
const akNow=Date.parse('2026-11-04T05:30:00Z');
akSource.as_of='2026-11-04T05:10:00Z';
// A split-time-zone state's partial votes may adjust a research diagnostic,
 // but a source winner flag must not lock it before the FINAL state close.
const alaskaCalled=structuredClone(akPrior);
alaskaCalled.records.find(r=>r.race_code==='AK-01').provider_called_party='D';
const civicAK={provider:'civicAPI',race_id:6301,office:'House',key:'AK-00',
 total:100000,percent_reporting:65,called:'Alaska Dem',
 last_updated:'2026-11-04T05:10:00Z',
 candidates:[{name:'Alaska Dem',party:'D',votes:57000},
             {name:'Alaska Rep',party:'R',votes:43000}]};
assert.equal(model.estimate(alaskaCalled,akRace,akSource,civicAK,akNow).mode,
 'live_informed','Alaska calls before final Aleutian close must not lock odds');
assert.equal(model.estimate(alaskaCalled,akRace,akSource,civicAK,
 Date.parse('2026-11-04T06:01:00Z')).mode,'live_informed',
 'A pre-final source call must NEVER revive when the viewer clock advances');
const civicAKClosed={...civicAK,last_updated:'2026-11-04T06:00:00Z'};
assert.equal(model.estimate(alaskaCalled,akRace,akSource,civicAKClosed,
 Date.parse('2026-11-04T06:01:00Z')).mode,'source_called',
 'A fresh independently validated post-final winner may lock the race');
const akRetracted={...civicAKClosed,called:null};
assert.equal(model.estimate(alaskaCalled,akRace,akSource,akRetracted,
 Date.parse('2026-11-04T06:01:00Z')).mode,'live_informed',
 'Withdrawal of civicAPI called name must restore uncertainty');
assert.equal(model.estimate(alaskaCalled,akRace,akSource,null,
 Date.parse('2026-11-04T06:01:00Z')).mode,'live_informed',
 'Absent civicAPI proof, cached correlated flags cannot force a call');
const texasCalled={...priors,records:[...priors.records,{
 office:'senate',race_code:'TX-SEN',dem_minus_rep:1,sigma_points:7,
 dem_beats_rep_pct:55,provider_called_party:'D'
}]};
const texasSeat={office:'Senate',key:'TX'};
const civicTexas={provider:'civicAPI',race_id:7132,office:'Senate',key:'TX',
 total:80000,percent_reporting:12,called:'Texas Dem',
 last_updated:'2026-11-04T02:00:00Z',
 candidates:[{name:'Texas Dem',party:'D',votes:45000},
             {name:'Texas Rep',party:'R',votes:35000}]};
assert.equal(model.estimate(texasCalled,texasSeat,null,civicTexas,
 Date.parse('2026-11-04T01:59:59Z')).mode,'live_informed',
 'Earliest-zone partial votes may inform a race, but final-zone winner is barred');
assert.equal(model.estimate(texasCalled,texasSeat,null,null,
 Date.parse('2026-11-04T02:00:00Z')).mode,'polls_only',
 'Naked cached D winner annotation cannot lock Texas without source');
assert.equal(model.estimate(texasCalled,texasSeat,null,civicTexas,
 Date.parse('2026-11-04T02:00:00Z')).mode,'source_called');
assert.equal(model.estimate(texasCalled,texasSeat,null,
 {...civicTexas,key:'KS'},Date.parse('2026-11-04T02:01:00Z')).mode,
 'polls_only','A called name from another state is never source proof');

const akLive=model.estimate(akPrior,akRace,akSource,null,akNow);
assert.equal(akLive.mode,'live_informed',
 'At-large source 00 must pair with the existing 01 model prior');
assert.equal(akLive.raceCode,'AK-01');
assert(akLive.demPct>60,'Real at-large returns may inform the corresponding model prior');
// Do NOT infer Alaska House votes at 04:00Z: polls close at 05:00Z.
// Nor may a 04:59Z source stamp be retroactively accepted at 05:30Z.
assert.equal(model.estimate(akPrior,akRace,akSource,null,now).mode,'polls_only',
 'Alaska 2026 returns must not affect odds before local polls close');
const akPreclose=structuredClone(akSource);
akPreclose.as_of='2026-11-04T04:59:00Z';
assert.equal(model.estimate(akPrior,akRace,akPreclose,null,akNow).mode,'polls_only',
 'Source timestamp predating local close must remain ineligible forever');
const caPreclose={...cv,last_updated:'2026-11-04T03:59:00Z'};
assert.equal(model.estimate(priors,ca,null,caPreclose,caNow).mode,'polls_only',
 'California supplemental votes must obey the West Coast close timestamp');
assert.equal(model.estimate(priors,ca,null,cv,
 Date.parse('2026-11-04T03:59:00Z')).mode,'polls_only',
 'Future California source cannot be accepted before local poll close');

assert.equal(model.estimate(akPrior,{office:'House',key:'AK-01'},akSource,null,akNow).mode,
 'polls_only','Legacy model code cannot silently invent a 01 source record');
const secondary=model.estimate(priors,ca,null,cv,caNow);
assert.equal(secondary.mode,'live_informed');
assert.equal(secondary.source,'civicAPI');
assert(secondary.demPct>38.75);
for(const invalid of [
 {...cv,provider:'unknown'},
 {...cv,race_id:0},
 {...cv,stale:true},
 {...cv,sourceStale:true},
 {...cv,total:1000},
 {...cv,candidates:[...cv.candidates, {...cv.candidates[0]}]},
 {...cv,candidates:[...cv.candidates,{name:'Other',party:'O',votes:5000}]},
 {...cv,candidates:cv.candidates.map(c=>({...c,votes:-1}))}
]){
 assert.equal(model.estimate(priors,ca,null,invalid,caNow).mode,'polls_only',
  'Malformed, stale or unverified civicAPI returns cannot shift probability');
}
const wrongCivic={...cv,key:'TX'};
assert.equal(model.estimate(priors,ca,null,wrongCivic,caNow).mode,'polls_only');
const lostParties={...cv,candidates:[{party:'O',votes:120000},{party:'R',votes:80000}]};
assert.equal(model.estimate(priors,ca,null,lostParties,caNow).mode,'polls_only');
const civicNoStamp={...cv,last_updated:null};
assert.equal(model.estimate(priors,ca,null,civicNoStamp,caNow).mode,'polls_only');
const calledPriors=structuredClone(priors);
calledPriors.records[0].provider_called_party='R';
const civicAZ={provider:'civicAPI',race_id:6401,office:'Senate',key:'AZ',
 total:100000,percent_reporting:65,called:'Arizona Rep',
 last_updated:'2026-11-04T03:30:00Z',
 candidates:[{name:'Arizona Dem',party:'D',votes:55000},
             {name:'Arizona Rep',party:'R',votes:45000}]};
const calledR=model.estimate(calledPriors,az,validSource,civicAZ,now);
assert.equal(calledR.mode,'source_called');
assert.equal(calledR.demPct,0,'Fresh validated Republican call must stay at 0% D');
assert.equal(calledR.repPct,100);
assert.equal(calledR.source,'civicAPI');
assert.equal(model.estimate(calledPriors,az,validSource,civicAZ,
 Date.parse('2026-11-04T01:59:00Z')).mode,'polls_only',
 'A provider-call flag cannot lock Arizona race odds before Arizona closes');
assert.match(calledR.explanation,/not official certification/);
assert.equal(model.estimate(calledPriors,az,validSource,null,now).mode,'live_informed',
 'Cached flag without a usable current civic source cannot lock D/R odds');
assert.equal(model.estimate(calledPriors,az,validSource,
 {...civicAZ,last_updated:'2026-11-04T01:59:00Z'},now).mode,'live_informed',
 'Preclose source flag cannot later resurrect when source time remains early');
assert.equal(model.estimate(calledPriors,az,validSource,
 {...civicAZ,last_updated:'2026-11-03T23:00:00Z'},now).mode,'live_informed',
 'Even older but formerly valid winner flags are not fresh sources');
assert.equal(model.estimate(calledPriors,az,validSource,
 {...civicAZ,called:'Not A Candidate'},now).mode,'live_informed',
 'Unknown winner name cannot force probability to 100 percent');
assert.equal(model.estimate(calledPriors,az,validSource,
 {...civicAZ,called:'Arizona Dem'},now).mode,'live_informed',
 'Disagreement between cached winner party and current source must fail closed');
calledPriors.records[0].provider_called_party='D';
const calledD=model.estimate(calledPriors,az,validSource,
 {...civicAZ,called:'Arizona Dem'},now);
assert.equal(calledD.demPct,100,'New independently revalidated D call can lock the race');
assert.equal(calledD.sensitivityLow,100);
assert.equal(calledD.sensitivityHigh,100);
calledPriors.records[0].provider_called_party=null;
assert.equal(model.estimate(calledPriors,az,validSource,civicAZ,now).mode,'live_informed',
 'Withdrawing provider call must restore the cautious partial-return nowcast');
assert.equal(model.estimate({...calledPriors,
 records:calledPriors.records.map((r,i)=>i===0?{...r,provider_called_party:'O'}:r)},
 az,validSource,civicAZ,now).mode,'live_informed',
 'Non-D/R independent candidates must not be forced into D/R outcome probabilities');
console.log('Election Night odds: source provenance, prior/posterior, conservative early returns and uncertainty tests passed');
