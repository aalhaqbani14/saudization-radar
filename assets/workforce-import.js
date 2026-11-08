/* Private, browser-only workforce CSV importer.
 * Never fetches to a server or stores input in cookies/localStorage.
 * No personal identifiers, names, emails, salary or row-level information are exported.
 */
(function(root){
"use strict";
const MAX_BYTES=5*1024*1024,MAX_ROWS=20000,MAX_COLS=60;
function canon(s){return String(s??"").normalize("NFKC").trim().toLowerCase().replace(/[إأآٱ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/[\u064b-\u065fـ]/g,"").replace(/[_\-]+/g," ").replace(/\s+/g," ")}
function pick(header,names){
 for(let i=0;i<header.length;i++)if(names.some(n=>canon(n)===canon(header[i])))return i;
 return -1;
}
function chooseDelimiter(text){
 const first=String(text).replace(/^\ufeff/,"").split(/\r?\n/,1)[0];
 const tests=[",",";","\t"];
 let best=",",highest=-1;
 for(const d of tests){let q=false,count=0;for(let i=0;i<first.length;i++){if(first[i]==='"'){if(q&&first[i+1]==='"')i++;else q=!q}else if(!q&&first[i]===d)count++}if(count>highest){best=d;highest=count}}
 return best;
}
function parseCSV(text){
 if(typeof text!=="string"||!text.trim())throw Error("ملف CSV فارغ");
 if(new TextEncoder().encode(text).length>MAX_BYTES)throw Error("الملف أكبر من 5 ميجابايت");
 const d=chooseDelimiter(text);const rows=[];let record=[],cell="",quoted=false,atStart=true;
 let value=text.replace(/^\ufeff/,"");
 for(let i=0;i<value.length;i++){
  const c=value[i];
  if(quoted){if(c==='"'){if(value[i+1]==='"'){cell+='"';i++}else quoted=false}else cell+=c;continue}
  if(c==='"'&&atStart){quoted=true;atStart=false;continue}
  if(c===d){record.push(cell.trim());cell="";atStart=true;continue}
  if(c==="\r"||c==="\n"){if(c==="\r"&&value[i+1]==="\n")i++;record.push(cell.trim());if(record.some(x=>x!==""))rows.push(record);if(rows.length>MAX_ROWS+1)throw Error("الملف يتجاوز 20 ألف صف");record=[];cell="";atStart=true;continue}
  if(c==='"')throw Error("تنسيق علامات الاقتباس غير صحيح");
  cell+=c;atStart=false;
 }
 if(quoted)throw Error("علامة اقتباس لم تُغلق");
 record.push(cell.trim());if(record.some(x=>x!==""))rows.push(record);
 if(rows.length<2)throw Error("الملف يحتاج صف عناوين وصف بيانات واحدًا على الأقل");
 if(rows[0].length>MAX_COLS)throw Error("عدد الأعمدة يتجاوز الحد الآمن");
 if(rows.some((r,i)=>i>0&&r.length!==rows[0].length))throw Error("يوجد صف بعدد أعمدة مختلف؛ راجع الفواصل وعلامات الاقتباس");
 return rows;
}
function integer(v,label,row){
 if(!/^\d+$/.test(String(v).trim()))throw Error("قيمة "+label+" غير صحيحة في صف "+row);
 const n=Number(v);if(!Number.isSafeInteger(n)||n>100000)throw Error("قيمة "+label+" خارج النطاق في صف "+row);
 return n;
}
function isSaudi(value,label,row){
 const v=canon(value);
 if(!v||["غير محدد","unknown","n a","na","-","null"].includes(v))throw Error("الجنسية غير واضحة في صف "+row);
 if(label==="flag"){
  if(["1","yes","true","y","نعم","سعودي","سعودية"].map(canon).includes(v))return true;
  if(["0","no","false","n","لا","غير سعودي","غير سعودية"].map(canon).includes(v))return false;
  throw Error("قيمة عمود سعودي؟ غير واضحة في صف "+row);
 }
 if(["سعودي","سعودية","السعودية","المملكة العربية السعودية","saudi","saudi arabia","ksa","sa"].map(canon).includes(v))return true;
 if(["غير سعودي","غير سعودية","non saudi","non saudi arabian","expat","expatriate"].map(canon).includes(v))return false;
 if(v.length<3||/^[0-9]+$/.test(v))throw Error("الجنسية غير صالحة في صف "+row);
 return false; // Any explicitly named, valid non-Saudi nationality is non-Saudi.
}
function accreditation(value){
 const v=canon(value);
 if(!v)return null;
 if(["نعم","ساري","معتمد","معتمدة","yes","true","approved","certified","1"].map(canon).includes(v))return true;
 if(["لا","غير معتمد","غير معتمدة","غير ساري","no","false","not accredited","0"].map(canon).includes(v))return false;
 return null;
}
function degreeLevel(value){
 const v=canon(value);
 if(!v)return null;
 if(/دبلوم|diploma/.test(v))return "diploma";
 if(/بكالوريوس|جامعي|bachelor|master|phd|ماجستير|دكتوراه/.test(v))return "bachelor";
 return null;
}
function contributionWage(value,row){
 const v=String(value??"").replace(/[,\s]/g,"");
 if(!v)return null;
 if(!/^(?:\d+)(?:\.\d{1,2})?$/.test(v)||!Number.isFinite(Number(v))||Number(v)>1000000)throw Error("أجر التأمينات غير صحيح في صف "+row);
 return Number(v);
}
function summarize(text,asOf){
 const csv=parseCSV(text),h=csv[0],raw=csv.slice(1);
 const title=pick(h,["المهنة","المسمى المهني","المسمى الوظيفي","المسمى","مسمى المهنة","title","job title","profession","occupation"]);
 const code=pick(h,["رمز المهنة","الرمز المهني","الكود المهني","occupation code","job code","profession code","code"]);
 const count=pick(h,["اجمالي الموظفين","الاجمالي","المجموع","العدد","total","count","employees","total employees"]);
 const saudi=pick(h,["السعوديون","عدد السعوديين","سعودي","saudis","saudi count","saudi employees"]);
 const national=pick(h,["الجنسية","nationality","citizenship","country"]);
 const flag=pick(h,["سعودي؟","سعودي","is saudi","saudi flag","saudi nationality","is saudi national"]);
 const identifier=pick(h,["رقم الموظف","الرقم الوظيفي","employee id","employee number","employee no","id number"]);
 const contribution=pick(h,["الأجر الخاضع للاشتراك","الاجر الخاضع للاشتراك","الأجر المسجل بالتأمينات","gosi wage","registered gosi wage","contribution wage"]);
 const approved=pick(h,["الاعتماد المهني","اعتماد مهني","professional accreditation","professional license"]);
 const education=pick(h,["المؤهل العلمي","المؤهل","المستوى التعليمي","degree","qualification"]);
 if(title<0)throw Error("لم أجد عمود المسمى الوظيفي");
 const grouped=count>=0&&saudi>=0;
 if(!grouped&&national<0&&flag<0)throw Error("يلزم عمود الجنسية أو سعودي؟ لكل موظف، أو عمودا الإجمالي والسعوديين");
 if(!/^20\d{2}-\d{2}-\d{2}$/.test(asOf))throw Error("اختر تاريخ لقطة صحيحًا بصيغة YYYY-MM-DD");
 const checkDate=new Date(asOf+"T00:00:00Z");
 if(!Number.isFinite(checkDate.getTime())||checkDate.toISOString().slice(0,10)!==asOf)throw Error("تاريخ لقطة غير موجود في التقويم");
 const titles=new Map(),codes=new Map(),seenIDs=new Set();let unknownCodes=0;
 for(let j=0;j<raw.length;j++){
  const r=raw[j],line=j+2,t=String(r[title]||"").trim().replace(/\s+/g," ");
  if(!t||t.length>150||/^[=+@]/.test(t)||/^[\-]/.test(t))throw Error("مسمى فارغ أو غير آمن في صف "+line);
  const occupationCode=code>=0?String(r[code]||"").trim():"";
  if(occupationCode&&!/^\d{6}$/.test(occupationCode))throw Error("الرمز المهني يجب أن يكون 6 أرقام في صف "+line);
  if(!occupationCode)unknownCodes++;
  let total,nSaudis;
  if(grouped){
    total=integer(r[count],"الإجمالي",line);nSaudis=integer(r[saudi],"السعوديين",line);
    if(total<1||nSaudis>total)throw Error("الإجمالي أو السعوديون غير منطقيين في صف "+line);
  } else {
    if(identifier>=0&&String(r[identifier]||"").trim()){
      const ident=String(r[identifier]).trim();
      if(seenIDs.has(ident))throw Error("يوجد رقم موظف مكرر في الصف "+line+"؛ يجب تنظيف التكرارات أولاً");
      seenIDs.add(ident);
    }
    total=1;nSaudis=isSaudi(r[national>=0?national:flag],national>=0?"nationality":"flag",line)?1:0;
  }
  const k=canon(t),prev=titles.get(k)||{title:t,total:0,saudi:0};
  prev.total+=total;prev.saudi+=nSaudis;titles.set(k,prev);
  if(occupationCode){
    const key=occupationCode+"|"+k,old=codes.get(key)||{code:occupationCode,title:t,total:0,saudi:0,wageChecked:0,wageBands:{"4500":0,"5000":0,"5500":0,"6000":0,"7000":0,"8000":0},accountingChecked:0,accountingEligible:0};
    old.total+=total;old.saudi+=nSaudis;
    if(!grouped&&nSaudis){
      const wage=contribution>=0?contributionWage(r[contribution],line):null;
      const license=approved>=0?accreditation(r[approved]):null;
      const level=education>=0?degreeLevel(r[education]):null;
      if(wage!==null){old.wageChecked++;for(const threshold of [4500,5000,5500,6000,7000,8000])if(wage>=threshold)old.wageBands[String(threshold)]++}
      if(wage!==null&&license!==null&&level!==null){old.accountingChecked++;if(license&&wage>=(level==="diploma"?4500:6000))old.accountingEligible++}
    }
    codes.set(key,old);
  }
 }
 const entries=[...titles.values()].sort((a,b)=>b.total-a.total||a.title.localeCompare(b.title,"ar"));
 const sum=entries.reduce((acc,x)=>{acc.total+=x.total;acc.saudi+=x.saudi;return acc},{total:0,saudi:0});
 if(sum.total>100000)throw Error("إجمالي الموظفين خارج نطاق الاستيراد");
 const exportData={asOf,organization:"SALIC",source:"ملف محلي مراجع، مجمع دون بيانات شخصية",summary:{total:sum.total,saudi:sum.saudi,nonSaudi:sum.total-sum.saudi,professions:entries.length},rows:entries.map(x=>[x.title,x.total,x.saudi]),deduplication:"الاستيراد المحلي يتحقق من تكرار رقم الموظف إن وجد؛ لا يحفظ أي معرفات"};
 return {mode:grouped?"aggregate":"employees",exportData,codeTotals:[...codes.values()],unverifiedCodes:unknownCodes};
}
function auditCodes(summary,guide){
 const rows=summary.codeTotals||[],checks=[],asOf=summary.exportData?.asOf||"";
 for(const decision of guide.decisions||[]){
  const match=new Map(decision.matchedRoles.map(r=>[r.code,r]));
  const subGroups=decision.grouped?["engineering","development","support"]:[null];
  for(const sg of subGroups){
   const found=rows.filter(x=>match.has(x.code)&&(!sg||match.get(x.code).subgroup===sg));
   const total=found.reduce((n,x)=>n+x.total,0),saudi=found.reduce((n,x)=>n+x.saudi,0);
   let min=decision.min,pct=decision.percent,reason="";
   if(asOf<decision.effective)reason="القرار/المرحلة لم يبدأ تطبيقها وقت اللقطة.";
   if(decision.id==="accounting"){
     const phases=(decision.phases||[]).filter(p=>p[0]<=asOf&&p[2]<=total&&(total>=5?p[2]>=5:p[2]===3)).sort((a,b)=>b[0].localeCompare(a[0]));
     if(phases.length){pct=phases[0][1];min=phases[0][2];reason="";}
     else reason="لا توجد مرحلة محاسبية سارية لهذا العدد بتاريخ اللقطة.";
   }
   const active=total>=min&&!reason,desired=active?(decision.rounding==="nearest"?Math.round(total*pct/100):Math.ceil(total*pct/100)):null;
   const mismatches=found.filter(x=>canon(x.title)!==canon(match.get(x.code).title));
   const wageRule=typeof decision.minimumEligibleSaudiWage==="number"?decision.minimumEligibleSaudiWage:
     decision.id==="ict"?(decision.minimumEligibleSaudiWage?.[sg]??null):null;
   const covered=decision.id==="accounting"?found.reduce((n,x)=>n+(x.accountingChecked||0),0):
     wageRule===null?0:found.reduce((n,x)=>n+(x.wageChecked||0),0);
   const eligible=decision.id==="accounting"?found.reduce((n,x)=>n+(x.accountingEligible||0),0):
     wageRule===null?null:found.reduce((n,x)=>n+(x.wageBands?.[String(wageRule)]||0),0);
   const allEligibilityFieldsKnown=saudi===covered&&eligible!==null;
   const countableSaudis=allEligibilityFieldsKnown?eligible:null;
   const eligibilityGap=active&&allEligibilityFieldsKnown?Math.max(0,desired-countableSaudis):null;
   checks.push({decisionId:decision.id,title:decision.title+(sg?" · "+sg:""),total,saudi,nonSaudi:total-saudi,rate:pct,required:desired,numericGap:desired===null?null:Math.max(0,desired-saudi),titleMismatchCount:mismatches.length,eligibleSaudisIfEvidenceComplete:countableSaudis,eligibleCountCoverage:covered,eligibleGapHypothesis:eligibilityGap,provisional:summary.unverifiedCodes>0||mismatches.length>0||!allEligibilityFieldsKnown,reason:reason||"تحتاج مطابقة الأجر والاعتماد والنشاط وشروط الدليل والرمز الفعلي في قوى.",warning:"استرشادي فقط: لا يثبت الأجر أو الاعتماد أو النشاط أو استيفاء المراحل، وقد توجد أكواد غير مدخلة في الملف."});
  }
 }
 return checks;
}

function download(data,filename){
 const blob=new Blob(["\ufeff"+JSON.stringify(data,null,2)+"\n"],{type:"application/json;charset=utf-8"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const api={parseCSV,summarize,auditCodes,canon};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
if(root){root.RadarImport=api}
if(typeof document==="undefined")return;
const $=id=>document.getElementById(id);
const state={summary:null,guide:null};
function msg(s,kind){const e=$("import-status");e.textContent=s;e.dataset.kind=kind||"info"}
const readLocal=(file)=>new Promise((resolve,reject)=>{const rd=new FileReader();rd.onload=()=>resolve(String(rd.result));rd.onerror=()=>reject(Error("تعذر قراءة الملف محليًا"));rd.readAsText(file,"utf-8")});
async function init(){
 const btn=$("process-csv"),file=$("csv-file"),save=$("save-summary"),saveCode=$("save-code");
 btn.addEventListener("click",async()=>{
  state.summary=null;save.disabled=true;saveCode.disabled=true;$("import-summary").textContent="";
  if(!file.files||file.files.length!==1){msg("اختر ملف CSV أولًا.","warn");return}
  const f=file.files[0];if(f.size>MAX_BYTES){msg("الملف أكبر من 5 ميجابايت؛ يرجى تصغيره.","error");return}
  try{
    const data=await readLocal(f),res=summarize(data,$("snapshot-date").value);
    state.summary=res;
    const d=res.exportData,s=d.summary;
    $("import-summary").textContent="قرئت البيانات محليًا دون إرسال الملف: "+s.total+" موظفًا، "+s.saudi+" سعوديًا، "+s.nonSaudi+" غير سعودي، "+s.professions+" مسمى. "+(res.unverifiedCodes?"ينقص الرمز المهني في "+res.unverifiedCodes+" صفًا؛ لا يمكن اعتبار مطابقته نظامية.":"كل الصفوف تتضمن رمزًا مهنيًا؛ تطابقه مع قوى يبقى مسؤولية مصدر الملف.");
    try{
      if(!state.guide){const r=await fetch("data/guide-matching.json",{cache:"no-store"});if(!r.ok)throw Error("No guide");state.guide=await r.json()}
      const checks=auditCodes(res,state.guide).filter(x=>x.total>0);
      const mismatchCount=checks.reduce((a,x)=>a+x.titleMismatchCount,0);
      if(mismatchCount)msg("تنبيه: توجد "+mismatchCount+" اختلافات بين رمز المهنة والمسمى في الدليل؛ راجعها قبل الاعتماد.","warn");
      $("code-analysis").textContent=checks.length?checks.map(x=>x.title+": "+x.total+" موظف، "+x.saudi+" سعودي، الفجوة الافتراضية قبل شروط الأجر "+(x.numericGap??"غير قابلة للحساب الآن")+"، النسبة المرجعية "+x.rate+"%، المؤهلون حسابيًا حسب الأجر/الاعتماد "+(x.eligibleSaudisIfEvidenceComplete??"غير مثبت")+(x.eligibleGapHypothesis===null?"":" · فجوة افتراضية بعد الضوابط: "+x.eligibleGapHypothesis)+(x.provisional?" · يحتاج تحقق من الرموز والاشتراطات":"")).join("\n"):"لا توجد رموز من الأدلة المراجعة في الملف، أو لم تُدخل أكواد المهن.";
    }catch(e){$("code-analysis").textContent="تعذر تحميل دليل الأكواد؛ يبقى ملخص الموظفين صالحًا للتنزيل بعد المراجعة."}
    msg("اكتمل التحقق الحسابي المحلي. راجع النتائج قبل تنزيل أي ملف مجمع.","ok");
    save.disabled=false;saveCode.disabled=res.codeTotals.length===0;
  }catch(e){msg(e.message||"تعذر التحقق من الملف.","error");$("code-analysis").textContent=""}
 });
 save.addEventListener("click",()=>{if(state.summary)download(state.summary.exportData,"salic-workforce-reviewed.json")});
 saveCode.addEventListener("click",()=>{if(state.summary)download({asOf:state.summary.exportData.asOf,source:"code groups from privately reviewed local file",groups:state.summary.codeTotals.map(x=>({code:x.code,title:x.title,total:x.total,saudi:x.saudi}))},"occupation-code-aggregates.json")});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})(typeof window!=="undefined"?window:null);
