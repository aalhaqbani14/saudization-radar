"""Safe HTML and plaintext notifications for Saudization Radar.

All text in alerts is untrusted extracted public web content. Never interpolate
unescaped values into HTML, and never claim a change is an approved decision.
"""
import html
import re
import datetime
from email.utils import format_datetime
from zoneinfo import ZoneInfo
from urllib.parse import urlsplit

SITE = "https://aalhaqbani14.github.io/saudization-radar/"

def safe_link(value):
    try:
        link = urlsplit(str(value or ""))
        if link.scheme != "https" or not link.hostname:
            return None
        host = link.hostname.lower()
        if host != "hrsd.gov.sa" and not host.endswith(".hrsd.gov.sa"):
            return None
        return link.geturl()
    except (ValueError, TypeError):
        return None

def ellipsis(text, max_chars=420):
    value = " ".join(str(text or "").split())
    return value[:max_chars] + ("…" if len(value) > max_chars else "")

def key_details(change):
    """Only show percentages/dates actually present in *new* source text.

    They are candidates for human verification, NOT extracted 'old/new' rates.
    """
    text = str(change or "")
    rates = list(dict.fromkeys(re.findall(r"(?<!\d)(?:100|[1-9]?\d)(?:[.,]\d+)?\s*[%٪]", text)))[:5]
    dates = list(dict.fromkeys(re.findall(r"(?:20\d{2})[-/](?:0?[1-9]|1[0-2])[-/](?:[0-2]?\d|3[01])", text)))[:4]
    return rates, dates

def date_now():
    return datetime.datetime.now(ZoneInfo("Asia/Riyadh")).strftime("%Y-%m-%d %H:%M")

def plain(alerts=None, test=False, demo=False):
    if demo:
        return "\n".join([
            "SAUDIZATION RADAR — محاكاة تنبيه قرار توطين",
            "",
            "مثال افتراضي بالكامل لغرض عرض شكل التنبيهات فقط؛ لا يمثل خبراً أو قراراً رسمياً.",
            "المجال الافتراضي: وظائف الخدمات الإدارية",
            "نسبة التوطين السابقة (افتراضية): 40%",
            "نسبة التوطين الجديدة (افتراضية): 60%",
            "تاريخ التطبيق الافتراضي: 2027-01-01",
            "الملاحظة: البيانات جميعها لغرض تجربة التصميم وليست مستمدة من قرار رسمي.",
            "وقت الاختبار بتوقيت الرياض: " + date_now(),
            "لوحة المتابعة: " + SITE,
        ])
    if test:
        return "\n".join([
            "SAUDIZATION RADAR — اختبار التنبيهات",
            "",
            "هذه رسالة تجريبية لتأكيد وصول تنبيهات البريد.",
            "لا تشير هذه الرسالة إلى صدور قرار جديد أو رصد تغيير فعلي.",
            "وقت الاختبار بتوقيت الرياض: " + date_now(),
            "لوحة المتابعة: " + SITE,
        ])
    alerts = alerts or []
    parts = ["SAUDIZATION RADAR — تنبيه رصد تغييرات محتملة",
             "تنبيه آلي استرشادي؛ ليس تأكيداً بصدور قرار أو تغيير نسبة.",
             "وقت الإرسال (الرياض): " + date_now(), ""]
    for a in alerts:
        snippet = ellipsis(a.get("summary", ""))
        rates, dates = key_details(snippet)
        parts.extend([
            a.get("title", "تغيير محتمل"),
            "المصدر: " + a.get("source", "وزارة الموارد البشرية"),
            "النص الذي تغير: " + snippet,
        ])
        if rates:
            parts.append("نسب ظهرت بالنص المضاف (تحتاج تحققاً): " + "، ".join(rates))
        if dates:
            parts.append("تواريخ ظهرت بالنص المضاف (تحتاج تحققاً): " + "، ".join(dates))
        if safe_link(a.get("url")):
            parts.append("رابط المصدر: " + safe_link(a.get("url")))
        parts.append("")
    parts.extend(["تأكد من نص القرار والدليل الإجرائي الساري قبل اتخاذ إجراء.", SITE])
    return "\n".join(parts)

