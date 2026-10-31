'use strict';
// Applies reviewed editorial decisions to the latest queue. No source retrieval.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..'),TRIAGE=path.join(__dirname,'update_integrity_queue.py');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const itemHash=item=>hash(JSON.stringify(item));
const clone=value=>JSON.parse(JSON.stringify(value));
const allowed=new Set(['review_status','primary_sources','review_notes','reviewed_as_of']);
function validURL(value){try{if(typeof value!=='string'||/[\u0000-\u0020\u007f]/.test(value))return false;const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}}
function applyReviewDelta(latest,delta,{python=process.env.INTEGRITY_REVIEW_PYTHON||'python3'}={}){
 assert(latest&&Array.isArray(latest.items),'Latest canonical queue items required');
 assert.equal(delta?.schema,'canonical-integrity-queue-manual-review-delta-v1');
 assert.equal(delta.target,'data/integrity_review_queue.json');
 assert.equal(delta.source_contract,'scripts/update_integrity_queue.py');
 assert.equal(hash(fs.readFileSync(TRIAGE)),delta.source_contract_sha256,'Reviewed triage source changed');
 assert(Array.isArray(delta.operations)&&delta.operations.length>0,'Nonempty reviewed keyed delta required');
 const byID=new Map();for(const item of latest.items){assert(item&&typeof item.id==='string'&&!byID.has(item.id),'Duplicate or invalid latest lead ID');byID.set(item.id,item);}
 const seen=new Set();
 for(const op of delta.operations){
  assert(op&&typeof op.id==='string'&&!seen.has(op.id),'Duplicate reviewed lead ID');seen.add(op.id);
  assert(/^[a-f0-9]{64}$/.test(op.before_item_sha256),'Exact JSON.stringify before-item hash required');
  assert.equal(op.before?.id,op.id);assert.equal(op.after?.id,op.id);
  assert.equal(itemHash(op.before),op.before_item_sha256,'Declared before-item hash mismatch');
  assert(byID.has(op.id),'Reviewed lead is absent from latest queue');
  assert.equal(itemHash(byID.get(op.id)),op.before_item_sha256,'Latest lead changed; re-review instead of overwriting');
  const original=clone(op.before),next=clone(op.after);
  for(const key of new Set([...Object.keys(original),...Object.keys(next)]))if(!allowed.has(key))assert.equal(JSON.stringify(next[key]),JSON.stringify(original[key]),'Unreviewed non-editorial field '+key);
  assert.equal(original.impact_counts_verified,false);assert.equal(next.impact_counts_verified,false);
  assert.equal(original.promoted_to_incident_id,null);assert.equal(next.promoted_to_incident_id,null);
  assert.equal(next.review_status,'primary_source_checked');
  assert(typeof next.review_notes==='string'&&next.review_notes.trim(),'Explicit source-specific review limits required');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(next.reviewed_as_of||''),'Checked date required');
  assert.equal(new Date(next.reviewed_as_of+'T00:00:00Z').toISOString().slice(0,10),next.reviewed_as_of,'Invalid checked date');
  assert(Array.isArray(next.primary_sources)&&next.primary_sources.length>0,'Reviewed sources required');
  for(const source of next.primary_sources){assert(source&&typeof source.publisher==='string'&&source.publisher.trim(),'Source attribution required');assert(validURL(source.url),'Absolute credential-free HTTPS source URL required');}
 }
 const next=clone(latest),replacements=new Map(delta.operations.map(op=>[op.id,clone(op.after)]));
 next.items=next.items.map(item=>replacements.get(item.id)||item);
 // Run the actual existing pure triage, not a second implementation or main().
 const code='import importlib.util,json,sys;sys.dont_write_bytecode=True;s=importlib.util.spec_from_file_location("editorial_queue_triage",sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);q=json.load(sys.stdin);metrics,groups=m.triage(q);print(json.dumps({"review_metrics":metrics,"advisory_related_headlines":groups}))';
 const result=JSON.parse(cp.execFileSync(python,['-c',code,TRIAGE],{input:JSON.stringify(next.items),encoding:'utf8',maxBuffer:4*1024*1024,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1',PYTHONUTF8:'1',PYTHONIOENCODING:'utf-8:strict'}}));
 assert(result&&result.review_metrics&&Array.isArray(result.advisory_related_headlines),'Existing triage result required');
 next.review_metrics=result.review_metrics;next.advisory_related_headlines=result.advisory_related_headlines;
 return {queue:next,changed_ids:[...seen],before_queue_sha256:hash(JSON.stringify(latest)),after_queue_sha256:hash(JSON.stringify(next)),scope:'Editorial source-text review only; no curated incident, impact, score, probability or election-source admission.'};
}
function main(argv=process.argv.slice(2)){
 let deltaPath=null,apply=false;for(let i=0;i<argv.length;i++){const arg=argv[i];if(arg==='--delta'){assert(!deltaPath&&argv[i+1]&&!argv[i+1].startsWith('--'));deltaPath=path.resolve(argv[++i]);}else if(arg==='--apply'){assert(!apply);apply=true;}else throw new Error('Unknown argument '+arg);}
 assert(deltaPath,'--delta reviewed-file.json required');
 const queuePath=path.join(ROOT,'data','integrity_review_queue.json'),before=fs.readFileSync(queuePath),delta=JSON.parse(fs.readFileSync(deltaPath,'utf8'));
 const result=applyReviewDelta(JSON.parse(before),delta);
 if(apply){
  assert.equal(process.env.INTEGRITY_QUEUE_REVIEW_APPLY_AUTHORIZED,'INDEPENDENT_SOURCE_REVIEW_ACCEPTED','Explicit accepted editorial-review authorization required');
  const temporary=queuePath+'.review-'+process.pid+'-'+Date.now()+'.tmp';
  try{fs.writeFileSync(temporary,JSON.stringify(result.queue,null,2)+'\n',{flag:'wx'});assert(fs.readFileSync(queuePath).equals(before),'Canonical queue changed during preparation; preserve newer data');fs.renameSync(temporary,queuePath);}finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
 }
 console.log(JSON.stringify({status:apply?'APPLIED_REVIEWED_KEYED_DELTA':'CHECKED_NOT_APPLIED',changed_ids:result.changed_ids,before_file_sha256:hash(before),after_queue_sha256:result.after_queue_sha256,review_metrics:result.queue.review_metrics,feed_clock_unchanged:true,scope:result.scope}));
}
module.exports={applyReviewDelta,itemHash,main};
if(require.main===module)try{main();}catch(error){console.error(error.message);process.exitCode=1;}
