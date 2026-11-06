"""Monitor public HRSD pages; notify via SMTP when relevant text changes.
Uses only public data. Detection is heuristic and requires human verification.
"""
import os, sys, json, re, hashlib, smtplib, ssl, datetime, pathlib
from email.message import EmailMessage
from email.utils import formataddr
import email_templates
import detection
from urllib.request import Request, urlopen
from urllib.parse import urljoin, urlsplit, urlunsplit, quote
from html.parser import HTMLParser

ROOT=pathlib.Path(__file__).resolve().parent
DATA=ROOT/'data'/'alerts.json'
STATE=ROOT/'data'/'state.json'
HEALTH=ROOT/'data'/'health.json'
DAILY_REPORT=ROOT/'data'/'daily-reports.json'
EXTRACTION_VERSION=2  # Changing extraction output must reset baseline without emailing
BASE_SOURCES=[
 {'name':'أخبار الوزارة','url':'https://www.hrsd.gov.sa/media-center/news','kind':'index'},
 {'name':'الأدلة الإجرائية','url':'https://www.hrsd.gov.sa/knowledge-centre/decisions-and-regulations/regulation-and-procedures/evidence','kind':'index'},
]
def monitored_sources():
 """Monitor the official registry plus landing pages; never accept off-domain URLs."""
 registry=ROOT/'data'/'source-registry.json'
 extra=json.loads(registry.read_text(encoding='utf-8')).get('sources',[]) if registry.exists() else []
 sources=list(BASE_SOURCES)
 existing={x['url'] for x in sources}
 for record in extra:
  url=record.get('url','')
  if not email_templates.safe_link(url):
   raise ValueError('Non-HRSD monitoring source in registry')
  if url not in existing:
   sources.append({'name':'قرار: '+record.get('title','بدون عنوان'),'url':url,'kind':'decision_page'})
   existing.add(url)
 return sources
class Extract(HTMLParser):
 """Plain content with stable official document references; excludes scripts and third-party links."""
 def __init__(self,base_url):
  super().__init__();self.base_url=base_url;self.parts=[];self.skip=0
  self.anchor=None;self.links=set()
 def handle_starttag(self,tag,attrs):
  if tag in ('script','style','noscript','svg'):self.skip+=1
  if tag=='a' and not self.skip:
   href=dict(attrs).get('href','')
   try:
    url=urljoin(self.base_url,href)
    parsed=urlsplit(url)
    host=(parsed.hostname or '').lower()
    normalized=urlunsplit((parsed.scheme,parsed.netloc,parsed.path,'',''))
    is_official=parsed.scheme=='https' and (host=='hrsd.gov.sa' or host.endswith('.hrsd.gov.sa'))
    is_document=parsed.path.lower().endswith('.pdf')
    is_policy='/knowledge-centre/decisions-and-regulations/' in parsed.path
    self.anchor={'url':normalized,'label':[]} if is_official and (is_document or is_policy) else None
   except (TypeError,ValueError):
    self.anchor=None
 def handle_endtag(self,tag):
  if tag=='a' and self.anchor:
   title=' '.join(' '.join(self.anchor['label']).split())[:180]
   if title:
    self.links.add('وثيقة رسمية مرتبطة: '+title+' '+self.anchor['url'])
   self.anchor=None
  if tag in ('script','style','noscript','svg') and self.skip:self.skip-=1
 def handle_data(self,data):
  if not self.skip and data.strip():
   self.parts.append(data.strip())
   if self.anchor:self.anchor['label'].append(data.strip())
 def extracted_text(self):
  body=re.sub(r'\s+',' ',' '.join(self.parts)).strip()
  # Sorted link inventory ensures that page-link ordering changes do not fire alerts.
  return body+'\n'+'\n'.join(sorted(self.links)) if self.links else body

