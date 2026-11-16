"""Build an independent occupation-code catalog from public HRSD group pages.

Safety: this never edits the Saudization decision engine or workforce data.
Only publish a verified complete snapshot; incomplete / blocked pages fail closed.
"""
import argparse
import datetime as dt
import json
import math
import pathlib
import re
import time
import urllib.error
import urllib.request
from html.parser import HTMLParser
from urllib.parse import urlencode

ROOT = pathlib.Path(__file__).resolve().parent
CATALOG = ROOT / "data" / "occupation-catalog.json"
DECISIONS = ROOT / "data" / "occupations.json"
OFFICIAL_HOST = "https://www.hrsd.gov.sa/skills-taxonomy/occupations/"
CODE = re.compile(r"\d{5,6}")
USER_AGENT = "Saudization-Radar-Occupation-Reference/1.0 (public reference only)"


class OccupationTableParser(HTMLParser):
    """Parse table rows with a 5–6 digit code and occupation title."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows = []
        self.in_row = False
        self.in_cell = False
        self.cells = []
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self.in_row = True
            self.cells = []
        elif tag == "td" and self.in_row:
            self.in_cell = True
            self.parts = []

    def handle_data(self, data):
        if self.in_row and self.in_cell:
            self.parts.append(data)

    def handle_endtag(self, tag):
        if tag == "td" and self.in_cell:
            self.cells.append(" ".join("".join(self.parts).split()))
            self.in_cell = False
        elif tag == "tr" and self.in_row:
            if len(self.cells) >= 2:
                code, title = self.cells[:2]
                if CODE.fullmatch(code) and title and not CODE.fullmatch(title):
                    self.rows.append((code, title))
            self.in_row = self.in_cell = False


def parse_rows(page):
    parser = OccupationTableParser()
    parser.feed(page)
    return parser.rows


def request_page(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT,
        "Accept-Language": "ar-SA,ar;q=0.9",
        "Accept": "text/html",
    })
    last = None
    for attempt in range(2):
        try:
            with urllib.request.urlopen(req, timeout=22) as response:
                if not response.url.startswith("https://www.hrsd.gov.sa/"):
                    raise ValueError("Official URL redirected to unexpected host")
                body = response.read(3_000_000)
                return body.decode("utf-8", errors="replace")
        except (urllib.error.URLError, TimeoutError) as exc:
            last = exc
            if attempt == 0:
                time.sleep(1)
    raise RuntimeError(f"Could not fetch {url}: {last}")


def scrape_group(group, fetch=request_page, sleep=time.sleep):
    """Return code/title rows; detect ignored pagination instead of duplicating page 1."""
    url = group["url"]
    if not url.startswith(OFFICIAL_HOST):
        raise ValueError("Unsafe occupation group URL")
    expected = int(group["count"])
    if expected <= 0 or expected > 1000:
        raise ValueError("Invalid group count")
    pages = math.ceil(expected / 12) + 5
    seen = {}
    for page in range(pages):
        endpoint = url if page == 0 else url + "?" + urlencode({"page": page})
        page_html = fetch(endpoint)
        extracted = parse_rows(page_html)
        if not extracted:
            raise ValueError(f"No occupation rows in {endpoint}")
        before = len(seen)
        for code, title in extracted:
            if code in seen and seen[code] != title:
                raise ValueError(f"Conflicting labels for {code}")
            seen[code] = title
        added = len(seen) - before
        if page > 0 and added == 0:
            # Diagnostic of public navigation attributes, never publish incomplete data.
            for marker in ("pagination", "pager", "page-link", "page-item", "data-page", "page-number", "__doPostBack", "getNext", "nextPage"):
                match = re.search(re.escape(marker), page_html, re.IGNORECASE)
                if match:
                    print("OFFICIAL_PAGER_HINT", marker, repr(page_html[max(0, match.start()-150):match.start()+480]), flush=True)
            links = re.findall(r'<a\\b[^>]{0,500}>', page_html, flags=re.I)
            print("OFFICIAL_PAGER_LINKS", [x[:350] for x in links if any(k in x.lower() for k in ("page", "onclick", "javascript", "next", "href=\"#"))][-15:], flush=True)
            raise ValueError(f"Pagination did not advance: {endpoint} ({len(seen)}/{expected})")
        if len(seen) >= expected:
            break
        sleep(0.25)
    if len(seen) != expected:
        raise ValueError(f"Group {group['id']} incomplete: {len(seen)} / {expected}")
    return seen


def build_catalog(seed, fetch=request_page, sleep=time.sleep):
    """All ten official groups must be complete before any data can be replaced."""
    if seed.get("schema") != 1 or len(seed.get("groups", [])) != 10:
        raise ValueError("Invalid seed catalog or missing group metadata")
    links = json.loads(DECISIONS.read_text(encoding="utf-8"))["occupations"]
    legal_by_code = {}
    for item in links:
        legal_by_code.setdefault(str(item["code"]), set()).update(item.get("decisionIds", []))
    merged = {}
    for group in seed["groups"]:
        scanned = scrape_group(group, fetch, sleep)
        for code, title in scanned.items():
            if code in merged:
                raise ValueError(f"Duplicate occupation code across official groups: {code}")
            merged[code] = {
                "code": code,
                "title": title,
                "group": str(group["id"]),
                "decisionIds": sorted(legal_by_code.get(code, set())),
            }
        print(f"Verified official category {group['id']}: {len(scanned)}")
    expected = sum(int(g["count"]) for g in seed["groups"])
    if len(merged) != expected:
        raise ValueError(f"Unexpected total count: {len(merged)} / {expected}")
    return {
        "schema": 1,
        "status": "official_group_pages_verified",
        "headlineTotal": seed["headlineTotal"],
        "coverageNote": "مهن مرجعية من صفحات مجموعات الوزارة؛ لا تثبت انطباق قرار أو رمز قوى الفعلي. قد يختلف عدّاد البوابة عن مجموع أرقام المجموعات.",
        "updatedAt": dt.datetime.now(dt.timezone.utc).date().isoformat(),
        "groups": seed["groups"],
        "items": [merged[code] for code in sorted(merged)],
    }


def main():
    args = argparse.ArgumentParser()
    args.add_argument("--check-only", action="store_true")
    ns = args.parse_args()
    seed = json.loads(CATALOG.read_text(encoding="utf-8"))
    updated = build_catalog(seed)
    previous = {k: v for k, v in seed.items() if k != "updatedAt"}
    current = {k: v for k, v in updated.items() if k != "updatedAt"}
    if previous == current:
        print(f"No catalog changes: {len(updated['items'])} official occupations")
        return
    if ns.check_only:
        print(f"Verified {len(updated['items'])} occupations. Not writing (--check-only).")
        return
    temp = CATALOG.with_suffix(".tmp")
    temp.write_text(json.dumps(updated, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp.replace(CATALOG)
    print(f"Published complete official snapshot ({len(updated['items'])} occupations)")


if __name__ == "__main__":
    main()
