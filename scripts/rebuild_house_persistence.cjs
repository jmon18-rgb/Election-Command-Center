#!/usr/bin/env node
'use strict';
// Descriptive historical studies only; never promotes a coefficient to production.
const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict');
const load=n=>JSON.parse(fs.readFileSync('data/'+n+'.json','utf8'));
const source={house22:load('house_history_2022_staging'),house24:load('house_history_2024_staging'),
 candidates22:load('house_2022_candidate_results_staging'),candidates24:load('house_2024_candidate_results_staging'),
 pres20:load('presidential_2020_by_2026_district_staging'),pres24:load('presidential_2024_by_2026_district_staging'),
 twoCycle:load('house_two_cycle_context')};
const write=process.argv.includes('--write');
function save(name,value){if(write)fs.writeFileSync('data/'+name+'.json',JSON.stringify(value,null,2)+'\n');
 else assert.deepEqual(load(name),value,'Historical study is stale: '+name);}
save('incumbent_persistence_2022_2024',require('./incumbent_persistence_backtest.js').build(source));
save('modern_incumbency_robustness_2022_2024',JSON.parse(cp.execFileSync(process.execPath,
 ['scripts/audit_modern_incumbency_robustness.cjs','--json'],{encoding:'utf8'})));
console.log('Historical persistence studies reproduce from corrected source bundle');
