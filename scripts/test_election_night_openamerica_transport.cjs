const assert=require('node:assert/strict');
const {create,normalizePrimarySource}=require('./election_night_openamerica_transport');
const H='https://openamerica.io/elections/results.json?year=2026&office=House';
const S='https://openamerica.io/elections/results.json?year=2026&office=Senate';
async function normalizationCases(){
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
 const fixture=require('./fixtures/openamerica_2026_senate_identity.synthetic.json');
 assert.match(fixture.label,/FICTIONAL/);
 const raw=structuredClone(fixture.document),original=JSON.stringify(raw),normalized=normalizePrimarySource(raw,S);
 assert.equal(JSON.stringify(raw),original,'Do not mutate even the wire-key input');
 assert.deepEqual(Object.keys(normalized),Object.keys(raw),'All top-level keys and order retained');
 assert.deepEqual(Object.keys(normalized.races),fixture.normalized_order,'Replace key in its original property position');
 assert.strictEqual(normalized.races['FL-special'],raw.races.FL,'Preserve exact race object');
 assert.strictEqual(normalized.counts,raw.counts);
 assert.strictEqual(normalized.races.AR,raw.races.AR);
 assert.strictEqual(normalized.races.VA,raw.races.VA);
 const expected={...raw,races:Object.fromEntries(Object.entries(raw.races).map(([k,r])=>[k==='FL'?'FL-special':k,r]))};
 assert.deepEqual(normalized,expected,'No field/value removal, conversion or invention');
 assert.strictEqual(normalizePrimarySource(normalized,S),normalized,'Canonical input is idempotent no-op');
 for(const url of [H,S+'&extra=1',S.replace('https:','http:'),S.replace('openamerica.io','example.org'),S.replace('2026','2024')])
  assert.strictEqual(normalizePrimarySource(raw,url),raw,'Unknown URL cannot authorize alias');
 for(const changes of [{api:2},{api:true},{year:2024},{year:'2026'},{office:'House'},{source:''},{source:'unknown'}]){
  const wrong={...raw,...changes};assert.strictEqual(normalizePrimarySource(wrong,S),wrong,'Wrong scope cannot authorize alias');
 }
 for(const flags of [{is_test:true},{test:true},{mock:true},{is_mock:true},{active:false},{live:false},{stale:true},{counting:false},{final:true}]){
  const marked={...raw,...flags},mapped=normalizePrimarySource(marked,S);
  for(const [key,value]of Object.entries(flags))assert.strictEqual(mapped[key],value,'Never sanitize admission flag '+key);
 }
 for(const mutate of [
  x=>x.races.FL.cands.pop(),
  x=>x.races.FL.cands.push({...x.races.FL.cands[0]}),
  x=>x.races.FL.cands[0].n='Unknown candidate',
  x=>x.races.FL.cands[0].p='R',
  x=>x.races.FL.cands[1]={...x.races.FL.cands[0]},
  x=>x.races.FL.cands[0].n=' '+x.races.FL.cands[0].n
 ]){
  const bad=structuredClone(raw);mutate(bad);const bytes=JSON.stringify(bad);
  assert.throws(()=>normalizePrimarySource(bad,S),/wire candidate roster/);assert.equal(JSON.stringify(bad),bytes);
 }
 const collision=structuredClone(raw);collision.races['FL-special']=structuredClone(collision.races.FL);
 assert.throws(()=>normalizePrimarySource(collision,S),/Ambiguous/,'Even identical dual keys are ambiguous');
 const reversed=structuredClone(raw);reversed.races.FL.cands.reverse();
 assert.deepEqual(normalizePrimarySource(reversed,S).races['FL-special'].cands,reversed.races.FL.cands,'Roster set is order-independent; candidate order is not sorted');
 let gets=0;
 const reader=create(async url=>{gets++;return{ok:true,status:200,url,redirected:false,json:async()=>raw};});
 const a=reader.load(S),b=reader.load(S);assert.strictEqual(a,b);
 assert.deepEqual(await a,expected);assert.equal(gets,1,'Normalize shared response once without extra requests');
 const unqualified=create(async url=>({ok:true,status:200,url,redirected:false,json:async()=>collision}));
 await assert.rejects(unqualified.load(S),/Ambiguous/);assert.equal(unqualified.pending(),0);
 // Fictional migration only, through the actual unchanged source/rollback guards.
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const cut=(a,b)=>{const start=html.indexOf(a),end=html.indexOf(b,start+1);assert(start>=0&&end>start);return html.slice(start,end);};
 const closes=require('./election_night_poll_closings_2026.js');
 class FixtureDate extends Date{static now(){return Date.parse(fixture.observer_now);}}
 const movements=Array.from({length:70},(_,i)=>({office:'Senate',key:'FL',prior:i,current:i+1,delta:1,at:fixture.document.as_of,fingerprint:'FICTIONAL-'+i}));
 const positive=structuredClone(raw);positive.races.FL.total=120;positive.races.FL.cands[1].v=70;positive.races.FL.cands[2].v=50;
 const envelope={schema_version:1,election:'2026-11-03',saved_at:fixture.observer_now,snapshots:{Senate:positive},movements};
 let stored=JSON.stringify(envelope);const storedBefore=stored;
 const initial={sentinel:'unchanged'};
 const ctx={Date:FixtureDate,Set,Map,Object,JSON,Number,Array,Boolean,Math,
  window:{ElectionNightPollClosings2026:closes,ElectionNightOpenAmericaTransport:{normalizePrimarySource}},
  enRemoteBase:'https://openamerica.io/elections/results.json',
  enSupportedStates:new Set('AR AZ CO CT FL GA IA ID IN LA MI MN NC PA RI SC TX UT VA VT WA WV'.split(' ')),
  enResumeKey:'FICTIONAL_RESUME',enResumeWindowMs:72*60*60*1000,
  localStorage:{getItem:()=>stored,setItem:()=>{throw Error('Restore must not write storage');}},
  enOfficeSnapshots:initial,enMovements:[],enRestoredAt:null,enResumePendingOffices:new Set(),
  enModeYear:2026,enOffice:'Senate',enData:null};
 vm.createContext(ctx);
 vm.runInContext(cut('function enElectionVotesAllowed(','function enCompareSnapshots(')+
  cut('function enResumeMovementValid(','function enResumeSave(')+
  cut('function enResumeRestore(','function enSnapshotCompatible(')+
  cut('function enSnapshotCompatible(','function enAcceptSource(')+
  cut('function enFetchUrl(','const enWatchRefreshPending='),ctx);
 assert.equal(ctx.enResumeRestore(),true,'Old raw FL positive resume is normalized in local parsed copy before validation');
 assert.equal(stored,storedBefore,'Raw browser-local saved envelope is not rewritten');
 assert.deepEqual(Object.keys(ctx.enOfficeSnapshots.Senate.races),fixture.normalized_order);
 assert.equal(JSON.stringify(ctx.enMovements),JSON.stringify(movements),'All70 historical movement keys/bytes/order retained');
 assert.equal(ctx.enMovements[0].key,'FL','Historical raw wire movement remains historical');
 assert.equal(ctx.enResumePendingOffices.has('Senate'),true,'Restored data remains pending fresh check');
 const old=ctx.enOfficeSnapshots.Senate,nextRaw=structuredClone(positive);nextRaw.as_of='2026-11-04T01:10:00Z';nextRaw.races.FL.total=130;nextRaw.races.FL.cands[1].v=75;nextRaw.races.FL.cands[2].v=55;
 const next=normalizePrimarySource(nextRaw,S);
 assert.equal(ctx.enSnapshotCompatible(positive,next),false,'Unmigrated counted wire key cannot silently disappear');
 assert.equal(ctx.enSnapshotCompatible(old,next),true,'Canonical migration preserves monotonic source continuity');
 for(const mutate of [
  x=>{x.races['FL-special'].total=119;},
  x=>{x.races['FL-special'].cands[1].v=69;},
  x=>{x.as_of=old.as_of;x.races.AR.total=1;x.races.AR.cands=[{n:'FICTIONAL ADDED',p:'D',v:1,pct:null}];}
 ]){
  const bad=structuredClone(next);mutate(bad);assert.equal(ctx.enSnapshotCompatible(old,bad),false,'Existing decrease/same-clock addition guard retained');
 }
 const badEnvelope=structuredClone(envelope);badEnvelope.snapshots.Senate.races.FL.cands[0].n='Unverified';
 stored=JSON.stringify(badEnvelope);ctx.enOfficeSnapshots=initial;ctx.enMovements=movements;ctx.enResumePendingOffices=new Set();
 assert.equal(ctx.enResumeRestore(),false,'Unqualified raw wire resume is refused atomically');
 assert.strictEqual(ctx.enOfficeSnapshots,initial);assert.strictEqual(ctx.enMovements,movements);assert.equal(ctx.enResumePendingOffices.size,0);
 console.log('Finite Florida Senate alias, unchanged flags/rows/order, no-mutation/collision and atomic pending-resume migration tests passed');
}
async function main(){
 const calls=[];
 let complete;
 const fetch=async(url,opts)=>{
  calls.push({url,opts});
  return new Promise(r=>{complete=r});
 };
 const transport=create(fetch);
 const one=transport.load(H),two=transport.load(H);
 assert.strictEqual(one,two,'Concurrently requested office must share a single promise');
 await Promise.resolve();await Promise.resolve();
 assert.equal(calls.length,1,'Duplicate primary source fetch');
 assert.equal(calls[0].opts.mode,'cors');
 assert.equal(calls[0].opts.credentials,'omit');
 assert.equal(calls[0].opts.cache,'no-cache');
 assert.equal(calls[0].opts.redirect,'error');
 assert.deepEqual(calls[0].opts.headers,{Accept:'application/json'});
 assert.equal(calls[0].opts.signal?.aborted,false);
 assert(!('If-None-Match' in calls[0].opts.headers),
  'Custom conditional header triggers unnecessary cross-origin preflight');
 assert.equal(transport.pending(),1);
 complete({ok:true,status:200,url:H,redirected:false,json:async()=>({api:1,year:2026,office:'House'})});
 assert.deepEqual(await one,{api:1,year:2026,office:'House'});
 assert.equal(transport.pending(),0);
 const another=transport.load(H);
 await Promise.resolve();await Promise.resolve();
 assert.equal(calls.length,2,'A settled successful request may not cache fulfilled votes');
 complete({ok:false,status:503});
 await assert.rejects(another,/HTTP 503/);
 assert.equal(transport.pending(),0);
 let count=0;
 const bad=create(async()=>{count++;throw Error('simulated outage')});
 await assert.rejects(bad.load(H),/simulated outage/);
 await assert.rejects(bad.load(H),/simulated outage/);
 assert.equal(count,2,'A failed request must be retryable, not sticky');
 assert.equal(bad.pending(),0);
 await assert.rejects(transport.load(H.replace('2026','2022')),/Unapproved/);
 await assert.rejects(transport.load(S.replace('openamerica.io','example.org')),/Unapproved/);
 await assert.rejects(transport.load(S+'%26race=FAKE'),/Unapproved/);
 let parallel=0;
 const separate=create(async(url)=>{parallel++;return {ok:true,status:200,url,redirected:false,json:async()=>({})}});
 await Promise.all([separate.load(H),separate.load(S)]);
 assert.equal(parallel,2,'Different offices must remain independent');
 const notJson=create(async(url)=>({ok:true,status:200,url,redirected:false,json:async()=>['bad']}));
 await assert.rejects(notJson.load(H),/not a JSON object/);
 // Only the exact approved final response URL is trusted. Browser-native
 // redirect:'error' rejects the 30x even before Response is made available;
 // the explicit final-URL gate also catches adapter or mock misbehavior.
 for(const actual of [
  'https://evil.example/elections/results.json?year=2026&office=House',
  'http://openamerica.io/elections/results.json?year=2026&office=House',
  'https://openamerica.io/elections/results.json?year=2024&office=House',
  'https://openamerica.io/elections/results.json?year=2026&office=Senate'
 ]){
  const origin=create(async()=>({ok:true,status:200,url:actual,
   redirected:false,json:async()=>({year:2026,office:'House',races:{}})}));
  await assert.rejects(origin.load(H),/approved source URL/);
  assert.equal(origin.pending(),0,'Unapproved response cannot strand retry');
 }
 const redirected=create(async()=>({ok:true,status:200,url:H,
  redirected:true,json:async()=>({year:2026,office:'House',races:{}})}));
 await assert.rejects(redirected.load(H),/approved source URL/);
 // A genuine Response without observable provenance must fail closed.
 if(typeof Response==='function'){
  const unproven=create(async()=>new Response('{}',{status:200}));
  await assert.rejects(unproven.load(H),/approved source URL/);
 }
 // Hung Senate request must fail and release the office even when its
 // custom mock ignores the abort signal. A subsequent request is fresh.
 let hungSignal=null,started=0;
 const hanging=create((_url,options)=>{
  started++;hungSignal=options.signal;
  return new Promise(()=>{});
 },{timeoutMs:25});
 await assert.rejects(hanging.load(S),/timed out/);
 assert.equal(started,1);
 assert.equal(hungSignal.aborted,true);
 assert.equal(hanging.pending(),0,'Timeout must free the watched Senate slot');
 const recovering=create(async(url)=>({ok:true,status:200,url,redirected:false,
  json:async()=>({year:2026,office:'Senate',races:{}})}),{timeoutMs:25});
 assert.equal((await recovering.load(S)).office,'Senate');
 assert.equal(recovering.pending(),0);
 assert.throws(()=>create(fetch,{timeoutMs:0}),/Bounded/);
 await normalizationCases();
 console.log('Open America conditional-cache, coalescing, timeout recovery and independent-office tests passed');
}
main().catch(e=>{console.error(e);process.exitCode=1});
