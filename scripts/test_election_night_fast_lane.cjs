'use strict';
/* Election Night 2026 fast-lane policy: no external requests. */
const assert=require('node:assert/strict');
const lane=require('./election_night_fast_lane.js');
const make=(office,key)=>({office,key});
const D=['Senate','ME'],R=['House','NY-17'],G=['Governor','NV'];
const at=Date.parse('2026-11-04T05:30:00Z');
assert.equal(lane.INTERVAL_MS,30000);
assert.equal(lane.MIN_RACE_SPACING_MS,26000);
assert.equal(lane.MAX_RACES,4);
const enabled={year:2026,visible:true,tabVisible:true,blocked:false,now:at};
assert(lane.shouldRun(enabled));
for(const x of [
 {year:2024},{visible:false},{tabVisible:false},{blocked:true},
 {now:lane.START-1},{now:lane.END},{now:NaN},
])assert.equal(lane.shouldRun({...enabled,...x}),false,JSON.stringify(x));
const personal=[make(...D),make(...R),make(...G),make('House','TX-23')];
const fresh=total=>({provider:'civicAPI',total,
 last_updated:'2026-11-04T05:29:00Z'});
const reported={'Senate|ME':fresh(12),'House|NY-17':fresh(900),
 'Governor|NV':fresh(220),'House|TX-23':fresh(110),
 'House|CA-13':fresh(550),'House|OH-01':fresh(0)};
const base={personal,automatic:[make('House','CA-13'),make('House','OH-01')],
 reported,lastAttempt:{},primaryStates:['TX'],now:at};
assert.deepEqual(lane.pick(base),[make(...D),make(...R),make(...G),make('House','CA-13')]);
assert.deepEqual(lane.pick({...base,lastAttempt:{'Senate|ME':at-1000}}),
 [make(...R),make(...G),make('House','CA-13')]);
assert.deepEqual(lane.pick({...base,max:2}),[make(...D),make(...R)]);
assert.deepEqual(lane.pick({...base,reported:{}}),[]);
assert.deepEqual(lane.pick({...base,personal:[make(...D),make(...D),make(...R)],automatic:[]}),
 [make(...D),make(...R)]);
assert.deepEqual(lane.pick({...base,personal:[{office:'House',key:'NH-99'},
 {office:'President',key:'NY'},null],automatic:[]}),[]);
assert.deepEqual(lane.pick({...base,lastAttempt:{'Senate|ME':at-26000}})[0],make(...D));
assert.throws(()=>lane.pick({...base,max:40}),/budget/);
assert.throws(()=>lane.pick({...base,now:NaN}),/budget/);
assert.deepEqual(lane.pick({...base,reported:{
 ...reported,'Senate|ME':{...reported['Senate|ME'],
  last_updated:'2026-11-04T02:29:59Z'}
}}).some(x=>x.office==='Senate'&&x.key==='ME'),false,
 'Expired 3-hour-old result cannot consume the faster source lane');
for(const altered of [
 {provider:'unknown'},
 {last_updated:'2024-11-04T05:29:00Z'},
 {last_updated:'2026-11-04T05:45:01Z'},
 {last_updated:'invalid'},
 {stale:true},{sourceStale:true},{total:0}
]){
 const record={...reported['Senate|ME'],...altered};
 assert.equal(lane.pick({...base,reported:{...reported,'Senate|ME':record}})
   .some(x=>x.office==='Senate'&&x.key==='ME'),false,
  'Rejected supplemental candidate cannot consume a hot slot: '+JSON.stringify(altered));
}
const earlyNow=Date.parse('2026-11-04T00:59:00Z');
assert.equal(lane.pick({personal:[make('Senate','ME')],
 reported:{'Senate|ME':{...fresh(1200),last_updated:'2026-11-04T00:59:00Z'}},
 now:earlyNow}).length,0,
 'Maine source is not eligible before its 8 PM EST local close');
assert.equal(lane.pick({personal:[make('Senate','ME')],
 reported:{'Senate|ME':{...fresh(1200),last_updated:'2026-11-04T01:00:00Z'}},
 now:Date.parse('2026-11-04T01:00:00Z')}).length,1,
 'Fresh verified count becomes eligible exactly at local close');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const win={};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,
 'election_night_fast_lane.js'),'utf8'),{window:win,Date});
assert.equal(win.ElectionNightFastLane.pick(base).length,0,
 'Before late-loading shared poll-closing contract, browser fails closed');
win.ElectionNightPollClosings2026=require('./election_night_poll_closings_2026.js');
assert.equal(win.ElectionNightFastLane.pick(base).length,4,
 'Late-loading poll-close contract restores verified fast-lane selection');

console.log('Election Night free 30-second hot-source lane: selection, quotas, pauses, stale locks PASS');
