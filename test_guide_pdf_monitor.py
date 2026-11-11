"""Offline regression tests for exact-source HRSD PDF text monitoring."""
import unittest
from unittest.mock import patch
import guide_pdf_monitor as guides

PDF_A = b'%PDF-1.7 first synthetic'
PDF_B = b'%PDF-1.7 second synthetic'


def lines(*texts):
    return [{'page': 1, 'text': text} for text in texts]


class GuidePdfMonitorTests(unittest.TestCase):
    def test_registry_accepts_only_known_direct_official_pdf(self):
        valid = {'sources': [{'id': 'admin', 'title': 'المهن الإدارية المساندة',
                              'url': 'https://www.hrsd.gov.sa/sites/default/files/test.pdf'}]}
        self.assertEqual(len(guides.validated_sources(valid)), 1)
        with self.assertRaises(ValueError):
            guides.validated_sources({'sources': [
                {'id':'admin','title':'المهن الإدارية المساندة','url':'https://evil.example/a.pdf'}]})
        with self.assertRaises(ValueError):
            guides.validated_sources({'sources': [
                {'id':'admin','title':'المهن الإدارية المساندة','url':'https://www.hrsd.gov.sa/a.html'}]})

    def test_first_check_baselines_without_alert(self):
        source = [{'id':'admin','title':'المهن الإدارية المساندة','url':'https://www.hrsd.gov.sa/a.pdf'}]
        base = lines('القرار الخاص بتوطين المهن الإدارية المساندة',
                     'نسبة التوطين 100% وفق شروط الدليل')
        new_snap, changes, scan, alerts = guides.scan_sources(
            source, {}, [], fetch=lambda u:PDF_A, extract=lambda b:(base,1),
            now='2026-11-11T11:00:00+00:00')
        self.assertEqual(scan[0]['status'], 'baseline')
        self.assertEqual(len(changes), 0)
        self.assertEqual(len(alerts), 0)
        self.assertEqual(new_snap['admin']['text_hash'], guides.content_hash(base))

    def test_changed_rate_old_and_new_cited_to_pages(self):
        source=[{'id':'admin','title':'المهن الإدارية المساندة','url':'https://www.hrsd.gov.sa/a.pdf'}]
        old=lines('نسبة التوطين 70%','العمل في القطاع بحسب النشاط')
        new=[{'page':2,'text':'نسبة التوطين 80%'},
             {'page':2,'text':'العمل في القطاع بحسب النشاط'}]
        first,_,_,_=guides.scan_sources(source, {}, [], fetch=lambda u:PDF_A,
                 extract=lambda blob:(old,1),now='2026-11-11T11:00:00+00:00')
        second,changes,scan,alerts=guides.scan_sources(source,first,[],
                fetch=lambda u:PDF_B,extract=lambda blob:(new,2),now='2026-11-12T11:00:00+00:00')
        self.assertEqual(scan[0]['status'],'changed')
        self.assertEqual(changes[0]['hunks'][0]['category'],'نسب التوطين')
        self.assertEqual(changes[0]['hunks'][0]['old_page'],1)
        self.assertEqual(changes[0]['hunks'][0]['new_page'],2)
        self.assertIn('70%',changes[0]['hunks'][0]['before'])
        self.assertIn('80%',changes[0]['hunks'][0]['after'])
        self.assertEqual(alerts[0]['email_worthy'],True)
        self.assertIn('غير مؤكد',changes[0]['status'])
        self.assertEqual(second['admin']['pages'],2)

    def test_same_extracted_text_different_binary_no_false_alert(self):
        src=[{'id':'admin','title':'المهن الإدارية المساندة','url':'https://www.hrsd.gov.sa/a.pdf'}]
        line=lines('نسبة التوطين 100% وتاريخ النفاذ في الدليل')
        a,_,_,_=guides.scan_sources(src, {}, [], fetch=lambda u:PDF_A,extract=lambda blob:(line,1))
        b,changes,scan,alerts=guides.scan_sources(src,a,[],fetch=lambda u:PDF_B,extract=lambda blob:(line,1))
        self.assertEqual(scan[0]['status'],'unchanged_text')
        self.assertEqual(changes,[])
        self.assertEqual(alerts,[])
        self.assertNotEqual(a['admin']['binary_sha256'],b['admin']['binary_sha256'])

    def test_failed_fetch_preserves_old_snapshot(self):
        src=[{'id':'admin','title':'المهن الإدارية المساندة','url':'https://www.hrsd.gov.sa/a.pdf'}]
        a,_,_,_=guides.scan_sources(src, {}, [], fetch=lambda u:PDF_A,
                        extract=lambda blob:(lines('قرار توطين المهن'),1))
        def fail(url): raise TimeoutError('server')
        b,changes,scan,alerts=guides.scan_sources(src,a,[],fetch=fail)
        self.assertEqual(scan[0]['status'],'error')
        self.assertEqual(a['admin']['text_hash'],b['admin']['text_hash'])
        self.assertFalse(alerts)

    def test_repeat_change_does_not_repeat_alert(self):
        src=[{'id':'admin','title':'المهن الإدارية المساندة','url':'https://www.hrsd.gov.sa/a.pdf'}]
        a,_,_,_=guides.scan_sources(src, {}, [], fetch=lambda u:PDF_A,
                   extract=lambda blob:(lines('نسبة التوطين 70%'),1))
        b,history,scan,alerts=guides.scan_sources(src,a,[],fetch=lambda u:PDF_B,
                   extract=lambda blob:(lines('نسبة التوطين 80%'),1))
        c,history2,scan2,alerts2=guides.scan_sources(src,a,history,fetch=lambda u:PDF_B,
                   extract=lambda blob:(lines('نسبة التوطين 80%'),1))
        self.assertEqual(len(history2),1)
        self.assertEqual(alerts2,[])
        self.assertEqual(len(alerts),1)
        self.assertEqual(c['admin']['text_hash'],b['admin']['text_hash'])

    def test_document_replaced_by_new_direct_url_baselines(self):
        url1='https://www.hrsd.gov.sa/a.pdf';url2='https://www.hrsd.gov.sa/b.pdf'
        src=[{'id':'admin','title':'المهن الإدارية المساندة','url':url1}]
        a,_,_,_=guides.scan_sources(src,{},[],fetch=lambda u:PDF_A,
                     extract=lambda b:(lines('نسبة التوطين 70%'),1))
        src[0]['url']=url2
        _,changes,scan,alerts=guides.scan_sources(src,a,[],fetch=lambda u:PDF_B,
                     extract=lambda b:(lines('نسبة التوطين 80%'),1))
        self.assertEqual(scan[0]['status'],'baseline')
        self.assertEqual(alerts,[])


if __name__ == '__main__':
    unittest.main()
