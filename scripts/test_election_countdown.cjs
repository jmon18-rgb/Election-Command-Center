#!/usr/bin/env node
'use strict';
// Read the actual display code with a fixed wall clock. This test performs no
// requests, model calculations, Worker work, browser startup or source reads.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const start=html.indexOf('function countdown(');
const end=html.indexOf('function renderItems(',start);
assert(start>0&&end>start,'Use the actual countdown and its initial render');
const presentationStart=html.indexOf('function enUpdateNightPresentation(');
const presentationEnd=html.indexOf("$('#enEarlyLayoutToggle').addEventListener",presentationStart);
assert(presentationStart>0&&presentationEnd>presentationStart);
const countdownSource=html.slice(start,end);
const presentationSource=html.slice(presentationStart,presentationEnd);
const at=iso=>Date.parse(iso);
let now=at('2026-11-02T18:00:00Z'),writes=0;
const label={value:'',get textContent(){return this.value},set textContent(value){writes++;this.value=value}};
class ClockDate extends Date{
 constructor(...args){super(...(args.length?args:[now]));}
 static now(){return now;}
}
const context=vm.createContext({Date:ClockDate,Intl,Number,
 window:{},document:{hidden:false,body:{dataset:{}}},
 $(selector){return selector==='#countdown'?label:null;},
 enEarlyLayoutChoice:'AUTO',
 fetch(){throw Error('Countdown must not request data');},
 Worker(){throw Error('Countdown must not start a Worker');}
});
vm.runInContext(countdownSource+presentationSource,context);
assert.equal(label.textContent,'1 day','The day before the election uses singular wording');
const show=iso=>{now=at(iso);vm.runInContext('countdown()',context);return label.textContent;};
assert.equal(show('2026-11-01T03:59:59Z'),'3 days','Eastern still has October31 before DST changes');
assert.equal(show('2026-11-01T04:00:00Z'),'2 days','Eastern midnight starts November1 in daylight time');
assert.equal(show('2026-11-01T05:59:59Z'),'2 days');
assert.equal(show('2026-11-01T06:00:00Z'),'2 days','The repeated DST hour does not change the calendar day');
assert.equal(show('2026-11-02T04:59:59Z'),'2 days','UTC November2 is still November1 in Eastern time');
assert.equal(show('2026-11-02T05:00:00Z'),'1 day');
assert.equal(show('2026-11-03T04:59:59Z'),'1 day','Election Day begins at Eastern midnight');

// Run the existing registered heartbeat with the real presentation function.
const heartbeat=html.split(/\r?\n/).filter(line=>line.includes('setInterval(')&&line.includes('enReconnectAfterInterruption('));
assert.equal(heartbeat.length,1,'Keep the single existing unattended-tab timer');
const timers=[],reconnect=[];
context.setInterval=(callback,interval)=>timers.push({callback,interval});
context.enReconnectAfterInterruption=()=>reconnect.push('existing reconnect');
context.enNightPresentationReady=true;
vm.runInContext(heartbeat[0],context);
assert.equal(timers.length,1);assert.equal(timers[0].interval,60000);
now=at('2026-11-03T05:00:00Z');timers[0].callback();
assert.equal(label.textContent,'Election Day','A tab left open rolls over without a reload');
assert.deepEqual(reconnect,['existing reconnect'],'The existing reconnect still runs exactly once');

// The optional presentation-clock module may be absent; the date label still
// refreshes on the actual visibility handler, without taking over navigation.
const visibility=html.split(/\r?\n/).filter(line=>line.includes("document.addEventListener('visibilitychange'")&&line.includes('enUpdateNightPresentation('));
assert.equal(visibility.length,1);
const listeners=[];context.document.addEventListener=(name,callback)=>listeners.push({name,callback});
vm.runInContext(visibility[0],context);
assert.equal(listeners[0].name,'visibilitychange');
now=at('2026-11-04T04:59:59Z');listeners[0].callback();
assert.equal(label.textContent,'Election Day');
now=at('2026-11-04T05:00:00Z');listeners[0].callback();
assert.equal(label.textContent,'Election Day has passed','The calendar never declares counting or elections complete');
const priorWrites=writes;listeners[0].callback();
assert.equal(writes,priorWrites,'An unchanged date label does not rewrite the reader DOM');
context.document.hidden=true;now=at('2026-11-03T05:00:00Z');listeners[0].callback();
assert.equal(label.textContent,'Election Day has passed','Hidden visibility events do not update the label');
context.document.hidden=false;listeners[0].callback();
assert.equal(label.textContent,'Election Day','Restoring visibility uses the current Eastern day');
now=NaN;vm.runInContext('countdown()',context);
assert.equal(label.textContent,'Election Day','An invalid clock does not invent a new day');
assert.equal(timers.length,1,'The countdown registers no extra production timer');
console.log('Election countdown Eastern calendar, DST, singular wording, open-tab and visibility refresh PASS');
