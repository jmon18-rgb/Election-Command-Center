#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const marker='function enBackgroundPrimaryDue(office,now=Date.now()){';
const begin=source.indexOf(marker);
assert(begin>=0,'Background primary freshness gate absent');
const end=source.indexOf('\n}',begin);
assert(end>begin,'Background refresh helper incomplete');
const helper=source.slice(begin,end+2);
const checked={Senate:1000,House:1000,Governor:undefined};
const due=new Function('enOfficeCheckedAt',helper+';return enBackgroundPrimaryDue')(checked);
assert.equal(due('Senate',55000),false,'Fresh observed Senate source should not be re-polled early');
assert.equal(due('Senate',56000),true,'Senate should refresh after 55 seconds');
assert.equal(due('Governor',56000),true,'Missing state must get its first check');
assert.equal(due('House',2000),false,'Avoid source burst');
assert.equal(due('Senate',NaN),false,'Invalid clock is not a source observation');
assert.match(source,/void enRefreshWatchedOffices\(enOffice,true\)/,
 'Independent background office timer must be wired');
assert.match(source,/if\(!cadenceOnly&&enModeYear===2026&&enIsVisible\(\)\)enQueueRefresh\(\)/,
 'Background Senate success must not postpone a failing House retry');
assert.match(source,/document.visibilityState!=='visible'/);
assert.match(source,/now<Date.parse\('2026-11-03T23:00:00Z'\)/);
assert.match(source,/enWatchRefreshPending.has\(office\)/);
console.log('Primary Senate independent 60s refresh: invalid time, throttling, House backoff and visibility safety PASS');
