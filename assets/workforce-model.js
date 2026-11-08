/* Aggregate workforce analysis: exact title hypotheses only, never an official compliance verdict. */
(function(){
"use strict";
const groups={
 admin:["مساعد إداري","موظف استقبال","كاتب موارد بشرية","سكرتير تنفيذي","أخصائي عمليات موارد بشرية","مدير عمليات موارد بشرية","أخصائي تواصل داخلي","أخصائي توظيف","أخصائي ارتباط وظيفي","أخصائي تخطيط قوى عاملة","مدير مواهب","مدير توظيف","مدير تنظيم إداري","أخصائي علاقات عامة"],
 procurement:["أخصائي مشتريات","مدير مشتريات","أخصائي أبحاث أسواق"],
 project:["مدير إدارة مشاريع","أخصائي إدارة مشاريع"],
 marketing:["أخصائي تسويق","مصمم جرافيك","أخصائي علاقات عامة","مدير دعاية وإعلان"],
 accounting:["محاسب","مدير مالي","مدير خزينة","مدير ميزانية","مدير مراجعة داخلية","مراجع داخلي","أخصائي حسابات ضرائب"],
 consulting:["أخصائي استشارات أعمال","أخصائي استشارات مالية"],
 legal:["أخصائي قانوني"],
 ict:["محلل نظم المعلومات","أخصائي علوم حاسب آلي","فني دعم تقنية معلومات","أخصائي دعم فني","مطور تطبيقات","محلل قاعدة بيانات","مهندس حاسب آلي","محلل بيانات"],
 engineers:["مهندس حاسب آلي"],
 sales:["وسيط سلع مستقبلية"]
};
const names={admin:"المهن الإدارية المساندة",procurement:"المشتريات",project:"إدارة المشاريع",marketing:"التسويق",accounting:"المحاسبة",consulting:"الاستشارات",legal:"المهن القانونية",ict:"تقنية المعلومات",engineers:"الهندسة",sales:"المبيعات"};
// Rates are indicative as of 2026-11-03, NOT a determination of legal scope.
// 'conditional' groups cannot safely use a combined workforce count to calculate a mandatory gap.
const policies={
 admin:{rate:100,min:1,kind:"general",detail:"تاريخ النفاذ يختلف حسب الرمز المهني وجدول المهنة؛ ليست كل المهن مستهدفة من تاريخ واحد."},
 procurement:{rate:70,min:3,kind:"general",rounding:"nearest",detail:"عدد العاملين في قائمة المهن الرسمية قد يختلف عن المسميات المطابقة في الملف."},
 project:{rate:70,min:3,kind:"future",effective:"2027-02-14",detail:"نسبة 70% تبدأ في 14 فبراير 2027 للمنشآت التي تضم 3 عاملين فأكثر في المهن الثلاث المستهدفة؛ هي فجوة تخطيطية مستقبلية وليست حكم امتثال حالي."},
 marketing:{rate:60,min:3,kind:"general",rounding:"nearest",detail:"يشترط أجر 5,500 ريال لاحتساب السعودي في مهن التسويق، مع مطابقة الرموز المهنية الرسمية؛ لا تتضمن بيانات الموظفين الحالية الأجور."},
 accounting:{rate:50,min:5,kind:"general",rounding:"nearest",detail:"50% اعتبارًا من 27 أكتوبر 2026 عند وجود 5 محاسبين فأكثر، مع اشتراط الاعتماد المهني والأجر (6,000 ريال للبكالوريوس أو 4,500 للدبلوم). فئة 3–4 محاسبين تبدأ في 2029؛ هذه الشروط غير مثبتة في بيانات الموظفين الحالية."},
 ict:{rate:null,min:5,kind:"grouped",detail:"نسبة 25% تُحتسب لكل مجموعة تخصصية بشكل مستقل، ولا يمكن جمع جميع موظفي التقنية في مقام واحد."},
 legal:{rate:70,min:1,kind:"general",rounding:"nearest",detail:"وفق الدليل المرفق، القرار يشمل جميع منشآت القطاع الخاص للمهن القانونية الأربع، ويشترط أجرًا خاضعًا للاشتراك لا يقل عن 5,500 ريال لاحتساب السعودي. الحكم النهائي يحتاج مطابقة رمز المهنة والأجر."},
 consulting:{rate:null,min:null,kind:"sector",detail:"يلزم التحقق من نطاق المهن الاستشارية وشروط المنشأة؛ المسمى وحده لا يثبت الانطباق."},
 engineers:{rate:30,min:5,kind:"threshold",detail:"تتطلب المهن الهندسية مطابقة الرمز والاعتماد والأجر؛ عدد المهندسين المطابقين للأسماء قد يقل عن العدد النظامي الفعلي."},
 sales:{rate:60,min:3,kind:"threshold",rounding:"nearest",detail:"وسيط سلع مستقبلية مدرج صراحة في جدول مهن المبيعات برمز 332401؛ يلزم إثبات أن الرمز المسجل لدى الجهات المختصة هو نفسه."}
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
  needed=policy.rounding==="nearest"?Math.round(total*policy.rate/100):Math.ceil(total*policy.rate/100);gap=Math.max(0,needed-saudi);
  status=policy.kind==="future"?"future":"estimate";
  reason=policy.kind==="future"?"فجوة تخطيطية للمرحلة القادمة فقط؛ ليست فجوة حالية مثبتة.":"فجوة حسابية افتراضية وفق طريقة التقريب المدونة في الدليل عند توفرها، وعلى المسميات المطابقة بالأسماء فقط. الأجور والاعتمادات والرموز الفردية غير مثبتة؛ ليست فجوة امتثال معتمدة.";
 }
 return {id,list,total,saudi,other,policy,needed,gap,status,reason};
}
function header(id){
 if(!rows)return '<div class="wf-topstrip wf-topstrip-loading">جارٍ تحميل المؤشرات…</div>';
 const g=group(id),r=official(id);
 const cards=r?
  [{label:"الموظفون",value:r.total},{label:"السعوديون",value:r.saudi},{label:"غير السعوديين",value:r.nonSaudi},{label:"الاحتياج",value:r.numericGap}]:
  [{label:"الموظفون",value:g.total},{label:"السعوديون",value:g.saudi},{label:"غير السعوديين",value:g.other},{label:"الفجوة التقديرية",value:g.gap===null?"—":g.gap}];
 const heading=r?"مؤشرات التوطين · "+r.asOf.split("-").reverse().join("/"):"مؤشرات القوى العاملة · 03/11/2026";
 const brief=r?"نسبة التوطين "+r.reportedSaudiPercent+"% · المستهدف "+r.targetPercent+"% · المصدر: وزارة الموارد البشرية والتنمية الاجتماعية":
 "المؤشرات مبنية على المسميات المهنية في بيانات سالك، وتخضع لمراجعة نطاق كل قرار.";
 return '<div class="wf-topstrip"><div class="wf-topstrip-title"><b>'+clean(heading)+'</b><small>'+(r?"المهن المشمولة ببيانات الوزارة في التاريخ المحدد":"بيانات سالك")+'</small></div><div class="wf-topstrip-grid">'+cards.map((v,i)=>'<div class="wf-topstrip-stat'+(i===3?' wf-topstrip-gap':'')+'"><small>'+clean(v.label)+'</small><strong>'+clean(v.value)+'</strong></div>').join("")+'</div><div class="wf-topstrip-note">'+clean(brief)+'</div></div>';
}
function compact(id){
 if(!rows)return '<div class="wf-compact">جارٍ تحميل المؤشرات…</div>';
 const g=group(id),r=official(id);
 if(r)return '<div class="wf-compact"><strong>مؤشرات وزارة الموارد البشرية · '+clean(r.asOf)+'</strong><span>'+r.total+' موظفًا · '+r.saudi+' سعودي · '+r.nonSaudi+' غير سعودي</span><span>التوطين '+r.reportedSaudiPercent+'% · الاحتياج <b>'+r.numericGap+'</b></span></div>';
 if(!g.total)return '<div class="wf-compact">لا تتوفر بيانات وظيفية مدرجة لهذا القرار.</div>';
 return '<div class="wf-compact"><strong>مؤشرات القوى العاملة</strong><span>'+g.total+' موظفًا · '+g.saudi+' سعودي · '+g.other+' غير سعودي</span><span>الفجوة التقديرية: <b>'+(g.gap===null?"قيد التحقق":g.gap)+'</b></span></div>';
}
function render(id){
 const g=group(id),p=g.policy,record=official(id);
 const rate=Number.isFinite(p.rate)?p.rate+"%":(id==="ict"?"25% لكل مجموعة":"وفق نطاق القرار");
 const others=id==="admin"?(rows||[]).filter(r=>norm(r.title)===norm("أخصائي إداري")):[];
 const primary=g.list.slice().sort((a,b)=>b.total-a.total||a.title.localeCompare(b.title,"ar"));
 const combined=primary.map(r=>({ ...r,classification:"ضمن قائمة التحليل" })).concat(others.map(r=>({...r,classification:"مهنة إدارية أخرى"})));
 const table=combined.map(r=>'<tr'+(r.classification==="مهنة إدارية أخرى"?' style="background:#f4f8fb"':'')+'><td>'+clean(r.title)+'</td><td>'+r.total+'</td><td>'+r.saudi+'</td><td>'+r.other+'</td><td><small'+(r.classification==="مهنة إدارية أخرى"?' style="color:#466b8a"':' style="color:#126d63"')+'>'+clean(r.classification)+'</small></td></tr>').join("");
 const body=table||'<tr><td colspan="5">لا توجد بيانات وظيفية متاحة لهذا القرار.</td></tr>';
 const items=combined.length;
 const total=combined.reduce((a,r)=>a+r.total,0);
 const saudi=combined.reduce((a,r)=>a+r.saudi,0);
 const nonSaudi=total-saudi;
 const subtitle=id==="admin"?"المسميات الوظيفية الإدارية المسجلة لدى سالك · 03/11/2026":"توزيع المسميات الوظيفية ذات الصلة · 03/11/2026";
 const attention=others.length?'<p class="wf-caution">يشمل الجدول «أخصائي إداري» ضمن المهن الإدارية الأخرى، دون احتسابه تلقائيًا ضمن المهن المستهدفة بالقرار. المرجع النظامي هو الرمز المهني المسجل.</p>':
 '<p class="wf-caution">يعتمد نطاق التوطين النهائي على الرموز المهنية المسجلة وشروط القرار.</p>';
 return '<section class="wf-section" aria-label="التوزيع الوظيفي">'+
 '<div class="wf-head"><div><h3>التوزيع الوظيفي</h3><p>'+clean(subtitle)+'</p></div><a class="wf-cta" href="calculator.html?decision='+encodeURIComponent(id)+'">حاسبة التوطين ↗</a></div>'+
 '<div class="wf-kpis"><div><small>المسميات الوظيفية</small><b>'+items+'</b></div><div><small>إجمالي العاملين بالجدول</small><b>'+total+'</b></div><div><small>السعوديون</small><b>'+saudi+'</b></div><div><small>غير السعوديين</small><b>'+nonSaudi+'</b></div><div class="wf-gap"><small>'+(record?"الاحتياج وفق بيانات الوزارة":"نسبة التوطين المستهدفة")+'</small><b>'+(record?record.numericGap:clean(rate))+'</b></div></div>'+
 '<div class="wf-table-scroll"><table class="wf-table"><thead><tr><th>المسمى الوظيفي</th><th>الإجمالي</th><th>السعوديون</th><th>غير السعوديين</th><th>التصنيف</th></tr></thead><tbody>'+body+'</tbody></table></div>'+
 attention+'</section>';
}
window.SalicWorkforce={names,groups,policies,norm,titleIds,setRows,setOfficialRecords,loadOfficial,official,load,getRows,group,header,compact,render};
})();