'use strict';
/* Election Night 2026 fast-lane policy: no external requests. */
const assert=require('node:assert/strict');
const lane=require('./election_night_fast_lane.js');
const make=(office,key)=>({office,key});
const D=['Senate','ME'],R=['House','NY-17'],G=['Governor','NV'];
const at=lane.START+100000;
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
const reported={'Senate|ME':{total:12},'House|NY-17':{total:900},
 'Governor|NV':{total:220},'House|TX-23':{total:110},
 'House|CA-13':{total:550},'House|OH-01':{total:0}};
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
console.log('Election Night free 30-second hot-source lane: selection, quotas, pauses, stale locks PASS');
