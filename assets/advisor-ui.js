/* Render the read-only evidence advisor without HTML injection or remote writes. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const api=window.SalicEvidenceAdvisor;
const workforceModel=window.SalicWorkforce;
if(!api||!workforceModel)return;
const make=(tag,value,cls)=>{
  const node=document.createElement(tag);
  if(value!==undefined&&value!==null)node.textContent=String(value);
  if(cls)node.className=cls;
  return node;
};
const add=(node,...children)=>node.append(...children);
function safeOfficialHref(url,label){
  const verified=api.publicLink(url);
  if(!verified)return make('small','لم يُثبت رابط مصدر رسمي');
  const a=make('a',label,'evidence-link');
  a.href=verified;
  a.rel='noopener noreferrer';
  a.referrerPolicy='no-referrer';
  a.target='_blank';
  return a;
}
function localDate(){
  const fields=Object.fromEntries(new Intl.DateTimeFormat('en-US',{
    timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(new Date()).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  return fields.year+'-'+fields.month+'-'+fields.day;
}
function labelGuide(docState){
  return ({
    public_guide_monitored:'دليل PDF عام ضمن الفحص النصي',
    restricted_manual_review:'دليل مقيّد — تحقق بشري',
    published_draft:'مسودة منشورة — ليست دليلًا معتمدًا',
    guide_not_in_public_monitor:'لا يوجد دليل PDF ضمن الرصد العام'
  })[docState]||'مصدر غير مكتمل';
}
let summary=null;
function makeCard(rec){
  const article=make('article',null,'card');
  const head=make('div',null,'card-top');
  const audited=rec.auditStatus==='reviewed';
  const status=make('span',audited?'مراجعة أساسية':'تدقيق تفصيلي مطلوب','chip '+(audited?'':'warn'));
  const doc=make('span',labelGuide(rec.docState),'chip '+(rec.docState==='public_guide_monitored'?'':'muted'));
  add(head,status,doc);
  add(article,head,make('h3',rec.title));
  add(article,make('small','رقم القرار المرجعي: '+rec.number+' · النسبة المذكورة: '+rec.rate));
  add(article,make('p',rec.relation));
  if(rec.preview){
    const stats=make('div',null,'facts');
    add(stats,make('span','مسميات متصلة: '+rec.preview.total),
      make('span','سعوديون: '+rec.preview.saudi),
      make('span','غير سعوديين: '+rec.preview.other));
    if(Number.isInteger(rec.preview.gap)){
      add(stats,make('span','فجوة افتراضية للمسميات: '+rec.preview.gap));
    }
    add(article,stats);
  }
  add(article,make('p',rec.proposedAdvice,'gap-warning'));
  if(rec.officialCounter){
    add(article,make('small','مؤشر وزارة مؤرخ ('+rec.officialCounter.asOf+'): '+rec.officialCounter.total+
      ' موظفًا واحتياج عددي منشور '+rec.officialCounter.numericGap+
      '، ولا يغني عن التحقق من النطاق وتاريخ اللقطة.'));
  }
  const details=make('details');
  add(details,make('summary','عرض شروط القرار والأدلة والمتطلبات'));
  add(details,make('h4','المرجع الوزاري'));
  const links=make('div');
  if(rec.source)add(links,safeOfficialHref(rec.source,'صفحة المصدر'));
  if(rec.guide)add(links,safeOfficialHref(rec.guide,rec.docState==='published_draft'?'المسودة المنشورة':'دليل PDF'));
  if(rec.ruleSource&&rec.ruleSource!==rec.source)add(links,safeOfficialHref(rec.ruleSource,'مرجع شروط الانطباق'));
  add(details,links,make('p','حالة التدقيق: '+(audited?'مراجعة أساسية':'يحتاج مراجعة')+'؛ '+rec.auditNote));
  add(details,make('h4','نقاط التحقق الخاصة بالقرار'));
  const checklist=make('ul');
  rec.checks.forEach(x=>checklist.append(make('li',x)));
  if(!rec.checks.length)checklist.append(make('li','تحديد شروط القرار من دليل الوزارة'));
  add(details,checklist,make('h4','المستندات والخطوات المطلوبة'));
  const tasks=make('ul');
  rec.tasks.forEach(t=>tasks.append(make('li',t.text)));
  add(details,tasks);
  if(rec.graceRecords.length){
    add(details,make('h4','فترات السماح المسجلة'));
    const list=make('ul');
    rec.graceRecords.forEach(x=>{
      const li=make('li',x.scope+' — '+x.duration+
        (x.status==='official'?' (من مصدر رسمي)':' (مذكورة في سجل الرصد؛ يلزم توثيق المدة)'));
      if(x.source)li.append(safeOfficialHref(x.source,'المرجع'));
      list.append(li);
    });
    add(details,list);
  }else add(details,make('p','لا توجد مدة سماح موثقة في سجلنا؛ هذا لا يعني عدم وجود مهلة.'));
  if(rec.upcoming.length){
    add(details,make('h4','مواعيد قادمة موثقة في السجل'));
    const stages=make('ul');
    rec.upcoming.forEach(x=>{
      const li=make('li',x.date+' — '+x.label+' · '+x.rate);
      li.append(safeOfficialHref(x.source,'المصدر'));
      stages.append(li);
    });
    add(details,stages);
  }
  add(details,make('p','لا توجد نتيجة انطباق نهائية: يلزم تأكيد أنشطة وترخيص SALIC والرموز الفعلية والأجر والاعتماد عند الاقتضاء.'));
  article.append(details);
  return article;
}
function draw(){
  if(!summary)return;
  const q=$('query').value.trim().toLocaleLowerCase('ar');
  const filter=$('filter').value;
  const sort=$('sort').value;
  let matches=summary.records.filter(rec=>{
    if(filter==='pending'&&rec.auditStatus==='reviewed')return false;
    if(filter==='reviewed'&&rec.auditStatus!=='reviewed')return false;
    if(filter==='workforce'&&!rec.preview)return false;
    return !q||[rec.title,rec.number,rec.gate,...rec.checks].join(' ').toLocaleLowerCase('ar').includes(q);
  });
  matches=matches.slice().sort((a,b)=>sort==='name'?
    a.title.localeCompare(b.title,'ar') :
    a.priority-b.priority||Number(a.auditStatus==='reviewed')-Number(b.auditStatus==='reviewed')||a.title.localeCompare(b.title,'ar'));
  const frag=document.createDocumentFragment();
  matches.forEach(x=>frag.append(makeCard(x)));
  if(!matches.length)frag.append(make('p','لا توجد قرارات مطابقة للتصفية. غيّر البحث أو اختر جميع القرارات.'));
  $('cards').replaceChildren(frag);
  $('status').textContent='عرض '+matches.length+' قرارًا من أصل '+summary.stats.decisions+
    '؛ جميع النتائج استرشادية وتتطلب مطابقة قوى وشروط الدليل.';
}
async function fetchJson(path){
  const res=await fetch(path,{cache:'no-store'});
  if(!res.ok)throw Error('source_not_ready');
  return res.json();
}
async function init(){
  try{
    const keys={
      decisions:'data/decisions.json',
      applicability:'data/salic-applicability.json',
      activities:'data/salic-activities.json',
      workforce:'data/salic-workforce.json',
      pdfSources:'data/guide-pdf-sources.json',
      grace:'data/grace-periods.json'
    };
    const names=Object.keys(keys);
    const vals=await Promise.all(names.map(x=>fetchJson(keys[x])));
    const data=Object.fromEntries(names.map((x,i)=>[x,vals[i]]));
    workforceModel.setRows(data.workforce.rows,data.workforce.summary);
    try{
      const counters=await fetchJson('data/official-inspections.json');
      if(Array.isArray(counters.records))workforceModel.setOfficialRecords(counters.records);
    }catch{
      // Counter source is optional. Missing it must not create fake compliance.
    }
    summary=api.build({...data,model:workforceModel,today:localDate()});
    $('m-total').textContent=summary.stats.decisions;
    $('m-reviewed').textContent=summary.stats.audited;
    $('m-pending').textContent=summary.stats.pending;
    $('m-pdfs').textContent=summary.stats.publicGuides;
    $('snapshot').textContent='لقطة الموظفين '+summary.workforce.asOf+' — '+summary.workforce.total+
      ' موظفًا ('+summary.workforce.saudi+' سعوديًا، '+summary.workforce.nonSaudi+
      ' غير سعودي)، '+summary.snapshotAgeDays+
      ' يومًا منذ تاريخ اللقطة وفق توقيت الرياض. هذا العدد لا يمثل بيانات قوى الحالية.';
    ['query','filter','sort'].forEach(id=>$(id).addEventListener(id==='query'?'input':'change',draw));
    $('print').addEventListener('click',()=>window.print());
    draw();
  }catch{
    $('status').classList.add('error');
    $('status').textContent='تعذّر تحميل مصادر المساعد؛ لن تُعرض نتائج أو أحكام غير موثقة. تأكد من الاتصال أو جرّب تحديث الصفحة.';
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
})();
