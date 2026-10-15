/* Optional locally imported user-owned Silver Bulletin Senate CSV context.
 * Source CSVs can come from manually selected browser files or user-published
 * repository assets. This model module itself has no network operations.
 * Polls, Silver's blended forecast and FLIPR win odds are NOT inputs.
 */
(function(root,factory){
 const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.PrivateSenateFundamentals=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const VERSION='private-candidate-context-csv-v2';
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 function csvRows(text){
  if(typeof text!=='string'||text.length>250000||!text.trim())throw Error('Invalid CSV size');
  const out=[],row=[];let cell='',quote=false;
  const finish=()=>{row.push(cell);out.push(row.splice(0));cell=''};
  for(let i=0;i<text.length;i++){
   const c=text[i];
   if(c==='"'){if(quote&&text[i+1]==='"'){cell+='"';i++}else quote=!quote}
   else if(c===','&&!quote){row.push(cell);cell=''}
   else if((c==='\n'||c==='\r')&&!quote){
    if(c==='\r'&&text[i+1]==='\n')i++;
    finish();
   }else cell+=c;
  }
  if(quote)throw Error('Unclosed quoted CSV cell');
  if(cell||row.length)finish();
  return out;
 }
 function numberInCell(cell){
  const s=String(cell??'').trim();
  const at=s.lastIndexOf('@@');
  if(at<0)return null;
  const value=Number(s.slice(at+2));
  if(!finite(value)||Math.abs(value)>70)throw Error('Invalid CSV margin');
  if(/^D\s*\+/.test(s)&&value<-.01||/^R\s*\+/.test(s)&&value>.01)
   throw Error('Inconsistent partisan margin sign');
  return value;
 }
 function parse(text){
  const rows=csvRows(text);
  const ix=rows.findIndex(r=>String(r[0]||'').replace(/^\uFEFF/,'').trim()==='Race');
  if(ix<0||ix>3)throw Error('Expected Silver CSV Race header');
  const header=rows[ix].map(s=>String(s||'').trim());
  const fundamentals=header.includes('Fancy')&&header.includes('Simple')&&header.includes('Blended');
  const experts=header.includes('Unadjusted')&&header.includes('Adjusted');
  if(fundamentals===experts)throw Error('Expected fundamentals or expert-ratings CSV');
  const pair=fundamentals?['Simple','Fancy','Blended']:['Unadjusted','Adjusted'];
  const look=rows.slice(ix+1).map(line=>String(line[0]||'').trim().toUpperCase());
  const house=look.some(id=>/^[A-Z]{2}-\d{1,2}$/.test(id));
  const kind=(house?'house':'senate')+(fundamentals?'Fundamentals':'Experts');
  const states=Object.create(null);
  for(const line of rows.slice(ix+1)){
   let id=String(line[0]||'').trim().toUpperCase();
   if(house&&/^[A-Z]{2}-\d{1,2}$/.test(id)){
    const [state,district]=id.split('-');
    id=state+'-'+district.padStart(2,'0');
   }
   if(!(house?/^[A-Z]{2}-\d{2}$/:/^[A-Z]{2}$/).test(id))continue;
   if(Object.prototype.hasOwnProperty.call(states,id))
    throw Error('Duplicate race in private CSV '+id);
   const record={};
   for(const k of pair){const pos=header.indexOf(k);record[k.toLowerCase()]=numberInCell(line[pos]);}
   if(!pair.every(k=>finite(record[k.toLowerCase()])))
    throw Error('Missing required numeric input for '+id);
   states[id]=record;
  }
  if(Object.keys(states).length<3||Object.keys(states).length>450)
   throw Error('CSV contained no usable Senate or House race inputs');
  return {kind,states};
 }
 function validData(data){
  if(!data||data.schema!==VERSION)throw Error('Invalid private context version');
  if(!['senateFundamentals','senateExperts','houseFundamentals','houseExperts']
     .some(k=>Boolean(data[k])))throw Error('No private context inputs');
  for(const kind of ['senateFundamentals','senateExperts','houseFundamentals','houseExperts']){
   const values=data[kind];
   if(values===null||values===undefined)continue;
   if(!values||typeof values!=='object'||Array.isArray(values)||
       Object.keys(values).length>(kind.startsWith('house')?450:50))
    throw Error('Invalid '+kind+' rows');
   for(const [race,item] of Object.entries(values)){
    if(!(kind.startsWith('house')?/^[A-Z]{2}-\d{2}$/:/^[A-Z]{2}$/).test(race))
     throw Error('Invalid race');
    for(const k of (kind.endsWith('Fundamentals')?['simple','fancy','blended']:['unadjusted','adjusted']))
     if(!finite(item?.[k])||Math.abs(item[k])>70)
      throw Error('Invalid '+kind+' margin');
   }
  }
  return data;
 }
 function accept(current,parsed){
  if(!['senateFundamentals','senateExperts','houseFundamentals','houseExperts']
      .includes(parsed?.kind)||!parsed.states)throw Error('Unrecognized CSV family');
  const obj=current?{...validData(current)}:{schema:VERSION};
  obj[parsed.kind]=parsed.states;
  return validData(obj);
 }
 function apply(basis,privateData,options={}){
  validData(privateData);
  if(basis?.senate_prior_mode!=='current_2026'||basis.senate?.length!==35)
   throw Error('Private context requires the validated 2026 Senate model');
  let count=0;
  const senate=basis.senate.map(row=>{
   const fundamental=privateData.senateFundamentals?.[row.state]||null;
   const expert=privateData.senateExperts?.[row.state]||null;
   if(!fundamental&&!expert)return {...row};
   // Blended is WITHIN the CSV's Fundamentals section (Simple/Fancy/Blended),
   // not the FINAL race forecast. Use it, not either extreme submodel.
   // Unadjusted expert ratings can overlap with survey signals: small weight.
   const anchor=fundamental&&expert?
    .8*fundamental.blended+.2*expert.unadjusted:
    fundamental?fundamental.blended:expert.unadjusted;
   const source=fundamental&&expert?'blended_fundamentals_plus_unadjusted_expert':
    fundamental?'blended_fundamentals_only':'expert_only';
   const publishedPollWeight=row.polled?
    row.poll_weight:null;
   // A separately labeled PRIVATE RESEARCH variant, never calibrated from
   // Silver forecast odds. No change to race sigma or shared covariance.
   const w=row.polled?
    (publishedPollWeight>=.90?.75:publishedPollWeight>=.83?.68:.60):0;
   const pollMargin=row.polled&&publishedPollWeight>0?
    (row.mean-(1-publishedPollWeight)*
     row.candidate_neutral_2026_environment_margin_points)/publishedPollWeight:null;
   const mean=w*pollMargin+(1-w)*anchor;
   if(!finite(mean))throw Error('Invalid private 2026 Senate blend for '+row.code);
   count++;
   return {...row,mean:Math.max(-55,Math.min(55,mean)),
    method:row.method+'+locally_imported_private_context',
    private_context_mode:'user_imported_silver_fundamentals_sensitivity',
    private_context_source:source,
    private_context_anchor_points:+anchor.toFixed(3),
    private_context_fancy_points:fundamental?.fancy??null,
    private_context_blended_fundamentals_points:fundamental?.blended??null,
    private_context_simple_points:fundamental?.simple??null,
    private_context_expert_unadjusted_points:expert?.unadjusted??null,
    private_context_expert_adjusted_comparator_points:expert?.adjusted??null,
    private_context_poll_weight:w,
    private_context_original_mean_points:row.mean,
    poll_weight:row.polled?w:row.poll_weight};
  });
  let houseCount=0;
  const house=basis.house.map(row=>{
   if(options.includeHouse!==true)return {...row};
   const fundamental=privateData.houseFundamentals?.[row.code]||null;
   const expert=privateData.houseExperts?.[row.code]||null;
   if(!fundamental&&!expert)return {...row};
   const anchor=fundamental&&expert?.unadjusted!==undefined?
    .8*fundamental.blended+.2*expert.unadjusted:
    fundamental?fundamental.blended:expert.unadjusted;
   const previousWeight=row.poll_weight;
   const w=row.polled?(finite(previousWeight)?Math.min(.75,previousWeight):.75):0;
   const prior=row.mean;
   let pollMargin=null;
   if(row.polled&&finite(previousWeight)&&previousWeight>0){
    // Prefer direct source polling when a previous mixture is available.
    const src=options.housePollMargins?.[row.code];
    if(finite(src))pollMargin=src;
   }
   if(row.polled&&!finite(pollMargin))return {...row};
   const mean=row.polled?w*pollMargin+(1-w)*anchor:anchor;
   if(!finite(mean))throw Error('Invalid House context '+row.code);
   houseCount++;
   return {...row,mean:Math.max(-55,Math.min(55,mean)),
    method:row.method+'+locally_imported_private_house_context',
    private_context_anchor_points:+anchor.toFixed(3),
    private_context_original_mean_points:prior,
    private_context_poll_weight:w,
    poll_weight:row.polled?w:previousWeight};
  });
  if(count===0&&houseCount===0)throw Error('No private race inputs match 2026 races');
  return {...basis,senate,house,private_imported_context:{
   model:'unvalidated_candidate_context_sensitivity_not_flipr_replication',
   source:options.repositoryPublished===true?'public_repository_fundamentals_csv':'local_only_no_raw_csv_committed',
   matched_senate_races:count,matched_house_races:houseCount,
   include_house:options.includeHouse===true,
   input_types:['senateFundamentals','senateExperts','houseFundamentals','houseExperts']
    .filter(t=>Boolean(privateData[t])),
   experts_used_as_small_secondary_signal:true,
   silver_win_probs_fitted:false}};
 }
 const STORAGE_KEY='jackstradamus_private_candidate_context_v1';
 const MAX_STORED_BYTES=180000;
 const IMPORT_WARN_AFTER_DAYS=7;
 const IMPORT_DISABLE_AFTER_DAYS=35;
 function safeIsoDate(now){
  const date=now instanceof Date?now:new Date(now===undefined?Date.now():now);
  if(!Number.isFinite(date.getTime()))throw Error('Invalid import date');
  return date.toISOString();
 }
 // Local-only device persistence: caller supplies same-origin Storage.
 // Never use the service worker, data API, fetch or a GitHub content endpoint.
 function saveDevice(storage,data,settings={},now){
  validData(data);
  if(!storage||typeof storage.setItem!=='function')
   throw Error('Browser storage unavailable');
  const record={schema:VERSION,data,imported_at:safeIsoDate(now),
   settings:{enabled:settings.enabled!==false,includeHouse:settings.includeHouse===true}};
  const payload=JSON.stringify(record);
  if(payload.length>MAX_STORED_BYTES)throw Error('Imported model context exceeds local storage limit');
  storage.setItem(STORAGE_KEY,payload);
  return {imported_at:record.imported_at,rows:Object.keys(data.senateFundamentals||{}).length+
   Object.keys(data.houseFundamentals||{}).length};
 }
 function restoreDevice(storage,now){
  if(!storage||typeof storage.getItem!=='function')return null;
  const raw=storage.getItem(STORAGE_KEY);
  if(raw===null||raw===undefined)return null;
  if(typeof raw!=='string'||raw.length>MAX_STORED_BYTES)
   throw Error('Stored private model context exceeds safety limit');
  let record;
  try{record=JSON.parse(raw)}catch(_){throw Error('Stored private model context is unreadable')}
  if(record?.schema!==VERSION||!record?.data)throw Error('Stored private model schema mismatch');
  validData(record.data);
  const date=Date.parse(record.imported_at),stamp=Date.parse(safeIsoDate(now));
  if(!Number.isFinite(date)||date>stamp+86400000||date<Date.parse('2026-01-01T00:00:00Z'))
   throw Error('Stored private input date is invalid');
  const ageDays=Math.max(0,(stamp-date)/86400000);
  return {data:record.data,
   settings:{enabled:record.settings?.enabled!==false,
    includeHouse:record.settings?.includeHouse===true},
   imported_at:record.imported_at,age_days:ageDays,
   warning:ageDays>=IMPORT_WARN_AFTER_DAYS,
   expired:ageDays>=IMPORT_DISABLE_AFTER_DAYS};
 }
 function clearDevice(storage){
  if(storage&&typeof storage.removeItem==='function')
   storage.removeItem(STORAGE_KEY);
 }
 return Object.freeze({VERSION,STORAGE_KEY,IMPORT_WARN_AFTER_DAYS,
  IMPORT_DISABLE_AFTER_DAYS,parse,accept,apply,validData,
  saveDevice,restoreDevice,clearDevice});
});
