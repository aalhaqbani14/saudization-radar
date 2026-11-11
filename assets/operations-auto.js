/* Read-only operational radar: computed recommendations, never actions on employees.
 * Reads public decision/watch/workforce summaries. No localStorage, no task status edits.
 */
(function(root){
"use strict";
const safeDate=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+"T00:00:00Z"));
function riyadhToday(date=new Date()){
 const fields=Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date).filter(p=>p.type!=="literal").map(p=>[p.type,p.value]));
 return fields.year+"-"+fields.month+"-"+fields.day;
}
function daysUntil(today,target){
 if(!safeDate(today)||!safeDate(target))return null;
 return Math.round((Date.parse(target+"T00:00:00Z")-Date.parse(today+"T00:00:00Z"))/86400000);
}
function officialUrl(value){
 try{const u=new URL(String(value||""));return u.protocol==="https:"&&/(^|\.)hrsd\.gov\.sa$/i.test(u.hostname)?u.href:null}catch{return null}
}
function stages(decisions,today){
 const seen=new Set(),result=[];
 for(const d of decisions){
  const add=(day,rate,label,url)=>{
   const n=daysUntil(today,day);
   if(n===null||n<0)return;
   const key=d.id+"|"+day+"|"+rate;
   if(seen.has(key))return;seen.add(key);
   result.push({id:d.id,decision:d.title,date:day,days:n,rate:rate||"بحسب الدليل",label:label||"مرحلة جديدة",url:officialUrl(url||d.source)});
  };
  for(const h of d.history||[]){
   if(h.verified===true&&safeDate(h.date)&&h.date>=today&&h.kind!=="pending")add(h.date,h.rate,h.label,h.source);
  }
  if(d.nextEffective&&d.nextPct!==undefined&&d.nextEffective>=today)add(d.nextEffective,d.nextPct+"%","بدء المرحلة الجديدة",d.source);
  // First effective dates can be included only if basic source was reviewed.
  if(d.effective&&d.effective>=today&&d.audit?.status==="reviewed")add(d.effective,d.rate,"بدء تطبيق القرار",d.source);
 }
 return result.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
}
function toRisk(group,decision,upcoming){
 if(!group||!group.total){
  return {level:"unknown",heading:"مطابقة غير مكتملة",detail:"لا تتوفر بيانات موظفين تطابق هذا القرار في الفهرس الحالي. لا يعني ذلك عدم انطباقه.",suggestion:"التحقق من الرموز المهنية الفعلية والأنشطة والاشتراطات أولًا."};
 }
 if(group.status==="future"||upcoming&&decision?.effective>riyadhToday()){
  return {level:"future",heading:"استعداد لقرار قادم",detail:"المجموعة مرتبطة بمرحلة مستقبلية؛ لا تُحسب الفجوة كالتزام ساري.",suggestion:"دراسة الأثر المتوقع والتخطيط قبل بداية النفاذ."};
 }
 if(group.status==="estimate"&&group.gap>0){
  return {level:"attention",heading:"فجوة حسابية تحتاج تحقق",detail:"تقدير أولي من المسميات فقط، وليس مخالفة مثبتة.",suggestion:"مقارنة الرموز الفعلية والأجور والمراحل مع القرار قبل اقتراح المعالجة."};
 }
 if(group.status==="manual"||group.status==="threshold"){
  return {level:"review",heading:"شروط الانطباق تحتاج تحقق",detail:group.reason||"النسبة تُحسب وفق مجموعة مهنية أو حد عدد أو نشاط معين.",suggestion:"مراجعة فئات المهن وشروط العدد والنشاط بدل حساب نسبة مجمعة."};
 }
 if(group.other>0){
  return {level:"review",heading:"مراجعة ارتباط المهن",detail:"توجد مسميات لغير سعوديين؛ لا يمكن الجزم بنطاق القرار من المسمى وحده.",suggestion:"التحقق من رموز قوى والأجر والاعتماد وتاريخ التطبيق."};
 }
 return {level:"normal",heading:"متابعة دورية",detail:"لا تظهر فجوة حسابية في البيانات الحالية، ولا يمثل ذلك شهادة امتثال.",suggestion:"الاستمرار في مراجعة القرار عند تحديث بيانات الموظفين أو الدليل."};
}
function build({decisions,model,alerts,health,workforce,today=riyadhToday()}){
 if(!safeDate(today)||!Array.isArray(decisions?.decisions)||!model?.names||typeof model.group!=="function")throw Error("Invalid public radar inputs");
 const linkedIds=[...new Set([...Object.keys(model.names),"techeng"])];
 const subset=linkedIds.map(id=>{
  const decision=decisions.decisions.find(d=>d.id===id);
  if(!decision)return null;
  const group=model.names[id]?model.group(id):null;
  const future=!!(decision.nextEffective&&decision.nextEffective>today||decision.effective&&decision.effective>today);
  const risk=toRisk(group,decision,future);
  return {id,title:decision.title,number:decision.latestDecisionNumber||decision.number||"",rate:decision.rate||"غير محدد",total:group?.total??null,saudi:group?.saudi??null,other:group?.other??null,gap:Number.isFinite(group?.gap)?group.gap:null,groupStatus:group?.status||"unmapped",risk,source:officialUrl(decision.source),audit:decision.audit?.status||"needs_review",nextDate:decision.nextEffective||decision.effective||null,reason:group?.reason||null};
 }).filter(Boolean);
 const order={attention:0,future:1,review:2,unknown:3,normal:4};
 subset.sort((a,b)=>order[a.risk.level]-order[b.risk.level]||(b.other||0)-(a.other||0)||a.title.localeCompare(b.title,"ar"));
 const upcoming=stages(decisions.decisions.filter(d=>linkedIds.includes(d.id)),today);
 const seen=new Set(),signals=[];
 for(const item of alerts?.alerts||[]){
  if(!item||typeof item.summary!=="string")continue;
  const normalized=item.summary.replace(/\s+/g," ").trim();
  const key=normalized.length>=80?normalized:item.id||normalized;
  if(seen.has(key))continue;seen.add(key);
  signals.push({id:String(item.id||""),title:String(item.title||"تغيير يحتاج مراجعة"),summary:normalized.slice(0,900),source:String(item.source||"المصدر الحكومي"),date:String(item.detected_at||""),url:officialUrl(item.url),priority:String(item.review_priority||"مراجعة"),reviewStatus:String(item.review_status||"غير مؤكدة")});
 }
 const count=Number(health?.total_sources),ok=Number(health?.successful_sources),failed=Number(health?.failed_sources),checkedAt=typeof health?.checked_at==="string"?health.checked_at:"";
 const checkedTime=Date.parse(checkedAt);
 const hours=Number.isFinite(checkedTime)?(Date.now()-checkedTime)/3600000:Infinity;
 const monitoring=Number.isInteger(count)&&count>0&&Number.isInteger(ok)&&Number.isInteger(failed)&&ok+failed===count?(failed>0?"partial":hours>36?"stale":"healthy"):"unknown";
 return {today,asOf:workforce?.asOf||null,headcount:workforce?.summary||null,monitored:subset,upcoming,signals,monitoring,scan:{count,ok,failed,checkedAt},total:subset.length,attention:subset.filter(x=>x.risk.level==="attention").length,review:subset.filter(x=>x.risk.level==="review"||x.risk.level==="unknown").length,verifiedActions:0,disclaimer:"التصنيف تلقائي استرشادي من بيانات الرادار المنشورة، وليس حكم امتثال أو تنفيذًا لإجراء وظيفي. لا تتوفر بيانات قوى الفردية وأجورها واعتماداتها في هذه الصفحة."};
}
const api={riyadhToday,daysUntil,officialUrl,stages,toRisk,build};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
if(root)root.RadarAutoOperations=api;
})(typeof window!=="undefined"?window:null);
