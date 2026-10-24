#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const api=require('./audit_ohio_pages_candidate_publication.cjs');
const NOW=Date.parse('2026-11-04T00:59:00Z');
const SOURCE='https://liveresults.ohiosos.gov/Api/v1/download?filename=VSSC1622XmlFileBlob';
const disabled={schema:'ohio-nist-2026-live-approval-v1',enabled:false,
 real_results_publication_reviewed:false};
assert.equal(api.checkApproved(disabled,null,NOW).candidate_races,0);
assert.throws(()=>api.checkApproved({...disabled,
 real_results_publication_reviewed:true},null,NOW));
const approved={...disabled,enabled:true,real_results_publication_reviewed:true,
 source_url:SOURCE,source_reviewed_at:'2026-11-04T00:45:00Z',
 approved_contests:[{race_key:'OH-SEN-special'}],
 county_gpunit_to_fips:Object.fromEntries(Array.from({length:88},(_,i)=>
  ['county'+i,'39'+String(i*2+1).padStart(3,'0')]))};
const snap={schema:'ohio-nist-candidate-county-2026-v1',
 status:'INDEPENDENTLY_REVIEWED_UNOFFICIAL_CANDIDATE_COUNTS_NO_RACE_CALLS',
 election_date:'2026-11-03',state:'OH',
 source:{url:SOURCE,xml_sha256:'a'.repeat(64),
  generated_at:'2026-11-04T00:53:00Z',
  approval_reviewed_at:approved.source_reviewed_at},
 ballots_remaining:null,reporting_fraction:null,
 independently_certified_winner_calls:false,may_move_national_needle:false,
 races:[{race_key:'OH-SEN-special',dashboard_race_id:'Senate|OH-special',
  office:'Senate',reported_county_count:1,
  counties:[{county_fips:'39001',candidates:[
   {name:'Synthetic D',party:'DEM',votes:100},
   {name:'Synthetic R',party:'REP',votes:120}]}]}]};
const status=api.checkApproved(approved,snap,NOW);
assert.equal(status.status,'OHIO_VERIFIED_APPROVED_CANDIDATE_COUNTS_PUBLISHED');
assert.equal(status.candidate_races,1);
assert.equal(status.may_move_national_needle,false);
assert.equal(api.checkApproved(approved,snap,Date.parse('2026-11-07T12:00:00Z')).status,
 'OHIO_ARCHIVED_UNOFFICIAL_COUNTS_NOT_LIVE');
const reviewedAfterGeneration={...approved,source_reviewed_at:'2026-11-04T01:04:00Z'};
const sourceApprovedAfterGeneration={...snap,
 source:{...snap.source,approval_reviewed_at:reviewedAfterGeneration.source_reviewed_at}};
assert.equal(api.checkApproved(reviewedAfterGeneration,sourceApprovedAfterGeneration,
 Date.parse('2026-11-07T12:00:00Z')).status,
 'OHIO_ARCHIVED_UNOFFICIAL_COUNTS_NOT_LIVE');
for(const change of [
 {...snap,ballots_remaining:100},
 {...snap,may_move_national_needle:true},
 {...snap,source:{...snap.source,xml_sha256:'invalid'}},
 {...snap,source:{...snap.source,generated_at:'2026-11-03T20:00:00Z'}},
 {...snap,races:[{...snap.races[0],dashboard_race_id:'Senate|MA'}]},
]){
 assert.throws(()=>api.checkApproved(approved,change,NOW));
}
assert.throws(()=>api.checkApproved(approved,snap,Date.parse('2026-11-04T01:40:00Z')),
 /stale|stopped updating/);
assert.equal(api.compareHead(disabled,null,disabled,null,NOW),'SOURCE_NOT_APPROVED');
assert.equal(api.compareHead(approved,snap,approved,snap,NOW),'PUBLISHED_APPROVED_SOURCE_REVISION');
assert.equal(api.compareHead(approved,snap,disabled,null,NOW),
 'APPROVED_OHIO_REVISION_WAITING_FOR_PAGES');
assert.throws(()=>api.compareHead(approved,snap,disabled,null,Date.parse('2026-11-04T01:20:00Z')),
 /failed to publish/);
const modules=Object.fromEntries(api.MODULES.map((f,i)=>[f,'console.log('+i+');']));
const tags=api.MODULES.map(f=>'<script src="./'+f+'?v='+api.blobRevision(modules[f])+'"></script>').join('\n');
const html='<div id="enOhioOfficialCountyDesk"></div><div id="enOhioOfficialCountyResults"></div>'+tags;
assert.equal(api.checkScripts(html,modules),2);
assert.throws(()=>api.checkScripts(html,{...modules,[api.MODULES[0]]:'other'}));
assert.throws(()=>api.checkScripts('<div id="enOhioOfficialCountyDesk"></div>'+tags,modules));
console.log('Ohio Pages: approved official source, mock/revoked, stale, archive, immutable scripts and publishing lag contract PASS');
