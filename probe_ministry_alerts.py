"""Temporary live smoke test for official page text scoping."""
import monitor
urls={
'project':'https://www.hrsd.gov.sa/knowledge-centre/decisions-and-regulations/regulation-and-procedures/الدليل-الإجرائي-لتوطين-مهن-إدارة-المشاريع',
'admin':'https://www.hrsd.gov.sa/knowledge-centre/decisions-and-regulations/regulation-and-procedures/الدليل-الإجرائي-لقرار-توطين-المهن-الإدارية-المساندة',
'news':'https://www.hrsd.gov.sa/media-center/news/رفع-نسب-توطين-مهن-إدارة-المشاريع-0',
'madinah':'https://www.hrsd.gov.sa/knowledge-centre/decisions-and-regulations/regulation-and-procedures/الدليل-الإجرائي-لقرار-التوطين-في-منطقة-المدينة',
}
for name,url in urls.items():
 try:
  value=monitor.get_text(url)
  print('LIVE',name,'len',len(value),'mentions_dentistry','طب الأسنان' in value,'mentions_kenya','الكيني' in value,'mentions_policy_equal','السياسة الوطنية لتشجيع تكافؤ الفرص' in value,'head',value[:250],flush=True)
  if name in ('project','admin') and 'طب الأسنان' in value:raise AssertionError('Related dentistry story leaked into primary content')
  if name=='news' and 'الكيني' in value:raise AssertionError('Related Kenya news leaked into primary content')
  if len(value)<110:raise AssertionError('Primary content too short')
 except Exception as exc:
  print('LIVE ERROR',name,type(exc).__name__,str(exc),flush=True)
  raise
