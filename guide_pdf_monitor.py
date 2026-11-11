"""Monitor explicitly verified public HRSD PDF guides for text changes.

This module does not verify legal applicability or alter decision data.
Changes require human review. First successful fetch establishes a baseline.
"""
from __future__ import annotations

import datetime
import difflib
import hashlib
import json
import re
from pathlib import Path
from urllib.request import Request, urlopen

import detection
import email_templates
import monitor

ROOT = Path(__file__).resolve().parent
SOURCE_REGISTRY = ROOT / 'data' / 'guide-pdf-sources.json'
SNAPSHOTS = ROOT / 'data' / 'guide-pdf-snapshots.json'
CHANGES = ROOT / 'data' / 'guide-pdf-changes.json'
EXTRACTION_VERSION = 1
MAX_BYTES = 12 * 1024 * 1024
MAX_PAGES = 160
MAX_LINES = 9000
MAX_CHARS = 500000
MAX_HUNKS = 18
PERCENT = re.compile(r'(?:100|[1-9]?\d)(?:[.,]\d+)?\s*[%٪]')
CODE = re.compile(r'(?<!\d)[1-9]\d{5}(?!\d)')
DATE = re.compile(r'20\d{2}[-/]\d{1,2}[-/]\d{1,2}|(?:يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)\s*20\d{2}', re.I)
TERMS = re.compile(r'مهل|مهلة|السماح|أجر|الأجور|شرط|اشتراط|اعتماد|تطبيق|نفاذ|مهنة|مهن|أنشطة|نطاق|الاحتساب|قرار|التوطين|السعودة', re.I)


def read_json(path, default):
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else default


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def validated_sources(data):
    if not isinstance(data, dict) or not isinstance(data.get('sources'), list):
        raise ValueError('Invalid PDF source registry')
    seen = set()
    sources = []
    for item in data['sources']:
        if not isinstance(item, dict):
            raise ValueError('Invalid PDF source entry')
        id_, title, url = (item.get(k, '') for k in ('id', 'title', 'url'))
        if not isinstance(id_, str) or not re.fullmatch(r'[a-z][a-z0-9-]{1,39}', id_):
            raise ValueError('Invalid decision ID')
        if not isinstance(title, str) or not (4 <= len(title) <= 120):
            raise ValueError('Invalid source title')
        if not isinstance(url, str) or not url.lower().split('?', 1)[0].endswith('.pdf') or not email_templates.safe_link(url):
            raise ValueError('Only official direct PDF documents are supported')
        if id_ in seen:
            raise ValueError('Duplicate PDF source decision')
        seen.add(id_)
        sources.append({'id': id_, 'title': title, 'url': url})
    return sources


def download_pdf(url):
    if not email_templates.safe_link(url):
        raise ValueError('Non-HRSD PDF URL')
    request = Request(monitor.encode_url(url), headers={
        'User-Agent': 'SaudizationRadar/1.0 (+official public guide text monitoring)',
        'Accept': 'application/pdf',
    })
    with urlopen(request, timeout=35) as response:
        if not email_templates.safe_link(response.geturl()):
            raise ValueError('Redirect left official HRSD domain')
        data = response.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ValueError('PDF exceeds size limit')
    if not data.startswith(b'%PDF-'):
        raise ValueError('Response is not a PDF')
    return data


def normalized_line(raw):
    return re.sub(r'\s+', ' ', (raw or '').replace('\u200f', '').replace('\u200e', '').replace('\u00ad', '')).strip()


