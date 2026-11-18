/* Real SALIC executive overview: read-only, no invented rates, no PII. */
(()=>{
"use strict";
const core=window.RadarHomeV3;
if(!core)return;
const $=id=>document.getElementById(id);
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined&&text!==null)n.textContent=String(text);if(cls)n.className=cls;return n};
const num=x=>Number(x).toLocaleString("en-US");
async function get(name){
 const r=await fetch("data/"+name+".json",{cache:"no-store"});
 if(!r.ok)throw Error("unavailable_public_"+name);
 return r.json();
}
function official(url,label){
 const href=core.safeUrl(url);
 if(!href)return node("span","تحتاج مرجعًا متاحًا");
 const a=node("a",label);
 a.href=href;a.target="_blank";a.rel="noopener noreferrer";a.referrerPolicy="no-referrer";
 return a;
}
function renderAlerts(items){
 const list=$("v3-alert-list"),fragment=document.createDocumentFragment();
 if(!items.length)fragment.append(node("p","لا توجد إشارات نشطة في سجل الرادار. لا يعني ذلك عدم صدور قرارات جديدة.","v3-card-note"));
 for(const x of items.slice(0,3)){
  const row=node("div",null,"v3-alert-item");
  row.append(node("span","مراجعة","v3-priority-tag"),official(x.source,x.summary||x.title));
  if(x.date)row.append(node("small",x.date,"v3-alert-date"));
  fragment.append(row);
 }
 list.replaceChildren(fragment);
}
function renderUpcoming(items){
 const list=$("v3-upcoming-list"),fragment=document.createDocumentFragment();
 if(!items.length)fragment.append(node("p","لا توجد مواعيد مستقبلية موثقة في سجلنا الحالي.","v3-card-note"));
 for(const x of items.slice(0,3)){
  const row=node("div",null,"v3-event-item");
  row.append(node("span",x.daysLeft===0?"اليوم":x.daysLeft+" يوم","v3-countdown"));
  row.append(official(x.source,x.title+" — "+x.label));
  fragment.append(row);
 }
 list.replaceChildren(fragment);
}
function renderCalendar(now,stages){
 const days=core.weekAround(now);
 const month=new Intl.DateTimeFormat("ar-SA",{timeZone:"UTC",month:"long",year:"numeric",calendar:"gregory"}).format(new Date(now+"T00:00:00Z"));
 const el=$("v3-calendar"),fragment=document.createDocumentFragment();
 const head=node("div",null,"v3-calendar-head");
 head.append(node("span",month),node("span",now));
 const dayNames=node("div",null,"v3-calendar-week");
 ["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"].forEach(x=>dayNames.append(node("span",x.slice(0,3))));
 const cells=node("div",null,"v3-calendar-week");
 const eventDates=new Set(stages.map(x=>x.date));
 for(const d of days){
  const span=node("span",String(d.day),d.isToday?"today":eventDates.has(d.date)?"near":"");
  span.title=eventDates.has(d.date)?"توجد مرحلة تنظيمية موثقة لهذا اليوم":d.date;
  cells.append(span);
 }
 fragment.append(head,dayNames,cells,node("p","التقويم يستعرض أسبوع اليوم. المراحل القادمة تظهر أعلاه.","v3-calendar-footnote"));
 el.replaceChildren(fragment);
}
function put(id,value){const n=$(id);if(n)n.textContent=String(value)}
async function init(){
 try{
  const [workforce,decisions,alerts,health]=await Promise.all([
   get("salic-workforce"),get("decisions"),get("alerts"),get("health")
  ]);
  const data=core.compute({workforce,decisions,alerts,health,now:core.localRiyadhDate()});
  put("v3-saudi-count",num(data.totals.saudi));
  put("v3-nonsaudi-count",num(data.totals.nonSaudi));
  put("v3-legend-saudi",num(data.totals.saudi)+" · "+data.totals.nationalShare.toFixed(1)+"%");
  put("v3-legend-other",num(data.totals.nonSaudi)+" · "+(100-data.totals.nationalShare).toFixed(1)+"%");
  put("v3-donut-total",num(data.totals.workforce));
  put("v3-workforce-snapshot","لقطة "+data.totals.asOf);
  $("v3-donut").style.setProperty("--part",Math.min(100,Math.max(0,data.totals.nationalShare)).toFixed(2)+"%");
  put("v3-audit-checked",num(data.decisions.reviewed)+" / "+num(data.decisions.total));
  put("v3-audit-reviewed",num(data.decisions.reviewed));
  put("v3-audit-remaining",num(data.decisions.pending));
  put("v3-audit-message","تمت مراجعة الأدلة الأساسية لـ"+num(data.decisions.reviewed)+
   " قرارًا. الباقي يحتاج تدقيق الشروط والتواريخ قبل الاعتماد.");
  $("v3-audit-progress").style.width=(data.decisions.total?
   100*data.decisions.reviewed/data.decisions.total:0).toFixed(1)+"%";
  renderAlerts(data.alerts);
  renderUpcoming(data.stages);
  renderCalendar(data.now,data.stages);
 }catch(err){
  for(const id of ["v3-alert-list","v3-upcoming-list","v3-calendar"]){
   const dest=$(id);if(dest)dest.replaceChildren(node("p","تعذّر قراءة البيانات الرسمية المسجلة؛ لم تُستبدل بأرقام تجريبية.","v3-card-note"));
  }
  put("v3-audit-message","تعذّر تحديث التدقيق. افحص اتصال الموقع أو راجع مركز الأدلة.");
 }
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
