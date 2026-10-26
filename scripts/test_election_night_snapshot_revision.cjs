'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const start=html.indexOf('function enSnapshotCompatible(');
const end=html.indexOf('function enAcceptSource(',start);
assert(start>0&&end>start);
const context=vm.createContext({});
vm.runInContext(html.slice(start,end),context);
const compatible=(old,next)=>context.enSnapshotCompatible(old,next);
const stamp='2026-11-04T03:00:00Z';
const base={year:2026,office:'House',as_of:stamp,counting:true,races:{
 'AZ-01':{total:100,cands:[{n:'First',p:'D',v:50},{n:'Second',p:'R',v:40}]}}};
const candidateAdded=structuredClone(base);
candidateAdded.races['AZ-01'].cands.push({n:'Third',p:'I',v:10});
assert.equal(compatible(base,candidateAdded),false,
 'A new counted candidate is a changed vote allocation even if total/old candidates stay unchanged');
const raceAdded=structuredClone(base);
raceAdded.races['AZ-02']={total:20,cands:[{n:'Another',p:'D',v:20}]};
assert.equal(compatible(base,raceAdded),false,
 'A new counted race also needs an advanced source publication clock');
for(const corrected of [candidateAdded,raceAdded]){
 corrected.as_of='2026-11-04T03:01:00Z';
 assert.equal(compatible(base,corrected),true,'Fresh additive source evidence can recover');
}
const reordered=structuredClone(base);
reordered.races['AZ-01'].cands.reverse();
assert.equal(compatible(base,reordered),true,'Ordering alone does not change counted evidence');
const retracted=structuredClone(base);
base.races['AZ-01'].called=true;base.races['AZ-01'].winner='First';
retracted.races['AZ-01'].called=false;retracted.races['AZ-01'].winner='';
assert.equal(compatible(base,retracted),true,'Revoking a winner flag must remain possible without changing votes');
const decreased=structuredClone(base);
decreased.as_of='2026-11-04T03:01:00Z';
decreased.races['AZ-01'].total=90;
assert.equal(compatible(base,decreased),false,'Downward revisions still require independent review');
console.log('Actual primary acceptance: same-clock added candidate/race rejected, fresh recovery/order/retraction preserved PASS');
