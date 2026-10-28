'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto'),native=require('./official_native_archive.cjs'),publisher=require('./publish_virginia_official_cache.cjs'),source=require('./virginia_official_house_source.js'),cache=require('./virginia_official_cache.js');
(async()=>{const saved={argv:process.argv,now:Date.now,fetch:global.fetch,token:process.env.GITHUB_TOKEN,factory:native.createForWorkflow,log:console.log};
 try{
  let clock=Date.parse('2026-10-28T17:00:00Z'),requests=0,captured=[],outcomes=[],stored=null;Date.now=()=>clock;console.log=()=>{};process.argv=['node','publisher','--publish','--bootstrap'];global.fetch=async()=>{requests++;throw Error('Bootstrap must never fetch');};await publisher.main();assert.equal(requests,0,'Automatic pre-election bootstrap makes no native or repository request');
  clock=Date.parse('2026-11-04T00:05:00Z');process.argv=['node','publisher','--publish'];process.env.GITHUB_TOKEN='synthetic-offline-token';native.createForWorkflow=()=>({enabled:true,record:e=>captured.push(e),publication:r=>outcomes.push(r)});
  global.fetch=async(url,options={})=>{
   if(url===source.URL){requests++;const fixture=require('./virginia_house_02_test_fixture.cjs').fixture({stamp:new Date(clock-60000).toISOString()}),r=Response.json(fixture);Object.defineProperty(r,'url',{value:source.URL});return r;}
   const base='https://api.github.com/repos/'+publisher.REPO;assert(url.startsWith(base));const suffix=url.slice(base.length);
   if(!suffix)return Response.json({full_name:publisher.REPO,default_branch:'main'});if(suffix.startsWith('/git/ref/'))return Response.json({object:{sha:'existing-data-branch'}});
   if(suffix.startsWith('/contents/')&&options.method==='GET')return stored?Response.json(stored):new Response('missing',{status:404});
   if(options.method==='PUT'){const value=JSON.parse(options.body);assert.equal(value.branch,cache.BRANCH);stored={sha:'synthetic',content:value.content};return Response.json({commit:{sha:'synthetic-data-only'}});}throw Error('Unexpected repository request');
  };
  await publisher.main();assert.equal(requests,1);assert.equal(captured.length,1);assert.equal(captured[0].kind,'counts');assert.equal(captured[0].source_url,source.URL);assert(Buffer.isBuffer(captured[0].raw));assert.equal(crypto.createHash('sha256').update(captured[0].raw).digest('hex'),captured[0].result.original_response_sha256);assert.equal(outcomes.length,1);assert(outcomes[0].changed);assert.equal(JSON.parse(Buffer.from(stored.content,'base64')).payload.ballotItemWithBreakdown.id,captured[0].result.payload.ballotItemWithBreakdown.id);
 }finally{process.argv=saved.argv;Date.now=saved.now;global.fetch=saved.fetch;native.createForWorkflow=saved.factory;console.log=saved.log;if(saved.token===undefined)delete process.env.GITHUB_TOKEN;else process.env.GITHUB_TOKEN=saved.token;}
 console.log('VA actual publisher path: zero-GET bootstrap, one fixed native request, exact sink body/hash and separate data-only publication outcome PASS; synthetic network only.');
})().catch(e=>{console.error(e);process.exitCode=1;});
