/* Aggregate workforce analysis: exact title hypotheses only, never an official compliance verdict. */
(function(){
"use strict";
const groups={
 admin:["مساعد إداري","موظف استقبال","كاتب موارد بشرية","سكرتير تنفيذي","أخصائي عمليات موارد بشرية","مدير عمليات موارد بشرية","أخصائي تواصل داخلي","أخصائي توظيف","أخصائي ارتباط وظيفي","أخصائي تخطيط قوى عاملة","مدير مواهب","مدير توظيف","مدير تنظيم إداري"],
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
let rows=null,waiting=null;
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
 if(rows)return Promise.resolve(rows);
 if(!waiting)waiting=fetch("data/salic-workforce.json").then(r=>{if(!r.ok)throw Error("Workforce data unavailable");return r.json()}).then(d=>setRows(d.rows,d.summary)).catch(e=>{waiting=null;throw e});
 return waiting;
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
function compact(id){
 if(!rows)return '<div class="wf-compact">بيانات سالك: جارٍ التحميل…</div>';
 const g=group(id),companyTotal=rows.reduce((sum,r)=>sum+r.total,0);
 if(!g.total)return '<div class="wf-compact">سالك: لم تثبت مطابقة مهنة من الملف بهذه المجموعة.</div>';
 const label=g.status==="future"?"فجوة المرحلة القادمة":g.status==="estimate"?"الفجوة الحسابية":"الفجوة تحتاج تدقيق";
 return '<div class="wf-compact"><strong>المطابقون للقرار: '+g.total+' من أصل '+companyTotal+' موظف بسالك</strong><span>'+g.saudi+' سعودي · '+g.other+' غير سعودي</span><span>'+label+': <b>'+(g.gap===null?"غير محددة":g.gap)+'</b></span></div>';
}
function render(id){
 const g=group(id),p=g.policy,companyTotal=(rows||[]).reduce((sum,r)=>sum+r.total,0);
 const rate=Number.isFinite(p.rate)?p.rate+"%":(id==="ict"?"25% لكل مجموعة":"بحسب النطاق");
 const gapText=g.gap===null?"غير محسوبة":String(g.gap);
 const note=(g.status==="future"?"فجوة تخطيطية للمرحلة القادمة":g.status==="estimate"?"فجوة حسابية تقديرية":"مراجعة شروط القرار قبل الحساب");
 const detail=p.detail||"يتطلب التحقق من الدليل والرموز المهنية";
 let table=g.list.map(r=>'<tr><td>'+clean(r.title)+'</td><td>'+r.total+'</td><td>'+r.saudi+'</td><td>'+r.other+'</td></tr>').join("");
 return '<section class="wf-section" aria-label="وضع موظفي سالك لهذا القرار"><div class="wf-head"><div><h3>موظفو سالك المرتبطون بهذا القرار</h3><p>عدد هذه المهن جزء من إجمالي '+companyTotal+' موظف في سالك، وليس إجمالي القوى العاملة. مطابقة مبدئية لمسميات ملف 03/11/2026 دون رموز قوى.</p></div><a class="wf-cta" href="calculator.html?decision='+encodeURIComponent(id)+'">افتح الحاسبة المستقلة ↗</a></div><div class="wf-kpis"><div><small>الوظائف المطابقة</small><b>'+g.list.length+'</b></div><div><small>الموظفون بالمهن المطابقة</small><b>'+g.total+'</b></div><div><small>السعوديون</small><b>'+g.saudi+'</b></div><div><small>غير السعوديين</small><b>'+g.other+'</b></div><div class="wf-gap"><small>'+note+'</small><b>'+gapText+'</b></div></div><div class="wf-explanation"><b>النسبة المرجعية:</b> '+clean(rate)+' · <b>حد العدد:</b> '+(p.min||"بحسب النشاط والجدول")+'<p>'+clean(g.reason)+'</p><p>'+clean(detail)+'</p></div><div class="wf-table-scroll"><table class="wf-table"><thead><tr><th>المهنة في ملف سالك</th><th>الإجمالي</th><th>سعودي</th><th>غير سعودي</th></tr></thead><tbody>'+(table||'<tr><td colspan="4">لا توجد مطابقة نصية معروفة للمجموعة</td></tr>')+'</tbody></table></div><p class="wf-caution">قد تتداخل المهن بين القرارات، ولا يجوز جمع الفجوات من عدة قرارات. الفجوة التقديرية لا تثبت وجود مخالفة ولا عدد التعيينات المطلوب نظامياً قبل فحص الرموز والكيان والأنشطة والأجر وشروط احتساب السعوديين.</p></section>';
}
window.SalicWorkforce={names,groups,policies,norm,titleIds,setRows,load,getRows,group,compact,render};
})();