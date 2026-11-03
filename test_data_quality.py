"""Read-only static data integrity checks. No network, secrets or code execution.
Run: python -m unittest -v test_data_quality.py
"""
import datetime
import json
import pathlib
import unittest
from urllib.parse import urlsplit

ROOT = pathlib.Path(__file__).resolve().parent

def read(name):
    return json.loads((ROOT / 'data' / name).read_text(encoding='utf-8'))

def is_date(value):
    try:
        return datetime.date.fromisoformat(value).isoformat() == value
    except (TypeError, ValueError):
        return False

def official(value):
    try:
        u = urlsplit(value)
        return u.scheme == "https" and (
            u.hostname == "hrsd.gov.sa" or u.hostname.endswith(".hrsd.gov.sa")
        ) and not u.username and not u.password
    except (TypeError, AttributeError, ValueError):
        return False

def government_historical_source(value):
    """Historical citations can be HRSD or Saudi Press Agency;
    SPA-only evidence is not confirmation of the original decree."""
    if official(value):
        return True
    try:
        u = urlsplit(value)
        return (u.scheme == "https" and u.hostname in {"spa.gov.sa", "www.spa.gov.sa"}
                and not u.username and not u.password)
    except (TypeError, AttributeError, ValueError):
        return False

class DataQuality(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.d = read('decisions.json')['decisions']
        cls.o = read('occupations.json')['occupations']
        cls.reg = read('source-registry.json')['sources']
        cls.grace = read('grace-periods.json')['records']

    def test_unique_decision_and_code_ids(self):
        self.assertEqual(len({x['id'] for x in self.d}), len(self.d))
        self.assertEqual(len({x['code'] for x in self.o}), len(self.o))

    def test_occupation_links_are_resolvable(self):
        ids = {x['id'] for x in self.d}
        for occupation in self.o:
            with self.subTest(code=occupation['code']):
                self.assertRegex(occupation['code'], r'^[1-9]\d{5}$')
                self.assertTrue(occupation['decisionIds'])
                self.assertTrue(set(occupation['decisionIds']) <= ids)
                self.assertTrue(official(occupation.get('source', '')))
                if occupation.get('primaryEffective'):
                    self.assertTrue(is_date(occupation['primaryEffective']))

    def test_decision_rates_dates_and_official_links(self):
        for decision in self.d:
            with self.subTest(id=decision['id']):
                self.assertTrue(official(decision['source']))
                if decision.get('source2'):
                    self.assertTrue(official(decision['source2']))
                for field in ('issueDate', 'effective'):
                    if decision.get(field):
                        self.assertTrue(is_date(decision[field]), (decision['id'], field))
                pct = decision.get('pct')
                if pct is not None:
                    self.assertTrue(isinstance(pct, (float, int)) and 0 <= pct <= 100)
                for stage in decision.get('history', []):
                    if stage.get('date'):
                        self.assertTrue(is_date(stage['date']))
                    self.assertIn(stage.get('kind'), {'original','expanded','raised','upcoming','special','single','pending'})
                    self.assertFalse(str(stage.get('label','')).startswith('https://'))
                    if stage.get('source'):
                        self.assertTrue(government_historical_source(stage['source']))
                        if not official(stage['source']):
                            self.assertFalse(stage.get('verified'),
                                'News-agency citations alone must not claim ministerial verification')

    def test_documented_grace_periods_are_scoped_and_source_backed(self):
        decisions={x['id']:x for x in self.d}
        seen=set()
        for grace in self.grace:
            with self.subTest(group=grace['decisionId'],scope=grace['scope']):
                decision=decisions[grace['decisionId']]
                self.assertTrue(grace['scope'])
                self.assertTrue(grace['duration'])
                self.assertIn(grace['status'], ('official','reported'))
                self.assertTrue(official(grace['source']))
                self.assertTrue(is_date(grace['start']))
                self.assertTrue(is_date(grace['end']))
                self.assertLessEqual(grace['start'],grace['end'])
                self.assertEqual(grace['start'],decision['issueDate'])
                valid_end={decision.get('effective')}
                valid_end.update(x.get('date') for x in decision.get('phases',[]))
                self.assertIn(grace['end'],valid_end)
                unique=(grace['decisionId'],grace['scope'])
                self.assertNotIn(unique,seen)
                seen.add(unique)

    def test_registry_has_official_sources_and_matches_decisions(self):
        ids = {x['id']:x for x in self.d}
        self.assertEqual(len({x['id'] for x in self.reg}),len(self.reg))
        for source in self.reg:
            with self.subTest(id=source['id']):
                self.assertIn(source['id'],ids)
                self.assertTrue(official(source['url']))
                self.assertTrue(source['number'])
                self.assertTrue(is_date(source['issued']))
                self.assertTrue(is_date(source['effective']))
                self.assertEqual(source['number'],ids[source['id']]['number'])
                if ids[source['id']].get('issueDate'):
                    self.assertEqual(source['issued'],ids[source['id']]['issueDate'])
                self.assertEqual(source['effective'],ids[source['id']]['effective'])

if __name__ == "__main__":
    unittest.main()
