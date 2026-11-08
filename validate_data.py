"""Validate published aggregate workforce, inspection and decision metadata.
No employee-level data is accessed or published.
"""
import json
from pathlib import Path
from datetime import date
ROOT=Path(__file__).resolve().parent
def read(name):
 return json.loads((ROOT/'data'/name).read_text(encoding='utf-8'))
def main():
 w=read('salic-workforce.json'); rows=w['rows']; sm=w['summary']
 assert isinstance(rows,list) and len(rows)==sm['professions']
 assert len({r[0] for r in rows})==len(rows),'Duplicate job titles'
 assert all(isinstance(r[0],str) and r[0].strip() and all(type(v) is int for v in r[1:]) and 0<=r[2]<=r[1] for r in rows)
 assert sum(r[1] for r in rows)==sm['total']
 assert sum(r[2] for r in rows)==sm['saudi']
 assert sm['total']-sm['saudi']==sm['nonSaudi']
 date.fromisoformat(w['asOf'])
 d=read('decisions.json'); ids=[x['id'] for x in d['decisions']]
 assert len(ids)==len(set(ids))
 for x in d['decisions']:
  if x.get('effective'):date.fromisoformat(x['effective'])
 registry=read('source-registry.json')
 assert len({x['id'] for x in registry['sources']})==len(registry['sources'])
 assert all(x['url'].startswith('https://www.hrsd.gov.sa/') for x in registry['sources'])
 inspection=read('official-inspections.json')
 for r in inspection.get('records',[]):
  assert r['decisionId'] in ids
  assert r['saudi']+r['nonSaudi']==r['total']
  assert r['numericGap']>=0
  assert abs(r['reportedSaudiPercent']-round(r['saudi']*100/r['total']))<=1
  date.fromisoformat(r['asOf'])
 guide=read('guide-matching.json')
 assert guide.get('version')==1
 assert len({x['id'] for x in guide['decisions']})==len(guide['decisions'])
 seen_rules=set()
 names={r[0] for r in rows}
 for decision in guide['decisions']:
  assert decision['id'] in ids
  assert decision['id'] not in seen_rules
  seen_rules.add(decision['id'])
  assert decision['sourceUrl'].startswith('https://www.hrsd.gov.sa/')
  assert 0<=decision['percent']<=100
  assert decision['min']>=1
  assert decision['rounding'] in ('nearest','none')
  date.fromisoformat(decision['effective'])
  roles=decision['matchedRoles']
  assert len({r['code'] for r in roles})==len(roles),'Duplicate official code inside decision'
  assert len({r['title'] for r in roles})==len(roles),'Duplicate job title inside decision'
  assert all(r['title'] in names and len(r['code'])==6 and r['code'].isdigit() for r in roles),'Code mapping not tied to published title'
  if decision.get('grouped'):
   assert all(r.get('subgroup') in ('engineering','development','support') for r in roles)
  if decision.get('phases'):
   assert all(len(v)==3 and date.fromisoformat(v[0]) and 0<=v[1]<=100 and v[2]>=1 for v in decision['phases'])
 def nearest(n,rate):
  return (n*rate*2+100)//200
 # For the uploaded guides: 3 * 70% -> 2; 16 * 60% -> 10; 23 * 40% -> 9.
 # Equivalent integer arithmetic avoids floating-point ambiguities.
 assert [nearest(3,70),nearest(16,60),nearest(23,40),nearest(23,50)]==[2,10,9,12]
 print('PASS: verified guide matches',len(guide['decisions']),'decisions;',sum(len(x['matchedRoles']) for x in guide['decisions']),'title-code pairs.')
 print('PASS: workforce',sm['total'],'employees;',sm['professions'],'unique titles;',len(ids),'decisions;',len(registry['sources']),'registered decision sources;',len(inspection.get('records',[])),'inspection snapshots')
 print('NOTICE: aggregate integrity does not prove HRSD profession-code matching, payroll eligibility, applicability or current compliance.')
if __name__=='__main__':main()