def extract_pages(blob):
    """Use local PyMuPDF. Never OCR; scanned PDFs are clearly marked unavailable."""
    import fitz  # lazy import: CI unit tests need no external PDF dependency
    doc = fitz.open(stream=blob, filetype='pdf')
    try:
        if doc.is_encrypted:
            raise ValueError('Encrypted PDF')
        if not (1 <= len(doc) <= MAX_PAGES):
            raise ValueError('Unsupported PDF page count')
        lines = []
        chars = 0
        for n, page in enumerate(doc):
            for raw in page.get_text('text', sort=True).splitlines():
                clean = normalized_line(raw)
                if len(clean) < 3:
                    continue
                lines.append({'page': n + 1, 'text': clean[:1000]})
                chars += len(clean)
                if len(lines) > MAX_LINES or chars > MAX_CHARS:
                    raise ValueError('Document exceeds text limits')
        if chars < 120:
            raise ValueError('PDF has insufficient extractable text; manual review required')
        return lines, len(doc)
    finally:
        doc.close()


def content_hash(lines):
    return hashlib.sha256('\n'.join(line['text'] for line in lines).encode('utf-8')).hexdigest()


def change_category(old, new):
    text = ' '.join([old, new])
    if PERCENT.search(text) or 'نسبة' in text or 'النسب' in text:
        return 'نسب التوطين'
    if CODE.search(text):
        return 'الرموز المهنية'
    if DATE.search(text) or re.search(r'مهلة|المهل|السماح|البدء|تاريخ|شهر|سنة', text):
        return 'التواريخ والمهل'
    if TERMS.search(text):
        return 'المهن والاشتراطات'
    return 'نص آخر'


def diff_lines(previous, current):
    """Return limited, page-labelled text excerpts; never an unverified legal verdict."""
    a = [x['text'] for x in previous]
    b = [x['text'] for x in current]
    changes = []
    matcher = difflib.SequenceMatcher(a=a, b=b, autojunk=True)
    counts = {'added': 0, 'removed': 0, 'replaced': 0}
    for kind, i1, i2, j1, j2 in matcher.get_opcodes():
        if kind == 'equal':
            continue
        counts[{'insert':'added','delete':'removed','replace':'replaced'}[kind]] += 1
        before = ' '.join(a[i1:i2])[:650]
        after = ' '.join(b[j1:j2])[:650]
        category = change_category(before, after)
        if len(changes) < MAX_HUNKS:
            changes.append({
                'type': {'insert':'إضافة','delete':'حذف','replace':'تعديل'}[kind],
                'category': category,
                'old_page': previous[i1]['page'] if i1 < len(previous) else None,
                'new_page': current[j1]['page'] if j1 < len(current) else None,
                'before': before,
                'after': after,
            })
    return {'hunks': changes, 'counts': counts, 'truncated': sum(counts.values()) > len(changes)}


def compare_snapshot(previous, latest):
    if not previous or previous.get('extraction_version') != EXTRACTION_VERSION:
        return 'baseline', None
    if previous.get('text_hash') == latest.get('text_hash'):
        return 'unchanged_text', None
    return 'changed', diff_lines(previous['lines'], latest['lines'])


