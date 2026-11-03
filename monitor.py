"""Monitor public HRSD pages; notify via SMTP when relevant text changes.
Uses only public data. Detection is heuristic and requires human verification.
"""
import os, json, re, hashlib, smtplib, ssl, datetime, pathlib, difflib
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
def send_email(alerts):
 host=os.environ.get('SMTP_HOST');user=os.environ.get('SMTP_USER');password=os.environ.get('SMTP_PASSWORD');recipient=os.environ.get('ALERT_EMAIL')
 if not (host and user and password and recipient):print('SMTP not configured; email skipped');return
 msg=EmailMessage();msg['Subject']=f'Saudization Radar: {len(alerts)} تحديث جديد';msg['From']=os.environ.get('SMTP_FROM',user);msg['To']=recipient
 body=['تم رصد تغييرات محتملة تتعلق بالتوطين. تحقق من المصدر الرسمي قبل الاعتماد.','']
 for a in alerts:body.extend([a['source'],a['title'],a['summary'],a['url'],''])
 msg.set_content('\n'.join(body))
 port=int(os.environ.get('SMTP_PORT','465'))
 if port==465:
  with smtplib.SMTP_SSL(host,port,context=ssl.create_default_context(),timeout=30) as smtp:smtp.login(user,password);smtp.send_message(msg)
 else:
  with smtplib.SMTP(host,port,timeout=30) as smtp:smtp.starttls(context=ssl.create_default_context());smtp.login(user,password);smtp.send_message(msg)
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
 if new:send_email(new)
 if not success:raise RuntimeError('No sources could be checked')
if __name__=='__main__':main()
