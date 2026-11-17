/* Private document encryption/decryption in memory; no uploads, no persistence. */
(()=>{
"use strict";
const core=window.SRadarLocalVault;
if(!core)return;
const $=id=>document.getElementById(id);
let decrypted=null;
function message(id,value,bad=false){
 const x=$(id);x.className="status"+(bad?" error":"");x.textContent=value;
}
function download(bytes,name,type){
 const blob=new Blob([bytes],{type:type||"application/octet-stream"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function clearOpen(){
 decrypted=null;
 $("decrypted-details").hidden=true;
 $("decrypted-meta").textContent="";
 $("decrypt-password").value="";
}
async function encryptFile(){
 const file=$("encrypt-file").files?.[0],
  pass=$("encrypt-password").value,confirm=$("encrypt-confirm").value;
 if(!file||file.size>core.MAX_BYTES||file.size===0){message("encrypt-status","اختر ملفًا غير فارغ بحجم لا يتجاوز 2 MB.",true);return}
 if(pass.length<12||pass.length>200||pass!==confirm){message("encrypt-status","كلمة المرور يجب أن تكون 12 حرفًا على الأقل وأن تطابق التأكيد.",true);return}
 $("encrypt-run").disabled=true;
 try{
  if(!window.isSecureContext||!crypto?.subtle)throw Error("missing_webcrypto");
  const bytes=new Uint8Array(await file.arrayBuffer());
  const envelope=await core.encrypt({
    bytes,name:file.name,type:file.type,decisionId:$("encrypt-decision").value,
    expiresOn:$("encrypt-expiry").value,password:pass
  },crypto);
  download(JSON.stringify(envelope),core.fileName(file.name)+".radarvault","application/octet-stream");
  message("encrypt-status","تم تشفير المستند وتنزيل النسخة المشفرة. احتفظ بكلمة المرور في مكان آمن مستقل عن الملف. لم يُرسل أي محتوى إلى الرادار.");
  $("encrypt-file").value="";
  $("encrypt-password").value="";
  $("encrypt-confirm").value="";
 }catch{
  message("encrypt-status","تعذر إتمام التشفير. تحقق من استخدام HTTPS ومن حجم الملف وكلمة المرور.",true);
 }finally{$("encrypt-run").disabled=false}
}
async function decryptFile(){
 const file=$("decrypt-file").files?.[0],pass=$("decrypt-password").value;
 clearOpen(); // resets password; retain entered password from variable above
 if(!file||!pass){message("decrypt-status","حدد ملفًا مشفرًا وكلمة مروره.",true);return}
 if(file.size>4*1024*1024||file.size===0){message("decrypt-status","حجم الملف المشفر غير صالح.",true);return}
 $("decrypt-run").disabled=true;
 try{
  if(!window.isSecureContext||!crypto?.subtle)throw Error("missing_webcrypto");
  const env=JSON.parse(await file.text());
  decrypted=await core.decrypt(env,pass,crypto);
  const expiry=decrypted.expiresOn?" · مراجعة حتى: "+decrypted.expiresOn:"";
  const related=decrypted.decisionId?" · القرار: "+decrypted.decisionId:"";
  $("decrypted-meta").textContent="الاسم: "+decrypted.name+
    " · الحجم: "+decrypted.bytes.length.toLocaleString("en-US")+" بايت"+
    related+expiry+". فك التشفير تم داخل هذا المتصفح.";
  $("decrypted-details").hidden=false;
  message("decrypt-status","نجح التحقق من كلمة المرور وسلامة الملف المشفر. يمكن تنزيل النسخة الأصلية الآن.");
 }catch{
  decrypted=null;
  message("decrypt-status","تعذر فتح الملف: قد تكون كلمة المرور غير صحيحة أو الملف تالفًا أو ليس بصيغة الخزنة. لم تُستخرج أي بيانات.",true);
 }finally{$("decrypt-run").disabled=false;$("decrypt-password").value=""}
}
async function init(){
 $("encrypt-run").addEventListener("click",encryptFile);
 $("decrypt-run").addEventListener("click",decryptFile);
 $("decrypted-save").addEventListener("click",()=>{
  if(!decrypted)return;
  download(decrypted.bytes,decrypted.name,decrypted.type);
  message("decrypt-status","نُزّل المستند الأصلي محليًا. امسح النسخة المفتوحة بعد الانتهاء.");
 });
 $("decrypted-clear").addEventListener("click",()=>{
  clearOpen();$("decrypt-file").value="";
  message("decrypt-status","مُسحت النسخة المفتوحة من حالة الصفحة. ملاحظة: قد يحتفظ المتصفح بنسخ مؤقتة خارج تحكم الموقع.");
 });
 try{
  const res=await fetch("data/decisions.json",{cache:"no-store"});
  if(!res.ok)return;
  const j=await res.json();if(!Array.isArray(j.decisions))return;
  const frag=document.createDocumentFragment();
  for(const d of j.decisions){
   if(!/^[a-z0-9-]{1,64}$/i.test(d.id||""))continue;
   const opt=document.createElement("option");opt.value=d.id;opt.textContent=d.title||d.id;frag.append(opt);
  }
  $("encrypt-decision").append(frag);
 }catch{
  message("encrypt-status","تعذر تحميل قائمة القرارات، لكن يمكن تشفير المستند دون ربطه بقرار.");
 }
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
