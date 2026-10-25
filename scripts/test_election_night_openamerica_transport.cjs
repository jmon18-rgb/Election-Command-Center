const assert=require('node:assert/strict');
const {create}=require('./election_night_openamerica_transport');
const H='https://openamerica.io/elections/results.json?year=2026&office=House';
const S='https://openamerica.io/elections/results.json?year=2026&office=Senate';
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
  'https://openamerica.io/elections/results.json?year=2026&office=Senate',
  undefined
 ]){
  const origin=create(async()=>({ok:true,status:200,url:actual,
   redirected:false,json:async()=>({year:2026,office:'House',races:{}})}));
  await assert.rejects(origin.load(H),/approved source URL/);
  assert.equal(origin.pending(),0,'Unapproved response cannot strand retry');
 }
 const redirected=create(async()=>({ok:true,status:200,url:H,
  redirected:true,json:async()=>({year:2026,office:'House',races:{}})}));
 await assert.rejects(redirected.load(H),/approved source URL/);
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
 console.log('Open America conditional-cache, coalescing, timeout recovery and independent-office tests passed');
}
main().catch(e=>{console.error(e);process.exitCode=1});
