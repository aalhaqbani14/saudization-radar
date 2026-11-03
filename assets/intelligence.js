
'use strict';
(function(){
 const $=id=>document.getElementById(id);
 const digits=v=>String(v??'').replace(/[٠-٩۰-۹]/g,c=>String.fromCharCode(48+(c.charCodeAt(0)>0x06ef?c.charCodeAt(0)-0x06f0:c.charCodeAt(0)-0x0660)));
 const esc=v=>digits(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]));
 const norm=v=>digits(v).toLowerCase().replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[\u064B-\u065F\u0670ـ]/g,'').replace(/\s+/g,' ').trim();
 const locale='ar-SA-u-ca-gregory-nu-latn';
 const fmt=new Intl.DateTimeFormat(locale,{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'});
 const dayFormat=v=>v&&/^\d{4}-\d{2}-\d{2}$/.test(v)?fmt.format(new Date(v+'T12:00:00Z')):'تاريخ بحسب الدليل';
 const dateNow=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const codeQuality=v=>v==='current'?['جدول حديث','current']:v==='historical'?['دليل أقدم','old']:['مسودة منشورة','draft'];
 const url=v=>{try{let u=new URL(v);return u.protocol==='https:'&&/(^|\.)hrsd\.gov\.sa$/.test(u.hostname)?u.href:'#'}catch{return '#'}};
 let occupations=[],decisions=[],decisionMap=new Map(),selected=new Set(),view='codes',fullList=false,events=[];
 try{selected=new Set(JSON.parse(localStorage.getItem('saudization-radar-saved')||'[]'))}catch{}
 function persist(){try{localStorage.setItem('saudization-radar-saved',JSON.stringify([...selected]))}catch{} $('k-selected').textContent=selected.size;}
 function score(o,q){const n=norm(q),title=norm(o.title),code=digits(o.code);if(!n)return 1;if(code===n)return 1000;if(/^\d+$/.test(n)&&code.startsWith(n))return 550;if(title===n)return 450;if(title.startsWith(n))return 400;if(title.includes(n))return 350;const words=n.split(' ').filter(Boolean);if(words.every(t=>title.includes(t)))return 275;if(code.includes(n))return 220;const related=o.decisionIds.map(id=>norm(decisionMap.get(id)?.title||'')).join(' ');if(related.includes(n))return 85;return 0;}
 function getMatch(){const q=$('profession-query').value.trim();let rows=occupations.map(o=>({o,score:score(o,q)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.o.title.localeCompare(b.o.title,'ar'));return {q,rows:fullList||q?rows:rows.slice(0,8)};}
 function linkedDecisions(o){return o.decisionIds.map(id=>decisionMap.get(id)).filter(Boolean);}
 function occupationCard(o,rank){
   const lab=codeQuality(o.evidenceQuality),decisionLinks=linkedDecisions(o);
   let tag=lab[1]==='current'?'badge':lab[1]==='old'?'badge amber':'badge red';
   const date=o.primaryEffective?'<span>بدء تطبيق المهنة في قرار الإدارة المساندة: <b>'+esc(dayFormat(o.primaryEffective))+'</b></span>':'<span>تاريخ التطبيق يتحدد بحسب القرار والنشاط.</span>';
   return '<article class="occupation-card"><div class="occupation-head"><span class="code-tag" dir="ltr">'+esc(o.code)+'</span><span class="'+tag+'">'+esc(lab[0])+'</span></div><h3>'+esc(o.title)+'</h3><div class="secondary">'+date+'</div><div class="occupation-decisions">'+decisionLinks.map(d=>'<button type="button" data-decision="'+esc(d.id)+'">'+esc(d.title)+' · '+esc(d.rate)+'</button>').join('')+'</div><p class="secondary">'+(o.decisionIds.length>1?'⚠️ مرتبط بأكثر من قرار محتمل؛ لا تعتمد النسبة الأعلى إلا بعد فحص النطاق وشروط التداخل.':esc(o.notes||'التحقق من نطاق القرار ضروري.'))+'</p><div class="occupation-foot"><span class="secondary">'+esc(o.sourceTable||o.verified)+'</span><a href="'+url(o.source)+'" target="_blank" rel="noopener noreferrer">جدول إثبات الرمز ↗</a></div></article>';
 }
 function drawCodes(){
   const {q,rows}=getMatch();$('occupations').innerHTML=rows.length?rows.map(({o,score})=>occupationCard(o,score)).join(''):'<div class="empty"><strong>ما حصلنا رمزاً مطابقاً في الفهرس الحالي.</strong><p>هذا لا يعني أن المهنة غير مستهدفة بالتوطين؛ الفهرس محدود ويُوسّع تدريجياً.</p></div>';
   $('occupation-results').textContent=q?'نتائج البحث: '+digits(rows.length)+' مهنة · المطابقة بالرمز أولوية ثم بمسمى المهنة':'استعراض '+digits(rows.length)+' من أصل '+digits(occupations.length)+' رمزاً مدخلاً في الفهرس';
   $('load-all').textContent=fullList?'عرض المختصر':'عرض جميع الرموز';
   $('occupations').querySelectorAll('[data-decision]').forEach(b=>b.addEventListener('click',()=>openDecision(b.dataset.decision)));
 }
 function buildTimeline(){
   events=[];
   decisions.forEach(d=>{
     const stages=(d.phases||[]).filter(p=>/^\d{4}-\d{2}-\d{2}$/.test(p.date));
     if(stages.length){stages.forEach(p=>events.push({date:p.date,title:d.title,rate:p.rate,label:p.label,id:d.id,category:d.category}))}
     else if(/^\d{4}-\d{2}-\d{2}$/.test(d.effective)){events.push({date:d.effective,title:d.title,rate:d.rate,label:'تاريخ بدء التطبيق المعروض في الملخص',id:d.id,category:d.category})}
   });
   events.sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title,'ar'));
 }
 function drawTimeline(){
   const filter=$('timeline-filter').value,cat=$('timeline-sector').value;
   const list=events.filter(e=>(!cat||e.category===cat)&&(filter==='all'||(filter==='future'?e.date>=dateNow:e.date<dateNow)));
   $('timeline-caption').textContent='عرض '+digits(list.length)+' موعداً مرحلياً · المراحل لا تعني أن جميع المنشآت تخضع للنسبة نفسها';
   $('timeline-list').innerHTML=list.length?list.map(e=>{
     const future=e.date>=dateNow;
     const distance=Math.round((Date.parse(e.date+'T00:00:00Z')-Date.parse(dateNow+'T00:00:00Z'))/86400000);
     const label=future?(distance===0?'اليوم':'بعد '+digits(distance)+' يوم'):'تاريخ سابق';
     return '<article class="time-item"><div class="time-date">'+esc(dayFormat(e.date))+'</div><div><h3>'+esc(e.title)+'</h3><small>'+esc(e.label)+' · '+esc(e.rate)+'</small></div><div class="time-meta '+(future?'':'past')+'">'+esc(label)+' <button type="button" data-decision="'+esc(e.id)+'" style="border:0;background:transparent;color:#0b7770;cursor:pointer">↗</button></div></article>'
   }).join(''):'<div class="empty">لا توجد مواعيد ضمن الفلتر المختار.</div>';
   $('timeline-list').querySelectorAll('[data-decision]').forEach(b=>b.addEventListener('click',()=>openDecision(b.dataset.decision)));
 }
 function drawAudit(){
   const complete=decisions.filter(d=>d.audit?.status==='reviewed').length,need=decisions.length-complete;
   const recent=occupations.filter(o=>o.evidenceQuality==='current').length;
   $('audit-metrics').innerHTML='<div class="audit-metric"><strong>'+digits(complete)+'</strong><span>مراجعة أساسية لمعلومات القرار</span></div><div class="audit-metric"><strong>'+digits(need)+'</strong><span>بحاجة لتدقيق تفاصيل القرار</span></div><div class="audit-metric"><strong>'+digits(recent)+'</strong><span>رمزاً من دليل المهن الإدارية المساندة 2026</span></div>';
   $('audit-list').innerHTML=decisions.map(d=>{
     const verified=d.audit?.status==='reviewed';
     return '<article class="audit-row"><div><strong>'+esc(d.title)+'</strong><br><small>'+esc(d.number||'دليل قطاعي')+'</small></div><div class="audit-meta"><span class="badge '+(verified?'':'amber')+'">'+(verified?'مراجعة أساسية · '+esc(d.audit.checked):'التدقيق التفصيلي مطلوب')+'</span><br><small>'+esc(d.audit?.limits||'تأكد من جداول الدليل')+'</small></div><a href="'+url(d.source)+'" target="_blank" rel="noopener noreferrer">المصدر ↗</a></article>'
   }).join('');
 }
 function openDecision(id){
   const d=decisionMap.get(id);if(!d)return;
   const audited=d.audit?.status==='reviewed';
   $('detail-content').innerHTML='<div class="dialog-hd"><span class="badge '+(audited?'':'amber')+'">'+(audited?'مراجعة معلومات أساسية':'ملخص أولي يحتاج مراجعة')+'</span><h2 id="detail-title">'+esc(d.title)+'</h2><small>'+esc(d.category)+' · '+esc(d.number||'قرار قطاعي')+'</small></div><div class="dialog-bd"><div class="detail-block"><div class="detail-lines"><div><small>نسبة التوطين</small><strong>'+esc(d.rate)+'</strong></div><div><small>تاريخ بداية التطبيق</small><strong>'+esc(dayFormat(d.effective))+'</strong></div><div><small>شرط النطاق</small><strong>'+esc(d.min||'راجع الدليل')+'</strong></div></div></div><div class="detail-block"><h3>ماذا يعني القرار؟</h3><p>'+esc(d.explain)+'</p><p><b>النطاق:</b> '+esc(d.scope||'تحقق من الدليل المعتمد')+'</p></div><div class="detail-block"><h3>خطة تحقق وتنفيذ مقترحة</h3><ol>'+(d.focus||[]).map(x=>'<li>'+esc(x)+'</li>').join('')+'<li>اعتماد قائمة الرموز والبيانات النظامية قبل إصدار حكم الامتثال.</li></ol></div><div class="detail-block"><h3>مثال توضيحي</h3><p>'+esc(d.example||'راجع الدليل الساري')+'</p></div><div class="detail-block"><h3>أثر المصادر</h3><p>آخر مراجعة للمعلومات الأساسية: '+esc(d.audit?.checked||'غير مكتملة')+'. '+esc(d.audit?.limits||'راجع الدليل التفصيلي')+'</p><div class="detail-actions"><a href="'+url(d.source)+'" target="_blank" rel="noopener noreferrer">فتح المرجع الرسمي ↗</a><button type="button" data-save="'+esc(d.id)+'">'+(selected.has(d.id)?'إزالة من تقريرك':'أضفه إلى تقريرك')+'</button></div></div><p class="last-reviewed">لا يمثل هذا الملخص شهادة امتثال أو رأياً قانونياً معتمداً. يلزم التحقق من القرار والدليل الأحدث والأنشطة المسجلة.</p></div>';
   $('detail-modal').hidden=false;document.body.style.overflow='hidden';
   $('detail-content').querySelector('[data-save]').addEventListener('click',e=>{selected.has(d.id)?selected.delete(d.id):selected.add(d.id);persist();e.currentTarget.textContent=selected.has(d.id)?'إزالة من تقريرك':'أضفه إلى تقريرك';drawReport()});
   $('detail-close').focus();
 }
 function closeDetail(){$('detail-modal').hidden=true;document.body.style.overflow=''}
 function drawReport(){
   const chosen=decisions.filter(d=>selected.has(d.id));
   $('report-count').textContent=digits(chosen.length);
   $('report-selected').innerHTML=chosen.length?chosen.map(d=>'<span class="badge">'+esc(d.title)+'</span>').join(' '):'<p>لم تختر قرارات بعد. يمكنك إنشاء تقرير استرشادي لأهم القرارات، أو إضافة قرارات محددة من نتائج البحث.</p>';
 }
 function buildReport(){
   const chosen=decisions.filter(d=>selected.has(d.id));
   const picks=chosen.length?chosen:decisions.filter(d=>['admin','procurement','project','marketing','sales','accounting','engineers','consulting'].includes(d.id));
   const today=dayFormat(dateNow),intro=chosen.length?'القرارات المختارة يدوياً':'عينة استرشادية من قرارات متعددة';
   const rows=picks.map((d,i)=>'<tr><td>'+digits(i+1)+'</td><td>'+esc(d.title)+'</td><td>'+esc(d.rate)+'</td><td>'+esc(dayFormat(d.effective))+'</td><td>'+(d.audit?.status==='reviewed'?'مراجعة أساسية':'تدقيق تفصيلي مطلوب')+'</td></tr>').join('');
   const steps=picks.slice(0,10).map((d,i)=>'<li><b>'+esc(d.title)+':</b> '+esc(d.focus?.[0]||'راجع الدليل الساري ونطاق التطبيق')+'</li>').join('');
   $('print-content').innerHTML='<article class="report-sheet" dir="rtl"><div class="stamp">SAUDIZATION RADAR · EXECUTIVE BRIEF</div><h1>موجز متابعة قرارات التوطين</h1><p>تاريخ الإعداد: <b>'+esc(today)+'</b> · أساس الاختيار: '+esc(intro)+' · عدد القرارات: '+digits(picks.length)+'</p><p><b>الغرض:</b> ملخص إداري استرشادي يربط القرار بنسبة التوطين وموعد التطبيق وخطوات التحقق دون الاعتماد على أي بيانات شخصية أو داخلية.</p><h2>ملخص القرارات</h2><table><thead><tr><th>#</th><th>القرار</th><th>النسبة</th><th>التاريخ</th><th>التوثيق</th></tr></thead><tbody>'+rows+'</tbody></table><h2>إجراءات تنفيذ مقترحة</h2><ol>'+steps+'</ol><h2>حوكمة المعلومات</h2><p>تُراجع رموز المهن والأنشطة الفعلية وشروط العدد والراتب والاعتماد المهني وفترات السماح وفق الدليل الرسمي الساري قبل تطبيق أي نسبة. لا يُعد هذا التقرير تقييماً تلقائياً لامتثال شركة أو منشأة. المراجع الرسمية وروابطها موجودة في المنصة.</p><h2>إعداد وتطوير</h2><p class="byline">عبدالعزيز عبدالله الحقباني</p><p class="report-foot">Saudization Radar | Independent Regulatory Intelligence Initiative · مصادر عامة ومراجعة بشرية لازمة</p></article>';
   document.body.classList.add('printing');$('print-host').classList.add('active');
 }
 function closeReport(){document.body.classList.remove('printing');$('print-host').classList.remove('active');}
 function setView(name){
   view=name;document.querySelectorAll('[data-tab]').forEach(b=>{const active=b.dataset.tab===name;b.classList.toggle('active',active);b.setAttribute('aria-selected',active?'true':'false')});
   document.querySelectorAll('.view').forEach(el=>el.hidden=el.id!=='view-'+name);
   if(name==='report')drawReport();
   if(name==='timeline')drawTimeline();
   if(name==='audit')drawAudit();
   window.location.hash=name==='codes'?'codes':name;
 }
 async function setup(){
   try{
     const [occResponse,decResponse]=await Promise.all([fetch('data/occupations.json?v='+Date.now()),fetch('data/decisions.json?v='+Date.now())]);
     if(!occResponse.ok||!decResponse.ok)throw new Error('Data unavailable');
     const [occDb,decDb]=await Promise.all([occResponse.json(),decResponse.json()]);
     occupations=Array.isArray(occDb.occupations)?occDb.occupations:[];decisions=Array.isArray(decDb.decisions)?decDb.decisions:[];
     decisionMap=new Map(decisions.map(d=>[d.id,d]));
     const overlaps=occupations.filter(o=>o.decisionIds.length>1).length;
     $('k-decisions').textContent=digits(decisions.length);$('k-codes').textContent=digits(occupations.length);
     $('k-audited').textContent=digits(decisions.filter(d=>d.audit?.status==='reviewed').length);
     $('k-overlaps').textContent=digits(overlaps);
     $('hero-decisions').textContent=digits(decisions.length);$('hero-codes').textContent=digits(occupations.length);
     $('source-version').textContent='آخر تحديث بيانات الفهرس: '+esc(dayFormat(occDb.updated));
     const cats=[...new Set(decisions.map(d=>d.category))].sort((a,b)=>a.localeCompare(b,'ar'));
     $('timeline-sector').innerHTML='<option value="">جميع القطاعات</option>'+cats.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join('');
     buildTimeline();drawCodes();drawTimeline();drawAudit();drawReport();
     let hashed=window.location.hash.slice(1);if(['codes','timeline','audit','report'].includes(hashed))setView(hashed);
   }catch(e){
     $('occupations').innerHTML='<div class="empty">تعذّر تحميل بيانات الفهرس. تحقق من وجود data/occupations.json وdata/decisions.json ومن اكتمال نشر GitHub Pages.</div>';
     $('occupation-results').textContent='تعذّر تحميل البيانات';
   }
 }
 $('profession-query').addEventListener('input',()=>{fullList=false;drawCodes()});
 $('profession-query').addEventListener('keydown',e=>{if(e.key==='Enter')drawCodes()});
 $('profession-search').addEventListener('click',drawCodes);
 $('load-all').addEventListener('click',()=>{fullList=!fullList;drawCodes()});
 document.querySelectorAll('[data-example]').forEach(b=>b.addEventListener('click',()=>{$('profession-query').value=b.dataset.example;fullList=false;setView('codes');drawCodes();$('profession-query').focus()}));
 document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.tab)));
 $('timeline-filter').addEventListener('change',drawTimeline);$('timeline-sector').addEventListener('change',drawTimeline);
 $('detail-close').addEventListener('click',closeDetail);$('detail-modal').addEventListener('click',e=>{if(e.target===$('detail-modal'))closeDetail()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeDetail();closeReport()}});
 $('make-report').addEventListener('click',buildReport);
 $('print-now').addEventListener('click',()=>window.print());$('close-print').addEventListener('click',closeReport);
 $('clear-selected').addEventListener('click',()=>{if(confirm('هل تريد إفراغ قائمة قرارات التقرير المحفوظة على هذا المتصفح فقط؟')){selected.clear();persist();drawReport()}});
 $('download-codes').addEventListener('click',()=>{
   const rows=[['رمز المهنة','المسمى','القرارات المرتبطة','تاريخ بدء المهنة','نوع المصدر','رابط المصدر'],...occupations.map(o=>[o.code,o.title,linkedDecisions(o).map(d=>d.title).join(' | '),o.primaryEffective||'',codeQuality(o.evidenceQuality)[0],o.source])];
   const csv='\ufeff'+rows.map(row=>row.map(x=>'"'+String(x??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
   const blob=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=blob;a.download='saudization-occupation-codes.csv';a.click();setTimeout(()=>URL.revokeObjectURL(blob),1000)
 });
 persist();setup();
})();
