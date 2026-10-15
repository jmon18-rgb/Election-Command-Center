'use strict';
const assert=require('node:assert/strict');
const x=require('./election_night_priority.js');
const ref=new Map(x.SEED.map(r=>[r.code,r]));
assert(x.SEED.length>=75,'Screenshot seed should include Senate, House and relevant governors');
for(const [race,tip] of [['ME-SEN',12],['TX-SEN',12],['OH-SEN',11],
 ['IA-SEN',10],['KS-SEN',8],['PA-10',3],['NC-01',3],['AZ-06',3],
 ['NY-17',2],['TX-34',2],['KY-06',1],['FL-27',0]]){
 assert.equal(ref.get(race)?.tip,tip,'Reference from screenshot: '+race);
}
assert.equal(ref.get('OH-SEN').key,'OH-special');
assert.equal(ref.get('FL-SEN').key,'FL-special');
assert.equal(x.SEED.filter(y=>y.office==='Senate').length,15);
assert.equal(x.SEED.filter(y=>y.office==='House').length>=50,true);
assert(x.watch({race_probabilities:[]}).some(z=>z.code==='ME-SEN'));
const dynamic=x.extras({race_probabilities:[
 {race_code:'MO-02',office:'house',dem_beats_rep_pct:48},
 {race_code:'AL-02',office:'house',dem_beats_rep_pct:51},
 {race_code:'VA-02',office:'house',dem_beats_rep_pct:50},
 {race_code:'LA-SEN',office:'senate',dem_beats_rep_pct:51}
]});
assert(dynamic.some(z=>z.code==='AL-02'));
assert(!dynamic.some(z=>z.code==='VA-02'),'Do not duplicate screenshot seeds');
assert(dynamic.some(z=>z.code==='LA-SEN'),'Close unseeded Senate should be discovered');
const at=Date.parse('2026-11-04T03:00:00Z');
const pending=x.priority(ref.get('ME-SEN'),{now:at,modelWinPct:52});
const live=x.priority(ref.get('ME-SEN'),{now:at,modelWinPct:52,live:{
 asOf:'2026-11-04T02:55:00Z',votes:250000,precincts:62,rawMargin:1.5,source:'civicAPI'
}});
assert(live.score>pending.score,'Fresh close reporting moves race up');
assert.equal(live.why,'Close reported vote count');
const flip=x.priority(ref.get('ME-SEN'),{now:at,modelWinPct:52,flipped:true,live:{
 asOf:'2026-11-04T02:55:00Z',votes:250000,precincts:62,rawMargin:1.5,source:'civicAPI'
}});
assert(flip.score>live.score,'Verified leader flip should move to top');
const called=x.priority(ref.get('ME-SEN'),{now:at,live:{
 asOf:'2026-11-04T02:55:00Z',votes:250000,precincts:65,rawMargin:3,source:'civicAPI',calledParty:'D'
}});
assert.equal(called.called,'D');
const before=x.priority(ref.get('ME-SEN'),{now:Date.parse('2026-10-15T15:00:00Z'),live:{
 asOf:'2026-11-04T02:55:00Z',votes:250000,precincts:65,rawMargin:3,source:'civicAPI',calledParty:'D'
}});
assert.equal(before.reporting,false,'Future/2024/pre-election returns never leak');
const archive=x.priority(ref.get('ME-SEN'),{now:at,live:{
 asOf:'2024-11-04T02:55:00Z',votes:250000,precincts:65,rawMargin:3,source:'civicAPI',calledParty:'D'
}});
assert.equal(archive.called,null,'Historical results cannot create current race calls');
const stale=x.priority(ref.get('ME-SEN'),{now:at,live:{
 asOf:'2026-11-03T17:30:00Z',votes:250000,precincts:65,rawMargin:3,source:'civicAPI',calledParty:'D'
}});
assert.equal(stale.reporting,false,'Stale vote counts must not display as live');
assert.equal(x.sort([
 {...ref.get('ME-SEN'),priority:pending},
 {...ref.get('TX-SEN'),priority:flip}
],'Senate')[0].code,'TX-SEN');
console.log('Automatic race desk seeds, near-50 discovery, dynamic ranking, archival isolation PASS');