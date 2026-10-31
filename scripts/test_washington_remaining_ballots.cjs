'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {inspect:inspectSource}=require('./inspect_washington_remaining_ballots.cjs');
const c=require('../data/washington_county_remaining_source_contract.json');
const inspect=(input,now)=>inspectSource(input,now,c.source_url);
const raw=fs.readFileSync(c.original_file);assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),c.original_sha256);
const actual=JSON.parse(raw),now=Date.parse('2026-11-04T04:20:00Z');
assert.throws(()=>inspectSource(actual,now,c.source_url.replace('20261103','20241105')));
assert.throws(()=>inspectSource(actual,now));
let result=inspect(actual,now);assert.equal(result.counties.length,39);assert.equal(result.wa03.length,7);
assert(result.counties.every(x=>x.reported_estimate===0&&!x.review_eligible&&x.exclusion_reason==='MISSING_OR_INVALID_REPORT_CLOCK'));
// Entirely SYNTHETIC later snapshots exercise semantics, not actual delivery.
function fixture(){const d=structuredClone(actual);for(const x of d.data[0].groups[0].children){x.value=123;x.lastUpdated='2026-11-04T04:10:00Z';}return d;}
const mutate=fn=>{const d=fixture();fn(d.data[0].groups[0].children,d);return d;};
result=inspect(fixture(),now);assert(result.wa03.every(x=>x.review_eligible&&x.scope==='WHOLE_COUNTY_ESTIMATE_NOT_DISTRICT_PART'&&!x.may_move_national_needle));assert.equal(result.may_move_national_needle,false);
assert(inspect(fixture(),Date.parse('2026-11-04T03:00:00Z')).counties.every(x=>!x.review_eligible));
for(const [at,reason] of [[null,'MISSING_OR_INVALID_REPORT_CLOCK'],['2026-11-31T04:10:00Z','MISSING_OR_INVALID_REPORT_CLOCK'],['2026-11-04T03:59:59Z','PRE_CLOSE'],['2026-11-04T04:30:00Z','FUTURE_CLOCK'],['2026-11-04T04:00:00Z','STALE_REPORT_CLOCK']]){
 const clock=reason==='STALE_REPORT_CLOCK'?now+1800000:now;
 assert.equal(inspect(mutate(a=>a[0].lastUpdated=at),clock).counties[0].exclusion_reason,reason);
}
for(const fn of [a=>a.pop(),a=>a[1]=structuredClone(a[0]),a=>a[0].id='unknown',a=>a[0].name[0].text='Clark County',a=>a[0].value=-1,a=>a[0].value=.5,a=>a[0].children=[],(a,d)=>d.data[0].id='other-statistic'])assert.throws(()=>inspect(mutate(fn),now));
const zero=inspect(mutate(a=>a[0].value=0),now).counties[0];assert(zero.review_eligible&&!zero.may_move_national_needle); // A timestamped zero is still no final-call or district inference.
assert.deepEqual(inspect(mutate(a=>a.reverse()),now).wa03.map(x=>x.county_fips).sort(),c.wa03_county_fips.slice().sort());
const wa03=require('../data/washington_house_03_county_fips_reference.json').counties;
assert.deepEqual(c.wa03_county_fips.slice().sort(),wa03.map(x=>x.fips).sort());
for(const x of wa03)assert(c.counties.some(p=>p.county_fips===x.fips&&p.name===x.county+' County'));
console.log('PASS: actual null-clock template excluded; synthetic clock/matrix/identity/estimate checks; no district allocation/model admission');

