/* Layout reference parity: only source-backed metrics and dated employee snapshots.
   Never manufactures monthly history, certification, deadlines or live HR status. */
(()=>{
  "use strict";
  const $=id=>document.getElementById(id);
  const model=window.RadarHomeV3;
  const set=(id,text)=>{const el=$(id);if(el)el.textContent=String(text)};
  const fmt=n=>Number(n).toLocaleString("en-US");
  const url=(x)=>model?.safeUrl(x);
  const load=async name=>{
    const res=await fetch("data/"+name+".json",{cache:"no-store"});
    if(!res.ok)throw Error("source_"+name);
    return res.json();
  };
  const arabicDate=()=>{
    const now=new Date();
    return new Intl.DateTimeFormat("ar-SA-u-ca-gregory",{
      timeZone:"Asia/Riyadh",weekday:"long",year:"numeric",month:"long",day:"numeric"
    }).format(now);
  };
  const scannedAt=(stamp)=>{
    if(!stamp||Number.isNaN(Date.parse(stamp)))return "لا يوجد فحص موثق";
    return "آخر فحص "+new Intl.DateTimeFormat("ar-SA-u-ca-gregory",{
      timeZone:"Asia/Riyadh",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"
    }).format(new Date(stamp));
  };
  function drawTrend(workforce){
    const today=workforce.asOf;
    const s=workforce.summary;
    if(!Number.isInteger(s.total)||!Number.isInteger(s.saudi)||s.total<=0)return;
    const percentage=100*s.saudi/s.total;
    set("v4-trend-value",percentage.toFixed(1)+"%");
    set("v4-trend-last",today||"لقطة حالية");
    set("v4-trend-first","لا توجد نقاط سابقة معتمدة");
    set("v4-trend-note","نقطة موثقة واحدة · لا يمكن استنتاج اتجاه تاريخي");
    const svg=$("v4-trend-points");
    const line=$("v4-trend-line"),area=$("v4-trend-fill");
    if(!svg||!line||!area)return;
    // No fabricated 6-month evolution: a single circle is the only evidence.
    line.setAttribute("d","");
    area.setAttribute("d","");
    const point=document.createElementNS("http://www.w3.org/2000/svg","circle");
    const cy=143-Math.min(100,Math.max(0,percentage))*1.24;
    point.setAttribute("cx","386");
    point.setAttribute("cy",String(cy));
    point.setAttribute("r","6");
    point.setAttribute("fill","#09bc7c");
    point.setAttribute("stroke","#fff");
    point.setAttribute("stroke-width","3");
    const value=document.createElementNS("http://www.w3.org/2000/svg","text");
    value.textContent=percentage.toFixed(1)+"%";
    value.setAttribute("x","386");
    value.setAttribute("y",String(cy-13));
    value.setAttribute("text-anchor","middle");
    value.setAttribute("fill","#007d50");
    value.setAttribute("font-weight","800");
    value.setAttribute("font-size","15");
    svg.replaceChildren(point,value);
  }
  function drawAudit(decisions){
    if(!Array.isArray(decisions.decisions))return;
    const total=decisions.decisions.length;
    const audited=decisions.decisions.filter(x=>x.audit?.status==="reviewed").length;
    const pct=total?100*audited/total:0;
    set("v4-gauge-number",Math.round(pct)+"%");
    const arrow=$("v4-gauge-needle");
    if(arrow)arrow.setAttribute("transform","rotate("+(-90+180*pct/100)+" 125 130)");
    const q=$("v4-pending-work");if(q)q.textContent=fmt(total-audited);
  }
  function drawLiveStatus(workforce,alerts,health){
    set("v4-today-date",arabicDate());
    set("v4-checked-at",scannedAt(health.checked_at));
    set("v4-last-scan",health.checked_at?
      new Intl.DateTimeFormat("ar-SA-u-ca-gregory",{timeZone:"Asia/Riyadh",day:"numeric",month:"short",hour:"numeric",minute:"2-digit"}).format(new Date(health.checked_at)):
      "غير معروف");
    const active=Array.isArray(alerts.alerts)?
      alerts.alerts.filter(a=>a.triage_status!=="context_only"&&a?.id&&url(a.url)): [];
    set("v4-new-alerts",fmt(active.length));
    set("v4-verified-sources",(health.successful_sources??"—")+"/"+(health.total_sources??"—"));
    const count=active.length;
    for(const id of ["v4-notification-count","v4-top-notification"]){
      const badge=$(id);if(!badge)continue;
      badge.hidden=count===0;
      badge.textContent=count>99?"99+":String(count);
    }
    set("v4-forecast-current",fmt(workforce.summary.total));
    set("v4-forecast-saudi",fmt(workforce.summary.saudi));
  }
  async function init(){
    try{
      const [workforce,decisions,alerts,health]=await Promise.all([
        load("salic-workforce"),load("decisions"),load("alerts"),load("health")
      ]);
      if(!workforce?.summary||!Number.isInteger(workforce.summary.total)||
       workforce.summary.total!==workforce.summary.saudi+workforce.summary.nonSaudi||
       !Array.isArray(decisions?.decisions))throw Error("incomplete_public_source");
      drawTrend(workforce);
      drawAudit(decisions);
      drawLiveStatus(workforce,alerts,health);
    }catch{
      set("v4-checked-at","تعذّر تحميل نتائج الفحص");
      set("v4-trend-note","بيانات لقطة الموظفين غير متاحة؛ لم تُعرض أرقام تجريبية");
      set("v4-pending-work","—");
    }
    const search=$("v4-search-form");
    if(search)search.addEventListener("submit",event=>{
      const val=$("v4-search")?.value.trim();
      if(!val){event.preventDefault();window.location.href="occupation-catalog.html";}
    });
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();
