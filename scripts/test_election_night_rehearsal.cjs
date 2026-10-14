#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const demo=require('./election_night_rehearsal.js');
const engine=require('./election_night_nowcast.js');
const originals={
 schema_version:'experimental-race-odds-v1',can_infer_chamber_control:false,
 records:['NC','MI','GA','TX'].map((state,i)=>({
  office:'senate',race_code:state+'-SEN',
  dem_minus_rep:[2,0,4,-2][i],sigma_points:6,
  dem_beats_rep_pct:[63,50,74,37][i]
 }))
};
assert.equal(demo.PHASES.length,5);
assert.equal(demo.RACES.length,4);
assert.equal(demo.PHASES[0].precinctPct,0);
assert(demo.PHASES.slice(1).every(x=>x.precinctPct>=10&&x.precinctPct<100));
assert.deepEqual(demo.RACES.map(r=>r.state),['NC','MI','GA','TX']);
const before=JSON.stringify(originals);
const initial=demo.run(originals,engine,0);
assert.equal(initial.totalSteps,5);
assert.equal(initial.rows.length,4);
assert(initial.rows.every(r=>r.result.mode==='polls_only'&&r.simulatedVotes===0));
for(let stage=1;stage<5;stage++){
 const result=demo.run(originals,engine,stage);
 assert.equal(result.step,stage);
 assert.equal(result.rows.length,4);
 assert(result.rows.every(r=>r.result.mode==='live_informed'&&r.simulatedVotes>0));
 for(const row of result.rows){
  assert.equal(row.result.source,'Open America');
  assert.equal(row.result.reporting,demo.PHASES[stage].precinctPct);
  assert(row.result.demPct>=0&&row.result.demPct<=100);
  assert(Math.abs(row.result.demPct+row.result.repPct-100)<1e-7);
  assert(row.result.sensitivityLow<=row.result.demPct);
  assert(row.result.sensitivityHigh>=row.result.demPct);
  const snap=demo.snapshot(row.code.slice(0,2),stage);
  assert.equal(snap.office,'Senate');
  assert.equal(snap.year,2026);
  assert.equal(snap.races[row.code.slice(0,2)].total,row.simulatedVotes);
  assert.equal(snap.races[row.code.slice(0,2)].called,false);
  assert.equal(snap.races[row.code.slice(0,2)].winner,'');
  assert.equal(snap.races[row.code.slice(0,2)].cands.reduce((x,c)=>x+c.v,0),row.simulatedVotes);
 }
}
const nc=demo.run(originals,engine,4).rows.find(r=>r.code==='NC-SEN');
assert(nc.result.demPct>initial.rows.find(r=>r.code==='NC-SEN').result.demPct,
 'Late hypothetical positive D margin should lift model relative to poll prior');
assert.equal(JSON.stringify(originals),before,'Synthetic run may not mutate published polling priors');
assert.equal(demo.snapshot('NC',0),null);
for(const bad of [-1,5,Infinity,1.5]){
 assert.throws(()=>demo.run(originals,engine,bad),/Unsupported/);
 assert.throws(()=>demo.snapshot('NC',bad),/Unsupported/);
}
assert.throws(()=>demo.snapshot('XY',1),/Unknown simulated race/);
assert.throws(()=>demo.run(originals,null,1),/Model missing/);
console.log('Election Night interactive rehearsal: five deterministic fictional stages, no calls, no source mutation, modeled odds tests passed');
