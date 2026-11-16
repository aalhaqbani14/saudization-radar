"""Expand the searchable catalog using the archived 2019 GASTAT occupation classification.

The archived reference is **not** the current HRSD occupational catalog and
never changes Saudization decision/applicability data. No PDF is published.
"""
import datetime as dt
import json
import pathlib
import re
import urllib.request
import fitz

ROOT = pathlib.Path(__file__).resolve().parent
CATALOG = ROOT / "data/occupation-catalog.json"
BASE = "https://quality.kku.edu.sa/sites/quality.kku.edu.sa/files/2024-03/"
URL_AR = (BASE + "%D8%A7%D9%84%D8%AA%D8%B5%D9%86%D9%8A%D9%81%20%D8%A7%D9%84%D8%B3%D8%B9%D9%88%D8%AF%D9%8A%20%D8%A7%D9%84%D9%85%D9%88%D8%AD%D8%AF%20%D9%84%D9%84%D9%85%D9%87%D9%86%201.pdf")
URL_EN = BASE + "Unified%20Saudi%20Occupational%20Classification%201.pdf"
AR_LINE = re.compile(r"^(.*?)\s*([0-9]{6})\s*$")
EN_LINE = re.compile(r"^\s*([0-9]{6})\s+([A-Za-z].+)$")

def fetch_pdf(url):
    with urllib.request.urlopen(
        urllib.request.Request(url, headers={"User-Agent":"Mozilla/5.0"}),
        timeout=70,
    ) as response:
        if response.status != 200 or response.url.split("/")[2] != "quality.kku.edu.sa":
            raise ValueError("Unexpected reference PDF source")
        blob = response.read(20_000_000)
    pdf = fitz.open(stream=blob, filetype="pdf")
    if len(pdf) < 130:
        raise ValueError("Incomplete GASTAT reference PDF")
    return pdf

def extract(pdf, language):
    results = {}
    pages = range(28, min(130, len(pdf))) if language == "ar" else range(34, min(145, len(pdf)))
    for page in pages:
        for line in pdf[page].get_text(sort=True).splitlines():
            text = line.strip()
            match = AR_LINE.fullmatch(text) if language == "ar" else EN_LINE.fullmatch(text)
            if match is None:
                continue
            if language == "ar":
                raw, code = match.groups()
                if len(raw) < 3 or not re.search(r"[\u0621-\u064A]", raw):
                    continue
                title = " ".join(reversed(raw.split()))
            else:
                code, title = match.groups()
                title = title.strip()
            if code in results and results[code] != title:
                raise ValueError(f"Contradictory {language} titles for {code}")
            results[code] = title
    return results

def compile_catalog(previous, ar, en):
    if len(ar) != 2012 or len(en) != 2012 or len(set(ar) | set(en)) != 2013 or len(set(ar)&set(en)) != 2011:
        raise ValueError(f"Unexpected archive occupation coverage: AR={len(ar)} EN={len(en)} union={len(set(ar)|set(en))}")
    if ar.get("111101") != "وزير" or en.get("111101") != "Minister":
        raise ValueError("Archive code/title alignment failed")
    existing = {r["code"]:r for r in previous["items"]}
    records = {}
    for code in sorted(set(ar)|set(en)):
        title = ar.get(code) or en.get(code)
        records[code] = {
            "code": code, "title": title, "group": code[0],
            "decisionIds": [], "sourceTier": "official_gastat_2019",
        }
        if en.get(code):
            records[code]["titleEn"] = en[code]
    # Preserve currently sourced HRSD guide/page titles (including 5-digit group-0 codes).
    # They are newer evidence but still not proof of Qiwa employee mapping.
    for code, item in existing.items():
        if not re.fullmatch(r"\d{5,6}",code):
            continue
        archived = records.get(code)
        records[code] = {**(archived or {}), **item}
        if archived and "titleEn" in archived:
            records[code]["titleEn"] = archived["titleEn"]
    result = {
        "schema": 1,
        "status": "historical_augmented",
        "headlineTotal": previous["headlineTotal"],
        "coverageNote": ("مرجع بحث موسّع: التصنيف السعودي الموحد للمهن (هيئة الإحصاء، نسخة 2019) "
                         "مضافًا إلى رموز أدلة القرارات وصفحات وزارة الموارد البشرية المتحققة. "
                         "ليس نسخة كاملة من تصنيف الوزارة الحالي لعام 2026، ولا يثبت انطباق التوطين أو رمز الموظف في قوى."),
        "updatedAt": dt.datetime.now(dt.timezone.utc).date().isoformat(),
        "groups": previous["groups"],
        "archive": {
            "authority": "الهيئة العامة للإحصاء",
            "referenceYear": 2019,
            "editionDate": "2019-11-13",
            "arabicPdf": URL_AR, "englishPdf": URL_EN,
            "archivedCodes": len(set(ar)|set(en)),
            "arabicCodes": len(ar),
            "englishCodes": len(en),
            "matchedBilingualCodes": len(set(ar)&set(en)),
        },
        "importedOfficialFirstPageRows": previous.get("importedOfficialFirstPageRows", 0),
        "items": [records[c] for c in sorted(records)]
    }
    if len(result["items"]) < 2013:
        raise ValueError("Catalog merge unexpectedly lost archived codes")
    return result

def main():
    previous = json.loads(CATALOG.read_text(encoding="utf-8"))
    ar, en = extract(fetch_pdf(URL_AR), "ar"), extract(fetch_pdf(URL_EN), "en")
    result = compile_catalog(previous, ar, en)
    print("ARCHIVE VERIFICATION",json.dumps({
        "arabic":len(ar),"english":len(en),"shared":len(set(ar)&set(en)),
        "uniqueArchived":len(set(ar)|set(en)),"combinedCatalog":len(result["items"])
    },ensure_ascii=False), flush=True)
    CATALOG.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")

if __name__ == "__main__":
    main()
