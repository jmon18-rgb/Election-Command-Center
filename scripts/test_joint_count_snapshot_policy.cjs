'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const policy=require('./joint_count_snapshot_policy.js'),kernel=require('./national_county_likelihood.js');
const now=Date.parse('2026-11-04T04:10:00Z'),clone=structuredClone,iso=t=>new Date(t).toISOString();
const envelopes=[require('./ohio_test_fixture.cjs').envelope(12,now),require('./michigan_house_07_test_fixture.cjs').envelope(12,now),require('./nebraska_test_fixture.cjs').envelope(12,now)];
for(const envelope of envelopes)envelope.snapshot.snapshot_updated_at=iso(now-60000);
const basis=require('./fictional_call_basis.cjs')({largeBags:true});
function frame(){return {key:'MODEL_FRAME:1',contextKey:'LOCAL_RESEARCH_VARIANT',modelRevision:'FICTIONAL_STATIC_REVISION',frameKind:'LIVE',
 countContext:'FICTIONAL_UNCHANGED_NONCOUNT_FEEDS_2026',sourceRows:[],descriptiveRows:[],historyRevision:'FICTIONAL_HISTORY_REVISION',pollingAt:'2026-10-29T00:00:00Z',
 payload:{basis:clone(basis),publicBasis:clone(basis),envelopes:clone(envelopes),variants:[{id:'house_shadow',basis:clone(basis)},{id:'presidential_shadow',basis:clone(basis)}],
 args:{samples:3000,seed:20261103,now,contextKey:'LOCAL_RESEARCH_VARIANT',independentSenateCredit:'no_credit',nationalShift:0,errorMultiplier:1,
  marginSummaryCodes:['OH-SEN','MI-07','NE-SEN'],live:{'IA-SEN':{mode:'source_called',winnerParty:'D',source:'civicAPI',asOf:iso(now-60000)}}}}};}
function classify(a,b,clock=now){return policy.classify(a,b,{now:clock,validateEnvelope:(envelope,currentNow)=>kernel.compile(envelope,{now:currentNow})});}
function bump(input,code,clock=now,field,delta=17){const next=clone(input),snapshot=next.payload.envelopes.find(row=>row.snapshot.race_code===code).snapshot;
 const key=field||(code==='NE-SEN'?'osborn_votes':'dem_votes');snapshot.counties[0][key]+=delta;snapshot.snapshot_updated_at=iso(clock);
 if(code==='NE-SEN')snapshot.candidates.find(row=>row.provider_id===(key==='osborn_votes'?220706:220702)).votes+=delta;
 next.payload.args.now=clock;next.key+=':NEXT';return next;}
