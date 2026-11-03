(function(){
"use strict";
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let decisions=[];
const names=window.SalicWorkforce.names,policies=window.SalicWorkforce.policies;
const currentDecision=()=>$("decision").value;
function selection(){
 const id=currentDecision(),p=policies[id],d=decisions.find(x=>x.id===id);
 if(!p){$("rate-help").textContent="حساب حر: النسبة التي تدخلها اختيارية ولا تُعد نسبة نظامية لأي قرار.";$("salic-help").textContent="اختر قراراً لتحميل أعداد المهن المطابقة لبيانات سالك.";$("salic-counts").replaceChildren();return}
 const g=window.SalicWorkforce.group(id);
 $("rate-help").textContent=(d?d.title+": ":"")+(p.rate===null?"لا توجد نسبة مجمعة موثوقة؛ أدخل نسبة افتراضية فقط.":p.rate+"% نسبة مرجعية مشروطة.")+(p.kind==="future"?" مرحلة 14 فبراير 2027 القادمة؛ ليست سارية الآن.":"")+" "+p.detail;
 $("salic-help").textContent="هذه الأعداد مأخوذة فقط من مسميات المهن المطابقة نصياً في قائمة سالك؛ وليست كل المهن المستهدفة المثبتة رسمياً.";
 $("salic-counts").innerHTML=["المطابقون: "+g.total,"سعوديون: "+g.saudi,"غير سعوديين: "+g.other,"المهن: "+g.list.length].map(t=>"<span>"+esc(t)+"</span>").join("");
}
function selectDecision(){
 const p=policies[currentDecision()];
 if(p)$("rate").value=Number.isFinite(p.rate)?p.rate:"";
 else $("rate").value="50";
 selection();calculate();
}
function calculate(){
 const t=Number($("total").value),s=Number($("saudi").value),r=Number($("rate").value);
 const valid=$("rate").value!==""&&$("total").value!==""&&$("saudi").value!==""&&Number.isInteger(t)&&Number.isInteger(s)&&Number.isFinite(r)&&t>=0&&s>=0&&s<=t&&t<=100000&&r>=0&&r<=100;
 $("error").hidden=valid;
 $("result").hidden=!valid;
 if(!valid){$("error").textContent="أدخل إجمالي وسعوديين بأعداد صحيحة غير سالبة، بشرط ألا يزيد السعوديون عن الإجمالي، ونسبة بين 0 و100.";return}
 const required=Math.ceil(t*r/100),gap=Math.max(0,required-s);
 $("out-saudi").textContent=s;$("out-other").textContent=t-s;$("out-required").textContent=required;$("out-gap").textContent=gap;
 const id=currentDecision(),p=policies[id];
 const qualifier=!p?"هذا حساب حر، ولا يمثل نسبة قانونية ملزمة.":p.kind==="future"?"النسبة المختارة من المرحلة القادمة (2027). الفجوة للتخطيط فقط ولا تعتبر مخالفة اليوم.":p.kind==="grouped"||p.kind==="sector"?"لا يمكن احتساب فجوة إلزامية مجمعة لهذه المجموعة؛ هذا سيناريو اختياري فقط.":t<p.min?"العدد المدخل أقل من حد نطاق القرار المسجل؛ النتيجة افتراضية وليست دليلاً على سريان القرار.":"النتيجة حسابية فقط؛ لا تثبت نسبة امتثال الشركة قبل مراجعة الرموز والكيان والأجر والضوابط.";
 $("out-note").textContent=(gap?"قد تحتاج نظرياً إلى "+gap+" سعوديين إضافيين للوصول للنسبة المختارة وفق هذا المثال. ":"لا تظهر فجوة رياضية في المثال المختار. ")+qualifier;
}
function loadSalic(){
 const id=currentDecision();if(id==="custom"){$("rate-help").textContent="اختر قراراً أولاً لتحميل أعداد موظفي سالك المرتبطين به.";return}
 const g=window.SalicWorkforce.group(id);$("total").value=g.total;$("saudi").value=g.saudi;calculate();
}
async function init(){
 try{
  const [_,r]=await Promise.all([window.SalicWorkforce.load(),fetch("data/decisions.json")]);
  if(!r.ok)throw Error("missing decisions");
  const db=await r.json();decisions=(db.decisions||[]).filter(d=>policies[d.id]);
  $("decision").innerHTML='<option value="custom">حساب حر — أنا أحدد النسبة</option>'+decisions.map(d=>'<option value="'+esc(d.id)+'">'+esc(d.title)+'</option>').join("");
  const desired=new URLSearchParams(window.location.search).get("decision");
  if(desired&&policies[desired]){$("decision").value=desired;selectDecision();loadSalic();}
  else{selection();calculate();}
 }catch(err){$("rate-help").textContent="تعذر تحميل بيانات سالك، لكن الحاسبة الحرة ما زالت تعمل.";calculate();}
}
["total","saudi","rate"].forEach(id=>$(id).addEventListener("input",calculate));
$("decision").addEventListener("change",selectDecision);
$("load-salic").addEventListener("click",loadSalic);
$("reset").addEventListener("click",()=>{$("decision").value="custom";$("rate").value=50;$("total").value=10;$("saudi").value=5;selection();calculate()});
init();
})();