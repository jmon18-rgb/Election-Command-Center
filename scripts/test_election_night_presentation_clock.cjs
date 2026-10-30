'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),
 path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process'),
 crypto=require('node:crypto');
const file=path.join(__dirname,'election_night_presentation_clock.js'),api=require(file),
 at=iso=>Date.parse(iso),early=at('2026-11-04T00:30:00Z');
let groups=0;const check=(name,test)=>{test();groups++;};
check('all exact phase boundaries are inclusive only at their declared instant',()=>{
 const boundaries=[
  ['2026-11-03T05:00:00Z','PRE_ELECTION','ELECTION_DAY'],
  ['2026-11-03T23:00:00Z','ELECTION_DAY','FIRST_RETURNS'],
  ['2026-11-04T00:30:00Z','FIRST_RETURNS','EARLY_INDICATORS'],
  ['2026-11-04T02:00:00Z','EARLY_INDICATORS','MAIN_COUNT'],
  ['2026-11-04T07:00:00Z','MAIN_COUNT','OVERNIGHT'],
  ['2026-11-04T11:00:00Z','OVERNIGHT','FOLLOW_UP']
 ];
 for(const [iso,before,after]of boundaries){
  assert.equal(api.evaluate({now:at(iso)-1}).phase,before,iso+' before');
  assert.equal(api.evaluate({now:at(iso)}).phase,after,iso+' at');
  assert.equal(api.evaluate({now:at(iso)+1}).phase,after,iso+' after');
 }
});
check('the spotlight is only the one requested2026 7:30–9PM Eastern interval',()=>{
 for(const [now,expected]of [[early-1,false],[early,true],
  [at('2026-11-04T02:00:00Z')-1,true],[at('2026-11-04T02:00:00Z'),false],
  [at('2025-11-04T00:30:00Z'),false],[at('2027-11-04T00:30:00Z'),false]]){
  const result=api.evaluate({now});assert.equal(result.earlySpotlight,expected);
  assert.equal(result.desiredLayout,expected?'EXPANDED':'COMPACT');
 }
});
check('landing is bounded from6PM election evening through6AM next morning',()=>{
 const start=at('2026-11-03T23:00:00Z'),end=at('2026-11-04T11:00:00Z');
 for(const [now,expected]of [[start-1,false],[start,true],[end-1,true],[end,false],
  [at('2027-11-03T23:00:00Z'),false]])
  assert.equal(api.evaluate({now}).autoLandingWindow,expected);
});
check('fixedUTC instants actually correspond to the stated Eastern calendar times',()=>{
 const formatter=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',
  year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const cases=[['2026-11-03T05:00:00Z','2026-11-03 00:00'],
  ['2026-11-03T23:00:00Z','2026-11-03 18:00'],
  ['2026-11-04T00:30:00Z','2026-11-03 19:30'],
  ['2026-11-04T02:00:00Z','2026-11-03 21:00'],
  ['2026-11-04T07:00:00Z','2026-11-04 02:00'],
  ['2026-11-04T11:00:00Z','2026-11-04 06:00']];
 for(const [iso,expected]of cases){const parts=Object.fromEntries(
  formatter.formatToParts(new Date(iso)).map(part=>[part.type,part.value]));
  assert.equal(parts.year+'-'+parts.month+'-'+parts.day+' '+parts.hour+':'+parts.minute,expected);}
});
check('hosttimezone does not change phase layout or labels',()=>{
 const code='process.stdout.write(JSON.stringify(require('+JSON.stringify(file)+').evaluate({now:'+early+'})))',expected=JSON.stringify(api.evaluate({now:early}));
 for(const TZ of ['UTC','America/Los_Angeles','Asia/Tokyo'])
  assert.equal(cp.execFileSync(process.execPath,['-e',code],{
   env:{...process.env,TZ},encoding:'utf8'}),expected);
});
check('explicit layout choices affect only visual layout',()=>{
 const automatic=api.evaluate({now:early}),compact=api.evaluate({now:early,layoutChoice:'COMPACT'});
 assert.equal(automatic.desiredLayout,'EXPANDED');assert.equal(compact.desiredLayout,'COMPACT');
 assert.equal(compact.earlySpotlight,false);assert.equal(compact.autoLandingWindow,automatic.autoLandingWindow);
 for(const key of ['phase','modeLabel','phaseLabel'])assert.equal(compact[key],automatic[key]);
 const before=api.evaluate({now:at('2026-11-02T18:00:00Z'),layoutChoice:'EXPANDED'});
 assert.equal(before.desiredLayout,'EXPANDED');assert.equal(before.earlySpotlight,false);
 assert.equal(before.autoLandingWindow,false);assert.equal(before.phase,'PRE_ELECTION');
});
check('archive hidden otherpage and rehearsals suppress all automatic presentation actions',()=>{
 const base=api.evaluate({now:early});
 for(const options of [{modeYear:2024},{modeYear:2025},{modeYear:null},
  {visible:false},{visible:'true'},{page:'brief'},{page:'model'},
  {rehearsalOpen:true},{rehearsalOpen:'false'}]){
  for(const layoutChoice of ['AUTO','EXPANDED','COMPACT']){
   const result=api.evaluate({now:early,...options,layoutChoice});
   assert.equal(result.phase,base.phase);assert.equal(result.phaseLabel,base.phaseLabel);
   assert.equal(result.desiredLayout,'COMPACT');assert.equal(result.earlySpotlight,false);
   assert.equal(result.autoLandingWindow,false);
  }
 }
 assert.equal(api.evaluate({now:early,modeYear:2024}).modeLabel,'2024 archive');
});
check('invalidNOW never expands lands or substitutes an implicit runtime clock',()=>{
 for(const now of [undefined,null,NaN,Infinity,-Infinity,'2026-11-04T01:00:00Z',
  true,{},[],1e20])for(const layoutChoice of ['AUTO','EXPANDED','COMPACT']){
  const result=api.evaluate({now,layoutChoice});assert.equal(result.phase,'UNKNOWN');
  assert.equal(result.desiredLayout,'COMPACT');assert.equal(result.earlySpotlight,false);
  assert.equal(result.autoLandingWindow,false);assert.equal(result.phaseLabel,'Clock unavailable');
 }
 assert.equal(api.evaluate().phase,'UNKNOWN');assert.equal(api.evaluate(null).phase,'UNKNOWN');
 assert.equal(api.evaluate([]).phase,'UNKNOWN');
});
check('malformed layout choices failcompact while validclock phase remains truthful',()=>{
 for(const layoutChoice of ['expanded','BAD',null,{},false]){
  const result=api.evaluate({now:early,layoutChoice});assert.equal(result.phase,'EARLY_INDICATORS');
  assert.equal(result.desiredLayout,'COMPACT');assert.equal(result.earlySpotlight,false);
 }
});
check('results andAPI are frozen and input is unchanged',()=>{
 const input=Object.freeze({now:early,layoutChoice:'AUTO'}),result=api.evaluate(input);
 assert(Object.isFrozen(result));assert(Object.isFrozen(api));
 assert.throws(()=>{result.phase='ALTERED';},TypeError);
 assert.deepEqual(input,{now:early,layoutChoice:'AUTO'});
 assert.equal(result.modeLabel,'Election Night · 2026');
});
check('no data calls sources probabilities or request state provide phase authority',()=>{
 const input={now:early};for(const key of ['counts','live','calls','probabilities','basis','sources'])
  Object.defineProperty(input,key,{get(){throw Error('Presentation read '+key);}});
 assert.deepEqual(api.evaluate(input),api.evaluate({now:early}));
 const source=fs.readFileSync(file,'utf8');assert.doesNotMatch(source,/Date\.now\s*\(/);
 assert.doesNotMatch(source,/\b(?:fetch|localStorage|sessionStorage|document)\s*[.(]/);
});
check('browserUMD exports the same pure frozenAPI withoutDOM or storage',()=>{
 const sandbox={window:{}};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(file,'utf8'),sandbox);
 assert.deepEqual(Object.keys(sandbox.window),['ElectionNightPresentationClock']);
 assert.equal(JSON.stringify(sandbox.window.ElectionNightPresentationClock.evaluate({now:early})),JSON.stringify(api.evaluate({now:early})));
 assert(Object.isFrozen(sandbox.window.ElectionNightPresentationClock));
});
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const proof={schema:'election-night-presentation-clock-proof-v1',status:'PASS',groups,
 helper_sha256:sha(file),test_sha256:sha(__filename),exact_timezone:'America/New_York',
 spotlight_window_utc:['2026-11-04T00:30:00.000Z','2026-11-04T02:00:00.000Z'],
 landing_window_utc:['2026-11-03T23:00:00.000Z','2026-11-04T11:00:00.000Z'],
 model_draws:0,source_GETs:0,browser_runs:0,scope:'Pure display policy only; root URL/user-choice checks and actual DOM/reader integration remain separate.'};
const out=process.env.PRESENTATION_CLOCK_PROOF||path.join(__dirname,'..','artifacts/readiness/election-night-presentation-clock.json');
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify(proof));
