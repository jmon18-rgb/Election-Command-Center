'use strict';
// Observation identity only. Request authorization remains in the probe.
// Full civicAPI county responses and light summaries must never share a key.
const OWNED_CACHE_URLS=Object.freeze([
 'https://raw.githubusercontent.com/jmon18-rgb/Election-Command-Center/official-virginia-results-cache/data/virginia_house_02_official_latest.json',
 'https://raw.githubusercontent.com/jmon18-rgb/Election-Command-Center/official-results-cache/data/washington_house_03_official_latest.json'
]);
function observationKey(url){
 if(typeof url!=='string')throw TypeError('Observation URL must be a string');
 // The two owned collectors add a minute cache key. No other query string
 // may be discarded, even on an otherwise approved provider path.
 for(const base of OWNED_CACHE_URLS){
  if(!url.startsWith(base+'?'))continue;
  const minute=url.slice(base.length+1).match(/^minute=(0|[1-9]\d*)$/);
  if(minute&&url===base+'?minute='+minute[1]&&Number.isSafeInteger(Number(minute[1])))return base;
 }
 return url;
}
module.exports=Object.freeze({observationKey});