def encode_url(url):
 """Percent-encode Unicode URL path/query for urllib's ASCII HTTP request target."""
 parsed=urlsplit(url)
 return urlunsplit((parsed.scheme,parsed.netloc,quote(parsed.path,safe="/%:@!def get_text(url):
 req=Request(url,headers='()*+,;=-._~"),quote(parsed.query,safe="=&%:@!{'User-Agent':'SaudizationRadar/1.0 (+personal public-site monitoring)','Accept-Language':'ar,en;q=0.8'})
 with urlopen(req,timeout=35) as r:
  raw=r.read(2000000).decode('utf-8','replace')
 p=Extract(url);p.feed(raw)
 return p.extracted_text()

def send_message(subject, body, test=False, html_body=None):
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
 msg['From']=formataddr(('Saudization Radar', sender))
 msg['To']=', '.join(recipients)
 msg.set_content(body)
 if html_body:
  msg.add_alternative(html_body, subtype='html')
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
 subject=f'Saudization Radar | {len(alerts)} تغيير محتمل يحتاج مراجعة'
 return send_message(subject,email_templates.plain(alerts),html_body=email_templates.render(alerts))

def send_test_email():
 """Display a clearly fictional percentage change; never imply an HRSD decision."""
 return send_message('Saudization Radar | محاكاة تجريبية لتغيير نسبة التوطين — ليست قراراً رسمياً',
                     email_templates.plain(demo=True),
                     test=True,html_body=email_templates.render(demo=True))

def main():
 state=json.loads(STATE.read_text(encoding='utf-8')) if STATE.exists() else {}
 db=json.loads(DATA.read_text(encoding='utf-8')) if DATA.exists() else {'alerts':[]}
 now=datetime.datetime.now(datetime.timezone.utc).isoformat();new=[];review_signals=0;success=0
 results=[]
 sources=monitored_sources()
 for src in sources:
  url=src['url'];name=src['name']
  try:
   content=get_text(url)
   if len(content)<100:raise ValueError('Page extraction too short')
   digest=hashlib.sha256(content.encode()).hexdigest()
   previous=state.get(url)
   comparable=bool(previous and previous.get('extraction_version')==EXTRACTION_VERSION)
   if comparable and previous['hash']!=digest:
    item=detection.analyze_change(previous.get('text',''),content,src,now)
    if item:
     seen={a.get('id') for a in db.get('alerts',[])}
     if item['id'] not in seen:
      db.setdefault('alerts',[]).insert(0,item)
      review_signals+=1
      if item['email_worthy']:new.append(item)
      print('Review signal:',name,'priority:',item['review_priority'],'email:',item['email_worthy'])
     else:
      print('Duplicate signal skipped:',name)
    else:
     print('No relevant decision signal:',name)
   # First run sets baseline, no false alert
   state[url]={'hash':digest,'text':content[:150000],'extraction_version':EXTRACTION_VERSION};success+=1
   results.append({'name':name,'url':url,'kind':src.get('kind'),'status':'ok','changed':bool(comparable and previous['hash']!=digest),'first_baseline':not comparable})
   print('Checked:',name, 'changed:',bool(comparable and previous['hash']!=digest))
  except Exception as exc:
   results.append({'name':name,'url':url,'kind':src.get('kind'),'status':'error','error_type':type(exc).__name__})
   print('ERROR:',name,repr(exc))
 if success:
  db['last_checked']=now;db['sources']=sources;db['alerts']=db.get('alerts',[])[:200]
  DATA.write_text(json.dumps(db,ensure_ascii=False,indent=2),encoding='utf-8')
  STATE.write_text(json.dumps(state,ensure_ascii=False,indent=2),encoding='utf-8')
 # Public health telemetry only. No page text, credentials, or private data.
 # Monitoring failures do not imply that regulatory requirements are unchanged.
 health={'checked_at':now,'total_sources':len(sources),'successful_sources':success,
         'failed_sources':len(sources)-success,'signal_count':review_signals,
         'sources':results,
         'coverage_notice':'هذه حالة تشغيل الرصد فقط ولا تثبت حداثة القرارات أو اكتمال تغطية الوزارة.'}
 HEALTH.write_text(json.dumps(health,ensure_ascii=False,indent=2),encoding='utf-8')
 # Daily operational snapshot, aggregated only; never implies that no legal changes occurred.
 day=now[:10]
 daily={'date':day,'last_checked_at':now,'total_sources':len(sources),
        'successful_sources':success,'failed_sources':len(sources)-success,
        'new_review_signals':review_signals,'status':'complete' if success==len(sources) else ('partial' if success else 'failed'),
        'failed_source_names':[x['name'] for x in results if x['status']=='error'],
        'notice':'ملخص تقني للرصد؛ لا يثبت اكتمال التغطية أو عدم صدور قرارات. الإشارات تحتاج مراجعة بشرية.'}
 try:
  history=json.loads(DAILY_REPORT.read_text(encoding='utf-8')) if DAILY_REPORT.exists() else {'reports':[]}
  old=next((x for x in history.get('reports',[]) if x.get('date')==day),None)
  if old:
   daily['runs']=old.get('runs',1)+1
   daily['new_review_signals']+=old.get('new_review_signals',0)
   daily['successful_sources']=max(success,old.get('successful_sources',0))
   daily['failed_sources']=len(sources)-daily['successful_sources']
   daily['status']='complete' if daily['failed_sources']==0 else ('partial' if daily['successful_sources'] else 'failed')
  else:daily['runs']=1
  history['reports']=([daily]+[x for x in history.get('reports',[]) if x.get('date')!=day])[:90]
  history['updated_at']=now
  DAILY_REPORT.write_text(json.dumps(history,ensure_ascii=False,indent=2),encoding='utf-8')
 except (ValueError,TypeError,KeyError) as exc:
  raise RuntimeError('Daily monitoring report could not be updated') from exc

 if new and not send_email(new):
  # Prevent lost notifications: workflow fails before state is committed to Git.
  raise RuntimeError('New changes detected, but email credentials are missing; state not committed so notifications can retry.')
 if not success:raise RuntimeError('No sources could be checked')
if __name__=='__main__':
 if '--test-email' in sys.argv:send_test_email()
 else:main()
()*+,;/?-._~"),parsed.fragment))

def get_text(url):
 req=Request(encode_url(url),headers={'User-Agent':'SaudizationRadar/1.0 (+personal public-site monitoring)','Accept-Language':'ar,en;q=0.8'})
 with urlopen(req,timeout=35) as r:
  raw=r.read(2000000).decode('utf-8','replace')
 p=Extract(url);p.feed(raw)
 return p.extracted_text()

def send_message(subject, body, test=False, html_body=None):
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
 msg['From']=formataddr(('Saudization Radar', sender))
 msg['To']=', '.join(recipients)
 msg.set_content(body)
 if html_body:
  msg.add_alternative(html_body, subtype='html')
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
 subject=f'Saudization Radar | {len(alerts)} تغيير محتمل يحتاج مراجعة'
 return send_message(subject,email_templates.plain(alerts),html_body=email_templates.render(alerts))

def send_test_email():
 """Display a clearly fictional percentage change; never imply an HRSD decision."""
 return send_message('Saudization Radar | محاكاة تجريبية لتغيير نسبة التوطين — ليست قراراً رسمياً',
                     email_templates.plain(demo=True),
                     test=True,html_body=email_templates.render(demo=True))

def main():
 state=json.loads(STATE.read_text(encoding='utf-8')) if STATE.exists() else {}
 db=json.loads(DATA.read_text(encoding='utf-8')) if DATA.exists() else {'alerts':[]}
 now=datetime.datetime.now(datetime.timezone.utc).isoformat();new=[];review_signals=0;success=0
 results=[]
 sources=monitored_sources()
 for src in sources:
  url=src['url'];name=src['name']
  try:
   content=get_text(url)
   if len(content)<100:raise ValueError('Page extraction too short')
   digest=hashlib.sha256(content.encode()).hexdigest()
   previous=state.get(url)
   comparable=bool(previous and previous.get('extraction_version')==EXTRACTION_VERSION)
   if comparable and previous['hash']!=digest:
    item=detection.analyze_change(previous.get('text',''),content,src,now)
    if item:
     seen={a.get('id') for a in db.get('alerts',[])}
     if item['id'] not in seen:
      db.setdefault('alerts',[]).insert(0,item)
      review_signals+=1
      if item['email_worthy']:new.append(item)
      print('Review signal:',name,'priority:',item['review_priority'],'email:',item['email_worthy'])
     else:
      print('Duplicate signal skipped:',name)
    else:
     print('No relevant decision signal:',name)
   # First run sets baseline, no false alert
   state[url]={'hash':digest,'text':content[:150000],'extraction_version':EXTRACTION_VERSION};success+=1
   results.append({'name':name,'url':url,'kind':src.get('kind'),'status':'ok','changed':bool(comparable and previous['hash']!=digest),'first_baseline':not comparable})
   print('Checked:',name, 'changed:',bool(comparable and previous['hash']!=digest))
  except Exception as exc:
   results.append({'name':name,'url':url,'kind':src.get('kind'),'status':'error','error_type':type(exc).__name__})
   print('ERROR:',name,repr(exc))
 if success:
  db['last_checked']=now;db['sources']=sources;db['alerts']=db.get('alerts',[])[:200]
  DATA.write_text(json.dumps(db,ensure_ascii=False,indent=2),encoding='utf-8')
  STATE.write_text(json.dumps(state,ensure_ascii=False,indent=2),encoding='utf-8')
 # Public health telemetry only. No page text, credentials, or private data.
 # Monitoring failures do not imply that regulatory requirements are unchanged.
 health={'checked_at':now,'total_sources':len(sources),'successful_sources':success,
         'failed_sources':len(sources)-success,'signal_count':review_signals,
         'sources':results,
         'coverage_notice':'هذه حالة تشغيل الرصد فقط ولا تثبت حداثة القرارات أو اكتمال تغطية الوزارة.'}
 HEALTH.write_text(json.dumps(health,ensure_ascii=False,indent=2),encoding='utf-8')
 # Daily operational snapshot, aggregated only; never implies that no legal changes occurred.
 day=now[:10]
 daily={'date':day,'last_checked_at':now,'total_sources':len(sources),
        'successful_sources':success,'failed_sources':len(sources)-success,
        'new_review_signals':review_signals,'status':'complete' if success==len(sources) else ('partial' if success else 'failed'),
        'failed_source_names':[x['name'] for x in results if x['status']=='error'],
        'notice':'ملخص تقني للرصد؛ لا يثبت اكتمال التغطية أو عدم صدور قرارات. الإشارات تحتاج مراجعة بشرية.'}
 try:
  history=json.loads(DAILY_REPORT.read_text(encoding='utf-8')) if DAILY_REPORT.exists() else {'reports':[]}
  old=next((x for x in history.get('reports',[]) if x.get('date')==day),None)
  if old:
   daily['runs']=old.get('runs',1)+1
   daily['new_review_signals']+=old.get('new_review_signals',0)
   daily['successful_sources']=max(success,old.get('successful_sources',0))
   daily['failed_sources']=len(sources)-daily['successful_sources']
   daily['status']='complete' if daily['failed_sources']==0 else ('partial' if daily['successful_sources'] else 'failed')
  else:daily['runs']=1
  history['reports']=([daily]+[x for x in history.get('reports',[]) if x.get('date')!=day])[:90]
  history['updated_at']=now
  DAILY_REPORT.write_text(json.dumps(history,ensure_ascii=False,indent=2),encoding='utf-8')
 except (ValueError,TypeError,KeyError) as exc:
  raise RuntimeError('Daily monitoring report could not be updated') from exc

 if new and not send_email(new):
  # Prevent lost notifications: workflow fails before state is committed to Git.
  raise RuntimeError('New changes detected, but email credentials are missing; state not committed so notifications can retry.')
 if not success:raise RuntimeError('No sources could be checked')
if __name__=='__main__':
 if '--test-email' in sys.argv:send_test_email()
 else:main()
