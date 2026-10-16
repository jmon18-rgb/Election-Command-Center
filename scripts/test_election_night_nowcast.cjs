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
const ca={office:'Governor',key:'CA'};
const cv={provider:'civicAPI',race_id:6402,office:'Governor',key:'CA',
 total:200000,percent_reporting:80,last_updated:'2026-11-04T03:30:00Z',
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
const akLive=model.estimate(akPrior,akRace,akSource,null,now);
assert.equal(akLive.mode,'live_informed',
 'At-large source 00 must pair with the existing 01 model prior');
assert.equal(akLive.raceCode,'AK-01');
assert(akLive.demPct>60,'Real at-large returns may inform the corresponding model prior');
assert.equal(model.estimate(akPrior,{office:'House',key:'AK-01'},akSource,null,now).mode,
 'polls_only','Legacy model code cannot silently invent a 01 source record');
const secondary=model.estimate(priors,ca,null,cv,now);
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
 assert.equal(model.estimate(priors,ca,null,invalid,now).mode,'polls_only',
  'Malformed, stale or unverified civicAPI returns cannot shift probability');
}
const wrongCivic={...cv,key:'TX'};
assert.equal(model.estimate(priors,ca,null,wrongCivic,now).mode,'polls_only');
const lostParties={...cv,candidates:[{party:'O',votes:120000},{party:'R',votes:80000}]};
assert.equal(model.estimate(priors,ca,null,lostParties,now).mode,'polls_only');
const civicNoStamp={...cv,last_updated:null};
assert.equal(model.estimate(priors,ca,null,civicNoStamp,now).mode,'polls_only');
const calledPriors=structuredClone(priors);
calledPriors.records[0].provider_called_party='R';
const calledR=model.estimate(calledPriors,az,validSource,null,now);
assert.equal(calledR.mode,'source_called');
assert.equal(calledR.demPct,0,'Provider-reported Republican winner must stay at 0% D');
assert.equal(calledR.repPct,100);
assert.equal(calledR.source,'civicAPI');
assert.match(calledR.explanation,/not official certification/);
calledPriors.records[0].provider_called_party='D';
const calledD=model.estimate(calledPriors,az,validSource,null,now);
assert.equal(calledD.demPct,100,'Provider-reported D winner must stay called');
assert.equal(calledD.sensitivityLow,100);
assert.equal(calledD.sensitivityHigh,100);
calledPriors.records[0].provider_called_party=null;
assert.equal(model.estimate(calledPriors,az,validSource,null,now).mode,'live_informed',
 'Withdrawing provider call must restore the cautious partial-return nowcast');
assert.equal(model.estimate({...calledPriors,
 records:calledPriors.records.map((r,i)=>i===0?{...r,provider_called_party:'O'}:r)},
 az,validSource,null,now).mode,'live_informed',
 'Non-D/R independent candidates must not be forced into D/R outcome probabilities');
console.log('Election Night odds: source provenance, prior/posterior, conservative early returns and uncertainty tests passed');
