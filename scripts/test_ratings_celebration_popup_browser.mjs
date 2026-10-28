// Isolated operator mechanics. Calls, iframe content and dates are fictional fixtures.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_URL||'playwright');
const root=resolve(import.meta.dirname,'..'),out=resolve(root,process.env.UI_REVIEW_OUTPUT_DIR||'artifacts/readiness');mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'application/javascript','.json':'application/json','.svg':'image/svg+xml','.mp3':'audio/mpeg','.jpg':'image/jpeg'};
const server=createServer((req,res)=>{const file=resolve(root,'.'+(new URL(req.url,'http://localhost').pathname==='/'?'/index.html':decodeURIComponent(new URL(req.url,'http://localhost').pathname)));
 if(!file.startsWith(root+sep)||!existsSync(file)||!statSync(file).isFile()){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(readFileSync(file));});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));let browser;const proof=[];
try{
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
 for(const [width,height]of [[1366,900],[390,844]]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}),page=await context.newPage(),errors=[],youtube=[];
  page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date('2026-10-28T13:00:00Z')});
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.hostname==='127.0.0.1')return route.continue();
   if(url.hostname==='www.youtube-nocookie.com'){youtube.push(url.href);return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Fixture player</title><button>Play synthetic test</button>'});}
   return route.abort();
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/#electionNight`,{waitUntil:'domcontentloaded'});await page.locator('#enMode2026').click();
  await page.waitForFunction(()=>document.querySelectorAll('#enPersonalFocus article').length===18);
  const numbers=await page.evaluate(()=>JSON.stringify(jointLastResult.probabilities));
  assert.equal(await page.locator('#enPersonalFocus .personal-focus-rating').count(),18);
  assert.equal(await page.locator('#enPersonalFocus [data-race="AK-SEN"] .personal-focus-rating').innerText(),'Rating pending');
  const key=page.locator('#enPersonalFocus .personal-focus-rating-key > summary');await key.click();
  await page.evaluate(()=>renderPersonalElectionFocus());assert.equal(await page.locator('#enPersonalFocus .personal-focus-rating-key').evaluate(e=>e.open),true);
  assert.equal(await key.evaluate(e=>e===document.activeElement),true,'Rating explanation keeps focus through redraw');
  // Render a synthetic normalized model call, then withdraw it. Do not change live source state.
  const labels=await page.evaluate(()=>{
   const host=document.createElement('section');document.body.append(host);
   const result=structuredClone(jointLastResult),options={closes:ElectionNightPollClosings2026};
   const entry=result.race_probabilities.find(x=>x.race_code==='IA-SEN');entry.dem_beats_rep_pct=100;
   PersonalElectionFocus.render(host,result,jointPulseBaseline,options);const uncalled=host.querySelector('[data-race="IA-SEN"] .personal-focus-rating').textContent;
   entry.provider_called_party='D';PersonalElectionFocus.render(host,result,jointPulseBaseline,options);const called=host.querySelector('[data-race="IA-SEN"] .personal-focus-rating').textContent;
   delete entry.provider_called_party;PersonalElectionFocus.render(host,result,jointPulseBaseline,options);const withdrawn=host.querySelector('[data-race="IA-SEN"] .personal-focus-rating').textContent;host.remove();return{uncalled,called,withdrawn};
  });assert.deepEqual(labels,{uncalled:'Safe D',called:'D victory',withdrawn:'Safe D'});
  await page.locator('#enPersonalFocus [data-race="IA-SEN"]').screenshot({path:resolve(out,`rating-card-${width}.png`)});
  await page.evaluate(()=>{document.querySelector('#enCelebrationAnnouncement').play=()=>Promise.resolve();});
  const launch=page.locator('#enCelebrationsOpen');await launch.click();
  const popup=page.locator('#enMilestoneSpotlight');assert.equal(await popup.evaluate(e=>e.matches(':modal')),true);
  assert.equal(await page.locator('#enMilestoneClose').evaluate(e=>e===document.activeElement),true);
  assert.match(await page.locator('#enMilestoneKicker').innerText(),/PREVIEW/);
  assert.equal(youtube.length,0,'Original mode makes no YouTube request');
  await page.evaluate(()=>document.querySelector('#enCelebrationAnnouncement').dispatchEvent(new Event('ended')));
  const bounds=await popup.boundingBox(),scene=await page.locator('#enCelebrationVisual').boundingBox();
  assert(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width+1&&bounds.y+bounds.height<=height+1);
  assert(scene.y>=0&&scene.y+scene.height<=height,'The animation itself is on screen without scrolling');
  await page.screenshot({path:resolve(out,`celebration-popup-${width}.png`)});
  for(let i=0;i<9;i++){await page.keyboard.press('Tab');assert.equal(await popup.evaluate(e=>e.contains(document.activeElement)),true,'Native modal keeps keyboard focus inside');}
  const settings=page.locator('.en-celebration-music-settings');await settings.locator('summary').click();
  await page.locator('#enCelebrationMusicMode').selectOption('youtube');await page.locator('#enCelebrationOnlinePlayer iframe').waitFor();
  const frame=await page.locator('#enCelebrationOnlinePlayer iframe').boundingBox();assert(frame.width>=200&&frame.height>=200);
  assert.match(youtube.at(-1),/v087M-InmIM/);assert.match(await page.locator('#enCelebrationOnlineStatus').innerText(),/Press Play.*unavailable/);
  await page.locator('#enCelebrationSound').click();assert.equal(await page.locator('#enCelebrationOnlinePlayer iframe').count(),0,'Mute removes the online player');
  await page.locator('#enCelebrationSound').click();
  await page.locator('#enCelebrationVideoInput').fill('https://youtube.com.evil.example/watch?v=gkWCLjxQqjU');await page.locator('#enCelebrationVideoSave').click();
  assert.match(await page.locator('#enCelebrationOnlineStatus').innerText(),/Use an HTTPS YouTube/);
  await page.locator('#enCelebrationVideoInput').fill('https://youtu.be/gkWCLjxQqjU?si=discard');await page.locator('#enCelebrationVideoSave').click();
  await page.waitForFunction(()=>document.querySelector('#enCelebrationOnlinePlayer iframe')?.src.includes('gkWCLjxQqjU'));
  assert.doesNotMatch(await page.locator('#enCelebrationVideoLink').getAttribute('href'),/si=/);
  await page.clock.runFor(7300);assert.equal(await page.locator('#enCelebrationStage').getAttribute('data-phase'),'complete');
  assert.equal(await page.locator('#enCelebrationOnlinePlayer iframe').count(),1,'Online recording can continue beyond the short animation until dismissed');
  await page.keyboard.press('Escape');assert.equal(await popup.isHidden(),true);assert.equal(await launch.evaluate(e=>e===document.activeElement),true);
  assert.equal(await page.locator('#enCelebrationOnlinePlayer iframe').count(),0);await page.clock.runFor(20000);assert.equal(await popup.isHidden(),true);
  await launch.click();await page.locator('#enCelebrationPreviewChoice').selectOption('abbott');assert.match(await page.locator('#enMilestoneKicker').innerText(),/PREVIEW/);
  assert.equal(await page.locator('#enCelebrationOnlinePlayer iframe').count(),0,'New story removes the prior finale player before its announcement');
  // A preview selection never populates earned/dedup state.
  assert.equal(await page.evaluate(()=>enMilestoneShown.size),0);await page.keyboard.press('Escape');
  // Existing validated provider-call ingress, with no real provider request.
  await page.clock.setSystemTime(new Date('2026-11-04T03:00:00Z'));
  await page.locator('#enMode2026').focus();await page.evaluate(()=>window.scrollTo(0,0));
  await page.evaluate(()=>{
   enCivicByWatch['Senate|TX']={provider:'civicAPI',office:'Senate',key:'TX',race_id:87438,total:98001,last_updated:'2026-11-04T02:00:00Z',called:'James Talarico',candidates:[{name:'James Talarico',party:'D',votes:65000},{name:'Ken Paxton',party:'R',votes:33001}]};
   delete enCivicErrors['Senate|TX'];enCivicValidatedGenerations['Senate|TX']=enCivicBreaker?.status().generation??0;enRenderMilestones();
  });
  assert.equal(await popup.evaluate(e=>e.matches(':modal')),true,'An earned call opens over the results automatically, without visiting the milestone desk');
  assert.match(await page.locator('#enMilestoneKicker').innerText(),/SOURCE-REPORTED CALL/);
  await page.evaluate(()=>document.querySelector('#enCelebrationAnnouncement').dispatchEvent(new Event('ended')));await page.locator('#enCelebrationOnlinePlayer iframe').waitFor();
  await page.evaluate(()=>{enCivicByWatch['Senate|TX'].called=null;enRenderMilestones();});assert.equal(await popup.isHidden(),true);assert.equal(await page.locator('#enCelebrationOnlinePlayer iframe').count(),0,'Call withdrawal stops the online track');
  assert.equal(await page.locator('#enMode2026').evaluate(e=>e===document.activeElement),true,'Automatic popup restores the prior control');
  assert.equal(await page.evaluate(()=>JSON.stringify(jointLastResult.probabilities)),numbers,'Presentation and fixture milestones cannot alter the live model');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(errors,[]);
  proof.push({width,height,bounds,scene,labels,youtube_fixture_requests:youtube.length,external_providers:'blocked',actual_youtube_playback:'NOT_TESTED',human_acceptance:'NOT_RUN'});
  await context.close();console.log(`${width}x${height}: ratings, automatic modal, focus/escape, call withdrawal and opt-in visible player PASS`);
 }
 writeFileSync(resolve(out,'ratings-popup-browser.json'),JSON.stringify({source:'working tree',scope:'isolated synthetic UI mechanics',proof},null,2)+'\n');
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
