#!/usr/bin/env node
/**
 * Real elapsed-time Chromium browser-tab check on PUBLIC GitHub Pages.
 * No fictional returns, network interception, source cache rewrite, or forecast writes.
 * This establishes transport/UI resilience only, NOT 2026 vote coverage or calls.
 */
import {writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {performance} from 'node:perf_hooks';
const URL_SITE='https://jmon18-rgb.github.io/Election-Command-Center/';
const opts=new Map();
for(const arg of process.argv.slice(2)){
 const m=/^--([a-z-]+)(?:=(.+))?$/.exec(arg);
 if(!m||opts.has(m[1]))throw Error('Invalid duplicate browser soak argument');
 opts.set(m[1],m[2]??'true');
}
for(const a of opts.keys())if(!['duration-minutes','interval-seconds','output','check-config'].includes(a))
 throw Error('Unknown browser soak argument '+a);
const minutes=Number(opts.get('duration-minutes')??120),
 interval=Number(opts.get('interval-seconds')??60),
 output=opts.get('output')??'/tmp/real_election_browser_tab_soak.json';
if(!Number.isInteger(minutes)||minutes<5||minutes>180||
 !Number.isInteger(interval)||interval<30||interval>300||
 typeof output!=='string'||!output.endsWith('.json'))
 throw Error('Duration 5-180 min, cadence 30-300 s and JSON output required');
if(opts.has('check-config')){
 console.log(JSON.stringify({schema:'real-election-browser-tab-v1',
  minutes,interval,source_fixture:false,clock_fixture:false}));
}else{
 const {chromium}=await import('playwright');
 const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const start=performance.now(),report={
  schema:'real-election-browser-tab-v1',status:'NOT_FINISHED',
  opened_at:new Date().toISOString(),site:URL_SITE,
  requested_minutes:minutes,interval_seconds:interval,
  fixture_votes:false,simulated_clock:false,
  authoritative_calls_verified:false,live_results_availability_proven:false,
  geographic_needle_calibrated:false,
  checkpoints:0,healthy_checkpoints:0,background_resume_observed:false,
  source_requests:{primary:0,supplemental:0},
  source_request_failures:0,source_http_errors:0,page_script_errors:0,
  audit_errors:0,probes:[],errors:[]
 };
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const ctx=await browser.newContext({viewport:{width:1440,height:900},
   serviceWorkers:'block',reducedMotion:'reduce'});
  const tab=await ctx.newPage();
  tab.on('pageerror',()=>{report.page_script_errors++});
  tab.on('request',req=>{
   const u=req.url();
   if(u.startsWith('https://openamerica.io/elections/results.json'))
    report.source_requests.primary++;
   if(u.startsWith('https://civicapi.org/api/v2/'))
    report.source_requests.supplemental++;
  });
  tab.on('requestfailed',req=>{
   if(/^https:\/\/(?:openamerica\.io|civicapi\.org)\//.test(req.url()))
    report.source_request_failures++;
  });
  tab.on('response',res=>{
   if(res.status()>=400&&
      /^https:\/\/(?:openamerica\.io|civicapi\.org)\//.test(res.url()))
    report.source_http_errors++;
  });
  await tab.goto(URL_SITE,{waitUntil:'domcontentloaded',timeout:60000});
  await tab.locator('[data-page="electionNight"]').click({timeout:30000});
  await tab.locator('#enMode2026').click({timeout:30000});
  await tab.waitForFunction(()=>
   document.querySelector('#enSourceReadiness')?.textContent?.includes('506 races'),
   undefined,{timeout:45000});
  let secondary=null;
  const total=minutes*60000,period=interval*1000;
  const steps=Math.floor(total/period);
  for(let step=0;step<=steps;step++){
   const until=start+step*period-performance.now();
   if(until>0)await sleep(until);
   // A separate tab briefly backgrounds and then reactivates the dashboard.
   // This is NOT claimed to simulate OS sleep or a source outage.
   if(step===Math.floor(steps/3)){
    secondary=await ctx.newPage();await secondary.goto('about:blank');
   }else if(step===Math.floor(steps/3)+2&&secondary){
    await tab.bringToFront();await secondary.close();secondary=null;
    report.background_resume_observed=true;
   }
   const state=await tab.evaluate(()=>{
    const text=document.querySelector('#enLiveCoverageTriage')?.textContent||'';
    return {active:!!document.querySelector('#electionNight.page.active'),
     sourceReadiness:!!document.querySelector('#enSourceReadiness')?.textContent?.includes('506 races'),
     deskPresent:text.includes('506 RACES'),
     coverageError:text.includes('Coverage audit unavailable')};
   });
   report.checkpoints++;
   const good=state.active&&state.sourceReadiness&&state.deskPresent&&!state.coverageError;
   if(good)report.healthy_checkpoints++;
   if(state.coverageError)report.audit_errors++;
   if(!good)report.errors.push('Unhealthy national desk checkpoint '+step);
   if(step%Math.max(1,Math.floor(300/interval))===0||step===steps)
    report.probes.push({step,elapsed_s:Math.round((performance.now()-start)/1000),
     ui_healthy:good,primary_attempts:report.source_requests.primary,
     supplementary_attempts:report.source_requests.supplemental});
  }
  await secondary?.close();await ctx.close();
 }catch(error){
  report.errors.push('Browser runtime failed: '+String(error?.name||'UnknownError'));
 }finally{
  await browser?.close();
  report.finished_at=new Date().toISOString();
  report.actual_elapsed_seconds=Math.round((performance.now()-start)/1000);
  const minRequests=Math.max(2,Math.floor(minutes/10));
  const success=report.checkpoints>=Math.floor(minutes*60/interval)&&
   report.healthy_checkpoints===report.checkpoints&&
   report.background_resume_observed&&report.source_requests.primary>=minRequests&&
   report.page_script_errors===0&&report.audit_errors===0&&report.errors.length===0;
  report.status=success?'PASS_REAL_BROWSER_TRANSPORT_ONLY':'FAIL_BROWSER_TAB_OR_REFRESH';
  await mkdir(dirname(output),{recursive:true});
  await writeFile(output,JSON.stringify(report,null,2)+'\n','utf8');
  console.log(JSON.stringify({...report,probes:report.probes.slice(-4)},null,2));
  if(!success)process.exitCode=1;
 }
}
