/* Phase II: auditable, aggregate-only SALIC planning. No write operations.
 * Provisional evidence or occupational-title overlap is not legal applicability.
 */
(function(root){
"use strict";
const arr=x=>Array.isArray(x)?x:[];
const dateOk=x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x||""));
const official=x=>{try{const u=new URL(x);return u.protocol==="https:"&&!u.username&&!u.password&&(u.hostname==="hrsd.gov.sa"||u.hostname.endsWith(".hrsd.gov.sa"))?u.href:null}catch{return null}};
const norm=x=>String(x||"").trim().replace(/[إأآٱ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/[\u064b-\u065f\u0670ـ]/g,"").replace(/\s+/g," ").toLowerCase();
function validate(data){
 if(!Array.isArray(data?.decisions?.decisions)||!Array.isArray(data?.workforce?.rows)||!Array.isArray(data?.applicability?.decisions)||!Array.isArray(data?.guideMatching?.decisions))throw Error("missing_phase_two_inputs");
 const s=data.workforce.summary;
 if(!s||!Number.isInteger(s.total)||s.total!==s.saudi+s.nonSaudi||!Number.isInteger(s.professions)||s.professions!==data.workforce.rows.length)throw Error("inconsistent_workforce_summary");
 return true;
}
function scope(data,model){
 validate(data);
 const rules=new Map(data.applicability.decisions.map(d=>[d.id,d]));
 const docs=new Map(arr(data.pdfSources?.sources).map(x=>[x.id,x]));
 return data.decisions.decisions.map(d=>{
  const rule=rules.get(d.id);
  const g=rule&&model?.names?.[d.id]&&typeof model.group==="function"?model.group(d.id):null;
  const doc=docs.get(d.id);
  const docState=d.audit?.pdfMonitoring==="restricted_document_not_copied"?"restricted":
   d.audit?.pdfMonitoring==="published_draft_not_final"||/مسودة/.test(doc?.title||"")?"draft":
   doc&&official(doc.url)?"public_monitored":"unconfirmed";
  const directCodes=arr(d.requiredActivityCodes).filter(x=>/^[0-9]{6}$/.test(String(x)));
  const blockers=[
    {id:"qiwa",label:"رموز قوى للموظفين",state:"missing"},
    {id:"licence",label:"النشاط والترخيص والفرع",state:data.activities?.verificationStatus==="official-verified-complete"?"review_against_scope":"missing"},
    {id:"legal",label:"التدقيق التفصيلي للقرار",state:d.audit?.status==="reviewed"?"reviewed_basic":"missing"},
    {id:"document",label:"الدليل الإجرائي النهائي",state:docState==="public_monitored"?"available_not_certified":"missing"},
    {id:"stage",label:"تاريخ السريان والاشتراطات المهنية",state:"needs_individual_review"}
  ];
  const done=blockers.filter(b=>b.state==="reviewed_basic").length;
  return {id:d.id,title:d.title,number:d.number||"غير مثبت",source:official(d.source),
    category:d.category||"",gate:rule?.gate||"unmapped",scopeSummary:rule?.summary||"يتطلب ضبط نطاق القرار",
    checks:arr(rule?.checks),docState,preview:g?.total>0?{total:g.total,saudi:g.saudi,nonSaudi:g.other,status:g.status,gap:g.gap}:null,
    directCodes,blockers,baseReviewed:d.audit?.status==="reviewed",basicReviewCount:done,
    finalVerdict:false,confidence:"requires_verified_evidence",
    evidenceNote:"وجود مسمى أو رمز نشاط مرشح لا يثبت شمول القرار أو الإعفاء منه."};
 });
}
function readiness(rows){
 return rows.map(r=>{
  const missing=r.blockers.filter(x=>x.state==="missing").length;
  return {id:r.id,title:r.title,checks:r.blockers,missing,remaining:r.blockers.length-r.basicReviewCount,
   grade:"غير جاهز للاعتماد النظامي",basis:"درجة توثيق المدخلات وليست امتثالًا",
   finalComplianceCertificate:false};
 });
}
function conflicts(data,model){
 validate(data);
 const roleList=data.workforce.rows.map(([title,total,saudi])=>({title,total,saudi}));
 const crossings=[];
 for(const r of roleList){
  const matches=model&&typeof model.titleIds==="function"?model.titleIds(r.title):[];
  if(matches.length>1)crossings.push({type:"title_overlap",title:r.title,total:r.total,saudi:r.saudi,decisions:matches,explanation:"مسمى مرتبط بأكثر من مجموعة تحليلية؛ راجع الرموز وشروط كل قرار. لا تجمع الفجوات."});
 }
 const codeIndex=new Map();
 for(const d of data.guideMatching.decisions){
  for(const item of arr(d.matchedRoles)){
   const code=String(item.code||"");
   if(!/^\d{6}$/.test(code))continue;
   if(!codeIndex.has(code))codeIndex.set(code,new Set());
   codeIndex.get(code).add(d.id);
  }
 }
 for(const [code,ids] of codeIndex){
  if(ids.size>1)crossings.push({type:"guide_code_overlap",code,decisions:[...ids],explanation:"الرمز موجود في أكثر من مجموعة دليل؛ تحقق من القرار الحاكم وتاريخ النفاذ دون جمع الموظف مرتين."});
 }
 const related=arr(data.guideMatching.decisions).flatMap(d=>arr(d.relatedNonTargetRoles).map(r=>({type:"related_non_target",title:r.title,decision:d.id,code:r.code||null,explanation:"مسمى تنظيمي قريب لكنه غير محسوب ضمن جدول القرار الحالي؛ يجب التأكد من رمز قوى الفعلي."})));
 return {overlaps:crossings,related,notes:["لا تحسم نتائج التطابق النصي تعارضًا نظاميًا.","تجميع المهن دون الرموز الفردية قد يبالغ في تقدير الاحتياج أو يخفيه."]};
}
function history(data,onDate){
 if(!dateOk(onDate))throw Error("invalid_asof_date");
 const events=[];
 for(const d of data.decisions.decisions){
  for(const h of arr(d.history)){
   if(!dateOk(h.date)||h.date>onDate||h.verified!==true)continue;
   const source=official(h.source);
   if(!source)continue;
   events.push({date:h.date,id:d.id,title:d.title,label:h.label||"تغيير",rate:h.rate||"وفق الدليل",kind:h.kind||"stage",source,scope:h.scope||""});
  }
 }
 events.sort((a,b)=>b.date.localeCompare(a.date)||a.title.localeCompare(b.title,"ar"));
 return {asOf:onDate,events,notice:"يعرض أحداثًا مؤرخة موثقة في سجل المشروع فقط؛ لا يعيد إنشاء بيانات الموظفين أو النصوص التاريخية التي لم تُحفظ آنذاك."};
}
function twelveMonths({workforce,startMonth,hire=0,replace=0,train=0,monthlySalary=0,trainingCost=0}){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(startMonth||"")))throw Error("bad_start_month");
 const s=workforce?.summary;if(!s||s.total!==s.saudi+s.nonSaudi)throw Error("invalid_workforce");
 const numbers=[hire,replace,train,monthlySalary,trainingCost];
 if(numbers.some(n=>!Number.isInteger(n)||n<0||n>1000000))throw Error("invalid_scenario");
 if(hire>10000||replace>10000||train>10000)throw Error("scenario_oversized");
 const [y,m]=startMonth.split("-").map(Number);
 let total=s.total,saudi=s.saudi,others=s.nonSaudi,cost=0;
 const months=[];
 for(let i=0;i<12;i++){
  if(replace>others)throw Error("replacement_exceeds_remaining_non_saudis");
  total+=hire;saudi+=hire+replace;others-=replace;
  // salary is only additional wages for Saudi hires or actual replacements.
  // It excludes incumbent wage offsets, taxes, severance, benefits and inflation.
  const additions=(i+1)*(hire+replace);
  const monthCost=additions*monthlySalary+train*trainingCost;
  cost+=monthCost;
  const d=new Date(Date.UTC(y,m-1+i,1)).toISOString().slice(0,7);
  months.push({month:d,total,saudi,other:others,rate:total?100*saudi/total:null,
    hires:hire,replacements:replace,training:train,monthAssumedCost:monthCost});
 }
 return {months,cost,before:{...s},after:months[11],caveat:"محاكاة شهرية فقط؛ التدريب لا يغيّر الجنسية. التكلفة الافتراضية لا تشمل التعويضات أو البدلات أو تكلفة إنهاء العقود، ولا تثبت نسب التوطين النظامية."};
}
function newVisitSnapshot({decisions,alerts,health,dailyReports}){
 const publicAlerts=arr(alerts?.alerts).filter(x=>x.triage_status!=="context_only").map(x=>String(x.id||"")).filter(Boolean).sort().slice(-500);
 const decisionsLog=arr(decisions?.decisions).map(d=>({id:d.id,audit:d.audit?.status||"unreviewed",number:d.number||"",rate:d.rate||""})).sort((a,b)=>a.id.localeCompare(b.id));
 const latest=arr(dailyReports?.reports)[0]||null;
 return {version:1,alertIds:publicAlerts,decisions:decisionsLog,latestScan:health?.checked_at||null,
  latestDay:latest?.date||null};
}
function visitChanges(previous,current){
 if(!previous||previous.version!==1)return {firstVisit:true,newAlerts:[],modifiedDecisions:[],newDecisions:[],latestScan:current.latestScan};
 const priorAlerts=new Set(arr(previous.alertIds)),seen=new Map(arr(previous.decisions).map(x=>[x.id,x]));
 const changed=[],added=[];
 for(const d of current.decisions){
  const prev=seen.get(d.id);
  if(!prev)added.push(d.id);
  else if(prev.audit!==d.audit||prev.rate!==d.rate||prev.number!==d.number)changed.push(d.id);
 }
 return {firstVisit:false,newAlerts:current.alertIds.filter(x=>!priorAlerts.has(x)),
 modifiedDecisions:changed,newDecisions:added,latestScan:current.latestScan};
}
const ROADMAP=Object.freeze([
 {id:"impact",label:"خريطة تأثير القرارات",delivery:"available"},
 {id:"readiness",label:"بطاقة جاهزية الأدلة",delivery:"available"},
 {id:"conflicts",label:"كاشف التعارضات",delivery:"available"},
 {id:"timeline",label:"آلة الزمن التنظيمية",delivery:"partial_history"},
 {id:"approvals",label:"غرفة اعتماد المراجعات",delivery:"local_drafts_only"},
 {id:"forecast",label:"توقع الاحتياج 12 شهرًا",delivery:"scenario_only"},
 {id:"vault",label:"خزنة الأدلة المشفرة",delivery:"encrypted_local_only"},
 {id:"changes",label:"ما تغير منذ آخر زيارة",delivery:"local_browser_only"}
]);
const api={validate,scope,readiness,conflicts,history,twelveMonths,newVisitSnapshot,visitChanges,official,ROADMAP,norm};
if(typeof module==="object"&&module.exports)module.exports=api;
if(root)root.SRadarPhaseTwo=api;
})(typeof window!=="undefined"?window:null);
