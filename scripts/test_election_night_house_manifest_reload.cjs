#!/usr/bin/env node
'use strict';
// Test the actual inline loader in index.html, rather than a duplicated
// implementation. No network, no live source calls, no synthesized votes.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const start=html.indexOf('let enHousePinsPromise=null,enHousePinsCheckedAt=');
const end=html.indexOf('async function enCivicFetchOne(',start);
assert(start>0&&end>start,'Expected exactly one real House pin loader');
assert.equal(html.indexOf('let enHousePinsPromise=null,enHousePinsCheckedAt=',start+1),-1);
const loader=html.slice(start,end);
let now=Date.parse('2026-11-04T01:00:00Z'),served=1;
let requests=[],accepted=[];
const ClockDate=class extends Date{static now(){return now}};
const adapter={
 setManifest(doc){
  accepted.push(doc.version);
  return Boolean(doc.version>0);
 }
};
const context=vm.createContext({
 Date:ClockDate,AbortController,
 setTimeout,clearTimeout,
 window:{CivicHouse2026Adapter:adapter},
 fetch:async (url,opts)=>{
  requests.push({url:String(url),opts});
  return {ok:served!==-1,json:async()=>({version:served})};
 }
});
vm.runInContext(loader,context);
const load=()=>vm.runInContext('enHousePinsReady()',context);
(async()=>{
 const first=await Promise.all([load(),load(),load()]);
 assert.deepEqual(first,[true,true,true]);
 assert.equal(requests.length,1,'Simultaneous House races share one manifest request');
 assert.deepEqual(accepted,[1]);
 assert.equal(requests[0].opts.cache,'no-store');
 assert.equal(requests[0].opts.credentials,'omit');
 assert.match(requests[0].url,/^\.\/data\/election_night_house_pins\.json\?v=\d+$/);
 now+=14*60000;served=2;
 assert.equal(await load(),true);
 assert.equal(requests.length,1,'A valid manifest is cached for 15 minutes');
 now+=60000;
 assert.equal(await load(),true);
 assert.equal(requests.length,2,'An open laptop tab must see new published IDs');
 assert.deepEqual(accepted,[1,2]);
 served=-1;now+=15*60000;
 assert.equal(await load(),false,'Unavailable pin manifest must fail closed');
 assert.equal(requests.length,3);
 now+=60000;
 assert.equal(await load(),false);
 assert.equal(requests.length,3,'Provider trouble must not trigger a request storm');
 served=3;now+=60000;
 assert.equal(await load(),true,'Manifest access must automatically recover');
 assert.equal(requests.length,4);
 assert.deepEqual(accepted,[1,2,3]);
 // Loss of the House adapter must also retry later, not freeze forever.
 context.window.CivicHouse2026Adapter=null;
 now+=15*60000;
 assert.equal(await load(),false);
 assert.equal(requests.length,4,'No network requests without source validator');
 context.window.CivicHouse2026Adapter=adapter;
 now+=2*60000;
 assert.equal(await load(),true);
 assert.equal(requests.length,5);
 assert.deepEqual(accepted,[1,2,3,3]);
 // A backward system clock must not preserve a future-dated cache forever.
 now-=20*60000;
 assert.equal(await load(),true);
 assert.equal(requests.length,6);
 assert(requests.every(r=>r.url.startsWith('./data/election_night_house_pins.json?v=')));
 console.log('Open-tab 2026 House pin manifest rechecks, throttling and recovery PASS');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