const cases=[];
function check(name,fn){fn();cases.push(name);}
function hardMutation(name,mutate){check(name,()=>{const a=frame(),b=bump(a,'OH-SEN');mutate(b,a);assert.equal(classify(a,b).kind,'HARD_INVALIDATION');});}
check('actual installed civic admission accepts monotone OH and unchanged atomic PUBLIC',()=>{const a=frame(),b=bump(a,'OH-SEN');assert.equal(classify(a,b).kind,'MONOTONE_COUNTS_ONLY');});
check('same snapshot still requires current installed validation',()=>{const a=frame();assert.equal(classify(a,a).kind,'MONOTONE_COUNTS_ONLY');assert.equal(classify(a,a,now+181*60000).kind,'HARD_INVALIDATION');});
check('six legal staggered updates keep all count prefixes compatible',()=>{const initial=frame();let previous=initial;const last=new Map();
 for(let i=0;i<6;i++){const clock=now+(i+1)*20000,code=['OH-SEN','MI-07','NE-SEN'][i%3];if(last.has(code))assert.equal(clock-last.get(code),60000);last.set(code,clock);
  const next=bump(previous,code,clock);assert.equal(classify(previous,next,clock).kind,'MONOTONE_COUNTS_ONLY');assert.equal(classify(initial,next,clock).kind,'MONOTONE_COUNTS_ONLY');previous=next;}
});
check('clock-only refresh preserves an identical counted vector',()=>{const a=frame(),b=clone(a);b.payload.envelopes[0].snapshot.snapshot_updated_at=iso(now);assert.equal(classify(a,b).kind,'MONOTONE_COUNTS_ONLY');});
check('new votes in an already matched previously zero county are monotone',()=>{const a=frame();a.payload.envelopes[0].snapshot.counties[0].dem_votes=0;const b=bump(a,'OH-SEN');assert.equal(classify(a,b).kind,'MONOTONE_COUNTS_ONLY');});
check('NE named Independent votes remain named and do not change caucus policy',()=>{const a=frame(),b=bump(a,'NE-SEN');assert.equal(classify(a,b).kind,'MONOTONE_COUNTS_ONLY');assert.equal(b.payload.args.independentSenateCredit,'no_credit');assert(!Object.hasOwn(b.payload.envelopes[2].snapshot.counties[0],'dem_votes'));});
check('NE all three individual other candidates may increase with reconciled totals',()=>{const a=frame(),b=clone(a),snapshot=b.payload.envelopes[2].snapshot,row=snapshot.counties[0];
 for(const person of row.other_candidates){person.votes+=3;snapshot.candidates.find(x=>x.provider_id===person.provider_id).votes+=3;row.other_votes+=3;}snapshot.snapshot_updated_at=iso(now);assert.equal(classify(a,b).kind,'MONOTONE_COUNTS_ONLY');});
hardMutation('one candidate decrease is a correction even if total votes increase',b=>{const row=b.payload.envelopes[0].snapshot.counties[0];row.rep_votes--;row.dem_votes+=100;});
hardMutation('NE one other candidate decrease cannot hide under increasing all-other sum',b=>{const snapshot=b.payload.envelopes[2].snapshot,row=snapshot.counties[0];row.other_candidates[0].votes--;row.other_candidates[1].votes+=20;row.other_votes+=19;
 snapshot.candidates.find(x=>x.provider_id===row.other_candidates[0].provider_id).votes--;snapshot.candidates.find(x=>x.provider_id===row.other_candidates[1].provider_id).votes+=20;snapshot.snapshot_updated_at=iso(now);});
hardMutation('NE statewide candidate totals must still equal all matched counties',b=>{b.payload.envelopes[2].snapshot.candidates[0].votes++;});
hardMutation('NE candidate provider identity changed',b=>{b.payload.envelopes[2].snapshot.counties[0].other_candidates[0].provider_id=99999;});
hardMutation('NE candidate name changed',b=>{b.payload.envelopes[2].snapshot.candidates[0].name='Fictional replacement';});
hardMutation('NE candidate party changed',b=>{b.payload.envelopes[2].snapshot.candidates[0].party='Democratic';});
hardMutation('NE Democratic alias is never accepted',b=>{b.payload.envelopes[2].snapshot.counties[0].dem_votes=1;});
hardMutation('NE contrast or caucus flags changed',b=>{b.payload.envelopes[2].snapshot.caucus_credit_assumed=true;});
hardMutation('county geometry changed',b=>{b.payload.envelopes[0].snapshot.counties[0].county_fips='39000';});
hardMutation('county names changed',b=>{b.payload.envelopes[0].snapshot.counties[0].county='Unknown';});
hardMutation('county order changed rather than pretending old transport order',b=>{b.payload.envelopes[0].snapshot.counties.reverse();});
hardMutation('historical baseline changed',b=>{b.payload.envelopes[0].baseline.counties[0].records.total.dem_votes++;});
hardMutation('independent geography reference changed',b=>{b.payload.envelopes[0].reference.counties[0].county='Unknown';});
hardMutation('method identity changed',b=>{b.payload.envelopes[0].snapshot.counties[0].vote_method='election_day';});
hardMutation('unreviewed per-method cells fail closed',b=>{b.payload.envelopes[0].snapshot.counties[0].methods={ElectionDay:{dem_votes:1,rep_votes:1,other_votes:0}};});
hardMutation('unknown snapshot metadata is not silently admitted',b=>{b.payload.envelopes[0].snapshot.unknown_source_flag=true;});
hardMutation('source URL changed',b=>{b.payload.envelopes[0].snapshot.source_url+='?alternate=1';});
hardMutation('route withdrawn',b=>{b.payload.envelopes.pop();});
hardMutation('route added',b=>{b.payload.envelopes.push(clone(b.payload.envelopes[0]));});
hardMutation('route order changed',b=>{b.payload.envelopes.reverse();});
hardMutation('source stamp rollback',b=>{b.payload.envelopes[0].snapshot.snapshot_updated_at=iso(now-120000);});
hardMutation('changed vector under identical publication stamp',b=>{b.payload.envelopes[0].snapshot.snapshot_updated_at=iso(now-60000);});
hardMutation('future publication rejected by actual installed validator',b=>{b.payload.envelopes[0].snapshot.snapshot_updated_at=iso(now+16*60000);});
check('old used frame expiry is checked now even if latest snapshot is fresh',()=>{const a=frame(),clock=now+181*60000,b=bump(a,'OH-SEN',clock);
 for(const envelope of b.payload.envelopes)envelope.snapshot.snapshot_updated_at=iso(clock);assert.equal(classify(a,b,clock).kind,'HARD_INVALIDATION');});
