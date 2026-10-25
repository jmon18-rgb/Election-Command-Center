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
assert.equal(called.called,'D');
// During split time-zone poll closings, a legitimate early vote lead may be
// prioritized, but the same provider winner flag MUST NOT show as a call.
for(const [office,key,early,final] of [
 ['Senate','TX','2026-11-04T01:00:00Z','2026-11-04T02:00:00Z'],
 ['House','TX-23','2026-11-04T01:00:00Z','2026-11-04T02:00:00Z'],
 ['House','IN-01','2026-11-03T23:00:00Z','2026-11-04T00:00:00Z'],
 ['Governor','AK','2026-11-04T05:00:00Z','2026-11-04T06:00:00Z']
]){
 const code=office==='Senate'?key+'-SEN':office==='Governor'?key+'-GOV':key;
 const row={office,key,code,tip:2};
 const clock=Date.parse(early);
 const earlyLive={asOf:early,votes:8000,precincts:9,rawMargin:1.7,
                   source:'civicAPI',calledParty:'D'};
 const partial=x.priority(row,{now:clock,live:earlyLive});
 assert.equal(partial.reporting,true,code+' early valid vote counts remain visible');
 assert.equal(partial.called,null,code+' early provider call must be suppressed');
 assert.notEqual(partial.why,'Provider-reported call');
 assert.equal(x.priority(row,{now:Date.parse(final),live:earlyLive}).called,null,
  code+' old early source clock cannot become a winner call just because viewer time advanced');
 const settled=x.priority(row,{now:Date.parse(final),live:{...earlyLive,asOf:final}});
 assert.equal(settled.called,'D',
  code+' may surface source-reported winner only after FINAL local-close stamp');
}
const earlyHouse={office:'House',key:'TX-01',code:'TX-01',tip:2};
const earlyHouseCall=x.priority(earlyHouse,{now:Date.parse('2026-11-04T01:00:00Z'),
 live:{asOf:'2026-11-04T01:00:00Z',votes:5000,source:'civicAPI',calledParty:'R'}});
assert.equal(earlyHouseCall.called,'R',
 'House district wholly in earlier time zone need not wait for unrelated late districts');

const before=x.priority(ref.get('ME-SEN'),{now:Date.parse('2026-10-15T15:00:00Z'),live:{
 asOf:'2026-11-04T02:55:00Z',votes:250000,precincts:65,rawMargin:3,source:'civicAPI',calledParty:'D'
}});
assert.equal(before.reporting,false,'Future/2024/pre-election returns never leak');
// A positive provider count or call must never outrank races before the
// state's actual local floor, even when the apparent source stamp is recent.
const snapshot=(asOf)=>({
 asOf,votes:12000,precincts:50,rawMargin:2,source:'civicAPI',calledParty:'D'
});
for(const [code,clock] of [
 ['AK-SEN','2026-11-04T04:59:00Z'],
 ['CA-48','2026-11-04T03:59:00Z'],
 ['IN-05','2026-11-03T22:59:00Z']
]){
 const item={office:code.endsWith('SEN')?'Senate':'House',
  key:code.endsWith('SEN')?code.slice(0,2):code,code,tip:2};
 const now=Date.parse(clock);
 const result=x.priority(item,{now,live:snapshot(clock),flipped:true});
 assert.equal(result.reporting,false,code+' cannot be live before local close');
 assert.equal(result.called,null,code+' cannot have a promoted winner flag');
 assert.equal(result.source,null,code+' cannot be promoted from cached votes');
}
for(const [code,clock] of [
 ['IN-05','2026-11-03T23:00:00Z'],
 ['AK-00','2026-11-04T05:00:00Z'],
 ['CA-48','2026-11-04T04:00:00Z']
]){
 const item={office:'House',key:code,code,tip:2};
 assert.equal(x.priority(item,{now:Date.parse(clock),
  live:snapshot(clock)}).reporting,true,
  code+' must recover precisely at local close when source is valid');
}
// Actual browser script may arrive ahead of the shared poll-close module.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const win={};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,
 'election_night_priority.js'),'utf8'),{window:win});
const me=win.AutomaticRaceDesk.SEED.find(row=>row.code==='ME-SEN');
assert.equal(win.AutomaticRaceDesk.priority(me,{now:at,
 live:snapshot('2026-11-04T02:55:00Z')}).reporting,false,
 'Missing browser poll-close module fails safely');
win.ElectionNightPollClosings2026=require('./election_night_poll_closings_2026.js');
assert.equal(win.AutomaticRaceDesk.priority(me,{now:at,
 live:snapshot('2026-11-04T02:55:00Z')}).reporting,true,
 'Loading the shared contract restores valid live race priority');

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
// Simulate a crowded Election Night source: all 35 Senate contests and
// Silver-tipping House references compete for only 12 civicAPI slots/minute.
const allSeats=senateSeats.map(x=>({...x,tip:ref.get(x.code)?.tip??null}));
const allHouse=x.SEED.filter(x=>x.office==='House');
const allProvider=[...allSeats,...allHouse,
 {office:'Governor',key:'MA',tip:null}];
const primaryStates=['TX','MI','IA','NC','GA','PA','AZ','VA','FL'];
let cursor={senate:0,house:0,other:0};
const seenSen=new Set(),seenHouse=new Set();
const uncoveredSen=allSeats.filter(x=>!primaryStates.includes(x.key.slice(0,2)));
const uncoveredHouse=allHouse.filter(x=>!primaryStates.includes(x.key.slice(0,2)));
const pins=[{office:'Senate',key:'NH'},{office:'House',key:'NY-17'}];
for(let i=0;i<30;i++){
 const pick=x.sourceBatch({candidates:allProvider,primaryStates,personal:pins,
  cursor,limit:12});
 assert(pick.items.length<=12,'Hourly supplemental bandwidth is bounded');
 assert.equal(new Set(pick.items.map(v=>v.office+'|'+v.key)).size,pick.items.length,
  'Duplicate exact-race checks waste provider requests');
 assert(pick.items.every(v=>!primaryStates.includes(v.key.slice(0,2))),
  'Do not spend supplemental requests on primary-owned states');
 assert(pick.items.some(v=>v.office==='House'&&v.tip>=1),
  'Silver-seeded House races keep dedicated refresh capacity');
 assert(pick.items.some(v=>v.office==='Senate'&&v.tip>=7),
  'Silver Senate high-impact races remain on the hot lane');
 for(const v of pick.items){
  if(v.office==='Senate')seenSen.add(v.key);
  if(v.office==='House')seenHouse.add(v.key);
 }
 cursor=pick.next;
}
assert.deepEqual([...seenSen].sort(),uncoveredSen.map(v=>v.key).sort(),
 'Every uncovered Senate seat must receive an identity-checked turn');
assert.deepEqual([...seenHouse].sort(),uncoveredHouse.map(v=>v.key).sort(),
 'Every eligible Silver House seed must eventually receive a turn');
const small=x.sourceBatch({candidates:[{office:'Senate',key:'ME',tip:12}],
 primaryStates:[],limit:12});
assert.equal(small.items.length,1,'Never duplicate a race merely to fill the quota');
assert.throws(()=>x.sourceBatch({limit:35}),/Unsafe provider request budget/);

console.log('Automatic race desk seeds, near-50 discovery, dynamic ranking, archival isolation PASS');