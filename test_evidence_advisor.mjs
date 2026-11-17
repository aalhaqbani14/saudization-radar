import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const api=require("./assets/evidence-advisor.js");
const read=p=>JSON.parse(fs.readFileSync("data/"+p+".json","utf8"));
const inputs={
 decisions:read("decisions"),applicability:read("salic-applicability"),
 activities:read("salic-activities"),workforce:read("salic-workforce"),
 pdfSources:read("guide-pdf-sources"),grace:read("grace-periods")
};
const ctx={window:{},console,Promise};
vm.runInNewContext(fs.readFileSync("assets/workforce-model.js","utf8"),ctx);
const model=ctx.window.SalicWorkforce;
model.setRows(inputs.workforce.rows,inputs.workforce.summary);
model.setOfficialRecords(read("official-inspections").records);
const report=api.build({...inputs,model,today:"2026-11-17"});
assert.equal(report.stats.decisions,21);
assert.equal(report.stats.audited,12);
assert.equal(report.stats.pending,9);
assert.equal(report.workforce.total,171);
assert.equal(report.workforce.saudi,117);
assert.equal(report.snapshotAgeDays,14);
assert.equal(report.stats.draftGuides,1);
assert.equal(report.stats.restrictedGuides,2);
assert.ok(report.stats.publicGuides>=10);
assert.equal(new Set(report.records.map(x=>x.id)).size,21);
const byId=Object.fromEntries(report.records.map(x=>[x.id,x]));
for(const r of report.records){
 assert.equal(r.finalVerdict,false);
 assert.equal(r.evidenceMissing.employeeQiwa,true);
 assert.equal(r.evidenceMissing.licence,true);
 assert.ok(r.tasks.length>=4);
 assert.ok(r.checks.length>0);
 assert.ok(r.source&&r.source.startsWith("https://www.hrsd.gov.sa/"),r.id);
 assert.ok(!/مخالفة مثبتة|غير منطبق نظاميًا|ممتثل نظاميًا/.test(r.proposedAdvice),r.id);
 assert.ok(!r.tasks.some(x=>x.status==="complete"));
}
for(const id of ["housing","beauty","realestate","education","aviation","postal","retail7","inspection","madinah"]){
 assert.equal(byId[id].auditStatus,"needs_review",id);
}
assert.equal(byId.housing.docState,"restricted_manual_review");
assert.equal(byId.education.docState,"restricted_manual_review");
assert.equal(byId.beauty.docState,"published_draft");
assert.equal(byId.admin.auditStatus,"reviewed");
assert.ok(byId.admin.preview);
assert.equal(byId.admin.preview.total,27);
assert.equal(byId.admin.preview.gap,3,"Provisional title-only gap; not a regulatory finding");
assert.match(byId.admin.proposedAdvice,/مجرد سيناريو من المسميات/);
assert.equal(byId.madinah.preview,null);
assert.equal(byId.madinah.gate,"regional_activity");
assert.match(byId.madinah.tasks.find(x=>x.id==="activity").text,/الفرع/);
assert.equal(byId.ict.preview.gap,null,"Grouped ICT policy must not be aggregated into a legal gap");
assert.ok(!byId.ict.proposedAdvice.includes("مخالفة"));
assert.equal(byId.project.preview.status,"future");
assert.ok(!byId.project.proposedAdvice.includes("مخالفة مثبتة"));
assert.equal(api.publicLink("https://www.hrsd.gov.sa/sites/default/files/r.pdf")!==null,true);
assert.equal(api.publicLink("https://www.hrsd.gov.sa.evil.example/a"),null);
assert.equal(api.publicLink("http://www.hrsd.gov.sa/a"),null);
assert.equal(api.publicLink("javascript:alert(1)"),null);
assert.equal(api.daysSince("2026-11-03","2026-11-17"),14);
assert.equal(api.daysSince("2026-11-03","invalid"),null);
const custom={
 history:[
  {verified:false,date:"2028-01-01",rate:"99%",source:"https://www.hrsd.gov.sa/a",label:"غير مثبت"},
  {verified:true,date:"2028-02-01",rate:"70%",source:"https://www.hrsd.gov.sa/b",label:"موثق"},
  {verified:true,date:"2028-02-01",rate:"70%",source:"https://www.hrsd.gov.sa/b",label:"موثق"},
  {verified:true,date:"2028-03-01",rate:"90%",source:"https://evil.example/a",label:"خبيث"}
 ]
};
assert.equal(api.stageHints(custom,"2026-11-17").length,1,"Only cited, verified, nonduplicate future stages");
const html=fs.readFileSync("advisor.html","utf8");
const ui=fs.readFileSync("assets/advisor-ui.js","utf8");
assert.ok(html.includes("assets/evidence-advisor.js")&&html.includes("assets/advisor-ui.js"));
assert.ok(html.includes('id="m-pending"')&&html.includes('id="cards"'));
assert.ok(html.includes('value="all"')&&html.includes('value="pending"'));
assert.ok(ui.includes("textContent")&&ui.includes("createElement"));
assert.ok(!/innerHTML|localStorage|sessionStorage|document\.cookie/.test(ui+fs.readFileSync("assets/evidence-advisor.js","utf8")),"No unsafe HTML insertion or private browser storage");
assert.ok(!/fetch\s*\([^)]*,\s*\{\s*method\s*:\s*['"]POST/i.test(ui),"No upload of employee records");
assert.ok(fs.readFileSync("index.html","utf8").includes('href="advisor.html"'),"Advisor must be accessible from home services");
console.log("PASS: 21 source-gated recommendations, 9 pending legal audits, restricted/draft protection, no verdicts or employee data writes");
