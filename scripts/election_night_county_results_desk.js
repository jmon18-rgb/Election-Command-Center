/* Source-attributed, read-only county results desk. NO model promotions. */
(function(root, factory) {
 const api=factory(typeof module!=='undefined'&&module.exports?
  require('./verified_county_source_contract_2026'):root.VerifiedCountySourceContract2026);
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.ElectionNightCountyResultsDesk=api;
})(typeof window!=='undefined'?window:null,function(contract){
 'use strict';
 const empty=reason=>Object.freeze({ready:false,reason,rows:[],may_move_national_needle:false});
 function prepare(envelope,expected,now=Date.now()){
  if(!contract||!expected||!envelope)return empty('No independently verified county snapshot available');
  const verified=contract.normalize(envelope,expected);
  if(!verified.ok)return empty('County source verification rejected: '+verified.reason);
  const rows=verified.rows||[];
  if(!rows.length)return empty('Verified county source has no rows');
  const current=rows.every(row=>{
   const t=Date.parse(row.updated_at);
   return Number.isFinite(t)&&t<=now+15*60000&&now-t<=90*60000;
  });
  if(!current)return empty('County reporting snapshot stale or timestamp invalid');
  const observations=rows.map(row=>({
   fips:row.county_id,
   ballots_reported:row.ballots_reported,
   status:row.reporting_status,
   updated_at:row.updated_at,
   candidates:row.candidates.map(c=>({name:c.name,party:c.party,votes:c.votes})),
  }));
  return Object.freeze({ready:true,source_url:verified.source_url,
   provider:verified.provider,race_key:envelope.race_key,
   observations,rows:observations,may_move_national_needle:false});
 }
 function render(host,prepared,doc){
  if(!host||!doc)return false;
  host.replaceChildren();
  const add=(parent,tag,text)=>{const n=doc.createElement(tag);n.textContent=text;parent.appendChild(n);return n};
  if(!prepared?.ready){
   add(host,'p',prepared?.reason||'No verified county results available');
   return false;
  }
  add(host,'h4',prepared.race_key+' · verified source-attributed county returns');
  const link=add(host,'a','Official source ↗');
  link.href=prepared.source_url;
  link.rel='noopener noreferrer';
  link.target='_blank';
  add(host,'p','Unofficial county candidate votes. Reporting statuses and ballot counts are source-reported; no projected winner or predictive needle is implied.');
  for(const item of prepared.rows){
   const section=doc.createElement('section');
   add(section,'strong','County FIPS '+item.fips+' · '+item.status+
    ' · ballots reported '+item.ballots_reported.toLocaleString('en-US'));
   add(section,'small','As of '+item.updated_at);
   for(const c of item.candidates){
    add(section,'p',c.name+' ('+c.party+'): '+c.votes.toLocaleString('en-US'));
   }
   host.appendChild(section);
  }
  return true;
 }
 return Object.freeze({prepare,render});
});
