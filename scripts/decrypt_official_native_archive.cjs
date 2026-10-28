'use strict';
const fs=require('node:fs'),path=require('node:path'),sealed=require('./official_native_archive_crypto.cjs'),archive=require('./official_native_archive.cjs');
function restore({artifactDir,privateKeyPath,outputDir}){
 const root=fs.realpathSync(artifactDir),base=fs.realpathSync(path.resolve(__dirname,'../artifacts/readiness')),out=path.resolve(outputDir);
 if(path.dirname(out)!==base||fs.existsSync(out))throw Error('Choose a new direct child of ignored artifacts/readiness for decrypted originals');
 function read(relative,limit){if(!/^(?:manifest\.json|bodies\/[a-f0-9]{64}\.enc|requests\/\d{4}-(?:counts|remaining)\.json|outcomes\/\d{4}\.json)$/.test(relative))throw Error('Unsafe archive member path');const p=path.join(root,relative),stat=fs.lstatSync(p);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>limit||!fs.realpathSync(p).startsWith(root+path.sep))throw Error('Archive member path/size bound');return fs.readFileSync(p);}
 const manifest=JSON.parse(read('manifest.json',131072)),spec=archive.SOURCES[manifest.source];
 if(manifest.schema!=='official-native-first-night-archive-v1'||manifest.repository!==archive.REPO||manifest.retention_days!==30||!spec||!Array.isArray(manifest.requests)||manifest.requests.length>spec.requests||!manifest.bodies||Object.keys(manifest.bodies).length>spec.requests)throw Error('Invalid first-night archive manifest');
 const key=fs.readFileSync(privateKeyPath);if(key.length>16384||sealed.publicInfo(key).fingerprint!==manifest.encryption_key_fingerprint)throw Error('Archive key mismatch');
 const originals=new Map();let bytes=0;
 for(const [digest,b]of Object.entries(manifest.bodies)){
  if(!/^[a-f0-9]{64}$/.test(digest)||b.path!=='bodies/'+digest+'.enc'||b.sha256!==digest)throw Error('Invalid archive body identity');
  const encrypted=read(b.path,sealed.MAX_RAW+8192);if(sealed.sha(encrypted)!==b.encrypted_sha256||encrypted.length!==b.encrypted_bytes)throw Error('Encrypted body hash/size mismatch');
  const raw=sealed.open(encrypted,key);if(sealed.sha(raw)!==digest||raw.length!==b.bytes)throw Error('Exact original body hash/size mismatch');bytes+=raw.length;originals.set(digest,raw);
 }
 if(bytes>spec.bytes)throw Error('Archive per-job total bound');
 const receipts=[],sequences=new Set(),referenced=new Set();
 for(const r of manifest.requests){const receipt=JSON.parse(read(r.path,16384)),kind=spec.kinds[receipt.kind],start=Date.parse(receipt.request_started_at),complete=Date.parse(receipt.body_completed_at||'');if(!kind||receipt.source_url!==kind.url||!Number.isSafeInteger(r.sequence)||r.sequence<1||r.sequence>spec.requests||sequences.has(r.sequence)||receipt.sequence!==r.sequence||r.path!=='requests/'+String(r.sequence).padStart(4,'0')+'-'+receipt.kind+'.json'||start<spec.start||!Number.isFinite(start)||start>=archive.END)throw Error('Invalid request receipt identity/window');sequences.add(r.sequence);if(receipt.complete_body){if(!originals.has(receipt.original_response_sha256)||receipt.body_path!=='bodies/'+receipt.original_response_sha256+'.enc'||originals.get(receipt.original_response_sha256).length!==receipt.body_bytes||receipt.body_bytes>kind.limit||!Number.isFinite(complete)||complete<start||complete>=archive.END)throw Error('Receipt does not match a complete original');referenced.add(receipt.original_response_sha256);}else if(receipt.original_response_sha256!==null||receipt.body_path!==null||receipt.body_bytes!==null||receipt.body_completed_at!==null)throw Error('Incomplete receipt claims complete original bytes');receipts.push(receipt);}
 if(referenced.size!==originals.size)throw Error('Unreceipted original body');
 // All identities, ciphertexts and exact original hashes pass before output exists.
 fs.mkdirSync(out);for(const [digest,raw]of originals)fs.writeFileSync(path.join(out,digest+'.bin'),raw,{flag:'wx',mode:0o600});
 fs.writeFileSync(path.join(out,'verified-receipts.json'),JSON.stringify({scope:'Verified exact originals only; no model/source admission or chronology/calibration claim',manifest,receipts},null,2)+'\n',{flag:'wx',mode:0o600});
 return {status:originals.size?'EXACT_ORIGINALS_VERIFIED':'NO_COMPLETE_ORIGINALS',bodies:originals.size,requests:receipts.length,raw_bytes:bytes,output:out};
}
module.exports={restore};
if(require.main===module){try{const args=process.argv.slice(2),options={};for(let n=0;n<args.length;n+=2){if(!['--artifact-dir','--private-key','--output'].includes(args[n])||!args[n+1])throw Error('Use --artifact-dir DIR --private-key FILE --output NEW-IGNORED-DIR');options[args[n]]=args[n+1];}console.log(JSON.stringify(restore({artifactDir:options['--artifact-dir'],privateKeyPath:options['--private-key'],outputDir:options['--output']})));}catch(e){console.error(e.message);process.exitCode=1;}}
