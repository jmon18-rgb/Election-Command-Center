'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const source=require('./washington_remaining_source.js'),{fixture:remaining,seal}=require('./washington_remaining_test_fixture.cjs');
const {fixture,load}=require('./washington_test_fixture.cjs'),cache=require('./washington_official_cache.js'),kernel=require('./national_county_likelihood.js');
const publisher=require('./publish_washington_official_cache.cjs'),{collectRemaining}=require('./collect_washington_official_results.cjs');
const reference=load('washington_house_03_county_fips_reference'),history=load('washington_house_03_2024_county_baseline_official');
const stamp='2026-11-04T04:05:00Z',now=Date.parse(stamp)+5000;
const model=require('./chamber_control_model.js');
const basis=model.prepare({seats:load('seat_universe'),history:load('house_history_2024_staging'),geography:load('house_geography_bridge'),senateHistory:load('senate_history_2020_2022_2024'),odds:load('race_probabilities'),polls:load('polling_estimates')});
(async()=>{
 assert.deepEqual(source.identities,load('washington_county_remaining_source_contract').counties);
 const actual=remaining();actual.payload=JSON.parse(fs.readFileSync('data/washington_historical_sources/2026-official-county-remaining-preclose.json','utf8'));
 assert.equal(source.parse(actual,{now,counts_stamp:stamp}).counties.length,0,'Real null clocks remain excluded on a post-close review clock');
 let calls=0;const collected=await collectRemaining({now,countsStamp:stamp,fetchImpl:async url=>{calls++;assert.equal(url,source.URL);return new Response(JSON.stringify(remaining().payload),{headers:{'content-type':'application/json'}});}});
 assert.equal(calls,1);assert.equal(source.parse(collected,{now,counts_stamp:stamp}).counties.length,6);
 const huge=await collectRemaining({now,countsStamp:stamp,fetchImpl:async()=>new Response('x'.repeat(1000001),{headers:{'content-type':'application/json'}})});assert.equal(huge.payload,null);
 const record=await fixture({stamp}),parsed=await cache.parse(record,reference,{now});
 const geometry={...load('washington_house_03_remaining_geography'),...load('house_geography_bridge').districts.find(c=>c.race_code_2026==='WA-03')};
 const envelope=snapshot=>({snapshot,reference,remaining_geography:geometry,baseline_year:2024,baseline:{race_code:'WA-03',geography_scope:'district_parts',counties:history.counties.map(c=>({county:c.county,records:{total:{dem_votes:c.dem_votes,rep_votes:c.rep_votes}}}))}});
 const ordinary=envelope(parsed),options={now,samples:900,seed:20261103};
 const withRemaining=async estimate=>envelope(await cache.parse({...record,official_remaining:remaining({estimate})},reference,{now}));
 const small=await withRemaining(100),large=await withRemaining(500000),a=kernel.compile(small,{now}),b=kernel.compile(large,{now});
 assert.equal(a.official_remaining_sensitivity.whole_counties,6);assert.equal(a.official_remaining_sensitivity.assumptions.calibrated,false);
 const historical=kernel.compile(ordinary,{now});assert(a.modeled_remaining_two_party_votes_band[0]<=historical.modeled_remaining_two_party_votes_band[0]);assert(a.modeled_remaining_two_party_votes_band[1]>=historical.modeled_remaining_two_party_votes_band[1],'Sensitivity envelope retains the historical range');
 const changedMap=structuredClone(small);changedMap.remaining_geography.map_relation_2024_to_2026='changed';assert.equal(kernel.compile(changedMap,{now}).logLikelihood(5),historical.logLikelihood(5));
 assert.notEqual(a.logLikelihood(-10)-a.logLikelihood(10),b.logLikelihood(-10)-b.logLikelihood(10),'Source estimates affect the SAME counts likelihood, not a second posterior');
 const low=kernel.condition(model,basis,[small],options),high=kernel.condition(model,basis,[large],options),base=kernel.condition(model,basis,[ordinary],options);
 assert.deepEqual(low.baseline,base.baseline);assert.deepEqual(high.baseline,base.baseline);assert.notDeepEqual(low.result.probabilities,high.result.probabilities);
 for(const x of [low,high]){assert(x.diagnostics.effective_sample_size>=450-1e-6);assert(x.diagnostics.state_likelihood_max_ratio.WA<=20+1e-8);assert.equal(x.diagnostics.used.length,1);}
 const thurston=structuredClone(small);thurston.snapshot.official_remaining.payload.data[0].groups[0].children.find(x=>x.name[0].text==='Thurston County').value=9999999;
 assert.equal(kernel.compile(thurston,{now}).logLikelihood(5),a.logLikelihood(5),'Whole Thurston estimate never substitutes for district part');
 const corrupt=structuredClone(record);corrupt.official_remaining=remaining();corrupt.official_remaining.selected_payload_sha256='bad';const guarded=await cache.parse(corrupt,reference,{now});assert(guarded.live_votes_accepted);assert(!guarded.official_remaining);
 const markedTest=remaining();markedTest.payload.test_data=true;
 const testGuard=await cache.parse({...record,official_remaining:seal(markedTest)},reference,{now});assert(testGuard.live_votes_accepted&&!testGuard.official_remaining);
 const wrongShape=remaining();wrongShape.payload.data={0:wrongShape.payload.data[0],length:1};assert.throws(()=>source.parse(wrongShape,{now,counts_stamp:stamp}),/identity/);
 const badClock=remaining();for(const r of badClock.payload.data[0].groups[0].children)r.lastUpdated=null;
 const excluded=await cache.parse({...record,official_remaining:seal(badClock)},reference,{now});assert(!excluded.official_remaining);assert.equal(kernel.compile(envelope(excluded),{now}).logLikelihood(5),kernel.compile(ordinary,{now}).logLikelihood(5));
 assert.equal(excluded.remaining_revision.status,'NO_USABLE_REMAINING_ESTIMATES');
 assert.throws(()=>source.parse(remaining(),{now:now+31*60000,counts_stamp:stamp}),/Stale/);
 const storageMap=new Map(),storage={getItem:k=>storageMap.get(k),setItem:(k,v)=>storageMap.set(k,v)},rev=source.createRevision({storage});
 const accept=(revision,r)=>revision.accept(r,source.parse(r,{now:Date.parse(r.fetched_at)+1000,counts_stamp:r.fetched_at}));
 accept(rev,remaining());const corrected=remaining({stamp:'2026-11-04T04:08:00Z',estimate:0});accept(source.createRevision({storage}),corrected);
 assert.throws(()=>accept(rev,remaining()),/Older/,'A second tab sees durable newer source metadata');
 const oldFreshReceipt=remaining();oldFreshReceipt.fetched_at='2026-11-04T04:09:00Z';assert.throws(()=>accept(rev,oldFreshReceipt),/Older/);
 assert.throws(()=>accept(rev,remaining({stamp:'2026-11-04T04:08:00Z',estimate:100})),/changed/);
 const nullClock=remaining({stamp:'2026-11-04T04:10:00Z'});for(const r of nullClock.payload.data[0].groups[0].children)r.lastUpdated=null;
 rev.accept(nullClock,source.parse(nullClock,{now:Date.parse('2026-11-04T04:10:01Z'),counts_stamp:nullClock.fetched_at}));
 assert.throws(()=>accept(source.createRevision({storage}),corrected),/receipt/,'A valid empty-clock withdrawal receipt prevents replay of an older cached supplement');
 let previous=null;const writes=[];
 const request=async(method,suffix,data)=>{
  if(method==='GET'&&suffix==='')return {full_name:publisher.REPO,default_branch:'main'};
  if(method==='GET'&&suffix.startsWith('/git/ref/'))return {object:{sha:'existing-data-branch'}};
  if(method==='GET'&&suffix.startsWith('/contents/')){if(previous)return previous;const e=Error('missing');e.status=404;throw e;}
  if(method==='PUT'){assert.equal(data.branch,cache.BRANCH);assert.equal(suffix,'/contents/'+cache.PATH);writes.push(data);previous={sha:'next',content:data.content};return{commit:{sha:'data-only'}};}
  throw Error('Unexpected repository write');
 };
 async function publishAt(minute,estimates){const at='2026-11-04T04:'+minute+':00Z',r=await fixture({stamp:at});r.official_remaining=estimates;await publisher.publish({request,record:r,reference,now:Date.parse(at)+1000});return JSON.parse(Buffer.from(writes.at(-1).content,'base64'));}
 await publishAt('05',remaining());const withdrawn=await publishAt('08',remaining({stamp:'2026-11-04T04:08:00Z',estimate:0}));
 assert.equal(withdrawn.remaining_revision_watermark['53011'].estimated_ballots_left,0);
 const replay=remaining();replay.fetched_at='2026-11-04T04:10:00Z';const guardedReplay=await publishAt('10',replay);
 assert.equal(guardedReplay.official_remaining.payload,null);assert.equal((await cache.parse(guardedReplay,reference,{now:Date.parse('2026-11-04T04:10:02Z')})).live_votes_accepted,true);
 assert.equal(guardedReplay.remaining_revision_watermark['53011'].reported_at,'2026-11-04T04:08:00Z');
 await publishAt('12',remaining({stamp:'2026-11-04T04:12:00Z'}));
 const older=remaining({stamp:'2026-11-04T04:12:00Z'});older.fetched_at='2026-11-04T04:11:00Z';
 const oldReceipt=await publishAt('14',older);assert(oldReceipt.official_remaining.payload===null);assert.match(oldReceipt.official_remaining.error,/Older remaining receipt/);
 assert.equal(oldReceipt.official_remaining.fetched_at,'2026-11-04T04:11:00Z');assert.equal(oldReceipt.official_remaining.rejected_at,'2026-11-04T04:14:01.000Z');
 const stale=await publishAt('50',remaining({stamp:'2026-11-04T04:12:00Z'}));
 assert.equal(stale.official_remaining.fetched_at,'2026-11-04T04:12:00Z','Rejection is not a new source request');assert.equal(stale.official_remaining.rejected_at,'2026-11-04T04:50:01.000Z');
 assert.equal(stale.official_remaining.receipt_kind,'PUBLISHER_VALIDATION_REJECTION');assert(stale.official_remaining.payload===null);
 const staleParsed=await cache.parse(stale,reference,{now:Date.parse('2026-11-04T04:50:02Z')});assert(staleParsed.live_votes_accepted&&!staleParsed.official_remaining&&!staleParsed.remaining_revision);
 const plans=[0,1,2,3].map(i=>publisher.sourceKindForSlot(i,4,record));assert.deepEqual(plans,['counts','remaining','counts','counts']);
 assert.equal(publisher.sourceKindForSlot(0,1,record),'counts');assert.equal(publisher.sourceKindForSlot(1,4,{status:'SOURCE_UNAVAILABLE'}),'counts');
 const savedArgv=process.argv,savedNow=Date.now,savedFetch=global.fetch;let forbiddenRequests=0;
 try{process.argv=['node','publisher','--publish','--bootstrap'];Date.now=()=>Date.parse('2026-10-27T08:00:00Z');global.fetch=async()=>{forbiddenRequests++;throw Error('No pre-election native request allowed');};await publisher.main();}
 finally{process.argv=savedArgv;Date.now=savedNow;global.fetch=savedFetch;}
 assert.equal(forbiddenRequests,0);
 previous=null;const healthAt=Date.parse('2026-10-27T08:00:00Z');
 await publisher.publish({request,reference,now:healthAt,healthOnly:true,record:{...record,fetched_at:new Date(healthAt).toISOString(),status:'SOURCE_UNAVAILABLE',payload:null,official_remaining:remaining()}});
 const healthRecord=JSON.parse(Buffer.from(writes.at(-1).content,'base64'));assert.equal(healthRecord.payload,null);assert.equal(healthRecord.official_remaining,undefined);
 console.log('Synthetic official remaining -> SAME national likelihood, baseline/ESS/state budgets, corruption/null clocks, no Thurston allocation PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
