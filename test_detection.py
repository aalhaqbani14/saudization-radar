"""Offline classifier regression tests. No government requests or email sends."""
import unittest
import detection
import monitor


SOURCE = {'name':'أخبار الوزارة','url':'https://www.hrsd.gov.sa/media-center/news'}


class TestDecisionSignals(unittest.TestCase):
    def test_unrelated_page_change_does_not_trigger(self):
        old = 'وزارة الموارد البشرية الصفحة الرئيسية أخبار الوزارة تفاصيل الخدمات'
        new = old + ' تم تحديث روابط التواصل الاجتماعي وألوان الصفحة.'
        self.assertIsNone(detection.analyze_change(old,new,SOURCE,'2026-11-03'))

    def test_navigation_topic_only_kept_low_priority(self):
        old = 'روابط الأخبار والخدمات والبحث'
        new = old + ' التوطين المهن'
        item = detection.analyze_change(old,new,SOURCE,'2026-11-03')
        self.assertIsNone(item) if item is None else self.assertFalse(item['email_worthy'])

    def test_decision_with_rate_date_warrants_review_not_verification(self):
        old = 'أخبار الوزارة آخر الأخبار والمقالات.'
        new = old + ' قرار وزاري جديد عن توطين مهنة محاسب بنسبة 60% يبدأ التطبيق في 2027-10-27.'
        item = detection.analyze_change(old,new,SOURCE,'2026-11-03')
        self.assertIsNotNone(item)
        self.assertTrue(item['email_worthy'])
        self.assertIn('60%',item['rates_mentioned'])
        self.assertIn('2027-10-27',item['dates_mentioned'])
        self.assertEqual(item['review_status'],'غير مؤكد — يحتاج مراجعة المصدر')
        self.assertNotIn('مؤكد',item['title'])

    def test_only_added_rates_not_existing_rates(self):
        old = 'تم ذكر توطين المهن بنسبة 40% في دليل سابق. صفحة الوزارة وبياناتها.'
        new = old + ' قرار جديد حول توطين المهن يبدأ تطبيقه في 2027-01-01 مع نسبة 60%.'
        item = detection.analyze_change(old,new,SOURCE,'2026-11-03')
        self.assertIsNotNone(item)
        self.assertEqual(item['rates_mentioned'],['60%'])
        self.assertNotIn('40%',item['summary'])

    def test_no_claim_from_unrelated_numeric_update(self):
        old = 'الموقع يراقب توطين المهن'
        new = old + ' تم تحديث رقم الاتصال العام إلى 123456. لن يتغير أي قرار.'
        item = detection.analyze_change(old,new,SOURCE,'2026-11-03')
        self.assertIsNone(item)

    def test_occupation_code_extracted_without_personal_data(self):
        old = 'أخبار الوزارة'
        new = old + ' قرار تطبيق توطين المهن بالرمز 412001 في 2028-02-15 بنسبة 70%.'
        item = detection.analyze_change(old,new,SOURCE,'2026-11-03')
        self.assertIsNotNone(item)
        self.assertIn('412001',item['occupation_codes_mentioned'])

    def test_monitor_includes_official_dossiers(self):
        sources = monitor.monitored_sources()
        self.assertGreaterEqual(len(sources), 8)
        self.assertEqual(len({x['url'] for x in sources}), len(sources))
        self.assertEqual(sum(x['kind']=='decision_page' for x in sources), len(sources)-2)
        for source in sources:
            self.assertTrue(source['url'].startswith('https://www.hrsd.gov.sa/'))

    def test_change_id_is_deterministic(self):
        old = 'أخبار الوزارة'
        new = old + ' قرار وزارة الموارد البشرية بشأن توطين المهن بنسبة 60% في 2027-10-27.'
        a = detection.analyze_change(old,new,SOURCE,'2026-11-03')
        b = detection.analyze_change(old,new,SOURCE,'2026-11-04')
        self.assertEqual(a['id'],b['id'])


if __name__ == '__main__':
    unittest.main()
