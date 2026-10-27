'use strict';
// Synthetic clock/network only: verifies actual production-loop starts/writes.
const assert=require('node:assert/strict'),{fixture}=require('./washington_test_fixture.cjs');
const {fixture:estimates}=require('./washington_remaining_test_fixture.cjs'),source=require('./washington_official_house_source.js'),remaining=require('./washington_remaining_source.js');
const publisher=require('./publish_washington_official_cache.cjs'),cache=require('./washington_official_cache.js');
(async()=>{
 const saved={argv:process.argv,now:Date.now,fetch:global.fetch,timer:global.setTimeout,token:process.env.GITHUB_TOKEN};
 try{for(const jobAt of ['2026-11-04T04:05:00Z','2026-11-04T17:00:00Z','2026-11-05T12:00:00Z'])for(const failFirst of [false,true]){
  let clock=Date.parse(jobAt),stored=null;const starts=[],jobStart=clock;const firstNight=clock<Date.parse('2026-11-04T17:00:00Z'),expectedStarts=firstNight?4:1;
  Date.now=()=>clock;process.argv=['node','publisher','--publish','--loop'];process.env.GITHUB_TOKEN='synthetic-offline-token';
  global.setTimeout=(fn,ms,...args)=>ms===60000?(clock+=ms,queueMicrotask(()=>fn(...args)),0):saved.timer(fn,ms,...args);
  global.fetch=async(url,opts={})=>{
   if(url===source.URL||url===remaining.URL){starts.push({url,at:clock});
    if(url===remaining.URL){assert.equal(opts.redirect,'error');return Response.json(estimates({stamp:new Date(clock).toISOString()}).payload);}
    if(failFirst&&starts.length===1)return new Response('temporary outage',{status:503});
    return Response.json((await fixture({stamp:new Date(clock).toISOString()})).payload);
   }
   const base='https://api.github.com/repos/'+publisher.REPO;assert(url.startsWith(base),'No unapproved source/repository request');const suffix=url.slice(base.length);
   if(!suffix)return Response.json({full_name:publisher.REPO,default_branch:'main'});
   if(suffix.startsWith('/git/ref/'))return Response.json({object:{sha:'existing-data-branch'}});
   if(suffix.startsWith('/contents/')&&opts.method==='GET')return stored?Response.json(stored):new Response('missing',{status:404});
   if(opts.method==='PUT'){const body=JSON.parse(opts.body);assert.equal(body.branch,cache.BRANCH);assert.equal(suffix,'/contents/'+cache.PATH);stored={sha:'offline-only',content:body.content};return Response.json({commit:{sha:'synthetic-no-network'}});}
   throw Error('Unexpected repository operation');
  };
  await publisher.main();assert.equal(starts.length,expectedStarts);for(let i=1;i<expectedStarts;i++)assert(starts[i].at-starts[i-1].at>=60000);
  assert(starts[0].at-jobStart>=60000);
  assert.deepEqual(starts.map(x=>x.url),!firstNight?[source.URL]:failFirst?[source.URL,source.URL,source.URL,source.URL]:[source.URL,remaining.URL,source.URL,source.URL]);
  const published=JSON.parse(Buffer.from(stored.content,'base64'));assert.equal(Boolean(published.official_remaining),firstNight&&!failFirst);
  const ended=clock;await publisher.main();assert.equal(starts.length,2*expectedStarts);assert(starts[expectedStarts].at-ended>=60000,'Back-to-back serialized jobs also retain the native floor');
  for(let i=1;i<starts.length;i++)assert(starts[i].at-starts[i-1].at>=60000);
 }}finally{process.argv=saved.argv;Date.now=saved.now;global.fetch=saved.fetch;global.setTimeout=saved.timer;if(saved.token===undefined)delete process.env.GITHUB_TOKEN;else process.env.GITHUB_TOKEN=saved.token;}
 console.log('PASS: actual first-night loop uses four native starts >=60s apart, three counts+one estimate only after positive counts, later jobs at/after17Z retain ONE counts read with no stats/cadence tradeoff, data-only writes; SYNTHETIC');
})().catch(e=>{console.error(e);process.exitCode=1;});
