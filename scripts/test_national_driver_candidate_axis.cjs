#!/usr/bin/env node
'use strict';
// Portable stock-Node regression: actual projection/driver code, no model draws.
// The tiny row adapter checks text/data mechanics, not native layout or input admission.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(process.env.DASHBOARD_TEST_ROOT||path.join(__dirname,'..'));
const html=fs.readFileSync(process.env.COUNTY_DRIVER_INDEX_PATH||path.join(root,'index.html'),'utf8');
const kernel=require(path.join(root,'scripts/national_county_likelihood.js'));
const signals=require(path.join(root,'scripts/election_night_signals.js'));
const fixture=require(path.join(root,'scripts/nebraska_test_fixture.cjs'));
const plain=value=>JSON.parse(JSON.stringify(value)),groups=[];
function check(name,fn){fn();groups.push(name);}
const mapStart=html.indexOf('const countyRows=(conditioned?.diagnostics.used||[]).map('),mapEnd=html.indexOf('\n  jointPulseRows=',mapStart);
assert(mapStart>=0&&mapEnd>mapStart);
const currentSource=html.slice(mapStart,mapEnd);
const rehearsalLine=html.split('\n').find(line=>line.includes('evidence:update.diagnostics.used.map'));
assert(rehearsalLine&&rehearsalLine.trim().endsWith('});'));
const rehearsalSource=rehearsalLine.slice(rehearsalLine.indexOf('evidence:')+9).trim().slice(0,-3);
const loopStart=html.indexOf('for(const d of movement.drivers){'),loopEnd=html.indexOf("\n  context.append(list,elt('p','four-needle-disclosure',",loopStart);
assert(loopStart>=0&&loopEnd>loopStart);
const driverSource=html.slice(loopStart,loopEnd);
const callStart=html.indexOf("jointPulseRows.push({race_code:r.code,office,provider:'civicAPI',"),callEnd=html.indexOf('});',callStart)+3;
assert(callStart>=0&&callEnd>callStart);
const callSource=html.slice(callStart,callEnd);
const current=used=>plain(vm.runInNewContext(currentSource+'\ncountyRows',{conditioned:{diagnostics:{used}}}));
const rehearsal=used=>plain(vm.runInNewContext('('+rehearsalSource+')',{update:{diagnostics:{used}}}));
function frames(code,after=60){
 return [{samples:3000,probabilities:{red_dawn:40,shrug:30,blue_wave:20,blue_tsunami:10},race_probabilities:[{race_code:code,dem_beats_rep_pct:40}]},
  {samples:3000,probabilities:{red_dawn:35,shrug:30,blue_wave:20,blue_tsunami:15},race_probabilities:[{race_code:code,dem_beats_rep_pct:after}]}];
}
function render(rows,code=rows[0].race_code,after=60){
 const [baseline,result]=frames(code,after),movement=signals.explainNeedle(result,baseline,rows),rendered=[];
 assert.equal(movement.drivers.length,rows.length);
 const elt=(tag,className)=>({tag,className,dataset:{},textContent:'',href:''});
 const list={append:row=>rendered.push(row)};
 vm.runInNewContext(driverSource,{movement,elt,list});
 return {movement,text:rendered.map(row=>row.textContent),rows:rendered};
}
const at=Date.parse('2026-11-04T04:06:00Z');
// Existing synthetic parser/compiler input; no simulate/propose/condition API is called.
const ne=kernel.compile(fixture.envelope(0,at),{now:at});
let neCurrent;
check('Current typed Independent diagnostics survive both projection and signal explanation',()=>{
 assert.equal(ne.candidate_contrast,'NE_OSBORN_RICKETTS_V1');
 neCurrent=current([ne]);
 assert.equal(neCurrent[0].candidate_contrast,ne.candidate_contrast);
 assert.equal(neCurrent[0].counted_named_candidate_votes,ne.counted_named_candidate_votes);
 const {movement}=render(neCurrent);
 assert.equal(movement.drivers[0].candidate_contrast,ne.candidate_contrast);
 assert.equal(movement.drivers[0].counted_named_candidate_votes,ne.counted_named_candidate_votes);
});
check('Current Independent win, counted and remaining labels name Osborn and Ricketts',()=>{
 const text=render(neCurrent).text[0];
 assert.match(text,/NE-SEN.*Osborn win 40\.0.*60\.0/);
 assert.match(text,/Osborn\/Ricketts named-candidate votes/);
 assert.match(text,/modeled Osborn\/Ricketts votes remaining/);
 assert.doesNotMatch(text,/\bD win|\bD\/R votes/);
 assert.equal(neCurrent[0].counted_two_party_votes,ne.counted_two_party_votes);
 assert.equal(neCurrent[0].modeled_remaining_two_party_votes,ne.modeled_remaining_two_party_votes);
 assert.deepEqual(neCurrent[0].modeled_remaining_two_party_votes_band,plain(ne.modeled_remaining_two_party_votes_band));
});
check('Rehearsal projection retains the same typed axis without inventing a remaining quantity',()=>{
 const projected=rehearsal([ne]),text=render(projected).text[0];
 assert.equal(projected[0].candidate_contrast,ne.candidate_contrast);
 assert.equal(projected[0].counted_named_candidate_votes,ne.counted_named_candidate_votes);
 assert.match(text,/SIMULATED.*Osborn\/Ricketts named-candidate votes/);
 assert.match(text,/Osborn win/);assert.doesNotMatch(text,/\bD win|\bD\/R votes|modeled .*remaining/);
});
const ordinary={code:'OH-SEN',as_of:'2026-11-04T04:05:00Z',reporting_counties:3,counted_two_party_votes:20000,modeled_remaining_two_party_votes:10000,modeled_remaining_two_party_votes_band:[5000,15000]};
check('Existing D/R current driver wording and all numeric formatting stay exact',()=>{
 assert.equal(render(current([ordinary])).text[0],'OH-SEN · EARLY SIGNAL · D win 40.0 → 60.0% (+20.0 pp) · civicAPI · 3 counties · 20,000 D/R votes · modeled remaining 10,000 (turnout scenario 5,000–15,000)');
});
check('Existing D/R rehearsal wording stays exact',()=>{
 assert.equal(render(rehearsal([ordinary])).text[0],'OH-SEN · EARLY SIGNAL · D win 40.0 → 60.0% (+20.0 pp) · SIMULATED · 3 counties · 20,000 D/R votes');
});
check('Existing validated Republican-call row retains typed Independent candidate labels',()=>{
 const c={jointPulseRows:[],r:{code:'NE-SEN',nonrep_independent_proxy:true},office:'Senate',civic:{percent_reporting:100},verified:{party:'R',at:'2026-11-04T04:05:00Z'}};
 vm.runInNewContext(callSource,c);
 const rows=plain(c.jointPulseRows),text=render(rows,'NE-SEN',0).text[0];
 assert.equal(rows[0].candidate_contrast,'NE_OSBORN_RICKETTS_V1');assert.equal(rows[0].calledParty,'R');
 assert.match(text,/PROVIDER CALL R.*Osborn win 40\.0.*0\.0/);assert.doesNotMatch(text,/\bD win|\bD\/R votes/);
});
check('Missing or unsupported Independent contrast withholds party and vote labels',()=>{
 for(const contrast of [undefined,'D_V_R']){
  const row={...neCurrent[0]};if(contrast===undefined)delete row.candidate_contrast;else row.candidate_contrast=contrast;
  const text=render([row]).text[0];assert.match(text,/Candidate contrast unavailable/);assert.doesNotMatch(text,/\bD win|Osborn win|D\/R votes|named-candidate votes/);
 }
});
check('Inconsistent named-count denominator cannot acquire a legitimate candidate label',()=>{
 const row={...neCurrent[0],counted_named_candidate_votes:neCurrent[0].counted_named_candidate_votes+1},text=render([row]).text[0];
 assert.match(text,/Candidate contrast unavailable/);assert.doesNotMatch(text,/\bD win|Osborn win|D\/R votes|named-candidate votes/);
});
const report={status:'PASS_SYNTHETIC_ZERO_DRAW_CANDIDATE_AXIS_REGRESSION',groups,model_draws:0,network_requests:0,browser_runs:0,formatting_sample_metadata_only:3000,scope:'Actual installed compiler/projection/signals/driver text; purpose-built row adapter has no native layout, source admission or empirical-calibration claim.'};
if(process.env.COUNTY_DRIVER_TEST_REPORT)fs.writeFileSync(process.env.COUNTY_DRIVER_TEST_REPORT,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(report));