// Source-shaped synthetic optional-supplement regressions. No fetch, collector,
// Worker, condition() simulation or ignored artifact dependency is used here.
(async()=>{
 const path=require('node:path'),zlib=require('node:zlib');
 const countSource=require('./washington_official_house_source.js'),cache=require('./washington_official_cache.js'),kernel=require('./national_county_likelihood.js');
 const reference=require('../data/washington_house_03_county_fips_reference.json'),history=require('../data/washington_house_03_2024_county_baseline_official.json');
 const geometry={...require('../data/washington_house_03_remaining_geography.json'),...require('../data/house_geography_bridge.json').districts.find(r=>r.race_code_2026==='WA-03')};
 const stamp='2026-11-04T04:20:00Z',at=Date.parse(stamp)+1000,hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
 const full=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'../data/washington_historical_sources/2026-official-wa03-preclose-sample.json.gz'))));
 full.election.asOf=stamp;full.election.publishDate=stamp;const b=full.ballotItemWithBreakdown;
 for(const row of b.breakdownResults){const h=history.counties.find(r=>r.county+' County'===row.locality.name[0].text);assert(h);for(const p of row.ballotOptions)p.voteCount=p.nativeId==='1601892'?Math.floor(h.dem_votes*.65):p.nativeId==='1601893'?Math.floor(h.rep_votes*.65):0;row.voteTotal=row.ballotOptions.reduce((n,p)=>n+p.voteCount,0);}
 for(const p of b.summaryResults.ballotOptions)p.voteCount=b.breakdownResults.reduce((n,row)=>n+row.ballotOptions.find(x=>x.nativeId===p.nativeId).voteCount,0);b.voteTotal=b.summaryResults.ballotOptions.reduce((n,p)=>n+p.voteCount,0);const overview=full.ballotItems.find(x=>x.id===b.id);overview.voteTotal=b.voteTotal;overview.summaryResults=structuredClone(b.summaryResults);
 // Same original-object selection as the production collector, then an
 // independent native-parser equivalence check; no normalized count injection.
 const payload={jurisdiction:{shortName:full.jurisdiction.shortName},election:Object.fromEntries(['id','name','electionDate','isPrimary','isProduction','isOfficialResults','asOf','publishDate'].map(k=>[k,full.election[k]])),ballotItems:full.ballotItems.filter(x=>x.id===b.id),ballotItemWithBreakdown:b};
 const parsed=countSource.parse(payload,reference,{now:at});assert.deepEqual(parsed,countSource.parse(full,reference,{now:at}));assert.equal(parsed.live_votes_accepted,true);
 const counts={schema:'official-wa03-collection-v1',source_url:countSource.URL,fetched_at:stamp,may_move_national_needle:false,status:parsed.status,http_status:200,source_test_data:false,payload,selected_payload_sha256:hash(payload),snapshot_updated_at:parsed.snapshot_updated_at,source_published_at:parsed.source_published_at};
 function estimate(){const d=structuredClone(actual);for(const row of d.data[0].groups[0].children){row.lastUpdated=stamp;row.value=10000;}return{schema:'official-wa-remaining-collection-v1',source_url:c.source_url,fetched_at:stamp,http_status:200,status:'COLLECTED_OFFICIAL_ESTIMATES',payload:d,selected_payload_sha256:hash(d)};}
 const baseline=await cache.parse(counts,reference,{now:at}),withEstimate=await cache.parse({...counts,official_remaining:estimate()},reference,{now:at});assert.equal(baseline.live_votes_accepted,true);assert.equal(withEstimate.official_remaining!==undefined,true);assert.equal(withEstimate.remaining_revision.counties.length,6);
 const nodes={payload:r=>r.payload,statistic:r=>r.payload.data[0],group:r=>r.payload.data[0].groups[0],whole_county:r=>r.payload.data[0].groups[0].children.find(x=>x.name[0].text==='Clark County'),other_county:r=>r.payload.data[0].groups[0].children.find(x=>x.name[0].text==='Adams County')};
 // Known negative markers are independently grounded in the installed official
 // Washington counts parser; expected cases do not read the new helper branch.
 const negatives=[['test_data',true],['mock',true],['is_test',true],['test',true],['is_mock',true],['isTest',true],['isProduction',false]];let representative=null;
 for(const [scope,node]of Object.entries(nodes))for(const[key,value]of negatives){const r=estimate();node(r)[key]=value;r.selected_payload_sha256=hash(r.payload);const guarded=await cache.parse({...counts,official_remaining:r},reference,{now:at});const label=scope+'.'+key;assert.equal(guarded.live_votes_accepted,true,label+' keeps valid counts');assert.equal(guarded.official_remaining,undefined,label+' rejects optional estimate');assert.equal(guarded.remaining_revision,undefined,label+' does not mint accepted used cells');assert(guarded.remaining_status.startsWith('REMAINING_EXCLUDED: Explicit test/unverified remaining source'),label);assert.deepEqual(guarded.counties,baseline.counties,label+' preserves exact native count rows');assert.equal(guarded.collection_selected_payload_sha256,baseline.collection_selected_payload_sha256,label+' preserves count integrity');assert.equal(guarded.snapshot_updated_at,baseline.snapshot_updated_at);assert.equal(guarded.source_published_at,baseline.source_published_at);if(scope==='group'&&key==='test_data')representative=guarded;}
 const positive=estimate();for(const node of [positive.payload,positive.payload.data[0],positive.payload.data[0].groups[0],...positive.payload.data[0].groups[0].children]){node.isProduction=true;for(const[k]of negatives)if(k!=='isProduction')node[k]=false;}positive.payload.isOfficialResults=false;positive.selected_payload_sha256=hash(positive.payload);assert.equal((await cache.parse({...counts,official_remaining:positive},reference,{now:at})).remaining_revision.counties.length,6,'Affirmative/unofficial metadata is not a negative marker');
 const inherited=estimate();inherited.payload.mock=true;for(const row of inherited.payload.data[0].groups[0].children){row.mock=false;row.isProduction=true;}inherited.selected_payload_sha256=hash(inherited.payload);assert.equal((await cache.parse({...counts,official_remaining:inherited},reference,{now:at})).official_remaining,undefined,'A negative ancestor cannot be cancelled by affirmative children');
 const envelope=snapshot=>({snapshot,reference,remaining_geography:geometry,baseline_year:2024,baseline:{race_code:'WA-03',geography_scope:'district_parts',counties:history.counties.map(row=>({county:row.county,records:{total:{dem_votes:row.dem_votes,rep_votes:row.rep_votes}}}))}});
 const ordinary=kernel.compile(envelope(baseline),{now:at}),fallback=kernel.compile(envelope(representative),{now:at});assert.equal(fallback.official_remaining_sensitivity,undefined);assert.equal(fallback.counted_two_party_votes,ordinary.counted_two_party_votes);assert.equal(fallback.modeled_remaining_two_party_votes,ordinary.modeled_remaining_two_party_votes);assert.deepEqual(fallback.modeled_remaining_two_party_votes_band,ordinary.modeled_remaining_two_party_votes_band);for(const margin of [-5,0,5])assert.equal(fallback.logLikelihood(margin),ordinary.logLikelihood(margin),'Actual counts likelihood uses unchanged historical fallback');
 console.log('PASS: nested known WA test/nonproduction flags excluded through checksum/native/cache path; counts and historical likelihood unchanged; no simulated draws or native requests');
})().catch(error=>{console.error(error);process.exitCode=1;});
