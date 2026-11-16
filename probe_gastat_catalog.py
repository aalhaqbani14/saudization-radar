"""Probe both copies of the 2019 GASTAT Saudi occupational classification."""
import re, urllib.request, fitz
BASE="https://quality.kku.edu.sa/sites/quality.kku.edu.sa/files/2024-03/"
LINKS={
  "ar":BASE+"%D8%A7%D9%84%D8%AA%D8%B5%D9%86%D9%8A%D9%81%20%D8%A7%D9%84%D8%B3%D8%B9%D9%88%D8%AF%D9%8A%20%D8%A7%D9%84%D9%85%D9%88%D8%AD%D8%AF%20%D9%84%D9%84%D9%85%D9%87%D9%86%201.pdf",
  "en":BASE+"Unified%20Saudi%20Occupational%20Classification%201.pdf",
}
def fetch(url):
 r=urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0"}),timeout=65)
 return fitz.open(stream=r.read(20_000_000),filetype="pdf")
arabic_re=re.compile(r"^(.*?)\s*([0-9]{6})\s*$")
en_re=re.compile(r"^\s*([0-9]{6})\s+([A-Za-z].+)$")
def arabic(pdf):
 out={};positions={};dup=[]
 for page in range(28,min(100,len(pdf))):
  for l in pdf[page].get_text(sort=True).splitlines():
   m=arabic_re.match(l.strip())
   if not m:continue
   text=m.group(1).strip();code=m.group(2)
   if len(text)<3 or not re.search(r"[\u0621-\u064A]",text):continue
   title=" ".join(reversed(text.split()))
   if code in out and out[code]!=title:dup.append((code,out[code],title))
   out[code]=title;positions[code]=page
 return out,positions,dup
def english(pdf):
 out={};positions={};dup=[]
 for page in range(34,min(112,len(pdf))):
  for l in pdf[page].get_text(sort=True).splitlines():
   m=en_re.match(l.strip())
   if not m:continue
   code,title=m.groups();title=title.strip()
   if code in out and out[code]!=title:dup.append((code,out[code],title))
   out[code]=title;positions[code]=page
 return out,positions,dup
ar,ap,ad=arabic(fetch(LINKS["ar"]));en,ep,ed=english(fetch(LINKS["en"]))
print("RESULT AR",len(ar),"EN",len(en),"SHARED",len(ar.keys()&en.keys()),"AR_ONLY",len(ar.keys()-en.keys()),"EN_ONLY",len(en.keys()-ar.keys()))
print("DUP AR",ad[:8],"EN",ed[:8])
print("SAMPLE",[(x,ar.get(x),en.get(x)) for x in list(ar)[:12]])
print("SAMPLE_END",[(x,ar.get(x),en.get(x)) for x in list(ar)[-10:]])
print("AR_ONLY_SAMPLE",[(x,ar[x],ap[x]) for x in list(ar.keys()-en.keys())[:12]])
print("EN_ONLY_SAMPLE",[(x,en[x],ep[x]) for x in list(en.keys()-ar.keys())[:12]])
print("PER_GROUP",[(n,len([x for x in ar if x.startswith(n)]),len([x for x in en if x.startswith(n)]))for n in "0123456789"])
