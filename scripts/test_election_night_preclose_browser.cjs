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

// The real browser's source-acceptance path must reject source mock
// metadata AND vote-history reversals; otherwise a working provider fetch
// can redraw a previously counted House/Senate/Governor race incorrectly.
const progressStart=html.indexOf('function enSnapshotCompatible(');
const progressEnd=html.indexOf('function enAcceptSource(',progressStart);
assert(progressStart>0&&progressEnd>progressStart);
const snapshotCompatible=vm.runInNewContext(
 html.slice(progressStart,progressEnd)+'\nenSnapshotCompatible',{Date});
const base=vote(100,'2026-11-04T00:40:00Z');
base.races.NC.cands=[
 {n:'Candidate D',p:'D',v:60,pct:null},
 {n:'Candidate R',p:'R',v:40,pct:null}
];
const after={...base,as_of:'2026-11-04T00:45:00Z',
 races:{NC:{...base.races.NC,total:130,cands:[
  {n:'Candidate D',p:'D',v:75,pct:null},
  {n:'Candidate R',p:'R',v:55,pct:null}]}}};
assert.equal(snapshotCompatible(base,after),true,
 'New legitimate counted candidate votes remain eligible');
const change=patch=>({...after,races:{NC:{...after.races.NC,...patch}}});
assert.equal(snapshotCompatible(base,change({total:95})),false,
 'Aggregate vote regression cannot silently become a new count');
assert.equal(snapshotCompatible(base,change({cands:[
 {n:'Candidate D',p:'D',v:59,pct:null},
 {n:'Candidate R',p:'R',v:71,pct:null}]})),false,
 'One candidate cannot lose votes without provenance even if the race grows');
assert.equal(snapshotCompatible(base,change({cands:[
 {n:'Candidate D',p:'R',v:75,pct:null},
 {n:'Candidate R',p:'R',v:55,pct:null}]})),false,
 'Previously reported candidates cannot silently change affiliation');
assert.equal(snapshotCompatible(base,change({cands:[
 {n:'Candidate D',p:'D',v:130,pct:null}]})),false,
 'Previously counted candidate cannot disappear from a refresh');
assert.equal(snapshotCompatible(base,{...after,races:{}}),false,
 'A partial missing-race response must not silently erase ballots');
assert.equal(snapshotCompatible(base,{...after,as_of:base.as_of}),false,
 'Changed vote totals require a newly published source timestamp');
assert.equal(snapshotCompatible(base,base),true,
 'Idempotent unchanged provider refreshes are safe');
const empty=vote(0,base.as_of);
assert.equal(snapshotCompatible(empty,after),true,
 'Standby zero-count response can transition to observed live results');
const archive={...base,year:2024};
assert.equal(snapshotCompatible(archive,{...after,year:2024}),true,
 '2024 archive view must not inherit new 2026 progression rules');
assert.match(html,/if\(!enSnapshotCompatible\(previous,o\)\)/,
 'Foreground live results must share the vote-progress gate');
assert.match(html,/if\(!enSnapshotCompatible\(old,obj\)\)/,
 'Background office refresh must share the vote-progress gate');
const freshForValidation=vote(100,'2026-11-04T00:40:00Z');
assert.equal(api.valid(freshForValidation,2026,'Senate'),true);
for(const flag of [{is_test:true},{test:true},{mock:true},
                   {is_mock:true},{active:false}]){
 assert.equal(api.valid({...freshForValidation,...flag},2026,'Senate'),false,
  'Explicit test or inactive office cannot be displayed as live votes');
}
assert.equal(api.valid({...freshForValidation,races:{NC:{
 ...freshForValidation.races.NC,cands:[
  {n:'Candidate D',p:'D',v:0,pct:0},
  {n:'Candidate R',p:'R',v:0,pct:0}]}}},2026,'Senate'),false,
 'Positive aggregate with no attributable candidates is not live returns');
assert.equal(api.valid({...freshForValidation,races:{NC:{
 ...freshForValidation.races.NC,cands:[
  {n:'Candidate D',p:'D',v:60,pct:null},
  {n:' candidate d ',p:'R',v:40,pct:null}]}}},2026,'Senate'),false,
 'Duplicate candidate identities in 2026 source must fail');

console.log('Browser source timestamp gate: NC/OH exact poll close, late fetch and civic recovery PASS');
