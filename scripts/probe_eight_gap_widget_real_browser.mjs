#!/usr/bin/env node
// Real Chrome CORS check (never vote ingestion, no fixtures or fake clock).
import {chromium} from 'playwright';
import {createServer} from 'node:http';
const slugs=['ak-house-00','de-house-00','nd-house-00','nh-house-01',
 'nh-house-02','sd-house-00','wy-house-00','ma-senate'];
const server=createServer((req,res)=>{
 res.writeHead(200,{'content-type':'text/html','cache-control':'no-store'});
 res.end('<!doctype html><html><title>Provider origin check</title></html>');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:'+server.address().port+'/');
 const rows=await page.evaluate(async urls=>{
  const out=[];
  for(const slug of urls){
   try{
    const abort=new AbortController(),id=setTimeout(()=>abort.abort(),14000);
    const response=await fetch('https://watch.vote/api/widgets/race/'+slug,
      {headers:{Accept:'application/json'},signal:abort.signal});
    clearTimeout(id);
    const data=await response.json().catch(()=>null);
    const expected='2026-'+slug;
    out.push({slug,status:response.status,
      exact_2026:response.ok&&data?.version===1&&
       data.raceSlug===slug&&data.raceId===expected&&
       data.electionDate==='2026-11-03'&&
       (data.results===null||typeof data.results==='object'),
      returned_race_id:data?.raceId||null,
      results_present:Boolean(data?.results)});
   }catch(error){out.push({slug,exact_2026:false,
     error_type:error.name})}
  }
  return out;
 },slugs);
 const successes=rows.filter(r=>r.exact_2026).length;
 console.log(JSON.stringify({status:'NATIVE_CROSS_ORIGIN_2026_WIDGET_PROBE',
  checked:8,verified:successes,rows},null,2));
 if(successes!==8)process.exitCode=1;
}finally{await browser?.close();server.close()}
