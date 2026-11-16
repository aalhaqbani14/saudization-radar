/* Cross-workstream readiness: read-only, aggregate only, zero regulatory verdicts.
 * No network writes; does not persist uploaded employee data.
 */
(function(root){
"use strict";
const WORKSTREAMS=Object.freeze([
 {id:"audit",title:"تدقيق القرارات الوزارية",owner:"الخدمات الحكومية والالتزام",action:"تدقيق الجداول والرموز والاستثناءات للقرارات المعلقة"},
 {id:"catalog",title:"التحقق من الرموز المهنية",owner:"الخدمات الحكومية",action:"مطابقة الرموز التاريخية بأحدث تصنيف معتمد وبقوى"},
 {id:"qiwa",title:"مطابقة موظفي سالك وقوى",owner:"الموارد البشرية والخدمات الحكومية",action:"تحديث قائمة الموظفين ورمز قوى والأجر والاعتماد بالمعالجة المحلية"},
 {id:"activity",title:"تدقيق الأنشطة والترخيص",owner:"الخدمات الحكومية والشؤون القانونية",action:"مطابقة الأنشطة المرخصة والفرع والنشاط الفعلي"},
 {id:"gap",title:"حاسبة الفجوات والسيناريوهات",owner:"الموارد البشرية",action:"إعادة الحساب لكل قرار بعد إثبات الأدلة المطلوبة، دون جمع نطاقات متداخلة"},
 {id:"report",title:"التقارير التنفيذية وفترات السماح",owner:"الخدمات الحكومية",action:"توحيد المؤشرات مع مصادرها وتواريخ اللقطة وأسباب عدم اليقين"},
 {id:"plans",title:"خمس خطط معالجة نظامية",owner:"الموارد البشرية والإدارات المعنية",action:"التحقق من التوظيف والإحلال الفعلي والتأهيل والمتابعة"},
 {id:"advisor",title:"المساعد الاسترشادي للقرارات",owner:"الخدمات الحكومية",action:"تقديم توصيات قراءة فقط، دون صلاحية تعديل أو تغيير على الأنظمة"},
 {id:"quality",title:"التحقق الفني والأمن والأداء",owner:"إدارة المشروع",action:"تشغيل اختبارات القواعد وخصوصية البيانات وسرعة التحميل"}
]);
const PLANS=Object.freeze([
 {id:"admin",name:"المهن الإدارية المساندة",steps:["مطابقة الرموز في قوى بما فيها مساعد إداري","تثبيت العدد والمرحلة ذات الصلة من الدليل","استعراض فرص التوظيف السعودي أو الإحلال الحقيقي","مراجعة أثر العملية الفعلية بعد التنفيذ"]},
 {id:"accounting",name:"المهن المحاسبية",steps:["مطابقة الرموز المحاسبية واشتراطات المرحلة والعدد","فحص الاعتماد والأجر المحتسب محليًا","استقطاب أو تأهيل كوادر سعودية مستوفية للشروط","توثيق الأثر بمراجعة مستقلة"]},
 {id:"procurement",name:"المشتريات والعقود",steps:["التحقق من الرموز الاثني عشر المشمولة حسب الدليل","التأكد من حد العدد وطريقة التقريب","خطة توظيف أو تأهيل حسب المهام الحقيقية","إعادة فحص النسبة عند اكتمال الدليل والأعداد"]},
 {id:"project",name:"إدارة المشاريع",steps:["تحديد المهن المستهدفة الثلاث برموز قوى","التحقق من مرحلة التطبيق القادمة بتاريخ 2027-02-14","إعداد احتياج السعوديين قبل النفاذ","التحقق من المسميات والمهام والاعتماد قبل احتساب الأثر"]},
 {id:"ict",name:"تقنية المعلومات",steps:["فصل مجموعات التقنية الثلاث كما في القرار","مطابقة رمز كل موظف بالمجموعة الصحيحة","فحص حد العدد والأجر لكل مجموعة مستقلة","استقطاب أو تأهيل وقياس كل مجموعة دون دمج النسب"]}
]);
const safeArray=x=>Array.isArray(x)?x:[];
function norm(value){return String(value??"").normalize("NFKC").trim().toLowerCase().replace(/[أإآٱ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/[\u064b-\u065f\u0670ـ]/g,"").replace(/\s+/g," ")}
function validOfficialLink(value){
 try{const u=new URL(String(value||""));return u.protocol==="https:"&&(u.hostname==="hrsd.gov.sa"||u.hostname.endsWith(".hrsd.gov.sa"))&&!u.username&&!u.password}
 catch{return false}
}
function extractPending(decisions, applicability){
 const cases=new Map(safeArray(applicability?.decisions).map(x=>[x.id,x]));
 return safeArray(decisions?.decisions).filter(d=>d.audit?.status!=="reviewed").map(d=>{
  const category=cases.get(d.id);
  const checks=[...new Set([...safeArray(d.focus),...safeArray(category?.checks)])].filter(v=>typeof v==="string"&&v.trim());
  return {
   id:d.id,title:d.title,number:d.number||"غير مثبت",effective:d.effective||null,
   rate:d.rate||"حسب الدليل",source:validOfficialLink(d.source)?d.source:null,
   secondary:validOfficialLink(d.source2)?d.source2:null,
   gate:category?.gate||"requires_review",checks,
   limit:d.audit?.limits||"الشروط النظامية والرموز بحاجة إلى توثيق",
   metadataVerified:d.audit?.metadataVerified===true,
   state:"needs_review",kind:"decision"
  };
 });
}
function build({decisions,applicability,activities,workforce,catalog,matching,grace,health}){
 if(!Array.isArray(decisions?.decisions)||!Array.isArray(workforce?.rows)||!Array.isArray(catalog?.items))throw Error("incomplete_readiness_data");
 const audited=decisions.decisions.filter(x=>x.audit?.status==="reviewed").length;
 const pending=extractPending(decisions,applicability);
 const counts=workforce.summary||{};
 if(!Number.isInteger(counts.total)||!Number.isInteger(counts.saudi)||!Number.isInteger(counts.nonSaudi)||counts.saudi+counts.nonSaudi!==counts.total)throw Error("invalid_workforce_snapshot");
 const catalogCount=catalog.items.length;
 const historical=catalog.items.filter(x=>x.sourceTier==="official_gastat_2019").length;
 const groups=safeArray(matching?.decisions);
 const checkedCodes=groups.reduce((sum,d)=>sum+safeArray(d.matchedRoles).filter(r=>r.employeeQiwaCodeVerified===true).length,0);
 const activityCodes=safeArray(activities?.activities).filter(x=>/^\d{6}$/.test(String(x.code||""))).map(x=>String(x.code));
 const activityVerified=activities?.verificationStatus==="official_cr_license_verified";
 const workforceFresh=typeof workforce.asOf==="string"&&workforce.asOf.length===10;
 const reportGraces=safeArray(grace?.records);
 const lines=[
  {id:"audit",state:pending.length?"needs_review":"ready_for_recheck",value:audited+"/"+decisions.decisions.length,detail:pending.length+" قرارات ما زالت تحتاج تدقيق الجداول والنطاق"},
  {id:"catalog",state:catalog.status==="official_group_pages_verified"?"reference_ready":"needs_review",value:String(catalogCount),detail:"منها "+historical+" رمزًا تاريخيًا غير مستبدل بمصدر أحدث؛ ليست جميع الرموز مثبتة لـ2026"},
  {id:"qiwa",state:"awaiting_external_evidence",value:counts.total+" موظفًا",detail:"لقطة "+workforce.asOf+"؛ لا توجد مطابقة فردية موثقة برموز قوى في الملف العام"},
  {id:"activity",state:activityVerified?"requires_scope_review":"awaiting_external_evidence",value:activityCodes.length+" نشاطًا مُدرجًا",detail:activityVerified?"يجب التحقق من انطباق كل قرار":"الأنشطة مدخلة من قائمة غير متحقق منها رسميًا"},
  {id:"gap",state:"estimates_only",value:"استرشادي",detail:"الحاسبة موجودة؛ الفجوة لا تُعتمد قبل مطابقة الرموز والمراحل وشروط القرار"},
  {id:"report",state:"estimates_only",value:reportGraces.length+" فترات",detail:"توفر سجل فترات السماح؛ التقارير مبنية على بيانات "+workforce.asOf+" مع حدود الدقة"},
  {id:"plans",state:"proposals_only",value:PLANS.length+" خطط",detail:"اقتراحات عملية تحتاج تكليفًا ومراجعة وتنفيذًا فعليًا"},
  {id:"advisor",state:"read_only",value:"قراءة فقط",detail:"مساعد قواعد استرشادي؛ لا يغير حسابات الموظفين أو القرارات"},
  {id:"quality",state:"verification_required",value:"اختبارات",detail:"الاختبارات الآلية تثبت سلامة الشيفرة والبيانات المحددة، لا اعتمادًا حكوميًا"}
 ];
 return {
  workforce:{...counts,asOf:workforce.asOf,source:workforce.source||"",freshnessKnown:workforceFresh},
  decisions:{total:decisions.decisions.length,audited,pending:pending.length,entries:pending},
  catalog:{total:catalogCount,historical,archiveYear:catalog.archive?.referenceYear||null,status:catalog.status},
  activity:{count:activityCodes.length,verified:activityVerified,codes:activityCodes},
  matching:{guideGroups:groups.length,employeeQiwaVerificationCount:checkedCodes},
  grace:{count:reportGraces.length,official:reportGraces.filter(x=>x.status==="official").length},
  scan:{checkedAt:health?.checked_at||null,total:health?.total_sources||0,successful:health?.successful_sources||0},
  workstreams:lines.map(item=>({...WORKSTREAMS.find(x=>x.id===item.id),...item})),
  plans:PLANS
 };
}
function crosswalk(workforce,catalog){
 if(!Array.isArray(workforce?.rows)||!Array.isArray(catalog?.items))throw Error("invalid_crosswalk_inputs");
 const index=new Map();
 for(const r of catalog.items){
  if(!/^\d{5,6}$/.test(String(r.code))||typeof r.title!=="string")continue;
  const k=norm(r.title);if(!k)continue;
  if(!index.has(k))index.set(k,[]);
  index.get(k).push(r);
 }
 const rank={official_group_pages:0,official_group_first_page:1,decision_guide:2,official_gastat_2019:3};
 const records=workforce.rows.map(r=>{
  const [title,total,saudi]=r;
  const unique=[...new Map((index.get(norm(title))||[]).map(x=>[String(x.code),x])).values()]
   .sort((a,b)=>(rank[a.sourceTier]??9)-(rank[b.sourceTier]??9)||a.code.localeCompare(b.code));
  return {title,total,saudi,candidates:unique.map(x=>({code:x.code,sourceTier:x.sourceTier})),
   status:unique.length===0?"no_match":unique.length===1?"candidate_only":"ambiguous"};
 });
 return {total:records.length,candidates:records.filter(x=>x.status==="candidate_only").length,
  ambiguous:records.filter(x=>x.status==="ambiguous").length,
  missing:records.filter(x=>x.status==="no_match").length,records};
}
function number(value,label){
 if(!/^(0|[1-9]\d{0,5})$/.test(String(value)))throw Error("invalid_"+label);
 const n=Number(value);if(!Number.isSafeInteger(n)||n>100000)throw Error("invalid_"+label);return n;
}
function simulateCompany({total,saudi,hire=0,replace=0,train=0}){
 const beforeTotal=number(total,"total"),beforeSaudi=number(saudi,"saudi");
 const h=number(hire,"hire"),r=number(replace,"replace"),t=number(train,"train");
 if(beforeSaudi>beforeTotal||r>beforeTotal-beforeSaudi||t>beforeSaudi+h+r)throw Error("invalid_scenario_scope");
 const afterTotal=beforeTotal+h,afterSaudi=beforeSaudi+h+r;
 return {before:{total:beforeTotal,saudi:beforeSaudi,other:beforeTotal-beforeSaudi,percent:beforeTotal?100*beforeSaudi/beforeTotal:null},
         after:{total:afterTotal,saudi:afterSaudi,other:afterTotal-afterSaudi,percent:afterTotal?100*afterSaudi/afterTotal:null},
         training:t,notice:"محاكاة لتركيبة القوى العاملة فقط. التدريب لا يغيّر الجنسية أو نسبة السعوديين بذاته؛ الأثر النظامي يخضع لشروط القرار، ولا يوجد تغيير فعلي للموظفين."};
}
const api={WORKSTREAMS,PLANS,norm,validOfficialLink,extractPending,build,crosswalk,simulateCompany};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
if(root)root.RadarCompletion=api;
})(typeof window!=="undefined"?window:null);
