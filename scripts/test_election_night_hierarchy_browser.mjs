// Operator tasks against actual app rendering; all external election requests blocked.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_URL||'playwright');
const root=resolve(import.meta.dirname,'..'),out=resolve(root,'artifacts/readiness/ui-review');
const server=createServer((req,res)=>{
 const file=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/\/$/,'/index.html'));
 if(!file.startsWith(root+sep)||!existsSync(file)||!statSync(file).isFile())return res.writeHead(404).end();
 res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream'}).end(readFileSync(file));
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));let browser;const receipt=[];mkdirSync(out,{recursive:true});
try{
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
 for(const width of [1366,390]){
  const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date('2026-10-27T22:00:00Z')});
  await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
  await page.locator('[data-page="electionNight"]').click();await page.locator('#enMode2026').click();
  await page.waitForFunction(()=>jointLastResult?.probabilities&&document.querySelectorAll('#enNationalNeedleMap .en-nmap-state').length===50&&document.querySelector('#enPersonalFocus article'));
  const probabilities=await page.evaluate(()=>JSON.stringify(jointLastResult.probabilities));
  const order=await page.evaluate(()=>{
   const before=(a,b)=>Boolean(document.querySelector(a).compareDocumentPosition(document.querySelector(b))&Node.DOCUMENT_POSITION_FOLLOWING);
   return {needleMap:before('#jointNightNeedle','#enNationalNeedleMap'),mapPersonal:before('#enNationalNeedleMap','#enPersonalFocus'),outsideSources:!document.querySelector('#enSourceDesk').contains(document.querySelector('#enNationalNeedleMap'))};
  });assert.deepEqual(order,{needleMap:true,mapPersonal:true,outsideSources:true});
  assert.equal(await page.locator('#enSourceDesk').evaluate(e=>e.open),false);
  assert.equal(await page.locator('#enNationalInputDetails').evaluate(e=>e.open),false);
  assert.equal(await page.locator('#jointNightNeedle .four-needle-labels span').count(),4);
  for(const label of await page.locator('#jointNightNeedle .four-needle-labels span').allTextContents())assert.match(label,/%/);
  assert.equal(await page.locator('.en-input-health').isVisible(),true);
  assert.match(await page.locator('.en-input-health').innerText(),/no national|reporting|awaiting/i);
  assert.match(await page.locator('#enPersonalFocus .personal-focus-next').innerText(),/Focus now \/ next: SC-SEN.*7:00 PM ET.*VA-02.*OH-SEN.*7:30 PM ET/);
  await page.locator('#jointNightNeedle').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,'hierarchy-outcomes-'+width+'.png')});
  const ia=page.locator('#enNationalNeedleMap [data-map-state="IA"]');await ia.focus();await ia.press('Enter');
  assert.match(await page.locator('#enNationalNeedleMap .en-nmap-detail').innerText(),/IA-SEN.*model chance/s);
  assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('data-map-state')),'IA');
  await page.evaluate(()=>enRenderNeedleCartogram());
  assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('data-map-state')),'IA','Source redraw retains selected map keyboard focus');
  await page.locator('#enNationalNeedleMap').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,'hierarchy-map-'+width+'.png')});
  await page.locator('#enNationalNeedleMap .en-nmap-open').click();assert.equal(await page.locator('#model.page.active').count(),1,'Map opens the actual model race');
  assert.match(page.url(),/#model\/senate\/IA-SEN$/);
  await page.locator('[data-page="electionNight"]').click();
  await page.locator('#enInspectSources').click();assert.equal(await page.locator('#enLiveCoverageTriage').isVisible(),true);
  await page.locator('#enSourceDesk > summary').focus();await page.evaluate(()=>enRenderAmbientDesk());
  assert.equal(await page.locator('#enSourceDesk').evaluate(e=>e.open),true);
  assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('#enSourceDesk > summary')),true);
  await page.locator('#enSourceDesk > summary').press('Enter');assert.equal(await page.locator('#enSourceDesk').evaluate(e=>e.open),false);
  assert.equal(await page.locator('#enNationalNeedleMap').isVisible(),true,'Closing diagnostics cannot hide the national map');
  await page.locator('#enNationalInputDetails > summary').click();assert.equal(await page.locator('#enNationalSouthCarolinaSource').isVisible(),true);
  await page.locator('#enNationalInputDetails > summary').click();
  assert.equal(await page.evaluate(()=>JSON.stringify(jointLastResult.probabilities)),probabilities,'Navigation/disclosure changes cannot change model probabilities');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,'Map scrolls internally without page overflow');
  assert.deepEqual(errors,[]);receipt.push({width,tasks:'four outcomes/map selection/model navigation/next windows/visible health/source disclosure/focus/no overflow',passed:true,external_sources:'blocked'});
  await page.locator('#enMode2024').click();assert.equal(await page.locator('.en-national-map-panel').isHidden(),true);
  await context.close();console.log(width+'px hierarchy operator tasks PASS');
 }
 writeFileSync(resolve(out,'hierarchy-browser-tasks.json'),JSON.stringify({at:new Date().toISOString(),receipt,limits:'Isolated pre-election UI task evidence, not actual vote delivery or full Oct30 review'},null,2));
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
