/* SALIC decision-scope screening. Read-only evidence tiers, no legal decisions.
 * A title-only match never proves Qiwa code, company activity, location or wage.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.SalicScopeScreen=api;
})(typeof window!=="undefined"?window:null,function(){
"use strict";
const GATES=new Set(["occupation","workforce_excluded","facility","licensed_activity","activity_or_occupation","tasks","regional_activity"]);
const TRUSTED=new Set(["provided-by-user-unverified","official-verified-complete"]);
function compact(v){return String(v||"").trim().replace(/[إأآٱ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/\s+/g," ").toLowerCase()}
function officialUrl(value){
 try{const u=new URL(String(value||""));return u.protocol==="https:"&&/(^|\.)hrsd\.gov\.sa$/i.test(u.hostname)?u.href:null}catch{return null}
}
function validate(registry,decisions,activities,workforce){
 if(!registry||!Array.isArray(registry.decisions)||!decisions||!Array.isArray(decisions.decisions))throw Error("Missing decision and screening registry");
 if(registry.decisions.length!==decisions.decisions.length)throw Error("Every decision must have a scope entry");
 if(!activities||!Array.isArray(activities.activities)||!Array.isArray(workforce?.rows))throw Error("Missing activity or workforce snapshot");
 const ids=new Set(decisions.decisions.map(d=>d.id)),seen=new Set();
 for(const r of registry.decisions){
  if(!ids.has(r.id)||seen.has(r.id)||!GATES.has(r.gate)||!Array.isArray(r.checks)||!r.checks.length||!r.checks.every(x=>typeof x==="string"&&x.length>5))throw Error("Invalid screening record");
  seen.add(r.id);
 }
 if(!TRUSTED.has(activities.verificationStatus))throw Error("Activity evidence status missing");
 return true;
}
function make({registry,decisions,activities,workforce,model}){
 validate(registry,decisions,activities,workforce);
 if(!model||typeof model.group!=="function"||!model.names)throw Error("Missing workforce matching model");
 // The activities list is user-provided and does not certify the completeness
 // of the commercial registration or the existence of licensed branches.
 const activitiesVerified=activities.verificationStatus==="official-verified-complete";
 const records=registry.decisions.map(rule=>{
  const d=decisions.decisions.find(x=>x.id===rule.id);
  const g=model.names[rule.id]?model.group(rule.id):null;
  const linked=g&&g.total>0?g.total:0;
  let status,heading,explanation;
  if(rule.gate==="workforce_excluded"&&d.salicScope?.status==="excluded_from_current_workforce_dashboard"){
   status="out_of_current_snapshot";
   heading="غير مدرج في مطابقة سالك الحالية";
   explanation=rule.summary+" يُعاد فحص القرار عند تغيير بيانات الموظفين أو الأنشطة.";
  }else if(rule.gate==="occupation"&&linked>0){
   status="potential_match";
   heading="صلة مهنية أولية";
   explanation="رُصدت مسميات مرتبطة بالقرار في قائمة الموظفين المجمعة؛ يلزم التأكد من الرموز الفعلية وشروط القرار قبل تأكيد الانطباق.";
  }else{
   status="needs_verification";
   heading=rule.gate==="regional_activity"?"تحقق من الموقع والنشاط":rule.gate==="licensed_activity"?"تحقق من النشاط والترخيص":rule.gate==="facility"?"تحقق من المنشأة وشروطها":rule.gate==="tasks"?"تحقق من المهام المهنية":rule.gate==="activity_or_occupation"?"تحقق من النشاط والمهنة":"تحقق من المهنة والعدد";
   explanation=rule.summary;
  }
  // No automatic final legal determination: verified activity registers are not
  // a substitute for individual occupation codes, regional licenses and phases.
  return {
   id:d.id,title:d.title,number:d.number||d.latestDecisionNumber||"",rate:d.rate||"",
   scope:d.scope||"",source:officialUrl(d.source),auditStatus:d.audit?.status||"needs_review",
   gate:rule.gate,status,heading,explanation,
   matchedTitleEmployees:linked,matchedTitles:g?.list?.map(x=>({title:x.title,total:x.total}))||[],
   checks:rule.checks,activityEvidence:activities.verificationStatus,
   workforceAsOf:workforce.asOf||"",finalVerdict:false,
   note:activitiesVerified?"حتى القائمة الرسمية للأنشطة لا تثبت اكتمال شروط المهنة والفرع.":"قائمة الأنشطة المقدمة غير متحققة رسميًا؛ لا تثبت النشاط المرخص أو غيابه."
  };
 });
 const countBy=key=>records.filter(x=>x.status===key).length;
 return {records,total:records.length,potential:countBy("potential_match"),needsReview:countBy("needs_verification"),outOfCurrent:countBy("out_of_current_snapshot"),confirmedApplicable:0,confirmedNotApplicable:0,
  audited:records.filter(x=>x.auditStatus==="reviewed").length,pendingAudit:records.filter(x=>x.auditStatus!=="reviewed").length,
  snapshot:workforce.asOf,activityEvidence:activities.verificationStatus,
  legalNotice:"نتائج فحص أولي ولا تثبت انطباق قرار أو عدم انطباقه نظاميًا. لا تُحدث بيانات التوطين أو تعدلها تلقائيًا."};
}
return {make,validate,officialUrl,compact};
});
