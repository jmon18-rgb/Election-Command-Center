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
function officialManualReferenceHostAllowed(row){
 // This contract validates human references only, never a provider/ingestion allowlist.
 const parsed=new URL(row.url),ny13Only=Array.isArray(row.race_ids)&&row.race_ids.length===1&&row.race_ids[0]==='House|NY-13';
 if(ny13Only||parsed.hostname==='vote.nyc'){
  const note=typeof row.scope_note==='string'?row.scope_note:'';
  return row.url==='https://vote.nyc/page/election-results-summary'&&row.state==='NY'&&
   Array.isArray(row.race_ids)&&row.race_ids.length===1&&row.race_ids[0]==='House|NY-13'&&
   row.mode==='county_results_directory_only'&&row.source_reference===row.url&&
   row.general_2026_results_verified===false&&row.primary_results_used_as_general_votes===false&&
   note.includes('2026 primary')&&note.includes('November 3 general results not verified')&&
   note.includes('not an independently reconciled NY-13 district total');
 }
 return /\.(gov|us)(\/|$)/.test(new URL(row.url).hostname+'/');
}
const links=new Map();
for(const row of manifest.links){
 assert(/^https:\/\//.test(row.url),'Official fallback must be HTTPS');
 assert(officialManualReferenceHostAllowed(row),
  'Official link domain must be government or the exact reviewed NY13 NYC directory');
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
// Exact municipal directory exception; original government-host behavior stays identical.
const ny13ManualRows=manifest.links.filter(row=>Array.isArray(row.race_ids)&&row.race_ids.length===1&&row.race_ids[0]==='House|NY-13');
assert.equal(ny13ManualRows.length,1,'One exact NY13-only manual directory entry');
const ny13Manual=ny13ManualRows[0];
assert.equal(officialManualReferenceHostAllowed(ny13Manual),true,'Reviewed NYC directory is a human reference');
const invalidNY13References=[
 ['nearby archive URL',{url:'https://vote.nyc/page/election-results-summary-2024'}],
 ['different trailing path',{url:'https://vote.nyc/page/election-results-summary/'}],
 ['URL query',{url:'https://vote.nyc/page/election-results-summary?race=13'}],
 ['different hostname',{url:'https://www.vote.nyc/page/election-results-summary'}],
 ['lookalike hostname',{url:'https://vote.nyc.evil.example/page/election-results-summary'}],
 ['unreviewed state portal for this NYC scope',{url:'https://nyenr.elections.ny.gov/'}],
 ['wrong race',{race_ids:['House|NY-26']}],
 ['mixed race scope',{race_ids:['House|NY-13','House|NY-26']}],
 ['wrong state',{state:'NJ'}],
 ['wrong results mode',{mode:'2026_results_landing'}],
 ['wrong source reference',{source_reference:'https://vote.nyc/'}],
 ['general results falsely verified',{general_2026_results_verified:true}],
 ['primary votes falsely admitted',{primary_results_used_as_general_votes:true}],
 ['missing scope limits',{scope_note:'NYC results'}]
];
for(const [boundary,updates]of invalidNY13References)assert.equal(officialManualReferenceHostAllowed({...ny13Manual,...updates}),false,'Reject '+boundary);
for(const row of manifest.links)if(row!==ny13Manual)assert.equal(officialManualReferenceHostAllowed(row),/\.(gov|us)(\/|$)/.test(new URL(row.url).hostname+'/'),'Original government-host rule unchanged for '+row.state);
console.log('Critical official emergency Senate links: 5 races, mock-warning, grounded URLs and no false coverage promotion PASS');
