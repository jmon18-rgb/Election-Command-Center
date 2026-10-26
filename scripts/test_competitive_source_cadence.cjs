const assert=require('node:assert/strict');
const C=require('./competitive_source_cadence.js');
const closes=require('./election_night_poll_closings_2026.js');
(async()=>{
 for(const code of C.CODES){
  const close=closes.floorFor(code);
  assert.equal(C.intervalMs(code,close-1),600000);
  assert.equal(C.intervalMs(code,close),15000);
  assert.equal(C.intervalMs(code,C.FAST_END),60000);
  assert.equal(C.delayMs(code,close-100000,close-2000),2000,'Wake at poll close, not ten minutes later');
 }
 assert.throws(()=>C.intervalMs('MI-04'));
 let now=Date.parse('2026-11-04T03:00:00Z'),active=true,id=0;
 const tasks=new Map(),attempts=[],last=new Map(C.CODES.map(c=>[c,now]));
 const tickers=C.CODES.map(code=>C.createTicker({code,now:()=>now,lastAttempt:()=>last.get(code),isActive:()=>active,
  setTimer:(fn,ms)=>{tasks.set(++id,{fn,at:now+ms});return id;},clearTimer:i=>tasks.delete(i),
  tick:async()=>{attempts.push({code,at:now});last.set(code,now);}}));
 async function advance(ms){const end=now+ms;while(true){const next=[...tasks].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;now=next[1].at;tasks.delete(next[0]);await next[1].fn();}now=end;}
 await advance(60000);
 assert.equal(attempts.length,20,'Five sources, four automatic requests each per minute');
 for(const code of C.CODES){const times=attempts.filter(x=>x.code===code).map(x=>x.at);assert.deepEqual(times.map((t,i)=>i?t-times[i-1]:15000),[15000,15000,15000,15000]);}
 active=false;await advance(120000);assert.equal(attempts.length,20,'Hidden/inactive sources make no automatic requests');
 active=true;tickers.forEach(t=>t.reschedule());await advance(50);assert.equal(attempts.length,25,'Resume once without a catch-up burst');
 await advance(5000);last.set('IA-SEN',now);tickers[0].reschedule();
 await advance(10000);assert.equal(attempts.filter(x=>x.code==='IA-SEN').length,5,'A manual refresh postpones the automatic deadline');
 await advance(5000);assert.equal(attempts.filter(x=>x.code==='IA-SEN').length,6);
 tickers.forEach(t=>t.destroy());assert.equal(tasks.size,0);await advance(120000);
 let pending=null,release,starts=0;
 const slow=C.createTicker({code:'IA-SEN',now:()=>now,lastAttempt:()=>now-15000,
  setTimer:fn=>{pending=fn;return 1;},clearTimer:()=>{pending=null;},
  tick:()=>{starts++;return new Promise(ok=>{release=ok;});}});
 const fire=pending;pending=null;const inFlight=fire();
 assert.equal(starts,1);assert.equal(pending,null,'A slow request has no overlapping automatic timer');
 now+=90000;slow.destroy();release();await inFlight;
 assert.equal(pending,null,'Destroy during a request cannot restart polling');
 console.log('Competitive cadence: close boundaries, 20/minute automatic budget, inactive pause, resume, manual spacing and destroy PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
