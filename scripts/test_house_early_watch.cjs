'use strict';
const assert=require('node:assert/strict'),focus=require('./personal_election_focus.js'),closes=require('./election_night_poll_closings_2026.js');
const refs=focus.WATCH.districts;
assert.equal(refs.length,21);assert.equal(new Set(refs.map(x=>x.code)).size,21);
assert.equal(focus.WATCH.publisher_as_of,null);assert.equal(focus.WATCH.independently_verified,false);
// Independent transcription of every supplied numeric/label pair, not a fixture generated from implementation.
const exact=[['FL-25','Lean D','Lean D',26.8,'D',3.7],['FL-14','Toss-Up','Likely D',18.2,'D',5.2],['FL-22','Toss-Up','Lean D',31.5,'D',2.8],['FL-13','Lean R','Lean R',67.2,'R',2.4],['FL-27','Lean R','Lean R',73,'R',3.5],['FL-09','Likely R','Lean R',62.1,'R',2],['FL-07','Likely R','Lean R',66.9,'R',2.5],['FL-16','Likely R','Likely R',80.2,'R',4.8],['FL-04','Solid R','Likely R',92.7,'R',10.2],['FL-08','Solid R','Likely R',93,'R',9.4],['FL-12','Solid R','Likely R',93.2,'R',10.3],['GA-07','Solid R','Solid R',97.9,'R',13.2],['NC-11','Lean D','Likely D',15.9,'D',5.9],['NC-01','Toss-Up','Likely D',18.9,'D',4.9],['NC-03','Likely R','Likely R',91.8,'R',7.4],['NC-13','Likely R','Likely R',93.3,'R',9.8],['NC-09','Solid R','Likely R',92.5,'R',8.2],['SC-01','Lean R','Lean R',74.4,'R',3.7],['VA-02','Lean D','Likely D',14.9,'D',5.9],['VA-01','Toss-up','Lean D',38.2,'D',1.6],['VA-05','Likely R','Likely R',86.3,'R',5.7]];
assert.deepEqual(refs.map(x=>[x.code,x.cook,x.flipr,x.rep_win_pct,x.margin_side,x.margin_points]),exact);
const result={race_probabilities:[...refs.map(x=>({race_code:x.code,dem_beats_rep_pct:99})),{race_code:'TX-SEN',dem_beats_rep_pct:61}],county_results_update:{used:[{code:'TX-SEN',as_of:'2026-11-04T02:00:00Z',counted_two_party_votes:1000}]}};
const frozen=JSON.stringify(result),options={closes,now:Date.parse('2026-11-04T03:00:00Z'),watch:true};
const broad=structuredClone(result);Object.assign(broad.race_probabilities[0],{source_method:'redrawn_state_distribution_proxy',polled:false});assert.equal(focus.rows(broad,result,options).find(x=>x.code==='FL-25').broadStateProxy,true);assert.equal(focus.rows(broad,result,options).find(x=>x.code==='FL-25').polled,false);
let rows=focus.rows(result,result,options);assert.equal(rows.length,32);assert(rows.every(x=>!x.called));assert(focus.watchSummary(rows).every(x=>x.calls.length===0));
assert.equal(focus.rows(result,result,{closes}).find(x=>x.code==='TX-SEN').ownCounts,true);
assert.equal(focus.rows(result,result,{closes}).find(x=>x.code==='TX-SEN').rating.label,'Leaning D');
assert.equal(JSON.stringify(result),frozen,'Display cannot alter joint draws, inputs or probabilities');
const called=structuredClone(result);for(const code of ['FL-04','GA-07','FL-09','NC-03'])called.race_probabilities.find(x=>x.race_code===code).provider_called_party='D';
for(const code of ['FL-25','NC-11'])called.race_probabilities.find(x=>x.race_code===code).provider_called_party='R';
// Duplicate records cannot count as multiple distinct races.
called.race_probabilities.push({...called.race_probabilities.find(x=>x.race_code==='FL-04')});
rows=focus.rows(called,result,options);assert.deepEqual(focus.watchSummary(rows).map(x=>[x.calls.length,x.total,x.multiple]),[[2,3,true],[2,6,true],[2,5,true]]);
called.race_probabilities=called.race_probabilities.filter(x=>x.race_code!=='GA-07');
assert.equal(focus.watchSummary(focus.rows(called,result,options))[2].multiple,false,'Withdrawal immediately clears the multiple-upset signal');
const corrected=structuredClone(result);corrected.race_probabilities.find(x=>x.race_code==='FL-04').provider_called_party='R';assert.equal(focus.watchSummary(focus.rows(corrected,result,options))[2].calls.length,0);
assert.equal(focus.rows(result,result,{...options,year:2024}).length,0);
assert.equal(focus.rows(result,result,options).find(x=>x.code==='NC-01').ownCounts,false,'Reference does not invent pending NC01 geography or admission');
console.log('21 exact owner references; Texas same-joint display; distinct validated surprise calls/retraction; no implicit admission/model mutation PASS');
