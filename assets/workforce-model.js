/* Aggregate workforce analysis: exact title hypotheses only, never an official compliance verdict. */
(function(){
"use strict";
const groups={
 admin:["مساعد إداري","موظف استقبال","كاتب موارد بشرية","سكرتير تنفيذي","أخصائي عمليات موارد بشرية","مدير عمليات موارد بشرية","أخصائي تواصل داخلي","أخصائي توظيف","أخصائي ارتباط وظيفي","أخصائي تخطيط قوى عاملة","مدير مواهب","مدير توظيف","مدير تنظيم إداري","أخصائي علاقات عامة"],
 procurement:["أخصائي مشتريات","مدير مشتريات"],
 project:["مدير إدارة مشاريع","أخصائي إدارة مشاريع"],
 marketing:["أخصائي تسويق","مصمم جرافيك","أخصائي علاقات عامة","مدير دعاية وإعلان"],
 accounting:["محاسب"],
 consulting:["أخصائي استشارات أعمال","أخصائي استشارات مالية"],
 legal:["أخصائي قانوني"],
 ict:["محلل نظم المعلومات","أخصائي علوم حاسب آلي","فني دعم تقنية معلومات","أخصائي دعم فني","مطور تطبيقات","محلل قاعدة بيانات","مهندس حاسب آلي"],
 engineers:["مهندس حاسب آلي"],
 sales:["وسيط سلع مستقبلية"]
};
const names={admin:"المهن الإدارية المساندة",procurement:"المشتريات",project:"إدارة المشاريع",marketing:"التسويق",accounting:"المحاسبة",consulting:"الاستشارات",legal:"المهن القانونية",ict:"تقنية المعلومات",engineers:"الهندسة",sales:"المبيعات"};
// Rates are indicative as of 2026-11-03, NOT a determination of legal scope.
// 'conditional' groups cannot safely use a combined workforce count to calculate a mandatory gap.
const policies={
 admin:{rate:100,min:1,kind:"general",detail:"تاريخ النفاذ يختلف حسب الرمز المهني وجدول المهنة؛ ليست كل المهن مستهدفة من تاريخ واحد."},
 procurement:{rate:70,min:3,kind:"general",detail:"عدد العاملين في قائمة المهن الرسمية قد يختلف عن المسميات المطابقة في الملف."},
 project:{rate:70,min:3,kind:"future",effective:"2027-02-14",detail:"نسبة 70% مرحلة مستقبلية، وليست النسبة النظامية السارية بتاريخ الملف؛ النسبة السابقة تحتاج مراجعة تاريخها."},
 marketing:{rate:60,min:3,kind:"general",detail:"يجب التحقق من الرموز الرسمية للمهن المستهدفة وشروط احتساب العاملين."},
 accounting:{rate:50,min:5,kind:"general",detail:"50% مرحلة 2026 عند وجود 5 عاملين فأكثر في المهن المحاسبية الرسمية؛ 3–4 محاسبين فئة منفصلة في 2029."},
 ict:{rate:null,min:5,kind:"grouped",detail:"نسبة 25% تُحتسب لكل مجموعة تخصصية بشكل مستقل، ولا يمكن جمع جميع موظفي التقنية في مقام واحد."},
 legal:{rate:null,min:null,kind:"sector",detail:"النطاق القطاعي للمهن القانونية يحتاج إثبات انطباقه على سالك؛ لا نفترض انطباق قرار شركات المحاماة على الإدارة القانونية الداخلية."},
 consulting:{rate:null,min:null,kind:"sector",detail:"يلزم التحقق من نطاق المهن الاستشارية وشروط المنشأة؛ المسمى وحده لا يثبت الانطباق."},
 engineers:{rate:30,min:5,kind:"threshold",detail:"تتطلب المهن الهندسية مطابقة الرمز والاعتماد والأجر؛ عدد المهندسين المطابقين للأسماء قد يقل عن العدد النظامي الفعلي."},
 sales:{rate:60,min:3,kind:"threshold",detail:"وسيط السلع المستقبلية ربط احتمالي يحتاج رمز المهنة الرسمي؛ لا نعتمد هذا المسمى تلقائياً ضمن قائمة المبيعات."}
};
function norm(v){return String(v??"").trim().replace(/[إأآٱ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/[\u064B-\u065F\u0670ـ]/g,"").replace(/\s+/g," ").toLowerCase()}
const clean=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function titleIds(title){const n=norm(title);return Object.keys(groups).filter(id=>groups[id].some(t=>norm(t)===n))}
let rows=null,waiting=null,officialRecords=Object.create(null),officialWaiting=null;
function setOfficialRecords(records){
 if(!Array.isArray(records))throw Error("Invalid official records");
 const next=Object.create(null);
 for(const r of records){
  if(!r||!policies[r.decisionId]||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(r.asOf||"")||![r.total,r.saudi,r.nonSaudi,r.reportedSaudiPercent,r.targetPercent,r.numericGap].every(Number.isInteger)||r.saudi+r.nonSaudi!==r.total||r.total<=0||r.numericGap<0)throw Error("Invalid official counter");
  next[r.decisionId]={...r};
 }
 officialRecords=next;return officialRecords;
}
function official(id){return officialRecords[id]||null}
function loadOfficial(){
 if(!officialWaiting)officialWaiting=fetch("data/official-inspections.json").then(r=>{if(!r.ok)throw Error("Official inspection data not available");return r.json()}).then(d=>setOfficialRecords(d.records)).catch(e=>{console.warn("Inspection counters could not be loaded",e);officialWaiting=null;return null});
 return officialWaiting;
}
function setRows(raw,expected){
 if(!Array.isArray(raw))throw Error("Invalid workforce rows");
 let list=raw.map(x=>{
  const [title,total,saudi]=Array.isArray(x)?x:[x.title,x.total,x.saudi];
  if(!title||!Number.isInteger(total)||!Number.isInteger(saudi)||total<0||saudi<0||saudi>total)throw Error("Invalid workforce aggregate");
  return {title,total,saudi,other:total-saudi,decisionIds:titleIds(title)};
 });
 const total=list.reduce((n,r)=>n+r.total,0),saudi=list.reduce((n,r)=>n+r.saudi,0);
 if(expected&&(total!==expected.total||saudi!==expected.saudi||total-saudi!==expected.nonSaudi||list.length!==expected.professions))throw Error("Workforce totals do not match file summary");
 rows=list;return list;
}
function load(){
 const workforce=rows?Promise.resolve(rows):(waiting||(waiting=fetch("data/salic-workforce.json").then(r=>{if(!r.ok)throw Error("Workforce data unavailable");return r.json()}).then(d=>setRows(d.rows,d.summary)).catch(e=>{waiting=null;throw e})));
 return Promise.all([workforce,loadOfficial()]).then(([list])=>list);
}
function getRows(){return rows||[]}
function group(id){
 const list=(rows||[]).filter(r=>r.decisionIds.includes(id));
 const total=list.reduce((s,r)=>s+r.total,0),saudi=list.reduce((s,r)=>s+r.saudi,0),other=total-saudi;
 const policy=policies[id]||{rate:null,min:null,kind:"sector"};
 let status="undetermined",gap=null,needed=null,reason="تحتاج المطابقة إلى التحقق من رموز المهن ونطاق القرار.";
 if(!rows){status="loading";reason="جارٍ تحميل بيانات سالك";}
 else if(!list.length){status="no-match";reason="لا توجد مهنة مطابقة في القائمة الحالية؛ هذا لا يعني عدم انطباق القرار."}
 else if(policy.kind==="sector"||policy.kind==="grouped"){status="manual";reason=policy.detail}
 else if(total<policy.min){status="threshold";reason="العدد المطابق للمسميات ("+total+") أقل من حد الفحص المذكور ("+policy.min+")، وقد توجد مهن مشمولة أخرى غير مطابقة بالأسماء."}
 else if(Number.isFinite(policy.rate)){
  needed=Math.ceil(total*policy.rate/100);gap=Math.max(0,needed-saudi);
  status=policy.kind==="future"?"future":"estimate";
  reason=policy.kind==="future"?"فجوة تخطيطية للمرحلة القادمة فقط؛ ليست فجوة حالية مثبتة.":"فجوة حسابية افتراضية على المهن المطابقة بالأسماء فقط، وليست فجوة امتثال معتمدة.";
 }
 return {id,list,total,saudi,other,policy,needed,gap,status,reason};
}
function header(id){
 if(!rows)return '<div class="wf-topstrip wf-topstrip-loading">جارٍ تحميل أعداد موظفي سالك…</div>';
 const g=group(id),r=official(id),all=rows.reduce((v,x)=>v+x.total,0);
 const cards=r?
  [{label:"الموظفون حسب الوزارة",value:r.total},{label:"السعوديون",value:r.saudi},{label:"غير السعوديين",value:r.nonSaudi},{label:"الاحتياج وفق المحضر",value:r.numericGap}]:
  [{label:"المطابقون من الإكسل",value:g.total},{label:"السعوديون",value:g.saudi},{label:"غير السعوديين",value:g.other},{label:"الفجوة التقديرية",value:g.gap===null?"تحتاج تحقق":g.gap}];
 const title=r?"المرجع الرقابي · "+r.asOf.split("-").reverse().join("/"):"بيانات الإكسل · 03/11/2026";
 const note=r?"المحقق: "+r.reportedSaudiPercent+"%، المطلوب: "+r.targetPercent+"%. الإكسل المؤرخ 03/11/2026 يطابق "+g.total+" موظفاً بالمسميات ("+g.saudi+" سعوديين و"+g.other+" غير سعوديين). فارق العدد "+(r.total-g.total)+" موظفين يتطلب مراجعة رموز قوى.":"العدد جزء من "+all+" موظف بسالك. الربط بالمسمى مبدئي وليس شهادة امتثال.";
 return '<div class="wf-topstrip"><div class="wf-topstrip-title"><b>'+clean(title)+'</b><small>'+(r?"مرجع الوزارة بتاريخ الزيارة وليس عدداً لحظياً":"مطابقة أولية لمسميات الإكسل")+'</small></div><div class="wf-topstrip-grid">'+cards.map((v,i)=>'<div class="wf-topstrip-stat'+(i===3?' wf-topstrip-gap':'')+'"><small>'+clean(v.label)+'</small><strong>'+clean(v.value)+'</strong></div>').join("")+'</div><div class="wf-topstrip-note">'+clean(note)+'</div></div>';
}
function compact(id){
 if(!rows)return '<div class="wf-compact">بيانات سالك: جارٍ التحميل…</div>';
 const g=group(id),r=official(id),total=rows.reduce((v,x)=>v+x.total,0);
 if(r)return '<div class="wf-compact"><strong>محضر الوزارة: '+r.total+' موظفاً بتاريخ '+clean(r.asOf)+'</strong><span>'+r.saudi+' سعودي · '+r.nonSaudi+' غير سعودي</span><span>المحقق '+r.reportedSaudiPercent+'% · الاحتياج: <b>'+r.numericGap+'</b></span><span>الإكسل: '+g.total+' مطابقون مبدئياً</span></div>';
 if(!g.total)return '<div class="wf-compact">لا توجد مطابقة بالمسمى في إكسل سالك لهذه المجموعة.</div>';
 return '<div class="wf-compact"><strong>المطابقون من الإكسل: '+g.total+' من أصل '+total+' موظف بسالك</strong><span>'+g.saudi+' سعودي · '+g.other+' غير سعودي</span><span>الفجوة الحسابية: <b>'+(g.gap===null?"تحتاج تحقق":g.gap)+'</b></span></div>';
}
function render(id){
 const g=group(id),p=g.policy,record=official(id),companyTotal=(rows||[]).reduce((sum,r)=>sum+r.total,0);
 const rate=Number.isFinite(p.rate)?p.rate+"%":(id==="ict"?"25% لكل مجموعة":"بحسب النطاق");
 const gapText=g.gap===null?"غير محسوبة":String(g.gap);
 const note=(g.status==="future"?"فجوة تخطيطية للمرحلة القادمة":g.status==="estimate"?"فجوة حسابية تقديرية":"مراجعة شروط القرار قبل الحساب");
 const detail=p.detail||"يتطلب التحقق من الدليل والرموز المهنية";
 let table=g.list.map(r=>'<tr><td>'+clean(r.title)+'</td><td>'+r.total+'</td><td>'+r.saudi+'</td><td>'+r.other+'</td></tr>').join("");
 const comparison=record?'<div class="wf-inspection-comparison"><h4>احتساب الوزارة مقابل مطابقة الإكسل</h4><div class="wf-comparison-grid"><div><small>مرجع الوزارة · '+clean(record.asOf)+'</small><strong>'+record.total+' موظفاً</strong><span>'+record.saudi+' سعودي · '+record.nonSaudi+' غير سعودي · محقق '+record.reportedSaudiPercent+'%</span></div><div><small>الإكسل · 2026-11-03</small><strong>'+g.total+' مطابقون بالمسميات</strong><span>'+g.saudi+' سعودي · '+g.other+' غير سعودي</span></div></div><p>فارق العدد '+(record.total-g.total)+' موظفين. احتساب الوزارة مبني على المهن المسجلة وقت الزيارة، بينما الربط من الإكسل مبني على المسميات المتاحة؛ لا نعرف أي رموز مهنية تفسر الفارق. لا تُعامل أرقام الوزارة كرصيد محدث اليوم.</p></div>':"";

 return '<section class="wf-section" aria-label="وضع موظفي سالك لهذا القرار">'+comparison+'<div class="wf-head"><div><h3>تفصيل المهن التي طابقناها من الإكسل</h3><p>هذه مطابقة بالإكسل فقط وليست إجمالي الوزارة. المهن جزء من إجمالي '+companyTotal+' موظف في سالك، وليس إجمالي القوى العاملة. مطابقة مبدئية لمسميات ملف 03/11/2026 دون رموز قوى.</p></div><a class="wf-cta" href="calculator.html?decision='+encodeURIComponent(id)+'">افتح الحاسبة المستقلة ↗</a></div><div class="wf-kpis"><div><small>الوظائف المطابقة</small><b>'+g.list.length+'</b></div><div><small>المطابقون بالإكسل</small><b>'+g.total+'</b></div><div><small>السعوديون</small><b>'+g.saudi+'</b></div><div><small>غير السعوديين</small><b>'+g.other+'</b></div><div class="wf-gap"><small>'+note+'</small><b>'+gapText+'</b></div></div><div class="wf-explanation"><b>النسبة المرجعية:</b> '+clean(rate)+' · <b>حد العدد:</b> '+(p.min||"بحسب النشاط والجدول")+'<p>'+clean(g.reason)+'</p><p>'+clean(detail)+'</p></div><div class="wf-table-scroll"><table class="wf-table"><thead><tr><th>المهنة في ملف سالك</th><th>الإجمالي</th><th>سعودي</th><th>غير سعودي</th></tr></thead><tbody>'+(table||'<tr><td colspan="4">لا توجد مطابقة نصية معروفة للمجموعة</td></tr>')+'</tbody></table></div><p class="wf-caution">قد تتداخل المهن بين القرارات، ولا يجوز جمع الفجوات من عدة قرارات. المقارنة مع المحضر لا تحل محل بيانات رموز المهن الرسمية، والفجوة التقديرية لا تثبت وجود مخالفة ولا عدد التعيينات المطلوب نظامياً قبل فحص الرموز والكيان والأنشطة والأجر وشروط احتساب السعوديين.</p></section>';
}
window.SalicWorkforce={names,groups,policies,norm,titleIds,setRows,setOfficialRecords,loadOfficial,official,load,getRows,group,header,compact,render};
})();