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
 def test_sources_official_and_unique(self):
  sources=monitor.monitored_sources()
  self.assertEqual(len(sources),len({x['url'] for x in sources}))
  self.assertTrue(all(x['url'].startswith('https://www.hrsd.gov.sa/') for x in sources))
if __name__=='__main__':unittest.main()
