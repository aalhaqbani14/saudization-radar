"""No-network regression tests for monitoring health and cautious alerting."""
import json
import pathlib
import tempfile
import unittest
from unittest.mock import patch
import monitor

SOURCES = [
    {"name": "اختبار مصدر", "url": "https://www.hrsd.gov.sa/media-center/news", "kind": "index"},
    {"name": "اختبار مصدر 2", "url": "https://www.hrsd.gov.sa/media-center/news/second", "kind": "decision_page"},
]
BASE = "بيانات وزارة الموارد البشرية عن الأخبار والخدمات والمنشآت في المملكة العربية السعودية. "

class TestMonitorHealth(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        directory = pathlib.Path(self.tmp.name)
        self.state = directory / "state.json"
        self.data = directory / "alerts.json"
        self.health = directory / "health.json"
        self.daily = directory / "daily-reports.json"
        self.p1 = patch.object(monitor, "STATE", self.state)
        self.p2 = patch.object(monitor, "DATA", self.data)
        self.p3 = patch.object(monitor, "HEALTH", self.health)
        self.p4 = patch.object(monitor, "monitored_sources", return_value=SOURCES)
        self.p5 = patch.object(monitor, "DAILY_REPORT", self.daily)
        for p in (self.p1,self.p2,self.p3,self.p4,self.p5):
            p.start()
            self.addCleanup(p.stop)

    def test_arabic_official_url_is_http_safe(self):
        from urllib.request import Request
        url = "https://www.hrsd.gov.sa/knowledge-centre/الدليل-الإجرائي-لتوطين-مهن-المشتريات"
        safe = monitor.encode_url(url)
        self.assertIn("%D8", safe)
        self.assertNotIn("الدليل", safe)
        self.assertEqual(Request(safe).full_url, safe)
        self.assertEqual(monitor.encode_url(safe), safe)

    def test_extract_includes_official_pdf_links_only(self):
        extractor = monitor.Extract("https://www.hrsd.gov.sa/media-center/news")
        extractor.feed("""<html><body><main><h1>أخبار الوزارة</h1>
            <a href="/sites/default/files/2026-11/new.pdf">الدليل الإجرائي لقرار توطين المهن</a>
            <a href="https://evil.example/document.pdf">قرار توطين مخادع</a>
            </main></body></html>""")
        content = extractor.extracted_text()
        self.assertIn("وثيقة رسمية مرتبطة:", content)
        self.assertIn("https://www.hrsd.gov.sa/sites/default/files/2026-11/new.pdf", content)
        self.assertNotIn("وثيقة رسمية مرتبطة: قرار توطين مخادع", content)

    @patch.object(monitor, "send_email")
    @patch.object(monitor, "get_text", return_value=BASE * 3)
    def test_extraction_upgrade_does_not_send_false_alerts(self, fetch, mail):
        legacy = {url["url"]: {"hash": "legacy", "text": "قرار توطين وظائف 60%"}
                  for url in SOURCES}
        self.state.write_text(json.dumps(legacy, ensure_ascii=False), encoding="utf-8")
        monitor.main()
        state=json.loads(self.state.read_text(encoding="utf-8"))
        self.assertTrue(all(x["extraction_version"]==monitor.EXTRACTION_VERSION
                            for x in state.values()))
        health=json.loads(self.health.read_text(encoding="utf-8"))
        self.assertTrue(all(x["first_baseline"] for x in health["sources"]))
        self.assertFalse(json.loads(self.data.read_text(encoding="utf-8"))["alerts"])
        mail.assert_not_called()

    @patch.object(monitor, "send_email")
    @patch.object(monitor, "get_text", return_value=BASE * 3)
    def test_first_monitor_creates_baseline_without_email(self, fetch, mail):
        monitor.main()
        health = json.loads(self.health.read_text(encoding="utf-8"))
        self.assertEqual(health["total_sources"], 2)
        self.assertEqual(health["successful_sources"], 2)
        self.assertEqual(health["failed_sources"], 0)
        self.assertTrue(all(x["first_baseline"] for x in health["sources"]))
        self.assertEqual(json.loads(self.data.read_text(encoding="utf-8"))["alerts"], [])
        mail.assert_not_called()

    @patch.object(monitor, "send_email")
    @patch.object(monitor, "get_text")
    def test_partial_failure_is_visible_without_fabricating_alerts(self, fetch, mail):
        def response(url):
            if url.endswith("/second"):
                raise TimeoutError("unreachable")
            return BASE * 3
        fetch.side_effect=response
        monitor.main()
        health=json.loads(self.health.read_text(encoding="utf-8"))
        self.assertEqual(health["successful_sources"],1)
        self.assertEqual(health["failed_sources"],1)
        self.assertEqual(health["sources"][1]["error_type"],"TimeoutError")
        self.assertNotIn("unreachable",self.health.read_text(encoding="utf-8"))
        mail.assert_not_called()

    def test_identical_news_across_four_source_pages_is_one_review_signal(self):
        common=('وزارة الموارد البشرية تعلن صدور قرار رفع نسبة توطين المهن الفنية '
                'الهندسية إلى 35% ويشمل القرار 94 مهنة في القطاع الخاص. '
                'يجب التحقق من الدليل الإجرائي الرسمي وتاريخ التطبيق.')
        names=['مرجع إضافي: التسويق','مرجع إضافي: المشتريات',
               'مرجع إضافي: إدارة المشاريع','أخبار الوزارة']
        items=[{'id':str(i),'source':name,'title':'تغيّر يتطلب مراجعة: '+name,
                'url':'https://www.hrsd.gov.sa/media-center/news'+('/'+str(i) if i else ''),
                'detected_at':'2026-11-08T14:46:20+00:00','summary':common,
                'review_status':'غير مؤكد — يحتاج مراجعة المصدر',
                'email_worthy':True} for i,name in enumerate(names)]
        result=monitor.consolidate_alerts(items)
        self.assertEqual(len(result),1)
        self.assertEqual(result[0]['source'],'أخبار الوزارة')
        self.assertEqual(result[0]['source_count'],4)
        self.assertEqual(len(result[0]['related_sources']),4)
        self.assertEqual(monitor.consolidate_alerts(result),result,'consolidation should be idempotent')

    def test_different_or_short_news_not_incorrectly_combined(self):
        base={'source':'مصدر أ','url':'https://www.hrsd.gov.sa/news/a',
              'detected_at':'2026-11-08T12:00:00+00:00',
              'summary':'قرار توطين 35%'}
        other=dict(base,id='two',source='مصدر ب',url='https://www.hrsd.gov.sa/news/b')
        self.assertEqual(len(monitor.consolidate_alerts([dict(base,id='one'),other])),2)
        full=('وزارة الموارد البشرية تعلن رفع نسبة التوطين في المهن الفنية '
              'الهندسية إلى 35% في منشآت القطاع الخاص بحسب تفاصيل الدليل الرسمي.')
        earlier=dict(base,id='old',summary=full)
        later=dict(other,id='new',summary=full,
                   detected_at='2026-12-03T12:00:00+00:00')
        self.assertEqual(len(monitor.consolidate_alerts([earlier,later])),2)

    @patch.object(monitor, 'send_email')
    @patch.object(monitor, 'get_text')
    def test_monitor_deduplicates_email_across_sources(self, fetch, mail):
        common=('وزارة الموارد البشرية تعلن قرار رفع نسبة توطين المهن الفنية '
                'الهندسية إلى 35% ويشمل 94 مهنة في القطاع الخاص، '
                'ويحتاج إلى مراجعة الدليل الإجرائي الرسمي.')
        baseline='قائمة أخبار الوزارة والمنشآت والخدمات العامة. '*5
        for src in SOURCES:
            source_url=src['url']
            self.state.parent.mkdir(parents=True,exist_ok=True)
        import hashlib
        legacy={src['url']:{'hash':hashlib.sha256(baseline.encode()).hexdigest(),
                 'text':baseline,'extraction_version':monitor.EXTRACTION_VERSION}
                 for src in SOURCES}
        self.state.write_text(json.dumps(legacy),encoding='utf-8')
        fetch.return_value=baseline+common
        mail.return_value=True
        monitor.main()
        recorded=json.loads(self.data.read_text(encoding='utf-8'))
        health=json.loads(self.health.read_text(encoding='utf-8'))
        self.assertEqual(len(recorded['alerts']),1)
        self.assertEqual(recorded['alerts'][0]['source_count'],2)
        self.assertEqual(health['signal_count'],1)
        mail.assert_called_once()
        self.assertEqual(len(mail.call_args.args[0]),1)

if __name__ == "__main__":
    unittest.main()
