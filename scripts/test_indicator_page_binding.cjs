'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
let ROOT=__dirname;while(!fs.existsSync(path.join(ROOT,'index.html'))){const next=path.dirname(ROOT);if(next===ROOT)throw Error('Repository root unavailable');ROOT=next;}
const script=name=>path.join(ROOT,'scripts',name),load=name=>JSON.parse(fs.readFileSync(path.join(ROOT,'data',name+'.json'),'utf8'));
const index=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
// The normal portable/CI path extracts ACTUAL tracked page code and module.
// Explicit paths are only useful before root installs this isolated candidate.
function extractFunction(text,name){
 const start=text.indexOf('function '+name+'(');assert(start>=0,'Actual function missing: '+name);
 const open=text.indexOf('{',start);let depth=0,quote=null,line=false,block=false;
 for(let i=open;i<text.length;i++){const c=text[i],n=text[i+1];
  if(line){if(c==='\n')line=false;continue;}if(block){if(c==='*'&&n==='/'){block=false;i++;}continue;}
  if(quote){if(c==='\\'){i++;continue;}if(c===quote)quote=null;continue;}
  if(c==='/'&&n==='/'){line=true;i++;continue;}if(c==='/'&&n==='*'){block=true;i++;continue;}
  if(c==='"'||c==="'"||c==='`'){quote=c;continue;}if(c==='{')depth++;if(c==='}'&&--depth===0)return text.slice(start,i+1);
 }throw Error('Unclosed actual function: '+name);
}
const bindingSource=process.env.TEST_INDICATOR_BINDING_PATH?fs.readFileSync(process.env.TEST_INDICATOR_BINDING_PATH,'utf8'):extractFunction(index,'enIndicatorCollect');
const modulePath=process.env.TEST_INDICATOR_MODULE_PATH||script('election_night_indicator_status.js');
const moduleSource=fs.readFileSync(modulePath,'utf8'),moduleWindow={ElectionNightEarlySignals:require(script('election_night_early_signals.js')),HouseEarlyWatchReference:require(script('house_early_watch_reference.js')),ElectionNightPollClosings2026:require(script('election_night_poll_closings_2026.js'))};
vm.runInNewContext(moduleSource,{window:moduleWindow});const api=moduleWindow.ElectionNightIndicatorStatus;
const NCL=require(script('national_county_likelihood.js')),VA=require(script('virginia_official_cache.js'));
const clone=x=>JSON.parse(JSON.stringify(x)),same=(a,b)=>assert.equal(JSON.stringify(a),JSON.stringify(b));
let groups=0;const check=(name,fn)=>{fn();groups++;};
const start=Date.parse('2026-11-04T03:10:00Z'),stamp='2026-11-04T03:05:00Z';
function envelope(code){
 const stem=code==='VA-02'?'virginia_house_02':'south_carolina';
 const reference=load(stem+'_county_fips_reference'),historical=load(code==='VA-02'?'virginia_house_02_2024_county_baseline_official':'south_carolina_senate_2020_county_baseline_official');
 const baseline={...historical,counties:historical.counties.map(c=>c.records?c:{...c,records:{total:{dem_votes:c.dem_votes,rep_votes:c.rep_votes}}})};
 const total=c=>c.records.total||{dem_votes:c.records.absentee.dem_votes+c.records.election_day.dem_votes,rep_votes:c.records.absentee.rep_votes+c.records.election_day.rep_votes};
 const d=baseline.counties.reduce((n,c)=>n+total(c).dem_votes,0),n=baseline.counties.reduce((n,c)=>n+total(c).dem_votes+total(c).rep_votes,0),mean=100*(2*d/n-1),fips=new Map(reference.counties.map(c=>[c.county,c.fips]));
 const counties=baseline.counties.map(c=>{const t=total(c),n=Math.floor((t.dem_votes+t.rep_votes)*.25),d=Math.round(n*Math.max(.001,Math.min(.999,t.dem_votes/(t.dem_votes+t.rep_votes)+.02)));return {county:c.county,county_fips:fips.get(c.county),dem_votes:d,rep_votes:n-d,other_votes:0};});
 const source_url=code==='VA-02'?'https://enr.elections.virginia.gov/results/public/api/elections/virginia/2026-November-General/data/ballot-item/01000000-f030-c43d-fd71-08df1fee52e7':'https://civicapi.org/api/v2/race/87409';
 return {mean,value:{baseline,reference,baseline_year:code==='VA-02'?2024:2020,snapshot:{race_code:code,source_url,status:'VALIDATED_COUNTY_COUNTS_METHOD_MIX_UNRESOLVED',live_votes_accepted:true,county_identities_matched:reference.counties.length,snapshot_updated_at:stamp,...(code==='VA-02'?{collection_fetched_at:stamp}:{}),counties}}};
}
function setup(){
 const va=envelope('VA-02'),sc=envelope('SC-SEN');
 const s={now:start,visible:true,hidden:false,year:2026,rehearsal:false,pending:false,asof:null,private:false,context:'PUBLIC',modelRevision:'FICTIONAL_PINNED_MODEL',workerRevision:'FICTIONAL_WORKER',shift:0,error:1,options:{independentSenateCredit:'no_credit'},live:{},envelopes:[va.value,sc.value],officialError:false,rawError:false,compileMissing:false,helperMissing:false,inputFailure:false,epoch:0,observed:'',cacheKey:'',frame:null,result:null,rawHook:null,reads:0};
 s.basis={house:[{code:'VA-02',mean:va.mean}],senate:[{code:'SC-SEN',mean:sc.mean}],governors:[],generated_from_sources:{model_polling_at:'2026-10-29T12:00:00Z'}};s.publicBasis=clone(s.basis);
 s.raw={verified:true,provider:'civicAPI',asOf:stamp,total:100000,d:30000,r:68000,precincts:12,stale:false};
 const inputs=()=>{s.reads++;if(s.inputFailure)throw Error('FICTIONAL_VALIDATION_FAILURE');
  // The page owns full typed/native admission. This focused boundary fixture
  // reuses the ACTUAL receipt rule to model a collector-stall expiry while the
  // less strict actual county compiler would still accept the native stamp.
  const envelopes=s.envelopes.filter(e=>e.snapshot.race_code!=='VA-02'||!s.officialError&&VA.receiptCurrent(e.snapshot.collection_fetched_at,s.now)===true);
  return {now:s.now,live:clone(s.live),rows:[],descriptive:[],envelopes,eligibility:envelopes.map(e=>{try{NCL.compile(e,{now:s.now});return [e.snapshot.race_code,true];}catch{return [e.snapshot.race_code,false];}})};};
 const key=i=>{const raw=JSON.stringify([s.modelRevision,s.workerRevision,s.basis,s.private?s.publicBasis:null,s.context,s.shift,s.error,s.options,i.live,i.eligibility,i.envelopes.map(e=>e.snapshot)]);if(raw!==s.observed){s.observed=raw;s.epoch++;}return 'MODEL_FRAME:'+s.epoch;};
 const sandbox={console,structuredClone,Date:class extends Date{static now(){return s.now;}},document:{get hidden(){return s.hidden;}},window:{get ElectionNightIndicatorStatus(){return s.helperMissing?null:api;},get NationalCountyLikelihood(){return s.compileMissing?null:NCL;}},
  jointUsesPrivateContext:()=>s.private,enIsVisible:()=>s.visible,jointValidatedFrameInputs:inputs,jointFrameKey:key,jointModelCodeRevision:()=>s.modelRevision,
  jointMarginSummaryCodes:()=>api.records.map(row=>row.code),jointShadowExpanded:()=>false,jointCorrelationExpanded:()=>false,
  jointRecordedCodeRevision:()=> 'FICTIONAL_RECORDED_CODE',jointCountSnapshotContext:()=> 'FICTIONAL_SOURCE_CONTEXT',jointHistoryRevision:()=> 'FICTIONAL_HISTORY',jointCountSnapshotOptions:()=>({}),
  enWatchParse:code=>{const row=api.records.find(row=>row.code===code);return row?{office:row.office,key:row.key}:null;},
  enEarlyLiveObservation:item=>{if(s.rawHook)s.rawHook(item);return {source:item.key==='KY-06'?clone(s.raw):null,error:s.rawError};}};
 const getters={enModeYear:'year',enRehearsalActive:'rehearsal',jointModelPending:'pending',jointAsOfSnapshot:'asof',jointCompletedFrame:'frame',jointCacheKey:'cacheKey',jointBasis:'basis',jointBasisPublic:'publicBasis',jointLastResult:'result',jointNationalShift:'shift',jointErrorMultiplier:'error',jointIndependentControlOptions:'options'};
 for(const [global,name]of Object.entries(getters))Object.defineProperty(sandbox,global,{get:()=>s[name]});
 const context=vm.createContext(sandbox);vm.runInContext(extractFunction(index,'jointFrameSnapshot')+'\n'+bindingSource,context);
 s.collect=()=>context.enIndicatorCollect();
 s.accept=()=>{const i=inputs(),k=key(i);s.frame=context.jointFrameSnapshot(i,k);s.cacheKey=k;
  // Obtain diagnostic rows from the actual kernel coordinator, rather than
  // manually inventing its used metadata. The sampler is a declared fixed
  // 3000-particle numerical fixture: no production model RNG or forecast proof.
  const sampler={simulate:(basis,args)=>{const result={samples:3000,probabilities:{red_dawn:25,shrug:25,blue_wave:25,blue_tsunami:25}};
   if(args.captureCountyDraws)result.county_draws={seeds:Uint32Array.from({length:3000},(_,i)=>i+1),margins:Object.fromEntries(args.captureCountyDraws.map(code=>[code,Float64Array.from({length:3000},()=>basis.house.concat(basis.senate).find(row=>row.code===code).mean)]))};return result;}};
  const args={...s.frame.payload.args,live:{}};
  s.result=NCL.condition(sampler,s.basis,i.envelopes,args).result;
 };
 s.accept();return s;
}
check('actual production snapshot plus actual kernel used metadata admits uncalled pattern',()=>{
 const s=setup(),before=JSON.stringify([s.basis,s.envelopes,s.frame]);const got=s.collect();assert.equal(got.current,true);assert.equal(got.active,true);assert.equal(got.rows.length,32);assert.equal(got.summary.stage,'STORM_BREWING');assert.equal(got.context,'PUBLIC');
 for(const code of ['VA-02','SC-SEN']){const r=got.rows.find(row=>row.code===code);assert(r.matched);assert.equal(r.calledParty,null);assert.equal(r.matched.source_at,stamp);}
 assert.equal(JSON.stringify([s.basis,s.envelopes,s.frame]),before);assert.equal(s.frame.payload.args.samples,3000);
});
check('current raw6pm candidates remain raw without invented matched geography',()=>{const s=setup(),r=s.collect().rows.find(row=>row.code==='KY-06');assert.equal(r.status,'RAW_RETURNS_ONLY');assert(r.raw);assert.equal(r.matched,null);});
check('pending and ASOF suppress weather but keep freshly validated source-call labels',()=>{
 for(const kind of ['pending','asof']){const s=setup();s.live={'VA-02':{mode:'source_called',winnerParty:'D',asOf:stamp}};s.accept();if(kind==='pending')s.pending=true;else s.asof={state:'AS_OF'};
  const got=s.collect(),r=got.rows.find(row=>row.code==='VA-02');assert.equal(got.current,false);assert.equal(r.matched,null);assert.equal(r.calledParty,'D');assert.equal(r.status,'VALIDATED_CALL');assert.equal(got.summary.stage,'AWAITING_MATCHED_SIGNALS');}
});
check('accepted called row retains its actual current matched comparison',()=>{const s=setup();s.live={'VA-02':{mode:'source_called',winnerParty:'D',asOf:stamp}};s.accept();const got=s.collect();assert.equal(got.current,true);assert.equal(got.summary.stage,'STORM_BREWING');assert.equal(got.rows.find(row=>row.code==='VA-02').status,'VALIDATED_CALL');});
check('call retraction and corrected winner are fresh ledger labels while model catches up',()=>{
 const s=setup();s.live={'VA-02':{mode:'source_called',winnerParty:'D',asOf:stamp}};s.accept();s.live={};let got=s.collect();assert.equal(got.current,false);assert.equal(got.rows.find(row=>row.code==='VA-02').calledParty,null);
 s.live={'VA-02':{mode:'source_called',winnerParty:'R',asOf:stamp}};got=s.collect();assert.equal(got.current,false);assert.equal(got.rows.find(row=>row.code==='VA-02').calledParty,'R');assert.equal(got.summary.stage,'AWAITING_MATCHED_SIGNALS');
});
check('same-clock count correction cannot reuse completed evidence',()=>{const s=setup();s.envelopes[0].snapshot.counties[0].dem_votes--;const got=s.collect();assert.equal(got.current,false);assert.equal(got.summary.stage,'AWAITING_MATCHED_SIGNALS');assert(got.rows.every(row=>row.matched===null));});
check('baseline or reference mutation invisible to source snapshot key still fails full binding',()=>{
 for(const change of [s=>s.envelopes[0].baseline.counties[0].records.total.dem_votes++,s=>s.envelopes[0].reference.counties[0].county+=' changed']){const s=setup();change(s);const got=s.collect();assert.equal(got.current,false);assert(got.rows.every(row=>row.matched===null));}
});
check('actual VA receipt expiry suppresses old matched row despite native compiler acceptance',()=>{const s=setup();s.now=Date.parse(stamp)+15*60000+1;assert.equal(VA.receiptCurrent(stamp,s.now),false);assert.doesNotThrow(()=>NCL.compile(s.envelopes[0],{now:s.now}));const got=s.collect();assert.equal(got.current,false);assert(got.rows.every(row=>row.matched===null));});
check('native expiry and official source failure clear current stage',()=>{
 for(const change of [s=>s.now=Date.parse(stamp)+180*60000+1,s=>s.officialError=true]){const s=setup();change(s);const got=s.collect();assert.equal(got.current,false);assert.equal(got.summary.stage,'AWAITING_MATCHED_SIGNALS');}
});
check('independently healthy official source survives raw provider outage only',()=>{const s=setup();s.rawError=true;const got=s.collect();assert.equal(got.current,true);const va=got.rows.find(row=>row.code==='VA-02'),sc=got.rows.find(row=>row.code==='SC-SEN');assert(va.matched);assert.equal(va.raw_source_unavailable,true);assert.equal(sc.status,'SOURCE_ERROR');assert.equal(got.summary.stage,'LOCAL_OVERPERFORMANCE');});
check('private/public contexts bind separate captured basis and expectations',()=>{const s=setup();s.private=true;s.context='LOCAL_RESEARCH_VARIANT';s.basis=clone(s.basis);s.basis.private_imported_context=true;s.basis.house[0].mean-=.5;assert.equal(s.collect().current,false);s.accept();let got=s.collect();assert.equal(got.current,true);assert.equal(got.context,'LOCAL_RESEARCH_VARIANT');assert.notEqual(got.rows.find(row=>row.code==='VA-02').matched.expectation_margin_points,s.publicBasis.house[0].mean);
 s.publicBasis.house[0].mean++;got=s.collect();assert.equal(got.current,false);assert(got.rows.every(row=>row.matched===null));});
