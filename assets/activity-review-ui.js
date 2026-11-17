/* Browser-only code matching: no document upload, cookies or persistence. */
(()=>{
"use strict";
const core=window.SalicActivityReview;
if(!core)return;
const $=id=>document.getElementById(id);
const make=(tag,value)=>{
  const el=document.createElement(tag);
  if(value!==undefined&&value!==null)el.textContent=String(value);
  return el;
};
let inputs=null,lastReport=null;
function clearResults(){
 lastReport=null;
 $("results").hidden=true;
 for(const id of ["n-codes","n-matched","n-new","n-decisions"])$(id).textContent="—";
 $("activity-rows").replaceChildren();
 $("reference-only").replaceChildren();
 $("decision-rows").replaceChildren();
 $("download").disabled=true;
}
function status(message,isError=false){
 $("status").textContent=message;
 $("status").classList.toggle("error",isError);
}
function trustedLink(value){
 const url=core.safeOfficial(value);
 if(!url)return make("span","يلزم تحقق رسمي");
 const a=make("a","وزارة الموارد البشرية");
 a.href=url;a.target="_blank";a.rel="noopener noreferrer";a.referrerPolicy="no-referrer";
 return a;
}
function render(report){
 $("n-codes").textContent=report.inputCodes.toLocaleString("en-US");
 $("n-matched").textContent=report.matchedReference.toLocaleString("en-US");
 $("n-new").textContent=report.newOrUnknown.toLocaleString("en-US");
 $("n-decisions").textContent=report.decisions.length.toLocaleString("en-US");
 const rows=document.createDocumentFragment();
 report.listed.forEach(rec=>{
  const tr=make("tr");
  [rec.code,rec.title||"غير موجودة في القائمة القديمة",
   rec.referenceStatus==="matches_unverified_salic_list"?"موجود في القائمة السابقة غير المعتمدة":"غير موجود في القائمة السابقة"
  ].forEach(value=>tr.append(make("td",value)));
  rows.append(tr);
 });
 $("activity-rows").replaceChildren(rows);
 const missing=document.createDocumentFragment();
 report.unlistedReference.forEach(rec=>{
  const tr=make("tr");
  tr.append(make("td",rec.code),make("td",rec.title));
  missing.append(tr);
 });
 $("reference-only").replaceChildren(missing);
 const decisions=document.createDocumentFragment();
 report.decisions.forEach(rec=>{
  const tr=make("tr");
  const title=make("td",rec.title);
  const codes=make("td",rec.requiredCodes.length?rec.requiredCodes.join("، "):"لم يثبت رمز نشاط محدد في السجل");
  const explain=make("td",rec.rationale);
  const link=make("td");link.append(trustedLink(rec.referenceUrl));
  tr.append(title,codes,explain,link);decisions.append(tr);
 });
 $("decision-rows").replaceChildren(decisions);
 $("results").hidden=false;
 $("download").disabled=false;
}
function run(){
 clearResults();
 try{
  const parsed=core.parseCodes($("codes").value);
  if(parsed.hasProblems){
   status("توجد "+parsed.invalidPositions.length+" قيمة غير صالحة؛ أدخل رموز نشاط مكونة من 6 أرقام فقط، بدون أسماء أو أرقام سجلات. لم تُحسب أي نتيجة.",true);
   return;
  }
  if(!parsed.codes.length){
   status("أدخل رمز نشاط واحدًا على الأقل لبدء المقارنة.",true);
   return;
  }
  lastReport=core.review({codes:parsed.codes,...inputs});
  render(lastReport);
  status("اكتملت المقارنة محليًا لـ "+parsed.codes.length+" رمزًا فريدًا. "+
   (parsed.duplicates.length?"تجاهلنا "+parsed.duplicates.length+" تكرارًا. ":"")+
   "لم نعتمد صحة السجل التجاري أو الترخيص أو شمول القرار.");
 }catch{
  clearResults();
  status("تعذر إتمام الفحص. تحقق من عدد الرموز وصيغتها، ولا تدخل بيانات شخصية أو أرقام سجلات.",true);
 }
}
function localDownload(){
 if(!lastReport)return;
 const csv=core.exportCsv(lastReport);
 const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
 const url=URL.createObjectURL(blob);
 const a=document.createElement("a");
 a.href=url;a.download="salic-activity-codes-local-review.csv";
 document.body.append(a);a.click();a.remove();
 URL.revokeObjectURL(url);
}
async function init(){
 try{
  const paths=["data/salic-activities.json","data/decisions.json","data/salic-applicability.json"];
  const data=await Promise.all(paths.map(async path=>{
   const res=await fetch(path,{cache:"no-store"});
   if(!res.ok)throw Error("Data source unavailable");
   return res.json();
  }));
  inputs={activities:data[0],decisions:data[1],applicability:data[2]};
  $("compare").disabled=false;
  $("clear").disabled=false;
  $("compare").addEventListener("click",run);
  $("clear").addEventListener("click",()=>{
   $("codes").value="";
   clearResults();
   status("مسحت المدخلات والنتائج من الصفحة.");
  });
  $("download").addEventListener("click",localDownload);
  status("المراجع جاهزة. القائمة السابقة تحتوي "+data[0].activities.length+
   " رمز نشاط مدرجًا بدون اعتماد رسمي. الصق الرموز المراد فحصها.");
 }catch{
  status("تعذّر تحميل ملفات المراجعة. لم نتحقق من أي رمز نشاط؛ جرّب فتح الصفحة بعد عودة الاتصال.",true);
 }
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
else init();
})();
