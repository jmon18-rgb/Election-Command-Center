#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const close=require('./election_night_poll_closings_2026.js');
const reconciliation=require('./election_night_reconciliation.js');
const start=html.indexOf('function enExportPrimaryUsable(');
const end=html.indexOf('function enBuildResultsCsv(',start);
assert(start>0&&end>start,'Exact production export source gates missing');
const now=Date.parse('2026-11-04T03:00:00Z');
const officeErrors=Object.create(null),pending=new Set(),cache=Object.create(null);
let foregroundError=null,valid=true,providerHealthy=true;
const ctx={
 Date,window:{ElectionNightReconciliation:reconciliation},
 enSourceValid:()=>valid,enOfficeErrors:officeErrors,
 enOffice:'House',enResumePendingOffices:pending,
 enElectionVotesAllowed:(key,total,stamp,clock)=>
  close.allowed(key,total,stamp,clock),
 enCivicUsable:({office,key})=>providerHealthy?cache[office+'|'+key]||null:null,
};
Object.defineProperty(ctx,'enFetchError',{get:()=>foregroundError});
const api=vm.runInNewContext(html.slice(start,end)+
 '\n({primary:enExportPrimaryUsable,civic:enExportCivicUsable})',ctx);
const primary={source:'state',year:2026,office:'House',stale:false,
 live:true,counting:true,final:false,as_of:'2026-11-04T02:50:00Z',
 races:{'AZ-01':{total:100}}};
assert(api.primary('House',primary,now),'Current reviewed primary may be exported');
officeErrors.House='HTTP 503';
assert(!api.primary('House',primary,now),'Failed primary must not export cached counts');
delete officeErrors.House;
foregroundError='HTTP 503';
assert(!api.primary('House',primary,now),'Foreground outage must block export');
foregroundError=null;
pending.add('House');
assert(!api.primary('House',primary,now),'Restored but unrevalidated office must not export');
pending.clear();
valid=false;
assert(!api.primary('House',primary,now),'Invalid source contract is not exportable');
valid=true;
assert(!api.primary('House',{...primary,as_of:'2026-11-03T20:00:00Z'},now),
 'Stale primary source cannot be silently exported');
assert(!api.primary('House',{...primary,as_of:'2026-11-04T03:20:00Z'},now),
 'Future-dated primary source cannot be exported');
const civic={provider:'civicAPI',office:'House',key:'AZ-01',race_id:123,
 total:500,last_updated:'2026-11-04T02:50:00Z'};
cache['House|AZ-01']=civic;
assert(api.civic(civic,now),'Recent AZ validated civicAPI detail is exportable');
assert(!api.civic({...civic},now),'Detached unverified lookalike cannot bypass cache generation');
providerHealthy=false;
assert(!api.civic(civic,now),'Provider outage blocks cached supplemental export');
providerHealthy=true;
assert(!api.civic({...civic,last_updated:'2026-11-04T01:50:00Z'},now),
 'Pre-AZ-close votes must remain excluded even if retrieved later');
assert(!api.civic({...civic,last_updated:'2026-11-03T23:59:00Z',key:'NH-01'},now),
 'Other race pre-close data cannot be exported');
assert(!api.civic({...civic,last_updated:'2026-11-03T23:00:00Z'},now),
 'Long-stale provider data cannot be exported');
assert(!api.civic({...civic,last_updated:'2026-11-04T03:20:00Z'},now),
 'Future-dated provider data cannot be exported');
assert(!api.civic({...civic,total:0},now),'Zero is not counted as reported votes');
const csv=html.slice(end,html.indexOf('function enBuildActivityCsv(',end));
assert.match(csv,/enExportPrimaryUsable\(office,snapshot\)/,
 'CSV primary rows must use the export gate');
assert.match(csv,/enExportCivicUsable\(data\)/,
 'CSV supplemental rows must use the export gate');
const button=html.slice(html.indexOf('function enRenderExportControls('),
 html.indexOf('function enDownloadCsv('));
assert.match(button,/enExportPrimaryUsable\(office,o\)/);
assert.match(button,/enExportCivicUsable\(o\)/);
console.log('Election Night CSV: verified current primary and supplemental only; outage, pre-close, stale and unvalidated cached counts blocked PASS');
