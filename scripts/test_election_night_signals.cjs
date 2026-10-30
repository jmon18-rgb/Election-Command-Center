#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const signals=require('./election_night_signals.js');
const at=Date.parse('2026-11-04T03:00:00Z');
const mk=(office,key,winner,party,opponent='Republican Candidate',oppParty='R')=>({
 provider:'civicAPI',office,key,race_id:100,total:98001,
 last_updated:'2026-11-04T02:00:00Z',percent_reporting:92,
 called:winner,candidates:[{name:winner,party,votes:65000},
  {name:opponent,party:oppParty,votes:33001}]
});
const r={};
const find=(id,year=2026,now=at)=>signals.evaluateMilestones(r,{year,now}).find(x=>x.id===id);
// Independent stories cannot borrow a different race or named candidate.
assert(signals.TRACKED.some(x=>x.office==='Senate'&&x.key==='MS'));
const separate={};
const separateState=(id,year=2026,now=at)=>signals.evaluateMilestones(separate,{year,now}).find(x=>x.id===id).state;
separate['Senate|TX']={...mk('Senate','TX','James Talarico','D','Ken Paxton'),race_id:87438};
assert.equal(separateState('talarico'),'earned');
assert.equal(separateState('abbott'),'waiting','Senate victory cannot defeat a governor');
assert.equal(separateState('blexas'),'warming','Two-call bonus still needs the governor');
separate['Senate|TX'].candidates[0].name='Another Democrat';
separate['Senate|TX'].called='Another Democrat';
assert.equal(separateState('talarico'),'waiting','Named story requires Talarico himself');
separate['Senate|TX'].candidates[0].name='James Talarico';
separate['Senate|TX'].called='James Talarico';
separate['Senate|TX'].last_updated='2026-11-04T01:59:00Z';
assert.equal(separateState('talarico'),'waiting','Texas final-close guard applies to the separate story');
delete separate['Senate|TX'];
separate['Governor|TX']=mk('Governor','TX','Democratic Candidate','D','Greg Abbott');
assert.equal(separateState('abbott'),'earned','Governor story does not require Senate success');
assert.equal(separateState('talarico'),'waiting');
assert.equal(separateState('blexas'),'warming');
separate['Governor|TX'].candidates[1].name='Another Republican';
assert.equal(separateState('abbott'),'waiting','Abbott story needs the named opponent');
separate['Governor|TX'].candidates[1].name='Greg Abbott';
separate['Governor|TX'].called=null;
assert.equal(separateState('abbott'),'waiting','Withdrawal revokes the governor story');
separate['Senate|MS']={...mk('Senate','MS','Democratic Candidate','D','Republican Candidate'),race_id:81004};
assert.equal(separateState('mississippi'),'earned');
assert.equal(separateState('mississippi',2024),'waiting','Archive mode cannot earn a current story');
separate['Senate|MS'].key='TX';
assert.equal(separateState('mississippi'),'waiting','A dictionary key cannot conceal the wrong contest');
separate['Senate|MS'].key='MS';
separate['Senate|MS'].last_updated='2024-11-04T02:00:00Z';
assert.equal(separateState('mississippi'),'waiting','Historical source clock cannot earn a 2026 story');
separate['Senate|MS'].last_updated='2026-11-04T02:00:00Z';
separate['Senate|MS'].sourceStale=true;
assert.equal(separateState('mississippi'),'waiting','Stale source remains ineligible');
delete separate['Senate|MS'].sourceStale;
separate['Senate|MS'].called=null;
assert.equal(separateState('mississippi'),'waiting','Retracted Mississippi call revokes the story');
assert(signals.TRACKED.length>=9);
assert.equal(signals.evaluateMilestones(r,{year:2024,now:at}).every(x=>x.state==='waiting'),true);
r['Senate|TX']=mk('Senate','TX','Democrat Senate','D');
assert.equal(find('blexas').state,'warming','Texas one race cannot activate Blexas');
r['Governor|TX']=mk('Governor','IA','Iowa Governor','D');
assert.equal(find('blexas').state,'warming',
 'A source record from another state cannot satisfy a Texas governor call');
