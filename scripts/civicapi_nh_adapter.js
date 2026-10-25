/* First independently tested civicAPI race adapter: 2026 New Hampshire US Senate.
 * Search metadata and race details are never treated as official certification.
 * A missing or conflicting source record must not become a zero-vote race. */
(function (root) {
  'use strict';
  const BASE='https://civicapi.org/api/v2';
  const DAY='2026-11-03';
  const COUNTING_START=Date.parse('2026-11-03T05:00:00Z');
  const disabled=x=>Boolean(x&&(x.is_test===true||x.test===true||
    x.mock===true||x.is_mock===true||x.active===false||x.live===false));
  function pollGate(){
    return typeof module!=='undefined'&&module.exports?
      require('./election_night_poll_closings_2026.js'):
      root?.ElectionNightPollClosings2026;
  }
  const votesAllowed=(total,updated,now)=>pollGate()?.allowed?.('NH',total,updated,now)===true;
  const callAllowed=(total,updated,now)=>pollGate()?.winnerAllowed?.('Senate','NH',total,updated,now)===true;
  const supports=item=>item?.office==='Senate'&&item?.key==='NH';
  const validDate=value=>typeof value==='string'&&
    /^2026-11-03(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d))?$/.test(value)&&
    Number.isFinite(Date.parse(value.length===10?value+'T00:00:00Z':value));
  function match(item,row){
    return supports(item)&&row&&!disabled(row)&&row.country==='US'&&row.province==='NH'&&
      row.municipality==null&&row.district==null&&
      Number.isSafeInteger(row.id)&&row.id>0&&validDate(row.election_date)&&
      row.type==='US Senate'&&row.election_type==='General'&&
      typeof row.election_name==='string'&&
      /^New Hampshire US Senate$/i.test(row.election_name.trim())&&
      Array.isArray(row.candidates)&&row.candidates.length<=60;
  }
  function select(item,doc){
    if(!supports(item)||!doc||disabled(doc)||!Array.isArray(doc.races)||
      doc.races.length===0||doc.races.length>20||
      (doc.count!=null&&(!Number.isSafeInteger(doc.count)||doc.count!==doc.races.length)))return null;
    const exact=doc.races.filter(row=>match(item,row));
    return exact.length===1?exact[0]:null;
  }
  function query(item){
    if(!supports(item))return null;
    return BASE+'/race/search?'+new URLSearchParams({
      country:'US',province:'NH',startDate:DAY,endDate:DAY,
      query:'US Senate',limit:'20'
    }).toString();
  }
  function party(label){
    const value=label.trim().toLowerCase();
    if(['democratic','democrat','dem','d'].includes(value))return 'D';
    if(['republican','rep','gop','r'].includes(value))return 'R';
    return 'O';
  }
  function validate(item,row,detail,now=Date.now()){
    if(!match(item,row)||!detail||disabled(detail)||
      (detail.id!=null&&detail.id!==row.id)||
      detail.country!==row.country||detail.province!==row.province||
      detail.election_date!==row.election_date||
      detail.election_name!==row.election_name||
      detail.election_type!==row.type||detail.district!==row.district||
      !Number.isFinite(detail.percent_reporting)||
      detail.percent_reporting<0||detail.percent_reporting>100||
      !Array.isArray(detail.candidates)||detail.candidates.length<2||
      detail.candidates.length>60||!Number.isFinite(now))return null;
    const seen=new Set(),candidates=[];
    let total=0,called=null,callCount=0;
    for(const candidate of detail.candidates){
      if(!candidate||typeof candidate.name!=='string'||!candidate.name.trim()||
        typeof candidate.party!=='string'||!candidate.party.trim()||
        !Number.isSafeInteger(candidate.votes)||candidate.votes<0||
        !Number.isFinite(candidate.percent)||candidate.percent<0||
        candidate.percent>100||typeof candidate.winner!=='boolean')return null;
      const key=candidate.name.trim().toLowerCase()+'|'+candidate.party.trim().toLowerCase();
      if(seen.has(key))return null;
      seen.add(key);
      total+=candidate.votes;
      if(!Number.isSafeInteger(total))return null;
      if(candidate.winner){callCount++;called=candidate.name.trim();}
      candidates.push({name:candidate.name.trim(),party:party(candidate.party),
        votes:candidate.votes,percent:candidate.percent});
    }
    if(callCount>1||(!total&&callCount)||now<COUNTING_START&&(total>0||callCount))return null;
    if(total){
      if(Math.abs(candidates.reduce((sum,c)=>sum+c.percent,0)-100)>2)return null;
      if(candidates.some(c=>Math.abs(100*c.votes/total-c.percent)>1.5))return null;
    }else if(candidates.some(c=>c.percent!==0))return null;
    const updated=detail.last_updated||null;
    if(updated&&(typeof updated!=='string'||!Number.isFinite(Date.parse(updated))||
      Date.parse(updated)>now+15*60000||
      (total>0&&Date.parse(updated)<COUNTING_START)))return null;
    if(!votesAllowed(total,updated,now))return null;
    return {provider:'civicAPI',office:'Senate',key:'NH',race_id:row.id,
      last_updated:updated,percent_reporting:detail.percent_reporting,
      total,candidates,called:called&&callAllowed(total,updated,now)?called:null,
      source_url:BASE+'/race/'+row.id};
  }
  const adapter=Object.freeze({supports,match,select,query,validate});
  if(typeof module!=='undefined'&&module.exports)module.exports=adapter;
  if(root)root.NHCivicRaceAdapter=adapter;
})(typeof window!=='undefined'?window:globalThis);
