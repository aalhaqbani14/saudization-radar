
/* Executive chronology renderer. Data is curated in data/decisions.json; not a compliance engine. */
(function(){
 'use strict';
 const clean=v=>String(v??'').replace(/[٠-٩۰-۹]/g,c=>String.fromCharCode(48+c.charCodeAt(0)-(c.charCodeAt(0)>=0x06F0?0x06F0:0x0660))).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'});
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const date=v=>v&&/^\d{4}-\d{2}-\d{2}$/.test(v)?fmt.format(new Date(v+'T12:00:00Z')):null;
 const pct=v=>clean(v).replace(/(\d+(?:\.\d+)?%)/g,'<bdi dir="ltr">$1</bdi>');
 const safeLink=s=>{try{const u=new URL(s);return u.protocol==='https:'&&/(^|\.)hrsd\.gov\.sa$/.test(u.hostname)?u.href:null}catch{return null}};
 const items=d=>Array.isArray(d?.history)?d.history:[];
 const kinds={original:"بداية التطبيق",raised:"زيادة النسبة",expanded:"إضافة مهن أو نطاق",upcoming:"مرحلة قادمة",special:"فئة منشآت مختلفة",pending:"تاريخ قيد المراجعة",single:"موعد مسجل في الملخص"};
 const type=e=>{
  if(!e.date)return 'pending';
  if(e.date>today)return 'future';
  if(e.kind==='special')return 'special';
  if(e.kind==='raised')return 'raised';
  if(e.kind==='expanded')return 'expanded';
  return 'past';
 };
 const stage=(d,e,index)=>{
  const t=type(e),label=kinds[e.kind]||'مرحلة توطين',start=e.date?date(e.date):e.dateLabel||'التاريخ بحاجة تحقق';
  const source=safeLink(e.source);
  return '<div class="rate-stage '+t+'"><span class="rate-stage-dot" aria-hidden="true"></span><div class="rate-stage-content"><div class="rate-stage-top"><span class="rate-stage-date">'+clean(start)+'</span><span class="rate-stage-rate">'+pct(e.rate)+'</span><span class="rate-stage-kind">'+(t==='future'?'قادم · ':'')+clean(label)+'</span></div><div class="rate-stage-label">'+clean(e.label||'')+'</div>'+(e.scope?'<div class="rate-stage-scope">النطاق: '+clean(e.scope)+'</div>':'')+(e.note?'<div class="rate-stage-note">'+clean(e.note)+'</div>':'')+(source?'<a href="'+source+'" target="_blank" rel="noopener noreferrer" class="rate-stage-source">المصدر الرسمي ↗</a>':'')+'</div></div>';
 };
 const heading=d=>{
  let issuance=d.issueDate?'<span>صدور التحديث: <bdi dir="ltr">'+clean(d.issueDate)+'</bdi></span>':'<span>تاريخ الإصدار: راجع المصدر الرسمي</span>';
  return '<div class="rate-head"><div><strong>تسلسل نسب التوطين ومواعيدها</strong><small>يفصل بين بدء النفاذ وزيادة النسبة وتوسيع قائمة المهن</small></div>'+issuance+'</div>';
 };
 function detail(d){let arr=items(d);return '<section class="rate-timeline">'+heading(d)+'<div class="rate-stages">'+arr.map((e,i)=>stage(d,e,i)).join('')+'</div>'+(arr.length===1?'<p class="rate-disclaimer">لا توجد مراحل إضافية موثقة في قاعدة البيانات الحالية لهذا القرار، وهذا لا يؤكد عدم وجود تحديثات خارجها.</p>':'')+'</section>'}
 function compact(d){let arr=items(d);if(!arr.length)return '';const visible=arr.length>4?[arr[0],arr[arr.length-3],arr[arr.length-2],arr[arr.length-1]]:arr;return '<div class="rate-compact"><div class="rate-compact-title">مسار التطبيق <span>'+clean(arr.length)+' محطات</span></div><div class="rate-compact-track">'+visible.map(e=>'<span class="rate-compact-stop '+type(e)+'"><b>'+pct(e.rate)+'</b><small>'+clean(e.date?date(e.date):e.dateLabel||'موعد غير مؤكد')+'</small><em>'+clean(e.kind==='special'?'نطاق مستقل':e.kind==='expanded'?'توسيع المهن':e.kind==='raised'?'رفع النسبة':e.kind==='pending'?'بانتظار التحقق':e.kind==='upcoming'?'قادم':'بداية')+'</em></span>').join('')+'</div></div>'}
 function summarize(d){let arr=items(d);return arr.map(e=>(e.date?e.date:e.dateLabel||'غير محدد')+' · '+e.rate+' ('+(e.scope||e.label||'')+')').join(' | ')}
 function dateFor(e){return date(e?.date)||e?.dateLabel||'التاريخ يحتاج تحقق'}
 window.SaudizationHistory={detail,compact,stage,items,summarize,dateFor,today,kind:kinds};
})();
