import assert from "node:assert/strict";
import fs from "node:fs";
const html=fs.readFileSync("index.html","utf8");
const css=fs.readFileSync("assets/v4-reference-dashboard.css","utf8");
const js=fs.readFileSync("assets/v4-reference-dashboard.js","utf8");
const icons=fs.readFileSync("assets/v4-icons.svg","utf8");
const skyline=fs.readFileSync("assets/v4-skyline.svg","utf8");
const head=html.slice(0,html.indexOf('<section id="salic-workforce"'));
assert.ok(html.includes('href="assets/v4-reference-dashboard.css"'));
assert.ok(html.includes('src="assets/v4-reference-dashboard.js"'));
assert.ok(html.includes('href="assets/v4-icons.svg#radar"'));
assert.ok(html.includes('id="services-toggle"')&&html.includes('id="services-panel"'));
assert.ok(html.includes('class="sidebar"')&&html.includes('class="topbar"'));
assert.ok(html.includes('class="v4-hero-copy"')&&html.includes('class="v4-hero-date"'));
assert.ok(html.includes('id="v4-today-date"')&&html.includes('id="v4-checked-at"'));
assert.ok(html.includes('src="assets/kafd-hero.webp"'));
assert.ok(html.includes("B.alotaby / Wikimedia Commons"));
assert.ok(html.includes('id="v4-search"')&&html.includes('action="occupation-catalog.html"'));
assert.ok(fs.readFileSync("assets/occupation-catalog.js","utf8").includes('URLSearchParams(window.location.search)'));
for(const id of ["v2-monitored-count","v2-national-ratio","v3-saudi-count","v3-nonsaudi-count","v2-pending-audits","v2-decision-count"]){
 assert.ok(head.includes('id="'+id+'"'),"Actual data KPI slot missing: "+id);
}
const kpis=head.match(/<section class="v3-executive"[\s\S]*?<\/section>/)?.[0];
assert.equal((kpis.match(/class="v2-summary/g)||[]).length,6);
const overview=head.match(/<section class="v3-overview"[\s\S]*?<\/section>/)?.[0];
assert.equal((overview.match(/class="v3-insight /g)||[]).length,4);
for(const id of ["v3-donut","v4-trend-svg","v4-gauge","v4-gauge-number","v4-updates","v3-alert-list","v2-visit-note"]){
 assert.ok(overview.includes(id),id);
}
assert.equal((head.match(/class="quick-action /g)||[]).length,7,"Reference has seven colored shortcut cards");
const bottom=head.match(/<section class="v3-bottom-grid"[\s\S]*?<\/section>/)?.[0];
assert.equal((bottom.match(/class="v3-insight /g)||[]).length,4);
assert.ok(bottom.includes('id="v3-upcoming-list"'));
assert.ok(bottom.includes('id="v3-calendar"'));
assert.ok(bottom.includes('id="v4-forecast-current"'));
assert.ok(head.includes('href="phase-two.html#changes"'),"Eighth feature remains available");
const sidebar=head.match(/<aside class="sidebar"[\s\S]*?<\/aside>/)?.[0];
for(const value of ["الرئيسية","الخدمات","القرارات والامتثال","الموظفون والمهن",
 "الأنشطة والتراخيص","التقارير والتحليلات","الذكاء الاسترشادي",
 "غرفة العمليات","التنبيهات","المهام والمراجعات","التقويم التنظيمي","سجل التغييرات"]){
 assert.ok(sidebar.includes(value),"Sidebar must retain reference row: "+value);
}
assert.ok(/grid-template-columns:245px minmax\(0,1fr\)/.test(css),"Sidebar reference width");
assert.ok(/height:59px!important/.test(css),"Top navigation height");
assert.ok(/height:147px!important/.test(css),"Hero reference height");
assert.ok(/height:76px!important/.test(css),"KPI reference height");
assert.ok(/height:222px!important/.test(css),"Analytics reference height");
assert.ok(/height:96px!important/.test(css),"Shortcut reference height");
assert.ok(/height:228px!important/.test(css),"Lower panels reference height");
assert.ok(css.includes("v4-skyline.svg")&&skyline.includes("<svg"));
assert.ok(css.includes("grid-template-columns:repeat(7,minmax(0,1fr))"));
assert.ok(css.includes("background:linear-gradient(135deg,#09d184,#00744e)"));
assert.ok(js.includes('data/"+name+".json"')&&js.includes("single circle"));
assert.ok(!js.includes("innerHTML")&&!js.includes("POST"),"No user HTML injection or uploads");
assert.ok(!head.includes("100% امتثال")&&!head.includes("100% الامتثال"),"No fabricated compliance certification");
assert.ok(icons.includes('<symbol id="radar"')&&icons.includes('<symbol id="bell"'));
assert.ok(!/https?:\/\/(?!www\.w3\.org)/.test(icons),"Icons must be local");
console.log("PASS: 245px light right sidebar, 59px header, KAFD 147px hero, 76px KPIs, four analytics, seven colored tiles, four lower panels and eight tools with real data");
