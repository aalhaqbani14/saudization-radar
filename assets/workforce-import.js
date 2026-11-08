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
  if(["1","yes","true","y","نعم","سعودي","سعودية"].includes(v))return true;
  if(["0","no","false","n","لا","غير سعودي","غير سعودية"].includes(v))return false;
  throw Error("قيمة عمود سعودي؟ غير واضحة في صف "+row);
 }
 if(["سعودي","سعودية","السعودية","المملكة العربية السعودية","saudi","saudi arabia","ksa","sa"].includes(v))return true;
 if(["غير سعودي","غير سعودية","non saudi","non saudi arabian","expat","expatriate"].includes(v))return false;
 if(v.length<3||/^[0-9]+$/.test(v))throw Error("الجنسية غير صالحة في صف "+row);
 return true===false; // Any named non-Saudi nationality is non-Saudi.
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
 if(title<0)throw Error("لم أجد عمود المسمى الوظيفي");
 const grouped=count>=0&&saudi>=0;
 if(!grouped&&national<0&&flag<0)throw Error("يلزم عمود الجنسية أو سعودي؟ لكل موظف، أو عمودا الإجمالي والسعوديين");
 if(!/^20\d{2}-\d{2}-\d{2}$/.test(asOf)||!Number.isFinite(Date.parse(asOf+"T00:00:00Z")))throw Error("اختر تاريخ لقطة صحيحًا بصيغة YYYY-MM-DD");
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
    const key=occupationCode+"|"+k,old=codes.get(key)||{code:occupationCode,title:t,total:0,saudi:0};
    old.total+=total;old.saudi+=nSaudis;codes.set(key,old);
  }
 }
 const entries=[...titles.values()].sort((a,b)=>b.total-a.total||a.title.localeCompare(b.title,"ar"));
 const sum=entries.reduce((acc,x)=>{acc.total+=x.total;acc.saudi+=x.saudi;return acc},{total:0,saudi:0});
 if(sum.total>100000)throw Error("إجمالي الموظفين خارج نطاق الاستيراد");
 const exportData={asOf,organization:"SALIC",source:"ملف محلي مراجع، مجمع دون بيانات شخصية",summary:{total:sum.total,saudi:sum.saudi,nonSaudi:sum.total-sum.saudi,professions:entries.length},rows:entries.map(x=>[x.title,x.total,x.saudi]),deduplication:"الاستيراد المحلي يتحقق من تكرار رقم الموظف إن وجد؛ لا يحفظ أي معرفات"};
 return {mode:grouped?"aggregate":"employees",exportData,codeTotals:[...codes.values()],unverifiedCodes:unknownCodes};
}
function auditCodes(summary,guide){
 const rows=summary.codeTotals||[],checks=[];
 for(const decision of guide.decisions||[]){
  const match=new Map(decision.matchedRoles.map(r=>[r.code,r]));
  const subGroups=decision.grouped?["engineering","development","support"]:[null];
  for(const sg of subGroups){
   const found=rows.filter(x=>match.has(x.code)&&(!sg||match.get(x.code).subgroup===sg));
   const total=found.reduce((n,x)=>n+x.total,0),saudi=found.reduce((n,x)=>n+x.saudi,0);
   const min=decision.min,pct=decision.percent,active=total>=min;
   const desired=active?(decision.rounding==="nearest"?Math.round(total*pct/100):Math.ceil(total*pct/100)):null;
   checks.push({decisionId:decision.id,title:decision.title+(sg?" · "+sg:""),total,saudi,nonSaudi:total-saudi,required:desired,numericGap:desired===null?null:Math.max(0,desired-saudi),warning:"استرشادي فقط: لا يثبت الأجر أو الاعتماد أو النشاط أو استيفاء المراحل، وقد توجد أكواد غير مدخلة في الملف."});
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
      $("code-analysis").textContent=checks.length?checks.map(x=>x.title+": "+x.total+" موظف، "+x.saudi+" سعودي، فجوة حسابية "+(x.numericGap??"دون حد العدد")).join("\n"):"لا توجد رموز من الأدلة المراجعة في الملف، أو لم تُدخل أكواد المهن.";
    }catch(e){$("code-analysis").textContent="تعذر تحميل دليل الأكواد؛ يبقى ملخص الموظفين صالحًا للتنزيل بعد المراجعة."}
    msg("اكتمل التحقق الحسابي المحلي. راجع النتائج قبل تنزيل أي ملف مجمع.","ok");
    save.disabled=false;saveCode.disabled=res.codeTotals.length===0;
  }catch(e){msg(e.message||"تعذر التحقق من الملف.","error");$("code-analysis").textContent=""}
 });
 save.addEventListener("click",()=>{if(state.summary)download(state.summary.exportData,"salic-workforce-reviewed.json")});
 saveCode.addEventListener("click",()=>{if(state.summary)download({asOf:state.summary.exportData.asOf,source:"code groups from privately reviewed local file",groups:state.summary.codeTotals},"occupation-code-aggregates.json")});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})(typeof window!=="undefined"?window:null);
