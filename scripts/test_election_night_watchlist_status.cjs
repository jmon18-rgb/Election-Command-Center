#!/usr/bin/env node
'use strict';
// Test actual laptop watchlist status, not a copied hypothetical function.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const close=require('./election_night_poll_closings_2026.js');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const validStart=html.indexOf('function enElectionVotesAllowed(');
const validEnd=html.indexOf('function enCompareSnapshots(',validStart);
const watchStart=html.indexOf('function enWatchStatus(');
const watchEnd=html.indexOf('function enRenderCivicCandidateDetails(',watchStart);
assert(validStart>0&&validEnd>validStart&&watchStart>0&&watchEnd>watchStart);
const now=Date.parse('2026-11-04T01:05:00Z');
class Clock extends Date{static now(){return now}}
const doc={
 api:1,year:2026,office:'Senate',source:'state',
 live:true,counting:true,stale:false,final:false,
 as_of:'2026-11-04T00:40:00Z',counts:{races:1},
 races:{NC:{total:100,called:false,winner:'',pct_in:11,
  cands:[{n:'D candidate',p:'D',v:55,pct:null},
         {n:'R candidate',p:'R',v:45,pct:null}]}}
};
const ctx={Date:Clock,window:{ElectionNightPollClosings2026:close},
 enOfficeSnapshots:{Senate:doc},enModeYear:2026,enOffice:'Senate',
 enData:null,enOfficeErrors:{},enResumePendingOffices:new Set(),
 enFetchError:false,enSupportedStates:new Set(['NC']),
 enCivicStatus:()=> 'unavailable',enLeadInfo:()=>({short:'D+10',votes:10}),
 enCurrentLeader:()=> 'D',enNum:n=>String(n)};
const fn=vm.runInNewContext(html.slice(validStart,validEnd)+'\n'+
 html.slice(watchStart,watchEnd)+'\nenWatchStatus',ctx);
const item={office:'Senate',key:'NC'};
assert.match(fn(item),/100 counted/,'Valid fresh primary votes still visible');
doc.live=false;doc.counting=false;
assert.match(fn(item),/SOURCE NOT VERIFIED/,'Inactive TEST totals cannot be counted');
doc.final=true;
assert.match(fn(item),/100 counted/,'Fresh final results remain valid');
doc.final=false;doc.live=true;doc.counting=true;
doc.races.NC.cands=null;
assert.match(fn(item),/SOURCE NOT VERIFIED/,'Malformed candidate array must not crash');
doc.races.NC.cands=[
 {n:'D candidate',p:'D',v:0,pct:null},
 {n:'R candidate',p:'R',v:0,pct:null}];
assert.match(fn(item),/SOURCE NOT VERIFIED/,'Zero attributed candidate count blocked');
doc.races.NC.cands=[
 {n:'D candidate',p:'D',v:55,pct:null},
 {n:'R candidate',p:'R',v:45,pct:null}];
doc.as_of='2026-11-04T00:20:00Z';
assert.match(fn(item),/SOURCE NOT VERIFIED/,'Pre-close 2026 votes blocked');
doc.as_of='2026-11-04T00:40:00Z';
doc.stale=true;
assert.match(fn(item),/SOURCE NOT VERIFIED/,'Stale provider blocked');
doc.stale=false;
ctx.enOfficeErrors.Senate=true;
assert.match(fn(item),/SOURCE UNAVAILABLE/,'Outage hides cached positives');
delete ctx.enOfficeErrors.Senate;
assert.match(fn(item),/100 counted/);
ctx.enModeYear=2024;
doc.year=2024;doc.live=false;
assert.match(fn(item),/100 counted/,'Historical rehearsal view preserved');
console.log('Actual 2026 laptop watchlist source gate PASS');
