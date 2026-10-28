// Isolated UI tasks with fictional rehearsal counts; no live provider requests.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_URL||'playwright');
const root=resolve(import.meta.dirname,'..'),out=resolve(root,'artifacts/readiness/ui-review');mkdirSync(out,{recursive:true});
const before=process.argv.includes('--capture-before'),label=before?'before':'after',receipt=[];
const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml'};
const server=createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname,file=resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+sep)||!existsSync(file)||!statSync(file).isFile())return res.writeHead(404).end();res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'}).end(readFileSync(file));});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));let browser;
try{browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
 for(const width of [1366,390]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-10-27T19:00:00Z')});
  await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
  await page.locator('[data-page="electionNight"]').click();await page.locator('#enMode2026').click();
  await page.waitForFunction(()=>jointLastResult?.probabilities);
  const live=await page.evaluate(()=>JSON.stringify(jointLastResult.probabilities));
  await page.locator('#enNationalRehearsal > summary').click();
  await page.locator('#enNationalRehearsal > details > summary').click();
  await page.locator('#enNationalNext').click();await page.locator('#enNationalNext').click();
  await page.waitForFunction(()=>document.querySelector('#enNationalStage').textContent.includes('3/5'));
  const button=await page.locator('#enNationalNext').evaluate(e=>({height:e.getBoundingClientRect().height,background:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color}));
  await page.locator('#enNationalNext').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,'rehearsal-controls-'+label+'-'+width+'.png')});
  const card=page.locator('#enPersonalFocusPreview [data-race="NE-SEN"]'),detail=card.locator('details'),summary=detail.locator('summary');
  await summary.click();assert.match(await card.innerText(),/Osborn\+3\.0 margin points vs expected/);
  const geometry=await card.evaluate(e=>{const a=e.getBoundingClientRect(),peer=Array.from(e.parentElement.children).find(c=>c!==e&&Math.abs(c.getBoundingClientRect().top-a.top)<2);return {openHeight:a.height,peerHeight:peer?.getBoundingClientRect().height||null,align:getComputedStyle(e.parentElement).alignItems};});
  await card.screenshot({path:resolve(out,'expanded-race-'+label+'-'+width+'.png')});
  await summary.focus();const scrollBefore=await page.evaluate(()=>scrollY);await page.evaluate(()=>jointNationalPreview());
  const retained=await page.evaluate(()=>{const c=document.querySelector('#enPersonalFocusPreview [data-race="NE-SEN"]');return {open:c.querySelector('details').open,focus:document.activeElement===c.querySelector('summary')};});
  const scrollDelta=(await page.evaluate(()=>scrollY))-scrollBefore;
  if(!before){
   assert(button.height>=44,'Next control has at least a44px target');assert(button.background.match(/\d+/g).slice(0,3).map(Number).reduce((s,n)=>s+n,0)<600,'Themed dark control rather than native white');
   const contrast=await page.locator('#enNationalNext').evaluate(e=>{const rgb=x=>x.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>{const s=n/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;});const lum=x=>{const a=rgb(x);return .2126*a[0]+.7152*a[1]+.0722*a[2];};const c=getComputedStyle(e),a=lum(c.color),b=lum(c.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);});assert(contrast>=4.5,'Control text contrast');
   assert.equal(geometry.align,'start');if(geometry.peerHeight!==null)assert(geometry.openHeight>geometry.peerHeight+40,'Opening one card does not stretch its neighbors');
   assert.deepEqual(retained,{open:true,focus:true},'Immediate redraw preserves disclosure/focus by race identity');
   assert(Math.abs(scrollDelta)<=2,'Unchanged redraw does not reset the operator scroll position');
   await page.keyboard.press('Tab');await page.locator('#enNationalNext').focus();
   const focusStyle=await page.locator('#enNationalNext').evaluate(e=>({width:getComputedStyle(e).outlineWidth,style:getComputedStyle(e).outlineStyle}));assert.equal(focusStyle.width,'3px');assert.equal(focusStyle.style,'solid');
   await page.locator('#enNationalNext').press('Enter');await page.waitForFunction(()=>document.querySelector('#enNationalStage').textContent.includes('4/5'));
   assert.equal(await detail.evaluate(e=>e.open),true,'Scenario correction retains the open explanation');assert.match(await card.innerText(),/Even margin points vs expected/);
   assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('#enNationalNext')),true,'Advancing with keyboard does not steal focus into a card');
   await summary.focus();await page.evaluate(async()=>{nationalPreviewStep=4;await jointNationalPreview();});
   assert.equal(await detail.count(),0,'Withdrawn evidence removes the obsolete explanation');
   assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('#enPersonalFocusPreview [data-race="NE-SEN"] h4')),true,'If focused explanation vanishes, focus stays with its race');
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true);
  assert.equal(await page.evaluate(()=>JSON.stringify(jointLastResult.probabilities)),live,'Presentation never changes the live forecast');assert.deepEqual(errors,[]);
  receipt.push({width,button,geometry,retained,scrollDelta,passed:before?null:true,scope:'Isolated fictional UI task; external sources blocked; not human acceptance/calibration'});
  await page.close();console.log(width+'px rehearsal readability '+label+' capture/tasks complete');
 }
 writeFileSync(resolve(out,'rehearsal-readability-'+label+'.json'),JSON.stringify({at:new Date().toISOString(),revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),workingTreeCandidate:!before,receipt},null,2));
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
