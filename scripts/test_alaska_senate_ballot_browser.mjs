// SYNTHETIC corrected-party and legacy-cache scenarios, not live Alaska votes.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{candidates}=require('./alaska_senate_test_fixture.cjs');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_URL||'playwright');
const root=resolve(import.meta.dirname,'..'),types={'.html':'text/html','.js':'text/javascript','.json':'application/json'};
const server=createServer((req,res)=>{const n=new URL(req.url,'http://localhost').pathname,f=resolve(root,'.'+(n==='/'?'/index.html':n));
 if(!f.startsWith(root+sep)||!existsSync(f)||!statSync(f).isFile())return res.writeHead(404).end();
 res.writeHead(200,{'content-type':types[extname(f)]||'application/octet-stream'}).end(readFileSync(f));});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
 for(const width of [1366,390]){
  const c=await browser.newContext({viewport:{width,height:844}}),p=await c.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));await p.clock.install({time:new Date('2026-11-04T06:15:00Z')});
  await p.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  await p.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
  await p.locator('[data-page="electionNight"]').click();await p.locator('#enMode2026').click();
  await p.waitForFunction(()=>jointBasis&&jointLastResult?.probabilities);
  const result=await p.evaluate(people=>{
   const item={office:'Senate',key:'AK'},search={country:'US',province:'AK',municipality:null,district:null,id:86916,
    election_date:'2026-11-03T05:00:00.000Z',election_name:'Alaska US Senate',type:'US Senate',election_type:'General',candidates:people};
   const detail={...search,election_type:search.type,round:1,test_data:false,percent_reporting:70,last_updated:'2026-11-04T06:10:00Z'};
   const wrong=structuredClone(search);wrong.candidates.find(c=>c.candidate_id===219761).party='Republican';
   const rejected=StateBatchCivicAdapter.select(item,{count:1,races:[wrong]})===null;
   const normalized=StateBatchCivicAdapter.validate(item,search,detail);
   if(!normalized)throw Error('Corrected-party synthetic partial count rejected');
   enCivicBreaker?.success();delete enCivicErrors['Senate|AK'];
   enCivicValidatedGenerations['Senate|AK']=enCivicBreaker?.status().generation;
   enCivicByWatch['Senate|AK']=normalized;enWatched=[item];enRenderWatchlist();
   const firstChoiceStatus=enCivicStatus(item),rawTotal=enCivicUsable(item)?.total;
   const legacy={...normalized,called:'Daniel J. Jr. Sullivan',candidates:[
    {name:'Daniel J. Jr. Sullivan',party:'R',votes:700,percent:70},
    {name:'Mary Peltola',party:'D',votes:300,percent:30}]};
   enCivicByWatch['Senate|AK']=legacy;
   const call=ElectionNightSignals.validatedCall(legacy),aggregate=RaceLiveNowcast.observed(item,null,legacy);
   const smart=smartRaceSource(item),early=enEarlyLiveObservation(item),national=jointLiveObservations();
   enCivicByWatch['Senate|AK']=normalized;enRenderWatchlist();
   return {rejected,firstChoiceStatus,rawTotal,call,aggregate,smart,earlySource:early.source,nationalAK:national['AK-SEN']||null};
  },candidates(510,490));
  assert.equal(result.rejected,true);assert.equal(result.rawTotal,1000);
  assert.match(result.firstChoiceStatus,/FIRST CHOICES.*NOT FINAL RCV.*NO VERIFIED CALL/);
  for(const key of ['call','aggregate','smart','earlySource','nationalAK'])assert.equal(result[key],null,key);
  await p.locator('#enWatchItems').evaluate(n=>{for(let a=n;a;a=a.parentElement)if(a.tagName==='DETAILS')a.open=true;n.scrollIntoView({block:'center'});});
  assert.equal(await p.locator('#enWatchItems').isVisible(),true);
  await p.screenshot({path:'artifacts/readiness/synthetic-alaska-ballot-guard-'+width+'.png'});
  assert.deepEqual(errors,[]);await c.close();
  console.log(width+'px AK source-party rejection, labeled first-choice raw counts, legacy call exclusion and no national/party-aggregate prediction PASS (SYNTHETIC)');
 }
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
