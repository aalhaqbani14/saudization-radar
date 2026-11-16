"""Offline regression checks for the optional national occupation-code catalog."""
import json
import pathlib
import unittest
from sync_occupation_catalog import parse_rows, scrape_group

ROOT = pathlib.Path(__file__).resolve().parent


def html(rows):
    return "<table><thead><tr><th>الرمز</th><th>المهنة</th></tr></thead><tbody>" + "".join(
        f"<tr><td>{code}</td><td>{title}</td></tr>" for code, title in rows
    ) + "</tbody></table>"


class OccupationCatalogTest(unittest.TestCase):
    def test_parser_reads_only_real_code_title_rows(self):
        data = html([("441601", "كاتب <strong>موارد بشرية</strong>"),
                     ("961302", "عامل نظافة حدائق"), ("not-code", "عنوان")])
        self.assertEqual(parse_rows(data),
                         [("441601", "كاتب موارد بشرية"), ("961302", "عامل نظافة حدائق")])

    def test_pagination_must_advance(self):
        group = {"id": "9", "count": 3,
                 "url": "https://www.hrsd.gov.sa/skills-taxonomy/occupations/elementary-occupations"}
        def fetch(url):
            if "?page=1" in url:
                return html([("961303", "عامل تجريبي")])
            return html([("961302", "عامل نظافة حدائق"), ("961301", "عامل نظافة شوارع")])
        self.assertEqual(len(scrape_group(group, fetch, lambda _: None)), 3)

    def test_duplicate_first_page_fails_closed(self):
        group = {"id": "9", "count": 3,
                 "url": "https://www.hrsd.gov.sa/skills-taxonomy/occupations/elementary-occupations"}
        with self.assertRaisesRegex(ValueError, "pagination did not advance"):
            scrape_group(group, lambda _: html([("961301", "عامل نظافة شوارع")]),
                         lambda _: None)

    def test_catalog_has_distinct_codes_and_honest_coverage(self):
        data = json.loads((ROOT / "data/occupation-catalog.json").read_text(encoding="utf-8"))
        self.assertEqual(data["schema"], 1)
        self.assertIn(data["status"], ("seed_guides_only", "official_partial_pages", "official_group_pages_verified"))
        self.assertEqual(len(data["groups"]), 10)
        codes = [r["code"] for r in data["items"]]
        self.assertEqual(len(codes), len(set(codes)))
        self.assertTrue(all(code.isascii() and code.isdigit() and len(code) in (5,6)
                            for code in codes))
        if data["status"] == "official_group_pages_verified":
            self.assertEqual(len(codes), sum(g["count"] for g in data["groups"]))

    def test_homepage_only_links_to_catalog_no_eager_catalog_fetch(self):
        html_content = (ROOT / "index.html").read_text(encoding="utf-8")
        self.assertIn('href="occupation-catalog.html"', html_content)
        self.assertNotIn("occupation-catalog.json", html_content)
        page = (ROOT / "occupation-catalog.html").read_text(encoding="utf-8")
        self.assertIn("assets/occupation-catalog.js", page)


if __name__ == "__main__":
    unittest.main()
