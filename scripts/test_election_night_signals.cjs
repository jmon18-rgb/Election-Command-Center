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
assert(signals.TRACKED.length>=9);
assert.equal(signals.evaluateMilestones(r,{year:2024,now:at}).every(x=>x.state==='waiting'),true);
r['Senate|TX']=mk('Senate','TX','Democrat Senate','D');
assert.equal(find('blexas').state,'warming','Texas one race cannot activate Blexas');
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
