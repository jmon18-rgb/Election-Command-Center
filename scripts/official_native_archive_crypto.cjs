'use strict';
const crypto=require('node:crypto'),zlib=require('node:zlib');
const MAX_RAW=2500000;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function publicInfo(key){const k=crypto.createPublicKey(key);if(k.asymmetricKeyType!=='rsa'||k.asymmetricKeyDetails.modulusLength<3072)throw Error('Archive public key must be RSA3072 or stronger');return {key:k,fingerprint:sha(k.export({type:'spki',format:'der'}))};}
function seal(raw,publicKey){
 if(!Buffer.isBuffer(raw)||raw.length>MAX_RAW)throw Error('Raw archive encryption bound');
 const info=publicInfo(publicKey),digest=sha(raw),key=crypto.randomBytes(32),iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(digest));
 const encrypted=Buffer.concat([cipher.update(zlib.gzipSync(raw,{level:6})),cipher.final()]);
 const header=Buffer.from(JSON.stringify({schema:'official-native-sealed-body-v1',compression:'gzip',encryption:'AES-256-GCM+RSA-OAEP-SHA256',key_fingerprint:info.fingerprint,wrapped_key:crypto.publicEncrypt({key:info.key,oaepHash:'sha256',padding:crypto.constants.RSA_PKCS1_OAEP_PADDING},key).toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),raw_sha256:digest,raw_bytes:raw.length}));
 const size=Buffer.alloc(4);size.writeUInt32BE(header.length);key.fill(0);return Buffer.concat([size,header,encrypted]);
}
function open(envelope,privateKey){
 if(!Buffer.isBuffer(envelope)||envelope.length<5||envelope.length>MAX_RAW+8192)throw Error('Encrypted archive body bound');
 const n=envelope.readUInt32BE();if(n<1||n>4096||n>=envelope.length-4)throw Error('Encrypted archive header bound');
 const h=JSON.parse(envelope.subarray(4,4+n));
 if(h.schema!=='official-native-sealed-body-v1'||h.compression!=='gzip'||h.encryption!=='AES-256-GCM+RSA-OAEP-SHA256'||!Number.isSafeInteger(h.raw_bytes)||h.raw_bytes<0||h.raw_bytes>MAX_RAW||!/^[a-f0-9]{64}$/.test(h.raw_sha256))throw Error('Invalid encrypted archive header');
 const info=publicInfo(privateKey);if(info.fingerprint!==h.key_fingerprint)throw Error('Wrong archive decryption key');
 const key=crypto.privateDecrypt({key:privateKey,oaepHash:'sha256',padding:crypto.constants.RSA_PKCS1_OAEP_PADDING},Buffer.from(h.wrapped_key,'base64')),iv=Buffer.from(h.iv,'base64'),tag=Buffer.from(h.tag,'base64');if(key.length!==32||iv.length!==12||tag.length!==16)throw Error('Invalid encrypted archive parameters');
 const decipher=crypto.createDecipheriv('aes-256-gcm',key,iv);decipher.setAAD(Buffer.from(h.raw_sha256));decipher.setAuthTag(tag);
 try{const packed=Buffer.concat([decipher.update(envelope.subarray(4+n)),decipher.final()]),raw=zlib.gunzipSync(packed,{maxOutputLength:MAX_RAW});if(raw.length!==h.raw_bytes||sha(raw)!==h.raw_sha256)throw Error('Decrypted original hash/size mismatch');return raw;}finally{key.fill(0);}
}
module.exports={MAX_RAW,sha,publicInfo,seal,open};
