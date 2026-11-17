/* Encrypted portable evidence envelopes. All operations occur in browser memory.
 * Files and passwords are never uploaded or persisted automatically.
 * Not an institutional shared vault or a substitute for managed SSO/RLS.
 */
(function(root){
"use strict";
const VERSION=1,ITERATIONS=310000,MAX_BYTES=2*1024*1024,MAX_ENVELOPE=4*1024*1024;
const enc=new TextEncoder(),dec=new TextDecoder();
function b64(bytes){
 let str="";
 for(let i=0;i<bytes.length;i+=32768){
  str+=String.fromCharCode(...bytes.subarray(i,i+32768));
 }
 return btoa(str);
}
function un64(text){
 if(typeof text!=="string"||text.length>MAX_ENVELOPE*1.5||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text))throw Error("invalid_encoding");
 const chars=atob(text),out=new Uint8Array(chars.length);
 for(let i=0;i<chars.length;i++)out[i]=chars.charCodeAt(i);
 return out;
}
const fileName=s=>String(s||"document").replace(/[/\\\x00-\x1f<>:"|?*]/g,"_").slice(0,160);
function assertPassword(password){
 if(typeof password!=="string"||password.length<12||password.length>200)throw Error("weak_password");
}
async function keyFor(password,salt,cryptoRef){
 const material=await cryptoRef.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveKey"]);
 return cryptoRef.subtle.deriveKey({name:"PBKDF2",hash:"SHA-256",salt,iterations:ITERATIONS},
  material,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
}
async function encrypt({bytes,name,type,decisionId,expiresOn,password},cryptoRef){
 if(!cryptoRef?.subtle||!cryptoRef?.getRandomValues)throw Error("secure_context_required");
 assertPassword(password);
 if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>MAX_BYTES)throw Error("invalid_file_size");
 if(decisionId!==""&&!/^[a-z0-9-]{1,64}$/i.test(decisionId))throw Error("invalid_decision_id");
 if(expiresOn&&!/^\d{4}-\d{2}-\d{2}$/.test(expiresOn))throw Error("invalid_expiry_date");
 const payload={v:VERSION,name:fileName(name),type:String(type||"application/octet-stream").slice(0,110),
  decisionId,expiresOn:expiresOn||"",createdAt:new Date().toISOString(),data:b64(bytes)};
 const salt=cryptoRef.getRandomValues(new Uint8Array(16)),iv=cryptoRef.getRandomValues(new Uint8Array(12));
 const key=await keyFor(password,salt,cryptoRef);
 const cipher=await cryptoRef.subtle.encrypt({name:"AES-GCM",iv},key,enc.encode(JSON.stringify(payload)));
 return {format:"SALIC_RADAR_LOCAL_VAULT",version:VERSION,kdf:"PBKDF2-SHA256",iterations:ITERATIONS,cipher:"AES-256-GCM",
  salt:b64(salt),iv:b64(iv),payload:b64(new Uint8Array(cipher))};
}
async function decrypt(envelope,password,cryptoRef){
 if(!cryptoRef?.subtle)throw Error("secure_context_required");
 assertPassword(password);
 if(!envelope||envelope.format!=="SALIC_RADAR_LOCAL_VAULT"||envelope.version!==VERSION||
    envelope.kdf!=="PBKDF2-SHA256"||envelope.cipher!=="AES-256-GCM"||envelope.iterations!==ITERATIONS)throw Error("invalid_envelope");
 const salt=un64(envelope.salt),iv=un64(envelope.iv),cipher=un64(envelope.payload);
 if(salt.length!==16||iv.length!==12||cipher.length<16||cipher.length>MAX_ENVELOPE)throw Error("invalid_encrypted_document");
 const key=await keyFor(password,salt,cryptoRef);
 // AES-GCM authentication failure throws; never release partial plaintext.
 const raw=await cryptoRef.subtle.decrypt({name:"AES-GCM",iv},key,cipher);
 const payload=JSON.parse(dec.decode(raw));
 if(payload.v!==VERSION||typeof payload.name!=="string"||typeof payload.data!=="string"||
  typeof payload.decisionId!=="string"||typeof payload.expiresOn!=="string")throw Error("invalid_payload");
 const bytes=un64(payload.data);
 if(!bytes.length||bytes.length>MAX_BYTES)throw Error("invalid_file_size");
 return {name:fileName(payload.name),type:String(payload.type||"application/octet-stream").slice(0,110),
  decisionId:payload.decisionId,expiresOn:payload.expiresOn,createdAt:payload.createdAt,bytes};
}
const api={encrypt,decrypt,fileName,MAX_BYTES,ITERATIONS,VERSION};
if(typeof module==="object"&&module.exports)module.exports=api;
if(root)root.SRadarLocalVault=api;
})(typeof window!=="undefined"?window:null);
