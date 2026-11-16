/* Private-free readiness UI. All external content rendered with textContent. */
(() => {
  "use strict";
  const core = window.RadarCompletion;
  if (!core) return;
  const $ = id => document.getElementById(id);
  const fmt = v => Number(v).toLocaleString("en-US",{maximumFractionDigits:2});
  const node = (tag, value, cls) => {
    const x = document.createElement(tag);
    if (value !== undefined && value !== null) x.textContent=String(value);
    if (cls) x.className=cls;
    return x;
  };
  const add = (parent, ...nodes) => parent.append(...nodes);
  const statusText = {
    needs_review:["قيد التدقيق","warn"],
    awaiting_external_evidence:["بانتظار مصدر رسمي","warn"],
    estimates_only:["استرشادي فقط","warn"],
    proposals_only:["خطة مقترحة","info"],
    read_only:["قراءة فقط","info"],
    verification_required:["تحقق مستمر","warn"],
    reference_ready:["فهرس مرجعي","info"],
    ready_for_recheck:["يتطلب مراجعة دورية","info"],
    requires_scope_review:["تحقق من النطاق","warn"]
  };
  function pill(state) {
    const [label,css]=statusText[state]||["غير محدد","warn"];
    return node("span",label,"chip "+css);
  }
  const link=(url,title)=>{
    if(!core.validOfficialLink(url))return node("small","المصدر غير مثبت");
    const a=node("a",title||"المصدر الرسمي");
    a.href=url;a.target="_blank";a.rel="noopener noreferrer";a.referrerPolicy="no-referrer";
    return a;
  };
  const json=async path=>{
    const response=await fetch(path,{cache:"no-store"});
    if(!response.ok) throw Error("load_"+path);
    return response.json();
  };
  let report=null,inputs=null;
  function renderStreams(items) {
    const root=$("streams"),fragment=document.createDocumentFragment();
    items.forEach(item=>{
      const card=node("article",null,"item");
      const head=node("div");add(head,node("h3",item.title),pill(item.state));
      add(card,head,node("p",item.detail),node("small","المسؤول المقترح: "+item.owner),node("small","الخطوة القادمة: "+item.action));
      fragment.append(card);
    });root.replaceChildren(fragment);
  }
  function renderPending(entries) {
    const fragment=document.createDocumentFragment();
    entries.forEach(x=>{
      const tr=node("tr");
      const c1=node("td");
      add(c1,node("strong",x.title),node("div","القرار: "+x.number));
      if(x.source)add(c1,link(x.source,"صفحة الوزارة"));
      if(x.secondary)add(c1,node("span"," · "),link(x.secondary,"دليل إضافي"));
      const c2=node("td");
      const ul=node("ul",null,"checks");
      x.checks.slice(0,6).forEach(y=>ul.append(node("li",y)));
      add(c2,node("div",x.limit),ul);
      const c3=node("td");
      add(c3,pill("needs_review"),node("small",x.metadataVerified?"بيانات أساسية مرجعية؛ الجداول لم تعتمد":"تحتاج أدلة أصلية"));
      add(tr,c1,c2,c3);fragment.append(tr);
    });
    $("pending-rows").replaceChildren(fragment);
    $("pending-label").textContent=entries.length+" قرارات للمراجعة";
  }
  function renderPlans(plans) {
    const fragment=document.createDocumentFragment();
    plans.forEach(p=>{
      const card=node("article",null,"plan");
      const ol=node("ol");p.steps.forEach(x=>ol.append(node("li",x)));
      add(card,node("h3",p.name),ol);fragment.append(card);
    });$("plans").replaceChildren(fragment);
  }
  function renderCrosswalk() {
    const outcome=core.crosswalk(inputs.workforce,inputs.catalog);
    const target=$("crosswalk-results");
    const summary=node("div",null,"result");
    summary.textContent="من "+outcome.total+" مسمى: "+outcome.candidates+" لها رمز مرشح واحد، و"+
      outcome.ambiguous+" مسميات لها أكثر من احتمال، و"+outcome.missing+
      " مسميات دون مطابقة نصية. هذه ليست مطابقة رموز قوى ولا دليلًا على الانطباق.";
    const box=node("div",null,"table-scroll");
    const table=node("table"),thead=node("thead"),head=node("tr");
    ["المسمى والعدد","الرموز المرشحة","حالة المطابقة"].forEach(x=>head.append(node("th",x)));
    thead.append(head);table.append(thead);
    const tbody=node("tbody");
    // Prefer ambiguous or missing, and show all rows; only aggregate counts are included.
    const records=outcome.records.slice().sort((a,b)=>
      ({ambiguous:0,no_match:1,candidate_only:2}[a.status]-{ambiguous:0,no_match:1,candidate_only:2}[b.status])||a.title.localeCompare(b.title,"ar"));
    records.forEach(x=>{
      const tr=node("tr");
      const codeText=x.candidates.length?x.candidates.slice(0,8).map(v=>v.code+" ("+(v.sourceTier==="official_gastat_2019"?"مرجع 2019":"دليل/وزارة")+")").join("، "):"—";
      const status=x.status==="no_match"?"غير موجود في الفهرس — لا يعني الإعفاء":x.status==="ambiguous"?"يتطلب اختيار الرمز من قوى":"مرشح نصي فقط";
      add(tr,node("td",x.title+" · "+x.total+" موظف"),node("td",codeText),node("td",status));tbody.append(tr);
    });
    table.append(tbody);box.append(table);target.replaceChildren(summary,box);
  }
  function renderScenario(){
    const res=$("scenario-result");
    try {
      const counts=report.workforce;
      const value=core.simulateCompany({
        total:counts.total,saudi:counts.saudi,
        hire:$("hire").value,replace:$("replace").value,train:$("train").value
      });
      res.id="scenario-result";res.className="result";
      const diff=value.before.percent===null||value.after.percent===null?"غير محدد":(value.after.percent-value.before.percent).toFixed(2);
      res.textContent="قبل المحاكاة: "+fmt(value.before.saudi)+"/"+fmt(value.before.total)+
        " ("+(value.before.percent===null?"—":value.before.percent.toFixed(2)+"%")+")؛ بعد المحاكاة: "+
        fmt(value.after.saudi)+"/"+fmt(value.after.total)+" ("+(value.after.percent===null?"—":value.after.percent.toFixed(2)+"%")+
        "). التغيّر: "+diff+" نقطة مئوية. الموظفون المؤهلون بالتدريب: "+fmt(value.training)+". "+value.notice;
    } catch(e) {
      res.className="result";res.textContent="أدخل أعدادًا صحيحة غير سالبة. لا يمكن إحلال عدد أكبر من غير السعوديين أو تأهيل عدد أكبر من السعوديين في المحاكاة.";
    }
  }
  async function init(){
    try {
      const paths={
        decisions:"data/decisions.json",
        applicability:"data/salic-applicability.json",
        activities:"data/salic-activities.json",
        workforce:"data/salic-workforce.json",
        catalog:"data/occupation-catalog.json",
        matching:"data/guide-matching.json",
        grace:"data/grace-periods.json",
        health:"data/health.json"
      };
      const names=Object.keys(paths);
      const data=await Promise.all(names.map(n=>json(paths[n])));
      inputs=Object.fromEntries(names.map((n,i)=>[n,data[i]]));
      report=core.build(inputs);
      $("kpi-audited").textContent=report.decisions.audited+"/"+report.decisions.total;
      $("kpi-pending").textContent=report.decisions.pending;
      $("kpi-catalog").textContent=fmt(report.catalog.total);
      $("kpi-workforce").textContent=fmt(report.workforce.total);
      $("status").textContent="آخر لقطة موظفين: "+report.workforce.asOf+
        " · الأنشطة: "+(report.activity.verified?"مدققة مرجعيًا — تحقق من نطاق القرار":"تحتاج تحققًا رسميًا")+
        " · تقرير صحة الفحص: "+(report.scan.checkedAt||"غير متوفر")+
        " · نتائج القرارات لا تعتمد قانونيًا حتى اكتمال الأدلة.";
      renderStreams(report.workstreams);
      renderPending(report.decisions.entries);
      renderPlans(report.plans);
      for(const id of ["crosswalk","print","simulate","hire","replace","train"])$(id).disabled=false;
      $("crosswalk").addEventListener("click",renderCrosswalk);
      $("simulate").addEventListener("click",renderScenario);
      $("print").addEventListener("click",()=>window.print());
      renderScenario();
    }catch(error){
      $("status").textContent="تعذر تحميل بيانات الجاهزية. لم تُحسب أي حالة امتثال. افتح صفحة المصدر الرسمية أو أعد المحاولة عند استعادة الاتصال.";
      $("pending-rows").replaceChildren(node("tr","تعذر تحميل السجل."));
    }
  }
  init();
})();
