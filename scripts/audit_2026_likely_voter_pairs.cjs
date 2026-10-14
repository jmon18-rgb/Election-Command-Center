#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const read=()=>JSON.parse(fs.readFileSync('data/polls.json','utf8'));
const d=read();
if(!Array.isArray(d.races)||d.races.length<70)
 throw Error('Missing 2026 contemporary poll universe');
const surveys=d.races.flatMap(r=>(r.polls||[]).map(p=>({...p,race_code:r.race_code})));
const populations={lv:0,rv:0,other_explicit:0,unknown:0};
const groups=new Map();
for(const row of surveys){
 const pop=String(row.sample_population||'').trim().toLowerCase();
 const population=['lv','likely voters','likely'].includes(pop)?'lv':
  ['rv','registered voters','registered'].includes(pop)?'rv':
  pop?'other_explicit':'unknown';
 populations[population]++;
 // A valid same-survey LV vs RV correction is the SAME race,
 // fieldwork end, polling firm and two candidates. Never infer a trend
 // from unrelated state samples or an unknown population label.
 if(!['lv','rv'].includes(population))continue;
 const key=[row.race_code,row.pollster,row.field_end,
  row.dem_name,row.rep_name].join('|');
 if(!groups.has(key))groups.set(key,{lv:[],rv:[]});
 groups.get(key)[population].push(row);
}
const pairs=[];
for(const [key,samples] of groups){
 if(!samples.lv.length||!samples.rv.length)continue;
 const lv=samples.lv[0],rv=samples.rv[0];
 if(!Number.isFinite(lv.margin)||!Number.isFinite(rv.margin))continue;
 pairs.push({survey_key:key,lv_minus_rv_margin_points:+(lv.margin-rv.margin).toFixed(3),
  lv_poll_id:lv.poll_id,rv_poll_id:rv.poll_id});
}
const minPairs=10;
const out={
 schema_version:'current-likely-voter-matched-pair-audit-v1',
 status:pairs.length>=minPairs?'ENOUGH_PAIRS_FOR_RESEARCH_ONLY':
  'INSUFFICIENT_VERIFIED_PAIRS_NO_AUTOMATIC_LV_SHIFT',
 source_updated_at:d.updated_at,
 sample_population_counts:populations,
 race_count:d.races.length,
 total_observed_poll_rows:surveys.length,
 independently_qualifying_LV_RV_pairs:pairs.length,
 minimum_pairs_before_estimating_any_shift:minPairs,
 pairs,
 party_bias_correction_applied_to_2026_model:false,
 reason:'A 2026 population-type shift must be inferred from matched LV/RV versions of the same survey, never guessed from unrelated polls, Silver paywall outputs, or unlabeled populations.',
 note:'Even ten pairs are only enough to begin cautious research; state/firm coverage and shrinkage remain necessary.'
};
if(process.argv.includes('--json'))console.log(JSON.stringify(out,null,2));
else console.log(out);