def render(alerts=None, test=False, demo=False):
    alerts = alerts or []
    banner = "محاكاة فقط · ليست خبراً رسمياً" if demo else ("رسالة اختبار — إعداد الإشعارات" if test else "تنبيه رصد تغيّر محتمل")
    heading = "محاكاة تنبيه تغيير نسبة التوطين" if demo else ("بريد Saudization Radar يعمل" if test else "تغيّر محتمل في مصادر التوطين")
    explanation = (
        "هذا المثال افتراضي بالكامل لتجربة شكل رسالة التوطين؛ جميع المهن والنسب والتواريخ أدناه غير مستمدة من أي قرار رسمي."
        if demo else
        "هذه رسالة تجريبية وليست إشعاراً بصدور قرار جديد. إعدادات الإرسال تعمل عند وصول البريد."
        if test else
        "تم رصد نص مضاف إلى صفحة عامة من وزارة الموارد البشرية. يظهر أدناه ما رُصد فقط، "
        "ولا تُثبت المنصة تلقائياً أن القرار صدر أو أن النسبة تغيرت."
    )
    cards = []
    if demo:
        cards.append("""<tr><td style="padding:12px 24px 20px">
          <div style="border:2px dashed #e7ad52;border-radius:12px;padding:13px;background:#fff8e9;color:#915a12;font-size:13px;font-weight:bold;text-align:center">
          مثال افتراضي — ليس قراراً رسمياً ولا إشعاراً حقيقياً
          </div>
          <div style="border:1px solid #dfe9ec;border-radius:14px;margin-top:12px;padding:20px;background:#ffffff">
          <div style="color:#128477;font-size:12px;font-weight:bold">نموذج قرار افتراضي · وظائف الخدمات الإدارية</div>
          <h2 style="font-size:19px;color:#163d4b;margin:12px 0">تغيير افتراضي في نسبة التوطين</h2>
          <p style="color:#526e78;font-size:13px;line-height:2">مثال لتوضيح شكل الإشعار التنفيذي عند توثيق قرار مستقبلي. لا تستخدم هذه البيانات لأي إجراء.</p>
          <table role="presentation" width="100%" style="border-collapse:separate;border-spacing:5px"><tr>
           <td style="border-radius:9px;padding:12px;background:#eef3f6;text-align:center"><div style="font-size:11px;color:#647e88">النسبة السابقة (افتراضية)</div><div dir="ltr" style="font-size:25px;color:#456170;font-weight:bold">40%</div></td>
           <td style="border-radius:9px;padding:12px;background:#e6f8f2;text-align:center"><div style="font-size:11px;color:#427b6b">النسبة الجديدة (افتراضية)</div><div dir="ltr" style="font-size:25px;color:#087967;font-weight:bold">60%</div></td>
          </tr></table>
          <div style="padding:11px;background:#f0f5f7;border-radius:8px;color:#4d6b78;font-size:12px;margin-top:11px">تاريخ التطبيق الافتراضي: <span dir="ltr">2027-01-01</span></div>
          <p style="color:#945d18;font-size:11px;line-height:1.8">المصدر: بيانات عرض تجريبية فقط. لا يوجد رابط لقرار حقيقي لأن هذا المثال مختلق لغرض التجربة.</p>
          </div></td></tr>""")
    if test and not demo:
        cards.append("""<tr><td style="padding:20px 24px">
          <div style="border:1px solid #c9e5df;border-radius:14px;background:#effaf6;padding:18px">
          <div style="font-size:12px;color:#328578">TEST EMAIL · تنبيه تجريبي</div>
          <div style="font-size:18px;font-weight:700;color:#0d3845;margin-top:7px">تم تجهيز قناة التنبيهات</div>
          <div style="font-size:13px;color:#536e79;line-height:1.9;margin-top:9px">
          هذه التجربة لا تتضمن أي بيانات عن قرارات التوطين.
          </div></div></td></tr>""")
    for index, a in enumerate(alerts[:12], 1):
        title = html.escape(ellipsis(a.get("title") or "تغيير محتمل", 140))
        source = html.escape(ellipsis(a.get("source") or "مصدر رسمي", 100))
        summary_text = ellipsis(a.get("summary"), 650)
        summary = html.escape(summary_text)
        rates, dates = key_details(summary_text)
        extras = []
        if rates:
            extras.append('<span style="display:inline-block;padding:6px 10px;margin:4px;background:#e9f6f1;border-radius:8px;color:#0b716a;font-size:12px">نِسَب في النص المضاف: '+html.escape("، ".join(rates))+'</span>')
        if dates:
            extras.append('<span style="display:inline-block;padding:6px 10px;margin:4px;background:#eef4f7;border-radius:8px;color:#456a80;font-size:12px">تواريخ في النص المضاف: '+html.escape("، ".join(dates))+'</span>')
        link = safe_link(a.get("url"))
        action = ('<a href="'+html.escape(link, quote=True)+'" style="display:inline-block;background:#0c8177;color:#fff;padding:11px 17px;border-radius:9px;text-decoration:none;font-weight:bold;font-size:12px;margin-top:13px">فتح المصدر الرسمي</a>') if link else ""
        cards.append(
            '<tr><td style="padding:9px 24px"><div style="border:1px solid #e0ebed;background:#ffffff;border-radius:14px;padding:18px">'
            '<div style="color:#0f897f;font-size:11px;font-weight:700">الرصد '+str(index)+' · '+source+'</div>'
            '<h2 style="color:#143b4c;font-size:18px;margin:11px 0 8px">'+title+'</h2>'
            '<p style="color:#546f7a;font-size:13px;line-height:2;margin:0">'+summary+'</p>'
            +("".join(extras) and '<div style="margin-top:10px">'+''.join(extras)+'</div>' or "")
            +'<div style="font-size:11px;color:#a16a23;line-height:1.8;margin-top:10px">المعلومات أعلاه مقتطفات تحتاج مطابقة مع الدليل الرسمي، وليست إعلاناً آلياً عن نسبة جديدة.</div>'
            +action+'</div></td></tr>'
        )
    count = len(alerts)
    meta = "عرض تجريبي افتراضي" if demo else ("اختبار النظام" if test else str(count) + " إشعار رصد")
    return f"""<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#eef4f6;font-family:Tahoma,Arial,sans-serif;color:#183744">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#eef4f6"><tr><td align="center" style="padding:26px 12px">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;background:#fff;border:1px solid #dce9e9;border-radius:18px;overflow:hidden">
<tr><td style="background:#0d2f42;padding:28px 26px;color:#fff">
 <div dir="ltr" style="font-size:12px;color:#88dac8;letter-spacing:2px;font-weight:700;text-align:left">SAUDIZATION RADAR</div>
 <h1 style="font-size:26px;line-height:1.5;margin:14px 0 6px;color:#fff">{html.escape(heading)}</h1>
 <div style="font-size:12px;color:#b6d4dc">{html.escape(banner)} · {html.escape(meta)}</div>
</td></tr>
<tr><td style="padding:22px 26px 10px">
 <p style="font-size:13px;line-height:2;color:#536f79;margin:0">{html.escape(explanation)}</p>
 <p style="font-size:11px;color:#8298a2;margin-top:12px">التاريخ والوقت بتوقيت الرياض: {html.escape(date_now())}</p>
</td></tr>
{"".join(cards)}
<tr><td style="padding:20px 26px">
 <a href="{SITE}" style="display:inline-block;text-decoration:none;background:#0b746b;color:#fff;padding:12px 18px;font-size:13px;font-weight:700;border-radius:9px">فتح لوحة Saudization Radar</a>
 <p style="font-size:11px;line-height:1.9;color:#78929b;margin:18px 0 0">منصة شخصية مستقلة لمتابعة مصادر عامة، وليست تابعة للوزارة. تحقق من المصدر الرسمي قبل أي إجراء نظامي.</p>
</td></tr>
<tr><td style="background:#f3f8f8;padding:15px 26px;text-align:center;color:#6b8490;font-size:10px">SAUDIZATION RADAR · REGULATORY MONITORING</td></tr>
</table></td></tr></table></body></html>"""
