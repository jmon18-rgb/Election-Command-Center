#!/usr/bin/env node
/* Real headed Chromium Election Night tab and HTTP soak.
 * Native browser CDP intentionally does NOT attach Playwright to the
 * monitored tab. Playwright emulates focus/visibility and can keep
 * document.hidden=false when a real Chrome tab is in the background.
 * The website and its provider responses are never intercepted or mocked.
 */
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp,rm,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {performance} from 'node:perf_hooks';
import {createRequire} from 'node:module';
const {assess}=createRequire(import.meta.url)('./election_night_browser_soak_acceptance.cjs');
const SITE='https://jmon18-rgb.github.io/Election-Command-Center/';
const args=new Map();
for(const arg of process.argv.slice(2)){
 const match=/^--([a-z-]+)(?:=(.+))?$/.exec(arg);
 if(!match||args.has(match[1]))throw Error('Invalid duplicate browser soak argument');
 args.set(match[1],match[2]??'true');
}
for(const name of args.keys())if(![
 'duration-minutes','interval-seconds','output','check-config'
].includes(name))throw Error('Unknown browser soak argument '+name);
const minutes=Number(args.get('duration-minutes')??120),
 interval=Number(args.get('interval-seconds')??60),
 output=args.get('output')??'/tmp/real_election_browser_tab_soak.json';
if(!Number.isInteger(minutes)||minutes<5||minutes>180||
 !Number.isInteger(interval)||interval<30||interval>300||
 typeof output!=='string'||!output.endsWith('.json'))
 throw Error('Duration 5-180 minutes, interval 30-300 seconds and JSON output required');
