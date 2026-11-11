"""Heuristic triage of HRSD page updates — NEVER a legal decision verifier.

Only newly added text is analyzed. Scores indicate how worthwhile an update
is for human review, not confidence that a government decision has been made.
"""
import hashlib
import re
import difflib

TOPIC = re.compile(r'توطين|سعود[ةي]|مهن(?:ة|ي|ية|يين)?|saudization|localization', re.I)
DECISION = re.compile(r'قرار|يقرر|اعتماد|اعتمد|إلزام|إلزامي|إلزامية|يُلزم|تطبيق|تطبق|بدء سريان|بدء العمل|يدخل حيز|رفع نسبة|نسب التوطين|حد أدنى|قرار وزاري|ministerial decision', re.I)
PERCENT = re.compile(r'(?<![\d.])(?:100|[1-9]?\d)(?:[.,]\d+)?\s*[%٪]')
DATE = re.compile(r'(?:20\d{2})[-/](?:0?[1-9]|1[0-2])[-/](?:[0-2]?\d|3[01])|(?:\d{1,2}\s+(?:يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر)\s+20\d{2})')
CODES = re.compile(r'(?<!\d)[1-9]\d{5}(?!\d)')
NAV = re.compile(r'^(?:الرئيسية|خدمات|اتصل بنا|الأخبار|المركز الإعلامي|البحث|المزيد|اقرأ المزيد|تابعنا|menu|home|search)$', re.I)

def normalize(text):
    return re.sub(r'\s+', ' ', (text or '')).strip()

def meaningful_new_text(old, new, max_chars=2200):
    """Diff on words so insertion isn't spuriously matched character-by-character.
    Returns adjacent *added* wording only; unchanged old rates are not evidence.
    """
    before, after = normalize(old).split(), normalize(new).split()
    if not before:
        return ''
    # Protect Actions runners against huge quadratic sequence comparisons.
    if len(before) > 14000 or len(after) > 14000:
        before, after = before[:14000], after[:14000]
    matcher = difflib.SequenceMatcher(None, before, after, autojunk=True)
    groups = []
    for op, i1, i2, j1, j2 in matcher.get_opcodes():
        if op not in ('insert', 'replace'):
            continue
        added = ' '.join(after[j1:j2])
        if len(added) < 12 or NAV.fullmatch(added.strip()):
            continue
        groups.append(added)
    return '\n'.join(groups)[:max_chars]

def classify(added, source_name='', source_url=''):
    """Returns a review signal; never marks the update 'verified' or 'issued'."""
    text = normalize(added)
    if len(text) < 14 or not TOPIC.search(text):
        return None
    has_decision = bool(DECISION.search(text))
    rates = list(dict.fromkeys(PERCENT.findall(text)))[:5]
    dates = list(dict.fromkeys(DATE.findall(text)))[:5]
    codes = list(dict.fromkeys(CODES.findall(text)))[:10]
    score = 1 + (2 if has_decision else 0) + (1 if rates else 0) + (1 if dates else 0) + (1 if codes else 0)
    # More decisive combinations receive a review alert, not a claim of law.
    priority = 'عالية للمراجعة' if score >= 4 else ('متوسطة للمراجعة' if score >= 3 else 'منخفضة للمراجعة')
    email_worthy = score >= 4 and has_decision
    return {
        'review_score': score,
        'review_priority': priority,
        'review_status': 'غير مؤكد — يحتاج مراجعة المصدر',
        'email_worthy': email_worthy,
        'rates_mentioned': rates,
        'dates_mentioned': dates,
        'occupation_codes_mentioned': codes,
        'signal_reasons': [k for flag, k in [
            (True, 'مصطلحات توطين'),
            (has_decision, 'صياغة قرار/تطبيق'),
            (bool(rates), 'نسب مذكورة'),
            (bool(dates), 'تواريخ مذكورة'),
            (bool(codes), 'رموز مهنية مذكورة'),
        ] if flag],
    }


def content_signature(item):
    """Identify an identical substantial HRSD update across monitored pages.

    Short/generic notices are deliberately not grouped, since different real
    decisions can share boilerplate such as 'توطين 100%'.
    """
    summary = normalize(item.get('summary', ''))
    if len(summary) < 100 or not TOPIC.search(summary) or not DECISION.search(summary):
        return None
    return hashlib.sha256(summary.encode('utf-8')).hexdigest()[:24]

def analyze_change(previous, current, source, detected_at):
    added = meaningful_new_text(previous, current)
    signal = classify(added, source.get('name', ''), source.get('url', ''))
    if not signal:
        return None
    digest = hashlib.sha256((source['url'] + '\0' + added).encode('utf-8')).hexdigest()[:16]
    return {
        'id': digest,
        'source': source['name'],
        'title': 'تغيّر يتطلب مراجعة: ' + source['name'],
        'summary': normalize(added)[:650],
        'url': source['url'],
        'detected_at': detected_at,
        **signal,
    }
