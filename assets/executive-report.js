/* Saudization Radar unified executive brief.
 * No employee-level data; no compliance verdict; no network writes.
 */
(function(root){
"use strict";
const pad=n=>String(n).padStart(2,"0");
function riyadhDate(now){
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now||new Date());
 const obj=Object.fromEntries(parts.filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));
 return obj.year+"-"+obj.month+"-"+obj.day;
}
function daysBetween(from,to){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from||"")||!/^\d{4}-\d{2}-\d{2}$/.test(to||""))return null;
 const a=Date.parse(from+"T00:00:00Z"),b=Date.parse(to+"T00:00:00Z");
 return Number.isFinite(a)&&Number.isFinite(b)?Math.round((b-a)/86400000):null;
}
function riskFor(g){
 if(!g||g.status==="no-match"||g.total===0)return {label:"يلزم تحقق الانطباق",level:"unknown",reason:"الملف لا يثبت أن المهن أو النشاط ينطبق عليها القرار"};
 if(g.status==="future")return {label:"استعداد لمرحلة قادمة",level:"planning",reason:"الفجوة التخطيطية ليست مخالفة سارية"};
 if(Number.isFinite(g.gap)&&g.gap>0&&g.other>0)return {label:"أولوية مراجعة مرتفعة",level:"high",reason:"فجوة افتراضية بالمسمى، يلزم التثبت من رموز قوى والأجور"};
 if(g.other>0)return {label:"أولوية تحقق",level:"medium",reason:"وجود موظفين غير سعوديين ضمن مسميات محتملة الانطباق"};
 return {label:"مراجعة دورية",level:"low",reason:"عدم وجود فجوة رقمية لا يثبت امتثال المنشأة"};
}
function sourceUrl(v){
 try{const u=new URL(String(v||""));return u.protocol==="https:"&&(/(^|\.)hrsd\.gov\.sa$/).test(u.hostname)?u.href:null}catch{return null}
}
function phasesFor(decisions,today){
 const seen=new Set(),result=[];
 function append(d,date,rate,label,source,kind){
  if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date))return;
  const key=d.id+"|"+date+"|"+rate;
  if(seen.has(key))return;seen.add(key);
  result.push({id:d.id,title:d.title,date,rate:String(rate||"غير محددة"),label:label||"مرحلة تطبيق",source:sourceUrl(source||d.source),kind:kind||"scheduled",days:daysBetween(today,date)});
 }
 for(const d of decisions){
  // History is authoritative for stage chronology; only future dates are listed.
  for(const h of d.history||[]){
   if(h.date>today&&h.kind==="upcoming")append(d,h.date,h.rate,h.label,h.source,h.kind);
  }
  for(const step of d.phases||[]){
   if(step&&step.date>today)append(d,step.date,step.rate||step.label,step.label,step.source||d.source,"phase");
  }
  if(d.nextEffective>today&&d.nextPct!==undefined)append(d,d.nextEffective,d.nextPct+"%","المرحلة القادمة للقرار "+(d.latestDecisionNumber||""),d.source,"upcoming");
  if(d.effective>today&&!(d.history||[]).some(x=>x.date===d.effective))append(d,d.effective,d.rate,"بدء التطبيق",d.source,"upcoming");
 }
 return result.sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title,"ar"));
}
function buildReport({workforce,decisions,graces,health,history,model,today=riyadhDate()}){
 if(!workforce||!Array.isArray(workforce.rows)||!decisions||!Array.isArray(decisions.decisions))throw Error("Missing verified report inputs");
 // A regulatory decision can remain in the public catalogue without creating
 // a SALIC-specific obligation, workforce risk, or regulatory deadline.
 const relevant=decisions.decisions.filter(d=>d.salicScope?.status!=="excluded_from_current_workforce_dashboard");
 const groupIds=Object.keys(model?.names||{}).filter(id=>relevant.some(d=>d.id===id));
 const reviews=relevant.filter(d=>d.audit?.status==="reviewed").length;
 const allGroups=groupIds.map(id=>{
  const g=model.group(id),d=decisions.decisions.find(x=>x.id===id);
  const risk=riskFor(g);
  return {id,title:model.names[id],total:g.total,saudi:g.saudi,nonSaudi:g.other,gap:Number.isFinite(g.gap)?g.gap:null,policyKind:g.status,rate:d?.rate|| (Number.isFinite(g.policy?.rate)?g.policy.rate+"%":"نطاق مشروط"),risk,source:sourceUrl(d?.source),verified:false};
 });
 const allDecisions=relevant.map(d=>({
  id:d.id,title:d.title,rate:d.rate,reviewStatus:d.audit?.status||"needs_review",
  statusNote:d.audit?.limits||"يجب مراجعة الدليل والمهن والنشاط",
  linkedGroup:groupIds.includes(d.id),effective:d.effective||null,
  nextEffective:d.nextEffective||null,nextPct:d.nextPct??null,
  source:sourceUrl(d.source)
 }));
 const deadlines=phasesFor(relevant,today);
 const grace=(graces?.records||[]).filter(x=>relevant.some(d=>d.id===x.decisionId)).map(x=>({
  id:x.decisionId,title:decisions.decisions.find(d=>d.id===x.decisionId)?.title||x.decisionId,
  scope:x.scope,from:x.start,to:x.end,duration:x.duration,status:x.status,
  days:daysBetween(today,x.end),basis:x.basis,source:sourceUrl(x.source)
 })).sort((a,b)=>a.to.localeCompare(b.to));
 const sourceCount=Number(health?.total_sources),good=Number(health?.successful_sources),bad=Number(health?.failed_sources);
 const hdate=String(health?.checked_at||"");
 const lastDay=hdate.slice(0,10);
 const hours=Number.isFinite(Date.parse(hdate))?(Date.now()-Date.parse(hdate))/3600000:Infinity;
 const scan={checked_at:hdate,total:sourceCount,success:good,failed:bad,
  state:sourceCount>0&&good+bad===sourceCount?(hours>36?"stale":bad===0?"healthy":good===0?"failed":"partial"):"unavailable",
  daysInHistory:Array.isArray(history?.reports)?history.reports.length:0,
  lastRunSignals:history?.reports?.[0]?.new_review_signals??null};
 const counts=workforce.summary;
 return {today,asOf:workforce.asOf,summary:counts,scan,
  audited:reviews,decisionTotal:allDecisions.length,pending:allDecisions.length-reviews,
  groups:allGroups,decisions:allDecisions,deadlines,grace,
  highPriority:allGroups.filter(x=>x.risk.level==="high").length,
  qualityNotice:"تم استبعاد القرارات الهندسية غير المطابقة للمهن الحالية في سالك من هذا التقرير، مع إبقائها في الأرشيف التنظيمي. نتائج المهن استرشادية بحسب تطابق المسميات لا رموز قوى. لا تُجمع الفجوات بين مجموعات متداخلة، ولا تُحوّل أولوية المراجعة إلى حكم امتثال."};
}
function scenario(report,id,monthlyCost,months){
 const g=report.groups.find(x=>x.id===id),wage=Number(monthlyCost),period=Number(months);
 if(!g||!Number.isFinite(g.gap)||g.policyKind==="future"||g.policyKind==="manual"||g.policyKind==="threshold"||g.policyKind==="sector")return {valid:false,reason:"لا يمكن اعتماد فجوة عددية للمهنة المحددة بسبب نقص شروط الانطباق أو أن المرحلة مستقبلية."};
 if(!Number.isFinite(wage)||wage<=0||!Number.isFinite(period)||period<1||period>36||!Number.isInteger(period))return {valid:false,reason:"أدخل تكلفة شهرية افتراضية موجبة وفترة صحيحة بين شهر و36 شهرًا."};
 return {valid:true,monthly:wage,months:period,gap:g.gap,total:Math.round(g.gap*wage*period),disclaimer:"تقدير افتراضي لتكلفة التوظيف، وليس قيمة غرامة نظامية أو التزامًا ماليًا مثبتًا."};
}
const api={riyadhDate,daysBetween,riskFor,phasesFor,buildReport,scenario};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
if(root)root.RadarExecutive=api;
})(typeof window!=="undefined"?window:null);
