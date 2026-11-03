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
        self.p1 = patch.object(monitor, "STATE", self.state)
        self.p2 = patch.object(monitor, "DATA", self.data)
        self.p3 = patch.object(monitor, "HEALTH", self.health)
        self.p4 = patch.object(monitor, "monitored_sources", return_value=SOURCES)
        for p in (self.p1,self.p2,self.p3,self.p4):
            p.start()
            self.addCleanup(p.stop)

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

if __name__ == "__main__":
    unittest.main()