delete r['Governor|TX'];
r['Governor|TX']=mk('Governor','TX','Democrat Governor','D');
assert.equal(find('blexas').state,'earned');
r['Governor|TX'].called=null;
assert.equal(find('blexas').state,'warming','A withdrawn call revokes a two-race milestone');
r['Governor|TX'].called='Republican Candidate';
assert.equal(find('blexas').state,'warming','A Republican call cannot satisfy Blexas');
r['Governor|TX']=mk('Governor','TX','Democrat Governor','D');
r['Senate|IA']=mk('Senate','IA','Iowa Democrat','D');
assert.equal(find('blue_corn').state,'earned','Iowa either statewide race triggers Blue Corn');
delete r['Senate|IA'];
r['Governor|IA']=mk('Governor','IA','Iowa Governor','D');
assert.equal(find('blue_corn').state,'earned');
r['Senate|SC']=mk('Senate','SC','Annie Andrews','D','Darline Graham');
assert.equal(find('graham').state,'earned');
r['Senate|SC'].candidates[1].name='Someone Else';
assert.equal(find('graham').state,'waiting','Never celebrate an unverified opponent');
r['Senate|SC'].candidates[1].name='Darline Graham';
r['Senate|ME']=mk('Senate','ME','Democrat','D','Susan Collins');
assert.equal(find('maine').state,'earned');
r['Senate|ME'].candidates[1].name='Other person';
assert.equal(find('maine').state,'waiting','Maine joke must identify Collins as opponent');
r['Senate|KS']=mk('Senate','KS','Democratic Candidate','D');
assert.equal(find('blansas').state,'earned');
r['Senate|NE']=mk('Senate','NE','Dan Osborn','O','Republican Candidate');
assert.equal(find('nebraska').state,'earned','Osborn is an independent, not silently a Democrat');
r['Senate|NE'].candidates[0].name='Different independent';
r['Senate|NE'].called='Different independent';
assert.equal(find('nebraska').state,'waiting','Another independent cannot unlock Osborn');
r['Senate|OH-special']=mk('Senate','OH-special','Ohio Democrat','D');
assert.equal(find('ohio').state,'earned');
assert.equal(find('ohio',2024).state,'waiting');
assert.equal(find('ohio',2026,Date.parse('2026-10-15T15:00:00Z')).state,'waiting');
r['Senate|OH-special'].last_updated='2024-11-04T02:00:00Z';
assert.equal(find('ohio').state,'waiting','2024 source timestamps cannot trigger a 2026 event');
r['Senate|OH-special'].last_updated='2026-11-04T02:00:00Z';
r['Senate|OH-special'].provider='unverified';
assert.equal(find('ohio').state,'waiting','Unverified provider name is not a winner call');
r['Senate|OH-special'].provider='civicAPI';
assert.equal(find('ohio').state,'earned');
// A "winner" cannot be honored merely because the first US polls
// have closed. Iowa, California and Alaska have later local closes.
for(const [office,key,pre,closed] of [
 ['Senate','IA','2026-11-04T01:59:00Z','2026-11-04T02:00:00Z'],
 ['Governor','CA','2026-11-04T03:59:00Z','2026-11-04T04:00:00Z'],
 ['Senate','AK','2026-11-04T05:59:00Z','2026-11-04T06:00:00Z']
]){
 const row=mk(office,key,'Democrat Candidate','D');
 row.last_updated=pre;
 assert.equal(signals.validatedCall(row,Date.parse(pre)),null,
  key+' preclose source call must fail');
 row.last_updated=closed;
 assert.equal(signals.validatedCall(row,Date.parse(closed))?.party,key==='AK'?undefined:'D',
  key+' valid postclose source can recover');
}
// Legitimate early source totals can precede the LAST polling closure,
 // but cannot award a statewide race call or trigger a celebratory milestone.
for(const [office,key,early,last] of [
 ['Senate','TX','2026-11-04T01:00:00Z','2026-11-04T02:00:00Z'],
 ['Governor','FL','2026-11-04T00:00:00Z','2026-11-04T01:00:00Z'],
 ['Governor','AK','2026-11-04T05:00:00Z','2026-11-04T06:00:00Z']
]){
 const row=mk(office,key,'Candidate D','D');
 row.last_updated=early;
 assert.equal(signals.validatedCall(row,Date.parse(last)+3600000),null,
  key+' cannot revive a source-stamped pre-final statewide winner');
 row.last_updated=last;
 assert.equal(signals.validatedCall(row,Date.parse(last))?.party,'D',
  key+' can accept a new post-final-close verified provider call');
}

const iowaPremature=mk('Senate','IA','Iowa candidate','D');
iowaPremature.last_updated='2026-11-04T01:59:00Z';
const earlyAwards=signals.evaluateMilestones(
 {'Senate|IA':iowaPremature},{now:Date.parse(iowaPremature.last_updated)});
assert.equal(earlyAwards.find(z=>z.id==='blue_corn').state,'waiting',
 'Iowa Blue Corn cannot celebrate a future/local preclose flag');
// Browser script initialization can precede the common closing-time module.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const win={};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,
 'election_night_signals.js'),'utf8'),{window:win});
const ma=mk('Senate','ME','Democrat','D','Susan Collins');
assert.equal(win.ElectionNightSignals.validatedCall(ma,at),null,
 'Missing poll-close module must fail closed');