check('installed exact expiry boundary before and at180min remains valid; after it is hard',()=>{const a=frame(),limit=Date.parse(a.payload.envelopes[0].snapshot.snapshot_updated_at)+180*60000;
 for(const offset of [-1,0,1]){const clock=limit+offset,b=bump(a,'OH-SEN',clock);for(const envelope of b.payload.envelopes)envelope.snapshot.snapshot_updated_at=iso(clock);
  assert.equal(classify(a,b,clock).kind,offset<=0?'MONOTONE_COUNTS_ONLY':'HARD_INVALIDATION');}
});
for(const [name,mutate]of [
 ['new call',b=>{b.payload.args.live['OH-SEN']={mode:'source_called',winnerParty:'R',source:'civicAPI',asOf:iso(now)};}],
 ['call retraction',b=>{b.payload.args.live={};}],['call correction',b=>{b.payload.args.live['IA-SEN'].winnerParty='R';}],
 ['call source version',b=>{b.payload.args.live['IA-SEN'].asOf=iso(now);}],['private basis',b=>{b.payload.basis.senate[0].mean+=1;}],
 ['PUBLIC basis',b=>{b.payload.publicBasis.house[0].mean+=1;}],['private context',b=>{b.contextKey='PUBLIC';}],
 ['model revision',b=>{b.modelRevision+=':NEW';}],['settings',b=>{b.payload.args.nationalShift=1;}],
 ['draw policy',b=>{b.payload.args.samples=900;}],['random seed',b=>{b.payload.args.seed++;}],
 ['Independent credit',b=>{b.payload.args.independentSenateCredit='D';}],['variant order',b=>{b.payload.variants.reverse();}],
 ['variant basis',b=>{b.payload.variants[0].basis.house[0].mean++;}],['history revision',b=>{b.historyRevision+=':NEW';}],
 ['polling version',b=>{b.pollingAt=iso(now);}],['noncounty feeds or hidden/reload boundary',b=>{b.countContext+=':NEW';}],
 ['source reading',b=>{b.sourceRows.push({race_code:'OH-SEN'});}],['descriptive reading',b=>{b.descriptiveRows.push({race_code:'OH-SEN'});}],
 ['archive',b=>{b.frameKind='POLLING_ARCHIVE_BASELINE';}],['rehearsal',b=>{b.payload.args.rehearsal=true;}],
 ['clock rollback',b=>{b.payload.args.now=now-1;}],['future browser clock',b=>{b.payload.args.now=now+1;}]
])hardMutation(name+' hard-invalidates the whole atomic model frame',mutate);
check('official WA and VA routes explicitly retain hard path without invented receipt TTL',()=>{for(const code of ['WA-03','VA-02']){const a=frame(),b=clone(a);a.payload.envelopes[0].snapshot.race_code=b.payload.envelopes[0].snapshot.race_code=code;
 const result=classify(a,b);assert.equal(result.kind,'HARD_INVALIDATION');assert.equal(result.reason,'SOURCE_REQUIRES_HARD_REFRESH');}});
