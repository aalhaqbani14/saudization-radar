/* Pure and auditable executive dashboard data mapping. Nothing here decides compliance. */
(function(root){
"use strict";
const isDate=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+"T00:00:00Z"));
const dateOrdinal=x=>Date.parse(x+"T00:00:00Z");
const safeUrl=x=>{try{const u=new URL(String(x||""));return u.protocol==="https:"&&!u.username&&!u.password&&(u.hostname==="hrsd.gov.sa"||u.hostname.endsWith(".hrsd.gov.sa"))?u.href:null}catch{return null}};
function localRiyadhDate(d=new Date()){
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d);
 const fields=Object.fromEntries(parts.filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));
 return fields.year+"-"+fields.month+"-"+fields.day;
}
function compute({workforce,decisions,alerts,health,now}){
 if(!isDate(now)||!workforce?.summary||!Array.isArray(workforce.rows)||!Array.isArray(decisions?.decisions)||!Array.isArray(alerts?.alerts)||!health)throw Error("incomplete_dashboard_sources");
 const summary=workforce.summary;
 if(![summary.total,summary.saudi,summary.nonSaudi].every(Number.isInteger)||summary.total<=0||summary.total!==summary.saudi+summary.nonSaudi||
    summary.saudi<0||summary.nonSaudi<0)throw Error("invalid_workforce_summary");
 const totals={workforce:summary.total,saudi:summary.saudi,nonSaudi:summary.nonSaudi,
  nationalShare:100*summary.saudi/summary.total,asOf:workforce.asOf||"غير متوفر"};
 const valid=decisions.decisions.filter(d=>d&&typeof d.id==="string");
 const reviewed=valid.filter(d=>d.audit?.status==="reviewed").length;
 const signals=alerts.alerts.filter(a=>a?.triage_status!=="context_only"&&a?.id&&safeUrl(a.url)&&typeof a.summary==="string")
   .sort((a,b)=>String(b.detected_at||"").localeCompare(String(a.detected_at||"")))
   .map(a=>({id:String(a.id),title:String(a.title||"إشارة مراجعة"),summary:String(a.summary).slice(0,170),
    source:safeUrl(a.url),date:String(a.detected_at||"").slice(0,10),
    status:String(a.review_status||"غير مؤكد — يحتاج مراجعة المصدر")}));
 const stages=[];
 const seen=new Set();
 for(const d of valid){
  for(const h of Array.isArray(d.history)?d.history:[]){
   if(h?.verified!==true||!isDate(h.date)||h.date<now||!safeUrl(h.source))continue;
   const key=d.id+"|"+h.date+"|"+String(h.label||"");
   if(seen.has(key))continue;
   seen.add(key);
   stages.push({date:h.date,title:d.title,label:String(h.label||"موعد وارد في مرجع رسمي"),
    rate:String(h.rate||"بحسب الدليل"),source:safeUrl(h.source),
    daysLeft:Math.round((dateOrdinal(h.date)-dateOrdinal(now))/86400000)});
  }
 }
 stages.sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title,"ar"));
 const okSources=Number.isInteger(health.successful_sources)&&health.successful_sources>=0?health.successful_sources:null;
 const totalSources=Number.isInteger(health.total_sources)&&health.total_sources>=0?health.total_sources:null;
 return {totals,decisions:{total:valid.length,reviewed,pending:valid.length-reviewed},
   health:{successful:okSources,total:totalSources,checkedAt:health.checked_at||""},
   alerts:signals,stages,now,notice:"توضح لوحة الرصد حالة المصادر والبيانات المجمعة المؤرخة فقط، ولا تثبت امتثال SALIC لأي قرار."};
}
function weekAround(today){
 if(!isDate(today))throw Error("invalid_calendar_date");
 const dt=new Date(today+"T00:00:00Z");
 // Show current week starting Sunday in a fixed seven-day row.
 const start=new Date(dt.getTime()-dt.getUTCDay()*86400000);
 const days=[];
 for(let i=0;i<7;i++){
  const d=new Date(start.getTime()+i*86400000);
  days.push({day:d.getUTCDate(),date:d.toISOString().slice(0,10),isToday:d.toISOString().slice(0,10)===today});
 }
 return days;
}
const api={compute,localRiyadhDate,weekAround,safeUrl,isDate};
if(typeof module==="object"&&module.exports)module.exports=api;
if(root)root.RadarHomeV3=api;
})(typeof window!=="undefined"?window:null);