win.ElectionNightPollClosings2026=require('./election_night_poll_closings_2026.js');
assert.equal(win.ElectionNightSignals.validatedCall(ma,at)?.party,'D',
 'Once shared module loads, genuinely postclose calls recover');

const evidence=r['Senate|OH-special'];
const original=JSON.parse(JSON.stringify(evidence));
function rejects(change,reason){
 const attempt=JSON.parse(JSON.stringify(original));
 change(attempt);
 assert.equal(signals.validatedCall(attempt,at),null,reason);
}
rejects(row=>{row.last_updated='2026-11-03T18:00:00Z'},
 'Expired provider winner flag must not freeze the election model');
rejects(row=>{row.stale=true},'A stale record cannot be a winner call');
rejects(row=>{row.race_id=0},'A source call requires a positive provider race ID');
rejects(row=>{row.key='MI-01'},'A House district cannot masquerade as a Senate seat');
rejects(row=>{row.office='Unknown'},'Unknown office must be rejected');
rejects(row=>{row.percent_reporting=102},'Invalid reporting percentage');
rejects(row=>{row.total=300},'Listed candidate votes cannot exceed counted total');
rejects(row=>{row.candidates[0].votes=-1},'Negative winner vote count is not valid');
rejects(row=>{row.candidates.push({...row.candidates[0]})},
 'Duplicate normalized candidate identities cannot generate a call');
rejects(row=>{row.called='Unknown candidate'},
 'The announced winner must match exactly one listed candidate');
rejects(row=>{row.called=null},'A missing winner is not a call');
rejects(row=>{row.candidates[0].party='???'},'Unknown normalized candidate party');
rejects(row=>{row.candidates[0].votes=0},'Winner must have positive reported votes');
assert.equal(signals.validatedCall({...original,last_updated:'2026-11-03T20:00:00Z'},
 Date.parse('2026-11-03T21:00:00Z')),null,
 'No pre-close provider call may lock the national needle');
const good=signals.validatedCall(original,at);
assert.equal(good?.sourceClass,'provider_reported_unofficial');
assert.equal(good?.certified,false);
assert.equal(good?.professionallyReviewed,false);
const staleTime=Date.parse('2026-11-04T06:00:01Z');
assert.equal(signals.validatedCall(original,staleTime),null,
 'Provider calls cease to be valid when evidence becomes older than three hours');
const one=signals.evaluateMilestones(r,{year:2026,now:at});
const changes=signals.changingMilestones([],one);
assert(changes.gained.includes('blexas')&&changes.gained.includes('ohio'));
r['Governor|TX'].called=null;
const changed=signals.changingMilestones(changes.active,signals.evaluateMilestones(r,{year:2026,now:at}));
assert(changed.withdrawn.includes('blexas'),'Corrections must be reversible');
const fake=k=>({probabilities:{red_dawn:k,shrug:20,blue_wave:55-k,blue_tsunami:25},
 race_probabilities:[{race_code:'OH-SEN',dem_beats_rep_pct:35+k}]});
const prior=fake(30),next=fake(18);
assert(signals.position(prior)<signals.position(next));
const pulse=signals.explainNeedle(next,prior,[{race_code:'OH-SEN',office:'Senate',
 provider:'civicAPI',reporting:55,asOf:'2026-11-04T02:00:00Z'}]);
assert(pulse&&pulse.shift>0&&pulse.dBothChange>0);
assert.equal(pulse.earlyCount,1);
assert.equal(pulse.drivers[0].early,true);
assert.equal(signals.explainNeedle(next,prior,[]).liveCount,0);
console.log('Election-night needle movement and source-called milestone rules PASS');

const oldAK=mk('Senate','AK','Daniel J. Jr. Sullivan','R');oldAK.last_updated='2026-11-04T06:10:00Z';assert.equal(signals.validatedCall(oldAK,Date.parse('2026-11-04T06:15:00Z')),null,'A cached older Alaska source cannot award a Republican chamber seat from the wrong Sullivan/RCV contract');

// Fictional normalized Michigan calls only: this does not establish a live
// provider race ID, ballot roster, source delivery or a new collection route.
// Acquisition remains the original fixed ten items. A new story only reads
// a Michigan call already admitted by the existing provider path.
assert.deepEqual(signals.TRACKED,[
 {office:'Senate',key:'SC'},{office:'Senate',key:'TX'},{office:'Governor',key:'TX'},
 {office:'Senate',key:'IA'},{office:'Governor',key:'IA'},
 {office:'Senate',key:'KS'},{office:'Senate',key:'ME'},{office:'Senate',key:'NE'},
 {office:'Senate',key:'OH-special'},{office:'Senate',key:'MS'}
],'Adding a celebration must not change the transport-tracked cohort');
const miSpec=signals.MILESTONES.find(x=>x.id==='michigan');
assert.deepEqual(miSpec.needs,[{office:'Senate',key:'MI',party:'D'}]);
assert.equal(miSpec.type,'all');
const miCall=()=>mk('Senate','MI','Fictional Michigan Democrat','D','Fictional Michigan Republican');
const miState=(row,now=at,year=2026)=>signals.evaluateMilestones(
 row?{'Senate|MI':row}:{},{now,year}).find(x=>x.id==='michigan');
