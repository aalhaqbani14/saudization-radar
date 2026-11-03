"""Monitor public HRSD pages; notify via SMTP when relevant text changes.
Uses only public data. Detection is heuristic and requires human verification.
"""
import os, sys, json, re, hashlib, smtplib, ssl, datetime, pathlib, difflib
from email.message import EmailMessage
from urllib.request import Request, urlopen
from html.parser import HTMLParser

ROOT=pathlib.Path(__file__).resolve().parent
DATA=ROOT/'data'/'alerts.json'
STATE=ROOT/'data'/'state.json'
SOURCES=[
 {'name':'أخبار الوزارة','url':'https://www.hrsd.gov.sa/media-center/news'},
 {'name':'الأدلة الإجرائية','url':'https://www.hrsd.gov.sa/knowledge-centre/decisions-and-regulations/regulation-and-procedures/evidence'},
]
KEYWORDS=('توطين','سعودة','المهن','المهنة','نسبة التوطين','saudization','localization')
class Extract(HTMLParser):
 def __init__(self):super().__init__();self.parts=[];self.skip=0
 def handle_starttag(self,tag,attrs):
  if tag in ('script','style','noscript','svg'):self.skip+=1
 def handle_endtag(self,tag):
  if tag in ('script','style','noscript','svg') and self.skip:self.skip-=1
 def handle_data(self,data):
  if not self.skip and data.strip():self.parts.append(data.strip())
def get_text(url):
 req=Request(url,headers={'User-Agent':'SaudizationRadar/1.0 (+personal public-site monitoring)','Accept-Language':'ar,en;q=0.8'})
 with urlopen(req,timeout=35) as r:
  raw=r.read(2000000).decode('utf-8','replace')
 p=Extract();p.feed(raw)
 return re.sub(r'\s+',' ',' '.join(p.parts)).strip()

def send_message(subject, body, test=False):
 """Use GitHub encrypted Actions secrets, never credentials in public files."""
 host=os.environ.get('SMTP_HOST') or 'smtp.gmail.com'
 port=int(os.environ.get('SMTP_PORT') or '465')
 user=os.environ.get('SMTP_USER')
 password=os.environ.get('SMTP_PASSWORD')
 recipient=os.environ.get('ALERT_EMAIL','')
 sender=os.environ.get('SMTP_FROM') or user
 missing=[key for key,value in [('SMTP_USER',user),('SMTP_PASSWORD',password),('ALERT_EMAIL',recipient)] if not value]
 if missing:
  notice='Email settings missing: '+', '.join(missing)+'. Configure repository Actions secrets; no email was sent.'
  if test:raise RuntimeError(notice)
  print('WARNING:',notice)
  return False
 recipients=[x.strip() for x in re.split(r'[;,]',recipient) if x.strip()]
 if not recipients or any('@' not in x or '\n' in x or '\r' in x for x in recipients):
  raise ValueError('Invalid ALERT_EMAIL recipient list')
 msg=EmailMessage()
 msg['Subject']=subject
 msg['From']=sender
 msg['To']=', '.join(recipients)
 msg.set_content(body)
 if port==465:
  with smtplib.SMTP_SSL(host,port,context=ssl.create_default_context(),timeout=30) as smtp:
   smtp.login(user,password)
   smtp.send_message(msg)
 elif port==587:
  with smtplib.SMTP(host,port,timeout=30) as smtp:
   smtp.ehlo()
   smtp.starttls(context=ssl.create_default_context())
   smtp.ehlo()
   smtp.login(user,password)
   smtp.send_message(msg)
 else:raise ValueError('Supported SMTP ports: 465 (SSL) or 587 (STARTTLS)')
 print('EMAIL_SENT:', 'test' if test else 'radar alert', 'recipient_count=',len(recipients))
 return True

def send_email(alerts):
 if not alerts:return False
 body=['مرحباً،','', 'رصد Saudization Radar تغييرات محتملة في صفحات وزارة الموارد البشرية.', 'هذه تنبيهات أولية لا تمثل قرارات نظامية مثبتة؛ تحقق من المصدر الرسمي.', '']
 for a in alerts:body.extend([a['source'],a['title'],a['summary'],a['url'],''])
 body.extend(['', 'Saudization Radar: https://aalhaqbani14.github.io/saudization-radar/'])
 return send_message(f'Saudization Radar | {len(alerts)} تحديث محتمل للتوطين', '\n'.join(body))

def send_test_email():
 """Send a genuinely labeled test without claiming an HRSD update."""
 stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
 body='''مرحباً،

هذه رسالة اختبار من Saudization Radar للتأكد من إعداد تنبيهات البريد الإلكتروني.

النوع: رسالة تجريبية فقط — لا يوجد خبر أو قرار توطين جديد في هذه الرسالة.
وقت الاختبار: {stamp}
رابط المنصة: https://aalhaqbani14.github.io/saudization-radar/

عند اكتشاف تغيير محتمل في المصادر الرسمية، سيتم إرسال تنبيه منفصل مع رابط المصدر للتحقق.
'''.format(stamp=stamp)
 return send_message('Saudization Radar | اختبار إشعارات البريد',body,test=True)

def main():
 state=json.loads(STATE.read_text(encoding='utf-8')) if STATE.exists() else {}
 db=json.loads(DATA.read_text(encoding='utf-8')) if DATA.exists() else {'alerts':[]}
 now=datetime.datetime.now(datetime.timezone.utc).isoformat();new=[];success=0
 for src in SOURCES:
  url=src['url'];name=src['name']
  try:
   content=get_text(url)
   if len(content)<100:raise ValueError('Page extraction too short')
   digest=hashlib.sha256(content.encode()).hexdigest()
   previous=state.get(url)
   if previous and previous['hash']!=digest:
    old=previous.get('text','');matcher=difflib.SequenceMatcher(None,old,content,autojunk=False)
    added=' '.join(content[j1:j2] for op,i1,i2,j1,j2 in matcher.get_opcodes() if op in ('insert','replace'))
    if any(k in added.lower() for k in KEYWORDS):
     excerpt=added[:450].strip() or 'تم تعديل الصفحة؛ راجع المصدر'
     item={'id':hashlib.sha256((url+digest).encode()).hexdigest()[:16], 'source':name,'title':'تغيير محتمل في '+name,'summary':excerpt,'url':url,'detected_at':now}
     db.setdefault('alerts',[]).insert(0,item);new.append(item)
   # First run sets baseline, no false alert
   state[url]={'hash':digest,'text':content[:150000]};success+=1
   print('Checked:',name, 'changed:',bool(previous and previous['hash']!=digest))
  except Exception as exc:print('ERROR:',name,repr(exc))
 if success:
  db['last_checked']=now;db['sources']=SOURCES;db['alerts']=db.get('alerts',[])[:200]
  DATA.write_text(json.dumps(db,ensure_ascii=False,indent=2),encoding='utf-8')
  STATE.write_text(json.dumps(state,ensure_ascii=False,indent=2),encoding='utf-8')
 if new and not send_email(new):
  # Prevent lost notifications: workflow fails before state is committed to Git.
  raise RuntimeError('New changes detected, but email credentials are missing; state not committed so notifications can retry.')
 if not success:raise RuntimeError('No sources could be checked')
if __name__=='__main__':
 if '--test-email' in sys.argv:send_test_email()
 else:main()
