"""Temporary source audit. Print only official PDF URLs and safe metadata."""
import json,re
from urllib.request import urlopen,Request
import monitor
import guide_pdf_monitor as guide
from urllib.parse import urlsplit
data=json.loads((monitor.ROOT/'data'/'decisions.json').read_text(encoding='utf-8'))
for d in data['decisions']:
 if d.get('audit',{}).get('status')=='reviewed':continue
 links=[]
 if d.get('source','').startswith('https://www.hrsd.gov.sa/') and not d['source'].split('?')[0].endswith('.pdf'):
  try:
   uri=monitor.encode_url(d['source'])
   with urlopen(Request(uri,headers={'User-Agent':'SaudizationRadar/1.0'}),timeout=35) as res:
    body=res.read(3000000).decode('utf-8','replace')
   parser=monitor.DecisionExtract(d['source']);parser.feed(body)
   text=parser.extracted_text()
   for link in sorted(parser.links):
    match=re.search(r'https://[^\s]+?\.pdf(?:\?[^\s]+)?$',link)
    if match:links.append(match.group(0).split('?',1)[0])
  except Exception as exc:print('SOURCE_ERROR',d['id'],type(exc).__name__,str(exc)[:80],flush=True)
 links=list(dict.fromkeys(([d['officialGuide']] if d.get('officialGuide') else [])+links))
 print('CANDIDATES',d['id'],d['title'],len(links),repr(links),flush=True)
 for u in links[:3]:
  try:
   blob=guide.download_pdf(u)
   pages,n=guide.extract_pages(blob)
   guide.reject_restricted_pdf(pages)
   print('PDF_VALID',d['id'],u,'pages',n,'lines',len(pages),flush=True)
  except Exception as exc:
   print('PDF_BLOCKED',d['id'],u,type(exc).__name__,str(exc)[:110],flush=True)
