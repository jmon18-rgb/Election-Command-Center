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
 assert.deepEqual(calls[0].opts,{mode:'cors',credentials:'omit',
  cache:'no-cache',headers:{Accept:'application/json'}});
 assert(!('If-None-Match' in calls[0].opts.headers),
  'Custom conditional header triggers unnecessary cross-origin preflight');
 assert.equal(transport.pending(),1);
 complete({ok:true,status:200,json:async()=>({api:1,year:2026,office:'House'})});
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
 const separate=create(async(_url)=>{parallel++;return {ok:true,status:200,json:async()=>({})}});
 await Promise.all([separate.load(H),separate.load(S)]);
 assert.equal(parallel,2,'Different offices must remain independent');
 const notJson=create(async()=>({ok:true,status:200,json:async()=>['bad']}));
 await assert.rejects(notJson.load(H),/not a JSON object/);
 console.log('Open America conditional-cache, coalescing, rejection, outage and independent-office tests passed');
}
main().catch(e=>{console.error(e);process.exitCode=1});
