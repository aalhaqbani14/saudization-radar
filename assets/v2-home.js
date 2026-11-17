/* Homepage executive counters use real public aggregate data only. No hardcoded grades. */
(()=>{
"use strict";
const $=id=>document.getElementById(id),core=window.SRadarPhaseTwo;
if(!core)return;
const STORE="saudization-radar-phase-ii-public-signals-v1";
async function read(path){const r=await fetch("data/"+path+".json",{cache:"no-store"});if(!r.ok)throw Error(path);return r.json()}
async function init(){
 try{
  const [workforce,decisions,health,alerts,dailyReports]=await Promise.all([
   read("salic-workforce"),read("decisions"),read("health"),read("alerts"),read("daily-reports")
  ]);
  if(!workforce.summary||workforce.summary.saudi+workforce.summary.nonSaudi!==workforce.summary.total||
   !Array.isArray(decisions.decisions))throw Error("data_quality");
  const s=workforce.summary;
  $("v2-national-ratio").textContent=s.total?(100*s.saudi/s.total).toFixed(1)+"%":"—";
  $("v2-decision-count").textContent=decisions.decisions.length.toLocaleString("en-US");
  $("v2-pending-audits").textContent=decisions.decisions.filter(x=>x.audit?.status!=="reviewed").length.toLocaleString("en-US");
  $("v2-workforce-count").textContent=s.total.toLocaleString("en-US");
  $("v2-workforce-date").textContent="لقطة "+workforce.asOf+" · السعوديون "+s.saudi+" وغير السعوديين "+s.nonSaudi;
  $("v2-monitored-count").textContent=(health.successful_sources||0).toLocaleString("en-US")+"/"+
   (health.total_sources||0).toLocaleString("en-US");
  $("v2-scan-date").textContent="آخر فحص: "+(health.checked_at||"غير متوفر");
  const snapshot=core.newVisitSnapshot({decisions,alerts,health,dailyReports});
  try{
   const old=localStorage.getItem(STORE);
   if(!old){
    localStorage.setItem(STORE,JSON.stringify(snapshot));
    $("v2-visit-note").textContent="أول زيارة بهذا المتصفح: حُفظت نقطة مقارنة للمعرفات العامة فقط. افتح التفاصيل لرؤية التغييرات اللاحقة.";
   }else{
    const changes=core.visitChanges(JSON.parse(old),snapshot);
    if(changes.firstVisit)$("v2-visit-note").textContent="لا تتوفر نقطة سابقة متوافقة؛ افتح مركز المرحلة الثانية لتحديث المقارنة.";
    else $("v2-visit-note").textContent=changes.newAlerts.length+" إشارات جديدة نشطة · "+
      (changes.modifiedDecisions.length+changes.newDecisions.length)+
      " تعديلات في بيانات القرارات منذ نقطة المقارنة المحلية. افتح التفاصيل للمراجعة.";
   }
  }catch{
   $("v2-visit-note").textContent="التخزين المحلي غير متاح؛ راجع سجل الرصد اليومي لمعرفة المستجدات.";
  }
 }catch{
  $("v2-visit-note").textContent="تعذّر تحديث ملخص مصادر الرادار. لم تُعرض أرقام تقديرية بدل البيانات.";
 }
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
