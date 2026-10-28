'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sealed=require('./official_native_archive_crypto.cjs'),root=path.resolve(__dirname,'..');
function init(){
 if(process.env.GITHUB_ACTIONS==='true')throw Error('Generate archive private keys locally, never inside CI/artifact uploads');
 const privatePath=path.join(root,'.official-native-archive-key/private.pem'),publicPath=path.join(root,'data/official_native_archive_public_key.pem');
 if(fs.existsSync(privatePath)||fs.existsSync(publicPath)){
  if(!fs.existsSync(privatePath)||!fs.existsSync(publicPath))throw Error('An archive key already exists without its matching pair; never overwrite it');
  const a=sealed.publicInfo(fs.readFileSync(privatePath)),b=sealed.publicInfo(fs.readFileSync(publicPath));if(a.fingerprint!==b.fingerprint)throw Error('Existing archive keys do not match');
  return {status:'EXISTING_KEY_PAIR_PRESERVED',public_fingerprint:a.fingerprint,private_key:privatePath};
 }
 const keys=crypto.generateKeyPairSync('rsa',{modulusLength:3072,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
 fs.mkdirSync(path.dirname(privatePath),{recursive:true});fs.writeFileSync(privatePath,keys.privateKey,{flag:'wx',mode:0o600});fs.writeFileSync(publicPath,keys.publicKey,{flag:'wx'});
 return {status:'LOCAL_PRIVATE_KEY_CREATED',public_fingerprint:sealed.publicInfo(keys.publicKey).fingerprint,private_key:privatePath,warning:'Keep the local private key through archive retention; loss prevents decryption. Never commit or upload it.'};
}
module.exports={init};
if(require.main===module){try{if(process.argv.length!==3||process.argv[2]!=='--init')throw Error('Use --init once; existing matching keys are preserved');console.log(JSON.stringify(init()));}catch(e){console.error(e.message);process.exitCode=1;}}
