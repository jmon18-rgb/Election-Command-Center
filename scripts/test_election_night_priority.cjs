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
// The complete official Senate universe, not 15 reference screenshots or
// near-50 model probabilities, determines ballot coverage.
const senateStates='AL AK AR CO DE FL GA ID IA IL KS KY LA MA ME MI MN MS MT NC NE NH NJ NM OH OK OR RI SC SD TN TX VA WV WY'.split(' ');
assert.equal(senateStates.length,35);
const senateSeats=senateStates.map(state=>({
 office:'Senate',state,code:state+'-SEN',
 kind:state==='FL'||state==='OH'?'special':'regular',
 key:state+(state==='FL'||state==='OH'?'-special':'')
}));
const full=x.watch({race_probabilities:[{office:'house',race_code:'OR-03',
 dem_beats_rep_pct:98.7}]},senateSeats,[
 {race_code:'CT-01',status:'multi_poll',dem_minus_rep:22},
 {race_code:'RI-01',status:'single_poll',dem_minus_rep:28}
]);
assert.equal(full.filter(z=>z.office==='Senate').length,35,
 'Every Senate ballot contest must remain visible even with no polling or odds');
assert(full.some(z=>z.code==='FL-SEN'&&z.key==='FL-special'));
assert(full.some(z=>z.code==='OH-SEN'&&z.key==='OH-special'));
assert(full.some(z=>z.code==='CT-01'&&z.added==='qualifying-house-poll'),
 'Heavily leaning but actually polled House seats must not disappear');
assert(full.some(z=>z.code==='RI-01'));
assert(full.some(z=>z.code==='FL-27'),
 'Editorially tracked House races must remain even without a current poll');
assert.equal(new Set(full.map(z=>z.office+'|'+z.key)).size,full.length);
const badUniverse=senateSeats.slice(1);
assert(x.watch({race_probabilities:[]},badUniverse).filter(z=>z.office==='Senate').length<35,
 'Never silently present an incomplete unverified roster as complete');
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