'use strict';
// Import versions are fixed self-hosted assets, never caller-provided URLs.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const names=Object.freeze(['election_night_poll_closings_2026','washington_remaining_source','washington_remaining_scenarios','source_call_conditioning','chamber_control_model','national_county_likelihood']);
const revision=bytes=>{const body=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes);return crypto.createHash('sha1').update(Buffer.from('blob '+body.length+'\0')).update(body).digest('hex').slice(0,12);};
function inspect(source,read,{fix=false}={}){
 if(typeof source!=='string')return {ok:false,errors:['Worker source must be text'],source};
 let expected;try{expected=names.map(name=>({name,stamp:revision(read(name))}));}
 catch{return {ok:false,errors:['Worker static dependency is unreadable'],source};}
 const match=source.match(/const IMPORTS=Object\.freeze\(\((\[[^\n]+\])\)\.map\(Object\.freeze\)\);/);
 const model=source.match(/const MODEL_REVISION=("[^\n]+");/);
 if(!match||!model)return {ok:false,errors:['Worker static manifest markers missing'],source};
 let actual,actualModel;try{actual=JSON.parse(match[1]);actualModel=JSON.parse(model[1]);}
 catch{return {ok:false,errors:['Worker static manifest is not valid JSON'],source};}
 const wanted=['source_call_conditioning','chamber_control_model','national_county_likelihood'].map(name=>'./scripts/'+name+'.js?v='+expected.find(x=>x.name===name).stamp).join('|');
 const changed=JSON.stringify(actual)!==JSON.stringify(expected)||actualModel!==wanted;
 if(changed&&fix)source=source.replace(match[0],'const IMPORTS=Object.freeze(('+JSON.stringify(expected)+').map(Object.freeze));').replace(model[0],'const MODEL_REVISION='+JSON.stringify(wanted)+';');
 return {ok:!changed||fix,changed,errors:changed&&!fix?['Worker import/model revisions must match exact static Git blobs']:[],source,expected};
}
function main(){const root=path.resolve(__dirname,'..'),file=path.join(root,'scripts/joint_model_worker.js'),fix=process.argv.includes('--fix');
 const check=inspect(fs.readFileSync(file,'utf8'),name=>fs.readFileSync(path.join(root,'scripts',name+'.js')),{fix});
 if(!check.ok){console.error(check.errors.join('\n'));process.exitCode=1;return;}
 if(fix&&check.changed)fs.writeFileSync(file,check.source);console.log('Worker static imports:6 exact assets'+(check.changed?' repaired':''));
}
if(require.main===module)main();module.exports={inspect,names,revision};
