/* Synthetic receipt fixtures; no native requests or actual admissions claimed. */
'use strict';
const assert=require('node:assert/strict'),api=require('./official_admission_audit.js');
let clock=Date.parse('2026-11-04T04:10:00Z'),saved='';
const storage={getItem:()=>saved,setItem:(k,v)=>{assert.equal(k,api.KEY);saved=v;}};
const audit=api.create({storage,now:()=>clock}),h='a'.repeat(64),h2='b'.repeat(64);
const envelope={snapshot:{race_code:'WA-03',status:'VALIDATED_COUNTY_COUNTS_METHOD_MIX_UNRESOLVED',live_votes_accepted:true,
 collection_payload_integrity_verified:true,collection_selected_payload_sha256:h,collection_original_response_sha256:h2,
 snapshot_updated_at:'2026-11-04T04:01:00Z',source_published_at:'2026-11-04T04:01:01Z',collection_fetched_at:'2026-11-04T04:02:00Z',counties:[{county_fips:'53011',dem_votes:10000,rep_votes:10000}]}};
const args={active:true,envelopes:[envelope],used:[{code:'WA-03'}],modelRevision:'model1|kernelhash1|pollclock1',modelVersion:'joint-control-beta-v1',pollingAt:'2026-11-03T12:00:00Z',kernelRevision:'./scripts/national_county_likelihood.js?v=abcdef123456'};
audit.observe({...args,simulated:true});assert.equal(audit.events().length,0);
audit.observe({...args,envelopes:[{...envelope,rehearsal:true}]});assert.equal(audit.events().length,0);
audit.observe({...args,used:[]});assert.equal(audit.events().length,0,'Available payload is not an admission');
audit.observe(args);assert.equal(audit.events()[0].kind,'ADMITTED');assert.equal(audit.events()[0].observed_at,new Date(clock).toISOString());
clock+=60000;audit.observe(args);assert.equal(audit.events().length,1,'Identical refresh cannot invent a new batch');
const missing=structuredClone(envelope);delete missing.snapshot.collection_selected_payload_sha256;
audit.observe({...args,envelopes:[missing]});assert.equal(audit.events()[0].kind,'AUDIT_METADATA_UNAVAILABLE');assert.equal(audit.events()[0].reason,'MODEL_STILL_ADMITTED_PROVENANCE_UNAVAILABLE');assert.equal(audit.events()[0].provenance_status,'PREVIOUS_ADMISSION_ONLY');
audit.observe({...args,envelopes:[missing]});assert.equal(audit.events().filter(e=>e.kind==='AUDIT_METADATA_UNAVAILABLE').length,1);
audit.observe(args);assert.equal(audit.events()[0].kind,'AUDIT_METADATA_RECOVERED');
const correction=structuredClone(envelope);correction.snapshot.collection_selected_payload_sha256='c'.repeat(64);correction.snapshot.counties[0].dem_votes=9000;
audit.observe({...args,envelopes:[correction]});assert.equal(audit.events()[0].kind,'CORRECTION');assert.equal(audit.events()[0].after,19000);
audit.observe({...args,envelopes:[],used:[]});const withdrawn=audit.events()[0];assert.equal(withdrawn.kind,'WITHDRAWN');assert.equal(withdrawn.receipt_at,envelope.snapshot.collection_fetched_at,'Withdrawal preserves the earlier real receipt rather than inventing a GET');
audit.observe({...args,envelopes:[correction]});assert.equal(audit.events()[0].kind,'RECOVERED');
const withRemaining=structuredClone(correction);withRemaining.snapshot.official_remaining={selected_payload_sha256:'d'.repeat(64),fetched_at:'2026-11-04T04:03:00Z'};
audit.observe({...args,envelopes:[withRemaining],used:[{code:'WA-03',official_remaining_sensitivity:{whole_counties:1}}]});assert.equal(audit.events()[0].kind,'SUPPLEMENT_CHANGE');
audit.observe({...args,envelopes:[withRemaining]});assert.equal(audit.events()[0].kind,'SUPPLEMENT_CHANGE');assert.equal(audit.events()[0].remaining_hash,null,'Rejected/unadmitted supplement does not appear as evidence');
audit.observe({...args,active:false});assert.equal(audit.events()[0].kind,'INACTIVE');
assert.equal(audit.csvRows()[0].length,12+api.headers.length);assert.equal(audit.csvRows()[0][17],'NO','Original full-body hash is never called recomputed');
const restored=api.create({storage,now:()=>clock});assert(restored.events().length>0);restored.observe({...args,used:[],envelopes:[]});assert.equal(restored.events()[0].kind,'INACTIVE','Restoring history never restores active admissions');
for(let i=0;i<150;i++){clock+=1000;audit.observe({...args,modelRevision:'model'+i});}assert(audit.events().length<=api.MAX_EVENTS);assert(saved.length<=api.MAX_BYTES);
assert.equal(api.create({storage:{getItem:()=>'{bad'},now:()=>clock}).events().length,0);
const pre=api.create({now:()=>Date.parse('2026-10-27T10:00:00Z')});pre.observe(args);assert.equal(pre.events().length,0);
assert.equal(audit.events()[0].original_hash_recomputed,false);
// Exercise the real export builder from candidate index.html with one legacy row.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(process.env.OFFICIAL_AUDIT_INDEX||path.resolve(__dirname,'../index.html'),'utf8');
const body=html.slice(html.indexOf('function enBuildActivityCsv('),html.indexOf('function enRenderExportControls()'));
const sandbox={window:{OfficialAdmissionAudit:api},enOfficialAdmissionAudit:audit,enMovements:[],enResumeMovementValid:()=>true,enCsv:rows=>rows};vm.runInNewContext(body,sandbox);
const legacy={office:'House',key:'PA-10',at:new Date(clock).toISOString(),prior:0,current:100,delta:100,newRace:true};
const rows=sandbox.enBuildActivityCsv([legacy]);assert(rows.length>2);assert(rows.every(r=>r.length===rows[0].length),'Legacy and provenance CSV rows must align with every header');
// A long-running tab prunes while observing, exporting and reading events.
clock+=73*60*60*1000;assert.equal(audit.csvRows().length,0);assert.equal(JSON.parse(saved).events.length,0);
const exp=api.create({now:()=>clock});exp.observe({...args,used:[]});assert.equal(exp.events().length,0);
for(const method of ['observe','csvRows','events']){
 let time=Date.parse('2026-11-04T04:10:00Z'),value='';const s={getItem:()=>value,setItem:(k,v)=>{value=v;}};
 const a=api.create({storage:s,now:()=>time});a.observe(args);assert.equal(JSON.parse(value).events.length,1);time+=73*60*60*1000;
 if(method==='observe')a.observe({...args,simulated:true});else a[method]();
 assert.equal(JSON.parse(value).events.length,0,method+' must prune a long-running tab without reload');
}
console.log('Official admission audit: actual decision gating, correction/withdrawal/recovery, supplement-only changes, receipts, bounded local restore and CSV PASS (synthetic)');
