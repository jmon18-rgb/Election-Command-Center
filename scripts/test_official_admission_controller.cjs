/* Synthetic local fixtures through actual parsers/controllers; no network. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=process.env.OFFICIAL_AUDIT_ROOT||path.resolve(__dirname,'..');
const candidate=process.env.OFFICIAL_AUDIT_CANDIDATE_DIR||path.join(root,'scripts');
const read=n=>fs.readFileSync(path.join(candidate,n),'utf8'),load=n=>JSON.parse(fs.readFileSync(path.join(root,'data',n+'.json'),'utf8'));
const model=require(path.join(root,'scripts/chamber_control_model.js')),bridge=require(path.join(root,'scripts/national_county_likelihood.js'));
const basis=model.prepare({seats:load('seat_universe'),history:load('house_history_2024_staging'),geography:load('house_geography_bridge'),senateHistory:load('senate_history_2020_2022_2024'),odds:load('race_probabilities'),polls:load('polling_estimates')});
const auditApi=require(path.join(candidate,'official_admission_audit.js'));
(async()=>{for(const [code,state,cacheName,controllerName,exportName] of [
 ['WA-03','washington','washington_official_cache.js','washington_house_evidence.js','WashingtonHouseEvidence'],
 ['VA-02','virginia','virginia_official_cache.js','virginia_house_02_evidence.js','VirginiaHouse02Evidence']]){
 const clock={value:Date.parse('2026-11-04T04:10:00Z')};class TestDate extends Date{static now(){return clock.value;}}
 const window={document:{hidden:false},localStorage:{getItem:()=>null,setItem:()=>{}},ElectionNightPollClosings2026:require(path.join(root,'scripts/election_night_poll_closings_2026.js'))};
 window.WashingtonOfficialHouseSource=require(path.join(root,'scripts/washington_official_house_source.js'));
 window.WashingtonRemainingSource=require(path.join(root,'scripts/washington_remaining_source.js'));
 const context=vm.createContext({window,Date:TestDate,crypto:crypto.webcrypto,TextEncoder,structuredClone,setTimeout:()=>1,clearTimeout:()=>{}});
 vm.runInContext(fs.readFileSync(path.join(root,'scripts/competitive_source_revision.js'),'utf8'),context);
 if(code==='VA-02')for(const name of ['virginia_official_usage.js','virginia_official_house_source.js'])
  vm.runInContext(fs.readFileSync(path.join(root,'scripts',name),'utf8'),context);
 vm.runInContext(read(cacheName),context);
 vm.runInContext(fs.readFileSync(path.join(root,'scripts',controllerName),'utf8'),context);
 const record=code==='WA-03'?await require(path.join(root,'scripts/washington_test_fixture.cjs')).fixture({stamp:'2026-11-04T04:05:00Z'}):require(path.join(root,'scripts/virginia_house_02_test_fixture.cjs')).cacheFixture({stamp:'2026-11-04T04:05:00Z'});
 let response=record;
 const controller=window[exportName].create({fetchJSON:async p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8')),fetchSource:async()=>response});
 assert.equal(await controller.tick(true),true);const envelope=controller.status().evidence;
 assert(envelope,controller.status().phase);assert.equal(envelope.snapshot.collection_payload_integrity_verified,true);
 assert.equal(envelope.snapshot.collection_selected_payload_sha256,record.selected_payload_sha256);
 const result=bridge.condition(model,basis,[envelope],{samples:900,seed:20261103,now:clock.value});assert.equal(result.diagnostics.used[0].code,code);
 const audit=auditApi.create({now:()=>clock.value}),args={active:true,envelopes:[envelope],used:result.diagnostics.used,modelRevision:model.VERSION+'|frozen-test-polling-lineage',modelVersion:model.VERSION,pollingAt:basis.generated_from_sources.model_polling_at,kernelRevision:'./scripts/national_county_likelihood.js?v=abcdef123456'};
 audit.observe(args);assert.equal(audit.events()[0].kind,'ADMITTED');assert.equal(audit.events()[0].selected_hash,record.selected_payload_sha256);assert.equal(audit.events()[0].model_version,model.VERSION);assert.equal(audit.events()[0].polling_at,basis.generated_from_sources.model_polling_at);
 response=structuredClone(record);response.selected_payload_sha256='bad';clock.value+=61000;
 assert.equal(await controller.tick(true),false);assert.equal(controller.status().evidence,null);
 const withdrawn=bridge.condition(model,basis,[],{samples:900,seed:20261103,now:clock.value});audit.observe({...args,envelopes:[],used:withdrawn.diagnostics.used});assert.equal(audit.events()[0].kind,'WITHDRAWN');assert.equal(audit.events()[0].receipt_at,record.fetched_at);
 controller.destroy();console.log(code+' actual parser -> controller -> national admission -> audit/withdrawal metadata PASS (synthetic)');
}})().catch(e=>{console.error(e);process.exitCode=1;});
