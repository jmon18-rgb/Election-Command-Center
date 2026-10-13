/* Four-state civicAPI adapter: validated Nov. 3, 2026 six
 * statewide Senate and governor races in AK, ME, MA, NV. Provider calls remain
 * civicAPI calls only, never official certifications. */
(function(root){
  'use strict';
  const BASE='https://civicapi.org/api/v2';
  const ELECTION='2026-11-03';
  const START=Date.parse('2026-11-03T05:00:00Z');
  const RACES=Object.freeze({
    'Senate|AK':{state:'AK',name:'Alaska US Senate',office:'Senate',id:86916},
    'Governor|AK':{state:'AK',name:'Alaska Governor',office:'Governor',id:148898},
    'Senate|ME':{state:'ME',name:'Maine US Senate',office:'Senate',id:87188},
    'Governor|ME':{state:'ME',name:'Maine Governor',office:'Governor',id:87189},
    'Governor|MA':{state:'MA',name:'Massachusetts Governor',office:'Governor',id:87276},
    'Governor|NV':{state:'NV',name:'Nevada Governor',office:'Governor',id:87260}
  });
  const configuration=item=>item&&RACES[item.office+'|'+item.key]||null;
  const supports=item=>Boolean(configuration(item));
  const validDate=value=>typeof value==='string'&&
    /^2026-11-03(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value);
  function query(item){
    const cfg=configuration(item);if(!cfg)return null;
    return BASE+'/race/search?'+new URLSearchParams({
      country:'US',province:cfg.state,startDate:ELECTION,endDate:ELECTION,
      query:cfg.office==='Senate'?'US Senate':'Governor',limit:'20'
    }).toString();
  }
  function match(item,row){
    const cfg=configuration(item);
    return Boolean(cfg&&row&&row.country==='US'&&row.province===cfg.state&&
      row.municipality==null&&row.district==null&&validDate(row.election_date)&&
      Number.isSafeInteger(row.id)&&row.id===cfg.id&&
      row.type===(cfg.office==='Senate'?'US Senate':'Governor')&&
      row.election_type===(cfg.office==='Senate'?'General':'Statewide')&&
      typeof row.election_name==='string'&&row.election_name.trim()===cfg.name&&
      Array.isArray(row.candidates)&&row.candidates.length<=60);
  }
  function select(item,doc){
    if(!configuration(item)||!doc||!Array.isArray(doc.races)||
       doc.races.length>20||doc.races.length===0||
       (Number.isSafeInteger(doc.count)&&doc.count>20))return null;
    const exact=doc.races.filter(row=>match(item,row));
    return exact.length===1?exact[0]:null;
  }
  function party(name){
    const x=name.trim().toLowerCase();
    if(['d','dem','democratic','democrat'].includes(x))return 'D';
    if(['r','rep','gop','republican'].includes(x))return 'R';
    return 'O';
  }
  function validate(item,row,detail,now=Date.now()){
    const cfg=configuration(item);
    if(!cfg||!match(item,row)||!detail||!Number.isFinite(now)||
       (detail.id!=null&&detail.id!==row.id)||
       detail.country!==row.country||detail.province!==row.province||
       detail.election_date!==row.election_date||
       detail.election_name!==row.election_name||
       detail.election_type!==row.type||detail.district!==row.district||
       !Number.isFinite(detail.percent_reporting)||
       detail.percent_reporting<0||detail.percent_reporting>100||
       !Array.isArray(detail.candidates)||detail.candidates.length<2||
       detail.candidates.length>60)return null;
    let total=0,called=null,calls=0;
    const candidates=[],seen=new Set();
    for(const c of detail.candidates){
      if(!c||typeof c.name!=='string'||!c.name.trim()||
         typeof c.party!=='string'||!c.party.trim()||
         !Number.isSafeInteger(c.votes)||c.votes<0||
         !Number.isFinite(c.percent)||c.percent<0||c.percent>100||
         typeof c.winner!=='boolean')return null;
      const id=c.name.trim().toLowerCase()+'|'+c.party.trim().toLowerCase();
      if(seen.has(id))return null;
      seen.add(id);
      total+=c.votes;
      if(!Number.isSafeInteger(total))return null;
      if(c.winner){called=c.name.trim();calls++}
      candidates.push({name:c.name.trim(),party:party(c.party),
        votes:c.votes,percent:c.percent});
    }
    if(calls>1||(!total&&calls)||(now<START&&(total>0||calls)))return null;
    if(total){
      if(Math.abs(candidates.reduce((sum,c)=>sum+c.percent,0)-100)>2||
         candidates.some(c=>Math.abs(100*c.votes/total-c.percent)>1.5))return null;
    }else if(candidates.some(c=>c.percent!==0))return null;
    const updated=detail.last_updated||null;
    if(updated&&(typeof updated!=='string'||!Number.isFinite(Date.parse(updated))||
      Date.parse(updated)>now+15*60000||
      (total>0&&Date.parse(updated)<START)))return null;
    return {provider:'civicAPI',office:cfg.office,key:cfg.state,
      race_id:row.id,last_updated:updated,percent_reporting:detail.percent_reporting,
      total,candidates,called,source_url:BASE+'/race/'+row.id};
  }
  const adapter=Object.freeze({supports,match,select,query,validate});
  if(typeof module!=='undefined'&&module.exports)module.exports=adapter;
  if(root)root.StateBatchCivicAdapter=adapter;
})(typeof window!=='undefined'?window:globalThis);
