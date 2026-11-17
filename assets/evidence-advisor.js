/* Evidence-gated occupational advisor. Pure, read-only, aggregate-only.
 * Never infers final applicability or compliant/noncompliant from title or activity hints.
 * The output is advice for human verification, not AI-generated legal determinations.
 */
(function(root){
"use strict";
const GATES=new Set(["occupation","workforce_excluded","facility","licensed_activity","activity_or_occupation","tasks","regional_activity"]);
const publicLink=value=>{
 try{
  const u=new URL(String(value||""));
  if(u.protocol!=="https:"||u.username||u.password)return null;
  if(u.hostname!=="hrsd.gov.sa"&&!u.hostname.endsWith(".hrsd.gov.sa"))return null;
  return u.href;
 }catch{return null}
};
const safeArray=x=>Array.isArray(x)?x:[];
function daysSince(snapshot,today){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(snapshot||""))||!/^\d{4}-\d{2}-\d{2}$/.test(String(today||"")))return null;
 const a=Date.parse(snapshot+"T00:00:00Z"),b=Date.parse(today+"T00:00:00Z");
 return Number.isFinite(a)&&Number.isFinite(b)?Math.max(0,Math.round((b-a)/86400000)):null;
}
function stageHints(d,today){
 const rows=[];
 for(const stage of safeArray(d.history)){
  if(stage.verified!==true||!/^\d{4}-\d{2}-\d{2}$/.test(stage.date||"")||stage.date<today)continue;
  if(!publicLink(stage.source))continue;
  rows.push({date:stage.date,rate:String(stage.rate||""),label:stage.label||"مرحلة تطبيق",source:publicLink(stage.source),kind:"source_verified_history"});
 }
 // Pending audit dates are NOT promoted to verified just because they occur in d.effective.
 const keys=new Set();
 return rows.filter(x=>{const key=x.date+"|"+x.label;if(keys.has(key))return false;keys.add(key);return true})
 .sort((a,b)=>a.date.localeCompare(b.date));
}
function aggregateSnapshot(workforce){
 const summary=workforce?.summary;
 if(!Array.isArray(workforce?.rows)||!summary||!Number.isInteger(summary.total)||!Number.isInteger(summary.saudi)||!Number.isInteger(summary.nonSaudi)||summary.total!==summary.saudi+summary.nonSaudi)throw Error("invalid_workforce_summary");
 return {total:summary.total,saudi:summary.saudi,nonSaudi:summary.nonSaudi,asOf:workforce.asOf};
}
function build({decisions,applicability,activities,workforce,pdfSources,grace,model,today}){
 if(!Array.isArray(decisions?.decisions)||!Array.isArray(applicability?.decisions)||!Array.isArray(activities?.activities)||!Array.isArray(pdfSources?.sources)||!model||typeof model.group!=="function"||typeof model.names!=="object"||!today)throw Error("invalid_advisor_inputs");
 const snapshot=aggregateSnapshot(workforce);
 const eligibility=safeArray(applicability.decisions),eligibilityMap=new Map(eligibility.map(x=>[x.id,x]));
 const docs=new Map(pdfSources.sources.map(x=>[x.id,x]));
 const graces=safeArray(grace?.records);
 const records=decisions.decisions.map((d)=>{
  const gate=eligibilityMap.get(d.id)||{
   id:d.id,gate:"undetermined",summary:"قرار جديد؛ يجب تحديد شروط انطباقه قبل احتساب أي فجوة.",
   checks:["قراءة الدليل المعتمد ومطابقة المهن والأنشطة المسجلة"]
  };
  const group=model.names[d.id]?model.group(d.id):null;
  const officialCounter=typeof model.official==="function"?model.official(d.id):null;
  const preview=group&&group.total>0?{total:group.total,saudi:group.saudi,other:group.other,status:group.status,needed:group.needed,gap:group.gap}:null;
  const guide=docs.get(d.id);
  const canReadPdf=!!(guide&&publicLink(guide.url));
  const guideState=d.audit?.pdfMonitoring||"";
  const docState=guideState==="restricted_document_not_copied"?"restricted_manual_review":
     guideState==="published_draft_not_final"||canReadPdf&&/مسودة/.test(guide.title)?"published_draft":
     canReadPdf?"public_guide_monitored":"guide_not_in_public_monitor";
  let relation;
  if(gate.gate==="workforce_excluded"){
    relation="مستبعد من مطابقة المسميات الحالية فقط، وليس مستبعدًا نظاميًا";
  }else if(preview){
    relation="صلة محتملة بالمسميات في لقطة الموظفين، لا تثبت شمول الرموز";
  }else if(GATES.has(gate.gate)){
    relation="الانطباق غير محدد، وتلزم بيانات النشاط أو الرمز أو الموقع";
  }else relation="قرار يحتاج إضافة شروط فحص قبل ربطه بسالك";
  const tests=[...new Set(safeArray(gate.checks).concat(safeArray(d.focus)).filter(x=>typeof x==="string"&&x.trim().length>5))];
  const tasks=[
    {id:"guide",text:docState==="restricted_manual_review"?"مراجعة الدليل المقيّد عبر الجهة المخولة دون نسخ محتواه علنًا":docState==="published_draft"?"الحصول على دليل معتمد بدل المسودة قبل تطبيق شروطها":"الرجوع لنص الدليل الساري وإثبات جدول النسب والرموز والاستثناءات",status:"requires_human_evidence"},
    {id:"qiwa",text:"مطابقة الرمز المهني الحقيقي لكل موظف في قوى، ومراجعة الأجر والاعتماد عند الاشتراط",status:"requires_private_records"},
    {id:"activity",text:gate.gate==="regional_activity"?"تأكيد الموقع الفعلي والفرع والأنشطة المرخصة في المنطقة المستهدفة":gate.gate==="facility"?"تأكيد المنشأة المستهدفة ونوع السكن وعدد المستفيدين وفق الدليل":"تأكيد نشاط وترخيص سالك للكيان والفرع والمهام الفعلية إن اشترط القرار",status:"requires_official_registration"},
    {id:"phase",text:"تحديد المرحلة وتاريخ النفاذ وفترة السماح والتداخل بين القرارات من المصدر",status:"requires_legal_review"}
  ];
  const graceRecords=graces.filter(x=>x.decisionId===d.id).map(x=>({
    scope:String(x.scope||""),status:String(x.status||"unverified"),
    duration:String(x.duration||""),source:publicLink(x.source)
  }));
  const markedReviewed=d.audit?.status==="reviewed";
  const preliminaryGap=preview&&Number.isInteger(preview.gap)&&preview.gap>=0?preview.gap:null;
  const advice=preliminaryGap!==null&&preliminaryGap>0?
    "إذا ثبت شمول الرموز وشروط القرار، ادرس التوظيف السعودي أو الإحلال الفعلي بعد مراجعة تكلفة التأهيل والمهام؛ الفجوة " + preliminaryGap + " مجرد سيناريو من المسميات وليست مخالفة.":
    preview&&preview.status==="future"?
    "التحضير للمرحلة القادمة وتدقيق الرموز والأجور قبل سريانها، دون تصنيف الوضع الحالي كمخالفة.":
    preview?
    "استكمل مطابقة رموز قوى والحد الأدنى وتقسيم المجموعات؛ لا يثبت غياب فجوة حسابية امتثال الشركة.":
    "لا تُستنتج عدم قابلية التطبيق من غياب مسمى في لقطة الموظفين. تحقق من الترخيص والرموز والنطاق أولًا.";
  const rank=preview&&preliminaryGap>0?1:preview?2:gate.gate==="workforce_excluded"?4:3;
  return {
    id:d.id,title:d.title,number:d.number||d.latestDecisionNumber||"غير مثبت",rate:d.rate||"وفق الدليل",
    auditStatus:markedReviewed?"reviewed":"needs_review",auditNote:d.audit?.limits||"لم يكتمل تدقيق التفاصيل",
    metadataVerified:d.audit?.metadataVerified===true,docState,
    source:publicLink(d.source),guide:canReadPdf?publicLink(guide.url):null,guideTitle:guide?.title||"",
    ruleSource:publicLink(gate.source),gate:gate.gate,relation,
    checks:tests,tasks,proposedAdvice:advice,preview,officialCounter:officialCounter?
      {asOf:officialCounter.asOf,total:officialCounter.total,saudi:officialCounter.saudi,numericGap:officialCounter.numericGap,kind:"dated_ministry_snapshot"}:null,
    graceRecords,upcoming:stageHints(d,today),priority:rank,finalVerdict:false,
    evidenceMissing:{
      employeeQiwa:true,licence:activities.verificationStatus!=="official-verified-complete",
      decisionAudit:!markedReviewed
    }
  };
 });
 const audited=records.filter(x=>x.auditStatus==="reviewed").length;
 return {
  records,stats:{decisions:records.length,audited,pending:records.length-audited,publicGuides:records.filter(x=>x.docState==="public_guide_monitored").length,
   draftGuides:records.filter(x=>x.docState==="published_draft").length,
   restrictedGuides:records.filter(x=>x.docState==="restricted_manual_review").length},
  workforce:snapshot,snapshotAgeDays:daysSince(snapshot.asOf,today),
  activityStatus:activities.verificationStatus,
  disclaimers:[
   "المساعد استرشادي قائم على قواعد واضحة، وليس ذكاءً توليديًا أو حكمًا قانونيًا.",
   "لا تُرفع بيانات موظفين أو هويات أو رواتب، ولا يُنفذ المساعد تغييرات في قوى أو القرارات.",
   "تشابه المسميات أو الأنشطة لا يثبت الانطباق، وغيابه لا يثبت الإعفاء."
  ]
 };
}
const api={build,publicLink,daysSince,stageHints,aggregateSnapshot};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
if(root)root.SalicEvidenceAdvisor=api;
})(typeof window!=="undefined"?window:null);