assert.equal(miState(null).state,'waiting','No cached call cannot earn Michigan');
const earnedMi=miState(miCall());
assert.equal(earnedMi.state,'earned');
assert.equal(earnedMi.evidence[0].key,'Senate|MI');
assert.equal(earnedMi.evidence[0].call.sourceClass,'provider_reported_unofficial');
assert.equal(earnedMi.evidence[0].call.certified,false);
assert.equal(miState({...miCall(),called:null}).state,'waiting','A raw lead is not a call');
assert.equal(miState({...miCall(),called:'Fictional Michigan Republican'}).state,'waiting','An R call cannot earn Michigan');
assert.equal(miState(miCall(),at,2024).state,'waiting','Archive cannot earn Michigan');
for(const [change,label]of [
 [r=>{r.provider='Open America'},'Primary raw counts are not the civicAPI call ledger'],
 [r=>{r.office='Governor'},'Wrong office under a Michigan Senate dictionary key'],
 [r=>{r.key='OH-special'},'Wrong contest under a Michigan dictionary key'],
 [r=>{r.race_id=0},'No invented or missing provider race identity'],
 [r=>{r.called='Unlisted winner'},'Winner must match exactly one listed candidate'],
 [r=>{r.candidates.push({...r.candidates[0]})},'Duplicate candidate identity'],
 [r=>{r.total=0},'Zero votes cannot earn a call'],
 [r=>{r.candidates[0].votes=0},'A called candidate must have positive votes'],
 [r=>{r.stale=true},'Stale source'],[r=>{r.sourceStale=true},'Source-wide unavailable flag'],
 [r=>{r.last_updated='2024-11-04T02:00:00Z'},'Historical source timestamp'],
 [r=>{r.last_updated='2026-11-04T01:59:59.999Z'},'Pre-final-close source flag cannot revive later'],
 [r=>{r.last_updated='2026-11-04T03:15:00.001Z'},'Future source timestamp beyond existing15min guard']
]){const row=miCall();change(row);assert.equal(miState(row).state,'waiting',label);}
const earlyMi=miCall();earlyMi.last_updated='2026-11-04T01:00:00Z';
assert.equal(miState(earlyMi,Date.parse(earlyMi.last_updated)).state,'waiting','Michigan earliest local close does not award a statewide call');
const finalMi=miCall();finalMi.last_updated='2026-11-04T02:00:00Z';
assert.equal(miState(finalMi,Date.parse(finalMi.last_updated)-1).state,'waiting','Michigan cannot earn before final9PMET close');
assert.equal(miState(finalMi,Date.parse(finalMi.last_updated)).state,'earned','The exact installed final-close boundary is unchanged');
assert.equal(miState(finalMi,Date.parse(finalMi.last_updated)+180*60000).state,'earned','Existing inclusive three-hour freshness boundary');
assert.equal(miState(finalMi,Date.parse(finalMi.last_updated)+180*60000+1).state,'waiting','Expired call is withdrawn without a new threshold');
const miAll=signals.evaluateMilestones({'Senate|MI':miCall()},{year:2026,now:at});
assert.deepEqual(miAll.filter(x=>x.state==='earned').map(x=>x.id),['michigan'],'Michigan cannot borrow or award another state milestone');
const miGain=signals.changingMilestones([],miAll);
assert.deepEqual(miGain.gained,['michigan']);
assert.deepEqual(signals.changingMilestones(miGain.active,miAll).gained,[],'Repeated identical call does not regain a seen event');
const miWithdrawal=signals.changingMilestones(miGain.active,signals.evaluateMilestones(
 {'Senate|MI':{...miCall(),called:null}},{year:2026,now:at}));
assert.deepEqual(miWithdrawal.withdrawn,['michigan'],'A corrected or withdrawn call revokes Michigan');
assert.deepEqual(signals.changingMilestones(miWithdrawal.active,miAll).gained,['michigan'],'A genuinely readmitted call can recover');
const miWindow={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'election_night_signals.js'),'utf8'),{window:miWindow});
assert.equal(miWindow.ElectionNightSignals.evaluateMilestones({'Senate|MI':miCall()},{year:2026,now:at}).find(x=>x.id==='michigan').state,'waiting','Missing shared final-close validator fails closed for Michigan');
console.log('Michigan passive-call celebration: unchanged acquisition cohort, final-close/freshness/identity/withdrawal/dedup guards PASS');
