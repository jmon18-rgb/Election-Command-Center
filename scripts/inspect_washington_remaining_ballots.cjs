'use strict';
// Offline source-contract review only. Never loaded by the dashboard or kernel.
const contract=require('../data/washington_county_remaining_source_contract.json');
const close=Date.parse('2026-11-04T04:00:00Z');
const stamp=/^2026-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?(?:Z|[+-]\d{2}:\d{2})$/;
const english=x=>Array.isArray(x)&&x.length===1&&x[0].languageId==='en'?x[0].text:null;
function inspect(input,now,sourceUrl){
 if(sourceUrl!==contract.source_url)throw Error('Exact observed election/source URL required');
 if(!Number.isFinite(now))throw Error('Explicit review clock required');
 const raw=typeof input==='string'?input:JSON.stringify(input);
 if(Buffer.byteLength(raw)>1000000)throw Error('Body exceeds review cap');
 const d=JSON.parse(raw);
 if(!Array.isArray(d.data)||d.data.length!==1)throw Error('Statistic identity drift');
 const s=d.data[0];
 if(s.id!==contract.stat_id||english(s.name)!==contract.stat_name||s.viewBy!==1||!Array.isArray(s.groups)||s.groups.length!==1)throw Error('Statistic identity drift');
 const g=s.groups[0];
 if(g.id!==contract.group_id||english(g.name)!==contract.group_name||!Array.isArray(g.children)||g.children.length!==39)throw Error('County matrix drift');
 const seen=new Set();
 const counties=g.children.map(x=>{
  const pinned=contract.counties.find(c=>c.id===x.id);
  if(!pinned||seen.has(x.id)||english(x.name)!==pinned.name||x.children!==null)throw Error('County identity/duplicate drift');
  seen.add(x.id);
  if(!Number.isSafeInteger(x.value)||x.value<0)throw Error('Invalid county estimate');
  const text=x.lastUpdated;
  const dateValid=typeof text==='string'&&stamp.test(text)&&new Date(Date.UTC(+text.slice(0,4),+text.slice(5,7)-1,+text.slice(8,10))).toISOString().slice(0,10)===text.slice(0,10);
  const t=dateValid?Date.parse(text):NaN;
  const reason=!Number.isFinite(t)?'MISSING_OR_INVALID_REPORT_CLOCK':now<close||t<close?'PRE_CLOSE':t>now+300000?'FUTURE_CLOCK':now-t>1800000?'STALE_REPORT_CLOCK':null;
  return {county_fips:pinned.county_fips,county:pinned.name,reported_estimate:x.value,reported_at:x.lastUpdated,review_eligible:reason===null,exclusion_reason:reason,scope:'WHOLE_COUNTY_ESTIMATE_NOT_DISTRICT_PART',may_move_national_needle:false};
 });
 return {status:'OFFLINE_REVIEW_ONLY',source_url:sourceUrl,production_enabled:false,may_move_national_needle:false,counties,wa03:counties.filter(c=>contract.wa03_county_fips.includes(c.county_fips))};
}
module.exports={inspect};
