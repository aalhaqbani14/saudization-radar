"""Offline smoke tests: no network calls and no personal employee data."""
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError
import monitor
class MonitorTests(unittest.TestCase):
 def test_arabic_url_encoding(self):
  raw='https://www.hrsd.gov.sa/knowledge-centre/الدليل-الإجرائي-للتوطين'
  encoded=monitor.encode_url(raw)
  self.assertTrue(encoded.startswith('https://www.hrsd.gov.sa/'))
  self.assertIn('%D8%A7',encoded)
  self.assertNotIn('الدليل',encoded)
  self.assertEqual(monitor.encode_url(encoded),encoded)
 def test_url_preserves_query(self):
  self.assertEqual(monitor.encode_url('https://www.hrsd.gov.sa/a?x=1&y=2'),'https://www.hrsd.gov.sa/a?x=1&y=2')
 def test_failure_categories(self):
  self.assertEqual(monitor.explain_failure(HTTPError('https://www.hrsd.gov.sa',403,'Forbidden',None,None))[0],'http_error')
  self.assertEqual(monitor.explain_failure(URLError('timed out'))[0],'timeout')
  self.assertEqual(monitor.explain_failure(ValueError('Page extraction too short'))[0],'insufficient_content')
 def test_email_test_requires_credentials(self):
  with patch.dict('os.environ',{'SMTP_USER':'','SMTP_PASSWORD':'','ALERT_EMAIL':''}):
   with self.assertRaisesRegex(RuntimeError,'Email settings missing'):
    monitor.send_test_email()
 def test_source_extraction_ignores_scripts(self):
  p=monitor.Extract('https://www.hrsd.gov.sa/media-center/news')
  p.feed('<main><h1>قرار توطين</h1><script>ignored javascript</script><p>النسبة 70%</p></main>')
  content=p.extracted_text()
  self.assertIn('قرار توطين',content)
  self.assertIn('70%',content)
  self.assertNotIn('ignored javascript',content)
 def test_official_detail_ignores_related_cards_and_preserves_primary_pdf(self):
  url='https://www.hrsd.gov.sa/knowledge-centre/decisions-and-regulations/regulation-and-procedures/test-decision'
  html='''<html><head><title>توطين مهن إدارة المشاريع | HRSD</title>
  <meta name="description" content="توطين مهن إدارة المشاريع بنسبة 70% وفق القرار." /></head>
  <body><nav>إعلانات أخرى: طب الأسنان 100%</nav>
  <main class="main-content" id="content">
  <div class="field field--name-body">توطين مهن إدارة المشاريع بنسبة 70%
    اعتباراً من 2027-02-14 وفق التعليمات الرسمية الصادرة بشأن القرار.
    <a href="/sites/default/files/2026-08/projects.pdf">الدليل الرسمي لإدارة المشاريع</a></div>
  <section class="bg-gray"><div class="block block-views-block-regulations-and-procedures-related">
    <div class="swiper-slide">الدليل الإجرائي لتوطين طب الأسنان 45% ثم 55% بأجر 9000</div>
    <a href="/sites/default/files/2026-08/dentistry.pdf">دليل طب الأسنان</a>
  </div></section>
  </main><aside>بطاقات آخر الأخبار توطين طب الأسنان 55%</aside></body></html>'''
  parser=monitor.DecisionExtract(url);parser.feed(html);content=parser.extracted_text()
  self.assertIn('إدارة المشاريع',content)
  self.assertIn('2027-02-14',content)
  self.assertIn('projects.pdf',content)
  self.assertNotIn('طب الأسنان',content)
  self.assertNotIn('dentistry.pdf',content)
  self.assertNotIn('إعلانات أخرى',content)
  self.assertNotIn('آخر الأخبار',content)

 def test_official_detail_primary_change_detected_but_related_story_ignored(self):
  from detection import analyze_change
  url='https://www.hrsd.gov.sa/knowledge-centre/decisions-and-regulations/regulation-and-procedures/projects'
  prefix='<html><head><title>قرار توطين إدارة المشاريع</title></head><body><main><div>'
  text='القرار الإجرائي لمهن إدارة المشاريع يستهدف تخصصات المشاريع وبرنامج التوطين الخاص بمهن إدارة المشاريع وبداية التطبيق.'
  related='</div><div class="block-views-block-regulations-and-procedures-related">'
  suffix='</div></main></body></html>'
  def clean(body,carousel):
   parser=monitor.DecisionExtract(url);parser.feed(prefix+body+related+carousel+suffix)
   return parser.extracted_text()
  source={'name':'قرار: إدارة المشاريع','url':url,'kind':'decision_page'}
  old=clean(text, 'توطين الأسنان 45%')
  new_related=clean(text, 'توطين الأسنان 55%')
  self.assertEqual(old,new_related)
  self.assertIsNone(analyze_change(old,new_related,source,'2026-11-17'))
  revised=clean(text+' قرار وزارة الموارد البشرية برفع التوطين إلى 80% اعتبارا من 2027-10-27.', 'توطين الأسنان 55%')
  signal=analyze_change(old,revised,source,'2026-11-17')
  self.assertIsNotNone(signal)
  self.assertIn('80%',signal['rates_mentioned'])

 def test_missing_primary_content_fails_closed(self):
  parser=monitor.DecisionExtract('https://www.hrsd.gov.sa/knowledge-centre/decisions-and-regulations/regulation-and-procedures/item')
  parser.feed('<html><body><section class="block-views-block-regulations-and-procedures-related">توطين الأسنان 55%</section></body></html>')
  with self.assertRaisesRegex(ValueError,'Primary document extraction unavailable'):
   parser.extracted_text()
  self.assertEqual(monitor.extraction_version('https://www.hrsd.gov.sa/media-center/news'),2)
  self.assertEqual(monitor.extraction_version('https://www.hrsd.gov.sa/media-center/news/a'),3)

 def test_monitor_covers_all_known_decision_html_sources(self):
  import json
  from pathlib import Path
  urls={x['url'] for x in monitor.monitored_sources()}
  catalogue=json.loads(Path('data/decisions.json').read_text(encoding='utf-8'))['decisions']
  candidates={d['source'] for d in catalogue if not d['source'].split('?')[0].lower().endswith('.pdf')}
  self.assertEqual(len(catalogue),21)
  self.assertTrue(candidates.issubset(urls), 'All decision HTML sources, even unrelated sectors, must be watched')
  self.assertGreaterEqual(len(urls),len(candidates)+2)

 def test_sources_official_and_unique(self):
  sources=monitor.monitored_sources()
  self.assertEqual(len(sources),len({x['url'] for x in sources}))
  self.assertTrue(all(x['url'].startswith('https://www.hrsd.gov.sa/') for x in sources))
if __name__=='__main__':unittest.main()
