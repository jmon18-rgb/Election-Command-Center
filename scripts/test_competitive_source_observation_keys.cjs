'use strict';
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {observationKey}=require('./competitive_source_observation_keys.cjs');
const {races}=require('./competitive_live_source_report.cjs');

// Fictional observation records only: no fetch, browser, source body or votes.
for(const race of races.filter(r=>!r.transport_url)){
 const full={url:race.url,http:200,body:'fictional full county body',headers:{date:'full'},started:'full-start'};
 const light={url:race.url+'?light=',http:200,body:'fictional light summary',headers:{date:'light'},started:'light-start'};
 for(const order of [[full,light],[light,full]]){
  const observed=new Map();
  for(const row of order)observed.set(observationKey(row.url),row);
  assert.equal(observed.size,2,race.code+' full/light observations remain distinct');
  assert.equal(observed.get(observationKey(race.url)),full,race.code+' selects the exact declared full response in either order');
  assert.equal(observed.get(observationKey(light.url)),light);
  assert.equal(observed.get(observationKey(race.url)).url,race.url,'Actual URL, headers and timing are retained by reference');
 }
 const errors=new Map();
 errors.set(observationKey(light.url),'light failed');
 assert.equal(errors.get(observationKey(race.url)),undefined,'Light failure cannot label the full county response');
 errors.set(observationKey(race.url),'full failed');
 assert.equal(errors.get(observationKey(light.url)),'light failed');
 assert.equal(errors.get(observationKey(race.url)),'full failed');
 const onlyLight=new Map([[observationKey(light.url),light]]);
 assert.equal(onlyLight.get(observationKey(race.url)),undefined,'No fallback from missing full body to light summary');
}

const caches=races.filter(r=>r.transport_url);
assert.deepEqual(caches.map(r=>r.code),['VA-02','WA-03']);
for(const race of caches){
 const base=race.transport_url;
 for(const minute of ['0','29895394',String(Number.MAX_SAFE_INTEGER)]){
  const row={url:base+'?minute='+minute,http:200,response_cache:{date:'actual-date'},request_started_at:'actual-start'};
  const observed=new Map([[observationKey(row.url),row]]);
  assert.equal(observationKey(row.url),base,'Only the known owned-cache minute query normalizes');
  assert.equal(observed.get(observationKey(base)),row);
  assert.equal(observed.get(base).url,row.url,'Report keeps the actual minute URL');
  const errors=new Map([[observationKey(row.url),'cache request failed']]);
  assert.equal(errors.get(observationKey(base)),'cache request failed');
 }
 for(const query of ['minute=01','minute=-1','minute=1.5','minute=','minute=NaN','minute=9007199254740992',
  'minute=1&minute=2','minute=1&other=2','other=2&minute=1','Minute=1','minute=%31','minute=1#fragment','minute=1\n','light=']){
  const url=base+'?'+query;
  assert.equal(observationKey(url),url,'Unknown/malformed cache query stays a distinct observation: '+query);
  assert.notEqual(observationKey(url),base);
 }
}

for(const url of [races[0].url+'?minute=1',races[0].url+'?other=1',races[0].url+'?light=&other=1',
 caches[0].transport_url+'.unapproved?minute=1',caches[0].transport_url.replace('raw.githubusercontent.com','example.invalid')+'?minute=1']){
 assert.equal(observationKey(url),url,'Unknown queries/hosts cannot replace a declared source observation');
}
assert.throws(()=>observationKey(null),TypeError);

// Confirm this pure selector is wired into both record types and both lookups,
// while the existing origin/path authorization remains separate and unchanged.
const probe=readFileSync(require.resolve('./probe_competitive_live_sources.mjs'),'utf8');
assert(probe.includes("require('./competitive_source_observation_keys.cjs')"));
assert(probe.includes('requestErrors.set(observationKey(request.url()),'));
assert(probe.includes('observed.set(observationKey(response.url()),'));
assert(probe.includes('observed.get(observationKey(race.transport_url||race.url))'));
assert(probe.includes('requestErrors.get(observationKey(race.transport_url||race.url))'));
assert(probe.includes('return new URL(url).origin===siteOrigin||approved.has(canonical(url))?route.continue():route.abort();'));
console.log('Offline source observation keys passed: full/light order isolation, exact county selection, isolated errors and only two owned-cache minute exceptions; no source requests');
