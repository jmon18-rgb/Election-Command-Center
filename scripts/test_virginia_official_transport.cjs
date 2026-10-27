const assert=require('node:assert/strict'),{create,MAX_BYTES}=require('./virginia_official_transport.js'),{fetchURL}=require('./virginia_official_cache.js');const URL=fetchURL();
const reply=(body,options={})=>{const r=new Response(body,{headers:{'content-type':'application/json'},...options});Object.defineProperty(r,'url',{value:URL});return r;};
(async()=>{
 let calls=0,active=true,generation=1,queued;
 const pool={run:(fn,opts)=>{assert.equal(opts.priority,true);return fn();}};
 const fetchSource=create({pool,fetchImpl:async()=>{calls++;return reply('{"ok":true}');},isActive:()=>active,sourceGeneration:()=>generation});
 assert.deepEqual(await fetchSource(URL),{ok:true});assert.equal(calls,1);
 await assert.rejects(()=>fetchSource(URL+'?light='),/Unapproved/);assert.equal(calls,1);
 for(const response of [()=>reply('x',{status:503}),()=>reply('x',{headers:{'content-type':'text/html'}}),()=>reply(' '.repeat(MAX_BYTES+1))]){
  await assert.rejects(()=>create({pool,fetchImpl:async()=>response()})(URL));
 }
 const redirected=()=>{const r=reply('{}');Object.defineProperty(r,'redirected',{value:true});return r;};
 await assert.rejects(()=>create({pool,fetchImpl:async()=>redirected()})(URL),/identity/);
 const waiting=create({pool:{run:fn=>new Promise((ok,bad)=>{queued=()=>fn().then(ok,bad);})},fetchImpl:async()=>{calls++;return reply('{}');},isActive:()=>active,sourceGeneration:()=>generation});
 const pending=waiting(URL);active=false;generation++;queued();await assert.rejects(()=>pending,/no longer active/);assert.equal(calls,1,'Queued hidden/archive request never reaches official origin');
 console.log('VA02 allowlist, independent reserved pool, bounded stream/size/status/redirect and queued-generation guards PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
