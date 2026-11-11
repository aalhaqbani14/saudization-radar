/* Protected collaborative Operations Room.
 * Public GitHub Pages hosts ONLY UI and anon key; RLS, roles and audits live in Supabase.
 * Disabled until an approved organization provisions a project and memberships.
 */
(async function(){
"use strict";
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const linkSafe=v=>{try{const u=new URL(String(v||""));return u.protocol==="https:"&&/(^|\.)hrsd\.gov\.sa$/.test(u.hostname)?u.href:null}catch{return null}};
const roles={owner:"مالك الصلاحيات",manager:"مدير / معتمد",editor:"محرر",viewer:"مُطّلع"};
const statusList={todo:"لم يبدأ",doing:"قيد التنفيذ",review:"بانتظار مراجعة",blocked:"متوقف",done:"مكتمل يدويًا"};
const stepList={codes:"مطابقة رموز قوى",scope:"نطاق القرار والاشتراطات",gap:"تدقيق الفجوة",plan:"خطة المعالجة",review:"مراجعة الأدلة"};
const teamList=["غير محدد","الخدمات الحكومية","الموارد البشرية","الالتزام","الشؤون القانونية","الإدارة المعنية","المشتريات والخدمات الإدارية"];
let db=null,config=null,user=null,member=null,decisions=[],dmap=new Map(),plans=[],tasks=[],approvals=[],audit=[],selected=null,loading=false;
function msg(value,bad=false){const el=$("message");el.textContent=value;el.className=bad?"error":"";}
function show(name){for(const id of ["setup","login","dashboard"])$(id).hidden=id!==name;}
function options(items,value){return items.map(([id,text])=>'<option value="'+esc(id)+'"'+(id===value?" selected":"")+'>'+esc(text)+'</option>').join("");}
function validConfig(c){
 if(!c||c.enabled!==true||c.provider!=="supabase")return false;
 if(typeof c.url!=="string"||!/^https:\/\/[a-z0-9-]{5,}\.supabase\.co\/?$/.test(c.url))return false;
 if(typeof c.anonKey!=="string"||c.anonKey.length<25||c.anonKey.startsWith("sb_secret_")||c.anonKey.includes("service_role"))return false;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c.orgId||""))return false;
 if(c.anonKey.startsWith("eyJ")){try{const raw=c.anonKey.split(".")[1].replace(/-/g,"+").replace(/_/g,"/");const b64=raw+"=".repeat((4-raw.length%4)%4);const payload=JSON.parse(atob(b64));if(payload.role!=="anon")return false}catch(_){return false}}
 return true;
}
const canEdit=()=>!!member&&["owner","manager","editor"].includes(member.role);
const canApprove=()=>!!member&&["owner","manager"].includes(member.role);
async function request(table,cols,sort){let q=db.from(table).select(cols).eq("org_id",config.orgId);if(sort)q=q.order(sort,{ascending:false});const {data,error}=await q;if(error)throw error;return data||[];}
function todayRiyadh(){
 const p=Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));
 return p.year+"-"+p.month+"-"+p.day;
}
function planTasks(id){return tasks.filter(x=>x.plan_id===id);}
function latestApproval(t){return approvals.find(x=>x.task_id===t.id&&x.task_version===t.version);}
function kpi(label,value){return '<span>'+esc(label)+' <b>'+Number(value||0).toLocaleString("en-US")+'</b></span>';}
function render(){
 if(!member)return;
 $("role").textContent="مستوى الوصول: "+(roles[member.role]||"مستخدم")+" · تظهر البيانات للمستخدمين المصرح لهم فقط";
 const completed=tasks.filter(t=>t.status==="done").length,approved=tasks.filter(t=>latestApproval(t)?.outcome==="approved").length;
 const overdue=tasks.filter(t=>t.due_on&&t.due_on<todayRiyadh()&&t.status!=="done").length;
 $("kpis").innerHTML=kpi("خطط",plans.length)+kpi("إجراءات",tasks.length)+kpi("مكتملة يدويًا",completed)+kpi("معتمدة في إصدارها",approved)+kpi("متأخرة",overdue);
 const toAdd=decisions.filter(d=>!plans.some(p=>p.decision_id===d.id));
 $("add-row").hidden=!canEdit();$("add").disabled=toAdd.length===0;
 $("decision-to-add").innerHTML=options(toAdd.map(d=>[d.id,d.title]),toAdd[0]?.id)||'<option value="">كل القرارات مضافة</option>';
 $("plans").innerHTML=plans.map(p=>{
  const t=planTasks(p.id),done=t.filter(x=>x.status==="done").length,approval=t.filter(x=>latestApproval(x)?.outcome==="approved").length;
  return '<button type="button" class="item '+(p.id===selected?"active":"")+'" data-plan="'+esc(p.id)+'"><b>'+esc(dmap.get(p.decision_id)?.title||p.decision_id)+'</b><small>'+done+'/'+t.length+' مكتملة · '+approval+' معتمدة</small></button>';
 }).join("")||'<p class="muted">لا توجد خطط مشتركة حتى الآن.</p>';
 const p=plans.find(x=>x.id===selected);$("details").innerHTML=p?planMarkup(p):'<p class="muted">اختر خطة من القائمة.</p>';
 $("audit").innerHTML=audit.slice(0,100).map(x=>'<tr><td>'+esc(x.occurred_at?.slice(0,19).replace("T"," ")||"")+' UTC</td><td>'+esc(x.entity_kind)+'</td><td>'+esc(x.event_kind)+'</td></tr>').join("")||'<tr><td colspan="3">لا يوجد نشاط مسجل.</td></tr>';
}
function planMarkup(p){
 const d=dmap.get(p.decision_id),href=linkSafe(d?.source),ts=planTasks(p.id);
 const approved=ts.filter(x=>latestApproval(x)?.outcome==="approved").length;
 const stage=d?.nextEffective?'<p class="muted">مرحلة قادمة: '+esc(d.nextEffective)+' · '+esc(String(d.nextPct||""))+'%</p>':"";
 const rows=ts.map(t=>{
  const review=latestApproval(t),isApproved=review?.outcome==="approved",canApproveTask=canApprove()&&t.status==="done";
  const note=review?(isApproved?"معتمد بواسطة مستخدم مخوّل لهذا الإصدار":"طلب تعديل من المعتمد"):(t.status==="done"?"بانتظار اعتماد المسؤول":"لا يوجد اعتماد");
  const form=canEdit()?'<div class="fields" data-task="'+esc(t.id)+'">'+
    '<label>القسم<select data-field="team">'+options(teamList.map(x=>[x,x]),t.team)+'</select></label>'+
    '<label>الحالة<select data-field="status">'+options(Object.entries(statusList),t.status)+'</select></label>'+
    '<label>الموعد<input data-field="due_on" type="date" value="'+esc(t.due_on||"")+'"></label>'+
    '<label>مراجعة الأدلة<select data-field="evidence_checked">'+options([["false","غير مكتملة"],["true","راجعت الأدلة خارج الموقع"]],String(t.evidence_checked))+'</select></label>'+
    '<button type="button" class="btn" data-save="'+esc(t.id)+'">حفظ</button></div>':"";
  const controls=canApproveTask?'<div class="actions" style="margin-top:11px"><button class="btn" data-approve="'+esc(t.id)+'" type="button">اعتماد المرحلة</button><button class="btn secondary" data-reject="'+esc(t.id)+'" type="button">رفض الاعتماد</button></div>':"";
  return '<div class="task"><div class="row"><h3>'+esc(stepList[t.step_id]||t.step_id)+'</h3><span class="pill'+(t.status==="blocked"?' alert':'')+'">'+esc(statusList[t.status]||t.status)+'</span></div><p class="muted">'+esc(note)+' · إصدار '+t.version+' · '+esc(t.updated_at?.slice(0,10)||"")+'</p>'+form+controls+'</div>';
 }).join("");
 return '<div class="row"><div><h2>'+esc(d?.title||p.decision_id)+'</h2><p class="muted">قرار '+esc(d?.number||"غير مدون")+' · '+esc(d?.rate||"غير محددة")+'</p>'+stage+'</div><span class="pill">'+approved+'/'+ts.length+' مراحل معتمدة</span></div>'+
 '<div class="actions">'+(href?'<a class="btn secondary" href="'+esc(href)+'" target="_blank" rel="noopener noreferrer">الدليل الرسمي</a>':"")+'<a class="btn secondary" href="decision-watch.html">تقويم القرارات</a></div>'+
 '<p class="muted">التقدم مرتبط بمراجعات بشرية؛ لا يدل على امتثال قانوني أو اعتماد حكومي. لا تدخل بيانات شخصية ضمن الحقول.</p>'+rows;
}
async function refresh(){
 if(loading||!user||!member)return;loading=true;
 try{
  [plans,tasks,approvals,audit]=await Promise.all([
   request("sradar_plans","id,org_id,decision_id,archived,created_at"),
   request("sradar_tasks","id,org_id,plan_id,step_id,status,team,due_on,evidence_checked,version,updated_at"),
   request("sradar_approvals","id,org_id,task_id,task_version,outcome,approved_at,approved_by","approved_at"),
   request("sradar_audit_events","id,org_id,entity_kind,entity_id,event_kind,occurred_at,actor_id","occurred_at")
  ]);
  plans=plans.filter(x=>!x.archived);
  if(!plans.some(p=>p.id===selected))selected=plans[0]?.id||null;
  render();show("dashboard");
 }catch(_){msg("تعذر تحميل البيانات المحمية. تحقق من صلاحيات المشروع وسياسات RLS، ثم أعد المحاولة.",true)}
 finally{loading=false}
}
async function authCheck(){
 const {data:{user:current},error}=await db.auth.getUser();
 if(error||!current){user=null;member=null;show("login");return}
 user=current;
 const {data,error:membershipError}=await db.from("sradar_members").select("org_id,user_id,role,active").eq("org_id",config.orgId).eq("user_id",user.id).eq("active",true).maybeSingle();
 if(membershipError||!data||!roles[data.role]){member=null;show("login");msg("تم تسجيل الدخول، لكن ما عندك عضوية مصرّح بها لهذا المشروع. اطلب من مسؤول النظام إضافتك.",true);return}
 member=data;await refresh();
}
$("login-form").addEventListener("submit",async e=>{
 e.preventDefault();if(!db)return;
 const email=$("email").value.trim();if(!email)return;
 const {error}=await db.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname,shouldCreateUser:false}});
 msg(error?"تعذر إرسال رابط الدخول. تأكد من أن الحساب مسجل ومفعّل.":"أُرسل طلب رابط الدخول. افتح بريدك المعتمد، ثم عد إلى هذه الصفحة.",!!error);
});
$("logout").addEventListener("click",async()=>{if(db)await db.auth.signOut();user=null;member=null;plans=[];tasks=[];approvals=[];audit=[];show("login");msg("تم تسجيل الخروج.")});
$("refresh").addEventListener("click",refresh);
$("plans").addEventListener("click",e=>{const b=e.target.closest("[data-plan]");if(!b)return;selected=b.dataset.plan;render()});
$("add").addEventListener("click",async()=>{
 if(!canEdit())return;const decision=$("decision-to-add").value;
 if(!decisions.some(d=>d.id===decision))return;
 try{
  const {error}=await db.rpc("sradar_create_plan",{p_org:config.orgId,p_decision:decision});if(error)throw error;
  msg("أُنشئت خطة مشتركة مع خمس خطوات. لم تُسند مسؤوليات لأفراد ولم تُغيّر أنظمة الوزارة.");await refresh();
 }catch(_){msg("فشل إنشاء خطة مشتركة. تحقق من الصلاحيات أو عدم وجود خطة سابقة للقرار.",true)}
});
$("details").addEventListener("click",async e=>{
 const button=e.target.closest("[data-save],[data-approve],[data-reject]");if(!button||!member)return;
 const tid=button.dataset.save||button.dataset.approve||button.dataset.reject;
 const t=tasks.find(x=>x.id===tid);if(!t)return;
 button.disabled=true;
 try{
  if(button.hasAttribute("data-save")){
   if(!canEdit())return;
   const el=button.closest("[data-task]"),get=k=>el.querySelector('[data-field="'+k+'"]').value;
   const update={team:get("team"),status:get("status"),due_on:get("due_on")||null,evidence_checked:get("evidence_checked")==="true"};
   if(update.status==="done"&&(!update.evidence_checked||update.team==="غير محدد")){msg("لا يمكن إغلاق الإجراء قبل تحديد قسم ومراجعة أدلته خارج الموقع.",true);return}
   const {data,error}=await db.from("sradar_tasks").update(update).eq("id",tid).eq("org_id",config.orgId).eq("version",t.version).select("id");
   if(error||!data?.length)throw Error("conflict");
   msg("حُفظ الإجراء على الخادم وسُجّل تغييره؛ يتطلب الاعتماد من شخص مخوّل.");
  }else{
   if(!canApprove()||t.status!=="done")return;
   const outcome=button.hasAttribute("data-approve")?"approved":"rejected";
   if(!window.confirm((outcome==="approved"?"تأكيد الاعتماد الإداري":"تأكيد رفض الاعتماد")+" لهذا الإصدار من المهمة؟"))return;
   const {error}=await db.from("sradar_approvals").insert({org_id:config.orgId,task_id:tid,task_version:t.version,outcome});
   if(error)throw error;
   msg(outcome==="approved"?"سُجّل الاعتماد لهذا الإصدار فقط.":"سُجّل رفض الاعتماد. يمكن تعديل المهمة ثم إعادة مراجعتها.");
  }
  await refresh();
 }catch(_){msg("تعذر الإجراء. قد تكون تغيرت نسخة المهمة أو الصلاحيات؛ حدّث البيانات قبل المحاولة.",true)}
 finally{button.disabled=false}
});
try{
 const resp=await fetch("data/team-ops-config.json?ts="+Date.now(),{cache:"no-store"});
 if(!resp.ok)throw Error("config");
 config=await resp.json();
 if(!validConfig(config)){show("setup");return}
 if(!window.supabase?.createClient){show("setup");msg("تعذر تحميل أداة المصادقة. تحقق من اتصالك أو سياسة الموارد الخارجية.",true);return}
 const [catalog]=await Promise.all([fetch("data/decisions.json?ts="+Date.now(),{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("catalog");return r.json()})]);
 decisions=(catalog.decisions||[]).filter(d=>typeof d.id==="string"&&/^[a-z0-9-]{2,40}$/.test(d.id)&&d.salicScope?.status!=="excluded_from_current_workforce_dashboard");
 dmap=new Map(decisions.map(d=>[d.id,d]));
 db=window.supabase.createClient(config.url,config.anonKey,{auth:{detectSessionInUrl:true,persistSession:true,autoRefreshToken:true}});
 db.auth.onAuthStateChange((event)=>{if(event==="SIGNED_IN"||event==="SIGNED_OUT")setTimeout(authCheck,0)});
 await authCheck();
}catch(_){show("setup");msg("تعذر تهيئة الخدمة المؤسسية، ولن يتم تشغيل الغرفة المشتركة بدون إعداد آمن.",true)}
})();
