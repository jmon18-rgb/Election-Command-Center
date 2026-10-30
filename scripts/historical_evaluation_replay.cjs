'use strict';
// Offline research infrastructure. No dataset admission, downloads or live-model hook.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const METHODS=Object.freeze(['model','polling_only','naive_count']);
const TARGET='EXHAUSTIVE_TWO_CANDIDATE_CONTEST',SELECTION='CONSECUTIVE_OBSERVATION_LIFECYCLE_AND_PREDICTION_V1',REMAINING_UNIT='UNREPORTED_VALID_TWO_CANDIDATE_CONTEST_VOTES';
const own=x=>structuredClone(x),hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
const exact=(x,keys)=>assert.deepEqual(Object.keys(x).sort(),keys.slice().sort());
function forecast(value){
 const p=own(value);assert(p&&typeof p==='object'&&!Array.isArray(p));
 if(p.status==='WITHHELD'){exact(p,['status','reason']);assert(typeof p.reason==='string'&&p.reason.length>0&&p.reason.length<=200);return freeze(p);}
 exact(p,['status','margin_points','positive_win_probability','margin_interval','remaining_interval']);assert.equal(p.status,'PREDICTED');
 assert(Number.isFinite(p.margin_points)&&Math.abs(p.margin_points)<=100);assert(Number.isFinite(p.positive_win_probability)&&p.positive_win_probability>=0&&p.positive_win_probability<=1);
 for(const name of ['margin_interval','remaining_interval']){const i=p[name];exact(i,['level','lower','upper']);assert(Number.isFinite(i.level)&&i.level>0&&i.level<1&&Number.isFinite(i.lower)&&Number.isFinite(i.upper)&&i.lower<=i.upper);if(name==='margin_interval')assert(i.lower>=-100&&i.upper<=100);else assert(i.lower>=0);}
 return freeze(p);
}
async function replay({identity,frozenExpectations,events,predictors}){
 const id=freeze(own(identity)),frozen=freeze(own(frozenExpectations)),sequence=own(events);exact(id,['election_id','race_id','positive_candidate_ids','negative_candidate_ids']);
 assert(typeof id.election_id==='string'&&id.election_id&&typeof id.race_id==='string'&&id.race_id);const candidates=[...id.positive_candidate_ids,...id.negative_candidate_ids];assert(id.positive_candidate_ids.length===1&&id.negative_candidate_ids.length===1&&candidates.every(c=>typeof c==='string'&&c)&&new Set(candidates).size===2,'Prototype target requires exactly two distinct candidate identities');
 assert(frozen&&typeof frozen==='object');exact(predictors,METHODS);assert(METHODS.every(k=>typeof predictors[k]==='function'));const functions=Object.freeze({...predictors});assert(Array.isArray(sequence)&&sequence.length>0&&sequence.length<=30000);
 const history=[],trace=[],seen=new Set();let previous=null,clock=-Infinity;
 for(const e of sequence){
  exact(e,['id','source_as_of','available_at','captured_at','previous_id','change_kind','observation','counted_positive','counted_negative']);assert(typeof e.id==='string'&&e.id&&!seen.has(e.id));seen.add(e.id);assert.equal(e.previous_id,previous);
  assert(['initial','update','correction','retraction','recovery'].includes(e.change_kind));assert((previous===null)===(e.change_kind==='initial'));const times=['source_as_of','available_at','captured_at'].map(k=>Date.parse(e[k]));assert(times.every(Number.isFinite)&&times[0]<=times[1]&&times[1]<=times[2]&&times[2]>clock);previous=e.id;clock=times[2];
  assert([e.counted_positive,e.counted_negative].every(x=>Number.isSafeInteger(x)&&x>=0));
  // Evaluation bins, final fraction/truth and future events are not in this packet.
  history.push({id:e.id,source_as_of:e.source_as_of,available_at:e.available_at,captured_at:e.captured_at,previous_id:e.previous_id,change_kind:e.change_kind,observation:own(e.observation)});
  const packet=freeze({identity:id,frozen_expectations:frozen,history:own(history)}),predictions={};
  for(const method of METHODS)predictions[method]=forecast(await functions[method](freeze(own(packet))));
  trace.push(freeze({id:e.id,change_kind:e.change_kind,source_as_of:e.source_as_of,available_at:e.available_at,captured_at:e.captured_at,normalized_hash:hash(e.observation),input_hash:hash(packet),counted_positive:e.counted_positive,counted_negative:e.counted_negative,predictions}));
 }
 return freeze({schema:'offline-race-replay-trace-v1',identity:id,frozen_expectations_hash:hash(frozen),events:trace,status:'RESEARCH_TRACE_NOT_DATASET_ADMISSION',admitted_independent_datasets:0,admitted_heldout_elections:0,metrics:null,may_claim_calibration:false,may_change_forecast:false});
}
const mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
function scoringRows(trace,truth,protocol){
 assert.equal(trace.schema,'offline-race-replay-trace-v1');exact(truth,['identity','positive_votes','negative_votes','snapshot_stages']);assert.deepEqual(trace.identity,truth.identity);
 assert([truth.positive_votes,truth.negative_votes].every(x=>Number.isSafeInteger(x)&&x>=0));const total=truth.positive_votes+truth.negative_votes;assert(Number.isSafeInteger(total)&&total>0);assert.deepEqual(Object.keys(truth.snapshot_stages).sort(),trace.events.map(e=>e.id).sort());assert(Object.values(truth.snapshot_stages).every(s=>['early','middle','late'].includes(s)));
 exact(protocol,['margin_level','remaining_level','target','observation_selection','remaining_unit']);assert([protocol.margin_level,protocol.remaining_level].every(x=>Number.isFinite(x)&&x>0&&x<1));assert.equal(protocol.target,TARGET);assert.equal(protocol.observation_selection,SELECTION);assert.equal(protocol.remaining_unit,REMAINING_UNIT);assert(trace.identity.positive_candidate_ids.length===1&&trace.identity.negative_candidate_ids.length===1);const actualMargin=100*(truth.positive_votes-truth.negative_votes)/total,y=truth.positive_votes===truth.negative_votes?null:Number(truth.positive_votes>truth.negative_votes),rows=[];let previousSignature=null,selected=0;
 for(const e of trace.events){const predictions=Object.fromEntries(METHODS.map(method=>[method,forecast(e.predictions[method])])),signature=hash({observation:e.normalized_hash,change_kind:e.change_kind,counted_positive:e.counted_positive,counted_negative:e.counted_negative,predictions}),unique=signature!==previousSignature;previousSignature=signature;if(unique)selected++;for(const method of METHODS){const p=predictions[method],base={event_id:e.id,stage:truth.snapshot_stages[e.id],method,distinct:unique,status:p.status};if(p.status==='WITHHELD'){rows.push({...base,reason:p.reason});continue;}assert.equal(p.margin_interval.level,protocol.margin_level);assert.equal(p.remaining_interval.level,protocol.remaining_level);const remaining=total-e.counted_positive-e.counted_negative,wp=y===null?null:y?p.positive_win_probability:1-p.positive_win_probability;rows.push({...base,error:p.margin_points-actualMargin,margin_covered:p.margin_interval.lower<=actualMargin&&actualMargin<=p.margin_interval.upper,margin_width:p.margin_interval.upper-p.margin_interval.lower,brier:y===null?null:(p.positive_win_probability-y)**2,log_loss:y===null?null:wp===0?'INFINITE':-Math.log(wp),remaining_covered:remaining<0?null:p.remaining_interval.lower<=remaining&&remaining<=p.remaining_interval.upper,remaining_width:remaining<0?null:p.remaining_interval.upper-p.remaining_interval.lower,overcount:remaining<0});}}
 return {rows,selected};
}
function score(trace,truth,protocol){
 const {rows,selected}=scoringRows(trace,truth,protocol);
 const summaries={};for(const method of METHODS){summaries[method]={};for(const stage of ['all','early','middle','late']){const rs=rows.filter(r=>r.method===method&&r.distinct&&(stage==='all'||r.stage===stage)),ps=rs.filter(r=>r.status==='PREDICTED'),values=k=>ps.map(r=>r[k]).filter(v=>v!==null),loss=values('log_loss');summaries[method][stage]={distinct_events:rs.length,predicted:ps.length,withheld:rs.length-ps.length,binary_outcome_scored:values('brier').length,remaining_interval_scored:values('remaining_covered').length,margin_MAE:mean(values('error').map(Math.abs)),margin_bias:mean(values('error')),margin_coverage:mean(values('margin_covered').map(Number)),margin_width:mean(values('margin_width')),Brier:mean(values('brier')),log_loss:loss.includes('INFINITE')?'INFINITE':mean(loss),remaining_coverage:mean(values('remaining_covered').map(Number)),remaining_width:mean(values('remaining_width')),overcount_not_scored_as_physical_remaining:ps.filter(r=>r.overcount).length};}}
 return freeze({schema:'offline-race-research-scores-v2',identity:trace.identity,scoring_protocol:own(protocol),raw_events:trace.events.length,distinct_events:selected,summaries,admitted_independent_datasets:0,admitted_heldout_elections:0,may_claim_calibration:false,may_change_forecast:false,scope:'Descriptive arithmetic only for an explicitly exhaustive two-candidate contest. Remaining unit is valid contest votes, never all ballots/undervotes/overvotes. Independent source/admission, frozen-code/vintage and election-heldout review remain external. No national-transfer inference.'});
}
function aggregate(reports){
 assert(Array.isArray(reports)&&reports.length);const groups=new Map(),seen=new Set(),protocol=reports[0].scoring_protocol;for(const r of reports){assert.equal(r.schema,'offline-race-research-scores-v2');assert.deepEqual(r.scoring_protocol,protocol,'Cannot aggregate different interval levels, selection policies, targets or count units');const key=r.identity.election_id+'|'+r.identity.race_id;assert(!seen.has(key));seen.add(key);if(!groups.has(r.identity.election_id))groups.set(r.identity.election_id,[]);groups.get(r.identity.election_id).push(r);}
 const average=xs=>xs.includes('INFINITE')?'INFINITE':mean(xs.filter(x=>x!==null)),summaries={},usable_denominators={};for(const method of METHODS){summaries[method]={};usable_denominators[method]={};for(const stage of ['all','early','middle','late']){summaries[method][stage]=Object.fromEntries(['margin_MAE','margin_bias','margin_coverage','margin_width','Brier','log_loss','remaining_coverage','remaining_width'].map(k=>[k,average([...groups.values()].map(rs=>average(rs.map(r=>r.summaries[method][stage][k]))))]));const ss=reports.map(r=>r.summaries[method][stage]);usable_denominators[method][stage]={race_records_total:reports.length,election_records_total:groups.size,margin_races_used:ss.filter(s=>s.predicted>0).length,winner_races_used:ss.filter(s=>s.binary_outcome_scored>0).length,remaining_races_used:ss.filter(s=>s.remaining_interval_scored>0).length,margin_elections_used:[...groups.values()].filter(rs=>rs.some(r=>r.summaries[method][stage].predicted>0)).length,winner_elections_used:[...groups.values()].filter(rs=>rs.some(r=>r.summaries[method][stage].binary_outcome_scored>0)).length,remaining_elections_used:[...groups.values()].filter(rs=>rs.some(r=>r.summaries[method][stage].remaining_interval_scored>0)).length,selected_states:ss.reduce((n,s)=>n+s.distinct_events,0),predicted_states:ss.reduce((n,s)=>n+s.predicted,0),withheld_states:ss.reduce((n,s)=>n+s.withheld,0)};}}
 return freeze({schema:'offline-research-equal-election-aggregate-v2',scoring_protocol:own(protocol),race_records:reports.length,election_records:groups.size,weighting:'Equal usable races within election, equal usable elections; selected state transitions are never independent sample size. All usable denominators disclosed.',summaries,usable_denominators,paired_baseline_skill:null,admitted_independent_datasets:0,admitted_heldout_elections:0,may_claim_calibration:false,may_change_forecast:false});
}
async function replayRetainedPackage({manifest,readBytes,decodeExpectations,decodeSnapshot,predictors}){
 // Own every retained byte and the manifest synchronously before any callback
 // can await. The reader, normalizers and predictors are trusted reviewed code,
 // not a security sandbox or proof of genuine contemporaneous provenance.
 const m=own(manifest),bytes=new Map(),functions=Object.freeze({...predictors});assert(typeof readBytes==='function');
 const preflight=require('./historical_evaluation_package_preflight.cjs').inspect(m,{readBytes:p=>{if(!bytes.has(p)){const b=readBytes(p);assert(Buffer.isBuffer(b));bytes.set(p,Buffer.from(b));}return bytes.get(p);}});
 assert.equal(preflight.status,'STRUCTURAL_PREFLIGHT_PASS_REQUIRES_INDEPENDENT_ADMISSION','Retained package must satisfy delivered539 structural contract');
 assert(typeof decodeExpectations==='function'&&typeof decodeSnapshot==='function');
 const body=id=>Buffer.from(bytes.get(m.artifacts[id].path));
 const frozen=own(decodeExpectations({model:body(m.frozen_expectations.model.body_artifact),polling_only:body(m.frozen_expectations.polling_only.body_artifact)}));
 // Exact axis identities come from reviewed frozen metadata, never party/name
 // inference from aggregate counts. This is a new explicit adapter contract.
 const identity=own(frozen.identity);assert.equal(identity.election_id,m.election.id);assert.equal(identity.race_id,m.race.id);
 const targetIds=[...identity.positive_candidate_ids,...identity.negative_candidate_ids];assert(m.race.candidate_ids.length===2&&targetIds.length===2&&new Set(targetIds).size===2&&targetIds.every(id=>m.race.candidate_ids.includes(id)),'Scoring target must exhaust the full native two-candidate contest; third-candidate races need a separately implemented full-roster target');
 const events=m.snapshots.map(s=>{const decoded=own(decodeSnapshot({original:body(s.original_artifact),normalized:body(s.normalized_artifact)},{election_id:s.election_id,race_id:s.race_id,candidate_ids:own(s.candidate_ids),reporting_unit_ids:own(s.reporting_unit_ids)}));exact(decoded,['observation','counted_positive','counted_negative']);return {id:s.id,source_as_of:s.source_as_of,available_at:s.available_at,captured_at:s.captured_at,previous_id:s.previous_snapshot_id,change_kind:s.change_kind,...decoded};});
 const trace=await replay({identity,frozenExpectations:frozen,events,predictors:functions});
 return freeze({schema:'retained-package-replay-v1',manifest_serialization_sha256:hash(m),artifact_hashes:own(m.artifacts),preflight_status:preflight.status,trace,admitted_independent_datasets:0,admitted_heldout_elections:0,metrics:null,may_claim_calibration:false,may_change_forecast:false});
}
function retainedScoringInput({replayResult,manifest,readBytes,decodeTruth}){
 assert.equal(replayResult.schema,'retained-package-replay-v1');const m=own(manifest);assert.equal(hash(m),replayResult.manifest_serialization_sha256);assert.deepEqual(m.artifacts,replayResult.artifact_hashes);assert(typeof decodeTruth==='function');
 const a=m.artifacts[m.final_truth_artifact],b=Buffer.from(readBytes(a.path));assert.equal(crypto.createHash('sha256').update(b).digest('hex'),a.sha256);
 // Final truth and retrospective stage labels enter only this second phase.
 const decoded=own(decodeTruth(b));exact(decoded,['identity','positive_votes','negative_votes']);return {trace:replayResult.trace,truth:{...decoded,snapshot_stages:Object.fromEntries(m.snapshots.map(s=>[s.id,s.evaluation_stage]))}};
}
function scoreRetainedTrace(options){const {trace,truth}=retainedScoringInput(options);return score(trace,truth,options.protocol);}
const PAIRED_PROTOCOL=freeze({version:'same-selected-event-paired-loss-v1',model_method:'model',baseline_methods:['polling_only','naive_count'],cohort:'BOTH_PREDICTED_ON_IDENTICAL_EXISTING_SELECTED_EVENT_IDS',weighting:'EQUAL_COMMON_RACES_WITHIN_ELECTION_THEN_EQUAL_USABLE_ELECTIONS',loss_difference:'BASELINE_MINUS_MODEL',relative_ratios:'NOT_COMPUTED',log_loss_infinity:'EXTENDED_NONNEGATIVE_LOSS_MEANS; BOTH_INFINITE_DIFFERENCE_UNDEFINED',interval_comparison:'SAME_NOMINAL_LEVEL_COVERAGE_AND_WIDTH_SIDE_BY_SIDE_ONLY'});
const BASELINES=PAIRED_PROTOCOL.baseline_methods,STAGES=['all','early','middle','late'];
const METRICS=Object.freeze({margin_MAE:{key:'error',loss:true,transform:Math.abs,mask:'margin'},margin_bias:{key:'error',mask:'margin'},Brier:{key:'brier',loss:true,mask:'probability'},log_loss:{key:'log_loss',loss:true,mask:'probability'},margin_coverage:{key:'margin_covered',transform:Number,mask:'margin'},margin_width:{key:'margin_width',mask:'margin'},remaining_coverage:{key:'remaining_covered',transform:Number,mask:'remaining'},remaining_width:{key:'remaining_width',mask:'remaining'}});
const tag=(kind,value=null)=>kind==='FINITE'?{kind,value}:{kind,value,reason:({NO_USABLE_PAIRS:'No paired observations satisfy metric eligibility.',POSITIVE_INFINITY:'Positive infinity is retained without clipping.',NEGATIVE_INFINITY:'Model loss is infinite while baseline loss is finite.',UNDEFINED_BOTH_INFINITE:'Both extended mean losses are infinite; their difference is undefined.',UNDEFINED_NO_USABLE_PAIRS:'No paired metric data; no zero loss is imputed.'})[kind]};
function pairedIdentity(identity){exact(identity,['election_id','race_id','positive_candidate_ids','negative_candidate_ids']);assert(typeof identity.election_id==='string'&&identity.election_id&&typeof identity.race_id==='string'&&identity.race_id);assert(Array.isArray(identity.positive_candidate_ids)&&Array.isArray(identity.negative_candidate_ids)&&identity.positive_candidate_ids.length===1&&identity.negative_candidate_ids.length===1);const ids=[...identity.positive_candidate_ids,...identity.negative_candidate_ids];assert(ids.every(id=>typeof id==='string'&&id)&&new Set(ids).size===2);}
function taggedMean(values){
 if(!values.length)return tag('NO_USABLE_PAIRS');
 assert(values.every(v=>v==='INFINITE'||Number.isFinite(v)));
 if(values.includes('INFINITE'))return tag('POSITIVE_INFINITY');
 // Stable finite mean without an overflowing intermediate sum of vote widths.
 let result=values[0];for(let i=1;i<values.length;i++)result+=(values[i]-result)/(i+1);
 assert(Number.isFinite(result));return tag('FINITE',result);
}
function meanTags(values){return taggedMean(values.map(t=>{assert(t.kind==='FINITE'||t.kind==='POSITIVE_INFINITY');return t.kind==='POSITIVE_INFINITY'?'INFINITE':t.value;}));}
function lossGain(model,baseline){
 if(model.kind==='NO_USABLE_PAIRS'||baseline.kind==='NO_USABLE_PAIRS'){assert.equal(model.kind,baseline.kind);return tag('UNDEFINED_NO_USABLE_PAIRS');}
 if(model.kind==='POSITIVE_INFINITY'&&baseline.kind==='POSITIVE_INFINITY')return tag('UNDEFINED_BOTH_INFINITE');
 if(baseline.kind==='POSITIVE_INFINITY')return tag('POSITIVE_INFINITY');
 if(model.kind==='POSITIVE_INFINITY')return tag('NEGATIVE_INFINITY');
 assert(model.kind==='FINITE'&&baseline.kind==='FINITE');return tag('FINITE',baseline.value-model.value);
}
const cohortHash=(identity,baseline,stage,metric,event_ids)=>hash({identity,baseline,stage,metric,event_ids});
function pairedMetric(identity,baseline,stage,name,pairs){
 const definition=METRICS[name],convert=definition.transform||((x)=>x),event_ids=pairs.map(p=>p.model.event_id),modelValues=pairs.map(p=>convert(p.model[definition.key])),baselineValues=pairs.map(p=>convert(p.baseline[definition.key]));
 const model=taggedMean(modelValues),comparison=taggedMean(baselineValues),digest=cohortHash(identity,baseline,stage,name,event_ids);
 const modelInfinite=event_ids.filter((id,i)=>modelValues[i]==='INFINITE'),baselineInfinite=event_ids.filter((id,i)=>baselineValues[i]==='INFINITE');
 const value={event_ids,count:event_ids.length,model_cohort_sha256:digest,baseline_cohort_sha256:digest,model,baseline:comparison,model_infinite_event_ids:modelInfinite,baseline_infinite_event_ids:baselineInfinite};
 if(definition.loss)value.gain=lossGain(model,comparison);
 return value;
}
function scorePaired(trace,truth,protocol,comparisonProtocol){
 assert.deepEqual(comparisonProtocol,PAIRED_PROTOCOL,'Explicit predeclared paired protocol required');
 pairedIdentity(trace.identity);
 const {rows,selected}=scoringRows(trace,truth,protocol),pairs={};
 for(const baseline of BASELINES){pairs[baseline]={};const baselineRows=new Map(rows.filter(r=>r.method===baseline).map(r=>[r.event_id,r]));
  for(const stage of STAGES){
   const selectedRows=rows.filter(r=>r.method==='model'&&r.distinct&&(stage==='all'||r.stage===stage)),paired=[],cohort={selected_event_ids:selectedRows.map(r=>r.event_id),both_predicted_event_ids:[],model_only_withheld_event_ids:[],baseline_only_withheld_event_ids:[],both_withheld_event_ids:[],tie_excluded_event_ids:[],negative_remaining_excluded_event_ids:[]};
   for(const model of selectedRows){const base=baselineRows.get(model.event_id);assert(base&&base.stage===model.stage&&base.distinct===model.distinct);const m=model.status==='PREDICTED',b=base.status==='PREDICTED';
    if(m&&b){cohort.both_predicted_event_ids.push(model.event_id);paired.push({model,baseline:base});if(model.brier===null){assert.equal(base.brier,null);cohort.tie_excluded_event_ids.push(model.event_id);}if(model.overcount){assert.equal(base.overcount,true);cohort.negative_remaining_excluded_event_ids.push(model.event_id);}}
    else if(!m&&!b)cohort.both_withheld_event_ids.push(model.event_id);
    else if(!m)cohort.model_only_withheld_event_ids.push(model.event_id);
    else cohort.baseline_only_withheld_event_ids.push(model.event_id);
   }
   const masks={margin:paired,probability:paired.filter(p=>p.model.brier!==null),remaining:paired.filter(p=>!p.model.overcount)},metrics={};
   for(const [name,definition]of Object.entries(METRICS))metrics[name]=pairedMetric(trace.identity,baseline,stage,name,masks[definition.mask]);
   pairs[baseline][stage]={cohort,denominators:Object.fromEntries(Object.entries(cohort).map(([key,ids])=>[key.replace(/_event_ids$/,'_states'),ids.length])),metrics};
  }
 }
 return freeze({schema:'offline-race-paired-research-v1',identity:own(trace.identity),scoring_protocol:own(protocol),comparison_protocol:own(comparisonProtocol),raw_events:trace.events.length,selected_states:selected,pairs,admitted_independent_datasets:0,admitted_heldout_elections:0,may_claim_calibration:false,may_change_forecast:false,scope:'Model versus each declared baseline on shared selected event IDs only. Conditional arithmetic with explicit abstention; method labels do not authenticate baseline implementations or information sets. No empirical admission, coverage acceptance, calibration or national transfer.'});
}
function validatePairedReport(report,protocol){
 assert.equal(report.schema,'offline-race-paired-research-v1');pairedIdentity(report.identity);assert.deepEqual(report.scoring_protocol,protocol,'Paired aggregation requires the same scoring protocol');assert.deepEqual(report.comparison_protocol,PAIRED_PROTOCOL,'Paired aggregation requires the fixed comparison protocol');exact(report.pairs,BASELINES);
 for(const baseline of BASELINES){exact(report.pairs[baseline],STAGES);for(const stage of STAGES){const block=report.pairs[baseline][stage],cohort=block.cohort;exact(block.metrics,Object.keys(METRICS));
   exact(cohort,['selected_event_ids','both_predicted_event_ids','model_only_withheld_event_ids','baseline_only_withheld_event_ids','both_withheld_event_ids','tie_excluded_event_ids','negative_remaining_excluded_event_ids']);
   for(const ids of Object.values(cohort))assert(Array.isArray(ids)&&new Set(ids).size===ids.length);
   const selected=cohort.selected_event_ids,partition=[...cohort.both_predicted_event_ids,...cohort.model_only_withheld_event_ids,...cohort.baseline_only_withheld_event_ids,...cohort.both_withheld_event_ids];assert.deepEqual(partition.slice().sort(),selected.slice().sort());
   for(const key of ['tie_excluded_event_ids','negative_remaining_excluded_event_ids'])assert(cohort[key].every(id=>cohort.both_predicted_event_ids.includes(id)));
   assert.deepEqual(block.denominators,Object.fromEntries(Object.entries(cohort).map(([key,ids])=>[key.replace(/_event_ids$/,'_states'),ids.length])));
   for(const [name,definition]of Object.entries(METRICS)){
    const metric=block.metrics[name],expected=cohort.both_predicted_event_ids.filter(id=>definition.mask==='probability'?!cohort.tie_excluded_event_ids.includes(id):definition.mask==='remaining'?!cohort.negative_remaining_excluded_event_ids.includes(id):true);exact(metric,['event_ids','count','model_cohort_sha256','baseline_cohort_sha256','model','baseline','model_infinite_event_ids','baseline_infinite_event_ids',...(definition.loss?['gain']:[])]);
    assert.deepEqual(metric.event_ids,expected,'Paired metric IDs must equal the shared eligible event cohort');assert.equal(metric.count,expected.length);const digest=cohortHash(report.identity,baseline,stage,name,expected);assert.equal(metric.model_cohort_sha256,digest,'Model cohort hash must bind the shared metric IDs');assert.equal(metric.baseline_cohort_sha256,digest,'Baseline cohort hash must bind the shared metric IDs');
    for(const side of ['model','baseline']){const t=metric[side],infinite=metric[side+'_infinite_event_ids'];assert(Array.isArray(infinite)&&new Set(infinite).size===infinite.length&&infinite.every(id=>expected.includes(id)));if(!expected.length){assert.deepEqual(t,tag('NO_USABLE_PAIRS'));assert.equal(infinite.length,0);}else if(t.kind==='POSITIVE_INFINITY'){assert.equal(name,'log_loss');assert(infinite.length>0);assert.equal(t.value,null);}else{assert.equal(t.kind,'FINITE');assert(Number.isFinite(t.value));assert.equal(infinite.length,0);}}
    assert.equal(Object.hasOwn(metric,'gain'),Boolean(definition.loss));if(definition.loss)assert.deepEqual(metric.gain,lossGain(metric.model,metric.baseline));
   }
  }}
}
const raceKey=identity=>JSON.stringify([identity.election_id,identity.race_id]);
function gainGroups(rows,getId,getGain){const result=Object.fromEntries(['FINITE','POSITIVE_INFINITY','NEGATIVE_INFINITY','UNDEFINED_BOTH_INFINITE','UNDEFINED_NO_USABLE_PAIRS'].map(kind=>[kind,{count:0,ids:[]}]));for(const row of rows){const kind=getGain(row).kind;assert(result[kind]);result[kind].count++;result[kind].ids.push(getId(row));}return result;}
function aggregatePaired(inputReports){
 const reports=own(inputReports);assert(Array.isArray(reports)&&reports.length);reports.sort((a,b)=>raceKey(a.identity).localeCompare(raceKey(b.identity)));const protocol=reports[0].scoring_protocol,seen=new Set(),groups=new Map();
 exact(protocol,['margin_level','remaining_level','target','observation_selection','remaining_unit']);assert([protocol.margin_level,protocol.remaining_level].every(x=>Number.isFinite(x)&&x>0&&x<1));assert.equal(protocol.target,TARGET);assert.equal(protocol.observation_selection,SELECTION);assert.equal(protocol.remaining_unit,REMAINING_UNIT);
 for(const r of reports){validatePairedReport(r,protocol);const key=raceKey(r.identity);assert(!seen.has(key),'Duplicate paired election/race');seen.add(key);if(!groups.has(r.identity.election_id))groups.set(r.identity.election_id,[]);groups.get(r.identity.election_id).push(r);}
 const pairs={},allRaceIds=reports.map(r=>({election_id:r.identity.election_id,race_id:r.identity.race_id})),allElectionIds=[...groups.keys()];
 for(const baseline of BASELINES){pairs[baseline]={};for(const stage of STAGES){const metrics={},denominators={};
  for(const key of Object.keys(reports[0].pairs[baseline][stage].denominators))denominators[key]=reports.reduce((n,r)=>n+r.pairs[baseline][stage].denominators[key],0);
  for(const [name,definition]of Object.entries(METRICS)){
   const elections=[],usableRaceIds=[],unusedRaceIds=[],modelInfiniteRaces=[],baselineInfiniteRaces=[],undefinedGainRaces=[];
   for(const [election_id,rs]of groups){const usable=rs.filter(r=>r.pairs[baseline][stage].metrics[name].count>0),ids=usable.map(r=>({election_id,race_id:r.identity.race_id}));usableRaceIds.push(...ids);unusedRaceIds.push(...rs.filter(r=>!usable.includes(r)).map(r=>({election_id,race_id:r.identity.race_id})));
    const model=meanTags(usable.map(r=>r.pairs[baseline][stage].metrics[name].model)),base=meanTags(usable.map(r=>r.pairs[baseline][stage].metrics[name].baseline));
    for(const r of usable){const m=r.pairs[baseline][stage].metrics[name],id={election_id,race_id:r.identity.race_id};if(m.model.kind==='POSITIVE_INFINITY')modelInfiniteRaces.push(id);if(m.baseline.kind==='POSITIVE_INFINITY')baselineInfiniteRaces.push(id);if(m.gain?.kind==='UNDEFINED_BOTH_INFINITE')undefinedGainRaces.push(id);}
    const row={election_id,common_race_ids:ids,model_race_ids:own(ids),baseline_race_ids:own(ids),usable_races:ids.length,model,baseline:base};if(definition.loss)row.gain=lossGain(model,base);elections.push(row);
   }
   const usableElections=elections.filter(e=>e.usable_races>0),model=meanTags(usableElections.map(e=>e.model)),base=meanTags(usableElections.map(e=>e.baseline)),commonElectionIds=usableElections.map(e=>e.election_id);
   const metric={model,baseline:base,common_race_ids:usableRaceIds,model_race_ids:own(usableRaceIds),baseline_race_ids:own(usableRaceIds),all_race_ids:own(allRaceIds),unused_no_pair_race_ids:unusedRaceIds,common_election_ids:commonElectionIds,model_election_ids:own(commonElectionIds),baseline_election_ids:own(commonElectionIds),all_election_ids:own(allElectionIds),unused_no_pair_election_ids:elections.filter(e=>e.usable_races===0).map(e=>e.election_id),usable_races:usableRaceIds.length,usable_elections:commonElectionIds.length,model_infinite_race_ids:modelInfiniteRaces,baseline_infinite_race_ids:baselineInfiniteRaces,undefined_both_infinite_gain_race_ids:undefinedGainRaces,model_infinite_election_ids:usableElections.filter(e=>e.model.kind==='POSITIVE_INFINITY').map(e=>e.election_id),baseline_infinite_election_ids:usableElections.filter(e=>e.baseline.kind==='POSITIVE_INFINITY').map(e=>e.election_id),undefined_both_infinite_gain_election_ids:usableElections.filter(e=>e.gain?.kind==='UNDEFINED_BOTH_INFINITE').map(e=>e.election_id),per_election:elections};if(definition.loss){metric.gain=lossGain(model,base);metric.gain_denominators={races:gainGroups(reports,r=>({election_id:r.identity.election_id,race_id:r.identity.race_id}),r=>r.pairs[baseline][stage].metrics[name].gain),elections:gainGroups(elections,e=>e.election_id,e=>e.gain)};}metrics[name]=metric;
  }
  pairs[baseline][stage]={denominators,metrics};
 }}
 return freeze({schema:'offline-equal-election-paired-research-v1',scoring_protocol:own(protocol),comparison_protocol:own(PAIRED_PROTOCOL),race_records:reports.length,election_records:groups.size,pairs,weighting:PAIRED_PROTOCOL.weighting,admitted_independent_datasets:0,admitted_heldout_elections:0,may_claim_calibration:false,may_change_forecast:false,scope:'Absolute paired losses on identical per-metric common race/election cohorts. Extended means are formed before gains; undefined/infinite and empty cohorts remain explicit. No cross-baseline ranking on unlike cohorts, dataset admission or empirical calibration.'});
}
function scoreRetainedPairedTrace(options){const {trace,truth}=retainedScoringInput(options);return scorePaired(trace,truth,options.protocol,options.comparisonProtocol);}
module.exports=Object.freeze({METHODS,TARGET,SELECTION,REMAINING_UNIT,PAIRED_PROTOCOL,replay,score,aggregate,replayRetainedPackage,scoreRetainedTrace,scorePaired,aggregatePaired,scoreRetainedPairedTrace});
