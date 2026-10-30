'use strict';
// Fictional normalized records through the ACTUAL page cache/coordinator.
// No discovery, provider delivery, model accuracy or certification claim.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),index=fs.readFileSync(path.join(root,'index.html'),'utf8'),signals=require('./election_night_signals.js'),closings=require('./election_night_poll_closings_2026.js');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
function between(a,b){const start=index.indexOf(a),end=index.indexOf(b,start);assert(start>=0&&end>start);return index.slice(start,end);}
const oldIds=['graham','blexas','blue_corn','blansas','maine','nebraska','ohio','talarico','abbott','mississippi','michigan'],newIds=['florida_senate','louisiana_senate'];
assert.deepEqual(signals.MILESTONES.map(x=>x.id),oldIds.concat(newIds));
assert.deepEqual(signals.TRACKED,[{office:'Senate',key:'SC'},{office:'Senate',key:'TX'},{office:'Governor',key:'TX'},{office:'Senate',key:'IA'},{office:'Governor',key:'IA'},{office:'Senate',key:'KS'},{office:'Senate',key:'ME'},{office:'Senate',key:'NE'},{office:'Senate',key:'OH-special'},{office:'Senate',key:'MS'}]);
const cacheFunctions=between('function enCivicProviderVerified(){','const enJohnBrownPortraitUrl='),tracked=between('function enMilestoneTracked(item){','function enEarlySourceTracked(item){'),acquisition=between('function enShouldProbeSupplemental(item,now=Date.now(),context=null){','// Every 30 seconds'),collect=between('function enMilestoneEvidence(){','function enMilestoneRender(item,demo=false){');
assert.equal(sha(cacheFunctions),'1702d1fa9bf54d3adc610746ec6fa38721d37cc92b962c8125cd73af4d4ad19e');
assert.equal(sha(tracked),'287882a842d12a3ed0ef4d91b1200d5311ff4977c922799db7d697f024c19992');
assert.equal(sha(acquisition),'b8b65181dcdc3a006121a1b3132900f1df6782b5083c99a13418975df0ddb8b3');
const NOW=Date.parse('2026-11-04T03:00:00Z');let now=NOW;class Clock extends Date{static now(){return now;}}
const calls=Object.create(null),reads=[],network=[],source={year:2026,office:'Senate',as_of:'2026-11-04T02:59:00Z',races:{'FL-special':{total:100},LA:{total:100}}};
const sandbox={window:{ElectionNightSignals:signals},Date:Clock,enModeYear:2026,enCivicByWatch:calls,enCivicErrors:Object.create(null),enCivicValidatedGenerations:Object.create(null),enCivicBreaker:null,enWatchId:x=>x.office+'|'+x.key,enElectionVotesAllowed:(key,total,stamp,at)=>closings.allowed(key,total,stamp,at),enSupportedStates:new Set(['FL','LA']),enOfficeSnapshots:{Senate:source},enOffice:'Senate',enData:source,enOfficeErrors:{},enResumePendingOffices:new Set(),enFetchError:null,enHouseSourceItem:x=>x,fetch:(...args)=>{network.push(args);throw Error('No acquisition from presentation');},enRefreshCivicWatchlist:()=>{network.push('refresh');throw Error('No refresh from presentation');}};
vm.runInNewContext(cacheFunctions+'\n'+tracked+'\n'+acquisition+'\n'+collect+'\nglobalThis.collect=enMilestoneEvidence;',sandbox);
const usable=sandbox.enCivicUsable;sandbox.enCivicUsable=item=>{reads.push(item.office+'|'+item.key);return usable(item);};
const row=key=>({provider:'civicAPI',office:'Senate',key,race_id:key==='LA'?902:901,total:100,percent_reporting:70,last_updated:'2026-11-04T02:30:00Z',called:'Fictional Democrat',candidates:[{name:'Fictional Democrat',party:'D',votes:60},{name:'Fictional Republican',party:'R',votes:40}]});
let groups=0;
function assess(key,value,at=NOW,year=2026){now=at;sandbox.enModeYear=year;for(const k of Object.keys(calls))delete calls[k];if(value)calls['Senate|'+key]=value;reads.length=0;const rows=sandbox.collect(),items=signals.evaluateMilestones(rows,{year,now:at});assert.equal(reads.length,13);assert.equal(new Set(reads).size,13);assert.equal(network.length,0);return {rows,item:items.find(x=>x.id===(key==='LA'?newIds[1]:newIds[0])),items};}
for(const [key,id,close]of [['FL-special',newIds[0],'2026-11-04T01:00:00Z'],['LA',newIds[1],'2026-11-04T02:00:00Z']]){
 assert.deepEqual(signals.MILESTONES.find(x=>x.id===id).needs,[{office:'Senate',key,party:'D'}]);
 assert.equal(sandbox.enMilestoneTracked({office:'Senate',key}),false);assert.equal(sandbox.enShouldProbeSupplemental({office:'Senate',key},NOW),false,'No new healthy-primary transport exception');
 assert.equal(assess(key,null).item.state,'waiting');const earned=assess(key,row(key));assert.equal(earned.item.state,'earned');assert.equal(earned.rows['Senate|'+key],calls['Senate|'+key]);groups++;
 for(const changed of [{called:null},{called:'Fictional Republican'},{office:'Governor'},{key:key==='LA'?'LA-special':'FL'},{stale:true},{sourceStale:true},{provider:'unknown'},{total:99},{last_updated:'2026-11-03T20:00:00Z'},{last_updated:'2026-11-04T03:15:00.001Z'}]){assert.equal(assess(key,{...row(key),...changed}).item.state,'waiting',JSON.stringify(changed));groups++;}
 const at=Date.parse(close);assert.equal(assess(key,{...row(key),last_updated:close},at).item.state,'earned','Exact installed final-close boundary');assert.equal(assess(key,{...row(key),last_updated:new Date(at-1).toISOString()},at).item.state,'waiting','Before final-close source stamp');assert.equal(assess(key,{...row(key),last_updated:close},at-1).item.state,'waiting','Before final-close wall clock');groups++;
 assert.equal(assess(key,row(key),Date.parse(row(key).last_updated)+180*60000+1).item.state,'waiting');assert.equal(assess(key,row(key),NOW,2024).item.state,'waiting');groups++;
 sandbox.enCivicErrors['Senate|'+key]='Fictional source unavailable';assert.equal(assess(key,row(key)).item.state,'waiting');delete sandbox.enCivicErrors['Senate|'+key];
 sandbox.enCivicBreaker={status:()=>({consecutive:1,generation:4})};assert.equal(assess(key,row(key)).item.state,'waiting');sandbox.enCivicBreaker=null;groups++;
 // These deliberately extreme display/scenario odds are not source calls.
 sandbox.jointLastResult={race_probabilities:[{race_code:key==='LA'?'LA-SEN':'FL-SEN',dem_beats_rep_pct:100}]};assert.equal(assess(key,{...row(key),called:null}).item.state,'waiting');delete sandbox.jointLastResult;groups++;
 const gained=signals.changingMilestones([],assess(key,row(key)).items);assert.deepEqual(gained.gained,[id]);assert.deepEqual(signals.changingMilestones(gained.active,assess(key,row(key)).items).gained,[]);assert.deepEqual(signals.changingMilestones(gained.active,assess(key,{...row(key),called:null}).items).withdrawn,[id]);groups++;
}
const seenCode=between('const enMilestoneSeenKey=','function enMilestonePersist(){'),ids=oldIds.concat(newIds),seen={window:{ElectionNightSignals:signals},localStorage:{getItem:()=>JSON.stringify([...ids,'tsunami','unknown'])}};
vm.runInNewContext(seenCode+'\nglobalThis.saved=[...enMilestoneShown];',seen);assert.deepEqual(Array.from(seen.saved),ids);groups++;
assert.equal(network.length,0);
const proof={schema:'stretch-celebration-authority-v1',status:'PASS',at:new Date().toISOString(),groups,source_sha256:{'index.html':sha(index),'scripts/election_night_signals.js':sha(fs.readFileSync(path.join(root,'scripts/election_night_signals.js')))},prior_transport_tracked:10,passive_condition_races:13,earned_ids:13,keys:['Senate|FL-special','Senate|LA'],same_original_acquisition_cache_hashes:true,source_GETs:0,model_draws:0,scope:'Fictional normalized records through original installed cache/poll-closing/coordinator. Neither private-scenario odds nor raw leads award a celebration. Existing source identity admission unchanged; no actual delivery/calibration claim.'};
fs.mkdirSync(path.join(root,'artifacts/readiness'),{recursive:true});fs.writeFileSync(path.join(root,'artifacts/readiness/stretch-celebration-authority.json'),JSON.stringify(proof,null,2)+'\n');console.log('Stretch celebration authority PASS: '+groups+' groups, original10 transport priorities,13 passive reads, exact FL-special/LA call floors and withdrawal.');
