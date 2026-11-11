/* Prevent a computer engineer from being counted under engineering-technical
 * Saudization decisions when SALIC workforce has no relevant job codes.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=p=>fs.readFileSync(p,'utf8');
const catalogue=JSON.parse(read('data/decisions.json')).decisions;
const workforce=JSON.parse(read('data/salic-workforce.json'));
const mapping=JSON.parse(read('data/guide-matching.json')).decisions;
const ctx={window:{},console,Promise};
vm.runInNewContext(read('assets/workforce-model.js'),ctx,{filename:'assets/workforce-model.js'});
const model=ctx.window.SalicWorkforce;
model.setRows(workforce.rows,workforce.summary);
const title='مهندس حاسب آلي';
const row=model.getRows().find(x=>x.title===title);
assert.equal(row?.total,1,'SALIC has one computer engineer in current snapshot');
assert.deepEqual(Array.from(model.titleIds(title)),['ict'],'Computer engineer must be ICT-only');
assert.ok(!Object.keys(model.names).includes('engineers'));
assert.ok(mapping.find(x=>x.id==='ict').matchedRoles.some(x=>x.title===title&&x.code==='215204'));
const engineering=['engineers','techeng'];
for(const id of engineering){
  const decision=catalogue.find(x=>x.id===id);
  assert.ok(decision,'Regulatory archive must keep official decision '+id);
  assert.equal(decision.salicScope.status,'excluded_from_current_workforce_dashboard');
}
for(const path of ['assets/intelligence.js','assets/salic.js']){
  assert.ok(!/["']engineers["']/.test(read(path)),'No unrelated engineering category in SALIC tool: '+path);
}
assert.ok(read('assets/operations-auto.js').includes('salicScope?.status!=="excluded_from_current_workforce_dashboard"'));
assert.ok(read('assets/executive-report.js').includes('salicScope?.status!=="excluded_from_current_workforce_dashboard"'));
assert.ok(read('assets/operations-team.js').includes('salicScope?.status!=="excluded_from_current_workforce_dashboard"'));
assert.ok(read('decision-watch.html').includes('salicScope?.status!=="excluded_from_current_workforce_dashboard"'));
assert.ok(!read('index.html').includes('"engineers"'));
assert.ok(read('guide-audit.html').includes('مستبعدة من حسابات سالك الحالية'));
assert.ok(!read('operations.html').includes('x.id==="techeng"'));
console.log('PASS: SALIC engineer stays under ICT; technical/general engineering excluded from SALIC dashboard but retained in regulatory catalogue.');
