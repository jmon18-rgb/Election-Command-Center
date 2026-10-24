#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const begin=html.indexOf('function enElectionVotesAllowed(');
const end=html.indexOf('function enCompareSnapshots(',begin);
assert(begin>0&&end>begin,'Actual browser gate and source validator missing');
const clock=Date.parse('2026-11-04T03:15:00Z');
class Clock extends Date{static now(){return clock}}
const api=vm.runInNewContext(html.slice(begin,end)+
 '\n({allowed:enElectionVotesAllowed,valid:enSourceValid})',{Date:Clock});
const vote=(total,as_of='2026-11-04T00:20:00Z')=>({
 api:1,year:2026,office:'Senate',source:'state',live:true,stale:false,
 counting:true,final:false,counts:{races:1},as_of,
 races:{NC:{total,called:false,winner:'',pct_in:40,
 cands:[{n:'Test Democrat',p:'D',v:total,pct:total>0?100:0}]}}
});
assert.equal(api.allowed('NC',100,'2026-11-04T00:20:00Z',clock),false);
assert.equal(api.allowed('OH-special',100,'2026-11-04T00:20:00Z',clock),false);
assert.equal(api.allowed('NC-01',100,'2026-11-04T00:20:00Z',clock),false);
assert.equal(api.allowed('NC',100,'2026-11-04T00:30:00Z',clock),true);
assert.equal(api.allowed('OH',100,'2026-11-04T00:30:00Z',clock),true);
assert.equal(api.allowed('ME',100,'2026-11-03T22:00:00Z',clock),false);
assert.equal(api.allowed('ME',100,'2026-11-03T23:00:00Z',clock),true);
assert.equal(api.allowed('NC',0,'',clock),true,'Zero is standby, not reported votes');
assert.equal(api.allowed('NC',100,'',clock),false,'Missing source timestamp cannot count');
assert.equal(api.allowed('NC',100,'2026-11-04T07:00:00Z',clock),false);
assert.equal(api.valid(vote(900)),false,
 'Pre-close primary NC snapshot fetched hours later must be rejected');
assert.equal(api.allowed('NC',900,'2026-11-04T00:30:00Z',clock),true,
 'Post-close source timestamps clear this eligibility gate; other source-shape checks remain independent');
assert.equal(api.allowed('NC',0,'',clock),true,
 'Zero votes remain zero-not-ballots, without establishing a reporting source');
const ineligibleNow=Date.parse('2026-11-04T00:25:00Z');
assert.equal(api.allowed('NC',100,'2026-11-04T00:30:00Z',ineligibleNow),false,
 'Future close timestamp must not enable pre-close results');
assert.match(html,/if\(!enElectionVotesAllowed\(item\.key,next\.total,next\.last_updated\)/,
 'All supplemental adapters must share the same final vote gate');
assert.match(html,/cache\?\.total>0&&!enElectionVotesAllowed/,
 'Resume/cache must never reauthorize pre-close votes');
console.log('Browser source timestamp gate: NC/OH exact poll close, late fetch and civic recovery PASS');
