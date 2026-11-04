/* Universal SALIC roster view: every profession is counted, independent of regulatory mapping. */
(function(){
"use strict";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const number=v=>Number(v).toLocaleString("en-US");
const pct=(a,b)=>b?(100*a/b).toFixed(1)+"%":"—";
const clean=v=>window.SalicWorkforce.norm(v);
const labels=window.SalicWorkforce.names;
function csv(v){let s=String(v??"");if(/^[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
function makeDownload(rows){
 const data=[["المسمى المهني","الإجمالي","السعوديون","غير السعوديين","نسبة السعوديين","القرارات المحتملة في الفهرس","حالة الربط"],...rows.map(r=>[r.title,r.total,r.saudi,r.other,pct(r.saudi,r.total),r.decisionIds.map(id=>labels[id]).join("؛ "),r.decisionIds.length?"مطابقة أولية بالمسمى":"غير مرتبط بقرار في الفهرس الحالي"])];
 const blob=new Blob(["\ufeff"+data.map(row=>row.map(csv).join(",")).join("\r\n")],{type:"text/csv;charset=utf-8"});
 const href=URL.createObjectURL(blob),a=document.createElement("a");a.href=href;a.download="salic-all-75-professions-2026-11-03.csv";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1200);
}
function create(root,rows){
 const id=root.dataset.salicRoles||"workforce";
 const sorted=rows.slice().sort((a,b)=>b.total-a.total||a.title.localeCompare(b.title,"ar"));
 const totals=sorted.reduce((s,r)=>({total:s.total+r.total,saudi:s.saudi+r.saudi,other:s.other+r.other}),{total:0,saudi:0,other:0});
 root.innerHTML='<div class="srb-head"><div><h2>جميع مهن موظفي سالك</h2><p>تُحتسب كل مهنة في إجمالي القوى العاملة، سواء ارتبطت بقرار توطين أم لا.</p></div><a href="salic.html#workforce" class="srb-link">التفاصيل الكاملة ↗</a></div>'+
 '<div class="srb-summary"><div><small>إجمالي الموظفين</small><strong>'+number(totals.total)+'</strong></div><div><small>السعوديون</small><strong>'+number(totals.saudi)+'</strong></div><div><small>غير السعوديين</small><strong>'+number(totals.other)+'</strong></div><div><small>كل المهن</small><strong>'+number(sorted.length)+'</strong></div></div>'+
 '<div class="srb-search"><input type="search" data-role="query" aria-label="ابحث عن مهنة بسالك" placeholder="ابحث في جميع المهن مثل أخصائي إداري أو مساعد إداري"><select data-role="filter" aria-label="تصفية المهن"><option value="all">كل المهن دون استثناء</option><option value="linked">لها قرار محتمل</option><option value="notlinked">لم تُربط بقرار في الفهرس</option><option value="nonsaudi">بها غير سعوديين</option></select><select data-role="sort" aria-label="الترتيب"><option value="count">الأعلى عدداً</option><option value="other">الأعلى غير سعوديين</option><option value="alpha">أبجدياً</option></select><button type="button" data-role="export">تصدير CSV</button></div>'+
 '<div class="srb-caption" data-role="caption" aria-live="polite"></div>'+
 '<div class="srb-scroll"><table class="srb-table"><thead><tr><th>المهنة</th><th>الموظفون</th><th>السعوديون</th><th>غير السعوديين</th><th>نسبة السعوديين</th><th>حالة ارتباط القرار</th></tr></thead><tbody data-role="rows"></tbody></table></div>'+
 '<p class="srb-footnote">الأعداد من ملف موظفي سالك بعد حذف التكرارات المتطابقة، بتاريخ 3 نوفمبر 2026. تصنيف الربط مبدئي بالمسمى وليس بالرمز المسجل في قوى؛ عدم الربط بقرار من الفهرس لا يعني استثناء المهنة من جميع متطلبات التوطين. قد تُطابق المهنة أكثر من قرار، لكن لا يُكرر الموظف في الإجمالي العام.</p>';
 const el=q=>root.querySelector('[data-role="'+q+'"]');
 let shown=[];
 function draw(){
  let q=clean(el("query").value),filter=el("filter").value,sort=el("sort").value;
  shown=sorted.filter(r=>(!q||clean(r.title).includes(q))&&(filter==="all"||filter==="linked"&&r.decisionIds.length||filter==="notlinked"&&!r.decisionIds.length||filter==="nonsaudi"&&r.other>0));
  shown.sort((a,b)=>sort==="alpha"?a.title.localeCompare(b.title,"ar"):sort==="other"?b.other-a.other||b.total-a.total:b.total-a.total||a.title.localeCompare(b.title,"ar"));
  const subtotal=shown.reduce((s,r)=>s+r.total,0);
  el("caption").textContent="النتائج: "+number(shown.length)+" من "+number(sorted.length)+" مهنة، تضم "+number(subtotal)+" موظفاً. الإجمالي العام ثابت: "+number(totals.total)+" موظفاً.";
  el("rows").innerHTML=shown.length?shown.map(r=>'<tr><td><strong>'+esc(r.title)+'</strong></td><td class="srb-num">'+number(r.total)+'</td><td class="srb-num">'+number(r.saudi)+'</td><td class="srb-num">'+number(r.other)+'</td><td class="srb-num">'+pct(r.saudi,r.total)+'</td><td>'+(r.decisionIds.length?'<span class="srb-tag">ربط مبدئي: '+esc(r.decisionIds.map(id=>labels[id]||id).join("، "))+'</span>':'<span class="srb-tag srb-muted">غير مربوط بقرار في الفهرس الحالي</span>')+'</td></tr>').join(""):'<tr><td colspan="6" class="srb-empty">لا توجد مهن مطابقة للتصفية المختارة.</td></tr>';
 }
 for(const control of ["query","filter","sort"])el(control).addEventListener(control==="query"?"input":"change",draw);
 el("export").addEventListener("click",()=>makeDownload(shown));
 draw();
}
async function init(){
 const roots=[...document.querySelectorAll("[data-salic-roles]")];if(!roots.length)return;
 try{const rows=await window.SalicWorkforce.load();roots.forEach(root=>create(root,rows));}
 catch(e){roots.forEach(root=>{root.textContent="تعذر تحميل جميع المهن من ملف القوى العاملة المجمّع. راجع مصدر البيانات.";root.classList.add("srb-error")});}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();