check('settings/model revision/context/sample option mismatch cannot retain matched authority',()=>{
 for(const change of [s=>s.shift=1,s=>s.error=1.2,s=>s.modelRevision+='new',s=>s.frame.contextKey='LOCAL_RESEARCH_VARIANT',s=>s.frame.payload.args.samples=900,s=>s.frame.payload.args.unknown_option=true,s=>s.frame.input_at='2026-11-04T03:00:00Z']){const s=setup();change(s);const got=s.collect();assert.equal(got.current,false);assert(got.rows.every(row=>row.matched===null));}
});
check('corrupted accepted diagnostic fails exact actual recomputation',()=>{const s=setup();s.result.county_results_update.used[0].matched_performance.difference_margin_scenarios[0]++;const got=s.collect();assert.equal(got.current,false);assert(got.rows.every(row=>row.matched===null));});
check('hidden/archive/rehearsal/nonvisible contexts suppress all source and matched rows',()=>{
 for(const change of [s=>s.hidden=true,s=>s.year=2024,s=>s.rehearsal=true,s=>s.visible=false]){const s=setup();change(s);const got=s.collect();assert.equal(got.active,false);assert.equal(got.current,false);assert(got.rows.every(row=>row.status==='INACTIVE'&&row.calledParty===null&&row.matched===null));}
});
check('missing helper/compiler or current-input failure is failclosed',()=>{
 const s=setup();s.compileMissing=true;assert.equal(s.collect().current,false);s.compileMissing=false;s.inputFailure=true;const got=s.collect();assert.equal(got.current,false);assert(got.rows.every(row=>row.matched===null));
 s.inputFailure=false;s.helperMissing=true;const missing=s.collect();assert.equal(missing.current,false);assert.equal(missing.rows.length,0);assert.equal(missing.summary,null);
});
check('reentrant source or context change never returns earlier positive stage or call',()=>{
 for(const change of [s=>s.live={'VA-02':{mode:'source_called',winnerParty:'R',asOf:stamp}},s=>{s.private=true;s.context='LOCAL_RESEARCH_VARIANT';},s=>s.visible=false,s=>s.now=Date.parse(stamp)+15*60000+1]){const s=setup();let once=false;s.rawHook=()=>{if(!once){once=true;change(s);}};const got=s.collect();assert.equal(got.current,false);assert(got.rows.every(row=>row.matched===null&&row.calledParty===null));assert.equal(got.summary.stage,'AWAITING_MATCHED_SIGNALS');}
});
check('return boundary contains no frame/basis/raw envelope/private input persistence',()=>{const s=setup(),got=s.collect();same(Object.keys(got).sort(),['active','context','current','now','rows','summary']);assert(!/typed_usage|native_usage|dem_votes|rep_votes|private_imported_context|logLikelihood|describePerformance|"basis"|"envelopes"/.test(JSON.stringify(got)));});
const out=process.env.TEST_ARTIFACT_DIR||path.join(ROOT,'artifacts/readiness/early-indicator-binding');fs.mkdirSync(out,{recursive:true});
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
fs.writeFileSync(path.join(out,'proof.json'),JSON.stringify({status:'PASS',groups,binding_sha256:hash(bindingSource),module_sha256:hash(moduleSource),production_frame_function_sha256:hash(extractFunction(index,'jointFrameSnapshot')),actual_tracked_binding:!process.env.TEST_INDICATOR_BINDING_PATH,actual_tracked_module:!process.env.TEST_INDICATOR_MODULE_PATH,
 actual_kernel_compile_and_condition:true,actual_production_frame_constructor:true,fixed_sampler_particles:3000,production_model_rng_draws:0,source_requests:0,private_values_persisted:false,
 scope:'Page-coordinator binding and admission boundary; fixture sampler is not a forecast/calibration or full browser proof'},null,2)+'\n');
console.log('Actual-page early-indicator current-frame binding PASS ('+groups+' groups; actual kernel diagnostics and production frame; no source requests)');
