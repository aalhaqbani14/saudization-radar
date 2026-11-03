"""Offline email tests: no SMTP connection and no government HTTP calls."""
import unittest
from unittest.mock import patch
from email.message import EmailMessage
import email_templates
import monitor


class TestEmailTemplates(unittest.TestCase):
    def test_test_email_has_no_fabricated_decision(self):
        body = email_templates.render(test=True)
        self.assertIn("رسالة تجريبية", body)
        self.assertIn("لا تتضمن أي بيانات", body)
        self.assertIn("Saudization Radar", body)

    def test_fictional_percentage_demo_is_clearly_labeled(self):
        body = email_templates.render(demo=True)
        plain = email_templates.plain(demo=True)
        self.assertIn("محاكاة", body)
        self.assertIn("ليس قراراً رسمياً", body)
        self.assertIn("40%", body)
        self.assertIn("60%", body)
        self.assertIn("2027-01-01", body)
        self.assertIn("افتراضي", plain)
        self.assertIn("ليست مستمدة", plain)

    def test_html_escapes_web_excerpts(self):
        items = [{
            "title": "<script>alert('x')</script>",
            "source": "وزارة الموارد البشرية",
            "summary": "<img src=x onerror=alert(1)> توطين 60% 2027-10-27",
            "url": "https://www.hrsd.gov.sa/media-center/news",
        }]
        body = email_templates.render(items)
        self.assertNotIn("<script>", body)
        self.assertNotIn("<img src=x", body)
        self.assertIn("&lt;script&gt;", body)
        self.assertIn("60%", body)
        self.assertIn("2027-10-27", body)
        self.assertIn("تحتاج", body)

    def test_external_links_blocked(self):
        self.assertIsNone(email_templates.safe_link("https://evil.example/"))
        self.assertIsNone(email_templates.safe_link("javascript:alert(1)"))
        self.assertIsNone(email_templates.safe_link("https://hrsd.gov.sa.evil.example/"))
        self.assertTrue(email_templates.safe_link("https://www.hrsd.gov.sa/media-center/news"))

    def test_plain_is_readable(self):
        message = email_templates.plain(test=True)
        self.assertIn("رسالة تجريبية", message)
        self.assertIn("https://aalhaqbani14.github.io/saudization-radar/", message)

    @patch.dict("os.environ", {
        "SMTP_HOST": "smtp.gmail.com",
        "SMTP_PORT": "465",
        "SMTP_USER": "noreply@example.com",
        "SMTP_PASSWORD": "dummy-testing-value",
        "ALERT_EMAIL": "recipient@example.com",
    }, clear=True)
    @patch("monitor.smtplib.SMTP_SSL")
    def test_multipart_mime_with_safe_sender(self, client):
        ok = monitor.send_message("test", "plain message", test=True, html_body="<p>html message</p>")
        self.assertTrue(ok)
        sent = client.return_value.__enter__.return_value.send_message.call_args.args[0]
        self.assertIsInstance(sent, EmailMessage)
        self.assertTrue(sent.is_multipart())
        self.assertIn("Saudization Radar", sent["From"])
        self.assertEqual(sent["To"], "recipient@example.com")
        html_part = sent.get_body(preferencelist=("html",))
        self.assertIn("html message", html_part.get_content())


if __name__ == "__main__":
    unittest.main()
