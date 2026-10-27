// Actual browser playback mechanics; media completion and calls are simulated.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,mkdirSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_URL||'playwright');
const root=resolve(import.meta.dirname,'..');
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
   await page.emulateMedia({reducedMotion:['talarico','abbott'].includes(id)?'no-preference':'reduce'});
   if(id==='tsunami')await page.locator('#enTsunamiPreview').click();
   else await page.locator('#enMilestoneGrid .en-milestone-card').filter({hasText:titles[id]}).click();
   assert.equal(await page.locator('#enCelebrationStage').getAttribute('data-phase'),'announcement');
   assert.equal(await page.locator('#enCelebrationFish').isHidden(),false);
   await page.evaluate(()=>document.querySelector('#enCelebrationAnnouncement').dispatchEvent(new Event('ended')));
   assert.equal(await page.locator('#enCelebrationStage').getAttribute('data-phase'),'scene');
   if(id==='graham'){
    assert.doesNotMatch(await page.locator('#enCelebrationStage').innerText(),/lindsey/i);
    const thumbnail=page.locator('#enMilestoneGrid .en-milestone-card').filter({hasText:titles.graham}).locator('img');
    assert.match(await thumbnail.getAttribute('src'),/celebration-owner-graham\.jpg\?v=90f3e5c8fdee$/,'Thumbnail must share the owner artwork revision');
   }
   if(id==='talarico'){
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
    await visual.screenshot({path:resolve(root,`artifacts/readiness/celebration-talarico-beat0-${width}.png`)});
    await page.clock.runFor(2400);
    assert.equal(await visual.getAttribute('data-beat'),'1');
    assert.equal(await visual.locator('[data-layer="texas-silhouette"]').count(),1);
    assert.equal(await visual.locator('[data-layer="blue-star"]').count(),5);
    assert.equal(await visual.evaluate(host=>host.getAnimations({subtree:true}).length),0);
    await visual.screenshot({path:resolve(root,`artifacts/readiness/celebration-talarico-beat1-${width}.png`)});
    await page.clock.runFor(2400);
    assert.equal(await visual.getAttribute('data-beat'),'2');
    assert.equal(await visual.locator('[data-layer="senate-victory-card"]').count(),1);
    assert.match(await visual.innerText(),/SIMULATED PREVIEW/);
    await visual.screenshot({path:resolve(root,`artifacts/readiness/celebration-talarico-beat2-${width}.png`)});
    await page.clock.runFor(2500);
   }else if(id==='abbott'){
    const visual=page.locator('#enCelebrationVisual');assert.equal(await visual.isVisible(),true);
    assert.equal(await visual.evaluate(host=>host.getAnimations({subtree:true}).length>0),true);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(()=>document.querySelector('#enCelebrationVisual').getAnimations({subtree:true}).length===0);
    assert.equal(await visual.locator('[data-layer="campaign-sign"]').count(),1);
    assert.equal(await visual.locator('[data-layer="falling-tree"]').count(),1);
    assert.match(await page.locator('#enCelebrationMusicLabel').innerText(),/Original score.*campaign-sign exit march/);
    await visual.screenshot({path:resolve(root,`artifacts/readiness/celebration-abbott-beat0-${width}.png`)});
    await page.clock.runFor(2400);assert.equal(await visual.locator('[data-layer="voted-out-stamp"]').count(),1);
    await visual.screenshot({path:resolve(root,`artifacts/readiness/celebration-abbott-beat1-${width}.png`)});
    await page.clock.runFor(2400);assert.equal(await visual.locator('[data-layer="governor-victory-card"]').count(),1);
    await visual.screenshot({path:resolve(root,`artifacts/readiness/celebration-abbott-beat2-${width}.png`)});
    await page.clock.runFor(2500);
   }else{
    assert.equal(await page.locator('#enCelebrationVisual').isHidden(),true,'Other stories retain their existing presentation');
    await page.clock.runFor(7300);
   }
   assert.equal(await page.locator('#enCelebrationStage').getAttribute('data-phase'),'complete');
   assert.equal(await page.evaluate(()=>enCelebrationPlayer.state().active),null);
   if(id==='talarico'){
    assert.equal(await page.locator('#enCelebrationVisual').isVisible(),true,'Completion/music(null) keeps the final visual card');
    assert.equal(await page.locator('#enCelebrationVisual').getAttribute('data-beat'),'2');
    assert.equal(await page.locator('#enCelebrationVisual [data-layer="senate-victory-card"]').count(),1);
    assert.equal(await page.locator('#enMilestonePoster').isHidden(),true);
    assert.equal(await page.locator('#enMilestoneClose').isVisible(),true);
   }
   assert.match(await page.locator('#enMilestoneKicker').innerText(),/PREVIEW/);
   if(['graham','blansas','talarico','abbott','mississippi'].includes(id)){
    const src=await page.locator('#enMilestonePoster').getAttribute('src');
    const ownerArt={graham:'graham',blansas:'kansas',mississippi:'mississippi'}[id];
    assert.equal(new URL(src,'http://localhost').pathname,ownerArt?'/assets/celebration-owner-'+ownerArt+'.jpg':'/assets/milestone-'+id+'.svg');
    if(ownerArt){
     assert.match(await page.locator('#enMilestoneSource').innerText(),/Owner-supplied fictional artwork/);
     assert.match(src,/\?v=[a-f0-9]{12}$/);
     const box=await page.locator('#enMilestonePoster').boundingBox();assert(box.width<=width&&box.height<=900*.52+2,'Uploaded art is contained without cropping or mobile overflow');
    }
    if(id==='graham')assert.match(src,/\?v=[a-f0-9]{12}$/,'Changed incumbent artwork must not reuse an old cached image');
    if(id==='graham')assert.doesNotMatch(await page.locator('#enMilestonePoster').getAttribute('alt'),/lindsey/i);
    await page.locator('#enMilestonePoster').evaluate(img=>img.decode());
    mkdirSync(resolve(root,'artifacts/readiness'),{recursive:true});
    await page.locator(['talarico','abbott'].includes(id)?'#enCelebrationVisual':'#enMilestonePoster').screenshot({path:resolve(root,`artifacts/readiness/celebration-${id}-${width}.png`)});
   }
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
  await page.locator('#enMode2024').click();
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
  await stage.screenshot({path:resolve(root,`artifacts/readiness/celebration-${width}.png`)});
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
