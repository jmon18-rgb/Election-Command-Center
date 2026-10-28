// Actual browser playback mechanics; media completion and calls are simulated.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,mkdirSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_URL||'playwright');
const root=resolve(import.meta.dirname,'..');
const out=resolve(process.env.UI_REVIEW_OUTPUT_DIR||resolve(root,'artifacts/readiness'));mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.mp3':'audio/mpeg','.jpg':'image/jpeg'};
const server=createServer((req,res)=>{
 const file=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname==='/'?'/index.html':new URL(req.url,'http://localhost').pathname));
 if(!file.startsWith(root+sep)||!existsSync(file)||!statSync(file).isFile()){res.writeHead(404).end();return;}
 res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(readFileSync(file));
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install();
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  // This retained eleven-scene drill exercises the original Abbott animation
  // as the supported missing-photo fallback. The supplied-art drill covers the
  // preferred image, its containment, attribution and default presentation.
  await page.route('**/assets/celebration-owner-abbott.jpg*',route=>route.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'domcontentloaded'});
  await page.locator('[data-page="electionNight"]').click();
  await page.locator('#enMode2026').click();
  await page.locator('#enMilestoneGrid .en-milestone-card').first().waitFor();
  // Keep media pending so the test can explicitly exercise ended/error/rejection.
  await page.evaluate(()=>{document.querySelector('#enCelebrationAnnouncement').play=()=>Promise.resolve();});
  const titles=await page.evaluate(()=>Object.fromEntries(window.ElectionNightSignals.MILESTONES.map(x=>[x.id,x.title])));
  // Exercise the first poster request, before it can be in the decoded-image cache.
  await page.route('**/assets/celebration-owner-mississippi.jpg*',route=>route.abort());
  await page.route('**/assets/milestone-mississippi.svg',route=>route.abort());
  await page.locator('#enMilestoneGrid .en-milestone-card').filter({hasText:titles.mississippi}).click();
  // This retained drill validates every original score and its fallback art.
  // Select that supported preference explicitly now that fresh profiles prefer
  // the owner's requested YouTube tracks. The separate popup drill covers them.
  await page.locator('#enCelebrationMusicQuick').click();
  assert.equal(await page.locator('#enCelebrationMusicMode').inputValue(),'original');
  await page.locator('#enMilestonePoster').waitFor({state:'hidden'});
  assert.equal(await page.locator('#enMilestoneArt').isVisible(),true);
  assert.equal(await page.locator('#enMilestoneTitle').isVisible(),true,'A missing poster preserves the readable story and controls');
  await page.locator('#enMilestoneClose').click();
  await page.unroute('**/assets/milestone-mississippi.svg');
  await page.locator('#enMilestoneGrid .en-milestone-card').filter({hasText:titles.mississippi}).click();
  await page.waitForFunction(()=>document.querySelector('#enMilestonePoster').src.endsWith('milestone-mississippi.svg'));
  await page.locator('#enMilestonePoster').evaluate(img=>img.decode());
  assert.equal(await page.locator('#enMilestonePoster').isVisible(),true,'Missing uploaded art falls back to the existing local illustration');
  await page.locator('#enMilestoneClose').click();
  await page.unroute('**/assets/celebration-owner-mississippi.jpg*');
  for(const id of ['graham','blexas','blue_corn','blansas','maine','nebraska','ohio','talarico','abbott','mississippi','tsunami']){
   await page.emulateMedia({reducedMotion:['talarico','abbott','mississippi','blansas','graham','nebraska','blue_corn','maine','ohio','blexas','tsunami'].includes(id)?'no-preference':'reduce'});
   if(id==='tsunami')await page.locator('#enTsunamiPreview').click();
   else await page.locator('#enMilestoneGrid .en-milestone-card').filter({hasText:titles[id]}).click();
   assert.equal(await page.locator('#enCelebrationStage').getAttribute('data-phase'),'announcement');
   assert.equal(await page.locator('#enCelebrationFish').isHidden(),false);
   if(['mississippi','blansas','graham'].includes(id)){
    await page.locator('#enMilestonePoster').evaluate(img=>img.decode());
    const posterBox=await page.locator('#enMilestonePoster').boundingBox();
    assert(posterBox.width<=width&&posterBox.height<=900*.52+2,'Supplied poster remains contained during announcement');
   }
   await page.evaluate(()=>document.querySelector('#enCelebrationAnnouncement').dispatchEvent(new Event('ended')));
   assert.equal(await page.locator('#enCelebrationStage').getAttribute('data-phase'),'scene');
   if(id==='graham'){
    assert.doesNotMatch(await page.locator('#enCelebrationStage').innerText(),/lindsey/i);
    const thumbnail=page.locator('#enMilestoneGrid .en-milestone-card').filter({hasText:titles.graham}).locator('img');
    assert.match(await thumbnail.getAttribute('src'),/celebration-owner-graham\.jpg\?v=90f3e5c8fdee$/,'Thumbnail must share the owner artwork revision');
   }
   if(['ohio','blexas','tsunami'].includes(id)){
    const visual=page.locator('#enCelebrationVisual');assert.equal(await visual.isVisible(),true);
    const spec={ohio:{first:'ohio-buckeye',middle:'ohio-blue-lightning',last:'ohio-special-finale',music:'Buckeye blue-shock riff'},blexas:{first:'blexas-illustrative-texas',middle:'blexas-office-star',last:'blexas-two-call-finale',music:'Two-star victory fanfare'},tsunami:{first:'tsunami-theatrical-wave',middle:'tsunami-lawn-sign',last:'tsunami-preview-finale',music:'The rising tide finale'}}[id];
    assert.equal(await visual.locator('[data-layer="'+spec.first+'"]').count(),1);
    assert.equal(await visual.evaluate(e=>e.getAnimations({subtree:true}).length>0),true);
    assert((await page.locator('#enCelebrationMusicLabel').innerText()).includes(spec.music));
    if(id==='tsunami'){assert.equal(await page.locator('#enTsunamiMeme').isHidden(),true,'Dedicated scene replaces duplicate wave poster');assert.match(await visual.innerText(),/PREVIEW ONLY.*NOT A FORECAST TRIGGER/);}
    await visual.screenshot({path:resolve(out,`celebration-${id}-beat0-${width}.png`)});
    await page.clock.runFor(2400);assert.equal(await visual.getAttribute('data-beat'),'1');
    assert.equal(await visual.locator('[data-layer="'+spec.middle+'"]').count(),id==='blexas'?2:1);
    assert.equal(await visual.evaluate(e=>e.getAnimations({subtree:true}).length>0),true);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(()=>document.querySelector('#enCelebrationVisual').getAnimations({subtree:true}).length===0);
    if(id==='ohio'){assert.equal(await visual.locator('[data-layer="ohio-cracked-shell"]').count(),2);assert.match(await visual.locator('[data-layer="ohio-cracked-shell"]').first().getAttribute('style'),/translateX\(-60px\)/);}
    if(id==='blexas')assert.match(await visual.innerText(),/SENATE.*GOVERNOR.*TWO SEPARATE STATEWIDE CALLS/s);
    if(id==='tsunami')assert.match(await visual.locator('[data-layer="tsunami-lawn-sign"]').getAttribute('style'),/rotate\(18deg\)/);
    await visual.screenshot({path:resolve(out,`celebration-${id}-beat1-${width}.png`)});
    await page.clock.runFor(2400);assert.equal(await visual.locator('[data-layer="'+spec.last+'"]').count(),1);
    if(id==='ohio')assert.match(await visual.innerText(),/SPECIAL SENATE/);
    if(id==='blexas')assert.match(await visual.innerText(),/BOTH CALLS REQUIRED/);
    if(id==='tsunami')assert.match(await visual.innerText(),/PREVIEW ONLY.*NO NATIONAL CALL/s);
    await visual.screenshot({path:resolve(out,`celebration-${id}-beat2-${width}.png`)});
    await page.clock.runFor(2500);
   }else if(id==='maine'){
    const visual=page.locator('#enCelebrationVisual');assert.equal(await visual.isVisible(),true);
    assert.equal(await visual.locator('[data-layer="maine-broom-hat"]').count(),1);
    assert.match(await visual.innerText(),/COLLINS/);
    assert.match(await visual.innerText(),/THEATRICAL SENDOFF.*ORIGINAL PARODY/);
    assert.match(await visual.innerText(),/SIMULATED PREVIEW/);
    assert.equal(await visual.evaluate(e=>e.getAnimations({subtree:true}).length>0),true);
    assert.match(await page.locator('#enCelebrationMusicLabel').innerText(),/Broom-and-bells sendoff/);
    await visual.screenshot({path:resolve(out,`celebration-maine-beat0-${width}.png`)});
    await page.clock.runFor(2400);assert.equal(await visual.getAttribute('data-beat'),'1');
    assert.equal(await visual.locator('[data-layer="maine-change-breeze"]').count(),1);
    assert.equal(await visual.evaluate(e=>e.getAnimations({subtree:true}).length>0),true);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(()=>document.querySelector('#enCelebrationVisual').getAnimations({subtree:true}).length===0);
    assert.match(await visual.locator('[data-layer="maine-broom-hat"]').getAttribute('style'),/translate\(430px,-90px\)/,'Reduced motion retains the exit endpoint');
    await visual.screenshot({path:resolve(out,`celebration-maine-beat1-${width}.png`)});
    await page.clock.runFor(2400);assert.equal(await visual.locator('[data-layer="maine-next-chapter"]').count(),1);
    assert.match(await visual.innerText(),/MAINE SENATE/);
    await visual.screenshot({path:resolve(out,`celebration-maine-beat2-${width}.png`)});
    await page.clock.runFor(2500);
   }else if(id==='blue_corn'){
    const visual=page.locator('#enCelebrationVisual');assert.equal(await visual.isVisible(),true);
    assert.equal(await visual.locator('[data-layer="iowa-corn-ear"]').count(),1);
    assert.equal(await visual.locator('[data-layer="first-blue-kernel"]').count(),1);
    assert.equal(await visual.locator('[data-layer="corn-kernel"]').count(),20);
    assert.equal(await visual.evaluate(e=>e.getAnimations({subtree:true}).length>0),true);
    assert.match(await visual.innerText(),/SIMULATED PREVIEW/);
    assert.match(await page.locator('#enCelebrationMusicLabel').innerText(),/Electric harvest two-step/);
    // WAAPI uses the compositor clock; observe real paint before advancing fixture timers.
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('#enCelebrationVisual [data-layer="first-blue-kernel"]')).fill==='rgb(128, 216, 255)');
    assert.equal(await visual.locator('[data-layer="first-blue-kernel"]').evaluate(n=>getComputedStyle(n).fill),'rgb(128, 216, 255)','First kernel visibly turns blue before the full-ear beat');
    await visual.screenshot({path:resolve(out,`celebration-iowa-beat0-${width}.png`)});
    await page.clock.runFor(2400);assert.equal(await visual.getAttribute('data-beat'),'1');
    assert.match(await visual.innerText(),/BLUE KERNELS EVERYWHERE/);
    assert.equal(await visual.evaluate(e=>e.getAnimations({subtree:true}).length>0),true);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(()=>document.querySelector('#enCelebrationVisual').getAnimations({subtree:true}).length===0);
    assert.equal(await visual.locator('[data-layer="corn-kernel"]').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).fill==='rgb(128, 216, 255)')),true,'Reduced motion retains all blue kernels');
    await visual.screenshot({path:resolve(out,`celebration-iowa-beat1-${width}.png`)});
    await page.clock.runFor(2400);assert.equal(await visual.locator('[data-layer="iowa-blue-corn-finale"]').count(),1);
    assert.match(await visual.innerText(),/IOWA SENATE OR GOVERNOR/);
    await visual.screenshot({path:resolve(out,`celebration-iowa-beat2-${width}.png`)});
    await page.clock.runFor(2500);
   }else if(id==='nebraska'){
    const visual=page.locator('#enCelebrationVisual');assert.equal(await visual.isVisible(),true);
    assert.equal(await visual.locator('[data-layer="coach-tom-osborne"]').count(),1);
    assert.match(await visual.innerText(),/COACH TOM OSBORNE/);
    assert.match(await visual.innerText(),/FICTIONAL SIDELINE REACTION/);
    assert.match(await visual.innerText(),/COACH OSBORNE ≠ CANDIDATE OSBORN/);
    assert.match(await visual.innerText(),/SIMULATED PREVIEW/);
    assert.equal(await visual.evaluate(e=>e.getAnimations({subtree:true}).length>0),true);
    assert.match(await page.locator('#enCelebrationMusicLabel').innerText(),/Sideline brass and halftime bass/);
    await visual.screenshot({path:resolve(out,`celebration-nebraska-beat0-${width}.png`)});
    await page.clock.runFor(2400);assert.equal(await visual.getAttribute('data-beat'),'1');
    assert.equal(await visual.locator('[data-layer="absurd-scoreboard"]').count(),1);
    assert.equal(await visual.locator('[data-layer="blue-confetti"] rect').count(),16);
    assert.match(await visual.innerText(),/COMEDY SCOREBOARD.*NOT VOTE TOTALS/);
    assert.equal(await visual.evaluate(e=>e.getAnimations({subtree:true}).length>0),true);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(()=>document.querySelector('#enCelebrationVisual').getAnimations({subtree:true}).length===0);
    assert.equal(await visual.locator('[data-layer="absurd-scoreboard"]').isVisible(),true);
    await visual.screenshot({path:resolve(out,`celebration-nebraska-beat1-${width}.png`)});
    await page.clock.runFor(2400);assert.equal(await visual.locator('[data-layer="nebraska-independent-finale"]').count(),1);
    assert.match(await visual.innerText(),/DAN OSBORN.*INDEPENDENT WINNER.*NO ASSUMED CAUCUS/s);
    await visual.screenshot({path:resolve(out,`celebration-nebraska-beat2-${width}.png`)});
    await page.clock.runFor(2500);
   }else if(id==='graham'){
    const visual=page.locator('#enCelebrationVisual');assert.equal(await visual.isVisible(),true);
    assert.equal(await visual.locator('[data-layer="farewell-disco-ball"]').count(),1);
    assert.equal(await visual.locator('[data-layer="graham-neon-marquee"]').count(),1);
    assert.equal(await visual.evaluate(e=>e.getAnimations({subtree:true}).length>0),true);
    assert.match(await visual.innerText(),/FICTIONAL STAGE.*NOT A REAL VENUE/);
    assert.match(await visual.innerText(),/SIMULATED PREVIEW/);
    assert.match(await page.locator('#enCelebrationMusicLabel').innerText(),/Last-call disco/);
    await visual.screenshot({path:resolve(out,`celebration-graham-beat0-${width}.png`)});
    await page.clock.runFor(2400);assert.equal(await visual.getAttribute('data-beat'),'1');
    assert.equal(await visual.locator('[data-layer="incumbent-stage-pass"]').count(),1);
    assert.equal(await visual.locator('[data-layer="stage-exit"]').count(),1);
    assert.equal(await visual.evaluate(e=>e.getAnimations({subtree:true}).length>0),true);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(()=>document.querySelector('#enCelebrationVisual').getAnimations({subtree:true}).length===0);
    assert.match(await visual.locator('[data-layer="incumbent-stage-pass"]').getAttribute('style'),/translateX\(400px\)/,'Reduced motion retains the theatrical exit endpoint');
    await visual.screenshot({path:resolve(out,`celebration-graham-beat1-${width}.png`)});
    await page.clock.runFor(2400);assert.equal(await visual.locator('[data-layer="graham-finale"]').count(),1);
    await visual.screenshot({path:resolve(out,`celebration-graham-beat2-${width}.png`)});
    await page.clock.runFor(2500);
   }else if(id==='talarico'){
    const visual=page.locator('#enCelebrationVisual');
    assert.equal(await visual.isVisible(),true);
    assert.equal(await visual.getAttribute('data-beat'),'0');
    assert.equal(await visual.locator('[data-layer="blue-horns"]').count(),1);
    assert.equal(await page.locator('#enCelebrationIcon').isHidden(),true);
    assert.equal(await page.locator('#enMilestonePoster').isHidden(),true);
    assert.equal(await visual.evaluate(host=>host.getAnimations({subtree:true}).length>0),true);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(()=>document.querySelector('#enCelebrationVisual').getAnimations({subtree:true}).length===0);
    mkdirSync(resolve(root,'artifacts/readiness'),{recursive:true});
    await visual.screenshot({path:resolve(out,`celebration-talarico-beat0-${width}.png`)});
    await page.clock.runFor(2400);
    assert.equal(await visual.getAttribute('data-beat'),'1');
    assert.equal(await visual.locator('[data-layer="texas-silhouette"]').count(),1);
    assert.equal(await visual.locator('[data-layer="blue-star"]').count(),5);
    assert.equal(await visual.evaluate(host=>host.getAnimations({subtree:true}).length),0);
    await visual.screenshot({path:resolve(out,`celebration-talarico-beat1-${width}.png`)});
    await page.clock.runFor(2400);
    assert.equal(await visual.getAttribute('data-beat'),'2');
    assert.equal(await visual.locator('[data-layer="senate-victory-card"]').count(),1);
    assert.match(await visual.innerText(),/SIMULATED PREVIEW/);
    await visual.screenshot({path:resolve(out,`celebration-talarico-beat2-${width}.png`)});
    await page.clock.runFor(2500);
   }else if(id==='abbott'){
    const visual=page.locator('#enCelebrationVisual');assert.equal(await visual.isVisible(),true);
    assert.equal(await visual.evaluate(host=>host.getAnimations({subtree:true}).length>0),true);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(()=>document.querySelector('#enCelebrationVisual').getAnimations({subtree:true}).length===0);
    assert.equal(await visual.locator('[data-layer="campaign-sign"]').count(),1);
    assert.equal(await visual.locator('[data-layer="falling-tree"]').count(),1);
    assert.match(await page.locator('#enCelebrationMusicLabel').innerText(),/Original score.*campaign-sign exit march/);
    await visual.screenshot({path:resolve(out,`celebration-abbott-beat0-${width}.png`)});
    await page.clock.runFor(2400);assert.equal(await visual.locator('[data-layer="voted-out-stamp"]').count(),1);
    await visual.screenshot({path:resolve(out,`celebration-abbott-beat1-${width}.png`)});
    await page.clock.runFor(2400);assert.equal(await visual.locator('[data-layer="governor-victory-card"]').count(),1);
    await visual.screenshot({path:resolve(out,`celebration-abbott-beat2-${width}.png`)});
    await page.clock.runFor(2500);
   }else if(id==='blansas'){
    const visual=page.locator('#enCelebrationVisual');assert.equal(await visual.isVisible(),true);
    assert.equal(await visual.locator('[data-layer="john-brown-ghost"]').count(),1);
    assert.equal(await visual.locator('[data-layer="old-rebel-emblem"]').count(),1);
    assert.equal(await visual.evaluate(e=>e.getAnimations({subtree:true}).length>0),true);
    assert.match(await visual.innerText(),/SIMULATED PREVIEW/);
    assert.match(await page.locator('#enCelebrationMusicLabel').innerText(),/Prairie fife and drum/);
    await visual.screenshot({path:resolve(out,`celebration-kansas-beat0-${width}.png`)});
    await page.clock.runFor(2400);assert.equal(await visual.getAttribute('data-beat'),'1');
    assert.equal(await visual.locator('[data-layer="kansas-ink-wash"]').count(),1);
    assert.equal(await visual.locator('[data-layer="blue-ink-splash"]').count(),3);
    assert.equal(await visual.evaluate(e=>e.getAnimations({subtree:true}).length>0),true);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(()=>document.querySelector('#enCelebrationVisual').getAnimations({subtree:true}).length===0);
    assert.match(await visual.innerText(),/KANSAS/);
    await visual.screenshot({path:resolve(out,`celebration-kansas-beat1-${width}.png`)});
    await page.clock.runFor(2400);assert.equal(await visual.locator('[data-layer="kansas-victory-card"]').count(),1);
    await visual.screenshot({path:resolve(out,`celebration-kansas-beat2-${width}.png`)});
    await page.clock.runFor(2500);
   }else if(id==='mississippi'){
    const visual=page.locator('#enCelebrationVisual');assert.equal(await visual.isVisible(),true);
    assert.equal(await visual.locator('[data-layer="retired-mascot-prop"]').count(),1);
    assert.equal(await visual.evaluate(e=>e.getAnimations({subtree:true}).length>0),true);
    assert.match(await visual.innerText(),/SIMULATED PREVIEW/);
    assert.match(await page.locator('#enCelebrationMusicLabel').innerText(),/Blue-river brass shuffle/);
    assert.match(await page.locator('#enMilestoneSource').innerText(),/Original animated scene/);
    await visual.screenshot({path:resolve(out,`celebration-mississippi-beat0-${width}.png`)});
    await page.clock.runFor(2400);
    assert.equal(await visual.getAttribute('data-beat'),'1');
    assert.equal(await visual.locator('[data-layer="mascot-storage-crate"]').count(),1);
    assert.equal(await visual.evaluate(e=>e.getAnimations({subtree:true}).length>0),true);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(()=>document.querySelector('#enCelebrationVisual').getAnimations({subtree:true}).length===0);
    assert.match(await visual.locator('[data-layer="retired-mascot-prop"]').getAttribute('style'),/translate\(700px,250px\)/,'Static reduced-motion frame retains the prop in storage');
    await visual.screenshot({path:resolve(out,`celebration-mississippi-beat1-${width}.png`)});
    await page.clock.runFor(2400);assert.equal(await visual.locator('[data-layer="mississippi-victory-card"]').count(),1);
    await visual.screenshot({path:resolve(out,`celebration-mississippi-beat2-${width}.png`)});
    await page.clock.runFor(2500);
   }else{
    assert.equal(await page.locator('#enCelebrationVisual').isHidden(),true,'Other stories retain their existing presentation');
    await page.clock.runFor(7300);
   }
   assert.equal(await page.locator('#enCelebrationStage').getAttribute('data-phase'),'complete');
   assert.equal(await page.evaluate(()=>enCelebrationPlayer.state().active),null);
   if(['mississippi','blansas','graham'].includes(id))assert.equal(await page.locator('#enMilestoneSource .en-scene-credit').count(),1,'Scene attribution does not accumulate across beats');
   if(id==='talarico'){
    assert.equal(await page.locator('#enCelebrationVisual').isVisible(),true,'Completion/music(null) keeps the final visual card');
    assert.equal(await page.locator('#enCelebrationVisual').getAttribute('data-beat'),'2');
    assert.equal(await page.locator('#enCelebrationVisual [data-layer="senate-victory-card"]').count(),1);
    assert.equal(await page.locator('#enMilestonePoster').isHidden(),true);
    assert.equal(await page.locator('#enMilestoneClose').isVisible(),true);
   }
   assert.match(await page.locator('#enMilestoneKicker').innerText(),/PREVIEW/);
   if(['graham','blansas','talarico','abbott','mississippi','nebraska','blue_corn','maine','ohio','blexas'].includes(id)){
    const src=await page.locator('#enMilestonePoster').getAttribute('src');
    const ownerArt={graham:'graham',blansas:'kansas',mississippi:'mississippi'}[id];
    assert.equal(new URL(src,'http://localhost').pathname,ownerArt?'/assets/celebration-owner-'+ownerArt+'.jpg':'/assets/milestone-'+({blue_corn:'blue-corn'}[id]||id)+'.svg');
    if(ownerArt){
     assert.match(await page.locator('#enMilestoneSource').innerText(),/Owner-supplied fictional artwork/);
     assert.match(src,/\?v=[a-f0-9]{12}$/);
     if(await page.locator('#enMilestonePoster').isVisible()){const box=await page.locator('#enMilestonePoster').boundingBox();assert(box.width<=width&&box.height<=900*.52+2,'Uploaded art is contained without cropping or mobile overflow');}
     else assert.equal(await page.locator('#enCelebrationVisual').isVisible(),true,'A hidden uploaded poster is replaced by its dedicated scene');
    }
    if(id==='graham')assert.match(src,/\?v=[a-f0-9]{12}$/,'Changed incumbent artwork must not reuse an old cached image');
    if(id==='graham')assert.doesNotMatch(await page.locator('#enMilestonePoster').getAttribute('alt'),/lindsey/i);
    await page.locator('#enMilestonePoster').evaluate(img=>img.decode());
    mkdirSync(resolve(root,'artifacts/readiness'),{recursive:true});
    await page.locator(['talarico','abbott','mississippi','blansas','graham','nebraska','blue_corn','maine','ohio','blexas','tsunami'].includes(id)?'#enCelebrationVisual':'#enMilestonePoster').screenshot({path:resolve(out,`celebration-${id}-${width}.png`)});
   }
   await page.locator('#enMilestoneClose').click();
  }
  // Supplied-art productions retain shared cancellation/archive mechanics.
  for(const sceneId of ['mississippi','blansas','graham','nebraska','blue_corn','maine','ohio','blexas','tsunami']){
  await page.emulateMedia({reducedMotion:'no-preference'});
  if(sceneId==='tsunami')await page.locator('#enTsunamiPreview').click();
  else await page.locator('#enMilestoneGrid .en-milestone-card').filter({hasText:titles[sceneId]}).click();
  await page.evaluate(()=>document.querySelector('#enCelebrationAnnouncement').dispatchEvent(new Event('ended')));
  assert.equal(await page.locator('#enCelebrationVisual').evaluate(e=>e.getAnimations({subtree:true}).length>0),true);
  await page.locator('#enMilestoneClose').click();
  assert.equal(await page.locator('#enCelebrationVisual svg').count(),0);await page.clock.runFor(20000);
  assert.equal(await page.locator('#enMilestoneSpotlight').isHidden(),true,'Skipped scene timers cannot reopen the story');
  if(sceneId==='tsunami')await page.locator('#enTsunamiPreview').click();
  else await page.locator('#enMilestoneGrid .en-milestone-card').filter({hasText:titles[sceneId]}).click();
  await page.evaluate(()=>document.querySelector('#enCelebrationAnnouncement').dispatchEvent(new Event('ended')));
  // A programmatic mode change tests the archive teardown while a native modal is open.
  await page.evaluate(()=>document.querySelector('#enMode2024').click());assert.equal(await page.locator('#enCelebrationVisual svg').count(),0);
  await page.locator('#enMode2026').click();
  }
  // Skip an actual running visual, then replace it and leave 2026 mode.
  await page.locator('#enMilestoneGrid .en-milestone-card').filter({hasText:titles.talarico}).click();
  await page.evaluate(()=>document.querySelector('#enCelebrationAnnouncement').dispatchEvent(new Event('ended')));
  assert.equal(await page.locator('#enCelebrationVisual').isVisible(),true);
  await page.locator('#enMilestoneClose').click();
  assert.equal(await page.locator('#enCelebrationVisual').isHidden(),true);
  assert.equal(await page.locator('#enCelebrationVisual svg').count(),0);
  await page.clock.runFor(20000);
  assert.equal(await page.locator('#enMilestoneSpotlight').isHidden(),true);
  await page.locator('#enMilestoneGrid .en-milestone-card').filter({hasText:titles.talarico}).click();
  await page.evaluate(()=>document.querySelector('#enCelebrationAnnouncement').dispatchEvent(new Event('ended')));
  await page.evaluate(()=>enMilestoneShow({id:'blansas',title:'Kansas'},true));
  assert.equal(await page.locator('#enCelebrationVisual').isHidden(),true,'Replacement clears prior SVG');
  await page.locator('#enMilestoneClose').click();
  await page.locator('#enMilestoneGrid .en-milestone-card').filter({hasText:titles.talarico}).click();
  await page.evaluate(()=>document.querySelector('#enCelebrationAnnouncement').dispatchEvent(new Event('ended')));
  // A programmatic mode change tests the archive teardown while a native modal is open.
  await page.evaluate(()=>document.querySelector('#enMode2024').click());
  assert.equal(await page.locator('#enCelebrationVisual').isHidden(),true,'Archive mode clears prior SVG');
  await page.locator('#enMode2026').click();
  await page.evaluate(()=>{document.querySelector('#enCelebrationAnnouncement').play=()=>Promise.reject(new Error('Synthetic autoplay rejection'));enMilestoneShow({id:'blansas',title:'Kansas'},true)});
  await page.waitForFunction(()=>document.querySelector('#enCelebrationStage').dataset.phase==='scene');
  await page.locator('#enCelebrationSound').click();
  assert.equal(await page.locator('#enCelebrationSound').getAttribute('aria-pressed'),'false');
  assert.equal(await page.evaluate(()=>enCelebrationNotes.length),0,'Mute releases scheduled score sources');
  const stage=page.locator('#enCelebrationStage');
  await stage.scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,'No mobile overflow');
  mkdirSync(resolve(root,'artifacts/readiness'),{recursive:true});
  await stage.screenshot({path:resolve(out,`celebration-${width}.png`)});
  await page.locator('#enMilestoneClose').click();
  assert.equal(await page.evaluate(()=>enCelebrationPlayer.state().active),null);
  assert.equal(await page.locator('#enMilestoneSpotlight').isHidden(),true);
  await page.clock.runFor(20000);
  assert.equal(await page.locator('#enMilestoneSpotlight').isHidden(),true,'Skipped timer cannot reopen playback');
  // Optional scene-script failure retains the original poster/text player.
  await page.route('**/election_night_celebration_scene.js*',route=>route.abort());
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('[data-page="electionNight"]').click();
  await page.locator('#enMode2026').click();
  await page.evaluate(()=>{document.querySelector('#enCelebrationAnnouncement').play=()=>Promise.resolve()});
  await page.locator('#enMilestoneGrid .en-milestone-card').filter({hasText:titles.talarico}).click();
  await page.evaluate(()=>document.querySelector('#enCelebrationAnnouncement').dispatchEvent(new Event('ended')));
  assert.equal(await page.locator('#enCelebrationVisual').isHidden(),true);
  assert.equal(await page.locator('#enCelebrationIcon').isVisible(),true);
  assert.equal(await page.locator('#enMilestonePoster').isVisible(),true);
  await page.locator('#enMilestoneClose').click();
  for(const sceneId of ['mississippi','blansas','graham','nebraska','blue_corn','maine','ohio','blexas','tsunami']){
  if(sceneId==='tsunami')await page.locator('#enTsunamiPreview').click();
  else await page.locator('#enMilestoneGrid .en-milestone-card').filter({hasText:titles[sceneId]}).click();
  await page.evaluate(()=>document.querySelector('#enCelebrationAnnouncement').dispatchEvent(new Event('ended')));
  assert.equal(await page.locator('#enCelebrationVisual').isHidden(),true);
  if(sceneId==='tsunami'){
   assert.equal(await page.locator('#enTsunamiMeme').isVisible(),true,'Missing wave renderer retains original preview poster');
   assert.match(await page.locator('#enMilestoneKicker').innerText(),/PREVIEW/);
  }else{
   assert.equal(await page.locator('#enMilestonePoster').isVisible(),true,'Missing optional renderer retains the original poster');
   const original={maine:'milestone-maine.svg',blue_corn:'milestone-blue-corn.svg',nebraska:'milestone-nebraska.svg',ohio:'milestone-ohio.svg',blexas:'milestone-blexas.svg',blansas:'celebration-owner-kansas.jpg',mississippi:'celebration-owner-mississippi.jpg',graham:'celebration-owner-graham.jpg'}[sceneId];
   assert.equal(new URL(await page.locator('#enMilestonePoster').getAttribute('src'),'http://localhost').pathname,'/assets/'+original);
  }
  await page.locator('#enMilestoneClose').click();
  }
  await page.route('**/election_night_celebration_player.js*',route=>route.abort());
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('[data-page="electionNight"]').click();
  await page.locator('#enMode2026').click();
  await page.locator('#enMilestoneGrid .en-milestone-card').first().click();
  assert.equal(await page.locator('#enMilestoneSpotlight').isVisible(),true,'Missing animation script falls back to the existing poster');
  assert.equal(await page.evaluate(()=>enCelebrationPlayer.state().active),null);
  assert.deepEqual(errors,[]);
  console.log(`${width}px: full preview roster, announcement ordering, autoplay failure, mute, skip and responsive layout PASS`);
  await context.close();
 }
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
