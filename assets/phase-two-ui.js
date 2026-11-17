/* Phase II UI. Only reads public aggregate files; local drafts never POST. */
(()=>{
"use strict";
const core=window.SRadarPhaseTwo,model=window.SalicWorkforce;
if(!core||!model)return;
const $=id=>document.getElementById(id);
const el=(tag,text,cls)=>{const x=document.createElement(tag);if(text!==undefined&&text!==null)x.textContent=String(text);if(cls)x.className=cls;return x};
const put=(id,node)=>$(id).replaceChildren(node);
const rows=(id,items)=>{const f=document.createDocumentFragment();items.forEach(x=>f.append(x));$(id).replaceChildren(f)};
const fmt=n=>Number(n).toLocaleString("en-US",{maximumFractionDigits:2});
const rate=n=>Number.isFinite(n)?n.toFixed(1)+"%":"—";
const localDate=()=>{const ps=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const obj=Object.fromEntries(ps.filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));return obj.year+"-"+obj.month+"-"+obj.day};
const linked=(url,label)=>{
 const safe=core.official(url);
 if(!safe)return el("span","يحتاج مصدرًا معتمدًا");
 const a=el("a",label||"الوزارة");a.href=safe;a.target="_blank";a.rel="noopener noreferrer";a.referrerPolicy="no-referrer";return a;
};
const cell=x=>{const td=el("td");if(x?.nodeType)td.append(x);else td.textContent=String(x??"—");return td};
const tr=(...vals)=>{const t=el("tr");vals.forEach(v=>t.append(cell(v)));return t};
const statusLabels={missing:"غير مكتمل",review_against_scope:"يحتاج مطابقة نطاق",reviewed_basic:"مراجعة أساسية",available_not_certified:"متاح للمراجعة وليس معتمدًا",needs_individual_review:"يتطلب مراجعة فردية"};
const gateLabels={occupation:"الرمز المهني",workforce_excluded:"مطابقة المسميات الحالية فقط",licensed_activity:"نشاط مرخص",regional_activity:"الموقع والفرع والنشاط",facility:"المنشأة",tasks:"المهام الفعلية",activity_or_occupation:"النشاط أو المهنة",unmapped:"نطاق غير محدد"};
let data,scope,conflicts,scenario,visitCurrent,visitView,visitPrev,approvals=[];
const VALID_APPROVAL=new Set(["requires_review","awaiting_evidence","ready_for_approval"]);
const STORAGE_KEY="saudization-radar-phase-ii-public-signals-v1";
async function loadJson(path){
 const response=await fetch("data/"+path+".json",{cache:"no-store"});
 if(!response.ok)throw Error("unavailable:"+path);
 return response.json();
}
function renderImpact(){
 const filter=$("impact-filter").value,q=core.norm($("impact-query").value);
 let view=scope.filter(x=>{
  if(filter==="titles"&&!x.preview)return false;
  if(filter==="pending"&&x.baseReviewed)return false;
  if(filter==="licensed"&&!["licensed_activity","regional_activity","facility","activity_or_occupation"].includes(x.gate))return false;
  return !q||core.norm(x.title+" "+x.number).includes(q);
 });
 view.sort((a,b)=>(b.preview?.total||0)-(a.preview?.total||0)||a.title.localeCompare(b.title,"ar"));
 $("impact-count").textContent="عرض "+view.length+" من أصل "+scope.length+" قرارًا. العدد هنا اتصال بالمسميات فقط، وليس عدد العاملين المشمولين نظاميًا.";
 rows("impact-rows",view.map(x=>{
  const preview=x.preview?fmt(x.preview.total)+" موظفًا بالمسمى · "+fmt(x.preview.nonSaudi)+" غير سعودي":"لا توجد مطابقة نصية مثبتة";
  const notes=x.baseReviewed?"المراجعة الأساسية تمت":"التدقيق التفصيلي معلّق";
  const source=linked(x.source,"مصدر الوزارة");
  return tr(x.title+" · "+x.number,preview,(gateLabels[x.gate]||x.gate)+" — "+x.scopeSummary,source);
 }));
}
function renderReadiness(){
 const id=$("readiness-decision").value;
 const item=scope.find(x=>x.id===id);
 if(!item)return;
 $("readiness-result").textContent="حالة "+item.title+": تحتاج استكمال أدلة نظامية. "+
  (item.baseReviewed?"تمت مراجعة أساسية للقرار، لكنها ليست اعتماد امتثال.":"لم يُستكمل التدقيق التفصيلي.")+
  " دليل PDF: "+({public_monitored:"متاح في الرصد العام",restricted:"مقيّد ولا يُنسخ علنًا",draft:"مسودة وليست نهائية",unconfirmed:"غير مؤكد ضمن الرصد العام"}[item.docState]||"غير متوفر")+".";
 rows("readiness-checks",item.blockers.map(x=>{
  const li=el("li");li.append(el("span",x.label),el("strong",statusLabels[x.state]||"بانتظار المراجعة"));return li;
 }));
}
function renderConflicts(){
 const combos=conflicts.overlaps,related=conflicts.related;
 $("conflicts-summary").textContent="تقاطعات مسميات أو رموز مرجعية: "+combos.length+
 "; مسميات مصنّفة تنظيمياً لكن غير مشمولة بجدول قرار محدد: "+related.length+
 ". هذه تنبيهات فحص لا تثبت تعارضاً نظامياً.";
 const list=combos.map(x=>tr(x.type==="guide_code_overlap"?"رمز في أدلة متعددة":"مسمى بمجموعات متعددة",
  x.title||x.code,x.decisions.join(" · "),x.explanation));
 related.forEach(x=>list.push(tr("تصنيف تنظيمي منفصل",x.title+(x.code?" · "+x.code:""),x.decision,x.explanation)));
 if(!list.length)list.push(tr("—","لم يظهر تداخل في الفهرس الحالي","—","قد تكشف رموز قوى الفعلية تداخلات غير مرئية في هذه البيانات."));
 rows("conflicts-rows",list);
}
function renderHistory(){
 const date=$("timeline-date").value;
 try{
  const result=core.history(data,date);
  $("timeline-count").className="status";
  $("timeline-count").textContent="عدد الأحداث المؤرخة الموثقة في السجل حتى "+date+": "+result.events.length+". "+result.notice;
  const shown=result.events.map(e=>tr(e.date,e.title,e.label+" — "+e.rate,linked(e.source,"المرجع")));
  if(!shown.length)shown.push(tr("—","لا أحداث موثقة حتى التاريخ","—","لا يعني عدم وجود قرارات"));
  rows("timeline-rows",shown);
 }catch{
  $("timeline-count").className="status error";
  $("timeline-count").textContent="أدخل تاريخًا صحيحًا. لا يمكن إعادة بناء تاريخ غير مسجل.";
  $("timeline-rows").replaceChildren();
 }
}
function renderApprovals(){
 const labels={requires_review:"تحتاج مراجعة",awaiting_evidence:"بانتظار أدلة",ready_for_approval:"جاهزة للعرض على المعتمد"};
 rows("approval-rows",approvals.map(x=>tr(x.title,labels[x.status],x.owner||"غير محدد",x.note||"لا توجد ملاحظات")));
 $("approval-message").textContent=approvals.length?"عدد مسودات حزمة المراجعة المحلية: "+approvals.length+
 ". لم تُنشأ موافقة رسمية أو تغيّر أي قرار.":"لا توجد مسودات مراجعة مؤقتة. لم تُنشأ أي موافقة أو تعديل.";
}
function approvalAdd(){
 const id=$("approval-decision").value;
 const found=scope.find(x=>x.id===id);
 const status=$("approval-status").value;
 if(!found||!VALID_APPROVAL.has(status))return;
 const entry={decisionId:id,title:found.title,status,owner:$("approval-owner").value.trim().slice(0,100),
   note:$("approval-note").value.trim().slice(0,700),date:localDate(),type:"local_review_draft_not_formal_approval"};
 approvals=approvals.filter(x=>x.decisionId!==id);approvals.push(entry);renderApprovals();
}
function download(content,name,type){
 const blob=new Blob([content],{type});
 const url=URL.createObjectURL(blob);
 const a=el("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
 URL.revokeObjectURL(url);
}
function approvalExport(){
 if(!approvals.length){$("approval-message").textContent="لا توجد مراجعات لتصديرها.";return}
 download(JSON.stringify({version:1,kind:"SALIC_LOCAL_DRAFT_NOT_APPROVAL",exportedOn:localDate(),reviews:approvals},null,2),
  "radar-local-review-drafts.json","application/json");
}
async function approvalImport(file){
 if(!file||file.size>150000)throw Error("file_too_large");
 const j=JSON.parse(await file.text());
 if(j.version!==1||j.kind!=="SALIC_LOCAL_DRAFT_NOT_APPROVAL"||!Array.isArray(j.reviews)||j.reviews.length>21)throw Error("bad_schema");
 const from=new Map(scope.map(x=>[x.id,x]));
 const accepted=[];
 for(const r of j.reviews){
  if(!r||!from.has(r.decisionId)||!VALID_APPROVAL.has(r.status)||
   typeof r.owner!=="string"||r.owner.length>100||typeof r.note!=="string"||r.note.length>700)throw Error("invalid_review");
  accepted.push({decisionId:r.decisionId,title:from.get(r.decisionId).title,status:r.status,owner:r.owner,note:r.note,
    date:localDate(),type:"local_review_draft_not_formal_approval"});
 }
 approvals=[...new Map(accepted.map(x=>[x.decisionId,x])).values()];
 renderApprovals();
}
function renderForecast(){
 try{
  const n=id=>{const v=Number($(id).value);if(!Number.isSafeInteger(v)||v<0)throw Error("invalid_amount");return v};
  scenario=core.twelveMonths({workforce:data.workforce,startMonth:$("forecast-start").value,
   hire:n("forecast-hire"),replace:n("forecast-replace"),train:n("forecast-train"),
   monthlySalary:n("forecast-salary"),trainingCost:n("forecast-training-cost")});
  $("forecast-summary").className="status";
  $("forecast-summary").textContent="بداية المحاكاة: "+fmt(scenario.before.saudi)+" سعوديًا من "+fmt(scenario.before.total)+
   " موظفًا. بعد 12 شهرًا: "+fmt(scenario.after.saudi)+" من "+fmt(scenario.after.total)+
   " ("+rate(scenario.after.rate)+"). التكلفة الإضافية المفترضة خلال السيناريو: "+fmt(scenario.cost)+" ر.س. "+scenario.caveat;
  rows("forecast-rows",scenario.months.map(m=>tr(m.month,fmt(m.total),fmt(m.saudi),fmt(m.other),
   rate(m.rate),fmt(m.monthAssumedCost)+" ر.س")));
  $("forecast-csv").disabled=false;
 }catch(e){
  scenario=null;$("forecast-csv").disabled=true;
  $("forecast-summary").className="status error";
  $("forecast-summary").textContent="افتراض غير صالح. يجب ألا يزيد الإحلال على الموظفين غير السعوديين المتبقين خلال 12 شهرًا، وأن تكون المدخلات أعدادًا صحيحة غير سالبة.";
  $("forecast-rows").replaceChildren();
 }
}
function exportForecast(){
 if(!scenario)return;
 const lines=[["الشهر","الإجمالي","السعوديون","غير السعوديين","النسبة الافتراضية","تكلفة إضافية للشهر"]];
 scenario.months.forEach(x=>lines.push([x.month,x.total,x.saudi,x.other,x.rate?.toFixed(2)||"",x.monthAssumedCost]));
 download("\uFEFF"+lines.map(x=>x.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(",")).join("\r\n"),
  "radar-12-month-planning-scenario.csv","text/csv;charset=utf-8");
}
function renderVisit(){
 const prev=visitPrev,now=visitCurrent,comp=core.visitChanges(prev,now),titles=new Map(scope.map(x=>[x.id,x.title]));
 if(comp.firstVisit){
  $("visit-summary").textContent="هذه أول زيارة مسجلة لهذا المتصفح. جرى إنشاء نقطة مقارنة للبيانات العامة فقط. افتح الصفحة بعد تحديث السجل لترى الفروقات.";
  $("visit-alerts").textContent="لا توجد مقارنة تاريخية محلية بعد.";
  $("visit-decisions").textContent="لا توجد مقارنة تاريخية محلية بعد.";
  return;
 }
 $("visit-summary").textContent="تحديث الرصد الأخير: "+(comp.latestScan||"غير متوفر")+
  ". مقارنة هذا المتصفح: "+comp.newAlerts.length+" إشارات جديدة نشطة و"+
  (comp.modifiedDecisions.length+comp.newDecisions.length)+" تغيرًا في بيانات القرارات. ليست هذه أحكامًا قانونية.";
 $("visit-alerts").textContent=comp.newAlerts.length?
  "معرفات الإشارات الجديدة: "+comp.newAlerts.slice(0,15).join("، ")+(comp.newAlerts.length>15?"…":""):
  "لم تظهر إشارات جديدة مقارنة بالنقطة المحفوظة.";
 const changed=[...comp.newDecisions,...comp.modifiedDecisions].map(id=>titles.get(id)||id);
 $("visit-decisions").textContent=changed.length?changed.join("، "):"لم يتغير رقم أو نسبة أو حالة التدقيق في البيانات المنشورة التي تقارنها الصفحة.";
}
function loadVisit(){
 visitCurrent=core.newVisitSnapshot(data);
 try{
  const v=localStorage.getItem(STORAGE_KEY);
  visitPrev=v?JSON.parse(v):null;
  if(!visitPrev){localStorage.setItem(STORAGE_KEY,JSON.stringify(visitCurrent));}
  renderVisit();
 }catch{
  visitPrev=null;
  $("visit-summary").textContent="تعذر استخدام ذاكرة هذا المتصفح؛ لن نختلق سجل زيارات. استخدم غرفة التنبيهات وتقارير الرصد لمعرفة المستجدات.";
  $("visit-alerts").textContent="التخزين المحلي معطل";
  $("visit-decisions").textContent="التخزين المحلي معطل";
 }
}
function visitAck(){
 if(!visitCurrent)return;
 try{localStorage.setItem(STORAGE_KEY,JSON.stringify(visitCurrent));visitPrev=visitCurrent;renderVisit();}
 catch{$("visit-summary").textContent="تعذر حفظ نقطة المقارنة بهذا المتصفح؛ سجل الرصد المستقل ما زال متاحًا.";}
}
async function init(){
 try{
  const names=["decisions","salic-workforce","salic-applicability","guide-matching","guide-pdf-sources","salic-activities","alerts","daily-reports","health"];
  const values=await Promise.all(names.map(loadJson));
  data={decisions:values[0],workforce:values[1],applicability:values[2],guideMatching:values[3],
   pdfSources:values[4],activities:values[5],alerts:values[6],dailyReports:values[7],health:values[8]};
  core.validate(data);model.setRows(data.workforce.rows,data.workforce.summary);
  scope=core.scope(data,model);conflicts=core.conflicts(data,model);
  $("k-decisions").textContent=fmt(scope.length);
  $("k-pending").textContent=fmt(scope.filter(x=>!x.baseReviewed).length);
  $("k-workforce").textContent=fmt(data.workforce.summary.total);
  $("k-sources").textContent=fmt(data.health.total_sources||0);
  $("load-status").textContent="البيانات من مستودع الرادار العام؛ لقطة الموظفين "+
    data.workforce.asOf+"، آخر فحص للمصادر "+(data.health.checked_at||"غير متوفر")+
    ". الأرقام المعروضة ليست شهادة امتثال.";
  const sorted=scope.slice().sort((a,b)=>a.title.localeCompare(b.title,"ar"));
  for(const id of ["readiness-decision","approval-decision"]){
   const s=$(id),frag=document.createDocumentFragment();
   sorted.forEach(x=>{const option=el("option",x.title);option.value=x.id;frag.append(option)});
   s.replaceChildren(frag);
  }
  $("readiness-decision").value="admin";
  $("approval-decision").value="admin";
  ["impact-filter","impact-query"].forEach(id=>$(id).addEventListener(id==="impact-query"?"input":"change",renderImpact));
  $("readiness-decision").addEventListener("change",renderReadiness);
  $("readiness-print").addEventListener("click",()=>window.print());
  $("timeline-date").value=localDate();
  $("timeline-show").addEventListener("click",renderHistory);
  $("approval-add").addEventListener("click",approvalAdd);
  $("approval-export").addEventListener("click",approvalExport);
  $("approval-clear").addEventListener("click",()=>{approvals=[];renderApprovals()});
  $("approval-import").addEventListener("change",async()=>{
   try{await approvalImport($("approval-import").files?.[0]);}
   catch{$("approval-message").textContent="تعذر قراءة حزمة المراجعة؛ لا تُستورد إلا ملفات المسودات المحلية المطابقة لصيغة الرادار.";}
   $("approval-import").value="";
  });
  $("forecast-start").value=localDate().slice(0,7);
  $("forecast-run").addEventListener("click",renderForecast);
  $("forecast-csv").addEventListener("click",exportForecast);
  $("visit-ack").addEventListener("click",visitAck);
  renderImpact();renderReadiness();renderConflicts();renderHistory();renderApprovals();renderForecast();loadVisit();
 }catch{
  $("load-status").className="status error";
  $("load-status").textContent="تعذر تحميل بعض المصادر. لن نحسب أو نعرض نتائج تنظيمية غير مستندة إلى بيانات موثقة. جرّب تحديث الصفحة.";
 }
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
else init();
})();
