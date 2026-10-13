/* Second separately verified civicAPI adapter: New Hampshire 2026 Governor.
 * This narrow pilot cannot claim NH House coverage or official winner calls. */
(function(root){
  'use strict';
  const BASE='https://civicapi.org/api/v2';
  const DAY='2026-11-03';
  const POLLS_DAY_START=Date.parse('2026-11-03T05:00:00Z');
  const supports=item=>item?.office==='Governor'&&item?.key==='NH';
  function validDate(value){
    return typeof value==='string'&&
      /^2026-11-03(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value);
  }
  function match(item,row){
    return Boolean(supports(item)&&row&&row.country==='US'&&row.province==='NH'&&
      row.municipality==null&&row.district==null&&
      Number.isSafeInteger(row.id)&&row.id>0&&validDate(row.election_date)&&
      row.type==='Governor'&&row.election_type==='Statewide'&&
      typeof row.election_name==='string'&&
      row.election_name.trim().toLowerCase()==='new hampshire governor'&&
      Array.isArray(row.candidates)&&row.candidates.length<=60);
  }
  function select(item,doc){
    if(!supports(item)||!doc||!Array.isArray(doc.races)||doc.races.length>20)return null;
    const matches=doc.races.filter(row=>match(item,row));
    return matches.length===1?matches[0]:null;
  }
  function query(item){
    if(!supports(item))return null;
    return BASE+'/race/search?'+new URLSearchParams({
      country:'US',province:'NH',startDate:DAY,endDate:DAY,query:'Governor',limit:'20'
    }).toString();
  }
  function normalizeParty(label){
    switch(label.trim().toLowerCase()){
      case 'd':case 'dem':case 'democrat':case 'democratic':return 'D';
      case 'r':case 'rep':case 'republican':case 'gop':return 'R';
      default:return 'O';
    }
  }
  function validate(item,row,detail,now=Date.now()){
    if(!match(item,row)||!detail||!Number.isFinite(now)||
      (detail.id!=null&&detail.id!==row.id)||
      detail.country!==row.country||detail.province!==row.province||
      detail.district!==row.district||detail.election_date!==row.election_date||
      detail.election_name!==row.election_name||
      detail.election_type!==row.type||
      !Number.isFinite(detail.percent_reporting)||
      detail.percent_reporting<0||detail.percent_reporting>100||
      !Array.isArray(detail.candidates)||detail.candidates.length<2||
      detail.candidates.length>60)return null;
    const seen=new Set(),candidates=[];
    let total=0,called=null,calls=0;
    for(const c of detail.candidates){
      if(!c||typeof c.name!=='string'||!c.name.trim()||
         typeof c.party!=='string'||!c.party.trim()||
         !Number.isSafeInteger(c.votes)||c.votes<0||
         !Number.isFinite(c.percent)||c.percent<0||c.percent>100||
         typeof c.winner!=='boolean')return null;
      const identity=c.name.trim().toLowerCase()+'|'+c.party.trim().toLowerCase();
      if(seen.has(identity))return null;
      seen.add(identity);
      total+=c.votes;
      if(!Number.isSafeInteger(total))return null;
      if(c.winner){calls++;called=c.name.trim();}
      candidates.push({name:c.name.trim(),party:normalizeParty(c.party),
         votes:c.votes,percent:c.percent});
    }
    if(calls>1||(!total&&calls)||(now<POLLS_DAY_START&&(total>0||calls)))return null;
    if(total){
      if(Math.abs(candidates.reduce((sum,c)=>sum+c.percent,0)-100)>2)return null;
      if(candidates.some(c=>Math.abs(c.votes/total*100-c.percent)>1.5))return null;
    }else if(candidates.some(c=>c.percent!==0))return null;
    const timestamp=detail.last_updated||null;
    if(timestamp&&(typeof timestamp!=='string'||!Number.isFinite(Date.parse(timestamp))||
        Date.parse(timestamp)>now+15*60000||
        (total>0&&Date.parse(timestamp)<POLLS_DAY_START)))return null;
    return {provider:'civicAPI',office:'Governor',key:'NH',race_id:row.id,
      last_updated:timestamp,percent_reporting:detail.percent_reporting,
      total,candidates,called,source_url:BASE+'/race/'+row.id};
  }
  const adapter=Object.freeze({supports,match,select,query,validate});
  if(typeof module!=='undefined'&&module.exports)module.exports=adapter;
  if(root)root.NHGovernorCivicAdapter=adapter;
})(typeof window!=='undefined'?window:globalThis);
