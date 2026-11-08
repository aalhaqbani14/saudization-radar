import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const cache=new Map();
const fetch=async path=>{
 if(!path.startsWith('data/')||!path.endsWith('.json'))throw Error('Unexpected data request: '+path);
 const d=JSON.parse(fs.readFileSync(path,'utf8'));
 return {ok:true,json:async()=>d};
};
const context={window:{},fetch,console,Promise};
vm.runInNewContext(fs.readFileSync('assets/workforce-model.js','utf8'),context,{filename:'assets/workforce-model.js'});
const wf=context.window.SalicWorkforce;
assert.ok(wf);
await wf.load();
const expected=[
 ['admin',27,24,3,'estimate'],
 ['procurement',8,8,0,'estimate'],
 ['accounting',15,12,0,'estimate'],
 ['marketing',6,5,0,'estimate'],
 ['sales',1,0,null,'threshold'],
 ['legal',1,1,0,'estimate'],
 ['ict',18,10,null,'manual']
];
for(const [id,total,saudi,gap,status] of expected){
 const g=wf.group(id);
 assert.equal(g.total,total,id+' total');
 assert.equal(g.saudi,saudi,id+' Saudi');
 assert.equal(g.gap,gap,id+' estimated gap');
 assert.equal(g.status,status,id+' status');
}
const mapping=JSON.parse(fs.readFileSync('data/guide-matching.json','utf8'));
const known=Object.fromEntries(mapping.decisions.map(x=>[x.id,x]));
assert.equal(known.sales.matchedRoles.find(x=>x.title==='وسيط سلع مستقبلية').code,'332401');
assert.equal(known.marketing.minimumEligibleSaudiWage,5500);
assert.equal(known.legal.percent,70);
assert.equal(known.ict.grouped,true);
const before=wf.getRows();
wf.setRows([['أخصائي مشتريات',3,0]],null);
assert.equal(wf.group('procurement').needed,2,'3 workers at 70% rounds to 2, not 3');
wf.setRows([['أخصائي قانوني',3,0]],null);
assert.equal(wf.group('legal').needed,2);
wf.setRows(before.map(x=>[x.title,x.total,x.saudi]),null);
console.log('PASS: all seven guide-matched groups and legal rounding were verified offline.');
