#!/usr/bin/env node
/**
 * Real elapsed-time Chromium browser-tab check on PUBLIC GitHub Pages.
 * No fictional returns, network interception, source cache rewrite, or forecast writes.
 * This establishes transport/UI resilience only, NOT 2026 vote coverage or calls.
 */
import {writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {performance} from 'node:perf_hooks';
import {createRequire} from 'node:module';
const {assess}=createRequire(import.meta.url)('./election_night_browser_soak_acceptance.cjs');
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
 // Playwright waitForFunction polls *inside* the target tab; real background
 // Chrome tabs may freeze that timer/RAF entirely. Observe visibility using
 // the controlling Node clock and one-shot CDP page evaluations instead.
 const awaitRealVisibility=async(page,wantHidden,timeoutMs=15000)=>{
  const deadline=performance.now()+timeoutMs;
  let last=null;
  while(performance.now()<deadline){
   last=await page.evaluate(()=>document.hidden);
   if(last===wantHidden)return;
   await sleep(250);
  }
  throw Error('Real Chromium document.hidden remained '+String(last)+
   ' rather than '+String(wantHidden)+' after OS/tab focus change');
 };
 const report={
  schema:'real-election-browser-tab-v1',status:'NOT_FINISHED',
  opened_at:new Date().toISOString(),site:URL_SITE,
  requested_minutes:minutes,interval_seconds:interval,
  fixture_votes:false,simulated_clock:false,
  authoritative_calls_verified:false,live_results_availability_proven:false,
  geographic_needle_calibrated:false,
  checkpoints:0,healthy_checkpoints:0,
  background_visibility_confirmed:false,background_resume_observed:false,
  physical_background_method:null,
  resumed_tab_visible:false,post_resume_primary_requests:0,
  post_resume_primary_healthy_responses:0,
  post_resume_refresh_trigger:null,
  source_requests:{primary:0,supplemental:0},
  primary_healthy_responses:0,
  source_request_failures:0,source_http_errors:0,page_script_errors:0,
  audit_errors:0,probes:[],errors:[],
  browser_operation_trace:[],last_browser_operation:'BROWSER_NOT_LAUNCHED'
 };
 const mark=step=>{
  report.last_browser_operation=step;
  report.browser_operation_trace.push({
   step,elapsed_s:soakStart===null?null:
    Math.round((performance.now()-soakStart)/1000)
  });
 };
 let browser,soakStart=null,resumed=false,originalWindowMinimized=null;
 try{
  // Chromium's headless shell leaves document.hidden=false for background
  // tabs. Use real headed Chromium under CI Xvfb so visibilitychange can be
  // observed rather than faking it with injected document properties.
  mark('LAUNCH_HEADED_CHROMIUM');
  browser=await chromium.launch({
   headless:false,args:['--no-sandbox'],
   // Keep actual Chromium background/visibility behavior rather than
   // Playwright's fast, unthrottled background-tab testing defaults.
   ignoreDefaultArgs:['--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows']
  });
  const ctx=await browser.newContext({viewport:{width:1440,height:900},
   serviceWorkers:'block',reducedMotion:'reduce'});
  const tab=await ctx.newPage();
  // Playwright forces every controlled page to look focused using CDP,
  // including tabs the human could no longer see. Disable this emulation
  // on both tabs before attempting to measure real visibility changes.
  const pageCDP=await ctx.newCDPSession(tab);
  await pageCDP.send('Emulation.setFocusEmulationEnabled',{enabled:false});
  tab.on('pageerror',()=>{report.page_script_errors++});
  tab.on('request',req=>{
   const u=req.url();
   if(u.startsWith('https://openamerica.io/elections/results.json')){
    report.source_requests.primary++;
    if(resumed)report.post_resume_primary_requests++;
   }
   if(u.startsWith('https://civicapi.org/api/v2/'))
    report.source_requests.supplemental++;
  });
  tab.on('requestfailed',req=>{
   if(/^https:\/\/(?:openamerica\.io|civicapi\.org)\//.test(req.url()))
    report.source_request_failures++;
  });
  tab.on('response',res=>{
   if(res.url().startsWith('https://openamerica.io/elections/results.json')&&
      [200,304].includes(res.status())){
    report.primary_healthy_responses++;
    if(resumed)report.post_resume_primary_healthy_responses++;
   }
   if(res.status()>=400&&
      /^https:\/\/(?:openamerica\.io|civicapi\.org)\//.test(res.url()))
    report.source_http_errors++;
  });
  mark('LOAD_DEPLOYED_DASHBOARD');
  await tab.goto(URL_SITE,{waitUntil:'domcontentloaded',timeout:60000});
  await tab.locator('[data-page="electionNight"]').click({timeout:30000});
  await tab.locator('#enMode2026').click({timeout:30000});
  await tab.waitForFunction(()=>
   document.querySelector('#enSourceReadiness')?.textContent?.includes('506 races'),
   undefined,{timeout:45000});
  // Start after the actual 506-race dashboard is rendered: browser launch
  // and network navigation cannot count toward the measured active-tab soak.
  soakStart=performance.now();
  mark('DASHBOARD_RENDERED_REAL_CLOCK_STARTED');
  let secondary=null;
  const total=minutes*60000,period=interval*1000;
  const steps=Math.floor(total/period);
  for(let step=0;step<=steps;step++){
   const until=soakStart+step*period-performance.now();
   if(until>0)await sleep(until);
   // A separate tab briefly backgrounds and then reactivates the dashboard.
   // This is NOT claimed to simulate OS sleep or a source outage.
   if(step===Math.floor(steps/3)){
    mark('BACKGROUND_BEGIN_USER_OPEN_NEW_TAB');
    // context.newPage() creates an independently focus-emulated Playwright
    // page, NOT necessarily a browser tab the person actually switched to.
    // Click a genuine target=_blank link inside the existing Chrome window:
    // this creates a real user-initiated browser tab and activation change.
    await tab.evaluate(()=>{
     const a=document.createElement('a');
     a.id='enSoakOpenBlankTab';a.href='about:blank';a.target='_blank';
     a.textContent='Open blank tab (real-tab test)';
     a.style.cssText='position:fixed;left:8px;top:8px;z-index:2147483646;'+
      'background:#fff;color:#000;padding:12px;font:16px sans-serif';
     document.body.appendChild(a);
    });
    mark('BACKGROUND_WAIT_FOR_POPUP');
    const popupPromise=tab.waitForEvent('popup',{timeout:10000});
    await tab.locator('#enSoakOpenBlankTab').click({timeout:10000});
    secondary=await popupPromise;
    mark('BACKGROUND_POPUP_OBSERVED');
    await secondary.waitForLoadState('domcontentloaded');
    const backgroundCDP=await ctx.newCDPSession(secondary);
    await backgroundCDP.send('Emulation.setFocusEmulationEnabled',{enabled:false});
    mark('BACKGROUND_SWITCH_TO_SECONDARY');
    await secondary.bringToFront();
    // A Chromium "popup" may be a *second OS window*, not a second tab.
    // Merely bringing it forward does not hide a still-visible first
    // window. In that case minimize the original real Chromium window
    // through Chrome's Browser window manager, NOT DOM/visibility
    // emulation, timers, synthetic visibilitychange or Page lifecycle.
    // Document.hidden must still independently become true.
    if(!await tab.evaluate(()=>document.hidden)){
     mark('BACKGROUND_MINIMIZE_ORIGINAL_OS_CHROME_WINDOW');
     const {windowId}=await pageCDP.send('Browser.getWindowForTarget');
     if(!Number.isSafeInteger(windowId)||windowId<0)
      throw Error('No actual Chromium window associated with original tab');
     await pageCDP.send('Browser.setWindowBounds',{
      windowId,bounds:{windowState:'minimized'}
     });
     originalWindowMinimized=windowId;
     report.physical_background_method='REAL_CHROMIUM_OS_WINDOW_MINIMIZED';
    }else{
     report.physical_background_method='REAL_CHROMIUM_TAB_SWITCH';
    }
    // Genuine minimized Chrome tabs can stop their own timers;
    // host-side elapsed polling still observes real document visibility.
    mark('BACKGROUND_WAIT_FOR_TRUE_DOCUMENT_HIDDEN');
    await awaitRealVisibility(tab,true);
    report.background_visibility_confirmed=
      await tab.evaluate(()=>document.hidden);
    mark('BACKGROUND_TRUE_DOCUMENT_HIDDEN_CONFIRMED');
   }else if(step===Math.floor(steps/3)+2&&secondary){
    // Network requests may fire synchronously from visibilitychange/focus.
    // Arm attribution BEFORE bringing the original tab to the foreground,
    // or an actual successful autonomous refresh could be misclassified as
    // having happened "before resume".
    resumed=true;
    mark('FOREGROUND_ACTIVATE_ORIGINAL_TAB');
    if(originalWindowMinimized!==null){
     mark('FOREGROUND_RESTORE_ORIGINAL_OS_CHROME_WINDOW');
     await pageCDP.send('Browser.setWindowBounds',{
      windowId:originalWindowMinimized,bounds:{windowState:'normal'}
     });
     originalWindowMinimized=null;
    }
    await tab.bringToFront();await secondary.close();secondary=null;
    mark('FOREGROUND_WAIT_FOR_TRUE_VISIBLE');
    await awaitRealVisibility(tab,false);
    report.resumed_tab_visible=await tab.evaluate(()=>{
     document.getElementById('enSoakOpenBlankTab')?.remove();
     return !document.hidden;
    });
    report.background_resume_observed=true;
    mark('FOREGROUND_TRUE_VISIBILITY_CONFIRMED');
    // Before Election Day, the standby feed intentionally uses a slower
    // ten-minute cadence. In a five-minute PR rehearsal, explicitly click
    // the owner-facing 2026 refresh control after resume. Never report this
    // as autonomous Election Night recovery. Once the election-day window
    // begins, do NOT intervene; require the real visibility/focus handler.
    if(Date.now()<Date.parse('2026-11-03T05:00:00Z')){
     report.post_resume_refresh_trigger='MANUAL_OWNER_CONTROL_PRE_ELECTION';
     await tab.locator('#enMode2026').click({timeout:30000});
    }else{
     report.post_resume_refresh_trigger='AUTONOMOUS_ELECTION_DAY_FOCUS';
    }
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
    report.probes.push({step,elapsed_s:Math.round((performance.now()-soakStart)/1000),
     ui_healthy:good,primary_attempts:report.source_requests.primary,
     primary_healthy_responses:report.primary_healthy_responses,
     supplementary_attempts:report.source_requests.supplemental});
  }
  await secondary?.close();await ctx.close();
 }catch(error){
  const detail=String(error?.message||'').slice(0,450)
   .replace(/https?:\/\/[^\s]+/g,'[url redacted]');
  report.errors.push('Browser runtime failed at '+
   report.last_browser_operation+': '+String(error?.name||'UnknownError')+
   (detail?' — '+detail:''));
  // Preserve only bounded stage names/times; never serialize page data,
  // API body, cookies, tokens, screenshot, candidate votes or private URLs.
 }finally{
  await browser?.close();
  report.finished_at=new Date().toISOString();
  report.actual_elapsed_seconds=soakStart===null?0:
   Math.round((performance.now()-soakStart)/1000);
  const acceptance=assess(report,minutes,interval);
  report.acceptance_checks=acceptance.checks;
  const success=acceptance.passed;
  report.status=success?'PASS_REAL_BROWSER_TRANSPORT_ONLY':'FAIL_BROWSER_TAB_OR_REFRESH';
  await mkdir(dirname(output),{recursive:true});
  await writeFile(output,JSON.stringify(report,null,2)+'\n','utf8');
  console.log(JSON.stringify({...report,probes:report.probes.slice(-4)},null,2));
  if(!success)process.exitCode=1;
 }
}
