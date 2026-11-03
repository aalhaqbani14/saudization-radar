"""Static HTML navigation integrity tests; no network requests."""
import pathlib
import unittest
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote

ROOT=pathlib.Path(__file__).resolve().parent
PAGES=['index.html','intelligence.html','sources.html']

class Refs(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs=[]
    def handle_starttag(self,tag,attrs):
        data=dict(attrs)
        for prop in (('src',) if tag in ('script','img') else ('href',) if tag in ('link','a') else ()):
            if data.get(prop):
                self.refs.append((tag,data[prop]))

class SiteIntegrity(unittest.TestCase):
    def test_local_assets_and_internal_links_exist(self):
        for name in PAGES:
            page=ROOT/name
            self.assertTrue(page.is_file())
            parser=Refs()
            parser.feed(page.read_text(encoding='utf-8'))
            for tag,ref in parser.refs:
                with self.subTest(page=name,ref=ref):
                    if ref.startswith(('#','mailto:','tel:','javascript:')):
                        continue
                    parsed=urlsplit(ref)
                    if parsed.scheme or parsed.netloc:
                        self.assertEqual(parsed.scheme, 'https',ref)
                        continue
                    relative=unquote(parsed.path)
                    if not relative:
                        continue
                    path=(page.parent/relative).resolve()
                    self.assertTrue(path.is_relative_to(ROOT),ref)
                    self.assertTrue(path.is_file(),f'{name} -> {ref}')
    def test_has_navigation_to_source_register(self):
        for name in ('index.html','intelligence.html'):
            self.assertIn('sources.html',(ROOT/name).read_text(encoding='utf-8'))

if __name__ == '__main__':
    unittest.main()
