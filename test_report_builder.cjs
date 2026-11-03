/* Offline regression checks for executive report classification and scoped grace. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {test} = require('node:test');
const path = require('node:path');
const model = require('./assets/report-data.js');
const data = name => JSON.parse(fs.readFileSync(path.join(__dirname,'data',name),'utf8'));
const decisions = data('decisions.json').decisions;
const occupations = data('occupations.json').occupations;
const grace = data('grace-periods.json').records;
const all = decisions.map(d=>d.id);

test('full report includes all 21 groups and all indexed professions as selected-scope targets',()=>{
  const r=model.build(decisions,occupations,grace,all);
  assert.equal(r.picked.length,decisions.length);
  assert.equal(r.targeted.length,occupations.length);
  assert.equal(r.outside.length,0);
  assert.equal(r.grace.filter(x=>x.decisionId==='admin').length,2);
  assert(r.stages.length>20);
});
test('filtered report separates indexed professions linked only to other decisions',()=>{
  const r=model.build(decisions,occupations,grace,['admin']);
  assert(r.targeted.some(o=>o.code==='412001'));
  assert(r.outside.length>0);
  assert(r.outside.every(o=>!o.matched.length));
  assert(r.targeted.every(o=>o.matched.includes('admin')));
});
test('grace remains scoped to professional tables; other decisions are explicitly unverified',()=>{
  const r=model.build(decisions,occupations,grace,['admin','accounting','housing']);
  const admin=r.grace.filter(g=>g.decisionId==='admin');
  assert.equal(admin.length,2);
  assert(admin.some(g=>g.duration==='تطبيق فوري'));
  assert(admin.some(g=>g.duration==='6 أشهر' && g.scope.includes('الجدول (3)')));
  assert(r.grace.some(g=>g.decisionId==='accounting' && g.duration==='9 أشهر'));
  assert(r.grace.some(g=>g.decisionId==='housing' && g.status==='unverified'));
});
test('manual occupation inputs never assume lack of targeting',()=>{
  const r=model.build(decisions,occupations,grace,['admin'],
    '412001\n541403\nمدير مشتريات\nمهنة جديدة غير موجودة\nمهنة جديدة غير موجودة');
  assert.equal(r.manual.find(x=>x.input==='412001').status,'targeted');
  assert.equal(r.manual.find(x=>x.input==='541403').status,'targeted');
  const unknown=r.manual.find(x=>x.input==='مهنة جديدة غير موجودة');
  assert(unknown);
  assert.equal(unknown.status,'unknown');
  assert.equal(r.manual.filter(x=>x.status==='unknown').length,2); // Includes unindexed job title
  assert.equal(r.manual.filter(x=>x.input==='مهنة جديدة غير موجودة').length,1);
});
test('selected report does not mutate original indexed profession or decision data',()=>{
  const before=JSON.stringify(occupations[0]);
  model.build(decisions,occupations,grace,['admin']);
  assert.equal(JSON.stringify(occupations[0]),before);
});
