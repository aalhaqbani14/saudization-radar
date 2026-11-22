/* SALIC occupational-code evidence reconciliation, using aggregate titles only.
 * A ministry-guide code identifies a target profession, not the code registered
 * to an individual employee. Never assert legal compliance or Qiwa verification.
 */
(function(root){
"use strict";
const STATUSES=["guide_exact","catalog_partial","archive_only","unmapped"];
function normalize(value){
 return String(value??"").normalize("NFKC").trim()
 .replace(/[إأآٱ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه")
 .replace(/[\u064b-\u065f\u0670ـ]/g,"").replace(/\s+/g," ").toLowerCase();
}
function safeSource(u){
 try{
  const x=new URL(String(u||""));
  if(x.protocol!=="https:"||x.username||x.password)return null;
  return x.hostname==="hrsd.gov.sa"||x.hostname.endsWith(".hrsd.gov.sa")||
   x.hostname==="quality.kku.edu.sa"?x.href:null;
 }catch{return null;}
}
function validate(db){
 if(db?.schemaVersion!==1||!Array.isArray(db.items)||!db.summary||!STATUSES.every(x=>db.summary.byStatus?.[x]))throw Error("invalid_crosswalk");
 const titles=new Set();let employees=0,saudis=0;
 for(const r of db.items){
  if(!r||typeof r.title!=="string"||!r.title.trim()||titles.has(normalize(r.title))||
   !Number.isInteger(r.total)||!Number.isInteger(r.saudi)||!Number.isInteger(r.nonSaudi)||
   r.total!==r.saudi+r.nonSaudi||r.total<0||r.saudi<0||r.nonSaudi<0||
   !STATUSES.includes(r.status)||!Array.isArray(r.candidateCodes)||r.recordedQiwaCode!==null||
   r.qiwaConfirmed!==false||r.regulatoryApplicability!=="needs_person_and_entity_verification")throw Error("unsafe_crosswalk_row");
  titles.add(normalize(r.title));employees+=r.total;saudis+=r.saudi;
  for(const c of r.candidateCodes){
   if(!/^\d{6}$/.test(String(c.code||""))||!Array.isArray(c.sourceUrls)||
    !c.sourceUrls.every(x=>safeSource(x))||!Array.isArray(c.guideDecisionIds))throw Error("invalid_candidate_source");
  }
  if(r.status==="unmapped"&&(r.referenceCode!==null||r.candidateCodes.length))throw Error("unmapped_assigned_code");
  if(r.status==="guide_exact"&&!r.candidateCodes.some(c=>c.matchesGuide&&c.code===r.referenceCode))throw Error("guide_code_not_sourced");
 }
 if(db.summary.titles!==titles.size||db.summary.totalEmployees!==employees||db.summary.saudi!==saudis||
  db.summary.nonSaudi!==employees-saudis||db.summary.employeeCodesVerified!==0)throw Error("summary_mismatch");
 for(const status of STATUSES){
  const rows=db.items.filter(r=>r.status===status);
  if(rows.length!==db.summary.byStatus[status].titles||rows.reduce((a,x)=>a+x.total,0)!==db.summary.byStatus[status].employees)throw Error("status_mismatch");
 }
 return true;
}
function filter(db,{status="all",query=""}={}){
 validate(db);
 const q=normalize(query);
 return db.items.filter(x=>(status==="all"||x.status===status)&&
  (!q||normalize(x.title).includes(q)||x.candidateCodes.some(c=>c.code.includes(q))||
    x.candidateCodes.some(c=>c.guideDecisionIds.some(g=>normalize(g).includes(q)))));
}
function csvSafe(value){
 let v=String(value??"");
 if(/^[\s\u200e\u200f]*[=+\-@]/.test(v))v="'"+v;
 return '"'+v.replace(/"/g,'""')+'"';
}
function exportCsv(db,rows){
 validate(db);
 if(!Array.isArray(rows)||rows.some(r=>!db.items.includes(r)))throw Error("unknown_export_rows");
 const table=[
 ["المسمى في SALIC","عدد الموظفين","السعوديون","غير السعوديين","الرمز المرجعي","حالة المطابقة","قرار دليل التوطين","رمز موظف قوى مؤكد","مصدر رسمي/تاريخي","ملاحظة"],
 ...rows.map(r=>[r.title,r.total,r.saudi,r.nonSaudi,r.referenceCode||"",r.status,
  [...new Set(r.candidateCodes.flatMap(c=>c.guideDecisionIds))].join(" ؛ "),"لا",
  [...new Set(r.candidateCodes.flatMap(c=>c.sourceUrls))].join(" ؛ "),r.guidance])
 ];
 return "\uFEFF"+table.map(row=>row.map(csvSafe).join(",")).join("\r\n")+"\r\n";
}
const api={validate,filter,exportCsv,safeSource,normalize,STATUSES};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
if(root)root.SalicCodeCrosswalk=api;
})(typeof window!=="undefined"?window:null);
