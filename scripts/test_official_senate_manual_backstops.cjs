#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'data/election_night_official_backstops.json')));
const coverage=JSON.parse(fs.readFileSync(path.join(root,'data/election_night_source_coverage.json')));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.equal(manifest.status,'OFFICIAL_HUMAN_FALLBACK_LINKS_NOT_AUTOMATED_RESULTS');
const ids=new Set(coverage.races.map(x=>x.id));
const links=new Map();
for(const row of manifest.links){
 assert(/^https:\/\//.test(row.url),'Official fallback must be HTTPS');
 assert(/\.(gov|us)(\/|$)/.test(new URL(row.url).hostname+'/'),
  'Official link domain must be state government');
 assert(Array.isArray(row.race_ids)&&row.race_ids.length>0);
 for(const id of row.race_ids){
  assert(ids.has(id),'Official fallback refers to nonexistent ballot '+id);
  assert(!links.has(id),'Conflicting official manual URLs for race '+id);
  links.set(id,row);
 }
}
for(const race of ['Senate|ME','Senate|OH-special','Senate|NE',
                   'Senate|NH','Senate|AK']){
 assert(links.has(race),'Important 2026 Senate race lacks official human backup');
}
assert.match(links.get('Senate|ME').url,/maine\.gov/);
assert.match(links.get('Senate|NE').url,/nebraska\.gov/);
assert.match(links.get('Senate|OH-special').url,/ohiosos\.gov/);
assert.equal(links.get('Senate|OH-special').mode,'pre_election_mock_results_only');
assert.equal(links.get('Senate|NE').mode,'pre_election_mock_results_only');
assert.equal(links.get('Senate|ME').mode,'november_2026_results_not_yet_published');
assert.equal(links.get('Senate|MA').mode,'certified_only_not_election_night');
assert.equal(links.get('Senate|MS').mode,'certified_only_not_election_night');
assert.equal(links.get('Senate|NH').mode,'post_election_results_landing');
assert.match(html,/const critical=new Set\(\['Senate\|AK'/);
assert.match(html,/WARNING: pre-election MOCK\/TEST results, not real votes/);
assert.match(html,/if\(unresolved\.length\)/);
assert.match(html,/provider outages may still require these official links/);
console.log('Critical official emergency Senate links: 5 races, mock-warning, grounded URLs and no false coverage promotion PASS');
