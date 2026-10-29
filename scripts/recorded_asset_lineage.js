// Pure derived recorded-history formatting. No DOM access or hashing.
// The full worker/job identities
// and numerical revisions must continue to use their original full strings.
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.RecordedAssetLineage=api;})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const VERSION='AR2';
 const definitionsAR1=[
  ['cl','election_night_poll_closings_2026.js','Poll-close rules'],
  ['wr','washington_remaining_source.js','WA remaining source rules'],
  ['ws','washington_remaining_scenarios.js','WA remaining scenarios'],
  ['sc','source_call_conditioning.js','Source-call transport'],
  ['en','chamber_control_model.js','Joint election engine'],
  ['co','national_county_likelihood.js','County likelihood'],
  ['wk','joint_model_worker.js','Worker runner'],
  ['po','joint_count_snapshot_policy.js','Count snapshot policy'],
  ['ct','joint_model_worker_controller.js','Worker coordinator'],
  ['wc','washington_official_cache.js','WA cache receipt'],
  ['wn','washington_official_house_source.js','WA native publication'],
  ['wu','washington_remaining_usage.js','WA used-remaining capture'],
  ['vn','virginia_official_house_source.js','VA native source'],
  ['vc','virginia_official_cache.js','VA cache receipt'],
  // AR1 defines an unbound map. Never retrofit a filename or
  // accept a hash for this slot. '?' records unknown binding, not absence.
  // Binding it requires a new fixed map version.
  ['vu',null,'VA typed usage · NOT_YET_BOUND']
 ];
 // Keep the old map immutable: a later filename binding must not reinterpret
 // an earlier AR1 '?' as known, or assign any missing historical hash.
 const definitionsAR2=[...definitionsAR1.map(row=>row[0]==='vu'?['vu','virginia_official_usage.js','VA typed count usage']:row),['ln','recorded_asset_lineage.js','Recorded component lineage codec']];
 const freezeMap=rows=>Object.freeze(rows.map(([id,script,label])=>Object.freeze({id,script,label})));
 const ROLE_MAPS=Object.freeze({AR1:freezeMap(definitionsAR1),AR2:freezeMap(definitionsAR2)}),ROLES=ROLE_MAPS[VERSION],byId=new Map(ROLES.map(row=>[row.id,row])),byScript=new Map(ROLES.filter(row=>row.script).map(row=>[row.script,row]));
 const fail=code=>{throw new Error(code);},plain=value=>value&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null),safeText=text=>typeof text==='string'&&text.length>0&&text.length<=4096&&!/[\r\n\u0000]/.test(text);
 function reference(src){
  if(typeof src!=='string')fail('INVALID_ASSET_REFERENCE');
  const match=/^\.\/scripts\/([a-z][a-z0-9_]*\.js)\?v=([a-f0-9]{12})$/.exec(src);
  if(!match)fail('UNSAFE_OR_NONCANONICAL_ASSET_REFERENCE');
  const definition=byScript.get(match[1]);if(!definition)fail('UNKNOWN_STATIC_ASSET_ROLE');
  return {definition,stamp:match[2],src};
 }
 function encodeEntries(entries){
  if(!Array.isArray(entries)||entries.length!==ROLES.length)fail('INCOMPLETE_ROLE_TABLE');
  const seen=new Map();
  for(const entry of entries){
   if(!plain(entry)||Object.keys(entry).some(key=>!['role','src','state'].includes(key))||!Object.hasOwn(entry,'role')||!Object.hasOwn(entry,'src')||!byId.has(entry.role))fail('INVALID_ROLE_ENTRY');
   if(seen.has(entry.role))fail('DUPLICATE_ROLE');const definition=byId.get(entry.role);
   if(entry.src===null){
    const markers={ABSENT:'-',NOT_IN_COMPONENT:'~',NOT_YET_BOUND:'?'};
    if(!Object.hasOwn(markers,entry.state))fail('MISSING_EXPLICIT_ROLE_STATE');
    if((!definition.script)!==(entry.state==='NOT_YET_BOUND'))fail('INVALID_ROLE_STATE');
    seen.set(entry.role,markers[entry.state]);continue;
   }
   if(!definition.script)fail('ROLE_NOT_YET_BOUND');
   if(Object.hasOwn(entry,'state')&&entry.state!=='RECORDED')fail('INVALID_ROLE_STATE');
   const parsed=reference(entry.src);if(parsed.definition.id!==entry.role)fail('ROLE_ASSET_MISMATCH');seen.set(entry.role,parsed.stamp);
  }
  return VERSION+'['+ROLES.map(row=>row.id+'='+seen.get(row.id)).join(',')+']';
 }
 function encodeWorkerRevision(full,options={}){
  if(!safeText(full)||!plain(options)||Object.keys(options).some(key=>!['absentRoles','notInComponentRoles','unboundRoles'].includes(key)))fail('INVALID_WORKER_REVISION');
  const found=new Map(),declared=new Map();
  for(const [key,state]of [['absentRoles','ABSENT'],['notInComponentRoles','NOT_IN_COMPONENT'],['unboundRoles','NOT_YET_BOUND']]){
   const list=options[key]??[];if(!Array.isArray(list))fail('INVALID_ROLE_STATE_DECLARATION');
   for(const id of list){if(!byId.has(id)||declared.has(id))fail('INVALID_ROLE_STATE_DECLARATION');declared.set(id,state);}
  }
  for(const src of full.split('|')){const parsed=reference(src),id=parsed.definition.id;if(found.has(id))fail('DUPLICATE_ASSET_ROLE');if(declared.has(id))fail('CONTRADICTORY_ROLE_STATE');found.set(id,src);}
  for(const role of ROLES)if(!found.has(role.id)&&!declared.has(role.id))fail('MISSING_EXPLICIT_ROLE_STATE');
  return encodeEntries(ROLES.map(role=>found.has(role.id)?{role:role.id,src:found.get(role.id)}:{role:role.id,src:null,state:declared.get(role.id)}));
 }
 function frozenResult(format,rows,notRecorded=[]){return Object.freeze({format,roles:Object.freeze(rows.map(row=>Object.freeze(row))),not_recorded:Object.freeze(notRecorded.slice())});}
 function decodeCompact(text){
  const version=typeof text==='string'?/^(AR\d+)\[/.exec(text)?.[1]:null,map=ROLE_MAPS[version];
  if(!safeText(text)||!map||!text.endsWith(']'))fail('UNKNOWN_RECORDED_FORMAT');
  const tokens=text.slice(version.length+1,-1).split(',');if(tokens.length!==map.length)fail('INCOMPLETE_ROLE_TABLE');
  const rows=tokens.map((token,index)=>{const m=/^([a-z]{2})=([-~?]|[a-f0-9]{12})$/.exec(token);if(!m||m[1]!==map[index].id)fail('NONCANONICAL_ROLE_ORDER_OR_VALUE');const definition=map[index],recorded=m[2].length===12;if(!definition.script&&m[2]!=='?')fail('ROLE_NOT_YET_BOUND');if(definition.script&&m[2]==='?')fail('INVALID_ROLE_STATE');return {role:definition.id,script:definition.script,stamp:recorded?m[2]:null,state:recorded?'RECORDED':m[2]==='-'?'EXPLICIT_ABSENT':m[2]==='~'?'NOT_IN_COMPONENT':'NOT_YET_BOUND'};});
  return frozenResult(version,rows,rows.filter(row=>['NOT_IN_COMPONENT','NOT_YET_BOUND'].includes(row.state)).map(row=>row.role));
 }
 function decodeLegacy(text){
  if(!safeText(text))fail('INVALID_LEGACY_RECORDED_REVISION');const found=new Map();
  for(const token of text.split('|')){let definition,stamp;
   if(token.startsWith('./scripts/')){const parsed=reference(token);definition=parsed.definition;stamp=parsed.stamp;}
   else{const m=/^([a-z][a-z0-9_]*)@([a-f0-9]{12})$/.exec(token);if(!m)fail('INVALID_LEGACY_ASSET_REFERENCE');definition=byScript.get(m[1]+'.js');if(!definition)fail('UNKNOWN_STATIC_ASSET_ROLE');stamp=m[2];}
   if(found.has(definition.id))fail('DUPLICATE_ASSET_ROLE');found.set(definition.id,{role:definition.id,script:definition.script,stamp,state:'RECORDED'});
  }
  const rows=ROLES.filter(row=>found.has(row.id)).map(row=>found.get(row.id));
  // Legacy omission never proves that a future/helper asset was absent.
  return frozenResult('LEGACY',rows,ROLES.filter(row=>!found.has(row.id)).map(row=>row.id));
 }
 function decodeRecorded(text){if(typeof text==='string'&&text.startsWith('AR'))return decodeCompact(text);return decodeLegacy(text);}
 function decodeHistory(text){
  if(!safeText(text))fail('INVALID_HISTORY_REVISION');const tokens=text.split('|'),compact=tokens.filter(token=>token.startsWith('AR')),legacy=tokens.filter(token=>token.startsWith('./scripts/')||/^[a-z][a-z0-9_]*@/.test(token));
  if(compact.length){if(compact.length!==1||legacy.length)fail('MIXED_OR_DUPLICATED_RECORDED_FORMAT');return decodeCompact(compact[0]);}
  if(!legacy.length)fail('NO_RECORDED_ASSET_IDENTITIES');return decodeLegacy(legacy.join('|'));
 }
 function inspectHistory(text){try{return Object.freeze({status:'DECODED',assets:decodeHistory(text)});}catch(error){return Object.freeze({status:'UNRECOGNIZED',reason:String(error.message)});}}
 return Object.freeze({VERSION,ROLES,ROLE_MAPS,encodeEntries,encodeWorkerRevision,decodeRecorded,decodeHistory,inspectHistory});
});
