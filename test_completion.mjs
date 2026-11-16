import assert from "node:assert/strict";
import fs from "node:fs";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const core=require("./assets/completion-model.js");
const read=p=>JSON.parse(fs.readFileSync("data/"+p+".json","utf8"));
const inputs={
 decisions:read("decisions"),applicability:read("salic-applicability"),
 activities:read("salic-activities"),workforce:read("salic-workforce"),
 catalog:read("occupation-catalog"),matching:read("guide-matching"),
 grace:read("grace-periods"),health:read("health")
};
const result=core.build(inputs);
assert.equal(result.decisions.total,21,"Decision watch must still include all sectors");
assert.equal(result.decisions.audited,12,"Don't grant audit status from index-page metadata");
assert.equal(result.decisions.pending,9,"Nine decisions remain for full legal guide review");
assert.equal(result.decisions.entries.length,9);
assert.equal(new Set(result.decisions.entries.map(x=>x.id)).size,9);
for(const row of result.decisions.entries) {
 assert.equal(row.state,"needs_review",row.id+" must remain review-required");
 assert.ok(row.checks.length>0,row.id+" needs actionable evidence tasks");
 assert.ok(row.limit.length>10,row.id+" needs scoped audit limitations");
 assert.ok(core.validOfficialLink(row.source),row.id+" source should be official");
}
assert.equal(result.catalog.total,2030);
assert.ok(result.catalog.historical>0);
assert.equal(result.activity.verified,false,"User-supplied activities are not a verified commercial register");
assert.equal(result.workforce.total,171);
assert.equal(result.workforce.saudi,117);
assert.equal(result.workforce.nonSaudi,54);
assert.equal(result.matching.employeeQiwaVerificationCount,0,"No individual Qiwa mapping evidence has been published");
assert.equal(result.workstreams.length,9);
assert.equal(new Set(result.workstreams.map(x=>x.id)).size,9);
assert.equal(result.plans.length,5);
assert.equal(new Set(result.plans.map(x=>x.id)).size,5);
assert.ok(result.workstreams.every(x=>x.action.length>10&&x.owner.length>3));
const retail=inputs.decisions.decisions.find(x=>x.id==="retail7");
const periodic=inputs.decisions.decisions.find(x=>x.id==="inspection");
assert.equal(retail.number,"208819");
assert.equal(periodic.number,"208861");
assert.ok(retail.officialGuide.startsWith("https://www.hrsd.gov.sa/sites/default/files/"));
assert.ok(periodic.officialGuide.startsWith("https://www.hrsd.gov.sa/sites/default/files/"));
assert.equal(retail.audit.status,"needs_review");
assert.equal(periodic.audit.status,"needs_review");
assert.equal(inputs.decisions.decisions.find(x=>x.id==="beauty").requiredActivityCodes[0],"960920");
assert.ok(!result.activity.codes.includes("960920"),"SALIC provided list doesn't prove current licensed scope");
const c=core.crosswalk(inputs.workforce,inputs.catalog);
assert.equal(c.total,75);
assert.equal(c.candidates+c.ambiguous+c.missing,75);
assert.equal(c.records.find(x=>x.title==="مساعد إداري").status,"candidate_only");
assert.ok(c.records.find(x=>x.title==="مساعد إداري").candidates.some(x=>x.code==="412001"));
assert.ok(c.records.every(x=>!Object.hasOwn(x,"verified")),"Exact-title candidates must not claim Qiwa verification");
const before=core.simulateCompany({total:171,saudi:117,hire:0,replace:0,train:5});
assert.equal(before.after.total,171);
assert.equal(before.after.saudi,117,"Training does not change Saudi headcount");
const after=core.simulateCompany({total:171,saudi:117,hire:3,replace:2,train:5});
assert.equal(after.after.total,174);
assert.equal(after.after.saudi,122);
assert.equal(after.after.other,52);
assert.equal(after.training,5);
assert.throws(()=>core.simulateCompany({total:171,saudi:117,replace:55,train:0}));
assert.throws(()=>core.simulateCompany({total:171,saudi:117,hire:-1}));
assert.throws(()=>core.simulateCompany({total:171,saudi:117,train:118}));
assert.equal(core.validOfficialLink("https://www.hrsd.gov.sa/sites/default/files/doc.pdf"),true);
assert.equal(core.validOfficialLink("https://hrsd.gov.sa.evil.com"),false);
assert.equal(core.validOfficialLink("javascript:alert(1)"),false);
const html=fs.readFileSync("completion.html","utf8");
const script=fs.readFileSync("assets/completion.js","utf8");
const home=fs.readFileSync("index.html","utf8");
assert.ok(home.includes('href="completion.html"'),"Readiness must be discoverable on the home page");
assert.ok(html.includes("assets/completion-model.js")&&html.includes("assets/completion.js"));
assert.ok(!/localStorage|sessionStorage|document\.cookie|indexedDB/.test(script+html),"No private workforce information stored on public static website");
assert.ok(!/fetch\s*\([^)]*,\s*\{\s*method\s*:\s*['"]POST/i.test(script),"No upload to remote server");
console.log("All nine workstreams and 5 plans: checked. Pending legal evidence is not falsely approved.");
