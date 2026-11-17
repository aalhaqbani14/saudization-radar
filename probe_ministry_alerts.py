import re
from urllib.request import urlopen, Request
from html.parser import HTMLParser
from urllib.parse import quote
urls={
'project':'https://www.hrsd.gov.sa/knowledge-centre/decisions-and-regulations/regulation-and-procedures/الدليل-الإجرائي-لتوطين-مهن-إدارة-المشاريع',
'admin':'https://www.hrsd.gov.sa/knowledge-centre/decisions-and-regulations/regulation-and-procedures/الدليل-الإجرائي-لقرار-توطين-المهن-الإدارية-المساندة',
}
class Structure(HTMLParser):
 def __init__(self):
  super().__init__();self.depth=0;self.marks=[];self.current=[]
 def handle_starttag(self,tag,attrs):
  self.current.append((tag,dict(attrs)));self.depth+=1
  if tag in ('main','article','aside','h1','h2','h3','section'):
   self.marks.append((tag,dict(attrs),[ (a,b.get('id'),b.get('class')) for a,b in self.current[-5:]]))
 def handle_endtag(self,tag):
  if self.current:self.current.pop()
def main():
 for name,url in urls.items():
  uri='https://www.hrsd.gov.sa'+quote(url.split('.sa',1)[-1],safe="/%:@!$&'()*+,;=-._~")
  r=urlopen(Request(uri,headers={'User-Agent':'SaudizationRadar/1.0','Accept-Language':'ar,en;q=0.8'}),timeout=45)
  html=r.read(4000000).decode('utf-8','replace')
  print('SOURCE',name,len(html),r.status,flush=True)
  for pat in ['الدليل الإجرائي لتوطين مهن إدارة المشاريع','الدليل الإجرائي لقرار توطين مهنة طب الأسنان','الدليل الإجرائي لقرار توطين المهن الإدارية المساندة','<main','<article','related-content','views-row','region-content']:
   a=list(re.finditer(re.escape(pat),html,re.I))
   print('MATCH',name,pat,len(a),flush=True)
   for x in a[:2]: print('CONTEXT',repr(html[max(0,x.start()-330):x.start()+500]),flush=True)
  p=Structure();p.feed(html)
  print('SEMANTIC STRUCTURE',name,repr(p.marks[:85]),flush=True)
if __name__=='__main__':main()
