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
  for(const id of ['graham','blexas','blue_corn','blansas','maine','nebraska','ohio','talarico','abbott','mississippi','tsunami']){
   await page.evaluate(id=>enMilestoneShow({id,title:id,tag:id,description:'Synthetic preview'},true),id);
   assert.equal(await page.locator('#enCelebrationStage').getAttribute('data-phase'),'announcement');
   assert.equal(await page.locator('#enCelebrationFish').isHidden(),false);
   await page.evaluate(()=>document.querySelector('#enCelebrationAnnouncement').dispatchEvent(new Event('ended')));
   assert.equal(await page.locator('#enCelebrationStage').getAttribute('data-phase'),'scene');
   await page.clock.runFor(7300);
   assert.equal(await page.locator('#enCelebrationStage').getAttribute('data-phase'),'complete');
   assert.equal(await page.evaluate(()=>enCelebrationPlayer.state().active),null);
   assert.match(await page.locator('#enMilestoneKicker').innerText(),/PREVIEW/);
   if(['talarico','abbott','mississippi'].includes(id)){
    await page.locator('#enMilestonePoster').scrollIntoViewIfNeeded();
    await page.locator('#enMilestonePoster').evaluate(img=>img.decode());
    mkdirSync(resolve(root,'artifacts/readiness'),{recursive:true});
    await page.locator('#enMilestonePoster').screenshot({path:resolve(root,`artifacts/readiness/celebration-${id}-${width}.png`)});
   }
  }
  await page.evaluate(()=>{document.querySelector('#enCelebrationAnnouncement').play=()=>Promise.reject(new Error('Synthetic autoplay rejection'));enMilestoneShow({id:'blansas',title:'Kansas'},true)});
  await page.waitForFunction(()=>document.querySelector('#enCelebrationStage').dataset.phase==='scene');
  await page.locator('#enCelebrationSound').click();
  assert.equal(await page.locator('#enCelebrationSound').getAttribute('aria-pressed'),'false');
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