hardMutation('supplemental remaining source is outside this scheduling slice',b=>{b.payload.envelopes[0].snapshot.official_remaining={};});
check('unknown route cannot be blessed by a missing or replacement validator',()=>{const a=frame();a.payload.envelopes[0].snapshot.race_code='UNKNOWN-SEN';assert.equal(policy.classify(a,a,{now,validateEnvelope:()=>({})}).kind,'HARD_INVALIDATION');});
check('validator is required and both old/new are validated at the same current clock',()=>{const a=frame(),b=bump(a,'OH-SEN'),seen=[];
 const result=policy.classify(a,b,{now,validateEnvelope:(envelope,currentNow)=>{seen.push([envelope,currentNow]);return kernel.compile(envelope,{now:currentNow});}});assert.equal(result.kind,'MONOTONE_COUNTS_ONLY');assert.equal(seen.length,6);assert.strictEqual(seen[0][0],a.payload.envelopes[0]);assert.strictEqual(seen[1][0],b.payload.envelopes[0]);assert(seen.every(([,currentNow])=>currentNow===now));
 assert.equal(policy.classify(a,b,{now}).kind,'HARD_INVALIDATION');for(const validateEnvelope of [()=>false,()=>Promise.resolve({}),()=>{throw Error('Fictional admission failure');}])assert.equal(policy.classify(a,b,{now,validateEnvelope}).kind,'HARD_INVALIDATION');});
check('nonfinite, buffers, cycles and accessors fail closed without invoking getters',()=>{const a=frame();
 for(const value of [NaN,new Float64Array([1])]){const b=bump(a,'OH-SEN');b.payload.basis.extra=value;assert.equal(classify(a,b).kind,'HARD_INVALIDATION');}
 const b=bump(a,'OH-SEN');b.loop=b;assert.equal(classify(a,b).kind,'HARD_INVALIDATION');const c=bump(a,'OH-SEN');let invoked=0;Object.defineProperty(c,'sideEffect',{enumerable:true,get(){invoked++;return 1;}});assert.equal(classify(a,c).kind,'HARD_INVALIDATION');assert.equal(invoked,0);
});
check('classification is read-only and never returns private model or source values',()=>{const a=frame(),b=bump(a,'OH-SEN'),before=JSON.stringify([a,b]),result=classify(a,b);assert.equal(JSON.stringify([a,b]),before);assert.deepEqual(Object.keys(result),['kind','reason']);assert(Object.isFrozen(result));
 b.snapshotInfo={status:'AS_OF',completed_at:iso(now)};b.input_at=iso(now);b.key='OTHER_APP_KEY';assert.equal(classify(a,b).kind,'MONOTONE_COUNTS_ONLY');});
const report={status:'PASS',groups:cases.length,checks:cases,source_scope:'Installed admitted civic counts only; WA/VA/cache and remaining supplements hard-refresh in this first slice.',
 actual_installed_admission_at_current_time:true,no_model_draws_or_native_requests:true,no_private_values_returned_logged_or_persisted:true,empirical_calibration_or_production_acceptance:false};
const out=path.join(__dirname,'../artifacts/readiness');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'joint-count-snapshot-policy.json'),JSON.stringify(report,null,2)+'\n');
console.log('Joint count snapshot policy PASS '+cases.length+' groups; strict pure scheduling compatibility, no model/source admission change');
