// Original official whole-county estimates. No district allocation or calls.
(function(root,factory){const api=factory(root);if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.WashingtonRemainingSource=api;
})(typeof window!=='undefined'?window:null,function(root){
 'use strict';
 const URL="https://results.votewa.gov/results/public/api/elections/washington/20261103/stats",statId="01000000-e026-b29a-7f5d-08df1f358b6d",groupId="01000000-e026-b29a-0caf-08df1f358f97";
 const identities=Object.freeze([{"id":"01000000-f977-1a83-b33e-08ddd6a09ca6","name":"Adams County","county_fips":"53001"},{"id":"01000000-f977-1a83-8b66-08ddd6a09ca8","name":"Asotin County","county_fips":"53003"},{"id":"01000000-f977-1a83-4559-08ddd6a09ca9","name":"Benton County","county_fips":"53005"},{"id":"01000000-f977-1a83-f99e-08ddd6a09ca9","name":"Chelan County","county_fips":"53007"},{"id":"01000000-f977-1a83-ad30-08ddd6a09caa","name":"Clallam County","county_fips":"53009"},{"id":"01000000-f977-1a83-56b4-08ddd6a09cab","name":"Clark County","county_fips":"53011"},{"id":"01000000-f977-1a83-0277-08ddd6a09cac","name":"Columbia County","county_fips":"53013"},{"id":"01000000-f977-1a83-ac95-08ddd6a09cac","name":"Cowlitz County","county_fips":"53015"},{"id":"01000000-f977-1a83-5bf7-08ddd6a09cad","name":"Douglas County","county_fips":"53017"},{"id":"01000000-f977-1a83-0502-08ddd6a09cae","name":"Ferry County","county_fips":"53019"},{"id":"01000000-f977-1a83-b165-08ddd6a09cae","name":"Franklin County","county_fips":"53021"},{"id":"01000000-f977-1a83-5b77-08ddd6a09caf","name":"Garfield County","county_fips":"53023"},{"id":"01000000-f977-1a83-0a73-08ddd6a09cb0","name":"Grant County","county_fips":"53025"},{"id":"01000000-f977-1a83-b7d1-08ddd6a09cb0","name":"Grays Harbor County","county_fips":"53027"},{"id":"01000000-f977-1a83-6425-08ddd6a09cb1","name":"Island County","county_fips":"53029"},{"id":"01000000-f977-1a83-1d0e-08ddd6a09cb2","name":"Jefferson County","county_fips":"53031"},{"id":"01000000-f977-1a83-d40f-08ddd6a09cb2","name":"King County","county_fips":"53033"},{"id":"01000000-f977-1a83-8682-08ddd6a09cb3","name":"Kitsap County","county_fips":"53035"},{"id":"01000000-f977-1a83-38ad-08ddd6a09cb4","name":"Kittitas County","county_fips":"53037"},{"id":"01000000-f977-1a83-eddf-08ddd6a09cb4","name":"Klickitat County","county_fips":"53039"},{"id":"01000000-f977-1a83-a581-08ddd6a09cb5","name":"Lewis County","county_fips":"53041"},{"id":"01000000-f977-1a83-5c13-08ddd6a09cb6","name":"Lincoln County","county_fips":"53043"},{"id":"01000000-f977-1a83-420f-08ddd6a09cb7","name":"Mason County","county_fips":"53045"},{"id":"01000000-f977-1a83-6c66-08ddd6a09cb8","name":"Okanogan County","county_fips":"53047"},{"id":"01000000-f977-1a83-37cd-08ddd6a09cb9","name":"Pacific County","county_fips":"53049"},{"id":"01000000-f977-1a83-0a9a-08ddd6a09cba","name":"Pend Oreille County","county_fips":"53051"},{"id":"01000000-f977-1a83-f161-08ddd6a09cba","name":"Pierce County","county_fips":"53053"},{"id":"01000000-f977-1a83-b520-08ddd6a09cbb","name":"San Juan County","county_fips":"53055"},{"id":"01000000-f977-1a83-8590-08ddd6a09cbc","name":"Skagit County","county_fips":"53057"},{"id":"01000000-f977-1a83-6920-08ddd6a09cbd","name":"Skamania County","county_fips":"53059"},{"id":"01000000-f977-1a83-262f-08ddd6a09cbe","name":"Snohomish County","county_fips":"53061"},{"id":"01000000-f977-1a83-f298-08ddd6a09cbe","name":"Spokane County","county_fips":"53063"},{"id":"01000000-f977-1a83-ae0a-08ddd6a09cbf","name":"Stevens County","county_fips":"53065"},{"id":"01000000-f977-1a83-605b-08ddd6a09cc0","name":"Thurston County","county_fips":"53067"},{"id":"01000000-f977-1a83-0cbd-08ddd6a09cc1","name":"Wahkiakum County","county_fips":"53069"},{"id":"01000000-f977-1a83-b406-08ddd6a09cc1","name":"Walla Walla County","county_fips":"53071"},{"id":"01000000-f977-1a83-5d8a-08ddd6a09cc2","name":"Whatcom County","county_fips":"53073"},{"id":"01000000-f977-1a83-0a29-08ddd6a09cc3","name":"Whitman County","county_fips":"53075"},{"id":"01000000-f977-1a83-f3fc-08ddd6a09cc3","name":"Yakima County","county_fips":"53077"}].map(Object.freeze));
 const whole=Object.freeze(['53011','53015','53041','53049','53059','53069']);
 const close=Date.parse('2026-11-04T04:00:00Z');
 const english=x=>Array.isArray(x)&&x.length===1&&x[0].languageId==='en'?x[0].text:null;
 const time=x=>{if(typeof x!=='string'||!/^2026-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?(?:Z|[+-]\d{2}:\d{2})$/.test(x))return NaN;
  if(new Date(Date.UTC(+x.slice(0,4),+x.slice(5,7)-1,+x.slice(8,10))).toISOString().slice(0,10)!==x.slice(0,10))return NaN;return Date.parse(x);};
 function parse(record,{now=Date.now(),counts_stamp}={}){
  if(!Number.isFinite(now)||record?.schema!=='official-wa-remaining-collection-v1'||record.source_url!==URL)throw Error('Unverified remaining source/election');
  const fetched=time(record.fetched_at),paired=time(counts_stamp);
  if(!Number.isFinite(fetched)||fetched>now+60000||now-fetched>1800000)throw Error('Stale/future remaining collection');
  if(record.status==='SOURCE_UNAVAILABLE'&&record.payload===null)return {status:'REMAINING_UNAVAILABLE',counties:[]};
  if(record.status!=='COLLECTED_OFFICIAL_ESTIMATES'||record.http_status!==200||!record.payload||JSON.stringify(record.payload).length>1000000)throw Error('Unbounded/unverified remaining payload');
  const d=record.payload,s=d.data?.[0],g=s?.groups?.[0];
  if([d,s].some(x=>x&&(('isProduction'in x&&x.isProduction!==true)||('test_data'in x&&x.test_data!==false))))throw Error('Explicit test/unverified remaining source');
  if(d.data?.length!==1||s.id!==statId||english(s.name)!=="Estimated Ballots Left to Count - The following is an estimation of how many ballots are left to count by county."||s.viewBy!==1||s.groups?.length!==1||g.id!==groupId||english(g.name)!=="Estimated Ballots Left to Count"||g.children?.length!==39)throw Error('Remaining statistic identity drift');
  const seen=new Set(),counties=[],excluded=[];
  for(const x of g.children){const pin=identities.find(c=>c.id===x.id);
   if(!pin||seen.has(x.id)||english(x.name)!==pin.name||x.children!==null||!Number.isSafeInteger(x.value)||x.value<0||x.value>10000000)throw Error('Remaining county matrix/value drift');
   seen.add(x.id);if(!whole.includes(pin.county_fips))continue;
   const at=time(x.lastUpdated);let reason=null;
   if(!Number.isFinite(at))reason='MISSING_REPORT_CLOCK';
   else if(now<close||at<close||!Number.isFinite(paired)||paired<close)reason='PRE_CLOSE_OR_UNPAIRED_COUNTS';
   else if(at>now+300000||at>fetched+300000||now-at>1800000||Math.abs(at-paired)>900000)reason='STALE_FUTURE_OR_UNPAIRED_CLOCK';
   if(reason)excluded.push({county_fips:pin.county_fips,reason});else counties.push({county_fips:pin.county_fips,county:pin.name,estimated_ballots_left:x.value,reported_at:x.lastUpdated});
  }
  return {status:counties.length?'VALIDATED_WHOLE_COUNTY_ESTIMATES':'NO_USABLE_REMAINING_ESTIMATES',source_url:URL,counties,excluded,calibrated:false,scope:'SIX_WHOLE_COUNTIES_ONLY_THURSTON_EXCLUDED'};
 }
 function createRevision({storage}={}){
  if(storage===undefined){try{storage=root?.localStorage;}catch{storage=null;}}
  const key='ecc:wa-remaining:2026:v1';let memory=null;
  function read(){try{const text=storage?.getItem(key);if(!text||text.length>10000)return null;const r=JSON.parse(text);
   if(!Number.isFinite(time(r.fetched_at))||!Array.isArray(r.counties)||r.counties.length>6||new Set(r.counties.map(c=>c.county_fips)).size!==r.counties.length||r.counties.some(c=>!whole.includes(c.county_fips)||!Number.isFinite(time(c.reported_at))||!Number.isSafeInteger(c.estimated_ballots_left)||c.estimated_ballots_left<0))return null;return r;
  }catch{return null;}}
  function accept(record,reviewed){
   if(record.source_url!==URL||!Number.isFinite(time(record.fetched_at))||!['VALIDATED_WHOLE_COUNTY_ESTIMATES','NO_USABLE_REMAINING_ESTIMATES','REMAINING_UNAVAILABLE'].includes(reviewed.status))throw Error('Unverified remaining revision');
   const previous=[memory,read()];
   for(const old of previous){if(!old)continue;
    if(time(record.fetched_at)<time(old.fetched_at))throw Error('Older remaining receipt');
    for(const row of reviewed.counties){const prior=old.counties.find(c=>c.county_fips===row.county_fips);if(prior&&(time(row.reported_at)<time(prior.reported_at)||time(row.reported_at)===time(prior.reported_at)&&row.estimated_ballots_left!==prior.estimated_ballots_left))throw Error('Older/changed remaining publication');}
   }
   const byFips=new Map();for(const old of previous)for(const c of old?.counties||[]){const prior=byFips.get(c.county_fips);if(!prior||time(c.reported_at)>=time(prior.reported_at))byFips.set(c.county_fips,c);}for(const c of reviewed.counties)byFips.set(c.county_fips,c);
   memory={fetched_at:record.fetched_at,counties:[...byFips.values()]};try{storage?.setItem(key,JSON.stringify(memory));}catch{}
  }
  return Object.freeze({accept,key});
 }
 return Object.freeze({URL,parse,whole,identities,time,createRevision});
});
