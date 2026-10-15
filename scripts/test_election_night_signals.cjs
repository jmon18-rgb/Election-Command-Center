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
