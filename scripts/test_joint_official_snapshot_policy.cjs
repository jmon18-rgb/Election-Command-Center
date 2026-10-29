'use strict';
// Existing fictional native producer records stay RAM-only. This does not fetch
// native sources or establish delivery, final ESS admission or calibration.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),scripts=__dirname,policy=require('./joint_count_snapshot_policy.js'),kernel=require('./national_county_likelihood.js');
const cache=require('./washington_official_cache.js'),native=require('./washington_official_house_source.js'),remaining=require('./washington_remaining_usage.js');
const washington={receiptCurrent:cache.receiptCurrent,publicationCurrent:native.publicationCurrent,remainingCapture:remaining.capture,remainingCurrent:remaining.current};
const fixture=require(path.join(scripts,'washington_test_fixture.cjs')),remainingFixture=require(path.join(scripts,'washington_remaining_test_fixture.cjs'));
const collect=require(path.join(scripts,'collect_washington_official_results.cjs')).collect,clone=structuredClone,iso=t=>new Date(t).toISOString(),load=name=>JSON.parse(fs.readFileSync(path.join(root,'data',name+'.json'),'utf8'));
const ref=load('washington_house_03_county_fips_reference'),history=load('washington_house_03_2024_county_baseline_official'),geometry={...load('washington_house_03_remaining_geography'),...load('house_geography_bridge').districts.find(row=>row.race_code_2026==='WA-03')};
const basis=require(path.join(scripts,'fictional_call_basis.cjs'))({largeBags:true}),start=Date.parse('2026-11-04T04:05:00Z'),groups=[];let producerRecords=0;
async function produced(payload,at,supplement){
 const record=await collect({reference:ref,now:at,fetchImpl:async()=>new Response(JSON.stringify(payload),{headers:{'content-type':'application/json'}})});producerRecords++;
 if(supplement)record.official_remaining=clone(supplement);return record;
}
function reconcile(payload){const b=payload.ballotItemWithBreakdown;
 for(const row of b.breakdownResults)row.voteTotal=row.ballotOptions.reduce((sum,c)=>sum+c.voteCount,0);
 for(const person of b.summaryResults.ballotOptions)person.voteCount=b.breakdownResults.reduce((sum,row)=>sum+row.ballotOptions.find(c=>c.nativeId===person.nativeId).voteCount,0);
 b.voteTotal=b.summaryResults.ballotOptions.reduce((sum,c)=>sum+c.voteCount,0);const overview=payload.ballotItems.find(row=>row.id===b.id);overview.summaryResults=clone(b.summaryResults);overview.voteTotal=b.voteTotal;
}
async function changed(record,{at,sourceAt=at,increase=17,change,remainingRecord=record.official_remaining}={}){
 const payload=clone(record.payload);payload.election.asOf=iso(sourceAt);payload.election.publishDate=iso(sourceAt);
 payload.ballotItemWithBreakdown.breakdownResults[0].ballotOptions.find(c=>c.nativeId==='1601892').voteCount+=increase;if(change)change(payload);reconcile(payload);
 return produced(payload,at,remainingRecord);
}
async function frame(record,at){const snapshot=await cache.parse(record,ref,{now:at});assert(snapshot.live_votes_accepted);
 return {key:'MODEL_FRAME:'+Math.trunc(at),contextKey:'PUBLIC',modelRevision:'FICTIONAL_OFFICIAL_EXTENSION_REVISION',frameKind:'LIVE',countContext:'FICTIONAL_NONCOUNT_STATE',sourceRows:[],descriptiveRows:[],historyRevision:'FICTIONAL_HISTORY',pollingAt:'2026-10-29T00:00:00Z',
  payload:{basis:clone(basis),publicBasis:null,envelopes:[{reference:clone(ref),baseline_year:2024,baseline:{race_code:'WA-03',geography_scope:'district_parts',counties:history.counties.map(c=>({county:c.county,records:{total:{dem_votes:c.dem_votes,rep_votes:c.rep_votes}}}))},remaining_geography:clone(geometry),snapshot}],variants:[],
   args:{samples:3000,seed:20261103,now:at,contextKey:'PUBLIC',independentSenateCredit:'no_credit',nationalShift:0,errorMultiplier:1,marginSummaryCodes:['WA-03'],live:{}}}};
}
const options=now=>({now,validateEnvelope:(envelope,currentNow)=>kernel.compile(envelope,{now:currentNow}),washington});
function capture(value){value.remainingUsage=policy.captureRemainingUsage(value,options(value.payload.args.now));return value;}
function classify(a,b,now=b.payload.args.now,helpers=washington){return policy.classify(a,b,{...options(now),washington:helpers});}
async function check(name,fn){await fn();groups.push(name);}
function hard(a,b,now=b.payload.args.now){assert.equal(classify(a,b,now).kind,'HARD_INVALIDATION');}
(async()=>{
 // The unchanged61-group Civic regression remains a separate required unit.
 assert.equal(policy.VERSION,'joint-count-snapshot-policy-v3');
 for(const helper of Object.values(washington))assert.equal(typeof helper,'function');
 const base=await fixture.fixture({stamp:iso(start)}),at=start+5000,a=await frame(base,at),freshRecord=await changed(base,{at:start+60000}),b=await frame(freshRecord,start+60000);
 await check('actual typed producer WA counts increase with original receipt/native clocks',()=>{assert.equal(classify(a,b).kind,'MONOTONE_COUNTS_ONLY');assert.equal(classify(a,a,at).kind,'MONOTONE_COUNTS_ONLY');});
 await check('existing static remaining geometry alone is not a used supplement',()=>{assert(a.payload.envelopes[0].remaining_geography);assert.equal(a.payload.envelopes[0].snapshot.remaining_status,'NO_REMAINING_SOURCE');assert.deepEqual(policy.captureRemainingUsage(a,options(at)),{});});
 await check('identical selected payload refetch can advance only collector receipt',async()=>{const record=await produced(base.payload,start+60000),next=await frame(record,start+60000);assert.equal(next.payload.envelopes[0].snapshot.collection_selected_payload_sha256,a.payload.envelopes[0].snapshot.collection_selected_payload_sha256);assert.equal(classify(a,next).kind,'MONOTONE_COUNTS_ONLY');});
 await check('each retained candidate cell must not decrease even if total rises',async()=>{const record=await changed(base,{at:start+60000,increase:100,change:p=>{p.ballotItemWithBreakdown.breakdownResults[0].ballotOptions.find(c=>c.nativeId==='1601893').voteCount--;}});hard(a,await frame(record,start+60000));});
 await check('write-in cell decrease cannot hide in increasing D total',async()=>{const raw=clone(base.payload);raw.ballotItemWithBreakdown.breakdownResults[0].ballotOptions.find(c=>c.nativeId==='9910').voteCount=20;reconcile(raw);const oldRecord=await produced(raw,start+1000),old=await frame(oldRecord,at),record=await changed(oldRecord,{at:start+60000,change:p=>{p.ballotItemWithBreakdown.breakdownResults[0].ballotOptions.find(c=>c.nativeId==='9910').voteCount--;}});hard(old,await frame(record,start+60000));});
 for(const [name,mutate]of [
  ['same source clock changed counted vector',x=>{x.payload.envelopes[0].snapshot.snapshot_updated_at=a.payload.envelopes[0].snapshot.snapshot_updated_at;}],
  ['receipt rollback',x=>{x.payload.envelopes[0].snapshot.collection_fetched_at=iso(start-1);}],
  ['publication rollback',x=>{x.payload.envelopes[0].snapshot.source_published_at=iso(start-1);}],
  ['unchanged selected hash with changed native content',x=>{x.payload.envelopes[0].snapshot.collection_selected_payload_sha256=a.payload.envelopes[0].snapshot.collection_selected_payload_sha256;}],
  ['unknown selected hash revision under same native content',x=>{x.payload.envelopes[0].snapshot.collection_selected_payload_sha256='a'.repeat(64);}],
  ['unverified selected payload',x=>{x.payload.envelopes[0].snapshot.collection_payload_integrity_verified=false;}],
  ['raw response hash falsely relabeled recomputed',x=>{x.payload.envelopes[0].snapshot.collection_original_response_hash_recomputed=true;}],
  ['official URL identity',x=>{x.payload.envelopes[0].snapshot.source_url+='?alternate=1';}],
  ['owned transport identity',x=>{x.payload.envelopes[0].snapshot.transport_url+='?alternate=1';}],
  ['method identity',x=>{x.payload.envelopes[0].snapshot.counties[0].vote_method='invented_method';}],
  ['geography identity',x=>{x.payload.envelopes[0].remaining_geography.geography_comparable_2024=false;}],
  ['baseline identity',x=>{x.payload.envelopes[0].baseline.counties[0].records.total.dem_votes++;}]
 ])await check(name+' is HARD',()=>{const old=clone(a),next=name.includes('same native content')?clone(a):clone(b);next.payload.args.now=b.payload.args.now;mutate(next);hard(old,next);});
 await check('missing pure freshness helpers fail closed',()=>{for(const key of ['receiptCurrent','publicationCurrent']){const helpers={...washington};delete helpers[key];assert.equal(classify(a,b,b.payload.args.now,helpers).kind,'HARD_INVALIDATION');}});
 await check('receipt age uses exact extracted15-minute boundary on old frame NOW',async()=>{const limit=Date.parse(a.payload.envelopes[0].snapshot.collection_fetched_at)+15*60000;
  for(const offset of [-1,0,1]){const now=limit+offset,next=await frame(await changed(base,{at:now}),now);assert.equal(classify(a,next,now).kind,offset<=0?'MONOTONE_COUNTS_ONLY':'HARD_INVALIDATION');}});
 await check('native publication helper is invoked for both old/new with explicit NOW',()=>{const calls=[],helpers={...washington,publicationCurrent(...args){calls.push(args);return native.publicationCurrent(...args);}};assert.equal(classify(a,b,b.payload.args.now,helpers).kind,'MONOTONE_COUNTS_ONLY');assert.equal(calls.length,2);assert(calls.every(row=>row[3]===b.payload.args.now));});
 const stats=remainingFixture.fixture({stamp:iso(start)}),withStatsRecord=clone(base);withStatsRecord.official_remaining=stats;const sa=capture(await frame(withStatsRecord,at)),statsNextRecord=await changed(withStatsRecord,{at:start+60000}),sb=capture(await frame(statsNextRecord,start+60000));
 await check('unchanged originally USED six-row supplement may accompany monotone counts',()=>{assert(sa.remainingUsage);assert.deepEqual(sa.remainingUsage['WA-03'].likelihood_footprint.county_fips,['53011','53015','53041','53049','53059','53069']);assert.equal(Object.isFrozen(sa.remainingUsage),true);assert.equal(Object.isFrozen(sa.remainingUsage['WA-03'].projection.used_counties[0]),true);assert.equal(classify(sa,sb).kind,'MONOTONE_COUNTS_ONLY');});
 await check('captured footprint is five actual used rows rather than all six available estimates',async()=>{const payload=clone(base.payload),county=payload.ballotItemWithBreakdown.breakdownResults.find(row=>row.locality.name[0].text==='Clark County');for(const candidate of county.ballotOptions)candidate.voteCount=0;reconcile(payload);
  const record=await produced(payload,start+1000,stats),old=capture(await frame(record,at));assert.equal(old.payload.envelopes[0].snapshot.remaining_revision.counties.length,6);assert.equal(old.remainingUsage['WA-03'].projection.used_counties.length,5);assert(!old.remainingUsage['WA-03'].likelihood_footprint.county_fips.includes('53011'));assert.equal(classify(old,old,at).kind,'MONOTONE_COUNTS_ONLY');
  const forged=clone(old),revision=old.payload.envelopes[0].snapshot.remaining_revision,all=revision.counties.map(row=>row.county_fips);forged.remainingUsage['WA-03'].projection=remaining.capture(revision,all,old.payload.envelopes[0].snapshot.snapshot_updated_at);forged.remainingUsage['WA-03'].likelihood_footprint.county_fips=all;forged.remainingUsage['WA-03'].likelihood_footprint.whole_counties=6;hard(old,forged,at);
  const nextRecord=await changed(record,{at:start+60000,change:p=>{p.ballotItemWithBreakdown.breakdownResults.find(row=>row.locality.name[0].text==='Clark County').ballotOptions.find(row=>row.nativeId==='1601892').voteCount+=17;}}),next=capture(await frame(nextRecord,start+60000));assert.equal(next.remainingUsage['WA-03'].projection.used_counties.length,6);hard(old,next);
 });
 await check('new supplement remains HARD even if it is valid',()=>hard(a,sb));
 await check('removed supplement remains HARD',()=>hard(sa,b));
 await check('changed supplement receipt/version remains HARD',async()=>{const record=await changed(withStatsRecord,{at:start+60000,remainingRecord:remainingFixture.fixture({stamp:iso(start+60000)})});hard(sa,capture(await frame(record,start+60000)));});
 await check('changed estimate values remain HARD',async()=>{const record=await changed(withStatsRecord,{at:start+60000,remainingRecord:remainingFixture.fixture({stamp:iso(start),estimate:11000})});hard(sa,capture(await frame(record,start+60000)));});
 await check('missing originally captured used footprint stays HARD',()=>{const next=clone(sb);delete next.remainingUsage;hard(sa,next);});
 await check('all available rows cannot replace exact originally used footprint',()=>{const next=clone(sb);next.remainingUsage['WA-03'].likelihood_footprint.county_fips=next.remainingUsage['WA-03'].likelihood_footprint.county_fips.slice(1);hard(sa,next);});
 await check('forged max-clock projection cannot conceal an expired used county',()=>{const next=clone(sb);next.remainingUsage['WA-03'].projection.used_counties[0].reported_at=iso(start+60000);hard(sa,next);});
 await check('missing per-used guard fails closed',()=>{for(const key of ['remainingCapture','remainingCurrent']){const helpers={...washington};delete helpers[key];assert.equal(classify(sa,sb,sb.payload.args.now,helpers).kind,'HARD_INVALIDATION');}});
 await check('frozen capture derives used IDs at exact frame input time rather than actual NOW',()=>{const calls=[],opts={...options(sb.payload.args.now+1000),validateEnvelope:(envelope,currentNow)=>{calls.push(currentNow);return kernel.compile(envelope,{now:currentNow});}};
  const usage=policy.captureRemainingUsage(sa,opts);assert.deepEqual(usage,sa.remainingUsage);assert.deepEqual(calls,[sa.payload.args.now]);});
 await check('future count stamp moving beyond original used-row pairing is HARD',async()=>{const now=start+16*60000,nextRecord=await changed(withStatsRecord,{at:now}),next=await frame(nextRecord,now);next.remainingUsage=policy.captureRemainingUsage(next,options(now));assert.equal(next.remainingUsage,null);hard(sa,next,now);});
 await check('frozen count pairing at exactly15min remains eligible but one millisecond later is HARD',async()=>{for(const offset of [0,1]){const now=start+15*60000+offset,next=capture(await frame(await changed(withStatsRecord,{at:now}),now));assert.equal(classify(sa,next,now).kind,offset===0?'MONOTONE_COUNTS_ONLY':'HARD_INVALIDATION');}});
 await check('originally used row expiry is hard despite fresh count receipt/native clocks and successful compile fallback',async()=>{const reported=start,captured=reported+30*60000-2500,late=reported+30*60000+1,countStamp=reported+15*60000,record=remainingFixture.fixture({stamp:iso(reported)});record.fetched_at=iso(captured);
  const old=capture(await frame(await changed(base,{at:captured,sourceAt:countStamp,increase:0,remainingRecord:record}),captured)),snapshot=old.payload.envelopes[0].snapshot,total=snapshot.counties.reduce((n,c)=>n+c.dem_votes+c.rep_votes+c.other_votes,0);
  assert(old.remainingUsage);assert(cache.receiptCurrent(snapshot.collection_fetched_at,late));assert(native.publicationCurrent(snapshot.snapshot_updated_at,snapshot.source_published_at,total,late));
  const fallback=kernel.compile(old.payload.envelopes[0],{now:late});assert(!fallback.official_remaining_sensitivity);hard(old,old,late);
 });
 await check('native candidate identity still rejected before typed source admission',()=>{const raw=clone(base.payload);raw.ballotItemWithBreakdown.breakdownResults[0].ballotOptions[0].nativeId='WRONG';assert.throws(()=>native.parse(raw,ref,{now:at}),/candidate identity\/count\/method/);});
 await check('VA stays HARD even if pure cache helpers are supplied',()=>{const old=clone(a);old.payload.envelopes[0].snapshot.race_code='VA-02';assert.equal(classify(old,old,at).kind,'HARD_INVALIDATION');});
 await check('changed opaque original hash requires a newer receipt and never becomes verified original bytes',()=>{const old=clone(a),next=clone(a);next.payload.envelopes[0].snapshot.collection_original_response_sha256='a'.repeat(64);hard(old,next,at);next.payload.envelopes[0].snapshot.collection_fetched_at=iso(start+2000);next.payload.args.now=at;assert.equal(classify(old,next,at).kind,'MONOTONE_COUNTS_ONLY');assert.equal(next.payload.envelopes[0].snapshot.collection_original_response_hash_recomputed,false);});
 await check('classification/capture are RAM-only and read-only',()=>{const before=JSON.stringify([sa,sb]),result=classify(sa,sb);assert.equal(JSON.stringify([sa,sb]),before);assert.deepEqual(Object.keys(result),['kind','reason']);});
 const report={status:'PASS_OFFICIAL_SCHEDULING_COMPONENT_ACCEPTANCE_OPEN',helper_sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'joint_count_snapshot_policy.js'))).digest('hex'),original_civic_regression:'Unchanged test_joint_count_snapshot_policy.cjs runs separately',official_groups:groups.length,groups,actual_typed_producer_records:producerRecords,source_GETs:0,model_draws:0,raw_body_persistence:false,fixture_numeric_tables_persisted:false,
  used_footprint_source:'Installed NCL.compile sensitivity at each frozen frame.args.now; current revalidation separately checks exact per-used rows/count pairing and captured footprint equality. Compiler used footprint is not final ESS admission.',scope:'WA no supplement and unchanged originally-used supplement only; VA/new/changed/removed supplement/footprint and missing helper remain HARD. Not calibration, delivery or full browser acceptance.'};
 const out=path.join(root,'artifacts','readiness');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'joint-official-snapshot-policy.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,official_groups:groups.length}));
})().catch(error=>{console.error(error);process.exitCode=1;});
