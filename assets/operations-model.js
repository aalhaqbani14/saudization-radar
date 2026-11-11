/* Operational follow-up in an unauthenticated static site.
 * PUBLIC-SITE SAFEGUARD: no employee names, IDs, attachments, or free-text notes.
 * Local browser state is not a shared or tamper-proof audit record.
 */
(function(root){
"use strict";
const VERSION=1,KEY="saudization-radar-operations-v1";
const STEPS=Object.freeze([
 {id:"codes",title:"مطابقة الرموز المهنية المسجلة في قوى",team:"الخدمات الحكومية",help:"تأكد من المهن الفعلية ورموزها لا من المسميات الداخلية وحدها."},
 {id:"scope",title:"مراجعة نطاق القرار والاشتراطات",team:"الالتزام",help:"النشاط والكيان، الحد الأدنى، الأجر، الاعتماد المهني وفترات التطبيق."},
 {id:"gap",title:"تدقيق الأعداد والفجوة الأولية",team:"الموارد البشرية",help:"يُعتمد العدد فقط بعد المطابقة، وتُمنع إضافة الفجوات المتداخلة."},
 {id:"plan",title:"إعداد خطة المعالجة النظامية",team:"الموارد البشرية",help:"التوظيف أو الإحلال الحقيقي أو التأهيل حسب الأعمال الفعلية، لا تغيير مسمى صوري."},
 {id:"review",title:"مراجعة الخطة وتوثيق اعتمادها خارجيًا",team:"الالتزام",help:"تسجيل حالة المراجعة هنا لا يُعد اعتمادًا رسميًا ولا يغيّر أي منصة حكومية."}
]);
const TEAMS=Object.freeze(["غير محدد","الخدمات الحكومية","الموارد البشرية","الالتزام","الشؤون القانونية","الإدارة المعنية","المشتريات والخدمات الإدارية"]);
const STATUS=Object.freeze({todo:"لم يبدأ",doing:"قيد التنفيذ",review:"بانتظار المراجعة",blocked:"متوقف",done:"مكتمل يدويًا"});
const EVIDENCE=Object.freeze({pending:"غير مكتمل",checked:"تمت مراجعته يدويًا"});
const SEEDS=Object.freeze(["admin","accounting","project","techeng"]);
const statIds=Object.keys(STATUS),evIds=Object.keys(EVIDENCE);
const plain=v=>typeof v==="string"?v:"";
const validDate=v=>v===""||(/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+"T00:00:00Z"))&&new Date(v+"T00:00:00Z").toISOString().slice(0,10)===v);
const time=()=>new Date().toISOString();
const normStore=s=>JSON.parse(JSON.stringify(s));
const hasOwn=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
function taskFrom(step){return {id:step.id,status:"todo",team:step.team,due:"",evidence:"pending"}}
function planFor(id){return {id,startedAt:time(),tasks:STEPS.map(taskFrom)}}
function blank(){return {version:VERSION,plans:SEEDS.map(planFor),events:[],lastSaved:null,source:"local"}}
function safeHistoryValue(value){
 const x=plain(value).slice(0,80);
 if(["","قالب مقترح","إزالة المتابعة المحلية"].includes(x))return x;
 const i=x.indexOf(":");if(i<0)return "";
 const field=x.slice(0,i),val=x.slice(i+1);
 if(field==="status"&&statIds.includes(val)||field==="team"&&TEAMS.includes(val)||field==="evidence"&&evIds.includes(val)||field==="due"&&validDate(val))return field+":"+val;
 return "";
}
function sanitize(raw,validDecisionIds){
 if(!raw||typeof raw!=="object"||Array.isArray(raw)||raw.version!==VERSION||!Array.isArray(raw.plans)||raw.plans.length>50||!Array.isArray(raw.events)||raw.events.length>1000)throw Error("unsupported_snapshot");
 const valid=new Set(validDecisionIds),found=new Set();
 const plans=raw.plans.map(p=>{
  if(!p||typeof p!=="object"||!valid.has(p.id)||found.has(p.id)||!Array.isArray(p.tasks)||p.tasks.length!==STEPS.length)throw Error("invalid_plan");
  found.add(p.id);const seen=new Set();
  const tasks=p.tasks.map(t=>{
   if(!t||typeof t!=="object"||!STEPS.some(a=>a.id===t.id)||seen.has(t.id)||!statIds.includes(t.status)||!TEAMS.includes(t.team)||!evIds.includes(t.evidence)||!validDate(t.due)||t.status==="done"&&(t.evidence!=="checked"||t.team==="غير محدد"))throw Error("invalid_task");
   seen.add(t.id);
   return {id:t.id,status:t.status,team:t.team,due:t.due,evidence:t.evidence};
  });
  return {id:p.id,startedAt:typeof p.startedAt==="string"&&/^20\d{2}-/.test(p.startedAt)?p.startedAt.slice(0,35):time(),tasks:STEPS.map(s=>tasks.find(x=>x.id===s.id))};
 });
 const events=raw.events.map(e=>{
  if(!e||typeof e!=="object"||!valid.has(e.decision)||!STEPS.some(s=>s.id===e.step)&&e.step!=="plan"||!["created","deleted","task_changed","restored"].includes(e.action)||typeof e.at!=="string")throw Error("invalid_history");
  return {at:e.at.slice(0,35),decision:e.decision,step:e.step,action:e.action,old:safeHistoryValue(e.old),value:safeHistoryValue(e.value)};
 });
 return {version:VERSION,plans,events,lastSaved:null,source:"local"};
}
function update(state,decision,step,updates,validIds){
 const current=sanitize(state,validIds),p=current.plans.find(x=>x.id===decision),t=p?.tasks.find(x=>x.id===step);
 if(!t)throw Error("unknown_task");
 if(!updates||Object.keys(updates).some(k=>!["team","due","status","evidence"].includes(k)))throw Error("invalid_update");
 const next={...t,...updates};
 if(!statIds.includes(next.status)||!TEAMS.includes(next.team)||!evIds.includes(next.evidence)||!validDate(next.due))throw Error("invalid_update");
 if(next.status==="done"&&(next.evidence!=="checked"||next.team==="غير محدد"))throw Error("completion_requires_review_and_team");
 const changes=Object.keys(t).filter(k=>k!=="id"&&next[k]!==t[k]);
 if(changes.length){
  p.tasks=p.tasks.map(x=>x.id===step?next:x);
  for(const field of changes)current.events.unshift({at:time(),decision,step,action:"task_changed",old:field+":"+t[field],value:field+":"+next[field]});
  current.events=current.events.slice(0,500);
 }
 return current;
}
function addPlan(state,decision,validIds){
 const current=sanitize(state,validIds);
 if(!validIds.includes(decision)||current.plans.some(x=>x.id===decision))throw Error("already_tracked_or_invalid");
 current.plans.push(planFor(decision));
 current.events.unshift({at:time(),decision,step:"plan",action:"created",old:"",value:"قالب مقترح"});
 current.events=current.events.slice(0,500);return current;
}
function removePlan(state,decision,validIds){
 const current=sanitize(state,validIds);
 if(!current.plans.some(x=>x.id===decision))throw Error("not_tracked");
 current.plans=current.plans.filter(x=>x.id!==decision);
 current.events.unshift({at:time(),decision,step:"plan",action:"deleted",old:"",value:"إزالة المتابعة المحلية"});
 current.events=current.events.slice(0,500);return current;
}
function summary(state,today){
 const plans=state.plans,items=plans.flatMap(p=>p.tasks.map(t=>({...t,decision:p.id})));
 const done=items.filter(t=>t.status==="done").length,blocked=items.filter(t=>t.status==="blocked").length;
 const overdue=items.filter(t=>t.due&&t.due<today&&t.status!=="done").length;
 const next=items.filter(t=>t.due&&t.due>=today&&t.status!=="done").sort((a,b)=>a.due.localeCompare(b.due));
 return {plans:plans.length,tasks:items.length,done,blocked,overdue,nextDue:next[0]?.due||null,percent:items.length?Math.round(done/items.length*100):0};
}
function serialize(state,validIds){return JSON.stringify(sanitize(state,validIds),null,2)}
const api={VERSION,KEY,STEPS,TEAMS,STATUS,EVIDENCE,SEEDS,blank,planFor,sanitize,update,addPlan,removePlan,summary,serialize};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
if(root)root.RadarOperations=api;
})(typeof window!=="undefined"?window:null);
