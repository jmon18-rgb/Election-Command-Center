#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const close=require('./election_night_poll_closings_2026.js');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const begin=html.indexOf('function enElectionVotesAllowed(');
const end=html.indexOf('function enCompareSnapshots(',begin);
assert(begin>0&&end>begin,'Actual browser gate and source validator missing');
const clock=Date.parse('2026-11-04T03:15:00Z');
class Clock extends Date{static now(){return clock}}
const api=vm.runInNewContext(html.slice(begin,end)+
 '\n({allowed:enElectionVotesAllowed,valid:enSourceValid})',{
 Date:Clock,window:{ElectionNightPollClosings2026:close}
});
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
assert.equal(api.allowed('ME',100,'2026-11-03T23:00:00Z',clock),false,
 'Maine cannot publish Senate votes before its 8 PM Eastern poll close');
assert.equal(api.allowed('ME',100,'2026-11-04T01:00:00Z',clock),true);
assert.equal(api.allowed('GA',100,'2026-11-03T23:59:59Z',clock),false);
assert.equal(api.allowed('GA',100,'2026-11-04T00:00:00Z',clock),true);
assert.equal(api.allowed('TX',100,'2026-11-04T00:59:59Z',clock),false);
assert.equal(api.allowed('TX',100,'2026-11-04T01:00:00Z',clock),true);
assert.equal(api.allowed('AZ',100,'2026-11-04T01:59:59Z',clock),false);
assert.equal(api.allowed('AZ',100,'2026-11-04T02:00:00Z',clock),true);
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
assert.match(html,/cache\.total>0&&!enElectionVotesAllowed/,
 'Resume/cache must never reauthorize pre-close votes');
// Exercise the actual early-results UI source extraction, not a duplicate
// illustrative validator: positive TEST/inactive/invalid county values must
// never masquerade as verified live early indicators or throw on malformed data.
const earlyStart=html.indexOf('function enEarlyLiveObservation(');
const earlyEnd=html.indexOf('function enRenderEarlySignals(',earlyStart);
assert(earlyStart>0&&earlyEnd>earlyStart,'Early signal browser source path missing');
const validStart=html.indexOf('function enElectionVotesAllowed(');
const realSource={
 api:1,year:2026,office:'Senate',source:'state',
 live:true,counting:true,stale:false,final:false,
 as_of:'2026-11-04T00:40:00Z',counts:{races:1},
 races:{NC:{total:100,called:false,winner:'',pct_in:10,
  cands:[{n:'Candidate D',p:'D',v:55,pct:null},
         {n:'Candidate R',p:'R',v:45,pct:null}]}}
};
const liveClock=Date.parse('2026-11-04T01:05:00Z');
class EarlyClock extends Date{static now(){return liveClock}}
const states={enOfficeSnapshots:{Senate:realSource},enModeYear:2026,
 enOffice:'Senate',enData:null,enOfficeErrors:{},
 enResumePendingOffices:new Set(),enFetchError:false,
 enSupportedStates:new Set(['NC']),
 enCivicUsable:()=>null,enCivicErrors:{},enWatchId:()=> 'Senate|NC',
 Date:EarlyClock,window:{ElectionNightPollClosings2026:close}};
const early=vm.runInNewContext(html.slice(validStart,end)+
 '\n'+html.slice(earlyStart,earlyEnd)+'\nenEarlyLiveObservation',states);
const nc={office:'Senate',key:'NC'};
assert.equal(early(nc).source?.total,100,
 'Fresh live verified primary candidate totals should display');
realSource.live=false;realSource.counting=false;
assert.equal(early(nc).source,null,'Inactive provider sample is NOT reporting');
realSource.final=true;
assert.equal(early(nc).source?.total,100,'Fresh final source may remain visible');
realSource.final=false;realSource.live=true;realSource.counting=true;
realSource.races.NC.cands=null;
assert.equal(early(nc).source,null,'Malformed candidate array fails closed');
realSource.races.NC.cands=[
 {n:'Candidate D',p:'D',v:0,pct:null},
 {n:'Candidate R',p:'R',v:0,pct:null}];
assert.equal(early(nc).source,null,
 'Reported ballots with zero attributed candidate votes are not verified');
realSource.races.NC.cands=[
 {n:'Candidate D',p:'D',v:55,pct:null},
 {n:'Candidate R',p:'R',v:45,pct:null}];
realSource.as_of='2026-11-04T00:20:00Z';
assert.equal(early(nc).source,null,'NC preclose positive source is rejected');
realSource.as_of='2026-11-04T00:40:00Z';
realSource.stale=true;
assert.equal(early(nc).source,null,'Marked stale source rejected');
realSource.stale=false;
states.enOfficeErrors.Senate=true;
assert.equal(early(nc).source,null,'Cached primary error cannot leak votes');
delete states.enOfficeErrors.Senate;
realSource.office='House';
assert.equal(early(nc).source,null,'Wrong-office primary is rejected');
realSource.office='Senate';
assert.equal(early(nc).source?.total,100);
console.log('Browser source timestamp gate: NC/OH exact poll close, late fetch and civic recovery PASS');
