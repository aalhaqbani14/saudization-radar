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
 print('PASS: workforce',sm['total'],'employees;',sm['professions'],'unique titles;',len(ids),'decisions;',len(registry['sources']),'registered decision sources;',len(inspection.get('records',[])),'inspection snapshots')
 print('NOTICE: aggregate integrity does not prove HRSD profession-code matching, payroll eligibility, applicability or current compliance.')
if __name__=='__main__':main()
