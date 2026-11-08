"""Send a clearly labelled one-time test alert only when SMTP secrets are configured.

The public JSON status contains NO recipient address, username, password or exception detail.
SMTP acceptance does not prove inbox delivery.
"""
import datetime
import json
import os
from pathlib import Path
import monitor

OUT=Path(__file__).resolve().parent / "data" / "email-health.json"

def probe():
    stamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
    keys=("SMTP_USER","SMTP_PASSWORD","ALERT_EMAIL")
    configured=all(bool(os.environ.get(key,"").strip()) for key in keys)
    status="needs_configuration"
    if configured:
        try:
            monitor.send_test_email()
            status="smtp_accepted"
        except Exception as exc:
            # Internal log contains only an exception class, never SMTP's exception text.
            print("EMAIL_PROBE_ERROR_TYPE:",type(exc).__name__)
            status="send_failed"
    result={
        "tested_at":stamp,
        "status":status,
        "smtp_accepted":status=="smtp_accepted",
        "recipient_delivery_confirmed":False,
        "public_notice":(
            "قبل خادم SMTP رسالة المحاكاة. يلزم تأكيد وصولها إلى صندوق الوارد يدويًا."
            if status=="smtp_accepted" else
            "تعذّر إرسال تجربة SMTP. تحقق من إعدادات البريد في أسرار المستودع وإذن الإرسال."
            if status=="send_failed" else
            "لم تُضبط جميع أسرار البريد اللازمة في GitHub Actions؛ لم تُرسل رسالة اختبار."
        )
    }
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("EMAIL_PROBE_STATUS:",status)
    return 1 if status=="send_failed" else 0

if __name__=="__main__":
    raise SystemExit(probe())
