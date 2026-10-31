'use strict';
// Editorial JSON mechanics only. Uses the installed pure triage; no main/GET/test data admission.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {applyReviewDelta,itemHash}=require('./apply_integrity_queue_review.cjs');
// Fabricated editorial mechanics, not an election/court dataset or source review.
const crypto=require('node:crypto'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const lead=(id,status='needs_primary_source')=>({id,title:'Independent mechanical lead '+id,url:'https://example.org/article/'+id,publisher:'Mechanical fixture',published_at:'2026-10-30T12:00:00Z',detected_at:'2026-10-30T13:00:00Z',state_hints:['AK'],topic_hints:['litigation'],headline_numbers_unverified:[],review_status:status,primary_sources:[],impact_counts_verified:false,promoted_to_incident_id:null});
const old={updated_at:'2026-10-30T13:00:00Z',status:'leads_only_not_verified_incidents',new_leads:2,review_metrics:{total_leads:3,awaiting_primary_source:2,primary_source_checked:1,advisory_related_headline_buckets:0,advisory_related_headlines:0},advisory_related_headlines:[],items:[lead('lead-a'),lead('lead-b'),lead('old-reviewed','primary_source_checked')]};
const delta={schema:'canonical-integrity-queue-manual-review-delta-v1',target:'data/integrity_review_queue.json',source_contract:'scripts/update_integrity_queue.py',source_contract_sha256:hash(fs.readFileSync(path.join(__dirname,'update_integrity_queue.py'))),case_number:'MECHANICAL-CASE',operations:old.items.slice(0,2).map(row=>({id:row.id,before:structuredClone(row),before_item_sha256:itemHash(row),after:{...structuredClone(row),review_status:'primary_source_checked',reviewed_as_of:'2026-10-30',review_notes:'Mechanical copied-text review only; no allegation, voter impact or incident promotion.',primary_sources:[{publisher:'Mechanical document copy',url:'https://example.org/order.pdf',source_kind:'primary_document_copy_court_order',case_number:'MECHANICAL-CASE',evidence_limit:'No official-host or native-original authentication.'}]}}))};
const before=JSON.stringify(old),deltaBefore=JSON.stringify(delta),ids=delta.operations.map(x=>x.id);
const result=applyReviewDelta(old,delta);assert.equal(JSON.stringify(old),before);assert.equal(JSON.stringify(delta),deltaBefore);
assert.equal(result.queue.items.length,old.items.length);assert.equal(result.changed_ids.length,2);
for(const op of delta.operations){assert.equal(itemHash(op.before),op.before_item_sha256);const row=result.queue.items.find(x=>x.id===op.id);assert.equal(row.review_status,'primary_source_checked');assert.equal(row.impact_counts_verified,false);assert.equal(row.promoted_to_incident_id,null);}
for(const row of old.items.filter(x=>!ids.includes(x.id)))assert.deepEqual(result.queue.items.find(x=>x.id===row.id),row,'Every other latest item must survive');
for(const k of Object.keys(old).filter(k=>!['items','review_metrics','advisory_related_headlines'].includes(k)))assert.deepEqual(result.queue[k],old[k],'Feed metadata is not a review clock');
assert.equal(result.queue.review_metrics.primary_source_checked,old.review_metrics.primary_source_checked+2);
assert.equal(result.queue.review_metrics.awaiting_primary_source,old.review_metrics.awaiting_primary_source-2);
// A later feed adds unrelated rows and clocks. The keyed delta must preserve them.
const newer=structuredClone(old),fresh={...structuredClone(old.items.find(x=>!ids.includes(x.id))),id:'new-feed-row-after-preparation',title:'A later unrelated lead',review_status:'needs_primary_source',primary_sources:[],impact_counts_verified:false,promoted_to_incident_id:null};
newer.items.unshift(fresh);newer.updated_at='2026-10-31T02:00:00Z';newer.new_leads=17;newer.feed_extra={honest:'newer metadata'};
const merged=applyReviewDelta(newer,delta);assert.deepEqual(merged.queue.items[0],fresh);assert.equal(merged.queue.updated_at,newer.updated_at);assert.equal(merged.queue.new_leads,17);assert.deepEqual(merged.queue.feed_extra,newer.feed_extra);assert.equal(merged.queue.review_metrics.total_leads,newer.items.length);
function fails(mutator,pattern){const q=structuredClone(old),d=structuredClone(delta);mutator(q,d);assert.throws(()=>applyReviewDelta(q,d),pattern);}
fails(q=>q.items.find(x=>x.id===ids[0]).review_notes='Later independent decision',/Latest lead changed/);
fails(q=>q.items=q.items.filter(x=>x.id!==ids[0]),/absent/);
fails(q=>q.items.push(structuredClone(q.items[0])),/Duplicate or invalid latest/);
fails((q,d)=>d.operations.push(structuredClone(d.operations[0])),/Duplicate reviewed/);
fails((q,d)=>d.operations[0].before_item_sha256='0'.repeat(64),/before-item hash mismatch/);
fails((q,d)=>d.operations[0].after.title='Changed headline',/non-editorial field title/);
fails((q,d)=>d.operations[0].after.impact_counts_verified=true,/non-editorial field impact_counts_verified/);
fails((q,d)=>d.operations[0].after.promoted_to_incident_id='fake-case',/non-editorial field promoted_to_incident_id/);
fails((q,d)=>d.operations[0].after.primary_sources[0].url='javascript:alert(1)',/HTTPS/);
fails((q,d)=>d.operations[0].after.primary_sources[0].url='https://name:secret@example.org/doc',/HTTPS/);
fails((q,d)=>d.source_contract_sha256='0'.repeat(64),/triage source changed/);
fails((q,d)=>d.operations[0].after.reviewed_as_of='2026-02-30',/Invalid checked date/);
console.log(JSON.stringify({status:'PASS_KEYED_EDITORIAL_REVIEW_MECHANICS',preserved_latest_other_rows:true,exact_ID_and_JSON_stringify_preimage:true,actual_existing_pure_triage:true,curated_promotion_and_numeric_fields_rejected:true,network:0,model_runs:0}));
