#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {evaluate}=require('./audit_senate_prior_continuity.cjs');
const read=n=>JSON.parse(fs.readFileSync('data/'+n+'.json','utf8'));
const src={seats:read('seat_universe'),history:read('house_history_2024_staging'),
 geography:read('house_geography_bridge'),
 senateHistory:read('senate_history_2020_2022_2024'),
 odds:read('race_probabilities'),polls:read('polling_estimates'),
 presidential:read('presidential_2024_by_2026_district_staging'),
 candidateOverperformance:read('historical_candidate_overperformance_2026')};
const report=evaluate(src);
assert.equal(report.status,'SENATE_PRIOR_CONTINUITY_DIAGNOSTIC_NOT_FORECAST');
assert.equal(report.source_model_exact_reconstruction,true);
assert.equal(report.senate_seats,35);
assert.equal(report.qualified_senate_matchups,24);
assert.equal(report.verified_historic_candidate_identity_count,12);
assert.equal(report.records.length,35);
assert.equal(new Set(report.records.map(x=>x.race_code)).size,35);
const by=code=>report.records.find(x=>x.race_code===code);
assert.equal(by('MN-SEN').candidate_continuity,'2020_winner_not_on_2026_poll_ballot');
assert.equal(by('ME-SEN').candidate_continuity,'2020_winner_on_2026_poll_ballot');
assert.equal(by('GA-SEN').candidate_continuity,'2020_winner_not_on_2026_poll_ballot');
assert.equal(by('OH-SEN').candidate_continuity,'different_seat_special');
assert.equal(by('NE-SEN').independent_proxy_not_dem_party,true);
assert.equal(by('SD-SEN').independent_proxy_not_dem_party,true);
assert(report.records.filter(x=>x.current_2026_poll_margin!==null).every(x=>
 Number.isFinite(x.poll_minus_prior_points.current_model)&&
 Number.isFinite(x.poll_minus_prior_points.neutral_geography)));
assert(report.records.some(x=>Math.abs(
 x.original_pre_poll_baseline_margin-
 x.candidate_neutral_2024_presidential_shadow_prior)>5));
assert(report.continuity_counts['2020_winner_not_on_2026_poll_ballot']>0);
assert(report.continuity_counts['2020_winner_on_2026_poll_ballot']>0);
assert(report.caveats.some(s=>s.includes('No Silver')));
const bad={...src,presidential:{...src.presidential,district_map_year_claimed:2024}};
assert.throws(()=>evaluate(bad),/2026-map source/);
const badRecs={...src.presidential,records:src.presidential.records.slice()};
badRecs.records[1]=badRecs.records[0];
assert.throws(()=>evaluate({...src,presidential:badRecs}),/duplicated presidential geography/);
const bogus={...src,candidateOverperformance:{...src.candidateOverperformance,status:'forecast'}};
assert.throws(()=>evaluate(bogus),/historical incumbent identity/);
const alteredPolls={...src.polls,senate_all:src.polls.senate_all.map(x=>
 x.race_code==='ME-SEN'?{...x,rep_candidate:'Different Candidate'}:x)};
assert.throws(()=>evaluate({...src,polls:alteredPolls}),/Matched Senate incumbent research contradicts 2026 matchup/);
console.log('Senate 2020-candidate continuity / 2024 geographic prior audit passed:',report.continuity_counts);
