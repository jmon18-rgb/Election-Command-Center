// Deferred return of real browser-local storage operations exercises the actual
// controller handlers. No production hook, private file or source request.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_URL||'playwright');
const root=resolve(import.meta.dirname,'..'),out=resolve(root,process.env.UI_REVIEW_OUTPUT_DIR||'artifacts/readiness/ui-review/local-audio-async-races');mkdirSync(out,{recursive:true});
const sourceFiles=['index.html','scripts/election_night_celebration_local.js','scripts/test_celebration_local_races_browser.mjs'];
const hashes=()=>Object.fromEntries(sourceFiles.map(file=>[file,createHash('sha256').update(readFileSync(resolve(root,file))).digest('hex')]));
const sourceHashes=hashes(),types={'.html':'text/html','.js':'application/javascript','.json':'application/json','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const negativeControl=process.argv.includes('--guard-negative-control');let servedIndex=readFileSync(resolve(root,'index.html'),'utf8');
if(negativeControl){
 const action="if(id!==enCelebrationCurrent||modalEpoch!==enCelebrationModalEpoch||settingsEpoch!==enCelebrationSettingsEpoch||!$('#enMilestoneSpotlight').open)return;";
 const info="if(id!==enCelebrationCurrent||modalEpoch!==enCelebrationModalEpoch||settingsEpoch!==enCelebrationSettingsEpoch||request!==enCelebrationInfoEpoch||!$('#enMilestoneSpotlight').open)return;";
 assert.equal(servedIndex.split(action).length,3,'Exactly two actual save/remove guards');assert.equal(servedIndex.split(info).length,2,'Exactly one actual info guard');
 servedIndex=servedIndex.replaceAll(action,"if(id!==enCelebrationCurrent||!$('#enMilestoneSpotlight').open)return;").replace(info,'if(id!==enCelebrationCurrent)return;');
}
const server=createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname,file=resolve(root,'.'+(p==='/'?'/index.html':decodeURIComponent(p)));
 if(!file.startsWith(root+sep)||!existsSync(file)||!statSync(file).isFile())return res.writeHead(404).end();res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'}).end(p==='/'||p==='/index.html'?servedIndex:readFileSync(file));});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
 const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[],blocked=[];
 page.on('pageerror',error=>errors.push(error.message));await page.clock.install({time:new Date('2026-10-28T13:00:00Z')});
 await page.addInitScript(()=>{
  let api;const arms=[],held=new Map();
  window.__localAudioRace={arm(method,id,tag){arms.push({method,id,tag});},pending:()=>[...held.keys()],release(tag){const pending=held.get(tag);if(!pending)throw Error('Missing explicitly held operation '+tag);held.delete(tag);pending.resolve(pending.result);}};
  Object.defineProperty(window,'ElectionNightCelebrationLocal',{configurable:true,get:()=>api,set(value){api=Object.freeze({...value,create(options){
   const actual=value.create(options),wrapped={...actual};
   for(const method of ['save','remove','info'])wrapped[method]=async(...args)=>{
    const result=await actual[method](...args),index=arms.findIndex(a=>a.method===method&&a.id===args[0]);
    if(index<0)return result;const {tag}=arms.splice(index,1)[0];
    return new Promise(resolve=>held.set(tag,{resolve,result}));
   };
   return Object.freeze(wrapped);
  }});}});
 });
 const origin='http://127.0.0.1:'+server.address().port;
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===origin)return route.continue();blocked.push(u.hostname);return route.abort();});
 await page.goto(origin+'/#electionNight',{waitUntil:'domcontentloaded'});await page.locator('#enMode2026').click();await page.waitForFunction(()=>document.querySelectorAll('#enPersonalFocus article').length===19);
 await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+1000)));
 await page.evaluate(()=>{document.querySelector('#enCelebrationAnnouncement').play=()=>Promise.resolve();});
 const launch=page.locator('#enCelebrationsOpen'),audio=page.locator('#enCelebrationLocalAudio'),popup=page.locator('#enMilestoneSpotlight'),records=[];
 const file=name=>{const samples=8000*12,buffer=Buffer.alloc(44+samples*2);buffer.write('RIFF',0);buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(8000,24);buffer.writeUInt32LE(16000,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(samples*2,40);return {name,mimeType:'audio/wav',buffer};};
 const choose=async name=>{const pending=page.waitForEvent('filechooser');await page.locator('#enCelebrationLocalChoose').click();await(await pending).setFiles(file(name));};
 const arm=async(method,tag)=>page.evaluate(({method,tag})=>__localAudioRace.arm(method,'talarico',tag),{method,tag});
 const held=async tag=>page.waitForFunction(tag=>__localAudioRace.pending().includes(tag),tag);
 const release=async tag=>{await page.evaluate(tag=>__localAudioRace.release(tag),tag);await page.clock.runFor(1);};
 const named=async name=>page.waitForFunction(name=>document.querySelector('#enCelebrationLocalName').textContent.includes(name),name);
 const mode=async value=>{if(!await page.locator('.en-celebration-music-settings').evaluate(e=>e.open))await page.locator('.en-celebration-music-settings > summary').click();await page.locator('#enCelebrationMusicMode').selectOption(value);};
 const scene=async()=>{await page.evaluate(()=>document.querySelector('#enCelebrationAnnouncement').dispatchEvent(new Event('ended')));await audio.waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('#enCelebrationLocalAudio').readyState>=2);};
 const reopen=async()=>{await page.keyboard.press('Escape');assert.equal(await popup.isHidden(),true);await launch.click();};
 const awayBack=async()=>{await page.locator('#enCelebrationPreviewChoice').selectOption('abbott');await page.locator('#enCelebrationPreviewChoice').selectOption('talarico');};
 const state=()=>page.evaluate(()=>({mode:enCelebrationMusicSettings.mode,musicEpoch:enCelebrationMusicEpoch,id:enCelebrationCurrent,open:document.querySelector('#enMilestoneSpotlight').open,src:document.querySelector('#enCelebrationLocalAudio').getAttribute('src'),iframe:document.querySelector('#enCelebrationOnlinePlayer iframe')?.getAttribute('src')||null,name:document.querySelector('#enCelebrationLocalName').textContent,removeDisabled:document.querySelector('#enCelebrationLocalRemove').disabled}));
 const unchanged=async(tag,before,{name=false}={})=>{await release(tag);const after=await state();for(const key of ['mode','musicEpoch','id','open','src','iframe'])assert.equal(after[key],before[key],tag+' stale completion changed '+key);if(name)assert.equal(after.name,before.name,tag+' stale info overwrote current file label');records.push({case:tag,before,after,passed:true});};
 await launch.click();
 // A committed save may still be awaiting its controller callback when the same
 // event is reopened. A later explicit mode choice belongs to the new session.
 await arm('save','save-close-reopen');await choose('fictional-A.wav');await held('save-close-reopen');await reopen();await mode('youtube');await unchanged('save-close-reopen',await state());
 // Switching away and back also creates a new presentation of the same event.
 await arm('save','save-away-back');await choose('fictional-B.wav');await held('save-away-back');await awayBack();await mode('original');await named('fictional-B.wav');await scene();const activeB=await state();assert.match(activeB.src,/^blob:/);await unchanged('save-away-back',activeB);
 // A later preference in the SAME modal must supersede an earlier pending save.
 await arm('save','save-later-mode-choice');await choose('fictional-C.wav');await held('save-later-mode-choice');await mode('youtube');await unchanged('save-later-mode-choice',await state());
 // A removed file can be replaced in a new session before the older remove
 // callback returns. Its completion must not restart the new native player.
 await named('fictional-C.wav');await arm('remove','remove-close-reopen');await page.locator('#enCelebrationLocalRemove').click();await held('remove-close-reopen');await reopen();await choose('fictional-D.wav');await named('fictional-D.wav');await scene();const activeD=await state();assert.match(activeD.src,/^blob:/);await unchanged('remove-close-reopen',activeD);
 await arm('remove','remove-away-back');await page.locator('#enCelebrationLocalRemove').click();await held('remove-away-back');await awayBack();await choose('fictional-E.wav');await named('fictional-E.wav');await scene();await unchanged('remove-away-back',await state());
 // Info responses contain no Blob, but must also obey session/latest-request
 // identity so a discarded request cannot paint an old file name over a new one.
 await arm('info','info-close-reopen');await mode('original');await held('info-close-reopen');await reopen();await page.waitForFunction(()=>!document.querySelector('#enCelebrationLocalRemove').disabled);await page.locator('#enCelebrationLocalRemove').click();await page.waitForFunction(()=>document.querySelector('#enCelebrationLocalRemove').disabled);await choose('fictional-F.wav');await named('fictional-F.wav');await unchanged('info-close-reopen',await state(),{name:true});
 await arm('info','info-away-back');await mode('original');await held('info-away-back');await awayBack();await page.waitForFunction(()=>!document.querySelector('#enCelebrationLocalRemove').disabled);await page.locator('#enCelebrationLocalRemove').click();await page.waitForFunction(()=>document.querySelector('#enCelebrationLocalRemove').disabled);await choose('fictional-G.wav');await named('fictional-G.wav');await unchanged('info-away-back',await state(),{name:true});
 await arm('info','info-latest-request');await mode('original');await held('info-latest-request');await choose('fictional-H.wav');await named('fictional-H.wav');await unchanged('info-latest-request',await state(),{name:true});
 await page.keyboard.press('Escape');assert.equal(await audio.isHidden(),true);assert.equal(await audio.getAttribute('src'),null);assert.deepEqual(errors,[]);assert.deepEqual(hashes(),sourceHashes,'Source bytes stay fixed during race review');
 assert(!negativeControl,'Negative control unexpectedly passed every race');
 writeFileSync(resolve(out,'local-audio-async-races.json'),JSON.stringify({at:new Date().toISOString(),scope:'Actual controller/IndexedDB with test-only delayed method return; fictional WAV; external providers blocked',source_hashes:sourceHashes,records,blocked_external_requests:blocked.length,actual_native_provider_gets:0,human_listening:'NOT_RUN'},null,2)+'\n');
 console.log('Actual local-audio handlers PASS:8 deferred realIDB save/remove/info races across same-id reopen, switch-away/back and later choices preserve current mode/nativeURL/music epoch/label');
}catch(error){
 if(!negativeControl||!error.message.includes('save-close-reopen stale completion changed mode'))throw error;
 const report={at:new Date().toISOString(),status:'GUARD_REMOVAL_NEGATIVE_CONTROL_EXPOSED_OLD_RACE',scope:'In-memory HTML string proxy removes only actual controller generation guards; repository files remain unchanged; actual local IndexedDB and component remain in use',source_hashes:sourceHashes,served_index_sha256:createHash('sha256').update(servedIndex).digest('hex'),expected_failure:error.message};
 writeFileSync(resolve(out,'local-audio-async-races-negative-control.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log('Guard-removal negative control correctly detected stale save changing the newly selected mode after same-id reopen');
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
