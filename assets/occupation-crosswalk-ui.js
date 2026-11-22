/* Read-only reference code table. No uploads, no names and no raw HTML insertion. */
(()=>{
"use strict";
const core=window.SalicCodeCrosswalk;
if(!core)return;
const $=id=>document.getElementById(id);
let db=null;
const elem=(tag,value,cls)=>{
 const x=document.createElement(tag);
 if(value!==null&&value!==undefined)x.textContent=String(value);
 if(cls)x.className=cls;
 return x;
};
const labels={guide_exact:"دليل قرار رسمي",catalog_partial:"فهرس مرجعي",archive_only:"تصنيف 2019",unmapped:"يحتاج رمز قوى"};
function sourceLink(url){
 const validated=core.safeSource(url);
 if(!validated)return null;
 const a=elem("a",validated.includes("hrsd.gov.sa")?"مصدر وزارة الموارد":"تصنيف 2019 المؤرشف");
 a.href=validated;a.target="_blank";a.rel="noopener noreferrer";a.referrerPolicy="no-referrer";
 return a;
}
function rowView(r){
 const tr=elem("tr");
 const title=elem("td");title.append(elem("strong",r.title));
 const counts=elem("td",r.total+" موظف");counts.append(elem("small",r.saudi+" سعودي / "+r.nonSaudi+" غير سعودي"));
 const codes=elem("td");if(r.candidateCodes.length){
   for(const c of r.candidateCodes){
    codes.append(elem("code",c.code,"code"));
    if(!c.matchesGuide)codes.append(elem("small","مرشح مرجعي غير مثبت في قوى"));
   }
 }else codes.append(elem("span","لم يتحدد رمز مطابق"));
 const status=elem("td");
 status.append(elem("span",labels[r.status],r.status==="archive_only"?"status legacy":r.status==="unmapped"?"status missing":r.status==="catalog_partial"?"status partial":"status"));
 const decisions=elem("td");
 const ids=[...new Set(r.candidateCodes.flatMap(c=>c.guideDecisionIds))];
 decisions.textContent=ids.length?ids.join(" · "):"لم تتأكد صلة بقرار محدد";
 const source=elem("td",null,"links");
 const urls=[...new Set(r.candidateCodes.flatMap(c=>c.sourceUrls))];
 for(const u of urls){
  const a=sourceLink(u);if(a)source.append(a);
 }
 if(!source.childNodes.length)source.append(elem("span","لم يثبت مصدر قابل للربط","note"));
 const guidance=elem("td",r.guidance,"note");
 tr.append(title,counts,codes,status,decisions,source,guidance);
 return tr;
}
function refresh(){
 if(!db)return;
 const current=core.filter(db,{status:$("status-filter").value,query:$("query").value});
 const frag=document.createDocumentFragment();
 for(const r of current)frag.append(rowView(r));
 if(!current.length){
  const tr=elem("tr"),td=elem("td","لا توجد مسميات مطابقة للبحث، غيّر التصفية.");td.colSpan=7;tr.append(td);frag.append(tr);
 }
 $("rows").replaceChildren(frag);
 $("status").textContent="عرض "+current.length+" من أصل "+db.items.length+" مسمى وظيفيًا · جميع رموز الموظفين المسجلة في قوى غير متحققة في هذا الملف.";
}
function csv(){
 if(!db)return;
 const selected=core.filter(db,{status:$("status-filter").value,query:$("query").value});
 const data=core.exportCsv(db,selected);
 const url=URL.createObjectURL(new Blob([data],{type:"text/csv;charset=utf-8"}));
 const a=document.createElement("a");a.href=url;a.download="SALIC-occupation-reference-crosswalk-2026-11-22.csv";
 document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);
}
async function init(){
 try{
  const response=await fetch("data/salic-occupation-crosswalk.json",{cache:"no-store"});
  if(!response.ok)throw Error("crosswalk_not_loaded");
  const file=await response.json();
  core.validate(file);
  db=file;
  $("m-titles").textContent=file.summary.titles;
  $("m-guide").textContent=file.summary.byStatus.guide_exact.titles;
  $("m-partial").textContent=file.summary.byStatus.catalog_partial.titles;
  $("m-legacy").textContent=file.summary.byStatus.archive_only.titles;
  $("m-missing").textContent=file.summary.byStatus.unmapped.titles;
  $("query").addEventListener("input",refresh);
  $("status-filter").addEventListener("change",refresh);
  $("export").disabled=false;
  $("export").addEventListener("click",csv);
  const incoming=new URLSearchParams(window.location.search).get("q");
  if(incoming)$("query").value=incoming.slice(0,110);
  refresh();
 }catch{
  $("status").classList.add("error");
  $("status").textContent="تعذر تحميل ملف مطابقة الرموز أو التحقق من سلامته. لم تُنشأ نتائج مبنية على بيانات غير مكتملة.";
 }
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
else init();
})();