def scan_sources(sources, old_snapshots, old_changes, fetch=download_pdf, extract=extract_pages, now=None):
    """Pure-ish injectable scanning loop: network/extraction supplied by caller.

    Failed fetches never erase old baselines, preserving next-run comparison.
    """
    checked = now or datetime.datetime.now(datetime.timezone.utc).isoformat()
    snapshots = {**old_snapshots}
    changes = list(old_changes)
    scan = []
    alerts = []
    existing = {c.get('id') for c in changes}
    for source in sources:
        id_, url = source['id'], source['url']
        try:
            blob = fetch(url)
            lines, pages = extract(blob)
            latest = {
                'url': url, 'title': source['title'], 'extraction_version': EXTRACTION_VERSION,
                'binary_sha256': hashlib.sha256(blob).hexdigest(),
                'text_hash': content_hash(lines), 'lines': lines, 'pages': pages,
                'last_success_at': checked,
            }
            prior = old_snapshots.get(id_)
            # Changes of the source URL or extractor version require a fresh baseline;
            # do not compare unrelated documents or emit an ungrounded alert.
            comparable = prior if prior and prior.get('url') == url else None
            status, diff = compare_snapshot(comparable, latest)
            snapshots[id_] = latest
            result = {'id': id_, 'title': source['title'], 'url': url,
                      'status': status, 'pages': pages, 'checked_at': checked}
            if status == 'changed':
                signal_id = hashlib.sha256((id_ + '\0' + latest['text_hash']).encode()).hexdigest()[:24]
                result['signal_id'] = signal_id
                if signal_id not in existing:
                    entry = {
                        'id': signal_id, 'decision_id': id_, 'title': source['title'],
                        'source_url': url, 'detected_at': checked,
                        'status': 'غير مؤكد — تغير نص الدليل ويحتاج مراجعة بشرية',
                        'old_text_hash': comparable['text_hash'],
                        'new_text_hash': latest['text_hash'],
                        'old_pages': comparable.get('pages'),
                        'new_pages': pages,
                        **diff,
                    }
                    changes.insert(0, entry)
                    existing.add(signal_id)
                    if any(x['category'] != 'نص آخر' for x in diff['hunks']):
                        alert = {
                            'id': signal_id, 'source': 'الأدلة الإجرائية PDF',
                            'title': 'تغيّر نص دليل رسمي يتطلب مراجعة: ' + source['title'],
                            'summary': ('تغيّر نص الدليل الإجرائي «' + source['title'] +
                                        '». راجع الفروق التفصيلية في غرفة مقارنة الأدلة؛ لا يعني التغيير صدور قرار أو نفاذ نسبة جديدة.'),
                            'url': url, 'detected_at': checked,
                            'review_priority': 'عالية للمراجعة',
                            'review_status': 'تغيير PDF يحتاج مراجعة بشرية',
                            'email_worthy': True, 'rates_mentioned': [],
                            'dates_mentioned': [], 'occupation_codes_mentioned': [],
                            'signal_reasons': ['تغير محتوى PDF رسمي'],
                        }
                        alerts.append(alert)
            scan.append(result)
        except Exception as exc:
            scan.append({'id': id_, 'title': source['title'], 'url': url,
                         'status': 'error', 'error': type(exc).__name__,
                         'message': 'تعذر جلب أو استخراج نص الدليل؛ لا تُحدّث النسخة المرجعية',
                         'checked_at': checked})
    return snapshots, changes[:100], scan, alerts


def main():
    sources = validated_sources(read_json(SOURCE_REGISTRY, {'sources': []}))
    if not sources:
        raise RuntimeError('No verified PDF sources configured')
    data = read_json(SNAPSHOTS, {'documents': {}})
    history = read_json(CHANGES, {'changes': []})
    snapshots, changes, scan, alerts = scan_sources(
        sources, data.get('documents', {}), history.get('changes', []))
    when = datetime.datetime.now(datetime.timezone.utc).isoformat()
    report = {'checked_at': when,
              'total_sources': len(sources),
              'successful_sources': sum(x['status'] != 'error' for x in scan),
              'failed_sources': sum(x['status'] == 'error' for x in scan),
              'sources': scan,
              'coverage_notice': 'المقارنة تخص روابط PDF المباشرة المسجلة فقط؛ لا تغطي جميع أدلة الوزارة، ولا تُثبت الانطباق على سالك.'}
    # Commit only if alerts have been delivered; a missing SMTP configuration must
    # not silently lose a genuine content change before the next scan.
    if alerts and not monitor.send_email(alerts):
        raise RuntimeError('PDF change notification failed; previous state retained for retry')
    write_json(SNAPSHOTS, {'version': EXTRACTION_VERSION, 'updated_at': when, 'documents': snapshots})
    write_json(CHANGES, {'updated_at': when, 'changes': changes, 'last_scan': report})
    if report['successful_sources'] == 0:
        raise RuntimeError('All PDF guides failed; prior snapshots preserved')
    print('PDF guide check:', report['successful_sources'], 'of', report['total_sources'],
          'successful;', len(alerts), 'relevant new text-change signals')


if __name__ == '__main__':
    main()
