#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const api=require('./audit_nc_pages_county_results.cjs');
const when=Date.parse('2026-11-04T01:00:00Z');
const SHA='a'.repeat(64);
const ZIP='https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2026_11_03/results_pct_20261103.zip';
const disabled={schema:'county-desk-config-v1',enabled:false,
 reason:'Source not yet reviewed',expected:null,snapshot_path:null};
assert.equal(api.inspectSource(disabled,null,when).status,
 'WAITING_FOR_REVIEWED_2026_OFFICIAL_SOURCE');
assert.throws(()=>api.inspectSource({...disabled,enabled:true},null,when));
assert.throws(()=>api.inspectSource({...disabled,snapshot_path:'./data/unknown.json'},null,when));
const approved={schema:'county-desk-config-v1',enabled:true,
 snapshot_path:'./data/nc_candidate_votes_2026.json',
 expected:{mode:'nc-candidate-only',reviewed:true,verified_source_url:ZIP,
 verified_archive_sha256:SHA,office:'Senate',race_key:'NC-SEN',
 contest_name:'US SENATE',contest_group_id:'37'}};
const snapshot={schema:'nc-official-candidate-votes-v1',
 election_date:'2026-11-03',state:'NC',office:'Senate',race_key:'NC-SEN',
 archive_checked_at:'2026-11-04T00:45:00Z',
 source:{url:ZIP,sha256:SHA,archive_member:'results_pct_20261103.txt',
 contest_name:'US SENATE',contest_group_id:'37'},
 ballots_reported:null,reporting_fraction:null,may_move_national_needle:false,
 counties:[{county_id:'37183',candidates:[
 {name:'A',party:'DEM',votes:120},{name:'B',party:'REP',votes:155}]}]};
const valid=api.inspectSource(approved,snapshot,when);
assert.equal(valid.status,'VERIFIED_CANDIDATE_COUNTS_PUBLISHED');
assert.equal(valid.published_counties,1);
assert.equal(valid.votes_for_listed_candidates,275);
assert.equal(valid.may_move_national_needle,false);
const archived=api.inspectSource(approved,snapshot,Date.parse('2026-11-10T12:00:00Z'));
assert.equal(archived.status,'ARCHIVED_SOURCE_VERIFIED_NOT_LIVE');
assert.equal(archived.may_move_national_needle,false);
assert.throws(()=>api.inspectSource(approved,
 {...snapshot,archive_checked_at:'2026-11-08T01:00:00Z'},
 Date.parse('2026-11-10T12:00:00Z')),/actual 2026 election window/);
const fail=[
 [approved,{...snapshot,election_date:'2024-11-05'},when],
 [approved,{...snapshot,source:{...snapshot.source,sha256:'b'.repeat(64)}},when],
 [approved,{...snapshot,ballots_reported:300},when],
 [approved,{...snapshot,reporting_fraction:0.75},when],
 [approved,{...snapshot,archive_checked_at:'2026-11-03T20:00:00Z'},when],
 [approved,{...snapshot,counties:[]},when],
 [{...approved,snapshot_path:'./data/fake.json'},snapshot,when],
 [{...approved,expected:{...approved.expected,reviewed:false}},snapshot,when]
];
for(const [c,s,n] of fail)assert.throws(()=>api.inspectSource(c,s,n));
const publication=api.compareApprovedHead(approved,snapshot,approved,snapshot,when);
assert.equal(publication.status,'PUBLISHED_APPROVED_HEAD');
assert.equal(api.compareApprovedHead(disabled,null,disabled,null,when).status,'APPROVAL_NOT_ENABLED');
assert.equal(api.compareApprovedHead(approved,snapshot,disabled,null,when).status,'PAGES_CATCHING_UP');
assert.throws(()=>api.compareApprovedHead(approved,snapshot,disabled,null,when+40*60000),
 /has not deployed/);
const older={...snapshot,archive_checked_at:'2026-11-04T00:10:00Z'};
assert.throws(()=>api.compareApprovedHead(approved,snapshot,approved,older,when+50*60000),
 /has not deployed/);
const scripts=Object.fromEntries(api.INDEX_FILES.map((f,i)=>[f,'console.log("version'+i+'");']));
const srcs=api.INDEX_FILES.map(f=>'<script src="./'+f+'?v='+api.gitRevision(scripts[f])+'"></script>').join('\n');
const html='<div id="enVerifiedCountyResults"></div>'+srcs;
assert.deepEqual(api.inspectScripts(html,scripts),api.INDEX_FILES);
const modified={...scripts,[api.INDEX_FILES[1]]:'console.error("stale code");'};
assert.throws(()=>api.inspectScripts(html,modified));
assert.throws(()=>api.inspectScripts('<div id="enVerifiedCountyResults"></div>',scripts));
assert.throws(()=>api.inspectScripts(srcs,scripts));
console.log('NC Pages deployed-result audit: disabled, approved, stale, bad-source, missing asset, and revision-mismatch tests passed');
