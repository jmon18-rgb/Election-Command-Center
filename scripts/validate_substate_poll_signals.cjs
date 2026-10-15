#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=path.join(__dirname,'..','data');
const local=JSON.parse(fs.readFileSync(path.join(base,'substate_poll_signals.json'),'utf8'));
const primary=JSON.parse(fs.readFileSync(path.join(base,'polls.json'),'utf8'));
assert.equal(local.schema_version,'substate-ballot-signals-v1');
assert.equal(local.status,'CURATED_VERIFIED_LOCAL_ELECTORATE_NOT_STATEWIDE');
assert(Array.isArray(local.signals)&&local.signals.length>=2);
const seen=new Set();
for(const x of local.signals){
 const key=x.poll_id+'|'+x.question_id;assert(!seen.has(key),'Poll question duplicated');seen.add(key);
 assert.equal(x.model_eligible,false,'Nonstatewide ballot questions cannot enter statewide polls or odds');
 assert.equal(x.sample_scope,'congressional_district');
 assert.equal(x.map_year,2026);
 assert.match(x.sample_district,/^[A-Z]{2}-\d{2}$/);
 assert(['senate','governor'].includes(x.office));
 assert.equal(x.race_code,x.sample_district.slice(0,2)+'-'+(x.office==='senate'?'SEN':'GOV'));
 assert(Number.isInteger(x.sample_size)&&x.sample_size>=100);
 assert(['lv','rv'].includes(x.sample_population));
 assert(Number.isFinite(x.dem_minus_rep_points)&&Math.abs(x.dem_minus_rep_points)<=100);
 assert(/^https:\/\/www\.uh\.edu\//.test(x.source_url));
 assert(/^2026-\d{2}-\d{2}$/.test(x.field_end)&&x.field_start<=x.field_end);
 assert(x.field_end<=x.release_date&&x.release_date<='2026-11-03');
 const duplicate=(primary.races||[]).find(r=>r.race_code===x.race_code &&
  (r.polls||[]).some(y=>y.poll_id===x.poll_id||y.question_id===x.question_id));
 assert(!duplicate,'District-only statewide-question must not contaminate state poll input');
}
assert(local.signals.some(x=>x.race_code==='TX-SEN'&&x.dem_minus_rep_points===-1));
assert(local.signals.some(x=>x.race_code==='TX-GOV'&&x.dem_minus_rep_points===-4));
console.log('Curated substate survey verified: TX-09 Senate and Governor questions isolated from statewide forecasts.');
