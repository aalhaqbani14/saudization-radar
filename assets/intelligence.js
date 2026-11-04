
'use strict';
(function(){
 const $=id=>document.getElementById(id);
 const digits=v=>String(v??'').replace(/[٠-٩۰-۹]/g,c=>String.fromCharCode(48+(c.charCodeAt(0)>0x06ef?c.charCodeAt(0)-0x06f0:c.charCodeAt(0)-0x0660)));
 const esc=v=>digits(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]));
 const escRates=v=>esc(v).replace(/(\d+(?:\.\d+)?%)/g,'<bdi dir="ltr">$1</bdi>');
 const norm=v=>digits(v).toLowerCase().replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[\u064B-\u065F\u0670ـ]/g,'').replace(/\s+/g,' ').trim();
 const locale='ar-SA-u-ca-gregory-nu-latn';
 const fmt=new Intl.DateTimeFormat(locale,{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'});
 const dayFormat=v=>v&&/^\d{4}-\d{2}-\d{2}$/.test(v)?fmt.format(new Date(v+'T12:00:00Z')):'تاريخ بحسب الدليل';
 const dateNow=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const codeQuality=v=>v==='current'?['جدول حديث','current']:v==='historical'?['دليل أقدم','old']:['مسودة منشورة','draft'];
 const url=v=>{try{let u=new URL(v);return u.protocol==='https:'&&/(^|\.)hrsd\.gov\.sa$/.test(u.hostname)?u.href:'#'}catch{return '#'}};
 let occupations=[],decisions=[],decisionMap=new Map(),selected=new Set(),view='codes',fullList=false,events=[],graceRecords=[];
 try{selected=new Set(JSON.parse(localStorage.getItem('saudization-radar-saved')||'[]'))}catch{}
 function persist(){try{localStorage.setItem('saudization-radar-saved',JSON.stringify([...selected]))}catch{} $('k-selected').textContent=selected.size;}
 function score(o,q){const n=norm(q),title=norm(o.title),code=digits(o.code);if(!n)return 1;if(code===n)return 1000;if(/^\d+$/.test(n)&&code.startsWith(n))return 550;if(title===n)return 450;if(title.startsWith(n))return 400;if(title.includes(n))return 350;const words=n.split(' ').filter(Boolean);if(words.every(t=>title.includes(t)))return 275;if(code.includes(n))return 220;const related=o.decisionIds.map(id=>norm(decisionMap.get(id)?.title||'')).join(' ');if(related.includes(n))return 85;return 0;}
 function getMatch(){const q=$('profession-query').value.trim();let rows=occupations.map(o=>({o,score:score(o,q)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.o.title.localeCompare(b.o.title,'ar'));return {q,rows:fullList||q?rows:rows.slice(0,8)};}
 function linkedDecisions(o){return o.decisionIds.map(id=>decisionMap.get(id)).filter(Boolean);}
 function occupationCard(o,rank){
   const lab=codeQuality(o.evidenceQuality),decisionLinks=linkedDecisions(o);const person=window.SalicWorkforce.getRows().find(r=>norm(r.title)===norm(o.title));
   let tag=lab[1]==='current'?'badge':lab[1]==='old'?'badge amber':'badge red';
   const date=o.primaryEffective?'<span>بدء تطبيق المهنة في قرار الإدارة المساندة: <b>'+esc(dayFormat(o.primaryEffective))+'</b></span>':'<span>تاريخ التطبيق يتحدد بحسب القرار والنشاط.</span>';
   return '<article class="occupation-card"><div class="occupation-head"><span class="code-tag" dir="ltr">'+esc(o.code)+'</span><span class="'+tag+'">'+esc(lab[0])+'</span></div><h3>'+esc(o.title)+'</h3>'+(person?'<div class="wf-compact">موظفو سالك في هذه المهنة: <b>'+person.total+'</b> · سعودي: '+person.saudi+' · غير سعودي: '+person.other+'</div>':'')+'<div class="secondary">'+date+'</div><div class="occupation-decisions">'+decisionLinks.map(d=>'<button type="button" data-decision="'+esc(d.id)+'">'+esc(d.title)+' · '+(d.id==='beauty'?'قطاعي · تحقّق من الدليل':escRates(d.rate))+'</button>').join('')+'</div><div class="occupation-history-summary">'+decisionLinks.slice(0,2).map(d=>d.id==='admin'&&o.primaryEffective?'<div class="occupation-specific-date"><b>موعد تطبيق هذه المهنة وفق جدول القرار:</b> '+esc(dayFormat(o.primaryEffective))+' <small>· '+esc(o.sourceTable||'يراجع الدليل')+'</small></div>':window.SaudizationHistory.compact(d)).join('')+'</div><p class="secondary">'+(o.decisionIds.length>1?'⚠️ مرتبط بأكثر من قرار محتمل؛ لا تعتمد النسبة الأعلى إلا بعد فحص النطاق وشروط التداخل.':esc(o.notes||'التحقق من نطاق القرار ضروري.'))+'</p><div class="occupation-foot"><span class="secondary">'+esc(o.sourceTable||o.verified)+'</span><a href="'+url(o.source)+'" target="_blank" rel="noopener noreferrer">جدول إثبات الرمز ↗</a></div></article>';
 }
 function drawCodes(){
   const {q,rows}=getMatch();
   const indexedTitles=new Set(occupations.map(o=>norm(o.title)));
   const extra=q?window.SalicWorkforce.getRows().filter(r=>!indexedTitles.has(norm(r.title))&&norm(r.title).includes(norm(q))):[];
   const cards=rows.map(({o})=>occupationCard(o)).join('')+extra.map(r=>'<article class="occupation-card"><div class="occupation-head"><span class="badge amber">لم يُطابق الرمز في فهرس المشروع</span></div><h3>'+esc(r.title)+'</h3><div class="wf-compact"><strong>عدد موظفي سالك: '+r.total+'</strong> · سعوديون: '+r.saudi+' · غير سعوديين: '+r.other+'</div><p class="secondary">المهنة مشمولة في إجمالي القوى العاملة حتى دون ارتباطها برمز أو قرار في الفهرس الجزئي. يُراجع الرمز الفعلي في قوى قبل الحكم على انطباق أي قرار.</p><a href="salic.html#workforce">افتح جميع مهن سالك ↗</a></article>').join('');
   $('occupations').innerHTML=cards||'<div class="empty"><strong>لا توجد نتيجة مطابقة.</strong><p>جميع المهن الـ75 موجودة في جدول القوى العاملة أعلاه، سواء ارتبطت بقرار أم لا.</p></div>';
   $('occupation-results').textContent=q?'نتائج البحث: '+digits(rows.length+extra.length)+' مهنة أو رمز من القائمة و الفهرس':'الرموز المفهرسة المعروضة: '+digits(rows.length)+' · إجمالي مهن سالك: '+digits(window.SalicWorkforce.getRows().length)+' مهنة في الجدول أعلاه';
   $('load-all').textContent=fullList?'عرض المختصر':'عرض جميع الرموز';
   $('occupations').querySelectorAll('[data-decision]').forEach(b=>b.addEventListener('click',()=>openDecision(b.dataset.decision)));
 }
 function buildTimeline(){
   events=[];
   decisions.forEach(d=>(d.history||[]).forEach(p=>{
     if(/^\d{4}-\d{2}-\d{2}$/.test(p.date||''))events.push({date:p.date,title:d.title,rate:p.rate,label:p.label,id:d.id,category:d.category,scope:p.scope||'',kind:p.kind||''})
   }));
   events.sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title,'ar'));
 }
 function drawTimeline(){
   const filter=$('timeline-filter').value,cat=$('timeline-sector').value;
   const list=events.filter(e=>(!cat||e.category===cat)&&(filter==='all'||(filter==='future'?e.date>=dateNow:e.date<dateNow)));
   $('timeline-caption').textContent='عرض '+digits(list.length)+' موعداً ضمن تسلسل القرارات · الزيادة في النسبة تختلف عن إضافة مهن أو تغيير نطاق القرار';
   $('timeline-list').innerHTML=list.length?list.map(e=>{
     const future=e.date>=dateNow;
     const days=Math.round((Date.parse(e.date+'T00:00:00Z')-Date.parse(dateNow+'T00:00:00Z'))/86400000);
     const when=future?(days===0?'اليوم':'بعد '+digits(days)+' يوم'):'تاريخ سابق';
     const kind=window.SaudizationHistory.kind[e.kind]||'مرحلة تطبيق';
     return '<article class="time-item"><div class="time-date">'+esc(dayFormat(e.date))+'</div><div><h3>'+esc(e.title)+'</h3><span class="timeline-phase-label">'+escRates(e.rate)+' · '+esc(kind)+'</span><br><small>'+esc(e.label)+(e.scope?' · '+esc(e.scope):'')+'</small></div><div class="time-meta '+(future?'':'past')+'">'+esc(when)+' <button type="button" data-decision="'+esc(e.id)+'" style="border:0;background:transparent;color:#0b7770;cursor:pointer">التفاصيل ↗</button></div></article>'
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
   $('detail-content').innerHTML='<div class="dialog-hd"><span class="badge '+(audited?'':'amber')+'">'+(audited?'مراجعة معلومات أساسية':'ملخص أولي يحتاج مراجعة')+'</span><h2 id="detail-title">'+esc(d.title)+'</h2><small>'+esc(d.category)+' · '+esc(d.number||'قرار قطاعي')+'</small><div id="intel-wf-top">'+window.SalicWorkforce.header(d.id)+'</div></div><div class="dialog-bd">'+window.SalicWorkforce.render(d.id)+'<div class="detail-block"><div class="detail-lines"><div><small>نسبة التوطين</small><strong>'+escRates(d.rate)+'</strong></div><div><small>تاريخ بداية التطبيق</small><strong>'+esc(dayFormat(d.effective))+'</strong></div><div><small>شرط النطاق</small><strong>'+esc(d.min||'راجع الدليل')+'</strong></div></div></div><div class="detail-block"><h3>ماذا يعني القرار؟</h3><p>'+esc(d.explain)+'</p><p><b>النطاق:</b> '+esc(d.scope||'تحقق من الدليل المعتمد')+'</p></div>'+window.SaudizationHistory.detail(d)+'<div class="detail-block"><h3>خطة تحقق وتنفيذ مقترحة</h3><ol>'+(d.focus||[]).map(x=>'<li>'+esc(x)+'</li>').join('')+'<li>اعتماد قائمة الرموز والبيانات النظامية قبل إصدار حكم الامتثال.</li></ol></div><div class="detail-block"><h3>مثال توضيحي</h3><p>'+esc(d.example||'راجع الدليل الساري')+'</p></div><div class="detail-block"><h3>أثر المصادر</h3><p>آخر مراجعة للمعلومات الأساسية: '+esc(d.audit?.checked||'غير مكتملة')+'. '+esc(d.audit?.limits||'راجع الدليل التفصيلي')+'</p><div class="detail-actions"><a href="'+url(d.source)+'" target="_blank" rel="noopener noreferrer">فتح المرجع الرسمي ↗</a><button type="button" data-save="'+esc(d.id)+'">'+(selected.has(d.id)?'إزالة من تقريرك':'أضفه إلى تقريرك')+'</button></div></div><p class="last-reviewed">لا يمثل هذا الملخص شهادة امتثال أو رأياً قانونياً معتمداً. يلزم التحقق من القرار والدليل الأحدث والأنشطة المسجلة.</p></div>';
   $('detail-modal').hidden=false;document.body.style.overflow='hidden';$('detail-modal').querySelector('.dialog').scrollTop=0;
   $('detail-content').querySelector('[data-save]').addEventListener('click',e=>{selected.has(d.id)?selected.delete(d.id):selected.add(d.id);persist();e.currentTarget.textContent=selected.has(d.id)?'إزالة من تقريرك':'أضفه إلى تقريرك';drawReport()});
   $('detail-close').focus();
 }
 function closeDetail(){$('detail-modal').hidden=true;document.body.style.overflow=''}
 function reportPicks(){
   const mode=$('report-mode').value;
   if(mode==='selected')return decisions.filter(d=>selected.has(d.id));
   if(mode==='category')return decisions.filter(d=>d.category===$('report-category').value);
   return decisions;
 }
 function syncReportChoices(){
   const mode=$('report-mode').value;
   $('report-category-wrap').hidden=mode!=='category';
   $('report-custom-wrap').hidden=mode!=='selected';
   const options=$('report-decision-options');
   options.innerHTML=decisions.map(d=>'<label class="report-check-item"><input type="checkbox" data-report-id="'+esc(d.id)+'" '+(selected.has(d.id)?'checked':'')+'><span>'+esc(d.title)+'</span></label>').join('');
   options.querySelectorAll('[data-report-id]').forEach(input=>input.addEventListener('change',()=>{
     input.checked?selected.add(input.dataset.reportId):selected.delete(input.dataset.reportId);
     persist();drawReport();
   }));
   drawReport();
 }
 function drawReport(){
   const picks=reportPicks();
   const mode=$('report-mode').value;
   $('report-count').textContent=digits(picks.length);
   $('make-report').disabled=!picks.length;
   $('clear-selected').hidden=mode!=='selected';
   const description=mode==='all'?'جميع مجموعات القرارات المتاحة في الفهرس':mode==='category'?'مجموعة قرارات قطاع '+($('report-category').value||'غير محدد'):'القرارات التي حددتها من القائمة';
   const chunks=picks.slice(0,9).map(d=>'<span class="badge">'+esc(d.title)+'</span>').join(' ');
   $('report-selected').innerHTML='<strong>نطاق التقرير:</strong> '+esc(description)+' · '+digits(picks.length)+' مجموعة قرار.<div style="margin-top:9px">'+(picks.length?chunks+(picks.length>9?' <span class="badge">و'+digits(picks.length-9)+' قرارات إضافية</span>':''):'<span class="badge amber">اختر قراراً واحداً على الأقل قبل الإنشاء</span>')+'</div><div class="secondary" style="margin-top:9px">سيُعرض كل ما هو مسجل في الفهرس من مهن مستهدفة، ومهن خارج الاختيار، والمراحل والمهل موثقة المصدر.</div>';
 }
 function printTable(headers,rows,empty){
   if(!rows.length)return '<p class="report-meta-note">'+esc(empty||'لا توجد بيانات مصنفة في النطاق المحدد.')+'</p>';
   return '<table><thead><tr>'+headers.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(x=>'<td>'+x+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
 }
 function reportLink(link,label){
   const href=url(link);
   return href==='#'?'<span class="report-meta-note">رابط يحتاج تحققاً</span>':'<a href="'+esc(href)+'" target="_blank" rel="noopener noreferrer">'+esc(label||'المصدر الرسمي')+'</a>';
 }
 function reportDate(date){return date?esc(dayFormat(date)):'غير مثبت';}
 function buildReport(){
   const picks=reportPicks();
   if(!picks.length){alert('حدد قراراً واحداً على الأقل لإنشاء التقرير.');return}
   if(!window.SaudizationReportModel){alert('تعذّر تحميل محرك التقرير. حدّث الصفحة وأعد المحاولة.');return}
   const model=window.SaudizationReportModel.build(decisions,occupations,graceRecords,picks.map(d=>d.id),$('report-extra-occupations').value);
   const m=model.coverage,today=dayFormat(dateNow);
   const mode=$('report-mode').value,selection=mode==='all'?'جميع مجموعات القرارات في الفهرس':mode==='category'?'قطاع '+$('report-category').value:'قرارات محددة يدوياً';
   const decisionRows=model.picked.map((d,i)=>[
     esc(digits(i+1)), '<b>'+esc(d.title)+'</b>'+(d.number?'<br><small>رقم '+esc(d.number)+'</small>':''),
     escRates(d.rate||'غير محدد'),reportDate(d.issueDate),reportDate(d.effective),
     esc(d.min||d.scope||'يراجع الدليل'),
     '<span class="report-badge '+(d.audit?.status==='reviewed'?'':'pending')+'">'+(d.audit?.status==='reviewed'?'مراجعة أساسية':'يحتاج تدقيقاً')+'</span><br>'+reportLink(d.source,'فتح المصدر')
   ]);
   const graceRows=model.grace.map(g=>[
     '<b>'+esc(g.decisionTitle)+'</b>',esc(g.scope||'يراجع الدليل'),
     reportDate(g.start),reportDate(g.end),'<b>'+esc(g.duration)+'</b>',
     '<span class="report-badge '+(g.status==='unverified'?'pending':'')+'">'+(g.status==='official'?'وردت المهلة صراحة':g.status==='reported'?'المهلة مذكورة في خبر الوزارة':'لم توثق مدة المهلة')+'</span><br><small>'+esc(g.basis||'')+'</small><br>'+reportLink(g.source,'السند')
   ]);
   const stageRows=model.stages.map(p=>[
     esc(p.decisionTitle),reportDate(p.date),escRates(p.rate),esc(p.label),
     esc(p.scope||'بحسب نطاق القرار')+(p.note?'<br><small>'+esc(p.note)+'</small>':''),
     reportLink(p.source,'المرجع')
   ]);
   const targetRows=model.targeted.map(o=>[
     '<b dir="ltr">'+esc(o.code)+'</b>',esc(o.title),
     esc(o.matched.map(id=>decisions.find(d=>d.id===id)?.title||id).join('؛ ')),
     o.primaryEffective?reportDate(o.primaryEffective):'<span class="report-meta-note">حسب القرار والجداول</span>',
     esc(o.sourceTable||o.verified||'مرجع الفهرس')+'<br>'+reportLink(o.source,'دليل الرمز')
   ]);
   const outsideRows=model.outside.map(o=>[
     '<b dir="ltr">'+esc(o.code)+'</b>',esc(o.title),
     esc(o.decisionIds.map(id=>decisions.find(d=>d.id===id)?.title||id).join('؛ ')),
     '<span class="report-badge pending">خارج القرارات المختارة فقط</span><br>'+reportLink(o.source,'المصدر')
   ]);
   const namesRows=model.mentioned.map(o=>[
     esc(o.title),esc(o.decisionTitle),
     '<span class="report-badge pending">ورد في الملخص؛ رمز مهني غير مطابق هنا</span>'
   ]);
   const manualRows=model.manual.map(o=>[
     esc(o.input),esc(o.code),
     '<span class="report-badge '+(o.status==='targeted'?'':'pending')+'">'+(o.status==='targeted'?'مستهدفة ضمن الاختيار':o.status==='out-of-scope'?'خارج الاختيار فقط':'حالة غير محددة')+'</span>',
     esc(o.notice)+(o.matched.length?'<br>'+esc(o.matched.join('، ')):'')+(o.otherDecisions.length?'<br>قرارات أخرى: '+esc(o.otherDecisions.join('، ')):'')
   ]);
   const allWorkforce=window.SalicWorkforce.getRows(),allTotal=allWorkforce.reduce((n,r)=>n+r.total,0),allSaudis=allWorkforce.reduce((n,r)=>n+r.saudi,0);
   const summaryCards=[
     [digits(allTotal),'جميع موظفي سالك'],
     [digits(allSaudis),'السعوديون في الملف'],
     [digits(allTotal-allSaudis),'غير السعوديين في الملف'],
     [digits(allWorkforce.length),'جميع مهن سالك'],
     [digits(m.selectedGroups),'مجموعات القرار المختارة'],
     [digits(m.targetedCount),'رموز مفهرسة في الاختيار'],
     [digits(m.outsideCount),'رموز خارج القرارات المختارة'],
     [digits(model.grace.filter(g=>g.status!=='unverified').length),'سجلات مهلة موثقة/مذكورة']
   ].map(x=>'<div><strong>'+x[0]+'</strong><span>'+x[1]+'</span></div>').join('');
   const targetNotice='هذه جميع رموز المهن المستهدفة ضمن الاختيار والموجودة في فهرس المنصة الجزئي، وليست حصر الوزارة الكامل. قد يتداخل الرمز في أكثر من قرار، ويلزم الرجوع إلى جداول الدليل الساري.';
   const outsideNotice='هذه مهن موثقة في فهرسنا لكنها مرتبطة بمجموعات قرار لم تُختَر لهذا التقرير. وصف «خارج نطاق الاختيار» لا يعني أنها غير مستهدفة بالتوطين عموماً.';
   let sections=[
     '<section><h2>1. ملخص القرارات المختارة</h2>'+printTable(['#','مجموعة القرار','النسبة المسجلة','تاريخ الإصدار','بدء التطبيق العام','شروط العدد والنطاق','حالة التدقيق والمصدر'],decisionRows)+'</section>',
     '<section><h2>2. فترات السماح والاستثناءات الزمنية</h2><p class="report-meta-note">تفاصيل المهل تختلف حسب رمز المهنة والجدول. إن لم توثق مدة المهلة فلا نعتبر الفارق بين تاريخ الإصدار والتطبيق تصريحاً بمهلة رسمية.</p>'+printTable(['القرار','النطاق المهني','بداية الفترة','نهاية الفترة / النفاذ','مدة السماح','درجة التوثيق والسند'],graceRows)+'</section>',
     '<section><h2>3. جدول المراحل وتواريخ التنفيذ</h2>'+printTable(['القرار','تاريخ المرحلة','النسبة','وصف المرحلة','النطاق والملاحظات','المصدر'],stageRows)+'</section>',
     '<section><h2>4. المهن المستهدفة ضمن النطاق المختار — رموز مفهرسة ('+digits(model.targeted.length)+')</h2><p class="report-meta-note">'+esc(targetNotice)+'</p>'+printTable(['الرمز المهني','المسمى','القرارات المختارة المرتبطة','تاريخ بدء خاص بالمهنة إن وجد','الجدول أو دليل الإثبات'],targetRows,'لا توجد رموز مفهرسة ضمن المجموعات المختارة؛ ارجع إلى الأدلة الرسمية للتحقق من قائمة المهن.')+'</section>',
     '<section><h2>5. مسميات إضافية مذكورة بملخصات القرارات ('+digits(model.mentioned.length)+')</h2><p class="report-meta-note">هذه المسميات واردة في ملخصات مختارة وليست قائمة رسمية مكتملة أو مطابقة للرموز.</p>'+printTable(['المسمى الوارد في الملخص','المجموعة المرتبطة','حدود التوثيق'],namesRows,'لا توجد مسميات إضافية خارج قائمة الرموز الحالية.')+'</section>',
     '<section><h2>6. المهن خارج القرارات المختارة — ضمن الفهرس ('+digits(model.outside.length)+')</h2><p class="report-caution">'+esc(outsideNotice)+'</p>'+printTable(['الرمز المهني','المسمى','قرارات أخرى قد تستهدفه','الحالة والمصدر'],outsideRows,'عند اختيار جميع القرارات لا تظهر عادة مهن خارج الاختيار من داخل الفهرس؛ ولا يمكن إثبات أن بقية مهن المملكة «غير مستهدفة» دون فهرس أشمل.')+'</section>'
   ];
   sections=sections.filter((part,i)=>i===0||(i===1&&$('report-part-grace').checked)||(i===2&&$('report-part-phases').checked)||(i===3&&$('report-part-targeted').checked)||(i===4&&$('report-part-mentions').checked)||(i===5&&$('report-part-outside').checked));
   if(allWorkforce.length){
     const aggregates=picks.map(d=>{const g=window.SalicWorkforce.group(d.id),r=window.SalicWorkforce.official(d.id);return [esc(d.title),esc(r?'محضر الوزارة بتاريخ '+r.asOf:'بيانات القوى العاملة 2026-11-03'),esc(digits(g.list.length)),esc(digits(r?r.total:g.total)),esc(digits(r?r.saudi:g.saudi)),esc(digits(r?r.nonSaudi:g.other)),esc(r?r.numericGap:g.gap===null?'لم تُحسب':digits(g.gap)),esc(r?'محقق '+r.reportedSaudiPercent+'% مقابل مطلوب '+r.targetPercent+'%. أعداد المهن المرتبطة مبدئيًا في البيانات الداخلية: '+g.total+' موظف. المصدران مختلفا التاريخ والمنهج.':g.reason)];});
     sections.unshift('<section><h2>الوضع الوظيفي لسالك حسب القرارات المختارة</h2><p class="report-caution">للمهن الإدارية المساندة فقط أرقام رقابية مجمعة من محضر الوزارة بتاريخ 25 أكتوبر 2026؛ لبقية القرارات أرقام مطابقة أولية من بيانات القوى العاملة 3 نوفمبر 2026. لا تخلط بين تاريخي المصدرين ولا تجمع الفجوات بين القرارات.</p>'+printTable(['القرار','المصدر وتاريخه','مسميات مرتبطة مبدئيًا','الإجمالي بحسب المصدر','السعوديون','غير السعوديين','الاحتياج / الفجوة','ملاحظات المقارنة'],aggregates)+'</section>');
     const wholeRows=allWorkforce.slice().sort((a,b)=>b.total-a.total||a.title.localeCompare(b.title,'ar')).map(r=>[esc(r.title),digits(r.total),digits(r.saudi),digits(r.other),esc(r.decisionIds.length?r.decisionIds.map(id=>window.SalicWorkforce.names[id]||id).join('، '):'لا يوجد ربط في الفهرس الحالي')]);
     sections.unshift('<section><h2>جميع مهن سالك — '+digits(allWorkforce.length)+' مهنة و'+digits(allTotal)+' موظفاً</h2><p class="report-meta-note">هذا الجدول يشمل جميع موظفي سالك حسب المسمى سواء كانوا مستهدفين بقرار توطين أم لا؛ كل موظف محسوب مرة واحدة في الإجمالي، دون تكرار عبر القرارات. العدد السعودي: '+digits(allSaudis)+'، غير السعودي: '+digits(allTotal-allSaudis)+'. الربط بالمهن المستهدفة مبدئي ويحتاج تحقق الرموز المسجلة في قوى.</p>'+printTable(['المسمى المهني','الإجمالي','سعودي','غير سعودي','قرار محتمل / لم يُربط'],wholeRows)+'</section>');
   }
   if(model.manual.length)sections.push('<section><h2>7. تقييم قائمة المهن التي أدخلتها ('+digits(model.manual.length)+')</h2><p class="report-meta-note">مقارنة محلية بالفهرس الجزئي فقط، دون رفع البيانات إلى أي خدمة. المهنة غير الموجودة نتيجتها غير محددة، وليست غير مستهدفة.</p>'+printTable(['المهنة المُدخلة','الرمز المفهرس إن وجد','نتيجة المقارنة','التفسير'],manualRows)+'</section>');
   const footer='<section><h2>حدود الاعتماد وخطوات التحقق</h2><p>لا يمثّل هذا التقرير تقييماً نظامياً لامتثال منشأة. اختيار القرار لا يثبت انطباقه على كل نشاط أو منشأة أو موظف. يجب مطابقة رموز المهن والمسميات الفعلية وشروط العدد والأجور والاعتماد المهني وفترات السماح والاستثناءات في الدليل الرسمي الساري، ومراجعة التعارضات بين القرارات. عدد رموز الفهرس الحالي '+digits(m.indexCount)+'؛ لذلك لا يمكن الجزم بأن مهنة غير مدرجة لا تخضع للتوطين.</p><p>يمكن متابعة آخر مراجعات المصادر من غرفة التحليل وسجل المصادر الرسمي في Saudization Radar.</p></section>';
   $('print-content').innerHTML='<article class="report-sheet" dir="rtl"><div class="report-cover"><div class="stamp">SAUDIZATION RADAR · EXECUTIVE DECISION REPORT</div><h1>التقرير التنفيذي لقرارات التوطين والمهن</h1><p>تاريخ إعداد التقرير (الرياض): <b>'+esc(today)+'</b> · نطاق التقرير: <b>'+esc(selection)+'</b></p><div class="summary-metrics">'+summaryCards+'</div><div class="report-caution">هذا التقرير استرشادي ومبني على فهرس جزئي، ولا يتضمن جميع المهن في التصنيف السعودي أو شهادات امتثال. التحقق من المستندات الرسمية شرط قبل أي استخدام نظامي.</div></div>'+sections.join('')+footer+'<p class="report-foot">Saudization Radar · Independent Regulatory Intelligence Initiative · مراجع حكومية وأعداد مهن مجمعة دون أسماء أو توقيع شخصي</p></article>';
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
     const [occResponse,decResponse,workforceResponse]=await Promise.all([fetch('data/occupations.json?v='+Date.now()),fetch('data/decisions.json?v='+Date.now()),fetch('data/salic-workforce.json?v='+Date.now())]);
     if(!occResponse.ok||!decResponse.ok||!workforceResponse.ok)throw new Error('Data unavailable');
     const [occDb,decDb,workDb]=await Promise.all([occResponse.json(),decResponse.json(),workforceResponse.json()]);
     try{const response=await fetch('data/grace-periods.json?v='+Date.now());if(!response.ok)throw Error('Grace registry unavailable');graceRecords=(await response.json()).records||[]}catch(err){graceRecords=[];console.warn('Grace records unavailable',err)}

     window.SalicWorkforce.setRows(workDb.rows,workDb.summary);
     await window.SalicWorkforce.loadOfficial();
     const relevantIds=new Set(["admin","procurement","project","marketing","accounting","ict","legal","consulting","engineers","sales"]);
     const salicTitles=new Set((workDb.rows||[]).map(row=>norm(row[0])));
     occupations=(Array.isArray(occDb.occupations)?occDb.occupations:[]).filter(o=>salicTitles.has(norm(o.title))&&o.decisionIds.some(id=>relevantIds.has(id))).map(o=>({...o,decisionIds:o.decisionIds.filter(id=>relevantIds.has(id))}));
     decisions=(Array.isArray(decDb.decisions)?decDb.decisions:[]).filter(d=>relevantIds.has(d.id));
     decisionMap=new Map(decisions.map(d=>[d.id,d]));
     selected=new Set([...selected].filter(id=>decisionMap.has(id)));persist();
     const overlaps=occupations.filter(o=>o.decisionIds.length>1).length;
     $('k-decisions').textContent=digits(decisions.length);$('k-codes').textContent=digits(occupations.length);
     $('k-audited').textContent=digits(decisions.filter(d=>d.audit?.status==='reviewed').length);
     $('k-overlaps').textContent=digits(overlaps);
     $('hero-decisions').textContent=digits(decisions.length);$('hero-codes').textContent=digits(occupations.length);
     $('source-version').textContent='آخر تحديث بيانات الفهرس: '+esc(dayFormat(occDb.updated));
     const cats=[...new Set(decisions.map(d=>d.category))].sort((a,b)=>a.localeCompare(b,'ar'));
     $('timeline-sector').innerHTML='<option value="">جميع القطاعات</option>'+cats.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join('');
     $('report-category').innerHTML=cats.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join('');

     buildTimeline();drawCodes();drawTimeline();drawAudit();syncReportChoices();
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
 $('report-mode').addEventListener('change',syncReportChoices);
 $('report-category').addEventListener('change',drawReport);
 $('report-select-all').addEventListener('click',()=>{decisions.forEach(d=>selected.add(d.id));persist();syncReportChoices()});
 $('report-select-none').addEventListener('click',()=>{selected.clear();persist();syncReportChoices()});
 $('make-report').addEventListener('click',buildReport);
 $('print-now').addEventListener('click',()=>window.print());$('close-print').addEventListener('click',closeReport);
 $('clear-selected').addEventListener('click',()=>{if(confirm('هل تريد إفراغ قائمة قرارات التقرير المحفوظة على هذا المتصفح فقط؟')){selected.clear();persist();syncReportChoices()}});
 $('download-codes').addEventListener('click',()=>{
   const rows=[['رمز المهنة','المسمى','القرارات المرتبطة','تاريخ بدء المهنة','نوع المصدر','رابط المصدر'],...occupations.map(o=>[o.code,o.title,linkedDecisions(o).map(d=>d.title).join(' | '),o.primaryEffective||'',codeQuality(o.evidenceQuality)[0],o.source])];
   const csv='\ufeff'+rows.map(row=>row.map(x=>'"'+String(x??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
   const blob=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=blob;a.download='saudization-occupation-codes.csv';a.click();setTimeout(()=>URL.revokeObjectURL(blob),1000)
 });
 persist();setup();
})();
