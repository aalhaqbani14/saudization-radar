/* Official-register activity *comparison* helper; read-only local processing.
 * A pasted code list has no certified provenance; never declares applicability.
 */
(function(root){
"use strict";
const GATES=new Set(["licensed_activity","regional_activity","facility","activity_or_occupation"]);
const HEADERS=new Set(["code","activity code","activitycode","رمز النشاط","رمز النشاط الاقتصادي","رمز"]);
const arDigits="٠١٢٣٤٥٦٧٨٩",faDigits="۰۱۲۳۴۵۶۷۸۹";
function latinDigits(s){
 return String(s??"").replace(/[٠-٩۰-۹]/g,ch=>{
  const a=arDigits.indexOf(ch);return String(a<0?faDigits.indexOf(ch):a);
 });
}
function sanitize(value){return String(value??"").trim().replace(/^\uFEFF/,"").replace(/^["']|["']$/g,"").trim();}
function normalizeActivityCode(value){
 const v=latinDigits(sanitize(value));
 return /^[0-9]{6}$/.test(v)?v:null;
}
function parseCodes(input){
 if(typeof input!=="string"||input.length>80000)throw Error("invalid_activity_input_size");
 const tokens=input.replace(/\r/g,"\n").split(/[\n,،;\t]+/).map(sanitize);
 if(tokens.length>5000)throw Error("too_many_activity_entries");
 const seen=new Set(),codes=[],invalid=[],duplicates=[];
 for(let i=0;i<tokens.length;i++){
  const value=tokens[i];if(!value)continue;
  if(HEADERS.has(value.toLowerCase()))continue;
  const code=normalizeActivityCode(value);
  if(!code){invalid.push(i+1);continue;}
  if(seen.has(code)){duplicates.push(code);continue;}
  seen.add(code);codes.push(code);
 }
 return {codes,invalidPositions:invalid,duplicates,hasProblems:invalid.length>0};
}
function safeOfficial(url){
 try{const u=new URL(String(url??""));return u.protocol==="https:"&&!u.username&&!u.password&&(u.hostname==="mc.gov.sa"||u.hostname.endsWith(".mc.gov.sa")||u.hostname==="hrsd.gov.sa"||u.hostname.endsWith(".hrsd.gov.sa"))?u.href:null}catch{return null}
}
function review({codes,activities,decisions,applicability,asOf="2026-11-17"}){
 if(!Array.isArray(codes)||!Array.isArray(activities?.activities)||!Array.isArray(decisions?.decisions)||!Array.isArray(applicability?.decisions))throw Error("invalid_activity_sources");
 if(codes.some(v=>typeof v!=="string"||!/^[0-9]{6}$/.test(v)))throw Error("invalid_activity_code");
 const unique=[...new Set(codes)];
 const givenReference=new Map(activities.activities.map(r=>[String(r.code),r]));
 const incoming=new Set(unique);
 const listed=unique.map(code=>({
  code,title:typeof givenReference.get(code)?.name==="string"?givenReference.get(code).name:null,
  referenceStatus:givenReference.has(code)?"matches_unverified_salic_list":"outside_unverified_salic_list"
 }));
 const unlistedReference=activities.activities.filter(x=>!incoming.has(String(x.code))).map(x=>({code:String(x.code),title:String(x.name||"")}));
 const rules=new Map(applicability.decisions.map(x=>[x.id,x]));
 const decisionsNeedingActivity=decisions.decisions.filter(d=>GATES.has(rules.get(d.id)?.gate)).map(d=>{
  const rule=rules.get(d.id);
  const exact=(Array.isArray(d.requiredActivityCodes)?d.requiredActivityCodes:[]).filter(x=>typeof x==="string"&&/^[0-9]{6}$/.test(x));
  const hits=exact.filter(x=>incoming.has(x));
  const candidate=hits.length>0;
  return {
   id:d.id,title:d.title,gate:rule.gate,referenceUrl:safeOfficial(d.source),requiredCodes:exact,
   matchingCodes:hits,reviewStatus:candidate?"exact_code_candidate":"requires_manual_scope_review",
   rationale:candidate?
    "الرمز المحدد في القرار ورد في القائمة المدخلة؛ يلزم إثبات النشاط والترخيص والموقع والكيان قبل الحكم.":
    exact.length?"الرمز المستهدف لم يظهر في هذه القائمة؛ هذا لا يثبت عدم الانطباق أو شمول جميع الفروع.":
    "ليس لدينا رمز نشاط محدد مؤكد لهذا القرار؛ يلزم الاطلاع على النشاط والرخصة والموقع والشروط."
  };
 });
 return {
  asOf,provenance:"self_supplied_codes_not_officially_verified",
  referenceStatus:activities.verificationStatus,
  inputCodes:unique.length,matchedReference:listed.filter(x=>x.referenceStatus==="matches_unverified_salic_list").length,
  newOrUnknown:listed.filter(x=>x.referenceStatus==="outside_unverified_salic_list").length,
  referenceOnly:unlistedReference.length,
  listed,unlistedReference,decisions:decisionsNeedingActivity,
  explicitCandidates:decisionsNeedingActivity.filter(x=>x.reviewStatus==="exact_code_candidate").length,
  finalComplianceVerdict:null,
  verifiedActivityCount:0,
  scopeNotice:"القائمة المدخلة لا تثبت صدور السجل أو سريان الترخيص. التطابق النصي مع رموز الأنشطة غير كافٍ لإثبات انطباق التوطين أو عدم انطباقه."
 };
}
function exportCsv(report){
 if(!report||!Array.isArray(report.listed))throw Error("report_required");
 function safe(s){
  let v=String(s??"");
  if(/^[\s\u200e\u200f]*[=+\-@]/.test(v))v="'"+v;
  return '"'+v.replace(/"/g,'""')+'"';
 }
 const rows=[["رمز النشاط","المسمى المرجعي (غير معتمد)","حالة المقارنة"].map(safe).join(",")];
 for(const x of report.listed){if(!/^[0-9]{6}$/.test(x.code))throw Error("invalid_report_code");
   rows.push([x.code,x.title||"",x.referenceStatus==="matches_unverified_salic_list"?"مطابق للقائمة السابقة غير المعتمدة":"غير موجود في القائمة السابقة"].map(safe).join(","));
 }
 return "\uFEFF"+rows.join("\r\n")+"\r\n";
}
const api={latinDigits,normalizeActivityCode,parseCodes,safeOfficial,review,exportCsv};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
if(root)root.SalicActivityReview=api;
})(typeof window!=="undefined"?window:null);
