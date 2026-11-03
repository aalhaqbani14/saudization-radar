
(()=>{'use strict';
const $=id=>document.getElementById(id);
const latin=s=>String(s??'').replace(/[٠-٩۰-۹]/g,c=>String.fromCharCode(48+(c.charCodeAt(0)>=0x06f0?c.charCodeAt(0)-0x06f0:c.charCodeAt(0)-0x0660)));
const esc=s=>latin(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rate=s=>esc(s).replace(/(\d+(?:\.\d+)?%)/g,'<bdi dir="ltr">$1</bdi>');
const href=s=>{try{let u=new URL(s);return u.protocol==='https:'&&/(^|\.)hrsd\.gov\.sa$/.test(u.hostname)?u.href:'#'}catch{return '#'}};
const now=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
let occupations=[],mapping=new Map();
function check(){
const code=latin($('app-code').value).trim(),totalText=$('app-total').value,saudiText=$('app-saudi').value,activity=$('app-activity').value,result=$('app-result');
const o=occupations.find(x=>x.code===code)||occupations.find(x=>x.title===code);
if(!code){result.innerHTML='<div class="app-empty">اختر رمزاً مهنياً من فهرس المهن، ثم أدخل أعداداً افتراضية لتجربة المحرك.</div>';return}
if(!o){result.innerHTML='<div class="app-empty">هذا الرمز غير موجود في الفهرس الحالي. عدم العثور عليه لا يعني أن المهنة غير خاضعة لقرار توطين.</div>';return}
const total=Number(totalText),saudi=Number(saudiText);
if(totalText===''||saudiText===''||!Number.isInteger(total)||!Number.isInteger(saudi)||total<0||saudi<0||saudi>total||total>100000){result.innerHTML='<div class="app-empty">أدخل أعداداً صحيحة. يجب أن يكون عدد السعوديين أقل من أو يساوي إجمالي العاملين في المهن المستهدفة.</div>';return}
let quality=o.evidenceQuality==='current'?'جدول حديث':o.evidenceQuality==='historical'?'دليل سابق':'مرجع مسودة';
let findings=o.decisionIds.map(id=>mapping.get(id)).filter(Boolean).map(d=>{
let min=(d.min||'').includes('عامل واحد فأكثر')?1:((d.min||'').match(/(\d+)\s*عامل/)||[])[1];
min=min===undefined?null:Number(min);
let phased=(Array.isArray(d.history)&&d.history.length>1)||(Array.isArray(d.phases)&&d.phases.length>0),upcoming=d.effective&&d.effective>now;
let estimate=!phased&&!upcoming&&Number.isFinite(d.pct)&&min!==null&&total>=min?Math.ceil(total*d.pct/100):null;
let need=estimate!==null?Math.max(0,estimate-saudi):null;
let reasons=[];
reasons.push(min===null?'شروط العدد تحتاج مراجعة في الدليل.':total<min?'العدد المدخل دون الحد العددي المذكور في هذا الملخص، ولا يستبعد ذلك قرارات أخرى.':'العدد يحقق الحد العددي المعلن مبدئياً، لكن بقية الشروط لم تتحقق بعد.');
if(phased)reasons.push('القرار متعدد المراحل؛ حدد المرحلة والنشاط وشروط العدد قبل احتساب أي فجوة.');
if(upcoming)reasons.push('بدء نفاذ القرار العام ما زال مستقبلياً.');
if(activity&&activity!==d.category)reasons.push('تصنيف النشاط المختار مختلف عن التصنيف هنا؛ هذا لا يثبت عدم انطباق القرار.');
if(d.wage)reasons.push('هناك اشتراطات أجر واحتساب: '+d.wage);
if(o.evidenceQuality!=='current')reasons.push('توثيق الرمز أقدم أو مسودة؛ يلزم الرجوع للجدول المعتمد الأحدث.');
let historyMarkup=(window.SaudizationHistory&&d.history)?window.SaudizationHistory.compact(d):'';
let calc=need===null?'<div class="app-impact-muted">لا تُحسب فجوة تلقائية لهذا القرار لأن شروطه أو مراحله لم تُحسم.</div>':'<div class="app-impact"><div><small>نسبة تقريبية</small><strong>'+d.pct+'%</strong></div><div><small>السعوديون المطلوبون نظرياً</small><strong>'+estimate+'</strong></div><div><small>الفجوة الحسابية</small><strong>'+need+'</strong></div></div>';
return '<article class="app-finding"><div class="app-finding-top"><h4>'+esc(d.title)+'</h4><span class="badge '+(d.audit?.status==='reviewed'?'':'amber')+'">'+(d.audit?.status==='reviewed'?'مراجعة أساسية':'تدقيق مطلوب')+'</span></div><p>النسبة المنشورة: '+rate(d.rate)+' · تاريخ البدء: '+esc(d.effective||'حسب الدليل')+'</p>'+historyMarkup+calc+'<ul>'+reasons.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ul><a class="app-official" href="'+href(d.source)+'" target="_blank" rel="noopener noreferrer">فتح المرجع الحكومي ↗</a></article>'
}).join('');
result.innerHTML='<div class="app-result-head"><div><small>نتيجة سيناريو تعليمي · لا تمثل حكم امتثال</small><h3>'+esc(o.title)+' <bdi dir="ltr">'+esc(o.code)+'</bdi></h3></div><span class="badge">'+quality+'</span></div><div class="app-warning">انطباق القرار يحتاج التحقق من الرمز والنشاط وشروط الكيان والحد الأدنى للأجور والاستثناءات قبل أي استنتاج نظامي. المعلومات والأرقام المدخلة تبقى داخل المتصفح، ولا تُرسل إلى خادم.</div><div class="app-findings">'+(findings||'<div class="app-empty">لا توجد مجموعة قرار مرتبطة في هذا الفهرس؛ قد توجد قرارات أخرى غير مفهرسة.</div>')+'</div>';
}
async function init(){
try{let [a,b]=await Promise.all([fetch('data/occupations.json?x='+Date.now()),fetch('data/decisions.json?x='+Date.now())]);if(!a.ok||!b.ok)throw Error('network');let [o,d]=await Promise.all([a.json(),b.json()]);occupations=o.occupations||[];mapping=new Map((d.decisions||[]).map(x=>[x.id,x]));$('app-activity').innerHTML='<option value="">غير محدد / نشاط عام</option>'+[...new Set((d.decisions||[]).map(x=>x.category))].sort().map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join('');$('app-availability').textContent='محرك استرشادي مبني على '+occupations.length+' رمزاً مهنياً و'+mapping.size+' مجموعة قرار.';check()}catch{$('app-result').innerHTML='<div class="app-empty">تعذر تحميل قواعد المعلومات. حدّث الصفحة بعد اكتمال نشر GitHub Pages.</div>'}
}
$('app-evaluate').addEventListener('click',check);
$('app-code').addEventListener('input',e=>e.target.value=latin(e.target.value));
document.querySelectorAll('[data-app-example]').forEach(b=>b.addEventListener('click',()=>{let [code,total,saudi]=b.dataset.appExample.split(',');$('app-code').value=code;$('app-total').value=total;$('app-saudi').value=saudi;$('app-activity').value='';check()}));
init();
})();