if(args.has('check-config')){
 console.log(JSON.stringify({schema:'real-election-browser-tab-v1',minutes,interval,
  source_fixture:false,clock_fixture:false}));
}else{
 const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const report={
  schema:'real-election-browser-tab-v1',status:'NOT_FINISHED',
  opened_at:new Date().toISOString(),site:SITE,
  requested_minutes:minutes,interval_seconds:interval,
  fixture_votes:false,simulated_clock:false,authoritative_calls_verified:false,
  live_results_availability_proven:false,geographic_needle_calibrated:false,
  checkpoints:0,healthy_checkpoints:0,
  background_visibility_confirmed:false,background_resume_observed:false,
  resumed_tab_visible:false,physical_background_method:null,
  post_resume_primary_requests:0,post_resume_primary_healthy_responses:0,
  post_resume_refresh_trigger:null,
  source_requests:{primary:0,supplemental:0},primary_healthy_responses:0,
  source_request_failures:0,source_http_errors:0,
  page_script_errors:0,audit_errors:0,probes:[],errors:[],
  browser_operation_trace:[],last_browser_operation:'NOT_STARTED'
 };
 let proc=null,profile=null,cdp=null,tabSession=null,tabTarget=null,
  start=null,resumed=false;
 const mark=step=>{
  report.last_browser_operation=step;
  report.browser_operation_trace.push({
   step,elapsed_s:start===null?null:Math.round((performance.now()-start)/1000)
  });
 };
 async function freePort(){
  const server=createServer();
  await new Promise((resolve,reject)=>{
   server.once('error',reject);server.listen(0,'127.0.0.1',resolve);
  });
  const port=server.address().port;
  await new Promise(resolve=>server.close(resolve));
  return port;
 }
 class Protocol {
  constructor(socket){
   this.socket=socket;this.next=1;this.pending=new Map();this.callbacks=new Map();
   socket.addEventListener('message',event=>{
    let value;
    try{value=JSON.parse(event.data)}catch{return}
    if(value.id){
     const request=this.pending.get(value.id);
     if(!request)return;
     this.pending.delete(value.id);
     if(value.error)request.reject(Error(value.error.message||'CDP command error'));
     else request.resolve(value.result||{});
    }else{
     for(const cb of this.callbacks.get(value.method)||[]){
      try{cb(value.params||{},value.sessionId||null)}catch{}
     }
    }
   });
   socket.addEventListener('close',()=>{
    for(const waiter of this.pending.values())waiter.reject(Error('Browser disconnected'));
    this.pending.clear();
   });
  }
  on(name,callback){
   const list=this.callbacks.get(name)||new Set();
   list.add(callback);this.callbacks.set(name,list);
  }
  send(method,params={},sessionId=null){
   return new Promise((resolve,reject)=>{
    const id=this.next++;this.pending.set(id,{resolve,reject});
    try{
     this.socket.send(JSON.stringify({id,method,params,
      ...(sessionId?{sessionId}:{})}));
    }catch(error){
     this.pending.delete(id);reject(error);
    }
   });
  }
  close(){this.socket.close()}
 }
 async function launchNative(){
  mark('LAUNCH_NATIVE_CHROMIUM_NO_PLAYWRIGHT_FOCUS_EMULATION');
  if(!process.env.DISPLAY)throw Error('Headed Chrome needs real X11 DISPLAY');
  const {chromium}=await import('playwright');
  const bin=chromium.executablePath();
  profile=await mkdtemp(join(tmpdir(),'real-election-native-chrome-'));
  const port=await freePort();
  proc=spawn(bin,['--no-sandbox','--no-first-run','--no-default-browser-check',
   '--disable-dev-shm-usage','--disable-extensions',
   '--user-data-dir='+profile,'--remote-debugging-port='+port,
   '--remote-allow-origins=*','about:blank'],{stdio:'ignore'});
  let info=null;
  for(let n=0;n<100;n++){
   if(proc.exitCode!==null)throw Error('Headed Chromium unexpectedly exited');
   try{
    const response=await fetch('http://127.0.0.1:'+port+'/json/version');
    if(response.ok){info=await response.json();break}
   }catch{}
   await sleep(250);
  }
  if(!info?.webSocketDebuggerUrl)
   throw Error('Native headed Chromium did not expose CDP');
  const socket=new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{
   socket.addEventListener('open',resolve,{once:true});
   socket.addEventListener('error',reject,{once:true});
  });
  return new Protocol(socket);
 }
 const evaluate=async expression=>{
  const response=await cdp.send('Runtime.evaluate',{
   expression,returnByValue:true,awaitPromise:true
  },tabSession);
  if(response.exceptionDetails)throw Error('Native page runtime evaluation failed');
  return response.result?.value;
 };
 const waitFor=async(expression,timeout=45000)=>{
  const stop=performance.now()+timeout;
  while(performance.now()<stop){
   const value=await evaluate(expression);
   if(value)return value;
   await sleep(250);
  }
  throw Error('Actual page readiness/visibility expectation not satisfied');
 };
 const waitHidden=async(expected,timeout=15000)=>{
  const stop=performance.now()+timeout;
  let last=null;
  while(performance.now()<stop){
   last=await evaluate('document.hidden');
   if(last===expected)return;
   await sleep(250);
  }
  throw Error('Real Chromium document.hidden stayed '+String(last)+
   ', expected '+String(expected));
 };
 const click=async selector=>{
  const query='(()=>{const e=document.querySelector('+JSON.stringify(selector)+
   ');if(!e)return null;e.scrollIntoView({block:"center",inline:"center"});'+
   'const r=e.getBoundingClientRect();return r.width>0&&r.height>0?'+
   '{x:r.left+r.width/2,y:r.top+r.height/2}:null})()';
  const xy=await evaluate(query);
  if(!xy||!Number.isFinite(xy.x)||!Number.isFinite(xy.y))
   throw Error('Visible source-mode UI control unavailable: '+selector);
  for(const type of ['mouseMoved','mousePressed','mouseReleased']){
   await cdp.send('Input.dispatchMouseEvent',{
    type,x:xy.x,y:xy.y,button:'left',
    ...(type==='mouseMoved'?{}:{clickCount:1})
   },tabSession);
  }
 };
 try{
  cdp=await launchNative();
  mark('ATTACH_ORIGINAL_NATIVE_CHROME_TAB');
  const targets=(await cdp.send('Target.getTargets')).targetInfos;
  tabTarget=targets.find(x=>x.type==='page'&&x.url==='about:blank')?.targetId;
  if(!tabTarget)throw Error('Native Chromium initial tab missing');
  const attached=await cdp.send('Target.attachToTarget',{
   targetId:tabTarget,flatten:true
  });
  tabSession=attached.sessionId;
  await cdp.send('Page.enable',{},tabSession);
  await cdp.send('Runtime.enable',{},tabSession);
  await cdp.send('Network.enable',{},tabSession);
  const sourceRequests=new Set();
  const isProvider=url=>/^https:\/\/(?:openamerica\.io|civicapi\.org)\//.test(url);
  cdp.on('Network.requestWillBeSent',(row,session)=>{
   if(session!==tabSession)return;
   const url=row.request?.url||'';
   if(isProvider(url))sourceRequests.add(row.requestId);
   if(url.startsWith('https://openamerica.io/elections/results.json')){
    report.source_requests.primary++;
    if(resumed)report.post_resume_primary_requests++;
   }
   if(url.startsWith('https://civicapi.org/api/v2/'))
    report.source_requests.supplemental++;
  });
  cdp.on('Network.responseReceived',(row,session)=>{
   if(session!==tabSession)return;
   const url=row.response?.url||'',status=row.response?.status;
   if(url.startsWith('https://openamerica.io/elections/results.json')&&
      [200,304].includes(status)){
    report.primary_healthy_responses++;
    if(resumed)report.post_resume_primary_healthy_responses++;
   }
   if(isProvider(url)&&status>=400)report.source_http_errors++;
  });
  cdp.on('Network.loadingFailed',(row,session)=>{
   if(session===tabSession&&!row.canceled&&sourceRequests.has(row.requestId))
    report.source_request_failures++;
  });
  cdp.on('Runtime.exceptionThrown',(_,session)=>{
   if(session===tabSession)report.page_script_errors++;
  });
  mark('LOAD_REAL_DEPLOYED_DASHBOARD');
  await cdp.send('Page.navigate',{url:SITE},tabSession);
  await waitFor('!!document.querySelector("[data-page=\\"electionNight\\"]")',60000);
  await click('[data-page="electionNight"]');
  await click('#enMode2026');
  await waitFor('document.querySelector("#enSourceReadiness")?.textContent?.includes("506 races")',45000);
  start=performance.now();
  mark('LIVE_506_RACE_DOM_RENDERED_START_REAL_CLOCK');
  const totalSteps=Math.floor(minutes*60000/(interval*1000));
  for(let step=0;step<=totalSteps;step++){
   const until=start+step*interval*1000-performance.now();
   if(until>0)await sleep(until);
   if(step===Math.floor(totalSteps/3)){
    mark('CREATE_AND_ACTIVATE_NATIVE_CHROME_SECOND_TAB');
    const second=await cdp.send('Target.createTarget',{url:'about:blank'});
    await cdp.send('Target.activateTarget',{targetId:second.targetId});
    mark('AWAIT_ACTUAL_BACKGROUND_DOCUMENT_HIDDEN');
    await waitHidden(true);
    report.background_visibility_confirmed=true;
    report.physical_background_method='NATIVE_CHROMIUM_REAL_TAB_ACTIVATION';
    mark('NATIVE_ORIGINAL_TAB_GENUINELY_HIDDEN');
   }else if(step===Math.floor(totalSteps/3)+2){
    resumed=true;
    mark('REACTIVATE_REAL_ORIGINAL_BROWSER_TAB');
    await cdp.send('Target.activateTarget',{targetId:tabTarget});
    await waitHidden(false);
    report.resumed_tab_visible=true;
    report.background_resume_observed=true;
    mark('NATIVE_ORIGINAL_TAB_GENUINELY_VISIBLE');
    if(Date.now()<Date.parse('2026-11-03T05:00:00Z')){
     report.post_resume_refresh_trigger='MANUAL_OWNER_CONTROL_PRE_ELECTION';
     // Use the actual owner-facing "Refresh now" chip, not a mode toggle.
     await click('#enRefresh');
    }else{
     report.post_resume_refresh_trigger='AUTONOMOUS_ELECTION_DAY_FOCUS';
    }
   }
   const state=await evaluate('(()=>{const text=document.querySelector("#enLiveCoverageTriage")?.textContent||"";'+
    'return {active:!!document.querySelector("#electionNight.page.active"),'+
    'sourceReadiness:!!document.querySelector("#enSourceReadiness")?.textContent?.includes("506 races"),'+
    'deskPresent:text.includes("506 RACES"),'+
    'coverageError:text.includes("Coverage audit unavailable")}})()');
   report.checkpoints++;
   const good=state?.active&&state.sourceReadiness&&
    state.deskPresent&&!state.coverageError;
   if(good)report.healthy_checkpoints++;
   if(state?.coverageError)report.audit_errors++;
   if(!good)report.errors.push('Unhealthy 506-race source desk checkpoint '+step);
   if(step%Math.max(1,Math.floor(300/interval))===0||step===totalSteps)
    report.probes.push({
     step,elapsed_s:Math.round((performance.now()-start)/1000),
     ui_healthy:good,primary_attempts:report.source_requests.primary,
     primary_healthy_responses:report.primary_healthy_responses,
     supplementary_attempts:report.source_requests.supplemental
    });
  }
 }catch(error){
  report.errors.push('Native Chromium runtime failed at '+
   report.last_browser_operation+': '+String(error?.name||'Error')+
   ' — '+String(error?.message||'').slice(0,250)
    .replace(/https?:\/\/[^\s]+/g,'[URL]'));
 }finally{
  report.finished_at=new Date().toISOString();
  report.actual_elapsed_seconds=start===null?0:
   Math.round((performance.now()-start)/1000);
  const acceptance=assess(report,minutes,interval);
  report.acceptance_checks=acceptance.checks;
  report.status=acceptance.passed?
   'PASS_REAL_BROWSER_TRANSPORT_ONLY':'FAIL_BROWSER_TAB_OR_REFRESH';
  await mkdir(dirname(output),{recursive:true});
  await writeFile(output,JSON.stringify(report,null,2)+'\n','utf8');
  console.log(JSON.stringify({...report,probes:report.probes.slice(-4)},null,2));
  try{cdp?.close()}catch{}
  try{proc?.kill('SIGTERM')}catch{}
  if(profile)await rm(profile,{recursive:true,force:true,maxRetries:2,retryDelay:100});
  if(!acceptance.passed)process.exitCode=1;
 }
}
