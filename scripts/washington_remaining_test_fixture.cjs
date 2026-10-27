'use strict';
// SYNTHETIC post-close estimates. The real pinned source has null clocks/zeros.
const fs=require('node:fs'),crypto=require('node:crypto'),source=require('./washington_remaining_source.js');
function fixture({stamp='2026-11-04T04:05:00Z',estimate=10000}={}){
 const payload=JSON.parse(fs.readFileSync('data/washington_historical_sources/2026-official-county-remaining-preclose.json','utf8'));
 for(const row of payload.data[0].groups[0].children){row.lastUpdated=stamp;row.value=estimate;}
 return seal({schema:'official-wa-remaining-collection-v1',source_url:source.URL,http_status:200,status:'COLLECTED_OFFICIAL_ESTIMATES',fetched_at:stamp,payload});
}
function seal(record){record.selected_payload_sha256=crypto.createHash('sha256').update(JSON.stringify(record.payload)).digest('hex');return record;}
module.exports={fixture,seal};
