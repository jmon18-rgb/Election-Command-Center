#!/usr/bin/env node
'use strict';
/* Prevent an Election Night script update from leaving index.html pointed at
 * the old Git-blob cache revision. Runs offline with stock Node 22.
 * --fix updates references ONLY: it never rewrites script contents.
 */
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const INDEX=path.join(ROOT,'index.html');
const SRC=/(<script\b[^>]*\bsrc=["'])([^"']+)(["'][^>]*>)/g;
const VALID=/^\.\/scripts\/[a-z0-9_-]+\.js\?v=([a-f0-9]{12})$/;
const UNVERSIONED=/^\.\/scripts\/[a-z0-9_-]+\.js$/;
function revision(bytes){
 const buf=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes);
 return crypto.createHash('sha1').update(Buffer.from('blob '+buf.length+'\0'))
  .update(buf).digest('hex').slice(0,12);
}
function inspect(html,readScript,{fix=false}={}){
 if(typeof html!=='string')throw Error('Invalid index document');
 const seen=new Set(),errors=[],updates=[];
 let scanned=0;
 const result=html.replace(SRC,(full,start,src,end)=>{
  scanned++;
  const name=src.split('?')[0];
  if(!VALID.test(src)&&!UNVERSIONED.test(src)){
   errors.push('Unsafe or unversioned external script: '+src);
   return full;
  }
  if(seen.has(name)){
   errors.push('Duplicate external script: '+name);
   return full;
  }
  seen.add(name);
  let expected;
  try{
   expected=revision(readScript(name));
  }catch(err){
   errors.push('Unreadable external script '+name+': '+String(err.message||err));
   return full;
  }
  const actual=src.match(VALID)?.[1]||null;
  if(actual!==expected){
   updates.push({name,actual:actual||'unversioned',expected});
   if(fix)return start+name+'?v='+expected+end;
   errors.push(name+': index revision '+(actual||'missing')+' differs from Git blob '+expected);
  }
  return full;
 });
 if(scanned<8)errors.push('External script inventory unexpectedly small: '+scanned);
 return {ok:errors.length===0,errors,updates,scanned,html:result};
}
function main(){
 const fix=process.argv.includes('--fix');
 const result=inspect(fs.readFileSync(INDEX,'utf8'),name=>
  fs.readFileSync(path.join(ROOT,name.slice(2))),{fix});
 if(result.errors.length){
  for(const error of result.errors)console.error('SCRIPT PROVENANCE:',error);
  console.error('Repair only valid revision stamps with: node scripts/check_election_night_asset_versions.cjs --fix');
  process.exitCode=1;return;
 }
 if(fix&&result.updates.length){
  fs.writeFileSync(INDEX,result.html);
  for(const x of result.updates)console.log('UPDATED',x.name,x.expected);
 }
 console.log('Election Night script revisions:',result.scanned,'checked,',
  result.updates.length,'mismatches'+(fix?' fixed':''));
}
if(require.main===module)main();
module.exports={revision,inspect};
